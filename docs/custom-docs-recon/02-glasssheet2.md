# 自定义玻璃合片单（`GlassSheet2PrintManager`）全量逆向

> 目标源码：`legacy/js/GlassSheet2.deobfuscated.js`（1860 行，字符串已还原）
> 原始压缩产物：`legacy/js/Home-d6b13b9a.js`，组件模块区间 **`269,047 – 290,137`**（字符偏移）
> 本文所有行号：`GS:NNN` = 反混淆文件行号；`@NNNNNN` = 原始 bundle 字符偏移。
> 对照模板：`docs/2026-09-17-receipt2-analysis.md` + `app/src/utils/receipt2/`。

---

## 0. 一页结论

| 问题 | 答案 |
|---|---|
| 依赖 hiprint 吗 | **不依赖**。自绘 HTML + 自带内联 CSS（与收据单同构） |
| 依赖第三方库吗 | **一个**：二维码用旧版内嵌的 **`@zxing/library` 系 QR 编码器**（从 vendor chunk `vue-ade658ba` 引入）在本机生成 SVG。见 §9 |
| 与收据单同构吗 | 骨架同构（构建 HTML → 交给 Home → 自己打印），**但分页/配置/配置界面三块都不一样** |
| 数据从哪来 | **不是 Home 的订单列表**，是 Home 调 **Hui 组件的 `calculateGlass()`**，把结果塞进 `getData` |
| 新版要不要重写数据层 | **不用** —— `app/src/utils/printPayloads.ts` 的 `glassProduces()`（`:748`）就是同一套行构造（引擎 A） |
| 最大未知量 | 布局编辑器的控件行为（本文已逐控件列出）+ 真实浏览器下的分页排版 |

**本单据在旧版不叫「玻璃合片单2」，是「自定义玻璃合片单」**（抽屉分组 `自定义单据：` 下，`dr[529]`）。
它和 hiprint 的 `ic=1`「玻璃合片单」是**两回事**：数据同源，版式不同。

---

## 1. ⚠️ 先补全 deobf 里剩下的自由标识符（读之前必看）

反混淆文件把字符串还原了，但**没解析模块外的标识符**。我把它们全部解出来了，
否则下面几节读不通。**这是本次逆向的前置成果。**

模块自己的字符串解码器在 raw 里叫 `bn`（表 `Ln`，shift 170，**运行时旋转 +37**）；
等价映射 `decode(x) = tableLiteral[(x - 133) mod 255]`。

| 标识符 | 真实值 | 证据 |
|---|---|---|
| `Bn` | 该模块的字符串解码器本身（`const l = Bn` 只是别名，**全部是死代码**） | `@268514` |
| `Mn` | `{ class: "gs2-layout-wrap" }` | `@260967` = `{class:Bn(222)}`，`Bn(222)="gs2-layout-wrap"` |
| `Nn` | `{ class: "gs2-layout-left" }` | `@260986` = `{class:Bn(311)}` |
| `En` | `["innerHTML"]`（动态 prop 名数组） | `@261005` = `[Bn(313)]` |
| `Dn` | **`"glass_sheet2_template_v1"`** —— 模板/打印设置的 localStorage 键 | `@268535` = `Dn=Bn(236)` |
| `An` | **`"glass_sheet2_printer_v1"`** —— 选中打印机的 localStorage 键 | 同上 = `An=Bn(267)` |
| `y` | QR 编码器类；`k = new y()`，`k.write(text, 180, 180, hintsMap)` → 返回 **SVG 元素** | `@271687` `k=new y` |
| `g` | 该库的 `EncodeHintType` 枚举；`g.MARGIN`（枚举值 6） | `@194630` `g.MARGIN`；vendor 里 `EncodeHintType2[EncodeHintType2.MARGIN=6]="MARGIN"` |

**CONFIRMED**：`Bn(223)` = `"GlassSheet2PrintManager"`（组件 `__name`），与盘点文档一致。

---

## 2. 数据模型

### 2.1 数据流（CONFIRMED，Home 侧）

```
Home「 自定义玻璃合片单 」按钮  →  wi()            @364118-364200
  └─ lc.value.calculateGlass()                    ← Hui 组件的方法
     └─ oi.value = 结果数组
        └─ li.value.buildGlassSheet2Html(ai())    ← ai() = Array.isArray(oi.value) ? oi.value : []
           └─ Wn.value = HTML                     ← 预览容器 innerHTML
```

- `lc` = Hui 组件 ref；`li` = 玻璃合片单组件 ref；`oi` = 玻璃行数组；`ai` = `getData` 的实现
- **入口条件**：Home 会先检查 `lc.value.calculateGlass` 是不是函数，不是就报 `calculateGlass 方法不存在`
  （`@364150`）。组件 ref 为 null 或没有 `buildGlassSheet2Html` → 报 `自定义玻璃合片单组件未就绪`（`dr[799]`）
- 数据来源是 **Hui 页当前的汇算表单**（`ping_hui` / `diao_hui` 两张表），**不是** Home 的订单列表

### 2.2 行对象的字段（CONFIRMED）

行由 Hui 的 `calculateGlass()` 产出，`legacy/js/Hui.formatted.js:10594-10989`。
两个分支产出同构对象（平开 `_0xcfde65` @10730，吊趟 `_0x4d28ce` @10897），形状：

| 键 | 中文来源 | 构造 | 平开/吊趟差异 |
|---|---|---|---|
| `client` | 客户 | `行["客户"] \|\| ""` | 同 |
| `door` | 型材+颜色 | `[行["型材"], 行["颜色"]].filter(Boolean).join("<br>")` | 同 |
| `OrderID` | 单号 | `行["单号"] \|\| ""`，**注意是 `OrderID` 大写 O** | 同 |
| `qrcode` | — | 同 `OrderID`（同一份单号，冗余字段） | 同 |
| `basicInfo` | 订单信息 | 尺寸行 `join("<br>")` + 后缀 | **不同**，见下 |
| `lockImg` | 方向 | `directionImageMap[...]` —— **开向示意图 URL** | **查表键不同**，见下 |
| `doorsheet` | 玻璃尺寸 | 玻璃件 `名:值` 拼 `<br>` + `数量:N` | 同结构，细节同引擎 |
| `doorImg` | 门图 | `await getImage(行["图片ID"])`（只在 `图片ID` 非空时取） | 同 |
| `remark` | 备注 | `[五金, 单双丁≠"正常", 备注, 安装地址].filter(Boolean).join("<br>")` + `加配：…` | 同 |
| `doorframe` / `casing` / `windows` | — | 初始化成 `""`，由 `_0xc8b731(row, formula)` 填 | 同 |

**⚠️ 中文键清单（行对象的来源字段，全部是中文键）**：
`客户`、`型材`、`颜色`、`单号`、`门洞宽`、`门洞高`、`墙厚`、`亮窗总高`、`亮窗数量`、`吊脚`、
`洞尺`、`面玻`、`底玻`、`玻璃厚`、`套线种类`、`开向`、`五金`、`单双丁`、`备注`、`安装地址`、
`加价项目`、`加价项目原始数据`、`图片ID`、`扇数`、`边封数`、`封板高`、`轨道长`、`轨道种类`、`数量`。
（`安装地址` 同样是**中文键**，和收据单那边踩的坑一样。）

**两处 `basicInfo` 差异（CONFIRMED）**：

- 平开（@10789）：
  `尺寸行.join("<br>") + "<br>" + (行["套线种类"] ? 行["套线种类"] + 行["开向"] : 行["开向"])`
  双无玻时玻璃串字面量是 **`"无"`**
- 吊趟（@10956）：
  `尺寸行.join("<br>") + (面玻==="无" && 底玻==="无" ? "" : "<br>" + 行["开向"] + "<br>" + 行["扇数"])`
  双无玻时玻璃串字面量是 **`"无玻璃"`**，且双无玻时**不追加**开向/扇数
- 尺寸行 = `[门洞高, 门洞宽, 墙厚].filter(v=>v&&v!==0).join("*")`
  → 有亮窗再加 `亮窗高：{n}`（平开钻石型 → `*{n}`；吊趟 → `总高{n}[*{m}格]`）
  → 平开另有 `吊脚：{n}`
  → 最后 `洞尺` 非空则 `unshift` 到最前

**两处 `lockImg` 差异（CONFIRMED）**：

- 平开 `@10743-10746`：`directionImageMap[getOriginalOpenDirection(行["开向"])] || ""`
  —— 先经 `openDirectionNaming` chunk 的 `getOriginalOpenDirection` 归一
- 吊趟 `@10948`：`directionImageMap["" + 行["扇数"] + 行["开向"]] || ""`
  —— **扇数与开向直接字符串拼接**，不归一

### 2.3 排序（CONFIRMED）

`calculateGlass()` 末尾 `@10969-10974`：
读 `localStorage["smartdoor_sort_method"]`；
`"order"` → 按 `OrderID` 首段数字（`split("-")[0]`）升序；否则 → 按每行构造时间戳升序。
**这与 Home 侧「选中订单」无关，是本单据实际的行序。**

### 2.4 版式里的列（CONFIRMED，GS:22-95）

**默认 8 列**，键与显示名**故意错位**（实现时别「修正」）：

| # | `key` | `label`（表头） | 默认宽 mm | 字号 pt | 行高 mm | 颜色 |
|---|---|---|---|---|---|---|
| 1 | `client` | 客户 | 30 | 13 | 7 | `#000000` |
| 2 | `door` | 门类 | 28 | 13 | 7 | `#000000` |
| 3 | `order` | 单号 | 24 | 12 | 7 | `#111111` |
| 4 | `basicInfo` | 订单信息 | 34 | 13 | 7 | `#111111` |
| 5 | `lockImg` | **方向** | 20 | **10** | **8** | `#111111` |
| 6 | `doorsheet` | **玻璃尺寸** | 36 | **14** | 8 | `#111111` |
| 7 | `doorImg` | 门图 | 28 | 12 | **6.2** | `#111111` |
| 8 | `remark` | 备注 | 30 | 12 | 7 | `#111111` |

默认可见列总宽 = **230mm**；默认纸宽 297mm，两边距 3mm → 可用 291mm。**列宽之和不必等于可用宽**
（`table-layout:fixed` + `width:{n}mm` 会让浏览器自行分配；见 §13 未确认 1）。

**单元格取值（`U(key, row, 0, opts)`，GS:206-307）**：

| key | 取值 | 渲染 |
|---|---|---|
| `client` | `row.client` | 多行文本 |
| `door` | `row.door` | 多行文本 |
| `order` | `row.OrderID ?? row.orderID ?? row.qrcode` | **二维码 SVG + 单号字幕** |
| `basicInfo` | `row.basicInfo` | 多行文本 |
| `lockImg` | `row.lockImg` | `<img>` |
| `doorsheet` | `row.doorsheet` | 多行文本 |
| `doorImg` | `row.doorImg` | `<img>` |
| `remark` | `row.remark` | 多行文本 |
| 其它 | — | `""` |

**多行文本（`A`，GS:188-202）**：按 `<br>` / `<br/>`（正则 `/<br\s*\/?>/i`）切分 → 每段 `trim()` →
`filter(Boolean)`（**空段丢弃**）→ 逐段 `<div class="gs2-line">{HTML 转义}</div>` 拼接。全空 → `""`。

转义（`D`，GS:182-187）：`&`→`&amp;`、`<`→`&lt;`、`>`→`&gt;`、`"`→`&quot;`、`'`→`&#39;`。

---

## 3. HTML 结构（逐字复刻级）

### 3.1 打印/导出用的完整文档（`J`，GS:673-681）

```
<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义玻璃合片单</title></head><body>{{rootHtml}}</body></html>
```
**逐字**，无换行、无缩进。`<title>` 就是「自定义玻璃合片单」6 字（`Bn(227)`）。

### 3.2 根容器（`j` 尾部，GS:626-666）

```
<div class="gs-root"><style>{{CSS}}</style>{{pages}}</div>
```
`{{CSS}}` = §4 的整段样式（**首字符是 `\n`**）；`{{pages}}` = 各页拼接，页与页之间无分隔符。

### 3.3 单页（GS:610-622）—— **换行与缩进都是字面量，必须照抄**

```
\n  <section class="gs-sheet" style="{{paperStyle}}">\n    {{pageNum}}\n    <div class="gs2-title">{{title}}</div>\n    <table class="gs2-table">\n      <thead><tr>{{theadCells}}</tr></thead>\n      <tbody>{{rows}}</tbody>\n    </table>\n  </section>
```

其中（按 JS 字符串拼接顺序，`+` 处即换行边界）：

| 占位 | 值 |
|---|---|
| `{{paperStyle}}` | `width:{{W}}mm;height:{{H}}mm;padding:{{P}}mm;position:relative;box-sizing:border-box;background:#fff;overflow:hidden` |
| `{{pageNum}}` | 多页时 `<div class="gs2-page-num">{{i+1}} / {{n}}</div>`，单页时 **`""`**（注意 `<section>` 后仍是 `\n    ` + `\n    <div class="gs2-title">`） |
| `{{title}}` | `table.title`，**经 HTML 转义**（`D()`） |
| `{{theadCells}}` | 见下 |
| `{{rows}}` | 见下 |

⚠️ 排版细节：
- `<section>` 前的 `\n  `（2 空格）、`> ` 后的 `\n    `（4 空格）、`</tr></thead>` 与 `<tbody>` 之间**没有空格**、
  `</tbody>` 与 `</table>` 之间是 `\n    `（4 空格）、`</table>` 与 `</section>` 之间是 `\n  `（2 空格）。
- `{{pageNum}}` 为空串时，会留下连续两个 `\n    `（`>\n    \n    <div class="gs2-title">`）。

### 3.4 表头单元格（GS:591-600）

```
<th style="width:{{widthMm}}mm">{{label}}</th>
```
逐列 `join("")`，**无换行**。
⚠️ **表头没有内联 `font-size`** —— 字号只由 CSS 的 `.gs2-table th { font-size:{{headerFontSize}}pt }` 提供。
（**这一点与布局编辑器的预览 `S()` 不同**，见 §7.3。）
⚠️ `{{label}}` **不转义**（直接拼 `e.label`）。

### 3.5 明细行（`G`，GS:538-570）

```
\n  <tr>{{cells}}</tr>
```
⚠️ **`<tr>` 前有一个换行 + 2 空格**，`</tr>` 前无换行；行与行直接首尾相接。

每个单元格：
```
<td style="width:{{widthMm}}mm;font-size:{{fontSize}}pt;color:{{fontColor}};line-height:{{rowHeightMm}}mm;">{{cell}}</td>
```
（**结尾分号后紧接 `">`，不换行**）

### 3.6 单元格内容三种形态

**(a) 多行文本**（`client`/`door`/`basicInfo`/`doorsheet`/`remark`）：
```
<div class="gs2-line">{{escapedLine}}</div><div class="gs2-line">{{escapedLine}}</div>…
```

**(b) 图片**（`doorImg`/`lockImg`，`imgStyle` 默认为字面量）：
```
<img style="width:100%;display:block;margin:0 auto;object-fit:contain;" src="{{url}}" />
```
⚠️ 结尾是 **` />`**（带空格）。`url` **不转义**。url 为空串（`trim()` 后）→ 整个单元格 `""`。

**(c) 二维码 + 单号**（`order`，GS:224-291）：
```
<svg style="width:17mm;height:17mm;display:block;margin:0 auto 0.5mm;" viewBox="{{viewBox}}" preserveAspectRatio="xMidYMid meet">{{svgInner}}</svg><div style="text-align:center;line-height:1.4;">{{caption}}</div>
```
- `{{viewBox}}` 取库生成 SVG 的 `viewBox`，**回退 `"0 0 180 180"`**；`{{svgInner}}` 是它的 `innerHTML`
- 二维码尺寸 **17mm**（`qrSize`），`<svg>` 之后 `margin:0 auto 0.5mm`
- 取不到二维码（库抛错）→ 只有字幕 div
- `{{caption}}`：把单号文本按 `/` 切分（`B`，GS:272-282）
  - ≥3 段：`esc(第1段/第2段) + "<br>" + esc(其余段用 / 连接)`
  - 2 段：`esc(第1段) + "<br>" + esc(第2段)`
  - 其它：`esc(全串)`
  - **每段经 `D()` 转义**（与 `A()` 不同：这里的 `<br>` 是**字面 `<br>`**，不是 `gs2-line` div）
- 单号为空 → 整个单元格 `""`

### 3.7 还原后的完整样子（默认配置，2 页，示意）

```html
<div class="gs-root"><style>
.gs-root { background:#fff; color:#111; width:297mm; }
…（§4 全文）…
</style>
  <section class="gs-sheet" style="width:297mm;height:210mm;padding:3mm;position:relative;box-sizing:border-box;background:#fff;overflow:hidden">
    <div class="gs2-page-num">1 / 2</div>
    <div class="gs2-title">玻璃合片单</div>
    <table class="gs2-table">
      <thead><tr><th style="width:30mm">客户</th><th style="width:28mm">门类</th><th style="width:24mm">单号</th><th style="width:34mm">订单信息</th><th style="width:20mm">方向</th><th style="width:36mm">玻璃尺寸</th><th style="width:28mm">门图</th><th style="width:30mm">备注</th></tr></thead>
      <tbody>
  <tr><td style="width:30mm;font-size:13pt;color:#000000;line-height:7mm;"><div class="gs2-line">张三</div></td>…</tr>
  <tr>…</tr>
      </tbody>
    </table>
  </section>
  <section class="gs-sheet" style="…">
    <div class="gs2-page-num">2 / 2</div>
    …
  </section>
</div>
```

---

## 4. CSS —— 完整原文（逐字，可直接落盘）

由 CSS 发生器 `(() => {…})()` 产出（GS:627-662）。下面是**默认配置**
（`paper{widthMm:297,heightMm:210,paddingMm:3}`、`borderColor:"#444444"`、`headerFontSize:13.5`）
代入后的**实产文本**（1739 字符）：

```css

.gs-root { background:#fff; color:#111; width:297mm; }
.gs2-title { text-align:center; font-size:7mm; line-height:8mm; font-weight:500; margin-bottom:0.5mm; }
.gs2-page-num { position:absolute; top:3mm; right:3mm; font-size:9pt; color:#666; }
.gs2-table { width:100%; border-collapse:collapse; table-layout:fixed; }
.gs2-table th, .gs2-table td { border:0.2mm solid #444444; vertical-align:top; padding:1mm 1.2mm; word-break:break-all; }
.gs2-table th { text-align:center; font-weight:600; background:#fff; font-size:13.5pt; }
.gs2-line { line-height:inherit; }
.gs2-qr { width:17mm; height:17mm; display:block; margin:0 auto 0.8mm; }
.gs2-order { text-align:center; line-height:1.4; }
.gs2-lock-img, .gs2-door-img { width:100%; height:100%; display:block; margin:0 auto; object-fit:contain; }
@page { size: 297mm 210mm; margin: 0; }
@media screen {
  .gs-root { background:#c0c0c0; padding:8mm; display:flex; flex-wrap:wrap; gap:8mm; align-items:flex-start; justify-content:flex-start; min-width:fit-content; width:auto; }
  .gs-sheet { box-shadow:0 2px 10px rgba(0,0,0,0.25); height:210mm; overflow:hidden; }
}
@media print {
  html, body { width:297mm !important; height:210mm !important; margin:0 !important; padding:0 !important; background:#fff; overflow:visible !important; }
  .gs-root { width:297mm !important; background:#fff !important; padding:0 !important; gap:0 !important; display:block !important; }
  .gs-sheet { width:297mm !important; height:210mm !important; box-shadow:none !important; margin:0 !important; break-after:page; page-break-after:always; page-break-inside:avoid; }
  .gs-sheet:last-child { break-after:auto; page-break-after:auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

**发生器源码骨架（GS:626-666）** —— 变量替换点：
`a = paper.widthMm`、`n = paper.heightMm`、`t.paddingMm`、`o.borderColor`、`o.headerFontSize`。
**首字符是 `\n`，末字符是 `\n`（`@media print` 块闭合后），中间全部是上面这些字面量。**

### 4.1 类名全表

| 类名 | 出现在 | 是否生效 |
|---|---|---|
| `.gs-root` | 《CSS》《打印 HTML 根》 | ✅ |
| `.gs-sheet` | 《CSS》《打印 HTML 页》 | ✅ |
| `.gs2-title` | 《CSS》《打印 HTML 标题》 | ✅ |
| `.gs2-page-num` | 《CSS》《打印 HTML 页码》 | ✅（多页时） |
| `.gs2-table` | 《CSS》《打印 HTML 表格》 | ✅ |
| `.gs2-line` | 《CSS》《`A()` 产出的每行 div》 | ✅ |
| `.gs2-qr` | 只在《CSS》里 | ❌ **死选择器**，markup 从不用（二维码走内联样式） |
| `.gs2-order` | 只在《CSS》里 | ❌ **死选择器**（单号字幕走内联样式） |
| `.gs2-lock-img` / `.gs2-door-img` | 只在《CSS》里 | ❌ **死选择器**（图片走内联样式） |
| `.gs2-prev-table` | 布局编辑器预览（`S()` 内联 `<style>` + `W()` 的包装 div） | 仅编辑器 |
| `.gs2-layout-*`（8 个） | 布局编辑器 DOM，在 **`legacy/css/Home-97d96482.css`**（scoped `[data-v-c251bbdd]`） | 仅编辑器 |

### 4.2 布局编辑器专属 CSS —— 完整原文

**不在**组件产出的 HTML 里，而在 scoped 样式表 `legacy/css/Home-97d96482.css`
（`data-v-c251bbdd` 全库只被这一组规则使用 ⇒ 确认属于本组件）：

```css
.gs2-layout-wrap[data-v-c251bbdd]{display:flex;gap:12px;height:calc(100vh - 160px);overflow:hidden}
.gs2-layout-left[data-v-c251bbdd]{width:460px;min-width:460px;border-right:1px solid #eee;padding-right:10px;overflow-y:auto}
.gs2-layout-right[data-v-c251bbdd]{flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center}
.gs2-layout-section-title[data-v-c251bbdd]{font-size:13px;color:#333;font-weight:600;margin:8px 0 4px;padding-bottom:2px;border-bottom:1px dashed #ddd}
.gs2-layout-canvas-shell[data-v-c251bbdd]{background:#e5e7eb;padding:16px;display:inline-flex;flex-direction:column;justify-content:center;align-items:center;gap:14px}
.gs2-layout-page-wrap[data-v-c251bbdd]{display:flex;flex-direction:column;align-items:stretch}
.gs2-layout-page-label[data-v-c251bbdd]{color:#666;font-size:12px;line-height:18px;text-align:right}
.gs2-layout-canvas[data-v-c251bbdd]{position:relative;background:#fff;box-sizing:border-box;box-shadow:0 2px 10px #0003;overflow:hidden}
```

> 与收据单对比：**收据单的 CSS 100% 由 JS 产出**，没有外部样式表；玻璃合片单**多出这 8 条 scoped 规则**
> （编辑器外壳）。新版直接放进组件的 `<style scoped>` 即可。

---

## 5. 分页

**有分页，但算法与收据单不是同一份。**

### 5.1 量测（`O`，GS:419-518）—— 隐藏 iframe 实测，思路与收据单类似

1. 取可见列 `t.table.columns.filter(c => c.visible)`
2. 建 `Map(key → col)`，构建表头（`width` + **内联 `font-size`**，与打印版不同）
3. 构建明细行，**每行带 `data-ridx="{index}"`**
4. 拼 `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">\n    <thead><tr>{th}</tr></thead><tbody>{rows}</tbody></table>`
   （注意这里是 `<tbody>` **紧接** `</thead>`，与打印版的 `\n      <tbody>` 不同）
5. 内联样式块（**裸 `th,td` 选择器，不是类选择器**）：
   `\n    th,td{border:0.2mm solid #444;vertical-align:top;padding:1mm 1.2mm;word-break:break-all;}\n    th{text-align:center;font-weight:600;}\n    .gs2-line{line-height:inherit;}\n    body{margin:0;padding:0;}\n  `
   ⚠️ 边框色**硬编码 `#444`**，忽略配置的 `borderColor`
6. 建隐藏 iframe（`position:fixed;top:-9999px;left:-9999px;width:0;height:0;…`），
   `document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><style>{上条}</style></head><body><div style="width:{W-2P}mm;">{table}</div></body></html>')`
7. **等图片**：`querySelectorAll("img")`，`complete` 直接计数，否则挂 `onload`/`onerror`；
   **另有 `setTimeout(resolve, 2000)` 兜底**（`@275499` 的 `2e3`）
8. 量：`y = doc.querySelectorAll("tr[data-ridx]")`；
   `v = (W - 2P) / (doc.querySelector("div").offsetWidth || 1)`（px→mm 比例）；
   `f = y.map(tr => tr.offsetHeight * v)`
9. **单元格里的二维码用 17mm**（与最终打印一致）

### 5.2 打包（`H`，GS:519-537）

```js
if (!Array.isArray(rows) || rows.length === 0) return [[]]     // 空数据 → 一个空页
const cfg  = cfgArg || i.value                                  // 活动配置
const P    = cfg.paper
const budget = P.heightMm - 2 * P.paddingMm - 8 - 10            // ← 固定预算，每页相同
const heights = await O(rows, cfg)
const pages = []; let cur = []; let used = 0
for (let i = 0; i < rows.length; i++) {
  const h = heights[i] ?? 20                                    // 量不到就按 20mm 估
  if (used + h > budget && cur.length > 0) { pages.push(cur); cur = []; used = 0 }
  cur.push(rows[i]); used += h
}
if (cur.length > 0) pages.push(cur)
return pages
```

**与收据单的关键差异**：

| | 收据单（`we`） | 玻璃合片单（`O`+`H`） |
|---|---|---|
| 「固定开销」 | 量出来的（含页头/表头实测高） | **硬编码 `8 + 10`**（常数，不量） |
| 最后一页 | 与中间页**预算不同**（页脚只最后一页有） | **与中间页预算完全相同**（本单无页脚） |
| 补丁 `l<=y → l=y+1` | 有 | **无**（不需要，「每页至少一行」由 `cur.length>0` 保证） |
| 补丁「给末页留一行」 | 有（不可删） | **无** |
| 量测入参 | 隐藏 DOM | 隐藏 iframe（`document.write`） |
| 图片等待 | 有 | 有，**且带 2s 超时** |
| 图片等待（打印路径） | 有 | 有，**但无超时**（见 §10） |
| 单行超页 | 静默裁掉 | **同样静默裁掉**（`budget` 固定，不切分不降字号） |

**`8` 与 `10` 的语义（INTERPRETED）**：`8` 对应 `.gs2-title` 的 `line-height:8mm`；
`10` 是额外留白（标题还带 `margin-bottom:0.5mm`，且避免贴边）。
证据：CSS 里标题行高正好 8mm，且预算里没有任何其它固定高度项。**照抄这两个常数，别"改进"。**

**`20` 的来源（CONFIRMED）**：`heights[i] ?? 20` —— 量测缺失时的兜底行高（mm）。

⚠️ **`paddingMm` 为 `NaN` 时预算变 `NaN`**，`used + h > NaN` **恒为 false** ⇒ **退化成单页**。
而 `NaN` 是能真实出现的（见 §6.4 的读取缺陷）。**新版已修**（§6.4 决策：`??` 改 `||` 语义）。

### 5.3 单页判定（CONFIRMED）

- 有数据但只有 1 页 → 无页码（`u.length > 1` 才渲染 `gs2-page-num`）
- 空数据（`rows.length === 0`）→ `[[]]` → **渲染 1 个空页**（表头在，`<tbody>` 空）
  —— 与收据单「一行 `colspan=10` 的『暂无明细』」**不同**
- 布局编辑器里空数据是另一条路：`W()` 直接显示 `暂无预览数据` 占位（见 §7.3）

---

## 6. 配置模型

### 6.1 默认配置对象（`a()`，GS:11-98）—— **完整、逐字段**

```js
{
  paper: { widthMm: 297, heightMm: 210, paddingMm: 3, orientation: "landscape" },
  table: {
    title: "玻璃合片单",
    borderColor: "#444444",
    headerFontSize: 13.5,
    columns: [
      { key:"client",    label:"客户",     widthMm:30, fontSize:13, rowHeightMm:7,   fontColor:"#000000", visible:true },
      { key:"door",      label:"门类",     widthMm:28, fontSize:13, rowHeightMm:7,   fontColor:"#000000", visible:true },
      { key:"order",     label:"单号",     widthMm:24, fontSize:12, rowHeightMm:7,   fontColor:"#111111", visible:true },
      { key:"basicInfo", label:"订单信息", widthMm:34, fontSize:13, rowHeightMm:7,   fontColor:"#111111", visible:true },
      { key:"lockImg",   label:"方向",     widthMm:20, fontSize:10, rowHeightMm:8,   fontColor:"#111111", visible:true },
      { key:"doorsheet", label:"玻璃尺寸", widthMm:36, fontSize:14, rowHeightMm:8,   fontColor:"#111111", visible:true },
      { key:"doorImg",   label:"门图",     widthMm:28, fontSize:12, rowHeightMm:6.2, fontColor:"#111111", visible:true },
      { key:"remark",    label:"备注",     widthMm:30, fontSize:12, rowHeightMm:7,   fontColor:"#111111", visible:true },
    ],
  },
  print: { copies: 1 },
}
```

⚠️ **`orientation` 在本组件里没有任何消费者**：
它不被 CSS 发生器读（横向/纵向完全靠宽高数值）、不被分页读、不被量测读。
只有「打印设置」弹窗的一个下拉框在读写它。**这是从合格标签那套复制过来的残留字段。**（CONFIRMED：全组件 grep）

### 6.2 三个 ref 与「草稿 vs 生效」

| ref | 角色 | 写入时机 |
|---|---|---|
| `i`（GS:102） | **生效配置** | 保存时从草稿深拷贝 |
| `c`（GS:103） | 打印设置弹窗**草稿** | 打开弹窗时 `= JSON.parse(JSON.stringify(i))` |
| `s`（GS:104） | 布局编辑器**草稿** | 打开编辑器时同上 |
| `d`（GS:105） | 布局编辑器的**行数据**快照 | `openLayoutEditor` 时取 `props.getData()` |
| `p`（GS:112） | **生效**配置的可见列（computed） | — |

- `重置默认`（设置弹窗 `B` / 布局编辑器 `M`）**只重置各自的草稿**，不写盘、不关窗（与收据单一致 ✅）
- `保存并应用`（`N`，GS:146-153）：`i = clone(c)` → 写盘 → 关窗 → 若 `isActive()` 则 `await refreshPreview()`
- `保存布局`（`E`，GS:154-161）：`i = clone(s)` → 写盘 → 关窗 → 若 `isActive()` 则 `await refreshPreview()`
- **两个弹窗共用同一个 localStorage 键**（`glass_sheet2_template_v1`），即「布局设置」与「打印设置」写的是**同一份配置**

### 6.3 localStorage（2 个键）

| 键 | 内容 | 写入时机 |
|---|---|---|
| **`glass_sheet2_template_v1`** | 整份 `{paper,table,print}` JSON | 两个弹窗的「保存」按钮；`C()` GS:115-120 |
| **`glass_sheet2_printer_v1`** | 裸字符串（打印机名，Electron 专属） | 打印机下拉 `change` 时；`z()` GS:121-126 |

**没有** `receipt2_*` 那一整套 7 键；**没有** `element_configs`（元素微调）、**没有** `column_widths`（列宽拖拽）。

### 6.4 读盘清洗（`onMounted`，GS:686-768）—— 逐字段

```
无该键 → 直接用默认（提前 return）
```

| 字段 | 规则 | 备注 |
|---|---|---|
| `paper.widthMm` | `Number(v) \|\| 297` | 0/NaN/undefined → 297 |
| `paper.heightMm` | `Number(v) \|\| 210` | 同上 |
| `paper.paddingMm` | ⚠️ **`null != Number(v) ? Number(v) : 3`** | **`?? ` 语义，不是 `\|\|`** |
| `paper.orientation` | `=== "portrait" ? "portrait" : "landscape"` | 只认这一个合法值 |
| `table.title` | `v \|\| "玻璃合片单"` | |
| `table.borderColor` | `v \|\| "#444444"` | |
| `table.headerFontSize` | `Number(v) \|\| 13.5` | |
| `table.columns` | `Array.isArray(v) && v.length>0` → `v.map((e,t) => ({...默认columns[t], ...e}))`；否则默认 | 按下标合并，**缺字段补默认、多出的列原样保留** |
| `print.copies` | `Math.max(1, Math.min(99, Number(v) \|\| 1))` | clamp 到 1–99 |

**⚠️ 两个实打实的缺陷（CONFIRMED，与收据单的 `K(null)` 同性质）**：

1. **`paddingMm` 用 `??` 而不是 `||`** ⇒ 存盘对象里**缺 `paddingMm` 字段**时
   `Number(undefined) === NaN`，而 `NaN != null` 为 **true** ⇒ **生效值变成 `NaN`**。
   后果：内联样式 `padding:NaNmm`（浏览器丢弃 → 视觉上 0 边距）+ **分页退化成单页**（见 §5.2）。
   触发条件：任何手工/早期版本写下的、不含 `paddingMm` 的 JSON。
2. `Number(null) === 0`，且 `0 != null` 为 true ⇒ 存盘里 `paddingMm: null` 会变成 **`0`**（不是默认的 3）。
   这一条还算合理（0 是合法值，min 就是 0），但要知道它**不会回落到 3**。

读盘整体包在 `try/catch` 里，抛错 → `i.value = a()`。

> ### ✅ 决策（用户 2026-09-17 拍板）：缺陷 1 **修**
>
> 新版把 `paddingMm` 的清洗改成 **`||` 语义**（`undefined`/`NaN`/`null` → 回落默认 **3**），
> 与同段的 `widthMm`/`heightMm`/`headerFontSize` 写法一致。
>
> **理由**：`NaN` 从来不是有意值；且新版是全新 app、localStorage 不会带着旧版数据过来，
> 这条路径**实际不可达**，修它零风险。
>
> **要求**：代码里写明这是**有意的偏离**（旧版是 `??`，会给 `NaN`），并注明后果
> —— `NaN` 会让分页预算 `heightMm - 2*NaN - 18` 变 `NaN`，从而 `used + h > NaN` 恒假、
> **整份单据退化成单页**（见 §5.2）。
>
> 缺陷 2（`null` → `0`）**照抄**，不改：`0` 是合法值（输入框 min 就是 0）。

---

## 7. 布局编辑器（`openLayoutEditor`）—— **与收据单最大的不同**

### 7.1 打开流程（GS:788-798）

```js
openLayoutEditor = async () => {
  s.value = JSON.parse(JSON.stringify(i.value))       // 草稿 ← 生效
  const rows = (props.getData?.() ) || []
  d.value = rows.length > 0 ? rows : []
  u.value = true                                       // 弹窗可见
  await nextTick()
  L()                                                  // 量右侧容器
  W()                                                  // 渲染布局预览
}
```
- **不关打印设置弹窗**（两者可同时存在；`openSettingsDialog` 也不关它）
- `d.value` 用 `rows.length > 0 ? rows : []` —— 等价于 `rows`，`length>0` 判断是无意义的（可能是笔误）
- ⚠️ **每次都重新取 `props.getData()`**，与 Home 的 `oi` 是同一份引用（不是快照拷贝）

### 7.2 弹窗骨架（GS:1371-1852）

```
<el-dialog v-model="layoutVisible" title="自定义玻璃合片单 - 布局编辑" fullscreen :destroy-on-close="false">
  #footer: [取消]  [重置默认]  [保存布局(primary)]
  #default:
    <div class="gs2-layout-wrap">
      <div class="gs2-layout-left">   …控件…   </div>
      <div class="gs2-layout-right" ref="layoutEditorRightRef">
        <div class="gs2-layout-canvas-shell" v-html="layoutPreviewHtml"></div>
      </div>
    </div>
</el-dialog>
```
- `fullscreen`（不是 `width`）—— **收据单的设置弹窗是固定宽 820px，这里是全屏**
- `:destroy-on-close="false"`
- 右侧预览用 **`v-html`**（`T.value`），**不是**组件树

### 7.3 左侧控件全清单（GS:1419-1824）

**区块一：`纸张`**（`.gs2-layout-section-title` 文字 = `"纸张"`，`el-form label-width="80px" size="small"`）

| 控件 | 标签 | 绑定 | min | max | step |
|---|---|---|---|---|---|
| `el-input-number` | `宽(mm)` | `s.paper.widthMm` | 100 | 420 | 1 |
| `el-input-number` | `高(mm)` | `s.paper.heightMm` | 100 | 297 | 1 |
| `el-input-number` | `边距(mm)` | `s.paper.paddingMm` | 0 | 20 | 0.5 |

**没有方向下拉、没有常用尺寸按钮**（这两样只在打印设置弹窗里）。

**区块二：`表格全局`**

| 控件 | 标签 | 绑定 | min | max | step |
|---|---|---|---|---|---|
| `el-input`（`style width:160px`） | `标题` | `s.table.title` | — | — | — |
| `el-input-number` | `表头字号` | `s.table.headerFontSize` | 7 | 28 | 0.5 |
| `el-color-picker`（`size:"small"`） | `边框颜色` | `s.table.borderColor` | — | — | — |

**区块三：`各列设置`** —— 一个 `el-table :data="s.table.columns" size="small" border style="width:100%" :max-height="400"`

| 列 | 宽 | 控件 | 范围 |
|---|---|---|---|
| `显` | 38 | `el-checkbox` ↔ `row.visible` | — |
| `列名` | 72 | `el-table-column prop="label"`（**只读**） | — |
| `宽mm` | 72 | `el-input-number` ↔ `row.widthMm`，`controls-position:"right"` | 10–120 / step 1 |
| `字号pt` | 72 | `el-input-number` ↔ `row.fontSize` | 7–28 / step 0.5 |
| `行高mm` | 72 | `el-input-number` ↔ `row.rowHeightMm` | 3–20 / step 0.5 |
| `颜色` | 52 | `el-color-picker` ↔ `row.fontColor` | — |
| `排序` | 70 | 两个 `el-button`：`↑` / `↓` | 见下 |

**排序按钮（GS:1748-1817）**：直接**交换数组相邻两项**（就地改 `s.table.columns`）：
- `↑`：`idx<=0` 时 disabled；否则 `swap(cols[idx], cols[idx-1])`
- `↓`：`idx === cols.length-1` 时 disabled；否则 `swap(cols[idx], cols[idx+1])`
- **没有拖拽排序**（收据单的 `metaOrder` 是拖拽；这里是上下按钮）

**⚠️ 布局编辑器不能改的**：`orientation`、`print.copies`、打印机、列的新增/删除、
`column.key`（不可改）、浏览器 resize 监听（`L()` 只在打开时调一次）。

### 7.4 右侧预览（`W`，GS:363-411）

```js
W = async () => {
  const token = ++Y                       // 竞态令牌（若已有更新的调用，丢弃本次结果）
  const cfg   = JSON.parse(JSON.stringify(s.value))
  const scale = b.value                   // fit 比例 = min(容器w/纸宽, 容器h/纸高)
  const rows  = d.value
  if (rows.length === 0) { T.value = '<div style="display:flex;…">暂无预览数据</div>'; return }
  const pages = await H(rows, cfg)        // ← 分页用**草稿**配置
  if (token !== Y) return                 // 过期
  const shrunk  = scale / 3.78            // 3.78 px/mm
  const totalMm = cfg.table.columns.filter(c=>c.visible).reduce((a,c)=>a+c.widthMm, 0)
  const cw = Math.max(120, cfg.paper.widthMm  * scale)
  const ch = Math.max(120, cfg.paper.heightMm * scale)
  const pd = cfg.paper.paddingMm * scale
  T.value = pages.map((page, i) => (
    '<div class="gs2-layout-page-wrap">' +
      (pages.length > 1 ? '<div class="gs2-layout-page-label">第 ' + (i+1) + ' / ' + pages.length + ' 页</div>' : '') +
      '<div class="gs2-layout-canvas" style="width:' + cw + 'px;height:' + ch + 'px;padding:' + pd + 'px;">' +
        '<div class="gs2-prev-table" style="transform-origin:top left;transform:scale(' + shrunk + ');width:' + (3.78*totalMm) + 'px;">' +
          S(page, cfg) +
        '</div>' +
      '</div>' +
    '</div>'
  )).join("")
}
```
- `b`（GS:172-181）= `Math.min(容器w / max(1,纸w), 容器h / max(1,纸h))` —— **INTERPRETED**：数值是「容器 px / 纸 mm」，即「1mm 对应多少 px」的比例
- `L`（GS:162-171）：`layoutEditorRightRef.clientWidth - 32` / `clientHeight - 32`（减 32 = shell 的 `padding:16px` ×2）；
  ref 为 null 时回退 `{w: max(600, innerWidth-500), h: max(400, innerHeight-200)}`
- `Vue.watch([s, d, b], …, {deep:true})`：`u.value`（弹窗可见）为真时才重渲染

**`S(page, cfg)`（GS:308-360）—— 编辑器预览的行/表构造，与打印版 `G`/`j` 有 4 处不同**：

| | 编辑器预览 `S` | 打印 `G`/`j` |
|---|---|---|
| 二维码尺寸 | **`15mm`** → 新版改成 `17mm`（见下方决策） | **`17mm`** |
| `<th>` 内联 `font-size` | **有**（`font-size:{headerFontSize}pt`） | **无**（靠 CSS 规则） |
| `<tr>` | **无** `data-ridx`、无前导 `\n  ` | 无 `data-ridx`、**有前导 `\n  `** |
| 表格/标题外层 | 附一段 `<style>`（`.gs2-prev-table th,td { border… }` + `th{text-align:center;font-weight:600}`），**无 `class` 的散装 `<table>`** | 用 `.gs2-table` 类 + 全局 CSS |
| 可见列为 0 时 | 早退 → `<div style="text-align:center;color:#999;padding:20px;">无可见列</div>` | 没有这个分支（表头为空、行只有空 td） |

`S` 的逐字模板：
```
<div style="text-align:center;font-size:7mm;line-height:8mm;font-weight:500;margin-bottom:0.5mm;">{{esc(title)}}</div>\n    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">\n      <thead><tr>{{th}}</tr></thead>\n      <tbody>{{rows}}</tbody>\n    </table>\n    <style>\n      .gs2-prev-table th, .gs2-prev-table td { border:0.2mm solid {{borderColor}}; vertical-align:top; padding:1mm 1.2mm; word-break:break-all; }\n      .gs2-prev-table th { text-align:center; font-weight:600; }\n    </style>
```
（`th` = `<th style="width:{{w}}mm;font-size:{{hf}}pt;">{{label}}</th>`；`rows` = `{{每行}}` 无分隔，
每行 `<tr>{{tds}}</tr>`，`td` 同 §3.5 但二维码 `qrSize:"15mm"`）

> ⚠️ 量测函数 `O` 与打印 `G` 都用 **17mm**；只有编辑器预览 `S` 用 **15mm**。
> ⇒ 编辑器里看到的换行位置与真实打印**会有细微出入**（二维码列更矮）。
>
> ### ✅ 决策（用户 2026-09-17 拍板）：新版**三处统一成 `17mm`**
>
> 编辑器预览 `S` 也改成 `17mm`。**理由**：编辑器预览的意义就是所见即所得，
> 留着 15 会让预览和实打对不上。
>
> **要求**：代码里注明这是**有意的偏离**（旧版预览 15 / 量测与打印 17）。

---

## 8. 打印设置弹窗（`openSettingsDialog`）

打开流程（GS:781-787）：草稿 ← 生效 → `settingsTab = "paper"` → 弹窗可见 → （Electron 且打印机列表为空时）拉打印机列表。

```
<el-dialog v-model="settingsVisible" title="自定义玻璃合片单 - 打印设置" width="820px" :destroy-on-close="false">
  #footer: [重置默认]  [取消]  [保存并应用(primary)]
  #default:
    <el-tabs v-model="settingsTab">
      <el-tab-pane label="纸张" name="paper">   …   </el-tab-pane>
      <el-tab-pane label="打印机" name="printer"> …   </el-tab-pane>
    </el-tabs>
</el-dialog>
```

**`纸张` 页**（`el-form label-width="120px" size="small"`）：

| 控件 | 标签 | 绑定 | 范围 |
|---|---|---|---|
| `el-input-number` | `纸张宽(mm)` | `c.paper.widthMm` | 100–420 / step 1 |
| `el-input-number` | `纸张高(mm)` | `c.paper.heightMm` | 100–297 / step 1 |
| `el-input-number` | `内边距(mm)` | `c.paper.paddingMm` | 0–20 / step 0.5 |
| `el-select`（`style width:200px`） | `方向` | `c.paper.orientation` | 选项：`横向`=landscape、`纵向`=portrait |
| 3 × `el-button size="small"` | `常用尺寸` | 直接写死数值 | **A4**→297×210；**A5**→210×148；**B5**→257×182 |

⚠️ **只有 3 个常用尺寸预设**（收据单是 8 个）；且**不联动 orientation**（只改宽高）。

**`打印机` 页**（`el-form label-width="110px" size="small"`）：

| 控件 | 条件 | 内容 |
|---|---|---|
| `el-form-item label=""` → `el-alert` | **非 Electron 才显示** | `type:"warning" :closable="false" title="仅Electron客户端支持静默打印，当前为浏览器模式"` |
| `el-select`（`label="选择打印机"`，`style width:100%`，`:placeholder="使用系统默认打印机"`，`clearable`，`@change=保存键`） | 恒显示 | 选项来自 `printers`，`:label="p.isDefault ? p.displayName+'（默认）' : p.displayName"`，`:value="p.name"` |
| `el-button size="small" :loading="loadingPrinters" @click="loadPrinters"` | 恒显示（无 label 的 form-item） | `刷新打印机列表` |
| `el-input-number` | `label="打印份数"` | `c.print.copies`，1–99 / step 1 |

**`x()` 拉打印机列表**（GS:127-139）：非 Electron **静默 return**；失败 `ElMessage.error("获取打印机列表失败")`。

> **与收据单对比**：收据单的「字体调节」弹窗有 6 类字号 + 品牌 + 8 个纸型 + 头部元素 3 行 + 信息栏拖动排序 + 底部元素。
> 玻璃合片单的弹窗**只有上面这些**，**没有任何字号输入、没有品牌、没有显隐开关、没有排序、没有元素几何**。
> 字号全在「布局设置」里按列改。

---

## 9. 门图 / 图片 / 二维码

### 9.1 两个图片字段怎么进 HTML

| 列 `key` | 表头 | 行字段 | 来源 | HTML |
|---|---|---|---|---|
| `doorImg` | 门图 | `row.doorImg` | Hui：`await getImage(行["图片ID"])`（**只有 `图片ID` 非空才取**，取不到就留空） | `<img style="width:100%;display:block;margin:0 auto;object-fit:contain;" src="{{url}}" />` |
| `lockImg` | 方向 | `row.lockImg` | Hui：`directionImageMap[开向]`（平开）/ `[扇数+开向]`（吊趟）—— **开向示意图**，不是锁具图 | 同上（**同一个 `imgStyle` 默认值**） |

- **不是挖孔图**。挖孔图（`挖孔图.formulaID + "左"/"右"`）走的是**另一族**模板（`glassHole` / 生产单），
  与玻璃合片单无关。
- `imgStyle` 与 `qrSize` 都由 `U` 的第 4 参传入；**在打印链路和量测链路里都显式传**：
  `{ qrSize: "17mm", imgStyle: "width:100%;display:block;margin:0 auto;object-fit:contain;" }`（GS:457-461、559-563）
- 编辑器预览 `S` 只传 `{ qrSize: "15mm" }`，`imgStyle` 落到默认值 —— **与显式值逐字相同**，无差异

### 9.2 二维码

```js
k = new QRCodeClass()                    // @zxing/library 系的编码器（vendor chunk 内嵌）
hints = new Map([[EncodeHintType.MARGIN, 1]])
svg = k.write(text, 180, 180, hints)     // → SVG 元素
cache.set(text + "::m1", { viewBox: svg.getAttribute("viewBox") || "0 0 180 180", inner: svg.innerHTML })
```
- **纯前端生成，不走图片、不走网络**（`getImage` 与二维码无关）
- 生成结果按 `text + "::m1"` 在组件内 `Map` 缓存（GS:204、251-256）
- 尺寸参数固定 **180×180**，`MARGIN=1`（静默区 1 模块）
- 输出 `<svg style="width:17mm;height:17mm;display:block;margin:0 auto 0.5mm;" viewBox="…" preserveAspectRatio="xMidYMid meet">…</svg>`
- 库抛错 → 返回 `null` → 只渲染单号字幕

> **新版落地建议**：项目里已有二维码生成能力（收据单的 `qr` 元素就是 18mm×18mm 的 SVG）。
> 直接复用它，**不要**为了这一处再引 `@zxing/library`。唯一要对齐的是
> `viewBox` / `preserveAspectRatio="xMidYMid meet"` / 外边距 0.5mm / 尺寸 17mm / `MARGIN=1`。

### 9.3 打印前等不等图片

| 路径 | 等图片 | 超时 | 位置 |
|---|---|---|---|
| `O`（量测） | ✅ | **✅ 2000ms** | GS:493-506 |
| `printDirect` | ✅ | ❌ **无超时** | GS:817-829 |

**⚠️ `printDirect` 的等待 Promise 没有 `setTimeout` 兜底**（raw `@279620-279700` 已核）：
任一张 `<img>` 既不触发 `onload` 也不触发 `onerror`（断链但连接挂起），
**打印对话框永远不会弹出**，而 `ElLoading` 遮罩一直转。
属于旧版缺陷 —— 新版**建议补 2s 兜底**（与 `O` 一致），并在注释里注明这是有意的改进。

---

## 10. 打印链路

### 10.1 三条路径

| 入口 | 触发 | 载体 | 时序 |
|---|---|---|---|
| **`printDirect`**（expose） | Home「手动打印」/「直接打印（非 Electron 分支）」按钮 | 新建**隐藏 iframe**（`top:0;left:0`），`document.write(完整文档)` | 等图片（无超时）→ **300ms** → `contentWindow.focus()` + `print()` → **1000ms** 后摘 iframe |
| **`printSilent`**（expose） | 「直接打印」且 `isElectronEnv` 为真 | Electron IPC | `await electronAPI.silentPrint(html, printerName, {landscape, copies, pageWidthMm, pageHeightMm})` |
| **预览 + 浏览器打印** | Home「直接打印」的非 Electron 分支 | Home 的预览容器 | Home 把 HTML 塞进容器 → `user-select`/浏览器 `Ctrl+P`，**组件本身不参与** |

### 10.2 `printDirect` 细节（GS:799-848）

```js
ElLoading.service({ lock:true, text:"正在生成玻璃合片单...", background:"rgba(0,0,0,0.7)" })
const html = await J()                                   // 完整 HTML 文档
const iframe = document.createElement("iframe")
iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;"
document.body.appendChild(iframe)
const win = iframe.contentWindow, doc = iframe.contentDocument || win.document
doc.open(); doc.write(html); doc.close()
await /* 等所有 <img> 完成，无超时 */
setTimeout(() => {
  win.focus(); win.print()
  setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe) }, 1000)
}, 300)
ElMessage.success("已打开打印对话框")
// finally: loading.close()
```
失败 → `ElMessage.error("打印失败: " + (e?.message || e))`

**与收据单 `printFromContainer` 的差异（这是重点）**：

| | 收据单 `printFromContainer(容器)` | 玻璃合片单 `printDirect()` |
|---|---|---|
| 输入 | **预览 DOM（clone）** | **重新构建的 HTML 字符串** |
| 谁调 | Home 的打印按钮，传容器 | Home 按钮直接调，**无参** |
| 为何能从 DOM clone | 预览就是最终样式 | 也可以，但旧版选择了重建 |
| 等图片 | ✅（无超时） | ✅（无超时） |
| 等待后延时 | **500ms** | **300ms** |
| 摘除 iframe | **1000ms** | **1000ms** |

⚠️ **玻璃合片单没有 `printFromContainer`**（全库 grep 无）。Home 侧也没有对应的 clone 打印按钮。
⇒ 玻璃合片单的「打印」实际是 `printDirect`（自己重建 HTML）+ `printSilent`（Electron）。
⇒ 新版若沿用收据单的 `printFromContainer(容器)` 方案，属于**改架构**，不是复刻；两者行为等价，
   但**要注意 300ms vs 500ms 这个差异**（收据单等更久）。

### 10.3 `printSilent` 细节（GS:849-889）

- 非 Electron → `ElMessage.warning("直接打印仅在Electron客户端可用")` + `return false`（**不抛错**）
- payload：`{ landscape: paper.widthMm > paper.heightMm, copies: config.print.copies, pageWidthMm, pageHeightMm }`
- 打印机名 = `selectedPrinter || ""`（空 → 系统默认）
- 成功文案 `已发送至打印机`；失败 `打印失败：{reason || "未知错误"}`；异常 `直接打印失败: {message}`

### 10.4 无「导出/复制」

玻璃合片单**没有** `copyPreviewToClipboard` / `exportPreviewToPdf` / `initColumnResize` / `initElementEditor`。
Home 侧对应位置也只有「排版用」的 `innerHTML` + `overflowX` 样式（见 §11.3）。

---

## 11. expose 全清单 + Home 侧调用点

### 11.1 组件 expose（GS:778-891，共 7 个）

| 名 | 类型 | 行为 |
|---|---|---|
| `buildGlassSheet2Html` | `(rows?) => Promise<string>` | 构建**整份 HTML 文档**（含 DOCTYPE/title） |
| `refreshPreview` | `() => Promise<void>` | `await props.onPreviewHtmlChange(await buildHtml())` |
| `openSettingsDialog` | `async () => void` | 打开「打印设置」 |
| `openLayoutEditor` | `async () => void` | 打开「布局编辑」 |
| `printDirect` | `async () => void` | 隐藏 iframe 打印 |
| `printSilent` | `async () => boolean` | Electron 静默打印 |
| `isElectronEnv` | `computed(() => !!window.electronAPI)` | ⚠️ **暴露的是 `Vue.computed` 本体**（不是 `.value`）；经 expose 代理取值时自动解包为 boolean |

**⚠️ 与盘点文档的一处更正**：`docs/2026-09-17-custom-documents.md` §2 写「每张的 expose 都有且仅有一个 `buildXxxHtml`」——
对**玻璃合片单**不准确：它有 **7 个**，`buildGlassSheet2Html` 只是同名的那一个。

### 11.2 props（GS:3-7，共 3 个）

```js
props: {
  getData:             { type: Function },   // Home 传 ai()
  isActive:            { type: Function },   // Home 传 ni()
  onPreviewHtmlChange: { type: Function },   // Home 传 ui()
}
```
**没有 `getCustomers`**（收据单是 `getCustomers`）；名字是 **`getData`**。

### 11.3 Home 侧全部调用点（`legacy/js/Home-d6b13b9a.js`）

| Home 符号 | raw 偏移 | 作用 |
|---|---|---|
| `li` | `@363024` | `Vue.ref(null)` —— 组件 ref |
| `oi` | `@363041` | `Vue.ref([])` —— 玻璃行 |
| `ai` | `@363056` | `() => Array.isArray(oi.value) ? oi.value : []` → 绑 `:get-data` |
| `ni` | `@363103` | `() => 16 === ic.value` → 绑 `:is-active` |
| `ui` | `@363126` | `async e => { Wn.value = e; await nextTick(); Hn.value = ao.value ? ao.value.scrollWidth : 0 }` → 绑 `:on-preview-html-change` |
| `ri` | `@363227` | `Vue.ref(false)` —— 「编辑合片单」弹窗可见 |
| `ii` | `@363242` | `oi.value.length ? ri.value = true : ElMessage.warning("暂无玻璃合片单数据")` |
| `ci` | `@363331` | `async e => { oi.value = e; eo.value && 16===ic.value && await li.value.refreshPreview() }` —— 编辑弹窗的 `onSave` |
| `si` | `@363469` | `await li.value.printDirect()` |
| `di` | `@363550` | `li.value.isElectronEnv ? await li.value.printSilent() : ( ic=16; Wn=On=Yn=""; Wn = await li.value.buildGlassSheet2Html(ai()); await nextTick(); Hn = ao.value?.scrollWidth ?? 0; eo=true )` |
| `Vi` | `@363855` | `li.value.openSettingsDialog?.() ?? ElMessage.error("自定义玻璃合片单组件未就绪")` |
| `mi` | `@363991` | `li.value.openLayoutEditor?.() ?? ElMessage.error("自定义玻璃合片单组件未就绪")` |
| `wi` | `@364118` | **入口**：调 `lc.value.calculateGlass()` → `oi.value` → `ic=16` → `buildGlassSheet2Html(ai())` |
| 状态 ref | `@354638-354683` | `Yn/Wn/On = ref("")`（三种预览 HTML）、`Hn = ref(0)`（预览宽）、`Tn = ref(false)` |
| `ao` | `@334486` | 预览容器 `ref`（`ref_key: "commentPreviewContainer"`） |
| `eo` | `@334426` | 预览显示开关 |

**组件挂载（`@500600`）**：
```html
<GlassSheet2PrintManager ref="li" :get-data="ai" :is-active="ni" :on-preview-html-change="ui" />
```
—— 与收据单一样**始终挂载**，靠 `isActive()`（`ic===16`）决定要不要刷新预览。

**预览容器（`@499768`）**：
```html
<div ref="commentPreviewContainer" :innerHTML="Wn" :style="{
  width: (ic===15 || ic===16) ? 'fit-content' : '1123px',
  margin: '0 auto', maxWidth: '100%',
  overflowX: (ic===15 || ic===16) ? 'auto' : undefined,
  position: 'relative', zIndex: 1 }" />
```
⚠️ `ic===16` 时 `width: fit-content` + `overflowX: auto` + `maxWidth: 100%`（**横向宽表靠容器横向滚动**）。
⚠️ `ui` **不调** `initColumnResize` / `initElementEditor`（收据单的 `yi` 会调）—— 玻璃合片单没有这两件事。

### 11.4 Home 工具条按钮（`ic===16` 时出现，共 5 颗，`@494300-495400`）

| key | 文案 | 图标类型 | handler | 动作 |
|---|---|---|---|---|
| 22 | ` 手动打印 ` | `primary` / `default` / `round` | `si` | `component.printDirect()` |
| 23 | ` 编辑合片单 ` | `primary` | `ii` | 打开 `ProductionEdit` 弹窗（见下） |
| 24 | ` 打印设置 ` | `warning` | `Vi` | `component.openSettingsDialog()` |
| 25 | ` 直接打印 ` | `primary` | `di` | Electron → `printSilent`；浏览器 → 生成预览 |
| 26 | ` 布局设置 ` | `success` | `mi` | `component.openLayoutEditor()` |

> 注意「编辑合片单」和「布局设置」是**两颗不同的按钮**：前者改**数据**，后者改**版式**。

### 11.5 「编辑合片单」弹窗（Home 侧，**不是**本组件的一部分）

`@516566`：
```html
<ProductionEdit v-model="ri" :production-data="oi" @save="ci" />
```
- **`ProductionEdit`** 定义在 **`legacy/js/Hui-d088417c.js`**（源码 `legacy/js/Hui.formatted.js:6227-6412`），
  被多张单据共用 —— **完整逆向见 §15**（另有 `ProductionEditOld` / `LabelEdit` 两个兄弟）
- props `{ modelValue: Boolean, productionData: any }`，emits `["update:modelValue", "save"]`
- 行为：打开时把 `basicInfo`/`doorsheet`/`doorframe`/`windows`/`door` 的 `<br>` 换成 `\n`（可就地编辑），
  保存时换回 `<br>`，`@save` 把整份新数组交回 Home → `ci` → `oi` 更新 → `refreshPreview()`
- 另有门图上传（`FileReader` → dataURL 写入 `row.doorImg`），限制「只能上传图片文件!」
- ⚠️ 它是**数据编辑**弹窗，与组件自己的 `openLayoutEditor`（**版式编辑**）是**两回事** —— 见 §15.6

---

## 12. 与收据单的差异 —— 逐条对照（实现时最需要的一节）

| # | 维度 | 收据单2（已实现） | 自定义玻璃合片单 | 影响 |
|---|---|---|---|---|
| 1 | **数据来源** | `props.getCustomers()` | `props.getData()` | Home 侧接线不同；数据来自 Hui 的 `calculateGlass()` |
| 2 | **行构造是否要重写** | 要（`receipt2/order.ts`） | **不用** —— `printPayloads.ts:748 glassProduces()` 已是同一套 | 直接复用 |
| 3 | **配置持久化** | 7 个键 | **2 个键**：`glass_sheet2_template_v1` / `glass_sheet2_printer_v1` | |
| 4 | **配置结构** | 扁平（6 字号 + 9 显隐 + 10 元素 + 10 列宽…） | **嵌套** `{paper, table{columns[]}, print}` | |
| 5 | **配置界面** | 「字体调节」弹窗（6 字号 + 品牌 + 纸张 + 头部元素 + 信息栏排序 + 底部元素 + 打印机） | 「打印设置」弹窗**只有纸张 + 打印机**，**无字号/品牌/显隐/排序** | |
| 6 | **版式编辑** | 元素微调浮层（X/Y 偏移、字号、宽度、显隐）+ 列宽拖拽 | **布局编辑全屏弹窗**（8 条 scoped CSS + 列参数表 + 上下箭头排序） | 两套完全不同的交互 |
| 7 | **列宽机制** | 10 个裸百分比 + 拖拽，存 `receipt2_column_widths` | 每列 `widthMm`（绝对 mm），**只能输入框改，不能拖** | |
| 8 | **字号机制** | 6 类全局字号 | 每列独立 `fontSize`（pt）+ 表头 `headerFontSize` | |
| 9 | **颜色** | 硬编码在 CSS | 每列 `fontColor` + 全局 `borderColor`（可改） | |
| 10 | **HTML 骨架类名** | `receipt2-*` / `data-r2-el` | `gs-*` / `gs2-*`，**无任何 data-* 属性** | |
| 11 | **页脚** | 只有最后一页有（金额 + 说明） | **完全没有页脚** | 分页预算因此是常数 |
| 12 | **页码** | 有（编号/日期区） | 多页时右上角 `gs2-page-num`（绝对定位，不占流） | |
| 13 | **分页固定开销** | 实测 | **硬编码 `- 8 - 10`** | |
| 14 | **分页预算是常数吗** | 否（末页不同） | **是** | |
| 15 | **空数据** | 一行 `colspan=10`「暂无明细」 | **一个空 `<tbody>` 的空页** | |
| 16 | **量测载体** | 隐藏 DOM | **隐藏 iframe（`document.write`）** | |
| 17 | **量测超时** | 无 | **2000ms** | |
| 18 | **打印入口** | `printFromContainer(容器)` —— clone 预览 DOM | `printDirect()` —— 重建 HTML 字符串，**无参** | |
| 19 | **打印等待** | 等图片 → **500ms** → print → **1000ms** 摘除 | 等图片（**无超时**）→ **300ms** → print → **1000ms** 摘除 | |
| 20 | **横版处理** | `@page size` 交换 + `transform: rotate(-90deg)` + `.r2-page-wrap` | **完全不做旋转** —— 直接把 `width/height` 写进 `@page` 和内联样式 | |
| 21 | **图片自适应** | `data-shrink-fit` 行内缩字号 | **没有** —— 图片列固定 `width:100%`，超长文本靠 `word-break:break-all` | |
| 22 | **二维码** | 18mm×18mm | **17mm×17mm**，`margin:0 auto 0.5mm`，**且带单号字幕**（按 `/` 折行） | |
| 23 | **导出/复制** | html2canvas + 浏览器打印对话框 | **没有** | |
| 24 | **编辑数据** | Home 的 contentEditable（改了不存） | Home 的 **`ProductionEdit` 弹窗**（改了**会存**，`@save` 回写） | |
| 25 | **外部 CSS** | 无（全内联） | 编辑器外壳 8 条在 `legacy/css/Home-97d96482.css`（scoped） | |
| 26 | **expose 数量** | 14 个（Home 用 8 个） | **7 个**（Home **全用**） | |
| 27 | **`orientation` 字段** | 有实际作用（旋转） | **有字段、无消费者** | 照抄即可，但别指望它生效 |

---

## 13. 未确认（没有猜着填）

1. **`table-layout:fixed` + 列宽之和 ≠ 可用宽时的实际分配** —— 默认 8 列合计 230mm，可用宽 291mm。
   浏览器对 `fixed` 布局里 `width` 之和不足的处理（按比例放大 / 保持原宽留白）**没有实测**，
   本环境无浏览器。**这直接影响「逐像素复刻」**，实现后必须人眼看一次。
   （INTERPRETED：几乎肯定是按比例放大到 100%，但没验证。）
2. **`O` 的 `doc.querySelector("div")` 取到的是不是包装 div** —— 量测算式
   `v = (W-2P) / div.offsetWidth`。若 `S`/表格内部先出现别的 div 就会取错。
   按 `O` 实际拼的 HTML（`<body><div style="width:…mm">{table}</div></body>`）看，
   第一个 div 就是包装 div；但**cell 里 `A()` 也会产出 `<div class="gs2-line">`**，
   若 `querySelector` 在某些实现下先命中它们就会错。**未实测**。
3. **`directionImageMap` 是怎么被填充的**（Hui 侧）—— `lockImg` 拿到的是 `string`，
   但那个 map 的构造在 Hui 里（`legacy/js/Hui.formatted.js` 的 `directionImageMap: v`，
   吊趟 `@4360`、平开 `@1570`），**本次没追**。属 Hui 侧逆向范围。
   （新版已有 `printPayloads.ts:97 lineLockImage()` 对应实现，可直接用。）
4. **`getImage()` 的返回形态** —— 是 dataURL 还是 http URL、是否本地缓存，未确认。
   新版 `printPayloads.ts` 用的是 `l.image_url`（后端字段），**与旧版 `getImage(图片ID)` 是否等价未验证**。
5. **`8` / `10` 这两个预算常数** —— 语义是 INTERPRETED（见 §5.2），不是直接读出来的注释。
6. **`a()` 里 `orientation` 到底是给谁用的** —— 全组件 0 消费者（CONFIRMED），
   但**为什么留着**是推断（从合格标签那套复制过来的残留）。
7. **`H` 里 `d = rows.length > 0 ? rows : []`**（GS:793）—— 逻辑上等价于 `rows`，
   读不出作者原意（可能本想做别的事）。按原样复刻即可，无行为影响。
8. ~~**`S` 用 15mm、`O`/`G` 用 17mm 是不是笔误**~~ —— 三处不一致是 CONFIRMED 的事实；
   「是不是有意」读不出。**已决策：新版三处统一 17mm**（§7.4）。
9. **`printDirect` 的图片等待无超时** 是 CONFIRMED 的代码事实；「是缺陷还是有意」是判断，
   本报告按缺陷处理并建议补 2s。

---

## 14. 新版落地建议（一句话版）

1. **数据层不用写** —— 复用 `app/src/utils/printPayloads.ts` 的 `glassProduces()`（引擎 A），
   它已经对齐了旧版 `_0xcfde65` / `_0x4d28ce`。
2. **CSS 层** §4 的 1739 字符 + §4.2 的 8 条 scoped 规则，**逐字落盘**。
3. **HTML 层** §3 的模板，注意那四个字面量换行/缩进、` />` 的空格、`<tr>` 的前导 `\n  `。
4. **分页层** §5 的 `O` + `H` 照抄，`8`/`10`/`17mm`/`20` 四个魔数一个都别改。
5. **配置层** 2 个键 + §6.4 的清洗规则；✅ **已决策：`paddingMm` 的 `??` 改 `||` 语义**（§6.4），
   注释写明这是有意的偏离、以及旧版 `NaN` 会让分页退化成单页。
6. **编辑器** §7 的控件表逐项对照实现；scoped CSS 拷 §4.2；✅ **已决策：二维码三处统一 17mm**（§7.4）。
7. **可复用到另三张**：布局编辑器（`gs2-layout-*` 这套外壳 + 列参数表 + 上下箭头）在
   合格标签 / 生产单 / 生产单2 里应当是**同一套**，做一次可复用四次 —— 但**本次只验证了玻璃合片单**，
   另三张的列结构/字段名需各自确认（它们的 scoped hash 可能不同）。
8. **还有一层独立的共用 UI**：Home 的「编辑XX」弹窗（`ProductionEdit` / `ProductionEditOld` / `LabelEdit`），
   与布局编辑器是两回事，见 **§15**。玻璃合片单用的是 `ProductionEdit`。

---

## 15. 共用弹窗 `ProductionEdit`（「编辑XX」系列）—— 补充逆向

> 起因：§11.5 只给了调用点。这一节把三个共用弹窗全部逆出来。
> 它们**不在** `GlassSheet2PrintManager` 里，而是定义在 **Hui chunk**
> （`legacy/js/Hui-d088417c.js`，源码 `legacy/js/Hui.formatted.js`），由 **Home** 挂载。

### 15.1 结论：Home 侧有**三个**共用的「编辑数据」弹窗

| 组件 | `Hui.formatted.js` 行 | scoped id | 根类名 | 数据形状 |
|---|---|---|---|---|
| **`ProductionEdit`** | 6227–6413 | `c844d7f3` | `.production-edit-wrapper` | **平铺行**（`client`/`door`/`basicInfo`/`doorsheet`/`doorframe`/`windows`/`doorImg`/`remark`/`OrderID`） |
| **`ProductionEditOld`** | 6529–6861 | `da0814f4` | `.production-edit-old-wrapper` | **oldSheet 族**（`size` + `oldSheet[0].*`，**支持双联** `orderId1`/`oldSheet1`） |
| **`LabelEdit`** | 5954–6137 | `4284534e` | `.label-edit-wrapper` | **标签行**（`client`/`storeAddress`/`door`/`size`/`color`/`lockway`/`orderID`/`address`/`glass`/`package`/`remark`） |

三者的 **props / emits 签名完全一致**（这是它们能共用的原因）：

| | 值 |
|---|---|
| props | `{ modelValue: { type: Boolean }, <数据 prop> }` —— 数据 prop 名分别是 `productionData`、`productionData`、`labelData` |
| emits | `["update:modelValue", "save"]` |

**Hui chunk 的导出映射（CONFIRMED，用于辨认同名组件）**：

```
_0xb261ee = ProductionEdit       (Hui.formatted.js:6227)
_0x475eaa = ProductionEditOld    (Hui.formatted.js:6529)
_0x33f65a = LabelEdit            (Hui.formatted.js:5954)
```

Home 的 import 行：`import{u as t,_ as l,a as o,b as a,c as n,d as u,e as r,f as i,g as c,s}from"./Hui-d088417c.js"`
⇒ Home 里的 `i` = `ProductionEdit`，`c` = `ProductionEditOld`，`r` = `LabelEdit`。

### 15.2 `ProductionEdit` 全解（玻璃合片单用的就是它）

**源码结构**（`Hui.formatted.js:6227-6412`）

```js
const ProductionEdit = Vue.defineComponent({
  __name: "ProductionEdit",
  props: { modelValue: { type: Boolean }, productionData: {} },
  emits: ["update:modelValue", "save"],
  setup(props, { emit }) {
    const dialogVisible = Vue.ref(false)   // l
    const rows          = Vue.ref([])      // o —— 内部副本
    const uploadDialogVisible = Vue.ref(false)  // c
    const uploadRow     = Vue.ref(null)    // n —— 当前上传的门图行
    // ...见下
  }
})
```

**状态与行为（逐条 CONFIRMED）**

1. **打开即拷贝 + 换行符转换**（`Vue.watch(() => props.modelValue, e => {...})`）：
   ```js
   dialogVisible.value = e
   if (e) rows.value = props.productionData.map(row => ({
     ...row,
     basicInfo: row.basicInfo?.replace(/<br>/gi, "\n") || "",
     doorsheet: row.doorsheet?.replace(/<br>/gi, "\n") || "",
     doorframe: row.doorframe?.replace(/<br>/gi, "\n") || "",
     windows:   row.windows?.replace(/<br>/gi, "\n")   || "",
     door:      row.door?.replace(/<br>/gi, "\n")      || "",
   }))
   ```
   ⚠️ **只转这 5 个字段**。`remark`、`OrderID`、`doorImg` **不做换行转换**。
   ⚠️ `map` 产出的是**新对象**（`{...row}`），所以编辑期间不会污染父组件的行 —— 直到点「确认修改」才回写。

2. **关闭时同步 v-model**：`Vue.watch(dialogVisible, e => { if (!e) emit("update:modelValue", false) })`

3. **「确认修改」**（`r`）：
   ```js
   const mapped = rows.value.map(row => ({
     ...row,
     basicInfo: row.basicInfo?.replace(/\n/g, "<br>") || "",
     doorsheet: row.doorsheet?.replace(/\n/g, "<br>") || "",
     doorframe: row.doorframe?.replace(/\n/g, "<br>") || "",
     windows:   row.windows?.replace(/\n/g, "<br>")   || "",
     door:      row.door?.replace(/\n/g, "<br>")      || "",
   }))
   emit("save", mapped)
   dialogVisible.value = false            // → 触发 watch #2 → emit update:modelValue(false)
   ElMessage.success("生产单已更新")
   ```
   转回的字段与转出去的**严格对应**（同样 5 个）。

4. **「取消」/ 关闭按钮 / ESC / 点遮罩**（`s` + `onClose`）：`dialogVisible.value = false`，**丢弃副本**（父数据从未被改）。

5. **门图上传**（`d`）：`<el-upload>` 的 `on-change` →
   - `uploadRow.value.raw.type.startsWith("image/")` 不成立 → `ElMessage.error("只能上传图片文件!")`
   - 否则 `FileReader.readAsDataURL(file)` → `onload` 里 `uploadRow.value.doorImg = String(reader.result)`
   - 上传完 `uploadDialogVisible.value = false`
   ⚠️ `before-upload: () => false` + `auto-upload: false` + `action: "#"` ⇒ **纯本地，不发请求**。

**弹窗 DOM（两层的 el-dialog）**

```
<div class="production-edit-wrapper">
  <el-dialog
    v-model="dialogVisible"
    width="1400px"
    :append-to-body="true"
    :destroy-on-close="false"
    @close="cancel">
    #default:
      <div class="button-group">
        <el-button type="primary" size="default" round @click="confirm">确认修改</el-button>
        <el-button               size="default" round @click="cancel">取消</el-button>
      </div>
      <el-table :data="rows" border :style="{width:'100%','font-size':'18px'}">
        <el-table-column prop="OrderID"   label="单号"       width="150"> el-input
        <el-table-column prop="door"      label="型材/颜色"   width="180"> el-input type=textarea rows=4
        <el-table-column prop="basicInfo" label="基本信息"   width="200"> el-input type=textarea rows=4 :autosize={minRows:4,maxRows:8}
        <el-table-column prop="doorsheet" label="门扇材料"   width="200"> el-input type=textarea rows=5 :autosize={minRows:5,maxRows:10}
        <el-table-column prop="doorframe" label="门框材料"   width="200"> el-input type=textarea rows=5 :autosize={minRows:5,maxRows:10}
        <el-table-column prop="windows"   label="亮窗/扣板"   width="200"> el-input type=textarea rows=5 :autosize={minRows:5,maxRows:10}
        <el-table-column prop="doorImg"   label="门图"       width="180"> …见下…
        <el-table-column prop="remark"    label="备注"       width="200"> el-input type=textarea rows=3
      </el-table>
  </el-dialog>

  <el-dialog
    v-model="uploadDialogVisible"
    title="上传图片"
    width="480px"
    :append-to-body="true"
    :destroy-on-close="false"
    :close-on-click-modal="false">
    #footer: <span class="dialog-footer"><el-button @click="uploadDialogVisible=false">取消</el-button></span>
    #default:
      <el-upload class="upload-dialog" drag action="#" :auto-upload="false"
                 :show-file-list="false" accept="image/*" :on-change="handleChange" :before-upload="() => false">
        <el-icon class="el-icon--upload"><upload-filled/></el-icon>
        <div class="el-upload__text">将图片拖到此处，或<em>点击上传</em></div>
        <div class="el-upload__tip">（只能上传 jpg/png 图片文件）</div>
      </el-upload>
  </el-dialog>
</div>
```

**门图列（`prop="doorImg"`）的单元格**：
```
<div class="door-image-cell">
  <el-image v-if="row.doorImg" :src="row.doorImg" :style="{width:'80px',height:'80px'}" fit="contain"/>
  <span v-else>-</span>
  <div class="door-image-actions">
    <el-button size="small" type="primary" @click="uploadRow=row; uploadDialogVisible=true">上传</el-button>
    <el-button size="small" type="danger"  @click="row.doorImg=''">删除</el-button>
  </div>
</div>
```

**所有输入框的 `input-style` 统一是** `{ fontSize: "18px", lineHeight: "1.6" }`；表格整体 `font-size: 18px`。

**scoped CSS 完整原文**（`legacy/css/Hui-39b802eb.css`，`data-v-c844d7f3`）：
```css
.production-edit-wrapper[data-v-c844d7f3] .el-dialog__body,.production-edit-wrapper[data-v-c844d7f3] .el-table,.production-edit-wrapper[data-v-c844d7f3] .el-table th,.production-edit-wrapper[data-v-c844d7f3] .el-table td,.production-edit-wrapper[data-v-c844d7f3] .el-table__header,.production-edit-wrapper[data-v-c844d7f3] .el-table__body{font-size:18px!important}
[data-v-c844d7f3] .el-input__inner,[data-v-c844d7f3] .el-textarea__inner{border:none!important;padding:2px 4px;background:transparent}
[data-v-c844d7f3] .el-input__wrapper,[data-v-c844d7f3] .el-textarea__wrapper{box-shadow:none!important;background:transparent;border:none!important}
.production-edit-wrapper[data-v-c844d7f3] .el-input__inner,.production-edit-wrapper[data-v-c844d7f3] .el-input input,.production-edit-wrapper[data-v-c844d7f3] .el-textarea__inner,.production-edit-wrapper[data-v-c844d7f3] .el-textarea textarea,.production-edit-wrapper[data-v-c844d7f3] .el-button,.production-edit-wrapper[data-v-c844d7f3] .el-button span,.production-edit-wrapper[data-v-c844d7f3] .el-table-column{font-size:18px!important}
.door-image-cell[data-v-c844d7f3]{display:flex;flex-direction:column;align-items:center;gap:8px}
.door-image-actions[data-v-c844d7f3]{display:flex;gap:8px}
.button-group[data-v-c844d7f3]{margin-bottom:16px;display:flex;gap:12px}
```

> ⚠️ **对玻璃合片单的含义（重要）**：`ProductionEdit` 的列是**按字段名硬编码**的，**不是按单据配置生成的**。
> 所以「编辑合片单」弹窗里出现的是：单号 / 型材·颜色 / 基本信息 / **门扇材料** / **门框材料** / **亮窗·扣板** / 门图 / 备注。
> 而玻璃合片单的 8 列是 客户 / 门类 / 单号 / 订单信息 / 方向 / **玻璃尺寸** / 门图 / 备注。
>
> - 弹窗里**改不到** `client`（客户）和 `lockImg`（方向）—— 这两列在玻璃合片单里可见但**不可编辑**；
> - 弹窗里的「门扇材料」实际写的是行对象的 **`doorsheet`**，也就是玻璃合片单的「玻璃尺寸」列 ——
>   **同一个字段、两个不同的列标题**；
> - 弹窗里的「门框材料」「亮窗·扣板」对应 `doorframe`/`windows`，玻璃合片单的版式**根本不显示**这两列
>   （`glassProduces()` 里也没有），所以对这张单是**多余的两列**（值为空串）。

### 15.3 `ProductionEditOld` 全解（自定义生产单 ic=14 用）

**与 `ProductionEdit` 的关键差异：它处理的是 `oldSheet` 嵌套族，且支持「双联」。**

- **数据形状**：`{ orderID, material, color, size, glass, address, remark, doorImg, oldSheet:[{doorsheet, doorframe, windows}] }`
  双联时再加 `orderID1, size1, remark1, doorImg1, oldSheet1:[{...}]`
- **编辑期字段重命名**（`<br>`↔`\n` 之外，还做了「嵌套 → 扁平」的拆装）：
  - `size`（数组）↔ `_size`（换行串）—— 保存时 `split("\n").filter(s => s.trim() !== "")`
  - `oldSheet[0].doorsheet` ↔ `_doorsheet`；`oldSheet[0].doorframe` ↔ `_doorframe`；`oldSheet[0].windows` ↔ `_windows`
  - 双联同理：`size1` ↔ `_size1`，`oldSheet1[0].*` ↔ `_doorsheet1`/`_doorframe1`/`_windows1`
  - `remark`/`remark1` 只做 `<br>`↔`\n`
- **是否显示第二联**由一个 computed 决定：
  `rows.length > 0 && rows.some(r => r.orderID1 !== undefined)`（源码里的 `r`），
  模板里 `r.value ? (<第二组列>) : ...`
- **门图上传支持两联**：`uploadRow` 存行、`uploadSlot`（源码 `d`，空串 或 `"1"`）决定写
  `row.doorImg` 还是 `row["doorImg1"]`
- 弹窗 `width="1500px"`（`ProductionEdit` 是 1400）
- 列（**第一联**，11 列）：单号`orderID`130 · 型材`material`180 · 颜色`color`120 · 尺寸`_size`150 · 玻璃`glass`150 ·
  地址`address`150 · 门扇材料`_doorsheet`200 · 门框材料`_doorframe`200 · 亮窗/扣板`_windows`200 · 门图`doorImg`160 · 备注`remark`180
- 列（**第二联**，同样 11 列，label 后缀 `2`）：单号2/型材2/颜色2/尺寸2/玻璃2/门扇2/门框2/亮窗·扣板2/门图2/备注2
- 其余（`确认修改`/`取消`、成功文案 `生产单已更新`、上传弹窗 `上传图片` 480px）与 `ProductionEdit` 相同
- scoped CSS 与 `ProductionEdit` **逐字相同**，只换了 hash（`da0814f4`）与根类名（`.production-edit-old-wrapper`）

> 结论：**不要**用 `ProductionEdit` 去顶 `ProductionEditOld`。两者的数据形状（平铺 vs oldSheet 嵌套 + 双联）不同。
> 新版若统一，必须先做一层「oldSheet 族 → 扁平行」的适配。

### 15.4 `LabelEdit` 全解（自定义合格标签 ic=13 用）

**最简单的一个 —— 它只做「拷贝 + 回写」，不做任何字段变换。**

- props `{ modelValue: Boolean, labelData: any }`，emits 同上
- 打开：`rows.value = props.labelData.map(e => ({ ...e }))` —— **纯浅拷贝，无 `<br>`↔`\n` 转换**
- 确认（`n`）：`emit("save", rows.value.map(e => ({ ...e })))`，关闭，`ElMessage.success("标签已更新")`
- `onMounted` 里有一个**门店特判**：
  `getUserData()` → 若 `userinfo.registrant === "杉杉铝木极简门"` → `showStoreAddress.value = true`
  该标志**只控制「位置」列（`prop="storeAddress"`）是否渲染**
- 弹窗 `width="1400px"`
- 列（12 列）：客户`client`130 · **位置`storeAddress`130（仅特判门店可见）** · 门型`door`160 · 尺寸`size`180 ·
  颜色`color`110 · 开向`lockway`130 · 单号`orderID`135 · 地址`address`120 · 玻璃`glass`130 · 包号`package`90 ·
  备注`remark` · **操作**150（`fixed:"right"`）
- 「操作」列两个按钮（**就地改数组**，没有二次确认弹窗）：
  - **复制**（`primary` small）：`rows.splice($index+1, 0, { ...rows[$index] })` → `ElMessage.success("已复制标签")`
  - **删除**（`danger` small）：`rows.length <= 1` → `ElMessage.warning("至少需要保留一个标签")`；
    否则 `rows.splice($index, 1)` → `ElMessage.success("已删除标签")`
- scoped CSS 只有 3 条（`data-v-4284534e`）：
  ```css
  [data-v-4284534e] .el-input__inner,[data-v-4284534e] .el-textarea__inner{border:none!important;padding:2px 4px;background:transparent}
  [data-v-4284534e] .el-input__wrapper,[data-v-4284534e] .el-textarea__wrapper{box-shadow:none!important;background:transparent;border:none!important}
  .button-group[data-v-4284534e]{margin-bottom:16px;display:flex;gap:12px}
  ```

### 15.5 各单据怎么用它（Home 侧全映射，CONFIRMED）

Home 的 render 里有 **6 个**这种「数据编辑」弹窗的 vnode（`@515915-516800`）：

| ic | 单据 | 工具栏按钮（key） | handler | 弹窗组件 | `v-model` ref | 数据 prop | `@save` |
|---|---|---|---|---|---|---|---|
| 1 | 玻璃合片单（hiprint） | ` 编辑玻璃合片单 `（33）| `dc` | **`ProductionEdit`** | `cc` | `uc` | `gc` |
| 2 | 生产单（hiprint） | ` 编辑生产单 `（29）| `dc` | **`ProductionEdit`** | `cc` | `uc` | `gc` |
| 13 | 自定义合格标签 | ` 编辑标签 `（11）| `kc` | **`LabelEdit`** | `Lc` | `bc`（`label-data`） | `Pc` |
| 14 | 自定义生产单 | ` 编辑生产单 `（13）| `mc` | **`ProductionEditOld`** | `Vc` | `14===ic ? Sr() : uc` | `wc` |
| 15 | 自定义生产单2 | ` 编辑生产单 `（18）| `Xr` | **`ProductionEdit`** | `Zr` | `qr` | `Qr` |
| 16 | **自定义玻璃合片单** | ` 编辑合片单 `（23）| `ii` | **`ProductionEdit`** | `ri` | `oi` | **`ci`** |

（另有 1 个 `customer-data` 弹窗 `v-model:_n :customer-data:jn[0] @save:qi`，属另一族，与本主题无关。）

**各 handler 的原文要点**：

- **打开**（都先判空，空则 `ElMessage.warning`）
  - `dc`（ic=1/2）：`uc.value.length ? cc.value = true : ElMessage.warning("暂无生产单数据")`
  - `ii`（ic=16，玻璃）：`oi.value.length ? ri.value = true : ElMessage.warning("暂无玻璃合片单数据")`
  - `Xr`（ic=15）：`qr.value.length ? Zr.value = true : ElMessage.warning("暂无生产单数据")`
  - `mc`（ic=14）：`const t = 14===ic.value ? Sr() : uc.value; Array.isArray(t) && t.length ? Vc.value = true : ElMessage.warning(...)`
  - `kc`（ic=13）：`Cc ? (bc.value = Cc, Lc.value = true) : ElMessage.warning(...)`（`Cc` 是普通变量，非 ref）
  - ⚠️ **`mc` 里的 `14===ic.value ? Sr() : uc.value` 恒为真分支**（该按钮只在 `14==ic` 时渲染），
    三元是冗余的 —— 照抄无行为影响。
- **保存后**（都先回写 ref，再在「预览打开且 ic 匹配」时刷新）
  - `ci`（玻璃）：`oi.value = Array.isArray(e) ? e : []; eo.value && 16===ic.value && await li.value.refreshPreview()`
  - `Qr`（生产单2）：`qr.value = …; eo.value && 15===ic.value && await jr.value.refreshPreview()`
  - `gc`（ic=2）：`uc.value = e; eo.value && 2===ic.value && …`（hiprint 重新渲染）
  - `wc`（生产单）：`if (14 !== ic.value) {...} else {...}` 双分支
  - `Pc`（合格标签）：`Cc = e; eo.value && 4===ic.value && …`
  - ⚠️ **`ci` 只改 `oi`（Home 的 ref），不会回写 Hui 的汇算结果**。
    下次从 Hui 重新 `calculateGlass()` 时改动**会被覆盖**。

**结论（对玻璃合片单）**：`ri`（弹窗可见）→ `oi`（数据）→ `ci`（回写 + 刷新预览）。
新版只需一个共用弹窗组件 + 每张单据一组 `(visibleRef, rows, onSave)`。

### 15.6 它与「布局编辑器」是什么关系？—— **三套完全不同的东西，别合并**

对自定义玻璃合片单，Home 上有 **三个**互不相干的弹窗：

| # | 入口按钮 | 归属 | 组件 | 改什么 | 存哪 | 生效方式 |
|---|---|---|---|---|---|---|
| A | ` 编辑合片单 ` | **Home**（Hui chunk 的共用件） | `ProductionEdit` | **行数据**（文本字段 + 门图 URL） | **不持久化**，只改内存 | `@save` → `oi` → `refreshPreview()` |
| B | ` 布局设置 ` | **`GlassSheet2PrintManager` 自己** | 组件内的 `openLayoutEditor` | **版式**（纸张/边距/标题/表头字号/边框色/每列的显隐·宽·字号·行高·颜色·排序） | localStorage `glass_sheet2_template_v1` | 保存后 `refreshPreview()` |
| C | ` 打印设置 ` | **`GlassSheet2PrintManager` 自己** | 组件内的 `openSettingsDialog` | 纸张尺寸/内边距/方向/常用尺寸/打印机/份数 | 同键 `glass_sheet2_template_v1` + `glass_sheet2_printer_v1` | 保存后 `refreshPreview()` |

**判据（为什么是「三套」而不是一套的三个入口）**：

1. **代码归属不同**：A 在 Hui chunk、由 Home 渲染并用 `v-model`/`@save` 接线；
   B/C 在 `GlassSheet2PrintManager` 的 setup 里，走 `expose`（`openLayoutEditor` / `openSettingsDialog`）。
2. **数据域不同**：A 改的是「这一次要打印的这几行」（`oi`），B/C 改的是「这张单据长什么样」（`oi` 之外）。
   A 的产物随行数据生灭，B/C 的产物跨会话持久化。
3. **生命周期不同**：A 的编辑副本在打开时拷贝、关闭即弃；B/C 是「草稿 ref + 保存回写」的成对结构。
4. **按钮是并列的**（Home 工具条 key 22–26 五颗，`ic===16` 时同时出现），不是同一条流程的三步。

**⚠️ 术语坑（写文档/代码时别混）**：

| 用户看到的按钮 | 技术名 | 是 A/B/C 哪个 |
|---|---|---|
| ` 编辑合片单 ` | `ProductionEdit` | **A** |
| ` 布局设置 ` | `openLayoutEditor`（弹窗标题「自定义玻璃合片单 - 布局编辑」） | **B** |
| ` 打印设置 ` | `openSettingsDialog`（弹窗标题「自定义玻璃合片单 - 打印设置」） | **C** |

> 盘点文档 `docs/2026-09-17-custom-documents.md` §3 说「其余四张配置入口是 `openLayoutEditor`（布局编辑）」——
> 那只覆盖了 **B**，**漏了 A**（`ProductionEdit`）。四张自定义单据**同时**有 A 和 B（见 §15.5 的映射表：
> ic=13 有 ` 编辑标签 ` + ` 编辑布局 `；ic=14 有 ` 编辑生产单 ` + ` 编辑布局 `；
> ic=15 有 ` 编辑生产单 ` + ` 布局设置 `；ic=16 有 ` 编辑合片单 ` + ` 布局设置 `）。

### 15.7 新版落地建议

1. **做一个共用弹窗**（建议 `app/src/components/ProductionEditDialog.vue`），props
   `{ modelValue, rows, columns }` + `emits ['update:modelValue','save']`。
   把「列定义」从组件里抽出来做参数，**不要**像旧版那样硬编码 8/11/12 列三份。
2. **换行转换做成配置**：`brFields: string[]`（旧版 `ProductionEdit` 是 5 个字段，`LabelEdit` 是 0 个）。
3. **`ProductionEditOld` 的 oldSheet 拆装**单独做一层 adapter
   （`oldSheet[0].* ↔ _*`、`size ↔ _size`、双联 `1` 后缀），别塞进共用弹窗。
4. **`LabelEdit` 的门店特判**（`registrant === "杉杉铝木极简门"` → 多一列「位置」）要保留 —— 这是业务规则，不是样式。
5. **门图上传**用本地 `FileReader.readAsDataURL` + `accept="image/*"` + 格式校验，
   路径要覆盖「上传 / 删除 / 拖拽」三种入口；**不经过后端**。
6. 三套（A/B/C）**保持分离**，只共用一个「编辑数据」弹窗；B/C 各单据仍需各自的版式/打印设置实现
   （玻璃合片单的 B/C 见 §7、§8）。
