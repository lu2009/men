# 打印字体：谁控制、原版怎么做的、待定项（2026-09-16）

> 起因：用户发现「模板预览里所有单据的单元格是上对齐，原版是上下居中」，顺藤摸出一串打印链路的问题。
> 本文记录该轮已修的三件事、字体控制链的实证、以及**原版字体自定义的真实机制**。
> 末尾「待定」是用户 2026-09-16 决定「先记下、暂不做」的部分。

## 1. 本轮已修（都在预览/实打链路，用户未反馈回归）

| 提交 | 问题 | 修法 |
|---|---|---|
| `dcc13359` | 预览里单元格**上对齐**（原版/实打是上下居中） | 删掉 `.production-host :deep(td){…}` 那几条**我们自己的覆盖**。它的特异性 (0,2,1) 高于 hiprint `print-lock.css` 里 `.hiprint-printElement-tableTarget td` 的 (0,1,1)，把 `vertical-align: middle` 盖成了 `top` |
| `3560bf6e` → `bafc3b66` | **实打 iframe 里一个样式表都没有** | 照原版在 `index.html` 加 `<link rel="stylesheet" type="text/css" media="print" href="/print-lock.css">`（文件放 `app/public/`）。hiprint 的 `hiwprint` 只认这个选择器（`print2` 云打印没有它还直接 throw） |
| `bafc3b66` | **实打是白纸**（iframe 里 `table` 数 = 0） | `printByJson` 补 `await tpl.update(cfg)`。`renderByJson` 一直有这一步、注释也写了「否则 getHtml 拿不到内容」，打印这条路漏了 |

修后实测（生产单）：实打 iframe 里 `link` 数 2、`table` 数 1，td 计算样式
`vertical-align=middle / padding=0 5.33px` —— **与预览完全一致**。

> ✅ **2026-09-16 用户实机确认：实打正常出纸**（不再空白）。上面那条「实打是白纸」的修复
> 原先只在 headless 里验到「纸进 iframe、样式对上」这一步，现已闭环。

> ⚠️ 中途把 `app/index.html` 的注释写成了嵌套注释（把原版那句 `<!-- 正确写法 -->` 原样抄进注释体），
> 导致 Vite 解析 HTML 失败、页面打不开。已重写该文件。**往 HTML 注释里抄含注释标记的原文要当心。**

## 2. 字体控制链（实证）

**谁控制**：模板 JSON 的表级选项 → hiprint 写成**内联样式**打在元素上。

| 控制项 | 来源（模板 JSON） | 实测 |
|---|---|---|
| 表格字号 | `table.options.fontSize` | product 内联 `font-size:13.5pt` → 计算 18px |
| 行高 | `options.lineHeight` | 内联 `line-height:22.25pt` |
| 字体族 | `options.fontFamily` | glassHole 写了 `"Microsoft YaHei"` → 计算值即它 |
| 表头字号/加粗 | `tableHeaderFontSize` / `tableHeaderFontWeight` | 只有 glassHole 写了 bold；其余靠 `print-lock.css` 的 `thead{font-weight:700}` 兜底 |
| 列级 | `columns[].fontSize/fontFamily/align/vAlign` | **17 个模板一个列都没设** → 全部继承表级 |
| 非表格元素 | 各自的 `fontSize` | 如标题「生产单」=13.5 |

**`fontFamily` 缺失时的坑**：hiprint 的选项类 `jn.prototype.css` 写的是

```js
if (e) return t.css("font-family", e), "font-family:" + e
t[0].style.fontFamily = "inherit"        // ← 没值就写死内联 "inherit"
```

即**模板没写 `fontFamily` ⇒ 元素上多一条内联 `font-family: inherit`**。
`inherit` 是关键字不是字体名，于是元素去取**父元素的计算值**；而内联声明赢过样式表，
所以 `print-lock.css` 里那条 `.hiprint-printElement-table{font-family:'SimSun'}` **一直被压着、从没生效**。

**实测（同一元素，清掉内联前后）**：

```
内联在时   计算值 = v-sans, system-ui, …   （= 父元素值，即 naive-ui 的 UI 字体栈）
★ 清掉内联 计算值 = SimSun                 （print-lock.css 那条规则立刻接管）
```

⇒ 目前 **16/17 个模板没写 `fontFamily`**，于是：

- **预览**：父链一路到页面 body → naive-ui 的 `v-sans`
- **实打**：父链一路到 iframe 的 body → 浏览器默认字体（macOS 实测 `PingFang SC`）

macOS 上两者实际落到同一系统字体、看不出差别；**Windows 上实打会落到浏览器默认（衬线），预览是 system-ui** —— 那才是真差异。

## 3. 原版是怎么做字体自定义的

**分两条完全不同的路，不要混。**

### ① hiprint 那 17 张模板 —— 原版**根本没有改字体的入口**

三处都查空：

| 找什么 | 结果 |
|---|---|
| 模板设计器路由 | 无（路由只有 login/home/hui/Diao/clients_Info/setting/Qrscanner/Progress/drawDoor/test-addprice/3d-view/…） |
| 保存模板类接口调用（`saveTemplate`/`updateTemplate`/`savePrintTemplate`） | 无（`vue-ade658be.js` 里的 `setTemplate` 是 hiprint 内部 API） |
| Home 里「模板管理/打印模板/模板设置/模板编辑」 | 四个词一个都没有 |

⇒ 那 17 张是在**别处（hiprint 设计器）改好再传到服务端**的，旧版 app 只读不写。
所以它们里 16 张没有 `fontFamily` **不是功能没做，是当年就没设过**。

### ② 「收据单2」—— 原版真正能自定义字体的地方

Home 页在 `ic.value === 12`（收据单2）时出现三个按钮：**打印 / 字体调节 / 编辑收据单**。

```js
12 == ic.value ? <button onClick={_i}> 打印 </button>      : null
12 == ic.value ? <button onClick={vi}> 字体调节 </button>   : null
12 != ic.value ? null : <button onClick={Ri}> 编辑收据单 </button>

vi = () => Xn.value[<method>]()      // 拿不到就报「收据单2组件未就绪」
_i = () => Xn.value.printFromContainer(ao.value)
Ri = contentEditable 就地改文字（不是编辑模板）
```

> ⚠️ **【2026-09-17 更正】下面这段模型是错的 —— 它属于「合格标签」，不是「收据单2」。**
> 逐字核实：`globalFont` / `fontFamily` / `fontColor` / `fontWeight` / `lineHeight` / `paddingMm` /
> `tableConfig` 在收据单2 组件里**出现次数全部为 0**。那套带 `paper:{…,paddingMm:2}`、
> `globalFont`、`fields[]` 的配置来自 `LabelPrintManager`（合格标签，纸型 70×90 —— 正是本文
> 那句「标签是 70×90」的来源）。当年把两个组件记混了。
> 收据单2 的真实模型见 `docs/2026-09-17-receipt2-analysis.md`。以下原文保留只为留痕。

**「字体调节」调的是一套完整配置**（❌ 实为合格标签的模型）：

```js
{
  paper:       { widthMm, heightMm, orientation, paddingMm },     // 标签是 70×90
  globalFont:  { fontFamily, fontSize, fontWeight, lineHeight },  // ←「统一字体」：一键改全部字段
  fields:      [{ key,label,x,y,width, fontSize, fontFamily,
                  fontColor, fontWeight, wrap, lineHeight }],      // ← 逐字段字体（表格那列「字体」）
  tableConfig: { tableFontSize, rowHeight, columns:[{key,label,visible,width}] },
}
```

字号分五类，各带范围（❌ 实为**六类**，漏了 `metaFontSize` 基础信息字体）：

```
标题字体 headerFontSize 14–36 ｜ 表格字体 tableFontSize 8–18 ｜ 金额字体 amountFontSize 16–40
说明字体 declarationFontSize 8–18 ｜ 编号日期字体 orderDateFontSize 8–18
```

### ③ 关键结论：收据单2 **不是** hiprint 模板

它不在我们导入的 17 张里（17 = FinalReceipt/ReceiptList/glass/glassHole/lable/product/product1/product10/product2..9/receipt），
而是旧版 Home 页里的另一个**自绘组件**（能复制成 PNG 到剪贴板、直接送打印机）。**新版还没做这张单据。**

## 4. 待定（用户 2026-09-16：「这块先记下」）

两条路，都**还没动手**：

1. **给现有 17 张补 `fontFamily`**（一次性）—— 原版没这功能，属**新增**。后端有写入口
   `POST /api/v1/print-templates/import`，可写脚本批量补。要不要做、用什么字体栈（建议
   `Microsoft YaHei, PingFang SC, sans-serif`，与 glassHole 已有的选择对齐且带兜底）待定。
2. **做「收据单2」这张自绘单据**（含它的「字体调节」）—— 那是原版字体自定义的正主，
   但要先做单据本体，工作量大，需单独排期。

在此之前，字体维持现状：macOS 上预览/实打实际一致，Windows 上实打会落到浏览器默认字体。
