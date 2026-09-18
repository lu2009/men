// 从「一张订单（含行）」装配出打印上下文 —— Home 批量打印与 Hui 单张打印共用同一套构造层
// （`utils/printPayloads.ts`），这里只负责**把数据凑齐**：
//   算料要 `formulas`、品牌段要 `clients`、玻璃订单/玻璃合片单要公式挖孔图、回执要收款码。
//
// ⚠️ 旧版 Home 打印有个坑：它的打印流程**不补拉订单明细**，只消费展开行时已加载的子表数据 ——
// 没展开过的订单打出来是空的（`docs` 逆向报告已记录）。新版在进入打印抽屉时**统一兜底拉取**，
// 这是有意的行为改进。

import { api } from '../api/client'
import { idbGetImage } from '../utils/imageStore'
import type { ClientDto, FormulaDto, FormulaImageDto, OrderDto } from '../api/types'
import { createPrintPayloads, type PrintContext } from '../utils/printPayloads'
import type { Line } from '../utils/partsEngine'
import type { PrintPayload } from '../utils/printService'

/** 收款码在本地 IndexedDB 里的固定键（与 Hui 的「收款码设置」同一份）。 */
const PAY_QRCODE_KEY = 'qrcode'

export interface PrintPrereqs {
  formulas: FormulaDto[]
  clients: ClientDto[]
  payQrcode: string
  formulaImages: Record<number, FormulaImageDto[]>
}

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 拉齐打印所需的公共数据（公式 / 客户 / 收款码 / 挖孔图）。 */
export async function loadPrintPrereqs(orders: OrderDto[]): Promise<PrintPrereqs> {
  const [formulas, clients, payQrcode] = await Promise.all([
    api.listFormulas().catch(() => [] as FormulaDto[]),
    api.listClients().catch(() => [] as ClientDto[]),
    idbGetImage(PAY_QRCODE_KEY).catch(() => null),
  ])

  // 挖孔图按行 `formula_id` 取；`holeImageOf`/`holeImgByDir` 是同步查缓存，
  // 不预取的话玻璃订单/玻璃合片单的图列会整列为空（Hui 里也踩过这个坑）。
  const ids = [
    ...new Set(
      orders
        .flatMap((o) => o.lines ?? [])
        .map((l) => l.formula_id)
        .filter((v): v is number => v != null),
    ),
  ]
  const formulaImages: Record<number, FormulaImageDto[]> = {}
  await Promise.all(
    ids.map(async (id) => {
      try {
        formulaImages[id] = await api.listFormulaImages(id)
      } catch {
        formulaImages[id] = []
      }
    }),
  )

  return { formulas, clients, payQrcode: payQrcode || '', formulaImages }
}

/** 订单行 → 打印行的归一（`parts`/`markup` 落库后是 `unknown`，非数组一律当空）。 */
function toLines(order: OrderDto): Line[] {
  return (order.lines ?? []).map(
    (l) =>
      ({
        ...l,
        parts: Array.isArray(l.parts) ? l.parts : [],
        markup: Array.isArray(l.markup) ? l.markup : [],
        open_img: l.open_img || '',
        image_url: l.image_url || '',
      }) as unknown as Line,
  )
}

/** 单张订单 → `PrintContext`。 */
export function buildOrderPrintContext(
  order: OrderDto,
  prereqs: PrintPrereqs,
  who: { tenantName: string; maker: string },
): PrintContext {
  return {
    order: {
      receipt_no: order.receipt_no || '',
      client_code: order.client_code || '',
      client_name: order.client_name || '',
      brand: order.brand || '',
      order_date: order.order_date || '',
      production_days: order.production_days || 0,
      deposit: order.deposit || 0,
      remark: order.remark || '',
      install_address: order.install_address || '',
      phone: order.phone || '',
    },
    lines: toLines(order),
    formulas: prereqs.formulas,
    clients: prereqs.clients,
    tenantName: who.tenantName,
    maker: who.maker,
    payQrcode: prereqs.payQrcode,
    // 订单查询二维码（旧版 `orderQrcode`）依赖终端只读页，新版尚未做 ⇒ 留空，
    // 模板里那一格会渲染成空 —— 与旧版取不到值时一致（原版也是 `|| ''`）。
    terminalLink: '',
    // 回执族两张表的显隐开关。批量打印时不做单张勾选，恒为「两张都要」。
    showPing: true,
    showDiao: true,
    sortMethod: localStorage.getItem('smartdoor_sort_method') || 'profile',
    formulaImages: prereqs.formulaImages,
    today: today(),
  }
}

/** 一次打印任务的入参（hiprint 直接吃）。`wrap` 仅用于说明形状，调 hiprint 时无差别。 */
export interface BuiltPrintPayload {
  payload: PrintPayload
  wrap: boolean
  /**
   * 载荷里那一段**整批共用**的行数组（`produces` 合并后的行 / 扁平行数组）——
   * 编辑弹窗读它、保存后也替换它（见 `buildBatchPayload` 的 `overrideRows`）。
   *
   * ⚠️ 与返回值里那个 `wrap` 标志**不是**一回事：`produces` 表那支也返回 `wrap:true`
   * （它的载荷同样是「一个元素包着行数组」），但行是整批一份。
   * · **玻璃订单**（`wrap` + `key` = `glassInfoList`）→ 取**首单**那份（旧版也只编辑 `rc[0]`）；
   * · **回执族**（`wrap` 无 `key`）→ 恒为 `[]`，那类的可编辑对象在 `header`（见下）。
   */
  rows: Record<string, unknown>[]
  /**
   * 「载荷对象本身就是编辑对象」那一类（**回执族**：`receipt` / `FinalReceipt` / `ReceiptList`）
   * 可供编辑的**首个**对象 —— 对应旧版的 `jn[0]` / `qn[0]`。其余两类恒为 `null`。
   *
   * ⚠️ 回执族的载荷是「**每单一个对象**」（表头 + `receipt` 行数组），没有「整批共用的行」，
   * 所以这类走 `header` 而不是 `rows`；旧版也只编辑 `jn[0]`（首单）。
   */
  header: Record<string, unknown> | null
}

/**
 * N 张订单 → **一个** hiprint 打印任务（N 页），与旧版一致（旧版把整批订单一次构造后只调一次打印）。
 *
 * 组装规则按 `templatePayload` 的三类形状：
 *   · `wrap`（回执族 / 玻璃订单：表头 + 行数组）→ **每单一个对象**，一份单据一页；
 *   · 有 `key`（`produces` 表）→ 各单的行**拼成一张表**，模板的 `maxRows` 负责翻页；
 *   · 无 `key`（标签 / oldSheet，本身就是行数组）→ 各单的行直接串起来，一行一页。
 *
 * `overrideRows` = **编辑弹窗改过的那份行**（旧版 Home 各 ic 的内存态行数组：ic=1/2 的 `uc`、
 * ic=4 的 `bc`、ic=8/9 的 `uc`、ic=15/16 的 `qr`/`oi`）。给了它就**不再汇算合并**，
 * 直接把它当作那一段行 —— 对应旧版保存回调的统一形态「写回 ref → 用同一模板重渲」（§4）。
 *
 * `overrideHeader` = 回执族那种「**载荷对象本身就是编辑对象**」的覆盖（旧版 `jn[0] = e`）。
 *
 * ⚠️ 三类形状各自的可编辑面不同：`produces`/扁平行数组 → `rows` 整批一份；
 *    `wrap`+`key`（玻璃订单）→ `rows` 是**首单**那份、也只替换首单；
 *    `wrap` 无 `key`（回执族）→ 走 `header`。
 */
export function buildBatchPayload(
  orders: OrderDto[],
  prereqs: PrintPrereqs,
  who: { tenantName: string; maker: string },
  template: unknown,
  mode: string,
  forPreview = false,
  overrideRows: Record<string, unknown>[] | null = null,
  overrideHeader: Record<string, unknown> | null = null,
): BuiltPrintPayload {
  const perOrder = orders.map((o) =>
    createPrintPayloads(buildOrderPrintContext(o, prereqs, who)).templatePayload(template, mode, forPreview),
  )
  const rows = (d: unknown) => (Array.isArray(d) ? d : [])

  if (perOrder[0]?.wrap) {
    const payload = perOrder.map((p) =>
      (p.key ? { ...p.extra, [p.key]: p.data } : p.data) as Record<string, unknown>,
    )
    const key = perOrder[0].key as string | undefined

    // —— 有 key（玻璃订单 `glassHole`）：行在对象自己的 key 下 ——
    // 旧版 `Uc`(ic=3) 只编辑 `rc[0].glassInfoList`（**首组**），改的也是它
    // （`Ac` 保存时「写回 `Nc` **并回写 `rc[0].glassInfoList`**」，施工图 §1/§4）。
    // 新版照此：行 = 首单那份，编辑结果也只替换首单。
    if (key) {
      if (overrideRows) payload[0] = { ...payload[0], [key]: overrideRows }
      return { payload, wrap: true, rows: rows(payload[0]?.[key]), header: null }
    }

    // —— 无 key（回执族 `receipt` 等）：载荷对象**本身就是**编辑对象 ——
    // 旧版 `jn[0]` / `qn[0]`（`customerInfo` + `receipt` 行），`qi` 保存时 `jn[0] = e`。
    if (overrideHeader) payload[0] = overrideHeader
    return { payload, wrap: true, rows: [], header: payload[0] ?? null }
  }
  if (perOrder[0]?.key) {
    const key = perOrder[0].key as string
    const merged = overrideRows ?? perOrder.flatMap((p) => rows(p.data))
    return { payload: [{ ...perOrder[0].extra, [key]: merged }], wrap: true, rows: merged, header: null }
  }
  const merged = overrideRows ?? perOrder.flatMap((p) => rows(p.data))
  return { payload: merged as Record<string, unknown>[], wrap: false, rows: merged, header: null }
}
