# 第一层：`<style>` 块 CSS 清单（39 块 / 4302 行）

> 第二层（写在模板 / 脚本里的样式，51 处装饰性）见 `01-hardcoded-styles.md`。
> **本文只做清点与分类，不含任何改动。**

## 口径

| 项 | 怎么算的 |
|---|---|
| 范围 | `app/src/**/*.vue` 中，**行首** `<style` 到行首 `</style>` 之间的全部内容 |
| 行数 | 不含 `<style>` / `</style>` 两行本身 |
| 剥注释 | 统计色值**先剥掉注释**。本仓库注释里成段逐字抄着旧版 CSS，不剥就全是假数（踩过，见 `01` 文与 `grep-hits-are-usually-comments`） |
| 出身判定 | 拿色值去**旧版应用自己的 bundle** 里实搜：`legacy/css/*.css` + `legacy/js/*.js`，**剔除** `vendor/` 与 `vue-*` / `element-plus*` / `echarts*` / `*coze*` 等第三方件 |
| 搜法 | 十六进制与 `rgb()` / `rgba()` 十进制**两种写法都搜**（旧版大量写作 `rgba(207,227,255,.5)`） |

⚠️ **粒度声明（重要）**：下文「甲 / 丁」是**色值级**判定 —— 「这个色值旧版用过」，
**不是**「这条规则抄自旧版」。规则级的保真判定要逐条比对旧版 CSS，
本文没做，所以本文**不能**用来宣称某条规则是保真的。

## 一、规模

| 项 | 数量 |
|---|---|
| `<style>` 块 | **39** |
| 总行数 | **4302**（scoped 4252 / 非 scoped 50） |
| 顶层规则数 | **683** |
| 注释行 | 352 |
| 含装饰属性的规则 | **316（46%）** |
| `!important` | 68 |
| `:deep(...)` | 129 |
| `--n-*` 引用 | 28 |
| 色值 | 出现 **403** 次，**103** 个不同值 |

选择器（剥注释后）：自有 class **592** · `.n-*`（Naive 原生类名）**50** · `:deep(...)` **88** · `.el-*` **0**。

> `.el-*` 是 0 —— 未剥注释时能数出 42 处，**全部在注释里**（逐字抄着 `element-plus-6bd3a0dc.css`）。

### 两个非 scoped 块（会外溢成全局样式）

| 块 | 行数 | 情况 |
|---|---|---|
| `App.vue` :53 | 5 | `:root { --app-header-h: 60px }` —— 全局变量定义，**本来就该非 scoped** |
| `views/Progress.vue` :2297 | 45 | 9 条 `.progress-color-filter-*` / `.progress-header-tools`。**有注释写明是有意为之**：Naive 的 `NPopover` 把内容 teleport 到 body，scoped 可能命中不了；旧版 `Progress-4dee25cf.css` 里这些类名本来就是全局的。注释同时诚实标注了「**这是推理，不是验证过的**」 |

⇒ 这两处**不是事故**，但第二处是**未验证的**假设，改这一带时要先实测。

## 二、色值出身

| 档 | 出现次数 | 占比 | 含义 |
|---|---|---|---|
| **EP 调色板内** | 178 | 44.2% | 命中 Element UI 2.x 标准调色板（primary/success/warning/danger/info + 文字/边框/底色梯级）—— 旧版用的就是它 |
| **甲**（调色板外，旧版 bundle 里能找到） | 167 | 41.4% | 值可追溯到旧版，只是不在 EP 标准板里 |
| **丁**（旧版全无） | 58 | 14.4% | 新版自加 |

丁再细分——**这两类的性质完全不同**：

| 子类 | 次数 | 是什么 | 处置 |
|---|---|---|---|
| **丁₁ · Naive 默认值漏出** | 6 | `#d03050` ×3（`naive-ui/es/_styles/common/light.mjs` 的 `errorColor` 默认值）· `#18a058` ×3（`successColor` 默认值）。我们 `App.vue` 的 `themeOverrides` **只覆盖了 primary**，这两处是组件库默认值直接漏进了业务 CSS | **最该先处理的一类** —— 语义明确（错误/成功），却与旧版口径的 `#f56c6c` / `#67c23a` **不是同一个绿、同一个红** |
| **丁₂ · 手挑新色** | 52 | 见下表 | 设计自由区 |

丁₂ 的主要来源：

| 色值 | 次数 | 用在哪 | 是什么 |
|---|---|---|---|
| `#cfe3ff` `#23405f` `#5a7b9c` `#7d9ec0` `#2c4a6b` `#13263b` `#16304d` `#1c3a58` `#b0814c` `#eaf6ff` `#9fc3e8` `#7fd8ff` `#9fb6c9` | 24 | `DashboardBigScreen` | 一套**成套的暗蓝底大屏色阶**（底 `#13263b`、描边 `#23405f`/`#2c4a6b`、次级字 `#5a7b9c`/`#7d9ec0`、亮字 `#cfe3ff`、铜牌 `#b0814c`）。**不是在旧版板上取色，是另起了一套** |
| `#1a7f3c` | 4 | `AppHeader`、`Hui` | **新版的品牌绿**：AppHeader 导航激活态、Hui 顶栏 `border-top`、`.vis-head` 标题色 |
| `#e8801f` | 3 | `Hui` | 新版「金额强调橙」：`.summary-bar .total b`、`.markup-amount`、`.totals-strip .grand b` |
| `#722ed1` `#d9ecff` `#efdbff` `#ffe7ba` `#e6f4ff` `#f9f0ff` `#fff7e6` `#f0fff0` | 8 | `ProgressDashboard` | 一套紫/蓝/橙标签底 + 描边色阶 |
| `#6a11cb` `#2575fc` `#faf5eb` | 3 | `FinanceDrawer` | 紫→蓝渐变 |
| `#e5e6eb` `#fafbfc` `#f0f6ff` `#f3d19e` | 6 | `GlassDraw`、`Formulas`、`Hui`、`ProcedureSettingsDialog` | **近值中性色**：与 EP 的 `#e4e7ed` / `#f5f7fa` 视觉上几乎不可分，但是另一个值 |

## 三、色族分桶：同义多值

| 色族 | 不同色值 | 出现次数 | 次数 ≥2 的明细 |
|---|---|---|---|
| 中性灰 / 黑白 | **39** | 235 | `#fff`×44 `#666`×23 `#909399`×21 `#606266`×14 `#999`×14 `#f5f7fa`×14 `#000`×11 `#303133`×10 |
| 蓝 | **26** | 75 | `#409eff`×13 `#0965fa`×8 `#cfe3ff`×6 `#667eea`×5 `#7caaf3`×4 `#ecf5ff`×4 |
| 橙 | 12 | 25 | `#e6a23c`×9 `#e69500`×4 `#e8801f`×3 |
| 绿 | 9 | 35 | `#67c23a`×13 `#3de7c9`×9 `#1a7f3c`×4 `#18a058`×3 `#52c41a`×2 |
| 紫 | 9 | 12 | `#764ba2`×4 |
| 红 | 5 | 18 | `#f56c6c`×10 `#d03050`×3 `#ff4d4f`×3 |
| 青 / 黄 | 3 | 3 | — |

**同一套语义，多套色值在跑**（下面这几条是**读代码确认过的**，不是按色相猜的）：

| 语义 | 各处在用的值 | 出处 |
|---|---|---|
| 「成功 / 余额 / 已清」绿 | `#67c23a`（EP success）· `#18a058`（Naive 默认 success）· `#1a7f3c`（新版品牌绿）· `#52c41a` | Hui `.summary-bar .balance` / `.markup-total` / `.totals-strip .bal` 用 `#18a058`；`01` 文里的乙类 #20/#21/#43「已清绿」用 `#67c23a` |
| 「危险 / 欠款」红 | `#f56c6c`（EP danger）· `#d03050`（Naive 默认 error）· `#ff4d4f` | `Receipt2Dialog:377` / `PrintPreviewDialog:722` / `DocSheetDialog:456` 三处**角色完全相同**（错误提示文字），都用 `#d03050` |
| 「金额强调」橙 | `#e6a23c`（EP warning）· `#e8801f`（新版）· `#e69500` | — |
| 「主色 / 链接」蓝 | `#409eff`（EP primary，**也是我们 `themeOverrides` 设的 primaryColor**）· `#0965fa` · `#7caaf3` | — |

## 四、39 块逐块

判定按**色值级**给出（见上方粒度声明）：

| 判定 | 含义 | 块数 |
|---|---|---|
| **A · 色值全可追溯** | 丁 = 0 —— 块内色值不是 EP 调色板就是旧版 bundle 里有的 | **28** |
| **B · 混合** | 丁 > 0，且块内有旧版引用注释 | 6 |
| **C · 新版面** | 丁 > 0，且块内**无**旧版引用注释 | 5 |

「旧版引用」列 = 块内注释里出现 `旧版/原版/legacy/逐字/照抄` 的词次 + `:1234` 形式行号引用的处数。
⚠️ 这一列只反映**注释习惯**，**不构成出身判定** —— 反例：`DashboardBigScreen` 引用为 0，但它本身是旧版组件（`Home.formatted.js:156-960`）。出身只认上面那张色值实搜表。

| 块 | 行 | 规则 | 装饰 | 旧版引用 | 新版色值 | 判定 |
|---|---|---|---|---|---|---|
| `views/Hui` | 387 | 58 | 19 | 27 + 11 | 4 | B |
| `components/ReceiptCard` | 379 | 66 | 42 | — | 0 | A |
| `views/Home` | 341 | 41 | 25 | 35 + 7 | 0 | A |
| `components/DashboardBigScreen` | 332 | 55 | 36 | — | 13 | C |
| `views/Formulas` | 269 | 51 | 16 | 8 + 1 | 3 | B |
| `components/DetailLinesTable` | 229 | 39 | 14 | 13 + 10 | 0 | A |
| `components/ProgressDashboard` | 227 | 39 | 22 | 9 | 8 | B |
| `components/FinanceDrawer` | 192 | 38 | 21 | 6 + 1 | 3 | B |
| `views/Qrscanner` | 192 | 29 | 9 | 16 + 3 | 0 | A |
| `components/ScanStatsPanel` | 175 | 31 | 18 | 6 | 0 | A |
| `views/Progress` 块1 | 130 | 22 | 8 | 11 + 2 | 0 | A |
| `components/ProductionSheetLayoutDialog` | 119 | 15 | 10 | 3 | 0 | A |
| `components/ReceiptEditDialog` | 118 | 21 | 5 | 2 + 3 | 0 | A |
| `components/DocSheetLayoutDialog` | 105 | 10 | 4 | 8 | 0 | A |
| `components/QualifiedLabelLayoutDialog` | 96 | 12 | 6 | 10 + 2 | 0 | A |
| `views/ReceiptView` | 92 | 14 | 9 | 2 | 0 | A |
| `components/DocSheetDialog` | 90 | 7 | 3 | 3 + 1 | 1 | B |
| `components/Receipt2SettingsDialog` | 63 | 9 | 1 | 1 | 0 | A |
| `components/DocEditDialog` | 59 | 10 | 5 | 1 | 0 | A |
| `components/ProductionSheetEditDialog` | 56 | 9 | 3 | 4 | 0 | A |
| `components/AppHeader` | 53 | 9 | 5 | — | 1 | C |
| `components/GlassDraw` | 53 | 11 | 3 | — | 1 | C |
| `components/QualifiedLabelEditDialog` | 53 | 8 | 2 | 3 + 1 | 0 | A |
| `components/Receipt2ElementEditor` | 52 | 6 | 4 | 6 | 0 | A |
| `components/ProcedureSettingsDialog` | 49 | 7 | 3 | 3 | 1 | B |
| `views/ReceiptShare` | 48 | 7 | 4 | 2 | 0 | A |
| `components/GlassEditDialog` | 47 | 8 | 2 | 1 + 1 | 0 | A |
| `views/Progress` 块2（非 scoped） | 45 | 9 | 4 | — | 0 | A |
| `components/PrintPreviewDialog` | 40 | 7 | 4 | — | 1 | C |
| `components/Receipt2Dialog` | 37 | 7 | 3 | — | 1 | C |
| `components/PrintDrawer` | 32 | 6 | 2 | — | 0 | A |
| `components/QualifiedLabelSettingsDialog` | 27 | 4 | 2 | 7 | 0 | A |
| `views/Clients` | 27 | 5 | 1 | — | 0 | A |
| `components/DetailLineDialogs` | 22 | 4 | 0 | 1 + 3 | 0 | A |
| `components/DocSheetSettingsDialog` | 18 | 2 | 0 | 1 | 0 | A |
| `components/ProductionSheetSettingsDialog` | 16 | 2 | 0 | 1 | 0 | A |
| `views/Login` | 16 | 3 | 1 | 1 | 0 | A |
| `components/ReceiptOtherDialog` | 11 | 1 | 0 | 3 | 0 | A |
| `App`（非 scoped） | 5 | 1 | 0 | — | 0 | A |

## 五、汇总结论

1. **39 块里 28 块（72%）色值 100% 可追溯到旧版或 EP 调色板** —— 第一层同样不是「样式债」。
   这和 `01` 文对第二层的结论一致：**这个仓库的样式主体是保真资产**。
2. **真正的设计自由只有 11 块**（B 6 + C 5），且集中在 `DashboardBigScreen`（13 个新色值）、
   `ProgressDashboard`（8）、`Hui`（4）、`FinanceDrawer`（3）、`Formulas`（3）。
3. **第一层最确实、最该先做的一件事，是和设计无关的**：把 **丁₁ Naive 默认漏出**收掉 ——
   `#d03050` / `#18a058` 共 6 处。它们现在让「错误」「成功」这两个语义
   在同一个应用里**渲染成两种红、两种绿**。这不是审美问题，是**一致性缺陷**，
   而且论证成本最低（值换成 EP 对应值或改成主题 token，渲染意图不变）。
4. **同义多值是可量化的**：绿 9 个值 / 红 5 个 / 橙 12 个 / 蓝 26 个。
   改主题时，只要还有硬编码，就必然漏改 —— 这是「抽 token」这件事在本仓库的**具体收益**，
   不再是泛泛的「代码整洁」。
5. **`ui-upgrade` 的可行面**：`DashboardBigScreen` + `ProgressDashboard` + `AppHeader`
   这三块是**能整体重做**的（C 类，且本来就是新版面/新组件）；
   `Hui` / `Formulas` / `FinanceDrawer` 是 B 类，只能**逐条**改，
   每改一条都要先确认那条规则有没有旧版依据。

## 六、更正记录

### 1. 8762 行是假数（已定位）

初次统计用 `/<style([^>]*)>([\s\S]*?)<\/style>/` 得 **8762 行**，与本文的 4302 差一倍。
定位：`views/Home.vue:2093` 有一句注释 `* 但 CSS 的层叠不靠顺序，见 \`<style>\` 里那段说明。`——
正则从这行**注释里提到的** `<style>` 开始匹配，一路啃到 3649 行的真 `</style>`，
把该文件虚报成 1557 行（真实块 3307→3649 = 341 行）。

**4302 是对的。** 改用「行首 `<style` / 行首 `</style>`」的状态机后复现一致。
教训同 `01` 文：**这个仓库里带尖括号/函数名的字符串，默认它在注释里。**

### 2. `rgba()` 匹配差点漏掉（已验证无影响）

第一版 rgb 形式搜的是 `rgb(207, 227, 255` —— 而 `rgba(207,227,255,.5)` 里
**不存在 `rgb(` 这个子串**（`rgb` 后面是 `a`），会整体漏判。
改成搜 `${r}, ${g}, ${b}` / `${r},${g},${b}`（不带前缀）后重跑：**判定 0 处变化**，
所以是个潜伏的坑、这次没咬人。

已做**阳性对照**验证匹配器：从 `legacy/css/Home-97d96482.css` 挖出全部 6 个不同的
`rgb()/rgba()` 三元组，转成十六进制再搜回去，**6/6 全部命中**，匹配器可信。

### 3. `#0003` / `#0000d` / `#0002e` 不是解析产物

- `#0003` 是**合法的 4 位十六进制**（`#RGBA`）：`box-shadow: 0 2px 10px #0003`，黑色 20% 透明。
- `#0000d` / `#0002e` 是**我脚本的显示 bug**：一句 `replace("#000000","#000")`
  把 8 位色 `#0000000d` 截成了 `#0000d`。**计数没受影响**，是显示层问题。
