# 公式 `parts` 键序保真问题（2026-09-15）

> 结论先行：**我们存的公式部件顺序与原版不一致**，因为写入链路上顺序被**丢两次**
> （serde_json 的 `BTreeMap` + PostgreSQL 的 `jsonb`）。原版打印列内部件顺序**直接依赖
> 这个声明序**，所以移门外框等列的顺序已经偏了。
>
> 存量数据**已无从恢复**（没有顺序来源）；修复的意义在于**未来导入真实公式时不再丢序**。

---

## 1. 原版：列内部件顺序由「公式 parts 的键序」决定

原版各打印列用 `Object.entries(partsMap).filter(...).map(...)` 直接遍历，**JS 对象保留字符串键的插入序**
⇒ 输出顺序 = 服务端下发的**声明序**。

| 引擎 / 产出 | 依赖级别 | 写法与证据 |
|---|---|---|
| **移门外框** `_0x1598e4` | **🔴 强依赖** | `Object.entries(_0x4cd8ac).filter(([e])=>["边封","下轨","上轨","滑","固定","移动","上横","盖板"].some(t=>e.includes(t))).filter(…).map(…)`；`_0x4cd8ac` 由 `Object.keys(_0x3556ef).forEach(...)` 按 parts 键序构造（@12484 附近）|
| **windows·平开** B平 / D平 | **🔴 强依赖** | B平 @492734 `["扣板",…,"压线"].some(t=>e.includes(t))`；D平 @533094 `["扣板",…,"压线","封板","上亮窗玻璃"].some(…)` —— **数组只做成员测试**，外层是 `Object.entries(parts).filter(...)` ⇒ 顺序 = parts 序 |
| **windows·吊趟** B吊 / D吊 / C吊 | **🔴 强依赖** | @512847 / @550917 / @583179 同上写法（`["中柱",…,"槽","压线"].some(…)`）|
| 平开外框 `_0x298841` | 🟡 组内依赖 | `Object.entries(_0x1d6087).forEach(([k,v])=>{ k.includes('门框高')?t.push([k,v]):k.includes('门框宽')&&a.push([k,v]) })` 后 `[...t,...a]`（@490695）—— 组序 `门框高组→门框宽组` 由代码定，**组内** entries 序 |
| 平开外框·钻石型 | ✅ 无关 | `["左边","右边","斜长","竖框"]` 常量数组（@490695）|
| 门扇列 | 🟡 组内依赖 | 关键词常量数组 + `reduce((acc,kw)=>[...acc,…])`（A平 @568460 `["玻璃","门扇"]`；B平 见 `DS_KW.ping`）—— 组序由常量定，**组内** entries 序 |
| glassHole（G）| ✅ 基本无关 | 大量 `Object.entries(parts).find(...)` 按名取名（@420997 等），**不依赖顺序**；`filter(...)` 处仅取单个 |
| 回执构造器 `receiptBuilder` | ✅ 无关 | 全文不读 `parts`（已核实 `.sort(` 0 处、`formulaid` 0 次）|

**⇒ 不能用「关键词数组」替代**：原版**移门外框**与**全部 windows 列**都是 `entries + .some()` 单次过滤，
完全按声明序；改成关键词分组会得到另一套错的顺序。

| **windows·D吊（三段式）** | 🟡 同下标并列才敏感 | 主体段 `.map(...)` 产出 `{priority: <命中关键词下标>}` 后 **`.sort((a,b)=>a.priority-b.priority)`**（@551979）；JS `Array.sort` **稳定** ⇒ 组序由关键词下标定，**同 priority 并列时组内 = parts 序** |
| **`kou` 列** | ✅ 无关 | B平 @494461 用关键词常量数组 `["扣板宽",…,"扣板厚"]` 逐个取**单件**；B吊 @515125 / C吊 @584654 固定 push ⇒ 不遍历 parts |
| **L1 / L2**（product10）| ✅ 无关 | 结果映射 `_0x1dcc9[e] = {…}`（@384715）是**按部件名索引的 map**，消费时按名取 ⇒ 不依赖顺序 |
| **`lable` / `lableForMaterial`** | ✅ 无关 | `_0xff5572`（@371010）从**订单字段**构造标签行，不遍历 parts |

> ✅ 原「未核实」三项（D吊 windows / L1·L2 与标签类 / kou 列）**已全部补完**，本表无遗留。

---

## 2. 我们这边：顺序在写入链路上被丢两次

| # | 环节 | 证据 | 行为 |
|---|---|---|---|
| 1 | **`serde_json::Value::Object` 是 `BTreeMap`** | `backend/Cargo.toml:13` `serde_json = "1"`（仅 default features，**未开 `preserve_order`**）；`cargo tree -e features -i serde_json` 确认 | 反序列化时**按键字典序重排** |
| 2 | **PostgreSQL `jsonb` 不保序** | `backend/migrations/0003_formulas.sql:14` `parts JSONB NOT NULL DEFAULT '{}'` | 再按「长度 + 字节」重排 |

实测对照（同一张「推拉」公式）：

| 来源 | 前几个键 |
|---|---|
| 原版抓取（`legacy/data/original-formulas.json`）| `无亮窗边封 → 2轨上滑 → 2轨下滑 → 2轨2扇上下方 → …` |
| 我们库里（formula 7）| `F槽宽 → F槽高 → 扣板宽 → 扣板高 → 2轨上滑 → 2轨下滑 → 3轨上滑 → …`（`无亮窗边封` 掉到第 12 位）|

**已可见的后果**：移门生产单的**外框列**，我们渲染为
`上滑 → 下滑 → 边封 → F槽宽 → F槽高 → 扣板宽 → 扣板高`，
而按原版声明序应为 `边封 → 上滑 → 下滑 → F槽宽 → …`。

---

## 2.1 我方逐函数顺序敏感清单（穷举，`app/src/views/Hui.vue`）

`computeParts()` 的全部调用点：`2635`（存到 `l.parts`）、`3602`+`3572`/`3625`（product10）、
`3739`（glassProduces）、`4070`（doorframeText）、`4142`（windowsText）、`4210`（doorsheetText）、
`4423`（product1Produces）。

### 🔴 强敏感 —— **会改变算出来的数值**（不只是显示顺序）

| 位置 | 函数 | 写法 | 后果 |
|---|---|---|---|
| `3573`/`3574` | `product10Row` | `parts.filter(含'玻璃高'/'玻璃宽').pop()` | 取到**别的部件** → 尺寸列/张数变 |
| `3626`/`3627` | `product10Copies` | 同上 `.pop()` → `Math.floor(gW.quantity)` | **标签张数变** |
| `3762`/`3763` | `glassProduces` | `g1[g1.length-1]` / `g2[g2.length-1]` 决定组末 `数量:N` | **玻璃合片单的数量变** |
| `4426` | `product1Produces` | `val(name)` = `filter(...).pop()` | **门框/玻璃/扣板尺寸变** |
| `4070` | `doorframeText` | 吊趟分支**单次 filter**，顺序全跟 parts | **外框列顺序（及分组稳定）变** |

> ⚠️ 注意：这些 `.pop()` **语义上与原版一致**（原版 @569700 是"部件遍历、命中即赋值 = 后者覆盖"，
> 等价于取最后一个）。问题不在写法，而在**"最后一个是谁"取决于顺序** —— jsonb 序 ≠ 原版声明序，
> 于是取到不同部件。**所以这几处不是"显示错"，是"算错"。**

### 🟡 组内敏感 —— 组序由代码常量定，**组内**跟 parts 序

| 位置 | 函数 | 组序来源 |
|---|---|---|
| `4142` | `windowsText` | 关键词常量数组（逐引擎，见 `engine-exhaustive.md` §D8）|
| `4210` | `doorsheetText` | `DS_KW.ping/pingOld/diao/diaoOld/diamond` |
| `3792` | `glassInfoProduces` | 用 `parts.find(re)` 取**第一个**命中 → 多命中时敏感 |
| `4070` | `doorframeText` 平开分支 | 显式分组 `门框高组→门框宽组→前框→后框`，**组内**跟 parts 序 |

### ✅ 不敏感

`2635`（`l.parts` 仅存起来供 `glassInfoProduces` 用，后者按名 `find`）、`2546`（回退用）、
单名 `find(p => p.materialName === n)` 这类精确取名。

### 影响范围小结

| 列 | 是否受影响 | 说明 |
|---|---|---|
| **移门外框** | ❌ 已可见 | `doorframeText` 吊趟分支是**单次 filter**，顺序完全跟 parts 走 |
| **亮窗/扣板、门扇** | ⚠️ 组内受影响 | 组序由关键词常量定，**组内**按 parts 序 |
| 平开外框 | ⚠️ 组内受影响 | 组序由代码定（门框高组→门框宽组），组内仍跟 parts |
| 平开外框·钻石型 | ✅ 不受影响 | 关键词常量数组 |
| **product10 张数 / 玻璃合片单数量 / product1 尺寸** | 🔴 **数值会变** | 见上表「强敏感」|

---

## 2.2 补漏清单（并行审计 po-ours 交付，team-lead 已逐条复核）

> 本节是对 §2.1 的**补漏**。以下每条的代码位置与原文对照均已由 team-lead 复核。

### 🔴 最大遗漏：`applyWidthIncrement` 是**跨键顺序状态机**

`Hui.vue:2235-2281` 单趟 `for (const [key,p] of Object.entries(parts))`，用状态位 `a`：

```js
let a = 0
… key.includes(fans) && key.includes('上下方') && (p.v += x, a = 1)
… key.includes('封板宽') && a === 1 && (p.v -= x)          // ← 需 a=1
… (上滑|上轨|下滑|左右盖板|上下盖板|轨道盖板) && a === 1 && (p.v -= dtv)   // ← 需 a=1
… key.includes('上横') && 门洞高 < 亮窗总高 && a === 1 && (p.v -= dtv)      // ← 需 a=1
```

**原版逐字相同**（`Hui.formatted.js:9467`：`l.includes(扇数)&&l.includes("上下方")&&(c.v=…+x, a=1)`、
`l.includes(封板宽)&&1===a&&(c.v=…-x)`）—— 原版跑在**声明序**上，我们跑在**重排序**上。

**实测分叉（本条已坐实，三层证据）**：

| 层 | 证据 |
|---|---|
| 我方代码 | `Hui.vue:2263-2279` 的 `a === 1` 门控 |
| 原版 | `Hui.formatted.js:9467` 的 `1 === a` 门控（逐字对应）|
| **客户端实际键序** | 直接抓 API 报文：`2轨2扇上下方` 在**第 0 位**、`2轨上滑` 在第 11 位（serde_json `BTreeMap` 按 UTF-8 字节序，ASCII 数字前缀排在汉字前）|
| 原版声明序 | `original-formulas.json` 的推拉：`无亮窗边封, 2轨上滑, 2轨下滑, 2轨2扇上下方`(第 3 位) |

⇒ 原版处理**轨道件**时 `a=0`（减量**不生效**），我们 `a=1`（减量**生效**）
⇒ **同一张单子，轨道长度/封板宽/上横长度算出来不同** —— 这是唯一一处顺序会改**数值**的路径。

> ⚠️ **当前实际影响 = 0**：库里只有 formula 4 / 9 配了 `widthIncrement`，而它们是**平开键形**
> （`门框宽/上下方/…`，无轨道件、无 `{扇数}上下方`），`a` 恒为 0；唯一吊趟键形的 formula 7 没配
> `widthIncrement`。所以**现在看不出来，导入真公式后必炸**。
>
> ⚠️ 另注：`computePartsUncached` 的**两遍 eval 防护挡不住这条** —— `applyWidthIncrement` 在
> `2554` 执行，**早于**两遍 eval，直接改 `p.v` 污染最终 result。

### 🔴 §2.1 漏掉的另外 3 处强敏感

| # | 位置 | 说明 |
|---|---|---|
| 2 | `Hui.vue:3752-3754` `glassProduces.groupText` **平开分支** | `list[list.length-1]` 取**最后一个「门扇」命中件**的 quantity 决定 `数量:N`（§2.1 只覆盖了吊趟的 3762/3763）|
| 3 | `Hui.vue:4433-4439` `product1Produces` 的 `for (const p of parts)` | 与 4426 的 `.pop()` 是**两条独立路径**：`玻璃高`/`玻璃宽`/`封板宽` 三处"后者覆盖"，直接喂 `4467 glassSize` 与 `4453 sheetWidth` |
| 4 | `Hui.vue:2059-2065` `partsTooltip` | `l.parts.map(...).join('\n')` 纯 `.map` 出显示文本 → **顺序变则提示内容变** |

> 第 4 条同时**纠正 §2.1 的结论**：`2635` 存的 `l.parts` 有**两个**消费点
> （`2060` 强敏感显示 + `3792` `.find` 条件敏感），不能简单标"不敏感"。

### 🟡 漏掉的组内/条件敏感

| # | 位置 | 说明 |
|---|---|---|
| 5 | `Hui.vue:1118-1132` `partsTrackOptions` | 决定**轨道/套线下拉候选顺序**；读的是 `formulaOf(l).parts`，**不经 computeParts**，但**同一个重排序源** |
| 6 | `Hui.vue:4158` `windowsText` 吊趟 `parts.find(扣板厚)` | 首个命中，与 3792 同类 |
| 7 | `Hui.vue:4184-4193` `windowsText` 吊趟D 的 `.sort((a,b)=>a.prio-b.prio)` | 稳定排序 → **同 prio 并列时并列内序 = parts 序** |
| 8 | `Hui.vue:3765/3768` `glassProduces` 吊趟 | `t1` 与 `g2.map(...)` 的**文本行序**（§2.1 只列了 3762/3763 的数量）|

### ✅ 补入「不敏感」（穷举完整性）

- `2286-2306 applyHinge`：逐键改自己的 `v`，无跨键状态
- `2319-2513 applyPartState`：逐键 `set`；`keys.some()` 仅布尔存在性
- `2590-2599` 两遍 eval + `secondPass`：本身免疫（但**挡不住 §2.2 第 1 条**，见上）
- **`[0]` 全审**：`Hui.vue` 内 `[0]` 无一处作用在 parts 上（唯一近亲 `3645 arr[0]?.glass` 读的是 label rows）
- `4857 .parts-preview`：**死 CSS**，全仓无引用

### 🔴 另一个文件：`app/src/utils/formulaEngine.ts`

| # | 位置 | 说明 |
|---|---|---|
| 14 | `formulaEngine.ts:148-161` `recalcForward`（调用方 `Formulas.vue:333`）| **单趟** `Object.entries(parts)`，跨件引用取 `computed[ref]`，**没算到就当 `'0'`** —— 依赖件排后面就占位成 0。**与 `computePartsUncached` 的两遍实现不一致**。序源 `Formulas.vue:832 Object.assign(parts, p)` ⇒ 同一重排序源。影响公式编辑器的占位值/结果列 |
| 15 | `Formulas.vue:313 rows` + `639 applyTemplate` | 编辑器明细表行序 = `Object.entries(parts)`；`applyTemplate` 按 `TEMPLATES` 序重建 ⇒ **保存并重载后行序会变**（**用户可见**）|

### 一条重要的存储语义差异

**`order_lines.parts` 是 JSONB 数组**（数组在 jsonb 里保序），**`formulas.parts` 是对象**（对象丢序）。
同一个 `.parts` 名字，两种行为 —— 行上存下来的算料结果**顺序是保留的**。

### 🔧 对 §4 修复方案的补充

改序后**必须回归 `applyWidthIncrement`**（轨道件/封板宽/上横的长度）——
这是唯一一处顺序会改变**数值**（而非仅顺序）的路径（见本节第 1 条）。

---

## 3. 存量数据：**无法恢复**

- 我们库现有 6 条公式：`123` / `推拉` / `33333` / `测试移门A` / `测试亮窗2格` / `带量子`
- 全部是**通过 UI 手工创建**的（`backend` 无公式导入端点、迁移里无种子；创建时间跨 2026-08-21 与 2026-09-09）
- 与原版抓取对照：**只有 `推拉` 能对上，且部件数不一致**（原版 32 / 我们 31）

⇒ **没有顺序来源，存量无法还原**。好在其中多数是测试数据。

**修复的意义转向「未来」**：当从原版系统导入真实公式时，把顺序**完整落库**。

---

## 4. 修复方案：**`extra._keyOrder` 数组**（= **原版自己的机制**），非 A

### 4.1 方案 A（改 `json` 列 + `preserve_order`）—— **实测不可行** ❌

原设想：① 后端开 `serde_json` 的 `preserve_order`；② `formulas.parts` 由 `jsonb` 改 `json`。
实测否掉了它：

| 实测 | 命令 | 结果 |
|---|---|---|
| `json` 列本身**确实保序** | `INSERT ... ('{"zeta":1,"alpha":2,"zz":3,"ab":4}'::json)` | 原样保留 ✅ |
| `jsonb` 列**重排对象键** | 同串 `::jsonb` | `{"ab":4,"zz":3,"zeta":1,"alpha":2}` ❌ |
| **`jsonb::json` 转换不恢复顺序** | `(b::json)::text` | 仍是 jsonb 的乱序 ❌ |
| **sqlx 以 jsonb OID 发参数** | `sqlx-postgres-0.8.6/src/types/json.rs:19` `type_info() → PgTypeInfo::JSONB` | 参数进 PG 前**已按 jsonb 解析** → 顺序在入库前就丢了 ❌ |
| `text` 参数写 `json` 列 | `PREPARE ins(text) AS INSERT INTO t2 VALUES ($1)` | **直接报错**（无 text→json 赋值转换）❌ |

⇒ 即使把列改成 `json`，sqlx 仍以 **jsonb** 语义发送/解析参数，顺序照样丢；
要绕开只能把所有写入点改成「绑 text + 显式 `$1::json`」，**改动面大且脆**。

### 4.2 方案 B（`extra._keyOrder: string[]`）—— **推荐** ✅

> 🔴 **重大发现：这就是原版自己的做法。** 字段名、机制、连过滤的元数据键都是照抄原文：
>
> ```js
> // 写（Diao.deobfuscated.js @141718，保存公式时）
> const a = 部件列表.value.map(a => a.name).filter(e => e)
> const t = { ...extra.value }
> t._keyOrder = a                                  // ★ 把「部件名数组」写进 _keyOrder
>
> // 读（@149913，加载公式时）—— 据此**重建编辑器行序**
> const a = l["diao"]._keyOrder || []
> delete l["diao"]._keyOrder                        // 当元数据摘掉
> c = a.filter(e => e !== "_keyOrder" && e !== "挖孔图" && e !== "公式类型")
>      .map(e => ({ id:…, materialName: l["diao"][e].materialName, … }))
> ```
>
> 遍历部件时一律跳过这三个元数据键：`Diao.deobfuscated.js` @125457/@149959 的
> `filter(e => e !== "_keyOrder" && e !== "挖孔图" && e !== "公式类型")`；
> `Hui-d088417c.js` @320257 的 `if ("_keyOrder" === x) return`。
>
> 并且**原版抓取文件里每条公式都带 `_keyOrder`**（`legacy/data/original-formulas.json`
> 的 `parts._keyOrder`，是**数组**、与其对象键序完全一致）—— 原版同样撞上了 jsonb 丢序，
> 也用「额外存一个数组」解决。**我们的修复与原版逐字同构。**

**关键实测**：`jsonb` **只重排对象键，数组保持有序**

```
数组在 jsonb 里 : ["zeta", "alpha", "zz", "ab"]   ← 顺序完整保留
```

同理 `serde_json::Value::Array` 是 `Vec`（有序），**只有 `Object`（`BTreeMap`）会被排序**。
⇒ 把顺序存成**数组**，就同时绕过两道重排，**既不用改列类型、也不用开 `preserve_order`**。

做法：
1. `formulas.extra` 里加 `_keyOrder: string[]`（**原版字段名**；写入时取 `Object.keys(parts)`）
2. 渲染侧（`computeParts` 出口）按 `_keyOrder` 排一次；缺 `_keyOrder` 时退回现状
3. 前端 `Formulas.vue` 保存时把 `Object.keys(parts)` 一并提交

### 4.3 连带检查点

- `computeParts` 的出口排序即可覆盖全部下游（本文件 §2.1 的 7 个调用点都从它拿 parts）
- 后端 `extra` 已是 jsonb —— 数组在其中保序 ✅
- 后端**无任何 jsonb 专有算子**（已核实：全仓 `->>` / `@>` / `jsonb_*` 命中 0），故不改列类型也无连带风险
- **同类问题排查（已完成，见 §4.5）**

### 4.4 数据迁移

存量公式**没有顺序来源**（§3），B 也救不回存量（我们库里 6 条公式的 `parts` 均无 `_keyOrder`）；
但 B 的价值在于**导入链路**：从原版抓取时把 `Object.keys(parts)` 的**声明序**一并写进 `partOrder`，
从此不再丢。

### 4.5 同类问题排查（全库 JSON/JSONB 列逐列判定，2026-09-15）

遍历 `information_schema` 取全部 8 个 `json/jsonb` 列，逐列判定「顶层是对象还是数组」+「顺序是否被消费」：

| 列 | 顶层类型 | 顺序被消费？ | 判定 |
|---|---|---|---|
| **`formulas.parts`** | **对象** | ✅ 被消费（打印列序 + `applyWidthIncrement` 状态位 `a`）| ❌ **有问题 → 本文件已修** |
| `formulas.extra` | 对象 | ❌ **全按名访问**（`resetSize`/`widthIncrement`/`TaoDong`/`hinge` 均按键取；`applyHinge` 用 `items.find(it=>it.includes('合页'))`）| ✅ 安全 |
| `order_lines.parts` | **数组** | ✅ 被消费（`partsTooltip` 的 `.map` 显示序）| ✅ 数组在 JSONB 里保序 → 安全 |
| `order_lines.markup` | **数组** | ✅ 被消费（`markupNames` 的 `.map` 拼接序）| ✅ 同上 → 安全 |
| `print_templates.template` | 对象 | 顺序敏感部分**全是数组**（`config.panels`、`panels[].printElements`）| ✅ 安全 |
| `column_configs.ping_columns` / `diao_columns` | 对象 | ❌ 按名（`colVis` = `map[key] !== false`）| ✅ 安全 |
| `profile_prices.lock_rules` | 数组 | ✅ 被消费（锁具候选序，`rememberLocks`）| ✅ 安全 |

**结论：全库只有 `formulas.parts` 一列满足「对象（丢序）+ 顺序被消费」这个组合，即本文件所述问题；其余列要么是数组（JSONB 保序），要么是纯按名访问 —— 均无需改动。**

---

## 5. 待办

- 🌟 **额外收获**：`_keyOrder` 是原版字段名 ⇒ **导入原版公式时其顺序直接可用**，无需另建映射
- [ ] `computeParts` 出口按 `partOrder` 排序（缺省退回现状，不改变未迁移数据的行为）
- [ ] 修复后：用一张部件数多、关键词命中多的公式端到端验证列内顺序
      （移门外框应为 `边封 → 上滑 → 下滑 → …`）

> **原「方案 A」条目已撤销** —— 见 §4.1：sqlx 以 jsonb OID 发参，改列类型无法保序。
