# 收据单2 · 配置与持久化模型（分工 1）

源文件：`/Users/aaa/Desktop/door-main/legacy/js/Receipt2.deobfuscated.js`（2637 行）
所有行号均指该文件。标注 **CONFIRMED** = 直接读到；**INTERPRETED** = 推断（附依据）。

---

## 0. 先纠正三个前提

### 0.1 `a` 不是「10 个字段的默认 X 坐标」，是**表格 10 列的默认宽度（%）** — CONFIRMED

`a`（L11）只被用在三处，全部是列宽语义：

- L12 `n = Vue.ref([...a])` —— `n` 就是列宽数组。
- L389–408（`ue()` 生成的 CSS）把 `n.value[0..9]` 写成 `th:nth-child(k){width:N%}`。
- L1083–1085（`onMounted` 读 `da`）校验 `l.length === a.length`，再 `Math.max(3, Number(e) || 3)`。

数值自证：`13.2+4.2+6.6+12.1+13.6+4+4.4+5.4+22.8+13.5 = 99.8`（≈100%）。X 偏移是另一套东西，
存在 `receipt2_element_configs`（`b`）里，且**每元素独立**，不存在「10 个数的默认 X 数组」。

对应的 10 列由 L440 `re()` 的表头确定：
`型材 / 开向 / 颜色 / 玻璃 / 尺寸 / 数量 / 单价 / 金额 / 计价方式 / 备注`。

> 注意：`x`（L80–91）也是 10 个 key，但那是**元素显隐**的 10 个元素，和表格列**无关**。
> 两处都是 10 项纯属巧合，别混。

### 0.2 字号是**六个**，你给的清单漏了 `metaFontSize` — CONFIRMED

`u`（L13–20）有 6 个 key，`Z()`（L252–289）逐个 clamp。详见 §2。

### 0.3 localStorage 是 **7 个**键，不是 8 个 — CONFIRMED

全文件 `localStorage` 共 14 处调用（L141/179/219/833/837/841/845/938/1022/1034/1046/1063/1080/1093），
去重后 **7 个 key**，且**没有任何 `removeItem` / `sessionStorage`**。详见 §5。

---

## 1. 纸型预设 `d` / `V` / `X` / `i`

### 1.1 `d` —— 预设表（L25–50）CONFIRMED

| key | widthMm | heightMm | orientation | UI 按钮文案 |
|---|---|---|---|---|
| `pin-210-140` | 210 | 140 | landscape | 「210×140」L1731 |
| `pin-200-140` | 200 | 140 | landscape | 「200×140」L1750 |
| `pin-210-90` | 210 | 90 | landscape | 「210×90」L1769 |
| `pin-200-90` | 200 | 90 | landscape | 「200×90」L1788 |
| `a4-landscape` | 297 | 210 | landscape | 「A4横向」L1807 |
| `a4-portrait` | 210 | 297 | portrait | 「A4纵向」L1826 |
| `a5-landscape` | 210 | 148 | landscape | 「A5横向」L1845 |
| `a5-portrait` | 148 | 210 | portrait | 「A5纵向」L1864 |

8 项，按钮顺序即上表顺序（L1717–1871 的按钮组，label「常用尺寸」L1714）。8 个按钮全部是
`size:"small"` + 文字，**无选中态高亮**（没有 `type` / `disabled` 绑定）—— 点一下就写入 `p`，
当前纸型是否等于某预设，代码里不维护也不显示。

### 1.2 `V(key)` —— 应用预设（L51–57）CONFIRMED

```js
V = (e) => { const t = l, o = d[e];
  p["value"]["widthMm"] = o["widthMm"]; ... }
```
只写 `p`（printSettings **草稿**，不是已生效的 `h`），写 3 个字段：`widthMm` / `heightMm` /
`orientation`（`orientation` 这一处非计算属性写法，但等价）。**注意没有 `copies`**，`copies` 保留不动。
必须点「保存」才落到 `h` 和 localStorage。
`V` 在 L1724/1743/1762/1781/1800/1819/1838/1857 被按钮调用，共 8 处。

### 1.3 `X(raw)` —— 校验 / 兜底（L290–306）CONFIRMED

```js
const o = K(e?.copies,   1,  99, s.copies);   // s = 默认 {copies:1,widthMm:200,heightMm:140,orientation:"landscape"}
const a = K(e?.widthMm,  50, 500, s.widthMm);
const n = K(e?.heightMm, 50, 500, s.heightMm);
const u = t(a >= n ? 385 : 659);              // t 是解码器：_o(385)="landscape", _o(659)="portrait"
return { copies, widthMm, heightMm, orientation:
  (e?.orientation === "landscape" || e?.orientation === "portrait") ? e.orientation : u };
```

关键点（**§9 实测修正**）：**已存的合法 orientation 优先，反推只是兜底**。
`e.orientation` 只要恰好等于 `"landscape"` 或 `"portrait"` 就**原样保留，哪怕它和尺寸矛盾**；
只有缺失 / `null` / `""` / 大小写不符 / 其它非法值时，才用 `宽≥高 ? landscape : portrait` 反推。
（我最初写的「orientation 是从尺寸反推的，不是照抄」**是错的**，已由 §9 实跑推翻。）
相等时走 `landscape`（`a >= n` 为真）。
`X` 的返回值**只有这 4 个字段**，多余字段被丢弃。
注意 L295 的 `t` 是本作用域内的 `l`（解码器别名），所以 `385/659` 是字符串下标，已解码验证。

### 1.4 按尺寸找预设 key（L682–692）CONFIRMED

```js
const o = Object.entries(d).find(([, l]) =>
  e.orientation === l.orientation && Q(e.widthMm, l.widthMm) && Q(e.heightMm, l.heightMm));
return o ? o[0] : "custom";
```
`Q(a,b,tol=2) = Math.abs(a-b) <= 2`（L307）。**容差 2mm**。找不到返回字面量 `"custom"`。

⚠️ 这个「找预设」的结果**只用于分页**（L667–692 的 `i`，喂给 L693 的可用高度计算），
**不参与配置、不落盘、不上 UI**。此函数在 §6 的持久化模型里没有位置。

### 1.5 由此得到的关键推论 — INTERPRETED

预设 key 字符串（`pin-*` / `a4-*` / `a5-*`）**从不持久化**。落盘的只有 4 个原始字段。
所以新建 TypeScript 模型时不需要存 `presetKey`；UI 的「高亮当前预设」是新版可以自由加的东西
（旧版没有）。依据：`X` 的返回值不含 key，且 `d` 只在 L53 / L684 被读。

---

## 2. 字号默认值 `u` 与 clamp `K`

### 2.1 `u`（L13–20）CONFIRMED

```js
u = { headerFontSize:30, tableFontSize:15, amountFontSize:20,
      metaFontSize:18, declarationFontSize:15, orderDateFontSize:13 }
```

### 2.2 `K(v,min,max,fallback)`（L245–251）CONFIRMED

```js
K = (e, t, o, a) => { const u = Number(e);
  return Number.isFinite(u) ? Math.max(t, Math.min(o, Math.round(u))) : a; };
```
要点：**四舍五入成整数**（`Math.round`，半值朝 +∞：`13.5→14`、`14.5→15`）。
只有 `Number(e)` 非有限时才返回 fallback。**关键是 `Number()` 的强制转换规则会「吃掉」很多东西**：

| 输入 | `Number(e)` | 结果 | 说明 |
|---|---|---|---|
| `""` | `0` | **min** | ⚠️ 实测 14，不是 30 |
| `null` | `0` | **min** | ⚠️ **我最初把 `null` 归进「返回 fallback」是错的**，见 §9 |
| `[]` | `0` | **min** | 同上 |
| `false` | `0` | **min** | 同上 |
| `true` | `1` | **min** | |
| `[20]` | `20` | 20 | 单元素数组被转成数字 |
| `"24"` | `24` | 24 | 数字字符串被接受 |
| `"abc"` | `NaN` | fallback | |
| `undefined` | `NaN` | fallback | 缺字段是这条路 |
| `NaN` | `NaN` | fallback | |
| `Infinity` / `-Infinity` | ±∞ | fallback | |
| `-5` | `-5` | min | |
| `1e9` | `1e9` | max | |

⚠️ **生产影响（CONFIRMED，真实可达）**：`JSON.stringify` 保留 `null`，且 Element Plus 的
`el-input-number` 被清空时会 emit `null`/`undefined`。若 emit 的是 `null`，
`Z()` 会把它当成 `0` 并 **clamp 到 min**（品牌字体变 14，而不是默认 30）——
即「把输入框清空 → 字号跳到最小值」。新版若想表现成「清空=恢复默认」，必须自己判 `null`。

### 2.3 六个字号的 min/max/default 表 — CONFIRMED

| 字段 | 默认(L13–20) | min | max | 调用处(L) | UI 文案 | UI min/max(L) |
|---|---|---|---|---|---|---|
| `headerFontSize` | 30 | 14 | 36 | 253–258 | 品牌字体 | 14 / 36 (1479/1480) |
| `orderDateFontSize` | 13 | 8 | 18 | 283–288 | 编号日期字体 | 8 / 18 (1503/1504) |
| `tableFontSize` | 15 | 8 | 18 | 259–264 | 表格字体 | 8 / 18 (1528/1529) |
| `amountFontSize` | 20 | 16 | 40 | 265–270 | 金额字体 | 16 / 40 (1553/1554) |
| `metaFontSize` | 18 | 8 | 18 | 271–276 | 基础信息字体 | 8 / 18 (1578/1579) |
| `declarationFontSize` | 15 | 8 | 18 | 277–282 | 说明字体 | 8 / 18 (1604/1605) |

「品牌字体」实际控制的是**标题**字号（CSS `.receipt2-title`，L379）；`headerFontSize` 这名字有点误导。
UI 表里 6 项的顺序（L1440/1492/1517/1542/1567/1592 的 label）与 `u` 的声明顺序**不同**，
以 UI 顺序为准做界面即可。

`Z(raw)`（L252–289）就是「六项逐个 K」并返回**恰好这 6 个字段**的新对象，多余字段丢弃。
`Z` 是唯一的清洗入口：`onMounted` 读盘（L1025）、`he` 保存（L820）、`ge`/`ye`/`printFromContainer`
取生效值（L743/1229）都走它。

---

## 3. 元素显隐 `g` / `te` / `M` / `L` / `b`

### 3.1 `g` —— 默认显隐（L58–72）CONFIRMED

```js
g = {
  showOrderNo:!0, showDate:!0, showQrcode:!0, showClient:!0, showTel:!0,
  showAddress:!0, showProductionDays:!0, showAmounts:!0, showDeclaration:!0,
  orderNoPosition:"left", datePosition:"right", qrcodePosition:"right",
  metaOrder: ["client","tel","address","productionDays"],
}
```
9 个布尔 + 3 个位置 + 1 个顺序数组，共 13 个字段。

⚠️ 三个 position 的默认**不一致**：`orderNoPosition:"left"`，`datePosition:"right"`，
`qrcodePosition:"right"`。照抄。

### 3.2 `te(raw)` —— 归一化（L324–349）CONFIRMED

```js
const o = { ...g };                            // 从默认起
for (const a of [9 个 showXxx])  typeof e[a]==="boolean" && (o[a]=e[a]);
for (const a of ["orderNoPosition","datePosition","qrcodePosition"])
                                R.includes(e[a]) && (o[a]=e[a]);   // R = ["left","right"] (L308)
if (Array.isArray(e.metaOrder)) {
  const l = e.metaOrder.filter(x => F.includes(x));    // F = ["client","tel","address","productionDays"] (L309)
  const a = F.filter(x => !l.includes(x));
  o.metaOrder = [...l, ...a];                          // 有效的在前（保持存的顺序），缺的按 F 顺序补尾
}
```

行为细节：
- 布尔只认 `typeof === "boolean"`；`0/1/"true"` 一律**忽略**并走默认 `true`。
- position 只认 `"left"`/`"right"`，其它值忽略走默认。
- `metaOrder` 归一化：先过滤出合法项（**保持已存顺序**），再把 `F` 中缺席的按 `F` 顺序**追加到尾部**。
  当输入本身无重复时，结果恰好是 `F` 的一个排列；**但若输入含重复项，结果会长于 4**
  （见下方「边缘 bug」，§9 已实证 —— 「结果永远是 F 的某个排列」这句对含重复的输入**不成立**）。

**边缘 bug — CONFIRMED（§9 实跑，我原来的 INTERPRETED 推断完全正确）**：
`filter(x => F.includes(x))` **不去重**，重复项原样保留，缺失项照样补尾。
实测 `["client","client"]` → `["client","client","tel","address","productionDays"]`（**长度 5**）；
`["client","client","client","tel"]` → 长度 **6**。渲染侧 L553 会把客户渲染多次。
旧版没防，新版建议加一道 `new Set` 去重。

其它实测边界：`[]` → 补成完整 `F`（长度 4，等于默认）；`["address"]` → `["address","client","tel","productionDays"]`
（**存的顺序优先，缺的按 F 顺序补尾**）；`["非法值","tel"]` 与 `[1,"tel"]` → `["tel","client","address","productionDays"]`
（非字符串/非法值被 `F.includes` 静默丢弃）；非数组（含 `undefined`）→ 走默认。

### 3.3 `M(cfg)` —— 单元素 → 内联 style（L104–124）CONFIRMED

```js
const o = [];
e.visible || o.push("display:none");
(0 !== e.offsetXMm || 0 !== e.offsetYMm) && o.push(
  "position:relative;left:"+e.offsetXMm+"mm;top:"+e.offsetYMm+"mm;z-index:10");
e.fontSize > 0 && o.push("font-size:"+e.fontSize+"px");
e.widthMm > 0 && o.push("width:"+e.widthMm+"mm;max-width:"+e.widthMm+"mm");
return o.join(";");
```
要点：
- `visible:false` **不 return**，只加 `display:none` —— 元素仍在 DOM 里占位（`ce()` 仍输出 `data-r2-el`），
  这也是元素编辑器还能点到隐藏元素的前提。
- 偏移只在「两个都为 0」时才不加，**只要有一个非 0 就同时输出 left/top**。
- `fontSize`/`widthMm` 的 `>0` 判断意味着 **0 = 「不覆盖，用 CSS 默认」**（UI 上标了「0=默认」，L2522/2562）。
- `M("")`（全 0 且 visible）返回 `""`，`ce()`（L463–469）此时只输出 `data-r2-el="..."` 不带 style 属性。

### 3.4 `L()` —— 生成默认 elementConfigs（L125–136）CONFIRMED

```js
L = () => { const e = {};
  for (const t of x) e[t] = { offsetXMm:0, offsetYMm:0, fontSize:0, widthMm:0, visible:!0 };
  return e; }
```
十个元素**全部**是同一份零值。`b = Vue.ref(L())`（L137）。

### 3.5 `x`（元素 key，有序）与 `B`（中文名）— CONFIRMED

`x`（L80–91），顺序有意义（编辑器默认展示顺序，也是 D() 遍历顺序）：

| # | key | `B[key]` 中文 | 渲染位置 |
|---|---|---|---|
| 1 | `orderNo` | 编号 | 头部（左右由 `orderNoPosition` 定） |
| 2 | `date` | 日期 | 头部（`datePosition`） |
| 3 | `title` | 品牌标题 | 头部中央 L565 |
| 4 | `qrcode` | 二维码 | 头部（`qrcodePosition`） |
| 5 | `client` | 客户 | meta 行 L521 |
| 6 | `tel` | 电话 | meta 行 L527 |
| 7 | `address` | 安装地址 | meta 行 L533（**渲染用 `e["安装地址"]` 中文 key，不是 `e.address`！**） |
| 8 | `productionDays` | 生产天数 | meta 行 L539 |
| 9 | `amounts` | 金额 | 底部 L584 |
| 10 | `declaration` | 说明 | 底部 L594 |

`B` 是 L92–103 的常量对象。它同时被 `Ce`（L955/963）和编辑器标题（L2434）当**校验表/显示名**用：
`if (!B[a]) return` —— 所以 `B` 的 key 集合 = 合法的 `data-r2-el` 值集合 = `x` 的集合。

> 顺带（属于渲染组，但与配置强相关）：`address` 用的数据字段是中文 `安装地址`（L537），
> 而配置 key 是英文 `address`；`client`/`tel`/`productionDays` 则用同名英文字段。这是旧数据契约。

### 3.6 `R` / `F` / `$` / `x` / `B` 常量表汇总 — CONFIRMED

| 变量 | 行 | 内容 | 用途 |
|---|---|---|---|
| `x` | L80–91 | 10 个元素 key 数组 | 生成 `b` 的遍历源；`B`/编辑器共用 |
| `B` | L92–103 | key → 中文（10 项） | 元素合法性校验 + 编辑器标题 |
| `R` | L308 | `["left","right"]` | position 字段的合法值 |
| `F` | L309 | `["client","tel","address","productionDays"]` | meta 行元素 + metaOrder 的合法值/规范顺序 |
| `$` | L310–315 | `client/tel/address/productionDays` → 中文 | metaOrder 拖拽列表的标签（L2161） |

注意 `F`/`$` 是 `x`/`B` 的**子集**（meta 那 4 项），专门给「metaOrder 排序」用。
`R` 只在 `te`（L341）里用到一次。

### 3.7 `ee(idx, delta)` —— metaOrder 上下移（L316–323）CONFIRMED

```js
const a = [...z.value.metaOrder], n = e + t;
n < 0 || n >= a.length || ([a[e],a[n]]=[a[n],a[e]], z.value.metaOrder = a);
```
写的是**草稿 `z`**，不是已生效的 `C`。越界直接静默忽略。
`z` 用整体替换 `z.value = a` 触发响应式（因为 `ee` 拿的是外层 `z`，不是 `l`）。

---

## 4. 元素编辑器状态机（`k` / `P` / `I` / `U` / `S` / `T`）

这一节是「暂存副本 vs 已生效」最典型的例子，实现时别搞混。

| 变量 | 行 | 含义 | CONFIRMED 依据 |
|---|---|---|---|
| `b` | L137 | **已生效的** elementConfigs（全 10 元素），唯一持久化源 | L993 保存时才写、L179 落盘 |
| `k` | L181 | 当前编辑的元素 key；`null` = 编辑器关闭 | L973 打开、L995/1006/1144 关闭 |
| `I` | L189–195 | **打开编辑器那一刻的快照**（用于「取消」还原） | L981 `I.value = {...i}` |
| `P` | L182–188 | **编辑中的暂存值**，`watch(P, deep)` 实时打到 DOM | L981 `P.value={...i}`；L205–211 |
| `U` | L196 | 弹窗定位 `{top,left}` | L972 |
| `S` | L197 | 预览容器 DOM（事件委托目标） | L986 |
| `T` | L198 | 当前被编辑的元素 DOM 节点 | L981 `T = o` |

流程（全部 CONFIRMED）：
1. **点开** `Ce(e)` L947–982：从 `e.target.closest("[data-r2-el]")` 找节点；找不到时用
   `document.elementsFromPoint` 兜底（L951–960，为了穿透遮罩/叠加层）。取 `data-r2-el`，
   `!B[a]` 则忽略（L963）。算 popover 位置：默认 `bottom+8`，下方放不下则翻到上方；
   右侧超出视口则左移（L966–971）。然后
   `i = b.value[a] || {零值}`（**注意这里 local 变量名 `i` 遮蔽了外层的品牌 `i`**，L974–980），
   `I.value = {...i}; P.value = {...i}; T = o`。
2. **编辑中**：`watch(P, Y, {deep:true})`（L205–211）→ `Y()`（L199–204）把 `M(P.value)`
   写成 `T.setAttribute("style", ...)`，`M` 返回空串时 `removeAttribute("style")`。
   **所以编辑器是所见即所得的实时预览，直接改 DOM，不重渲染整个预览。**
3. **确认** `xe()` L989–1003：`b.value = {...b.value, [k]: {...P.value}}` → `A()`（落盘 `ya`）
   → 清 `k`/`T` → 若组件处于激活态则 `ve()` 重建预览 + `requestAnimationFrame` 后
   `pe(S); ze(S)`（因为整块 HTML 换了，列宽手柄和点击监听都要重挂）。
4. **取消** `Be()` L1004–1007：`P.value = {...I.value}`（还原现实 DOM）→ `Y()` → 清 `k`/`T`。
   **`b` 不动，不落盘。** 也绑定了遮罩点击（L2415，`@click.self`）。
5. **重置** `Me()` L1008–1016：只把 `P` 置成零值对象（不改 `I`，不落盘）。
   之后点「确认」才会以零值写入 `b`。
6. **全部重置** `resetAllElementConfigs()` L1147–1153（expose）：`b.value = L()` → `A()` → 刷新预览。

`destroyElementEditor()` L1141–1146：解绑 `S` 上的 click、清 `k`/`T`。

> 实现提示：`Ce` 里那个「local `i` 遮蔽外层品牌 `i`」在 deobfuscate 后仍然保留（L474 vs L976），
> 重写时请给它们不同名字（如 `config` vs `brand`）。

---

## 5. localStorage：7 个键

### 5.1 键名表 — CONFIRMED（key 字符串由 `_o(idx)` 解码核实）

| 变量 | 实际 key 字符串 | 解码来源 | 存储内容 | 写 | 读 |
|---|---|---|---|---|---|
| `sa` | `receipt2_font_settings` | `_o(412)` | `v`（已清洗的字号对象） | L837 | L1022 |
| `ma` | `receipt2_print_settings` | `_o(700)` | `h`（纸型 + 份数） | L841 | L1034 |
| `wa` | `receipt2_visibility_settings` | `_o(361)` | `C`（显隐 + 位置 + metaOrder） | L845 | L1046 |
| `ga` | `receipt2_brand_settings` | 字面量 | `i`（品牌开关/名称） | L833 | L1063 |
| `ya` | `receipt2_element_configs` | 字面量 | `b`（10 元素几何配置） | L179 | L141 |
| `da` | `receipt2_column_widths` | `_o(677)` | `n`（10 列百分比） | L938 | L1080 |
| `Va` | `receipt2_selected_printer` | `_o(672)` | `H`（打印机名**裸字符串，非 JSON**） | L219 | L1093 |

八个「等」是不存在的 —— 全量 grep 只有这 7 个。

`sa`/`da`/`Va`/`ma`/`wa` 在源码里是模块级常量（组件外），deobfuscate 时未内联；
我用 `legacy/decode-token.mjs _o <idx>` 还原。`ga`/`ya` 在原 bundle 里就是字面量。

### 5.2 写入时机 — CONFIRMED

- **只有「保存」按钮（`he`, L817–850）会写 `ga`/`sa`/`ma`/`wa` 四个键**，且是**一次写四发**（L831–846）。
  四个 `(() => {...})()` IIFE 是 deobfuscate 残留（原代码包了 `const e = l` 别名），行为上就是顺序 `setItem`。
- `he` 的完整顺序（重要，照抄）：
  1. `v = Z(f)`（清洗草稿字号）→ `f = {...v}`
  2. `h = X(p)`（清洗草稿纸型）→ `p = {...h}`
  3. `C = te(z)`（归一化草稿显隐）→ `z = {...C, metaOrder:[...C.metaOrder]}`
  4. `i = { enabled: c.enabled, name: c.value.name.trim() }` → `c = {...i}`（**名称 `trim()`**，L828）
  5. `setItem(ga/sa/ma/wa)`
  6. `y.value = false`（关对话框）
  7. 若 `isReceipt2Active()` 则 `await ve()` 刷新预览
  用 `?.(...)` 可选调用，`isReceipt2Active` 没传就跳过刷新。
- `ya`（元素配置）：`A()`（L177–180）在 **`xe` 确认**（L994）和 **`resetAllElementConfigs`**（L1150）时写，
  不走 `he`。
- `da`（列宽）：**只在拖拽结束时**写（L936–939 的 mouseup 处理器内），且是**拖一次写一次**，
  没有「保存」确认步骤。
- `Va`（打印机）：`j()`（L216–221）是 `el-select` 的 `@change`（L2286），选中即写；
  `H` 的 `v-model`（L2279–2281）改值本身不写，靠 `onChange` 落盘。**用空 `try{}catch{}` 吞异常**
  （L220，localStorage 满/被禁时不报错）。

### 5.3 `onMounted` 载入顺序（L1018–1095）CONFIRMED

严格按此顺序，7 步：

1. `sa` → `Z(JSON.parse(t))` → `v`；**同时** `f = {...v}`。无值/异常 → `v = f = {...u}`。（L1019–1030）
2. `ma` → `X(JSON.parse(t))` → `h`，`p = {...h}`。无值/异常 → `h = p = {...s}`。（L1031–1042）
3. `wa` → `te(JSON.parse(t))` → `C`，`z = {...C, metaOrder:[...C.metaOrder]}`。
   无值/异常 → `C = z = {...g, metaOrder:[...g.metaOrder]}`。（L1043–1059）
4. `ga` → **手工**校验：`{ enabled: !!l.enabled, name: typeof l.name === "string" ? l.name : "" }` → `i`，`c = {...i}`。
   无值 → `i = c = {...r}`（`r = {enabled:false, name:""}`, L21）。（L1060–1075）
   ⚠️ 这里的 `enabled` 用 `!!` 强转（不是 `te` 那样只认布尔），`name` **不 trim**（trim 只在保存时做）。
5. `D()`（L1076）→ 读 `ya`，走内联归一化器（L143–171）。
6. `da` → 必须是 `Array.isArray` 且 **`length === 10`** 才接受，逐项 `Math.max(3, Number(e) || 3)`；
   否则 `n = [...a]`。（L1077–1089）
7. `Va` → `H = localStorage.getItem(Va) || ""`。（L1090–1095）

**顺序无副作用耦合**（7 个互不依赖），但重写时保持这个顺序最省心。

### 5.4 `D()` —— 元素配置的载入归一化（L138–176）CONFIRMED

与 `te`/`X`/`Z` 风格一致：**先 `L()` 拿全零底，再逐 key 覆盖**。

```js
o = L();
if (e && typeof e === "object")
  for (const l of x)                                  // 只遍历 x 的 10 个 key
    if (e[l] && typeof e[l] === "object") {
      const a = e[l];
      o[l] = {
        offsetXMm: isFinite(Number(a.offsetXMm)) ? Number(a.offsetXMm) : 0,   // 无上下限
        offsetYMm: isFinite(Number(a.offsetYMm)) ? Number(a.offsetYMm) : 0,
        fontSize:  isFinite(Number(a.fontSize))  && a.fontSize  >= 0 ? Number(a.fontSize)  : 0,
        widthMm:   isFinite(Number(a.widthMm))   && a.widthMm   >= 0 ? Number(a.widthMm)   : 0,
        visible:   typeof a.visible !== "boolean" || a.visible,              // 非布尔当 true
      };
    }
```
- **`fontSize`/`widthMm` 只卡下界 0，无上界**（UI 上限 60 / 300，但读盘不校验）。
  **§9 实跑证实例：`fontSize:9999` 原样保留成 `9999`**，`widthMm:-5` → `0`。
- 数值用 `Number()` 强转后判 `isFinite`，所以**数字字符串会被接受**：
  `offsetXMm:"-3.5"` → `-3.5`（§9 实证）。非数字串 `"abc"` → `0`。
- 偏移**完全不限**，可为负。
- `visible` 的写法 `typeof x !== "boolean" || x`：非布尔一律 `true`（`"yes"` → `true`，§9 实证）。
- `x` 里**不在存盘数据中的 key 保持零值**（向前兼容：新增元素不会炸）；
  反过来，**存盘数据里多出的非法元素名会被静默丢弃**（`bogus` 不会出现在结果里，§9 实证）。
  结果对象的 key 数**恒为 10**。
- 子项为 `null` / 非对象 → 该项保持零值（不抛错）。
- 整体 `try/catch`，任何异常 → `b = L()`（**不是部分保留**，L173–175）。

### 5.5 汇总：可持久化的数据结构 — CONFIRMED

```ts
// receipt2_font_settings  (sa)
interface FontSettings {
  headerFontSize: number;      // 30, [14,36]
  tableFontSize: number;       // 15, [8,18]
  amountFontSize: number;      // 20, [16,40]
  metaFontSize: number;        // 18, [8,18]
  declarationFontSize: number; // 15, [8,18]
  orderDateFontSize: number;   // 13, [8,18]
}

// receipt2_print_settings  (ma)
interface PrintSettings {
  copies: number;        // 1, [1,99]
  widthMm: number;       // 200, [50,500]
  heightMm: number;      // 140, [50,500]
  orientation: 'landscape' | 'portrait';  // 'landscape'（由尺寸反推）
}

// receipt2_visibility_settings  (wa)
interface VisibilitySettings {
  showOrderNo: boolean;         // true
  showDate: boolean;            // true
  showQrcode: boolean;          // true
  showClient: boolean;          // true
  showTel: boolean;             // true
  showAddress: boolean;         // true
  showProductionDays: boolean;  // true
  showAmounts: boolean;         // true
  showDeclaration: boolean;     // true
  orderNoPosition: 'left' | 'right';   // 'left'
  datePosition: 'left' | 'right';      // 'right'
  qrcodePosition: 'left' | 'right';    // 'right'
  metaOrder: MetaKey[];                // ['client','tel','address','productionDays']
}
type MetaKey = 'client' | 'tel' | 'address' | 'productionDays';

// receipt2_brand_settings  (ga)
interface BrandSettings { enabled: boolean; name: string }   // {false, ""}；name 保存时 trim，≤40 字（UI maxlength，L1452）

// receipt2_element_configs  (ya)
type ElementKey = 'orderNo'|'date'|'title'|'qrcode'|'client'|'tel'
                | 'address'|'productionDays'|'amounts'|'declaration';
interface ElementConfig {
  offsetXMm: number;  // 0，无界（可负）
  offsetYMm: number;  // 0，无界（可负）
  fontSize: number;   // 0 = 用 CSS 默认；读盘只保 >=0，UI 限 [0,60]
  widthMm: number;    // 0 = 用 CSS 默认；读盘只保 >=0，UI 限 [0,300]
  visible: boolean;   // true
}
type ElementConfigs = Record<ElementKey, ElementConfig>;   // 读盘时缺的 key 补零值

// receipt2_column_widths  (da)
// number[10]，百分比，各项 >= 3；长度必须 === 10，否则整组丢弃
// 默认 [13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5]

// receipt2_selected_printer  (Va)
// 裸 string（非 JSON）；空串 = 系统默认。UI 占位符「使用系统默认打印机」(L2283)
```

**注意 `da` 是唯一「不是对象」的键**：直接 `JSON.stringify(number[])`，
且**唯一一个不经过 `Z`/`X`/`te` 风格清洗器**（清洗是 `onMounted` 里的匿名 IIFE，L1077–1089）。

---

## 6. 草稿 vs 生效：成对 ref 一览 — CONFIRMED

| 生效（渲染 + 落盘） | 草稿（对话框编辑） | 类型 | 生效值被谁读 |
|---|---|---|---|
| `v` (L74) | `f` (L75) | FontSettings | `Z(v.value)` → L743 `ye`、L1229 `printFromContainer`、L820 `he` |
| `h` (L76) | `p` (L77) | PrintSettings | `X(h.value)` → L635/651/691/751/1198/1234 |
| `C` (L78) | `z` (L79) | VisibilitySettings | `de` L477、`Ve` L581、`se` 间接 |
| `i` (L22) | `c` (L23) | BrandSettings | `de` L569（标题文字） |
| `b` (L137) | `P` (L182，另有快照 `I` L189) | ElementConfigs | `ce` L465、`se` L472 |
| `n` (L12) | —— 无草稿，直接改 | number[10] | `ue` L390–408（CSS） |
| `H` (L214) | —— 无草稿，选中即写 | string | L1119 `printDirect`、L1318 |

统一模式：
- **对话框打开**（`openFontDialog`, L1102–1112）：`f = {...v}`、`p = {...h}`、`c = {...i}`、
  `z = {...C, metaOrder:[...C.metaOrder]}`，`y = true`。
  （注意这里**没有** `b` 的草稿 —— 元素配置走独立 popover，见 §4。）
- **重置默认**（`fe`, L810–816）：`f = {...u}`、`p = {...s}`、`z = {...g, metaOrder:[...g.metaOrder]}`、
  `c = {...r}`。**只重置草稿，不落盘**，也不关对话框。
- **保存**（`he`, L817–850）：清洗 + 提交 + 写 4 个 key + 关框 + 刷新预览。
- **取消**：`y = false`（L1387）**直接丢弃草稿，不做任何还原** —— 因为生效值 `v/h/C/i`
  从未被草稿污染，所以不需要还原。这是本组件比 `P`/`I` 那套更简单的原因。

`metaOrder` 必须**浅拷贝数组**（`[...x.metaOrder]`）才能断开与生效值的引用共享 ——
L814/825/1049/1054/1056/1107 都显式做了这一步。`ee`（L322）也是整体替换数组。
重写时若用 `structuredClone` 或每次新建对象就没这个坑。

---

## 7. 其他与配置相关的常量/行为

- `s`（L24）：`{ copies:1, widthMm:200, heightMm:140, orientation:"landscape" }` —— 打印设置默认值。
  **默认纸型是 200×140 横向（≈ `pin-200-140`）**，工业针式纸。
- `u`（L13）是字号默认；`r`（L21）是品牌默认 `{enabled:false, name:""}`。三个默认对象
  `u`/`s`/`g` 在 `fe` 和 `onMounted` 的 catch 里被反复展开，**切勿原地修改**（都用 `{...}`）。
- `W`（L212）：`computed(() => !!window.electronAPI)`。**「打印份数」这一栏只在 Electron 下显示**
  （L2370 `W.value ? ... : createCommentVNode`），但 `copies` 字段和 clamp 在 Web 下依然存在并会落盘。
- `q`/`J`（L222–238）：打印机列表懒加载，仅 Electron；`J` 在对话框 `onOpen`（L1369）时触发。
  `O` = 打印机数组，`G` = 加载中。
- 元素编辑器 UI 的字段范围（L2445–2565）：X/Y 偏移 `step:0.5, precision:1`（**无 min/max**）、
  字体 `[0,60]` step 1、宽度 `[0,300]` step 0.5。这两个 UI 界与 §5.4 的读盘清洗**不一致**（读盘无上界）。
- 列宽拖拽（`pe`, L851–946）：只对前 9 个 `th` 挂手柄（L883 `u === a.length-1 → return`），
  拖动时**成对调整相邻两列**，各列下限 `Math.max(3, ...)`（L913–914），
  mouseup 时用 `getBoundingClientRect` 实测重算全部 10 列并 `Math.round(x*10)/10` 保留 1 位小数（L929–935）。

---

## 8. 未确认 / 存疑

1. **`Q` 的容差在其他地方是否被复用** —— `Q`（L307）只找到 L687/L688 两处调用（都在「找预设」里）。
   但 `Q` 是组件级的具名函数，不排除我 grep 漏了；已 grep `Q(` 全文件，未发现更多。**CONFIRMED 只有 2 处**。

2. **`I` 快照是否真能完整还原** —— `Be`（L1004）用 `P.value = {...I.value}` + `Y()` 还原 DOM 的
   `style` 属性。但 `Y()` 是 `setAttribute("style", M(P.value))`，会**整体覆盖**该节点的 style。
   `M` 只产出 `display/position/left/top/z-index/font-size/width/max-width` 这几种，
   而元素原本可能带 CSS 类来的样式（如 `.receipt2-qrcode` 的 `width:18mm`）。
   覆盖后 `width` 若被写成 `0`（即不输出），样式会回落到类定义 —— 逻辑上是对的，
   但**若元素还有别的内联 style 就会被抹掉**。据我所读，预渲染的 HTML 里没有别的内联 style
   （`ce()` L468 生成的就是 `M()` 的产物）。**INTERPRETED：当前无副作用，但重写时不要把别的内联样式混进这些节点。**

3. **`da` 长度校验写死 `a.length`（10）** —— 若将来列数变化，旧数据会被整体丢弃而不迁移（L1084）。
   这是现状，不是 bug，但如果新版要加列，**必须自己写迁移**。

4. ~~**`te` 的 `metaOrder` 重复项问题**~~ —— **已于 §9 实跑确认，不再是未确认项**（见 §3.2）。

5. **`sa`/`da`/`Va`/`ma`/`wa` 这 5 个常量的声明位置** —— 它们在 `Receipt2PrintManager` 组件**外部**
   （原 bundle 的模块作用域），deobfuscate 产物里直接引用但未声明。我通过
   `legacy/decode-token.mjs _o <idx>` 从 `/tmp/home-map.json` 拿到字符串值。
   如果 map 有误，这 5 个 key 名会跟着错；但 `ga`/`ya` 是原文字面量（L833/L141），可作交叉验证
   —— 两者命名风格完全一致（`receipt2_*`），所以映射可信度高。

6. **「重置默认」是否会重置 `b`（元素配置）** —— 不会。`fe`（L810–816）只碰 `f/p/z/c`；
   元素配置的重置是独立的 expose `resetAllElementConfigs`（L1147）。UI 上两处的按钮文案都是
   「重置默认」/「重置」，容易混，**新版建议改名区分**。

---

## 9. 实证验证（Node 实跑）

脚本：`/tmp/r2-analysis/verify.mjs`（主实验）+ `/tmp/r2-analysis/verify2.mjs`（null/强转补充）。
做法：把 `Receipt2.deobfuscated.js` 的 `K`/`Z`/`X`/`te`/`D`(内联归一化器)/`L`/`M`/`Q`/找预设
**原样复制**到 Node 里跑，连带模块级常量 `u`/`s`/`g`/`r`/`x`/`F`/`R`/`d`。唯一需要还原的是
L295 的解码器调用 `t(a >= n ? 385 : 659)`，用 `dec(i) = i===385 ? "landscape" : "portrait"` 代替
（字符串值已由 `decode-token.mjs` 独立核实）。未改任何产品代码。

### 9.1 三条与原文不符 / 需要更正 — 请优先看这里

| # | 结论 | 原表述 | 实测 | 处理 |
|---|---|---|---|---|
| **A** | `X()` 的 orientation 优先级 | 我写「**orientation 是从尺寸反推的**，不是照抄」 | **反了**：已存的合法值**优先保留**，反推只是兜底 | **已更正 §1.3** |
| **B** | `K()` 遇到 `null` | 我把 `null` 列进「返回 fallback」那一类 | `Number(null)===0` → **clamp 到 min（14）**，不是 fallback（30） | **已更正 §2.2** |
| **C** | `te()` 的 metaOrder 重复项 | 标 INTERPRETED，推断「长度变成 5」 | **实测长度就是 5**，推断完全正确 | INTERPRETED → **CONFIRMED**（§3.2） |

> A 和 B 是**实测推翻推断**的两条。A 尤其重要：它决定了「用户手改/迁移导入一个
> 尺寸与方向自相矛盾的配置」时新版该不该纠正 —— 旧版**不纠正**。

### 9.2 `te()` — metaOrder 归一化（逐条输入 → 实际输出）

| 输入 `metaOrder` | 实际产出 | len |
|---|---|---|
| `["client","client"]` | `["client","client","tel","address","productionDays"]` | **5** |
| `["client","client","client","tel"]` | `["client","client","client","tel","address","productionDays"]` | **6** |
| `["address"]` | `["address","client","tel","productionDays"]` | 4 |
| `[]` | `["client","tel","address","productionDays"]` | 4 |
| `["非法值","tel"]` | `["tel","client","address","productionDays"]` | 4 |
| `[1,"tel"]` | `["tel","client","address","productionDays"]` | 4 |
| `["productionDays","client","tel","address"]` | 同输入（已是合法排列，原序保留） | 4 |
| `"notanarray"` | `["client","tel","address","productionDays"]` | 4 |
| （字段缺失 `{}`） | `["client","tel","address","productionDays"]` | 4 |

结论：**不去重**（C 确认）；非法项静默丢弃；缺失项按 `F` 顺序补尾；非数组走默认。
渲染侧 L553 `for (const l of o.metaOrder) m[l] && V[l] && w.push(V[l]())` —— 重复 key 会被推两次。

### 9.3 `K()` 边界（对照 §2.2）

| 调用 | 实际输出 | 备注 |
|---|---|---|
| `K("", 14, 36, 30)` | **14** | 空串 → `Number("")===0` → clamp 到 min |
| `K("abc", 14, 36, 30)` | 30 | `NaN` → fallback |
| `K(NaN, 14, 36, 30)` | 30 | fallback |
| `K(null, 14, 36, 30)` | **14** | ⚠️ **B：不是 30** |
| `K(undefined, 14, 36, 30)` | 30 | fallback（缺字段走这条） |
| `K(14.5, 14, 36, 30)` | 15 | `Math.round` 半值朝 +∞ |
| `K(15.5, 14, 36, 30)` | 16 | 同上 |
| `K(13.5, 14, 36, 30)` | 14 | 先 round 到 14，再落在边界内 |
| `K(1/0, 14, 36, 30)` | 30 | `Infinity` 非有限 → fallback |
| `K(-1/0, 14, 36, 30)` | 30 | 同上 |
| `K(1e9, 14, 36, 30)` | 36 | 有限 → clamp 到 max |
| `K(-5, 14, 36, 30)` | 14 | clamp 到 min |

`null` 的真实可达性（补充脚本实测）：

| 调用 | 实际输出 |
|---|---|
| `Z({headerFontSize:null})` | `headerFontSize: **14**`（其余保持默认） |
| `Z({tableFontSize:null})` | `tableFontSize: **8**` |
| `Z({amountFontSize:null})` | `amountFontSize: **16**` |
| `Z({headerFontSize:"24"})` | `24`（数字字符串被接受） |
| `Z({headerFontSize:[]})` | `**14**`（`Number([])===0`） |
| `Z({headerFontSize:[20]})` | `20`（单元素数组） |
| `Z({headerFontSize:true})` | `**14**`（`Number(true)===1`） |
| `Z({headerFontSize:false})` | `**14**` |

**→ 「清空输入框 → 字号掉到最小值」是真实行为。** 新版若想要「清空=恢复默认」，
必须在 `Z()` 之前把 `null`/`""` 归一成 `undefined`。

### 9.4 `X()` — orientation 反推 vs 保留（§1.3 更正依据）

| 输入 | 实际输出 | 判定 |
|---|---|---|
| `{w:100,h:200,orientation:"landscape"}` | `orientation:"landscape"` | **合法值直接保留，哪怕与尺寸矛盾** |
| `{w:100,h:200,orientation:"portrait"}` | `orientation:"portrait"` | 保留 |
| `{w:100,h:200,orientation:"bogus"}` | `orientation:"portrait"` | 非法 → 反推（100<200） |
| `{w:100,h:200}`（无字段） | `orientation:"portrait"` | 缺失 → 反推 |
| `{w:200,h:200,orientation:"bogus"}` | `orientation:"landscape"` | **相等 → `a>=n` 为真 → landscape** |
| `{w:200,h:200}` | `orientation:"landscape"` | 同上 |
| `{w:200,h:140}` | `orientation:"landscape"` | 反推 |
| `{copies:0,w:10,h:9999}` | `{copies:1,w:50,h:500,orientation:"portrait"}` | 三项都被 clamp，`0` 是有限数→clamp 到 min |
| `{}` | `{copies:1,w:200,h:140,orientation:"landscape"}` | 全默认 |
| `{copies:null}` | `copies:1` | `0`→clamp 到 min 1 |
| `{w:null,h:null,orientation:null}` | `{w:50,h:50,orientation:"landscape"}` | 双 50 相等 → landscape |
| `{orientation:"LANDSCAPE"}` | `"landscape"` | 大小写敏感，不符 → 反推（默认 200×140） |
| `{orientation:""}` | `"landscape"` | 同上 |

### 9.5 找预设 / `Q()` 容差（§1.4）

| 调用 | 实际输出 |
|---|---|
| `findPreset({w:200,h:140,orientation:"landscape"})` | `"pin-200-140"` |
| `findPreset({w:202,h:140,orientation:"landscape"})` | `"pin-200-140"`（差 2 仍命中） |
| `findPreset({w:202.1,h:140,orientation:"landscape"})` | `"custom"`（差 2.1 落空） |
| `findPreset({w:210,h:140,orientation:"portrait"})` | `"custom"`（orientation 必须也相等） |
| `findPreset({w:148,h:210,orientation:"portrait"})` | `"a5-portrait"` |
| `Q(100.0, 102.0)` | **`true`** → 是 `<= 2` 不是 `< 2` |
| `Q(100.0, 102.1)` | `false` |
| `Q(100.0, 101.999999999)` | `true` |

`Object.entries` 顺序 = 声明顺序，所以**多个预设同时命中时取先声明的**
（例如 210×140 只会命中 `pin-210-140`，因为 `pin-200-140` 的宽差 10 超容差；此点由构造保证，未见冲突）。

### 9.6 `D_parse()` — 元素配置越界容错（§5.4）

输入 `{orderNo:{fontSize:9999, widthMm:-5, offsetXMm:"abc", visible:"yes"}}`
→ 产出 `orderNo = {offsetXMm:0, offsetYMm:0, fontSize:**9999**, widthMm:0, visible:**true**}`

| 检查 | 实测 |
|---|---|
| `fontSize:9999` 是否被截断 | **否，原样 9999**（读盘无上界，UI 上限 60 形同虚设） |
| `widthMm:-5` | `0`（负数被判 `>=0` 失败 → 归零，**不是 clamp 到 0 后再保留 -5**） |
| `offsetXMm:"abc"` | `0`（`NaN` → 归零） |
| `offsetXMm:"-3.5"` | **`-3.5`**（数字字符串被接受） |
| `visible:"yes"` | `true`（非布尔 → true） |
| `visible:false` | `false`（布尔被尊重） |
| 缺 key（只给 `orderNo`） | `title`/`amounts` 均为零值对象；**结果 key 数恒为 10** |
| 非法元素名 `{bogus:{fontSize:5}}` | `bogus` **不出现在结果里** |
| `D_parse(null)` / `D_parse("x")` | 全部零值，不抛错 |
| `{orderNo:null}` | `orderNo` 保持零值（`typeof null === "object"` 但 `e[l]` 为 falsy → 跳过） |

### 9.7 `M()` 边角（§3.3）

| 输入 | 实际输出字符串 |
|---|---|
| 全零 + `visible:true` | `""`（**空串** → `ce()` 不输出 style 属性） |
| 全零 + `visible:false` | `"display:none"` |
| `visible:false` + 偏移 5/-2 | `"display:none;position:relative;left:5mm;top:-2mm;z-index:10"` |
| 仅 X 偏移 3（Y 为 0） | `"position:relative;left:3mm;top:0mm;z-index:10"`（**Y 也照输出 0mm**） |
| 仅 Y 偏移 -1.5 | `"position:relative;left:0mm;top:-1.5mm;z-index:10"` |
| `fontSize:0, widthMm:0` | `""` |
| `fontSize:12` | `"font-size:12px"` |
| `widthMm:40` | `"width:40mm;max-width:40mm"` |
| 全开 | `"position:relative;left:1mm;top:2mm;z-index:10;font-size:12px;width:40mm;max-width:40mm"` |
| `visible:0`（非布尔 falsy） | `"display:none"` |

段序恒为 `display → position → font-size → width`。注意 `M` **不做类型校验**（与 `D` 不同），
`visible:0` 照样 `display:none`；生产路径上 `D` 已把 `visible` 归一成布尔，所以不会出问题。

### 9.8 `L()` / `Z()` / 列宽（§3.4 / §2.3 / §0.1 的复核）

| 检查 | 实测 |
|---|---|
| `L()` key 数 / 顺序 | **10** 个，顺序 = `["orderNo","date","title","qrcode","client","tel","address","productionDays","amounts","declaration"]`（与 `x` 同序） |
| `L().orderNo` | `{offsetXMm:0, offsetYMm:0, fontSize:0, widthMm:0, visible:true}` |
| `L()` 两次调用是否同引用 | **false**（每次新对象，无共享引用坑） |
| `Z({})` / `Z(undefined)` / `Z(null)` | 三者都 = `u` 全默认（30/15/20/18/15/13） |
| `Z({headerFontSize:100, extra:1})` | `headerFontSize:36`，**`extra` 被丢弃**（返回值恰好 6 字段） |
| `Z` 是否污染 `u` | 否，`u` 保持原值（`K` 只读不写） |
| `a` 求和 | **99.8**，len 10 → 再次印证是列宽百分比（§0.1） |

### 9.9 仍在「未确认」的条目

§8 里第 1/2/3/5/6 条**不因本次实测而改变**（它们是关于调用点数量、DOM 副作用、
长度校验、键名来源、按钮语义的判断，纯函数实跑无法触及）。
第 4 条（metaOrder 重复项）**已结案**，见 §3.2 / §9.2。
