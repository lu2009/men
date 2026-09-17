// C 家族自绘单据 · 公共底座（核心逻辑层）。
//
// 「C 家族」= 旧版 Home bundle 里同一套模板换皮的两张自绘单据：
//   · 自定义玻璃合片单（`app/src/utils/glasssheet2/`）
//   · 自定义生产单2   （`app/src/utils/productionsheet2/`）
// 43 个成员只有 7 个有实质差异 —— 差异全部由 `DocSheetProfile` 注入，
// 其余 100% 同构：`docs/custom-docs-recon/01-diff.md`（施工图）/ `02-glasssheet2.md`（GS2 定稿）。
//
//   分层：
//   types.ts     数据模型（配置 / 行 / 二维码 / 渲染选项）—— 两张单据共用
//   profile.ts   **单据档案**：前缀 / 两个 localStorage 键 / 文档标题 / 默认配置工厂 /
//                空段占位开关 / 单元格 case 表 —— 底座层唯一的差异注入点
//   defaults.ts  与单据无关的默认值（纸张 / 打印份数）+ 全部 UI 控件参数
//   sanitize.ts  读盘清洗（旧版 `onMounted` 的清洗段）
//   storage.ts   2 个 localStorage 键（键名来自 profile）
//   css.ts       CSS 发生器（旧版 `j` 内嵌的 IIFE）
//   html.ts      HTML 构造器（`D`/`A`/`B`/`U`/`G`/`S`/单页/`j`/`J`）
//   paginate.ts  量测 `O` + 打包 `H` + 调度
//   print.ts     打印链路（`printDirect`）
//   qr.ts        二维码编码器（与单据无关，两张单据共用）
//
// ⚠️ **数据层不在本目录** —— 行对象由调用方传入（见各单据 `index.ts` 的说明）。

export * from './types'
export * from './profile'
export * from './defaults'
export * from './sanitize'
export * from './storage'
export * from './css'
export * from './html'
export * from './paginate'
export * from './print'
