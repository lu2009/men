# 旧版两张明细子表 SFC 逆向报告（`Ping_hui` / `Diao_hui`）

> 只读逆向，未改动任何生产代码。所有结论都附「文件:行号」或切出来的源码原文。
> 切件脚本在 `/tmp`（`hui-extract.mjs` / `offmap.mjs` / `q.mjs`），仓库内没有新增脚本。
>
> **行号口径**：正文统一用 `Hui.formatted.js:NNNN`（项目既有引用习惯，该文件由
> `legacy/deobfuscate-hui.mjs` 生成、行号与旧版对齐）。括号里另给 `raw@NNNNNN`，
> 是**原始 chunk** `legacy/js/Hui-d088417c.js` 的字符偏移，便于 `indexOf` 精确定位。

---

## 0. 结论速览

| 项 | 平开 `Ping_hui` | 移门 `Diao_hui` |
|---|---|---|
| 组件变量 | `_0x5a7707`（`Hui.formatted.js:571`） | `_0x4d18bf`（`:3566`） |
| 导出名 | `_0x148cac`（`export{... _0x148cac as _ ...}`） | `_0xf4057`（`... _0xf4057 as a ...`） |
| scoped id | `data-v-a854303f`（`:2820`） | `data-v-6d3802`（`:5570`） |
| 行数组初值 | `ue = ref([])` —— **空**（`:903`） | `Z = ref([R()])` —— **自带一条空行**（`:3743`） |
| props | 7 个（含 `addPriceItems`） | 6 个（**无 `addPriceItems`**） |
| emits 声明 | `update:showPingkai` / `refresh` / `unselect` / `calculateSingleRow` | `update:showDiao` / `update:showCheckbox` / `refresh` / `unselect` / `calculateSingleRow` |
| defineExpose | 16 个 | 19 个 |
| **自己 fetch 明细行？** | **否** | **否** |

**三条最要紧的结论：**

1. **两个 SFC 都不自己拉明细数据。** 行数据完全由父组件灌进来（`addRow`）或直接改
   `tableData` 数组。组件自己只发**行级**写请求（`updateRowData` / `deleteRow` /
   `changeSquare`）。父组件才是数据源（Home 走 `param1=detail`，Hui 页走自有流程）。
2. **`add-price-items` 是个死绑定。** 平开虽声明了这个 prop 却从不读它（用的是自己
   `useAddPriceItems()` 的实例）；移门连声明都没有。两个表各持一份独立的加价项目表。
3. **`update:showXxx` 不是「只在删最后一行时 emit false」。** `removeFirstRow()` 的
   **两个分支都会 emit**：删完为空 → `false`，否则 → `true`。另外「删除行」按钮在删空时
   也会 emit `false`。详见 §3。

---

## 1. 怎么切出来的（可复现）

`Hui.formatted.js` 只替换了具名解码器，**组件内单字母解码器（`a()/t()/x()`）没替换**
（该文件头部注释就写明这一点）。所以直接读会读错。这次的切法：

1. `legacy/js/Hui-d088417c.js` 里 `_0x5a7707=Vue.defineComponent({` / `_0x4d18bf=Vue.defineComponent({`
   起做花括号配平（认识字符串/正则/注释），切出整个组件体；
2. 组件体内做**多轮闭包**收 `const X=Y` / `,X=Y`，把单字母名解析回解码器；
   **同名指向两个不同解码器就报错**（本报告两个组件都**无冲突**，即全组件只有一个解码表：
   平开 `_0x2d32`（别名 `_0x4017e5`）、移门 `_0x309a`（别名 `_0x11aa97`）——
   所以全局正则替换在本例中是安全的）；
3. 替换后又发现 `Z` / `U` 各 1 处没解析（不是解码调用，是普通函数调用），其余全命中。

顺带把「原始 chunk 偏移 → `Hui.formatted.js` 行号」的映射也建了出来，并**逐字节校验**过
（重跑 `deobfuscate-hui.mjs` 的两步替换 + 美化，结果与 `Hui.formatted.js` 完全一致）：

```
✅ 重跑结果与 Hui.formatted.js 逐字节一致，行号映射可信
_0x5a7707 @raw 30383 → line 571
_0x4d18bf @raw 142114 → line 3566
highlight-matched-order @raw 54079 → line 1355
```

> ⚠️ 过程中踩过一个坑，记下来免得复现：美化函数里有 `i += 2` 的跳步分支
> （`};` / 字符串转义 / 注释），会让「输出偏移映射表」留下**没赋值的洞**，
> 洞被当成 0 就会把行号算到第 4 行。补齐后映射是严格单调的（全量抽查 0 个非单调点）。

---

## 2. props 完整清单

### 2.1 平开 `Ping_hui`

原文（`Hui.formatted.js:572-588`，`raw@30496` 起）：

```js
__name:"Ping_hui",props:{
  selectedDate:{type:Date,default:()=>new Date},
  oderColumn:{type:Boolean,default:!1},
  showCheckbox:{type:Boolean,default:!1},
  disableEditing:{type:Boolean,default:!1},
  customerInfo:{type:String,default:""},
  addPriceItems:{type:Array,default:()=>[]},
  highlightOrderQuery:{type:String,default:""}
},emits:["update:showPingkai","refresh","unselect","calculateSingleRow"]
```

| prop | 类型 | 默认 | 必填 | 组件内实际读没读 |
|---|---|---|---|---|
| `selectedDate` | Date | `() => new Date` | 否 | 读了（作为回执日期初值） |
| `oderColumn` | Boolean | `false` | 否 | 读了（表格列 `oderColumn`，`:11311` 由 Home 传 `jo.value.has(回执单号)`） |
| `showCheckbox` | Boolean | `false` | 否 | 读了（`:1727` `{"with-checkbox":e["showCheckbox"]}`、`:1746` 决定出不出勾选列） |
| `disableEditing` | Boolean | `false` | 否 | 读了（控制输入框是否可编辑） |
| `customerInfo` | String | `""` | 否 | 读了（`addRow` 里给新行补客户名） |
| `addPriceItems` | Array | `() => []` | 否 | **没读 —— 死 prop**（见下） |
| `highlightOrderQuery` | String | `""` | 否 | 读了（`:1355`，见 §7） |

**`addPriceItems` 是死 prop，这条是逐字核过的。** 在整个组件体（含 render）里，字符串
`addPriceItems` 只出现 **2 次**：一次是上面的 props 声明，一次是解构
`useAddPriceItems()` 的返回值：

```js
// Hui.formatted.js:1217 / raw@50065
},{addPriceItems:nt,addPriceItem:dt,removePriceItem:rt,updatePriceItem:st}=useAddPriceItems(),
   {verifyPassword:ut}=usePasswordVerify(),it=Vue.ref([]),ft=Vue.ref({}),Vt=Vue.ref({}),bt=e,
```

`bt = e`（`e` 是 setup 的 props 形参）→ `bt` 就是 props 对象，`bt["highlightOrderQuery"]` 之类
都走它；但从头到尾没有 `bt["addPriceItems"]` 也没有 `e["addPriceItems"]`。
模板里用的加价项目表是 `nt.value`（composable 的）。

### 2.2 移门 `Diao_hui`

原文（`Hui.formatted.js:3567-3581`，`raw@142190` 起）：

```js
__name:"Diao_hui",props:{
  selectedDate:{type:Date,default:()=>new Date},
  showCheckbox:{type:Boolean,default:!1},
  disableEditing:{type:Boolean,default:!1},
  customerInfo:{type:String,default:""},
  oderColumn:{type:Boolean,default:!1},
  highlightOrderQuery:{type:String,default:""}
},emits:["update:showDiao","update:showCheckbox","refresh","unselect","calculateSingleRow"]
```

| prop | 类型 | 默认 | 必填 | 备注 |
|---|---|---|---|---|
| `selectedDate` | Date | `() => new Date` | 否 | |
| `showCheckbox` | Boolean | `false` | 否 | |
| `disableEditing` | Boolean | `false` | 否 | |
| `customerInfo` | String | `""` | 否 | |
| `oderColumn` | Boolean | `false` | 否 | |
| `highlightOrderQuery` | String | `""` | 否 | |

**移门没有 `addPriceItems` prop。** 它用的是自己 `useAddPriceItems()`：

```js
// Hui.formatted.js:3584-3590 / raw@142113+
const x=_0x11aa97,{addPriceItems:_,addPriceItem:l,removePriceItem:o,updatePriceItem:c}=useAddPriceItems(),
  {verifyPassword:n}=usePasswordVerify();
```

### 2.3 `add-price-items` 两处传参确认：**是同一个值**

Home 侧模板（`Home.formatted.js:11311` / `:11316`，`raw` 里是同一段）：

```js
// 平开
Vue.createVNode(l,{
  ref:t=>((e,t)=>{const l=g; e&&Ql["value"]["set"](t,e)})(t,e[s(1472)][s(467)]),
  "v-model:showPingkai":uo(e.row[s(467)],"ping"),
  "add-price-items":ro.value,           // ← 平开：ro.value
  showCheckbox:!0,
  oderColumn:jo[s(755)][s(907)](e[s(1472)]["回执单号"]),
  "disable-editing":sl[s(755)],
  "highlight-order-query":po[s(755)],
  onRefresh:vo,onUnselect:kn,onCalculateSingleRow:In
},...)
// 移门
Vue.createVNode(o,{
  ref:t=>((e,t)=>{const l=g; e&&Rl.value["set"](t,e)})(t,e[s(1472)][s(467)]),
  "v-model:showDiao":uo(e[s(1472)][s(467)],"diao"),
  "add-price-items":ro[s(755)],         // ← 移门：ro[s(755)]
  showCheckbox:!0,
  oderColumn:jo[s(755)].has(e[s(1472)][s(467)]),
  "disable-editing":sl[s(755)],
  "highlight-order-query":po[s(755)],
  onRefresh:vo,onUnselect:Pn,onCalculateSingleRow:Un
},...)
```

`s` 是**渲染函数里的局部别名**，指向 Home 的主解码表 `dr`：

```js
// Home.formatted.js:11995 一带所在的渲染函数开头（raw Home @464240）
(c,t)=>{const s=g, V=Vue.resolveComponent(s(1129)), ...
```

而 `dr(755) = "value"`、`dr(467) = "回执单号"`（`legacy/home-map.json`，`legacy-slice.mjs`
的 `assertDecoder()` 就是拿 `dr(755)==="value"` 做自检的）。

> ⚠️ 注意：Home 的模块级 import 里 `s` 是 `shouldUseNewSizeFormat`（Hui 的导出
> `shouldUseNewSizeFormat as s`），**那个是账户名判断的真函数**，不是解码器；
> 这里能当解码器用是因为渲染函数内 `const s=g` 把它**遮蔽**了（`raw Home @464240`）。
> 差点读错，记一笔。

**结论：`ro[s(755)] === ro.value === ro.value`，两个绑定是同一个值。**

### 2.4 传给组件但**不是 props** 的东西

下面这些在 Home/Hui 的模板里传了，但两个组件都**没声明**，属于 attrs：

| 传的 | 谁传 | 说明 |
|---|---|---|
| `v-model:showPingkai` / `showPingkai` | Home `:11311`、Hui `:13103` | 不是 prop，只在 emit 侧生效 |
| `v-model:showDiao` / `showDiao` | Home `:11316`、Hui `:13105` | 同上 |
| `height` | **只有 Hui 页** `:13103` `"calc(100vh - 20px)"` / `:13105` | 不是 prop |
| `class:"pingkai"` / `"diao_hui"` 等 | Home `:11307`/`:11312`、Hui `:13103`/`:13105` | 不是 prop |
| `add-price-items` | 两边都传 | 见 §2.1/§2.2 —— 平开有 prop 但不用，移门没 prop |

两个组件的 render 都是**多根节点**（最后一段是
`]), Vue.createBlock(Vue.Teleport,{to:"body"},[...])` ＋前面若干 `el-dialog`，
见 `/tmp/pingkai.pretty.js` 末尾），且都**没有 `inheritAttrs:false`**。
多根 + 未声明 attrs ⇒ Vue 不会自动继承，这些多余绑定**既不落到 prop 也不落到 DOM**，
只在开发模式打一句 warning。（即新旧实现里都是纯粹的无效绑定。）

---

## 3. emits 完整清单 + 触发时机（含「`update:showXxx` 只在删最后一行时 emit false」的复核）

### 3.1 全部 emit 调用点（`Hui.formatted.js` 行号）

平开（emit 别名为 `Lt`；`:1512` 处 `const Pt=Vue.ref([]),Lt=a,St=e=>{`，`a` 就是 setup 的 emit）：

| 行 | 调用 | 触发场景 |
|---|---|---|
| `:1451` | `Lt("refresh")` | 单行「保存」成功（`updateRowData` 返回 200）之后 |
| `:1521` | `Lt("unselect", e)` | 行从选中变未选中：`St()` 里 `Pt.splice` 之后，把整行 payload 带出去 |
| `:1572` | `Lt("update:showPingkai", false)` | `removeFirstRow()` 且表已空 |
| `:1572` | `Lt("update:showPingkai", true)` | `removeFirstRow()` 且表还有行 |
| `:1781` | `Lt("update:showPingkai", false)` | 「删除」按钮把最后一行删掉（`0===ue.value.length &&`） |
| `:1783` | `Lt("refresh")` | 「删除」成功、提示「删除成功」之后 |
| `:1807` | `Lt("refresh")` | 「复制」成功（把当前行复制成一条新行 push 进去）之后 |
| `:1880` | `Lt("calculateSingleRow", a)` | 「算料」按钮，且 `row.formulaid` 非空 |

移门（emit 别名为 `ht`；`:4321` 处 `const ht=a,vt=Vue.reactive([]),pt=e=>{`）：行号与语义**一一对应**：

| 行 | 调用 | 场景 |
|---|---|---|
| `:3882` | `ht("refresh")` | 单行「保存」成功 |
| `:4330` | `ht("unselect", e)` | 取消勾选 |
| `:4359` | `ht("update:showDiao", false)` / `(…, true)` | `removeFirstRow()` 空 / 非空 |
| `:4575` | `ht("update:showDiao", false)` | 「删除」删空 |
| `:4575` | `ht("refresh")` | 「删除」成功（**注意移门是先 emit `update:showDiao` 再 `refresh`**，平开是先 msgbox 再 `refresh`，顺序细节不同） |
| `:4601` | `ht("refresh")` | 「复制」成功 |
| `:4682` | `ht("calculateSingleRow", a)` | 「算料」 |

> 扫法：把组件体整个反混淆后，正则 `\b(Lt|ht)\("([^"]+)"` 全量列出，再无遗漏地检查了
> 有没有别的 emit 别名（`a("` 在两个组件体里**一次都没出现**——都被函数内的
> `const a=x` 遮蔽了）。所以上表就是**全部**。

### 3.2 `update:showPingkai` / `update:showDiao` 的复核

**「只在删掉自己最后一行时 emit `false`」这个说法不完整，需要改成两条：**

**(a) `removeFirstRow()` 无条件 emit，两个分支都发。** 原文逐字
（平开 `Hui.formatted.js:1570-1573`，`raw@59536`）：

```js
},isPersistedRow:Ve,directionImageMap:ve,material:O,addRow:be,removeFirstRow:()=>{
  const e=x,t=ue.value[e(468)](),a=fe(t);
  a&&ie[e(691)][e(383)](a),0===ue[e(691)][e(248)]?Lt(e(142),!1):Lt("update:showPingkai",!0)
},isImporting:Ot,allOpenDirections:B,openDirections:E,columnVisibility:_
```

同义（移门 `:4357-4360`，`raw@167749`）：

```js
},isPersistedRow:ee,addRow:te,removeFirstRow:()=>{
  const e=x,t=Z[e(416)][e(375)](),a=F(t);
  a&&$[e(416)][e(335)](a),0===Z[e(416)][e(129)]?ht("update:showDiao",!1):ht(e(137),!0)
},
```

即 `表格.length === 0 ? emit(false) : emit(true)`。**`true` 这一支不是「顺手」，它是
父组件导入流程依赖的**：Home 的 `Ro`/`Fo` 在灌完行后会调一次
`o.tableData.length > e.ping_hui.length && o.removeFirstRow()`（见 §4.3），
此时表非空 → emit `true`。

**(b) 「删除行」按钮在把最后一行删掉时也会 emit `false`。** 平开 `:1781`：

```js
// Hui.formatted.js:1779-1783
t[a(660)]&&await deleteImage(t[a(660)],String(t.id)),ue[a(691)][a(215)](e,1);
const _=fe(t);
_&&ie.value.delete(_),0===ue[a(691)][a(248)]&&Lt(a(142),!1),ElementPlus.ElMessage({
  type:"success",message:a(437)
}),Lt(a(205))
```
（`a(142)`＝`"update:showPingkai"`、`a(205)`＝`"refresh"`、`a(215)`＝`splice`、`a(248)`＝`length`。）

移门 `:4575` 同构。

**所以准确的说法是：`false` 有两个来源（`removeFirstRow` 后表空、删行后表空），
`true` 只有一个来源（`removeFirstRow` 后表非空）。**

### 3.3 声明的 emits 里有两个**永远不会发**的

- **移门 `update:showCheckbox`**：在 emits 数组里（`:3581`），但全组件没有一处 emit 它
  （上面全量扫描里没有）。**死事件。**
- `refresh` 在 Hui 页里没人监听（Hui 只传 `ref` / `customer-info` / `selected-date` /
  `add-price-items` / `disable-editing` / `showPingkai|showDiao` / `onCalculateSingleRow`，
  见 `:13103-13106`）——即**在 Hui 页里 `refresh` / `unselect` 是空转**，只有 Home 接了。

---

## 4. defineExpose 完整清单 + 调用点

### 4.1 平开（`Hui.formatted.js:1547-1574`，`t({...})`，`raw@61322`）

切出来的原文（已反混淆；`t` 是 setup 的 `expose`）：

```js
t({
  ping_hui: Pt,
  selectAll: () => {
    Vue.nextTick(() => { const e=_0x2d32; ue.value.forEach(t => { t.isSelected=!0, St(t) }) }),
    Pt.value = [...ue.value]
  },
  unselectAll: () => { Vue.nextTick(() => { const e=_0x2d32; ue.value.forEach(t => { t.isSelected=!1, St(t) }) }) },
  selectedExtraItems: ft,
  tableData: ue,
  clearTable: () => { const e=x; ie.value.clear(), ue.value = [se()] },
  markRowsPersisted: (e = ue.value) => { e.forEach(e => { const t=_0x2d32, a=fe(e); a && ie.value.add(a) }) },
  isPersistedRow: Ve,
  directionImageMap: ve,
  material: O,
  addRow: be,
  removeFirstRow: () => { /* 见 §3.2 */ },
  isImporting: Ot,
  allOpenDirections: B,
  openDirections: E,
  columnVisibility: _
})
```

**16 个成员**：`ping_hui` `selectAll` `unselectAll` `selectedExtraItems` `tableData`
`clearTable` `markRowsPersisted` `isPersistedRow` `directionImageMap` `material`
`addRow` `removeFirstRow` `isImporting` `allOpenDirections` `openDirections` `columnVisibility`。

### 4.2 移门（`Hui.formatted.js:4333-4361`，`raw@168699`）

```js
t({
  unselectAll: () => { Vue.nextTick(() => { Z.value.forEach(t => { t.isSelected=!1, pt(t) }) }) },
  diao_hui: vt,
  selectAll: () => { Z.value.forEach(e => { Vue.nextTick(() => { e.isSelected=!0, pt(e) }) }) },
  selectedExtraItems: rt,
  tableData: Z,
  clearTable: () => { const e=x; $.value.clear(), Z.value = [R()], rt.value = {} },
  markRowsPersisted: (e = Z.value) => { e.forEach(e => { const a=t, x=F(e); x && $.value.add(x) }) },
  isPersistedRow: ee,
  addRow: te,
  removeFirstRow: () => { /* 见 §3.2 */ },
  material: p,
  directionImageMap: v,
  isImporting: gt,
  doorsheets: I,
  openDirections: h,
  trackType: N,
  lineType: M,
  trackytypedata: $e,
  lineytypedata: Fe
})
```

**19 个成员**（**没有 `columnVisibility`、没有 `allOpenDirections`**）。

> 两处 `selectAll` **写法不一致**（不是同义改写）：平开的 `nextTick` 在 `forEach` **外面**，
> 且在 nextTick 回调之后再同步执行 `Pt.value=[...ue.value]`；移门的 `nextTick` 在
> `forEach` **里面**（每行一个 nextTick），且**不去写 `diao_hui`**。
> 结果差异：平开的选中集在 `selectAll()` 之后立即被整体覆盖成全部行；移门只能靠
> `pt()` 逐行累积。**实作时不能按「同一个底座」处理。**

### 4.3 谁在调（行号）

**Home**（`Ql` = `Map<回执单号, 平开实例>`、`Rl` = 移门实例；声明在
`Home.formatted.js:7650`）：

| Home 行 | 调用 | 说明 |
|---|---|---|
| `:7852` | `o.isImporting = true; o.tableData.value = []` | 灌数据前清空 —— ⚠️ 见 §10.1 |
| `:7858` | `o.addRow({...e})` | 逐行灌入（来自 `param1=detail` 的 `data.ping_hui`） |
| `:7859` | `o.markRowsPersisted(e.ping_hui)` | 标记为「已落库」 |
| `:7859` | `o.tableData.length > e.ping_hui.length && o.removeFirstRow()` | 多出来的空行删掉 |
| `:7860` | `o.isImporting = false` | |
| `:7871/7872/7873` | 同上，移门版 `Fo` | |
| `:7755/7757` `:7764/7766` | `selectAll()` / `unselectAll()` | 主表勾选联动 |
| `:7780` `:7825` | `unselectAll()` | 展开/收起时清选择 |
| `:7799` `:7808` | `selectAll()` | 拉完明细后恢复勾选 |
| `:9351/9352` | `unselectAll()` | 「订单已修改，请重新选择」时清空 |
| `:9361-9370` | 读 `s["ping_hui"]`（**暴露出来的选中集**） | 收集下单 payload：`(s.ping_hui||[]).forEach(...)` |
| `:9372-9380` | 读 `s["diao_hui"]` | 同上 |
| `:11334-11337` | `Ql.get(回执单号).markRowsPersisted()` / `Rl.get(...).markRowsPersisted()` | 「保存」成功后（`updateCustomerInfo` 200） |
| `:11310/11315` | `Ql.set(回执单号, 组件实例)` / `Rl.set(...)` | 模板 `ref` 回调登记实例 |

关键的 `:9361-9370` 逐字（说明 `ping_hui` / `diao_hui` 这两个暴露数组**是必用的**）：

```js
for(const[e,s]of Ql[n(755)][n(729)]()){          // Ql.value.entries()
  if(yo[n(755)])break;
  (s[n(701)]||[])[n(1034)]((e=>{                 // s["ping_hui"].forEach
    const t=n,l=e[t(467)],o=e[t(1074)];          // l=回执单号, o=isSelected
    V[t(897)](l)&&(... wn[l][t(701)][t(949)](e) ...),   // V.includes(l) → 收
    !V[t(897)](l)&&o&&(... wn[l][t(701)][t(949)](e) ...) // 否则看 isSelected
  }))
}
```

（`n(701)="ping_hui"`、`n(1179)="diao_hui"`、`n(467)="回执单号"`、`n(1074)="isSelected"`、
`n(729)="keys"`、`n(1034)="forEach"`、`n(949)="push"`、`n(897)="includes"`，
全部由 `docs/home-audit/legacy-slice.mjs` 的 `deobf` 解出。）

**Hui 页**（`_0x23e965` = 平开实例、`_0x1be4d9` = 移门实例）：用得**少得多**——
只有 `tableData`（`:8108`×2、`:8666`、`:8744`、`:8917`、`:8920`）、`clearTable`（`:8241`，两个实例各一处）、
`markRowsPersisted`（`:8867`，两个实例各一处）、`columnVisibility`（`:8692`，**只平开**）、`material`
（`:8692/8693` 平开 / `:8767/8768` 移门）、`directionImageMap`（平开 `:8703`、`:10745`、`:11295`、
`:11297`、`:11866/11868`；移门 `:8776/8778`、`:10948`、`:11560`、`:12126`、`:12557`）。

**Hui 页从不调** `addRow` / `removeFirstRow` / `isImporting` / `selectAll` / `unselectAll` /
`isPersistedRow` / `selectedExtraItems` / `doorsheets` / `trackType` / `lineType` /
`trackytypedata` / `lineytypedata` / `openDirections`（全量正则扫过，0 命中）。
其中 `doorsheets` / `trackytypedata` / `lineytypedata` 在**Home 里也一次都没出现**
——它们是移门 SFC **只给自己模板用**、但顺手 expose 出来的。

Hui 页怎么把行灌进去（`:8915-8920`）：

```js
if(_0x515a7c.value=!!(c["showPingkai"]&&(c["ping_hui"]?.length)>0),
   _0xcf05a4.value=!!(c.showDiao&&(c["diao_hui"]?.length)>0),
   await Vue.nextTick(),
   _0x515a7c["value"]&&_0x23e965["value"]&&(c.ping_hui?.length)>0){
  const e=_0x23e965["value"].tableData; e["splice"](0,e.length,...c["ping_hui"])
}
```

即**直接改 `tableData` 数组本身**（`splice`），而不是 `addRow`。
两者的区别很关键：expose 出来的 ref 会被 Vue 的 `proxyRefs` **解包**，
所以 `inst.tableData` 拿到的是**数组本体**，`splice` 有效。

> 证据（vendored Vue 运行时 `legacy/vendor/js/vue.min.js`）：
> ```js
> function iW(e){return e.exposed?e.exposeProxy||(e.exposeProxy=new Proxy(tP(tC(e.exposed)),
>   {get:(t,n)=>n in t?t[n]:n in ri?ri[n](e):void 0, has:(e,t)=>t in e||t in ri})):e.proxy}
> function tP(e){return tv(e)?e:new Proxy(e,tO)}   // proxyRefs
> function tC(e){return !w(e,"__v_skip")&&Object.isExtensible(e)&&ee(e,"__v_skip",!0),e}  // markRaw
> ```

---

## 5. 内部状态：SFC 自己持有什么，数据从哪儿来（最关键的一条）

### 5.1 行数据不在 SFC 里产生

```js
// 平开 Hui.formatted.js:903 / raw@39697
},ue=Vue.ref([]),ie=Vue.ref(new Set),fe=e=>{ ... e.id ... },Ve=e=>{ ... ie.value.has(a) ... }
// 移门 Hui.formatted.js:3743 / raw@150207
},Z=Vue.ref([R()]),$=Vue.ref(new Set),F=e=>{ const t=e?.id; return t==null?"":String(t).trim() },
```

- 平开 `ue = ref([])` —— **空表**，一条都没有。
- 移门 `Z = ref([R()])` —— **`R()` 造一条空白行**，所以移门表永远至少有一行。
  （这正好解释了 §3.2：移门 `removeFirstRow` 到 0 行才会 emit `false`。）

**两个组件都没有 `param1=detail` 请求。** 把两个组件体里所有
`https://www.samrtdoor.com.cn/1?param1=...` 抓出来：

| 平开有的 param1 | 移门有的 param1 |
|---|---|
| `saveCustomDirectionNames` | — |
| `changeDirectionMode` | — |
| `reverseDirection` | — |
| `getAddPrice` | `getAddPrice` |
| `getPingPrice` | `getDiaoPrice` |
| `initializPing` | `initializDiao` |
| `updateRowData` | `updateRowData` |
| `changeSquare` | `changeSquare` |
| `addAddPrice` | `addAddPrice` |
| `deleteRow` | `deleteRow` |

**没有一条是拉明细的。** 组件只做「行级写」和「取配置/取价」。

> Home 侧才是明细来源：`Home.formatted.js:7789`
> `fetch("https://www.samrtdoor.com.cn/1?param1=detail&param2="+ds+"&param3="+回执单号)`
> → `data.ping_hui` / `data.diao_hui` → `Ro`/`Fo` → `addRow` 逐行灌。

### 5.2 各组件自有的状态清单

**平开**

| 变量 | 定义行 | 是什么 |
|---|---|---|
| `ue` | `:903` | **行数组**（`ref([])`，父组件灌） |
| `ie` | `:903` | `ref(new Set)` —— **已落库行 id 集合**（`markRowsPersisted` 往里加，`isPersistedRow` 查） |
| `_` | `:591` | `ref({})` —— **列显隐**，`onMounted` 里 `_[value]=userData.registrant.ping_column`（`:959`） |
| `ht` | `:1334` | `ref(new Map)` —— 行 id → 正在编辑的 `$index`（决定出「编辑/取消」哪个按钮） |
| `vt` | `:1335` | `ref(new Set)` —— **脏行 id 集合**（`unsaved-row` 类的来源） |
| `pt` | `:1335` | `ref({})` —— 行 id → **进入编辑时的快照**（用来比对是否真改了） |
| `Pt` | `:1512` | `ref([])` —— **选中行的 payload 数组**（expose 为 `ping_hui`） |
| `ft` | `:1222` | `ref({})` —— 行 id → 选中的加价项目下标数组（expose 为 `selectedExtraItems`） |
| `nt` | `:1222` | `useAddPriceItems()` 的**实例自己的**加价项目表 |
| `Ot` | `:1487` | `ref(false)` —— `isImporting`，父组件灌数据时置 true，用来**抑制 watch** |
| `ve` | 见 §4.1 | `computed` —— 开向示意图映射（`directionImageMap`） |
| `O` | 见 §4.1 | `ref([...])` —— 型材 → formulaid 映射（`material`） |
| `B`/`E` | `:708` | 全部/可选开向（`allOpenDirections` / `openDirections`） |

**移门**

| 变量 | 定义行 | 是什么 |
|---|---|---|
| `Z` | `:3743` | 行数组（`ref([R()])`） |
| `$` | `:3743` | 已落库行 id 集合 |
| `ae` | `:3769` | 行 id → 编辑中的行下标 |
| `xe` | `:3770` | `ref(new Map)` |
| `_e` | `:3770` | **脏行 id 集合** |
| `nt` | `:4135` | `ref({})` —— **列显隐**，`registrant.diao_column`（`:4313`）—— **未 expose** |
| `vt` | `:4321` | 选中 payload 数组（expose 为 `diao_hui`） |
| `rt` | `:4135` 一带 | 选中加价项目 |
| `gt` | `:4269` | `isImporting` |
| `p` / `v` | `:3619` / 附近 | `material` / `directionImageMap` |
| `I` | `:3624` | `doorsheets` |
| `h` `N` `M` | | `openDirections` / `trackType` / `lineType` |
| `$e` `Fe` | `:3987` / 附近 | `trackytypedata` / `lineytypedata` |

**结论：SFC 自己维护「行数组 / 已落库集合 / 脏行集合 / 编辑快照 / 列显隐 / 选中集 /
加价项目选中」，但行的**内容**全部来自父组件。**

### 5.3 `isImporting` 的真实作用

不是「加载中」spinner —— 是**给子组件关掉自动补型材的 watch**：

```js
// 平开，Hui.formatted.js:1451 附近（raw@56257 前一段）
Vue.watch((()=>ue.value.map(e=>[e.id,e["型材"],e["墙厚"],e["门洞宽"],e["门洞高"],e["亮窗总高"]])),
  ()=>{ if(!Ot.value && O.value && Object.keys(O.value).length!==0)
          for(const a of ue.value){ ... a.formulaid=String(_) ... }
  },{deep:!0})
```

移门同构（`if(!gt.value){ ... }`）。父组件灌行前后把它拨 true/false，避免逐行触发重算。

---

## 6. 两张表 vs 一个组件：**两份独立代码，不是共享底座**

它们是**两份各自 ~2000 行的独立 SFC**（平开 `Hui.formatted.js:571-2820`，移门 `:3566-5570`），
模板/逻辑大段是复制粘贴改的，但**没有抽过任何共用底座**。共享的只有 import 的公共件：
`useAddPriceItems` / `useDoor3DView` / `usePasswordVerify` / `getUserData` / `getImage` /
`saveImage` / `saveOptions` / `deleteImage`。

### 6.1 列集差异（`label:` 逐个切出来，按 render 顺序）

| # | 平开 `Ping_hui` | 移门 `Diao_hui` |
|---|---|---|
| 1 | 日期 | 日期 |
| 2 | 回执单号 | 回执单号 |
| 3 | **平开门**（操作列） | **移门**（操作列） |
| 4 | 门花图 | 门花图 |
| 5 | 型材/颜色 | 型材/颜色 |
| 6 | 单价/数量 | 单价/数量 |
| 7 | 玻璃 | 玻璃 |
| 8 | 门洞尺寸 | **扇数/开向** |
| 9 | 吊脚 | **下轨道/套线** |
| 10 | 亮窗总高 | 门洞尺寸 |
| 11 | 五金 | 亮窗信息 |
| 12 | 封板高 | 五金 |
| 13 | 备注 | 备注 |
| 14 | 金额 | 金额 |
| 15 | 加价项目 | 加价项目 |
| 16 | 计价方式 | **上轨/边封** |
| 17 | 打折 | 前包加长 |
| 18 | 前包加长 | 后包加长 |
| 19 | 后包加长 | 单双丁 |
| 20 | 单/双丁墙体 | 计价方式 |
| 21 | 单号 | 打折 |
| 22 | 图片ID | 单号 |
| 23 | 客户 | 图片ID |
| 24 | 客户编号 | 客户 |
| 25 | 其它费用 | 客户（**重复了一个 `key:11` 的「客户」**，疑似旧版笔误） |
| 26 | — | 其它费用 |

（平开列定义从 `Hui.formatted.js:1137` 起；移门从 `:936` 起。）

列显隐由 `columnVisibility` 逐列 `v-if` 控制。平开侧的门（`_["value"][…]?`）在：
`:2129` 套线种类、`:2169` 轨道种类、`:2336` 洞尺、`:2348` 吊脚、`:2382` 五金、
`:2537` 打折、`:2545` 前包加长。**移门用的是 `nt["value"][…]`（未 expose 的那个 ref）。**

### 6.2 行为差异

| 维度 | 平开 | 移门 |
|---|---|---|
| 行数组初值 | `ref([])` | `ref([R()])`（1 条空行） |
| 3D 入口 | `useDoor3DView({openSwing3DView,…})`，子组件 `_0x47c7c0` = `SlidingDoor3D` | `useDoor3DView({openSliding3DView,…})` |
| 开关向请求 | `changeDirectionMode` / `reverseDirection` / `saveCustomDirectionNames` | 无 |
| 取价/初始化接口 | `getPingPrice` / `initializPing` | `getDiaoPrice` / `initializDiao` |
| 密码校验 | 有 `usePasswordVerify()` | 有 |
| 方数口径 | `max(门洞宽*max(门洞高,亮窗总高)/1e6, l)`，`diamond` 型加墙厚与亮窗 | 另有一套（`扇数`/`轨道种类` 驱动） |
| 列显隐来源 | `registrant.ping_column` | `registrant.diao_column`（**不 expose**） |
| 暴露 `columnVisibility` | 是 | **否** —— 但 Hui 页 `:8692` **只读平开的** `columnVisibility["轨道种类"]` 去判断平开行的「锁具没指定」。**不能类推到移门。** |
| 加价项目 | 自己 `useAddPriceItems()`（prop 是死的） | 自己 `useAddPriceItems()`（没 prop） |
| emits 额外项 | — | 多一个 `update:showCheckbox`（**死事件**） |
| 行类前缀字段 | `单号` | `单号`（同一个字段） |

### 6.3 完全一致的部分

- `emits` 的 `refresh` / `unselect` / `calculateSingleRow` 三个名字与语义一致；
- `removeFirstRow` / `clearTable` / `markRowsPersisted` / `isPersistedRow` / `addRow` 语义一致；
- 行类函数（`unsaved-row` + `highlight-matched-order`）逐字同构，只有变量名不同（见 §7）；
- 删除行 / 复制行 / 单行保存 / 算料 四类行内操作，连提示文案都一样。

---

## 7. `highlight-order-query` 的语义（逐字）

### 7.1 组件里：只加类，**不滚动**

平开（`Hui.formatted.js:1349-1356`，`raw@53872`）：

```js
},Nt=({row:e})=>{
  const t=x,a=[],_=Ct(e);
  if(_&&vt.value.has(_)&&a["push"]("unsaved-row"),bt["highlightOrderQuery"]){
    const x=bt["highlightOrderQuery"]["toLowerCase"](),_=String(e["单号"]||"")["toLowerCase"]();
    _&&_["startsWith"](x)&&a.push("highlight-matched-order")
  }
  return a["join"](" ")
}
```

移门（`Hui.formatted.js:3783-3792`，`raw@157000` 一带）——**逐字同构**，只是
`vt`→`_e`、`bt`→`ut`（移门的 props 别名）、`Ct`→`oe`：

```js
},de=({row:e})=>{
  const t=x,a=[],_=oe(e);
  if(_&&_e["value"].has(_)&&a["push"]("unsaved-row"),ut.highlightOrderQuery){
    const x=ut["highlightOrderQuery"]["toLowerCase"](),_=String(e["单号"]||"")["toLowerCase"]();
    _&&_["startsWith"](x)&&a.push("highlight-matched-order")
  }
  return a["join"](" ")
}
```

要点：
- 比的是 **`row["单号"]`**（不是回执单号），**两端都 `toLowerCase()`**，语义是 **`startsWith`**；
- 类**追加**在 `unsaved-row` 后面（两个类可以同时在）。CSS 优先级实测：
  `unsaved-row` 粉 `#ffe6ef`，`highlight-matched-order` 绿 `#d4edda`（见 §7.3）；
- 函数里**没有** `scrollIntoView` / `scrollTo` / `setScrollTop` 之类。
  整个组件体里 `scroll` 字样一次都不出现（全量扫过）。

### 7.2 「滚动到居中」在**父组件 Home**，不在 SFC

在 `Home.formatted.js:7702-7729`（函数 `Yo`，"按单号查并定位" 的确认动作）：

```js
if(a){                                                   // a = 命中
  await Vue.nextTick();
  const t=ps["value"][0];                                // ps = 当前列表
  t&&Vn["value"]&&(Vn["value"].toggleRowExpansion(t,!0),setTimeout(()=>{
    const o=Vn["value"]?.["$el"];  if(!o)return;
    const a=o["querySelector"](".highlight-matched-order");   if(!a)return;
    const n=o["querySelector"](".el-table__body-wrapper");    if(!n)return;
    const u=n["querySelector"](".el-scrollbar__wrap")||n,
          r=u.scrollTop,
          i=a["getBoundingClientRect"](), c=u["getBoundingClientRect"](),
          s=r+(i["top"]-c["top"])-c.height/2;
    Vn["value"]["setScrollTop"](Math["max"](0,s))
  },800))
}
```

（`Vn` = 主表 `el-table` 的 ref；`l(1174)="querySelector"`、`l(1412)=".highlight-matched-order"`、
`l(521)=".el-table__body-wrapper"`、`l(1199)=".el-scrollbar__wrap"`、`l(583)="$el"`、
`l(763)="setScrollTop"` —— 由 `legacy-slice.mjs` 解出。）

节奏：**展开第一条命中订单 → `setTimeout(…, 800)` → 在展开行的 DOM 里找
`.highlight-matched-order` → 相对滚动容器居中**。找不到元素就直接 return（**不滚**）。
`Vn` 是主 `el-table`，而类由 SFC 加在展开行的子表行上 —— 子表 DOM 正挂在主表内。

**Hui 页里没有对应实现**：`Hui.formatted.js` 全文只有 `:1355` / `:3789` 两处出现
`highlight-matched-order`（都是 SFC 自己），Hui 页从不给子组件传 `highlight-order-query`
（`:13103-13106` 的 props 清单里没有）。**所以「高亮 + 滚动定位」是 Home 独占的功能。**

### 7.3 CSS（`legacy/css/Hui-39b802eb.css`，两张表各自的 scoped 块）

```css
[data-v-a854303f] .el-table__row.highlight-matched-order>td.el-table__cell{background-color:#d4edda!important}
[data-v-a854303f] .el-table__body tr.highlight-matched-order:hover>td.el-table__cell{background-color:#c3e6cb!important}
[data-v-a854303f] .el-table__row.unsaved-row>td.el-table__cell{background-color:#ffe6ef!important}
[data-v-a854303f] .el-table__body tr.unsaved-row:hover>td.el-table__cell{background-color:#ffd6e6!important}
```
（`data-v-6dcd3802` 的移门块是同四条，逐字一致。）

---

## 8. `add-price-items` 的默认常量

**原始 Home chunk** `legacy/js/Home-d6b13b9a.js` 字符偏移 **`334578`**（`indexOf("人工")` = 334598）：

```js
ao=Vue.ref(null),no=Vue.reactive({}),uo=(e,t)=>(!no[e]&&(no[e]={ping:!0,diao:!0}),no[e][t]),
ro=Vue.ref([{name:"人工",price:100,unit:"元/套"}]),
io=e=>so(e),co=e=>{...}
```

**`Home.formatted.js:7655-7658`**（换行是美化器拆的）：

```js
},no=Vue.reactive({
    }),uo=(e,t)=>(!no[e]&&(no[e]={
      ping:!0,diao:!0
    }),no[e][t]),ro=Vue.ref([{
      name:"人工",price:100,unit:"元/套"
    }
    ]),
```

**逐字确认：`[{name:"人工",price:100,unit:"元/套"}]`，与任务描述一致。**
同一常量在 Hui 页也有独立一份：`Hui.formatted.js:7978`
`_0xfcd2e3=Vue.ref([{name:"人工",price:100,unit:"元/套"}])`（Hui 页自己传给两个子组件）。

---

## 9. `calculate-single-row`（Home 的 `In` / `Un`）到底干什么

### 9.1 触发点：表内「算料」按钮

平开（`Hui.formatted.js:1877-1881`）：

```js
Vue.createVNode(f,{link:"",type:"warning",size:"small",
  onClick:e=>(e=>{
    const t=x,a=ue["value"][e];
    a["formulaid"]&&""!==a["formulaid"].trim()
      ? Lt("calculateSingleRow",a)
      : ElementPlus.ElMessage["warning"]("该行没有型材数据，无法计算")
  })(t),class:"upload-link"},
  {default:Vue.withCtx((()=>a[35]||(a[35]=[Vue.createTextVNode(" 算料 ")]))),_:2},1032,["onClick"])
```

移门同构（`:4679-4683`，按钮文案同为「算料」）。
**没有 `formulaid` 就只弹 warning，不 emit。**

### 9.2 Home 的处理器（`Home.formatted.js:8221-8241` / `:8242-8262`）

`In`（平开）：

```js
},In=async e=>{
  var t,l;
  const o=g;
  if(lc.value)if("function"==typeof lc["value"]["calculateReceipt"])try{
    uc.value=[],await Vue.nextTick();
    const a=await lc["value"]["calculateReceipt"]({
      ping:!0,diao:!1,single:!0,singleRowData:e
    });
    Array["isArray"](a)?uc["value"]=a:uc["value"]=[],await Vue.nextTick(),ic["value"]=2;
    const n={produces:uc["value"]},u=await x();                    // x = getUserData
    if(!u)return void ElementPlus.ElMessage["error"]("无法获取用户数据");
    const r=u?.["registrant"]?.["template"]?.["product"],
          i=It["commentPreview"](r,n);                             // 渲染生产单模板
    On.value="",Yn.value="",Wn["value"]=i[0]["outerHTML"],await Vue.nextTick(),
    Hn.value=ao["value"]?ao["value"].scrollWidth:0,eo.value=!0      // 打开预览
  }
  catch(a){ElementPlus.ElMessage["error"]("计算失败，请重试")}
  else ElementPlus.ElMessage.error("calculateReceipt 方法不存在");
  else ElementPlus.ElMessage["error"]("计算组件未初始化")
}
```

`Un` 完全同构，只有一处不同：`{ping:!1,diao:!0,single:!0,singleRowData:e}`。

### 9.3 它调了什么

`lc` 是 **Home 内嵌的 `Hui` 页组件实例**（离屏）：

```js
// Home.formatted.js:10030
},lc=Vue.ref(null),oc=Vue.ref({ping_hui:[],diao_hui:[],customerInfo:{},hui_picture:[]}),…
// Home.formatted.js:11994-11998
Vue.createVNode(a,{ ref_key:s(1144), ref:lc, receiptData1:oc.value, style:{display:s(880)} },null,8,[s(1084)])
```
（`a` = 从 `Hui-d088417c.js` 导入的 `Hui`；外层 `[[Vue.vShow,!1]]` 永久隐藏。
失败提示「Hui 组件引用不存在」也印证了这点，见 `:8318`。）

**所以「算料」不是「直接出生产单预览」这么简单，链路是：**

1. SFC 的按钮 → `emit("calculateSingleRow", row)`；
2. Home 的 `In`/`Un` → 调 **Hui 页组件暴露的 `calculateReceipt({ping,diao,single:true,singleRowData})`**；
3. Hui 页内部（`Hui.formatted.js:10997` 的 `_0x32bd6f`）在 single 模式下把自己那份
   payload 临时换成 `{ping_hui: ping?[singleRowData]:[], diao_hui: diao?[singleRowData]:[]}`，
   算 `produces`；
4. 回到 Home：`commentPreview(registrant.template.product, {produces})` 渲染**生产单**模板 HTML
   → `Wn` → `eo=true` 打开预览抽屉（`ic=2`）。

**没有点任何按钮/走 UI；是「服务端模板 + 本地渲染」直接出预览。**

**Hui 页自己的两个处理器更短**（`:10989` / `:10993`）：

```js
_0x1f0952=async e=>{await _0x32bd6f({ping:!0,diao:!1,single:!0,singleRowData:e})},
_0x233007=async e=>{await _0x32bd6f({ping:!1,diao:!0,single:!0,singleRowData:e})},
```
即 Hui 页直接用**自己的** `_0x32bd6f`，不绕 Home 那一圈。

---

## 10. 未证实 / 存疑（**不要当结论用**）

### 10.1 ⚠️ Home 的 `o.tableData.value = []` 疑似**无效**

`Home.formatted.js:7852`（`Ro`）与 `:7865`（`Fo`）：

```js
o["isImporting"]=!0,o["tableData"].value=[],Vue.nextTick((()=>{ ... o["addRow"](t) ... }))
```

按 §4.3 的 Vue 运行时证据，`expose` 出来的 ref 会被 `proxyRefs` 解包，
`o.tableData` **已经是数组本身**，所以 `o.tableData.value = []` 只是给数组挂了个
多余的 `value` 属性，**清不掉任何行**。Hui 页用的是正确写法（`tableData.splice(0, len, ...)`）。

**为什么线上没炸**：Home 的展开行内容在收起时会被销毁重建，重展开时子组件是新的
`ue=ref([])`，本来就空；而且 `jo` 集合保证明细只拉一次。所以这个 bug 被掩盖了。
**⚠️ 但这只是我的推断，没有在浏览器里实测过旧版行为**，也没找到旧版「连续两次灌同一订单」
的路径证据。**实作新版时不要照抄这一句。**

### 10.2 ⚠️ 「多根组件 + attrs 丢弃」只做了静态判断

我确认了两个组件 render 的根是 Fragment 且有多个根 vnode、且没有 `inheritAttrs:false`，
据此推断多余的 `height` / `class` / `add-price-items` 不会落到 DOM。**没有实测**。
（这条不影响主结论：`add-price-items` 在平开是死 prop、在移门根本不是 prop，这一点是逐字核过的。）

### 10.3 ⚠️ 平开 `props.addPriceItems` 是否**曾经**被用过

我核的是**当前 bundle**：整个组件体（含 render）只有 props 声明和 composable 解构两处。
不排除它是一处历史残留。**不要据此认为「平开和移门的加价项目来自同一处」。**

### 10.4 ⚠️ 移门列集里 `key:11` 的「客户」出现两次

`Hui.formatted.js:1857` `key:10,label:"客户"` 与 `:1863` `key:11,label:"客户"`。
**我判断是旧版重复列（疑似笔误），未证实**；也有可能是两个不同字段被我读成了同一个 `label`。

### 10.5 ⚠️ 移门 `_0x309a` 与平开 `_0x2d32` 是两张不同的解码表

本报告两个组件的名字→解码器闭包**都没有冲突**（各只有一个表），这点是自检过的。
但**跨组件**不能混用 —— 例如 `t(275)` 在平开是 `"startsWith"`，在别的组件里可能不是。

---

## 11. 与新版对照

> 只读，未改。以下只在能确证时写。

### 11.1 新版**没有**这两个子组件

`app/src/components/` 下没有平开/移门明细表组件；两张表目前都**内联在页面里**：

- **`app/src/views/Hui.vue:81-150`** —— 两张表并排内联渲染：
  `pingColumns` + `pingRows`（`:104`）与 `diaoColumns` + `diaoRows`（`:127`），
  数据是**同一个 `lines` 数组按 `line_type` 过滤**出来的：
  ```ts
  // app/src/views/Hui.vue:1244-1245
  const pingRows = computed(() => lines.value.filter((l) => l.line_type === 'ping'))
  const diaoRows = computed(() => lines.value.filter((l) => l.line_type === 'diao'))
  ```
  也就是说**新版早就是「一个数据源 + 两个视图」**，与旧版「两个组件各持一份数组、
  父组件靠 `addRow`/`splice` 灌」的形状不同。
- **`app/src/views/Home.vue:2007-2062`** —— 展开行里是**只读**明细子表
  （`h(NDataTable…)`），由 `details[id].lines` 过滤而来（`:1983` / `:1986`），
  不是可编辑子组件。文件里 `:1545` 有一条自述：「…再级联到展开行里的两张子表
  （新版无子表，随 A3 一起缺）」。

### 11.2 已经对齐/明确记录差异的点

- **`highlight-order-query` 与「滚动居中」**：`app/src/views/Home.vue:2099-2114`
  明确写了「旧版这里还有一段 800ms 后『滚到居中』」，并说明**新版刻意没做**，
  理由是 `OrderLineDto` 里没有「单号」字段（`app/src/api/types.ts:109-159`），
  因此 `Hui.vue:3893` 那两条 `.highlight-matched-order` 样式目前是**悬空的**。
  —— 本次逆向**证实了那段注释描述的旧版行为**（`Home.formatted.js:7702-7729`，
  见本报告 §7.2），也证实类的来源字段确实是 `row.单号`（§7.1）。
- **`unsaved-row`**：新版在 `app/src/views/Hui.vue:2980-2981`
  `const rowClassName = (r) => (r.id == null ? 'unsaved-row' : '')` —— 判据是
  **`id == null`（未落库）**；旧版的判据是**脏行集合**（`vt`/`_e`，即「编辑过且与原快照不同」）。
  **两者不等价**：旧版「已落库但被改动过」的行也是粉的，新版不是。见 `Hui.vue:3974` 的注释
  已经把旧版规则抄对了，但实现只用了 `id == null`。
  **⚠️ 这与本次任务无关，只是顺手发现，未深查，请勿直接改。**
- **两份文档已存在的引用**：`app/src/views/Home.vue:949-952` 引 `Qo`（`:7842-7849`）、
  `:1865` 引 `_o`（`:7792`）、`:1940` 引 `jo`（`:7772`/`:7826`）——都与本次切出来的
  行号一致，说明这条行号口径是可信的。

### 11.3 「能否直接复用」的初步判断（供方案参考，不是结论）

按旧版接口反推，要抽一个**可复用明细表组件**，需要它至少能：

1. **收行**：`tableData`（或 `addRow` + 清空手段）；
2. **吐选中行**：`ping_hui` / `diao_hui` 那样的选中 payload 数组（Home `:9361-9370` 依赖）；
3. **吐/收脏态**：`markRowsPersisted` + `isImporting` + `isPersistedRow`；
4. **列显隐**：`columnVisibility`（注意**移门旧版没暴露**，Hui 页只读平开的）；
5. **row-class**：`单号.startsWith(highlightOrderQuery)`（依赖明细行上有「单号」字段 —— 新版模型里没有，见 §11.2）；
6. **两个 emits**：`refresh`（父级刷新）与 `calculateSingleRow`（父级算料）；
7. **3D 入口**：平开 `openSwing3DView`、移门 `openSliding3DView`，是**不同的**两套。

其中 **第 5 条在新版模型下做不到**（`OrderLineDto` 无「单号」）；第 7 条要求按 `line_type`
分派；第 1、3 条在「一个 `lines` 数组 + 两个视图」的新形状下**语义要重新定义**
（旧版是两个独立数组，`isImporting`/`markRowsPersisted` 是按表来的）。
**所以不能把旧版两个 SFC 直接搬成一个组件** —— 这是要请用户拍板的部分。
