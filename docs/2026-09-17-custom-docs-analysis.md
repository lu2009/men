# 自定义单据（其余四张）· 逆向定稿与实现方案（2026-09-17）

> **这是什么**：旧版 Home 打印选项抽屉里「自定义单据：」分组下的 5 张自绘单据。
> **自定义收据单已实现完毕**（见 `docs/2026-09-17-receipt2-analysis.md`），本文处理**其余四张**。
>
> 盘点见 `docs/2026-09-17-custom-documents.md`；详尽逆向（含逐字 HTML/CSS、27 条差异对照）
> 在 `docs/custom-docs-recon/`。本文只做**结论汇总 + 方案 + 决策项**。

---

## 0. 一页结论

| 问题 | 答案 |
|---|---|
| 四张都要重写数据层吗 | **不用**。行数据由 Hui 的 `calculateXxx()` 产出，而新版 `printPayloads.ts` 的 `glassProduces()`（`:748`）等**已是同一套引擎实现** |
| 四张要写四遍吗 | **不用**。骨架四张完全一致（见 §2），配置只有**三种形状**（见 §3） |
| 要引新依赖吗 | **不用**。二维码用项目已有的生成能力，不为这一处再引 `@zxing/library` |
| 与收据单同构吗 | 骨架同构，但**分页 / 配置 / 配置界面三块都不一样**（27 条对照见 `02-glasssheet2.md` §12） |
| 最大未知量 | 真实浏览器下的分页排版（本机无 headless 浏览器，只能人眼看） |

**试点选自定义玻璃合片单**（1860 行，最小之一），跑通后再复用到其余三张。

---

## 1. 五张的两种「编辑」——别合并

> ⚠️ 初版盘点只写了「布局编辑器」，**漏了另一半**。每个 `ic` 激活后工具栏**同时**出现两颗编辑按钮：

| | A. 编辑**行数据** | B. 编辑**版式** |
|---|---|---|
| 弹窗定义在 | **Hui chunk**（`ProductionEdit` / `ProductionEditOld` / `LabelEdit`） | 各组件自带 `openLayoutEditor` |
| 改什么 | 订单行的字段值 | 纸张 / 列 / 字号 / 边距 |
| 持久化 | **不**（只改内存里的行数组） | 写 localStorage |

| ic | A 的按钮 | B 的按钮 |
|---|---|---|
| 13 合格标签族 | `编辑标签` | `编辑布局` |
| 14 自定义生产单 | `编辑生产单` | `编辑布局` |
| 15 自定义生产单2 | `编辑生产单` | `布局设置` |
| 16 自定义玻璃合片单 | `编辑合片单` | `布局设置` |

**三套 A 弹窗的 props/emits 签名完全一致，但数据形状不同**（平铺行 / oldSheet 嵌套族+双联 / 标签行）。
⇒ **新版只做一个共用弹窗组件**（列定义与 `brFields` 做成参数），另两个的转换各留扩展点。

**已知的三个坑**（`02-glasssheet2.md` §15.2）：

1. 弹窗的列是**硬编码按下标字段名**的，不是按单据配置生成 ⇒ 玻璃合片单的「客户」「方向」
   在这弹窗里**改不到**；且「门扇材料」实际是它的「玻璃尺寸」列（**同字段两个列标题**）；
   「门框材料」「亮窗·扣板」对这张单是**多余列**（`glassProduces()` 根本不产这两个字段）。
2. 只有 5 个字段做 `<br>`↔`\n` 转换（`basicInfo`/`doorsheet`/`doorframe`/`windows`/`door`），
   `remark`/`OrderID`/`doorImg` **不转**；`LabelEdit` 一个都不转 ⇒ 建议做成 `brFields` 参数。
3. 玻璃合片单的 `onSave` **只改 Home 的内存行，不回写 Hui 汇算结果** ⇒ 下次从 Hui 重新
   `calculateGlass()` 时改动**会被覆盖**。

---

## 2. 共用骨架（四张完全一致，抽一份）

1. **expose 契约**：`buildXxxHtml(data)` / `refreshPreview()` / `openSettingsDialog()` /
   `openLayoutEditor()` / `printDirect()` / `printSilent()` / `isElectronEnv`
2. **props 契约**：`getData` / `isActive` / `onPreviewHtmlChange`（合格标签另加 `onFixedQuantityChange`）
   —— 注意是 **`getData`**，不是收据单的 `getCustomers`
3. **`printDirect` 骨架**：ElLoading → 拼 HTML → iframe → write → 等 img → **300ms** → focus+print
   → **1000ms** 移除
4. **`printSilent` 骨架**：Electron 守卫 → ElLoading → `electronAPI.silentPrint(...)`
5. **布局编辑器骨架**：全屏 dialog + footer[取消/重置默认/保存布局] + 左表单右预览；
   打开=深拷贝到草稿，保存=深拷贝回生效+落库+关窗，重置=`草稿=默认`
6. **设置弹窗骨架**：dialog + tabs（**一律含「纸张」与「打印机」**）
7. **打印机块**：`getPrinters()` + 刷新按钮 + 「已选：」+ 失败文案
8. **归一化**：默认值 ⊕ 存档值 → 逐键 clamp，白名单合并（丢未知键）
9. **落库**：`try{ setItem(KEY, JSON.stringify(x)) }catch{}`

## 3. 逐张不同（必须各自处理）

| 维度 | 差异 |
|---|---|
| **配置形状** | **三种 schema**：QL=自由定位 `fields`；PS=`headerFields`+`tableConfig`+`doorImgBox`；**PS2/GS2=纯列模型** |
| **编辑器 UI 家族** | 三个：A(QL) / B(PS) / **C(PS2=GS2，内部逐字相同)**——C 家族只需 `prefix`+`defaults` 两个参数 |
| 弹窗尺寸 | QL=980px 浮层；其余三张全屏 |
| 拖拽 | QL 有；PS 有 3 套；**PS2/GS2 没有**（列排序是 ↑↓ 按钮交换） |
| 就地编辑 / 固定张数 / 打印旋转 | **只有 QL 有**（Home 也不调就地编辑那四件套） |
| `getItemsPerPage` | **只有 PS 有** |
| 字号机制 | 收据单是 6 类全局；**GS2 是每列独立 `fontSize`(pt)** + 表头 `headerFontSize` |
| 列宽机制 | 收据单是 10 个裸百分比+拖拽；**GS2 是每列绝对 `widthMm`，只能输入框改** |
| 颜色 | 收据单硬编码；**GS2 每列 `fontColor` + 全局 `borderColor` 可改** |
| `orientation` 字段 | **有字段、无消费者**（照抄即可，别指望它生效） |

## 4. 试点：自定义玻璃合片单

- **配置 2 个键**：`glass_sheet2_template_v1` / `glass_sheet2_printer_v1`
- **配置结构**：嵌套 `{paper, table{columns[]}, print}`
- **设置弹窗只有「纸张 + 打印机」两页**，无字号/品牌/显隐/排序
- **版式编辑**：全屏弹窗，8 条 scoped CSS 在 `legacy/css/Home-97d96482.css`
- **分页**：预算**硬编码** `heightMm - 2*paddingMm - 8 - 10`，**每页相同**（这张没有页脚）；
  量测走隐藏 iframe + `document.write`，带 **2000ms 超时**；没有收据单那两个补丁
- **打印**：`printDirect()` **无参**（重建 HTML 字符串），不是收据单那种 clone 预览 DOM；
  **不做横版旋转**（直接把宽高写进 `@page` 和内联样式）
- **二维码**：17mm×17mm，本机生成 SVG，**带单号字幕**（按 `/` 折行）
- **门图**：`doorImg` 列固定 `width:100%`；**没有**收据单那套 `data-shrink-fit`

---

## 5. 本次已拍板的决策

| # | 问题 | 决定 | 理由 |
|---|---|---|---|
| 1 | `paddingMm` 的 `??` 语义（`undefined` → `NaN` → **内联 `padding:NaNmm` + 分页退化成单页**） | **修**，回落到默认 3 | `NaN` 从来不是有意值；新版是全新 app、localStorage 不会带旧数据过来，这条路径不可达，修它零风险 |
| 2 | 二维码尺寸 **预览 15mm / 打印 17mm** 不一致 | **统一 17mm** | 编辑器预览的意义就是所见即所得，留着 15 会让预览和实打对不上 |

---

## 6. 实现方案

```
app/src/utils/customdoc/                  ← 四张共用的底座
  ├─ useDocLayout.ts      布局编辑器状态机（草稿/生效/保存/重置/落库）
  └─ print.ts             printDirect / printSilent 骨架
app/src/components/
  ├─ DocLayoutDialog.vue  布局编辑器壳（dialog + footer + 左右两栏）
  ├─ DocEditDialog.vue    共用「编辑行数据」弹窗（列定义 + brFields 参数化）
  └─ GlassSheet2*.vue     玻璃合片单（试点）
app/src/utils/glasssheet2/
  ├─ types.ts / defaults.ts   配置模型与默认值
  ├─ sanitize.ts              归一化（含 §5 决策 1）
  ├─ css.ts / html.ts         逐字移植
  └─ paginate.ts              硬编码预算那套
```

**复用**：数据层直接用 `printPayloads.ts` 的 `glassProduces()`，不重写。

---

## 7. 未确认（没有猜着填）

1. **`table-layout:fixed` 下列宽之和（默认 230mm）≠ 可用宽（291mm）时浏览器怎么分配** ——
   **直接影响逐像素复刻**，本机无浏览器，实现后必须人眼看。（INTERPRETED：几乎肯定按比例放大）
2. **量测算式 `v = (W-2P) / div.offsetWidth` 里 `querySelector("div")` 取到的是不是包装 div** ——
   未实测。
3. **`8` / `10` 两个预算常数的语义** —— INTERPRETED，不是读出来的。
4. **`getImage()` 的返回形态**（dataURL / http URL）与新版用 `l.image_url` 是否等价 —— 未验证。
5. **`a()` 里 `orientation` 给谁用** —— 全组件 0 消费者是 CONFIRMED，但为什么留着是推断。
6. **二维码库的替换**：旧版用 `@zxing/library`，新版用项目已有的生成能力 ——
   **能对齐的只有 `viewBox` / `preserveAspectRatio="xMidYMid meet"` / 外边距 0.5mm / 尺寸 /
   `MARGIN=1`**，图案本身是否逐位一致未验证。

---

## 附：材料索引

| 文件 | 内容 |
|---|---|
| `docs/2026-09-17-custom-documents.md` | 五张的盘点 + 卡片入口→ic 全映射 |
| `docs/custom-docs-recon/01-skeleton.md` | **共用骨架对照表**（哪些共用/哪些逐张不同） |
| `docs/custom-docs-recon/02-glasssheet2.md` | **玻璃合片单全量逆向**（含 §12 差异对照 27 条、§15 编辑弹窗） |
| `docs/custom-docs-recon/gs2-default.css` | 玻璃合片单 CSS 实产原文 |
| `legacy/js/*.deobfuscated.js` | 五张的已解码源码 |
| `legacy/decode-home-component.mjs` | 解码脚本（通用版，可重跑） |
