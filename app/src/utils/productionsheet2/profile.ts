// 自定义生产单2 · 单据档案 —— 把 PS2 的四处差异填进底座 `DocSheetProfile`。
//
// 施工图：`docs/custom-docs-recon/01-diff.md` §0 / §11。四处差异逐条落到哪里：
//   #1 行数据来源 `calculateGlass` → `calculateReceipt`  → **不在本层**：行由调用方传
//      （`printPayloads.ts` 的 `productionProduces()`，见 `index.ts` 头注）
//   #2 列集 8→9 列                                      → `createDefaultColumns` / `createDefaultConfig`
//   #3 空行渲染：丢空段 → 补 `&nbsp;` 占位                → `keepEmptyLines: true`（**本单据唯一的真逻辑差异**）
//   #4 类名前缀 `gs`→`ps` / 两个 localStorage 键 / UI 文案 → `prefix` / `storageKeys` / `documentTitle`
// 另加 §7.1 的 case 表差异                                     → `cellCases`

import { createDocSheetClasses, type DocSheetProfile } from '../docsheet/profile'
import { createDefaultColumns, createDefaultConfig } from './defaults'

/**
 * 2 个 localStorage 键（旧版 module 级常量 `yn` / `vn`，§8）。
 * 定义点放在 profile 里、由 `storage.ts` 转出 —— 键名是「单据档案」的一部分。
 */
export const PRODUCTIONSHEET2_STORAGE_KEYS = {
  /** 整份配置。旧版 `yn`，PS2:127 写 / PS2:716 读 */
  template: 'production_sheet2_template_v1',
  /** 打印机名，裸字符串。旧版 `vn`，PS2:133 写 / PS2:798 读 */
  selectedPrinter: 'production_sheet2_printer_v1',
} as const

/**
 * PS2 的档案 —— 全组件唯一的差异注入点。
 *
 * ⚠️ `keepEmptyLines: true` 是**本单据与 GS2 的分水岭**（§6）：
 * 空段不再被 `.filter(Boolean)` 丢掉，而是渲染成 `<div class="ps2-line">&nbsp;</div>` 占位行；
 * 且由于 `String(x).split()` 永返回 ≥1 个元素，**本单据的 `renderMultiline` 永不可能返回 `""`**
 * —— 旧版那个 `o.length === 0 ? "" : …` 是死分支（PS2:205-206 CONFIRMED）。
 *
 * ⚠️ **连带影响（§5 末段 / §6.3）**：`doorframe`/`windows` 在 `calculateReceipt` 过滤后
 * 无匹配部件时就是空串，于是这些行会渲染出 9mm 高的占位行而**不再塌成 0**
 * ⇒ 每一行实测高度大于 GS2 的算法 ⇒ **切页位置随之改变**。分页代码一个字没改，行为却变了。
 *
 * TODO(未确认): `calculateReceipt` 产出的多行 `<br>` 串里**会不会出现连续 `<br>`**（即串内空段）
 *   —— §12.1。已知六个字段都可能是**整个空串**（一定触发占位行），但**串内空段未逐条验证**。
 *   这决定本开关的占位行在实际数据上出现多少、进而决定分页偏移量有多大。
 *   **端到端未实测**（要拿真实订单跑一遍旧版 PS2 的打印预览才能比）。
 *   本层的行为无论哪种情况都正确（照抄 PS2:197-212 逐字），未确认的只是「实际触发频率」。
 */
export const PRODUCTIONSHEET2_PROFILE: DocSheetProfile = {
  prefix: 'ps',
  classes: createDocSheetClasses('ps'),
  documentTitle: '自定义生产单2',
  storageKeys: PRODUCTIONSHEET2_STORAGE_KEYS,
  createDefaultConfig,
  createDefaultColumns,
  keepEmptyLines: true,
  // 旧版 `U` 的 switch 分支（PS2:216-327），**顺序照抄**：
  // door → doorImg → order → basicInfo → lockImg → doorsheet → doorframe → windows → remark。
  //   · **删掉 `client`**（PS2 没有这个 case，客户已并进 `door`）；
  //   · **新增 `doorframe` / `windows`**（GS2 落到 `default` → `""`）。
  cellCases: {
    door: { kind: 'multiline', field: 'door' }, // PS2:224-225
    doorImg: { kind: 'image', field: 'doorImg' }, // PS2:226-231
    order: { kind: 'order' }, // PS2:232-300
    basicInfo: { kind: 'multiline', field: 'basicInfo' }, // PS2:301-302
    lockImg: { kind: 'image', field: 'lockImg' }, // PS2:303-308
    doorsheet: { kind: 'multiline', field: 'doorsheet' }, // PS2:309-310
    doorframe: { kind: 'multiline', field: 'doorframe' }, // PS2:311-312
    // PS2:313-321 —— 旧版这里包了一层 `String(row.windows ?? "").trim()`，**是冗余的**
    // （`renderMultiline` 内部本来就 `String(e ?? "")` 再 `.split().map(trim)`）。
    // 行为等价（CONFIRMED，§3.6），故不照抄那层多余包装 —— 等价的写法简化，不是行为偏离。
    //
    // TODO(未确认): 那层包装**是不是原作者有意为之**，看不出动机（§12.2）。
    //   已按行为等价处理；若将来发现它与其它列有语义差别，回来改成显式 trim 入口。
    windows: { kind: 'multiline', field: 'windows' },
    remark: { kind: 'multiline', field: 'remark' }, // PS2:322-323
  },
}
