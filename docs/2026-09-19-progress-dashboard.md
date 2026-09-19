# 生产分析看板（`ProductionDashboard`）口径挖细

> 对象：`Progress`（`/Progress` 生产进度页）内嵌的 **生产分析看板** 组件。
> 源文件 `legacy/js/Progress-f4bdef35.js`（单行混淆）。
> **本文所有 `@NNNN` 偏移都指「反混淆产物」`/tmp/progress.decoded.js` 的字符偏移**
> （与 `docs/2026-09-19-progress-analysis.md` §5.5、`-shell.md` §4 同一套坐标）。
> 复现命令见 §14。
>
> **本文不是复述 §5.5，是把 §5.5 的每一条拆成可直接写代码的规格，并逐条真跑验证。**
> 结论前置，公式放最显眼处；没证成的一律标 `⚠️ 未证实`。

---

## 0. 结论速查

### 0.1 一句话口径

| 指标 | 一句话公式（全部作用在 `pe` = 看板自己筛完的行集上） |
|---|---|
| 总门数 | `Σ 数量`（所有行，**不分类**） |
| 门数 4 桶 | 逐行**互斥**分类成 平开门/移门/淋浴房/其它，各自 `Σ 数量` |
| 总扇数 | `平开扇 + 移门扇 + 移门亮窗 + 淋浴扇 + 其它扇`（**5 个桶相加**，不是「每行算一次」） |
| 扇数 5 桶 | 逐行算，**同一行可同时进多个桶**（见 §5） |
| 总平方 | `Σ 平方数` |
| 总金额 | `Σ 金额` |
| 生产进度 | `已生产 = pe 里 单号 为真的行数`；`未生产 = pe.length − 已生产` |

### 0.2 关键事实（先看这 8 条）

1. **看板不吃页面上的任何筛选**。它的 `tableData` 是页面那个**原始全量** ref（本 build 叫 `K`，§5.5 里叫 `K2`）。
   ✅ **复核成立**，而且**还多一层**：连「只看自己打单」的**数据范围**都不吃（§2.2）。
2. 看板有**自己**的一套筛选条（时间 / 客户 / 业务员 / 生产状态 / 重置），作用在 `pe`。
3. **`不含单玻` 判定 = `底玻 === "无"`（严格相等）**。✅ 复核成立。开关打开时该行 **5 类扇数全归零，但门数/平方/金额一行不变**。
4. ⚠️ **文案里的「单玻」是另一个定义**（`底玻==='无' && 面玻!=='无'`）。✅ 复核成立，两个**不要共用一个函数**（§5.3）。
5. **「本周」从周日算起**（dayjs 默认 en locale，`weekStart=0`）。**不是周一**。
6. **「今天 / 本周 / 本月」的右端都是「今天」**，不是周末/月末。**未来日期的行会被排除**（§3.1）。
7. 4 个 tab 是**按总金额降序**排的（`Ae`），**没有 TopN 截断**。
8. 趋势图 **超过 30 个不同日期就自动按月聚合**，标题从「每日趋势」变成「月度趋势」。

### 0.3 与现有文档的差异（`§5.5` 需要更正的地方）

| §5.5 原文 | 本文结论 |
|---|---|
| 「筛选条：时间 radio `全部 / 今天 / 本周 / 本月 / 上月 / (自定义查询 → emit)`」 | ✅ 对，但**页面里有两组时间 radio**（筛选条一组 + 趋势图上方一组），**共用同一个 `w` ref**，后者没有「自定义查询」（§1.3） |
| 「趋势图：标题 月度趋势 或 每日趋势」 | ✅ 对，触发条件补齐：**`pe` 里不同日期数 > 30** 才转月（§9.1） |
| 「4 个 tab …表列分组固定为 `数量类(总门数/平开/移门/淋浴/其它)`…」 | ✅ 对。补齐：**首列 width 180 + `sortable`，另有 4 列 `sortable`（总门数/总扇数/总面积/总金额）**，表格 `height=400`，四个 tab 列集**逐字相同**（§10） |
| 「『按工序统计』tab 会另外拉一次 `GetProcedures`」 | ✅ 对，补齐：**硬编码域名 + `param2={userinfo.registrant}`**，拉到的 `Ie`（loading 标志）**是死变量**（§10.2） |
| （未提） | **导出 xlsx 的表头/文件名也吃「不含单玻」**，且 `Ae` 的排序、面积 `toFixed(2)`、金额 `toFixed(0)` 都写死在导出里（§11） |

---

## 1. 看板在哪触发 · 外壳 · 尺寸

### 1.1 入口：工具条上那颗「生产分析」按钮

`Progress-f4bdef35.js @141816`：

```js
Vue.createVNode(r,{type:"primary",onClick:a[1]||(a[1]=e=>B["value"]=!0)},
  {default:Vue.withCtx((()=>a[36]||(a[36]=[Vue.createTextVNode("生产分析")]))),_:1})
```

- 只在 `P["value"]` 为真时渲染（`? :` 三元 + 注释节点占位）。`@118848`：
  ```js
  const l = t["userinfo"]["registrant"], a = t["userinfo"]["name"];
  L["value"] = a, b["value"] = l === a, P["value"] = l === a || a === "开门红"
  ```
- **顺序**：`打印选项` → `批量更新 (n)` → `查询更多` → **`生产分析`** → `刷新` → `导出表格`…
- 点击 → `B.value = true` → 打开看板。
- 按钮**不是常驻**：不满足 `P` 就连按钮都没有。
  ⚠️ 关于 `"开门红"` 账号被路由守卫踢下线导致该分支不可达，见 `-shell.md` §6.3（**本轮未复核**，属引用）。

挂载点 `@175142`：

```js
Vue.createVNode(ie,{ref_key:"dashboardRef",ref:N,modelValue:B.value,
  "onUpdate:modelValue":…,tableData:K.value,onCustomQuery:Lo},null,8,["modelValue","tableData"])
```

`ie` = `ProductionDashboard` 组件。

### 1.2 外壳：**全屏对话框（不是抽屉）**

`@24660`：

```js
Vue.createBlock(se,{
  modelValue: i["value"], "onUpdate:modelValue": …,
  title: Ce["value"],                          // 动态标题，见 §3.6
  fullscreen: "", "destroy-on-close": "", "close-on-click-modal": !1,
  class: "production-dashboard-dialog"
})
```

`se` = `resolveComponent("el-dialog")`（`@24058`）。

| 属性 | 值 | 影响 |
|---|---|---|
| `fullscreen` | 有 | **全屏**，不是抽屉、不是可调尺寸 |
| `destroy-on-close` | 有 | 关闭时销毁内容 → 再次打开**重新 init echarts**、筛选状态**全部重置回默认**（`w="all"`, `m=""`, `g=""`, `v=null`, `h=false`, `p="customer"`） |
| `close-on-click-modal` | `false` | 点遮罩不关 |
| `title` | `Ce.value` | 见 §3.6 |

`el-dialog__body` 在 `<=480px` 时 `overflow:hidden;padding:0`（CSS 见 §1.4）。

### 1.3 移动端

- `c = Vue.ref(window["innerWidth"] <= 768)`（`@8103`）。
- 两组时间 radio 在 `c.value` 为真时**各多出一颗红色「关闭」radio**（`.mobile-close-radio`），点击 `d()` → `i.value = false` 直接关对话框。
- `V = () => { c.value = window.innerWidth <= 768 }`，挂在 `window.addEventListener("resize", V)`（`@19618`）。

> ⚠️ **旧版两个时间 radio 组共用同一个 `w` ref**（筛选条的 `@25138` 一组 + 趋势图上方的 `@31731` 一组，两者的 `modelValue` setter 一个写 `t[0]` 一个写 `t[5]`，但都写 `w.value`）。所以：
> - 在任意一组切时间，两组一起变；
> - 上面切到「自定义查询」后，**趋势那组会一个都不选中**（它没有该选项）。

### 1.4 布局与尺寸（`legacy/css/Progress-4dee25cf.css`，scope `data-v-720e8586`）

```
.dashboard-container       overflow-y:auto; overflow-x:hidden; padding:0 10px   （<=768: padding:10px）
.filter-bar                white / padding:15px / radius:8 / flex gap:15 / margin-bottom:20   （<=768: flex-wrap:wrap）
.kpi-cards                 display:grid; grid-template-columns:repeat(5,1fr); gap:20; margin-bottom:20
                           （<=768: repeat(2,1fr) gap:10    <=480: 1fr）
.kpi-card                  white / padding:20 / radius:8 / shadow 0 2px 12px #0000000d / flex column center
.kpi-card .label           #909399 / 14px / margin-bottom:10
.kpi-card .value           28px / 700 / #303133       （<=768: 20px）
  .kpi-card.total  .value  #409eff
  .kpi-card.fans   .value  #9a66e4
  .kpi-card.area   .value  #67c23a
  .kpi-card.amount .value  #e6a23c
.kpi-card.fans             position:relative                     ← 「不含单玻」开关的定位锚
.fans-filter-toggle        position:absolute; top:10px; right:10px
.kpi-card .detail-row      13px / #909399 / margin-top:8 / white-space:nowrap   （<=768: normal+居中）
.kpi-card.production .sub-values   flex column; gap:5px; font-size:16px
.started                   #67c23a
.not-started               #f56c6c
.charts-row                grid; repeat(4,1fr); gap:20; margin-bottom:20   （<=768: 2 列  <=480: 1 列）
.chart-wrapper             white / padding:20 / radius:8 / shadow
.chart-title               16px / 700 / margin-bottom:15 / text-align:center   （<=768: 14px）
.chart                     height:430px   （<=768: 280px   <=480: 250px）
.trend-chart-section       margin-bottom:20
.trend-time-filter         margin-bottom:10
.trend-chart               height:350px   （<=768: 250px）
.tabs-section              white / padding:20 / radius:8 / shadow   （<=768: padding:10px）
.tabs-section .el-table    font-size:12px；th,td padding:6px 4px      ← 仅 <=768 生效
```

DOM 结构（类名常量 `@6938`–`@7958`）：

```
.dashboard-container
├── .filter-bar                      ← 时间 radio / 客户 select / 业务员 select / 生产状态 select / 重置
├── .kpi-cards                       ← 5 张 .kpi-card
│   ├── .kpi-card.total       .label/.value/.detail-row
│   ├── .kpi-card.fans        .fans-filter-toggle/.label/.value/.detail-row
│   ├── .kpi-card.area        .label/.value/.detail-row
│   ├── .kpi-card.amount      .label/.value/.detail-row
│   └── .kpi-card.production  .label/.sub-values(.started/.not-started)
├── .charts-row                      ← 4 个 .chart-wrapper（按门数/按扇数/按平方/按金额）
├── .trend-chart-section
│   └── .chart-wrapper[style=width:100%]
│       ├── .trend-time-filter       ← 第二组时间 radio（共用 w）
│       ├── .chart-title             ← 「每日趋势（门数/扇数/平方/金额）」
│       └── .trend-chart             ← echarts
└── .tabs-section                    ← el-tabs
    └── 4 个 el-tab-pane（按客户/按业务员/按工序/按型材）
        └── div(style margin-bottom:10px)[导出表格 按钮] + el-table[height=400]
```

**4 个饼图的 ref**：`countPieRef`(`C`) / `fansPieRef`(`E`) / `areaPieRef`(`B`) / `amountPieRef`(`ne`)；
**趋势 ref**：`trendChartRef`(`ce`)。echarts 是**全局**（`legacy/index.html` 里
`<script src="/vendor/js/echarts.min.js">`），不是 import。

---

## 2. 数据流：看板到底吃哪份数据

### 2.1 结论

```
K（页面 setup 里的 ref，@72562）
 ├─ 赋值：getProgress / getProgressForTerminal 返回的 data.progressData.map(e => ({...e, isSelected:false, 生产进度: e.生产进度||""}))
 │        （@117837 终端分支；PC 分支同构）
 ├─ oo  = b.value ? K.value : K.value.filter(打单人 === L.value)     ← 「数据范围」
 ├─ no  = （xo 查询结果 或 oo）→ 列头筛选 → 进度筛选 → 单号前缀 → 搜索框   ← 表格真正渲染的是 no 的分页切片 io
 └─ tableData: K.value                                              ← 看板拿的是这个 ★
```

**看板 = `K`（原始全量），既不是 `no`（页面筛选后），也不是 `oo`（数据范围后）。**

### 2.2 复核：比 §5.5 多一条

§5.5 写「看板吃**全量** `K2`，不是筛选后的 `no`」——**成立**。
本轮**多查出一条**：看板**同时也绕过了 `b`（`registrant === name` → 看全部 / 否则只看自己打单）**。
`tableData` prop 直连 `K.value`，而 `oo`（唯一吃 `b` 的地方）只喂表格。

⇒ **一个业务员账号打开看板，看到的是全公司的数据。** 这是旧版的实际行为，实现时要不要照抄需上游拍板（§15）。

### 2.3 `K` 会被「查询更多」改写

`@129136`（`Lo` 成功回调）：

```js
const V = new Set(K["value"]["map"](e => e["id"]))
const w = d["filter"](t => V["has"](t["id"]))          // 查询结果里已在 K 中的
const y = d.filter(t => !V["has"](t["id"]))            // 新增的
K["value"] = K.value["map"](e => w.find(t => t.id === e.id) || e)   // 就地替换
K["value"] = [...K["value"], ...y]                                   // 追加
```

所以「查询更多」之后，看板的 `tableData` = **原全量 ∪ 查询结果**，并且 `watch(tableData, {deep:true})`（`@19312`）会触发 `Te()` 重画。

---

## 3. 筛选链（看板自己的 4 个筛选器）

### 3.1 时间：`fe`（`@9134`）

```js
fe = Vue.computed(() => {
  const t = u["tableData"]
  if (!t || 0 === t.length) return []
  const l = f().format("YYYY-MM-DD")                    // 今天
  const a = f().startOf("week").format("YYYY-MM-DD")    // ★ 本周起点（周日，见下）
  const o = f().startOf("month").format("YYYY-MM-DD")
  const n = f().subtract(1,"month").startOf("month").format("YYYY-MM-DD")
  const s = f().subtract(1,"month").endOf("month").format("YYYY-MM-DD")
  let i = "", c = l
  switch (w["value"]) {
    case "today":     i = l; break
    case "week":      i = a; break
    case "month":     i = o; break
    case "lastMonth": i = n, c = s; break
    case "custom":    if (!y.value) return t; i = y.value[0], c = y["value"][1]; break
    default:          return t                                // "all" → 原样返回，不筛
  }
  return t.filter(e => { const t = e["日期"]; return !!t && (t >= i && t <= c) })
})
```

| `w` | 标签 | 区间 | 空日期的行 |
|---|---|---|---|
| `"all"`（默认） | 全部 | **不筛** | ✅ **保留** |
| `"today"` | 今天 | `[今天, 今天]` | ❌ 丢 |
| `"week"` | 本周 | `[本周日, 今天]` ★ | ❌ 丢 |
| `"month"` | 本月 | `[本月1日, 今天]` ★ | ❌ 丢 |
| `"lastMonth"` | 上月 | `[上月1日, 上月最后一天]` | ❌ 丢 |
| `"custom"` | 自定义查询 | `y.value = [start, end]` | ❌ 丢（除非 start 为空串） |

★ **右端是「今天」而不是「本周末 / 本月末」** —— 所以**未来日期的行在 今天/本周/本月 三种模式下都被排除**。
（实跑：今天 = 2026-09-19（周六），夹具里 `2026-09-20` 在 `week`/`month`/`today` 下都被剔除。）

**比较方式**：`t >= i && t <= c` 是**字符串比较**（`日期` 字段是 `YYYY-MM-DD` 字符串，见 §3.6）。
若服务端给的是别的格式（如 `2026/9/19`），字符串序会与日期序不一致 —— ⚠️ **未证实**线上是否存在这种数据。

#### 「本周」到底从周几算起？—— **周日**

`f` = `import{c as f} from"./vue-ade658be.js"`，该导出是 **dayjs 默认构建**：

```js
// vue-ade658be.js @3337283
const _0x4c1c6a = getDefaultExportFromCjs(dayjs_minExports);   // = dayjs
// vue-ade658be.js @3333600（startOf('week') 的实现）
case c: var b = this.$locale().weekStart || 0, y = (p < b ? p + 7 : p) - b; ...
```

- `$locale().weekStart || 0` → 无 locale 覆盖时 **0 = 周日**。
- 全仓库 grep：`vue-ade658be.js` 里 `zh-cn` 出现 **0 次**，`weekStart` 出现 **1 次**（就是上面那句）。⇒ **没有任何地方注册中文 locale**。
- **实跑证实**：夹具 `2026-09-13`（周日）在 `week` 下**保留**，`2026-09-12`（周六）被剔除。

> ⚠️ 这条与 `app/src/components/DashboardBigScreen.vue:189` 的「本周 = 周一」**相反**。
> 新版实现时**不要沿用我们的经营看板那套**。

### 3.2 客户：`m`

```js
m["value"] && (t = t["filter"](t => t["客户"] === m["value"]))
```

严格 `===`，**不 trim、不 toLowerCase、不支持多选**。
候选列表 `Ve`（`@8555`）来自 **`u.tableData`（全量 Raw）**，`Set` 去重 + 默认 `sort()`：

```js
Ve = Vue.computed(() => { const t = new Set
  u["tableData"]["forEach"](e => { e["客户"] && t.add(e["客户"]) })
  return Array.from(t)["sort"]() })
```

**实跑**：夹具 `['甲公司',' 甲公司','甲公司 ','乙公司']` → 候选 = `[" 甲公司","乙公司","甲公司","甲公司 "]`（默认字符串序，空格排最前）。选「甲公司」只命中 1 行。

### 3.3 业务员：`g`

```js
g["value"] && (t = t.filter(t => t["业务员"] === g["value"]))
```

同样严格 `===`。候选 `we`（`@8689`）多一层 trim 判空：

```js
we = Vue.computed(() => { const t = new Set
  u["tableData"]["forEach"](l => { l["业务员"] && l["业务员"]["trim"]() && t["add"](l["业务员"]) })
  return Array.from(t)["sort"]() })
```

⚠️ 判空用 `trim()`，**但加进 Set 的是原值**。所以 `" 张三"` 会成为一个候选（值就是带空格的 `" 张三"`），而 `"   "`（纯空格）不会。

### 3.4 生产状态：`v`

```js
typeof v["value"] === "boolean" && (t = t.filter(e => {
  const t = null !== e["单号"] && "" !== e["单号"]    // ← 判定「已进入生产」
  return v.value ? t : !t
}))
```

下拉两项（`@26833`）：`{label:"已进入生产", value:!0}` / `{label:"未进入生产", value:!1}`，`clearable`。

- 初始 `v = Vue.ref(null)` → **`typeof null !== "boolean"` → 不筛**。
- 清空（点小叉）→ `v.value` 变成 `""` 或 `undefined` → **不筛**。

### 3.5 重置 & 自定义查询回环

```js
ve = () => { w["value"]="all", m["value"]="", g.value="", v.value=null, ge() }   // 「重置」
ge = () => Vue.nextTick(() => Te())
ye = () => { w["value"]!=="custom" ? (y["value"]=null, Vue.nextTick(()=>Te())) : s("customQuery") }
me = () => { w["value"]==="custom" && s("customQuery") }
```

- `重置` 按钮：`type:"info"`, `size:"small"`，**只重置 4 项，不重置 `不含单玻`（`h`）**。
- 点「自定义查询」radio → `ye`（onChange）发现 `w==="custom"` → `emit("customQuery")`；`me`（onClick）再补一次。

回环（`Progress` 侧 `Lo`，`@127474`）：

```
emit('customQuery')  → Progress 打开「查询更多」对话框 Do
   用户选 客户/地址/日期区间 → 查询 → fetch getMoreProgress&param2=..&param3={客户}&param4={地址}&param5={start}&param6={end}
   → 成功：结果并回 K（§2.3）→ 若 B.value && N.value（看板开着）：
        N.value.setCustomDateRange([ toYMD(Do.startDate), toYMD(Do.endDate) ])
```

看板暴露的方法（`@23900`）：

```js
return t({ setCustomDateRange: e => { y["value"] = e, w.value = "custom", Vue.nextTick(() => Te()) } }), (e,t)=>{…}
```

`toYMD` 用**本地时间** `getFullYear/getMonth+1/getDate` 拼 `YYYY-MM-DD`，`Date` 原样传则直接返回。

### 3.6 标题：`Ce`（`@10245`）

```js
he = Vue.computed(() => {                    // 区间（作用在 pe 上！）
  const t = pe["value"]
  if (0 === t["length"]) return { start:"", end:"" }
  const l = t["map"](e => e["日期"])["filter"](e => e)["sort"]()
  return { start: l[0] || "", end: l[l.length-1] || "" }
})
Ce = Vue.computed(() => {
  const { start:t, end:l } = he.value
  return t && l ? (t === l ? "生产分析看板 (" + t + ")" : "生产分析看板 (" + t + " ~ " + l + ")")
                : "生产分析看板"
})
```

- **区间算在 `pe` 上**（看板自己筛完之后），所以切时间/客户都会改标题。
- `sort()` 是**默认字符串排序**；`filter(e=>e)` 只剔 falsy，**纯空格 `" "` 会被当成有效日期**。
  实跑夹具 `['2026-08-15','2026-09-01','2026-09-19','2026-09-20','',' ']`（`all` 模式）→ 标题
  `生产分析看板 (  ~ 2026-09-20)`（`start` 是那个空格）。⚠️ 属旧版瑕疵。
- `start===end` 时只显示一个日期。

---

## 4. 逐行基元 A：门数分类（4 桶，**互斥**）

`Me` 内联的分类器（`@11893` 起，源码在 `Me` 的 `forEach` 里）：

```js
const s = (e => {
  const l = e["型材"] && e["型材"]["includes"]("哑口")            // isYakou
  if (["2轨2扇","2轨3扇","2轨4扇","3轨2扇1纱","3轨4扇2纱","3轨3扇","4轨4扇","5轨5扇",
       "6轨6扇","7轨7扇","8轨8扇","9轨9扇","单轨单扇","单轨2扇","折叠2扇","折叠3扇",
       "折叠4扇","折叠5扇","折叠6扇","折叠7扇","折叠8扇","折叠9扇"]["includes"](e["扇数"])
      && !l) return "移门"
  const a = e["扇数"] === "一固一活" || "双活" === e["扇数"]
  const o = e["型材"] && e["型材"]["includes"]("钻石")
  return (a || o) ? "淋浴房" : (!o && ze(e["开向"])) ? "平开门" : "其它"
})(e)
```

**优先级（从上到下，先中先赢）**：

| # | 条件 | 归类 |
|---|---|---|
| 1 | `扇数` ∈ 22 项清单 **且** `型材` 不含「哑口」 | **移门** |
| 2 | `扇数` ∈ {`一固一活`, `双活`} **或** `型材` 含「钻石」 | **淋浴房** |
| 3 | `型材` 不含「钻石」**且** `ze(开向)`（开向 ∈ 14 项平开清单） | **平开门** |
| 4 | 其余 | **其它** |

**实跑复核**（`数量=5, 金额=100, 平方数=2`）：

| 夹具 | 归类 |
|---|---|
| `扇数:'2轨2扇', 型材:'普通', 开向:'内左'` | 移门（**开向被忽略**） |
| `扇数:'2轨2扇', 型材:'哑口', 开向:'内左'` | **平开门**（哑口排除了第 1 条，落进第 3 条） |
| `扇数:'', 型材:'哑口 钻石'` | **淋浴房**（哑口不影响钻石） |
| `扇数:'', 型材:'哑口', 开向:'内左'` | 平开门 |
| `扇数:'', 型材:'钻石', 开向:'外右'` | 淋浴房（第 2 条赢） |
| `扇数:'', 型材:'普通', 开向:''` | 其它 |

⚠️ **`开向` 只在第 3 条参与**，且必须同时 `!型材.includes("钻石")` —— 钻石行的平开开向**不算平开门**。

---

## 5. 逐行基元 B：扇数分类（5 桶，**同一行可同时进多个桶**）

### 5.1 完整公式

`xe`（`@10655`）：

```js
xe = e => {
  if (h.value && "无" === e["底玻"])                                   // ★ 不含单玻开关
    return { swingFans:0, slidingFans:0, showerFans:0, otherFans:0, brightFans:0 }
  const o = e["数量"] || 0
  let n=0, u=0, s=0, i=0, c=0
  const d = l()                                                        // 自定义开向名表（localStorage）
  const V = e["型材"] && e["型材"].includes("哑口")                      // isYakou
  const w = [22 项扇数清单].includes(e["扇数"]) && !V                    // isSliding
  const y = e["扇数"] === "一固一活" || "双活" === e["扇数"]              // isShowerByFans
  const m = e["型材"] && e["型材"].includes("钻石")                      // isDiamond
  const g = ze(e["开向"], d)                                            // isSwing（开向 ∈ 14 项）
  const v = e["亮窗总高"] > 0 && e["轨道种类"] && e["轨道种类"] !== "NULL"
            && "" !== e["轨道种类"]                                     // hasBright

  if (m || (Ne.includes(a(e["开向"],d)) ? n = o                     // 单开 8 项 → 数量
            : Be.includes(a(e["开向"],d)) && (n = 2*o)),            // 双开 6 项 → 2×数量
      w) {                                                          // ← 逗号运算符：真条件是 w
    const l = e["扇数"]; let a = 1
    "2轨2扇"===l||l==="单轨2扇"||l==="折叠2扇" ? a=2
    : l==="2轨3扇"||l==="3轨3扇"||l==="折叠3扇"||l==="3轨2扇1纱" ? a=3
    : "2轨4扇"===l||l==="折叠4扇"||"4轨4扇"===l ? a=4
    : l==="3轨4扇2纱"||l==="折叠6扇"||l==="6轨6扇" ? a=6
    : l==="单轨单扇" ? a=1
    : "折叠5扇"===l||"5轨5扇"===l ? a=5
    : l==="折叠7扇"||"7轨7扇"===l ? a=7
    : l==="折叠8扇"||l==="8轨8扇" ? a=8
    : l!=="折叠9扇"&&l!=="9轨9扇"||(a=9)
    e["型材"] && e["型材"]["includes"]("+0")                        // ★ 空转语句，见 §5.4
    u = o * a
  }
  return (y ? s = 2*o : m && (s = o)),                              // 淋浴扇
         v && (c = o),                                              // 亮窗扇
         !w && !v && !y && !m && !g && (i = o),                     // 其它扇
         { swingFans:n, slidingFans:u, showerFans:s, otherFans:i, brightFans:c }
}
```

`Ee`（14 项并集，`@10374`）、`Ne`（8 项单开）、`Be`（6 项双开）：

```js
Ee = ["内左","内右","外左","外右","左锁内开","右锁内开","左锁外开","右锁外开",
      "双开内开","双开外开","双开内左","双开内右","双开外左","双开外右"]
Ne = ["内左","内右","外左","外右","左锁内开","右锁内开","左锁外开","右锁外开"]
Be = ["双开内开","双开外开","双开内左","双开内右","双开外左","双开外右"]
ze = (e,t) => { if (!e) return false; return Ee.includes(a(e, t || l())) }     // @10569
```

`a` = `openDirectionNaming` 的 `g`（**把用户自定义的开向名归一化回原名**）：

```js
// legacy/js/openDirectionNaming-92dbc91d.js  export{g as a}
function c(t, r) {                                   // ≈ 归一化
  if (!t) return t
  const c = r || o()                                 // o() 读 localStorage 的 custom_direction_names
  if (c?.[t]) return t
  for (const [n, o] of Object.entries(c || {}))
    if (typeof o === "string" && o.trim() && o.trim() === t.trim()) return n
  return t
}
```

**实跑复核**：`normalize('左边开', {'内左':'左边开'}) === '内左'`，
`normalize('内左', {'内左':'左边开'}) === '内左'` ⇒ 归一化是**双向幂等**的。

### 5.2 「不含单玻」开关（`h`）—— 复核

| 项 | 结论 |
|---|---|
| 控件 | `el-checkbox`，文案「不含单玻」，`size:"small"`，放在 `.kpi-card.fans` 的 `.fans-filter-toggle`（**绝对定位右上角**） |
| 初值 | `h = Vue.ref(false)`（`@8103`）→ **默认关** |
| 判定 | **`底玻 === "无"`（严格相等）**，只看 `底玻`；不看 `面玻`/`玻璃厚`/`型材`/`开向`/`扇数` |
| 命中时 | 该行 **`swingFans/slidingFans/showerFans/otherFans/brightFans` 全部置 0** |
| 行会被丢吗 | **不会**。`Me` 仍然把 `数量`/`平方数`/`金额` 计入 `totalQuantity`/`totalArea`/`totalAmount`，也仍计入 4 个**门数**桶 |
| 谁吃 `h` | **只有 `xe`**（扇数）。`Me` 的门数/面积/金额分类完全不看 `底玻` |
| 分母 | `pe`（看板自己筛完的行），**每个 tab 的分组（`De/be/Se/Pe`）同样走 `pe`，口径一致** |
| 文案影响 | **只有两处**：导出 xlsx 的表标题（`@19976`）与「总扇数」列头（`@20021`）。**其余列头、xlsx 文件名、图表标题都不变** |

**实跑复核**（`底玻` 取值 → `xe` 返回，`h=true`）：

| `底玻` | 结果 |
|---|---|
| `"无"` | 5 桶全 0 |
| `"5mm"` / `""` / `null` / `undefined` | 正常算（**不算单玻**） |

`watch(h, () => { i.value && Te() })`（`@19312` 之后）→ 开关一变就重画图。

### 5.3 ⚠️ 别类推：同一份代码里「单玻」还有**另一个**定义 —— 复核

**打印/标签文案**里的「单玻」（本 build `@131382` / `@133898`，两处逐字相同）：

```js
"无" === e["底玻"] && "无" != e["面玻"]
  ? n["glass"] = (g === "家家发门业" || g === "星之铝门窗") ? "单玻:" + e["面玻"]
                                                          : "单玻:" + e["面玻"] + "*" + e["玻璃厚"] + "mm"
  : "无" === e["底玻"] && "无" == e["面玻"] ? n.glass = "无玻璃"
  : e["型材"]["includes"]("钻石") ? n["glass"] = …"固玻:"+底玻+"<br>门玻:"+面玻…
  : 0 == e["玻璃厚"] ? n["glass"] = "背板:"+底玻+"<br>面板:"+面玻
  : n.glass = …
```

**两个「单玻」不等价**：

| 场景 | 看板「不含单玻」会剔吗 | 标签会写「单玻:…」吗 |
|---|---|---|
| `底玻='无'`, `面玻='5mm'` | ✅ 剔 | ✅ 写 |
| `底玻='无'`, `面玻='无'` | ✅ 剔 | ❌ 写「无玻璃」 |
| `底玻='无'`, `面玻=''` | ✅ 剔 | ❌ 走后面的分支 |
| `底玻='5mm'`, `面玻=''` | ❌ 不剔 | ❌ |

⇒ **新版实现时不要写一个 `is单玻()` 同时喂这两处**，要写两个语义不同的函数（或一个带参的）。

### 5.4 旧版死代码：`型材.includes("+0")`

`xe` 的移门分支里：

```js
e["型材"] && e["型材"]["includes"]("+0"),      // ← 求值后丢弃（逗号运算符左操作数）
u = o * a
```

**没有任何赋值**。工作条统计 `yo`（`@` 在 `Progress` 里）里有一模一样的空转：

```js
0===r ? t : (l["型材"] && l["型材"]["includes"]("+0"), t + o*r)
```

⇒ 这是从更早版本残留的死代码（当年大概是「型材含 `+0` 时扇数 +0 / ×1」之类）。
**新版不实现它**，但要在注释里写明「旧版有这段空转，是有意不抄」。

### 5.5 ⚠️ 一行可以同时进**多个**扇数桶 ⇒ `totalFans` 不是「行的扇数」

**实跑**：

| 夹具（`数量:1`） | `xe` 返回 |
|---|---|
| `扇数:'单轨单扇', 开向:'内左'` | `{swingFans:1, slidingFans:1, showerFans:0, otherFans:0, brightFans:0}` |
| `扇数:'', 开向:'内左', 亮窗总高:50, 轨道种类:'2轨'` | `{swingFans:1, slidingFans:0, …, brightFans:1}` |

`swingFans` 与 `slidingFans` 是**两个独立 `if`**，互不排斥。
`Me` 最后 `totalFans = swingFans + slidingFans + slidingBrightFans + showerFans + otherFans` ——
**5 个桶直接相加**。所以「总扇数」可能**大于**逐行算出来的扇数。
⚠️ 但 `Me` 里那 4 个**门数**桶是 `if/else if` 链，**互斥**（`totalQuantity` = 各桶之和，安全）。

同理 §5.1 里 `otherFans` 的条件 `!w && !v && !y && !m && !g` 说明「其它扇」是**补集**，但
`slidingFans` 与 `swingFans`/`brightFans` **可以叠加**。

---

## 6. 聚合器 `Me`（`@11893`）

```js
Me = e => {
  const l = { totalQuantity:0, swingQuantity:0, slidingQuantity:0, showerQuantity:0, otherQuantity:0,
              totalArea:0, swingArea:0, slidingArea:0, showerArea:0, otherArea:0,
              totalAmount:0, swingAmount:0, slidingAmount:0, showerAmount:0, otherAmount:0,
              totalFans:0, swingFans:0, slidingFans:0, slidingBrightFans:0, showerFans:0, otherFans:0 }
  e["forEach"](e => {
    const o = e["数量"] || 0, n = e["平方数"] || 0, u = e["金额"] || 0
    const s = （§4 的分类器）(e)
    l.totalQuantity += o; l.totalArea += n; l.totalAmount += u
    s === "平开门" ? (l.swingQuantity+=o,  l.swingArea+=n,  l.swingAmount+=u)
    : s === "移门" ? (l.slidingQuantity+=o, l.slidingArea+=n, l.slidingAmount+=u)
    : s === "淋浴房" ? (l.showerQuantity+=o, l.showerArea+=n, l.showerAmount+=u)
    :                 (l.otherQuantity+=o,  l.otherArea+=n,  l.otherAmount+=u)
    const i = xe(e)                                                    // ★ 唯一吃 h 的地方
    l.swingFans += i.swingFans; l.slidingFans += i.slidingFans
    l.slidingBrightFans += i.brightFans          // ← 亮窗扇进的是「移门亮窗」桶
    l.showerFans += i.showerFans; l.otherFans += i.otherFans
  })
  l.totalFans = l.swingFans + l.slidingFans + l.slidingBrightFans + l.showerFans + l.otherFans
  return l
}
```

**边界**：

- `数量`/`平方数`/`金额` 用 `|| 0` 兜底 —— `null`/`undefined`/`NaN`/`""` 都变 0。
- ⚠️ **但字符串数字会变成字符串拼接**：`数量:'3'` → `totalQuantity` = `"03"`（`0 + '3'`）。
  更糟的是 KPI 卡里 `totalArea.toFixed(2)`（`@28585`）会 **`TypeError: toFixed is not a function`**。
  **实跑证实会抛异常**。⚠️ **未证实**线上服务端是否可能返回字符串（`getProgress` 的 DTO 未查）。
- ⚠️ **亮窗扇的归属**：`brightFans` 无条件累进 `slidingBrightFans`，而**该行的门数**可能落进「其它」。
  实跑：`{数量:2, 型材:'普通', 亮窗总高:100, 轨道种类:'2轨', 扇数:''}` →
  门数分类 = **其它**，但 `slidingBrightFans = 2`。
  ⇒ **「按门数」饼和「按扇数」饼分解的不是同一批行**，合计对不上是正常的。

---

## 7. 五张 KPI 卡（`ke`，`@13291`）

```js
ke = Vue.computed(() => {
  const t = pe.value, l = Me(t)
  const a = t.filter(e => e["单号"]).length                    // ← 注意：纯 truthiness！
  return { ...l, startedCount: a, notStartedCount: t["length"] - a }
})
```

### 卡 1 —— `.kpi-card.total`

```
label     总门数
value     {ke.totalQuantity}                      （整数原样，不格式化）
detail    平开{q} | 移门{q} | 淋浴{q} | 其它{q}     其中 q = swing/sliding/shower/other Quantity
```

源码 `@27290`：

```js
Vue.createElementVNode("div",{class:"label"},"总门数",-1),
Vue.createElementVNode("div",A,Vue.toDisplayString(ke["value"]["totalQuantity"]),1),
Vue.createElementVNode("div",D,"平开"+ke["value"]["swingQuantity"]
   +" | 移门"+ke["value"]["slidingQuantity"]
   +" | 淋浴"+ke["value"]["showerQuantity"]
   +" | 其它"+ke["value"]["otherQuantity"],1)
```

⚠️ **分隔符是 `" | "`**，标签与数字之间**没有空格**（`平开2 | 移门3`）。

### 卡 2 —— `.kpi-card.fans`（带「不含单玻」开关）

```
开关      ☐ 不含单玻        （.fans-filter-toggle，绝对定位右上角）
label     总扇数
value     {ke.totalFans}
detail    平开{s} | 移门{s} | 亮窗{s} | 淋浴{s} | 其它{s}
```

> ⚠️ **副行的顺序是 平开 / 移门 / 亮窗 / 淋浴 / 其它**，
> 与**饼图**的顺序（平开扇数 / 移门扇数 / **淋浴扇数** / **移门亮窗** / 其它）**不同**（§8）。
> 实现时别照着饼图的顺序抄副行。

### 卡 3 —— `.kpi-card.area`

```
label     总平方                       ← 不是「总平方数」
value     {ke.totalArea.toFixed(2)}
detail    平开{swingArea.toFixed(1)} | 移门{…toFixed(1)} | 淋浴{…toFixed(1)} | 其它{…toFixed(1)}
```

⚠️ 主值 `toFixed(2)`、副行 `toFixed(1)` —— **精度不一样**。

### 卡 4 —— `.kpi-card.amount`

```
label     总金额
value     ¥{ke.totalAmount.toFixed(0)}
detail    平开{swingAmount.toFixed(0)} | 移门{…} | 淋浴{…} | 其它{…}
```

### 卡 5 —— `.kpi-card.production`

```
label     生产进度
（无 value 行）
sub-values  ├─ 已生产: {ke.startedCount}     （.started   → #67c23a 绿）
            └─ 未生产: {ke.notStartedCount}  （.not-started → #f56c6c 红）
```

```js
Vue.createElementVNode("span",H,"已生产: "+Vue.toDisplayString(ke.value["startedCount"]),1),
Vue.createElementVNode("span",q,"未生产: "+Vue.toDisplayString(ke["value"]["notStartedCount"]),1)
```

### 7.1 ⚠️ 已知不一致：「已生产」判定 ≠ 「生产状态」筛选判定

| 判定处 | 表达式 | `单号 = undefined` | `单号 = 0` |
|---|---|---|---|
| 生产状态**筛选**（§3.4） | `null !== 单号 && "" !== 单号` | **算「已进入生产」** | 算「已进入生产」 |
| 生产进度**卡片**（`ke`） | `t.filter(e => e["单号"]).length` | **不算已生产** | 不算已生产 |

**实跑证实**：`单号 = undefined` 的单行 → 选「已进入生产」留下 **1 行**，但卡片显示 `已生产: 0 / 未生产: 1`。
`单号 = 0` 同。`null`/`""`/`" "`/`"A-1"` 两处一致。

⇒ 同一个面板上，**筛选器说这行已生产，进度卡说它未生产**。
实际数据里 `单号` 为 `null`（新行模板 `"单号":null`，`@72562`）或 string，两处一致；
**只有当字段整个缺失（`undefined`）或为数字 `0` 时才分歧**。⚠️ 实测数据里出现概率未证实。

---

## 8. 四张饼图（`Te`，`@15626`）

### 8.1 共用 option

```js
const l = {
  tooltip: { trigger:"item" },
  legend:  { bottom:"0%" },
  series: [{
    type: "pie",
    radius: ["40%","70%"],                 // 环形
    center: ["50%","45%"],
    itemStyle: { borderRadius:5, borderColor:"#fff", borderWidth:2 },
    label: { show:!0, formatter: "{b}: {c} ({d}%)" },
  }]
}
```

**实跑/读码复核的点**：

- **没有 `roseType`**（不是玫瑰图）。
- **没有 `sort`/`sortBy`** → 扇形按**数据声明顺序**排（不按值大小）。所以「小的在前」是正常的。
- **没有 `labelLine`** 配置 → 用 echarts 默认。
- **`{d}%` 的分母由 echarts 自己算** = 该系列 value 之和。旧版**没有做除零保护** ⇒ 全 0 时 echarts 画空环。
- 图标题不是 echarts title，而是 DOM 里的 `.chart-title` div。

### 8.2 四张图的数据

| 标题 | ref | 数据（顺序 = 扇形顺序） |
|---|---|---|
| **按门数** | `countPieRef`(`C`) | `平开门=swingQuantity` / `移门=slidingQuantity` / `淋浴房=showerQuantity` / `其它=otherQuantity` |
| **按扇数** | `fansPieRef`(`E`) | `平开扇数=swingFans` / `移门扇数=slidingFans` / **`淋浴扇数=showerFans`** / **`移门亮窗=slidingBrightFans`** / `其它=otherFans` |
| **按平方** | `areaPieRef`(`B`) | `平开门/移门/淋浴房/其它 = parseFloat(swing/sliding/shower/otherArea.toFixed(2))` |
| **按金额** | `amountPieRef`(`ne`) | `平开门/移门/淋浴房/其它 = swing/sliding/shower/otherAmount`（**不取整**） |

> ⚠️ **「按扇数」饼的 3、4 位是「淋浴扇数 → 移门亮窗」**，
> 而 KPI 卡副行是「亮窗 → 淋浴」（§7 卡 2）。**两处顺序不同**，是旧版真实差异，不是笔误。
>
> ⚠️ 「按平方」**每项各自 `toFixed(2)` 再 `parseFloat`**（所以各自四舍五入后再画），
> 「按金额」**原值**（`总金额` 卡才 `toFixed(0)`）—— 所以饼的分段和可能 ≠ 卡上的总金额（差在四舍五入）。

### 8.3 重绘时机

`Te` 是**普通函数**（不是 computed），只在下列时机被调：

| 时机 | 触发点 |
|---|---|
| 打开对话框 | `watch(i, e => { if (e) { …nextTick(() => { init echarts; Te() }) } })` `@18597` |
| `tableData` 变（deep） | `watch(() => u["tableData"], () => i.value && Te(), {deep:true})` `@19312` |
| `不含单玻` 开关 | `watch(h, () => i.value && Te())` |
| 时间 radio | `ye` → `nextTick(Te())` |
| 客户/业务员/生产状态 | select 的 `onChange: ge` → `nextTick(Te())` |
| 重置 | `ve` → `ge()` |
| `setCustomDateRange` | `nextTick(Te())` |

`Te` 开头有门禁：

```js
Te = () => { if (!(re && se && ie && ue)) return; … if (de) { …趋势… } }
```

即 **4 张饼的实例都在**才画；趋势单独判 `de`。

⚠️ **旧版从不在 window resize 时调 `echarts.resize()`**。
`window.addEventListener("resize", V)` 注册的 `V` 只改 `c`（是否移动端）。
⇒ 拖窗口大小时图表**不跟随**（只在重新打开时按新尺寸 init）。新版要不要照抄这个毛病需拍板。

### 8.4 「按工序统计」的在窗口重开时的额外请求

见 §10.2。

---

## 9. 趋势图（`Ue` `@14492` + `Te` 内的 option）

### 9.1 数据 `Ue`

```js
Ue = Vue.computed(() => {
  const t = pe["value"], l = new Map
  t["forEach"](t => {
    const o = t["日期"] || "未知日期"
    if (!l.has(o)) l.set(o, { doors:0, fans:0, area:0, amount:0 })
    const n = l.get(o), r = xe(t)
    n.doors  += t["数量"] || 0
    n.fans   += r.swingFans + r.slidingFans + r.brightFans + r.showerFans + r.otherFans
    n.area   += t["平方数"] || 0
    n.amount += t["金额"] || 0
  })
  const a = Array.from(l.keys()).filter(e => "未知日期" !== e).sort()
  if (a.length > 30) {                                    // ★ 超过 30 个不同日期
    const t = new Map
    a.forEach(a => { const n = a.substring(0,7)           // "YYYY-MM"
      if (!t.has(n)) t.set(n, {doors:0,fans:0,area:0,amount:0})
      const r = t.get(n), u = l.get(a)
      r.doors += u.doors, r.fans += u.fans, r.area += u.area, r.amount += u.amount })
    const o = Array.from(t.keys()).sort()
    return { dates:o, doors:o.map(l=>t.get(l).doors), fans:o.map(l=>t.get(l).fans),
             area:o.map(l=>parseFloat(t.get(l).area.toFixed(2))),
             amount:o.map(l=>t.get(l).amount), isMonthly:!0 }
  }
  return { dates:a, doors:a.map(t=>l.get(t).doors), fans:a.map(t=>l.get(t).fans),
           area:a.map(t=>parseFloat(l.get(t).area.toFixed(2))),
           amount:a.map(t=>l.get(t).amount), isMonthly:!1 }
})
```

**规则**：

| 规则 | 值 |
|---|---|
| 分组键 | `日期 || "未知日期"`；**`"未知日期"` 桶最后被剔除**（不进 `dates`） |
| `doors` | `Σ 数量` |
| `fans` | `Σ (swing + sliding + bright + shower + other)` —— **等于逐行 `totalFans`** |
| `area` | `Σ 平方数`，**最后 `parseFloat(toFixed(2))`**（日聚合和月聚合都做） |
| `amount` | `Σ 金额`，**不取整** |
| 排序 | 默认字符串 `sort()` 升序 |
| **转月阈值** | **不同日期数 `> 30`**（**31 才转**，30 不转；实跑证实） |
| 转月键 | `日期.substring(0,7)` → `"YYYY-MM"` |
| 空数据 | `dates: []`，四个数组全空，`isMonthly:false` |

**实跑**：34 个不同日期 → `{dates:["2026-08","2026-09"], doors:[31,3], amount:[310,30], isMonthly:true}`；
30 天 → `isMonthly:false`；31 天 → `true`。

### 9.2 标题

```js
Vue.createElementVNode("div",$, Vue.toDisplayString(Ue["value"]["isMonthly"] ? "月度趋势" : "每日趋势")
                            + "（门数/扇数/平方/金额）", 1)
```

⇒ `每日趋势（门数/扇数/平方/金额）` / `月度趋势（门数/扇数/平方/金额）`（**全角括号**）。

### 9.3 option

```js
{
  tooltip: { trigger:"axis", axisPointer:{ type:"cross" } },
  legend: { data:["门数","扇数","平方","金额"], bottom:"0%",
            selected: { "门数":!1, "扇数":!0, "平方":!1, "金额":!1 } },   // ★ 默认只显示「扇数」
  grid: { left:"3%", right:"4%", bottom:"15%", top:"10%", containLabel:!0 },
  xAxis: { type:"category", data: t.dates, axisLabel:{ rotate:45 } },
  yAxis: [ { type:"value", name:"数量/扇数", position:"left" },
           { type:"value", name:"金额",     position:"right" } ],
  series: [
    { name:"门数", type:"bar",  data: t.doors,  barMaxWidth:30 },
    { name:"扇数", type:"bar",  data: t.fans,   barMaxWidth:30 },
    { name:"平方", type:"line", data: t.area,   smooth:!0 },
    { name:"金额", type:"line", data: t.amount, yAxisIndex:1, smooth:!0 },
  ]
}
```

- **图表类型**：2 根 bar（左轴，「数量/扇数」）+ 2 条 line（平方走左轴、金额走 `yAxisIndex:1` 右轴）。
- **默认只勾「扇数」**（`selected` 里其余三个 `false`）—— 打开看板时**只看到两条柱**，用户要自己点图例开别的。
- `xAxis.axisLabel.rotate: 45`。
- **没有 `dataZoom`、没有 `title`**。
- ⚠️ 右轴 `name:"金额"` 与 series「金额」同名，但「平方」这条 line 挂在**左轴**（没写 `yAxisIndex`）——
  UI 上「平方」和「金额」量纲不同却分属左右轴，是旧版有意为之还是疏忽：**未证实**，照抄即可。

---

## 10. 四个统计 tab

### 10.1 tab 骨架与列集

`el-tabs` 绑 `p`（`p = Vue.ref("customer")` → **默认「按客户统计」**）：

| `name` | 标签 | 数据 | 首列标签 |
|---|---|---|---|
| `customer` | 按客户统计 | `De` | 客户 |
| `salesman` | 按业务员统计 | `be` | 业务员 |
| `procedure` | 按工序统计 | `Se` | 工序 |
| `profile` | 按型材统计 | `Pe` | 型材 |

**四个 tab 的列集逐字相同**（`@31973` / `@35633` / `@39283` / `@42933`，仅首列的 `label` 不同）：

| # | 分组 | 列 `label` | `prop` | width | sortable |
|---|---|---|---|---|---|
| 1 | — | 客户/业务员/工序/型材 | `name` | 180 | ✅ |
| 2 | **数量类** | 总门数 | `metrics.totalQuantity` | 90 | ✅ |
| 3 | | 平开 | `metrics.swingQuantity` | 80 | |
| 4 | | 移门 | `metrics.slidingQuantity` | 80 | |
| 5 | | 淋浴 | `metrics.showerQuantity` | 80 | |
| 6 | | 其它 | `metrics.otherQuantity` | 80 | |
| 7 | **扇数类** | 总扇数 | `metrics.totalFans` | 90 | ✅ |
| 8 | | 平开扇 | `metrics.swingFans` | 80 | |
| 9 | | 移门扇 | `metrics.slidingFans` | 80 | |
| 10 | | 移门亮 | `metrics.slidingBrightFans` | 80 | |
| 11 | | 淋浴扇 | `metrics.showerFans` | 80 | |
| 12 | | 其它扇 | `metrics.otherFans` | 80 | |
| 13 | **面积类 (m²)** | 总面积 | `metrics.totalArea` | 100 | ✅ |
| 14 | | 平开 | `metrics.swingArea` | 90 | |
| 15 | | 移门 | `metrics.slidingArea` | 90 | |
| 16 | | 淋浴 | `metrics.showerArea` | 90 | |
| 17 | | 其它 | `metrics.otherArea` | 90 | |
| 18 | **金额类 (元)** | 总金额 | `metrics.totalAmount` | 110 | ✅ |
| 19 | | 平开 | `metrics.swingAmount` | 100 | |
| 20 | | 移门 | `metrics.slidingAmount` | 100 | |
| 21 | | 淋浴 | `metrics.showerAmount` | 100 | |
| 22 | | 其它 | `metrics.otherAmount` | 100 | |

渲染细节：

- 面积列 `default` 插槽里 `toFixed(2)`（`总面积` = `metrics.totalArea.toFixed(2)`，其余同理）；
  金额列 `toFixed(0)`；**数量/扇数列直接显示原值，不格式化**。
- 扇数列的表头**不吃「不含单玻」**：只有 **导出 xlsx** 的 `总扇数` 列头会变（§11），
  页面上的列头**固定写死 `总扇数`**。
- 表格：`border`、`style="width:100%"`、`height="400"`、`header-cell-style="Ye"`、`cell-style="Oe"`。
- 每个 tab 上方一个 `el-button type="primary" size="small"`「导出表格」。
- **没有分页**、**没有 TopN 截断** —— 全部分组一次性渲染在 400px 高的滚动区里。

**行/列配色**（`Ye` `@17495` 表头 / `Oe` `@18296` 单元格）：

```js
Ye = ({row, column, rowIndex, columnIndex}) => {
  const n = column["label"] || "", u = column.property || ""
  return n === "数量类" || n["includes"]("门数")
         || ("平开"===n||"移门"===n||"淋浴"===n||"其它"===n) && u["includes"]("Quantity")
           ? {background:"#d9ecff", color:"#1890ff", fontWeight:"bold"}
    : u["includes"]("Quantity") ? {…同蓝…}
    : n === "扇数类" || n["includes"]("扇") || u["includes"]("Fans") || u["includes"]("Bright")
           ? {background:"#efdbff", color:"#722ed1", fontWeight:"bold"}
    : n === "面积类 (m²)" || n === "总面积" ? {background:"#d9f7be", color:"#52c41a", fontWeight:"bold"}
    : u["includes"]("Area") ? {…同绿…}
    : "金额类 (元)" === n || n === "总金额" ? {background:"#ffe7ba", color:"#d46b08", fontWeight:"bold"}
    : u.includes("Amount") ? {…同橙…} : {}
}
Oe = ({row, column, rowIndex, columnIndex}) => {          // 单元格底色
  const n = column["property"] || ""
  return n["includes"]("Quantity") ? {background:"#e6f4ff"}
    : n["includes"]("Fans") || n["includes"]("Bright") ? {background:"#f9f0ff"}
    : n["includes"]("Area") ? {background:"#f0fff0"}
    : n["includes"]("Amount") ? {background:"#fff7e6"} : {}
}
```

**中文分支确实会命中 —— 命中的是「分组表头」那一行**（`el-table-column` 的分组列没有 `prop`，
所以 `u === ""`，只能靠 `n` 认）。逐格推演：

| 单元格 | `n` | `u` | 命中分支 | 色 |
|---|---|---|---|---|
| 分组头 `数量类` | 数量类 | — | `n === "数量类"` | 蓝 |
| 分组头 `扇数类` | 扇数类 | — | `n === "扇数类"` | 紫 |
| 分组头 `面积类 (m²)` | 面积类 (m²) | — | `n === "面积类 (m²)"` | 绿 |
| 分组头 `金额类 (元)` | 金额类 (元) | — | `"金额类 (元)" === n` | 橙 |
| 数据头 `总门数` | 总门数 | `metrics.totalQuantity` | `n.includes("门数")` | 蓝 |
| 数据头 `平开`(数量组) | 平开 | `metrics.swingQuantity` | `("平开"===n) && u.includes("Quantity")` | 蓝 |
| 数据头 `平开`(面积组) | 平开 | `metrics.swingArea` | 落到 `u.includes("Area")` | 绿 |
| 数据头 `平开`(金额组) | 平开 | `metrics.swingAmount` | 落到 `u.includes("Amount")` | 橙 |

⚠️ 注意 `||` 与 `&&` 的优先级：`A || B || (C && D)` —— 「平开/移门/淋浴/其它」这四个标签
**必须同时** `prop` 含 `Quantity` 才是蓝的，所以它们在面积组/金额组里靠**后面的** `u.includes("Area"/"Amount")` 兜住。
`扇数类` 那一档里的 `n.includes("扇")` 会把「平开扇/移门扇/淋浴扇/其它扇」都抓住。
**单元格底色 `Oe` 完全没有中文分支**，只看 `prop`。

### 10.2 分组函数 `Ae`（`@13441`）

```js
Ae = e => { const l = new Map
  pe["value"]["forEach"](a => { const n = e(a); l.has(n) || l.set(n,[]); l.get(n).push(a) })
  return Array.from(l.entries())
    .map(([e,t]) => ({ name:e, metrics: Me(t) }))
    .sort((e,l) => l["metrics"]["totalAmount"] - e["metrics"]["totalAmount"])   // ★ 总金额降序
}
De = Vue.computed(() => Ae(e => e["客户"] || "未知客户"))
be = Vue.computed(() => Ae(e => e["业务员"] && e["业务员"]["trim"]() ? e["业务员"] : "未分配"))
Pe = Vue.computed(() => Ae(e => e["型材"] || "未知型材"))
```

| tab | 分组键 | 空值归入 | 备注 |
|---|---|---|---|
| 客户 | `客户` | `""` / `null` / `undefined` → **`未知客户`** | |
| 业务员 | `业务员` | 空/纯空格 → **`未分配`** | ⚠️ 键是**原值**（`" 张三"` 与 `"张三"` 是两个组） |
| 型材 | `型材` | 空 → **`未知型材`** | |

- **排序：`totalAmount` 降序**。并列时**保持插入顺序**（V8 的 `Array.sort` 稳定）——
  实跑 `[Z:100, A:100, M:100]` → 输出 `Z,A,M`。
- 每个分组的 `metrics` 用同一个 `Me` ⇒ 与 KPI 卡同口径（含 `h` 开关）。
- **没有 TopN**，多少个分组就渲染多少行。

#### 死代码

`@13892`（**没有赋给任何变量**）：

```js
Vue.computed(() => Ae(e => e["单号"] ? "已进入生产" : "未进入生产"));
```

⇒ 「按生产状态统计」这个 tab **被算出来但从未使用**。§5.5 曾把它当成一个隐藏 tab —— 它**连 tab 都不是**。

### 10.3 「按工序统计」`Se`（`@13981`）

```js
Le = Vue.ref({})                       // 工序名表：{ 工序1:"下料", 工序2:"组装", … }
Se = Vue.computed(() => {
  const t = new Map
  pe["value"]["forEach"](l => {
    for (let e = 1; e <= 15; e++) {
      if (10 === e) continue                                    // ★ 跳过工序10
      const o = "工序" + e, n = l[o]
      if (n && "" !== n) {
        const e = Le["value"][o] || "", n = e ? o + "-" + e : o  // 有名字 → "工序N-名字"
        t.has(n) || t.set(n, []); t.get(n).push(l)
      }
    }
  })
  return Array.from(t.entries()).map(([e,t]) => ({ name:e, metrics:Me(t) }))
    .sort((t,l) => parseInt(t.name.match(/工序(\d+)/)?.[1] || "0")
                 - parseInt(l.name.match(/工序(\d+)/)?.[1] || "0"))   // ★ 按槽号升序
})
```

| 规则 | 值 |
|---|---|
| 槽范围 | `1..15`（**含 15**） |
| **跳过** | **`工序10`**（与 §5.4 / `-analysis.md` §5.4 一致） |
| 行入选 | 该槽非空（`n && "" !== n`）—— `null`/`""` 都不算 |
| 分组名 | `Le.value["工序N"]` 有值 → **`工序N-名字`**；否则 → `工序N` |
| **排序** | **按槽号升序**（与其它三个 tab 的「金额降序」**不同**） |
| 多槽命中 | 一行可进**多个**工序组（每槽一组） |

**实跑复核**：
- `Le` 为空 → `工序1 | 工序2 | 工序15`
- `Le = {工序1:'下料', 工序2:'组装', 工序15:'包装'}` → `工序1-下料 | 工序2-组装 | 工序15-包装`
- 夹具里的 `工序10` 值 **不出现**在任何分组里 ✅

**`Le` 的来源**（`watch(i)` 内，`@18903`）：

```js
if (!(Object.keys(Le.value).length > 0)) {
  Ie["value"] = !0
  try {
    const t = await o()                                    // o() = index-c3b16e3f 的 auth/userinfo
    if (!t) return
    const l = t["userinfo"]["registrant"]
    const a = await fetch("https://www.samrtdoor.com.cn/1?param1=GetProcedures&param2=" + l)
    const n = await a.json()
    200 === n["code"] && n["data"] && (Le.value = n["data"])
  } catch(t) {} finally { Ie["value"] = !1 }
}
```

- **硬编码域名** `https://www.samrtdoor.com.cn/1`（注意拼写是 `samrtdoor`，与其它包的 `samrtdoor.com.cn` 一致）。
- `param2 = userinfo.registrant`（**账号的 registrant，不是 name**）。
- **只在对话框打开时拉，且只在 `Le` 为空时拉一次**（首次打开后缓存住）。
  `destroy-on-close` 销毁的是**渲染**，`Le` 是 setup 里的 ref ——
  ⚠️ 但对话框销毁会 unmount 组件 ⇒ setup 重跑 ⇒ `Le` 重新变 `{}` ⇒ **每次打开都重新拉一次**。
  （`watch(i)` 里 `if (!t) return` 之前还有一个 `if (!u.tableData || 0 === u.tableData.length) return void(i.value=!1)`，
  见 §12。）
- ⚠️ **`Ie`（loading 标志）是死变量**：全组件内只被写（`@18771` `Ie.value=!0`、`@19020` `Ie.value=!1`），
  **从未被读**，模板里也**没有 `v-loading`**（grep 确切：组件内 `loading`/`Loading`/`vLoading` 出现 **0 次**）。
  ⇒ 拉工序名期间**界面上没有任何加载提示**。

---

## 11. Excel 导出（`We`，`@19663`）

每个 tab 各一份 xlsx，`We("customer" | "salesman" | "procedure" | "profile")`。

### 11.1 结构

```
工作表名      "统计数据"（四个 tab 都一样）
第 1 行       标题（合并 A1:V1，高 30，16pt 粗体，居中）
               = {tab 中文名} [+ "(不含单玻)"，当 h=true]
                 按客户统计 / 按业务员统计 / 按工序统计 / 按型材统计
第 2 行       分组表头（高 25，11pt 粗体，居中）
               数量类(2-6) | 扇数类(7-12) | 面积类(m²)(13-17) | 金额类(元)(18-22)
第 3 行       列头（高 25，10pt 粗体，居中）
第 4 行起     数据（高 22，居中）
所有单元格    四边 thin 边框
```

### 11.2 列（22 列，与页面 tab **同名同序**，但列头文案略有出入）

| # | 表头 | key | width | 值 |
|---|---|---|---|---|
| 1 | 客户/业务员/工序/型材 | `name` | 20 | |
| 2 | 总门数 | `totalQuantity` | 12 | 原值 |
| 3–6 | 平开 / 移门 / 淋浴 / 其它 | `*Quantity` | 10 | 原值 |
| 7 | **`总扇数` 或 `总扇数(不含单玻)`** | `totalFans` | 16 | 原值 |
| 8–12 | 平开扇 / 移门扇 / **移门亮** / 淋浴扇 / 其它扇 | `*Fans`/`slidingBrightFans` | 10 | 原值 |
| 13 | **总面积(m²)** | `totalArea` | 14 | `parseFloat(toFixed(2))` |
| 14–17 | 平开面积 / 移门面积 / 淋浴面积 / 其它面积 | `*Area` | 12 | 同上 |
| 18 | **总金额(元)** | `totalAmount` | 14 | `parseFloat(toFixed(0))` |
| 19–22 | 平开金额 / 移门金额 / 淋浴金额 / 其它金额 | `*Amount` | 12 | 同上 |

⚠️ 与**页面表格**的列头差异：
页面写 `总面积` / `总金额`（分组头里带单位），导出写 `总面积(m²)` / `总金额(元)`（单位进列头）。
页面写 `移门亮`、导出也写 `移门亮`（一致）。

**唯一吃「不含单玻」的两处**（`h=true` 时）：
1. 第 1 行大标题 → `{tab 名}(不含单玻)`
2. 第 7 列表头 → `总扇数(不含单玻)`

### 11.3 文件名与提示

```js
g.download = u + "_" + f().format("YYYY-MM-DD_HHmmss") + ".xlsx"
ElementPlus.ElMessage.success("导出成功")
// catch: ElementPlus.ElMessage.error("导出失败: " + (e instanceof Error ? e.message : String(e)))
```

⇒ 文件名形如 `按客户统计_2026-09-19_143012.xlsx`（`h=true` 时是 `按客户统计(不含单玻)_…`）。

**分组表头的填充色**：第 2 行按列区间 `#FFD9ECFF`(2-6) / `#FFEFDBFF`(7-12) / `#FFD9F7BE`(13-17) / `#FFFFE7BA`(18-22)；
第 3 行（列头）用更浅的一档 `#FFE6F4FF` / `#FFF9F0FF` / `#FFF0FFF0` / `#FFFFF7E6`
—— 与页面上 `Oe` 的色值一致。

---

## 12. 边界与已知毛病（清单）

| # | 场景 | 旧版行为 | 性质 |
|---|---|---|---|
| 1 | **打开时 `tableData` 为空** | `watch(i)` 里 `if (!u.tableData \|\| 0 === u.tableData.length) return void(i.value = !1)` → **对话框立刻自己关掉**（用户看到闪一下）。点「生产分析」在无数据时**什么都不会出现** | 有意（防崩） |
| 2 | `fe` 结果为空 | `ke` 全 0；`he` = `{start:"",end:""}`；标题 = `生产分析看板`；`Ue.dates = []`（趋势空）；4 张饼的 value 全 0 | 未处理除零（echarts 自己画空） |
| 3 | `数量/平方数/金额` 为 `null`/`undefined`/`NaN` | `\|\| 0` → 0 | 安全 |
| 4 | `数量/平方数/金额` 为**字符串** | `0 + '3'` → **`"03"`**；KPI 卡再调 `.toFixed()` → **`TypeError` 抛异常，整个卡片渲染失败** | ⚠️ 旧版无防护；**未证实**线上会出现 |
| 5 | `日期` 为 `""` | `all` 模式**保留**；其余模式**剔除** | 有意 |
| 6 | `日期` 为 `" "`（纯空格） | `all`/`custom` 下算「有日期」，会**污染标题区间**（`sort()` 把空格排最前） | ⚠️ 瑕疵 |
| 7 | 未来日期 | `today`/`week`/`month` **全部排除**（右端 = 今天） | 有意 |
| 8 | **本周起点** | **周日**（dayjs 默认 locale） | ⚠️ 与我们 `DashboardBigScreen.vue` 的「周一」**相反** |
| 9 | `单号 === undefined` 或 `0` | 「生产状态」筛选判为**已进入生产**，「生产进度」卡判为**未生产** —— **同一面板两处相反** | ⚠️ 旧版不一致（§7.1） |
| 10 | 一行同时是「移门」和「平开方向」 | `swingFans` 与 `slidingFans` **各算一份** → `totalFans` 虚高 | ⚠️ 旧版算法本身如此 |
| 11 | 亮窗行不是移门 | `brightFans` 仍进 **`slidingBrightFans`**，但门数进「其它」 → 两张饼人口不同 | ⚠️ 旧版如此 |
| 12 | `型材` 含「哑口」且 `扇数` 是移门扇 | **不算移门**，落进平开门/其它 | 有意 |
| 13 | `型材` 含「+0」 | `xe` 与工具条 `yo` 里各有一句**空转**（求值后丢弃） | 死代码（§5.4） |
| 14 | 工序 10 | 三个地方都跳过（`Se` 循环、写入侧、§5.4） | 有意 |
| 15 | 窗口 resize | 图表**不 resize**（只更新 `c`） | ⚠️ 旧版瑕疵（§8.3） |
| 16 | 「按生产状态统计」 | 算出来但**从未使用**（连 tab 都不是） | 死代码 |
| 17 | 工序名请求的 loading | `Ie` **只写不读**，无 `v-loading` → **无提示** | 死变量（§10.3） |
| 18 | 「重置」按钮 | **不重置**「不含单玻」`h`，也**不重置**当前 tab `p` | 需要确认是否有意 |

---

## 13. 与 `app/src/components/DashboardBigScreen.vue` 的关系 / 可复用性

### 13.1 结论：**几乎不可复用**，只能借「外壳长相」

| 维度 | `DashboardBigScreen.vue`（我们已有） | `ProductionDashboard`（要重写） |
|---|---|---|
| 业务 | Home 的**经营数据**（订单/客户/收款） | Progress 的**生产分析**（工序/型材/扇数） |
| 数据源 | `OrderSummaryDto[]`（Home 的订单） | `K`（Progress 的行，中文字段名） |
| **图表实现** | **零 echarts**：`conic-gradient` 画饼、`<svg><polyline>` 画趋势、纯 CSS 排行条 | **echarts 全局**（`/vendor/js/echarts.min.js`），环形饼 ×4 + 双轴 bar/line |
| 地图/指标 | 已付/未付/门数/客户排行/业务员排行 | 门数/扇数/平方/金额/生产进度 + 4 分组表 |
| 「本周」 | **周一**起 | **周日**起 |
| 筛选 | 时间 chips（含「90天」）+ 客户 + 业务员 | 时间 radio（含「自定义查询」）+ 客户 + 业务员 + **生产状态** |
| 弹层 | `.big-screen` 自有全屏遮罩（`v-if="show"`） | `el-dialog fullscreen` |

**可以直接借的**：

1. **`.kpi-cards` 的 5 列 grid 布局**（`DashboardBigScreen.vue:525` 已经是 `repeat(5,1fr)`）——但**卡内结构不同**（我们有 `.value`+副行，它的「生产进度」卡没有 `.value`）。
2. **`charts-row` 4 列 grid + 响应式断点**（768 → 2 列、480 → 1 列）——与旧版 CSS 逐字同构，可以照抄数值。
3. 视觉基调（白卡 + `border-radius:8px` + `box-shadow: 0 2px 12px #0000000d`）——**两套本来就是一个设计语言**。

**不能借的**：

- `echarts` — **`app/package.json` 里根本没有 echarts 依赖**。要么新增依赖，要么照 `DashboardBigScreen.vue` 的思路手搓（但 4 张环形饼 + 双轴组合图手搓代价高）。**这是本任务最大的技术决策点，需要上游拍板。**
- 指标口径全部要重写（§4–§10）。

### 13.2 新栈里已存在、**看板可以直接重用**的东西

| 旧版件 | 新版对应 | 说明 |
|---|---|---|
| `openDirectionNaming` 的 `g`（归一化） | `app/src/composables/useOpenDirection.ts` 的 `getOriginalOpenDirection` | `ze` 需要它。**看板不读也不写 localStorage**，只是读那份配置 |
| 开向配置加载 | `Progress.vue` 的 `onMounted` 里已调 `loadOpenDirectionSettings()` | 看板在同页，**无需再加载**（若看板抽成独立组件在别处挂载，则必须自己调） |
| 移门扇数查表（22 项 + 倍数） | `Progress.vue:1313` 的 `moveFans` | ⚠️ **只能借「表」，不能借「函数」** —— 工具条 `yo` 与看板 `xe` 的**跳过规则不同**（哑口行：工具条整行跳过，看板仍可能进 swing/other） |
| 「生产分析」按钮位 | `Progress.vue:123` 已有 `disabled` + `notYet(...)` 占位 | 接真实看板时把这颗按钮的 `disabled` 去掉 |

---

## 14. 差分台（可复现）

按项目硬规矩：**不手抄，切旧版源码真跑**。本轮建了两段：

### 14.1 反混淆（已有流程，直接复用）

```bash
node legacy/decode-progress-map.mjs legacy/js/Progress-f4bdef35.js /tmp/progress-map.json
node legacy/decode-progress-scoped.mjs legacy/js/Progress-f4bdef35.js /tmp/progress-map.json /tmp/progress.decoded.js
#   → 替换 4173 处，残留「名字(数字)」0 处
```

### 14.2 切看板的 setup（**本轮新增**）

`/tmp/dash-index.mjs` 用括号配平找出 `setup(e,{expose:t,emit:n}){…}` 的边界，
再按**顶层 `;`** 切成 10 条语句，标出每条的行内偏移：

```
@8103  refs 与开关          @8478 let re/ue/se/ie（echarts 实例）
@8514  ce（趋势实例）        @8537 let de
@8549  Ve we ye me ge ve fe pe he Ce Ee Ne Be ze xe Me ke Ae De be Pe     ← 5450 字符，核心全在这
@13892 死 computed（生产状态分组）
@13945 Le Ie Se Ue Te Ye Oe
@18597 watch(i) + GetProcedures + echarts init + resize
@19657 We（导出）
@23890 render（22752 字符）
```

`/tmp/dash2.slice.js` = 把 `@8103 @8478 @8514 @8537 @8549 @13945` 六段拼起来 + 导出符号。
**切片里唯一的改动**：`const r=N` 的 `N`（解码器）换成注入的桩（被调用就抛）。

`/tmp/dash2.harness.mjs`：

```js
import { readFileSync } from 'node:fs'
import { g as normalize, l as readNames } from '/tmp/openDirectionNaming.mjs'   // ★ 用真件，不手抄
const body = readFileSync('/tmp/dash2.slice.js', 'utf8')

export function makeRunner({ tableData = [], innerWidth = 1440 } = {}) {
  const N = () => { throw new Error('解码器 N 被调用，切片假设不成立') }
  const Vue = {                                              // 只实现用到的那两个 API
    computed: (fn) => (typeof fn === 'function'
      ? { get value() { return fn() } }
      : { get value() { return fn.get() }, set value(v) { fn.set(v) } }),
    ref: (v) => ({ value: v }),
  }
  const echarts = { init: () => { throw new Error('差分台不画图') } }   // Te 不被调用
  const f = dayjsShim()          // ★ 唯一的手写替身，见下
  const l = () => ({})           // 真件是读 localStorage；替身给空表
  const a = normalize            // ★ 真件
  const factory = new Function('N','Vue','e','n','window','echarts','f','l','a', body)
  const api = factory(N, Vue, { modelValue:true, tableData }, () => {}, { innerWidth }, echarts, f, l, a)
  return { ...api, props: { modelValue:true, tableData } }
}
```

⚠️ **参数名不能叫 `u`/`s`**：切片里 `const r=N,u=e,s=n` 自己声明了 `u`/`s`，用同名形参会
`SyntaxError: Identifier 'u' has already been declared`。要用 `e`/`n`（与旧版实参名一致）。

⚠️ **`f`（dayjs）是唯一的手写替身**，因为 `vue-ade658be.js` 是 4.8MB 的混合 vendor chunk、
`decode-progress-scoped.mjs` 跑不动。替身只实现 `format('YYYY-MM-DD')` / `startOf('week'|'month'|'day')` /
`endOf('month'|'week')` / `subtract(n,'month')`，且**语义逐条对齐 dayjs**：

- `startOf('week')` 用 `date - getDay()` ⇒ **周日**（与 `$locale().weekStart || 0` 一致）；
- 已用「2026-09-13（周日）在 `week` 下保留、2026-09-12（周六）被剔」这条实跑**反向校验**过。

两组夹具脚本：`/tmp/dash2.battery.mjs`（时间/筛选/扇数/分类）、
`/tmp/dash2.battery2.mjs`（工序/趋势/分组/饼）、`/tmp/dash2.battery3.mjs`（归一化/阈值/null）。
本文表格里的每个数字都出自这三个脚本的实际输出。

---

## 15. 未证实 / 需要拍板

### 15.1 未证实（不要当成结论用）

1. ⚠️ **`getProgress` 返回的 `数量`/`平方数`/`金额` 有没有可能是字符串**。
   §12 第 4 条那个 `TypeError` 只在字符串时炸；本轮**没有查服务端 DTO**。
2. ⚠️ **`单号` 会不会真的是 `undefined` 或数字 `0`**（§7.1 的分歧只在那种数据上显形）。
   已知新行模板是 `"单号":null`，线上数据未抽样。
3. ⚠️ **产品名「samrtdoor」拼写**：本轮照抄源码字符串，**没有**核对域名是否真的可解析。
4. ⚠️ **趋势图「平方」挂左轴、「金额」挂右轴**（§9.3）是有意还是疏忽，无从判断。
5. ⚠️ **`"开门红"` 账号实际不可达**（引用 `-shell.md` §6.3，**本轮未复核**）。

### 15.2 需要上游拍板

1. **echarts 依赖**：加 `echarts` 依赖，还是照 `DashboardBigScreen.vue` 手搓？
   （旧版是全局 `/vendor/js/echarts.min.js`，我们 `app/package.json` 里没有。）
2. **「看板绕过数据范围」要不要照抄**（§2.2）：一个业务员账号能看到**全公司**的生产数据。
   这是旧版实际行为，但可能是权限漏洞。
3. **旧版瑕疵照不照抄**（照抄 = 保真；不抄 = 更好用）：
   - 图表 resize（§8.3）
   - `日期` 为 `" "` 污染标题区间（§12 第 6 条）
   - 「重置」不清 `不含单玻`（§12 第 18 条）
   - 生产状态筛选与进度卡判定相反（§7.1）—— **这条建议不要照抄**，但要写清按哪个为准
   - 打开时无数据自动关窗（§12 第 1 条）—— 建议照抄（否则 `ke` 全 0 的面板更难看）
4. **「本周」起点**：旧版是**周日**，我们的 `DashboardBigScreen.vue` 是**周一**。
   看板按旧版（周日）实现会让两页不一致；按周一实现会丢保真。**需要明确选一个。**

---

## 附：本轮产出物清单

| 路径 | 用途 | 是否入库 |
|---|---|---|
| `docs/2026-09-19-progress-dashboard.md` | **本文** | ✅ |
| `/tmp/progress.decoded.js` | 反混淆产物（`legacy/decode-progress-*.mjs` 生成） | 一次性 |
| `/tmp/dash-index.mjs` | 切看板 setup 的语句索引器（§14.2） | 一次性 |
| `/tmp/dash2.slice.js` | 看板核心逻辑切片（`@8103`–`@18597`） | 一次性 |
| `/tmp/dash2.harness.mjs` | 差分台（真跑旧版） | 一次性 |
| `/tmp/dash2.battery{,2,3}.mjs` | 三组夹具 | 一次性 |
| `/tmp/openDirectionNaming.mjs` | `legacy/js/openDirectionNaming-92dbc91d.js` 的副本（供 ESM import） | 一次性 |

**本轮没有改任何 `app/` 或 `backend/` 代码。**

---

## 16. 拍板结果（2026-09-19 用户 + 我）

§15.2 那 4 件事的结论。**②③ 用户定，①④ 我定。**

### ② 「看板绕过数据范围」—— **不照抄**

旧版实际行为是：看板吃**原始全量** `K`，连「只看自己打单」的数据范围都不吃
⇒ 一个业务员账号能看到**全公司**的生产数据。**用户拍板不照抄。**

新版：看板的数据范围**与页面一致**（业务员只看自己的）。
⚠️ 这是**有意偏离**，会写进代码注释 —— 别以后有人「照旧版改回去」。

### ③ 旧版瑕疵 —— **一律不照抄**

用户拍板。逐条（§12 那份清单）：

| 瑕疵 | 新版 |
|---|---|
| 图表不 resize | **做 resize** |
| `日期` 为 `" "` 污染标题区间 | **过滤掉**（trim 后为空的日期不算一个区间） |
| 「重置」不清「不含单玻」 | **一起清** |
| 生产状态筛选与进度卡判定**相反** | **统一口径**（分队也建议这条别照抄） |
| 打开时无数据自动关窗 | ✅ **照抄** —— 这不是瑕疵：`ke` 全 0 的面板比直接关掉更难看 |

> 最后一条是**唯一的例外**：它不是毛病，是旧版有意的处理，照抄。

### ① echarts 依赖 —— **加**（动态 import）

- 旧版**就是** echarts（全局 `/vendor/js/echarts.min.js`），**保真度最容易达标**；
- 4 个饼图 + 趋势 + 5 KPI 手搓不现实 —— 我们现有的 `DashboardBigScreen.vue` 只画了**一条**
  手搓 SVG 趋势线，那是另一个量级；
- 用**动态 import**，只在打开看板时才拉那个 chunk，**不进主包**。

版本次旧版对齐（`legacy/vendor/js/echarts.min.js` 的版本，落地时核）。

### ④ 「本周」起点 —— **周一**

- 旧版的**周日**来自 dayjs **默认 en locale**（`weekStart=0`）—— 是**事故不是决策**，
  按用户「旧版瑕疵不照抄」的精神一并处理；
- 我们的 `DashboardBigScreen.vue:187-190` 已经是**周一**（`mondayOffset = day === 0 ? -6 : 1 - day`）；
  两个看板对「本周」给不同答案，比丢一点保真更糟。

⚠️ 有意偏离，写进代码注释。
