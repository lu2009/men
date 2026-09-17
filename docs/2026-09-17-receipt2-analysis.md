# 收据单2 逆向分析（2026-09-17）

> **这是什么**：旧版 Home 页在 `ic=12` 时提供的那张**自绘单据**（组件名 `Receipt2PrintManager`），
> 是原版唯一能真正调字号的地方。它不是 hiprint 模板，不在我们已导入的 17 张里。
> 本文是**动手实现前的分析定稿**，按项目既定做法：确认无误后再开始写代码。
>
> **详尽材料**（六路并行逆向的原始报告，含逐条行号与 CONFIRMED/INTERPRETED 标注）在
> `docs/receipt2-recon/`。本文只做**结论汇总 + 决策项**，细节往下钻到那六份。
>
> **已解码的旧版源码**：`legacy/js/Receipt2.deobfuscated.js`（2637 行，996 处字符串还原，0 残留），
> 生成脚本 `legacy/decode-receipt2.mjs`。

---

## 0. 一页结论

| 问题 | 答案 |
|---|---|
| 依赖 hiprint 吗 | **不依赖**。三条独立证据：组件区间内 `hiprint`/`print-lock`/`printService` 全 0 命中；云打印按钮的渲染条件排除了 `ic=12`；`socket` 在 Home 全库 0 次 |
| 依赖第三方服务吗 | **不依赖**。样式是**纯字符串内联**，与 HTML 同一次 `document.write` 进 iframe |
| 浏览器能 1:1 复刻吗 | **能**。去掉的只有 Electron 静默打印那一条路径和它那块 UI |
| 工作量 | 一个组件 + 一个设置弹窗 + 一个元素微调浮层。参考：Hui.vue 的打印层抽离是 ~2300 行，这个约**一半** |
| 最大风险 | 分页算法（唯一没被 DOM 实测覆盖的部分，已单独做参考实现）、横向多页（见 §10 决策项） |

**为什么旧版不会「实打白纸」**（对照我们之前踩的坑）：收据单2 的样式**自带**在 HTML 里，
和 `document.write` 一次写进 iframe —— 没有 `<link>`、不用 `print-lock.css`。
而 hiprint 那条路要从**父文档** XHR 拉 `print-lock` 的 `<link>`，父文档没引就白纸。
两者机理正好相反，所以本单据没有那个坑。

---

## 1. ⚠️ 对既有文档的更正（先看这条）

`docs/2026-09-16-print-font.md` §3 写的「收据单2 的字体调节配一套
`{globalFont, fields[{fontFamily,fontColor,fontWeight,wrap,lineHeight}], tableConfig}`」——**全部不存在**。

在 `Receipt2.deobfuscated.js` 里逐字 grep：

```
globalFont  fontFamily  fontColor  fontWeight  lineHeight  paddingMm  tableConfig
    0           0           0           0           0          0            0     ← 出现次数
```

那套模型**属于 `LabelPrintManager`（合格标签）**：它的 `paper` 是 `70×90`，
正是旧文档里「标签是 70×90」那句的真实来源。当年把**两个组件记混了**。

| 旧文档说法 | 实际 |
|---|---|
| `globalFont`「统一字体」一键改全部 | 不存在，**没有任何一键改全部的功能** |
| 逐字段 `fontFamily`/`fontColor`/`fontWeight`/`wrap`/`lineHeight` | 不存在，这些全部**硬编码在 CSS** |
| `paddingMm` | 不存在，页边距硬编码 `padding: 4mm 4mm 3mm` |
| `tableConfig.columns[]`（key/label/visible/width） | 不存在，列只有一份**裸的百分比数组**（10 个数字） |
| 「字号分五类」 | 是**六类**（漏了 `metaFontSize` 基础信息字体） |
| 「标签是 70×90」 | 那是合格标签。收据单2 默认纸 **200×140 横向** |

已同步更正 `docs/2026-09-16-print-font.md` §3 与记忆 `print-font-receipt2`。

> **对决策的影响**：「字体自定义的正主是收据单2」这个判断**依然成立**；
> 但「能不能换字体族」是**新增功能，不是复刻** —— 旧版从头到尾没这能力。

---

## 2. 组件边界与数据流

```
Home（ic=12 时）
 ├─ props: getCustomers / isReceipt2Active / onPreviewHtmlChange
 ├─ 挂载: <Receipt2PrintManager ref="Xn" :get-customers="…" :is-receipt2-active="…"
 │                              :on-preview-html-change="…" />  （在 Home 模板里，始终挂载）
 ├─ 数据源: props.getCustomers() —— **不是**直接吃 Home 的订单列表 ref
 ├─ 预览: 组件自己拼 HTML → onPreviewHtmlChange(html) → Home 塞进预览容器
 └─ 按钮: 打印(_i) / 字体调节(vi) / 编辑收据单(Ri)
```

- 组件**始终挂载**，靠 `isReceipt2Active()`（即 `ic.value===12`）决定要不要刷新预览。
- 「组件未就绪」的确切条件：`!Xn.value`（ref 为 null），或调 `openFontDialog` 时组件没暴露该方法。
- `Ri`「编辑收据单」**不是**组件的方法，是 **Home 自己**的 contentEditable 开关（见 §6）。
- `onPreviewHtmlChange` 回到 Home 后，Home 做三件事：塞进预览容器 → `initColumnResize(容器)`
  → `initElementEditor(容器)`。

**新版映射**：我们的 `PrintDrawer.vue` 已经有「选中订单 → 载荷」的管道，
收据单2 应作为**第 18 张单据**进 `PrintDrawer`（或独立抽屉），
预览容器复用 `PrintDrawer` 里那套 `v-html` + 后续 init 调用的模式。

---

## 3. 配置模型（7 个 localStorage 键）

全部是**扁平结构**，没有嵌套的 fields/columns。详见 `01-config-persistence.md` §5。

| 键 | 存储内容 | 写入时机 |
|---|---|---|
| `receipt2_font_settings` | 6 个字号 | 「保存」按钮，一次写 4 个键 |
| `receipt2_print_settings` | `{copies,widthMm,heightMm,orientation}` | 同上 |
| `receipt2_visibility_settings` | 9 个 `show*` + 3 个 `*Position` + `metaOrder[4]` | 同上 |
| `receipt2_brand_settings` | `{enabled,name}` | 同上 |
| `receipt2_element_configs` | 10 个元素的 `{offsetXMm,offsetYMm,fontSize,widthMm,visible}` | **元素微调「确认」时**，不走保存 |
| `receipt2_column_widths` | `number[10]` 裸百分比 | **拖拽 mouseup**，拖一次写一次 |
| `receipt2_selected_printer` | 裸字符串（Electron 专属） | 选中即写 |

**6 个字号的默认值与范围**（`K(v,min,max,dflt)` clamp，`Math.round` 后取整）：

| 字段 | UI 标签 | 默认 | 范围 |
|---|---|---|---|
| `headerFontSize` | 品牌字体 | 30 | 14–36 |
| `orderDateFontSize` | 编号日期字体 | 13 | 8–18 |
| `tableFontSize` | 表格字体 | 15 | 8–18 |
| `amountFontSize` | 金额字体 | 20 | 16–40 |
| `metaFontSize` | 基础信息字体 | 18 | 8–18 |
| `declarationFontSize` | 说明字体 | 15 | 8–18 |

**「草稿 vs 生效」是成对的 ref**（`v/f`、`h/p`、`C/z`、`i/c`），
打开弹窗时把生效值拷进草稿，确认才写回。取消 = 直接丢弃草稿（生效值从未被污染，所以不用还原）。
⚠️ `metaOrder` 必须**浅拷贝数组**断引用；重写时用新对象即可避免。

### 实测挖出来的三个行为坑（`01` §9，Node 实跑确认）

1. **`K(null,…)` 会 clamp 到 min，不是取默认值** —— `Number(null)===0`。
   后果：**清空字号输入框 → 字号掉到最小值**（实测 `Z({headerFontSize:null})` → `14`）。
   同理 `true`/`false`/`[]` 也都变 `14`。
   → 新版若想要「清空=恢复默认」，必须在清洗前把 `null`/`""` 归一成 `undefined`。
2. **`X()` 的 orientation 合法值优先保留，反推只是兜底**（与直觉相反）。
   即「尺寸与朝向自相矛盾」的脏数据旧版**不纠正**。
3. **`te()` 归一化 `metaOrder` 不去重** —— 存了 `["client","client"]` 会产出**长度 5** 的数组，
   渲染时客户被渲染两次。旧版没防，**新版实现时应补 `Set` 去重**。

---

## 4. 渲染

### 4.1 HTML 骨架

单一「页面模板」函数 `me(order, rows, withFooter)`；页头 `de`、表头 `re`、明细 `ie`、页脚 `Ve`。
**逐字骨架见 `02-render-pipeline.md` §2**，实测产物见 `07-golden-sample.md`。

```
<div class="receipt2-root"><style>{{CSS}}</style>
<section class="receipt2-page">
    <div class="receipt2-header">
      {左：编号/日期/二维码，按 position 配置}
      <div class="receipt2-title" data-r2-el="title">{{品牌或"收据单2"}}</div>
      {右}
    </div>
    <div class="receipt2-meta-row" style="grid-template-columns:…">{客户/电话/安装地址/生产天数}</div>
    <table class="receipt2-table">
      <thead>型材|开向|颜色|玻璃|尺寸|数量|单价|金额|计价方式|备注</thead>
      <tbody>{明细行}</tbody>
    </table>
    {{仅最后一页：金额 + 说明}}
  </section>
```

要点：
- **`data-r2-el` 只打在 10 个元素上**（页头 3 + meta 4 + 页脚 2 …… 实为 10 个 key），
  **明细表一个都没有** → 元素微调面板管不到表格。
- 客户/电话/安装地址三个 span 带 `data-shrink-fit`，`productionDays` **不带**。
- **只有最后一页带页脚**（金额 + 说明）。
- 空明细 → 一行 `colspan=10` 的「暂无明细」。
- ⚠️ `安装地址` 用的是**中文键**，不是 `address`。两者是不同字段。

### 4.2 CSS

**一个发生器 `ue(fontSettings, printSettings)`**，产出全部样式（含 `@page` 与 `@media print`）。
完整原文见 `06-style-geometry.md` §1.2（可直接落盘）+ 实测产物 `07-golden-sample.md`。
**不使用任何外部样式表**（grep 全仓库 `legacy/css/*.css`，没有一条规则提到 `receipt2`）。

- `.receipt2-page`：`width/height` 是**固定 mm**（来自打印设置）+ `padding: 4mm 4mm 3mm`
- 字体族**只在 `.receipt2-root` 写死一次**：`"Microsoft YaHei", "PingFang SC", sans-serif`，其余继承
- 金额色 `#d9001b`；二维码固定 `18mm×18mm`（不随字号/纸张变）
- 列宽：`.receipt2-table th:nth-child(k){width:N%}`，其中**第 2/3/6/7/8 列额外 `text-align:center`**
- 屏幕态：灰底 `#c0c0c0` + 页面卡片阴影 + `[data-r2-el]:hover` 蓝色虚线框（元素微调的交互提示）

**⚠️ `nth-child(3)` 那个坑实测坐实了，而且比预想严重**（`07` §5.4）：

`.receipt2-meta-row span:nth-child(3) { padding-left: 6mm }` 选的是**第 3 个渲染出来的 span**，
与元素身份无关。实测四种配置：

| 配置 | `padding-left:6mm` 落在谁身上 |
|---|---|
| 默认 | `address`（安装地址）✅ 这正是设计意图——地址最长，缩进避让 |
| `metaOrder` 把 address 提前 | **`tel`（电话）** ❌ |
| 关掉 `showTel` | **`productionDays`（生产天数）** ❌ |
| 只留 `client` | 规则落空（不足 3 个 span） |

即：**拖动排序或动任一开关，那 6mm 缩进就漂到别的字段上**——没有任何东西把它绑在「安装地址」上。

**新版实现建议**：给「安装地址」一个类（如 `.r2-meta-address`）挂这条样式，**不要复刻 `nth-child(3)`**。
若要逐像素对齐旧版，才需要连「不足 3 个 span 时不生效」一起复刻。

（附带：`.receipt2-meta-row` 类规则里写死的 4 列 `1.2fr 1.5fr 1.7fr 0.8fr` 是**死声明**——
每行都有内联 `grid-template-columns` 覆盖它。）

### 4.3 分页

**先用隐藏 DOM 实测高度再算**（不是估算）：
量出「非明细非页脚的固定开销」`V` 与各 `<tr>` 自然高，再贪心打包。
中间页按「不带页脚」的预算装，只有最后一页带页脚；剩余内容连页脚一起装得下就收进当前页。

→ 已做成**可执行参考实现 + 用例表**：`08-pagination.md` + `paginate.mjs`
（自带断言，`node paginate.mjs` 直接跑）。**实现时逐字移植它，不要照散文重写。**

**三条经实证的发现**（`08` §5，都推翻了原始描述）：

1. **补丁③ `if (l <= y) l = y + 1` 是死代码** —— 20 万组随机模糊测试 **0 次触发**。
   `l` 初值即 `y`，while 条件第一项 `l > y` 为假 → 短路 → 循环体必执行一次 → 退出时恒有 `l ≥ y+1`。
   「每页至少一行」的保证来自这里，**不是**来自补丁③。移植时可删，但注释要写对。
2. **补丁④ `if (l >= len && len - y > 1) l = len - 1` 的语义与它看起来的相反** ——
   它是**强制把最后一行切出去**留给带页脚的末页，**不是**「别把最后一行单独留下」。
   原因：页脚只在最后一页渲染，而进到这一步说明当前页已不可能是末页，必须给末页留至少一行，
   否则页脚无处安放。**不能删**。建议注释写成 `// 必须给带页脚的末页留至少一行`。
3. ⚠️ **单行本身就超过一整页时，旧版静默裁掉** —— 不切分、不缩字号、不告警。
   这是本次分析里**最需要产品决策**的一点（见 §10 决策项 7）。

### 4.4 `data-shrink-fit`

**不是分页降级，是行内自适应**：只作用于 meta 区前 3 个 span，客户名/地址太长就压低字号。
步长 0.5px，下限 `max(6px, 原字号×0.5)`，判据 `scrollWidth > width + 1`。

⚠️ **它第一步会把内联 `font-size` 整条清空** → 在元素微调里给这 3 个字段设的字号**会被抹掉**。
旧版如此，复刻需保留该行为以对齐像素（但要写进注释，否则后来人以为是 bug）。

---

## 5. 打印链路

**三条浏览器路径 + 一条 Electron 路径**（详见 `03-print-chain.md`）：

| 入口 | 载体 | 备注 |
|---|---|---|
| `printFromContainer(容器)` | clone 预览 DOM → 隐藏 iframe | **Home「打印」按钮走这条**。等图片 → 500ms → `print()` → 1s 后移除 |
| `ye()`（内部） | 从数据重建 HTML → iframe | 需要补 `[data-shrink-fit]` 缩字 |
| `printSilent(容器)` | Electron IPC | **仅 Electron**，横向时多插一层 `.r2-page-wrap` |
| `printDirect()` | —— | **死代码**，Home 从未调用（全库 0 调用点），内含一句被丢弃的 `JSON.stringify` 调试残留 |

**没有「纸型 → 边距」对照表**：`@page { size: …; margin: 0 }`，内边距恒定 `4mm 4mm 3mm`。
横向不是交给打印机，而是 `@page size` 交换成 `Hmm Wmm` + `transform: translateY(Wmm) rotate(-90deg)`。

**Electron 专属、新版整体去掉**：

| 能力 | 去掉后 |
|---|---|
| `getPrinters` 打印机组 + `receipt2_selected_printer` | 整块 UI 不渲染（原版已被 `W.value ?` 包住，天然降级） |
| 「直接打印」按钮 | **建议新版直接不渲染这颗按钮** |
| `copies` 份数 | 浏览器路径本就完全忽略它 |
| `.r2-page-wrap` 包装层 | 见下 |

**关于横向旋转块，实测更正了一处过头结论**（`07` §5.3）：
原先写「旋转规则命中不到任何元素、是死代码」——**不对**。`@media print` 在 landscape 下产出四条
**并列的顶层规则**，最后一条 `.receipt2-page { position:absolute; transform: … rotate(-90deg) }`
**不带 `.r2-page-wrap` 前缀**，所以在浏览器路径下**照样命中、内容照样旋转**。
真正落空的只是 wrap 专属的两条：`overflow:hidden` 裁切与 `page-break-after:always` 分页。
⇒ 症状是**横向多页的分页/裁切异常**，不是「完全不旋转」。

---

## 6. 编辑交互（**两套并列，别合并**）

| | A. 元素微调面板（组件自带） | B. 「编辑收据单」（Home 的 contentEditable） |
|---|---|---|
| 触发 | 点预览里任一 `data-r2-el` 元素 | 点「编辑收据单」按钮切模式 |
| 改什么 | **样式**：X/Y 偏移(mm)、字号、宽度、显隐 | **文字**：就地改内容 |
| 持久化 | ✅ 写 `receipt2_element_configs` | ❌ **不持久化** |
| 打开方式 | 浮层（`Teleport to body`），遮罩 `z-index:9998` | 直接在预览上编辑 |

**字体调节弹窗**（「字体调节」按钮）：6 个字号 + 品牌（开关+名称，maxlength 40）+
纸张设置（宽/高 50–500、方向、8 个常用尺寸预设按钮）+ 头部元素（3 行：开关 + 左/右单选，
单选在开关关闭时 disabled）+ 信息栏（4 项拖动排序）+ 底部元素（金额/说明开关）+ 打印机组（Electron）。
三个底部按钮：`重置默认`（**只重置草稿，不写盘不关窗**）/ `取消` / `保存`。
控件全清单与行号见 `04-font-dialog-edit.md` §1.2。

**列宽拖拽**：手柄只挂在**前 9 个** `th` 上，拖动时**成对调整相邻两列**，各列下限 3%，
mouseup 时实测重算全部 10 列并保留 1 位小数。

---

## 7. 对外 API 面

Home 真正调用的 **8 个**（`05` §B5）：

`buildReceipt2Html` · `openFontDialog` · `initColumnResize` · `initElementEditor` ·
`printFromContainer` · `printSilent` · `copyPreviewToClipboard` · `exportPreviewToPdf`

另外 6 个 Home 一次都没调（`exportReceipt2PdfToBrowserPrint`、`printDirect`、`refreshPreview`、
`destroyElementEditor`、`resetAllElementConfigs`、`isElectronEnv`）。
其中 **`refreshPreview` 是组件内部刷新预览的关键通路，功能上不能省**。

---

## 8. 依赖

| 库 | 用途 | 是否在打印链路上 | 新版建议 |
|---|---|---|---|
| html2canvas 1.4.1（CONFIRMED） | 「复制到剪贴板」截图为 PNG | ❌ 仅导出 | 需新增依赖才能复刻 |
| jsPDF（INTERPRETED，别名链未走通） | 「导出 PDF」 | ❌ 仅导出 | 同上 |
| Element Plus | 弹窗/表单控件 | — | **新版用 Naive UI 替代（既定偏好）** |

复制/导出**都不看 Electron 门槛**，纯浏览器实现（剪贴板需要 https/localhost 安全上下文）。

---

## 9. 新版实现方案建议

**做**（复刻）：

1. `components/Receipt2Sheet.vue` —— 渲染 + CSS 发生器（逐字移植的 CSS 原文）
2. `utils/receipt2Payload.ts` —— 订单 → 收据单2 的数据模型 + 分页
3. `components/Receipt2SettingsDialog.vue` —— 字体调节弹窗（6 字号 + 纸张 + 显隐 + 排序 + 品牌）
4. 元素微调浮层 + 列宽拖拽
5. 接进 `PrintDrawer`：预览容器 + `printFromContainer` 等价物（iframe 打印）
6. 配置持久化 —— **建议落后端（租户级）而非 localStorage**，理由：localStorage 是单机单浏览器，
   换台机器配置就没了；而后端已有 `print_templates` 这类租户级配置的先例

**不做**（做减法，理由充分）：

| 项 | 理由 |
|---|---|
| Electron 静默打印 + 打印机选择 + 份数 | 新版只有浏览器，整条链路无载体 |
| `printDirect` / `exportReceipt2PdfToBrowserPrint` / `destroyElementEditor` / `resetAllElementConfigs` | 旧版**死代码**，0 调用点 |
| contentEditable「编辑收据单」 | **不持久化**（改完刷新就没），复刻它等于复刻一个假功能。若用户确实需要，应当做成**真的能存**的编辑 |

---

## 10. 决策记录（用户 2026-09-17 拍板）

**总基调：完整复刻，保真度优先。**

| # | 问题 | 决定 |
|---|---|---|
| 1 | 配置存哪 | **照抄 localStorage**（7 个键同名同结构） |
| 2 | 「编辑收据单」contentEditable | **原样复刻**，包括「改了不持久化」 |
| 3 | 复制成 PNG / 导出 PDF | 两个都做。「复制成 PNG」引 `html2canvas`；「导出 PDF」**不引 jsPDF，改走浏览器打印对话框**（用户 2026-09-17 追加决定，理由：jsPDF 只服务这一颗按钮、体积不小，而打印对话框本身就能另存为 PDF，且产出的是**矢量文字**、可选中可搜索，比整页贴图更好。代价：文件名/位置由浏览器定，且会先弹对话框） |
| 4 | 交付范围 | **一次做完整版**（本体 + 打印 + 字体调节 + 元素微调 + 列宽拖拽） |
| 5 | 字体族是否可配 | **不做**（旧版没有，属新增功能） |

**由本次分析新提出、按「完整复刻」基调推定处理的三项**（如与预期不符请指出）：

| # | 问题 | 处理 |
|---|---|---|
| 6 | **横向多页**：`.r2-page-wrap` 只在 Electron 路径生成，浏览器路径下横向多页的分页/裁切会异常 | 新版两条路径**都插包装层**。这属于修 bug 而非偏离——旧版是「能转但分页不对」，照抄没有意义 |
| 7 | **单行超过一整页**：旧版**静默裁掉**（不切分、不缩字号、不告警） | 先照抄（对齐保真度），但**留 TODO**。若你要，可加成「缩字号或告警」 |
| 8 | **`nth-child(3)` 的 6mm 缩进**漂移问题 | 新版**绑到「安装地址」这个字段上**（加类名），不复刻位置依赖。视觉在默认配置下与旧版一致 |
| 9 | **`K(null)` → 字号掉到最小值** | 照抄（保真度优先），但代码里注明这是旧版行为 |
| 10 | **`metaOrder` 不去重**导致客户渲染两次 | 新版**补 `Set` 去重**。这是明确的 bug，且只在脏数据下触发，修它不影响正常路径的保真度 |

---

## 11. 验证情况与未确认清单

**验证做到什么程度**（这决定了下文结论的可信度）：

| 验证手段 | 覆盖 |
|---|---|
| 逐行比对解码产物 | 996 处字符串还原，**0 处未命中、0 处残留** |
| Node 实跑配置清洗器 | `K`/`Z`/`X`/`te`/`D`/`L`/`M`/`Q` 全跑，**推翻 2 条推断**（`01` §9） |
| Node 实跑渲染器 | 默认 + 非默认两套配置的 HTML/CSS **黄金样本**，与文档骨架核对 **19/20 一致**（`07` §5） |
| Node 实跑分页 | 参考实现 + 用例表 + 20 万组模糊测试，**推翻 2 条描述**（`08` §5） |
| 未能验证 | 需要真实浏览器的部分：实际排版、横向多页打印行为 |

**未确认清单**（没有猜着填）：

1. `electronAPI.*` 的契约 —— 主进程代码不在仓库，全库只有 6 处调用、无定义。（新版不接，无影响）
2. 横向多页在浏览器下的**实际**排版后果 —— CSS 文本与选择器形状已实证，但「分页/裁切到底怎么错」
   是推断，本环境无浏览器无法实证。（决策项 6 已按「做对」处理，不影响实现）
3. 分页里 `pin-*-90` 的 1px 修正量的设计意图 —— 读不出原意，照抄或取 0 都只差 1px。
4. `w` = jsPDF 的别名链没走通（仅 API 形态吻合）。
5. `remark`/`pricing` 对应的中文键名未逐字验证（`Hui.formatted.js` 用另一套字符串表）。

**黄金样本与文档唯一的不一致**（`07` §5.2）：`Ve()` 里金额块 `</div>` 与说明块
`<div class="receipt2-declaration"` 之间**没有换行**（文档里画成了两行）。
做逐字比对时**以样本为准**，不影响 DOM 结构与观感。

---

## 12. 命名：用户看到的是「自定义收据单」，不是「收据单2」

| 叫法 | 出处 |
|---|---|
| **自定义收据单** | **用户可见**：旧版打印选项抽屉里那个入口按钮的字面量（`dr[1336]` = ` 自定义收据单 `），归在分组 `自定义单据：`（`dr[972]`）下 |
| `FinalReceipt2` | 该入口设定的模板 mode（`dr[761]`），技术标识 |
| `Receipt2PrintManager` | 组件源码名；其设置弹窗自称「收据单2 设置」 |

「收据单2」这个叫法**只出现在源码/弹窗内部**，旧版界面上对用户显示的是「自定义收据单」，
与同族的「自定义合格标签 / 自定义生产单 / 自定义生产单2 / 自定义玻璃合片单」命名法一致。

新版：**用户可见文案一律用「自定义收据单」**（Home 工具条、抽屉标题、设置弹窗、
提示语、打印 iframe 的 `<title>`）；**内部命名保持 `receipt2` / `Receipt2*`**，
以便与旧版源码对照查证。

---

## 13. 实现落地（2026-09-17）

代码已写完并提交。**新增依赖只有 `html2canvas`**（`jspdf` 按用户决定去掉了）。

| 文件 | 内容 |
|---|---|
| `app/src/utils/receipt2/` × 9 | types / defaults / sanitize / storage / css / html / paginate / print / order |
| `app/src/components/Receipt2Drawer.vue` | 编排：预览 + 工具条（打印 / 字体调节 / 编辑收据单 / 复制 / 导出PDF） |
| `app/src/components/Receipt2SettingsDialog.vue` | 6 字号 + 品牌 + 纸张 + 8 个常用尺寸 + 头部元素 + 信息栏排序 + 底部元素 |
| `app/src/components/Receipt2ElementEditor.vue` | 点选元素的几何微调浮层 |
| `app/src/composables/useReceipt2Preview.ts` | 缩字自适应 + 列宽拖拽 |
| `app/src/views/Home.vue` | 工具条新增「收据单2（N）」 |

### 已验证（可重跑，脚本在 `docs/receipt2-recon/`）

| 脚本 | 对齐物 | 结果 |
|---|---|---|
| `check-css.mjs` | 旧版实跑产出的 CSS 夹具 | **两个朝向逐字节相等**（4888 / 4221 字符） |
| `check-html.mjs` | 黄金样本 §2.1 | **逐字节相等**（2321 字符） |
| `check-paginate.mjs` | 参考实现 `paginate.mjs` | 对拍 **200,011 组，0 组不一致** |
| （清洗器） | 逆向报告 §9 的实测用例表 | ALL PASS |
| `e2e-receipt2.mjs` | 真实订单（后端 :3000） | 数据管线通，10 列映射逐项对上 |

`vue-tsc --noEmit` 零错、`npm run build` 通过。

### ⚠️ 尚未验证 —— 需要人工在浏览器里看

1. **真实排版与分页**：分页要量真实 DOM 行高，Node 里跑不了（本机没装 headless 浏览器）。
   行高测量、翻页位置、`@page` 是否铺满 —— **全部只能靠人眼**。
2. **打印/导出**：`printFromContainer` 的 iframe 时序、横向纸型的旋转。
3. **交互**：元素微调浮层的即时预览与三个按钮、列宽拖拽、设置弹窗各控件、contentEditable 编辑模式。

### 实现期发现并已修正的两处

- `findPaperPresetKey` 一度有**两份实现**（规格与实现撞车），已收成一处。
- 旧版 `measure()` 里 rAF 回调抛错会让 Promise **永不 settle**（`finally` 根本不执行、
  量测节点永不摘除）。新版加了 reject 路径 —— 属有意的行为改进。

---

## 附：关于行号引用的一个提醒

本次工作中 `legacy/js/Home.formatted.js` **被重新生成过**（修好了生成器不认识正则字面量的问题，
文件从 579737 → 657656 字节，见提交 `f5c873ad`）。因此：

- **早于重生成**写下的、对 `Home.formatted.js` 的行号引用**会整体偏移**，不能直接照查；
- 对 `legacy/js/Receipt2.deobfuscated.js` 的引用**不受影响**（该文件本次未再改动）；
- 已经核过一遍：`03-print-chain.md` 的 14 处与 `06-style-geometry.md` 的引用**全部有效**；
  `02-render-pipeline.md` 有 2 处失效，**已就地修正**（`:2281`→`:2282`、`:2373`→`:2372`）。

引用 `Home.formatted.js` 时，**建议改用可 grep 的锚点串**（如 `ya="receipt2_element_configs"`）
而不是行号 —— 该文件是从混淆产物自动生成的，随时可能再变。

---

## 附：材料索引

| 文件 | 内容 |
|---|---|
| `docs/receipt2-recon/01-config-persistence.md` | 配置与持久化（含 **§9 Node 实跑实证**） |
| `docs/receipt2-recon/02-render-pipeline.md` | 渲染管线、HTML 骨架、分页、字段映射 |
| `docs/receipt2-recon/03-print-chain.md` | 三条打印路径、页边距、Electron 边界 |
| `docs/receipt2-recon/04-font-dialog-edit.md` | 字体调节弹窗、元素微调、contentEditable |
| `docs/receipt2-recon/05-export-home-api.md` | 导出/复制、expose API 面、Home 调用矩阵 |
| `docs/receipt2-recon/06-style-geometry.md` | **完整 CSS 原文**、类名全表、版面几何 |
| `docs/receipt2-recon/07-golden-sample.md` | 实跑产出的 HTML/CSS 黄金样本（逐字参考） |
| `docs/receipt2-recon/08-pagination.md` | 分页参考实现 + 测试用例表 |
| `legacy/js/Receipt2.deobfuscated.js` | 已解码的旧版源码 |
| `legacy/decode-receipt2.mjs` | 解码脚本（可重跑） |
