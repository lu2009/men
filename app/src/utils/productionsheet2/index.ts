// 自定义生产单2（旧版 `ProductionSheet2PrintManager`）· 核心逻辑层统一出口。
//
// 逆向定稿：`docs/custom-docs-recon/01-diff.md`（施工图，逐函数对照 + 四处差异）
// 反混淆源码：`legacy/js/ProductionSheet2.deobfuscated.js`（注释里的 `PS2:NNN` 即其行号）
//
// 分层（与 `glasssheet2/` 同构 —— 两边**共用** `../docsheet/` 底座）：
//   profile.ts   **单据档案**：把本单据的四处差异（前缀 `ps` / 两个 localStorage 键 /
//                `自定义生产单2` / 9 列默认配置 / `keepEmptyLines:true` / case 表）填进底座
//   types.ts     数据模型（配置 / 行 / 二维码 / 渲染选项；通用形状转出底座）
//   defaults.ts  默认配置 `a()`（PS2:11-107）+ UI 控件范围
//   sanitize.ts  读盘清洗（PS2:709-803）
//   storage.ts   2 个 localStorage 键
//   css.ts       CSS 发生器（PS2:652-692）
//   html.ts      HTML 构造器（`D`/`A`/`B`/`U`/`G`/`S`/单页/`j`/`J`）
//   paginate.ts  量测 `O` + 打包 `H` + 调度
//   print.ts     打印链路（`printDirect`）·  qr.ts 二维码编码器
//
// 依赖方向单向：`productionsheet2/` → `docsheet/`，底座不认识任何单据。
//
// ⚠️ **数据层不在本目录** —— 行对象由调用方传入。本单据的行来自
// `app/src/utils/printPayloads.ts` 的 **`productionProduces()`**，它就是旧版
// `calculateReceipt({ping:!0,diao:!0,single:!1,singleRowData:null})` 那条口径（§7.2 CONFIRMED，
// 键名已核实全覆盖：`door`/`doorImg`/`OrderID`/`basicInfo`/`lockImg`/`doorsheet`/`doorframe`/`windows`/`remark`）。
//
// ⚠️ 别和 GS2 搞混：GS2 的行来自 `glassProduces()`（= `calculateGlass()`），
// 它的 `doorframe`/`windows` **恒为 `""`**，所以 GS2 没有那两列（§7.3 / §11 第 9 条）。

export * from './types'
export * from './defaults'
export * from './sanitize'
export * from './storage'
export * from './css'
export * from './html'
export * from './paginate'
