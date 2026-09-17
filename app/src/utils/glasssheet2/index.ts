// 自定义玻璃合片单（旧版 `GlassSheet2PrintManager`）· 核心逻辑层统一出口。
//
// 逆向定稿：`docs/custom-docs-recon/02-glasssheet2.md`
// 反混淆源码：`legacy/js/GlassSheet2.deobfuscated.js`（注释里的 `GS:NNN` 即其行号）
//
// 分层：
//   profile.ts   **单据档案**：把本单据的四处差异（前缀 `gs` / 两个 localStorage 键 /
//                文档标题 / 8 列默认配置 / `keepEmptyLines:false` / case 表）填进底座
//   types.ts     数据模型（配置 / 行 / 二维码 / 渲染选项；通用形状转出底座）
//   defaults.ts  默认配置 `a()`（GS:11-98）+ UI 控件范围
//   sanitize.ts  读盘清洗（GS:686-768）
//   storage.ts   2 个 localStorage 键
//   css.ts       CSS 发生器（GS:626-666）
//   html.ts      HTML 构造器（`D`/`A`/`B`/`U`/`G`/`S`/单页/`j`/`J`）
//   paginate.ts  量测 `O` + 打包 `H` + 调度
//   print.ts     打印链路（`printDirect`）·  qr.ts 二维码编码器
//
// ⚠️ **实现已全部上移到公共底座 `../docsheet/`**（GS2 与 PS2 43 个成员里只有 7 个有实质差异，
// 见 `docs/custom-docs-recon/01-diff.md`）。本目录只剩「本单据取什么值」与「对外 API 转出」，
// 依赖方向单向：`glasssheet2/` → `docsheet/`，底座不认识任何单据。
//
// **数据层不在本目录** —— 行对象由调用方传入，复用 `app/src/utils/printPayloads.ts`
// 的 `glassProduces()`（引擎 A）与 `lineLockImage()`。

export * from './types'
export * from './defaults'
export * from './sanitize'
export * from './storage'
export * from './css'
export * from './html'
export * from './paginate'
