// 端到端验证用的聚合入口（只存在于 /tmp，不进仓库）。
export { buildOrderPrintContext } from '/Users/aaa/Desktop/door-main/app/src/composables/useOrderPrint'
export { buildReceipt2Order } from '/Users/aaa/Desktop/door-main/app/src/utils/receipt2/order'
export { renderPage } from '/Users/aaa/Desktop/door-main/app/src/utils/receipt2/html'
export { DEFAULT_VISIBILITY, DEFAULT_BRAND, defaultElementConfigs } from '/Users/aaa/Desktop/door-main/app/src/utils/receipt2/defaults'
export { createPrintPayloads } from '/Users/aaa/Desktop/door-main/app/src/utils/printPayloads'

import { createPrintPayloads, type PrintContext } from '/Users/aaa/Desktop/door-main/app/src/utils/printPayloads'
export function receiptPrintDataOf(ctx: PrintContext) {
  return createPrintPayloads(ctx).receiptPrintData()
}
