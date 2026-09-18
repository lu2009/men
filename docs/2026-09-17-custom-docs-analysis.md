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
| 最大未知量 | ~~真实浏览器下的分页排版~~ —— **2026-09-18 用户实机确认无误** |

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

## 8. 实现落地（试点：自定义玻璃合片单）

代码已写完并提交。**新增依赖只有 `qrcode-generator`**（~10KB 零依赖，用户拍板选的）。

| 文件 | 内容 |
|---|---|
| `app/src/utils/glasssheet2/` × 8 | types / defaults / sanitize / storage / css / html / paginate / index |
| `app/src/utils/glasssheet2/qr.ts` | `qrcode-generator` → 核心层 `QrEncoder` 的接线 |
| `app/src/utils/glasssheet2/print.ts` | `printDirect` 等价物（无参重建 HTML，300ms/1000ms 时序） |
| `app/src/components/GlassSheet2Drawer.vue` | 主抽屉（预览 + 工具条） |
| `app/src/components/GlassSheet2LayoutDialog.vue` | 全屏布局编辑器 |
| `app/src/components/GlassSheet2SettingsDialog.vue` | 打印设置（纸张 / 打印机两页） |
| `app/src/components/DocEditDialog.vue` | **共用**「编辑行数据」弹窗（四张单据共用） |
| `app/src/views/Home.vue` | 工具条「自定义玻璃合片单（N）」 |

### 已验证（可重跑，脚本在 `docs/custom-docs-recon/`）

| 脚本 | 对齐物 | 结果 |
|---|---|---|
| `gs2-csscheck.mjs` | `gs2-default.css` 夹具 | **逐字节相等**（1739 字节） |
| `gs2-htmlcheck.mjs` | 逆向报告 §3 逐字模板 | 26/26 |
| `gs2-logiccheck.mjs` | 行构造 / 单元格三形态 / 文档外壳 | 34/34 |
| `gs2-logiccheck2.mjs` | 量测节点 / 二维码 / 等图超时 | 15/15 |
| `verify/e2e.mjs` | 真实订单（后端 :3000） | 数据管线通，渲染含二维码 |
| `verify/qrprobe2.mjs` | 二维码编码 | 出码，属性与 §9.2 逐项对齐 |

`vue-tsc --noEmit` 零错、`npm run build` 通过。

### ✅ 浏览器实机确认（用户，2026-09-18）

用户已在浏览器里打过一遍，**确认无误**。下面几条因此从「未验证」转为**已确认**：

1. 真实排版与分页（行高测量、翻页位置）——包括**空段占位抬高行高后切页位置仍正确**
2. `table-layout:fixed` 下列宽之和（230mm）≠ 可用宽（291mm）时的浏览器分配
3. 二维码扫得出来
4. 打印时序、布局编辑器与打印设置弹窗的交互

> 原「未验证」清单保留在下方仅为留痕 —— 它记录的是**当时为什么验不了**
> （本机无 headless 浏览器），不是遗留问题。

### ⚠️ 原「尚未验证」清单（留痕）

1. **真实排版与分页**：分页要量真实 DOM 行高，Node 里跑不了。
2. **`table-layout:fixed` 下列宽之和（默认 230mm）≠ 可用宽（291mm）时浏览器的分配** ——
   直接影响逐像素复刻。
3. **量测算式 `querySelector("div")` 是否取对包装 div**。
4. **打印**：iframe 时序、等图片加载。
5. **交互**：布局编辑器各控件、打印设置弹窗。

### 实现期发现并记下的三个点

1. **二维码的 `viewBox` 与旧版数值不同但等价**：旧版 zxing 是 `0 0 180 180`（按请求尺寸缩放），
   新版是 `0 0 23 23`（21 模块 + 两侧各 1 模块静默区）。外层 `<svg>` 固定 17mm +
   `preserveAspectRatio="xMidYMid meet"`，**矢量缩放后成图一致** —— 变的只是坐标系尺度。
2. **Node 里没有 `DOMParser`**，`qr.ts` 会降级成「只画字幕」。这是正确降级，但在 Node 里验证要自己补桩。
3. **`vue-tsc` 抓不到缺失的 `.vue` 导入**（`env.d.ts` 有 `declare module '*.vue'` 通配）⇒
   **改组件导入后 `vue-tsc` 与 `npm run build` 都要跑**。

---

## 8b. 第 3 张：自定义生产单2（已完成）

施工图 `docs/custom-docs-recon/01-diff.md`（43 成员逐函数对照）证明它与玻璃合片单
**约 77% 逐字相同** ⇒ 走「抽底座 + 参数化」，**不复制一份**：

- `app/src/utils/docsheet/` —— **C 家族公共底座**（profile 参数化：前缀 / 存储键 / 标题 /
  默认配置工厂 / **空段占位开关** / 单元格 case 表）
- `app/src/utils/glasssheet2/` / `productionsheet2/` —— 各自的 profile 实例
- `app/src/components/DocSheet{Drawer,LayoutDialog,SettingsDialog}.vue` —— 共用组件，
  各单据只剩薄包装 + 一份 `*UiProfile.ts`

### 四处差异各自落到哪

| # | 差异 | 落到哪 |
|---|---|---|
| 1 | 行数据来源（`calculateGlass` → `calculateReceipt`） | **不在核心层** —— 新版用 `productionProduces()`，落在 UI profile 的 `produceRows(ctx)` |
| 2 | 列集 8 → 9 列 | 核心层 `defaults` profile |
| 3 | 空段占位（PS2 补 `&nbsp;`） | 核心层「空段占位」开关 |
| 4 | 前缀 / 存储键 / 文案 | profile |

### 验收

| 脚本 | 结果 |
|---|---|
| `gs2-csscheck` / `gs2-htmlcheck` / `gs2-logiccheck` / `gs2-logiccheck2` | byte-equal · 26/26 · 34/34 · 15/15（**抽底座后零回归**） |
| `ps2-csscheck` / `ps2-htmlcheck` / `ps2-logiccheck` | byte-equal · 38/38 · 48/48 |
| `verify/ps2-e2e.mjs` | 真实订单通，**空段占位在真实数据上复现 3 处** |

### 两条推翻既有结论的发现

1. **`doorframe` / `windows` 不是「多余列」**。上一份报告说「`glassProduces()` 根本不产」——
   那是 `calculateGlass` 的行为；PS2 用的 `calculateReceipt` **会产**，实测行[0] 两列都有值。
2. **PS2 的 `o.length === 0` 是死分支** —— `String(x).split()` 恒返回 ≥1 元素，
   它的多行渲染**永不可能返回空串**。

---

## 8c. 第 4 张：自定义生产单（ic=14，已完成）

施工图 `docs/custom-docs-recon/01-ps.md`（1192 行）。**这张不属 C 家族**，与前两张的路子完全不同：

| | PS2（C 家族） | **PS（本单）** |
|---|---|---|
| 与参照物的差异 | **4 处**（行来源 / 列集 / 空行语义 / 贴皮） | **没有参照物** |
| 核心层复用 | 前缀替换 | **CSS / HTML / 分页 / 清洗 / profile 全须新写** |
| 分页 | 量测隐藏 iframe（与 GS2 逐字节同） | **解析式估高，无 iframe**；且**首页与后续页预算不同** |
| 清洗 | 内联在 `onMounted`，按**下标**合并 | 独立 `z()`，按 **key 白名单**合并，**读盘与写回两端都调用** |
| 每页条数 | 无 | **`print.itemsPerPage`（1/2）+ 配对** |

**底座能原样用的只有 4 小件**：`escapeHtml` / `waitForImages` / `createQrEncoder` / `storage.ts` 三个函数。
另加底座 2 处参数化（二维码回退 viewBox、打印的文档构造）。

⚠️ **类名规则对不上**（施工图标为「最容易踩的一处」）：PS 产出 HTML 只有 `ps-root`/`ps-sheet`，
编辑器类是 **`ps-layout-editor-*`**（带 `editor`、无 `2`），与 C 家族的 `ps2-layout-*` 不同 ——
底座的 `ns + '-layout-wrap'` 推导对 PS 是错的，必须用**显式常量表** `PS_CLASSES`。

### 验收

| 脚本 | 结果 |
|---|---|
| `ps-csscheck` | **逐字节相等**（709 字节 / 8 条规则） |
| `ps-htmlcheck` / `ps-logiccheck` | 58/58 · 98/98 |
| `gs2-*` / `ps2-*` 共 7 个 | **全过**（底座被改仍零回归） |
| `verify/ps-e2e.mjs` | 真实订单通，16 行 → 配对 8 行，渲染含 16 个二维码 |

### 数据层零新代码

行来源是旧版 `calculateReceiptOld()` → 新版 `oldSheetProduces(paired)`（报告做了逐键比对）。
⚠️ **`orderID` 是小写 d**（ic=15 的 `calculateReceipt` 用大写 `OrderID`）——**两张的数据层不通用**。

### 有意偏离

**不复刻**旧版 ic=14 那处脏数据回环：保存时把「配对过的行」又配对一次 ⇒ 一次汇算 ≥4 张订单
且开「2 条/页」时多出 `orderID11` 这类脏键。新版配对只在一处做、编辑完不重跑。

---

## 9. 下一步：最后一张

| ic | 组件 | 怎么复用 |
|---|---|---|
| 13 | 合格标签族 | **A 家族**，配置最丰富（逐字段字体、固定张数、就地编辑），且**一个组件挂三个入口**（自定义合格标签 / 平开合格标签 / 推拉合格标签，同一组件只换数据过滤）。数据源是 `lable()`，新版对应实现**待查**。 |

底座 `utils/docsheet/` 里 `escapeHtml` / `waitForImages` / `createQrEncoder` / `storage` 那几件
对四张都通用，可直接拿。

---

## 附：材料索引