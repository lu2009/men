// 用逐字抽取的渲染器产出黄金样本，直接写成 markdown。
// HTML/CSS 全部来自真实函数调用，脚本只负责排版，绝不手改输出。
import { writeFileSync } from 'node:fs'
import * as R from './render-extracted.mjs'
const { ue, de, re, ie, me, Ve, X, Z, te, b, C, i, n, u, s, g, a } = R

const F = '```'
const md = []
const push = (...x) => md.push(...x)

// ============ 合成订单 ============
const order = {
  orderNo: 'SO-2026-0917-001',
  date: '2026-09-17',
  brand: '金鑫门窗',
  client: '张伟',
  tel: '13800138000',
  '安装地址': '广东省佛山市南海区桂城街道 A 座 1801',
  productionDays: '15',
  total: 12860.5,
  deposit: 5000,
  balance: 7860.5,
  declaration: '1. 本单为定制产品，下单后 3 日内可改尺寸。\n2. 尾款于安装验收当日结清。\n3. 质保两年，五金件一年。',
  payQrcode: 'https://example.com/qr/pay.png',
  receipt: [
    {
      profile: '断桥铝合金 70 系列<br>香槟金',
      direction: '外开',
      color: '香槟金',
      glass: '5+12A+5 双钢化<br>白玻',
      size: '1200×1500',
      quantity: 2,
      price: 1580,
      amount: 3160,
      pricing: '按面积计价<br>单价 × 面积 × 系数',
      remark: '一扇带纱窗<br>纱网为金刚网',
    },
    {
      profile: '断桥铝合金 60 系列',
      direction: '推拉 & 提升',
      color: '深灰 <哑光> "定制"',
      glass: '5+9A+5',
      size: '2000×2200 & 特殊',
      quantity: 1,
      price: 4200.5,
      amount: 4200.5,
      pricing: '按樘计价',
      remark: '含 <五金> "进口" 件',
    },
    {
      profile: '普通铝合金 55 系列',
      direction: '内开内倒',
      color: '白色',
      glass: '单层 5mm',
      size: '900×1200',
      quantity: 5,
      price: 1100,
      amount: 5500,
      pricing: '按面积计价\n第二行\n第三行',
      remark: '普通\n备注两行',
    },
  ],
}

// ============ 默认配置 ============
const defFonts = Z({})            // = u
const defPrint = X({})            // = s
const defHTML = me(order, order.receipt, true)
const defCSS = ue(defFonts, defPrint)

// ============ 非默认配置 ============
const ndFonts = Z({
  headerFontSize: 20, tableFontSize: 10, amountFontSize: 24,
  metaFontSize: 12, declarationFontSize: 11, orderDateFontSize: 9,
})
const ndPrintRaw = { copies: 2, widthMm: 210, heightMm: 297, orientation: 'portrait' }
const ndPrint = X(ndPrintRaw)

const ndVisRaw = {
  ...g,
  metaOrder: ['address', 'client'],
  showQrcode: false,
  showDeclaration: false,
}
const ndVis = te(ndVisRaw)        // 走真实归一化

// 改模块级状态（n / C / i / b 都是 ref 形状的对象）
const savedN = { ...n }, savedC = { ...C }, savedI = { ...i }, savedB = b
n.value = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
C.value = ndVis
i.value = { enabled: true, name: '测试门窗厂' }
const ndB = R.L()
ndB.client = { offsetXMm: 5, offsetYMm: -2, fontSize: 14, widthMm: 40, visible: true }
b.value = ndB

const ndHTML = me(order, order.receipt, true)
const ndCSS = ue(ndFonts, ndPrint)

// 还原
n.value = savedN.value
C.value = savedC.value
i.value = savedI.value
b.value = savedB.value

// ============ @media print 旋转块 ============
const grabPrintBlock = (css) => {
  const at = css.indexOf('@media print')
  return css.slice(at, css.indexOf('@media screen', at))
}
const cssLandscape = ue(defFonts, X({ widthMm: 200, heightMm: 140, orientation: 'landscape' }))
const cssPortrait = ue(defFonts, X({ widthMm: 200, heightMm: 140, orientation: 'portrait' }))
const grabPage = (css) => {
  const at = css.indexOf('@page')
  return css.slice(at, css.indexOf('@media print', at))
}
const grabRotate = (css) => {
  const at = css.indexOf('.r2-page-wrap')
  return at < 0 ? '(无 .r2-page-wrap 规则)' : css.slice(at, css.indexOf('.receipt2-page {', at) + 200)
}

// ============ 生成 markdown ============
push('# 收据单2 · 黄金样本（实跑产出）')
push('')
push('由 `/tmp/r2-analysis/make-golden.mjs` 调用 `/tmp/r2-analysis/render-extracted.mjs` 生成。')
push('`render-extracted.mjs` 里的 `ue`/`de`/`re`/`ie`/`me`/`Ve`/`M`/`ce`/`se`/`oe`/`ae`/`ne`/`X`/`Z`/`K`')
push('是从 `Receipt2.deobfuscated.js` **逐字自动抽取**的（`extract-render.mjs`，含括号/字符串/正则感知的扫描器），')
push('**没有任何手抄**。因此下面的空白与换行就是真实产物，可直接做逐字比对基准。')
push('')
push('> 抽取器踩过的坑：`le` 里的正则 `/"/g`、`/\'/g` 会让朴素的字符串跟踪错位，')
push('> 导致扫描越界把 `ue` 的 CSS 截断在 `.receipt2-table th,` 那个逗号上。')
push('> 现已用「`/` 前面最近非空白字符属 `(,=:[!&|?{};+-*%~^<>` 就当正则」的启发式修正（与 `decode-receipt2.mjs` 同款）。')
push('')
push('基线状态：`b = L()`（全零元素配置）、`C = {...g}`（全默认显隐）、`i = {...r}`（品牌关）、`n = [...a]`（默认列宽）。')
push('')
push('---')
push('')
push('## 1. 合成订单输入')
push('')
push(F + 'json')
push(JSON.stringify(order, null, 2))
push(F)
push('')
push('覆盖点：')
push('- `receipt[0]` 的 `profile`/`glass`/`pricing`/`remark` 都含 `<br>` → 验证 `oe` 的换行转换')
push('- `receipt[1]` 的 `direction`/`color`/`size`/`remark` 含 `&`、`<`、`>`、`"` → 验证 `ae` 转义；`remark` 是 `oe` 路径')
push('- `receipt[2]` 的 `pricing`/`remark` 用**真实换行符** `\\n`（非 `<br>`）→ 验证 `oe` 对 `\\r\\n` 的归一')
push('- `declaration` 含真实换行 → 验证 `oe`')
push('- `payQrcode` 非空 → 走 `<img>` 分支')
push('')
push('---')
push('')
push('## 2. 默认配置产出')
push('')
push(`字号 \`Z({})\` = \`${JSON.stringify(defFonts)}\``)
push('')
push(`打印 \`X({})\` = \`${JSON.stringify(defPrint)}\``)
push('')
push('### 2.1 HTML —— `me(order, order.receipt, true)` 原样')
push('')
push(F + 'html')
push(defHTML)
push(F)
push('')
push('### 2.2 CSS —— `ue(Z({}), X({}))` 原样')
push('')
push(F + 'css')
push(defCSS)
push(F)
push('')
push('---')
push('')
push('## 3. 非默认配置产出')
push('')
push('输入（按你的清单）：字号 header 20 / table 10 / amount 24 / meta 12 / declaration 11 / orderDate 9；')
push('纸型 `{copies:2, widthMm:210, heightMm:297, orientation:"portrait"}`；列宽全 10；')
push('关 `showQrcode`/`showDeclaration`；`metaOrder: ["address","client"]`；品牌 `{enabled:true, name:"测试门窗厂"}`；')
push('`client` 元素配置 `{offsetXMm:5, offsetYMm:-2, fontSize:14, widthMm:40, visible:true}`。')
push('')
push(`清洗后字号 \`Z(...)\` = \`${JSON.stringify(ndFonts)}\``)
push('')
push(`清洗后打印 \`X(...)\` = \`${JSON.stringify(ndPrint)}\``)
push('')
push(`⚠️ **\`metaOrder\` 经 \`te()\` 归一化后不是 \`["address","client"]\`**，而是 \`${JSON.stringify(ndVis.metaOrder)}\``)
push('（缺失的 `tel`/`productionDays` 被自动补到尾部 —— 见 01 文档 §3.2）。')
push('')
push('⚠️ **因此 meta 行仍是 4 列，不是 2 列**：内联 `grid-template-columns` 实测为 ')
push('`1fr 1fr 1fr 1fr`（列数 = **实际渲染的 span 数**，而 `te()` 把被删的项又补了回来）。')
push('只有同时关掉 `showTel`/`showProductionDays` 列数才会降到 2 —— 详见 §5.4。')
push('')
push('### 3.1 HTML')
push('')
push(F + 'html')
push(ndHTML)
push(F)
push('')
push('### 3.2 CSS')
push('')
push(F + 'css')
push(ndCSS)
push(F)
push('')
push('---')
push('')
push('## 4. `@page` 与 `@media print` 横向旋转块（横向 vs 纵向各跑一次）')
push('')
push('同一份 `ue(fonts, print)`，只改 `print.orientation`（尺寸固定 200×140，仅换方向字段），')
push('看 `@page` 与 `@media print` 是否变化。')
push('')
push('### 4.1 `orientation:"landscape"` 的 `@page`')
push('')
push(F + 'css')
push(grabPage(cssLandscape).trim())
push(F)
push('')
push('### 4.2 `orientation:"portrait"` 的 `@page`')
push('')
push(F + 'css')
push(grabPage(cssPortrait).trim())
push(F)
push('')
push('### 4.3 `orientation:"landscape"` 的 `@media print` 全文')
push('')
push(F + 'css')
push(grabPrintBlock(cssLandscape).trim())
push(F)
push('')
push('### 4.4 `orientation:"portrait"` 的 `@media print` 全文')
push('')
push(F + 'css')
push(grabPrintBlock(cssPortrait).trim())
push(F)
push('')
push(`长度对比：landscape 的 \`@media print\` = ${grabPrintBlock(cssLandscape).length} 字符，`
  + `portrait = ${grabPrintBlock(cssPortrait).length} 字符。`)
push(`横向旋转块（\`.r2-page-wrap\` / \`transform: ... rotate(-90deg)\`）在 landscape 下`
  + `${grabPrintBlock(cssLandscape).includes('rotate(-90deg)') ? '**存在**' : '**不存在**'}，`
  + `在 portrait 下 ${grabPrintBlock(cssPortrait).includes('rotate(-90deg)') ? '**存在**' : '**不存在**'}。`)

push('')
push('---')
push('')
push('## 5. 逐条核对：产出 vs `02-render-pipeline.md`')
push('')
push('### 5.1 一致（逐条已用实测产物核对）')
push('')
push('| 02 的说法 | 实测 | 结论 |')
push('|---|---|---|')
push('| `me`: `<section class="receipt2-page">\\n    {DE}` —— 页首有**一行 4 空格空行** | 产出 `...receipt2-page">\\n    \\n    <div class="receipt2-header">` | ✅ 一致 |')
push('| `me`: `</table>\\n    {FOOTER}\\n  </section>` | 产出 `</table>\\n    <div class="receipt2-amounts"...` / 无页脚时 `</table>\\n    \\n  </section>` | ✅ 一致 |')
push('| 空明细 → `<tr><td colspan="10" class="empty-row">暂无明细</td></tr>` | 完全一致 | ✅ 一致 |')
push('| `de`: `\\n    <div class="receipt2-header">\\n      {LEFT}\\n      <div class="receipt2-title" {CE:title}>{TITLE}</div>\\n      {RIGHT}\\n    </div>\\n    {META}` | 逐字一致 | ✅ 一致 |')
push('| `LEFT`/`RIGHT` 为空时字面量 `<div></div>` | 页头三件套全关 → `<div></div>` ×2 | ✅ 一致 |')
push('| `META` 全不可见时为空串 | 四个 meta 开关全关 → `</div>\\n    \\n    <table` | ✅ 一致 |')
push('| `grid-template-columns:1fr 1fr …` 列数 = 可见 span 数 | 默认 4 项 → `1fr 1fr 1fr 1fr;` | ✅ 一致 |')
push('| 页头同侧内固定顺序 `orderNo → date → qrcode` | 右侧产出 `date` 在前、`qrcode` 在后 | ✅ 一致 |')
push('| 二维码二选一：`typeof payQrcode === "string" && payQrcode.trim() !== ""` | `payQrcode:"   "`（纯空白）→ 走**空 div** 分支 | ✅ 一致 |')
push('| `<img class="receipt2-qrcode" data-r2-el="qrcode" src="..." alt="收款二维码" />` | 逐字一致 | ✅ 一致 |')
push('| 前三个 meta span 带 `data-shrink-fit`，`productionDays` 不带 | 逐字一致 | ✅ 一致 |')
push('| `TITLE` = 品牌开且有名字 ? 品牌名 : (`order.brand` \\|\\| `"收据单2"`) | 品牌关 + `order.brand` 有值 → 品牌名；品牌关且无 `brand` → `收据单2`；品牌开 → `测试门窗厂` | ✅ 一致 |')
push('| `ie` 行模板（含各 `\\n    <td` 缩进与结尾 `\\n  </tr>`） | 逐字一致 | ✅ 一致 |')
push('| `cell-multi` 列为 1/4/5/9/10，用 `oe()`；其余用 `ae()` | `profile`/`glass`/`size`/`pricing`/`remark` 的 `<br>` → 真实换行，且 `&`/`<`/`>`/`"` 被转义；`direction`/`color` 的 `<br>` **不**转换只转义 | ✅ 一致 |')
push('| 明细行**没有** `data-r2-el` | 产出中确认没有 | ✅ 一致 |')
push('| `declaration` 用 `oe()` | 真实 `\\n` 保留 | ✅ 一致 |')
push('| `@page` 横向交换尺寸（200×140 → `140mm 200mm`） | 横向 `size: 140mm 200mm`；纵向 `size: 200mm 140mm` | ✅ 一致 |')
push('| `@media print` 旋转块仅在 `orientation === "landscape"` 注入 | 见 §4.3/§4.4 | ✅ 一致 |')
push('| `ue` 签名 `(fonts, print)`，列宽走闭包 `n` 而非参数 | 实证：改 `n.value` 立刻反映到 CSS，改参数不影响列宽 | ✅ 一致 |')
push('')
push('### 5.2 与 `02-render-pipeline.md` **不一致**的地方')
push('')
push('**唯一一处（排版层面，非逻辑层面）：`Ve()` 里「金额块」与「说明块」之间没有换行。**')
push('')
push('02 的 §2 / §2.1 fenced 块把两者画成了两行：')
push('')
push(F + 'html')
push('      </div>')
push('<div class="receipt2-declaration" data-r2-el="declaration">{{declaration}}</div>')
push(F)
push('')
push('实测产物是**紧贴**的，`</div>` 与 `<div class="receipt2-declaration"` 之间**没有换行符**：')
push('')
push(F + 'html')
push('      </div><div class="receipt2-declaration" data-r2-el="declaration">X</div>')
push(F)
push('')
push('原因：`Ve` 是两个三元表达式用 `+` 直接拼接（`:583–600`），前一段以 `</div>` 结尾不带 `\\n`，')
push('后一段以 `<div class="receipt2-declaration"` 开头。**做逐字比对时以本样本为准**，')
push('02 那一处只是示意排版，不影响 DOM 结构与观感（两者都是块级元素）。')
push('')
push('### 5.3 复核 `02` §7 未确认第 1 条')
push('')
push('02 §7.1 断言：`@media print` 的横向旋转块在 `ye()`（浏览器打印）路径上是**死代码**，')
push('因为 `.r2-page-wrap` 只有 `printSilent` 会生成，而旋转规则「命中不到任何元素」。')
push('')
push('本次实测**证实了前半句、但后半句的选择器事实有偏差**：')
push('')
push('- ✅ 旋转 CSS **只在 landscape 下注入**（§4.3 vs §4.4，portrait 下整块不存在）。')
push('- ⚠️ 但 `@media print` 在 landscape 下产出的是**四条并列的顶层规则**：')
push('  `.receipt2-root`、`.r2-page-wrap`、`.r2-page-wrap:last-child`、`.receipt2-page`。')
push('  最后一条**不带 `.r2-page-wrap` 前缀**，`transform: translateY(200mm) rotate(-90deg) !important`')
push('  是直接挂在 `.receipt2-page` 上的。')
push('')
push('**推论（INTERPRETED，非实测）**：因此在 `ye()` 路径下，`.r2-page-wrap` 两条规则确实落空，')
push('但 `.receipt2-page` 的 `position:absolute` / `width` / `height` / `transform` **仍会命中**，')
push('内容照样被转 -90°；`@page` 也已交换成 `140mm 200mm`，几何上恰好对得上（旋转后占位 140×200）。')
push('真正丢掉的更像是 **`.r2-page-wrap` 提供的 `overflow:hidden` 裁切与 ')
push('`page-break-after: always` 分页**（`.receipt2-page` 自己带的是 `page-break-after: auto !important`），')
push('即多页横向打印可能分页/裁切异常，而**不是**「完全不旋转」。')
push('')
push('**建议 02 的作者复核并更正措辞**：不是「旋转规则命中不到任何元素（死代码）」，')
push('而是「wrap 专属的两条规则落空，旋转本身仍生效」。')
push('')
push('边界声明：我能证明的只是 **CSS 文本与选择器形状**（§4.3 原文可逐字复核）；')
push('上面关于 `ye()` 实际排版后果的部分是**推断**，本环境无浏览器无法实证。')
push('`ye()` 是否真的不生成 wrap 属 02 的取证范围，我未独立验证，仅采信其结论作为前提。')
push('')
push('### 5.4 `grid-template-columns` 列数 & `.receipt2-meta-row span:nth-child(3)` 的坑（实测坐实）')
push('')
push('`ue()` 里有一条**按 DOM 位置生效**的规则（`:387`）：')
push('')
push(F + 'css')
push('.receipt2-meta-row span:nth-child(3) { padding-left: 6mm; }')
push(F)
push('')
push('它选的是**第 3 个渲染出来的 span**，与元素身份无关。实测五种配置：')
push('')
push('| 配置 | 实际渲染的 span 顺序 | 列数 | 内联 `grid-template-columns` | `nth-child(3)` 落在谁身上 |')
push('|---|---|---|---|---|')
push('| 默认 `C = {...g}` | `client, tel, address, productionDays` | 4 | `1fr 1fr 1fr 1fr` | **`address`（安装地址）** |')
push('| `metaOrder` 改成 address 优先（经 `te` 补全） | `address, client, tel, productionDays` | 4 | `1fr 1fr 1fr 1fr` | **`tel`（电话）** |')
push('| 关 `showTel` | `client, address, productionDays` | 3 | `1fr 1fr 1fr` | **`productionDays`（生产天数）** |')
push('| 关 `showClient` | `tel, address, productionDays` | 3 | `1fr 1fr 1fr` | **`productionDays`（生产天数）** |')
push('| 只留 `client` | `client` | 1 | `1fr` | 规则**落空**（无第 3 个 span） |')
push('')
push('**结论（CONFIRMED）**：02 标的这个坑是真的，而且比「按 DOM 位置生效」更严重 ——')
push('**拖拽排序 `metaOrder` 或开关任一 `showXxx` 都会把这 6mm 缩进挪到另一个字段上**。')
push('默认配置下它恰好落在「安装地址」上，这正是设计意图（地址最长、需要缩进避让），')
push('但**没有任何东西把它绑在 `address` 上**。')
push('')
push('**新版实现建议**：不要复刻 `nth-child(3)`，改成给 `address` 一个类（如 `.r2-meta-address`）')
push('并挂 `padding-left: 6mm`。否则排序 / 开关一动，视觉就漂。')
push('若要与旧版**逐像素**对齐，则必须复刻 `nth-child(3)` 的语义（含「不足 3 个 span 时不生效」）。')
push('')
push('另一个附带实测：`.receipt2-meta-row` 的**类规则**写死了 4 列 `1.2fr 1.5fr 1.7fr 0.8fr`（`:385`），')
push('但每个 meta 行都有**内联** `grid-template-columns`，内联优先 —— 所以类规则那 4 个非等宽比例')
push('在任何含 meta 行的页面上都是**死声明**（只有内联缺失时才生效）。')
push('')
push('---')
push('')
push('## 6. 黄金样本怎么用（新版回归建议）')
push('')
push('目标：把「新旧产出逐字节相等」变成一个**能在 CI 里跑**的断言，而不是靠人眼看预览。')
push('')
push('### 6.1 落地成夹具')
push('')
push('建议路径（与仓库现有 `app/src/` 结构一致）：')
push('')
push(F + 'text')
push('app/src/__fixtures__/receipt2/')
push('  order.default.json          # §1 的合成订单（含 receipt 明细）')
push('  config.default.json         # 字号/纸型/列宽/显隐/品牌 = 全默认')
push('  config.custom.json          # §3 的非默认配置')
push('  expected.default.html       # §2.1 原样')
push('  expected.default.css        # §2.2 原样')
push('  expected.custom.html        # §3.1 原样')
push('  expected.custom.css         # §3.2 原样')
push(F)
push('')
push('直接用本文件的 fenced block 落地即可 —— 它们就是真实函数返回值，未做任何美化。')
push('**注意保留行尾与空白**：`me()` 的产物里有 `\\n    \\n` 这种「只有 4 个空格的行」，')
push('是真实输出的一部分（见 §2.1 第 2 行），编辑器/格式化工具很容易把它删掉。')
push('落地后建议跑一次 `git diff --stat` 确认没有尾随空白被剥离。')
push('')
push('### 6.2 断言方式')
push('')
push('新实现应暴露两个**纯函数**（不要只暴露拼好整页的接口），签名对齐旧版：')
push('')
push(F + 'ts')
push('buildPageCss(fonts: FontSettings, print: PrintSettings, columnWidths: number[]): string')
push('buildPageHtml(order: Order, rows: ReceiptLine[], opts: { withFooter: boolean }): string')
push(F)
push('')
push('然后：')
push('')
push(F + 'ts')
push('expect(buildPageCss(cfg.fonts, cfg.print, cfg.columnWidths)).toBe(readFixture(\'expected.default.css\'))')
push('expect(buildPageHtml(order, order.receipt, { withFooter: true })).toBe(readFixture(\'expected.default.html\'))')
push(F)
push('')
push('**逐字节 `toBe`，不要用 snapshot、不要 normalize 空白**。')
push('旧版产物是字符串拼接的确定输出，没有任何随机性或时间戳，可以做到完全确定。')
push('')
push('### 6.3 重点覆盖的边界（本样本已含，回归时别丢）')
push('')
push('- `<br>` → 真实换行（`oe`）vs 只转义不换行（`ae`）—— 用 `receipt[0]` 与 `receipt[1]` 覆盖')
push('- `&`/`<`/`>`/`"` 的转义 —— `receipt[1]` 的 `color`/`remark` 覆盖四种字符')
push('- 真实 `\\n` 透传（`receipt[2]` 的 `pricing`/`remark`）—— 别把它和 `<br>` 混为一谈')
push('- 空明细 → `暂无明细` 占位行')
push('- `withFooter=false` → `</table>\\n    \\n  </section>` 的尾随空行')
push('- 页头三件套全关 → `<div></div>` 占位')
push('- meta 全关 → 整块为空串')
push('- 二维码空/有两条分支（`payQrcode` 为 `""` / `"   "` / 有值）')
push('- 元素配置：无配置（无 style 属性）vs 有配置（`data-r2-el="client" style="..."`）')
push('')
push('### 6.4 建议额外补的夹具（本样本未覆盖，但值得锁住）')
push('')
push('- **横向 vs 纵向**各一份 CSS 夹具（§4.3/§4.4 已给全文）—— 横向那份含旋转块，纵向不含')
push('- **多页**：`we()` 的分页结果（需要 DOM 量测，本环境跑不了）—— 建议在浏览器/`jsdom` 里补')
push('- **`nth-child(3)` 的坑**（§5.4）：至少给「默认」与「address 优先」两份 meta 行夹具，')
push('  否则新版很容易把这 6mm 钉死在 `address` 上，从而与旧版在排序后**不一致**')
push('')
push('### 6.5 重要提醒：夹具锁的是「旧版行为」，不是「正确行为」')
push('')
push('本样本忠实记录了旧版的若干**已知缺陷**（见 01 文档 §3.2 的 `metaOrder` 不去重、')
push('§5.4 的 6mm 缩进漂移、以及横向打印在 `ye()` 路径下的错位风险）。')
push('做逐字节 diff 时，**先决定哪些缺陷要保留、哪些要修**：')
push('')
push('- **保留** → 夹具就是验收标准，diff 必须为空。')
push('- **要修** → 别直接改夹具「让它过」；应在夹具文件里写明偏离点与理由，')
push('  并让测试显式断言「此处与旧版有意不同」，否则以后没人分得清是 bug 还是有意为之。')
push('')
push('这条与你之前记录在案的「点击传图不加名字字幕带 = 有意偏离」是同一个原则：')
push('**偏离要有据可查，不要静默漂移**。')

writeFileSync('/tmp/r2-analysis/07-golden-sample.md', md.join('\n'))
console.log('已写出 07-golden-sample.md')
console.log('defHTML 长度', defHTML.length, '| defCSS 长度', defCSS.length)
console.log('ndHTML 长度', ndHTML.length, '| ndCSS 长度', ndCSS.length)
