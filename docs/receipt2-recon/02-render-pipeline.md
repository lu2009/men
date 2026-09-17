# 收据单2 · 渲染管线（订单数据 → HTML 字符串）

分析对象：`legacy/js/Receipt2.deobfuscated.js`（2637 行，字符串已解码、变量名单字母）。
所有行号引用均指该文件。标注：**CONFIRMED** = 直接读到；**INTERPRETED** = 推断（附依据）。

> **先纠正一处任务描述里的猜测**：`Z` **不是**「订单 → 行数组」的函数。
> `Z`（`Receipt2.deobfuscated.js:252`）= **字号设置清洗器**（headerFontSize/tableFontSize/…，
> 钳位到白名单范围，给缺省值）。真正的「订单 → 行数组」是 `we`（单张）与 `ge`/`ye`（批量）。
> 另外 `l`（`:9` `const l = _o`）是**字符串解码器**的别名残留，`const t = l` / `const o = l`
> （如 `:52`、`:108`、`:200`、`:241`…）在解码后全部是**死代码**，不带任何语义。
> `Jo`（`:629`、`:832`、`:1061`）同理，是另一个解码器（`Home.formatted.js:2282` `function Jo(e,t)`），
> `const t = Jo; const o = t;` 里的 `o` 从未被使用。**读这个文件时，除 `l`/`Jo` 外的单字母才需要就近读赋值。**

---

## 1. 入口与数据流

### 1.0 订单对象的形状（渲染器实际读取的键）

| 层级 | 键 | 说明 |
|---|---|---|
| order | `receipt: Line[]` | 明细行数组。**不是数组就当空数组**（`:617`） |
| order | `payQrcode` | 收款二维码 URL（可空） |
| order | `orderNo` / `date` / `client` / `tel` / `productionDays` | 英文键 |
| order | `安装地址` | **中文键**，注意与英文 `address` 不通用 |
| order | `brand` | 品牌（标题兜底） |
| order | `total` / `deposit` / `balance` | 金额三兄弟 |
| order | `declaration` | 说明文字 |
| line | `profile` `direction` `color` `glass` `size` `quantity` `price` `amount` `pricing` `remark` | 10 个英文键，见 §4 |

**CONFIRMED**（`:479–500`、`:525–543`、`:587–598`、`:443–461`）。
数据来源：`_()`（`:239`）= `props.getCustomers()`，`Array.isArray` 校验后取用。

### 1.1 `we(order, fontSettings) -> Promise<string[]>` —— 单张订单 → 页面数组（核心）

`Receipt2.deobfuscated.js:615`。步骤：

1. `a = order.receipt`（非数组则 `[]`）。
2. **空明细短路**：`a.length === 0` → 直接 `[me(order, [], true)]`（一页 + 「暂无明细」占位行 + 页脚）。**CONFIRMED**（`:620`）
3. **离线量测**（`:621–666`）：把一张临时 DOM 挂到 `body` 外量高度，见 §3。
4. 预设惩罚量 `i`（`:667–692`）：按打印预设 key 查表，`pin-210-140`/`pin-200-140`/`a4-*`/未知 → `0`；
   `pin-210-90`/`pin-200-90` → `1`。**INTERPRETED**：这是 1px 安全余量（90mm 矮纸留白更紧）；
   预设 key 由 `X(h.value)` 与预设表 `d` 做「朝向相同 + 宽高差 ≤2mm」的近似匹配得出（`:682–690`，`Q()` 定义在 `:307`）。
5. 分页（`:693–720`），算法见 §3.3。
6. 逐页 `me(order, rows.slice(...), isLastPage)`。

### 1.2 `ge(orders?) -> Promise<string>` —— 批量 → 预览用 HTML 片段

`Receipt2.deobfuscated.js:723`。默认 `orders = _()`；对每张订单 `await we(o, Z(v.value))` 并展平页面数组；
产出：

```html
<div class="receipt2-root"><style>{{CSS}}</style>{{所有页面拼接}}</div>
```

**注意**：`ge` **不等待图片、不做 shrink-fit**。它只吐字符串，交给父组件 `props.onPreviewHtmlChange`（`ve`，`:805`）。
缩字与图片等待由**父组件侧**的 `initColumnResize`(`pe`) 完成，见 §3.4。

### 1.3 `ye() -> Promise<void>` —— 批量 → 独立 HTML 文档 + iframe 静默调起浏览器打印

`Receipt2.deobfuscated.js:740`。产出完整文档：

```html
<!DOCTYPE html><html><head><meta charset="utf-8"><title>收据单2</title>
    <style>html,body{margin:0;padding:0;background:#fff;}{{CSS}}</style>
  </head><body><div class="receipt2-root">{{所有页面拼接}}</div></body></html>
```

然后：建隐藏 iframe → `document.write` → **等所有 `<img>` 加载完** → `setTimeout(500)` → shrink-fit → `contentWindow.focus()` → `print()` → 1s 后移除 iframe。**CONFIRMED**（`:755–803`）

**图片等待逻辑（`:764–776`）**：`querySelectorAll("img")`，长度 0 直接 resolve；否则每个 img 上
`img.complete ? 计数+1 : (img.onload = img.onerror = 计数+1)`，**计数达总数才 resolve**。
→ **渲染器产出的 `<img>` 只有收款二维码一个**（`ie` 的明细行**不含任何图片**），所以这段等待
实质上是「等二维码加载完」。**CONFIRMED**：全文只有 `:481` 一处输出 `<img>`。

**`we` 里没有图片等待逻辑**（任务描述里提到的那段在 `ye`，不在 `we`）。

### 1.4 相关但不属于本条线的入口（仅列名，供交叉引用）

- `ve = async () => onPreviewHtmlChange(await ge())`（`:805`）——刷新预览。
- `me(order, rows, withFooter) -> string`（`:603`）——**单页**组装，是唯一的「页面模板」函数。
- `de(order) -> string`（`:475`）——页头 + 客户信息区。
- `Ve(order) -> string`（`:579`）——页脚（金额 + 说明）。
- `re() -> string`（`:439`）——表头行。
- `ie(line) -> string`（`:441`）——明细行。
- `ue(fonts, print) -> string`（`:371`）——**唯一的 CSS 发生器**（含 `@page`）。
- `ce(name)` / `se(name)`（`:463` / `:470`）——`data-r2-el` 属性生成 / 可见性判定。

---

## 2. 还原后的 HTML 骨架（逐字复刻用）

缩进与换行**照抄**（这段空白是真实产物的一部分，`overflow:hidden` 的 flex 布局下不影响观感，但复刻时应一致）。

```html
<div class="receipt2-root"><style>{{CSS}}</style>
<section class="receipt2-page">
    
    <div class="receipt2-header">
      {{HEADER_LEFT}}
      <div class="receipt2-title" {{CE:title}}>{{TITLE}}</div>
      {{HEADER_RIGHT}}
    </div>
    {{META_ROW}}
    <table class="receipt2-table">
      <thead><tr><th>型材</th><th>开向</th><th>颜色</th><th>玻璃</th><th>尺寸</th><th>数量</th><th>单价</th><th>金额</th><th>计价方式</th><th>备注</th></tr></thead>
      <tbody>{{ROWS}}</tbody>
    </table>
    {{FOOTER}}
  </section>
</div>
```

### 2.1 逐段精确模板

**`me`（`:603`）** —— 注意 `<section ...>` 后是 `\n` + 4 空格，紧接着 `de()` 又以 `\n` + 4 空格开头，
所以页首有**一行 4 空格空行**；页脚为空时表尾会留下 `</table>\n    \n  </section>`。

```
<section class="receipt2-page">\n    {DE}\n    <table class="receipt2-table">\n      {RE}\n      <tbody>{ROWS}</tbody>\n    </table>\n    {FOOTER}\n  </section>
```
- `FOOTER` = `withFooter ? Ve(order) : ""`。**只有最后一页带页脚**。**CONFIRMED**（`:613`、`:719`）
- `ROWS` = 行拼接，或（无明细时）`<tr><td colspan="10" class="empty-row">暂无明细</td></tr>`。**CONFIRMED**（`:611`）

**`de`（`:562–577`）** —— 页头 + 客户信息区：

```
\n    <div class="receipt2-header">\n      {LEFT}\n      <div class="receipt2-title" {CE:title}>{TITLE}</div>\n      {RIGHT}\n    </div>\n    {META}
```
- `LEFT`  = 有内容时 `<div class="receipt2-header-left">` + 元素 `join("")` + `</div>`，否则字面量 `<div></div>`。
- `RIGHT` = 同上，类名 `receipt2-header-right`。
- `TITLE` = `brandEnabled && brandName ? brandName : (order.brand || "收据单2")`，经 `ae()` 转义。
  品牌设置来自 localStorage `receipt2_brand_settings`（`{enabled, name}`，`:21`）。**CONFIRMED**（`:568–572`）
- `META` = 至少一个 span 可见时：
  `<div class="receipt2-meta-row" style="grid-template-columns:1fr 1fr …;">{SPANS}</div>`，
  列数为可见 span 数、每列 `1fr`（`w.map(() => "1fr").join(" ")`）。全部不可见时为空串。**CONFIRMED**（`:554–561`）

**页头三件套（`:489–511`）** —— 每件按配置位置推进 `r`(左) 或 `c`(右) 数组，**同一侧内按
`showOrderNo → showDate → showQrcode` 的固定顺序入队**（即 `metaOrder` 那种拖拽排序**不适用于页头**）：

```html
<div class="receipt2-order" data-r2-el="orderNo">编号：{{orderNo}}</div>
<div class="receipt2-date"  data-r2-el="date">日期：{{date}}</div>
```
二维码二选一（`:479–488`）：
```html
<img class="receipt2-qrcode" data-r2-el="qrcode" src="{{payQrcode}}" alt="收款二维码" />
<div class="receipt2-qrcode receipt2-qrcode-empty" data-r2-el="qrcode"></div>
```
- 判空条件：`typeof payQrcode === "string" && payQrcode.trim() !== ""`。
- **`src` 未做 HTML 转义**（直接拼 `e["payQrcode"]`）。**CONFIRMED**
- 位置配置 `orderNoPosition`/`datePosition`/`qrcodePosition` ∈ {`left`,`right`}，`"left"` 进左侧，**其余一切值都进右侧**。**CONFIRMED**（`:503–511`）

**客户信息 span（`:520–545`）** —— 顺序由 `metaOrder` 决定，默认 `["client","tel","address","productionDays"]`：

```html
<span data-shrink-fit data-r2-el="client">客户：{{client}}</span>
<span data-shrink-fit data-r2-el="tel">电话：{{tel}}</span>
<span data-shrink-fit data-r2-el="address">安装地址：{{order["安装地址"]}}</span>
<span data-r2-el="productionDays">生产天数：{{productionDays}}</span>
```
- **前三者带 `data-shrink-fit`，`productionDays` 不带**。**CONFIRMED**（`:522`/`:528`/`:534` vs `:540`）
- 各自受 `showClient`/`showTel`/`showAddress`/`showProductionDays` 开关门控。**CONFIRMED**（`:546–551`）

**明细行 `ie`（`:441–462`）**：

```html
<tr>
    <td class="cell-multi">{{profile}}</td>
    <td>{{direction}}</td>
    <td>{{color}}</td>
    <td class="cell-multi">{{glass}}</td>
    <td class="cell-multi">{{size}}</td>
    <td>{{quantity}}</td>
    <td>{{price}}</td>
    <td>{{amount}}</td>
    <td class="cell-multi">{{pricing}}</td>
    <td class="cell-multi">{{remark}}</td>
  </tr>
```
- `cell-multi` 列（1/4/5/9/10）用 `oe()`（`<br>`→`\n` + 转义），其余用 `ae()`（只转义）。
- **`data-r2-el` 明细行一个都没有** —— 元素编辑器管不到表格。**CONFIRMED**

**页脚 `Ve`（`:579–601`）**：

```html
<div class="receipt2-amounts" data-r2-el="amounts">
        <span>总额：{{total|2dp}}</span>
        <span>已付：{{deposit|2dp}}</span>
        <span>未付：{{balance|2dp}}</span>
      </div>
<div class="receipt2-declaration" data-r2-el="declaration">{{declaration}}</div>
```
- 金额受 `showAmounts && se("amounts")`，说明受 `showDeclaration && se("declaration")`；两者相互独立。
- `declaration` 用 `oe()`（换行 + 转义）。**CONFIRMED**

---

## 3. `data-shrink-fit` 机制

### 3.1 是什么

**不是「内容放不下就整体缩」的分页降级，而是「这一格文字比格子宽就压低字号」的行内自适应**。
只作用于页头客户信息区的前 3 个 span（客户 / 电话 / 安装地址）。**CONFIRMED**（`:522`,`:528`,`:534`）

### 3.2 收缩算法（`ye` 内的版本，`:779–795`；`pe` 内的预览版，`:857–871` 完全同构）

```
1. el.style.fontSize = ""                 // 先清空内联字号
2. width = el.getBoundingClientRect().width
   若 width <= 0 → 直接跳过（元素不可见）
3. 记下原 overflow，改成 visible          // 让 scrollWidth 反映真实内容宽
4. base = parseFloat(getComputedStyle(el).fontSize)
   floor = Math.max(6, base * 0.5)        // 下限 = max(6px, 原始字号的一半)
5. size = base
   while (el.scrollWidth > width + 1 && size > floor) {
       size -= 0.5
       el.style.fontSize = size + "px"
   }
6. 还原 overflow
```
- **步长 0.5px，上限收缩到原始字号的 50%，且不低于 6px，比较基准是 `scrollWidth > width + 1`。** **CONFIRMED**
- `width` 只在**开头量一次**（清空字号后），循环中不再更新。因为 CSS 给 `.receipt2-meta-row span`
  设了 `overflow:hidden` + `display:flex`，该宽度≈grid 列宽，所以基准稳定。**INTERPRETED**（依据：`:385–386` 的 CSS）
- 触发时机：`ye`（浏览器打印）在图片加载完 + **再等 500ms** 后执行；`pe` 在预览刷新后被父组件手动调用。
- **副作用（真实行为，复刻时注意）**：第 1 步会**抹掉元素配置里设的 `font-size`**
  （`ce()` 可能写进 `style="font-size:Npx"`），且若循环一次都没进，字号会停留在空串。**CONFIRMED**（`:783` vs `:468`）

### 3.3 分页算法（`we`，`:621–720`）

**量测阶段**（`:628–665`）：造一个 `position:absolute;visibility:hidden` 的 `div` 挂到 `body`，
注入 `ue(fonts, print)` + 两条量测用覆盖 CSS：

```css
#r2mp { height: auto !important; overflow: visible !important; }
#r2mf .receipt2-declaration { flex: 0 0 auto !important; min-height: 0 !important; }
```

内部结构（**这段 HTML 不进入最终产物，只为量尺寸**）：
```html
<div class="receipt2-root"><section class="receipt2-page" id="r2mp">{de}</section> …
```
`requestAnimationFrame` 后量出：

| 变量 | 含义 |
|---|---|
| `i` | `#r2mp` 的实际高度（= 内容自然高，因为 `height:auto`） |
| `c` | `#r2mp` 宽度 × (heightMm / widthMm) = **目标页高(px)** |
| `s` | `#r2mf`（页脚包裹）高度 |
| `d` | 各 `<tr>` 高度数组 |
| `V` | `i - Σ(rowH) - s` = 「非明细、非页脚」的固定开销 |
| `u`(availNoFooter) | `c - V` |
| `r`(availWithFooter) | `c - V - s` |

**分页阶段**（`:693–714`）：

```
penalty = (预设是 pin-*-90 ? 1 : 0)
c = max(0, availNoFooter - penalty)      // 无页脚页的行高预算
s = max(0, availWithFooter - penalty)    // 带页脚页的行高预算
pages = [0]; y = 0
while y < rows.length:
    if (剩余所有行高之和 <= s) break     // 整段能连页脚一起塞下 → 收工
    t = 0; l = y
    while l < len && !(l > y && t + rows[l] > c):   // 贪心塞满「无页脚预算」
        t += rows[l]; l++
    if (l <= y) l = y + 1                            // 保证至少前进一行
    if (l >= len && len - y > 1) l = len - 1         // 别把最后一行单独留下
    y = l
    if (y >= len) break
    pages.push(y)
```
- **语义**：中间页按「不带页脚」的高度预算贪心装；只有**最后一页**才带金额/说明页脚。
  若剩余内容连页脚都能装下，就直接收进当前页。**CONFIRMED**
- 页切片：`pages[k] .. (pages[k+1] ?? len)`，`isLast = (end === len)`。**CONFIRMED**（`:716–720`）
- 量测 div 在算完后立即 `removeChild`。**CONFIRMED**（`:663`）
- **行高按「自然高度」量（都按单行/原样式），未考虑 shrink-fit 后的回流** —— 明细行没有 shrink-fit，无影响。

### 3.4 预览侧（`pe`，`:851–876`）

父组件在预览容器上调用 `initColumnResize(container)`：
1. 对容器内所有 `[data-shrink-fit]` 跑 §3.2 的收缩（用 `window.getComputedStyle`）；
2. 移除旧的 `.r2-resize-handle`；
3. 取**第一个** `.receipt2-page`，对它的 `thead th`（跳过最后一列）逐个插一条 6px 宽拖拽条，
   用 mousemove 实时改 `th.style.width`（左右两列联动，各不低于 3%），
   mouseup 时把 10 个百分比写入 `n.value` 并落 localStorage `receipt2_column_widths`。
   **列宽改动会立即改变 `ue()` 生成的 CSS**（因为 `ue` 闭包引用 `n`），重渲后生效。**CONFIRMED**（`:903–939`、`:389–408`）

---

## 4. 数值 / 字符串格式化工具

| 函数 | 行 | 语义 | 备注 |
|---|---|---|---|
| `le(e)` | `:350` | **HTML 转义**：`&`→`&amp;`、`<`→`&lt;`、`>`→`&gt;`、`"`→`&quot;`、`'`→`&#39;` | **不做 String() 包裹**，传非字符串会抛错；调用方都先包了 |
| `oe(e)` | `:356` | **多行文本**：`String(e ?? "")` → `/<br\s*\/?>/gi` 换 `\n` → `\r\n` 换 `\n` → 再 `le()` 转义 | 配 `.cell-multi { white-space: pre-line }` 显示换行 |
| `ae(e)` | `:365` | **单行文本**：`le(String(e ?? ""))` | 只转义，不处理 `<br>` |
| `ne(e)` | `:366` | **两位小数**：`Number(e)` 有限则 `toFixed(2)`，否则字面量 `"0.00"` | `null`/`""`→`0`→`"0.00"`；`undefined`/非数字→`"0.00"`。**永不抛错、永不留空** |

其它相关工具（非格式化，但在渲染链上）：

| 函数 | 行 | 语义 |
|---|---|---|
| `K(v, min, max, dflt)` | `:245` | 数值钳位；非有限则取默认值 |
| `Q(a, b, tol=2)` | `:307` | `Math.abs(a-b) <= tol`（用于打印预设近似匹配） |
| `X(print)` | `:290` | 打印设置清洗：`copies` 1–99、`widthMm`/`heightMm` 50–500；`orientation` 只认 `landscape`/`portrait`，否则按「宽≥高 → landscape」推断 |
| `Z(fonts)` | `:252` | 字号清洗（header 14–36、table 8–18、amount 16–40、meta 8–18、declaration 8–18、orderDate 8–18） |
| `M(cfg)` | `:104` | 元素配置 → 内联 style 串：`display:none` / `position:relative;left:{x}mm;top:{y}mm;z-index:10` / `font-size:{n}px` / `width:{n}mm;max-width:{n}mm`，`;` 连接 |
| `L()` | `:125` | 元素配置默认值：`{offsetXMm:0, offsetYMm:0, fontSize:0, widthMm:0, visible:true}` |
| `ce(name)` | `:463` | 返回 `data-r2-el="{name}"`，配置产出非空 style 时再拼 ` style="{style}"` |
| `se(name)` | `:470` | `!cfg \|\| cfg.visible` —— **默认可见**，只有显式 `visible:false` 才隐藏 |

元素配置持久化在 localStorage `receipt2_element_configs`（`ya`，`Home.formatted.js:2372`），
其余键：`receipt2_font_settings`(sa) / `receipt2_column_widths`(da) / `receipt2_selected_printer`(Va) /
`receipt2_print_settings`(ma) / `receipt2_visibility_settings`(wa) / `receipt2_brand_settings`(ga)。

**可被 `data-r2-el` 命中的 10 个元素**（`x`，`:80–91`）与中文标签（`B`，`:92–103`）：
`orderNo`编号 / `date`日期 / `title`品牌标题 / `qrcode`二维码 / `client`客户 / `tel`电话 /
`address`安装地址 / `productionDays`生产天数 / `amounts`金额 / `declaration`说明。
（这套名字**只用于元素编辑器**，与订单字段名无关。）

---

## 5. CSS 全文说明

**单一发生器 `ue(fonts, print)`（`:371–438`）**，被 `ge`、`ye`、`printFromContainer`、`printSilent`、
以及 `we` 的量测器共用。任务描述里说的「两段 CSS」实为**一个函数内**的：
① 页面样式（`receipt2-*` 类）；② 内嵌的 `@page`（`:414–423`）。**CONFIRMED**

### 5.1 基础

| 选择器 | 声明 | 来源行 |
|---|---|---|
| `*` | `box-sizing: border-box` | `:372` |
| `.receipt2-root` | `color:#000; background:#fff; font-family:"Microsoft YaHei","PingFang SC",sans-serif` | `:372` |
| `.receipt2-page` | `width:{widthMm}mm; height:{heightMm}mm; padding:4mm 4mm 3mm; background:#fff; display:flex; flex-direction:column; overflow:hidden; page-break-after:always` | `:372–376` |
| `.receipt2-page:last-child` | `page-break-after:auto` | `:376` |

### 5.2 页头

| 选择器 | 声明 |
|---|---|
| `.receipt2-header` | `display:grid; grid-template-columns:1fr 2fr 1fr; align-items:start; margin-bottom:2mm; flex-shrink:0` |
| `.receipt2-order` | `font-size:{orderDateFontSize}px; padding-top:1mm` |
| `.receipt2-title` | `text-align:center; font-size:{headerFontSize}px; font-weight:700; letter-spacing:0.5px; line-height:1.05` |
| `.receipt2-header-left` | `display:flex; align-items:flex-start; justify-content:flex-start; gap:2mm` |
| `.receipt2-header-right` | 同上，`justify-content:flex-end` |
| `.receipt2-date` | `font-size:{orderDateFontSize}px; padding-top:1mm; white-space:nowrap` |
| `.receipt2-qrcode` | `width:18mm; height:18mm; object-fit:contain; border:1px solid #bbb` |
| `.receipt2-qrcode-empty` | `border-style:dashed` |

（`:376–385`。二维码尺寸是写死的 18mm×18mm，**不随字号/纸张变化**。）

### 5.3 客户信息行

| 选择器 | 声明 |
|---|---|
| `.receipt2-meta-row` | `display:grid; grid-template-columns:1.2fr 1.5fr 1.7fr 0.8fr; gap:1.5mm; margin-bottom:1.5mm; font-size:{metaFontSize}px; line-height:1.2; flex-shrink:0` |
| `.receipt2-meta-row span` | `overflow:hidden; white-space:nowrap; display:flex; align-items:center` |
| `.receipt2-meta-row span:nth-child(3)` | `padding-left:6mm` |

（`:385–387`）
> **坑**：`grid-template-columns` 的 4 列默认值**会被内联 `1fr 1fr …` 覆盖**（`de` 里按可见数量写死），
> 但 `span:nth-child(3) { padding-left:6mm }` 是**按 DOM 位置**生效的 —— 若 `metaOrder` 换序或
> 前面的项被隐藏，被加左内边距的就是「第 3 个渲染出来的 span」，未必是安装地址。**CONFIRMED**

### 5.4 明细表格

| 选择器 | 声明 |
|---|---|
| `.receipt2-table` | `width:100%; border-collapse:collapse; table-layout:fixed; font-size:{tableFontSize}px; margin-bottom:1.5mm` |
| `.receipt2-table th, td` | `border:1px solid #000; padding:1mm 0.8mm; vertical-align:top; line-height:1.18; word-break:break-all` |
| `.receipt2-table th` | `text-align:center; font-weight:600` |
| `.receipt2-table td` | `text-align:left` |
| `.receipt2-table .cell-multi` | `white-space:pre-line` |
| `.empty-row` | `text-align:center !important; vertical-align:middle !important; color:#666` |

列宽（`n.value`，默认 `[13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5]`，`:11`，
**合计 99.8% 不是 100%**），逐列 `th:nth-child(k), td:nth-child(k) { width:…% }`，其中
**第 2/3/6/7/8 列额外 `text-align:center`**（开向、颜色、数量、单价、金额），其余走默认左对齐。**CONFIRMED**（`:389–408`）

列序与表头文案（`re`，`:439`）：
`型材 | 开向 | 颜色 | 玻璃 | 尺寸 | 数量 | 单价 | 金额 | 计价方式 | 备注`

### 5.5 页脚

| 选择器 | 声明 |
|---|---|
| `.receipt2-amounts` | `display:grid; grid-template-columns:repeat(3,1fr); margin-bottom:1.2mm; color:#d9001b; font-size:{amountFontSize}px; line-height:1; flex-shrink:0` |
| `.receipt2-amounts span` | `white-space:nowrap` |
| `.receipt2-declaration` | `border-top:1px dashed #999; padding-top:1.2mm; white-space:pre-line; line-height:1.16; font-size:{declarationFontSize}px; flex:1; overflow:hidden` |

（`:409–413`。金额是**红色 `#d9001b`**；说明区 `flex:1` 吃掉剩余高度且溢出裁切。）

### 5.6 `@page`（`:414–423`）

```css
@page { size: {landscape ? heightMm : widthMm}mm {landscape ? widthMm : heightMm}mm; margin: 0; }
```
横向时把纸张尺寸**交换**（200×140 → `size: 140mm 200mm`），靠 `@media print` 里的旋转变换把内容转正。

### 5.7 `@media print`（`:424–437`）

```css
html, body { margin:0 !important; padding:0 !important; background:#fff; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
/* ↓ 仅 orientation === "landscape" 时注入 */
.receipt2-root { display:block !important; background:#fff !important; padding:0 !important; gap:0 !important; }
.r2-page-wrap { width:{heightMm}mm !important; height:{widthMm}mm !important; overflow:hidden !important; position:relative !important; page-break-after:always !important; }
.r2-page-wrap:last-child { page-break-after:auto !important; }
.receipt2-page { position:absolute !important; top:0 !important; left:0 !important;
  width:{widthMm}mm !important; height:{heightMm}mm !important;
  transform-origin: top left !important;
  transform: translateY({widthMm}mm) rotate(-90deg) !important;
  box-shadow:none !important; page-break-after:auto !important; }
/* ↑ */
.receipt2-table { border-collapse: collapse !important; }
.receipt2-table th, .receipt2-table td { border:1px solid #000 !important; }
```
> **重要不一致（CONFIRMED）**：`.r2-page-wrap` 这个包裹 div **只有 `printSilent` 会生成**
> （`:1293–1302`，Electron 静默打印，逐页插 wrap）。`ye()`（浏览器打印，`:740`）和
> `printFromContainer`（`:1226`）**都不生成** → 横向打印时旋转规则命中不到任何元素，
> 这两条路径下横向纸型会错位。**是 bug 还是有意（静默打印才是主路径）无法从代码断定**，
> 列入 §7 未确认。

### 5.8 `@media screen`（`:438`）

```css
.receipt2-root { background:#c0c0c0; padding:12mm; display:flex; flex-direction:column; align-items:center; gap:8mm; min-width:fit-content; }
.receipt2-page { position:relative; box-shadow:0 3px 14px rgba(0,0,0,0.28); }
[data-r2-el] { cursor:pointer; transition:outline 0.15s; border-radius:2px; position:relative; z-index:5; }
[data-r2-el]:hover { outline:2px dashed #409eff; outline-offset:1px; z-index:10; }
```
屏幕态是灰底 `#c0c0c0`、页面卡片带阴影、可点击元素 hover 显示蓝色虚线框（元素编辑器的交互提示）。

**CSS 里被插值的量一览**：`widthMm` / `heightMm` / `orientation`（打印设置）、
`headerFontSize` / `tableFontSize` / `amountFontSize` / `metaFontSize` / `declarationFontSize` /
`orderDateFontSize`（字号设置）、`n.value[0..9]`（列宽 ref）。**`ua` 的签名是 `(fonts, print)`，
调用处一律 `ue(字号, X(打印设置))`；但列宽是闭包捕获的 `n`，不从参数传。**

---

## 6. 字段映射表（收据每一格 ↔ 订单/行字段）

### 6.1 订单头（`order`）

| 收据位置 | 读取的键 | 格式器 | 中文来源（旧版 Hui/Progress 生产者侧） |
|---|---|---|---|
| 标题 | `brand`（brandEnabled 时被配置的 `name` 覆盖） | `ae` | `客户信息.品牌`（Hui 拼 `+"收据单"`） |
| 编号 | `orderNo` | `ae` | `回执单号` |
| 日期 | `date` | `ae` | `日期` |
| 二维码 | `payQrcode`（`<img src>`，**未转义**） | — | 上传的收款码 URL |
| 客户 | `client` | `ae` | `客户` |
| 电话 | `tel` | `ae` | `电话` |
| 安装地址 | **`安装地址`（中文键）** | `ae` | `安装地址`（多地址用 `_` join） |
| 生产天数 | `productionDays` | `ae` | `生产天数` |
| 总额 | `total` | `ne` | `总价` |
| 已付 | `deposit` | `ne` | `定金` |
| 未付 | `balance` | `ne` | `截止日期/余额`（生产者算） |
| 说明 | `declaration` | `oe` | `订单备注` 等拼装 |

> ⚠️ **`address` 与 `安装地址` 是两个不同的键**。渲染器**只读 `安装地址`**；
> 生产者侧（`Progress-f4bdef35.js` 的 `customerInfo`）同时写了 `address: 客户.地址` 和 `"安装地址": ""`，
> 即电子回执路径下 `地址` 不进收据、`安装地址` 可能为空。新版 `app/src/utils/receiptBuilder.ts:306-309`
> 把两者都填成 `install_address`（**有意的口径统一，非等价复刻**）。

### 6.2 明细行（`line`）

| 列 | 英文键 | 中文键（Hui 生产者侧） | 格式器 |
|---|---|---|---|
| 1 型材 | `profile` | `型材` | `oe` |
| 2 开向 | `direction` | `开向`（电子回执用**原始开向**；平开拼 `套线种类` 前缀） | `ae` |
| 3 颜色 | `color` | `颜色` | `ae` |
| 4 玻璃 | `glass` | `底玻`+`面玻`+`玻璃厚` | `oe` |
| 5 尺寸 | `size` | `门洞高`/`门洞宽`/`亮窗总高`/`墙厚`/`轨道长` | `oe` |
| 6 数量 | `quantity` | `数量` | `ae` |
| 7 单价 | `price` | `单价`（无价时生产者写 `"/"`） | `ae` |
| 8 金额 | `amount` | `金额` | `ae` |
| 9 计价方式 | `pricing` | `计价方式`（含 `•单价元/方*…=…元` 明细） | `oe` |
| 10 备注 | `remark` | 折价 / 扇数 / 轨道种类 / 五金 / 套线 / 安装地址 / `备注` 的复合列表 | `oe` |

（英文键 **CONFIRMED** 自 `:443–461`；中文键 **INTERPRETED**，来自 `legacy/js/Hui.formatted.js`
的行对象构造（`Let _ = {profile:"",profile2:"",direction:"",openImg:"",price:0,color:"",glass:"",
size:"",quantity:0,amount:0,pricing:"",remark:"",maker:"",doorImg:""}` 后逐字段从中文键赋值），
以及团队既有的 `app/src/utils/receiptBuilder.ts:201-258` 复刻结论。**注意 `Hui.formatted.js`
用的是另一套解码器（偏移不是 246），本次未能逐索引验证 `remark`/`pricing` 对应的中文键名**，
详见 §7。）

**生产者还会写但渲染器完全不用的字段**：`profile2`、`openImg`、`maker`、`doorImg`、`id`、
`imageUrl`、`门洞宽/门洞高/亮窗总高/扇数/轨道长` 等 —— 收据单2 的明细表**不含图片、不含门图**。
**CONFIRMED**（`ie` 只读那 10 个键）

---

## 7. 未确认 / 自相矛盾

1. **`.r2-page-wrap` 只在 `printSilent` 生成**（`:1293–1302`），`ye()`（`:740`，浏览器打印）与
   `printFromContainer`（`:1226`）都不生成 → `@media print` 里那一整块横向旋转 CSS 在后者上是**死代码**。
   无法从代码判断是历史遗留还是「静默打印才是主路径」的有意选择。**需实现方决策。**
2. **`pin-*-90` 的 1px 惩罚量**（`:667–692`）：只减 1px，量级小到像是凑出来的经验值。
   为什么只有 90mm 预设需要、`custom` 为什么落 `default→0`，无注释可依。**INTERPRETED** 为安全余量。
3. **`remark` / `pricing` 的中文键对应**：`Receipt2.deobfuscated.js` 里是权威的
   `e["remark"]` / `e.pricing`，但生产者 `Hui.formatted.js` 用的是**另一套字符串表**（`x(819)`、`x(1113)`），
   本次用 `_0x4407`（偏移 246）无法解出（索引越界 ⇒ 确认是别的解码器，其偏移未在本次定位）。
   目前只能靠 `receiptBuilder.ts` 的既有复刻交叉印证：**未逐字验证**。
4. **`total`/`deposit`/`balance` 在旧版电子回执路径下口径可疑**：
   `Progress-f4bdef35.js` 里写的是 `total: Math.round(Σ金额)`、`deposit: 0`、`balance: Math.round(Σ金额)`
   —— **押金恒为 0 且未付=总额**，与新版 `receiptBuilder.ts`（`balance = total - deposit`）不一致。
   这属于生产者而非渲染器问题，渲染器只是原样显示。**未确认哪个是线上真实行为。**
5. **`de` 里 `ce("qrcode")` 的 `data-r2-el` 会重复**：二维码 `<img>` 与外层 `qrcode` 元素
   —— 实际只出现一次（img 或空 div 二选一），不重复。此条已核实，**非问题**，列出仅为排除。
6. **shrink-fit 抹掉元素配置字号**（`:783`、`:860`）：若用户在元素编辑器里给「客户/电话/安装地址」
   设了字号，只要走 `ye()` 或 `pe()` 就会被清空并按 CSS 基准重算。
   是 bug 还是「收缩功能优先」无法断定，**复刻时建议保留该行为以对齐像素**。
7. **`ge()` 产出的 HTML 由父组件怎么消费**（`onPreviewHtmlChange` → 父组件渲染到哪个容器）
   不在本文件内，本次未追（`app` 侧对应实现为 `useOrderPrint.ts`/`PrintDrawer.vue`）。
   影响的是「预览容器」的定位，不影响本文件的 HTML 结构结论。
