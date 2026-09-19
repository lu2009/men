# 生产进度（`/Progress`）深挖 —— 外壳 / 设置页 / 看板

> 本文是 `docs/2026-09-19-progress-analysis.md` 的**补篇**：只回答那份文档 §9「不确定清单」里
> 分给本轮的 5 条 + 1 条对 `docs/2026-09-17-home-analysis.md:217` 的修正。
> **本文不改上面两份文档**（`2026-09-19-progress-analysis.md` 与 `2026-09-17-home-analysis.md` 都保持原样）。
>
> 证据形式：
> - `@NNNNN` = 反混淆后源码里的字符偏移（文件见每节的「怎么复现」）。
> - `表(下标)` = 解码表取值，例如 `de(582)`；表的 dump 用 `legacy/decode-progress-map.mjs` 跑出来。
> - `文件:行号` = 旧版服务端源码 `/Users/aaa/Downloads/server`。
>
> 本轮新增的公共件与踩坑记在 §9。

---

## 0. 六条结论速览

| # | 问题 | 结论 | 把握 |
|---|---|---|---|
| 1 | `procedure_name_color_map` / `procedure_name_order_list` 谁写的 | **不是设置页**，是**扫码生产页 `/Qrscanner`（`Qrscanner-195163c4.js`）工具栏的「设置工序」弹窗**，点「确认」时写 | **已证实**（写入点整段切出来跑过） |
| 2 | 移动端底部 Tab 里有没有 `/Progress` 入口 | **有**。本地与线上两套外壳**都有**：第 **5** 项，图标 `⏳`，文案「进度」→ `push("/Progress")`。**分析文档 §9 第 7 条要更正** | **已证实**（两套都切出来看过） |
| 3 | `userinfo.defaulted` 取值全集 | 服务端字段是 `User.isDefaultPw`；前端只特判 **1/2/3**（+ 路由守卫默认 2）。**1 = 车间（默认密码）账号、2 = 扫码账号、3 = 终端账号、0/其它 = 普通 PC 账号**。`3` 的写入点**不在**旧服务端源码里 | 1/2 **已证实**，3 **半证实**，0 **未证实** |
| 4 | 看板 KPI 的「不含单玻」 | 判定就是 **`底玻 === "无"`（严格相等，只看底玻，不看面玻/玻璃厚）**。开关打开时该行**五类扇数全归零**，但**门数/平方/金额完全不受影响**，行也不被丢掉。分母是**看板自己筛完的行**（不是整表） | **已证实**（整段切出来跑过，见 §4.3 差分结果） |
| 5 | `home-analysis.md:217` 的更正没说全 | 更正说「传的不是工序10」**对**；但**没写**非槽值会被服务端路由到 `updatePrintStatus`，而它**最终仍然写 `工序10`**（外加「打单操作」）。建议替换文字见 §5 | **已证实** |
| 6 | `'开门红'` 硬编码 | 条件是 `userinfo.registrant === userinfo.name \|\| userinfo.name === "开门红"`（比的是**账号名**，不是公司名）。命中只多出**「生产分析」按钮**。**但**同 build 的路由守卫会把**名字正好是「开门红」的账号**当场踢下线 —— 所以这条分支**实际不可达** | **已证实** |

---

## 1. `procedure_name_color_map` / `procedure_name_order_list` 的写入点

### 1.1 结论

**写入点是「扫码生产」页 `/Qrscanner`**（`legacy/js/Qrscanner-195163c4.js`），
具体是工具条上那颗 **「设置工序」** 按钮打开的弹窗（弹窗标题也是「设置工序」，`width:"90%"`），
点弹窗里的 **「确认」** 按钮时写。

**不是设置页。** `legacy/js/setting-872a24e9.js` 全文（22590 字节）里没有任何一处含这两个串 ——
它的三张解码表（`u`/`C`/`M`）dump 出来后逐条查过，也没有。

### 1.2 证据 A：常量声明原文

```js
// legacy/js/Qrscanner-195163c4.js —— 反混淆后（/tmp/qr.decoded.js @18585）
const _e = "procedure_name_color_map",      // f(449)
      $e = "procedure_name_order_list",     // f(316)
      et = Vue.defineComponent({ __name: "Qrscanner", setup(n) { const m = v; … } })
```

`Qrscanner-195163c4.js` 的解码器是 `f`（offset 157，540 条）；`f(449) = "procedure_name_color_map"`、
`f(316) = "procedure_name_order_list"`。

对照 Progress 包里的同一个 key（`Progress-f4bdef35.js` 的解码器 `de`，offset 218）：
`de(582) = "procedure_name_color_map"`、`de(220) = "procedure_name_order_list"`、`de(274) = "__unproduced__"`。
两边**完全一致**。

### 1.3 证据 B：写入函数 `ra`（「确认」的 handler）

把 `ra` 整段切出来、用 `f` 表解干净（脚本见 §8）：

```js
ra = async () => {
  tt.value = true
  try {
    const t = await a()                                   // 读本地 userinfo
    if (!t) return ElMessage.error("无法获取用户数据"), void (tt.value = false)
    const l = t.userinfo.registrant
    const n = await fetch("https://www.samrtdoor.com.cn/1?param1=SetProcedures&param2=" + l, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(yl)                            // ← 工序名按槽号提交到服务端
    })
    const o = await n.json()
    if (200 === o.code) {
      const t = {}
      Object.keys(yl).forEach(l => {                      // ← 构造 {工序名: 颜色}
        const n = (yl[l] || "").trim()                    // 工序名（用户在弹窗里改的）
        const o = (wl[l] || "").trim()                    // 颜色（取色器选的）
        if (n && o) t[n] = o
      })
      ;(e => { localStorage.setItem("procedure_name_color_map", JSON.stringify(e)) })(t)
      const l = El.value.map(e => (yl[e] || "").trim()).filter(e => e)   // ← 顺序表
      localStorage.setItem("procedure_name_order_list", JSON.stringify(l))
      ElMessage.success("工序设置保存成功")
      ml.value = false
    } else ElMessage.error(o.message || "工序设置保存失败")
  } catch (t) {
    ElMessage.error("保存工序设置出错: " + (t instanceof Error ? t.message : String(t)))
  } finally { tt.value = false }
}
```

**写什么结构**：

| key | 结构 | 构造规则 |
|---|---|---|
| `procedure_name_color_map` | `{ 工序名: 颜色 }`（**名字→颜色**，都是 trim 过的字符串） | 取 `yl`（槽号→名字）与 `wl`（槽号→颜色），**两者都非空**才进表。**键是名字不是槽号** |
| `procedure_name_order_list` | `["下料","钻孔",…]` 工序名数组 | `El.value.map(槽 => (yl[槽]‖"").trim()).filter(Boolean)` |

其中 `El` 是：

```js
yl = Vue.reactive({}), wl = Vue.reactive({}),
vl = ["#67C23A","#409EFF","#E6A23C","#F56C6C","#9A66E4","#13C2C2","#95A5A6","#FFFFFF"],  // 取色器预置色
fl = () => { El.value.forEach(t => { wl[t] = "#FFFFFF" }) },                              // 「一键重置颜色」
El = Vue.computed(() =>
  Object.keys(yl)
    .filter(t => t !== "工序10")                                                        // ★ 工序10 被排除
    .sort((e, t) => (parseInt(e.replace("工序","")) || 0) - (parseInt(t.replace("工序","")) || 0))   // 按槽号升序
)
```

★ **`工序10` 被明确排掉**，所以 `procedure_name_order_list` 里**永远不会含「回款」槽**。

### 1.4 证据 C：读入函数 `sa`（「设置工序」按钮的 handler）

```js
sa = async () => {
  const e = m, t = await a()
  if (!t) return void ElMessage.error("无法获取用户数据")
  if (1 === t.userinfo.defaulted) {                       // ★ 只有 defaulted===1 能进
    lt.value = true
    try {
      const t = await a()
      if (!t) return ElMessage.error("无法获取用户数据"), void (tt.value = false)
      const l = t.userinfo.registrant
      const n = await fetch("https://www.samrtdoor.com.cn/1?param1=GetProcedures&param2=" + l)
      const o = await n.json()
      if (200 === o.code && o.data) {
        const t = (() => {                                 // 读 localStorage 颜色表，坏数据返回 {}
          try { const t = localStorage.getItem(_e); if (!t) return {}
                const l = JSON.parse(t); return l && typeof l === "object" ? l : {} }
          catch (t) { return {} }
        })()
        for (const l in o.data) {                          // o.data = {工序1:'下料',…,工序15:''}
          yl[l] = o.data[l]
          const a = typeof o.data[l] === "string" ? o.data[l].trim() : ""
          wl[l] = a && t[a] ? t[a] : "#FFFFFF"             // ★ 按「工序名」回到颜色
        }
        ml.value = true                                    // 打开弹窗
      } else ElMessage.error(o.message || "获取工序信息失败")
    } catch (l) { ElMessage.error("获取工序信息出错: " + …) }
    finally { lt.value = false }
  } else ElMessage.error("您没有权限进行工序设置")
}
```

### 1.5 界面是什么、什么时候写

| 项 | 值 | 证据 |
|---|---|---|
| 页面 | 扫码生产 `/Qrscanner`（桌面菜单「📱 扫码生产」进来；`index` 里 `O = () => r.push("/Qrscanner")`） | `/tmp/index.decoded.js` @19398 附近 |
| 入口按钮 | 工具条第 4 颗：`{type:"info", onClick: sa, loading: lt}` 文案 **「设置工序」** | 渲染函数 @52293 附近 |
| 按钮可见条件 | `yt.value`。`yt` 由 `Ft()` 置位：**`1 === Number(userinfo.defaulted)`** | `Ft` @22172 |
| 弹窗 | `el-dialog title:"设置工序" width:"90%" :close-on-click-modal="false"` | 渲染函数 @59769 附近 |
| 弹窗内容 | `el-form` 里对 `El`（工序集合，槽号升序，无工序10）逐行渲染：`el-input v-model="yl[槽]" placeholder="请输入工序名称"` + `el-color-picker v-model="wl[槽]" show-alpha :predefine="vl"` | 同上 |
| footer | `一键重置颜色`（warning，只把 `wl` 全置 `#FFFFFF`，**不写盘不删 key**）/ `取消` / `确认`(= `ra`，写盘) | 同上 |
| 何时写 | 只有点「确认」且 `SetProcedures` 返回 `code===200` 时写。**注意写盘在服务端成功之后** —— 服务端失败则 localStorage 不动 | `ra` 里 `if (200 === o.code) { … setItem … }` |

**副作用**：`ra` 顺手把 `yl`（`{工序槽: 名称}`）POST 给 `SetProcedures`，服务端
`legacy-dispatch.ts:834` → `progServ.setProcedures(p.ds, data)` 写 `Procedure` 表（`progress.service.ts:859`）。
即「改工序名」是**服务端 + 本地颜色表一起改**的。

### 1.6 全仓库覆盖范围（「找不到就写找不到」的交代）

把 `legacy/js/` 下 45 个文件里**每个 chunk 的解码表**都 dump 出来，逐条查这两个串：

```
$ mkdir -p /tmp/allmaps
$ for f in legacy/js/*.js; do node legacy/decode-progress-map.mjs "$f" /tmp/allmaps/$(basename "$f" .js).json; done
```

结果：**只有两个包含这两个串** ——

| 包 | 角色 |
|---|---|
| `Progress-f4bdef35.js` | **只读**（`X()` 读颜色表、`J()` 读顺序表 + 颜色表） |
| `Qrscanner-195163c4.js` | **读 + 写**（本文 §1.3 / §1.4） |

线上 build 同样：`/js/Progress-f53b59ce.js` 的表里 `dl(987)` / `dl(658)` 就是这两个串，
`/js/Qrscanner-1fcb594a.js` 也一样（没逐字重切，只查了表）。

> 📝 **函数名对照**：分析文档 §5.3 用的是 `X2()` / `J2()` / `R2()` / `F2()`，
> 本文（以及 `/tmp/progress.decoded.js`）里它们叫 `X` / `J` / `R` / `F`（@73080 / @73229 / @74294 / @73010），
> **是同一批函数**，只是两份反混淆产物的局部名不同。常量名一致：`Vl` / `wl` / `yl`（@67780 / @67810 / @67841）。

> ⚠️ **没有解码器的包**（`Diao` / `drawDoor` / `draw` / `printService` / `Hui.formatted` 等 29 个）
> 用**原文 grep** 兜底查过 `procedure`（大小写不敏感）：全部 0 命中。
> 另外 `Diao.deobfuscated.js` / `Home.formatted.js` / `Hui.formatted.js` 这几份已反混淆的产物也查过，0 命中。

### 1.7 顺手发现：另一个容易混淆的 key `procedures_data`

`Login-1a4b7608.js` 在登录成功后**也**拉了一次工序，但存的是**另一个 key**：

```js
// Login-1a4b7608.js（反混淆后 /tmp/login.flat.js）
try {
  await (async e => {                       // e = userinfo.registrant
    if (e) try {
      const a = await fetch("https://www.samrtdoor.com.cn/1?param1=GetProcedures&param2=" + e)
      const r = await a.json()
      200 === r?.code && r.data && localStorage.setItem("procedures_data", JSON.stringify(r.data))
    } catch (a) {}
  })(t.userinfo.registrant)
} catch (d) {}
```

- `procedures_data` = **`{工序1:'下料',…,工序15:''}` 扁平槽表**（服务端 `buildLoginResponse` 里也回了一份，
  见 `auth.service.ts:348` 附近；`legacy-dispatch.ts:632` 的登录响应里 `userinfo.defaulted` 那一段旁边）。
- 与本文的颜色表**不是一回事**：一个存「槽→名字」，一个存「名字→颜色」。
- `procedures_data` 的读侧在 `Hui` 与 `Login` 两个包里（见 §8 的 key 清单）。

---

## 2. 移动端底部 Tab 里的 `/Progress` 入口（**更正分析文档 §9 第 7 条**）

### 2.1 结论（前置）

**两份外壳里都有 `/Progress` 入口，位置和文案完全一样：**

| 外壳 | 移动底部 Tab 里 `/Progress` 是第几项 | 图标 | 文案 | 容器 | onClick |
|---|---|---|---|---|---|
| 本地 `legacy/js/index-c3b16e3f.js`（`legacy/index.html` 加载的入口） | **第 5 项**（共 6 项） | ⏳ | **进度** | `div.mobile-bottom-tab`（`ne`，`key:2`） | `me()` → `r.push("/Progress")` |
| 线上 `js/index-f9710780.js`（= `/tmp/live-index.js`，sha1 `30f17fee…`，2026-09-19 02:30 拉取，与服务器上那份**逐字节相同**） | **第 5 项**（共 6 项） | ⏳ | **进度** | `div.mobile-bottom-tab`（`_e`… 同结构） | `me()` → `o.push("/Progress")` |

> 📌 **`docs/2026-09-19-progress-analysis.md` §9 第 7 条写「移动端底部 tab 里没有找到指向 `/Progress` 的项」是错的**，
> 应改为上面这句。当轮没切到的原因是：移动 tab 的项不是 `el-menu-item`，而是裸
> `<div class="tab-item">`，用 `"desktop-icon"` 去 grep 抓不到；**它们的图标 class 是 `tab-icon`**。

### 2.2 两套外壳里 `/Progress` 的完整门控链

两套的 `userinfo.defaulted` 分支**逐字相同**（线上只是变量名不同）：

```js
// onMounted
const n = t.userinfo.defaulted
if (2 == n || 3 == n) {
  de.value = false                      // de = 「公式」(/Diao) + 「客户信息」+ 「参数设定」
  if (3 == n) { we.value = false; ve.value = true }   // we=扫码生产/画门窗; ve=订单管理(/terminal-orders)
  if (2 == n) { fe.value = false }                    // fe=回执单 + 生产管理 + 生产进度
} else de.value = true
// 初值：de=fe=we=true, ve=false
```

`/Progress` 在两个地方出现，**门控都是 `fe && !ve`**（即 `defaulted !== 2 && defaulted !== 3`）：

| 位置 | 渲染条件（完整） | 证据（本地包反混淆偏移） |
|---|---|---|
| 桌面左菜单第 5 项 `el-menu-item index:"9"`：`⏳ / 生产进度` | `fe && !ve`，且外层 `isMobile === false`（`c.value` 为假时渲染 `el-menu`） | @22458 |
| 移动底部 Tab 第 5 项 `div.tab-item`：`⏳ / 进度` | `!isEnglish && isMobile && !isReceiptOrTerminalRoute && !assistiveMenuEnabled && fe && !ve` | @26901 |

其余相关容器：

| 容器 | class | 渲染条件 | 里面有没有 `/Progress` |
|---|---|---|---|
| 桌面左菜单 | `el-menu.navbar` | `!isMobile` | ✅ 有（第 5 项，`index:"9"`） |
| 中文移动底部 Tab | `mobile-bottom-tab`（`ne`，`key:2`） | `!isEnglish && isMobile && !j && !u` | ✅ **有（第 5 项）** |
| 英文移动底部 Tab | `mobile-bottom-tab`（`te`，`key:1`） | `isEnglish && isMobile && !j && !u` | ❌ 无（只有 `✏️ Draw Door` / `🔄 Re-login` / `🌐 中文`） |
| 「更多功能」半屏面板 | `more-menu-grid` | `!isEnglish && isMobile && s`（`s` = 更多面板开关） | ❌ 无（只有 公式/客户信息/参数设定/扫码生产/画门窗/重新登录） |
| 悬浮球辅助菜单 | `assistive-menu-grid` | `isMobile && assistiveMenuEnabled` | ✅ **有（第 5 项：`⏳ / 进度`，`fe && !ve`）** |

符号对照（本地包 `Navigation` 的 `setup` 作用域）：

```js
c  = isMobile（window.innerWidth <= 768）
i  = isEnglish（locale，localStorage "app-locale"）
j  = computed(() => path.startsWith("/receipt") || path === "/terminal-orders")
u  = assistiveMenuEnabled（localStorage "assistiveMenuEnabled" === "true"，或 storage/自定义事件）
U  = computed(() => path → "hui" | "home" | "drawDoor" | "progress" | "")   // 高亮用
me = () => { T(); router.push("/Progress") }
```

⚠️ **`isMobile === true` 且 `assistiveMenuEnabled === "true"` 时，底部 Tab 整条被悬浮球取代** ——
但悬浮球的辅助菜单里**仍然有「⏳ 进度」**，所以移动端**在任何一种形态下都进得去 `/Progress`**。

### 2.3 中文移动底部 Tab 的完整 6 项（本地包，源码顺序）

| # | 图标 | 文案 | 条件 | onClick | 高亮条件 |
|---|---|---|---|---|---|
| 1 | 🧾 | 回执单 | `fe` | `W()` → `/Hui`（若当前在 `/diao` 则 reload） | `U === "hui"` |
| 2 | 📋 | 订单管理 | `ve` | `ge()` → `/terminal-orders` | — |
| 3 | ✏️ | 画门窗 | `ve` | `ue()` → `/drawDoor`（白名单公司弹「免费空间已耗尽」提示） | `U === "drawDoor"` |
| 4 | ⚒️ | 生产 | `fe && !ve` | `Z()` → `/Home` | `U === "home"` |
| 5 | ⏳ | **进度** | `fe && !ve` | `me()` → **`/Progress`** | `U === "progress"` |
| 6 | ➕ | 更多 | `!ve` | `s.value = !s.value`（开「更多功能」面板） | — |

**每套里 `/Progress` 在第几项**：中文移动 Tab 第 5 项（文案「进度」）；桌面左菜单第 5 项（文案「生产进度」）；
悬浮球辅助菜单第 5 项（文案「进度」）。**没有一项的文案是 `o(NNN)` token —— 全是明文中文。**

### 2.4 线上 vs 本地的差异（与 `/Progress` 无关，但同属外壳，记一笔）

| | 本地 `index-c3b16e3f.js`（2025-07-22 下载） | 线上 `index-f9710780.js`（2026-09-19） |
|---|---|---|
| `/Progress` 入口 | 一致 | 一致 |
| `defaulted` 门控 | 一致 | 一致 |
| 画门窗白名单 | `le = ["欧诺名门1"]` | `le = ["欧诺名门","菲邦门业数据版"]` |
| 反盗版提示文案 | 「**吾忧**我知道你了，再这样子报警，无耻的小偷！」 | 「我知道你了，再这样子报警，无耻的小偷！」 |
| `Progress` chunk | `Progress-f4bdef35.js` | `Progress-f53b59ce.js`（表里**仍有** `开门红`/`不含单玻`/`procedure_name_color_map`/`__unproduced__`） |

---

## 3. `userinfo.defaulted` 的取值全集

### 3.1 结论

**服务端字段来源**：`User.isDefaultPw`（Prisma `Int @default(1) @map("is_default_pw")`，
`/Users/aaa/Downloads/server/prisma/schema.prisma:22`）。
登录响应里 `userinfo.defaulted = user.isDefaultPw`（`auth.service.ts:285`、`:348`；
`legacy-dispatch.ts:632` 原样透传）。

**前端只出现 3 个特判值 + 一个兜底**：

| 值 | 前端叫它什么 | 服务端谁写的 | 已证实? |
|---|---|---|---|
| **1** | 车间/扫码操作账号（「设置工序」「扫码查单」的准入值；也是设备防盗校验的准入值） | Prisma 默认；`createUser`（`settings.service.ts:325`）默认 1；`seed-default-user.ts:17`；`buildCustomerLoginResponse`（客户临时登录）**硬编码 1** | ✅ |
| **2** | 扫码账号（**受限外壳**：只剩「扫码生产」+「重新登录」） | **`addScanner`（`scanner.service.ts:18`，`isDefaultPw: 2`）** —— 就是「扫码账号管理」里「添加」出来的账号 | ✅ |
| **3** | 终端账号（订单管理 → `/terminal-orders`；Progress/Home 降级终端模式） | **旧服务端源码里没有写入点** | ⚠️ 半证实 |
| **0 / 其它** | 普通 PC 账号（**没有任何分支特判它**） | `changePassword` 把它置 0（`auth.repository.ts:26`、`auth.service.ts:260`） | ⚠️ 「0 是普通账号」是从「没有分支」推的 |

**前端没有任何一处判断 `defaulted === 0`**，也没有 `> 1` / `< 3` 之类区间判断 —— 全是 `=== 1` / `== 2` / `== 3`。
另外**路由守卫在没有 userinfo 时用一个硬编码默认值 `2`**（见 §3.4）。

### 3.2 每个值意味着什么 UI（逐条带证据）

#### `defaulted === 1`

| 位置 | 表现 | 证据 |
|---|---|---|
| 外壳（菜单） | **全部菜单可见**（`de`/`fe`/`we` 全 true） | `index-c3b16e3f.js` onMounted |
| 扫码生产页 | 工具条多出 **「设置工序」** 按钮（`yt.value = 1 === Number(n)`） | `Qrscanner` `Ft()` |
| 扫码生产页 | `sa`（设置工序）准入；否则 `ElMessage.error("您没有权限进行工序设置")` | `Qrscanner` `sa()` |
| 扫码生产页 | `ua`（**扫码查单**）准入；否则**同一条** `"您没有权限进行工序设置"` | `Qrscanner` `ua()` |
| 设备防盗 | **只有 `1` 会跑设备授权/防盗校验**：`if (1 !== Number(e?.userinfo?.defaulted)) return {allowed:true, skipped:true, …}` | `index` 的 `Dt()` |

#### `defaulted === 2`（**受限外壳 —— 实际就是扫码账号**）

| 位置 | 表现 | 证据 |
|---|---|---|
| 外壳开关 | `de = false`（公式/客户信息/参数设定 全隐）、`fe = false`（回执单/订单管理/生产管理/**生产进度** 全隐）；`we` 保持 true | onMounted |
| 结果菜单 | 只剩 **📱 扫码生产**（→ `/Qrscanner`）+ 🔄 重新登录 | 桌面菜单条件 |
| 所有导航函数 | 一进门就 `if (2 == t.userinfo.defaulted) return` —— **点了也不动**（`/Diao` `/Hui` `/Home` `/clients_Info` `/setting` 全被挡） | `Y/W/Z/_/J` 五个函数 |
| 登录后跳转 | `if (2 == a) return void N.push("/Qrscanne")` —— ⚠️ **拼错了**，正确路由是 `/Qrscanner`。**本地与线上两套 Login 都是这个拼写**（`/tmp/login.flat.js`、线上 `Login-17035c54.js` 的 `z(332) = "/Qrscanne"`），且路由表**没有 catch-all**，所以这条会落到一个未匹配路径 | `Login-1a4b7608.js` |
| 路由守卫 | 已登录状态下再访问 `/login`：走 `else n(1 === t ? "/hui" : "/Qrscanner")` —— 这里**拼写是对的**，2 会被送到 `/Qrscanner` | `index` 守卫 |

> 「2 = 受限」这个叫法没错，但**更准确的语义是「扫码账号」**：服务端 `AddScanner` 明确写 `isDefaultPw: 2`
> （`scanner.service.ts:18`，注释 `扫码设备添加成功`）。菜单只剩「扫码生产」+ 登录后想去 `/Qrscanner`
> 两处独立证据都指向同一件事。

#### `defaulted === 3`（终端账号）

| 位置 | 表现 | 证据 |
|---|---|---|
| 外壳 | `de = false`、`we = false`（扫码生产/画门窗 隐藏）、**`ve = true`** → 出现 `📋 订单管理 → /terminal-orders`，且「生产管理」「生产进度」因 `!ve` 而消失 | onMounted |
| Login 跳转 | `if (3 == a) { const e = sessionStorage.getItem("pending_receipt_no"); return void (e ? …push("/receipt-view/"+e) : N.push("/terminal-orders")) }` | `Login-1a4b7608.js` |
| 路由守卫 | `let t = 2; if (e?.userinfo) t = e.userinfo.defaulted; if (3 == t) { … n(receiptNo ? "/receipt-view/x" : "/terminal-orders") }` | `index` 守卫 |
| Progress 页 | `3 === t.userinfo.defaulted && (D.value = false)` —— 切终端模式（列集 10 列、读 `getProgressForTerminal`） | `Progress` onMounted @118865 |
| Home 页 | `3 == o && (Yt.value = false, Gt.value = name.split("-")[0], jt.value = Number(name.split("-")[1]))` —— 工厂态关闭 + 切终端门店后缀 | `Home.formatted.js` @433737 |
| Hui 页 | `yt.value = (3 != a)` —— 「同步保存」按钮**仅非终端**显示 | `Hui.formatted.js` @206864 |
| TerminalOrders | **不判断**，只是把值 `toString()` 塞进一个 ref（见 §3.5 的坑） | `/tmp/to.flat.js` @9960 |

#### `defaulted === 0` / 其它

- 外壳：走 `else de.value = true` → 与 `1` 同（全部菜单可见）。
- Progress 页：`3 === defaulted` 为假 → **PC 模式**。
- 扫码生产页：`1 === Number(defaulted)` 为假 → **没有「设置工序」按钮**，`sa`/`ua` 都会被拒。
- 设备防盗：`1 !== Number(…)` → **跳过**。
- 结论：**0 与 1 的差别只在「扫码生产页的几个开关 + 设备防盗」上**，外壳与 Progress/Home/Hui 完全一样。

### 3.3 服务端侧的写入点清单（`/Users/aaa/Downloads/server`）

| 函数 | 写入值 | 文件:行 |
|---|---|---|
| Prisma 默认 | `1` | `prisma/schema.prisma:22` |
| `seed-default-user.ts` | `1` | `src/seed-default-user.ts:17` |
| `settings.createUser` | `body.isDefaultPw ?? 1`（`Number(...)`） | `src/modules/settings/settings.service.ts:336` |
| `scanner.addScanner` | **`2`**（且 `mutilUser: 1`） | `src/modules/scanner/scanner.service.ts:18` |
| `auth.changePassword` | **`0`** | `src/modules/auth/auth.service.ts:260`、`auth.repository.ts:26` |
| `auth.buildCustomerLoginResponse` | **`1`**（硬编码，客户端扫码临时登录） | `src/modules/auth/auth.service.ts:381` |
| **`3`** | **全仓库无写入点** | — |

⚠️ **`3`（终端账号）在旧服务端源码里查不到创建入口**。可能是：
(a) 供应商在数据库里手工改的；(b) 由那个我们没拿到的旧 Flask 后台写的；
(c) `createUser` 的调用方（`settings.routes.ts:180` 那个 HTTP 端点）传 `isDefaultPw: 3`。
**本轮没能证实是哪一种。** 但**前端对 3 的处理是明确的**（上表），所以实现不受影响。

### 3.4 路由守卫的那个「默认 2」

```js
// index-c3b16e3f.js（反混淆）@87737 附近
if (o && "/login" === e.path) try {
  const e = await A()
  if (await on(e, n)) return
  let t = 2                                             // ★ 没有 userinfo 时默认 2
  if (e && e.userinfo && (t = e.userinfo.defaulted), 3 == t) { … n("/terminal-orders") }
  else n(1 === t ? "/hui" : "/Qrscanner")
} catch (s) { localStorage.removeItem("token"); "/login" !== e.path ? n("/login") : n() }
```

⇒ **取不到 userinfo 时按「2（扫码账号）」处理**，只有明确 `1` 才去 `/hui`。
这一条在**本地与线上两套里逐字相同**。

另外 `_t(e)`（IndexedDB `userData` 的规范化函数，@71950）把读回来的值统一成
`defaulted: Number(userinfo.defaulted)` —— 所以从 IndexedDB 恢复时是**数字**，而登录直读时是服务端原始类型。
§3.5 的坑就出在这里。

### 3.5 顺手记一个旧版小毛病：TerminalOrders 里 `defaulted` 被塞进了「门店后缀」的 ref

```js
// TerminalOrders-43b60190.js（反混淆 /tmp/to.flat.js @9960）
se.value = m.userinfo.name
ue.value = m.userinfo.ds
ce.value = m?.userinfo?.defaulted?.toString() || ""      // ★ ce 平时是门店后缀！
```

同一个 `ce` 在另一条分支里是 `ce.value = name.split("-")[1] || ""`（@7450），
并且被用去拼 `getTableDataForTerminal&param2={ds}_{ce}`（@7593）。
在「按回执单号进来」的那条分支里 `ce` 赋值后**没再被读**，所以**是死赋值**。
记录在此是因为它看起来像「终端页也吃 defaulted」——**不是**。

---

## 4. 看板 KPI 的「不含单玻」判定

### 4.1 结论

看板（`ProductionDashboard`）「总扇数」卡片右上角的 **`不含单玻`** 开关（`h`，`Vue.ref(false)`，默认 **关**）
只影响一件事：**逐行的「扇数」计算**。

```js
// @10655（函数 xe）；开向数组 Ee/Ne/Be 在 @10374
xe = e => {
  if (h.value && "无" === e["底玻"])
    return { swingFans: 0, slidingFans: 0, showerFans: 0, otherFans: 0, brightFans: 0 }   // ★ 全部归零
  const o = e["数量"] || 0
  …  // 下面才是正常的平开/移门/淋浴/亮窗/其它扇数
  return { swingFans: n, slidingFans: u, showerFans: s, otherFans: i, brightFans: c }
}
```

**完整定义**：

1. **哪些行算「单玻」**：`底玻` **严格等于** 字符串 `"无"`。
   - 只看 `底玻`。**不看 `面玻`、不看 `玻璃厚`、不看 `型材`、不看 `开向`、不看 `扇数`**。
   - `undefined` / `null` / `""` / `"无 "`（带空格）/ `"5mm"` 都**不算**单玻。
2. **开关关掉时（默认）**：正常算，单玻行的扇数照算。
3. **开关打开时**：该行的**五类扇数全部记 0**。行**不被丢弃** ——
   `Me(rows)` 仍然把它的 `数量`/`平方数`/`金额` 计入 `totalQuantity`/`totalArea`/`totalAmount`，
   也仍然计入「平开/移门/淋浴/其它」的**门数/面积/金额**分类桶。
   所以**只有「扇数」类指标会变**，门数/平方/金额**一行都不变**。
4. **分母是谁**：`ke` 这个 computed 吃的是 `pe.value` ——
   看板**自己**在 `props.tableData`（= 页面传进来的 `K2`，原始未筛选行）上依次筛：
   时间区间（`w`）→ 客户（`m`）→ 业务员（`g`）→ 生产状态（`v`）之后的结果。
   **不是**页面上那张表的筛选结果（`no`），**也不是**整张表。
   每个 tab 的分组统计（`De/be/Se/Pe`）同样走 `pe.value`，所以口径一致。

### 4.2 相关代码（原文）

```js
// 逐行 → 扇数（@10655）
xe = e => { if (h.value && "无" === e["底玻"]) return {…全 0…}; … }

// 一组行 → 全部 KPI（@11893）
Me = e => {
  const l = { totalQuantity:0, …, totalFans:0, swingFans:0, slidingFans:0, slidingBrightFans:0, showerFans:0, otherFans:0 }
  e.forEach(e => {
    const o = e["数量"] || 0, n = e["平方数"] || 0, u = e["金额"] || 0
    const s = (行 => { … 归到 "移门" / "淋浴房" / "平开门" / "其它" … })(e)      // ★ 这里完全不看 底玻
    l.totalQuantity += o; l.totalArea += n; l.totalAmount += u
    s === "平开门" ? (l.swingQuantity += o,  l.swingArea += n,  l.swingAmount += u)
    : s === "移门" ? (l.slidingQuantity += o, l.slidingArea += n, l.slidingAmount += u)
    : s === "淋浴房" ? (l.showerQuantity += o, l.showerArea += n, l.showerAmount += u)
    :                 (l.otherQuantity += o,  l.otherArea += n,  l.otherAmount += u)
    const i = xe(e)                                                              // ★ 唯一吃 h 的地方
    l.swingFans += i.swingFans; l.slidingFans += i.slidingFans
    l.slidingBrightFans += i.brightFans; l.showerFans += i.showerFans; l.otherFans += i.otherFans
  })
  l.totalFans = l.swingFans + l.slidingFans + l.slidingBrightFans + l.showerFans + l.otherFans
  return l
}

// KPI 卡的数据源（@13291）
ke = Vue.computed(() => {
  const t = pe.value, l = Me(t), a = t.filter(e => e["单号"]).length
  return { ...l, startedCount: a, notStartedCount: t.length - a }   // 已生产/未生产 也不受 h 影响
})

// 分组统计（@13441）
Ae = e => { const l = new Map
  pe.value.forEach(a => { const n = e(a); l.has(n) || l.set(n, []); l.get(n).push(a) })
  return Array.from(l.entries()).map(([e, t]) => ({ name: e, metrics: Me(t) }))
            .sort((e, l) => l.metrics.totalAmount - e.metrics.totalAmount) }   // 按总金额降序

De = computed(() => Ae(e => e["客户"] || "未知客户"))
be = computed(() => Ae(e => e["业务员"] && e["业务员"].trim() ? e["业务员"] : "未分配"))
Pe = computed(() => Ae(e => e["型材"] || "未知型材"))
// 「生产状态」的分组版被算出来但没赋给任何变量（空转）：
Vue.computed(() => Ae(e => e["单号"] ? "已进入生产" : "未进入生产"))

// 按工序统计（@13981）：工序 1..15 逐槽，**跳过 10**，名字带槽前缀
Se = Vue.computed(() => { const t = new Map
  pe.value.forEach(l => { for (let e = 1; e <= 15; e++) {
      if (10 === e) continue                                  // ★ 工序10 又被跳过
      const o = "工序" + e, n = l[o]
      if (n && "" !== n) { const e = Le.value[o] || "", n = e ? o + "-" + e : o
        t.has(n) || t.set(n, []); t.get(n).push(l) } } })
  return Array.from(t.entries()).map(([e, t]) => ({ name: e, metrics: Me(t) }))
            .sort((t, l) => parseInt(t.name.match(/工序(\d+)/)?.[1] || "0") - parseInt(l.name.match(/工序(\d+)/)?.[1] || "0")) })
```

另外，开关只改了**文案**的两处：Excel 导出的表标题与「总扇数」列头会加 `(不含单玻)`
（`@19984` / `@20010`）。**其余列头、xlsx 的文件名、图表标题都不变**。

### 4.3 差分结果（真跑出来的）

把 `Ne/Be/ze/xe/Me` 这一段（2822 字符）切出来、注入桩函数跑（脚本见 §8）：

夹具：

```js
{单号:'A-1', 底玻:'无',  面玻:'5mm', 数量:2, 平方数:3.5, 金额:1000, 扇数:'2轨2扇',   开向:''}
{单号:'A-2', 底玻:'5mm', 面玻:'',    数量:3, 平方数:4.0, 金额:2000, 扇数:'2轨3扇',   开向:''}
{单号:'A-3', 底玻:'无',  面玻:'',    数量:1, 平方数:1.0, 金额:500,  扇数:'单轨单扇', 开向:'内左'}
```

| 指标 | `h=false`（默认） | `h=true`（不含单玻） | 变化 |
|---|---|---|---|
| `totalQuantity` | 6 | **6** | 不变 |
| `slidingQuantity` | 6 | **6** | 不变 |
| `totalArea` | 8.5 | **8.5** | 不变 |
| `totalAmount` | 3500 | **3500** | 不变 |
| `swingFans` | 1 | **0** | 单玻行 A-3 的 1 归零 |
| `slidingFans` | 14 | **9** | A-1 的 4 + A-3 的 1 归零 |
| `totalFans` | 15 | **9** | 差 6 = A-1(4) + A-3(1+1) |

单行 `xe`（`h=true`，`数量:2`、`扇数:'2轨2扇'`）：

| `底玻` | 返回 |
|---|---|
| `"无"` | `{swingFans:0, slidingFans:0, showerFans:0, otherFans:0, brightFans:0}` |
| `"5mm"` | `{swingFans:0, slidingFans:4, showerFans:0, otherFans:0, brightFans:0}` |
| `""` | 同上（**不算单玻**） |
| `null` | 同上（**不算单玻**） |
| `undefined` | 同上（**不算单玻**） |

顺带喂了一条**双开**行做桩自检（`{开向:'双开外开', 数量:2}`）→
`swingQuantity:2 / swingFans:4`，即被正确归进「平开门」且双开按 `2*数量` 计扇 —— 说明桩里的
`Ee/Ne/Be` 用对了（见 §8 踩坑 6）。

> ⚠️ 夹具 A-3 同时吃到「开向 `内左`」和「扇数 `单轨单扇`」两条独立分支，
> 所以它**同时**贡献 `swingFans` 和 `slidingFans`。这不是 bug，是旧版算法本身如此
> （`n` 与 `u` 分别算，互不排斥）。

### 4.4 ⚠️ 别类推：同一份代码里「单玻」还有**另一个**定义

打印/标签文案里的「单玻」是 **`底玻 === '无' && 面玻 !== '无'`**：

```js
// Progress-f53b59ce.js（线上）反混淆 @131177；本地 0x 同构
"无" === e["底玻"] && "无" != e["面玻"]
  ? n.glass = (g === "家家发门业" || g === "星之铝门窗") ? "单玻:" + e["面玻"]
                                                        : "单玻:" + e["面玻"] + "*" + e["玻璃厚"] + "mm"
  : "无" === e["底玻"] && "无" == e["面玻"] ? n["glass"] = "无玻璃"
  : e["型材"].includes("钻石") ? n.glass = … "固玻:"+底玻+"<br>门玻:"+面玻 …
  : 0 == e["玻璃厚"] ? n["glass"] = "背板:"+底玻+"<br>面板:"+面玻
  : n.glass = …
```

**两个「单玻」不等价**：

| 场景 | 看板「不含单玻」会剔吗 | 标签会写「单玻:…」吗 |
|---|---|---|
| `底玻='无'`, `面玻='5mm'` | ✅ 剔 | ✅ 写 |
| `底玻='无'`, `面玻='无'` | ✅ 剔 | ❌ 写「无玻璃」 |
| `底玻='无'`, `面玻=''` | ✅ 剔 | ❌ 走后面的分支 |

新版实现时**不要用一个「is单玻」函数同时喂这两处**。

---

## 5. 对 `docs/2026-09-17-home-analysis.md:217` 那条更正的补充建议

### 5.1 现状（**该文档保持原样，此处只提建议**）

`docs/2026-09-17-home-analysis.md:216-218` 现在写的是：

```
- **审核确认**（日期列内，仅未生产未审核行）：`updateCustomerInfo` + `Hl("确认下单", [回执单号])`（即 `updataProgress`，`param3` = 操作名）→ `更新成功`(1279)。
  > ⚠️ **2026-09-18 更正**：此处原先写「`updataProgress`(工序10, 操作名「确认下单」)」—— **「工序10」是错的**，
  > 这条传的只有操作名。`Hl("工序10", 单号集合, 日期)` 是另一个函数 `Gl` 在调。证据见 `docs/home-audit/02-actions.md` G2。
```

这条更正**说的两件事都对**（本轮复核过）：

- `Hl`（`Home.formatted.js` @412382）签名就是 `Hl(param3, refs, param4?)`，URL 拼接为
  `…?param1=updataProgress&param2={ds}&param3={encodeURIComponent(param3)}[&param4={…}]`；
- 审核确认的调用点（@592045）确实是 `await Hl("确认下单", [row["回执单号"]])` —— **没有 param4**；
- `Gl`（@413114）确实是 `Hl("工序10", refs, date)`。

**但它漏掉了最关键的一半：服务端拿到非槽值时会自己写 `工序10`。**

### 5.2 漏掉的事实

`legacy-dispatch.ts:791`（`HANDLER_MAP['updataprogress']`）：

```ts
if (isRawAction(p, 'updataProgress') && !isProcedureSlot(p.param3)) {
  return progServ.updatePrintStatus(p.ds, p.param3, p.body as string[], p.param4 || '');
}
```

`isProcedureSlot = (v) => /^工序\d+$/.test(v.trim())`（`progress.service.ts:230`）。
`"确认下单"` 不匹配 ⇒ 走 **`updatePrintStatus(ds, "确认下单", [回执单号], "")`**。

而 `updatePrintStatus`（`progress.service.ts:661`）会写：

```ts
// 1) 命中明细行（订单级命中时是「所有明细行」）写 工序10 —— 合并而非覆盖
nextSpecs[key] = rows.map(row => withProgressText({
  ...row, '工序10': mergePrintStatus(row['工序10'], statusText),
}))
// 2) 无论如何都写订单级 customerInfo['打单操作']（Home 页「打单操作」那一栏的数据源）
nextSpecs = { ...nextSpecs, customerInfo: {
  ...customerInfo,
  '打单操作': mergePrintStatus(customerInfo['打单操作'], statusText),
  '单号集': buildReceiptNoSet(nextSpecs),
  ...(operatorName ? { '打单人': operatorName } : {}),   // 这里 operatorName === '' ⇒ 不写
} }
```

`mergePrintStatus`（`progress.service.ts:102`）= 用 `_` 拼、**已存在就不重复加**（幂等追加）。

### 5.3 建议的替换文字（供拍板）

> ⚠️ **2026-09-19 补**：上面那条 2026-09-18 的更正要**再补一半** ——
> 「前端传的不是工序10」说的是**第 2 个参数**（`param3`）；但这条请求**最终仍然会写成 `工序10`**，
> 因为服务端按 `param3` 分流：**非 `/^工序\d+$/` ⇒ 走 `updatePrintStatus`**，
> 而 `updatePrintStatus` 内部把 `工序10 = mergePrintStatus(原值, "确认下单")` 写进命中的明细行
> （订单级命中时=全部明细行），**并且**把 `customerInfo["打单操作"] = mergePrintStatus(原值, "确认下单")`。
> 所以：
> - 「前端不传 工序10」= **对**（`Hl("确认下单", [回执单号])`，证据 @592045）；
> - 「效果不是写 工序10」= **错**（效果恰恰是写 工序10，只是由服务端代写的）。
>
> 同理，Home 上所有 `Hl("生产单"/"玻璃订单"/"标签"/"收据单"/"确认下单", refs)` 的调用
> **都会在服务端的 `工序10` 槽和分析文档 §5.5 的「按工序统计（跳过工序10）」里出现** ——
> 这也是 Progress 页「按工序统计」tab 要 `if (10 === e) continue` 的原因之一。
> 证据：`legacy-dispatch.ts:791`、`progress.service.ts:661/102/230`。

（若嫌长，最小改法：把 218 行末尾那句「这条传的只有操作名」改成
「这条**前端**传的只有操作名；**服务端** `!isProcedureSlot(param3)` 分支会转 `updatePrintStatus`，
最终**仍然写 `工序10`**（+ `customerInfo.打单操作`）」）

---

## 6. `'开门红'` 这个硬编码

### 6.1 结论

```js
// Progress-f4bdef35.js 反混淆 @118865（Vue.onMounted）
Vue.onMounted(async () => {
  …
  const t = await o()                                   // 读 userinfo
  if (t) {
    3 === t["userinfo"]["defaulted"] && (D.value = !1)  // 3 = 终端 → 关 PC 模式
    const l = t["userinfo"]["registrant"]               // 公司名 / 品牌
    const a = t["userinfo"]["name"]                     // ★ 账号显示名
    L["value"] = a
    b["value"] = l === a                                // 是否「注册人」
    P["value"] = l === a || a === "开门红"               // ★ 「生产分析」按钮开关
  }
})
```

- `l` = `userinfo.registrant`（**公司名/品牌**），`a` = `userinfo.name`（**账号显示名**）。
- 硬编码比的是 **`userinfo.name`**，**不是** `registrant`、**也不是**「公司名」。
- 只有 `registrant !== name` 时这半条才有意义（否则 `l === a` 已经为真）。

### 6.2 命中时多出什么 UI

**只有一样东西**：工具条上一颗 `el-button type="primary"` **「生产分析」**（`P` 在整份 Progress 包里
**只被读 1 次**，就是它的 `v-if`）：

```js
P["value"] ? createBlock(r, { key:2, type:"primary", onClick: () => B.value = true },
  { default: () => [createTextVNode("生产分析")] }) : createCommentVNode("", true)
```

点它 → `B.value = true` → 打开 `ProductionDashboard` 那个全屏看板对话框（`production-dashboard-dialog`）。
`b`（注册人）另外还控制数据范围（`oo = b ? K2 : K2.filter(r => r.打单人 === L)`），**与硬编码无关**。

**⚠️ 2026-09-19 新版落地的两处差异**（`app/src/views/Progress.vue`）：

1. ~~看板本版没做~~ **✅ 已接真看板**（`components/ProgressDashboard.vue`，第五刀）——
   这颗按钮**已不是置灰**，点了就开看板。⚠️ 进度见 `-analysis.md` §8.0 的表，别再照抄旧措辞。
2. **新版没有按 `P2` 控制显隐**：`P2 = (registrant === name) || name === '开门红'` 依赖
   `userinfo.registrant` / `userinfo.name` 这套账号字段，而新版账号模型里**还没有**这两个概念
   （`-analysis.md` §10：`defaulted` 不复刻、账号类型映射等做权限那一步再定）。
   所以按钮**恒渲染**（且**可点**，见上第 1 条）。等权限那一步落地时，要么补上 `P2` 等价条件、
   要么明确决定「任何人都能看到这颗按钮」。⚠️ `'开门红'` 那半条本来也不可达（见 §6.3），
   别顺手把它当笔误删掉。

### 6.3 ⚠️ 但这条分支**实际不可达** —— 同 build 的路由守卫会把「开门红」账号踢下线

`index-c3b16e3f.js`（反混淆 @67700 附近）里有一个「反盗版」守卫函数：

```js
async function on(e, t) {                                    // e = userinfo 对象，t = next
  if ("开门红" === e?.userinfo?.name)
    return await (async redirect => {
      await ElementPlus.ElMessageBox.alert("吾忧我知道你了，再这样子报警，无耻的小偷！", "警告",
        { confirmButtonText: "我知道了", type: "warning" })
      await tn()                                             // 清 token / token_expires_at / try_time / loginDate
      redirect("/login")
    })(t), true
  …
}
```

而 `on` 在路由守卫里被调用**两次**，其中一次是**所有已登录导航**都会走的分支：

```js
// index-c3b16e3f.js @87682 附近
if (!o && "/login" !== e.path) return void n("/login")
if (o && "/login" === e.path) try { … if (await on(e, n)) return; … }   // ① 去 /login 时
else try {                                                              // ② 其它所有导航
  const t = await A()
  if (await on(t, n)) return                                             // ★ 这里
  …
}
```

`o = localStorage.getItem("token")`。所以**任何**已登录状态下的跳转都会先过 `on`。
名字正好是「开门红」的账号一旦登录成功、Login 页 `push("/hui")`，这次导航就命中分支 ②，
弹警告 + 清 token + `next("/login")` —— **根本进不去**。

> ✅ 这条链路上每一步都核过了：
> ① `push("/hui")` 之前 `localStorage.token` 已经写好（`Login` 里先 `localStorage.setItem("token", h.token)` 再跳）；
> ② `to.path !== '/login'` ⇒ 走 `else` 分支；
> ③ 守卫最上面那句 `if (!1 === e.meta?.requiresAuth) return void n()` **不会提前返回** ——
> 路由表里 `/hui`、`/Progress`、`/home` **都没有 meta**（`undefined !== false`），
> 带 `meta` 的只有 `/login`(false)、`/receipt-share`(false)、`/share`、`/terminal-orders`(true)。
> ④ 于是 `on(t, n)` 必被调用。

**⇒ 结论：`a2 === "开门红"` 是死代码**（除非有人把守卫拆掉）。
但它是**故意留的诱饵**（警告文案「再这样子报警，无耻的小偷」—— 针对拿到源码的人），
**不能当「作者笔误」删掉**，也不该照抄进新系统。

**线上 build 里这段守卫仍然在**（`/tmp/live.decoded.js` @60475，只是文案去掉了「吾忧」二字）：

```js
async function Ct(e, t) {
  return "开门红" === e?.userinfo?.name
    ? (await (async e => { await ElementBox.alert("我知道你了，再这样子报警，无耻的小偷！", "警告", …)
                           await gt(); e("/login") })(t), true)
    : !(!(name === "开门红试用号") || !vt()) && (await (…));
}
```

### 6.4 同一 build 里的其它硬编码（一并列出，判断「保留还是删」时一起看）

| 串 | 位置 | 作用 | 线上还在吗 |
|---|---|---|---|
| `"开门红"` | `index` 守卫 | 反盗版：踢下线 | ✅ 在 |
| `"开门红试用号"` | `index` 守卫 | 试用账号，`loginDate` 距今 `>= 2` 天则「试用期已到，早买早享受哦」+ 踢下线 | ✅ 在 |
| `"开门红"` | `Progress` `P2` | 「生产分析」按钮（**不可达**，见 §6.3） | ✅ 在（表里有 `dl(698)`） |
| `"开门红，欢迎您！"` | `index` `Navigation` 顶部 | **对所有中文用户硬编码的欢迎语**（英文分支是 `"Welcome!"`）；同一处 logo `alt="开门红"`、logo 文件 `/png/开门红-5010a417.png` | ✅ 在 |
| `"开门红"` | `Diao-1afe5586.js` | 公式页：`if ("开门红" !== userinfo.name) { if (!(await verifyPassword(...))) return }` —— **只有名字不是「开门红」时才要密码** | ⚠️ 未逐字复核线上 |
| `"开门红试用号"` | `Hui.formatted.js` | 常量 `TRIAL_ACCOUNT_NAME = "开门红试用号"` + `TRIAL_DEVICE_LICENSE_CACHE_TTL_MS = 108e5` | ⚠️ 未逐字复核线上 |
| `["欧诺名门1"]` / `["欧诺名门","菲邦门业数据版"]` | `index` 画门窗 | 命中则弹「由于免费用户过多，免费空间已耗尽，画门窗功能限时免费使用。」（**只弹提示，不拦**） | ✅ 在（线上是 2 个名字） |
| `"家家发门业"` / `"星之铝门窗"` | `Progress` 标签/打印文案 | 决定玻璃文案要不要带 `*{玻璃厚}mm` | ✅ 在 |
| `"smartdoor-2025"` | `setting-872a24e9.js` `q` | 设置页某个固定串（本轮未展开） | ⚠️ 未证 |

**本轮只负责把事实摆清；新版保留与否不由本文决定。**

---

## 7. 怎么复现本文结论

```bash
cd /Users/aaa/Desktop/door-main

# ① Progress 整包反混淆（分析文档已建立的流程）
node legacy/decode-progress-map.mjs legacy/js/Progress-f4bdef35.js /tmp/progress-map.json
node legacy/decode-progress-scoped.mjs legacy/js/Progress-f4bdef35.js /tmp/progress-map.json /tmp/progress.decoded.js
#    → 0 残留，可直接 grep：  不含单玻 / 开门红 / 底玻

# ② 两套外壳
node legacy/decode-progress-map.mjs legacy/js/index-c3b16e3f.js /tmp/index-map.json
node legacy/decode-progress-scoped.mjs legacy/js/index-c3b16e3f.js /tmp/index-map.json /tmp/index.decoded.js
grep -o '.\{200\}mobile-bottom-tab.\{200\}' /tmp/index.decoded.js | head
curl -sk https://www.19901110.xyz:16666/js/index-f9710780.js -o /tmp/live-index.js
shasum /tmp/live-index.js      # 30f17fee6d68d490808ba5b73ef4fffaf274846e
node legacy/decode-progress-map.mjs /tmp/live-index.js /tmp/live-map.json
node legacy/decode-progress-scoped.mjs /tmp/live-index.js /tmp/live-map.json /tmp/live.decoded.js

# ③ Qrscanner（写入点）
node legacy/decode-progress-map.mjs legacy/js/Qrscanner-195163c4.js /tmp/qr-map.json
node legacy/decode-progress-scoped.mjs legacy/js/Qrscanner-195163c4.js /tmp/qr-map.json /tmp/qr.decoded.js
python3 -c "import json;t=json.load(open('/tmp/qr-map.json'))['sets']['f']['table'];print(t['449'],t['316'])"
#   → procedure_name_color_map / procedure_name_order_list

# ④ Login（defaulted 的落地跳转 + procedures_data）
node legacy/decode-progress-map.mjs legacy/js/Login-1a4b7608.js /tmp/login-map.json
node legacy/decode-progress-scoped.mjs legacy/js/Login-1a4b7608.js /tmp/login-map.json /tmp/login.decoded.js

# ⑤ 全仓库扫 key（45 个 chunk 的解码表都 dump 一遍）
mkdir -p /tmp/allmaps && for f in legacy/js/*.js; do
  node legacy/decode-progress-map.mjs "$f" /tmp/allmaps/$(basename "$f" .js).json >/dev/null 2>&1; done
grep -l 'procedure_name_color_map' /tmp/allmaps/*.json
#   → 只有 Progress-f4bdef35.json 与 Qrscanner-195163c4.json

# ⑥ 看板 KPI 差分台（§4.3）
node /tmp/dash.harness.mjs      # 见 §8 的脚本
```

⚠️ `decode-progress-map.mjs` 的自检是**钉死在本地 Progress 包**上的，
跑**线上新 build**（`Progress-f53b59ce.js`）会 `throw`。本轮做法是：
复制一份到 `/tmp/dump-map-nocheck.mjs`、把 self-check 的 `throw` 降级为警告
（**仓库里的原脚本没动**）。线上包的表**尚未被自检钉住**，本文引用它的结论都做了交叉核对
（例如「线上 `xe` 的 `"无" === e["底玻"]` 逐字相同」）。

---

## 8. 本轮用到的脚本 / 中转产物

| 路径 | 用途 | 是否入库 |
|---|---|---|
| `legacy/decode-progress-map.mjs` | 解码表 dumper（上轮产物，本轮复用） | 已在库 |
| `legacy/decode-progress-scoped.mjs` | 作用域感知反混淆器（上轮产物，本轮复用） | 已在库 |
| `legacy/lib-break-render.mjs` | Vue render 折行（本轮**没用到**） | 已在库 |
| `/tmp/dash.slice.clean.js` | 从 `progress.decoded.js` 切出 `Ne/Be/ze/xe/Me`（2822 字符），把 `const X=r` 的**解码器别名初值换成 `null`**（保留声明，否则破坏 `const` 多声明器） | 一次性 |
| `/tmp/dash.harness.mjs` | 注入桩：`r`（被调用就抛，防止误以为它参与计算）、`h`（`{value}` 模拟 ref）、`l()`（开向命名表）、`a`（开向归一化）、`Ee/Ne/Be` 三个开向数组 | 一次性 |
| `/tmp/qr.flat.js` | Qrscanner 全量反混淆（再用 `f` 表把残留 `X(NNN)` 一次替换干净） | 一次性 |
| `/tmp/login.flat.js` / `/tmp/to.flat.js` | 同上的 Login / TerminalOrders | 一次性 |
| `/tmp/dump-map-nocheck.mjs` | 上面那份 self-check 降级副本，**仅供线上新 build 用** | 一次性，不入库 |

### 踩坑（免得下次再踩）

1. **`grep -c` 判断「某串在不在某个包里」会骗人**。解码表 dump 出来的是**一行 JSON**，
   `grep -c` 返回的是「有多少行命中」= 0 或 1，看起来像计数。要用
   `grep -l`（哪个文件命中）或直接把表读进 Python 逐条比。
   —— 本轮第一版就靠 `grep -c` 误判过 `Qrscanner`。
2. **`局部名(数字)` 不一定都是解码器调用**。Progress 包反混淆后有 30 处 `B(779)` 一类残留，
   它们在 `setup` 作用域里是**别的别名**；直接全局替换会把无关代码改坏。
   正确做法是按**词法作用域**解析（`decode-progress-scoped.mjs` 干的就是这个），或者
   **只替换「下标全部落在该表有效区间内」的那些名字**（本轮 Qrscanner / Login 的兜底就是这么做的：
   先确认 8 个别名的下标全部落在 `f` 表 157..696 里，再替换）。
3. **`const e=r` 里 `r` 是数组函数还是解码器，光看文本看不出来**。
   `setting-872a24e9.js` 里满篇 `const e=r; e(163)` —— 但 `r` 是**数组取回函数**
   （`function r(){const e=[…15 条…]; return (r=function(){return e})()}`），真正的解码器是 `u`/`C`/`M`。
   **判定办法：真的把解码器 eval 出来，用同一个下标分别调 `r(163)` 和 `C(163)` 看谁返回字符串。**
   （`r(163)` 返回 15 元素数组、`C(163)` 返回 `"生产标签"`。）
4. **移动端 tab 的项是裸 `<div class="tab-item">`，不是 `el-menu-item`**，
   图标 class 是 `tab-icon` 而不是 `desktop-icon`。用 `desktop-icon` 去 grep 会漏掉整个移动端（§2 的老坑）。
5. **`decode-progress-map.mjs` 的自检会 `throw`**，跑非本地 Progress 包时必须先降级，
   但**别顺手改仓库里的脚本**。
6. **给看板切片喂桩时，`Ee` / `Ne` / `Be` 三个开向数组必须逐字照抄**：
   `Ee` 是 **14 条的并集**（`Ne` 8 条单开 + `Be` 6 条双开），`Ne` 才是 8 条。
   本轮第一版把 `Ee` 误传成了 8 条 → `Me` 里 `ze(开向)`（用 `Ee`）会把「双开外开」判成「其它」而不是「平开门」。
   §4.3 的夹具恰好只用 `内左`，两次跑出来的数一样；**但换成双开行就会错**，
   所以照抄原数组、并且**加一行双开夹具自检**（本文 §4.3 补的那行 `双开外开` 就是干这个的）。

### 本轮顺带产出的 localStorage key 全清单（按包）

用 §7⑤ 的全量 dump 反查「哪些包含哪些 key」：

```
add_2                     <- Hui, Progress
apply_failed              <- index
change_password           <- Login
clients_info              <- clients_Info
custom_direction_names    <- Login, ReceiptView, TerminalOrders
diao_column               <- Hui            hui_picture    <- Home, Hui, Progress
diao_counts/diao_money/diao_sheets/diao_tabs/ping_money/ping_square/ping_tabs <- index / Hui / Progress
diao_hui / ping_hui       <- Home, Hui, Progress, ReceiptShare, ReceiptView, TerminalOrders
finance_payment_methods   <- Home
glass_sheet2_printer_v1 / glass_sheet2_template_v1 <- Home
label_quantity_enabled / label_quantity_value / qr_label_printer <- Qrscanner
loginDate / token / token_expires_at / try_time / remember_password / saved_password / saved_username <- Login / Hui / index
mutil_user / ping_column  <- index / Hui / TerminalOrders
pending_receipt_no        <- Login
procedure_name_color_map  <- Progress, Qrscanner      ← ★ 本文 §1
procedure_name_order_list <- Progress, Qrscanner      ← ★ 本文 §1
procedures_data           <- Hui, Login               ← §1.7
production_sheet_printer / production_sheet_template_v1 / qualified_label_* / receipt2_* <- Home
smartdoor_client_device_id / smartdoor_electron_* / smartdoor_hot_update_last_attempt_debug <- index
smartdoor_disable_auto_markup / smartdoor_last_order / smartdoor_sort_method / smartdoor_store_name <- Hui / CompositeGate3DDemo
terminal_font_size        <- TerminalOrders
staffName / openDirectionCustomNames / newFinanceSystem / app-locale / assistiveMenuEnabled / assistiveFullscreen / loginDate <- 见各包
```

---

## 9. 仍未证实 / 需要上游拍板

1. ⚠️ **`defaulted === 3`（终端账号）的写入点**：旧服务端源码里查不到。
   前端对 3 的处理是明确的，所以**不影响实现**，但「终端账号怎么开出来」这件事没有答案。
2. ⚠️ **`defaulted === 0`**：只有 `changePassword` 会写 0。前端没有任何分支特判 0
   （所以它落进「普通 PC 账号」桶）。**「0 是普通账号」是从「代码里没有它」推出来的，不是正面证据。**
3. ⚠️ **`SetProcedures` 的 `param2`**：前端传 `userinfo.registrant`，服务端 handler 用的是 `p.ds`。
   与分析文档 §9 第 3 条同一个问题（`GetProcedures` 的 `param2`），本轮**没有**解决。
4. ⚠️ **`Qrscanner` 页面本身是否对 `defaulted !== 1` 的用户也开放**：外壳里「扫码生产」的可见条件是
   `we && !ve`（即 `defaulted !== 3`），**不是** `defaulted === 1`。所以 `defaulted === 0/2` 的用户
   能打开页面但用不了「设置工序」/「扫码查单」。**这是有意还是漏判，未证实。**
5. ⚠️ **`Diao` 页的 `"开门红" !== userinfo.name` 免密分支**：`Diao-1afe5586.js` 是单行混淆且**没有**内联解码器表
   （dump 不出表），本轮只在**原文**里看到这一处，**没有**逐字反混淆 + 复核线上 build。
6. ⚠️ **线上 `Qrscanner` / `Diao` / `Hui` 三个包**：本轮只查了 `Progress` / `index` / `Login`
   三个线上包的**解码表**，其余包没有逐字复核（线上 chunk 是另一套 hash，本地那份对不上）。
7. ⚠️ **`Vue.computed(() => Ae(e => e["单号"] ? "已进入生产" : "未进入生产"))`** 是被算出来
   **没有赋给任何变量**的空转（分析文档 §5.5 把它当成一个隐藏 tab；实际它连 tab 都不是）。
   **是否本来该有一个「按生产状态统计」tab**，未证实。
8. ⚠️ **`procedure_name_order_list` 的消费语义**：Progress 的 `J()` 拿到数组后**从后往前**找第一个
   出现在进度串里的名字（分析文档 §5.3 已写）。由于写入侧**按槽号升序且不含工序10**，
   实际效果是「**工序号最大的那个工序的颜色优先**」。
   但这依赖「用户在扫码页保存过一次」；**没保存过的机器上这个 key 不存在**，走的是另一条按「颜色名长度倒序」的匹配。
   **新版要不要保留这个「双分支」**，建议上游拍板。
