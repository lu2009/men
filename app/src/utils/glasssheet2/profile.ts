// 自定义玻璃合片单 · 单据档案 —— 把 GS2 的四处差异填进底座 `DocSheetProfile`。
//
// 施工图：`docs/custom-docs-recon/01-diff.md` §0 / §11。GS2 侧全部取值如下：
//   · `prefix: 'gs'`            —— 派生 `gs-root` / `gs-sheet` / `gs2-*`（§4.2：两套前缀并存是旧版事实）
//   · `documentTitle`           —— `<title>自定义玻璃合片单</title>`（GS:673-681 / §3.1）
//   · `storageKeys`             —— `glass_sheet2_template_v1` / `glass_sheet2_printer_v1`（§8，旧版 `Dn`/`An`）
//   · `createDefaultConfig`     —— `a()`（GS:11-98），8 列、标题「玻璃合片单」
//   · `keepEmptyLines: false`   —— **GS2 丢空段**（GS:188-202 的 `.filter(Boolean)`）
//   · `cellCases`               —— GS2 有 `client`，**没有** `doorframe`/`windows`（§7.1）

import { createDocSheetClasses, type DocSheetProfile } from '../docsheet/profile'
import { createDefaultColumns, createDefaultConfig } from './defaults'

/**
 * 2 个 localStorage 键（旧版 module 级常量 `Dn` / `An`，§8）。
 * 定义点放在 profile 里、由 `storage.ts` 转出 —— 键名是「单据档案」的一部分。
 */
export const GLASSSHEET2_STORAGE_KEYS = {
  /** 整份配置。旧版 `Dn`，GS:118 写 / GS:690 读 */
  template: 'glass_sheet2_template_v1',
  /** 打印机名，裸字符串。旧版 `An`，GS:124 写 / GS:772 读 */
  selectedPrinter: 'glass_sheet2_printer_v1',
} as const

/**
 * GS2 的档案 —— 全组件唯一的差异注入点。
 *
 * ⚠️ `keepEmptyLines: false` 是**本单据与 PS2 的分水岭**：置为 `true` 会让
 * `client`/`door`/`basicInfo`/`doorsheet`/`remark` 的整串为空时渲染出 `&nbsp;` 占位行，
 * 从而改变行高与分页 —— GS2 的验收夹具（`gs2-htmlcheck.mjs` 的「空段丢弃 → 空串」那条）
 * 就是钉死这一点的。**别改。**
 */
export const GLASSSHEET2_PROFILE: DocSheetProfile = {
  prefix: 'gs',
  classes: createDocSheetClasses('gs'),
  documentTitle: '自定义玻璃合片单',
  storageKeys: GLASSSHEET2_STORAGE_KEYS,
  createDefaultConfig,
  createDefaultColumns,
  keepEmptyLines: false,
  // 旧版 `U` 的 switch 分支（GS:206-307），**顺序照抄**：client → door → doorImg → order →
  // basicInfo → lockImg → doorsheet → remark。未登记的 key → `''`（GS:304-305）。
  cellCases: {
    client: { kind: 'multiline', field: 'client' }, // GS:214-215
    door: { kind: 'multiline', field: 'door' }, // GS:216-217
    doorImg: { kind: 'image', field: 'doorImg' }, // GS:218-223
    order: { kind: 'order' }, // GS:224-291
    basicInfo: { kind: 'multiline', field: 'basicInfo' }, // GS:292-293
    lockImg: { kind: 'image', field: 'lockImg' }, // GS:294-299
    doorsheet: { kind: 'multiline', field: 'doorsheet' }, // GS:300-301
    remark: { kind: 'multiline', field: 'remark' }, // GS:302-303
  },
}
