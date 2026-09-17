# 收据单2 · 黄金样本（实跑产出）

由 `/tmp/r2-analysis/make-golden.mjs` 调用 `/tmp/r2-analysis/render-extracted.mjs` 生成。
`render-extracted.mjs` 里的 `ue`/`de`/`re`/`ie`/`me`/`Ve`/`M`/`ce`/`se`/`oe`/`ae`/`ne`/`X`/`Z`/`K`
是从 `Receipt2.deobfuscated.js` **逐字自动抽取**的（`extract-render.mjs`，含括号/字符串/正则感知的扫描器），
**没有任何手抄**。因此下面的空白与换行就是真实产物，可直接做逐字比对基准。

> 抽取器踩过的坑：`le` 里的正则 `/"/g`、`/'/g` 会让朴素的字符串跟踪错位，
> 导致扫描越界把 `ue` 的 CSS 截断在 `.receipt2-table th,` 那个逗号上。
> 现已用「`/` 前面最近非空白字符属 `(,=:[!&|?{};+-*%~^<>` 就当正则」的启发式修正（与 `decode-receipt2.mjs` 同款）。

基线状态：`b = L()`（全零元素配置）、`C = {...g}`（全默认显隐）、`i = {...r}`（品牌关）、`n = [...a]`（默认列宽）。

---

## 1. 合成订单输入

```json
{
  "orderNo": "SO-2026-0917-001",
  "date": "2026-09-17",
  "brand": "金鑫门窗",
  "client": "张伟",
  "tel": "13800138000",
  "安装地址": "广东省佛山市南海区桂城街道 A 座 1801",
  "productionDays": "15",
  "total": 12860.5,
  "deposit": 5000,
  "balance": 7860.5,
  "declaration": "1. 本单为定制产品，下单后 3 日内可改尺寸。\n2. 尾款于安装验收当日结清。\n3. 质保两年，五金件一年。",
  "payQrcode": "https://example.com/qr/pay.png",
  "receipt": [
    {
      "profile": "断桥铝合金 70 系列<br>香槟金",
      "direction": "外开",
      "color": "香槟金",
      "glass": "5+12A+5 双钢化<br>白玻",
      "size": "1200×1500",
      "quantity": 2,
      "price": 1580,
      "amount": 3160,
      "pricing": "按面积计价<br>单价 × 面积 × 系数",
      "remark": "一扇带纱窗<br>纱网为金刚网"
    },
    {
      "profile": "断桥铝合金 60 系列",
      "direction": "推拉 & 提升",
      "color": "深灰 <哑光> \"定制\"",
      "glass": "5+9A+5",
      "size": "2000×2200 & 特殊",
      "quantity": 1,
      "price": 4200.5,
      "amount": 4200.5,
      "pricing": "按樘计价",
      "remark": "含 <五金> \"进口\" 件"
    },
    {
      "profile": "普通铝合金 55 系列",
      "direction": "内开内倒",
      "color": "白色",
      "glass": "单层 5mm",
      "size": "900×1200",
      "quantity": 5,
      "price": 1100,
      "amount": 5500,
      "pricing": "按面积计价\n第二行\n第三行",
      "remark": "普通\n备注两行"
    }
  ]
}
```

覆盖点：
- `receipt[0]` 的 `profile`/`glass`/`pricing`/`remark` 都含 `<br>` → 验证 `oe` 的换行转换
- `receipt[1]` 的 `direction`/`color`/`size`/`remark` 含 `&`、`<`、`>`、`"` → 验证 `ae` 转义；`remark` 是 `oe` 路径
- `receipt[2]` 的 `pricing`/`remark` 用**真实换行符** `\n`（非 `<br>`）→ 验证 `oe` 对 `\r\n` 的归一
- `declaration` 含真实换行 → 验证 `oe`
- `payQrcode` 非空 → 走 `<img>` 分支

---

## 2. 默认配置产出

字号 `Z({})` = `{"headerFontSize":30,"tableFontSize":15,"amountFontSize":20,"metaFontSize":18,"declarationFontSize":15,"orderDateFontSize":13}`

打印 `X({})` = `{"copies":1,"widthMm":200,"heightMm":140,"orientation":"landscape"}`

### 2.1 HTML —— `me(order, order.receipt, true)` 原样

```html
<section class="receipt2-page">
    
    <div class="receipt2-header">
      <div class="receipt2-header-left"><div class="receipt2-order" data-r2-el="orderNo">编号：SO-2026-0917-001</div></div>
      <div class="receipt2-title" data-r2-el="title">金鑫门窗</div>
      <div class="receipt2-header-right"><div class="receipt2-date" data-r2-el="date">日期：2026-09-17</div><img class="receipt2-qrcode" data-r2-el="qrcode" src="https://example.com/qr/pay.png" alt="收款二维码" /></div>
    </div>
    <div class="receipt2-meta-row" style="grid-template-columns:1fr 1fr 1fr 1fr;"><span data-shrink-fit data-r2-el="client">客户：张伟</span><span data-shrink-fit data-r2-el="tel">电话：13800138000</span><span data-shrink-fit data-r2-el="address">安装地址：广东省佛山市南海区桂城街道 A 座 1801</span><span data-r2-el="productionDays">生产天数：15</span></div>
    <table class="receipt2-table">
      <thead><tr><th>型材</th><th>开向</th><th>颜色</th><th>玻璃</th><th>尺寸</th><th>数量</th><th>单价</th><th>金额</th><th>计价方式</th><th>备注</th></tr></thead>
      <tbody><tr>
    <td class="cell-multi">断桥铝合金 70 系列
香槟金</td>
    <td>外开</td>
    <td>香槟金</td>
    <td class="cell-multi">5+12A+5 双钢化
白玻</td>
    <td class="cell-multi">1200×1500</td>
    <td>2</td>
    <td>1580</td>
    <td>3160</td>
    <td class="cell-multi">按面积计价
单价 × 面积 × 系数</td>
    <td class="cell-multi">一扇带纱窗
纱网为金刚网</td>
  </tr><tr>
    <td class="cell-multi">断桥铝合金 60 系列</td>
    <td>推拉 &amp; 提升</td>
    <td>深灰 &lt;哑光&gt; &quot;定制&quot;</td>
    <td class="cell-multi">5+9A+5</td>
    <td class="cell-multi">2000×2200 &amp; 特殊</td>
    <td>1</td>
    <td>4200.5</td>
    <td>4200.5</td>
    <td class="cell-multi">按樘计价</td>
    <td class="cell-multi">含 &lt;五金&gt; &quot;进口&quot; 件</td>
  </tr><tr>
    <td class="cell-multi">普通铝合金 55 系列</td>
    <td>内开内倒</td>
    <td>白色</td>
    <td class="cell-multi">单层 5mm</td>
    <td class="cell-multi">900×1200</td>
    <td>5</td>
    <td>1100</td>
    <td>5500</td>
    <td class="cell-multi">按面积计价
第二行
第三行</td>
    <td class="cell-multi">普通
备注两行</td>
  </tr></tbody>
    </table>
    <div class="receipt2-amounts" data-r2-el="amounts">
        <span>总额：12860.50</span>
        <span>已付：5000.00</span>
        <span>未付：7860.50</span>
      </div><div class="receipt2-declaration" data-r2-el="declaration">1. 本单为定制产品，下单后 3 日内可改尺寸。
2. 尾款于安装验收当日结清。
3. 质保两年，五金件一年。</div>
  </section>
```

### 2.2 CSS —— `ue(Z({}), X({}))` 原样

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

---

## 3. 非默认配置产出

输入（按你的清单）：字号 header 20 / table 10 / amount 24 / meta 12 / declaration 11 / orderDate 9；
纸型 `{copies:2, widthMm:210, heightMm:297, orientation:"portrait"}`；列宽全 10；
关 `showQrcode`/`showDeclaration`；`metaOrder: ["address","client"]`；品牌 `{enabled:true, name:"测试门窗厂"}`；
`client` 元素配置 `{offsetXMm:5, offsetYMm:-2, fontSize:14, widthMm:40, visible:true}`。

清洗后字号 `Z(...)` = `{"headerFontSize":20,"tableFontSize":10,"amountFontSize":24,"metaFontSize":12,"declarationFontSize":11,"orderDateFontSize":9}`

清洗后打印 `X(...)` = `{"copies":2,"widthMm":210,"heightMm":297,"orientation":"portrait"}`

⚠️ **`metaOrder` 经 `te()` 归一化后不是 `["address","client"]`**，而是 `["address","client","tel","productionDays"]`
（缺失的 `tel`/`productionDays` 被自动补到尾部 —— 见 01 文档 §3.2）。

⚠️ **因此 meta 行仍是 4 列，不是 2 列**：内联 `grid-template-columns` 实测为 
`1fr 1fr 1fr 1fr`（列数 = **实际渲染的 span 数**，而 `te()` 把被删的项又补了回来）。
只有同时关掉 `showTel`/`showProductionDays` 列数才会降到 2 —— 详见 §5.4。

### 3.1 HTML

```html
<section class="receipt2-page">
    
    <div class="receipt2-header">
      <div class="receipt2-header-left"><div class="receipt2-order" data-r2-el="orderNo">编号：SO-2026-0917-001</div></div>
      <div class="receipt2-title" data-r2-el="title">测试门窗厂</div>
      <div class="receipt2-header-right"><div class="receipt2-date" data-r2-el="date">日期：2026-09-17</div></div>
    </div>
    <div class="receipt2-meta-row" style="grid-template-columns:1fr 1fr 1fr 1fr;"><span data-shrink-fit data-r2-el="address">安装地址：广东省佛山市南海区桂城街道 A 座 1801</span><span data-shrink-fit data-r2-el="client" style="position:relative;left:5mm;top:-2mm;z-index:10;font-size:14px;width:40mm;max-width:40mm">客户：张伟</span><span data-shrink-fit data-r2-el="tel">电话：13800138000</span><span data-r2-el="productionDays">生产天数：15</span></div>
    <table class="receipt2-table">
      <thead><tr><th>型材</th><th>开向</th><th>颜色</th><th>玻璃</th><th>尺寸</th><th>数量</th><th>单价</th><th>金额</th><th>计价方式</th><th>备注</th></tr></thead>
      <tbody><tr>
    <td class="cell-multi">断桥铝合金 70 系列
香槟金</td>
    <td>外开</td>
    <td>香槟金</td>
    <td class="cell-multi">5+12A+5 双钢化
白玻</td>
    <td class="cell-multi">1200×1500</td>
    <td>2</td>
    <td>1580</td>
    <td>3160</td>
    <td class="cell-multi">按面积计价
单价 × 面积 × 系数</td>
    <td class="cell-multi">一扇带纱窗
纱网为金刚网</td>
  </tr><tr>
    <td class="cell-multi">断桥铝合金 60 系列</td>
    <td>推拉 &amp; 提升</td>
    <td>深灰 &lt;哑光&gt; &quot;定制&quot;</td>
    <td class="cell-multi">5+9A+5</td>
    <td class="cell-multi">2000×2200 &amp; 特殊</td>
    <td>1</td>
    <td>4200.5</td>
    <td>4200.5</td>
    <td class="cell-multi">按樘计价</td>
    <td class="cell-multi">含 &lt;五金&gt; &quot;进口&quot; 件</td>
  </tr><tr>
    <td class="cell-multi">普通铝合金 55 系列</td>
    <td>内开内倒</td>
    <td>白色</td>
    <td class="cell-multi">单层 5mm</td>
    <td class="cell-multi">900×1200</td>
    <td>5</td>
    <td>1100</td>
    <td>5500</td>
    <td class="cell-multi">按面积计价
第二行
第三行</td>
    <td class="cell-multi">普通
备注两行</td>
  </tr></tbody>
    </table>
    <div class="receipt2-amounts" data-r2-el="amounts">
        <span>总额：12860.50</span>
        <span>已付：5000.00</span>
        <span>未付：7860.50</span>
      </div>
  </section>
```

### 3.2 CSS

```css

  * { box-sizing: border-box; }
  .receipt2-root { color: #000; background: #fff; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
  .receipt2-page {
    width: 210mm; height: 297mm;
    padding: 4mm 4mm 3mm; background: #fff;
    display: flex; flex-direction: column; overflow: hidden;
    page-break-after: always;
  }
  .receipt2-page:last-child { page-break-after: auto; }
  .receipt2-header {
    display: grid; grid-template-columns: 1fr 2fr 1fr;
    align-items: start; margin-bottom: 2mm; flex-shrink: 0;
  }
  .receipt2-order { font-size: 9px; padding-top: 1mm; }
  .receipt2-title { text-align: center; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.05; }
  .receipt2-header-left { display: flex; align-items: flex-start; justify-content: flex-start; gap: 2mm; }
  .receipt2-header-right { display: flex; align-items: flex-start; justify-content: flex-end; gap: 2mm; }
  .receipt2-date { font-size: 9px; padding-top: 1mm; white-space: nowrap; }
  .receipt2-qrcode { width: 18mm; height: 18mm; object-fit: contain; border: 1px solid #bbb; }
  .receipt2-qrcode-empty { border-style: dashed; }
  .receipt2-meta-row {
    display: grid; grid-template-columns: 1.2fr 1.5fr 1.7fr 0.8fr;
    gap: 1.5mm; margin-bottom: 1.5mm; font-size: 12px; line-height: 1.2; flex-shrink: 0;
  }
  .receipt2-meta-row span { overflow: hidden; white-space: nowrap; display: flex; align-items: center; }
  .receipt2-meta-row span:nth-child(3) { padding-left: 6mm; }
  .receipt2-table {
    width: 100%; border-collapse: collapse; table-layout: fixed;
    font-size: 10px; margin-bottom: 1.5mm;
  }
  .receipt2-table th, .receipt2-table td {
    border: 1px solid #000; padding: 1mm 0.8mm;
    vertical-align: top; line-height: 1.18; word-break: break-all;
  }
  .receipt2-table th { text-align: center; font-weight: 600; }
  .receipt2-table td { text-align: left; }
  .receipt2-table .cell-multi { white-space: pre-line; }
  .receipt2-table th:nth-child(1), .receipt2-table td:nth-child(1) { width: 10%; }
  .receipt2-table th:nth-child(2), .receipt2-table td:nth-child(2) { width: 10%; text-align: center; }
  .receipt2-table th:nth-child(3), .receipt2-table td:nth-child(3) { width: 10%; text-align: center; }
  .receipt2-table th:nth-child(4), .receipt2-table td:nth-child(4) { width: 10%; }
  .receipt2-table th:nth-child(5), .receipt2-table td:nth-child(5) { width: 10%; }
  .receipt2-table th:nth-child(6), .receipt2-table td:nth-child(6) { width: 10%; text-align: center; }
  .receipt2-table th:nth-child(7), .receipt2-table td:nth-child(7) { width: 10%; text-align: center; }
  .receipt2-table th:nth-child(8), .receipt2-table td:nth-child(8) { width: 10%; text-align: center; }
  .receipt2-table th:nth-child(9), .receipt2-table td:nth-child(9) { width: 10%; }
  .receipt2-table th:nth-child(10), .receipt2-table td:nth-child(10) { width: 10%; }
  .empty-row { text-align: center !important; vertical-align: middle !important; color: #666; }
  .receipt2-amounts {
    display: grid; grid-template-columns: repeat(3, 1fr);
    margin-bottom: 1.2mm; color: #d9001b; font-size: 24px; line-height: 1; flex-shrink: 0;
  }
  .receipt2-amounts span { white-space: nowrap; }
  .receipt2-declaration {
    border-top: 1px dashed #999; padding-top: 1.2mm;
    white-space: pre-line; line-height: 1.16; font-size: 11px; flex: 1; overflow: hidden;
  }
  @page { size: 210mm 297mm; margin: 0; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    
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

---

## 4. `@page` 与 `@media print` 横向旋转块（横向 vs 纵向各跑一次）

同一份 `ue(fonts, print)`，只改 `print.orientation`（尺寸固定 200×140，仅换方向字段），
看 `@page` 与 `@media print` 是否变化。

### 4.1 `orientation:"landscape"` 的 `@page`

```css
@page { size: 140mm 200mm; margin: 0; }
```

### 4.2 `orientation:"portrait"` 的 `@page`

```css
@page { size: 200mm 140mm; margin: 0; }
```

### 4.3 `orientation:"landscape"` 的 `@media print` 全文

```css
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
```

### 4.4 `orientation:"portrait"` 的 `@media print` 全文

```css
@media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    
    .receipt2-table { border-collapse: collapse !important; }
    .receipt2-table th, .receipt2-table td { border: 1px solid #000 !important; }
  }
```

长度对比：landscape 的 `@media print` = 991 字符，portrait = 324 字符。
横向旋转块（`.r2-page-wrap` / `transform: ... rotate(-90deg)`）在 landscape 下**存在**，在 portrait 下 **不存在**。

---

## 5. 逐条核对：产出 vs `02-render-pipeline.md`

### 5.1 一致（逐条已用实测产物核对）

| 02 的说法 | 实测 | 结论 |
|---|---|---|
| `me`: `<section class="receipt2-page">\n    {DE}` —— 页首有**一行 4 空格空行** | 产出 `...receipt2-page">\n    \n    <div class="receipt2-header">` | ✅ 一致 |
| `me`: `</table>\n    {FOOTER}\n  </section>` | 产出 `</table>\n    <div class="receipt2-amounts"...` / 无页脚时 `</table>\n    \n  </section>` | ✅ 一致 |
| 空明细 → `<tr><td colspan="10" class="empty-row">暂无明细</td></tr>` | 完全一致 | ✅ 一致 |
| `de`: `\n    <div class="receipt2-header">\n      {LEFT}\n      <div class="receipt2-title" {CE:title}>{TITLE}</div>\n      {RIGHT}\n    </div>\n    {META}` | 逐字一致 | ✅ 一致 |
| `LEFT`/`RIGHT` 为空时字面量 `<div></div>` | 页头三件套全关 → `<div></div>` ×2 | ✅ 一致 |
| `META` 全不可见时为空串 | 四个 meta 开关全关 → `</div>\n    \n    <table` | ✅ 一致 |
| `grid-template-columns:1fr 1fr …` 列数 = 可见 span 数 | 默认 4 项 → `1fr 1fr 1fr 1fr;` | ✅ 一致 |
| 页头同侧内固定顺序 `orderNo → date → qrcode` | 右侧产出 `date` 在前、`qrcode` 在后 | ✅ 一致 |
| 二维码二选一：`typeof payQrcode === "string" && payQrcode.trim() !== ""` | `payQrcode:"   "`（纯空白）→ 走**空 div** 分支 | ✅ 一致 |
| `<img class="receipt2-qrcode" data-r2-el="qrcode" src="..." alt="收款二维码" />` | 逐字一致 | ✅ 一致 |
| 前三个 meta span 带 `data-shrink-fit`，`productionDays` 不带 | 逐字一致 | ✅ 一致 |
| `TITLE` = 品牌开且有名字 ? 品牌名 : (`order.brand` \|\| `"收据单2"`) | 品牌关 + `order.brand` 有值 → 品牌名；品牌关且无 `brand` → `收据单2`；品牌开 → `测试门窗厂` | ✅ 一致 |
| `ie` 行模板（含各 `\n    <td` 缩进与结尾 `\n  </tr>`） | 逐字一致 | ✅ 一致 |
| `cell-multi` 列为 1/4/5/9/10，用 `oe()`；其余用 `ae()` | `profile`/`glass`/`size`/`pricing`/`remark` 的 `<br>` → 真实换行，且 `&`/`<`/`>`/`"` 被转义；`direction`/`color` 的 `<br>` **不**转换只转义 | ✅ 一致 |
| 明细行**没有** `data-r2-el` | 产出中确认没有 | ✅ 一致 |
| `declaration` 用 `oe()` | 真实 `\n` 保留 | ✅ 一致 |
| `@page` 横向交换尺寸（200×140 → `140mm 200mm`） | 横向 `size: 140mm 200mm`；纵向 `size: 200mm 140mm` | ✅ 一致 |
| `@media print` 旋转块仅在 `orientation === "landscape"` 注入 | 见 §4.3/§4.4 | ✅ 一致 |
| `ue` 签名 `(fonts, print)`，列宽走闭包 `n` 而非参数 | 实证：改 `n.value` 立刻反映到 CSS，改参数不影响列宽 | ✅ 一致 |

### 5.2 与 `02-render-pipeline.md` **不一致**的地方

**唯一一处（排版层面，非逻辑层面）：`Ve()` 里「金额块」与「说明块」之间没有换行。**

02 的 §2 / §2.1 fenced 块把两者画成了两行：

```html
      </div>
<div class="receipt2-declaration" data-r2-el="declaration">{{declaration}}</div>
```

实测产物是**紧贴**的，`</div>` 与 `<div class="receipt2-declaration"` 之间**没有换行符**：

```html
      </div><div class="receipt2-declaration" data-r2-el="declaration">X</div>
```

原因：`Ve` 是两个三元表达式用 `+` 直接拼接（`:583–600`），前一段以 `</div>` 结尾不带 `\n`，
后一段以 `<div class="receipt2-declaration"` 开头。**做逐字比对时以本样本为准**，
02 那一处只是示意排版，不影响 DOM 结构与观感（两者都是块级元素）。

### 5.3 复核 `02` §7 未确认第 1 条

02 §7.1 断言：`@media print` 的横向旋转块在 `ye()`（浏览器打印）路径上是**死代码**，
因为 `.r2-page-wrap` 只有 `printSilent` 会生成，而旋转规则「命中不到任何元素」。

本次实测**证实了前半句、但后半句的选择器事实有偏差**：

- ✅ 旋转 CSS **只在 landscape 下注入**（§4.3 vs §4.4，portrait 下整块不存在）。
- ⚠️ 但 `@media print` 在 landscape 下产出的是**四条并列的顶层规则**：
  `.receipt2-root`、`.r2-page-wrap`、`.r2-page-wrap:last-child`、`.receipt2-page`。
  最后一条**不带 `.r2-page-wrap` 前缀**，`transform: translateY(200mm) rotate(-90deg) !important`
  是直接挂在 `.receipt2-page` 上的。

**推论（INTERPRETED，非实测）**：因此在 `ye()` 路径下，`.r2-page-wrap` 两条规则确实落空，
但 `.receipt2-page` 的 `position:absolute` / `width` / `height` / `transform` **仍会命中**，
内容照样被转 -90°；`@page` 也已交换成 `140mm 200mm`，几何上恰好对得上（旋转后占位 140×200）。
真正丢掉的更像是 **`.r2-page-wrap` 提供的 `overflow:hidden` 裁切与 
`page-break-after: always` 分页**（`.receipt2-page` 自己带的是 `page-break-after: auto !important`），
即多页横向打印可能分页/裁切异常，而**不是**「完全不旋转」。

**建议 02 的作者复核并更正措辞**：不是「旋转规则命中不到任何元素（死代码）」，
而是「wrap 专属的两条规则落空，旋转本身仍生效」。

边界声明：我能证明的只是 **CSS 文本与选择器形状**（§4.3 原文可逐字复核）；
上面关于 `ye()` 实际排版后果的部分是**推断**，本环境无浏览器无法实证。
`ye()` 是否真的不生成 wrap 属 02 的取证范围，我未独立验证，仅采信其结论作为前提。

### 5.4 `grid-template-columns` 列数 & `.receipt2-meta-row span:nth-child(3)` 的坑（实测坐实）

`ue()` 里有一条**按 DOM 位置生效**的规则（`:387`）：

```css
.receipt2-meta-row span:nth-child(3) { padding-left: 6mm; }
```

它选的是**第 3 个渲染出来的 span**，与元素身份无关。实测五种配置：

| 配置 | 实际渲染的 span 顺序 | 列数 | 内联 `grid-template-columns` | `nth-child(3)` 落在谁身上 |
|---|---|---|---|---|
| 默认 `C = {...g}` | `client, tel, address, productionDays` | 4 | `1fr 1fr 1fr 1fr` | **`address`（安装地址）** |
| `metaOrder` 改成 address 优先（经 `te` 补全） | `address, client, tel, productionDays` | 4 | `1fr 1fr 1fr 1fr` | **`tel`（电话）** |
| 关 `showTel` | `client, address, productionDays` | 3 | `1fr 1fr 1fr` | **`productionDays`（生产天数）** |
| 关 `showClient` | `tel, address, productionDays` | 3 | `1fr 1fr 1fr` | **`productionDays`（生产天数）** |
| 只留 `client` | `client` | 1 | `1fr` | 规则**落空**（无第 3 个 span） |

**结论（CONFIRMED）**：02 标的这个坑是真的，而且比「按 DOM 位置生效」更严重 ——
**拖拽排序 `metaOrder` 或开关任一 `showXxx` 都会把这 6mm 缩进挪到另一个字段上**。
默认配置下它恰好落在「安装地址」上，这正是设计意图（地址最长、需要缩进避让），
但**没有任何东西把它绑在 `address` 上**。

**新版实现建议**：不要复刻 `nth-child(3)`，改成给 `address` 一个类（如 `.r2-meta-address`）
并挂 `padding-left: 6mm`。否则排序 / 开关一动，视觉就漂。
若要与旧版**逐像素**对齐，则必须复刻 `nth-child(3)` 的语义（含「不足 3 个 span 时不生效」）。

另一个附带实测：`.receipt2-meta-row` 的**类规则**写死了 4 列 `1.2fr 1.5fr 1.7fr 0.8fr`（`:385`），
但每个 meta 行都有**内联** `grid-template-columns`，内联优先 —— 所以类规则那 4 个非等宽比例
在任何含 meta 行的页面上都是**死声明**（只有内联缺失时才生效）。

---

## 6. 黄金样本怎么用（新版回归建议）

目标：把「新旧产出逐字节相等」变成一个**能在 CI 里跑**的断言，而不是靠人眼看预览。

### 6.1 落地成夹具

建议路径（与仓库现有 `app/src/` 结构一致）：

```text
app/src/__fixtures__/receipt2/
  order.default.json          # §1 的合成订单（含 receipt 明细）
  config.default.json         # 字号/纸型/列宽/显隐/品牌 = 全默认
  config.custom.json          # §3 的非默认配置
  expected.default.html       # §2.1 原样
  expected.default.css        # §2.2 原样
  expected.custom.html        # §3.1 原样
  expected.custom.css         # §3.2 原样
```

直接用本文件的 fenced block 落地即可 —— 它们就是真实函数返回值，未做任何美化。
**注意保留行尾与空白**：`me()` 的产物里有 `\n    \n` 这种「只有 4 个空格的行」，
是真实输出的一部分（见 §2.1 第 2 行），编辑器/格式化工具很容易把它删掉。
落地后建议跑一次 `git diff --stat` 确认没有尾随空白被剥离。

### 6.2 断言方式

新实现应暴露两个**纯函数**（不要只暴露拼好整页的接口），签名对齐旧版：

```ts
buildPageCss(fonts: FontSettings, print: PrintSettings, columnWidths: number[]): string
buildPageHtml(order: Order, rows: ReceiptLine[], opts: { withFooter: boolean }): string
```

然后：

```ts
expect(buildPageCss(cfg.fonts, cfg.print, cfg.columnWidths)).toBe(readFixture('expected.default.css'))
expect(buildPageHtml(order, order.receipt, { withFooter: true })).toBe(readFixture('expected.default.html'))
```

**逐字节 `toBe`，不要用 snapshot、不要 normalize 空白**。
旧版产物是字符串拼接的确定输出，没有任何随机性或时间戳，可以做到完全确定。

### 6.3 重点覆盖的边界（本样本已含，回归时别丢）

- `<br>` → 真实换行（`oe`）vs 只转义不换行（`ae`）—— 用 `receipt[0]` 与 `receipt[1]` 覆盖
- `&`/`<`/`>`/`"` 的转义 —— `receipt[1]` 的 `color`/`remark` 覆盖四种字符
- 真实 `\n` 透传（`receipt[2]` 的 `pricing`/`remark`）—— 别把它和 `<br>` 混为一谈
- 空明细 → `暂无明细` 占位行
- `withFooter=false` → `</table>\n    \n  </section>` 的尾随空行
- 页头三件套全关 → `<div></div>` 占位
- meta 全关 → 整块为空串
- 二维码空/有两条分支（`payQrcode` 为 `""` / `"   "` / 有值）
- 元素配置：无配置（无 style 属性）vs 有配置（`data-r2-el="client" style="..."`）

### 6.4 建议额外补的夹具（本样本未覆盖，但值得锁住）

- **横向 vs 纵向**各一份 CSS 夹具（§4.3/§4.4 已给全文）—— 横向那份含旋转块，纵向不含
- **多页**：`we()` 的分页结果（需要 DOM 量测，本环境跑不了）—— 建议在浏览器/`jsdom` 里补
- **`nth-child(3)` 的坑**（§5.4）：至少给「默认」与「address 优先」两份 meta 行夹具，
  否则新版很容易把这 6mm 钉死在 `address` 上，从而与旧版在排序后**不一致**

### 6.5 重要提醒：夹具锁的是「旧版行为」，不是「正确行为」

本样本忠实记录了旧版的若干**已知缺陷**（见 01 文档 §3.2 的 `metaOrder` 不去重、
§5.4 的 6mm 缩进漂移、以及横向打印在 `ye()` 路径下的错位风险）。
做逐字节 diff 时，**先决定哪些缺陷要保留、哪些要修**：

- **保留** → 夹具就是验收标准，diff 必须为空。
- **要修** → 别直接改夹具「让它过」；应在夹具文件里写明偏离点与理由，
  并让测试显式断言「此处与旧版有意不同」，否则以后没人分得清是 bug 还是有意为之。

这条与你之前记录在案的「点击传图不加名字字幕带 = 有意偏离」是同一个原则：
**偏离要有据可查，不要静默漂移**。