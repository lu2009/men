// 自定义生产单2（旧版 `ProductionSheet2PrintManager`）的数据模型。
//
// 逆向定稿：`docs/custom-docs-recon/01-diff.md`（本单只写差异，GS2 的结论引 `02-glasssheet2.md`）。
// 反混淆源码：`legacy/js/ProductionSheet2.deobfuscated.js`（下称 `PS2:NNN`）。
//
// ⚠️ **通用形状全部转出底座 `../docsheet/types.ts`**（§2.1：`paper`/`print` 与 GS2 逐字段相同）——
// 本文件只保留**本单据独有**的两样东西：
//   · `ColumnKey`              —— 默认 **9 列**的 key 联合（GS2 是 8 列）
//   · `ProductionSheet2Row`    —— 行对象（字段名照抄旧版 `calculateReceipt()` 的产物）

import type { DocSheetRow } from '../docsheet/types'

/**
 * 通用形状（实现与逐字段说明见 `../docsheet/types.ts`）：
 * `Orientation` / `PaperConfig` / `ColumnConfig` / `TableConfig` / `PrintConfig` /
 * `QrSvg` / `QrEncoder` / `RenderOptions`。
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

/** 整份配置 —— 两个弹窗共用、共用**一个** localStorage 键（`production_sheet2_template_v1`）。 */
export type { DocSheetConfig as ProductionSheet2Config } from '../docsheet/types'

/** 一页的 HTML。 */
export type { DocSheetPage as ProductionSheet2Page } from '../docsheet/types'

/**
 * 默认 **9 列**的 key（§2.2）。
 *
 * 与 GS2 的 8 列对照（**别照抄 GS2**，§11 第 3、4 条）：
 *   · **删除** `client`（「客户」）—— 客户被并进第 1 列 `door`（「客户/门类」）；
 *   · **新增** `doorframe`（「外框」）与 `windows`（「亮窗/扣板」）。
 * 这不是拍脑袋：PS2 的行来自 `calculateReceipt()`，它**会**填 `doorframe`/`windows`
 * 并把客户拼进 `door`；而 GS2 的行来自 `calculateGlass()`，那两个字段**恒为 `""`**（§7.3 CONFIRMED）。
 * **列集与行来源是自洽的 —— 别把这两列「补」到 GS2 上，也别把 `client` 留在 PS2。**
 */
export type ColumnKey =
  | 'door'
  | 'doorImg'
  | 'order'
  | 'basicInfo'
  | 'lockImg'
  | 'doorsheet'
  | 'doorframe'
  | 'windows'
  | 'remark'

/**
 * 行对象（§7.1 / §7.3，CONFIRMED）。
 *
 * ⚠️ **与 GS2 的 `GlassSheet2Row` 是两个不同的东西，别合并** —— 两者的
 * `door` / `doorsheet` / `doorframe` / `windows` / `basicInfo` / `remark`
 * 都是**不同生成器算出来的**（差异表见 §7.3）：
 *
 * | 字段 | `calculateReceipt`（本单据） | `calculateGlass`（GS2） |
 * |---|---|---|
 * | `door` | **含客户**：`[客户, 型材, 颜色].filter(Boolean).join("<br>")`（白名单门店除外） | 只有型材 + 颜色 |
 * | `doorsheet` | 固定键序 `名:值*数量`，**无「数量:N」汇总行** | `名:值` + `<br>数量:N` |
 * | `doorframe` / `windows` | **会赋值** | **恒为 `""`** |
 * | `basicInfo` | 玻璃串**不带 mm**；平开双无玻 = 「无玻璃」、吊趟 = 「无」 | **带 mm**；平开 = 「无」、吊趟 = 「无玻璃」 |
 * | `remark` | 平开是另一套（含墙型段） | 与 receipt 吊趟逐字一致 |
 *
 * **新版不重写数据层** —— 行由调用方传进来，复用 `app/src/utils/printPayloads.ts` 的
 * `productionProduces()`（= 旧版 `calculateReceipt({ping:!0,diao:!0,single:!1,singleRowData:null})`
 * 那条口径，§7.2；键名已核实全覆盖）。
 */
export interface ProductionSheet2Row extends DocSheetRow {
  /**
   * 客户 + 型材 + 颜色（`filter(Boolean).join("<br>")`）。
   * ⚠️ 客户在最前一行 —— 这就是第 1 列标签叫「客户/门类」的原因（§7.4 第 2 条）。
   * **白名单门店**（44 家）不发客户请求，此时只有型材 + 颜色。
   */
  door?: string
  /**
   * 门图 URL。
   * ⚠️ `calculateReceipt` 对**白名单门店连请求都不发**，字段是 `undefined`（§7.4 第 3 条）——
   * 渲染成空串、不报错。新版数据层若两个键都给，会让白名单门店**反而有门图**，
   * 那是一处行为偏离，需拍板（不在本层）。
   */
  doorImg?: string
  /** 单号（大写 O）。`calculateReceipt` 写的就是这个键 */
  OrderID?: string
  /** 单号回退写法（小写 o），仅 `renderCell('order')` 读；新版数据层不产出它 */
  orderID?: string
  /** 单号的冗余副本；新版数据层不产出它（`OrderID` 已覆盖） */
  qrcode?: string
  /** 订单信息：尺寸串 + 开向；玻璃串**不带 mm** */
  basicInfo?: string
  /** 开向示意图 URL（**不是锁具图**） */
  lockImg?: string
  /** 门扇 —— 固定键序取部件，`名:值*数量`，**无「数量:N」汇总行** */
  doorsheet?: string
  /** 外框 —— 平开：门框/前框/后框/门板四组；吊趟：边封/轨道组 + `套线名：`段 */
  doorframe?: string
  /** 亮窗/扣板 —— 平开：扣板/上亮横/上亮窗玻璃/压线；吊趟：中柱/亮窗玻璃/槽/压线 + 扣板 */
  windows?: string
  /** 备注 —— 平开 = `[轨道种类, 五金, 安装地址, 备注]` + 墙型段；吊趟是另一套（§7.3） */
  remark?: string
  /** 生成器写回的其它字段（`maker` / `kou` / `casing` 等），本单据不渲染 */
  [extra: string]: unknown
}
