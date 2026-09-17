// 自定义生产单2 · 二维码编码器 —— 实现已上移到公共底座 `../docsheet/qr.ts`。
//
// 编码器**与具体单据无关**：§1 的逐函数对照表里 `k,P,I` 三个成员「完全相同」
// （`MARGIN=1` / 缓存键 `text+"::m1"` / 失败不缓存），PS2 与 GS2 用的是同一个。
//
// 保留本文件（而不是让组件直接引底座）的理由：与 `glasssheet2/qr.ts` 对称，
// 将来 PS2 的抽屉/布局弹窗按 `'../utils/productionsheet2/qr'` 引入即可，两边路径形状一致。

export { createQrEncoder } from '../docsheet/qr'
