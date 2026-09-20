# 生产进度（`/Progress`）逆向分析

> 源文件：`legacy/js/Progress-f4bdef35.js`（164919 字节，**单行**混淆）
> 路由：`legacy/js/index-c3b16e3f.js` @73662 —— `{path:"/Progress",name:"Progress",component:()=>import("./Progress-f4bdef35.js")}`
> 样式：`legacy/css/Progress-4dee25cf.css`（含两个 scopeId：`data-v-95ebc180` = 页面，`data-v-720e8586` = 看板）
> 旧版**服务端源码**：`/Users/aaa/Downloads/server`（本次已用来把「推断」升级为「证实」）
>
> 本文所有结论都带证据。证据形式：
> `@NNNNN` = 在 `Progress-fb4def35.js` 里的**字节偏移**（单行文件）；`E(n)` / `de(n)` 等 = 解码表下标（解码表由
> `legacy/decode-progress-map.mjs` 跑出来）；服务端结论给文件+行号。

---

## 0. 一句话结论

`/Progress` **不是**一张独立的新表，也**不是**首页的一个视图 —— 它是**把「订单管理」（Home）整页复制一份改出来的**
「生产进度」页：同一套工序/打单数据结构，换了一套**读接口**（`getProgress` / `getProgressForTerminal`）、
一套**专为工序链设计的列集**（14 列，PC），外加一个内嵌的**「生产分析看板」**（`ProductionDashboard`，echarts 大屏）。

它**只读 + 只改进度**：没有新建订单、没有编辑门款字段的入口；能做的是
「更新进度 / 删除进度 / 收款 / 打印各类单据 / 查询更多 / 导出表格 / 看板」。

---

## 1. 这是什么页、给谁用、入口在哪

### 1.1 入口（结论）

旧版**桌面版左侧菜单**第 `index:"9"` 项：**⏳ 生产进度**。

```js
// 菜单项（index 包反混淆后的渲染原文）
fe["value"] && !ve["value"]
  ? createBlock(o, { key: 4, index: "9", onClick: me }, { default: withCtx(() => [
      createElementVNode("span", { class: "desktop-icon" }, "⏳"),
      createElementVNode("span", null, "生产进度")
    ])})
  : createCommentVNode("", true)

// 点击回调
me = () => { const e = n; T(), r["push"]("/Progress") }
```

证据：`legacy/js/index-c3b16e3f.js` 里 `setup(e,{expose:t}){const n=X,...}` @15381（`X` 是解码器 `R` 的别名，
`legacy/js/index-c3b16e3f.js` @12233 `const X=R;`）；菜单项渲染在反混淆后的 `onClick: me` 处。

### 1.2 菜单可见性（与账号类型绑定）

```js
const n = t.userinfo.defaulted
if (n == 2 || n == 3) {
  de.value = false
  if (n == 3) { we.value = false; ve.value = true }   // 3 = 终端账号
  if (n == 2) { fe.value = false }                    // 2 = 受限账号
} else de.value = true
```

- `defaulted == 3`（**终端账号**）→ `ve = true`：菜单换成「📋 订单管理 → `/terminal-orders`」，
  **⏳ 生产进度 不出现**。
- `defaulted == 2` → `fe = false`：**生产管理 / 生产进度 都不出现**。
- 其它（正常 PC 账号）→ 两个都出现。

⚠️ 注意：**页面本身没有再做一次拦截** —— 手工敲 `/Progress` 仍能进（终端账号进去后会自动落到终端模式，见 §6）。

### 1.3 页面职责

给**老板 / 生产管理者**看「哪些单做到哪道工序了」，并且直接在这里推进工序。
生产终端（车间）用的是同一组件但走 `getProgressForTerminal` 且列更少（见 §6）。

---

## 2. 页面骨架

页面组件 = `ml = Vue.defineComponent({name:"Progress", __name:"Progress", ...})`
（`@63437` `ml=Vue.defineComponent(`，`@63461` `name:ce(710),__name:ce(710)`，`de(710) === "Progress"`；
导出 `const pl=n(ml,[["__scopeId","data-v-95ebc180"]]);export{pl as default}` @164896）。

### 2.1 顶层结构

```
<div class="ping-hui-outer-container">      ← margin-top:65px（给顶栏让位）
  <div class="ping-hui-container">
    <div class="search-row">                ← 工具条 + 统计行
    <el-table ...>                          ← 主表（v-if="K2.length > 1"）
    <div class="table-footer"><el-pagination>
  </div>
  ... 各种 el-dialog / el-drawer（打印、更新进度、收款、查询更多、看板）
</div>
```

证据：`const Ve={class:"ping-hui-outer-container"},we={class:"ping-hui-container"},ye={class:"search-row"},
me={key:4,class:"search-info"},ge={class:"total-info"},ve={key:5,class:"search-info"},fe={class:"total-info"}`
（反混淆源 `const Ve = { class: "ping-hui-outer-container" }, we = ...`）；样式见 `legacy/css/Progress-4dee25cf.css`
（`[data-v-95ebc180]` 那一段）。

### 2.2 工具条（`search-row`，从左到右）

| 按钮 | 出现条件 | 行为 |
|---|---|---|
| 打印选项 | `D2`（PC 模式） | 开打印抽屉 `zl=true` |
| 批量更新 (n) | `已选条数 > 1` 且 `D2` | 批量改工序 |
| 查询更多 | 始终 | 开「更多查询」对话框（`Lo`） |
| 生产分析 | `P2` | 开看板 `B2=true` |
| 刷新 | 始终 | `pa()` = 重新拉 `getProgress` + 清空勾选 |
| 导出表格 | `zo`（有搜索词/更多查询条件）非空 | ExcelJS 导出「筛选结果」 |
| 搜索框 | 始终 | `placeholder="输入关键词搜索（可用空格分隔多个关键词）"`，`clearable` |

统计行两种形态（`zo` 非空时显示「当前筛选」，否则显示「总计」）：

```
当前筛选: {zo} ({no.length} 条结果)  | 时间: {earliest} 至 {latest} | 移门扇数: {yo} | 平开门扇数: {vo}
                                     | 移门亮窗个数: {mo} | 淋浴房扇数: {go} | 其它: {fo}
总计: {no.length} 条记录              | 时间: …（同上）
```

证据：渲染原文 `默认: … Vue.createTextVNode(" 当前筛选: "+toDisplayString(zo["value"])+" ("+toDisplayString(no.value.length)+" 条结果) ")…`。

**✅ 2026-09-19 已落**（`app/src/views/Progress.vue`，差分台 `docs/progress-toolbar-logiccheck.mjs`）。
四处**要留意的落地细节**：

1. ~~三颗按钮的目标 UI 本版还没做~~ **✅ 2026-09-19 全部接上**：
   「生产分析」→ 真看板、「打印选项」→ 真抽屉（§4.5）、「批量更新」→ 真弹窗（§4.2）、
   「查询更多」→ 真对话框（§3.3 / §4.1）—— **七颗按钮没有一颗是置灰占位**，
   `notYet()` 与 `.pending-slot` 那套占位机制已从本页删掉。
   行勾选 UI 也补齐了（§2.3 第 1 行、§4.2），所以「批量更新 (n)」按旧版条件（已选 > 1）
   **会真的出现**；没勾选时仍然一颗都不渲染（旧版此刻本来就没有这颗按钮）。
2. **`zo` 还兼着「导出表格」的显隐开关**（见 §4.6），新版同样是「搜索词非空才出现」。
   ✅ 现在两条赋值路都在了：搜索框（`v-model`）与「查询更多」确认时的回显
   （`zo = (客户 + " " + 地址).trim()`）—— 后者在**两个条件都空**时得到空串 ⇒ 那句仍是「总计」、
   「导出表格」也不出现，**与旧版一致**（别当成 bug）。
3. **旧版 `no` 的第一句是 `Bo ? xo : oo`** —— ✅ **已补**：新版 = `moreActive ? moreRows : rows`
   （`onSearchInput` / `onSearchClear` 退出，照旧版的 `ao` / `lo`）。
   ⚠️ `Bo`/`xo` 与 `oo`（数据范围）**不是一回事**：前者是用户主动查出来的结果集、后者是权限范围；
   旧版把结果集**架在**数据范围之上（`Bo ? xo : oo`），但结果集本身在 `Io` 里已经被数据范围滤过一遍
   —— 新版 `oo` 仍未实现（见 §10），所以今天两者同源。
4. **搜索框动一下不重置页码**是旧版的行为（`zo` 只被 v-model 写、`ao` 只清 `Bo`），
   本站**有意偏离**：搜索词一变回第 1 页（旧版会停在越界页显示空表）。
5. 旧版「当前筛选」那句尾部还有一个空格（和 `<span>` 开头的空格连成两个），
   模板编译器会把节点末尾空白吃掉 ⇒ 新版只剩一个；HTML 会把连续空白并成一个，渲染无差别。

### 2.3 主表列集与列顺序（**关键**）

表组件 `el-table`：`data=io`（当前页切片）、`border`、`size="small"`、
`cell-style=ue2`（只给「生产进度」列上底色）、`height="calc(100vh - 240px)"`、
**`v-if="K2.value.length > 1"`**（⚠️ 见 §9 的「旧版本身有毛病」）。

列（`el-table-column`）按源码出现顺序，含各自的显示条件：

| # | label | min-width | 出现条件 | 单元格内容 |
|---|---|---|---|---|
| 1 | **日期** | 30 | 始终 | `D2` 时表头带「全选/取消全选」checkbox；行内 checkbox；`{日期}`；`D2` 时右侧两个链接 **更新进度** / **删除**（✅ 表头那颗与行内那颗 2026-09-19 已落，见下） |
| 2 | **客户** | 40 | `D2` | `{客户}` |
| 3 | **单号** | 30 | `D2` | 表头：`有单号`/`空单号` 列筛（`filters` + `column-key="单号"`）+「查单号」popover（输入 `-` 前数字也可，回车确认）；单元格 `{单号}` + hover tooltip |
| 4 | **生产进度** | 150 | 始终 | 表头：「颜色筛选」popover；单元格 `innerHTML = va(生产进度)`，含「回款」时加 `.progress-paid`（红字） |
| 5 | **备注** | — | **`!D2`**（终端） | `{安装地址}` + `{备注}` 两行 |
| 6 | **型材/颜色** | — | 始终 | `{型材}` / `{颜色}` 两行 |
| 7 | **玻璃** | — | 始终 | 底玻 / 面玻 / 玻璃厚（`glass-input-label` 小标签） |
| 8 | **扇数/开向** | — | 始终 | `{扇数}`（可空）/ `{开向}` |
| 9 | **下轨道/套线** | — | 始终 | `{轨道种类}`（有才显示）/ `{套线种类}`（有才显示） |
| 10 | **门洞尺寸** | — | 始终 | 门洞高 / 门洞宽 / 墙厚 / 轨道长，`{洞尺}` 有则追加 |
| 11 | **亮窗信息** | — | 始终 | 亮窗总高 / 亮窗数量 / `{封板高}`（>0 才显示） |
| 12 | **备注** | — | **`D2`**（PC） | `{安装地址}` + `{备注}` |
| 13 | **金额** | 45 | 始终 | 单价/数量/平方/金额等 |
| 14 | **打单人** | 40 | `D2` | `{打单人}` |
| 15 | **业务员** | 40 | `D2` | `{业务员}` |

- **PC 模式（`D2=true`）共 14 列**：日期、客户、单号、生产进度、型材/颜色、玻璃、扇数/开向、下轨道/套线、门洞尺寸、亮窗信息、备注、金额、打单人、业务员。
- **终端模式（`D2=false`）共 10 列**：日期、生产进度、**备注（前移到这里）**、型材/颜色、玻璃、扇数/开向、下轨道/套线、门洞尺寸、亮窗信息、金额。
  （`备注` 在两种模式下**位置不同**，这是同一个 label 出现两次的原因，不是重复列。）

样式补充：`[data-v-95ebc180] .el-table{min-width:1500px}`、表头底色 `#f0f9eb`、`table-layout:fixed`（`Progress-4dee25cf.css`）。

**✅ 2026-09-19：「日期」列的两颗 checkbox 已落**（`Progress.vue` 的 `dateHeader` / `allSelected` /
`toggleSelectAll`，差分台 `docs/progress-select-logiccheck.mjs`），两条**反直觉、但必须照抄**的语义：

1. **表头「全选」盖的是「当前筛选结果」`no`**，不是当前页、也不是全量 —— 旧版自己在 checkbox 的
   `title` 里就写了「全选/取消全选（**当前筛选结果**）」（本版照抄这句 title）。
   对应新版 = `filteredRows`（筛完但**没分页**）。
2. **「取消全选」清的是全量 `K`**（`K.value.forEach(r => r.isSelected = false)`），**不是 `no`** ——
   被筛掉、翻到别的页的那些勾**也会一起清掉**。看着别扭，但这是旧版的行为，别「顺手改对」。
3. 勾选态挂在**行对象**上（旧版 `isSelected` 就是在 map 那一步补的），新版同 —— 不另开「已选 id」表。
   ⚠️ 新版**没有**旧版那两个 `ping_hui`/`diao_hui` 数组：旧版建它们只是为了打印时拼标签/生产单的行，
   新版打印走「订单 + 行」链路 ⇒ 唯一事实来源是行上的 `isSelected`（见 §4.2 / §4.5）。

### 2.4 分页

`el-pagination` 在 `.table-footer`（`justify-content:center`）；`page=ro`（初值 1）、`pageSize=uo`（初值 **100**）、
可选 `[10,20,50,100,200]`；翻页后把 `.table-container` 滚回顶部；改页长重置到第 1 页。
证据：`ro=Vue.ref(1),uo=Vue.ref(100),so=[10,20,50,100,200],io=computed(()=>no.value.slice((ro.value-1)*uo.value, ro.value*uo.value))`。

---

## 3. 数据来源（**最重要**）

### 3.1 只读接口

前端调用点（`Progress-fb4def35.js`）：

```js
// @108455
if (D[t(765)]) a = await fetch(t(259) + l.userinfo.ds);                       // t(765)="value" → D.value
else {
  const e = l[t(675)].name[t(720)]("-")[1];                                    // t(675)="userinfo", t(720)="split"
  a = await fetch(t(777) + (l[t(675)].ds + "_") + e);                          // @108535
}
```

解码后：

| 场景 | URL |
|---|---|
| PC（`D=true`） | `https://www.samrtdoor.com.cn/1?param1=getProgress&param2={userinfo.ds}` |
| 终端（`D=false`） | `https://www.samrtdoor.com.cn/1?param1=getProgressForTerminal&param2={userinfo.ds}_{userinfo.name.split("-")[1]}` |

URL 前缀本身也在解码表里：`de(259)="https://www.samrtdoor.com.cn/1?param1=getProgress&param2="`、
`de(777)="…?param1=getProgressForTerminal&param2="`、`de(299)=getMoreProgress`、`de(387)=getClientsInfo`、
`de(706)=deleteProgress`、`de(712)=updataProgress`、`de(489)=PaymentCollection`、`de(743)=updataPaymentCollection`、
`de(446)=finance_getCustomerBalance`、`de(697)=deleteRow`、`de(360)/E(738)=GetProcedures`。

**返回结构（服务端已证实）**

```ts
// /Users/aaa/Downloads/server/src/modules/progress/progress.service.ts:303
export async function getProgress(ds: string, orderNo?: string) {
  const { databaseName } = parseDs(ds)
  const where = { databaseName }; if (orderNo) where.orderNo = orderNo
  const orders = await prisma.order.findMany({ where, include: { client: true }, orderBy: { orderNo: 'asc' } })
  const progressData = []
  for (const order of orders) progressData.push(...buildProgressRowsForOrder(order))
  return { code: 200, data: { progressData }, message: '数据获取成功' }
}
```

⇒ 前端只认 `{ code, data: { progressData: [...] }, message }`。

末端的 `单号` 排序：前端拿回来后又自己**按单号倒序**排了一遍 —— 把单号按 `^(\d+)-(\d+)\/(\d+)\/(\d+)$`
解析成 `{序号, 年, 月}`（即 `序号-年/月/日`），依次比 `年 ↓ → 月 ↓ → 序号 ↓`；**没有单号的行排最前**
（`if(!l3&&!a3)return 0; if(!l3)return -1; if(!a3)return 1;`）。证据：`@108867`
（原文 `…[t(941)][t(553)]((e=>({...e,isSelected:!1,"生产进度":e[t(432)]||""})))[t(619)](((e,t)=>{const l=e["单号"],a=t["单号"];…`，
`t(941)`="progressData"、`t(553)`="map"、`t(619)`="sort"）。

**行字段（服务端证实）**：`progressRowFromDoorRow` / `enrichDoorRow` / `buildProgressText`
（`progress.service.ts:262 / ~150 / ~180`）：

- 关键：**`生产进度` 是 `工序1…工序15` 用 `➞` 拼起来的**：
  ```ts
  function buildProgressText(row) {
    const parts = []
    for (let i = 1; i <= 15; i++) { const v = row[`工序${i}`]; if (v != null && String(v).trim() !== '') parts.push(String(v).trim()) }
    return parts.join('➞')
  }
  ```
- 行里带的中文字段（前端直接按这些 key 取值，见 §2.3 与 Excel 导出）：
  `日期 客户 客户编号 单号 回执单号 型材 颜色 底玻 面玻 玻璃厚 开向 扇数 门洞高 门洞宽 墙厚 轨道长
   轨道种类 套线种类 套线金额 亮窗总高 亮窗数量 洞尺 封板高 吊脚 数量 单价 平方数 金额 备注 安装地址
   生产进度 打单人 业务员 打单操作 扫码日期 加价项目 加价项目原始数据 其它费用 计价方式 折扣 边封数
   五金 formulaid 图片ID imageUrl 工序1..工序15 id`
- 前端再补：`isSelected:false`、`生产进度 = 生产进度 || ""`。

### 3.2 工序列表

```
GET /1?param1=GetProcedures&param2={userinfo.registrant}
```
调用点：`@76983`、`@133918`；字面 URL 前缀也在解码表 `de(360)`（另有 `E(738)` 同值）。

服务端（`auth.service.ts:295`）返回**扁平 15 槽**：

```ts
const result = {}; for (let i = 1; i <= 15; i++) result[`工序${i}`] = ''
for (const p of procedures) if (p.orderIndex) result[`工序${p.orderIndex}`] = p.name
return result          // { 工序1: '下料', 工序2: '', … 工序15: '打包' }
```

前端消费（反混淆源，两处同构）：
```js
Object.entries(data)                      // [['工序1','下料'], …]
  .map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v.trim() : '',
                      order: Number(k.match(/(\d+)/)?.[1] ?? Number.POSITIVE_INFINITY) }))
  .filter(x => x.value)                   // 丢掉空槽
  .sort((a, b) => a.order - b.order)      // 按槽号
for (const x of list) { U.push(x.value); T[x.value] = x.key }   // U=工序名数组, T=名→槽key
if (!T['回款']) { U.push('回款'); T['回款'] = '工序10' }         // 回款兜底到工序10
```

⚠️ **`回款` 永远是前端补进去的**，且固定映射到槽 `工序10`。

### 3.3 写接口

**改进度** —— `POST /1?param1=updataProgress&param2={ds}&param3={槽key}&param4={追加段}`，
body = `JSON.stringify(数组)`：

```js
const a = userinfo.ds
const n = (W.operator === '默认' || !W.operator.trim()) ? '' : W.operator
const r = W.selectedProcedure            // 工序名（显示用）
const u = T[r]                           // 工序槽 key，如 "工序10"
let i = r; if (n) i += '_' + n; i += '_' + W.updateDate      // 追加段 = 工序名[_操作员]_YYYY-MM-DD
// body：工序10（回款）传 id，其它传 单号
s = (u === '工序10') ? rows.map(x => x.id) : rows.map(x => x['单号'])
fetch('…?param1=updataProgress&param2=' + a + '&param3=' + u + '&param4=' + i,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
```

证据：调用点 `@82456`（字面 URL）+ 反混淆源里的 `la` 函数。

服务端语义（`legacy-dispatch.ts:791`）—— **同一个 `updataProgress`，按 `param3` 分流**：

```ts
if (!isProcedureSlot(p.param3))            // 不是 /^工序\d+$/ ⇒ 是「打单操作」
  return progServ.updatePrintStatus(p.ds, p.param3, p.body, p.param4 || '')
if (p.param3 === '工序10' && p.param4)
  return progServ.updateProgress(...).then(r => progServ.updatePrintStatus(p.ds, p.param4, p.body, '', true).then(() => r))
return progServ.updateProgress(p.ds, p.param3, p.body, p.param4 || '')
```
且 `updateProgress`（`progress.service.ts`）里：`工序10` 走 `mergePrintStatus(row['工序10'], procedureValue)`（**合并**），
其它槽是**直接覆盖** `[procedureSlot]: procedureValue`。

**删进度** —— `GET /1?param1=deleteProgress&param2={ds}&param3={槽key}&param4={id或单号}&param5={encodeURIComponent(工序名)}`
（调用点见 §3.4 的「删除」；服务端 `legacy-dispatch.ts:820` → `deleteProgressCell(ds, param3, param4, param5)`）。

**收款**（`回款` 相关）：
- 读：`GET /1?param1=PaymentCollection&param2={ds}&param3={回执单号}` → `data.tableData[0]` 取
  `{客户,日期,门数,总价,定金,回执单号}`
- 写：`GET /1?param1=updataPaymentCollection&param2={ds}&param3={新定金}&param4={回执单号}`（调用点 `@80140`）

**查询更多**：
```js
GET /1?param1=getMoreProgress&param2={ds}&param3={客户}&param4={地址}&param5={startDate}&param6={endDate}
// 调用点 @118671；服务端 progress.service.ts:324 → 同样返回 {code,data:{progressData}}
```
返回后前端：按 `parseInt(回执单号)` **倒序**，按 `打单人` 过滤（非注册人时），
并入 `K2`（已有行保留原对象、新行追加），并把 `zo` 设为 `"{客户} {地址}".trim()`。
对话框打开时（`Lo`）另拉 `GET /1?param1=getClientsInfo&param2={ds}`（调用点 `@118001`）填客户下拉，
映射成 `{name:客户, tel:电话, address:地址, id:编号}`。

> ⚠️ **上一条的「已有行保留原对象」要更正**（2026-09-19 回源码逐字核对）：旧版 `Io` 是
> `K = K.map(e => w.find(t => t.id === e.id) || e)` —— **已有 id 的行换成查回来的那个新对象**
> （位置留在原处），只有**没查到的行**才保留原对象；新 id 追加到末尾。
> 这个区别在页面上看得见：换新对象会**顺带清掉那几行的勾选态**（新对象是 `isSelected:false`）。

**✅ 2026-09-19 已落**（`Progress.vue` 的 `openMore` / `submitMore` / `onSearchInput` / `onSearchClear`，
差分台 `docs/progress-more-logiccheck.mjs`）。三处**要留意的落地细节**：

1. **默认日期与快捷项按本地时区**（旧版两个默认值走 `toISOString()`⇒**UTC**，UTC+8 每天
   00:00–08:00 打开弹窗默认区间整体早一天）。理由与本仓库既有的 `localToday()` 那段一致
   （⚠️ 2026-09-20：那个函数的**声明**已从 `Home.vue` 归位到 `app/src/utils/homeDate.ts`，纯搬迁、
   逻辑逐字未改；`Home.vue` 仍 `import` 它。行号级指针按 Ruling 173 未重编）。
   快捷项文案照旧版：最近一周 / 最近一个月 / 最近三个月。
   ⚠️ 这是**前端**那一半。**服务端**那一半（`date_anchors` 的「当天/本周/本月」）曾按库会话的
   UTC 算、同样差一天，2026-09-19 已修 —— 两边现在都以北京时间为准，
   见 `docs/2026-09-19-db-timezone.md`。
2. **客户候选走 `GET /v1/clients`**，不照抄旧版那个 `getClientsInfo` —— 它返回 prisma 行（camelCase）
   而旧前端读四个中文键，全 `undefined`，紧接着 `l.name.toLowerCase()` **会直接抛** ⇒
   **那个口本来就是坏的**（§8.3 与服务端文档各自独立证过）。新映射 `{name, tel: phone, address, id: code}`。
3. **旧版那颗客户框的 `.error-input`（红框）是死代码**（`Eo` 只被写成 `false`，从没置真）⇒ 不复刻。

另两条**照抄/沿用**、别当 bug 的地方：
- 确认查询会把 `zo` 赋成「客户 地址」，而本站对搜索词有一条既有偏离（§2.2 第 4 条：
  **搜索词一变回第 1 页**）⇒ 这里同样会回到第 1 页；旧版 `Io` 不动 `ro`（会停在上次那一页）。
- **「刷新」不退出结果集**：旧版 `pa()` 只重拉 `K`，`Bo`/`xo` 原样留着 ⇒ 刷新后表里仍是上次查出来的
  那批行。照抄（要退出就走旧版那两条路：动搜索框、或点它的清除）。
- 旧版「客户」那一项外面套着 `D2`（**终端模式不显示**）；本版不做终端分支 ⇒ **恒显示**，
  与其余恒显示的 PC 专有项同一个口径。

**其它（同页复用 Home 的那套）**：`getLatestClientsInfo`(@126248)、`getimage`(@126599)、
`finance_getCustomerBalance`(@127081, 前缀 `de(446)`)、`deleteRow`(@135146, 前缀 `de(697)`)。

### 3.4 请求时序

```
onMounted  → 读 userinfo；defaulted===3 ⇒ D=false
             L2 = userinfo.name；b2 = (userinfo.registrant === userinfo.name)
             P2 = b2 || userinfo.name === '开门红'
onActivated→ Ta()（拉 getProgress / getProgressForTerminal）+ X2()（重读 localStorage 颜色表）
```
证据：`Vue.onMounted(async()=>{ … 3===t2.userinfo.defaulted&&(D2.value=!1); … L2.value=a2; b2.value=l2===a2;
P2.value=l2===a2||a2==="开门红" })`、`Vue.onActivated(()=>{Ta(),X2()})`。

---

## 4. 交互

### 4.1 筛选与搜索（全部在前端做，不重新请求）

`K2`（原始行）→ `oo` → `no`（最终结果集）→ `io`（当页切片）。链路：

1. `oo = b2 ? K2 : K2.filter(r => r.打单人 === L2)`
   —— **不是注册人就只看自己打单的行**。
2. `ia`（单号列筛选，值 ∈ `有单号` / `空单号`）
3. `Z2`（**生产进度颜色筛选**）：若选的是 `__unproduced__` → 只留 `单号` 为空的行；否则按
   `R2(row.生产进度) === Z2` 匹配颜色键。
4. `Va`（「查单号」输入的前缀）→ `单号.toLowerCase().startsWith(v)`
5. `zo`（搜索框）→ 空格分词，**每个词都要命中**下列任一字段（`includes`，全部 `toLowerCase`）：
   `客户 日期 型材 安装地址 备注 单号 业务员 打单人 生产进度 回执单号`。
6. 列筛 `filters`（`单号` 列的表头筛）另经 `fa = ({单号}) => 单号 && (ia.value = 单号)` 回灌。

### 4.2 更新进度（单行）

「日期」列 → **更新进度** 链接（`v-if="单号"`，无单号则提示「未开始生产的单无法更新进度」）：

1. `Y = row`，打开弹窗 `I=true`（标题 `更新进度`，`width:280px`，`class="update-progress-dialog"`，`close-on-click-modal=false`）
2. 拉 `GetProcedures` 填工序下拉（`U`），重置 `W = {selectedProcedure:'', operator:'默认', updateDate:今天}`
3. 表单：**选择工序**（必填）/ **操作员**（默认「默认」，可清空）/ **更新日期**（默认今天）
4. footer：`确认` / `取消`（取消后 `pa()` 刷新）；**非批量**时额外两颗：`收款`（warning）、`删除`（danger）
5. `确认` → §3.3 的 `updataProgress` → 成功提示「进度更新成功」→ 关弹窗 + `pa()` 刷新

批量模式（工具条「批量更新 (n)」）：标题 `批量更新进度 (n条)`，勾选行取自 `ping_hui + diao_hui`，
且**勾选里只要有一行缺单号就拒绝**：
`ElMessage.error("存在未生产的订单（缺少单号），不允许批量更新，请取消勾选未生产的订单")`。

**✅ 2026-09-19 已落**（`app/src/views/Progress.vue` 的 `openBatchUpdate` / `submitUpdate` /
`openUpdateDialog`，差分台 `docs/progress-select-logiccheck.mjs`）。三处**要留意的落地细节**：

1. **批量与单行是同一个弹窗**（旧版也是：同一个 `I`，只换标题、`footer` 少两颗）。
   本版同样只多一个 `updBatch` 标志 —— 标题 `批量更新进度 (n条)`。
2. **发的是行 id**，两种模式都是。旧版批量时按槽分流（`工序10` → 行 id，其余槽 → **行级单号**），
   那是它服务端的分流口径；新版 `/v1/progress/update` **两种粒度都收**（`line_ids` 或 `line_nos`，
   §10 已去掉「回款→工序10」的特判），`/Progress` 页手上就是行 id ⇒ 照旧发 `line_ids`，
   **不照抄那个按槽分流**。（`line_nos` 是给 `/Qrscanner` 用的：它手里只有扫出来的单号，
   见 `docs/2026-09-19-qrscanner-analysis.md` §8.6-(a2) 第二版。）
3. **成功提示分两种**（照旧版）：批量 `批量更新成功，共 N 条` / 单行 `进度已更新`。

### 4.3 删除进度

> ⚠️ **本节标题是个坑，先看这条更正（2026-09-19 回源码逐字核对后补）**：
> 下面那个**单行「删除」链接删的不是「进度」，是整条门行**。它调的是 **`deleteRow`**
> （POST body=`{id,数量,金额,安装地址}`），**不是** `deleteProgress`。
> 本节原先把 `.then(...)` 省略成 `...`，只看这一节会得出错误的接口结论 —— 现补齐全文。
> `deleteProgress` 只出现在**弹窗里那颗「按工序删」**上（本节第二段），两者别混。

**单行「删除」链接**（日期列，红字 `style="color:#f56c6c"`，与「更新进度」同为
`<span class="update-progress-link">`、同为 `v-if="D2"`）：
```js
onClick: async (row) => {
  await E('删除') && ElMessageBox.confirm('确定要删除这一行吗？', '提示', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
  }).then(async () => {
    const u = await o(); if (!u) return void ElMessage.error('无法获取用户数据')
    const ds = u.userinfo.ds
    if (row.id) {
      const r = await fetch('…?param1=deleteRow&param2=' + ds, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, 数量: row.数量, 金额: row.金额, 安装地址: row.安装地址 }),
      }), j = await r.json()
      if (200 !== j.code) return void ElMessage.error(j.message || '删除失败')
    }
    row.图片ID && await s(row.图片ID, String(row.id))   // 顺带删门图
    const i = K2.value.findIndex(x => x.id === row.id)
    -1 !== i && K2.value.splice(i, 1)                   // ← **局部删，不重拉整表**
    ElMessage.success('删除成功'), await ae()
  }).catch(() => ElMessage.info('已取消删除'))
}
```
- **取消**：`ElMessage.info("已取消删除")`（Element Plus 点「取消」/点遮罩/按 Esc 都走 `.catch`）。
- **`ae()`** 与 `pa()` 不是一回事：`ae` 只重算「已选 id 列表」`le.value`（**不重拉数据**），
  `pa` 才是 `Ta()` 重拉 + 清勾选。删行后只调了 `ae()`。
- ⚠️ **`E` 是 `setup` 里 `const { verifyPassword: E } = usePasswordVerify()`** —— 即**删一行要过密码校验**，
  提示语为「删除」。证据：`@63719` `setup(n){const f=ce,{verifyPassword:E}=C(),...`，`C` 来自
  `import{u as C}from"./usePasswordVerify-b6115859.js"`。

**服务端语义**（`legacy-dispatch.ts:132` 把 `deleteRow` 归一到 `deleterow`，`:754` `deleterow` = `deletehui`
分支）：POST + 有 body ⇒ `orderServ.deleteDetailRow(ds, body.id)`（`order.service.ts:661`）——
只把该 `id` 的明细行从 `doorSpecs` 摘掉，重算整单 `totalAmount`/`unpaidAmount`/`doorCount`
并回写 `financeOrder` 的 `unpaidAmount`/`statusText`。**不是删整单**（那要 POST 数组 body 走 `deleteRows`）。

**弹窗里的「删除」**（按工序删）：先 `confirm`，若选中的工序是 `回款` 且该行有回执单号，
再问一次「是否把该门款在已付款中扣除？」，确认则调 `PaymentCollection` 读定金 →
`updataPaymentCollection` 写回 `max(0, 定金 - 行金额)`；最后 `deleteProgress&…&param5=工序名`。

**✅ 2026-09-19：单行「删除」已落**（`app/src/views/Progress.vue` 的 `confirmDeleteRow()`）。
两处**有意偏离**，都写在函数注释里：
1. 走新版既有端点 `DELETE /api/v1/orders/{orderId}/lines/{lineId}`（`orders` 模块的
   `service::delete_line`，语义与旧版 `deleteDetailRow` 对齐）—— **`modules/progress/` 里没有删除
   handler**，「行」本来就属于订单模块。前端封装 `api.deleteOrderLine()`，Home/Hui 的行删除同一条。
2. **旧版那步密码校验新版刻意不做**，理由与 `Home.vue:1605-1659` 那段结论完全相同
   （跨系统发往旧版生产域名 / 只对写死的 3 个租户生效 / 新版后端无对应端点）。
   未拍板前**不补假闸门**。
弹窗里的「按工序删」仍是 ⏳ 未做（它要的 `deleteProgress` 后端也不存在）。

### 4.4 收款

弹窗（`class="payment-dialog"`）：`此门金额 / 客户 / 日期 / 门数 / 总价 / 已付(输入框) / 未付`。
`未付 = 总价 - 已付`，`>0` 时加 `.unpaid-warning`（橙）；整单已付清时 dialog 加 `.payment-dialog-paid-full`（绿底）。
保存 → `updataPaymentCollection&param2=ds&param3=新已付&param4=回执单号`。

### 4.5 打印

工具条「打印选项」→ 抽屉 `class` 里一排按钮（都受「已选条数 > 0」disabled 约束）：

`标签` · `生产标签` · `料标签` · `生产单` · `生产单定制` · `生产单定制(竖版)` · `玻璃合片单` · `玻璃订单` ·
`平开门生产单` · `移门生产单` · `平开门生产单(定制)` · `收据单`

点任意一个 → 生成 HTML 预览（`commentPreview` + 模板）→ 预览弹窗（`width:1180px`，容器宽 `1123px` 居中），
弹窗按钮：`关闭` / `云打印` / `手动打印`（loading）/ 依据当前类型出现
`编辑标签`(4=标签) / `复制收据单`+`编辑收据单`(5=收据单) / `编辑生产单`(2) + `导出扣板`(2) /
`编辑玻璃合片单`(1) / `编辑玻璃单`(3) / `复制玻璃单`+`导出玻璃订单`。
本地打印服务地址：`hl = Vue.ref("http://localhost:17521")`，`io(hl)` 建 socket，连上置 `Nl=true`。

证据：`const pl2=Vue.ref(4)`（当前打印类型，默认 **4=标签**），类型名映射 `ne2`：

```
1→玻璃合片单  2/7/8/9→生产单  3→玻璃订单  4→标签  5→收据单  10→生产标签  11→料标签
```

**✅ 2026-09-19 已落**（`PrintDrawer.vue` 的 `preset="progress"` + `Progress.vue` 的
`openPrint` / `printOrdersOf` / `onOpenPrintMode`）。**逐颗的 `ic` / 模板键**（回源码追出来的，
不是按按钮名猜的）：

| 旧版按钮 | 旧版 `ic` / 模板键 | 新版 mode | 依据（旧版 handler） |
|---|---|---|---|
| 标签 | `4` / `template.lable` | `lable` | `Ca` |
| 生产标签 | `10` / `template.product10` | `product10` | `Pa` |
| 料标签 | `11` / `template.product4` | `product4` | `La`（⚠️ 就是「切料标签」那张模板） |
| 生产单 | `2` / `template.product` | `product` | `Ba`（`calculateReceipt{ping,diao}`） |
| 生产单定制 | `8` / `template.product2` | `product2` | `xa`（`calculateReceiptOld`） |
| 生产单定制(竖版) | `9` / `template.product3` | `product3` | `ba` |
| 玻璃合片单 | `1` / `template.glass` | `glass` | `Ma`（`calculateGlass`） |
| 玻璃订单 | `3` / `template.glassHole` | `glassHole` | `ka`（`Glasslist`） |
| 平开门生产单 | `2` / `template.product` | — **置灰** | `Aa`：`{ping:true,diao:false,single:true}` |
| 移门生产单 | `2` / `template.product` | — **置灰** | `Da`：`{ping:false,diao:true,single:true}` |
| 平开门生产单(定制) | `7` / `template.product1` | `product1` | `Ia`（`calculateReceiptForCustomed`） |
| 收据单 | `5` / 回执族 | `FinalReceipt` | `So` |

**四处要留意的落地细节**：

1. **不新造打印链路**：12 颗按钮 → `PrintDrawer`（`preset="progress"`，只列入口）
   → `PrintPreviewDialog`（预览 + 该单据的操作栏）。旧版那 12 段 handler 里各自算行的那部分
   （标签行 / 生产单行 / 玻璃行…）新版**早就在 `utils/printPayloads.ts` 里**（按**模板字段族**分发），
   Home / Hui 打印走的就是它 —— 再抄一份等于同一套口径两份实现。
2. **两类置灰**（「平开门生产单」「移门生产单」）：它们与「生产单」**同一个模板**，
   差别是「只留平开/只留移门的行」+ `single:true`（一扇一页）。新版载荷层是**订单级**构造
   （`showPing`/`showDiao` 恒 true、没有 `single` 这个分页概念）⇒ 现在做出来只能与「生产单」完全一样。
   **置灰 + 悬停提示**，不假装能做（理由逐条写在 `PrintDrawer.vue` 的 `PROGRESS_ITEMS`）。
3. **⚠️ 一处有意的粒度差异**：旧版的输入是**勾选的门行**，新版共用链路吃的是**订单**。
   新版把勾选行折算成订单时**只保留被勾选的那些行**（`printOrdersOf`）⇒ 打出来的「门」与旧版一致，
   差异只在「订单头字段来自整单」（旧版同样如此：`enrichDoorRow` 的客户/单号/日期本来就取自订单头）。
4. **多一道「收据单不能跨客户」的闸**（旧版 `So` 的原话）：
   `if (new Set(客户编号).size > 1) return ElMessage.error("所选数据包含不同客户，不能构建收据单")`。
   新版回执族载荷是**每单一份**，不加这道闸会把两个客户的收据一次全打出来 —— 那是旧版明确拒绝的事。
   另：旧版 Progress 抽屉里**没有**顶部那两颗回执单按钮、也**没有**「自定义单据」分组（Home 才有），
   新版 `preset="progress"` 同样没有。

### 4.6 导出

- **导出表格**（工具条，`zo` 非空时可见）：ExcelJS 造「筛选结果」表，列 =
  `日期 客户 单号 生产进度 型材 颜色 底玻 面玻 玻璃厚 开向 扇数 门洞高 门洞宽 墙厚 轨道长 亮窗总高
   数量 平方数 金额 备注 安装地址 打单人 业务员`；
  第 1 行标题（合并、蓝底 `FFE6F4FF`）、第 2 行统计（黄底 `FFFFF7E6`，高度按字数 `max(25, 18*ceil(len/80))`）；
  表头行蓝底 `FFD9ECFF`；「生产进度」列 `wrapText`，行高按 `➞` 数量 `max(22, 18*(n+1))`。

  **✅ 2026-09-19 已落**（`app/src/views/Progress.vue` 的 `exportTable()`，差分台
  `docs/progress-toolbar-logiccheck.mjs` —— 两边喂**真 exceljs**，逐行逐格比值/行高/字体/对齐/底色/边框）。
  三条**只看这一节会漏掉**的实现细节（都是跑旧代码跑出来的，不是读出来的）：

  1. **成品里有「重复表头行」**：`ws.columns = cols` 会让 ExcelJS 自己插一行表头（row3），
     旧版随后又 `addRow(cols.map(c => c.header))` 手工加了一行带样式的表头（row4）⇒
     导出的 xlsx 里第 3、4 行是两行一样的表头（第 3 行还是没底色的）。
     **新版照抄、没清理** —— 那属于「改输出」，要改得先拍板。
  2. **导出里的统计文案与工具条上那句不是同一串**，两处不同，别合并成一个函数：
     · 「`{n}条记录`」后**直接**跟 `" | 时间:"`（工具条那句是「`{n} 条记录 | 时间:`」，中间有空格）；
     · 这里是「**移门亮窗**」，工具条上是「**移门亮窗个数**」。
  3. 文件名是 `筛选结果_{YYYY-MM-DD_HH-mm-ss}.xlsx`，时间戳由
     `toLocaleString('zh-CN', {...})` 后**逐字符替换**（`/`→`-`、`:`→`-`、空格→`_`）得来 ——
     照抄的是**替换规则**，不是手写格式化。
  4. 新版**加了 `exceljs@4.4.0` 依赖**（旧版是 CDN/全局 `ExcelJS`），并且是**动态 import**：
     只在真点「导出表格」时才下载那个 940KB 的 chunk（构建产物里是独立的 `exceljs.min-*.js`，
     `index.html` 里没有 modulepreload）。
- **看板各 tab 的「导出表格」**：每个 tab 各一份 xlsx。

### 4.7 分页 / 看板

- 分页见 §2.4。
- 「生产分析」（`P2`：`registrant === name` 或 `name === '开门红'`）→ 打开
  `ProductionDashboard`（`production-dashboard-dialog` 里的全屏 `dashboard-container`）。
- 看板里把时间切到「自定义查询」时不自己查，而是 `emit('customQuery')` →
  页面 `Lo()` 打开 §4.3 的「更多查询」对话框（`onCustomQuery: Lo`）。

---

## 5. 状态与口径

### 5.1 「生产进度」串的格式

```
工序名[_操作员]_YYYY-MM-DD  ➞  工序名[_操作员]_YYYY-MM-DD  ➞  …
```
- 段由服务端 `buildProgressText` 用 `➞` 拼 `工序1..工序15`（§3.1）。
- 追加段由前端拼：`工序名` +（操作员非「默认」时 `_操作员`）+ `_YYYY-MM-DD`（§3.3）。

### 5.2 串的渲染 `va()`（**颜色/加粗口径**）

```js
va(s):
  s 为空 → ''
  不含 '➞':
      含 '_' → 前段 + '_' + 红15px粗体(最后一段)
      否则   → 原文
  含 '➞':
      逐段拆；带日期的段落记 {part, date, index}
      无日期但含 '_' → 红15px粗体(末段)
      无日期也无 '_' → 整段红15px粗体
      然后：带日期的段落里
        日期全相同 → 取**最后一段**涂红加粗
        否则       → 取**日期最大**的那段涂红加粗
      用 '➞' 拼回去
```
即：**当前所处工序 = 红字加粗 15px**；判断依据优先看日期，没有日期就退化成「最后一段」。
红字样式内联：`color: red; font-size: 15px; font-weight: bold`。

### 5.3 颜色（`procedure_name_color_map`）—— 存 localStorage

三个常量（反混淆源）：

```js
const Vl = 'procedure_name_color_map'   // localStorage key：{工序名: 颜色}
const wl = 'procedure_name_order_list'  // localStorage key：工序名数组（优先级顺序）
const yl = '__unproduced__'             // 伪颜色键：未生产
```
证据：raw `@63398` `const Vl=ce(582),wl=ce(220),yl=ce(274),…` 且 `de(582)/de(220)/de(274)` 见解码表。

解析顺序：
1. `X2()` → 读 `procedure_name_color_map`，坏数据返回 `{}`。
2. `J2(进度串)`：
   - 先读 `procedure_name_order_list`；**非空**时**从后往前**找第一个「包含在进度串里」的名字 → 返回其颜色；找不到返回 `null`。
   - 该 List 为空时：把进度串按 `➞` 拆、取「日期最大」的那段（日期全相同取最后一段；都没有日期取最后一段），
     再用颜色表的 key **按长度倒序**找第一个被该段 `includes` 的 → 返回其颜色。
3. `R2(进度串)` = 颜色键（`F2` = 去空白 + 小写）；空串 → `#b71c1c`。
4. **内置兜底**（颜色表没命中时按关键词）：
   `发货` / `收据单` / `回款` → `#90EE90`；`标签` → `#FFC0CB`；`玻璃订单` → `#87CEEB`；
   `生产单` → `#FFFF99`；`自助下单` → `#FFA500`。

**「颜色筛选」下拉项**（表头 popover，`$2`）= `[{colorKey:'__unproduced__', color:'#f44336', label:'未生产'}]`
拼上本地颜色表里出现的颜色（`label` = 该颜色下的所有工序名用 `' / '` 连接）。
单元格底色由 `re2()` 给：无进度 → `{backgroundColor:'#b71c1c', color:'#fff', fontWeight:'bold'}`（红底白字），
命中 → `{backgroundColor:<色>, fontWeight:'bold'}`。

### 5.4 统计数字（工具条 + 看板）

工具条统计（全部作用在 `no`，即**筛选后**）：

| 变量 | 含义 | 公式 |
|---|---|---|
| `yo` | 移门扇数 | 逐行：`型材` 含「哑口」跳过；按 `扇数` 查表得 r（2轨2扇/单轨2扇/折叠2扇→2；2轨3扇/3轨3扇/折叠3扇/3轨2扇1纱→3；2轨4扇/4轨4扇/折叠4扇→4；3轨4扇2纱/折叠6扇/6轨6扇→6；单轨单扇→1；折叠5扇/5轨5扇→5；折叠7扇/7轨7扇→7；折叠8扇/8轨8扇→8；折叠9扇/9轨9扇→9；查不到→跳过）；累加 `数量 * r` |
| `vo` | 平开门扇数 | `型材` 含「钻石」跳过；`开向` 归一化后 ∈ {内左,内右,外左,外右,左锁内开,右锁内开,左锁外开,右锁外开} → `+数量`；∈ {双开内开,双开外开,双开内左,双开内右,双开外左,双开外右} → `+2*数量` |
| `mo` | 移门亮窗个数 | `亮窗总高>0 && 轨道种类` 非空且非 `"NULL"` → `+数量` |
| `go` | 淋浴房扇数 | `扇数` ∈ {一固一活, 双活} → `+2*数量`；否则 `型材` 含「钻石」→ `+数量` |
| `fo` | 其它 | 不属于以上任何一类 → `+数量`（⚠️ **不是**「且非哑口」，见下） |
| `po` | 时间区间 | `no` 里所有 `日期` 的 min/max（`toISOString().slice(0,10)`） |

⚠️ 这些是**前端逐行算的**，不是后端给的；与看板的 `ke2`（下面）口径**不完全一样**（看板另有「不含单玻」开关）。

**⚠️ 「其它」的判据：本表早先写成「（且非哑口）」，那是错的。** 逐字读旧版源码：
`型材` 含「哑口」**只参与「移门」那一条判据**（`d = 是移门扇数 && ! 哑口`），
`fo` 里并**没有**一个总的「哑口 ⇒ 不算其它」的分支。所以一行「哑口」如果不同时是亮窗 / 淋浴 /
钻石 / 开向在那 14 项里，它**会被算进「其它」**。
（2026-09-19 实现时发现并改掉；新版照源码写，差分台里专门留了一条哑口夹具钉这个行为。）

**✅ 2026-09-19 已落**（`app/src/views/Progress.vue` 的 `moveFans`/`pingFans`/`lightWindows`/
`showerFans`/`others`/`dateRange`）。差分台 `docs/progress-toolbar-logiccheck.mjs`：
59 条夹具**逐条单独**对（不是只对总数，防「一处多算一处少算、总数碰巧相等」）。
两处落地注意：

1. 旧版读的是**中文键**（`型材`/`扇数`/`开向`/`数量`/`亮窗总高`/`轨道种类`），
   我们的 DTO 是英文列名 ⇒ 依次换成 `profile`/`fans`/`direction`/`quantity`/
   `light_window_height`/`track`。**「型材」在新版叫 `profile`**，是唯一一个不同名的。
2. 开向归一化（旧版 `openDirectionNaming` 的 `g`）新版用
   `composables/useOpenDirection.ts` 的 `getOriginalOpenDirection`。
   ⚠️ 旧版是**每次现读 localStorage**，新版是模块级 ref ⇒ **`Progress.vue` 必须在
   `onMounted` 里显式调一次 `loadOpenDirectionSettings()`**（在此之前只有 `Hui.vue` 在加载），
   否则「平开门扇数 / 其它」会漏掉改过名的开向。本页**不读写任何 localStorage**，只是读那份配置。

> ⚠️ **本节已被 `docs/2026-09-19-progress-dashboard.md`（1286 行）细化** ——
> 那份逐个 KPI 给了确切公式、筛选链、边界，以及**本节需要更正/补齐的地方**（其 §0.3 有对照表）。
> 本节保留作为当时的粗挖记录，**别只拿它当依据**。

### 5.5 看板（`ProductionDashboard`）的口径

`__name:"ProductionDashboard"` @7691（`const z={class:N(743)}` @6955，`E(743)="dashboard-container"`）；
props `{modelValue:Boolean, tableData}`，
emits `['update:modelValue','customQuery']`；`data-v-720e8586`。

**数据源**：`tableData` = 页面传进来的 `K2`（**原始未筛选行**，不是 `no`），看板自己在前端聚合。

**筛选条**：时间 radio `全部 / 今天 / 本周 / 本月 / 上月 / (自定义查询 → emit)`；
`筛选客户`（可搜索）；`筛选业务员`；`生产状态`（`已进入生产` / `未进入生产`，可清空）；`重置`。
标题随筛选变：`生产分析看板 (start ~ end)`，无区间时 `生产分析看板`。

**5 张 KPI 卡**（`kpi-cards`，`grid-template-columns:repeat(5,1fr)`）：

| class | 标题 | 主值 | 副行 |
|---|---|---|---|
| `kpi-card total` | 总门数 | `totalQuantity` | `平开{q} \| 移门{q} \| 淋浴{q} \| 其它{q}` |
| `kpi-card fans` | 总扇数 | `totalFans` | `平开 \| 移门 \| 亮窗 \| 淋浴 \| 其它`；右上角开关 **不含单玻** |
| `kpi-card area` | 总平方 | `totalArea.toFixed(2)` | 各项 `.toFixed(1)` |
| `kpi-card amount` | 总金额 | `¥{totalAmount.toFixed(0)}` | 各项 `.toFixed(0)` |
| `kpi-card production` | 生产进度 | — | `已生产: {startedCount}`（绿）/ `未生产: {notStartedCount}`（红） |

**4 张饼图**：`按门数` / `按扇数` / `按平方` / `按金额`（echarts，`label.formatter="{b}: {c} ({d}%)"`）。
**趋势图**：标题 `月度趋势` 或 `每日趋势`（`（门数/扇数/平方/金额）`），受时间筛选影响。
**4 个 tab**：`按客户统计` / `按业务员统计` / `按工序统计` / `按型材统计`，每个 tab 一张表 + `导出表格` 按钮。
表列分组固定为：`数量类(总门数/平开/移门/淋浴/其它)`、`扇数类(总扇数/平开扇/移门扇/移门亮/淋浴扇/其它扇)`、
`面积类(m²)(总面积/平开/移门/淋浴/其它)`、`金额类(元)(总金额/平开/移门/淋浴/其它)`（首列依次是 客户/业务员/工序/型材）。
「按工序统计」tab 会**另外**拉一次 `GetProcedures` 取工序名。

---

## 6. 权限 / 角色

| 开关 | 来源 | 作用 |
|---|---|---|
| `D2`（旧版 Home 里叫 `Yt`） | `userinfo.defaulted === 3 ⇒ false`，否则 `true` | **PC / 终端模式**总开关：读接口、列集、工具条 |
| `b2` | `userinfo.registrant === userinfo.name` | 数据范围：`true` 看全部，`false` 只看 `打单人 === 自己` |
| `P2` | `b2 \|\| userinfo.name === '开门红'` | 「生产分析」按钮是否出现 |
| `Nl` | 本地打印 socket 连上 | 云打印可用性 |

**`D2=false`（终端模式）时**：
- 读 `getProgressForTerminal&param2={ds}_{name.split('-')[1]}`
- 隐藏 `客户` / `单号` 列、隐藏「全选」checkbox、隐藏「打印选项」与「批量更新」按钮
- 表格多出一列 `备注`（位置在「生产进度」之后），PC 模式那列 `备注` 则消失
- 表体渲染另有 `.mobile-close-radio`（关闭按钮染红，仅 `innerWidth<=768` 时出现）

**⚠️ 与「终端订单页」不是同一样东西**：菜单里的「订单管理 → `/terminal-orders`」是**另一个页面**
（`legacy/js/TerminalOrders-43b60190.js`）。`/Progress` 的终端模式是**同一组件的另一分支**。

---

## 7. 与 Home / Hui 的关系

### 7.1 结论：`Progress` 是 `Home` 的**整页复制 + 换数据源**

| | Home（订单管理，`/Home`） | Progress（生产进度，`/Progress`） |
|---|---|---|
| chunk | `legacy/js/Home-d6b13b9a.js` | `legacy/js/Progress-f4bdef35.js` |
| 组件名 | `__name:"Home"`（`Home-d6b13b9a.js` @327897） | `__name:"Progress"`（`@63440`，`de(710)="Progress"`） |
| scopeId | — | `data-v-95ebc180`（`fl(294)`） |
| 读接口 | `getTableData`（`Home-d6b13b9a.js` @341990） | `getProgress`（`Progress-f4bdef35.js` @108455） |
| 终端分支 | `getTableDataForTerminal&param2={ds}_{name.split('-')[1]}`，且置 `Yt=false` | `getProgressForTerminal&…`，且置 `D=false` |
| 复用 | 同一批 Hui chunk 抽屉组件、`printService` / `mutilPrintService`、`usePasswordVerify`、`openDirectionNaming` | 同左（见下） |

**共用的现成件**（两边 import 几乎一样）：

```js
// Progress-f4bdef35.js 头部
import{b as c,c as d,d as V,e as w,f as y,s as m}from"./Hui-d088417c.js";   // 收据/玻璃单/标签/生产单 抽屉
import{_ as g}from"./printService-48210c48.js";                            // commentPreview / 云打印
import{_ as v}from"./mutilPrintService-0d5f4920.js";
import{u as C}from"./usePasswordVerify-b6115859.js";                       // 删除时的密码校验
import{l,g as a}from"./openDirectionNaming-92dbc91d.js";                   // 开向归一化（统计用）
```
`Home-d6b13b9a.js` 也从 `Hui-d088417c.js` 引同一批（`import{u as t,_ as l,a as o,b as a,c as n,d as u,e as r,f as i,g as c,s}`）。

### 7.2 「生产进度」这个字段在两边**语义不同** —— 别类推

- **Progress 页的「生产进度」列** = **工序链**（`工序1..15` 用 `➞` 拼，服务端 `buildProgressText` 证实），
  渲染用 `va()`（红字加粗**日期最大**那段），底色来自 `procedure_name_color_map`。
- **Home 页的「生产进度」**（`docs/2026-09-17-home-analysis.md:108`）是**打单操作**那一套
  （固定项 `已打生产单`/`未打生产单`/`已订玻璃`/`未订玻璃` + localStorage 自定义项），
  新版已在 `app/src/views/Home.vue:2573 progressSegments` 实现成「5 固定段 + 自定义段」色条。
  ⚠️ 2026-09-20：`progressSegments` 的**声明**已归位到 `app/src/utils/homeConstants.ts`（纯搬迁、
  逻辑逐字未改；`manualActions` 改由调用方作为第二实参传入，仍是页面那个 ref）。上述 `Home.vue:2573`
  是**搬迁前的行号**，按 Ruling 173 由 Task 15 一次性对账，本笔**不重编**。
- 两者**写的是同一个接口** `updataProgress`，靠 `param3` 是否匹配 `/^工序\d+$/` 分流
  （匹配 → `updateProgress` 写工序槽；不匹配 → `updatePrintStatus` 写打单操作）——
  **`legacy-dispatch.ts:791` 已证实**。所以「Progress 页只会写工序」这个说法是对的，但**不能反推 Home 也走工序**。

### 7.3 新版已有的可复用件

| 现有件 | 能否直接复用 |
|---|---|
| `app/src/components/DashboardBigScreen.vue`（「经营数据驾驶舱」） | ❌ **不是**这个看板。它是 Home 的经营看板（业务员/客户排行），Progress 要的是「生产分析看板」（工序/型材统计 + 4 饼图 + 趋势）。**只能借布局与 echarts 封装，指标要重写。** |
| `app/src/views/Home.vue` 的进度串渲染 / 手动更新进度弹窗 / 打印链路 | ✅ 进度串分段与 `usePasswordVerify` 用法**可参考**；`PrintDrawer` / `PrintPreviewDialog` / `printPayloads` **已实际复用**（2026-09-19，`PrintDrawer` 的 `preset="progress"`，见 §4.5）；但**列集与筛选链路要另写** |
| `app/src/api/client.ts` | ⚠️ 没有 `getProgress` 对应端点，需新增 |
| `backend/src/modules/orders/*` | ⚠️ 没有 `getProgress` / `GetProcedures` 对应端点，需新增 |

---

## 8. 新版实现建议

> ### 8.0 落地状态（2026-09-19，逐条对着 `app/src/views/Progress.vue`）
>
> | 本节的条目 | 状态 |
> |---|---|
> | 1 路由 / 2 导航 | ✅ 已落 |
> | 3 后端端点 | ✅ 已落（`/v1/progress`、`/v1/procedures` 读+写、`/v1/progress/update`）；`delete` ⏳ 未落。<br>✅ **2026-09-19 补：`GET /v1/progress/more`（「查询更多」取数）已落**；`getClientsInfo` **不另开端点**，复用 `GET /v1/clients` —— 见 §8.3 |
> | 4 数据流（全量 + 前端筛/分页） | ✅ 已落 |
> | 5 列集 | ⚠️ **只落 PC 14 列**。终端 10 列**不做** —— 见 §10「不做终端分支」 |
> | 6 可复用 | ✅ **打印抽屉 / 看板 / 工具条 / 统计行 / 导出表格全落**（2026-09-19，打印抽屉走 `PrintDrawer` 的 `preset="progress"`，见 §4.5）；⚠️ 只有**密码校验**仍**有意不接**（§4.3 那三条理由） |
> | 7 顺带修的旧版毛病 | ✅ `v-if` 那条已按 `> 0` 落；✅ 搜索框「不重置页码」也顺手修了（见 §2.2 第 4 条） |
>
> **工具条专项（2026-09-19，对着 §2.2 / §4.6 / §5.4）**
>
> | | 状态 |
> |---|---|
> | 刷新 / 搜索框 / 统计行 / 导出表格 | ✅ 全落（差分台 `docs/progress-toolbar-logiccheck.mjs`） |
> | 打印选项 / 生产分析 | ✅ **2026-09-19 都接上真目标了**：打印抽屉（§4.5）/ 生产分析看板。不再置灰 |
> | 查询更多 | ✅ **2026-09-19 已接**：真对话框（`openMore` / `submitMore`，§3.3）+ `GET /v1/progress/more`（§8.3）。差分台 `docs/progress-more-logiccheck.mjs` |
> | 批量更新 (n) | ✅ **会真的出现了**：按旧版条件（已选 > 1）渲染，而行勾选 UI 已于 2026-09-19 补上（§2.3 第 1 行 / §4.2）。没勾选时仍然**一颗都不渲染**（不是置灰） |
> | 新依赖 | `exceljs@4.4.0`（**动态 import**） |
>
> **§5.2 的 `va()`**（✅ 已落）：`app/src/views/Progress.vue` 的 `va()`。逐字差分台
> `docs/progress-cell-logiccheck.mjs`（17 条夹具，含日期全同/日期最大/无日期三种分支）。
> ⚠️ **一处有意偏离**：新版把非红色部分做了 **HTML 转义**（旧版是裸 `innerHTML`），
> 真实数据下输出**逐字节相同**。差分台里单列了这条。
>
> **§5.3 的颜色**（✅ 已落，**来源换了**）：旧版读 localStorage `procedure_name_color_map`
> （见 §5.3 / §9.1 第 1 条），新版读 `GET /v1/procedures` 的 `slots[].color`，**本页不读写任何
> localStorage**。差分台同样覆盖（24 项）。
>
> ⚠️ **`procedure_name_order_list` 这个键新版没有**（它是 `/Qrscanner` 保存时写的，
> 见 `docs/2026-09-19-qrscanner-analysis.md` §4.3）。旧版 `J()` 的用法是「**从后往前**找第一个
> 被进度串 `includes` 的名字」，而那个 List 本身就是**按槽号升序**写的 ⇒ 新版等价物 =
> **`procedures` 按槽号从大到小扫**。差分台已证等价（除下面这一条）。
>
> ⚠️ **一处已知且有意的不等价**：旧版写 List 时**排掉了工序10**（`El` 而不是全键），新版**不排**
> （§10：新版去掉「回款→工序10」的全部特判）。后果：进度串同时含「回款」和一个**更低槽号**的
> 工序名时，两边会给出**不同**颜色。差分台把这条**断言为"应当不等价"**，防止后人当成 bug 改回去。

1. **路由**：`app/src/router/index.ts` 加 `{ path: '/progress', name: 'progress', component: Progress, meta: { requiresAuth: true } }`。
2. **导航**：`AppHeader.vue` 加菜单项「⏳ 生产进度」，可见性按 `defaulted`（新版若无 `defaulted`，
   先用「非终端账号」等价条件）。
3. **后端**（`backend/src/modules/`）新增两个端点，字段名沿用旧版中文 key 最省事（与 Home 的
   `OrderSummaryDto` 不同，别硬套）：
   - `GET /v1/progress?ds=…`（PC）/ `?ds=…&terminal=<name-prefix>`（终端）→ `{ progressData: [...] }`
   - `GET /v1/procedures` → `{ slots: [{ slot:'工序1', name:'下料', color:'#67C23A' }, … ] }`
     （**恒 15 项、按槽号排序**；`color` 空串 = 没配过。落地时的形状与本条不同 —— 当年建议的是
     `{ 工序1: '下料', … }` 那种裸对象；见 `docs/2026-09-19-qrscanner-analysis.md` §8.1）
   - `POST /v1/procedures` → `{ slots: [...] }` 整体 upsert（**颜色进库**，不落 localStorage）；
     槽名非法 400。逆向依据：`docs/2026-09-19-qrscanner-analysis.md` §4 / §8
   - `POST /v1/progress/update`（`slot` + `refs[]` + `segment`）、`POST /v1/progress/delete`
   - ✅ **2026-09-19 已落：`GET /v1/progress/more`** —— 「查询更多」的取数口，对应旧版 `getMoreProgress`。
     入参 `client_name` / `install_address` / `start_date` / `end_date`（**复用 Home「查询更多」的
     `OrderSearchQuery` 结构**，`GET /v1/orders/search` 同款）；返回 `{ progressData: [...] }`，
     **行结构与 `GET /v1/progress` 一模一样**（同一个 `build_row`）⇒ 前端一套 `ProgressRowDto` 吃两条接口。
     空筛选 = 全量。两处**有意偏离**：① 地址筛的是行里**显示的那一格** `orders.install_address`，
     不是旧版那种「拿客户档案 `client.address` 筛、却显示 `customerInfo.安装地址`」；
     ② 租户从登录态取，URL 里没有 `ds`。**合并结果集（旧版 `K2`/`xo`/`Bo`）是前端的事**，本口只取数。
   - ✅ **`getClientsInfo` 不另开端点**：旧版 = `clientServ.getClients(ds)` = 本租户**全部客户**
     （`client.service.ts:219`），正是 `GET /v1/clients?search=`（空搜索）的结果。
     前端按 `{ name: c.name, tel: c.phone, address: c.address, id: c.code }` 映射成下拉项即可
     （旧版前端读 `客户/电话/地址/编号` 四个中文键 —— 见 §3.3）。
     唯一差异：旧版按 `createdAt desc` 给，`/v1/clients` 按 `客户编号` 升序；**不改** `/v1/clients`
     的排序（它还被别的页面用着），下拉本身带本地过滤，顺序只影响观感。
     ⚠️ 顺带记一条旧版毛病：`/Users/aaa/Downloads/server` 的 `getclientsinfo` 直接 `res.json` prisma 行
     （**camelCase**），而前端读的是 `e['客户']` —— 四个键全 `undefined`，`bo` 里的
     `l.name.toLowerCase()` 会直接抛。**这个口在旧服务端上是坏的**，别拿它当"旧版能跑"的证据。
4. **数据流**：页面只拉一次全量 `progressData` → 前端筛选/分页（**与旧版一致**，旧版确实不重新请求）；
   看板吃**全量**（`K2`），不是筛选后的 `no`。
5. **列集**：按 §2.3 实现两套（PC 14 列 / 终端 10 列），**备注列位置在两种模式下不同**。
6. **可复用**：`.ping-hui-outer-container` 布局、`PrintDrawer`、`usePasswordVerify`、开向归一化
   （`openDirectionNaming`）、`printPayloads`。
7. **建议顺带修的旧版毛病**（见 §9）：表格 `v-if="K2.length > 1"`、看板标题里 `工序10` 的 `回款` 硬编码。

---

## 9. 不确定清单（⚠️ 已更新 —— 见 §9.0）

### 9.0 2026-09-19 二轮深挖后的状态

当年这份清单留了 8 条。二轮派了两路把能证的去证了，**产出两份姊妹文档**：

| 文档 | 管什么 |
|---|---|
| `docs/2026-09-19-progress-server.md` | **服务端**到底怎么算/怎么存（切旧服务端源码 + Prisma 桩真跑） |
| `docs/2026-09-19-progress-shell.md` | 外壳 / 设置页 / 看板 |

**逐条结算**（原编号沿用下面 §9.1）：

| # | 原问题 | 结论 |
|---|---|---|
| 1 | color_map / order_list 谁写的 | ✅ **解了** —— 不是设置页，是 **`/Qrscanner` 的「设置工序」弹窗**点确认时写。见 shell 文档 |
| 2 | `userinfo.defaulted` 取值全集 | ✅ **解了** —— 服务端字段是 `User.isDefaultPw`：**1=车间账号 / 2=扫码账号 / 3=终端账号 / 0 或其它=普通**。⚠️ `3` 的服务端写入点**没查到**；`0=普通` 是从「没有分支」推的 |
| 3 | `GetProcedures` 的 `param2` | ✅ **解了，且原措辞要改** —— 原写「两者恰好相等（巧合？）」。实际是**约定**：系统有**两把租户键**，业务表用 `ds`、配置表用 `registrant`，两侧列名都叫 `database_name`。**传错不报错、只静默降级**。见 server 文档 |
| 4 | 看板「不含单玻」判定 | ✅ **解了** —— 就是 `底玻 === "无"` **严格相等**。⚠️ 但**标签文案里的「单玻」是另一个定义**（`底玻==='无' && 面玻!=='无'`），**别共用一个函数** |
| 5 | `updatePrintStatus` 写入口径 | ✅ **解了** —— 写 `工序10`(merge) + `customerInfo.打单操作`(merge) + **`单号集`(覆盖)** + `打单人` + `orders.operator_name`；**不碰其余 14 槽**；会**重算覆盖「生产进度」串**；**顺带补「单号」**。见 server 文档 |
| 6 | `扫码员工`/`扫码日期` | ✅ **解了** —— 只存在 `orders.door_specs` JSON 里，**无独立表/列**；服务端唯一读点是 `getProcessCounts`；前端只有 `/Qrscanner` 用，且**只显示「扫码日期」，「扫码员工」从来没上过屏** |
| 7 | 「移动 Tab」有没有 /Progress 入口 | ❌ **原结论是错的，更正**：**两套外壳都有** —— 移动中文底部 Tab **第 5 项**（`tab-icon`，图标 ⏳，文案「进度」）。上一轮只按 `desktop-icon` 找，**漏了 `tab-icon`**。桌面菜单第 5 项「⏳ 生产进度」、悬浮球辅助菜单第 5 项，也都有 |
| 8 | `'开门红'` 硬编码 | ✅ **解了** —— 条件是 `registrant === name \|\| name === "开门红"`（比的是**账号名**），命中只多出「生产分析」一颗按钮。⚠️ 但**路由守卫会把名字正好是「开门红」的账号当场踢下线**（弹「再这样子报警，无耻的小偷」）⇒ **这条分支实际不可达**。线上 build 里守卫仍在，**不能当笔误删** |

**二轮新挖出来的（原清单里没有）**：

- **`updateProgress` 大小写敏感**：分流三个分支全部带 `isRawAction('updataProgress')` 前置 —— 发 `updateProgress`（大写 P）会**全部落空**，把「已打生产单」当槽名写进门行。
- **`getProgressForTerminal` 是写死 400**（`legacy-dispatch.ts:282` 的静态响应覆盖；第 774 行那个 handler 是够不着的死代码）⇒ **终端模式在当前服务端上必然坏**。新版要不要做终端分支，得单独拍板。
- **「回款」不是服务端常量**（`grep -rn 回款 src` 零命中）—— 服务端只认槽名「工序10」。
- **逐槽核过：只有 `工序10` 特判**（merge），其余 14 槽覆盖。实测**复现了耦合 bug**：已有「回款」再写一次 → `工序10 = "回款_回款_李四_2026-09-20"`，扫码员工被写成「回款_李四」。
- **旧版自相矛盾**：同一张 `procedures` 表两把键 —— `login` 按 `users.database_name` 查，`GetProcedures` 按 `registrant` 查。
- **Login 里一个拼写 bug**：`defaulted === 2` 跳的是 `/Qrscanne`（**缺个 r**）—— **线上也还是错的**。

### 9.1 原清单（保留原文，便于对照）



1. ⚠️ **`procedure_name_color_map` / `procedure_name_order_list` 是谁写进 localStorage 的** ——
   本 chunk 只读不写。全仓库 `grep` 未找到写入方。**推测**在设置页（`/setting`）或旧版另一个 chunk，
   **未证实**。
2. ⚠️ **`userinfo.defaulted` 的取值全集** —— 只从代码见到 `2`（受限）、`3`（终端）两个分支被特判，
   `1`/其它一律按正常 PC 账号。全集未证实。
3. ⚠️ **`GetProcedures` 的 `param2` 语义** —— 前端传的是 `userinfo.registrant`，
   服务端 `legacy-dispatch.ts:364` 把 `param2` 当 `ds`（`databaseName`）。两者在旧数据里恰好相等，
   但**这是巧合还是约定，未证实**。
4. ⚠️ **看板 `ke2`（KPI 聚合）的「不含单玻」判定细节** —— 只读到 `h2`（开关）与 `底玻 === '无'` 参与，
   完整的「单玻」定义未逐行切出来。
5. ⚠️ **服务端 `updatePrintStatus` 的写入口径** —— 本次只读了 `legacy-dispatch.ts` 的分流与
   `updateProgress` 的主体，`updatePrintStatus` 内部未展开（它在 Progress 页只在 `工序10` 兜底时被间接调用）。
6. ⚠️ **`扫码员工` / `扫码日期`** —— 服务端在 `parseScanMarker` 命中时会**额外写这两个字段**，
   但前端 Progress 页**没有渲染它们**（只用了 `扫码日期` 参与 `enrichDoorRow` 的透传）。是否给别的页用，未证实。
7. ⚠️ **「移动 Tab」** —— 任务描述里提到的那套。本次在 `index-c3b16e3f.js` 里只找到
   **桌面菜单**（`class="desktop-icon"`）那一处 `/Progress` 入口；
   移动端底部 tab（`mobile-bottom-tab`）里**没有**找到指向 `/Progress` 的项。**不足以断言"移动端没有入口"**，
   只能说「本次没切到」。
8. ⚠️ **`P2` 里的 `'开门红'`** —— 这是**公司名/注册人名字面量**（`a2 === "开门红"`），
   用于让特定账号也能看到「生产分析」。新版是否保留这个硬编码需要上游拍板。

### 旧版本身的两处毛病（**不照抄**，已定位）

- **`el-table` 的 `v-if="K2.value.length > 1"`**：结果是 1 条时**整张表不渲染**（连表头都没有），
  只剩统计行。合理写法应是 `> 0`。新版不要照抄。
- **`回款` → `工序10` 的硬编码**：前端在 `GetProcedures` 结果里没找到「回款」时，会把它塞进 `工序10`；
  而服务端 `updateProgress` 对 `工序10` 又走 `mergePrintStatus`（合并而非覆盖）。两处特判是耦合的，
  新版要么一起保留、要么一起去掉，**不能只改一边**。

---

## 附：本次新增的公共件（可复用）

| 脚本 | 用途 |
|---|---|
| `docs/progress-toolbar-logiccheck.mjs` | **工具条差分台**：统计数字（§5.4）、导出表格（§4.6）、搜索框（§4.1 第 5 步）。左边跑旧版真代码、右边跑新版真代码；导出那块两边喂**真 exceljs** 后逐行逐格比。 |
| `legacy/decode-progress-map.mjs` | 通用**解码表 dumper**：切出包内**全部** 数组/解码器/轮转 IIFE 并真的 eval 跑，dump 出「下标→字符串」。带 6 条已知值自检。 |
| `legacy/decode-progress-scoped.mjs` | **带词法作用域**的反混淆器（`@babel/parser`）。把 `X(数字)` 就地换成字符串。 |
| `legacy/lib-break-render.mjs` | 把 Vue 编译产物那种「几千字符一行的 `return a, b(...)`」按括号深度折行，便于人读。 |

用法：

```bash
node legacy/decode-progress-map.mjs legacy/js/Progress-f4bdef35.js /tmp/progress-map.json
node legacy/decode-progress-scoped.mjs legacy/js/Progress-f4bdef35.js /tmp/progress-map.json /tmp/progress.decoded.js
node legacy/lib-break-render.mjs /tmp/progress.decoded.js /tmp/progress.broken.js 3
# 同样的两个脚本也能吃 index 包（它自己那 12 套解码器会被自动枚举）：
node legacy/decode-progress-map.mjs legacy/js/index-c3b16e3f.js /tmp/index-map.json
```

⚠️ 自检只对 **Progress 包**有效（6/6 命中）。跑 index 包时会打印
「本包没有任何一条自检命中 —— 解码表**没有被钉住**」——
所以 **index 包的 12 张表尚未被已知值验证过**，本文里引用它的结论（§1 入口、§6 菜单可见性）
都是靠**语义自洽**（`r.push("/Progress")` 必须是 `push` 而不是 `removeEventListener`）交叉核对过的，
但不如 Progress 包那几张表钉得死。

### 踩过的坑（写在这里免得下次再踩）

1. **`l[t-=453]` 是相对偏移** —— `f(453+k)` 才等于 `arr[k]`；直接 `f(k)` 一个都取不到。
2. **数组函数不一定在解码器前面**：主表里解码器 @758、数组 @1284；`dl` 的轮转又夹在两者之间。
3. **轮转 IIFE 的开头形状每套都不一样**（`for(;;)try{` / `for(var e=se,t=ue();;)try{`），
   写死一种会让另外几套被判成「无轮转」，解码表**整体错位**却不报错。
   本次就因此把 `se(413)` 解成了校验和串 `75758DDkOwr`（应为 `__scopeId`）——**靠自检才发现**。
4. **`!function(){...}()` 里 `function` 后面那个 `()` 是空参数表**，配平要配后面那个 `{`。
5. **别名必须按作用域解析**：组件里 `const r=N,u=e,s=n` 中的 `u`/`s` 是 **props / emit**，不是解码器；
   全局做「名字→解码器」的传递闭包会把它们错替（首版就这么错的）。

---

## 10. 数据模型决定（2026-09-19 拍板并落地）

§8 第 3 条只说了「字段名沿用旧版中文 key 最省事」，**没点破一个前提**：
我们新后端**根本没有存工序的地方**。`order_lines` 只有：

```
parts   JSONB   ← 算料结果
markup  JSONB   ← 加价项目
progress TEXT   ← 一个「生产进度标识」字符串
```

所以 `/Progress` **不是「加个页面」就能做的**，得先补数据模型。已按下面落地（迁移 `0021_progress.sql`）：

| 加什么 | 放哪 | 说明 |
|---|---|---|
| `order_lines.procedure_slots JSONB DEFAULT '{}'` | 行级 | `{"工序1":"下料_张三_2026-09-19", …}`。**按行存**（= 旧版门行），与 `parts`/`markup` 同风格 |
| `procedures` 表（`tenant_id` + `slot` + `name` + `color`） | 租户级 | 15 个扁平槽，即旧版 `GetProcedures` 的 `{工序1:"下料",…}`。`color` 是迁移 `0022_procedure_color.sql` 加的（空串 = 没配过）—— 旧版颜色根本不进服务端，存在浏览器 localStorage 的 `procedure_name_color_map` 里，见 `docs/2026-09-19-qrscanner-analysis.md` §4.6 / §8.3 第 2 条 |

### 两处**有意偏离**旧版（一起做，不拆分）

1. **去掉「回款 → 工序10」的前端硬编码**，也**去掉服务端对 `工序10` 的 merge 特判**。
   两处是耦合的（见 §9.0），实测能写出 `工序10="回款_回款_李四_2026-09-20"` 的脏数据。
   新版：**槽就是槽**，没有哪个特殊；「回款」由租户当普通工序名自己配。
2. **不做终端分支**。旧版 `getProgressForTerminal` 在服务端是**写死 400**
   （`legacy-dispatch.ts:282` 的静态响应覆盖，handler 是够不着的死代码）——
   **那条路本来就是坏的**，照抄没有意义。

### ⚠️ 从旧库导入时要留意

旧版有**两把租户键**：业务表按 `ds`、配置表（含 `procedures`）按 `registrant`，列名都叫
`database_name`。新版只有一把 `tenant_id` —— **导入工序清单时得按旧库的 `registrant` 捞，不是 `ds`**。

### 终端/角色

`userinfo.defaulted`（服务端字段 `User.isDefaultPw`）我们**不复刻**：新版用 `users.role` 表达同一件事。
映射**已定**（2026-09-19 做权限那一步时定的，不再悬空）：

| 旧版 `defaulted` | 新版 |
|---|---|
| 1 = 车间（默认密码）账号 | `role='admin'`（租户主账号，能管扫码账号、能设置工序） |
| 2 = 扫码账号 | `role='scanner'`（只能扫码生产那几条端点） |
| 3 = 终端账号 | **不做**（终端分支本条已决定不做，见上文 §10） |
| 0 / 其它 = 普通 PC 账号 | `role` 的其它取值 = 只放开自助端点，业务端点全拦 |

服务端白名单见 `docs/2026-08-21-auth-design.md` 的「角色授权层」一节。见 shell 文档 §3。

---

## 11. `progressData` 的行结构（读透了，实现依据）

§3 只说「返回 `progressData:[…]`」，没说**每行长什么样**。这条链在旧服务端是三层，
2026-09-19 读完了（`src/modules/progress/progress.service.ts`）：

```
getProgress
  └─ buildProgressRowsForOrder(order)            :283
       ├─ doorRowsFromSpecs(specs)               =  specs.ping_hui ++ specs.diao_hui
       │                                            （= 我们的 order_lines 按 line_type 分）
       ├─ mergeProgressFields(行, 缓存里的同名行)   ← 进度字段有缓存时合并
       └─ progressRowFromDoorRow(行, order, specs)
            ├─ enrichDoorRow(行, order, specs)   ← 补客户/单号/日期等订单级字段
            └─ 再补 procedureName / procedureStatus / 业务员 / 打单人 / 打单操作 / 生产进度 / 单号
```

### 一行的字段（`enrichDoorRow` + `progressRowFromDoorRow` 合起来）

| 字段 | 来源 |
|---|---|
| `id` / `formulaid` / `imageUrl` | 行自身（`id` 是 `rowRef(row)`，`formulaid`/`imageUrl` 默认 null） |
| `...row` | **行自身的全部字段**（我们的 `OrderLineDto`） |
| `工序1` … `工序15` | 行自身；**缺的补 `null`**（`for i in 1..=15`，15 个键**一定都在**） |
| `生产进度` | **`buildProgressText(row)`** = 15 槽里非空的按序用 `➞` 拼；空则回落行自带的 `生产进度` |
| `procedureName` | `row.procedureName \|\| row.工序 \|\| ''` |
| `procedureStatus` | `row.procedureStatus ?? row.生产进度 ?? null` |
| `业务员` | 行 → `customerInfo.业务员` → `''` |
| `打单人` | 行 → `customerInfo.打单人` → `null` |
| `打单操作` | 行 → `customerInfo.打单操作` → `''` |
| `回执单号` | 行 → `customerInfo.回执单号` → **`order.orderNo`** → `''` |
| `备注` | 行 → `customerInfo.订单备注` → `''` |
| `安装地址` | 行 → `customerInfo.安装地址` → `customerInfo.地址` → `client.address` → `''` |
| `客户` | 行 → `customerInfo.客户` → `order.customerName` → `''` |
| `客户编号` | 行 → `customerInfo.客户编号` → `client.clientCode` → **`0`**（数字 0，不是 `''`） |
| `封板高` | 行 → **`0`** |
| `日期` | 行 → `customerInfo.日期` → `order.orderDate`（都是 `dateText()` 格式化后的串） |
| `洞尺` | 行 → `''` |
| `扫码日期` | 行 → **`null`**（⚠️ `扫码员工` **不在这一行里** —— 全仓库只有 `/Qrscanner` 读它，见 server 文档） |
| `加价项目原始数据` | 行 → **字符串 `'null'`**（是四个字母的串，不是 null！） |
| `单号` | `progressRowFromDoorRow` 再补一次：行 → `enriched.单号` → `''`（**行级单号**，不是回执单号） |
| `orderNo` | `order.orderNo` |
| `order` | **整个订单对象**（含 `client`）—— 前端可能整块拿去用，别当冗余丢掉 |

### 值得注意的三处

1. **15 个 `工序N` 键一定都在**（缺的显式补 `null`），不是「只给有值的」。
   前端拿到的行**形状是齐的** —— 新版 DTO 也要保持这一点，否则前端读 `row.工序5` 会 undefined。
2. **`客户编号` 的兜底是数字 `0`**、`封板高` 是数字 `0`、`加价项目原始数据` 是**字符串 `'null'`** ——
   三个都不是 `''`。照抄，别「统一成空串」。
3. **`order` 整个对象挂进行里** —— 前端有些地方直接读 `row.order.xxx`。

### 新版怎么落（待实现）

按上表逐字段映射，其中：

- `工序N` ← `order_lines.procedure_slots`（迁移 0021）
- `回执单号` ← `orders.receipt_no`（我们没有 `customerInfo` 那层，直接用订单头）
- `客户`/`客户编号`/`日期`/`业务员` ← 订单头 / `clients` 表
- `扫码日期` → `GET /v1/progress` 给 `null`（旧版也只在 `/Qrscanner` 用）。
  ⚠️ **2026-09-19**：`/Qrscanner` 那两条**窄**接口（`GET /v1/scan/qrcode`、`GET /v1/scan/stats`）
  用的是**同一个 `build_row`**，但**会把这一格填上**——从 `procedure_slots` 用旧版
  `parseScanMarker` 的正则**读时现推**（`progress/service.rs::derive_scan_marker`）。
  26 列的「订单详情」里有一列就是它，所以扫码那两条必须填；全量那条不填（保持旧行为）。
  见 `docs/2026-09-19-qrscanner-analysis.md` §8.6-(b) 的「第二版」。
- `单号` ← `order_lines.line_no`（**行级**，见 `docs/2026-09-18-order-no-semantics.md`）
- `procedureName` / `procedureStatus` / `打单人` / `打单操作` / `加价项目原始数据` / `封板高` / `洞尺`
  → 我们是新模型，**没有对应字段**；先按旧版的兜底值给（`''` / `null` / `'null'` / `0`），
  文档记明「这些字段旧版有、新版暂无来源」。
