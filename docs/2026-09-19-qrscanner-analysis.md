# 扫码生产（`/Qrscanner`）逆向

> 目标：把旧版**「扫码生产」页**（路由 `/Qrscanner`）逆向清楚，重点是**「设置工序」弹窗**——
> 它是 `procedure_name_color_map` / `procedure_name_order_list` 两个 localStorage 键的**唯一写入点**，
> 也是 `docs/2026-09-19-progress-*.md` 三份文档一直卡住的「工序名清单从哪来」的答案。
>
> 证据形式（全文统一）：
> - `Qrscanner-195163c4.js @NNNNN` = **原始混淆文件里的字节偏移**（不是字符偏移；该文件 72953 字节 / 71263 字符）。
> - `dec @NNNNN` = 反混淆产物 `/tmp/qr.decoded.js` 里的**字符偏移**（生成方式见 §10）。
> - `表(N)` = 解码表取值，例如 `f(449)`；表 dump 方式见 §10。
> - `文件:行号` = 旧服务端源码 `/Users/aaa/Downloads/server`。
>
> **代码块怎么读**：变量名保留反混淆后的原名（`yl`/`wl`/`El`/`ra`…），
> 但去掉了 `Vue.` 前缀、`["value"]` 下标写法、以及压缩产物里的逗号表达式等**构建噪声**；
> 凡是**字段名 / 字段路径 / 字符串字面量 / 数值 / 判断条件**，一律**逐字取自原文**，没有意译。
> 完全原样的片段另在正文里注明「原文」。
>
> 本文**不改任何既有文档**，也不动 `app/`、`backend/`。
> `docs/2026-09-19-progress-shell.md` §1 已经找到「设置工序」这个写入点 —— 本文**逐条复核了它**（结论一致），
> 并在其之上补齐了**整页骨架、扫码流程、接口清单、权限、死代码、其余四个弹窗**。

---

## 0. 结论速览

| # | 问题 | 结论 | 把握 |
|---|---|---|---|
| 1 | 这是什么页 | **车间/扫码工的手机端扫码作业页**：扫码录单 → 选工序 → 提交进度；附带扫码统计看板、标签云打印、扫码账号管理 | 已证实 |
| 2 | 入口在哪 | **桌面左侧菜单**「📱 扫码生产」、**悬浮球菜单面板**、**移动端底部「更多」浮层**三处。**移动端底部 Tab 条里没有它** | 已证实 |
| 3 | 谁能看见 | 导航项由 `we` 门控：`defaulted===3` 时隐藏。路由守卫里 **`defaulted` 不是 1/3 时（即 2 或其它）默认落地页就是 `/Qrscanner`** | 已证实 |
| 4 | 「设置工序」只给谁 | **`userinfo.defaulted === 1` 才显示按钮**（`yt`）；`sa` 内部再判一次 | 已证实 |
| 5 | 「设置工序」写什么 | 服务端 POST `SetProcedures`，body = **`{工序1:名字, 工序2:名字, …}`（槽号→工序名，15 个键）**；**颜色不上服务端** | 已证实 |
| 6 | 写到哪两个 localStorage 键 | `procedure_name_color_map` = `{工序名: 颜色}`（**含工序10**）；`procedure_name_order_list` = `[工序名,…]`（**不含工序10**，按槽号升序） | 已证实 |
| 7 | 15 槽 vs 工序名列表 | 服务端**恒返回 15 个键**；弹窗**只渲染 14 行**（工序10 被硬排除）；序号列表**最多 14 项** | 已证实 |
| 8 | 颜色从哪来 | `el-color-picker` **自由取色 + `show-alpha`**，预置 8 色。**不是固定色板** | 已证实 |
| 9 | 二维码内容 | **就是「单号」**（订单号）。打印标签时 `qrcode: String(单号)`，扫码查单按单号精确匹配 | 已证实 |
| 10 | 用摄像头还是扫码枪 | **摄像头**（`getUserMedia` + ZXing `BrowserMultiFormatReader`）。全文**没有任何 `keydown`/扫码枪键盘楔**代码 | 已证实 |
| 11 | 两块大面板是死的 | 「🔧 调试信息」(`Dt`) 与「⚙️ QR码识别高级设置」(`Tt`) 都是 `ref(false)` 且**全文无任何赋值** → 永不可见；连带「简单测试扫码」也不可达 | 已证实 |
| 12 | 与 Progress 的关系 | Progress **每次调用都现读** localStorage（`X()`/`J()`，无缓存）→ **写完不需要刷新页面** | 已证实 |

---

## 1. 这是什么页、给谁用、入口在哪

### 1.1 页面定位

`Qrscanner-195163c4.js @17657`：

```js
// 原文（v 是本作用域里解码器 f 的别名）
const _e=v(449),$e=v(316),et=Vue.defineComponent({__name:v(255),setup(n){const m=v;…
// f(449)="procedure_name_color_map"  f(316)="procedure_name_order_list"  f(255)="Qrscanner"
```

导出（`@末尾`）：`const nt = n(et, [["__scopeId","data-v-b89ab1cc"]]); export { nt as default }`。
样式在 `legacy/css/Qrscanner-4d126922.css`（10197 字节，全部带 `[data-v-b89ab1cc]`）。

一句话：**给车间扫码工用的作业页**。手机开摄像头扫门单上的二维码 → 把单号勾进「选中门单」→
从**工序下拉**里选一道工序 → 「确认」把这批单的该工序槽写成 `工序名_员工名_YYYY-MM-DD`；
另外还有扫码统计看板（门数/扇数/面积 + 单价估算）、标签云打印、以及两个管理弹窗
（「设置工序」「扫码账号管理」）。

### 1.2 三套导航里的位置

路由登记（`index-c3b16e3f.js @73817`）：

```js
{ path:"/Qrscanner", name:"Qrscanner", component:()=>u(()=>import("./Qrscanner-195163c4.js"), […]) }
```

| 导航 | 有没有 | 位置 / 文案 | 证据 |
|---|---|---|---|
| **桌面左侧 `el-menu`** | ✅ | `index:"7"`，图标 `📱`，`onClick:O` | `index-c3b16e3f.js @22071`（`…{key:7,index:"7",onClick:O}…createElementVNode(r(508),null,r(430),-1)`，`R(430)="扫码生产"`） |
| **移动端底部 Tab 条** | ❌ **没有** | 底部 Tab 只有：回执单 / 订单管理 / 画门窗 / 生产 / 进度 / 更多 | `dec @26200–26800`：六个 `class="tab-item"`，无扫码生产 |
| **移动端「更多功能」浮层** | ✅ | `class="more-menu-item"`，`onClick` 里 `O()` 后 `s.value=false` | `index-c3b16e3f.js @32859` |
| **悬浮球「菜单」面板** | ✅ | `class="assistive-menu-item"`，`onClick` 里 `O()` 后 `m.value=false` | `index-c3b16e3f.js @30210` |

跳转函数（`index-c3b16e3f.js @17852`）：

```js
O = () => { const e=R; T(), r.push(e(526)) }      // R(526) = "/Qrscanner"
```

> ⚠️ 与 `docs/2026-09-19-progress-shell.md` §0 第 2 条**不冲突**：它说的是 `/Progress` 在底部 Tab 里
> **有**（第 5 项 ⏳「进度」），这个结论我复核过，是对的。**扫码生产**才是不在 Tab 里的那个。

### 1.3 导航可见性门控（`index` chunk）

`dec @19462`（Navigation 组件的 setup）：

```js
de = Vue.ref(!0), fe = Vue.ref(!0), we = Vue.ref(!0), ve = Vue.ref(!1), …
```

`dec @20120`（`onMounted` 里按 `defaulted` 关掉一些）：

```js
const t = await A();                       // 读本地 userinfo
if (t) {
  const n = t.userinfo.defaulted;
  2 == n || 3 == n
    ? (de.value = false, 3 == n && (we.value = false, ve.value = true), 2 == n && (fe.value = false))
    : de.value = true;
}
```

| 变量 | 门控的菜单 | defaulted=1 | =2 | =3 |
|---|---|---|---|---|
| `de` | 公式、客户信息、参数设定 | ✅ | ❌ | ❌ |
| `fe` | 制作回执单、生产管理、生产进度 | ✅ | ❌ | ✅ |
| `we` | **扫码生产、画门窗** | ✅ | ✅ | ❌ |
| `ve` | 终端模式（`/terminal-orders`，且隐藏 生产进度/客户信息/参数设定/扫码生产/画门窗） | ❌ | ❌ | ✅ |

所以：**扫码生产对 `defaulted ∈ {1,2}` 开放，对 3 不开放。**

### 1.4 路由守卫：Qrscanner 是「非 1 非 3」账号的默认落地页

`index-c3b16e3f.js @82575` 附近（`router.beforeEach`，已登录 + 访问 `/login` 时）：

```js
const e = await A();
if (await on(e, n)) return;
let t = 2;
if (e && e.userinfo) t = e.userinfo.defaulted;
if (3 == t) { const t = new URLSearchParams(window.location.search),
                    r = rn(e) || t.get("receiptNo");
              n(r ? `/receipt-view/${encodeURIComponent(r)}` : "/terminal-orders") }
else n(1 === t ? "/hui" : "/Qrscanner")
```

★ **`defaulted` 不是 1 也不是 3 的账号，登录后直接落在 `/Qrscanner`。** 这是本页最实际的入口。

---

## 2. 页面骨架

根节点 `div.qr-scanner`（`E = {class:"qr-scanner"}`，CSS `padding:16px;max-width:100%;margin:65px auto 0`，
≤768px 时 `margin-top:17px`、`padding:10px`）。自上而下：

### 2.1 工具条 `div.button-group`（`C`）

CSS：`display:flex;flex-wrap:wrap;gap:10px;justify-content:center`；按钮 `min-width:100px`；≤768px 变纵向铺满。

| 序 | 文案 | el-button | 显示条件 | onClick | 证据 |
|---|---|---|---|---|---|
| 1 | **扫码录单** | `type="primary"` | `!ot`（扫码区未开） | 内联：开摄像头**连续**扫码 | `@48621` |
| 2 | **停止扫码** | `type="primary" class="confirm-btn"` | `ot` | `al` | `@48821` |
| 3 | **手动录单** | `type="primary" plain` | 总是 | `xt` | — |
| 4 | **扫码查单** | `type="success"` | 总是 | `ua` | `@49046` |
| 5 | **手动查单** | `type="success" plain` | 总是 | `At` | — |
| 6 | **设置工序** | `type="info"` | `yt`（**defaulted===1**） | `sa` | `@49350` |
| 7 | **扫码账号管理** | `type="warning"` | `dt`（**name===registrant**） | `Xt` | `@21043` |

> 1/2 互斥；`tt`（提交中）同时是 1/2/4/6/7 的 `loading`。

### 2.2 日期范围 `div.date-range-actions`（`p`）

四个 `el-button text class="range-btn"`（选中加 `.active`，蓝色加粗）：
**当天 / 本周 / 本月 / 更多**（`@50000`），onClick 分别是 `Fl("当天"|"本周"|"本月")` / `_l`。
`zl` 初值 `"当天"`。查询期间 `Bl` 为 loading。

「更多」展开区 `Nl`：

- `Pl`（`window.innerWidth <= 768`）→ `div.custom-date-picker-mobile`：**两个独立 `el-date-picker type="date"`**（开始/结束，`value-format:"YYYY-MM-DD"`，`editable:false`），`onChange` = `ta`/`la`；
- 否则 → 一个 `el-date-picker type="daterange"`，`range-separator:"至"`，`onChange = $l`。

两条路都会：日期齐全 → `ea()` 校验「开始日期不能晚于结束日期」→ `Zl("更多")` 查询。

### 2.3 「🔧 调试信息」面板 `div.debug-panel`（`z`，key:1）—— **死代码**

`Dt = Vue.ref(false)`，**全文没有任何赋值**（`grep 'Dt\[\?\.value\]\?='` 零命中）→ 永不渲染。
内容（仅存档）：扫码器显示状态 / Video 元素状态 / 媒体流状态 / ZXing 读取器 / DOM 容器，五个 `div.debug-item`。

### 2.4 「⚙️ QR码识别高级设置」面板 `div.advanced-settings-panel`（`x`，key:2）—— **死代码**

`Tt = Vue.ref(false)`，同样**零赋值**。内容（仅存档）：

- 摄像头分辨率 `el-select`（`Qt`）：`320x240(快速)` / `640x480(推荐)` / `1280x720(高清)` / `1920x1080(超清)`，**默认 640x480**
- ZXing 解码参数四个 `el-checkbox`：`TRY_HARDER`(`qt`，默认✅)、`ALSO_INVERTED`(`Kt`)、UTF-8 字符集(`Wt`)、`!PURE_BARCODE`(`Gt`，默认✅)
- 摄像头方向 `el-select`（`Rt`，默认 `environment`）：`后置/前置/自动`
- 三颗按钮：应用设置(`ia`，只弹提示「下次启动扫码时生效」)、重置默认(`Va`)、🧪 测试当前设置(`da`)

### 2.5 「🔍 简单测试扫码」区 `div.test-scanner-container`（`O`，key:4）—— **连带死代码**

`bt` **只在 `da()` 里被置 true**，而 `da` 只在死掉的高级面板里可达 → 这个区也永不可见。

### 2.6 员工名称输入 + 工序下拉

```html
<el-input v-model="sl" placeholder="请输入员工名称" class="staff-name-input" @blur="fa" />   <!-- rl 时显示 -->
<el-select v-model="il" placeholder="请选择工序" class="procedure-select" @change="pa">     <!-- 总是显示 -->
  <el-option v-for="o in dl" :label="o.label" :value="o.value" />
</el-select>
```

- `sl`（员工名称）初值：`onMounted` 里从 `localStorage.staffName` 读（`Qrscanner @40408`）；`fa()` 在 blur 时写回 / 为空则 `removeItem`。
- `dl`（工序下拉项）= `GetProcedures` 结果里 **键以「工序」开头且值非空**的项，`label` 和 `value` **都是工序名**（`Ca`，`@41792`）。
  ★ **这里不过滤工序10** —— 只要工序10 有名字，它就在下拉里可选。
- `pa()`：选中后反查槽号写入 `Vl`（`for (const [k,v] of Object.entries(gl.value)) if (v === il.value) return void (Vl.value = k)`）。

`.staff-name-input` / `.procedure-select` 都是 `width:50%`（窄屏仍是 50%，旧版没为它加媒体查询）。

### 2.7 扫码容器

```html
<div ref="scannerRef" class="scanner-container" v-show="ot"></div>
```

CSS：`width:100%;max-width:300px;height:300px;margin:1rem auto;border:1px solid #ddd;border-radius:.5rem`。
`Zt`（video 元素，`document.createElement("video")`，`width/height:100%`、`objectFit:cover`、`autoplay`、`playsInline`、`muted`）在扫码启动时被 append 进去。

### 2.8 扫码结果区 `div.scan-results`（`H`，key:5）— `Xe.length > 0` 时显示

```
<h3>选中门单数： {et2.length}个</h3>          ← ★ 显示的是「勾选数」，不是「扫到数」
<el-button type="success" class="print-btn" @click="Ba" :loading="st">打印标签</el-button>
<span style="display:inline-flex;…">
   <el-switch v-model="rt" @change="ya" size="small" />
   <span>固定标签数</span>
   <el-input-number v-if="rt" v-model="ut" :min="1" :max="99" size="small" style="width:90px" @change="ya" />
   <el-button v-if="mt === '恒泰智门'" type="primary" plain size="small" @click="wa" style="margin-left:8px">指定打印机</el-button>
</span>
<el-checkbox-group v-model="et2">
   <div class="result-item" v-for="(code,i) in Xe">
      <el-checkbox :label="code" @change="onChange(code)">{{ code }}</el-checkbox>
   </div>
</el-checkbox-group>
<div class="button-group-bottom"><el-button type="primary" @click="oa" :loading="tt">确认</el-button></div>
```

- `Xe` = 所有扫到/录入过的单号（原序）；`et2` = 勾选的子集；`w` = 去重用的同一份列表。
- 勾选框 `@change`：勾上 → 未在 `w` 里则 push；取消 → 从 `w` 里 `splice` 掉。
- `rt`/`ut`（固定标签数）持久化在 `label_quantity_enabled` / `label_quantity_value`（`@40204`），`ut` 默认 1、上限 99。
- `mt` = `userinfo.registrant`（租户名），只有租户名**正好是「恒泰智门」**才多出「指定打印机」按钮（`@57970`）。

### 2.9 统计面板 `div.process-stats-mobile`（`se`，key:6）— `pl` 时显示（查询成功后）

```
div.stats-header
  ├ div.stats-title  「扫码统计」
  ├ div.stats-subtitle {zl} · 共{Cl.length}条 [· 员工 {ul}]
  └ div.stats-actions  [导出表格(Tl)] [显示详情/隐藏详情(jl)]
div.stats-kpi-grid        ← grid-template-columns: repeat(2,minmax(0,1fr))
  ├ 卡1 总门数：Rl.totalQuantity；副行「平开{swingQuantity} · 移门{slidingQuantity}」；单价输入(xl.quantity)；「合计 {(totalQuantity*quantity).toFixed(2)}」
  ├ 卡2 总扇数：Rl.totalFans；副行「亮窗{slidingBrightFans} · 淋浴{showerFans}」；单价(xl.fans)
  └ 卡3 总面积：Rl.totalArea.toFixed(2)；副行「㎡（平开… · 移门…）」；单价(xl.area)
div.procedure-stats-section 「按工序统计」
  └ div.procedure-stats-card × N（Jl）
       工序显示名 Hl(name)  →  "工序3-钻孔"（有名字时），否则 "工序3"
       三行 metric-row：门数/扇数/面积，各带单价 el-input-number + 「= 合计」
       无数据 → 「暂无工序统计数据」
[v-if Ml] div.detail-orders-section 「订单详情」
  └ 每单一张卡 div.order-item：标题「订单 N」，下面按 Ma 顺序逐字段
       div.result-field > span.field-label「标签:」 + span.field-value「值」
       ★ 值 == null / === 0 / === "" 的字段**整行不渲染**
```

`Ma`（`@42385`）26 列，顺序即显示顺序：

```
查询员工, 客户, 日期, 扫码日期, 型材, 安装地址, 备注, 生产进度, 门洞宽, 门洞高,
墙厚, 吊脚, 亮窗总高, 亮窗数量, 扇数, 开向, 颜色, 底玻, 面玻, 玻璃厚,
套线种类, 轨道种类, 边封数, 轨道长, 数量, 平方数
```

`aa(key,val)`：只有 `key === "日期"` 时把值格式化成 `YYYY-MM-DD`，其它原样。

> 注意每行数据被塞了一个额外字段 `查询员工`：`Cl.value = e.map(r => ({...r, "查询员工": ul.value}))` ——
> 它不在服务端返回里，是前端补的，所以「导出表格」和「订单详情」都能显示它。

### 2.10 四个弹窗（按渲染顺序）

| # | 标题 | 绑定 | 宽度 | 触发 |
|---|---|---|---|---|
| 1 | 指定打印机 | `ct` | 420px | `mt==="恒泰智门"` 时的 `wa()` |
| 2 | **设置工序** | `ml` | 90%（`close-on-click-modal=false`） | 工具条按钮 `sa()` |
| 3 | 扫码账号管理 | `wt` | 90%（`close-on-click-modal=false`） | 工具条按钮 `Xt()` |
| 4 | 手动录入单号 / 手动查单 | `vt` | 90%（`close-on-click-modal=false`） | `xt()` / `At()` |

---

## 3. 扫码流程

### 3.1 二维码内容 = **单号**

写二维码的地方在标签打印（`za`，`@43896`）：

```js
const e4 = { qrcode: String(t3["单号"] || ""), client: …, door: "型材:"+…, size: …, color:"颜色:"+…,
             lockway:"开向:"+…, remark:"备注:"+…, orderID: t3["单号"] || "", address:"地址:"+…,
             glass:"玻璃:"+底玻+"-"+面玻, package: l3+"-"+(n4+1) };
```

读的地方三处都把它当**单号**用：

```js
// 扫码查单 / 手动查单（It @19614 与 ua @36583）
fetch("https://www.samrtdoor.com.cn/1?param1=getScanQRcode&param2=" + ds + "&param3=" + 扫到的文本)
```

旧服务端 `progress.service.ts:511 getScanQrCode()` 也是拿 `param3` 去 `row['单号']` 做**精确匹配**（trim 后 `Set.has`）。

### 3.2 摄像头（不是扫码枪）

`ol()`（`@` 环境自检）→ 三个前置条件，缺一就往 `errors` 里塞：

```
"https:" !== location.protocol && hostname !== "localhost" && hostname !== "127.0.0.1" → "需要HTTPS环境才能访问摄像头"
!navigator.mediaDevices                                                              → "浏览器不支持MediaDevices API"
!navigator.mediaDevices?.getUserMedia                                                → "浏览器不支持getUserMedia API"
!navigator.mediaDevices?.enumerateDevices                                            → "浏览器不支持enumerateDevices API"
```

`g()`（取流，`Qrscanner @` 模块头 `const g=async(e={})=>{…}`）：
Cordova 下先 `deviceready` + `cordova.plugins.permissions.checkPermission/requestPermission(CAMERA)`，
然后 `navigator.mediaDevices.getUserMedia(l)`（`l` 默认 `{video:{width:{ideal:640},height:{ideal:480},facingMode:"environment"}}`）。
拿不到就抛 `"浏览器不支持摄像头访问"`。

ZXing（`vue-ade658be.js` 的 `i=DecodeHintType` / `j=BarcodeFormat` / `k=BrowserMultiFormatReader`）：

```js
const r3 = new Map();
r3.set(e.POSSIBLE_FORMATS, [t.QR_CODE]);
r3.set(e.TRY_HARDER, true);
Jt = new l(r3);                                   // BrowserMultiFormatReader
await Jt.decodeFromVideoDevice(null, Zt, cb)      // Zt = video 元素
```

★ **全文没有 `keydown` / `keypress` / `onkeypress` / 任何键盘缓冲** → **不支持扫码枪键盘楔**，只走摄像头。

### 3.3 三条扫码/录入路径

**(a) 扫码录单（工具条第 1 颗，内联 handler `@48621`）**

1. `ot=true`（露出扫码容器）、`nt2=true`（**连续模式**标记）、`tt=true`；
2. `ol()` 环境自检 → 不过就报错并收起；
3. `ll()` 先清一遍旧流；`y.value.innerHTML=""`，新建 `<video>` append 进去；
4. **挑后置摄像头**：`navigator.mediaDevices.enumerateDevices()` 过滤 `kind==="videoinput"`，
   默认取第一个，然后遍历找 `label.toLowerCase()` 含 `back` / `rear` / `environment` 的换上去
   （★ 但最后取流用的是 `facingMode:"environment"`，挑出来的 `deviceId` **没有被用上** —— 选了却不用，
   见 §9 不确定清单）；
5. 等 `canplay`（5 秒超时抛「Video播放超时」）→ `decodeFromVideoDevice`；
6. 每解到一个码：`getText()` → `!w.includes(t3) && (na(t3), 提示「识别到新二维码: …」)`；
   `nt2` 为 true 所以**不停止**，可连着扫多个单号。

**(b) 扫码查单（工具条第 4 颗，`ua` `@36583`）**

- 先判 `1 === userinfo.defaulted`，否则 `ElMessage.error("您没有权限进行工序设置")`（★ 文案是错的，复用了工序设置的提示）；
- 开摄像头（流程同上，但用局部 `Jt`/`Zt`）；
- 解到**第一个**码 → `await al()` **立刻停摄像头** → 提示「识别到二维码: …」→ 调 `getScanQRcode`；
- `code===200` → `Cl = data || []`、`pl=true`（展开统计面板）、`Ml=false`（收起详情）。

**(c) 手动录单 / 手动查单（`xt` / `At` → 弹窗 → `It` `@19614`）**

先 `ot && await al()`（关摄像头），清空 `pt`，再：

```js
const t = new Date(), l = t.getMonth() + 1;
l >= 2 && l <= 11 ? (pt.year = String(t.getFullYear()).slice(-2), kt.value = true)
                  : (pt.year = "", kt.value = false);
Pt.value = "entry"; vt.value = true          // At 里是 Pt.value = "query"
```

- `kt` = 显示提示「默认预录入当前年份，请根据实际录入」。**只在 2–11 月预填年份**（1 月/12 月要手选，跨年边界）。
- 弹窗字段：`单号`(`pt.number`，`maxlength=10`，`onInput=zt` 只留数字)、`年`(`el-select` 只有一个 option = 当前 YY，`filterable allow-create`)、`月`(同上，MM)、`日`(`el-input` `maxlength=2`，`onInput=ht` 只留数字)。
- 校验：日不能大于当月最大天数（`Nt()` 算，2 月按闰年），月不能 > 12。
- 预览 `Bt` = `${number||"___"}-${year||"__"}/${month||"__"}/${day||"__"}`。
- 点确认（`It`）：拼 `o2 = number + "-" + year(纯数字) + "/" + Mt(month) + "/" + Mt(day)`（`Mt` 补零到 2 位）；
  - `Pt==="query"` → 调 `getScanQRcode`（同 (b)）；
  - 否则 → **只本地 `na(o2)`** 加进列表，提示「已录入单号: …」，**不调任何接口**。

### 3.4 提交进度（「确认」`oa` `@34003`）

```js
if (et2.value.length === 0) → "没有扫描结果可提交"
else if (sl.value === "")   → "请先输入员工名称"
else if (il.value === "")   → "请先选择工序"
else {
  al(); ot.value = false;
  const ds = userinfo.ds, slot = Vl.value;
  const val = il.value + "_" + sl.value + "_" + new Date().toISOString().split("T")[0];
  await fetch(`…?param1=updataProgress&param2=${ds}&param3=${slot}&param4=${val}`,
              { method:"POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify(et2.value) })         // body = 勾选的单号数组
  200 === code ? success("提交成功") : error(message || "提交失败")
}
finally { w/Xe/et2 全清空 }
```

★ `param3` 是**槽号**（如 `工序3`），`param4` 是三段值 `工序名_员工名_YYYY-MM-DD`（`YYYY-MM-DD` 是 **UTC** 日期，
`toISOString()` 而不是本地日期 —— 晚 8 点以后在东八区会写到**第二天**，旧版的既有毛病，见 §9）。

### 3.5 打印标签（`Ba` `@43145` → `za` `@43896`）

1. 前置：`et2.length > 0`，否则「没有选中的单号可打印」；
2. `POST getLabelData&param2=ds`，body = `JSON.stringify(et2)`（单号数组）→ `data` 为行数组；
3. `za(data)`：
   - 读租户配置 `V2.registrant.ping_tabs` / `.diao_tabs`（`.sheets` / `.add` / `.add_2`）；
   - 每行算**标签张数** `l3`：默认 `数量`（缺省 1）；有「扇数」时按扇型乘 `N*sheets+1`；
     `亮窗总高>0` 再加 `ping_tabs.add`、`套线单价>0` 再加 `diao_tabs.add`；
     **按租户名的硬编码特例**：`名典门业`/`名扬门业` `-1`、`鑫隆迪门厂` 折叠扇数强制 1、
     `美居门业有限公司` 恒 1、型材含 `哑口套` → `l3 = 数量`、型材含 `+0` → `l3 -= 1`；
     `rt`（固定标签数）开着时 `l3 = ut`；
   - 每张标签构造 `{qrcode, client, door, size, color, lockway, remark, orderID, address, glass, package}`，
     其中 `size = "尺寸:门洞高*门洞宽"`，墙厚/吊脚/亮窗总高 >0 才追加 `*值`；
   - `d.transitPrintSingle(templateId, rows, {silent:true, printer, copies, color:true})` ——
     `mutilPrintService` 的**云打印**（走 hiprint socket 推给客户端），失败只 `warning("云打印失败")`；
   - `templateId = registrant.template.lable`，`printer = localStorage.qr_label_printer || registrant.pagesize.lable`，
     `copies = registrant.copy.lable`。

### 3.6 导出表格（`Tl` `@26506`）

纯前端 CSV（`﻿` BOM + `text/csv;charset=utf-8`，文件名 `扫码统计_YYYY-MM-DD.csv`），两段：

```
扫码统计
工序,门数,门数单价,门数合计,扇数,扇数单价,扇数合计,面积,面积单价,面积合计
<每道工序一行，取自 Jl>
汇总,<totalQuantity>,<xl.quantity>,…,<totalArea>,<xl.area>,…
<空行>
订单详情
序号,<Ma 的 26 个 label>
<每单一行，aa(key,value) 格式化值>
```

字段一律 `'"' + String(v).replace(/"/g,'""') + '"'` 转义。

---

## 4. 【重点】「设置工序」弹窗

### 4.1 界面

**打开**：工具条 `el-button type="info"` 「设置工序」，**`yt` 为 true 时才有**（`yt` 见 §6）。`onClick = sa`（`@34945`）。

```js
sa = async () => {                                   // Qrscanner-195163c4.js @34945
  const t = await a();
  if (!t) return void ElMessage.error("无法获取用户数据");
  if (1 === t.userinfo.defaulted) {                  // ★ 这里又判了一次
    lt.value = true;
    try {
      const reg = (await a()).userinfo.registrant;
      const r = await fetch("…?param1=GetProcedures&param2=" + reg);   // @35227
      const d = await r.json();
      if (200 === d.code && d.data) {
        const t4 = (() => { const s = localStorage.getItem(_e);
                            if (!s) return {};
                            const o = JSON.parse(s);
                            return o && typeof o === "object" ? o : {} })();   // 颜色表，坏数据→{}
        for (const k in d.data) {
          yl[k] = d.data[k];                                        // 槽号 → 工序名
          const nm = typeof d.data[k] === "string" ? d.data[k].trim() : "";
          wl[k] = nm && t4[nm] ? t4[nm] : "#FFFFFF";                 // ★ 颜色按「工序名」反查
        }
        ml.value = true;
      } else ElMessage.error(d.message || "获取工序信息失败");
    } catch (e) { ElMessage.error("获取工序信息出错: " + …) }
    finally { lt.value = false }
  } else ElMessage.error("您没有权限进行工序设置");
}
```

**渲染**（`dec @63295` 起，对应原始文件 `Qrscanner @60439`；下面这段为可读性按 render 结构缩进改写，字段名与属性逐字取自原文）：

```
<el-dialog v-model="ml" title="设置工序" width="90%" :close-on-click-modal="false">
  <div class="procedure-form">                     ← max-height:60vh; overflow-y:auto
    <el-form :model="yl" label-width="80px">
      <el-form-item v-for="slot in El" :key="slot" :label="slot">        ← slot 就是 "工序N"
        <div class="procedure-setting-row">                              ← display:flex; align-items:center; gap:12px
          <el-input        v-model="yl[slot]" placeholder="请输入工序名称" />   ← .el-input{flex:1}
          <el-color-picker v-model="wl[slot]" show-alpha :predefine="vl" />
        </div>
      </el-form-item>
    </el-form>
  </div>
  #footer
    <span class="dialog-footer">
      <el-button type="warning" plain @click="fl">一键重置颜色</el-button>
      <el-button @click="ml=false">取消</el-button>
      <el-button type="primary" @click="ra" :loading="tt">确认</el-button>
    </span>
</el-dialog>
```

窄屏（≤768px）CSS：`el-dialog` 强制 `width:95%!important;margin:0 auto!important`；
`el-form-item__label` 改为块级左对齐；`el-form-item` 间距 15px。

### 4.2 初值从哪来

| 变量 | 含义 | 初值 |
|---|---|---|
| `yl` | **槽号 → 工序名**（`Vue.reactive({})`，`@25238`） | `GetProcedures` 返回的 `data` 逐键拷入。**不预先清空** |
| `wl` | 槽号 → 颜色（`Vue.reactive({})`） | `localStorage.procedure_name_color_map[该槽的工序名] ?? "#FFFFFF"` |
| `El` | 弹窗渲染的槽列表（computed，`@25417`） | `Object.keys(yl).filter(k => k !== "工序10").sort(按槽号数字升序)` |
| `vl` | 取色器预置色（`@25302`） | `["#67C23A","#409EFF","#E6A23C","#F56C6C","#9A66E4","#13C2C2","#95A5A6","#FFFFFF"]` |

`El` 原文（`Qrscanner @25417–25460`）：

```js
El = Vue.computed(() => Object.keys(yl)
      .filter(t => t !== e(420))                                 // e(420) === "工序10"
      .sort((a,b) => (parseInt(a.replace("工序",""))||0) - (parseInt(b.replace("工序",""))||0)))
```

### 4.3 「确认」到底写什么、写到哪

`ra`（`Qrscanner @35793`）逐段：

```js
ra = async () => {
  tt.value = true;
  try {
    const t = await a();
    if (!t) return ElMessage.error("无法获取用户数据"), void (tt.value = false);
    const reg = t.userinfo.registrant;
    // ① 上服务端：body = yl 本身（槽号 → 工序名）
    const resp = await fetch("…?param1=SetProcedures&param2=" + reg, {     // @35963
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(yl),
    });
    const d = await resp.json();
    if (200 === d.code) {
      // ② 本地颜色表：遍历 yl 的【全部键，含工序10】
      const colorMap = {};
      Object.keys(yl).forEach(k => {
        const name  = (yl[k] || "").trim();
        const color = (wl[k] || "").trim();
        if (name && color) colorMap[name] = color;
      });
      (m => localStorage.setItem("procedure_name_color_map", JSON.stringify(m)))(colorMap);
      // ③ 本地顺序表：只取 El（【不含工序10】），按槽号升序
      const orderList = El.value.map(k => (yl[k] || "").trim()).filter(Boolean);
      localStorage.setItem("procedure_name_order_list", JSON.stringify(orderList));
      ElMessage.success("工序设置保存成功");
      ml.value = false;
    } else ElMessage.error(d.message || "工序设置保存失败");
  } catch (e) { ElMessage.error("保存工序设置出错: " + …) }
  finally { tt.value = false }
}
```

**写到哪 —— 一张表说清：**

| 目标 | 内容 | 规则 |
|---|---|---|
| `POST …/1?param1=SetProcedures&param2=<registrant>`（body 是 JSON） | `{ "工序1":"下料", "工序2":"组装", … , "工序15":"" }` —— **槽号 → 工序名，15 个键** | 就是 `yl` 原样。**颜色一个字节都不传** |
| `localStorage["procedure_name_color_map"]` | `{ "下料":"#67C23A", … }`（**工序名 → 颜色**） | 遍历 `yl` 的**全部键（含工序10）**；名和色都 `trim()` 后非空才进表 |
| `localStorage["procedure_name_order_list"]` | `["下料","组装",…]`（**工序名数组**） | 只取 `El`（**排掉工序10**），按槽号升序，`trim()` 后 `filter(Boolean)` |

★ **两个键的「含/不含工序10」是不一致的**：颜色表含，顺序表不含。前者是 `yl` 的全键遍历，
后者是 `El` 的遍历。这不是笔误可能的范围 —— 两处写法不同、语义也确实不同。

### 4.4 15 个槽 vs 工序名列表；「排除工序10」是怎么回事

**(a) 槽永远是 15 个。** 旧服务端 `auth.service.ts:295 getProcedures()`：

```ts
const result: Record<string, string> = {};
for (let i = 1; i <= 15; i++) result[`工序${i}`] = '';      // ★ 先铺 15 个空槽
for (const p of procedures) if (p.orderIndex) result[`工序${p.orderIndex}`] = p.name;
```

所以前端 `for (const k in d.data)` 一定拿到 `工序1..工序15` 十五个键。
**弹窗因此渲染 15 − 1 = 14 行**（`工序1..工序9`、`工序11..工序15`）。

**(b) 服务端存的是「槽」。** `SetProcedures`（`legacy-dispatch.ts:834` → `progress.service.ts:859 setProcedures`）
按 `工序N` 解析出 `orderIndex = N`，**名字为空即删行**（`processSlot` 里 `if (!name) { delete }`）。
所以「清空某个槽的名字」= 服务端把这个槽删掉。

**(c) 为什么排掉工序10。** `工序10` 是 **Progress 页「回款」的固定槽**：
`docs/2026-09-19-progress-analysis.md:248` 记着 Progress 的代码是

```js
if (!T['回款']) { U.push('回款'); T['回款'] = '工序10' }     // 回款兜底到工序10
```

而服务端 `updateProgress` 对 `工序10` 走 **merge**（其余 14 槽是覆盖），两处特判是耦合的。
**「设置工序」不让你碰工序10，就是为了别把「回款」这个槽改名/改色改坏。**
（★ 这条「为什么」是**推断**，旧版没有注释 —— 见 §9 不确定清单第 3 条。）

**(d) 但「工序下拉」**（§2.6 的 `dl`）**不过滤工序10**，两条路径的数据源不同：

```js
// Ca @41792 —— 工序下拉的选项，只要求「键以工序开头 + 值非空」
dl.value = Object.entries(o2.data)
  .filter(([k, v]) => k.startsWith("工序") && v)
  .map(([k, v]) => ({ label: v, value: v }))
```

→ 只要工序10 有名字，它在**下拉里可选、能提交进度**；只是**不能在「设置工序」里改名改色**。

### 4.5 颜色：自由取色，不是固定色板

`<el-color-picker show-alpha :predefine="vl">` —— `show-alpha` 支持透明度，`predefine` 只是 8 个**快捷色块**，
用户可以点色板任意取色。所以 `procedure_name_color_map` 里出现的值**不限于那 8 个**。

「一键重置颜色」(`fl` `@25368`)：

```js
fl = () => { El.value.forEach(t => { wl[t] = "#FFFFFF" }) }      // ★ 只重置 El（14 个），不碰工序10
```

### 4.6 三个已知的坑（旧版行为，值得在新版避开）

1. **颜色表的键是「工序名」不是槽号** → **改名字就丢颜色**。
   `sa` 里 `wl[k] = t4[nm]`，`nm` 是**新**名字；改过名之后按新名查不到旧颜色 → 回落 `#FFFFFF`。
2. **两个槽改成同名会互相覆盖。** `colorMap[name] = color` 是对象赋值，后者胜；
   `orderList` 则会出现两个同名项。
3. **`yl` 不清空就写入。** `sa` 只做 `for (const k in d.data) yl[k] = …`，没有 `yl = {}`。
   若服务端某次返回的键变少，**上一次的残留键会留在 `yl` 里一并提交**。正常情况（恒 15 键）不会触发。

---

## 5. 数据来源（接口逐条）

Base URL 全部硬编码：`https://www.samrtdoor.com.cn/1?param1=<动作>&param2=…`。
`param2` 在**业务接口**里一律是 `userinfo.ds`，在**配置接口**（工序）里是 `userinfo.registrant` ——
两把租户键，见 §8.2。

| # | 用途 | `param1` | 参数 | 方法 / body | 调用点 | 服务端 |
|---|---|---|---|---|---|---|
| 1 | 读工序清单 | `GetProcedures` | `param2=registrant` | GET | `sa`（`@35227`）、`Ca`（`@41933`） | `legacy-dispatch.ts:642` → `auth.service.ts:295` |
| 2 | **写工序** | `SetProcedures` | `param2=registrant` | **POST**，body = `yl`（槽→名） | `ra`（`@35963`） | `legacy-dispatch.ts:834` → `progress.service.ts:859` |
| 3 | 扫码/手动查单 | `getScanQRcode` | `param2=ds`，`param3=单号` | GET | `It`（`@20197`）、`ua`（`@37600`） | `legacy-dispatch.ts:789` → `progress.service.ts:511` |
| 4 | 扫码统计 | `getProcessCounts` | `param2=ds`，`param3=员工号/名`，`param4=当天\|本周\|本月\|"起,止"` | GET | `Zl`（`@32337`） | `legacy-dispatch.ts:790` → `progress.service.ts:558` |
| 5 | 提交进度 | `updataProgress` | `param2=ds`，`param3=工序槽`，`param4=工序名_员工_日期` | **POST**，body = 单号数组 | `oa`（`@34324`） | `legacy-dispatch.ts:791` → `progress.service.ts:598` |
| 6 | 标签数据 | `getLabelData` | `param2=ds` | **POST**，body = 单号数组 | `Ba`（`@43314`） | `legacy-dispatch.ts:783` → `progress.service.ts:490` |
| 7 | 加扫码账号 | `AddScanner` | `param2=ds`（`encodeURIComponent`）、`param3=registrant`、`param4=registrant+后缀`、`param5=密码` | GET | `_t`（`@21807`） | `legacy-dispatch.ts:1073` → `scanner.service` |
| 8 | 删扫码账号 | `DeleteScanner` | `param2=ds`、`param3=registrant+后缀` | GET | `$t`（`@23414`） | `legacy-dispatch.ts:1081` → `scanner.service` |

### 5.1 返回结构

| 接口 | 成功返回 | 失败 |
|---|---|---|
| `GetProcedures` | `{ code:200, data:{ "工序1":"", …, "工序15":"" } }`（**恒 15 键**） | `code!==200` → `d.message \|\| "获取工序信息失败"` |
| `SetProcedures` | `{ code:200, message:"工序设置保存成功" }` | `d.message \|\| "工序设置保存失败"` |
| `getScanQRcode` | `{ code:200, data:[ 行… ] }`；行是「门行」对象，键即 `Ma` 里的字段名 + `单号` | 服务端找不到行时给 `{code:404,data:[],message:"未找到相关订单"}` → 前端走 `error` 分支 |
| `getProcessCounts` | `{ code:200, data:{ progressData:[ 行… ] } }` | 缺参给 500；日期不合法给 400 |
| `updataProgress` | `{ code:200 }` | `d.message \|\| "提交失败"` |
| `getLabelData` | `{ code:200, data:[ 行… ] }` | `d.message \|\| "未找到标签数据"` |
| `AddScanner` / `DeleteScanner` | `{ code:200, message }` | 同左 |

### 5.2 `getProcessCounts` 的 `param3` / `param4` 口径

```js
const u2 = String(sl.value || "").trim();                        // 员工名称输入框
const i2 = u2 || (s2 && s2 !== r2 ? s2 : "1");                   // s2=userinfo.name, r2=userinfo.registrant
cl.value = i2;  ul.value = u2 || s2;                             // ul 只用于显示「· 员工 X」
```

- 输入框有值 → 按它查；
- 否则若 `name !== registrant`（子账号）→ 按 `name` 查；
- 否则 → 传字面量 **`"1"`**，服务端 `getProcessCounts` 里 `if (operatorName !== '1' && scanEmployee !== operatorName) continue`
  → **`"1"` 是「全部员工」的哨兵值**。

`param4` 前端传的是**字面标签**（`当天`/`本周`/`本月`）或 `"起,止"`；由**服务端** `resolveDateLabel()` 换算成真实日期
（`当天` → `今天,今天`；`本周` → **周一**到`今天`；`本月` → 月初到今天）。

### 5.3 扫码账号管理弹窗（`wt`，`_t` / `$t`）

- 前缀：`Ut = computed(() => String(mt.value || "").trim() || "registrant")` —— 显示成 `<租户名前缀>` + 员工名输入框；
- 添加：校验 `i(l2)`（`passwordStrength`：**长度 8–20、必须同时含大写/小写/数字/特殊符号**），
  不通过就报 `V`（`"密码至少8位，必须同时包含大写字母、小写字母、数字和特殊符号"`）；
  再校验 `name === registrant`（否则「您没有扫码账号管理权限」）；
  `username = registrant + 后缀`，然后 `AddScanner&param2=ds&param3=registrant&param4=username&param5=password`；
  成功后 `ElMessageBox.alert` 明文显示账号+密码，并**尝试写系统剪贴板**（`navigator.clipboard.writeText`，
  失败回落 `textarea + execCommand("copy")`），提示「已复制账号密码，可直接到微信进行粘贴」。
- 删除：`DeleteScanner&param2=ds&param3=registrant+后缀`。

---

## 6. 权限

### 6.1 页面内的四处 `userinfo` 判断

| 变量 | 条件 | 控制 | 代码 |
|---|---|---|---|
| `yt` | `Number(userinfo.defaulted) === 1` | **「设置工序」按钮**是否显示 | `Ft()`（`@` 组件头后段），`dec @22266` 是唯一赋值点 |
| `dt` | `name && registrant && name === registrant` | **「扫码账号管理」按钮**是否显示 | `Ft()` |
| `rl` | `name && registrant && (name === registrant \|\| name === registrant + "生产")` | **「员工名称」输入框**是否显示 | `Ea()`（`@41386`）+ `Zl()`（`@32337`）都赋这个值，公式相同 |
| `Vl` | 由 `il` 反查 `gl` 得到 | 提交时用的槽号 | `pa()` |

`Ea()` 里还有一段：`rl` 为 false 时自动推员工名 ——
`if (name.startsWith(registrant)) s2 = name.slice(registrant.length).trim()`，写进 `sl` 并存 localStorage。
即：**子账号（`name = 租户名 + 员工名`）自动从账号名里剥出员工名；主账号要手填。**

### 6.2 函数内部再判一次（重复门控）

| 函数 | 判断 | 不通过的提示 |
|---|---|---|
| `sa`（设置工序） | `1 === userinfo.defaulted` | `"您没有权限进行工序设置"` |
| `ua`（扫码查单） | `1 === userinfo.defaulted` | `"您没有权限进行工序设置"` ★ **文案串了** |
| `Xt`（扫码账号管理入口） | `dt` | `"您没有扫码账号管理权限"` |
| 扫码录单（工具条内联 handler） | **没有任何 defaulted 检查** | — |

`defaulted` 语义（沿用 `docs/2026-09-19-progress-shell.md` §0 第 3 条）：
**1 = 车间（默认密码）账号、2 = 扫码账号、3 = 终端账号、0/其它 = 普通 PC 账号**；
`3` 的写入点在旧服务端源码里找不到（那条结论保持「半证实」）。

### 6.3 汇总：谁能做什么

| | `defaulted=1` | `=2` | `=3` | 其它 |
|---|---|---|---|---|
| 导航里有「扫码生产」 | ✅ | ✅ | ❌ | ✅ |
| 登录后默认落地页 | `/hui` | `/Qrscanner` | `/terminal-orders` | `/Qrscanner` |
| 扫码录单 / 手动录单 | ✅ | ✅ | （无入口） | ✅ |
| 扫码查单 / 手动查单 | ✅ | ❌ 提示无权限 | （无入口） | ❌ |
| **设置工序** | ✅ | ❌ | （无入口） | ❌ |
| 扫码账号管理 | 仅当 `name===registrant` | 同上（一般 `name===registrant`，因为扫码账号本身是子账号，`name = registrant+后缀` → 按钮不显示） | — | 同 |

> ⚠️ 「扫码账号管理」按钮对**子账号**（`name = registrant + 后缀`）**不显示** —— 也就是说，
> 一个扫码账号登进来是**看不到**这个按钮的；只有租户主账号能管理扫码账号。这是读代码的结论，未实测。

---

## 7. 与 Progress 的关系

### 7.1 谁读这两个键

| 键 | 写 | 读 |
|---|---|---|
| `procedure_name_color_map` | **只有 Qrscanner 的 `ra`** | Progress（`Vl`）、Qrscanner 自己的 `sa`（当颜色初值） |
| `procedure_name_order_list` | **只有 Qrscanner 的 `ra`** | Progress（`wl`）、Qrscanner 自己没用 |

（全仓 `grep -rn "procedure_name_color_map|procedure_name_order_list"` 只命中：Qrscanner chunk、Progress chunk、
以及 `docs/2026-09-19-progress-{shell,analysis}.md`。**setting 页没有** —— 与 progress-shell §1 一致。）

> ⚠️ **别用 `grep _e` 找这两个键** —— render 函数里有
> `const _e = Vue.resolveComponent("el-dialog"), $e = Vue.resolveComponent("el-color-picker")`
> （`dec @49368`），**把模块级的两个键常量遮蔽掉了**。这和 §10.2 那个 `m` 撞名是同一类坑：
> 这个包的可读名字很少，各种作用域互相遮蔽。要定位键的真实使用点，只看 `sa`（`dec @37063`）和 `ra`（`dec @38080`/`@38204`）这两处。

Progress 侧（`Progress-f4bdef35.js`，`dec @67784` 声明）：

```js
const Vl = "procedure_name_color_map", wl = "procedure_name_order_list", yl = "__unproduced__";
```

两个读取函数（`dec @73130` / `@73260`）：

```js
X = () => { try { const t = localStorage.getItem(Vl); if (!t) return {};
                  const l = JSON.parse(t); return l && typeof l === "object" ? l : {} }
            catch { return {} } }                        // 工序名 → 颜色
J = (text) => { const l = String(text||"").trim(); if (!l) return null;
                const a = X();
                const o = (() => { try { const t = localStorage.getItem(wl); if (!t) return [];
                                         const l = JSON.parse(t); return Array.isArray(l) ? l : [] }
                                   catch { return [] } })();
                if (o.length > 0) {
                  for (let e = o.length - 1; e >= 0; e--) {          // ★ 从后往前
                    const n = o[e];
                    if (n && a[n] && l.includes(n)) return a[n]      // 第一个「出现在进度串里且有颜色」的名字
                  }
                  return null
                }
                …（无顺序表时的兜底） }
```

### 7.2 改了工序名之后 Progress 要不要刷新？

**不需要刷新页面。** 两个函数都是**每次调用现场 `localStorage.getItem`**，没有任何模块级缓存。
Progress 是在渲染/解析每行「生产进度」串时调 `J(text)`，所以：

- 如果你**在另一个标签页**改的工序 → 回到 Progress 标签页后，下一次重渲染（切页/改筛选/任何响应式更新）就会用新值；
  没有任何 `storage` 事件监听，所以不会「自动」重绘 —— 保守做法是切走再切回。
- 如果**同一个 SPA 会话**从 `/Qrscanner` 走到 `/Progress` → 组件重新挂载，拿到的必然是新值。

★ **但 `procedure_name_order_list` 的语义是「优先级顺序」**（`J` 从后往前找第一个命中的），
也就是说**数组越靠后优先级越高**。`ra` 写的是**槽号升序**，所以「槽号越大 → 在颜色判定里越优先」。
这是旧版的一个隐含副作用，不是刻意设计的优先级 —— 新版如果要做「工序颜色」应该明确写清优先级。

### 7.3 ⚠️ 两个键是**全局**的，不分租户

`localStorage` 是浏览器级。同一台机器换账号登录（不同 `registrant`）→ 读到的是**上一个租户**的工序名和颜色。
旧版就是这么写的。新版如果继续用 localStorage，要么按 `tenant_id` 加前缀，要么干脆别用（见 §8）。

---

## 8. 新版实现建议

### 8.1 现状（新栈里已经有什么）

> ✅ **本节 + §8.2 已落地**（2026-09-19）：迁移 `0022_procedure_color.sql` 加了 `color` 列，
> `POST /v1/procedures` 已实现。下面是**当时的**现状存档，接口形状与最终实现有两处出入：
> ① 颜色默认是**空串**不是 `#FFFFFF`（空串 = 没配过，兜底色由前端定）；
> ② 「名称为空 ⇒ 删行」**没做** —— 改成「只 upsert 请求里给的槽，没提到的槽一个都不动」
> （旧版发的是恒 15 键全量对象，新版若「先清后写」，只发改动槽的调用方会静默清空其余槽）。

```
backend/migrations/0021_progress.sql   →  procedures(id, tenant_id, slot, name, sort_order, UNIQUE(tenant_id,slot))
backend/src/modules/progress/model.rs  →  ProcedureSlotDto { slot, name } / ProceduresDto { slots }
backend/src/modules/progress/service.rs:23 get_procedures()  —— 恒返回 15 项（库里没配的给空名）
backend/src/modules/progress/handler.rs:17  GET /api/v1/procedures
app/src/api/client.ts:125              →  listProcedures()
app/src/views/Progress.vue:132         →  已消费 slots（filter(name.trim()) 后做下拉，value 用 slot）
```

**当时缺的只有「写」。**

> ✅ **前端也已落地**（2026-09-19）：`app/src/views/Qrscanner.vue`（导航「📱 扫码生产」，路由
> `/qrscanner`）。它**只有「设置工序」这一块** —— 15 行（槽号 + 工序名 + 取色器）+ 保存，
> 旧版那 4 个弹窗、扫码、看板、标签打印、账号管理都没做，清单在该文件头的「⏳ 还没做」。
> 与本文 §8.3 的三条建议一致：不排 `工序10`、颜色落库不写 localStorage、value 用 slot。
> ⚠️ 一处与 §4.5/§8 的**补充**：旧版把 `#FFFFFF` 当「没配颜色」的兜底初值，
> 新版库里**空串才是「没配」**（迁移 `0022` 头注），所以新页面**不预填白色**，
> 未配色的槽原样发空串回去。

### 8.2 建议的接口形状

```rust
// POST /api/v1/procedures   （或 PUT；路由在 progress/mod.rs 里加）
// body: { "slots": [ {"slot":"工序1","name":"下料","color":"#67C23A"}, … ] }
// 语义：整体替换本租户的工序配置；slot 必须在 工序1..工序15 内；name 为空 ⇒ 删除该槽行
```

- **一次事务整体 upsert**，不要照抄旧版「逐个 `findFirst` 再 update/create」（旧服务端 `setProcedures`
  按 `order_index` 再按 `name` 兜底查，会误合并；新版 `UNIQUE(tenant_id, slot)` 直接 `ON CONFLICT` 干净）。
- 「名字为空 ⇒ 删行」这条**建议保留**（与旧版一致，且「清空 = 停用」是用户直觉）。
  ⚠️ **最终实现没采用这条**，见 §8.1 顶部框 —— 空名照样 upsert 成 `name=''`
  （`GET` 本来就一律返回 15 项，看不出差别），但**不再删行**，免得半量请求清空别的槽。

### 8.3 三处**不要照搬**旧版

1. **不要照搬「排除工序10」。**
   那条排除是旧版对「Progress 里 `回款 → 工序10` 硬编码」的补偿，而 `0021_progress.sql` 的迁移头注
   已经明确决定**新版把「回款→工序10」和「服务端对工序10 的 merge 特判」两处一起去掉**。
   既然槽不再有特殊含义，新版「设置工序」就应该 **15 个槽全部可编辑**。
   → 换句话说：`procedures` 表里 `slot` 是纯粹的 1..15，谁也不特殊。

2. **不要照搬两个 localStorage 键。** 理由：
   - 它们是**全局**的（不分租户，见 §7.3）；
   - 键是**工序名**（改名即丢颜色，见 §4.6）；
   - 新版 `Progress.vue` 已经走 `GET /v1/procedures`，再引入 localStorage 只会产生两个真相源。
   → **颜色直接落在 `procedures` 表上**（加一列 `color TEXT NOT NULL DEFAULT '#FFFFFF'`），
     键是 **slot**，改名不丢色，天然按租户隔离。

3. **不要照搬「工序下拉的 value 是工序名」。** 旧版 `dl` 的 `{label: 工序名, value: 工序名}` 再用 `pa()`
   反查槽号，一旦两个槽同名就只会命中第一个。新版 `Progress.vue:134` 已经是 `{label: name, value: slot}` —— 保持这样。

### 8.4 页面落地的建议

| 旧版 | 新版建议 |
|---|---|
| 4 个弹窗挤在一个组件里 | 「设置工序」单独一个 `components/ProcedureSettingsDialog.vue`（它是**别的页面也要用**的配置） |
| 两块死代码面板（调试信息 / 高级设置） | **不实现**。它们是不可达的开发者脚手架 |
| 摄像头：`enumerateDevices` 挑后置 + `facingMode` 双保险 | 保留 `facingMode:"environment"` 即可；旧版挑出的 `deviceId` **根本没被用**（§9 第 5 条），别照抄这段死逻辑 |
| 连续扫码（`nt2`） | 保留：扫码录单连续、扫码查单单发 |
| `updataProgress` 的 `param3/param4` 塞在 query | 新后端已有 `POST /api/v1/progress/update`，body `{line_ids, slot, value}`（`progress/model.rs:35`）—— 用它 |
| 二维码内容 = 单号 | 保持。打印标签的 `qrcode` 字段与扫码查单的匹配键必须一致 |
| `toISOString()` 取日期（UTC） | **改成本地日期**。东八区晚 8 点后旧版会把进度日期写到第二天 |
| `defaulted` 决定按钮 | 新版若没有 `defaulted` 概念，用**角色/权限位**表达：`设置工序` = 租户管理员、`扫码账号管理` = 租户管理员 |

### 8.5 「扫码查单 → 提交进度」与 `/Progress` 的关系

两条路都写同一批 `procedure_slots` 槽：

```
/Progress   行内「更新进度」  → API updateProgress([line_id], slot, value)   ← 已有
/Qrscanner  「确认」          → 同一接口，line_ids = 勾选单号解析出的行 id     ← 待做
```

★ 旧版 Qrscanner 提交时 `param3` 是**槽号**、`param4` 才是拼好的值，而 `/Progress` 侧
（`progress-analysis.md:262`）用的是「工序名反查槽号」——两边最终落到同一个槽，语义一致。
新版共用 `POST /v1/progress/update` 即可，**不需要**为扫码端另开接口。

---

## 9. 不确定清单（全部 ⚠️ 未证实）

1. ⚠️ **`defaulted === 3` 的写入点不在旧服务端源码里**（沿用 progress-shell §0 第 3 条）。
   「扫码生产对 3 隐藏」只在**前端**代码里证实，没有真实账号验证。
2. ⚠️ **原版 Flask 服务端没见到。** `/Users/aaa/Downloads/server` 是 Node+TS 的（源码里多处注释写 "Match Flask"），
   本文引用的服务端行为（`GetProcedures` 恒 15 键、`SetProcedures` 空名删行、`resolveDateLabel` 周一起算）
   **都出自这份源码**。原 Flask 是否逐字一致，未直接证实 —— 但前端对键数不敏感
   （`for (const k in data)`），多几个少几个都不会报错，所以前端结论不受影响。
3. ⚠️ **「排除工序10 是为了保护回款槽」是推断，不是证据。** 旧版没有任何注释说明理由；
   我是从 Progress 侧的「`回款 → 工序10` 硬编码」反推的。也可能只是历史遗留。
4. ⚠️ **工序下拉的同名歧义未实测。** `dl` 的 `value` 是工序名，`pa()` 用
   `for (const [k,v] of Object.entries(gl.value)) if (v === il.value) return void (Vl.value = k)`
   反查槽号 —— 两个槽同名时只会命中 `Object.entries` 顺序里的**第一个**。读代码的结论，没跑过。
5. ⚠️ **「扫码录单」里挑出的 `deviceId` 没被使用。** `@47847` 附近的代码
   `let c3 = u3[0]?.deviceId; for (const e of u3) if (/back|rear|environment/.test(label)) { c3 = e.deviceId; break }`
   —— 之后 `c3` **再也没有被引用**，取流用的是 `g({video:{…, facingMode:"environment"}})`。
   即「挑后置摄像头」这段是**无效代码**。我没跑过真机确认是否有别处副作用。
   （对照：`ca()` 里 `Rt.value !== "auto" && (t2.video.facingMode = Rt.value)` 那份才是真在用的取流参数，
   而 `ca` 只被死掉的「测试当前设置」用。）
6. ⚠️ **`ua`（扫码查单）的错误文案是串的** —— 权限不足时报「您没有权限进行**工序设置**」。
   读代码确认，未实测。
7. ⚠️ **提交进度的日期用 `toISOString().split("T")[0]`（UTC）**。
   时区偏移导致「东八区晚间提交会写成次日」是**推理**，没在真实环境验证过时区。
8. ⚠️ **`Zt.autoplay` 的 `canplay` 5 秒超时**在慢设备上是否会误报，未实测。
9. ⚠️ **「扫码账号管理」按钮对子账号不显示**（§6.3 的推论）—— 由 `dt` 的公式推得，未实测。
10. ⚠️ **`GetProcedures` 返回的 `data` 若某槽是空串**：`yl[k] = ""` 仍会建键，所以弹窗**仍渲染该行**（空输入框）。
    「服务端先铺 15 个空槽」这条使弹窗恒为 14 行 —— 这个推断依赖第 2 条。
11. ⚠️ **`legacy/css/Qrscanner-4d126922.css` 里 `.capture-btn`、`.debug-value.warning` 等类名在 render 里没出现**
    （疑似更早版本的残留）。只做了 grep 对照，没有逐条核。
12. ⚠️ 本文**没有**跑任何差分台 —— 本页依赖摄像头/云打印等外部设备，没有可离线复现的纯函数入口
    （除 `Ql`/`ql` 的扇数/汇总算法，那部分属于 Progress 看板，已由 progress 文档覆盖）。

---

## 10. 怎么复现（给下一个人）

### 10.1 解这个包

```bash
# ① dump 三张解码表（自检 0/6 是正常的 —— 这包的已知值不在 CHECKS 列表里）
node legacy/decode-progress-map.mjs legacy/js/Qrscanner-195163c4.js /tmp/qrscanner-map.json
#   w/m  @1952  offset 386，数组 57 条   ← 小表（摄像头/Cordova/剪贴板那几个串）
#   f/Xe @3075  offset 157，数组 540 条  ← 主表（组件用这个）
#   at/lt @70377 offset 139，数组 11 条  ← 小表
```

### 10.2 ⚠️ 公共件的一个 bug（本次踩到，`legacy/decode-progress-scoped.mjs`）

`legacy/decode-progress-scoped.mjs` 里有一行

```js
if (fromDec && !ARRAY_FNS.has(alias.name)) scope.declare(alias.name, fromDec)
```

`ARRAY_FNS` 是**数组函数名集合**（本包 = `{m, Xe, lt}`）。而 Qrscanner 组件里
`setup(n){ const m = v; … }` 的局部解码器别名**正好叫 `m`**，撞上数组函数名 →
这一行把**整条别名链掐断**，`setup` 之后所有 `m(NNN)` 都没被替换。

症状很有迷惑性：脚本**不报错**，只打印「残留『名字(数字)』形状 30 处」，那 30 处全是 `m(N)`/`t(N)`/`e(N)`，
而且它**不会**进 `stats.unresolved`（因为 `m` 已被声明成 `null`，走的是「已绑定但不是解码器」分支）。

修法（本次用 /tmp 副本，**没有改仓库里的公共件**）：

```js
if (fromDec) scope.declare(alias.name, fromDec)      // 去掉 !ARRAY_FNS.has(...) 这半句
```

理由：`fromDec` 非空本身就意味着右边已经解析成**解码器**了，
`ARRAY_FNS.has(alias.name)`（比的是**左边的别名**，不是右边）在语义上就是多余且会误伤的。
改完后替换数 140 → **1615**，残留 0；`grep -c 'm([0-9]' ` 归零。

> ⚠️ 这条只影响**别名恰好撞上数组函数名**的包。Progress 包（`E`/`dl`/`ue`/`vl`）没撞上，
> 所以 `decode-progress-map.mjs` 的 6/6 自检仍然有效 —— **但 Qrscanner 包的自检是 0/6**
> （`CHECKS` 里没有这个包的已知值），也就是说**光靠自检发现不了这个 bug**。
> 建议后续给 `CHECKS` 补一条 Qrscanner 的锚点，例如 `['f', 255, 'Qrscanner']`。

### 10.3 偏移映射

反混淆会改变长度（71263 → 76386 字符），所以「反混淆后偏移」不能直接当「原文件字节偏移」。
本文的 `@NNNNN` 是**原始文件的字节偏移**，用一个把 edits 列表记录下来的副本换算：

```js
// /tmp/qr-scoped2.mjs = legacy/decode-progress-scoped.mjs + 上面那处修复
//                       + writeFileSync("/tmp/qr-edits.json", JSON.stringify(edits))
// /tmp/mapoff.mjs      = 用 edits 构造「反混淆偏移 → 原始字节偏移」的分段映射
node /tmp/qr-scoped2.mjs legacy/js/Qrscanner-195163c4.js /tmp/qrscanner-map.json /tmp/qr.decoded.js
node -e 'import("/tmp/mapoff.mjs").then(({mapOff})=>console.log(mapOff(35793)))'
```

⚠️ 注意 `Qrscanner-195163c4.js` 是 **72953 字节 / 71263 字符**（中文是多字节），
直接拿 `String.prototype.indexOf` 的下标当字节偏移会错。

### 10.4 折行读 render

```bash
node -e 'const s=require("fs").readFileSync("/tmp/qr.decoded.js","utf8");
         require("fs").writeFileSync("/tmp/qr-comp.js", s.slice(s.indexOf("const _e=")))'
app/node_modules/.bin/esbuild /tmp/qr-comp.js --format=esm --outfile=/tmp/qr-comp.pretty.js
# → 750 行，setup 主体在 1–637，render 在 638–715
```

---

## 附：本文与既有文档的关系

| 既有文档 | 关系 |
|---|---|
| `docs/2026-09-19-progress-shell.md` §1 | **复核一致**。它写的 `ra` 行为、`El` 的 `工序10` 过滤、两个键的构造规则，我逐条对过原文/字节偏移，结论相同。本文补的是该节没写的：弹窗 UI 全貌、`sa` 的完整逻辑、接口清单、权限矩阵、死代码 |
| `docs/2026-09-19-progress-analysis.md` §5.3 / §8 | Progress 侧怎么**读**这两个键；本文是**写**的那一半。两边对「工序名 vs 槽号」的口径一致 |
| `backend/migrations/0021_progress.sql` 头注 | 该迁移说「新版两处特判一起去掉」。本文 §8.3 第 1 条据此建议新版「设置工序」**不要**排除工序10 |
| `app/src/views/Progress.vue` | 已经走 `GET /v1/procedures`，**没有**用那两个 localStorage 键。本文 §8.3 第 2 条据此建议新版 Qrscanner 也别用 |
