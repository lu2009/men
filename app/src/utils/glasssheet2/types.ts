// 自定义玻璃合片单（旧版 `GlassSheet2PrintManager`）的数据模型。
//
// 逆向定稿：`docs/custom-docs-recon/02-glasssheet2.md`（§2 数据模型 / §6 配置模型）。
// 反混淆源码：`legacy/js/GlassSheet2.deobfuscated.js`（下称 `GS:NNN`）。
//
// ⚠️ **通用形状已抽到底座 `../docsheet/types.ts`**（GS2 与 PS2 逐字段相同，见 `01-diff.md` §2.1）——
// 本文件只保留**本单据独有**的两样东西，其余一律 `export type` 转出以保持对外 API 不变：
//   · `ColumnKey`      —— 默认 8 列的 key 联合（PS2 是另一套，9 列）
//   · `GlassSheet2Row` —— 行对象（字段名照抄旧版 `calculateGlass()` 的产物）

import type { DocSheetRow } from '../docsheet/types'

/**
 * 通用形状（实现与逐字段说明见 `../docsheet/types.ts`）：
 * `Orientation` / `PaperConfig` / `ColumnConfig` / `TableConfig` / `PrintConfig` /
 * `QrSvg` / `QrEncoder` / `RenderOptions`。
 *
 * ⚠️ `ColumnConfig.key` 是 `string` 而不是字面量联合：读盘时**按下标合并默认列、多出的列原样保留**
 * （GS:745-748），所以运行期真的会存在 `key` 不在默认 8 个之内的列 —— 它们经 `renderCell` 的
 * `default` 分支渲染成空串（GS:304-305），列本身仍在表头里占一格。
 */
export type {
  Orientation,
  PaperConfig,
  ColumnConfig,
  TableConfig,
  PrintConfig,
  QrSvg,
  QrEncoder,
  RenderOptions,
} from '../docsheet/types'

/** 整份配置 —— 两个弹窗共用、共用**一个** localStorage 键（`glass_sheet2_template_v1`）。 */
export type { DocSheetConfig as GlassSheet2Config } from '../docsheet/types'

/** 一页的 HTML。 */
export type { DocSheetPage as GlassSheet2Page } from '../docsheet/types'

/** 默认 8 列的 key（§2.4）。其余值走 `renderCell` 的 `default` 分支 → 空串。 */
export type ColumnKey =
  | 'client'
  | 'door'
  | 'order'
  | 'basicInfo'
  | 'lockImg'
  | 'doorsheet'
  | 'doorImg'
  | 'remark'

/**
 * 行对象（§2.2，CONFIRMED）。
 *
 * **全字段可选**：旧版一律用 `?.` / `?? ""` 取值，缺字段不会抛。
 * 字段名照抄旧版，注意三处坑：
 *   - 单号是 **`OrderID`（大写 O）**，`orderID` 只是 `renderCell` 的回退写法；
 *   - `qrcode` 与 `OrderID` 是**同一份单号的冗余字段**（Hui 侧 `calculateGlass()` 同时写两个）；
 *   - `door`/`basicInfo`/`doorsheet`/`remark` 都是**含 `<br>` 的富文本串**，不是纯文本。
 *
 * 新版**不重写数据层** —— 行由调用方传进来，复用 `app/src/utils/printPayloads.ts` 的
 * `glassProduces()`（同报告 §14.1）。
 *
 * ⚠️ 与 PS2 的 `ProductionSheet2Row` 是**两个不同的东西**（§7.3）：本单据的行来自
 * `calculateGlass()`，**没有** `doorframe`/`windows`（恒不赋值），也**没有**客户并进门类那一说。
 * 别把两者合并。
 */
export interface GlassSheet2Row extends DocSheetRow {
  /** 客户 */
  client?: string
  /** 型材 + 颜色，`filter(Boolean).join("<br>")` */
  door?: string
  /** 单号（大写 O） */
  OrderID?: string
  /** 单号回退写法（小写 o），仅 `renderCell('order')` 读 */
  orderID?: string
  /** 单号的冗余副本 */
  qrcode?: string
  /** 订单信息：尺寸行 + 后缀（平开/吊趟两分支内容不同） */
  basicInfo?: string
  /** 开向示意图 URL（**不是锁具图**） */
  lockImg?: string
  /** 玻璃尺寸 */
  doorsheet?: string
  /** 门图 URL */
  doorImg?: string
  /** 备注 */
  remark?: string
  /** 旧版 `ProductionEdit` 会回写的其它字段（`doorframe` / `windows` 等），本单据不渲染 */
  [extra: string]: unknown
}
