// 自定义生产单（旧版 `ProductionSheetPrintManager`，Home 的 `ic=14`）· 核心逻辑层统一出口。
//
// 逆向定稿：`docs/custom-docs-recon/01-ps.md`（施工图，逐段判定 + 逐字模板）
// 反混淆源码：`legacy/js/ProductionSheet.deobfuscated.js`（注释里的 `PS:NNN` 即其行号）
//
// ⚠️ **本单据不属于 C 家族**（§0 一页结论）—— 目录形态是照 `productionsheet2/` 的习惯排的，
//    但**语义没有一处可以照搬**（§0.2 那张规模对比表：与 PS2 同名的只有
//    `ps-root`/`ps-sheet` 两个 class 和打印骨架）。
//
// 分层：
//   types.ts     数据模型（`paper` / `globalHeaderFont` / `headerFields[12]` / `tableConfig` /
//                `doorImgBox` / `print.itemsPerPage`）
//   profile.ts   单据常量：产出 class（只有 2 个）/ 布局编辑器 class / 两个 localStorage 键 /
//                文档标题 / QR 回退 viewBox（**不是**底座的 `DocSheetProfile`，§0.1）
//   defaults.ts  默认配置 `a()`（`PS:33-243`）+ 7 个纸张预设（`PS:548-553`）+ 全部 UI 范围
//   sanitize.ts  读盘清洗 `z`（`PS:271-513`，4806 字符）—— **读盘与写回两端都调用**
//   storage.ts   两个 localStorage 键（薄层，转发底座的键版原语）
//   css.ts       CSS 发生器 `le`（`PS:1024-1034`）—— 709 字符 / 8 条规则
//   html.ts      HTML 构造器 `R`/`F`/`$`/`ee`/`te` + 页容器 / 根容器 / 完整文档 `ne`
//   paginate.ts  **解析式**估高（`PS:1237-1260`）+ 打包（`PS:1261-1275`）+ 两联（`PS:1063-1200`）
//   build.ts     构建入口 `oe`（`PS:1036-1321`，**内部无 await**）
//   print.ts     打印链路 `printDirect`（`PS:1394-1442`）·  qr.ts 二维码 provider
//
// **数据层不在本目录** —— 行对象由调用方传入，复用 `app/src/utils/printPayloads.ts` 的
// **`oldSheetProduces(paired)`**（§6.4 逐键核对 CONFIRMED：ic=14 的 14 个平铺键 +
// `oldSheet:[{…4 键…}]`，含 ic=14 独有的 `maker`/`lockway`；`orderID` 是**小写 d**）。
//
// ⚠️ **依赖方向单向**：`productionsheet/` → `../docsheet/`（只用了 4 小件 + 2 处参数化）；
//    底座不认识本单据。别反向 import。

export * from './types'
export * from './profile'
export * from './defaults'
export * from './sanitize'
export * from './storage'
export * from './css'
export * from './html'
export * from './paginate'
export * from './build'
export * from './print'
export * from './qr'
