// 订单 → 收据单2 的数据模型。
//
// 复用了打印层的 `receiptPrintData()` —— 因为旧版的 `customerInfo` **只构造一次、
// 被多条路共用**（`{...customerInfo, receipt: …}`），打印回执与收据单2 拿的是同一份行数据。
// 不自己重推一遍字段，避免两套格式化慢慢漂开。
//
// 唯一的实质性差异见下面 `安装地址` 那条注释。

import { createPrintPayloads, type PrintContext } from '../printPayloads'
import type { Receipt2Line, Receipt2Order } from './types'

/** 收据单2 的 10 列只用到这几个键；`receiptPrintData` 的行是它的超集。 */
function toReceipt2Line(row: Record<string, unknown>): Receipt2Line {
  return {
    profile: String(row.profile ?? ''),
    direction: String(row.direction ?? ''),
    color: String(row.color ?? ''),
    glass: String(row.glass ?? ''),
    size: String(row.size ?? ''),
    quantity: row.quantity as string | number,
    price: row.price as string | number,
    amount: row.amount as string | number,
    pricing: String(row.pricing ?? ''),
    remark: String(row.remark ?? ''),
  }
}

/**
 * `PrintContext` → 收据单2 的订单模型。
 *
 * ⚠️ **`brandSuffix` 默认「收据单」，不是「回执单」。**
 * 旧版 `customerInfo.brand` 先拼成 `(品牌||门店||"客户") + "回执单"`（`dr[801]`），
 * 但走收据单2 的那条路（Home 的 `pi`）会再替换一次：
 * `brand.replace(dr[801], dr[777])`，即把末尾的「回执单」换成「收据单」。
 *
 * 所以收据单2 上显示的是「XX收据单」。用默认值「回执单」会差一个字。
 */
export function buildReceipt2Order(ctx: PrintContext, brandSuffix = '收据单'): Receipt2Order {
  const data = createPrintPayloads(ctx).receiptPrintData(brandSuffix)

  return {
    orderNo: data.orderNo,
    date: data.date,
    client: data.client,
    tel: data.tel,
    // ⚠️ **中文键，且取的是原始安装地址**。
    // 不能拿 `data.address` 顶上 —— 那个是**派生过**的（`install_address ? 行地址去重 : 客户地址`），
    // 订单没填安装地址时会回落成客户地址，与收据单2 要的不是一回事。
    // 旧版 `customerInfo` 同时写了 `address`（派生）与 `"安装地址"`（原始）两个字段，
    // 收据单2 渲染器只读后者（`Receipt2.deobfuscated.js` 的 `de()`）。
    安装地址: ctx.order.install_address || '',
    productionDays: data.productionDays,
    brand: data.brand,
    total: data.total,
    deposit: data.deposit,
    balance: data.balance,
    declaration: data.declaration ?? '',
    payQrcode: data.payQrcode ?? '',
    receipt: (data.receipt as unknown as Record<string, unknown>[]).map(toReceipt2Line),
  }
}
