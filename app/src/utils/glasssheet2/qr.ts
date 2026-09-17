// 自定义玻璃合片单 · 二维码编码器 —— 实现已上移到公共底座 `../docsheet/qr.ts`。
//
// 编码器**与具体单据无关**：§1 的逐函数对照表里 `k,P,I` 三个成员「完全相同」
// （`MARGIN=1` / 缓存键 `text+"::m1"` / 失败不缓存），GS2 与 PS2 用的是同一个。
// 所以它住在底座层，两张单据各自 `qr.ts` 只做一次转出。
//
// 本文件保留的原因：`GlassSheet2Drawer.vue` / `GlassSheet2LayoutDialog.vue` 直接按
// `'../utils/glasssheet2/qr'` 引入 `createQrEncoder` —— 别改这条路径。

export { createQrEncoder } from '../docsheet/qr'
