// 自定义合格标签（旧版 `QualifiedLabelPrintManager`，Home 的 `ic=13`）· 核心逻辑层统一出口。
//
// 逆向定稿：`docs/custom-docs-recon/01-ql.md`（施工图，逐段判定 + 逐字模板）
// 反混淆源码：`legacy/js/QualifiedLabel.deobfuscated.js`（注释里的 `QL:NNN` 即其行号）
//
// ⚠️ **本单据不属于任何既有家族**（§0 一页结论）—— 目录形态是照 `productionsheet/`（PS）
//    的习惯排的，但**语义没有一处可以照搬**（§0.2 的规模对比表：与 PS 撞的只有
//    「无参照物」「拖拽写草稿」这类结构性描述，产物一个字节都不撞）。
//
// 分层：
//   types.ts          数据模型（`paper`5 / `globalFont`4 / `fields[]`11×13 / `print`1）
//   profile.ts        单据常量：4 个产出 class / 布局编辑器 class / **4 个** localStorage 键 /
//                     文档标题 / QR 回退 viewBox（**不是**底座的 `DocSheetProfile`，§0.1）
//   defaults.ts       默认配置 `a()`（`QL:23-205`）+ 7 个纸张预设 + 全部 UI 范围
//   sanitize.ts       读盘清洗 `N`（`QL:241-369`，R1–R11）—— **读盘与写回两端都调用**
//   fieldAliases.ts   别名表 `_`（11 组）+ 取值 + 剥前缀（**底座无此概念**）
//   css.ts            CSS 发生器 `R`（`QL:633-661`）—— 838 / 1108 字符两份夹具
//   html.ts           `Q`（字段三分支）/ `ae`（全部标签）/ `de`（完整文档）—— **无分页**
//   qr.ts             二维码 provider（复用底座，回退 viewBox 传 200）
//   layout.ts         布局编辑器的纯变换（`j`/`ee`/`te`/`W`/`O`/`H`/`G`/`P`）
//   fixedQuantity.ts  固定张数（`L` + Home 的 `Cr` + 两个裸串键）—— **本单独有**
//   storage.ts        4 个 localStorage 键的读写（前两个走底座键版原语）
//   print.ts          打印链路 `printDirect`（**iframe 真实尺寸**，四张里唯一）
//
// ⚠️ **没有 `paginate.ts`** —— ★ 本单**根本没有分页**（§5.1）：
//    `ae()` 一次产出**全部**标签（一张一个 `<section class="qlabel">`），
//    `page-break-after:always` 在内联样式里、由 CSS 的 `.qlabel:last-child` 取消，
//    剩下交给浏览器。**不要**引入底座的量测 / 行高预算 / `paginate`（`QL:719-766` 全文 0 个 `await`）。
//
// **数据层不在本目录** —— 行对象由调用方传入，复用 `app/src/utils/printPayloads.ts` 的
// **`labelRows('lable')`**（§9 逐键核对 CONFIRMED：11 个 field key 全部命中，
// 含 `remark` 的 `<br>` 语义 —— 本单**不解释 `<br>`**，会逐字显示，与旧版一致）。
// ⚠️ **唯一缺口是三入口的行过滤**（`ping`/`diao`，§9 / §10.1 D1）—— 不在本层，见报告。
//
// ⚠️ **依赖方向单向**：`qualifiedlabel/` → `../docsheet/`（只用了 4 小件 + 2 处参数化）；
//    底座不认识本单据。别反向 import。

export * from './types'
export * from './profile'
export * from './defaults'
export * from './sanitize'
export * from './fieldAliases'
export * from './css'
export * from './html'
export * from './qr'
export * from './layout'
export * from './fixedQuantity'
export * from './storage'
export * from './print'
