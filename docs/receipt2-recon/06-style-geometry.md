# 收据单2 · 样式与版面几何（完整逆向）

对象：`/Users/aaa/Desktop/door-main/legacy/js/Receipt2.deobfuscated.js`
（组件 `Receipt2PrintManager`，2637 行；字符串已解码，变量名仍为单字母，**按作用域就近读**）

标记：**CONFIRMED** = 直接从代码读到；**INTERPRETED** = 推断（附依据）。

---

## 0. 先纠正任务书里的两处误认（重要，会影响其他几路）

| 任务书原文 | 实际情况 | 依据 |
|---|---|---|
| 「字段的 `x`（那 10 个默认数 `[13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5]`）」 | **这不是字段坐标，是明细表 10 列的默认列宽（百分比 %）**。字段坐标叫 `offsetXMm` / `offsetYMm`，单位 mm，默认全 0。 | `Receipt2.deobfuscated.js:11` 定义 → `:12` 包成 `n` → 唯一消费点是 CSS 生成器里的 `n["value"][0]`…`n["value"][9]` + `"%"`（`:390-408`）；另在 `:1117` 以 `columnWidths: [...n["value"]]` 导出。 | CONFIRMED |
| 「`columnWidths` 默认 `[96,120,120,96,80,80,80,176,100,100,160,100]`」 | **本组件没有这个数组**。那 12 个数是 Home 里**「君豪汇总订单」Excel 导出设置**的列宽（px），localStorage key `junhaoOrderSummaryExcelSettings`；UI 上 `min:48 max:360`。 | `legacy/js/Home.formatted.js:640`（`rowHeight:60,columnWidths:[96,120,...]`）、`:7305`；`docs/2026-09-17-home-analysis.md:313`。全仓库 grep `receipt2` 相关 CSS/JS 均无 12 元素数组。 | CONFIRMED |

顺带记一下本组件的 localStorage key（`Home.formatted.js:2372` 已解码确认）：
`receipt2_font_settings` / `receipt2_column_widths` / `receipt2_selected_printer` / `receipt2_print_settings` / `receipt2_visibility_settings` / `receipt2_brand_settings` / `receipt2_element_configs`。

---

## 1. CSS 原文（逐字，未删减）

### 1.1 来源与注入点

只有**一个** CSS 生成器：`ue = (e, t) => '...'`（`:371-438`）。
- 形参 `e` = **字号设置**（经 `Z()` 归一化，`:252-289`）
- 形参 `t` = **打印/纸张设置**（经 `X()` 归一化，`:290-306`）

它被注入到 **5 个地方**，每次都是同一份字符串（CONFIRMED）：

| # | 注入位置 | 行号 | 用途 |
|---|---|---|---|
| 1 | `buildReceipt2Html` 返回的预览片段 `<div class="receipt2-root"><style>…</style>…` | `:733-737` | 页面内预览（**注意：`<style>` 未加 scope，会污染宿主页**） |
| 2 | 浏览器打印 iframe | `:750-752` | `exportReceipt2PdfToBrowserPrint` |
| 3 | `printFromContainer` iframe | `:1233-1235` | 从预览容器克隆后打印 |
| 4 | Electron 静默打印 HTML | `:1304-1306` | `printSilent` |
| 5 | 分页测量用临时 div（**额外追加 2 条覆盖**） | `:634-637` | 量行高 |

**没有外部样式表**：生成的 HTML 里只有 `<style>`，**不使用 `print-lock.css`**（`print-lock.css` 是 hiprint 模板那条链路的，见 `docs/2026-09-16-print-font.md:12`）。CONFIRMED——grep 全仓库 `legacy/css/*.css`，**没有任何一条规则提到 `receipt2`**，本单据样式 100% 自包含。

### 1.2 完整 CSS（以默认纸型 200mm×140mm landscape、默认字号渲染，逐字节复制自模板）

```css

  * { box-sizing: border-box; }
  .receipt2-root { color: #000; background: #fff; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
  .receipt2-page {
    width: 200mm; height: 140mm;
    padding: 4mm 4mm 3mm; background: #fff;
    display: flex; flex-direction: column; overflow: hidden;
    page-break-after: always;
  }
  .receipt2-page:last-child { page-break-after: auto; }
  .receipt2-header {
    display: grid; grid-template-columns: 1fr 2fr 1fr;
    align-items: start; margin-bottom: 2mm; flex-shrink: 0;
  }
  .receipt2-order { font-size: 13px; padding-top: 1mm; }
  .receipt2-title { text-align: center; font-size: 30px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.05; }
  .receipt2-header-left { display: flex; align-items: flex-start; justify-content: flex-start; gap: 2mm; }
  .receipt2-header-right { display: flex; align-items: flex-start; justify-content: flex-end; gap: 2mm; }
  .receipt2-date { font-size: 13px; padding-top: 1mm; white-space: nowrap; }
  .receipt2-qrcode { width: 18mm; height: 18mm; object-fit: contain; border: 1px solid #bbb; }
  .receipt2-qrcode-empty { border-style: dashed; }
  .receipt2-meta-row {
    display: grid; grid-template-columns: 1.2fr 1.5fr 1.7fr 0.8fr;
    gap: 1.5mm; margin-bottom: 1.5mm; font-size: 18px; line-height: 1.2; flex-shrink: 0;
  }
  .receipt2-meta-row span { overflow: hidden; white-space: nowrap; display: flex; align-items: center; }
  .receipt2-meta-row span:nth-child(3) { padding-left: 6mm; }
  .receipt2-table {
    width: 100%; border-collapse: collapse; table-layout: fixed;
    font-size: 15px; margin-bottom: 1.5mm;
  }
  .receipt2-table th, .receipt2-table td {
    border: 1px solid #000; padding: 1mm 0.8mm;
    vertical-align: top; line-height: 1.18; word-break: break-all;
  }
  .receipt2-table th { text-align: center; font-weight: 600; }
  .receipt2-table td { text-align: left; }
  .receipt2-table .cell-multi { white-space: pre-line; }
  .receipt2-table th:nth-child(1), .receipt2-table td:nth-child(1) { width: 13.2%; }
  .receipt2-table th:nth-child(2), .receipt2-table td:nth-child(2) { width: 4.2%; text-align: center; }
  .receipt2-table th:nth-child(3), .receipt2-table td:nth-child(3) { width: 6.6%; text-align: center; }
  .receipt2-table th:nth-child(4), .receipt2-table td:nth-child(4) { width: 12.1%; }
  .receipt2-table th:nth-child(5), .receipt2-table td:nth-child(5) { width: 13.6%; }
  .receipt2-table th:nth-child(6), .receipt2-table td:nth-child(6) { width: 4%; text-align: center; }
  .receipt2-table th:nth-child(7), .receipt2-table td:nth-child(7) { width: 4.4%; text-align: center; }
  .receipt2-table th:nth-child(8), .receipt2-table td:nth-child(8) { width: 5.4%; text-align: center; }
  .receipt2-table th:nth-child(9), .receipt2-table td:nth-child(9) { width: 22.8%; }
  .receipt2-table th:nth-child(10), .receipt2-table td:nth-child(10) { width: 13.5%; }
  .empty-row { text-align: center !important; vertical-align: middle !important; color: #666; }
  .receipt2-amounts {
    display: grid; grid-template-columns: repeat(3, 1fr);
    margin-bottom: 1.2mm; color: #d9001b; font-size: 20px; line-height: 1; flex-shrink: 0;
  }
  .receipt2-amounts span { white-space: nowrap; }
  .receipt2-declaration {
    border-top: 1px dashed #999; padding-top: 1.2mm;
    white-space: pre-line; line-height: 1.16; font-size: 15px; flex: 1; overflow: hidden;
  }
  @page { size: 140mm 200mm; margin: 0; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    
    .receipt2-root { display: block !important; background: #fff !important; padding: 0 !important; gap: 0 !important; }
    .r2-page-wrap { width: 140mm !important; height: 200mm !important; overflow: hidden !important; position: relative !important; page-break-after: always !important; }
    .r2-page-wrap:last-child { page-break-after: auto !important; }
    .receipt2-page { position: absolute !important; top: 0 !important; left: 0 !important; width: 200mm !important; height: 140mm !important; transform-origin: top left !important; transform: translateY(200mm) rotate(-90deg) !important; box-shadow: none !important; page-break-after: auto !important; }
    
    .receipt2-table { border-collapse: collapse !important; }
    .receipt2-table th, .receipt2-table td { border: 1px solid #000 !important; }
  }
  @media screen {
    .receipt2-root { background: #c0c0c0; padding: 12mm; display: flex; flex-direction: column; align-items: center; gap: 8mm; min-width: fit-content; }
    .receipt2-page { position: relative; box-shadow: 0 3px 14px rgba(0,0,0,0.28); }
    [data-r2-el] { cursor: pointer; transition: outline 0.15s; border-radius: 2px; position: relative; z-index: 5; }
    [data-r2-el]:hover { outline: 2px dashed #409eff; outline-offset: 1px; z-index: 10; }
  }

```

> 说明：首行空行、每个 `@media` 块前的 4 空格缩进行，都是模板里 `"\n    "` 拼出来的**真实字符**，原样保留。
> 上面是 **landscape** 变体。**portrait** 变体只有 3 处不同（CONFIRMED，用 `diff` 验过）：
> 1. `.receipt2-page` 的 `width/height` 换成 `{widthMm}mm / {heightMm}mm`；
> 2. `@page { size: {widthMm}mm {heightMm}mm; margin: 0; }`（**不交换**）；
> 3. **整个 `.r2-page-wrap` / 旋转 `.receipt2-page` 那 5 行完全不出现**（模板里是三元 `orientation === "landscape" ? "..." : ""`，`:425-437`）。

复现脚本（可重跑核对）：`/tmp/r2-analysis/extract-css.cjs`，产物 `/tmp/r2-analysis/css-landscape.css`、`/tmp/r2-analysis/css-portrait.css`。

### 1.3 分页测量专用的额外 CSS（只在临时量高 div 里，`:634-637`）

```css
/* 前缀是 ue(...) 的完整输出，其后追加： */
      #r2mp { height: auto !important; overflow: visible !important; }
      #r2mf .receipt2-declaration { flex: 0 0 auto !important; min-height: 0 !important; }
```
**CONFIRMED**。作用：让单页长成自然高度以便逐行量高；让说明块不抢 `flex:1` 的剩余空间。

### 1.4 元素编辑弹窗的 CSS（**不在**收据 HTML 里，在宿主全局样式表）

源码位置：`legacy/css/Home-97d96482.css`（CONFIRMED，且该文件是唯一含 `r2-el-editor` 的 CSS）。模板里只挂了类名（`Receipt2.deobfuscated.js:2414`、`:2424`、`:2437`、`:2462`、`:2487`、`:2526`、`:2566`、`:2587`，对应 Home.formatted.js:2359-2371 的 hoist 常量 `oa/aa/na/ua/ra/ia/ca`）。

```css
.r2-el-editor-mask { position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.15) }
.r2-el-editor { position:fixed;z-index:9999;background:#fff;border:1px solid #dcdfe6;border-radius:8px;box-shadow:0 4px 20px #0000002e;padding:14px 16px;min-width:270px;font-size:13px }
.r2-el-editor-title { font-size:15px;font-weight:600;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #ebeef5;color:#303133 }
.r2-el-editor-row { display:flex;align-items:center;gap:8px;margin-bottom:8px }
.r2-el-editor-row label { width:72px;text-align:right;color:#606266;flex-shrink:0 }
.r2-el-editor-actions { display:flex;justify-content:flex-end;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid #ebeef5 }
```
（已按源码原样保留压缩格式，未加空格。）

弹窗定位：`style="{ top: U.top + 'px', left: U.left + 'px' }"`（`:2425-2428`），`U` 由 `Ce()` 计算（`:965-972`）：`top = 锚点.bottom + 8`，若 `top + 240 > innerHeight` 则改 `max(8, 锚点.top - 240 - 8)`；`left = 锚点.left`，若 `left + 280 > innerWidth` 则 `max(8, innerWidth - 280 - 8)`。CONFIRMED。

### 1.5 列宽拖拽手柄的 CSS（运行时内联，`:889-890`）

```
position:absolute;right:-3px;top:0;width:6px;height:100%;cursor:col-resize;z-index:20;background:transparent;user-select:none;
```
hover → `background: rgba(64,158,255,0.35)`（`:893`）；拖拽中 → `rgba(64,158,255,0.55)`（`:909`）；mouseup 恢复 `transparent`（`:926`）。
挂载时同时给该 `th` 打 `position:relative; overflow:visible`（`:884-885`）。手柄只挂在**前 N-1 个** `thead th` 上（`:883` `if (u === a.length - 1) return`）。

---

## 2. `.receipt2-*` 类名全表（逐条注解）

| 选择器 | 全部声明 | 说明 |
|---|---|---|
| `*` | `box-sizing: border-box` | 全局。`200mm × 140mm` 含 4mm/4mm/3mm padding → **内容区 = 192mm × 133mm** |
| `.receipt2-root` | 基础：`color: #000; background: #fff; font-family: "Microsoft YaHei", "PingFang SC", sans-serif`；screen：`background: #c0c0c0; padding: 12mm; display:flex; flex-direction:column; align-items:center; gap:8mm; min-width:fit-content`；print：`display:block !important; background:#fff !important; padding:0 !important; gap:0 !important` | 字体族**只在这一条**，其余全部继承。**没有 `globalFont` 之类可配置项**，字体族是写死的 |
| `.receipt2-page` | `width: {widthMm}mm; height: {heightMm}mm; padding: 4mm 4mm 3mm; background:#fff; display:flex; flex-direction:column; overflow:hidden; page-break-after:always`；screen：`position:relative; box-shadow: 0 3px 14px rgba(0,0,0,0.28)`；print：见上（landscape 有旋转） | **固定 mm**，不是百分比。取色/尺寸来自打印设置 `X(h.value)` |
| `.receipt2-page:last-child` | `page-break-after: auto` | |
| `.receipt2-header` | `display:grid; grid-template-columns: 1fr 2fr 1fr; align-items:start; margin-bottom:2mm; flex-shrink:0` | 左/标题/右 |
| `.receipt2-order` | `font-size:{orderDateFontSize}px; padding-top:1mm` | 编号。**无 `white-space:nowrap`**（与 `.receipt2-date` 不同） |
| `.receipt2-title` | `text-align:center; font-size:{headerFontSize}px; font-weight:700; letter-spacing:0.5px; line-height:1.05` | 品牌标题 |
| `.receipt2-header-left` | `display:flex; align-items:flex-start; justify-content:flex-start; gap:2mm` | |
| `.receipt2-header-right` | `display:flex; align-items:flex-start; justify-content:flex-end; gap:2mm` | |
| `.receipt2-date` | `font-size:{orderDateFontSize}px; padding-top:1mm; white-space:nowrap` | 日期 |
| `.receipt2-qrcode` | `width:18mm; height:18mm; object-fit:contain; border:1px solid #bbb` | **两处 18 都是硬编码字面量**（`:382-384` 是 `"width: 18" + "mm; height: " + 18 + "mm"`），无配置项 |
| `.receipt2-qrcode-empty` | `border-style: dashed` | 无二维码时渲染空 div，虚线框 |
| `.receipt2-meta-row` | `display:grid; grid-template-columns: 1.2fr 1.5fr 1.7fr 0.8fr; gap:1.5mm; margin-bottom:1.5mm; font-size:{metaFontSize}px; line-height:1.2; flex-shrink:0` | **⚠ 这里的列定义实际是死代码**：只要渲染该行就一定带内联 `grid-template-columns: repeat(N,'1fr')` 把它盖掉（`:556-558`）。保真时仍要照抄 |
| `.receipt2-meta-row span` | `overflow:hidden; white-space:nowrap; display:flex; align-items:center` | `display:flex` 使 span 撑满格宽；`overflow:hidden` 是 shrink-fit 的裁剪基础 |
| `.receipt2-meta-row span:nth-child(3)` | `padding-left: 6mm` | **写死第 3 格**。注意 `metaOrder` 可拖拽换序，换序后这 6mm 仍加在第 3 个上（原版即如此） |
| `.receipt2-table` | `width:100%; border-collapse:collapse; table-layout:fixed; font-size:{tableFontSize}px; margin-bottom:1.5mm` | print 里再声明一次 `border-collapse: collapse !important` |
| `.receipt2-table th, .receipt2-table td` | `border:1px solid #000; padding:1mm 0.8mm; vertical-align:top; line-height:1.18; word-break:break-all` | 四边框实线；**上对齐**；print 里 `border: 1px solid #000 !important` |
| `.receipt2-table th` | `text-align:center; font-weight:600` | |
| `.receipt2-table td` | `text-align:left` | 被下面的 nth-child 规则按列覆盖 |
| `.receipt2-table .cell-multi` | `white-space: pre-line` | 配合 `oe()` 把 `<br>` 转 `\n` |
| 第 1 列 | `width: 13.2%` | 型材（cell-multi） |
| 第 2 列 | `width: 4.2%; text-align: center` | 开向 |
| 第 3 列 | `width: 6.6%; text-align: center` | 颜色 |
| 第 4 列 | `width: 12.1%` | 玻璃（cell-multi） |
| 第 5 列 | `width: 13.6%` | 尺寸（cell-multi） |
| 第 6 列 | `width: 4%; text-align: center` | 数量 |
| 第 7 列 | `width: 4.4%; text-align: center` | 单价 |
| 第 8 列 | `width: 5.4%; text-align: center` | 金额 |
| 第 9 列 | `width: 22.8%` | 计价方式（cell-multi） |
| 第 10 列 | `width: 13.5%` | 备注（cell-multi） |
| `.empty-row` | `text-align:center !important; vertical-align:middle !important; color:#666` | `<td colspan="10">暂无明细</td>` |
| `.receipt2-amounts` | `display:grid; grid-template-columns: repeat(3, 1fr); margin-bottom:1.2mm; color:#d9001b; font-size:{amountFontSize}px; line-height:1; flex-shrink:0` | 红色 `#d9001b`。**无 text-align（默认左对齐）** |
| `.receipt2-amounts span` | `white-space: nowrap` | |
| `.receipt2-declaration` | `border-top:1px dashed #999; padding-top:1.2mm; white-space:pre-line; line-height:1.16; font-size:{declarationFontSize}px; flex:1; overflow:hidden` | `flex:1` 吃掉页面剩余高度 |
| `.r2-page-wrap` | **只在 `@media print` 内、且只在 landscape 时存在** | 见 §8 |
| `[data-r2-el]` / `:hover` | screen 才生效 | 见上 |

**类名清单（共 15 个 `receipt2-*` + 2 个非前缀）**：
`receipt2-root`、`receipt2-page`、`receipt2-header`、`receipt2-order`、`receipt2-title`、`receipt2-header-left`、`receipt2-header-right`、`receipt2-date`、`receipt2-qrcode`、`receipt2-qrcode-empty`、`receipt2-meta-row`、`receipt2-table`、`receipt2-amounts`、`receipt2-declaration`、`cell-multi`、`empty-row`、`r2-page-wrap`。

**颜色值总表（原样）**：`#000`、`#fff`、`#c0c0c0`、`#bbb`、`#999`、`#666`、`#d9001b`、`#409eff`、`rgba(0,0,0,0.28)`。
**`print-color-adjust`**：仅一处 —— `@media print` 里的 `* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`（`:424`）。
**`@media print` 内容**：见 §1.2 原文（共 6 条规则 + `html,body` 归零 + `*` 颜色保真）。

---

## 3. 版面几何：页面被切成哪几块

DOM 顺序（CONFIRMED，由 `me()` `:603-614` 拼出）：

```
<section class="receipt2-page">
  ├─ 页头块（de() :562-577）
  │   ├─ <div class="receipt2-header">        grid 1fr 2fr 1fr
  │   │   ├─ <div class="receipt2-header-left">  …编号/日期/二维码（按 position 配置）…</div>   或 <div></div>
  │   │   ├─ <div class="receipt2-title">  品牌标题  </div>
  │   │   └─ <div class="receipt2-header-right"> …</div>                                     或 <div></div>
  │   └─ <div class="receipt2-meta-row" style="grid-template-columns:1fr …">客户/电话/安装地址/生产天数</div>   （无可见字段时整块不渲染）
  ├─ <table class="receipt2-table">
  │   ├─ <thead><tr> 固定 10 个 <th> </tr></thead>
  │   └─ <tbody> 明细行 或 <tr><td colspan="10" class="empty-row">暂无明细</td></tr> </tbody>
  └─ 页脚块（Ve() :579-602）— **只在最后一页渲染**（me() 第三参 `o`）
      ├─ <div class="receipt2-amounts"> <span>总额：…</span><span>已付：…</span><span>未付：…</span> </div>
      └─ <div class="receipt2-declaration">说明</div>
</section>
```

- **块间距全部来自 CSS**，DOM 里没有为间距写内联 style（唯一的间距内联是 meta-row 的 `grid-template-columns`）。CONFIRMED。
- 页内纵向节奏：`header margin-bottom 2mm` → `meta-row margin-bottom 1.5mm` → `table margin-bottom 1.5mm` → `amounts margin-bottom 1.2mm` → `declaration`（`flex:1` 占满剩余）。
- `.receipt2-page` 是 `display:flex; flex-direction:column; overflow:hidden` → 内容超出**直接裁掉**（不流到下一页；分页靠 JS 预计算，见 §6 与 r2-render 篇）。
- **页头左右两栏只放「编号/日期/二维码」**，`meta-row` 才放客户信息。左右栏全空时输出 `<div></div>` 占位以维持 3 列网格（`:512-519`）。

---

## 4. 内联样式（渲染时打到元素上的 `style="…"`）

### 4.1 字段级：`M(e)` → `ce(key)`

`M`（`:104-124`）按顺序 push，最后 `join(";")`；`ce`（`:463-469`）拼出 `data-r2-el="键"` + （非空时）`style="…"`：

| 条件 | 产出 | 行号 |
|---|---|---|
| `!e.visible` | `display:none` | `:108` |
| `offsetXMm !== 0 \|\| offsetYMm !== 0` | `position:relative;left:{offsetXMm}mm;top:{offsetYMm}mm;z-index:10` | `:109-116` |
| `fontSize > 0` | `font-size:{fontSize}px` | `:117` |
| `widthMm > 0` | `width:{widthMm}mm;max-width:{widthMm}mm` | `:118-121` |
| 以上都不满足 | 无 `style` 属性（`ce` 的三元） | `:468` |

字段配置默认值（`L()` `:125-136`）：`{ offsetXMm: 0, offsetYMm: 0, fontSize: 0, widthMm: 0, visible: true }`，**10 个键**：`orderNo, date, title, qrcode, client, tel, address, productionDays, amounts, declaration`（`:80-91`）。
- `fontSize = 0` 表示「用 CSS 里的默认值」（弹窗提示文案就是「0=默认」，`:2522`）。
- 字体族、字重、颜色**没有字段级配置**，只能改字号。
- 字号来源：**只有** `fields[key].fontSize`（内联，最高优先级）；CSS 里的字号来自 `Z(字体设置)` 的 6 个全局值。**不存在 `globalFont` 这个配置项**（CONFIRMED：全文件无该标识符）。

### 4.2 容器级内联样式

| 元素 | style | 行号 |
|---|---|---|
| `<div class="receipt2-meta-row">` | `grid-template-columns: 1fr 1fr …`（个数 = 可见字段数，永远全是 `1fr`） | `:556-558` |
| `<div class="receipt2-title">` | 来自 `ce("title")` | `:565-566` |
| 二维码 `<img>` / 空 `<div>` | 来自 `ce("qrcode")`（`src` 是数据/URL 原值，未转义） | `:481-488` |
| 编号 / 日期 / amounts / declaration | 各自 `ce(...)` | `:490,496,584,595` |
| **`.receipt2-order/date/title` 等不支持换行** | 无 `white-space` 内联 | — |

### 4.3 宿主页预览容器的内联样式（Home 模板，非本组件）

`Home.formatted.js:11827-11831`，解码后（`dr` 表）：

```js
Vue.createElementVNode("div", {
  ref_key: "commentPreviewContainer", ref: ao,
  innerHTML: Wn.value,
  style: {
    width: (ic.value === 15 || ic.value === 16) ? "fit-content" : "1123px",
    margin: "0 auto",
    maxWidth: "100%",
    overflowX: (ic.value === 15 || ic.value === 16) ? "auto" : undefined,
    position: "relative",
    zIndex: 1
  }
})
```
CONFIRMED（`s(1177)="div"`, `s(1178)="commentPreviewContainer"`, `s(671)="0 auto"`, `s(1281)="relative"`, `s(1288)="fit-content"`，均取自 `/tmp/home-map.json` 的 `dr` 表）。`ic` 是预览类型/板型开关，取值 15/16 时容器改成 `fit-content + overflowX:auto`。

---

## 5. 元素坐标与显隐

- **单位是 mm**，且是**相对偏移**（`position: relative; left/top`），不是绝对定位。字段配置项名就叫 `offsetXMm` / `offsetYMm`（弹窗 label「X偏移(mm)」`:2442`、「Y偏移(mm)」`:2467`），步长 `step: 0.5`、`precision: 1`（`:2452-2453`）。取值**无范围限制**（输入框未设 min/max）。CONFIRMED。
- 设了偏移就带 `z-index:10`（内联），配合 screen 下 `[data-r2-el]` 的 `z-index:5`。
- `widthMm` 同时写 `width` 和 `max-width`（弹窗 label「宽度(mm)」`:2531`，`min:0 max:300`，`step:0.5`，`precision:1`）。
- **`visible: false` → `display:none`（元素仍然渲染）**，不是不渲染、也不是 `visibility:hidden`。CONFIRMED（`:108`）。

  ⚠ 与「显隐设置」是两套独立的开关，**串联**生效，缺一不可：
  - `showXxx`（打印设置里的勾选）控制**要不要拼这段 HTML**（`:503-511`、`:547-550`、`:583`、`:594`）；
  - `fields[key].visible`（元素编辑弹窗里的「显示」勾选）控制**打上 `display:none`**（`:108`）。
  - 判定函数 `se(key) = !cfg || cfg.visible`（`:470-474`）。
  - 因此弹窗里取消勾选后，元素仍在 DOM 里但不占位（`display:none`）；而设置里取消勾选则是整个元素消失，`data-r2-el` 锚点也没了 → 也就**无法再点选编辑**。

- **那 10 个默认数不是坐标**，是列宽百分比，见 §0 与 §7。

---

## 6. `data-shrink-fit`：收缩算法

**挂在哪**：只有 `client`（客户）、`tel`（电话）、`address`（安装地址）三个 `<span>`（`:522、:528、:534`）。
**`productionDays` 没有这个属性**（`:539-544`）。标题/编号/日期/二维码也没有。CONFIRMED。

**算法**（两处实现：预览 `pe()` `:857-871`；打印 iframe `ye()` `:779-795`，逻辑逐字相同）：

```js
el.style.fontSize = "";                       // 先清掉内联字号，回到 CSS 默认
const w = el.getBoundingClientRect().width;   // 以「清空后」的盒子宽作为目标宽
if (w <= 0) return;                           // 不可见就跳过
const prevOverflow = el.style.overflow;
el.style.overflow = "visible";                // 测量期间别被 overflow:hidden 干扰
const base = parseFloat(getComputedStyle(el).fontSize);   // = metaFontSize
const floor = Math.max(6, 0.5 * base);        // 下限 = 基准的一半，且不低于 6px
let f = base;
while (el.scrollWidth > w + 1 && f > floor) { f -= 0.5; el.style.fontSize = f + "px"; }
el.style.overflow = prevOverflow;             // 复原（原本是 ""，即回到 CSS 的 hidden）
```

要点（全部 CONFIRMED）：
1. **只改 `font-size`，不用 transform / scale**。步长 0.5px。
2. 目标宽度 `w` 是**元素自身盒宽**（`.receipt2-meta-row span` 是 grid item + `display:flex`，会撑满格宽），所以等价于「该格可用宽度」。
3. 字号下限 `max(6, base/2)`。默认 `metaFontSize = 18` → 下限 9px。
4. 停止条件是 `scrollWidth > w + 1`（1px 容差）。
5. 收缩结果写在**内联 style** 上，因此 `cloneNode(true)` 克隆出来的打印 DOM **会带着收缩结果**（`printFromContainer` `:1230`、`printSilent` `:1289`）。而 `ye()`（另起 iframe 重新生成 HTML）里会在 iframe 内部重跑一遍。
6. **调用时机**：预览刷新后 `pe(S)`（`:1001`，在 `requestAnimationFrame` 里）；打印 iframe 里是先等图片加载完 → `setTimeout(…, 500)` 再算（`:777-803`）。
7. **触发条件**：只要元素有 `data-shrink-fit` 且 `width > 0` 就跑，没有内容长度判断——不溢出时循环一次都不进。
8. `pe()` 每次重跑前先清空所有内联字号（`:860`），所以是幂等的；并且每次都先删掉旧的 `.r2-resize-handle` 再重建（`:874-876`）。

---

## 7. 列宽

- **单位：百分比（%）**（CONFIRMED，`:390-408` 拼 `+ "%"`）。默认 `[13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5]`，**合计 99.8%**（不是 100%），配合 `table-layout: fixed` 由浏览器按比例分配。
- **进表格的方式：CSS 规则，不是 `<colgroup>`，也不是 `th.style.width`**。渲染时由 `ue()` 生成 `th:nth-child(n), td:nth-child(n) { width: X% }`（同时命中 `th` 和 `td`，特异性 (0,2,1)）。
- **持久化**：localStorage `receipt2_column_widths`（`:938` 写、`:1080-1088` 读）。读入校验 `Array.isArray && length === 10`，每项 `Math.max(3, Number(e) || 3)`；失败回落到默认数组。写入时 `Math.round(x * 10) / 10`（保留 1 位小数，`:934`）。
- **拖拽改宽**（`:899-942`）：在 `mousemove` 里把像素位移换算成百分比（`(clientX - startX) / tableWidth * 100`），同时改**相邻两列**（当前列 `+Δ`、右列 `-Δ`），两列各自下限 3%（`:913-914`）；写入的是**容器内所有 `.receipt2-table` 的 `thead th`**（多页同步，`:915-920`）。注意**只写 `th`**，`td` 靠 `table-layout:fixed` 跟随。
- 拖拽时取的基准宽：`th.getBoundingClientRect().width / tableWidth * 100`（`:906-908`）。
- `printDirect` 的 payload 里 `columnWidths: [...n["value"]]`（`:1117`）——即 10 个百分比。

---

## 8. 打印专属样式

1. **`@page { size: … }` 的值从哪来**：来自**打印设置** `h.value`，经 `X()` 归一化（`:290-306`）：
   - `widthMm` / `heightMm`：`K(值, 50, 500, 默认)`，默认 `s = { copies:1, widthMm:200, heightMm:140, orientation:"landscape" }`（`:24`）。
   - 生成规则（`:417-421`）：
     - `orientation === "landscape"` → `size: {heightMm}mm {widthMm}mm`（**交换**）
     - 否则 → `size: {widthMm}mm {heightMm}mm`（不交换）
     - `margin: 0` **恒为 0**。
   - `orientation` 缺省时的自动推导：`widthMm >= heightMm ? "landscape" : "portrait"`（`:295`，`l(385)="landscape"` / `l(659)="portrait"`，经 `/tmp/home-map.json` 的 `Jo` 表核实）。
   - 纸型预设表 `d`（`:25-50`）：`pin-210-140`(210×140 L)、`pin-200-140`(200×140 L)、`pin-210-90`(210×90 L)、`pin-200-90`(200×90 L)、`a4-landscape`(297×210 L)、`a4-portrait`(210×297 P)、`a5-landscape`(210×148 L)、`a5-portrait`(148×210 P)。全部 `orientation` 写死。
2. **landscape 的旋转方案**（`:425-437`）——这是原版最别扭的一块，务必照搬：
   - 物理 `@page` 用**交换后的尺寸**（如 a4-landscape → `210mm 297mm`，即竖着的一张纸）；
   - 需要一个 `.r2-page-wrap` 容器：`width:{heightMm}mm; height:{widthMm}mm; overflow:hidden; position:relative`；
   - `.receipt2-page` 在里面 `position:absolute; top:0; left:0; width:{widthMm}mm; height:{heightMm}mm; transform-origin: top left; transform: translateY({widthMm}mm) rotate(-90deg)`。
   - 几何验算：`rotate(-90deg)` 把 (x,y)→(y,−x)，再 `translateY(W)` 得 y∈[0,W]、x∈[0,H] → 正好填满 wrap。
   - ⚠ **`.r2-page-wrap` 只在 `printSilent` 里被创建**（`:1293-1302`，`orientation === "landscape"` 时给每个 `.receipt2-page` 套一层）——**浏览器打印路径（`ye` / `printFromContainer`）都不套 wrap**。因此浏览器的 landscape 打印会命中「`@page` 是竖版 + 页面是横版 + 没有旋转」的组合。见 §9 未确认。
3. **打印时是否用外部样式表**：**不用**。四个打印路径（iframe ×2、electron ×1、容器克隆 ×1）注入的都是 `ue()` 那一份自包含 `<style>`，外加 html/body 归零。**`print-lock.css` 与本单据无关**（那是 hiprint 模板链路的，`docs/2026-09-16-print-font.md:12`）。CONFIRMED。
4. **`@media print` 里到底有什么**（`:424-438`）：
   - `html, body { margin:0 !important; padding:0 !important; background:#fff }`
   - `* { -webkit-print-color-adjust: exact; print-color-adjust: exact }`
   - landscape 才有的 `.receipt2-root` / `.r2-page-wrap` / `.r2-page-wrap:last-child` / `.receipt2-page` 四条
   - `.receipt2-table { border-collapse: collapse !important }`
   - `.receipt2-table th, .receipt2-table td { border: 1px solid #000 !important }`
5. **份数 `copies` 不进 CSS**：`X()` 会归一化（`K(值,1,99,1)`，`:292`），但 `ue()` 完全不用它；它只在 `printSilent` 里作为 electron API 参数传出（`:1312`），以及设置弹窗的输入框（`:2380`）。CONFIRMED —— 即**份数由打印机驱动处理，不是复制页面 DOM**。
6. **`@media screen`** 只为预览服务：灰底 `#c0c0c0`、`padding:12mm`、页面间距 `gap:8mm`、页面投影、`[data-r2-el]` 的手型/虚线 hover 框。这些在打印输出里不生效。

---

## 9. 未确认 / 自相矛盾

1. **landscape 浏览器打印是否真的错位** —— 按 §8.2 的读法，`ye()` / `printFromContainer()` 生成的 DOM 里没有 `.r2-page-wrap`，于是 `@media print` 的旋转规则不触发，而 `@page` 又是竖版尺寸、`.receipt2-page` 是横版 `width:{widthMm}mm`（如 297mm 宽塞进 210mm 的纸）→ 应会横向溢出被裁。
   **INTERPRETED**（依据纯静态阅读）。可能原版实际就这么坏（用户只用 electron 静默打印），也可能我漏看了别处补 wrap 的代码。**建议实测一次 `a4-landscape` 的浏览器打印**再决定新版照抄还是修正。
2. **`.receipt2-meta-row` 的 `grid-template-columns: 1.2fr 1.5fr 1.7fr 0.8fr` 是否曾生效** —— 我读过全部渲染路径，只要该行被渲染就必带内联的 `1fr 1fr …` 覆盖。**INTERPRETED**：判定为死代码（除非有别的入口直接构造这段 HTML）。保真起见仍照抄。
3. **`.receipt2-qrcode` 的 18mm 是否本应可配** —— 源码里是两处字面量 `18`（`:382-384`），但字段配置里又有 `widthMm`（能给二维码单独改宽，却**改不动高**，会破坏 `object-fit` 比例）。**INTERPRETED**：原版的疏漏，照抄会导致二维码被拉变形。
4. **预览 `<style>` 的污染范围** —— `buildReceipt2Html` 返回的片段里 `<style>` 在 `.receipt2-root` 内部，宿主用 `innerHTML` 注入后该 `<style>` 会**全局生效**（含 `@page` 与 `@media print`），会影响整个 Home 页面的打印行为。**CONFIRMED 现象、未确认原版是否有意**。新版建议隔离（Shadow DOM / iframe / 加 scope 前缀），但注意别改变收据自身的观感。
5. **`data-r2-el` 弹出编辑器的锚点在 `display:none` 元素上的行为** —— 字段被设为不显示后，元素 `getBoundingClientRect()` 全为 0，`Ce()` 计算出的弹窗位置会是 `top=8/left=8`，且 `elementsFromPoint` 兜底也点不到。**INTERPRETED**：即「取消显示后就点不回来，只能靠设置弹窗或 localStorage 重置」。
6. **字号归一化的边界值** —— `Z()` 的 clamp 区间（CONFIRMED 读到的，供 r2-config 复核）：`headerFontSize 14–36`、`tableFontSize 8–18`、`amountFontSize 16–40`、`metaFontSize 8–18`、`declarationFontSize 8–18`、`orderDateFontSize 8–18`；默认 `{30, 15, 20, 18, 15, 13}`（`:13-20`）。字段级 `fontSize` 弹窗允许 `0–60`（`:2502-2503`），**不受上述 clamp 约束**——即存在两条互相矛盾的约束链，**未确认**哪个是设计意图。
