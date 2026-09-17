# 自定义生产单2（`ProductionSheet2PrintManager`）vs 自定义玻璃合片单（`GlassSheet2PrintManager`）—— 实现差异清单

> **本文只写差异。** GS2 已确认的结论（HTML/CSS/分页/二维码/弹窗结构等）不重述，
> 一律引 `docs/custom-docs-recon/02-glasssheet2.md` 的节号。
>
> 行号约定：
> - `PS2:NNN` = `legacy/js/ProductionSheet2.deobfuscated.js`
> - `GS2:NNN` = `legacy/js/GlassSheet2.deobfuscated.js`
> - `HOME@NNNNN` = `legacy/js/Home.formatted.js` 的**字符偏移**（该文件是单行格式化，不能用行号）
> - `HUI@NNNNN` = `legacy/js/Hui.formatted.js` 的字符偏移
>
> 每条标 **CONFIRMED** / **INTERPRETED** / **未确认**。

---

## 0. 一页结论

**PS2 不是「另一张单子」，而是 GS2 换了 4 样东西：**（CONFIRMED）

| # | 换掉了什么 | 性质 |
|---|---|---|
| 1 | **行数据来源**：`calculateGlass()` → `calculateReceipt({ping:true,diao:true,single:false,singleRowData:null})` | ⚠️ **最重要，且不在组件内** |
| 2 | **列集默认值**：8 列 → 9 列，键/标签/宽度/字号/行高/颜色**全改** | 配置数据 |
| 3 | **空行渲染**：丢空段 → **补 `&nbsp;` 占位行**（`fnbsp` 那一处） | 真正的逻辑差异 |
| 4 | **类名前缀 `gs` → `ps`、localStorage 键名、若干 UI 文案** | 贴皮 |

**其余全部逐字相同**：分页算法、量测 iframe、CSS 结构、二维码、图片等待、打印链路、
布局编辑器、打印设置弹窗、读盘清洗、expose 面、渲染函数骨架 —— 无一处 PS2 独有分支。

**判据（可复现）**：把两文件做「去空白 + 去尾逗号 + 记法归一（`["x"]`→`.x`）+
前缀归一（`gs2`/`ps2`→`XX`）+ 解码器别名归一」后逐成员比对，
**43 个条目里只有 8 个存在真实差异**（`a` / `C` / `z` / `A` / `U` / `S` / `j` / `J`），
其中 `S` 只是变量提升写法不同、**语义等价** → **实质性差异只有 7 个成员**。
复现脚本：`/tmp/ps2-recon/fns2.mjs`、`/tmp/ps2-recon/tok.mjs`（`node fns2.mjs <GS2> <PS2>`）。

---

## 1. 逐函数对照表（问题 1）

| 成员 | GS2 行 | PS2 行 | 判定 | 差异内容 |
|---|---|---|---|---|
| `a` 默认配置工厂 | GS2:11 | PS2:11 | **仅参数不同** | 标题 + 列集（见 §2） |
| `n,u,r,i,c,s,d,V,m` refs | GS2:99-107 | PS2:108-116 | 完全相同 | — |
| `w` computed(electron) | GS2:108 | PS2:117 | 完全相同 | — |
| `v,f,h` refs | GS2:109-111 | PS2:118-120 | 完全相同 | — |
| `p` computed(可见列) | GS2:112 | PS2:121 | 完全相同 | — |
| `C` 存配置 | GS2:115 | PS2:124 | **仅参数不同** | localStorage 键名 |
| `z` 存打印机 | GS2:121 | PS2:130 | **仅参数不同** | localStorage 键名 |
| `x` 取打印机列表 | GS2:127 | PS2:136 | 完全相同 | — |
| `B` 重置设置草稿 | GS2:140 | PS2:149 | 完全相同 | — |
| `M` 重置布局草稿 | GS2:143 | PS2:152 | 完全相同 | — |
| `N` 保存设置 | GS2:146 | PS2:155 | 完全相同 | — |
| `E` 保存布局 | GS2:154 | PS2:163 | 完全相同 | — |
| `L` 量容器 | GS2:162 | PS2:171 | 完全相同 | — |
| `b` computed(预览缩放) | GS2:172 | PS2:181 | 完全相同 | — |
| `D` HTML 转义 | GS2:182 | PS2:191 | 完全相同 | 5 条 `replace` 逐字一致 |
| **`A` 多行文本渲染** | GS2:188 | PS2:197 | ⚠️ **逻辑不同** | 见 §6 —— **本单最关键的一处** |
| `k,P,I` 二维码机器 | GS2:203-205 | PS2:213-215 | 完全相同 | `MARGIN=1`、`text+"::m1"`、失败不缓存 |
| **`U` 单元格渲染** | GS2:206 | PS2:216 | **逻辑不同** | 少 `case "client"`；多 `case "doorframe"`/`case "windows"`（见 §5） |
| `S` 预览表格 | GS2:308 | PS2:328 | **结构不同，语义等价** | GS2 把行串存 `const l` 再 return；PS2 直接内联 return。输出逐字节相同 |
| `T` ref + `Y` 计数器 | GS2:360-361 | PS2:384-385 | 完全相同 | — |
| `W` 渲染预览 | GS2:363 | PS2:386 | **仅排版不同，语义等价** | `.reduce(...,0)` vs `.reduce(...,0,)`（尾逗号）+ prettier 折行 |
| `O` 量测 | GS2:419 | PS2:445 | 完全相同 | 去空白后逐字节相同（2108 字符） |
| `H` 分页 | GS2:519 | PS2:545 | 完全相同 | 见 §4 |
| `G` 打印行 | GS2:538 | PS2:564 | 完全相同 | — |
| `j` 建 HTML | GS2:571 | PS2:597 | **仅参数不同** | 根/页 class 前缀 + CSS 前缀（见 §3/§4） |
| `q` refreshPreview | GS2:668 | PS2:694 | 完全相同 | — |
| `J` 建文档 | GS2:673 | PS2:699 | **仅参数不同** | `<title>` |
| `onMounted` 读盘 | GS2:686 | PS2:709 | **仅参数不同** | 两个 key + 默认回退对象 |
| expose 块 | GS2:778 | PS2:804 | **仅参数不同** | 方法名 + 文案（见 §7） |
| 渲染函数（模板） | GS2:891-1860 | PS2:917-1882 | **仅参数不同** | 弹窗标题 ×2、两个 module 级 class 常量（见 §7） |

**解码器别名**：GS2 用 `const l = Bn`，PS2 用 `const l = dn` —— 无关紧要，
各自是 Home bundle 里该组件局部的解码器别名（`HOME@292707` 附近可见 `fn = Vue.defineComponent({` 前的 `dn` 同族）。
**别名不同的其它自由标识符**（都是 module 级常量，不是逻辑差异）：

| PS2 名 | GS2 名 | 值 | 引用处 |
|---|---|---|---|
| `yn` | `Dn` | `"production_sheet2_template_v1"` / `"glass_sheet2_template_v1"` | `PS2:127,716` `PS2:798` |
| `vn` | `An` | `"production_sheet2_printer_v1"` / `"glass_sheet2_printer_v1"` | `PS2:133,798` |
| `mn` | `Mn` | `{class:"ps2-layout-wrap"}` / `{class:"gs2-layout-wrap"}` | `PS2:1443` |
| `wn` | `Nn` | `{class:"ps2-layout-left"}` / `{class:"gs2-layout-left"}` | `PS2:1444` |
| `gn` | `En` | `["innerHTML"]` | `PS2:1863` / `GS2:1841` |

**结论：`mn/wn/gn` 与 `Mn/Nn/En` 的差别只有类名前缀一处，`En`/`gn` 完全相同。**（CONFIRMED，`HOME@330100-330120`）

---

## 2. 配置模型（问题 2）

### 2.1 PS2 默认配置完整逐字段（`a()`，PS2:11-107）

顶层三块：`paper` / `table` / `print`。`paper` 与 `print` 与 GS2 **完全相同**：

| 字段 | PS2 值 | GS2 值 | 判定 |
|---|---|---|---|
| `paper.widthMm` | `297` | `297` | 同 |
| `paper.heightMm` | `210` | `210` | 同 |
| `paper.paddingMm` | `3` | `3` | 同 |
| `paper.orientation` | `"landscape"` | `"landscape"` | 同（**死字段**，无消费者，见报告 §6.1 末尾） |
| `table.borderColor` | `"#444444"` | `"#444444"` | 同 |
| `table.headerFontSize` | `13.5` | `13.5` | 同 |
| `print.copies` | `1` | `1` | 同 |
| **`table.title`** | **`"生产单"`** | `"玻璃合片单"` | ⚠️ **改值** |

### 2.2 `table.columns` 逐字段对照（PS2:22-104）

| # | PS2 key | PS2 label | PS2 宽 | 字号 | 行高 | 颜色 | GS2 对应 | 判定 |
|---|---|---|---|---|---|---|---|---|
| 1 | `door` | **客户/门类** | **32** | 13 | 7 | `#000000` | ① `client`「客户」30 / ② `door`「门类」28 | **改值 + 合并两列** |
| 2 | `doorImg` | 门图 | 28 | 12 | **6.2** | `#111111` | 原第 7 位 `doorImg` | **位置前移**（值全同） |
| 3 | `order` | 单号 | **22** | 12 | 7 | `#111111` | ③ `order` 24 | **改值** |
| 4 | `basicInfo` | 订单信息 | **30** | 13 | 7 | `#111111` | ④ 34 | **改值** |
| 5 | `lockImg` | 方向 | **14** | 10 | 8 | `#111111` | ⑤ 20 | **改值** |
| 6 | `doorsheet` | **门扇** | **35** | **15** | **9** | `#111111` | ⑥「玻璃尺寸」36 / 14 / 8 | **改值（含 label）** |
| 7 | **`doorframe`** | **外框** | **39** | **15** | **9** | `#111111` | — | ⚠️ **新增列** |
| 8 | **`windows`** | **亮窗/扣板** | **36** | **15** | **9** | `#111111` | — | ⚠️ **新增列** |
| 9 | `remark` | 备注 | 30 | 12 | 7 | `#111111` | ⑧ 30 | 同（值全同） |

**删除列**：`client`（「客户」）——被并入第 1 列 `door` 的语义（见 §5.2 的行来源证据）。

**可见列宽合计**：PS2 = **266mm**（32+28+22+30+14+35+39+36+30）；GS2 = **230mm**。
纸宽 297 − 2×3 = **291mm 可用**。两边都「列宽之和 ≠ 可用宽」，`table-layout:fixed` 自行分配。

**⚠️ 三个 15pt / 9mm 的列**（`doorsheet`/`doorframe`/`windows`）是 PS2 最大字号，
超过 GS2 的 14pt 上限；但 UI 控件范围（`COLUMN_UI_RANGES` 7–28pt / 3–20mm）**两边相同**（PS2:1713-1748 与 GS2 同），**默认值不越界，无需改范围**。

### 2.3 读盘清洗（`onMounted`，PS2:709-803）

与 GS2 **逐字段相同**（`Number(v) || 默认`、`paddingMm` 用 `??` 的旧版缺陷、
`columns` 按**下标**合并默认列并保留多出的列、`copies` 夹到 1–99）。
**唯一差异是两个 localStorage 键名**。GS2 报告 §6.4 的所有决策**原样适用于 PS2**。

---

## 3. HTML 逐字骨架（问题 3）

**PS2 的 HTML 与 GS2 逐字节相同，只差两件事**：(a) 类名 `gs`→`ps`；(b) 列集（§2.2）。
下面是 PS2 自己的骨架（转写自 `PS2:564-707`，`\n` 与缩进都是字面量，**照抄**）。

### 3.1 打印/导出文档（`J`，PS2:699-707）

```
<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义生产单2</title></head><body>{rootHtml}</body></html>
```
GS2 为 `<title>自定义玻璃合片单</title>`。**其它逐字相同。**

### 3.2 根容器（`j` 尾，PS2:691-692）

```
<div class="ps-root"><style>{CSS}</style>{pagesHtml}</div>
```

### 3.3 单页（`j` 内，PS2:637-647）—— **换行与缩进都是字面量**

```
\n  <section class="ps-sheet" style="{sheetStyle}">\n    {pageNum}\n    <div class="ps2-title">{escapedTitle}</div>\n    <table class="ps2-table">\n      <thead><tr>{ths}</tr></thead>\n      <tbody>{rows}</tbody>\n    </table>\n  </section>
```

- `sheetStyle` = `['width:{w}mm','height:{h}mm','padding:{p}mm','position:relative','box-sizing:border-box','background:#fff','overflow:hidden'].join(';')`（顺序照抄）
- `pageNum` = `pages.length > 1 ? '<div class="ps2-page-num">' + (i+1) + ' / ' + n + '</div>' : ''`
- `escapedTitle` 走 `escapeHtml`；**`th` 的 `label` 不转义**（`PS2:623` 直接拼 `e.label`）

### 3.4 表头单元格（`j` 内，`PS2:618-626`）

```
<th style="width:{widthMm}mm">{label}</th>
```
⚠️ **打印版表头没有内联 `font-size`** —— 字号由 CSS `.ps2-table th { font-size:{headerFontSize}pt }` 给。
（量测版 `O` 的内联 `font-size` 是另一回事，见 §4）

### 3.5 明细行（`G`，PS2:564-596）

```
\n  <tr>{tds}</tr>
```
每个 `td`：
```
<td style="width:{widthMm}mm;font-size:{fontSize}pt;color:{fontColor};line-height:{rowHeightMm}mm;">{cellHtml}</td>
```
`cellHtml` = `U(key, row, 0, {qrSize:'17mm', imgStyle:'width:100%;display:block;margin:0 auto;object-fit:contain;'})`

### 3.6 单元格内容三种形态（`U`，PS2:216-327）

与 GS2 报告 §3.6 相同，**除了**：
- 删除 `case "client"`
- 新增 `case "doorframe"` → `renderMultiline(row.doorframe)`
- 新增 `case "windows"` → `renderMultiline(String(row.windows ?? '').trim())`

⚠️ `windows` 外面那层 `String(...).trim()`（PS2:313-321）**是冗余的**：`A` 内部本来就做
`String(e ?? '')` 再 `.split().map(trim)`。**行为等价**（CONFIRMED）。

### 3.7 空数据 / 无可见列

- 无可见列（`S`，PS2:332 / `O` 无此逻辑）：`'<div style="text-align:center;color:#999;padding:20px;">无可见列</div>'` —— **两边逐字相同**
- 空数据 `[[]]` → 渲染 1 个空页（表头在，tbody 空）—— 与 GS2 相同
- 布局编辑器空数据 → `W` 出 `暂无预览数据` 占位（PS2:394）—— 与 GS2 相同

---

## 4. CSS（问题 3 续 / 问题 4）

### 4.1 夹具

**`/tmp/ps2-recon/ps2-default.css`** —— 1739 字符，从 PS2 源码直接求值得到
（`PS2:652-687` 的字符串拼接在 `widthMm=297,heightMm=210,paddingMm=3,borderColor=#444444,headerFontSize=13.5` 下的结果）。

**`shasum = 2ac1613b620a8df39c06d4221d38ed87ce25e1d3`**

### 4.2 与 GS2 的差异 —— **只有一处：前缀 `gs` → `ps`**

CONFIRMED（机器验证，非目测）：把 `docs/custom-docs-recon/gs2-default.css`
做全局 `gs` → `ps` 替换后，与 PS2 求值结果**逐字节相等**（脚本 `/tmp/ps2-recon/cssx.mjs`，
同时用它重算了 GS2 的 CSS 并与 `gs2-default.css` 比对 → `true`，证明该求值方法可信）。

替换波及 **13 个类名**（`PS2:1680-2680` 全量提取）：

| GS2 | PS2 | | GS2 | PS2 |
|---|---|---|---|---|
| `.gs-root` | `.ps-root` | | `.gs2-page-num` | `.ps2-page-num` |
| `.gs-sheet` | `.ps-sheet` | | `.gs2-line` | `.ps2-line` |
| `.gs2-title` | `.ps2-title` | | `.gs2-qr` | `.ps2-qr` |
| `.gs2-table` | `.ps2-table` | | `.gs2-order` | `.ps2-order` |
| `.gs2-lock-img` / `.gs2-door-img` | `.ps2-lock-img` / `.ps2-door-img` | | `.gs2-layout-*`（4 个） | `.ps2-layout-*` |

**注意两套前缀并存**：`gs-root`/`gs-sheet` 是**无 `2`** 的（`GS2:637,652`），
`gs2-title` 等是**有 `2`** 的（`GS2:662` 起）。这不是笔误，
`gs`→`ps` 单一替换同时覆盖了两者（`gs2-` 的前两字符正好是 `gs`）—— **实现时别"顺手统一"**。

三个死选择器（`.ps2-qr` / `.ps2-order` / `.ps2-lock-img`+`.ps2-door-img`）
**PS2 里同样是死的**（`U` 走内联样式，不吐这三个类）—— 照抄不删。

`@page { size: 297mm 210mm; margin: 0; }`、`@media screen`、`@media print` 三块
除前缀外**逐字相同**（含 `break-after:page` 与 `:last-child` 例外、`print-color-adjust:exact`）。

### 4.3 布局编辑器专属 CSS

`docs/custom-docs-recon/02-glasssheet2.md` §4.2 那份布局编辑器 CSS —— PS2 相同，仅前缀 `gs2-`→`ps2-`（CONFIRMED，同上验证）。

---

## 5. 分页（问题 4）

**完全一致，无 PS2 独有分支。**（CONFIRMED：`H` 去空白后 421 字符逐字节相同；`O` 2108 字符逐字节相同）

| 项 | PS2 | GS2 | 判定 |
|---|---|---|---|
| 预算公式 | `PS2:551`：`heightMm - 2*paddingMm - 8 - 10` | `GS2:525` 同 | **同** |
| 常数 `8` / `10` | `8` / `10` | `8` / `10` | **同**（语义见报告 §5.2） |
| 兜底行高 | `PS2:557`：`?? 20` | `GS2:531`：`?? 20` | **同** |
| 切页条件 | `used + h > budget && cur.length > 0` | 同 | **同** |
| 空数据 | `[[]]` | `[[]]` | **同** |
| 量测 iframe | `position:fixed;top:-9999px;left:-9999px;width:0;height:0;…` | 同 | **同** |
| 量测比例 | `(wMm - 2*paddingMm) / (div.offsetWidth \|\| 1)` | 同 | **同** |
| 图片等待 | `complete` / `onload` / `onerror` + `setTimeout(…, 2e3)` | 同 | **同**（`PS2:519-531`） |
| 量测里的二维码 | `qrSize:'15mm'` | 同 | **同** |
| 行标记 | `data-ridx` | 同 | **同** |
| 量测样式块 | 裸 `th,td` 选择器 + **硬编码 `#444`** + `.ps2-line{line-height:inherit;}` | 同（前缀 `gs2`） | **同（除前缀）** |

**PS2 独有的分页分支：无。**

⚠️ **但分页的「输入」变了** —— §6 的空行渲染会**改变每一行的实测高度**，
从而改变切页位置。分页代码不用改，**行为却会变**。这是最容易被忽略的连带影响。

---

## 6. 空行 / 空值渲染 —— 本单唯一真正的逻辑差异（问题 6）

### 6.1 两边源码对照

**GS2（`A`，GS2:188-202）**：
```js
o = String(e ?? '').split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean)  // ← 有 filter
return o.length === 0 ? '' : o.map(s => '<div class="gs2-line">' + D(s) + '</div>').join('')
```

**PS2（`A`，PS2:197-212）**：
```js
o = String(e ?? '').split(/<br\s*\/?>/i).map(s => s.trim())                  // ← 无 filter
return o.length === 0 ? '' : o.map(s =>
  s ? '<div class="ps2-line">' + D(s) + '</div>'
    : '<div class="ps2-line">&nbsp;</div>'                                   // ← 空段补占位行
).join('')
```

### 6.2 行为差异（CONFIRMED，逐例推演）

| 输入 `e` | GS2 输出 | PS2 输出 |
|---|---|---|
| `""` | `""`（**空串**） | `<div class="ps2-line">&nbsp;</div>`（**1 行**） |
| `undefined` / `null` | `""` | `<div class="ps2-line">&nbsp;</div>` |
| `"  "`（全空格） | `""` | `<div class="ps2-line">&nbsp;</div>` |
| `"A"` | 1 个 div | 1 个 div（同） |
| `"A<br>B"` | 2 个 div | 2 个 div（同） |
| `"A<br><br>B"` | **2 个 div**（中间空段被丢） | **3 个 div**（中间是 `&nbsp;` 行） |
| `"A<br>"` | 1 个 div | **2 个 div**（尾巴多一个 `&nbsp;`） |
| `"<br>A"` | 1 个 div | **2 个 div**（开头多一个 `&nbsp;`） |

**PS2 的 `o.length === 0` 是死分支**：`String(x).split(...)` 永远返回 ≥1 个元素，
所以 `A` **永不可能返回 `""`**（CONFIRMED）。

### 6.3 影响哪些列

`A`（= 新版的 `renderMultiline`）只被这几列走：**`door`、`basicInfo`、`doorsheet`、
`doorframe`、`windows`、`remark`**（PS2:224-323）。

**`doorImg` / `lockImg` / `order` 不受影响** —— 它们不走 `A`：
- `doorImg`/`lockImg` 空 → 直接返回 `""`（PS2:226-231 / 302-307）
- `order` 无单号 → `qrSvg` 为 `null`、字幕为 `""` → 返回 `""`（PS2:291-298）

**⚠️ 直接后果**：PS2 里 `doorframe`、`windows` 这两个字段**经常是空串**
（`calculateReceipt` 里过滤后无匹配部件时 `[].join('<br>') === ''`，见 §7.3），
于是这两列在没有配件的行上会渲染出一行 `&nbsp;` 占位（行高 = `rowHeightMm` = 9mm），
**而不是塌成 0**。这是设计意图（保持行高整齐），但它会让每一行的实测高度**大于** GS2 的算法，
进而**改变分页**。

### 6.4 施工提示

新版 `app/src/utils/glasssheet2/html.ts:76-83` 的 `renderMultiline` 实现的是 **GS2** 语义
（注释里也写死了「`filter(Boolean)` 丢掉空段」「全空 → 空串」）。
**PS2 需要把它参数化**（例如 `renderMultiline(value, { keepEmptyLines: boolean })`），
别直接改 GS2 的 —— 会破坏 GS2 的验收夹具。同理 `paginate.ts:124` 与 `css.ts:43`
里硬编码的 `.gs2-line` 选择器也要跟着前缀走。

---

## 7. 单元格字段与行来源（问题 5）—— ⚠️ 本节含一条**推翻 GS2 报告**的结论

### 7.1 PS2 逐列读哪个字段（CONFIRMED，`U`，PS2:223-326）

| `key` | 读取的字段 | 渲染形态 | 与 GS2 差异 |
|---|---|---|---|
| `door` | `row.door` | `A` 多行文本 | GS2 也有同名 case，**值来源不同**（§7.3） |
| `doorImg` | `row.doorImg` | `<img style="{imgStyle}" src="…">`，空 → `""` | 同（值来源不同） |
| `order` | `row.OrderID ?? row.orderID ?? row.qrcode` | 二维码 SVG（`qrSize`）+ 居中字幕（按 `/` 折行） | **逐字相同** |
| `basicInfo` | `row.basicInfo` | `A` | 同 |
| `lockImg` | `row.lockImg` | `<img>`，空 → `""` | 同 |
| `doorsheet` | `row.doorsheet` | `A` | 同（值来源不同，§7.3） |
| **`doorframe`** | `row.doorframe` | `A` | ⚠️ **PS2 新增 case（GS2 落到 `default` → `""`）** |
| **`windows`** | `row.windows`（外面包一层 `String().trim()`，冗余） | `A` | ⚠️ **PS2 新增 case** |
| `remark` | `row.remark` | `A` | 同 |
| ~~`client`~~ | — | — | ⚠️ **PS2 删除**（GS2 有 `case "client"`，读 `row.client`） |
| 其它 | — | `""` | 同 |

### 7.2 行来源：`calculateGlass()` → `calculateReceipt()`（CONFIRMED）

**这是 PS2 与 GS2 最根本的不同，且不在组件代码里。**

`HOME@448504`（ic=15 分支）：
```js
const l = await lc.value.calculateReceipt({ ping:!0, diao:!0, single:!1, singleRowData:null })
qr.value = Array.isArray(l) ? l : []
ic.value = 15
const o = await jr.value.buildProductionSheet2Html(Jr())
```
- `lc` = Hui 组件 ref（**同一个 ref**，ic=16/GS2 分支在 `HOME@450845` 调 `lc.value.calculateGlass()`）
- `jr` = PS2 组件 ref；`t(1340)` = `buildProductionSheet2Html`；`t(621)` = `calculateReceipt`；`t(730)` = `calculateGlass`（解码表 `/tmp/home-map.json`）

**其它 ic 的值**：13 = 自定义合格标签、14 = 自定义生产单（`ProductionSheet`）、
**15 = 自定义生产单2（本单）**、16 = 自定义玻璃合片单。（CONFIRMED，`HOME@448735` 的 `ic[t(755)]=15`）
Home 侧 PS2 支持的 expose：`buildProductionSheet2Html` / `refreshPreview` / `openSettingsDialog` /
`openLayoutEditor` / `printDirect` / `printSilent` / `isElectronEnv` —— **与 GS2 一模一样**（CONFIRMED）。

### 7.3 两个 generator 的行对象差异（CONFIRMED，Hui 侧）

| | `calculateReceipt` | `calculateGlass` |
|---|---|---|
| 定义 | `HUI@583638`（`_0x32bd6f`，L10997） | `HUI@556032`（`_0x4f7790`，L10594） |
| 行模板 | **L11163 @594555**（平开）/ **L11426 @615884**（吊趟） | L10731 @565165 / L10898 @577200 |
| `client` / `doorImg` | ⚠️ **二选一**：模板 A 有 `client` 无 `doorImg`，模板 B 有 `doorImg` 无 `client` | **两个键都在**（`client` 在模板里，`doorImg` 动态加） |
| `maker` | 有 | **无** |
| `kou` | 有 | **无** |
| `doorframe` / `windows` | **会赋值** | ⚠️ **从不赋值 → 恒为 `""`** |
| `casing` | 从不赋值 | 从不赋值 |

**二选一的判据**：`_0x743794.includes(registrant)`，
`_0x743794` 是 **44 家门店名白名单**（`HUI@393936`），`registrant` 是
`(await getUserData()).userinfo.registrant`（`HUI@585897`）。（CONFIRMED）

**逐字段构造差异**：

| 字段 | `calculateReceipt` | `calculateGlass` | 差异 |
|---|---|---|---|
| `door` | **非白名单**门店 = `[行["客户"]\|\|"", 行["型材"], 行["颜色"]].filter(Boolean).join("<br>")`（`HUI:11238`/`11505`） | 一律 `[行["型材"],行["颜色"]].filter(Boolean).join("<br>")` | ⚠️ **receipt 会把客户拼在最前一行**（白名单与「鸿程鑫派门窗」除外） |
| `OrderID`/`qrcode` | `行["单号"]\|\|""` | 同 | 同 |
| `doorImg` | `await getImage(行["图片ID"])`，真值才写；**白名单门店连请求都不发** → `undefined` | 同算法，**无条件请求** | 取值同、触发条件不同 |
| `lockImg` | 同 `directionImageMap` 规则（平开按归一化开向、吊趟按 `扇数+开向`） | 同 | 同 |
| `doorsheet` | 固定键序取部件，`名:值*数量`，**无「数量:N」汇总行** | `名:值` 拼 `<br>` + `<br>数量:N` | ⚠️ **算法不同** |
| `doorframe` | 平开：门框/前框/后框/门板四组；吊趟：边封/轨道组 + **`套线名：`段** | **恒 `""`** | ⚠️ **只有 receipt 有值** |
| `windows` | 平开：扣板/上亮横/上亮窗玻璃/压线；吊趟：中柱/亮窗玻璃/槽/压线 + 扣板 | **恒 `""`** | ⚠️ **只有 receipt 有值** |
| `basicInfo` | 尺寸串 + 开向；玻璃串**不带 mm**；平开双无玻 = `"无玻璃"`、吊趟 = `"无"` | 结构同，但**带 mm**，且平开双无 = `"无"`、吊趟 = `"无玻璃"` | ⚠️ **字面量与单位都不同** |
| `remark` | 平开 = `[轨道种类, 五金, 安装地址, 备注]` + **墙型段**；吊趟 = `[五金, 单双丁≠"正常", 备注, 安装地址]` | 与 **receipt 吊趟逐字一致** | ⚠️ **receipt 平开是另一套** |

> **🔴 顺带纠正 GS2 报告的一处错误**：
> `docs/custom-docs-recon/02-glasssheet2.md:82` 写「`doorframe`/`casing`/`windows`
> 初始化成 `""`，由 `_0xc8b731(row, formula)` 填」—— **错**。
> `_0xc8b731`（`HUI@398282`）只做一件事：把 `formula.hardware` 串成
> `"配件:" + …` 追加到 **`row.remark`**（调用点 `HUI:11293` / `11558`）。
> `calculateGlass` 区间内**没有任何一处**对 `doorframe`/`windows`/`casing` 赋值
> （CONFIRMED，穷举赋值点：`HUI:11223`(receipt 平开) / `11489` / `11503`(receipt 吊趟) /
> `12044` / `12069` / `12071` / `12519`(另一函数)，**全在 glass 区间之外**）。
> **这条对 GS2 无实际影响**（GS2 默认列里没有这两个 key），但会影响任何按报告 §2.2 建数据层的人。

### 7.4 对实现的直接含义

1. **列集与行来源是自洽的**：PS2 之所以有 `doorframe`/`windows` 两列，
   正是因为 `calculateReceipt` 会填这两个字段；GS2 没有这两列，
   正是因为 `calculateGlass` 从不填。**别把 PS2 的两列「补」到 GS2 上。**
2. PS2 之所以没有 `client` 列、而是把第 1 列叫「客户/门类」，
   正是因为 `calculateReceipt` 把客户拼进了 `door`（§7.3）。**标签不是随便起的。**
3. **`doorImg` 在白名单门店下是 `undefined`** → `doorImg` 列渲染空串（不报错）。
   新版数据层要么照抄这个「二选一」，要么两键都给（**后者会让白名单门店反而有门图**，
   是行为偏离，需拍板）。
4. 新版的数据层在 `app/src/utils/printPayloads.ts`（`glassProduces()` 是 GS2 那条）。
   **PS2 需要另一条 receipt 口径的产出函数**；`utils/glasssheet2/` 只吃行对象，不用改。

---

## 8. localStorage 键名（问题 7）

| 用途 | PS2 键 | GS2 键 | 定义处 |
|---|---|---|---|
| 整份 `{paper,table,print}` JSON | **`production_sheet2_template_v1`** | `glass_sheet2_template_v1` | `HOME@292707`（PS2） |
| 打印机名（裸字符串，Electron 专属） | **`production_sheet2_printer_v1`** | `glass_sheet2_printer_v1` | 同上 |

- 写入：`PS2:127`（`C()`，配置）/ `PS2:133`（`z()`，打印机）
- 读取：`PS2:716`（`onMounted`，配置）/ `PS2:798`（`onMounted`，打印机）

**两个键、JSON 与裸串、写入时机 —— 全部与 GS2 同构，只有名字不同。**
（CONFIRMED，`HOME@292707` 处的 module 级常量 `yn` / `vn` 声明）

---

## 9. `getItemsPerPage`（问题 8）

**PS2 没有。**（CONFIRMED）

```
grep -c getItemsPerPage:
  GlassSheet2.deobfuscated.js      0
  ProductionSheet2.deobfuscated.js 0   ← 本单
  ProductionSheet.deobfuscated.js  1   ← 是这张（旧版非自定义「生产单」）
  QualifiedLabel.deobfuscated.js   0
```
唯一一处：`ProductionSheet.deobfuscated.js:1487`
`getItemsPerPage: () => r.value.print.itemsPerPage`。

骨架报告的表述「只有 PS（生产单）有」指的是 **`ProductionSheet`**，
**不是 `ProductionSheet2`**。PS2 与 GS2 一样**没有每页条数设置**，
分页完全靠实测高度（§5）。

---

## 10. 组件层 / 渲染期的其它字符串差异（问题 1 补充）

| 位置 | PS2 | GS2 |
|---|---|---|
| `__name` | `ProductionSheet2PrintManager`（`PS2:2`） | `GlassSheet2PrintManager`（`GS2:2`） |
| expose 方法名 | `buildProductionSheet2Html`（`PS2:805`） | `buildGlassSheet2Html`（`GS2:779`） |
| 打印设置弹窗标题 | `自定义生产单2 - 打印设置`（`PS2:946`） | `自定义玻璃合片单 - 打印设置` |
| 布局编辑弹窗标题 | `自定义生产单2 - 布局编辑`（`PS2:1400`） | `自定义玻璃合片单 - 布局编辑` |
| `printDirect` Loading 文案 | `正在生成生产单...`（`PS2:829`） | `正在生成玻璃合片单...` |
| `J` 的 `<title>` | `自定义生产单2`（`PS2:703`） | `自定义玻璃合片单` |
| Home 侧「组件未就绪」 | `自定义生产单2组件未就绪`（`HOME@448540` 附近） | `自定义玻璃合片单组件未就绪` |

**`printSilent` 文案**（`已发送至打印机` / `打印失败：` / `直接打印失败: ` /
`直接打印仅在Electron客户端可用`）**两边逐字相同**（CONFIRMED）。
**`printDirect` 里 GS2 那段无用的 `const a = l,`（`GS2:823`）在 PS2 被去掉了**（`PS2:849`）——
纯噪声，无行为差异。

**其余渲染函数（两个弹窗的全部控件、布局编辑器左栏、排序上下箭头、
`el-table` 列、`el-input-number` 的 min/max/step、常用尺寸 A4/A5/B5 预设、
方向下拉）逐字相同**（CONFIRMED，去空白后 87 行差异里没有一条落在这里）。

---

## 11. 施工图：照着改 GS2 实现的清单

> 目标仓库现状：`app/src/utils/glasssheet2/{types,defaults,sanitize,storage,css,html,paginate,print,qr,index}.ts`
> + `app/src/components/GlassSheet2{Drawer,SettingsDialog,LayoutDialog}.vue`，消费者 `app/src/views/Home.vue`。

| # | 改动 | 落到哪个文件 | 对应本文 | 量级 |
|---|---|---|---|---|
| 1 | 类名前缀参数化：`gs-root`/`gs-sheet`/`gs2-*` → 由 `prefix` 注入 | `css.ts`（23 处 `gs`/`gs2`）、`html.ts`（18 处）、`paginate.ts:124`（1 处代码 `.gs2-line` + 3 处注释） | §4.2 | 机械替换，**注意 `gs` 与 `gs2` 两套并存，单一 `gs`→`ps` 替换正好都对** |
| 2 | `renderMultiline` 加 `keepEmptyLines` 选项（空段 → `<div class="…-line">&nbsp;</div>`，**不返回空串**） | `html.ts:76-83` | §6 | **真逻辑改动，别改坏 GS2** |
| 3 | 默认列集换成 9 列（§2.2 那张表），`title` → `生产单` | `defaults.ts` | §2.1/§2.2 | 数据 |
| 4 | `renderCell` 删 `case 'client'`，加 `case 'doorframe'`/`case 'windows'` | `html.ts:187-227` | §7.1 | 小 |
| 5 | localStorage 两个键改名 | `storage.ts:15-19` | §8 | 小 |
| 6 | 组件/文案：`__name`、expose 名、两个弹窗标题、Loading 文案、`<title>` | 新 `.vue` + `html.ts:370` | §10 | 小 |
| 7 | 分页代码**不动** | `paginate.ts` | §5 | **零** |
| 8 | CSS 内容**不动**（只有前缀变） | `css.ts` | §4.2 | 零 |
| 9 | 数据层：新增 `calculateReceipt` 口径的产出函数（`door` 拼客户、`doorframe`/`windows` 有值、`doorsheet` 格式不同） | `utils/printPayloads.ts` | §7.3 | **大，且不在 glasssheet2 目录内** |
| 10 | 验收夹具：`/tmp/ps2-recon/ps2-default.css`（1739 字符，`shasum 2ac1613b…`） | 建议移入 `docs/custom-docs-recon/` | §4.1 | 小 |

**共用底座建议（INTERPRETED）**：1/2/6 加起来说明
「GS2 与 PS2 的 `utils/` 差异 = 前缀 + 空行语义 + 默认配置 + 3 个文案」，
其余 100% 同构。**把前缀当作配置项注入，`renderMultiline` 加一个开关，
默认配置由调用方传** —— 就能覆盖两张单子，不需要复制整个目录。

---

## 12. 未确认

1. **`calculateReceipt` 的多行 `<br>` 串里会不会出现连续 `<br>`**（即「空段」）
   —— 直接决定 §6 的 `&nbsp;` 分支在实际数据上触发多少。
   已知 `door`/`basicInfo`/`doorsheet`/`doorframe`/`windows`/`remark` 都可能是
   **整个空串**（一定触发），但**串内空段**未逐条验证。**未确认。**
2. **PS2 的 `U` 里 `windows` 那层 `String(...).trim()` 是不是原作者有意为之**
   —— 行为等价，看不出动机。**无影响，标记未确认。**
3. **白名单 44 家门店之外，`door` 里客户的位置是否真的会渲染出「客户/门类」两行**
   —— 依赖 `行["客户"]` 非空；`filter(Boolean)` 保证空客户不留空行（在 receipt 侧），
   但 `A`（PS2 侧）会把空段变 `&nbsp;`。**端到端未实测。未确认。**
4. **`HUI` 侧 `_0x743794` 那 44 家名单是否随租户配置变化**（硬编码 vs 服务端下发）
   —— 子代理读到的是硬编码常量数组（`HUI@393936`）。**未复核是否有第二处覆盖。未确认。**
