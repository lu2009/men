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
}

/**
 * N 张订单 → **一个** hiprint 打印任务（N 页），与旧版一致（旧版把整批订单一次构造后只调一次打印）。
 *
 * 组装规则按 `templatePayload` 的三类形状：
 *   · `wrap`（回执族 / 玻璃订单：表头 + 行数组）→ **每单一个对象**，一份单据一页；
 *   · 有 `key`（`produces` 表）→ 各单的行**拼成一张表**，模板的 `maxRows` 负责翻页；
 *   · 无 `key`（标签 / oldSheet，本身就是行数组）→ 各单的行直接串起来，一行一页。
 */
export function buildBatchPayload(
  orders: OrderDto[],
  prereqs: PrintPrereqs,
  who: { tenantName: string; maker: string },
  template: unknown,
  mode: string,
  forPreview = false,
): BuiltPrintPayload {
  const perOrder = orders.map((o) =>
    createPrintPayloads(buildOrderPrintContext(o, prereqs, who)).templatePayload(template, mode, forPreview),
  )
  const rows = (d: unknown) => (Array.isArray(d) ? d : [])

  if (perOrder[0]?.wrap) {
    const payload = perOrder.map((p) =>
      (p.key ? { ...p.extra, [p.key]: p.data } : p.data) as Record<string, unknown>,
    )
    return { payload, wrap: true }
  }
  if (perOrder[0]?.key) {
    const key = perOrder[0].key as string
    const merged = perOrder.flatMap((p) => rows(p.data))
    return { payload: [{ ...perOrder[0].extra, [key]: merged }], wrap: true }
  }
  const merged = perOrder.flatMap((p) => rows(p.data))
  return { payload: merged as Record<string, unknown>[], wrap: false }
}
