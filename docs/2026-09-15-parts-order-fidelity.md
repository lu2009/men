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

> 未核实（本表未覆盖，勿当结论）：D吊 windows 的「三段式 + 关键词下标 priority 排序」具体实现、
> L1/L2 与 `lable`/`lableForMaterial` 的字段拼装、`kou` 列。

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

## 3. 存量数据：**无法恢复**

- 我们库现有 6 条公式：`123` / `推拉` / `33333` / `测试移门A` / `测试亮窗2格` / `带量子`
- 全部是**通过 UI 手工创建**的（`backend` 无公式导入端点、迁移里无种子；创建时间跨 2026-08-21 与 2026-09-09）
- 与原版抓取对照：**只有 `推拉` 能对上，且部件数不一致**（原版 32 / 我们 31）

⇒ **没有顺序来源，存量无法还原**。好在其中多数是测试数据。

**修复的意义转向「未来」**：当从原版系统导入真实公式时，把顺序**完整落库**。

---

## 4. 修复方案（已确认）

**必须同时做两件事，缺一不可：**

1. **后端开 `serde_json` 的 `preserve_order`**
   `backend/Cargo.toml`：`serde_json = { version = "1", features = ["preserve_order"] }`
   → `Value::Object` 由 `BTreeMap` 变 `IndexMap`，反序列化不再排序。
2. **`formulas.parts` 由 `jsonb` 改 `json`**
   迁移：`ALTER TABLE formulas ALTER COLUMN parts TYPE json USING parts::json;`
   → `json` 保留文本原文顺序。

**只做第 2 步不够**（serde_json 那层仍会排序）；**只做第 1 步也不够**（jsonb 仍会重排）。

### 连带检查点

- 后端**所有**读写 `parts` 的地方（`backend/src/modules/formula/service.rs` 的 SELECT 列、
  `Value` 绑定、INSERT/UPDATE；`orders/`、`catalog/` 是否也碰 `parts`）
- 是否有 SQL 用到 jsonb 专有算子（`->>`、`@>`、`jsonb_object_keys`、jsonb 索引）—— 改 `json` 后这些会失效
- 前端 `Formulas.vue` 提交 `parts: JSON.parse(JSON.stringify(parts))`（对象序在报文里是对的，问题在后端侧）
- 打印模板 `formulas.parts` 之外，**套线/五金等其它以对象存储的字段**是否有同类问题

### 数据迁移

存量无法还原；待导入真实公式时，**确保导入链路是「有序对象 → preserve_order → json 列」**，
即可从源头保住声明序。

---

## 5. 待办

- [ ] 后端 `serde_json` 开 `preserve_order`
- [ ] 迁移：`formulas.parts` → `json`
- [ ] 复查所有 `parts` 读写点与 jsonb 专有算子
- [ ] 修复后：用一张部件数多、关键词命中多的公式（如 32 部件的移门公式）端到端验证列内顺序
