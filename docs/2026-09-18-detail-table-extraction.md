# Home 展开行 = Hui 两张明细表：方案（含决策记录）

> 起因：用户指出「Home 页折叠展开的明细行 和 Hui 页表格一样，原版是这样的，新版是重新画的」。
> 对应审计 `docs/home-audit/01-table.md` F3/F4/F5、`02-actions.md` A3 那条**架构级偏离**。
>
> **配套的旧版逆向报告见 `docs/2026-09-18-detail-sfc-recon.md`**（`Ping_hui` / `Diao_hui` 两个 SFC 的
> props / emits / expose / 内部状态 / 列集差异，全部切源码核实，带行号）。本文只写**方案与决策**，
> 不复述那份报告。
>
> **行号口径**：`legacy/js/Hui.formatted.js`（反混淆后，13436 行）用 `Hui.formatted.js:NNNN`；
> 新版用 `文件:行号`。

---

## §0 结论

旧版的平开/移门明细表本来就是**两个独立 SFC**（`Ping_hui` / `Diao_hui`），编译进 Hui chunk
后从里面 export 出来，被 Hui 页面和 Home 展开行**同时使用**。新版从没拆过这两个组件，
Home 展开行是自绘的一张**只读 13 列** `NDataTable`（`Home.vue:1990/2032`）——
所以「长得不一样」是必然的，不是样式没调好。

**本次要做的**：把 Hui 的两张表拆成一个可复用组件，Home 展开行改挂它。

---

## §1 旧版证据链（已切源码核实）

```js
// legacy/js/Home.formatted.js:9-11
import { u as t, _ as l, a as o, … } from "./Hui-d088417c.js";
// legacy/js/Hui-d088417c.js 末尾
export { Hui as H, _0x148cac as _, _0xf4057 as a, … }
```

| | 标识符 | `__name` | scopeId | CSS |
|---|---|---|---|---|
| 平开 | `_0x5a7707` → `_0x148cac` | `Ping_hui` (`Hui.formatted.js:572`) | `data-v-a854303f` | `Hui-39b802eb.css`，105 条 ≈10.1KB |
| 移门 | `_0x4d18bf` → `_0xf4057` | `Diao_hui` (`:3567`) | `data-v-6dcd3802` | 同文件，101 条 ≈10.0KB |

`Ping_hui_vue_vue_type_style_index_0_scoped_a854303f_lang=""` 直接从源码读出，无需解码。

**Hui 页面自己也挂同一个**（`createVNode(_0x148cac, { "customer-info", "selected-date", "add-price-items", "disable-editing":!0, ref:"pingHuiRef", … })`）
—— 同一个组件类型，两页传的 props 不同。

**两个 SFC 是同一份代码 fork 出来的**：两者 CSS 前 12 条选择器逐字相同，连类名都叫 `.ping-hui-*`
（移门表也照用没改），之后各自漂移。⇒ **新版用一个组件带 `kind` 承载两张表**（见 §3.1）。

---

## §2 决策记录（2026-09-19 用户拍板）

| # | 问题 | 决定 |
|---|---|---|
| ① | Home 展开行可编辑到什么程度？ | **全开 + 补落库链路**（选项 C） |
| ② | 拆成一个组件还是两个？ | **一个组件带 `kind: 'ping' \| 'diao'`** |
| ③ | `Hui.vue:2943` 的 `seal_board` 恒真死闸门 | 已回旧版核实 ⇒ 见 §5 |

---

## §3 方案

### 3.1 组件形态

```
app/src/components/DetailLinesTable.vue    // props.kind: 'ping' | 'diao'
app/src/composables/useOrderLines.ts       // 行编辑引擎（模块级单例）
```

**为什么不照抄旧版的两份 fork**：两者是同源重复，差异点可枚举（见 `detail-sfc-recon.md` §6.1/§6.2），
用 `kind` 分支比维护两份更不容易继续漂移。**这是「旧版本身有毛病（重复代码）」的有意不照抄**，
按项目规矩记在这里。

⚠️ **但不能当「同一个底座」糊过去** —— 旧版两份有**实现级**差异，不是同义改写，必须逐条分支：

| 差异 | 平开 | 移门 |
|---|---|---|
| 行数组初值 | `ref([])` | `ref([R()])`（**自带一条空行**，所以移门表永远 ≥1 行） |
| `selectAll()` | `nextTick` 在 `forEach` **外**，且回写 `Pt.value=[...rows]` | `nextTick` 在 `forEach` **里**，**不回写** `diao_hui` |
| 暴露 `columnVisibility` | **有** | **无**（Hui 页 `:8692` 只读平开那份去判断「锁具没指定」，**不能类推**） |
| 开关向接口 | `changeDirectionMode` / `reverseDirection` / `saveCustomDirectionNames` | 无 |
| 取价/初始化 | `getPingPrice` / `initializPing` | `getDiaoPrice` / `initializDiao` |
| 列显隐来源 | `registrant.ping_column` | `registrant.diao_column`（**不 expose**） |
| emits | 4 个 | 5 个（多一个 `update:showCheckbox` —— **死事件，全文件无调用点**） |
| 方数口径 | `max(门洞宽*max(门洞高,亮窗总高)/1e6, l)`，钻石型加墙厚与亮窗 | 另一套（`扇数`/`轨道种类` 驱动） |

### 3.2 props / emits（对齐旧版接口）

旧版接口小，是因为**组件自己持有行数据**（两个 SFC 都不发 `param1=detail`，行全靠父组件灌）。

```ts
defineProps<{
  kind: 'ping' | 'diao'
  rows: Line[]                            // 父持有
  colVis: Record<string, boolean>         // 必须保持 reactive
  client: { name: string; code: string }  // = order.client_name / client_code（列 + 取价要用）
  saved: boolean                          // 决定删除走不走 api
  showCheckbox?: boolean                  // 旧版 prop
  disableEditing?: boolean                // 旧版 prop
  oderColumn?: boolean                    // 旧版 prop
  highlightOrderQuery?: string            // 旧版 prop
  customerInfo?: string                   // 旧版 prop（Hui 传，Home 不传）
  selectedDate?: Date                     // 旧版 prop（Hui 传，Home 不传）
  filling?: boolean                       // 「填入单号」loading
}>()
defineEmits<{
  (e: 'refresh'): void                    // 旧版 emit（单行保存/删除/复制成功后）
  (e: 'unselect', row: Line): void        // 旧版 emit（携带整行 payload）
  (e: 'calculate-single-row', row: Line): void
  (e: 'add-row'): void
  (e: 'batch-delete'): void
  (e: 'toggle-show'): void
  (e: 'fill-line-numbers'): void          // 仅 ping
}>()
```

> ⚠️ **`addPriceItems` 是死 prop，两张表都不读**（平开声明了但从不读，移门连声明都没有；
> 两者都用自己 `useAddPriceItems()` 的实例）。详见 `detail-sfc-recon.md` §2.1。新版不必复刻这个 prop。

**引擎注入**：`useOrderLines.ts`（模块级单例，照 `useMarkupCatalog.ts` / `useOpenDirection.ts` 的既有写法），
承载 `lineRefresh` / `cellError` / 候选源(型材·颜色·轨道·五金·锁具) / `resolveRow` / `syncSizeMarkup` /
`removeLine` / `copyRow` / 门图三件套 / 加价目录 / `partsEngine`（**必须同一实例**）。

### 3.3 落库链路 —— 本次要**补**的那条

**旧版明细行的落库入口是「行级 保存」按钮**，不是页面级「保存回执单」：

```js
// legacy/js/Hui.formatted.js:1429-1454（平开 Ut；移门同构）
const x = {}
for (const a in e) !zt["includes"](a) && (x[a] = e[a])       // 剔内部键
if (ft.value[e.id]) x["加价项目原始数据"] = JSON.stringify(选中加价项)
const o = await fetch(<updateRowData URL>, { method:'POST', body: JSON.stringify(x) })
if (200 === c.code) {
  ElMessage.success("数据更新成功")
  ie.value.delete(a)          // 从「已落库」集合里去掉
  delete pt.value[a]          // 清编辑快照
  vt.value.delete(a)          // 从「脏行」集合里去掉
  Lt("refresh")               // ← emit，父组件刷新
}
```

**新版现状（缺口）**：

| 层 | 状态 |
|---|---|
| 旧版服务端 | `updateRowData` → `orderServ.updateRow(ds, id, body)`（`legacy-dispatch.ts:755`） |
| **我们的后端** | ✅ 已有：`PUT /api/v1/orders/{id}/lines/{line_id}` → `handler::update_line`（`handler.rs:80`），路由已登记（`orders/mod.rs:24`） |
| **我们的前端** | ❌ `client.ts` **没有** `updateOrderLine`（只有 `deleteOrderLine`，`client.ts:195`） |
| **我们的表格** | ❌ `opsCol` 只有 删除 / 复制 / 算料（`Hui.vue:2366-2392`），**没有「保存」** |
| 文档 | `docs/2026-08-23-hui-analysis.md:410/447` 早已记下「保存单行 `updateRowData`」—— **记了没做** |

⇒ **要补三处**：① `client.ts` 加 `updateOrderLine`；② `opsCol` 加「保存」按钮
（按旧版：脏行才可点、「数据更新成功」文案、成功后清脏 + emit `refresh`）；③ 父组件接 `refresh`。

⚠️ **这条是独立的既有缺口，不只服务 Home** —— Hui 页自己现在也缺行级保存。
按 CLAUDE.md 硬规矩，补它要同步改 `docs/2026-08-23-hui-analysis.md` 的状态。

### 3.4 Home 侧接线

`Home.vue` 的 `renderExpandDetail`（`:2032-2062`）从自绘 `NDataTable` 改为挂 `DetailLinesTable`：

- `rows` ← `details[id].lines` 过滤（平开/移门各一个实例，照旧版两个独立实例）
- `showCheckbox: true`、`oderColumn`、`disableEditing`（= 旧版 `sl.value`，`"自助下单" !== row.打单操作`）、
  `highlightOrderQuery`（= 查单号关键字）、`client`
- `@refresh` → 重新 `api.getOrder(id)` 灌 `details[id]`
- `@unselect` / `@calculate-single-row` → 照旧版 `kn`/`Pn`、`In`/`Un`
- 两个实例用 `ref` 登记进 `Map<回执单号, instance>`，供打印链路读（旧版 `Ql`/`Rl`）

**打印链路**：旧版打印读的是**子表实例**（`:9361-9382` `for (const [e,s] of Ql.value.entries()) (s["ping_hui"]||[]).forEach(...)`）。
新版 `useOrderPrint.ensureLineNumbersForPrint` 已经走 `api.fillLineNumbers`，**这次不动** ——
但要在接线后回归确认打印载荷里的明细与展开行一致。

### 3.5 「算料」这条回调比看上去重

旧版 Home 的 `In`（平开）/ `Un`（移门）（`Home.formatted.js:8221-8263`）**不是自己算**：

```js
In = async e => {
  if (lc.value)                                          // lc = ref 到**内嵌的 Hui 页面组件**
    if (typeof lc.value["calculateReceipt"] === "function")
      const a = await lc.value.calculateReceipt({ ping:true, diao:false, single:true, singleRowData:e })
      … uc.value = Array.isArray(a) ? a : []
      ic.value = 2                                       // 切到 ic=2（生产单）
      const i = It["buildPrintData"](u.registrant.template["生产单"], { produces: uc.value })
      Wn.value = i[0][…]; eo.value = true                // 打开预览弹窗
}
```

**旧版 Home 为了复用 `calculateReceipt`，把整个 Hui 页面组件内嵌了进来**
（`import { b as a } from "./Hui-d088417c.js"`，模板里 10 处 `createVNode(a, …)`；`lc` 就是它的 ref）。

⇒ 新版要做这条，**不能照抄「Home 里挂一个 Hui 页面」**。两个选择：

- **(a) 把算料抽成共享件**（推荐）：`Hui.vue` 的 `calculateReceipt` 逻辑落到 `utils/` 或
  `composables/`，Home 与 Hui 各自调。与仓库既有做法一致（`partsEngine.ts` / `printPayloads.ts`
  已经是 Home 与 Hui 共用的底座）。
- (b) 给 `Hui.vue` 加 `defineExpose({ calculateReceipt })`，Home 内嵌 Hui 页面 —— 贴旧版，但把一个页面组件当库用。

⚠️ 无论哪条，都**先要读懂新版 `Hui.vue` 的 `calcSingleRow`（`:2558`）与 `openTemplatePreview`（`:3326`）**
（项目规矩：发现旧版有对应实现时，先整段读完再改）。

### 3.6 连带修好的一条：查单号高亮 + 滚动定位

旧版 `highlight-order-query` 的完整链路（逆向报告 §7 已逐字切出）：

1. SFC 的 `row-class-name` 里，`String(row["单号"]).toLowerCase().startsWith(prop.toLowerCase())`
   → 追加 `highlight-matched-order` 类（CSS 绿底 `#d4edda`）；
2. **滚动不在 SFC 里** —— 在 Home 的 `Yo`（`Home.formatted.js:7702-7729`）：展开首条命中行 →
   `setTimeout(…, 800)` → 在展开行 DOM 里找 `.highlight-matched-order` → 相对滚动容器居中。

新版目前**两条都没做**，而且 `Home.vue:2110-2117` 的注释写着「做不了」：

> 旧版一行明细属于某个单号，新版把单号收在回执单号上了（`0009_orders.sql`：单号不单设列）

**这句已经过时** —— 迁移 `0020_order_line_no.sql` 已加 `order_lines.line_no`，
`OrderLineDto.line_no` 也在（`api/types.ts:162`）。⇒ **这条现在做得了**，
本次接线时一并补上，并改掉那段注释（CLAUDE.md 硬规矩：改了行为同笔提交改文档）。

> 注：小分队 A 的交接里把这条列为「不能直接复用的硬点之一（新版 `OrderLineDto` 没有『单号』）」——
> **那条判断是过时的**，它没看到当天加的 `0020` 迁移。

---

## §4 分步（每步独立可验收）

| 步 | 内容 | 验收 |
|---|---|---|
| 1 | 抽 `useOrderLines.ts`，Hui.vue 改为调用它 | **Hui 行为零变化**；现有检查脚本 + 手工回归 |
| 2 | 补行级保存链路（§3.3 三处） | 旧版差分台：改一格 → 点行内保存 → 重新拉取，逐字段比 |
| 3 | 抽 `components/DetailLinesTable.vue` + 把 ~230 行 CSS 整体搬入 | Hui 像素级一致 |
| 4 | Hui.vue 改挂新组件 | 同上 |
| 5 | Home 展开行改挂新组件 + 回退审计 A3/F3/F4/F5/J8/H1/I4 相关条目 | 展开行逐列与 Hui 比；Home 打印链路回归 |

⚠️ 第 1–4 步**不改变任何可见行为**，可以用「Hui 页改动前后一致」当验收。第 5 步才动 Home。

### 进度

| 步 | 状态 | 验收 |
|---|---|---|
| 1 | ✅ **已完成**（2026-09-19） | 见下 |
| 2 | ✅ **已完成**（2026-09-19） | 见下 |
| 3a | ✅ **已完成**（2026-09-19） | 见下 |
| 3b | ✅ **已完成**（2026-09-19） | 见下 |
| 4 | ✅ **空操作**（3a/3b 已完成挂载） | build + 五件回归 + CSS 差分台全绿 |
| 5 | ✅ **已完成**（5a/5b/5c，2026-09-19） | 见下 |

### 第 5 步的前置（2026-09-19 已做）

Home 每个展开行各有自己的 `lines`（同一时刻可能展开多张单），而引擎依赖里 `lines` 是**一个** ref
—— 共享一份会张冠李戴。所以给组件加了**自建引擎**模式：

```ts
engine?: OrderLines                       // Hui 传页面那份
engineDeps?: { lines; formulas; order; orderId; disableAutoMarkup }   // Home 不传 engine，给这个
const engine = props.engine ?? useOrderLines(props.engineDeps!)        // ?? 短路，与 message/dialog 同手法
```

不违反「引擎唯一」：`createPartsEngine(formulas)` 对同一份 `formulas` 是确定性的，
两份实例的 `isDiamond`/候选/算料结果一致（**旧版两个 SFC 本来就是各持一套**）。

Hui 仍传 `engine` ⇒ **行为零变化**（build + 五件回归 + movecheck 47/47 & 51/51 全绿）。

### 第 5 步的正题：拆成 5a / 5b / 5c

**5a（已做，2026-09-19）—— 算料抽成共享件（原 §3.5）**

`calcRowParts` 进引擎：公式兜底匹配 → 取公式 → `computeParts(l,'B')` → `lineRefresh`，
提示文案逐字照抄。页面只剩两件页面能力，经 `beforeCompute` 回调注入（**保住原顺序**：先拉挖孔图再算）：

- Hui：`engine.calcRowParts(l, loadFormulaImages)` + `openTemplatePreview('product')`
- Home：同样调它，接自己的预览（Home 不再需要内嵌 Hui 页面组件）

**5b（✅ 已完成，2026-09-19）—— 4 个页面弹窗抽成共用件**

```ts
app/src/composables/useDetailLineDialogs.ts   // 状态 + 逻辑（工厂）
app/src/components/DetailLineDialogs.vue      // 四个弹窗的壳
```

Hui 与 Home 各挂一份：`<DetailLineDialogs :d="dialogs" />` +
`const dialogs = useDetailLineDialogs({ lineRefresh: engine.lineRefresh })`。

**搬迁保真**：逻辑**逐字搬**（只把闭包依赖改成参数注入），Hui.vue 2176 行（起点 4041）。
`vue-tsc` + `build` ✅；五件回归全绿。

⚠️ CSS 差分台这次是 **526 → 530（0 消失、4 新增）**：新增的四条
（`.footer` / `.mgmt-name` / `.square-dialog p` / `.vis-col .mgmt-row`）是**在弹窗组件里复制的一份**
—— 页面里这些类还给别的弹窗用着（加价项目管理等），**不能搬走**；而 scoped 样式不跨组件，
所以组件内自成一份。**关键是「0 消失」**：页面那边一条没少。

**原始评估**（保留，便于对照）：组件化后 `DetailLinesTable` 的 `hooks` 里，Home 一样都没有。
这些弹窗原先内联在 Hui.vue：

| 弹窗 | Hui.vue 位置 | 估计 |
|---|---|---|
| 新增加价项目 | 模板 `:158-189` + `submitAddMarkup` 等 | ~60 行 |
| 修改平方数 | `:391-405` + `openSquareDialog`/`confirmSquare` | ~25 行 |
| 门图预览 | `:406-410` | ~5 行 |
| 门图名字（文字传图） | `:411-414` + `confirmTextImg` | ~15 行 |
| 门图上传/删除的 IndexedDB 逻辑 | `applyDoorImg`/`pickDoorImg`/`removeDoorImg` | ~40 行 |

抽成小组件（`MarkupAddDialog` / `SquareDialog` / `DoorImgDialogs`），Hui 与 Home 各挂一份 ——
与 `DetailLinesTable` 同一路子。

**5c（未做）—— Home 接线**

`renderExpandDetail`（自绘只读 13 列）→ 挂两个 `DetailLinesTable`，传 `engineDeps` + `hooks`；
两个实例 `ref` 登记进 `Map<回执单号, 实例>` 供打印链路读（旧版 `Ql`/`Rl`）；
顺带补 §3.6 的查单号高亮 + 800ms 滚动居中，并改掉 `Home.vue:2110-2117` 那段已过时的注释。

### 3b：列定义 / 单元格 / 行级编辑态搬进组件

`columns` prop 消失，改为组件按 `kind` 内部生成。终态：

| | 行数 |
|---|---|
| `app/src/views/Hui.vue` | 4041 → **2406** |
| `app/src/components/DetailLinesTable.vue` | **1346**（新） |
| `app/src/composables/useOrderLines.ts` | **804** |
| `app/src/utils/detailOptions.ts` | 45（新，静态选项枚举，两处共用） |

**留在页面、经 `hooks` 注入的 9 个回调**：`openSquareDialog` / `openAddMarkup` /
门图三件套 / `previewImage` / `calcSingleRow` / `onSelectChange`（勾选计数**跨两表共用一个**，
旧版也如此）/ `lineInputOf`（行级保存要发完整行）。

**组件化时的机械改写**（全部列进 `hui-extract-movecheck.mjs` 的 `COMPONENT_REWRITES`，
共 18 条）：`pingColVis`/`diaoColVis` → `props.colVis`、`orderId.value` → `props.savedOrderId`、
`lines.value` → `props.engine.lines.value`、`order.client_name` → `props.client.name`、
`checkboxTick.value++` → `props.hooks.onSelectChange()` 等。
另为 `useOrderLines` 增加了 **`lines` 的透出**（旧版 `It` 要跨两表找当前编辑行，只拿本表 rows 找不到）。

**3b 的验收**：

- **`hui-extract-movecheck.mjs` 扩展到两轮**：引擎 47/47、**组件 51/51 逐字一致**。
  ⚠️ 组件那轮用的是**过渡期参照** —— 步骤 1/2/3a 当时还没提交，`HEAD` 对被那三步动过的函数是过期的
  （`opsCol`/`rowClassName` 在步骤 2 改过、`pingCols` 在 3a 改过），所以拿 3b 动手前切出的快照当参照。
  **等 1–5 步提交后 `HEAD` 即成为正确参照**，那个快照可弃（脚本找不到时会退回过期会话并打印提示，不静默放过）。
- 该守卫**做过变异测试**：反转 `cellError` 的 `profile` 判定、反转 `recomputeDirty` 的比较，
  两次都精确报红到具体行。
- CSS 差分台仍 **526 条全等**（3b 不动 CSS）。
- `vue-tsc` + `npm run build` ✅；五件回归脚本全绿。

### 3b 的确切方案（未开始）

**搬进组件的行段**（Hui.vue 当前行号，2026-09-19 快照）：

| 段 | 行 | 内容 |
|---|---|---|
| A | 1442–1703 | 单元格：`wallThicknessCell`/`glassSelectCell`/`CELL`/`cellError`/`tCell`/`isRedNum`/`intCell`/`moneyCell`/`optCell`/`profileCell`/`colorCell`/`trackCell`/`casingCell`/`hardwareCell` + 洞尺选项常量 |
| B | 1704–1718 | `selCol` |
| C | 1756–1781 | `partsTooltip`（算料 tooltip） |
| D | 1782–1925 | **行级编辑态全套**（EditState / pingEdit / diaoEdit / rowKeyOf / editOf / stripForDirty / recomputeDirty / isEditing / isDirty / confirmLeaveDirtyRow / enterEdit / cancelEdit / saveRow） |
| E | 1926–1966 | `opsCol` |
| F | 1967–2061 | `sqCell` / `amountCell` / `remarkCell` / `markupSelectCell` / `markupCol` |
| G | 2178–2211 | `doorImgCell` |
| H | 2233–2269 | `cCol` / `sub` / `DOUBLE_DING_OPTS` / `orderNoCell` / `moneyCell_2` / `doorImgCol` |
| I | 2270–2549 | `pingCols` / `diaoCols` |
| J | 2550–2584 | `rowKey` / `rowClassName` / `rowPropsOf` / `pingColumns` / `diaoColumns` |

**留在页面的**（组件通过 props 注入）：

- `checkboxTick` / `selectedLines` / `batchDeleteRows`（1722–1755）—— **跨两表共用一个计数**，
  组件只收 `selectedCount`，勾选变更 emit 回页面（旧版也是两表共用一个 tick）。
- 门图页级弹窗态 + `applyDoorImg`/`pickDoorImg`/`removeDoorImg`/`openTextImg`/`confirmTextImg`（2062–2112）
- `calcSingleRow`（2129–2177，要 `loadFormulaImages` + `openTemplatePreview`，属 §3.5 那条）
- `hydrateRowImages`（2212–2232，`loadOrder` 要调）
- `openSquareDialog`（2591）、`openAddMarkup`（加价弹窗）

**props 收窄后**（`columns` 消失，改为组件按 `kind` 内部生成）：

```ts
kind: 'ping' | 'diao'
rows: Line[]
colVis: Record<string, boolean>
client: { name: string; code: string }
engine: OrderLines              // useOrderLines 的返回
savedOrderId: number | null
selectedCount: number
filling: boolean
hooks: {                        // 页面回调，共 ~9 个
  openSquareDialog(l): void
  openAddMarkup(l): void
  pickDoorImg(l): void
  removeDoorImg(l): void
  openTextImg(l): void
  previewImage(url: string): void
  calcSingleRow(l): void
  onSelectChange(): void        // checkboxTick++
  lineInputOf(l): OrderLineInput
}
```

`rowKey` / `rowClassName` / `rowPropsOf` / `pingColumns` / `diaoColumns` / `scrollX`(2000/2200) 都变成组件内部。

**3b 的验收**（与 3a 同规格）：

1. `hui-extract-movecheck.mjs` **扩展到覆盖 `DetailLinesTable.vue`** —— A–J 十段逐字比（这是本步的核心验收）。
2. CSS 差分台不变（3b 不再动 CSS）。
3. `vue-tsc` + **`npm run build`**（3a 的教训：`vue-tsc` 是盲区，以 build 为准）。
4. 五件回归脚本全绿。

### 3a：抽「表格外壳」到 `components/DetailLinesTable.vue`

**把 3 拆成 3a/3b** 是因为这一笔太大（~1000 行 + 一个约 15 员的接口），一次做完中途出错会留下半截树。
3a 只搬**模板 + 那 ~220 行表格 CSS**；**列定义/单元格仍在 Hui.vue**，由 `columns` prop 传进来。
3b 再把列与单元格搬进去，接口随之收窄。

搬走的东西：两个 `<section class="table-wrap">`（表头按钮 / 表格 / 表尾「添加行」）+ 8 段 CSS
（单元格 `:deep` 组、`.table-head`、`.table-wrap`/`.table-footer`、按钮配色、表格密度大组、
`unsaved-row`/`highlight-matched-order`/`red-number-input`/`image-cell2`/`direction-image`）。

⚠️ `.grow-spacer` **在页面里也用了**（顶部工具栏），所以在组件内**重复了一份**（scoped 样式不跨组件）。

**3a 的验收 —— 核心是那台「CSS 产物差分台」**（这步最大的风险就是「规则静默不命中」）：

- 搬迁前后各构建一次，把产物 CSS 的 `data-v-*` **剥掉**（拆成两个 SFC 后 scope id 会重新编号，
  不剥就是 137 条假差异），比**规则多重集**：**526 → 526，逐条一致，0 消失 0 新增**。
- 该守卫**做过变异测试**：删掉 `.unsaved-row` 那条粉底规则，立刻精确报出
  `.table-wrap[S] .n-data-table .unsaved-row .n-data-table-td{background:#ffe6ef}` 消失。
- `vue-tsc --noEmit` ✅；`npm run build` ✅。
  ⚠️ 过程里 `vue-tsc` **又是盲区**：3a 首轮 `vue-tsc` 全绿而 `build` 报
  `Unexpected }` —— 我按行段切 CSS 时把两条规则的收尾 `}`（原 `3409` / `3608`）切在区间外，
  还把一段注释块切成两半（`/*` 去了组件、` */` 留在页面）。
  **教训：按行号切 CSS 必须核对每段末尾是不是完整的 `}`，并以 build 为准，不能以 `vue-tsc` 为准。**
- 回归全绿：`hui-extract-movecheck` 47/47、`hui-engine-logiccheck` 56/56、
  `hui-row-save-check` 10/10、`lineno-logiccheck` 21/21、`print-lineno-check` 24/24。

**第 2 步（行级保存）—— ⚠️ 动手前发现 §3.3 的立项**不完整**，实际范围比它写的大**

§3.3 原写「补一个『保存』按钮」，读完旧版发现行级保存**嵌在一整套「行级编辑态」里**，
只加按钮两边都不像。用户 2026-09-19 拍板「完整照旧版补」。实际补的是：

| 件 | 旧版 | 本版 |
|---|---|---|
| 编辑态 Map | 平开 `ht`(`:1335`) / 移门 `xe`(`:3770`) | `pingEdit.editing` / `diaoEdit.editing` |
| 快照 | `pt` / `ae` | `pingEdit.snapshot` / `diaoEdit.snapshot` |
| 脏集合 | `vt` / `_e` | `pingEdit.dirty` / `diaoEdit.dirty` |
| 点单元格进入编辑态 | `@cell-click: kt`（`:1401`） | `row-props` 的 onClick（naive-ui 无 cell-click 事件） |
| 脏判定 | `Et`(`:1343`) / `ne` | `recomputeDirty` |
| 切行守卫 | `It`(`:1362`)「未保存提醒 / 保存并切换」 | `confirmLeaveDirtyRow` |
| 保存 | `Ut`(`:1428`) / `fe`(`:3860`) → `updateRowData` | `saveRow` → `PUT /orders/{id}/lines/{line_id}` |
| 取消 | 快照 `Object.assign` 回滚 | `cancelEdit` |
| 行类 | `unsaved-row` = **脏** | 同左（**语义改了**，原写「行没有 id」） |

**两处必须说明的处置**：

- **「剔内部键」清单没有照抄**。旧版 POST 前剔
  `["平开门","门花图","开向图","errorFields","imageUrl","isSelected","生产进度"]`；
  换成我们的字段名后，`开向图`/`imageUrl`/`生产进度` 恰恰是**要落库的列**
  （`open_img`/`image_url`/`progress`），剔了会把它们抹空。⇒ 我们**只剔 `isSelected`**。
- **「每次点单元格都重拍快照」照抄了**。旧版 `kt` 每次点击都 `pt[key]={...row}`，
  后果是「取消」只回滚到**最后一次点击**那一刻，而非进入该行编辑那一刻。
  ⚠️ **是否算旧版缺陷未确认**，此处照抄并记在 §7。

**第 2 步的验收**：

- `vue-tsc --noEmit` ✅ 零错；`npm run build` ✅。
- **`docs/home-audit/hui-row-save-check.mjs`：10/10**，打真后端：
  ① 改一个字段 → 发完整行 → 重新拉取 → **除改的那个外逐字段不变**（含 `progress`/`install_address` 没被抹空）；
  ② **故意发部分字段 → 断言其余列真的被抹空** —— 这条不是缺陷报告，是**护栏**：
     `client.ts` 那句「必须发完整行」原来只是从源码读出来的，现在被测住了。
     前端侧的对应保障是 `lineInputOf(l): OrderLineInput` 的**类型**（全字段必填，`vue-tsc` 绿即为证）。
- 回归：`hui-extract-movecheck` 47/47、`hui-engine-logiccheck` 56/56、`lineno-logiccheck` 21/21、
  `print-lineno-check` 24/24、`hui-save-clobber-check` 通过。

**第 1 步（抽 `useOrderLines.ts`）的验收**：

- `Hui.vue` 4041 → **3439** 行；新增 `app/src/composables/useOrderLines.ts` **801** 行。
- `npm run typecheck`（`vue-tsc --noEmit`）✅ 零错。
- `npm run build` ✅ 通过（bundle 2,634.52 kB → 2,636.05 kB，+1.5 kB 来自模块边界与注释）。
- **`docs/home-audit/hui-extract-movecheck.mjs`：47 个搬迁件归一化后逐字一致。**
  这是本步的核心验收 —— 光靠 build 绿证明不了语义没变（少一个 `?? 0`、`Math.max` 写成 `Math.min` 都照样过编译）。
- 该守卫**做过变异测试**：把 `computeAmount` 的 `Math.round` 改成 `Math.floor`、删掉 `singleArea` 的钻石型分支，
  两次都精确报红到具体行；还原后回到 47/47。
- **`docs/home-audit/hui-engine-logiccheck.mjs`：56 条行为断言全过**（不依赖后端）。
  搬迁用源码级证明，这个脚本补行为级 —— 源码一致但接线接错（例如 `formulas` 传成了别的 ref）只有它能抓到。
  同样做过变异测试：`computeSquare` 的「自定义方数覆盖」回退成旧版的「下限」语义 → 报红。
  ⚠️ 过程里发现**守卫自身有个洞**：扇数正则是 `(\d+)\s*扇`，但夹具全是单位数（真实 `FANS` 也确实没有两位数），
  把它改窄成 `(\d)` 时**测试不报错**。已补一条两位数断言（该值不在真实 `FANS` 里，是故意加的），再测得红。

---

## §5 `seal_board` 恒真死闸门 —— 已回旧版核实

**问**：`Hui.vue:2943` 用 `colVis(diaoColVis, 'seal_board')` 做闸门，但 `seal_board` 不在 `DIAO_VIS_KEYS`
（`:950-974`）里 ⇒ 恒 `true`。是有意还是漏加？

**答：旧版移门表根本没有这个键。**

移门的列显隐来自 `userData.registrant.diao_column`（`Hui.formatted.js:4313`，
`DIAO(410)="registrant"` / `DIAO(325)="diao_column"`，切源码解出），
渲染里全部的闸门只有 8 处：

| 行 | 键 |
|---|---|
| `:5128` | 洞尺 |
| `:5175` | `l(442)` |
| `:5188` | 五金 |
| `:5335` | `l(142)` |
| `:5348` | `l(192)` |
| `:5361` | 单双丁 |
| `:5383` | 计价方式（`DIAO(324)`） |
| `:5396` | 打折 |

**没有「封板高」**——旧版移门的封板高并进「亮窗信息」列内、无独立闸门。

⇒ 我们那句因键不存在而恒真，**行为上与旧版一致**，是**无害的死代码**。
**处置：原样保留 + 加注释写明「旧版无此键，恒真，等价于无闸门」**。
**不要**把它加进 `DIAO_VIS_KEYS` —— 那会**新增**一个旧版没有的开关，属行为偏离。

> ⚠️ **顺手发现（不在本次范围）**：我们的 `PING_VIS_KEYS`(22) / `DIAO_VIS_KEYS`(23) 比旧版实际闸门数
> （平开 7 / 移门 8）**多得多**。可能是从后端 `registrant.*_column` 对象枚举来的（该对象可能含
> 比渲染闸门更多的键），也可能是有意加的。**未核实**，另立一条待查。

---

## §6 必须原样跟走的雷（漏一条就是静默回退）

| # | 雷 | 位置 |
|---|---|---|
| 1 | CSS 那 ~230 行 `:deep()` —— 这些 vnode 在 NDataTable 的 render 回调里建，靠祖先 `data-v` 命中；搬进子组件后祖先变了，**整段不搬就全部失效**（格子变宽松、字号回 14px、蓝标签 `#1302fa` 丢、未保存行不粉、开向图撑爆格子） | `Hui.vue:3635-3690/3780-3820/3830-3908/3974-4016` |
| 2 | 「文字传图」按 Enter 弹「删除门图」—— `doorImgCell` 里两个 vnode 的 `key` 不能省（commit `f362c4ab` 刚修的就是它） | `Hui.vue:2593-2606` |
| 3 | `checkboxTick` / `selectedLines` **跨两表共用** —— 拆成两个实例后各持一份，A 表勾选不会刷新 B 表头「批量删除(N)」 | `Hui.vue:2317/2320` |
| 4 | `colorOptions` **遍历全表 `lines.value`** —— 只传本表 rows 会让另一表已录颜色掉出候选 | `Hui.vue:1401-1414` |
| 5 | `partsEngine` 必须**同一实例** —— 再 `createPartsEngine` 一份会让 `isDiamond`/候选/算料分歧 | `Hui.vue:1527` |
| 6 | `fillLineNumbers` 按钮**只有平开表有** | `Hui.vue:96-98`（移门块没有） |
| 7 | `scroll-x` 两表不同（2000 / 2200） | `Hui.vue:110/133` |
| 8 | `lineRefresh` 的兜底语义：`partsCache.delete(l)` 必须在**每个**字段变更后无条件执行（该文件注释点名「洞尺/单双丁」栽过） | `Hui.vue:1837-1841` |
| 9 | `pingCasingOptions` 的合并顺序（`casingKindOptions` 前、`partsTrackOptions` 后，靠 `seen` 去重） | `Hui.vue:2248` |
| 10 | 移门「单价」列的生产进度 tooltip 每次 render 新建，别改共享实例 | `Hui.vue:2857-2864` |
| 11 | 移门列集里有一个 **`key:11` 的重复「客户」列**（旧版笔误，疑似） | `detail-sfc-recon.md` §6.1 |

---

## §7 前提与不确定

- §1/§2 的接口面全部来自**切源码实跑解码器**，另有 `detail-sfc-recon.md` 的逐字核对。
- ⚠️ **`legacy/js/Hui.formatted.js` 是存在的**（13436 行）—— 本次过程中一度因 shell cwd 串了而误判
  「文件不存在」，差点绕远路。后续逆向优先用它（行号口径与项目既有引用一致）。
- ✅ **`Line`（`partsEngine.ts:30`）与 `OrderLineDto`（`api/types.ts:109`）字段已逐条核过，结构兼容**
  —— 这就是第 5 步的硬前置，已解除。逐字段比对：50 个字段里 **45 个名字与类型完全一致**，
  差异只有四处，且都不阻碍复用：

  | 字段 | `Line` | `OrderLineDto` | 处置 |
  |---|---|---|---|
  | `id` | `number \| null`（未保存行为 null） | `number` | 组件内部自己产生未保存行，接收侧只需放宽 |
  | `line_type` | `'ping' \| 'diao'` | `string` | 收窄 |
  | `parts` / `markup` | `PartPreview[]` / `MarkupItem[]` | `unknown`（落库是 JSON） | 需归一化 —— `useOrderPrint.ts:104` 的 `toLines()` **已经有一份现成的**（`Array.isArray(x) ? x : []`），直接复用 |
  | `row_index` | 无 | 有 | 组件用不到，忽略 |

  `line_no` / `custom_square` / `isSelected` 三个都在（`isSelected` 在 `Line` 侧是可选、组件自持）。
- ⚠️ §5 末尾「我们的 VIS_KEYS 比旧版闸门多得多」的原因**未核实**。
- ⚠️ `detail-sfc-recon.md` 里给的部分行号（如「平开列定义从 `:1137` 起」）与当前文件对不上，
  该报告其余部分已抽查一致；引用具体行号前**以当前文件为准**复核。
- §3.3 的「旧版行级保存是唯一落库入口」依据是 `detail-sfc-recon.md` §5.1 的接口清单
  （两个 SFC 都只发 `updateRowData`/`deleteRow`/`changeSquare` 等行级写，无整单写）。
- §3.4 里 Home 的 `unselect` / `calculate-single-row` 两个回调在旧版 Home 的实现（`kn`/`Pn`、`In`/`Un`）
  **只读到入口，未整段读完** —— 接线前要按项目规矩「先整段读完再改」。
- ⚠️ **旧版 `Home.formatted.js:7852` 的 `o.tableData.value = []`（灌数据前清空）疑似无效** ——
  expose 出来的 ref 经 Vue 的 `proxyRefs` 解包，`inst.tableData` 拿到的已是数组本体，
  再 `.value = []` 打不到数组上（同处的 `:7858` `addRow` 与 `:8915-8921` Hui 侧直接
  `tableData.splice(...)` 都印证「拿到的是本体」）。**新版别照抄这句**，用 `splice`。
  ⚠️ 未实测，小分队 A 只做了静态推断。
- ⚠️ **新旧数据结构不同构，不能机械迁移**：旧版是**两个独立行数组**（`ue` / `Z`），
  新版是**一个 `lines` 数组按 `line_type` 过滤**。`isImporting`（抑制 watch）、
  `markRowsPersisted`（已落库集合）、`selectedExtraItems`、选中集 `ping_hui`/`diao_hui`
  这些**按数组划分**的语义，在单数组模型下要重新定义归属（按 `line_type` 切，还是整表一份）。
  **这是拆分设计里最需要先想清楚的一条**，别到写代码时才发现。
- ⚠️ 小分队 A 把「3D 入口平开/移门是两套不同函数，必须分派」列为硬点 —— 与 §3.1 的差异表一致，
  已记。

### 补记 2026-09-19（二）：两条预览面收敛成一个

用户指出「预览一个就行 这个重复了」。原先两套并存：

| | Hui（自绘） | Home（`PrintPreviewDialog`） |
|---|---|---|
| 面 | `templatePreviewOpen` 弹窗（1040px） | 打印预览弹窗（1180px，带该单据操作栏） |
| 模板 | **有下拉**，可切任意模板 | 固定 `mode` |
| 渲染 | 自己 `renderTemplatePreview` + `v-html` | `loadPrintPrereqs` + `buildBatchPayload` + `renderByMode` |

**收敛方向**：按用户拍板「直接用 home 那个」——保留 `PrintPreviewDialog`，
给它补一个可选的模板下拉（`:templates`，**不传则行为完全不变**），
删掉 Hui 自绘那套（弹窗模板 + `renderTemplatePreview` + `printCurrentTemplate` + `templatePreviewHtml`）。

**两个要点**：

- `PrintPreviewDialog` 新增内部 `currentMode`：默认跟着 `props.mode` 走（Home 一直如此），
  给了 `templates` 才能被下拉切换；`props.mode` 一变就同步回来 —— 保证「父组件说了算」。
- Hui 那条路传 **`auto-line-numbers: false`**：Hui 从不补行级单号（旧版也是，它有独立的
  「填入单号」按钮）。同 §5c 那条副作用的处置。

**踩到一次已知盲区**：`PrintPreviewDialog` 在模板里用了却**忘了 import**，而
`vue-tsc --noEmit` **没报**（memory `vue-tsc-blind-spot`：抓不到缺失的 `.vue` 导入）。
补上后 build 才真正可信。**这一步又一次说明：以 `npm run build` 为准，不以 `vue-tsc` 为准。**

验收：`vue-tsc` + `build` 绿；五件回归全绿。Hui.vue 2176 → 2164。
