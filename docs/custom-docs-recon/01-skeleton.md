# 自定义单据 ×4 · 共用骨架逆向

范围：合格标签（QualifiedLabel）/ 生产单（ProductionSheet）/ 生产单2（ProductionSheet2）/ 玻璃合片单（GlassSheet2），
以收据单（Receipt2）作对照。

**本文只管「骨架」**：状态机、弹窗结构、就地编辑、固定张数、打印链路、expose API 面、Home 调用、持久化。
单张单据的字段/版面对照见其它文档。

---

## 0. 阅读约定

- 行号引用 `文件:行`，文件位于 `/Users/aaa/Desktop/door-main/legacy/js/`。
  - 四张用 `Xxx.deobfuscated.js`（已还原字符串，变量名仍是单字母）。
  - Home 用 `Home.formatted.js`（有行号）+ 原始单行文件 `Home-d6b13b9a.js` 的字符偏移 `@N`。
- 反混淆残留的 `const l = pa` / `const t = l` / `const e = l` 是**死代码**，不作为语义依据（CONFIRMED：这些标识符在本文件内无声明）。
- 组件内被反混淆器删掉的 class 常量（`Aa`/`xa`/`mn` 等）已回原始 chunk `Home.formatted.js` 交叉验证。

---

## 1. 顶层状态对照表（★最关键的一张）

### 1.1 状态变量逐个对照

| 语义 | QualifiedLabel | ProductionSheet | ProductionSheet2 | GlassSheet2 |
|---|---|---|---|---|
| **生效配置**（被 print/preview/localStorage 读） | `r` `:209` | `r` `:250` | `i` `:111` | `i` `:102` |
| **设置弹窗草稿** | `i` `:210` | `i` `:251` | `c` `:112` | `c` `:103` |
| **布局编辑器草稿** | `d` `:213` | `s` `:253` | `s` `:113` | `s` `:104` |
| 设置弹窗显隐 | `n` `:207` | `n` `:248` | `n` `:107` | `n` `:98` |
| 布局编辑器显隐 | `s` `:212` | `c` `:252` | `u` `:108` | `u` `:99` |
| 设置弹窗当前 tab | `u` `:208` | `u` `:249` | `r` `:110` | `r` `:101` |
| 当前选中项 key | `m`（选中**字段** key）`:222` | `d`（字段 key）`:254` | — 无 | — 无 |
| 当前选中项种类 | — 无（只有字段一种） | `V`（`"field"`/`"doorImgBox"`/`"table"`）`:255` | — 无 | — 无 |
| 画布基准尺寸 | — 无（写死 320×260，见 `V` `:214`） | `A` `:428`（`{w,h}`，打开时按右栏 DOM 实测） | `m` `:116`（`{w:800,h:600}`，打开时实测） | `m` `:107` |
| 右栏 DOM ref | — 无 | `D` `:427`（`layoutEditorRightRef`） | `V` `:115` | `V` `:106` |
| 当前样本数据 | — 无（用 props `getLabels()`） | `m` `:256`（`getData()[0]`） | `d` `:114` | `d` `:105` |
| 打印机列表 | `f` `:228` | `f` `:262` | `v` `:119` | `v` `:110` |
| 打印机名（生效） | `h` `:229` | `h` `:263` | `f` `:120` | `f` `:111` |
| 打印机拉取中 | `p` `:230` | `p` `:264` | `h` `:121` | `h` `:112` |
| Electron 环境 | `v` computed `:227` | `v` computed `:260` | `w` computed `:117` | `w` computed `:108` |
| 就地编辑模式开 | `c` `:211` | — 无 | — 无 | — 无 |
| 编辑模式容器 | `ue`（`let`，非 ref）`:771` | — 无 | — 无 | — 无 |
| 编辑监听清理栈 | `re`（数组）`:772` | — 无 | — 无 | — 无 |
| 固定标签数：开关 / 值（生效） | `C` `:231` / `z` `:232` | — 无 | — 无 | — 无 |
| 固定标签数：开关 / 值（设置草稿） | `x` `:233` / `B` `:234` | — 无 | — 无 | — 无 |
| 批量调参当前值（正文字号/正文行宽/客户单号宽） | `S` `:428` / `T` `:429` / `Y` `:430` | — 无 | — 无 | — 无 |

> 注意 QualifiedLabel 里 `S/T/Y` 与 ProductionSheet 的 `s` 无关系，纯属单字母撞名，**按文件分别读**。

### 1.2 配置对象的顶层形状

| | 顶层键 | 定位模型 |
|---|---|---|
| QualifiedLabel | `paper` / `globalFont` / `autoHideEmpty` / `fields[]` / `print` | **自由定位**：每个 field 有 `x/y/width/height(mm) + fontSize(pt) + fontWeight + textAlign + wrap + maxLines + showPrefix + visible` |
| ProductionSheet | `paper` / `headerFields[]` / `tableConfig{columns[],tableFontSize,rowHeight,showBodyBorder,underlineBrElements,tableTopMm}` / `doorImgBox{enabled,x,y,width,height}` / `print{copies,itemsPerPage}` | **混合**：`headerFields` 自由定位；`tableConfig.columns` 只控列宽/显隐；`doorImgBox` 自由定位 |
| ProductionSheet2 | `paper` / `table{title,borderColor,headerFontSize,columns[]}` / `print` | **只有列模型**：`columns[]` = `{key,label,widthMm,fontSize,rowHeightMm,fontColor,visible}`，无坐标 |
| GlassSheet2 | 同 PS2 | 同 PS2 |
| Receipt2（对照） | `fontSettings` / `columnWidths[]` / `printSettings` / `visibilitySettings` / `brandSettings` / `elementConfigs` | 列宽 + 元素偏移（`offsetXMm/offsetYMm/fontSize/widthMm/visible`） |

**CONFIRMED**：PS2 与 GS2 的顶层结构**完全同构**，连键名都一致。

### 1.3 归一化函数（读 localStorage 与写回时都调用）

| | 函数 | 行 | 关键行为 |
|---|---|---|---|
| QL | `N(e)` | `:241`–`:369` | 逐字段 clamp：paper 20–300 / 20–400 / pad 0–20；`globalFont.fontSize` 5–30、`lineHeight` 1–2、`fontWeight` 只允许 bold/normal；`fontFamily` 保留；field `width` 1..paperW、`height` 1..paperH（qrcode 时 height=width）、`x` 0..(w−width)、`y` 0..(h−height)、`fontSize` 5–30、`maxLines` 1–10、`textAlign` ∈ {left,center,right}；`copies` 1–99。**兜底：若所有 field 都 `visible=false`，整个 fields 恢复默认**（`:364-366`） |
| PS | `z(e)` | `:265`–`:511` | paper 50–400 / 50–400；headerField 的 `key/label/prefix` **强制取默认**（不允许改名）；`x/y` 0–400、`width` 5–300、`fontSize` 6–36、`lineHeight` 0.8–3、`fontWeight` bold/normal；`tableConfig.columns` 与默认列表按 key **合并 + 补齐缺失列**；`copies` 1–99 |
| PS2 | 内联在 `onMounted` | `:716`–`:770` | 逐键 `Number(x) \|\| 默认`；**columns 按 `$index` 位置合并默认**（`{...默认[t], ...saved[t]}`）—— 顺序变了会错配 |
| GS2 | 内联在 `onMounted` | `:690`–`:744` | 同 PS2 |
| Receipt2 | `D()` `:138` | | elementConfigs 白名单逐键校验 |

**CONFIRMED**：QL/PS 有独立的、可复用的归一化函数；PS2/GS2 没有，归一化逻辑被内联复制在 `onMounted` 里。

---

## 2. 布局编辑器（`openLayoutEditor`）★

### 2.1 弹窗容器对照

| | QualifiedLabel | ProductionSheet | ProductionSheet2 | GlassSheet2 |
|---|---|---|---|---|
| 容器 | `el-dialog` `:1072` | `el-dialog` `:1506` | `el-dialog` | `el-dialog` |
| 标题 | `自定义合格标签 - 布局编辑` `:1922` | `自定义生产单 - 布局编辑` `:2936` | `自定义生产单2 - 布局编辑` `:1400` | `自定义玻璃合片单 - 布局编辑` `:1377` |
| `width` | `"980px"` `:1923` | 无 | 无 | 无 |
| `fullscreen` | 无（浮层） | **`""`（=true，全屏）** `:2942` | **`""`（全屏）** `:1401` | **`""`（全屏）** `:1378` |
| `destroy-on-close` | `false` `:1924` | `false` `:2943` | `false` `:1402` | `false` `:1379` |
| `append-to-body` | 无 | 无 | 无 | 无 |
| 外层 class | `layout-editor-wrap` / `-left` / `-right` / `layout-canvas-shell` / `layout-canvas` | `ps-layout-*` | `ps2-layout-wrap` / `ps2-layout-left` / `ps2-layout-right` / `ps2-layout-canvas-shell` / `ps2-layout-canvas` | `gs2-layout-*` |
| 底部按钮 | 取消 / 重置默认 / 保存布局 | 同 | 同 | 同 |
| 字段/列列表位置 | **右栏底部**（画布下方）`:2837` | **左栏底部** `:3745` | **左栏中部** `:1639` | **左栏中部** `:1616` |
| 画布缩放 | 固定 `min(320/w, 260/h)` `:214` | 右栏 DOM 实测 `−32px`，兜底 `max(600,iw−440)×max(400,ih−200)` `:1380` | 右栏实测 `−32px`，兜底 `max(600,iw−500)×max(400,ih−200)` `:171` | 同 PS2 `:161` |
| 画布预览渲染 | 绝对定位 div，**无 innerHTML** | 字段 div + **表格 `innerHTML`** `:4075` + 门图框 div | **整块 `innerHTML: T.value`**（字符串拼接）`:1855` | **整块 `innerHTML`** `:1833` |
| 拖拽 | 字段（1 套） | 字段 + 门图框 + 表格（**3 套**）`:3953/:739/:713` | **无** | **无** |
| 点空白取消选中 | 无 | 有 `:3919` | 无 | 无 |
| 纸张预设 / 方向 / 旋转 | 无 / 无 / **有 `printRotate90`** `:2206` | 无 / 无 / 无 | 无 / 无 / 无 | 无 / 无 / 无 |
| 字段/列的增删排序 | 无 | 无 | **有 ↑/↓ 换位**（仅 `:1771`） | **有 ↑/↓ 换位** `:1750` |
| 导入 / 导出 JSON | 无 | 无 | 无 | 无 |

**CONFIRMED —— 三套 UI 家族**：
- **家族 A（QualifiedLabel）**：`layouts-editor` 左栏=纸张+字段设置+快捷批量调整，右栏=画布+字段表（9 列）。
- **家族 B（ProductionSheet）**：`ps-` 左栏=纸张+字段设置+表格设置+列宽设置+门图框设置+字段表（5 列），右栏=画布（三种元素）。
- **家族 C（ProductionSheet2 / GlassSheet2）**：`ps2-`/`gs2-` 左栏=纸张+表格全局+各列设置表（7 列），右栏=整块 innerHTML 预览。**这两张逐字相同**（连缓存下标 `t[27]`/`t[29]` 都一样），只差字符串前缀、标题、默认列定义。

### 2.2 打开 / 保存 / 取消 / 重置

| | 打开 `openLayoutEditor` | 保存 | 取消 | 重置默认 |
|---|---|---|---|---|
| QL | `d = N(deepCopy(r))`；`m = d.fields[0].key`；`W()`（回读批量调参当前值）；`s = true` `:911-919` | `oe` `:712`：`r = N(deepCopy(d))` → `M()`（写 localStorage）→ `s=false` → `await ne()`（刷预览） | 内联 `s=false` | `le` `:709`：`d = a()` + `W()` |
| PS | `s = z(deepCopy(r))`；`d = s.headerFields[0].key`；`V="field"`；`m = getData()[0] ?? null`；`c=true`；`await nextTick`；测右栏尺寸 `:1367-1396` | `_` `:771`：`r = z(deepCopy(s))` → `C()` → `c=false` → `isActive && await ae()` | 内联 `c=false` | `J` `:768`：`s = a()` |
| PS2 | `s = deepCopy(i)`（**无归一化**）；`d = getData() \|\| []`；`u=true`；`await nextTick`；`L()`（测尺寸）；`W()`（重算预览）`:814-825` | `E` `:163`：`i = deepCopy(s)` → `C()` → `u=false` → `isActive && await q()` | 内联 `u=false` | `M` `:152`：`s = a()` |
| GS2 | 与 PS2 逐字相同 `:788-797` | 与 PS2 逐字相同 `:153` | 同 | 与 PS2 逐字相同 `:143` |

**CONFIRMED 差异**：QL/PS 在「打开」和「保存」**两端都做归一化**；PS2/GS2 两端都只做 `JSON.parse(JSON.stringify(...))` **纯深拷贝、不归一化**。
**CONFIRMED**：四张的「打开」都是**深拷贝**（不是引用共享），所以取消不脏写。
**CONFIRMED**：只有 QL 和 PS 的 layout 保存后会刷新预览（`ne`/`ae`）；PS2/GS2 只在 `isActive()` 为真时刷新。

### 2.3 控件清单对照（左栏）

| 控件（label 原文） | 绑定 | QL | PS | PS2 | GS2 |
|---|---|---|---|---|---|
| `纸张宽(mm)` / `宽(mm)` | `paper.widthMm` | ✅ 20–300 step1 | ✅ 50–400 step1 | ✅ 100–420 step1 | ✅ 100–420 step1 |
| `纸张高(mm)` / `高(mm)` | `paper.heightMm` | ✅ 20–400 step1 | ✅ 50–400 step1 | ✅ 100–297 step1 | ✅ 100–297 step1 |
| `内边距(mm)` / `边距(mm)` | `paper.paddingMm` | ✅ 0–20 s0.5 | ✅ 0–30 s0.5 | ✅ 0–20 s0.5 | ✅ 0–20 s0.5 |
| `默认字号(pt)` + 「应用到全部」 | `globalFont.fontSize` | ✅ 5–30 s0.5 | ❌ | ❌ | ❌ |
| 「适应纸张宽度」按钮 | 写所有非 qrcode 字段 width | ✅ `:2102` | ❌ | ❌ | ❌ |
| `字段宽度`（提示「(宽-边距×2)」） | — | ✅ | ❌ | ❌ | ❌ |
| `默认粗细` select（正常/加粗） | `globalFont.fontWeight` | ✅ | ❌ | ❌ | ❌ |
| `自动隐藏空` switch | `autoHideEmpty` | ✅ | ❌ | ❌ | ❌ |
| `打印旋转90°` switch（提示「布局60×90→打印输出到90×60纸」） | `paper.printRotate90` | ✅ `:2206` | ❌ | ❌ | ❌ |
| `字段设置：{label}` 分组 | 见 2.4 | ✅ | ✅ | ❌ | ❌ |
| `快捷批量调整` 分组 | `S/T/Y` + `O/H/G` | ✅ `:2546` | ❌ | ❌ | ❌ |
| `表格设置` 分组 | `tableConfig.*` | ❌ | ✅ `:3331` | ❌ | ❌ |
| `列宽设置` 表 | `tableConfig.columns` | ❌ | ✅ `:3484` | ❌ | ❌ |
| `门图框设置` 分组 | `doorImgBox.*` | ❌ | ✅ `:3573` | ❌ | ❌ |
| 「启用门图框 / 门图框已启用」按钮 | `Y` | ❌ | ✅ `:3879` | ❌ | ❌ |
| `纸张` 分组标题 | — | 无（裸 el-form） | 无（裸 el-form） | ✅ `:1446` | ✅ `:1422` |
| `表格全局` 分组 | — | ❌ | ❌ | ✅ `:1539` | ✅ `:1517` |
| `各列设置` 分组 | — | ❌ | ❌ | ✅ `:1632` | ✅ `:1609` |

### 2.4 每字段/每列的编辑属性对照

**QL —— 两个入口同时存在**：
- 左栏「字段设置」面板（选中字段，非 v-for）`:2248`：`X(mm)` 0–300 s0.5 / `Y(mm)` 0–400 s0.5 / `宽(mm)` 4–300 s0.5；`key!=="qrcode"` 时追加：`字号(pt)` 5–30 s0.5、`粗细` select、`换行` switch、**`最多行数`**（仅 `wrap` 为真时）1–10 s1、`对齐` select（左/中/右）、`显示前缀` switch。**没有 height / visible / label 输入框**。
- 右栏字段表（9 列）`:2837`：`显`(checkbox→visible, w38) / `字段`(只读 label, w46) / `X`(w72) / `Y`(w72) / `宽(mm)`(w82, **min 1**) / `字号`(w78, 仅非 qrcode) / `对齐`(w74 select, 仅非 qrcode) / `换行`(w52 checkbox) / `前缀`(w52 checkbox)。行点击 → `m.value = row.key`；单元格 input 都带 `@click.stop`。

**PS —— 同样是两个入口**：
- 左栏「字段设置」`:3076`：`X(mm)` 0–400 s0.5 / `Y(mm)` 0–400 s0.5 / `宽(mm)` 5–300 s0.5；`key ∉ {qrcode, lockImg}` 时追加：`字号(pt)` **6–36** s0.5、**`颜色` el-color-picker→`fontColor`**、`粗细` select、`换行` switch、**`行距` 0.8–3 s0.1**。**没有 height / visible / prefix / textAlign / maxLines**。
- 右栏字段表（5 列）`:3745`：`显` / `字段` / `X` / `Y` / `宽`。max-height 240。
- 另有 `表格设置`：`Y位置(mm)` 0–400 s0.5、`字号(pt)` 6–24 s0.5、`行高(px)` 16–60 s1、`外边框` switch、`加下划线` switch。
- `列宽设置` 表 3 列：`显` / `列名` / `宽(mm)` 5–300 s1。
- `门图框设置`：`启用` switch、`X(mm)` 0–400、`Y(mm)` 0–400、`宽(mm)` 10–200 s1、`高(mm)` 10–200 s1。

**PS2 / GS2 —— 只有列**（`el-table` 7 列）`:1650` / `:1627`：
`显`(w38 checkbox→visible) / `列名`(w72 只读) / `宽mm`(w72, 10–120 s1→`widthMm`) / `字号pt`(w72, 7–28 s0.5→`fontSize`) / `行高mm`(w72, 3–20 s0.5→`rowHeightMm`) / `颜色`(w52 color-picker→`fontColor`) / `排序`(w70, ↑/↓ 交换数组元素，首末行 disabled)。

**CONFIRMED 结论**：`x/y/width` 这套「自由定位」只在 QL 和 PS 存在；PS2/GS2 **完全没有坐标概念**，只有列宽/行高/字号/颜色。

### 2.5 拖拽规则对照

| | QL 字段 | PS 字段 | PS 门图框 | PS 表格 |
|---|---|---|---|---|
| 监听 | `mousedown`(`:2723`) → `document` 上 `mousemove`/`mouseup` | 同 `:3953` | 同 `:739` | 同 `:713` |
| 吸附 | `round(2v)/2` = **0.5mm** | 同 | 同 | 同 |
| X clamp | `[0, widthMm−1]` | 同 | `[0, widthMm−doorImgBox.width]` | — 不拖 X |
| Y clamp | `[0, heightMm−1]` | 同 | `[0, heightMm−doorImgBox.height]` | `[0, heightMm−paddingMm−10]` |
| 写入目标 | `r.value.fields[i]`（**生效配置**，非草稿！） | `s.value.headerFields[i]`（草稿） | `s.value.doorImgBox` | `s.value.tableConfig.tableTopMm` |
| mouseup 后 | `M()`（**立即写 localStorage**）→ `await ne()` → `ce(ue)` 重进编辑模式 | `U("field", key)` 仅改选中 | `U(...)` | `U("table","")` |

> ⚠️ **QL 的拖拽直接改生效配置并立刻落 localStorage**（无草稿、无确认）。这是与 PS 家族最实质的行为差异。—— CONFIRMED（`QualifiedLabel.deobfuscated.js:821-853`）

---

## 3. `enterEditMode` / `exitEditMode` / `toggleEditMode` / `isEditMode`

**只有 QualifiedLabel 有这套 API。**（CONFIRMED：其余三张文件内 grep 零命中）

定义（`QualifiedLabel.deobfuscated.js`：

| API | 实现 |
|---|---|
| `enterEditMode: ce` `:921` / `:790-853` | `ie()` 先清理 → `ue = 容器DOM`、`c.value = true` → 取 `[data-qlabel]` 子节点 → 按 `rect.width/paper.widthMm` 与 `rect.height/paper.heightMm` 算出 mm→px 比例 → 对所有 `.qfield`：`outline = 1px dashed #409eff`、`cursor: move`，挂 `mousedown` 拖拽（拖到哪写哪个字段的 `x/y`，见 2.5），监听器清理函数压进 `re` 数组 |
| `exitEditMode: se` `:922` `:785` | `c.value = false`；`ie()`：执行并清空 `re`、移除 `qlabel-edit` class、清 `.qfield` 的 inline outline/cursor、`ue = null` |
| `toggleEditMode(e)` `:923` | `c.value ? se() : ce(e)` |
| `isEditMode()` `:926` | `() => c.value` |

**与收据单的编辑模式不是一回事**（CONFIRMED）：
- Receipt2 **没有** `enterEditMode` 等方法。它的编辑模式由 **Home 侧**驱动：Home 函数 `Ri`（`Home.formatted.js:9867`）直接操作 DOM（`contentEditable`）+ 调 `Xn.initColumnResize(el)` / `Xn.initElementEditor(el)`（`ze` `Receipt2.deobfuscated.js:983`——只是给容器挂一个 `click` 代理监听）；选中元素弹浮层改 `offsetXMm/offsetYMm/fontSize/widthMm/visible`，攒在草稿 `P`，点确认才 `xe()` 写回 `b`（生效）并落库。
- QualifiedLabel 的 `ce` 是**组件自管**的拖拽定位（改 x/y），改的是**生效配置**，**无浮层、无草稿、无确认**，每次 mouseup 直接落库。
- 两者唯一的形式相似点是都用 `querySelectorAll` 给子元素挂 inline 监听、都用 `document`/容器级代理。

**Home 从不调用这四个方法**（CONFIRMED，`Home.formatted.js` 全文件每个符号仅出现 1 次，即组件 expose 处）。它们在本构建里是**死 API**——新版若不做「Home 侧的就地编辑」，可以只保留 `openLayoutEditor`。

---

## 4. `getFixedQuantitySetting`

**只有 QualifiedLabel 有**（CONFIRMED）。

```js
getFixedQuantitySetting: () => ({ enabled: C.value, value: L(z.value) })
```
`QualifiedLabel.deobfuscated.js:927-930`

- `C` = 固定标签数开关（生效），`z` = 值（生效）；`L(e)` `:377` = `round → clamp(1,99)`，非数字回 1。
- 草稿是 `x` / `B`（设置弹窗内），确认时 `C = x; z = L(B)`（`k` `:404-413`）。
- UI 位置：设置弹窗 → **打印机** tab → `固定标签数`（el-switch，灰字提示「开启后按指定页数生成标签」）`:1838`；打开后才出现 `打印数量`（el-input-number 1–99 step1）`:1875`。
- 持久化：`qualified_label_quantity_enabled`（`"1"`/`"0"`）与 `qualified_label_quantity_value`（字符串数字），只在设置弹窗「保存并应用」时写。
- 语义：开启后，Home 侧的 `Cr(e)`（`Home.formatted.js:8279`）把标签数据按固定数量补齐/循环到 N 条再交给 `buildQualifiedLabelHtml`。

**其余三张没有任何「固定张数」概念**（CONFIRMED）。

---

## 5. 打印链路

四张 + Receipt2 的 `printDirect` / `printSilent` 属于**同一个模板的两个变体**。

### 5.1 `printDirect`（浏览器打印对话框）

共同骨架（CONFIRMED，四张逐字一致的部分）：
```
ElLoading.service({lock:true, text:"正在生成XXX...", background:"rgba(0,0,0,0.7)"})
  → 生成完整 HTML 文档字符串
  → createElement("iframe") + style.cssText
  → appendChild → contentWindow/contentDocument
  → doc.open() / doc.write(html) / doc.close()
  → await Promise: querySelectorAll("img")，全部 complete/onload|onerror 后 resolve
  → setTimeout(…, 300) → win.focus() → win.print()
      → setTimeout(() => 移除 iframe, 1000)
  → ElMessage.success("已打开打印对话框")
catch → ElMessage.error("打印失败: " + (err?.message||err))
finally → loading.close()
```

逐张差异：

| | QL `:931-985` | PS `:1394-1442` | PS2 `:825-873` | GS2 `:799-847` |
|---|---|---|---|---|
| 生成函数 | `de()`（内部 `ae(e)`） | `ne()` | `J()` | `J()` |
| Loading 文案 | `正在生成标签...` | `正在生成生产单...` | `正在生成生产单...` | `正在生成玻璃合片单...` |
| 文档 `<title>` | `自定义合格标签` | `自定义生产单` | `自定义生产单2` | `自定义玻璃合片单` |
| **iframe 尺寸** | **`top:-9999px;left:-9999px;width:{widthMm}mm;height:{heightMm}mm`** ← 按纸张实际尺寸 | `top:0;left:0;width:0;height:0` | 同 PS | 同 PS |
| 数据来源 | `r.value` + `props.getLabels()` | `r.value` + `props.getData()` | `i.value` + `props.getData()` | 同 PS2 |
| 后续动作 | 无 | 无 | 无 | 无 |

**CONFIRMED**：QL 的 iframe 用**真实 mm 尺寸并 `top:-9999px` 藏在屏外**；PS/PS2/GS2 用**0×0**。这是四张里唯一一处结构性差异，会影响部分浏览器/打印驱动的分页行为。

### 5.2 `printSilent`（Electron 静默打印）

共同骨架：
```
if (!isElectron) → ElMessage.warning("直接打印仅在Electron客户端可用"); return false
ElLoading.service({... "正在发送到打印机..." ...})
  → 生成完整 HTML 文档字符串
  → await window.electronAPI.silentPrint(html, printerName || "", { landscape, copies, pageWidthMm, pageHeightMm })
  → success ? (ElMessage.success(...), true) : (ElMessage.error("打印失败："+reason), false)
catch → ElMessage.error("直接打印失败: " + msg); return false
finally → loading.close()
```

| | QL `:986-1057` | PS `:1443-1498` | PS2 `:874-919` | GS2 `:849-892` | Receipt2 `:1271-1330` |
|---|---|---|---|---|---|
| 入参 | 无（自取 `getLabels()`） | 无 | 无 | 无 | **容器 DOM `e`** |
| 额外前置守卫 | **`getLabels().length === 0` → warning「没有可打印的标签」return false** | 无 | 无 | 无 | **`!e` → error「预览容器未就绪」return false** |
| 循环 | **逐张循环**（每张单独建 HTML + 单独 `silentPrint`），Loading 文案动态 `正在发送到打印机(n/N)...` | 单次 | 单次 | 单次 | 单次 |
| `landscape` | `!printRotate90 && orientation==="landscape"` | `widthMm > heightMm` | 同 PS | 同 PS | **恒 `false`** |
| `pageWidthMm/HeightMm` | `printRotate90 ? (h,w) : (w,h)` | `(w, h)` | 同 PS | 同 PS | `orientation==="landscape" ? (h,w) : (w,h)` |
| 成功文案 | `已发送 {N} 张至打印机：{printer\|系统默认}` | `已发送至打印机：{printer\|系统默认}` | `已发送至打印机`（**不带打印机名**） | 同 PS2 | `收据单2已发送至打印机：{printer\|系统默认}` |
| 失败文案 | `第{N}张打印失败：{reason\|未知错误}` | `打印失败：{reason\|未知错误}` | 同 PS | 同 PS | 同 PS |
| HTML 生成 | `de([单条label])` | `ne()` | `J()` | `J()` | 特制：clone 容器 DOM、剔 `.r2-resize-handle`；landscape 时给每个 `.receipt2-page` 外包 `.r2-page-wrap` |

### 5.3 与收据单 `printFromContainer` 的差别

| | 收据单 `printFromContainer(container)` `:1226-1270` |
|---|---|
| **数据来源** | **不重新构造** —— `container.cloneNode(true)` 直接克隆**预览里的真实 DOM**（先剔 `.r2-resize-handle`），再把 `innerHTML` 拼进文档 |
| iframe | `width:0;height:0`（同 PS 家族） |
| 等图后延时 | **500ms**（QL/PS/PS2/GS2 都是 **300ms**） |
| 打印后移除 | 1000ms |
| 成功提示 | **无** |
| `printDirect` | `:1113` **不做任何打印**，只是 `await ye()`（= `exportReceipt2PdfToBrowserPrint`）+ `已打开收据单2已打开浏览器打印` —— **Home 侧从不调用它**（CONFIRMED） |

**CONFIRMED**：Receipt2 是唯一「从预览 DOM 克隆」的路子；四张自定义单据都是**从配置对象重新构造 HTML 字符串**（所以它们的 `buildXxxHtml` 才能脱离预览独立产出）。

### 5.4 `printFromContainer` / `buildXxxHtml` 的有无

| | `printFromContainer` | build 方法 | 其它导出 |
|---|---|---|---|
| QL | ❌ | `buildQualifiedLabelHtml(labels)` | `refreshPreview` |
| PS | ❌ | `buildProductionSheetHtml(data)` | `refreshPreview`、`getItemsPerPage` |
| PS2 | ❌ | `buildProductionSheet2Html(data)` | `refreshPreview` |
| GS2 | ❌ | `buildGlassSheet2Html(data)` | `refreshPreview` |
| Receipt2 | ✅ | `buildReceipt2Html` | `refreshPreview`、`printDirect`、`copyPreviewToClipboard`、`exportPreviewToPdf`、`exportReceipt2PdfToBrowserPrint`、`openFontDialog`、`initColumnResize`、`initElementEditor`、`destroyElementEditor`、`resetAllElementConfigs` |

---

## 6. expose 全清单（新版要对齐的 API 面）

`Home.formatted.js` 的 expose 行号：QL `3788-3840` / PS `4951-5016` / PS2 `6061-6119` / GS2 `6752-6810` / Receipt2 `~1108-1330`。

| 方法 | QL | PS | PS2 | GS2 | Receipt2 |
|---|:-:|:-:|:-:|:-:|:-:|
| `buildXxxHtml(...)` | ✅ `buildQualifiedLabelHtml(labels)` | ✅ `buildProductionSheetHtml(data)` | ✅ `buildProductionSheet2Html(data)` | ✅ `buildGlassSheet2Html(data)` | ✅ `buildReceipt2Html` |
| `refreshPreview()` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `openSettingsDialog()` | ✅ | ✅ | ✅ | ✅ | — （叫 `openFontDialog`） |
| `openLayoutEditor()` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `printDirect()` | ✅ | ✅ | ✅ | ✅ | ✅（空转） |
| `printSilent(...)` | ✅ `()` | ✅ `()` | ✅ `()` | ✅ `()` | ✅ `(container)` |
| `isElectronEnv` | computed | computed | computed | computed | computed |
| `getFixedQuantitySetting()` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `getItemsPerPage()` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `enterEditMode(c)` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `exitEditMode()` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `toggleEditMode(c)` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `isEditMode()` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `printFromContainer(c)` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `openFontDialog()` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `initColumnResize/destroyElementEditor/resetAllElementConfigs` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `copyPreviewToClipboard/exportPreviewToPdf/exportReceipt2PdfToBrowserPrint` | ❌ | ❌ | ❌ | ❌ | ✅ |

### 6.1 组件 props（Home 挂载处，`Home.formatted.js:11832-11842`）

| 组件 | props |
|---|---|
| Receipt2PrintManager | `:get-customers` / `:is-receipt2-active` / `@on-preview-html-change` |
| QualifiedLabelPrintManager | `:get-labels` / `:is-active` / `@on-preview-html-change` / **`:on-fixed-quantity-change`** |
| ProductionSheetPrintManager | `:get-data` / `:is-active` / `@on-preview-html-change` |
| ProductionSheet2PrintManager | `:get-data` / `:is-active` / `@on-preview-html-change` |
| GlassSheet2PrintManager | `:get-data` / `:is-active` / `@on-preview-html-change` |

**共用 props 契约（CONFIRMED）**：`isActive()` 决定 preview 变化是否回报宿主；`getData()/getLabels()` 提供数据；`onPreviewHtmlChange(html)` 把生成的 HTML 推给宿主预览容器。
只有 QL 多一个 `onFixedQuantityChange()`（固定张数改动时请宿主重算数据）。

### 6.2 各组件 emit/回调的触发路径

- `refreshPreview()` → 内部 `build` → `await props.onPreviewHtmlChange(html)`。
- QL 的 `ae(e)`（build）本身**不**调 `onPreviewHtmlChange`；`ne()` 才调。
- PS 的 `oe()`（build）**不**调；`ae()` 才调。
- 保存布局/设置后：QL·PS 无条件刷预览；PS2·GS2 仅 `isActive()` 真时刷。

---

## 7. Home 侧调用

### 7.1 组件 ref（`Home.formatted.js`）

| 组件 | ref 变量 | 声明行 | ref_key | 模板行 |
|---|---|---|---|---|
| Receipt2PrintManager | `Xn` | 8266 | `receipt2ManagerRef` | 11833 |
| QualifiedLabelPrintManager | `fr` | 8279 | `qualifiedLabelManagerRef` | 11835 |
| ProductionSheetPrintManager | `Ir` | 8417 | `productionSheetManagerRef` | 11837 |
| ProductionSheet2PrintManager | `jr` | 8443 | `productionSheet2ManagerRef` | 11839 |
| GlassSheet2PrintManager | `li` | 8494 | `glassSheet2ManagerRef` | 11841 |

（每个声明都是 `Vue.ref(null)`。）

### 7.2 方法调用点 + 「组件未就绪」条件（逐字）

| Home 函数 | 行 | 调用 | 守卫 → 提示（都是 `ElMessage.error`） |
|---|---|---|---|
| `Cr(e)` | 8281 | `fr.getFixedQuantitySetting()` | 可选链，无守卫；`!enabled \|\| 0===len` 时原样返回 |
| `Mr()` | 8296 | `fr.openSettingsDialog()` | `!fr.value?.openSettingsDialog` → **`自定义合格标签组件未就绪`** |
| `Nr()` | 8300 | `fr.openLayoutEditor()` | `!fr.value?.openLayoutEditor` → **`自定义合格标签布局编辑器未就绪`** |
| `Er()` | 8304 | `await fr.printDirect()` | 无守卫（可选链） |
| `Lr()` | 8308 | `if (await fr.printSilent())` | 无守卫 |
| `br()/Dr()/Ar()` | 8315/8333/8353 | `fr.buildQualifiedLabelHtml(Cc)` | `!fr.value?.buildQualifiedLabelHtml` → **`自定义合格标签组件未就绪`** |
| `Wr()` | 8424 | `Ir.openSettingsDialog()` | → **`自定义生产单组件未就绪`** |
| `Or()` | 8428 | `Ir.openLayoutEditor()` | → **`自定义生产单布局编辑器未就绪`** |
| `Hr()` | 8432 | `await Ir.printDirect()` | 无守卫 |
| `Gr()` | 8436 | `if (await Ir.printSilent())` | 无守卫 |
| `gi()` | 8546 | `Ir.buildProductionSheetHtml(Sr())` | → **`自定义生产单组件未就绪`** |
| `Rr()` | 8453 | `await jr.printDirect()` | 无守卫 |
| `Fr()` | 8457 | `jr.isElectronEnv ? jr.printSilent() : jr.printDirect()` | `if(!jr.value) return`（静默） |
| `$r()` | 8465 | `jr.openSettingsDialog()` | → **`自定义生产单2组件未就绪`** |
| `ei()` | 8469 | `jr.openLayoutEditor()` | → **`自定义生产单2组件未就绪`**（**注意：不是「布局编辑器未就绪」**） |
| `ti()` | 8473 | `jr.buildProductionSheet2Html(Jr())` | → **`自定义生产单2组件未就绪`** |
| `si()` | 8504 | `await li.printDirect()` | 无守卫 |
| `di()` | 8508 | `li.isElectronEnv ? li.printSilent() : (重建 buildGlassSheet2Html)` | `if(!li.value) return` |
| `Vi()` | 8519 | `li.openSettingsDialog()` | → **`自定义玻璃合片单组件未就绪`** |
| `mi()` | 8523 | `li.openLayoutEditor()` | → **`自定义玻璃合片单组件未就绪`** |
| `wi()` | 8527 | `li.buildGlassSheet2Html(ai())` | → **`自定义玻璃合片单组件未就绪`** |
| `Qr(e)` | 8449 | `jr.refreshPreview()` | `eo.value && 15===ic.value` |
| `ci(e)` | 8500 | `li.refreshPreview()` | `eo.value && 16===ic.value` |
| `Pc(e)` | 10353 | `fr.buildQualifiedLabelHtml(Cc)` | `eo.value && 13===ic.value` |
| `Sr()` | 8417 | `Ir.getItemsPerPage()` | 无守卫；`===2` 时对数据做每页 2 条切分 `sc(o)` |

**CONFIRMED 提示语不统一**：
- QL / PS：`openLayoutEditor` 有**专属**提示「…**布局编辑器**未就绪」（QL `8303`、PS `8431`）。
- PS2 / GS2：`openLayoutEditor` 与 `openSettingsDialog`、`build` **共用同一条**提示（「…组件未就绪」）。

**CONFIRMED：`enterEditMode` / `exitEditMode` / `toggleEditMode` / `isEditMode` 在 Home 里零调用。**
`getFixedQuantitySetting` 是这四件套之外唯一被 Home 调用的「独有方法」。

### 7.3 触发按钮（都是 `el-button onClick`，**无任何键盘快捷键**，CONFIRMED）

预览弹窗工具栏，按 `ic.value` 分支（`ic`：13=合格标签、14=生产单、15=生产单2、16=玻璃合片单、12=收据单2）：

| `ic` | 按钮文案（逐字） | 处理函数 | label 行 |
|---|---|---|---|
| 13 | `" 手动打印 "` | `Er` → `fr.printDirect()` | 11678 |
| 13 | `" 标签机设置 "` | `Mr` → `fr.openSettingsDialog()` | 11682 |
| 13 | `" 直接打印 "` | `Lr` → `fr.printSilent()` | 11686 |
| 13 | `" 编辑布局 "` | `Nr` → `fr.openLayoutEditor()` | 11690 |
| 13 | `" 编辑标签 "` | `kc`（标签数据弹窗） | 11694 |
| 14 | `" 手动打印 "` / `" 编辑生产单 "` / `" 生产单设置 "` / `" 直接打印 "` / `" 编辑布局 "` | `Hr` / `mc` / `Wr` / `Gr` / `Or` | 11698/11702/11706/11710/11714 |
| 15 | `" 手动打印 "` / `" 编辑生产单 "` / `" 打印设置 "` / `" 直接打印 "` / `" 布局设置 "` | `Rr` / `Xr` / `$r` / `Fr` / `ei` | 11718/11722/11726/11730/11734 |
| 16 | `" 手动打印 "` / `" 编辑合片单 "` / `" 打印设置 "` / `" 直接打印 "` / `" 布局设置 "` | `si` / `ii` / `Vi` / `di` / `mi` | 11738/11742/11746/11750/11754 |
| 12 | `" 直接打印 "` / `" 打印 "` / `" 字体调节 "` / `" 编辑收据单 "/" 完成编辑 "` | `Ji` / `_i` / `vi` / `Ri` | 11658/11662/11666/11670/11674 |

**CONFIRMED 文案不统一**：PS 的布局按钮叫 **「编辑布局」**；PS2/GS2 叫 **「布局设置」**；设置按钮 QL=「标签机设置」、PS=「生产单设置」、PS2/GS2=「打印设置」。

打开入口（`打印选项` 抽屉 → `回执单-其它` 面板 → 分隔标题 `自定义单据：`，`Home.formatted.js:11941`）：

| 按钮文案 | 处理函数 | 最终调用 | 行 |
|---|---|---|---|
| `" 自定义收据单 "` | `pi` | Receipt2 流程 | 11968 |
| `" 自定义合格标签 "` | `br` | `fr.buildQualifiedLabelHtml` | 11972 |
| `" 平开合格标签 "` | `Dr` | 同上 | 11976 |
| `" 推拉合格标签 "` | `Ar` | 同上 | 11980 |
| `" 自定义生产单 "` | `gi` | `Ir.buildProductionSheetHtml` | 11984 |
| `" 自定义生产单2 "` | `ti` | `jr.buildProductionSheet2Html` | 11988 |
| `" 自定义玻璃合片单 "` | `wi` | `li.buildGlassSheet2Html` | 11992 |

### 7.4 入口函数的公共骨架（CONFIRMED，6 个入口形状一致）

```js
al.value=!1; lo.value=!1; oo.value=!1; Jl.value=!0;
await Vue.nextTick();
if(!lc.value)                          → error("Hui 组件引用不存在"); Jl=false; return
if(typeof lc.value.<算法> !== 'function') → error("<算法> 方法不存在");   Jl=false; return
try {
  uc.value = []; await nextTick();
  const l = await lc.value.<算法>(...);     // 调 Hui 组件算法
  <目标数组>.value = Array.isArray(l) ? l : [];
  const data = Cr(<目标数组>);              // 仅合格标签过 Cr()（固定张数补齐）
  if(!REF.value?.buildXxxHtml) → error("…未就绪"); return
  ic.value = 13|14|15|16;                  // 切预览类型
  清空 Wn/On
  const o = await REF.value.buildXxxHtml(getter());
  Wn.value = o; await nextTick();
  Hn.value = ao.value?.scrollWidth; eo.value = !0;
} catch(l) { error("生成失败: " + (l?.message||l)) }
finally { Jl.value=!1 }
```

| 入口 | Hui 算法 | 缺失提示 | 置位 |
|---|---|---|---|
| `br/Dr/Ar` | `lc.value.lable` | `lable 方法不存在` | `ic=13` |
| `gi` | `lc.value.calculateReceiptOld` | `calculateReceiptOld 方法不存在` | `ic=14` |
| `ti` | `lc.value.calculateReceipt` | `calculateReceipt 方法不存在` | `ic=15` |
| `wi` | `lc.value.calculateGlass` | `calculateGlass 方法不存在` | `ic=16` |

`lc` = 隐藏挂载的 Hui 组件（`huiRef`，`Home.formatted.js:11994`）。

### 7.5 编辑器子组件的 onSave 回灌（`Home.formatted.js:12200-12212`）

| 子组件 | props | onSave → 效果 |
|---|---|---|
| 标签编辑 | `"label-data":bc` | `Pc` → `fr.buildQualifiedLabelHtml`（`ic===13` 时） |
| 生产单编辑 | `"production-data":uc` | `gc` → `Ir.buildProductionSheetHtml` |
| 生产单2编辑 | `"production-data":qr` | `Qr` → `jr.refreshPreview()` |
| 合片单编辑 | `"production-data":oi` | `ci` → `li.refreshPreview()` |

**CONFIRMED 不一致**：生产单走 `build*` 重建，PS2/GS2 走 `refreshPreview()`。

---

## 8. 持久化（localStorage）

### 8.1 键名对照（CONFIRMED，来自 `Home.formatted.js:3461 / 4522 / 5787 / 6485 / 2372`）

| 单据 | 模板键 | 打印机键 | 其它 |
|---|---|---|---|
| QualifiedLabel | `qualified_label_template_v2` | `qualified_label_printer` | `qualified_label_quantity_enabled`、`qualified_label_quantity_value` |
| ProductionSheet | `production_sheet_template_v1` | `production_sheet_printer` | — |
| ProductionSheet2 | `production_sheet2_template_v1` | `production_sheet2_printer_v1` | — |
| GlassSheet2 | `glass_sheet2_template_v1` | `glass_sheet2_printer_v1` | — |
| Receipt2 | — （无整包模板） | `receipt2_selected_printer` | `receipt2_element_configs`、`receipt2_font_settings`、`receipt2_column_widths`、`receipt2_print_settings`、`receipt2_visibility_settings`、`receipt2_brand_settings` |

### 8.2 写入时机

| 单据 | 写函数 | 键 | 触发点 |
|---|---|---|---|
| QL | `M()` `:236` | `qualified_label_template_v2` | ① 布局编辑器「保存布局」`oe` ② 设置弹窗「保存并应用」`k` ③ **编辑模式拖拽 mouseup（`ce` 内，每次拖完立即写）** |
| QL | `E()` `:371` | `qualified_label_printer` | 打印机下拉 `onChange`（`:1724`） |
| QL | 内联 `:412-413` | `qualified_label_quantity_enabled` / `_value` | 设置弹窗「保存并应用」`k` |
| PS | `C()` `:257` | `production_sheet_template_v1` | ① 设置弹窗保存 `E` ② 布局编辑器保存 `_` |
| PS | `x()` `:515` | `production_sheet_printer` | 下拉 `onChange`（`:2763`） |
| PS2 | `C()` `:126` | `production_sheet2_template_v1` | ① 设置弹窗保存 `N` ② 布局编辑器保存 `E` |
| PS2 | `z()` `:132` | `production_sheet2_printer_v1` | 下拉 `onChange`（`:1273`） |
| GS2 | `C()` `:117` | `glass_sheet2_template_v1` | 同 PS2 |
| GS2 | `z()` `:123` | `glass_sheet2_printer_v1` | 下拉 `onChange`（`:1249`） |

**CONFIRMED**：写 localStorage 全部包在 `try{}catch{}` 里静默失败；键名是**模块级常量**（反混淆后为 `Aa/ka/Pa/Ia`、`on/an`、`yn/vn`、`Dn/An`），命名风格不统一（`_v2` / `_v1` / `_printer_v1`）——**新版建议统一**，但要保留旧键做迁移读取，否则用户已存的布局会丢。

### 8.3 读取时机（全部在 `onMounted`）

| 单据 | 读取 + 归一化 |
|---|---|
| QL | `onMounted` `:872-902`：template 缺省→`a()`，有→`N(JSON.parse(t))`（含 try/catch 回退）；printer → `h`；固定张数 → `"1"===...` / `L(值)`。**不拉打印机列表** |
| PS | `onMounted` `:1341-1360`：template 缺省→`a()`，有→`z(JSON.parse(t))`；printer → `h`。**不拉打印机列表** |
| PS2 | `onMounted` `:712-802`：template 逐键内联校验（columns 按位置合并）；printer → `f`；**`w.value && x()`（Electron 下自动拉打印机列表）**；`isActive() && await q()` |
| GS2 | `onMounted` `:686-776`：同 PS2 |

### 8.4 打印机列表拉取时机（CONFIRMED，**四张不一致**）

| | onMounted 自动拉 | 设置弹窗 `onOpen` 自动拉 | 「刷新打印机列表」按钮 |
|---|:-:|:-:|:-:|
| QL | ❌ | ✅ `onOpen: D` `:1091` → `D` `:379`（Electron 且 `f.length===0`） | ✅ `:1787`（`loading: p.value`） |
| PS | ❌ | ✅ `onOpen: M` `:1522` → `M` `:533` | ✅ `:2826` |
| PS2 | ✅ `:800` | ❌（改在 `openSettingsDialog` 内 `w.value && 0===v.length && await x()` `:817`） | ✅ `:1334` |
| GS2 | ✅ | ❌（同 PS2，`openSettingsDialog` 内） | ✅ `:1311` |

失败提示统一为 `ElMessage.error("获取打印机列表失败")`。

---

## 9. 「哪些共用 / 哪些逐张不同」汇总

### 9.1 可以抽成一份公共实现（四张完全一致）

1. **expose 契约**：`buildXxxHtml(data)` / `refreshPreview()` / `openSettingsDialog()` / `openLayoutEditor()` / `printDirect()` / `printSilent()` / `isElectronEnv`。
2. **props 契约**：`getData` / `isActive` / `onPreviewHtmlChange`（QL 另加 `onFixedQuantityChange`）。
3. **`printDirect` 骨架**：ElLoading → 建 HTML → iframe → write → 等 img → 300ms → focus+print → 1000ms 移除 → `已打开打印对话框` / `打印失败: `。
4. **`printSilent` 骨架**：Electron 守卫（`直接打印仅在Electron客户端可用`）→ ElLoading → `electronAPI.silentPrint(html, printer, opts)` → 成功/失败文案 → `finally close()`。
5. **布局编辑器骨架**：`el-dialog(fullscreen) → footer[取消/重置默认/保存布局] → 左栏(el-form 控件) + 右栏(预览)`；打开=深拷贝到草稿、保存=深拷贝回生效+落库+关弹窗+（可选）刷预览、取消=关弹窗、重置=`草稿=默认`。
6. **设置弹窗骨架**：`el-dialog → footer[重置默认/取消/保存并应用] → el-tabs`；tab 一律含 `纸张` 与 `打印机`；`openSettingsDialog` = 深拷贝到草稿 + tab 复位 `"paper"` + 开弹窗；确认 = 深拷贝回生效 + 落库 + 关弹窗 + 刷预览。
7. **打印机块**：`getPrinters()` + `刷新打印机列表` 按钮（`loading`） + 「已选：」提示 + 失败 `获取打印机列表失败`。
8. **归一化思路**：读/写都走「默认值 ⊕ 存档值 → 逐键 clamp」；纯 white-list 合并（丢弃未知键）。
9. **落库包装**：`try{ localStorage.setItem(KEY, JSON.stringify(x)) }catch{}`。

### 9.2 逐张不同（必须各自实现 / 参数化）

| 维度 | 差异 |
|---|---|
| **配置形状** | QL=`fields` 自由定位；PS=`headerFields`+`tableConfig`+`doorImgBox`；PS2/GS2=`table.columns` 纯列模型 —— **三种形状，无法共用同一份 schema** |
| **布局编辑器 UI 家族** | 三个家族：A(QL) / B(PS) / C(PS2=GS2)。C 家族内部逐字相同，只需 `prefix + defaults` 两个参数 |
| **弹窗尺寸** | QL=`980px` 浮层；PS/PS2/GS2=全屏 |
| **拖拽** | QL 有（写生效配置+立即落库）；PS 有 3 套（写草稿）；PS2/GS2 无 |
| **就地编辑 API** | 只有 QL 有 `enterEditMode` 四件套（且 Home 不调用） |
| **固定张数** | 只有 QL（含 2 个额外 localStorage 键 + `onFixedQuantityChange` 回调） |
| **`getItemsPerPage`** | 只有 PS（含 `print.itemsPerPage` 配置 + Home 侧每页 2 条切分） |
| **归一化位置** | QL/PS 是独立函数；PS2/GS2 内联在 `onMounted` 且 columns 按**下标**合并（顺序敏感，是个隐患） |
| **打印旋转** | 只有 QL 有 `paper.printRotate90`，且它的 `printDirect` iframe 用真实 mm 尺寸 |
| **打印份数/打印机 key 命名** | 四套都不同（`_template_v2`/`_template_v1`/`_printer`/`_printer_v1`） |
| **按钮/提示文案** | 「编辑布局」vs「布局设置」；「标签机设置」vs「生产单设置」vs「打印设置」；PS2/GS2 的 layout/settings/build 共用一条「组件未就绪」 |
| **打印机列表拉取时机** | QL/PS 在设置弹窗 `onOpen`；PS2/GS2 在 `onMounted` + `openSettingsDialog` 内 |
| **预览刷新时机** | QL/PS 保存后无条件刷；PS2/GS2 仅 `isActive()` 真时刷 |

### 9.3 实现建议（INTERPRETED）

- 抽 `useDocumentLayout<TConfig>` 组合式 + `<DocumentLayoutDialog>` 壳组件（dialog + footer + 左右两栏 + 保存/取消/重置/落库），
  内层「纸张块」「打印机块」「列编辑表」做成子组件。
- 三套 schema 各写一份 `normalize(raw): Config` + `defaults(): Config`，其余全走泛型。
- PS2/GS2 直接一份组件 + `prefix`/`title`/`defaults` 参数。
- QL 的编辑模式四件套若新版不做 Home 侧就地编辑，可**不实现**（Home 现在也不调）。

---

## 10. 未确认

1. **`ic` 各值的完整映射**：13/14/15/16/12 已由 `is-active` computed（`xr/Tr/_r/ni/vr` 分别比对 13/14/15/16/12）确认；其余值（1/2/3/4/5/8/9）只由按钮文案推断。**INTERPRETED**。
2. **`Yt`（控制「自定义单据」整块显隐的变量）**：只确认它是 ref，未追到置位点。**未确认**。
3. ~~Receipt2 的 `printDirect` 是否真无人调用~~ → **已确认为 CONFIRMED**：
   `Home-d6b13b9a.js` 全文件 `printDirect` 字面量只出现 **6 次**（偏移 116297=Receipt2 定义、155989=QL、206561=PS、245420=PS2、283486=GS2、371069=Home 调 GlassSheet2 那一处）。
   查表下标 `(1405)`（= `"printDirect"`）在 `Home.formatted.js` 全文件只出现 **4 次**：`8307`(QL `Er`)、`8435`(PS `Hr`)、`8456`(PS2 `Rr`)、`8461`(GS2 `Fr`)。
   → **Home 从不调用 `Receipt2.printDirect`**（`ic==12` 的「直接打印」走 `printSilent(container)`，「打印」走 `printFromContainer(container)`）。
4. **QL `E()`（写 `qualified_label_printer`）是否还有第二个触发点**：只确认了打印机下拉 `onChange`（`:1724`）。**未确认**。
5. **PS2/GS2 `onMounted` 里 `isActive() && await q()` 的行为**：`q` = `refreshPreview`，即挂载时若已激活会主动推一次预览给宿主。**CONFIRMED**（读到），但其必要性/时序影响未验证。
