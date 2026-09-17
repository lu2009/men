// 端到端验证用的聚合入口（只存在于 /tmp，不进仓库）。
const ROOT = '/Users/aaa/Desktop/door-main/app/src'

export { buildOrderPrintContext } from '/Users/aaa/Desktop/door-main/app/src/composables/useOrderPrint'
export { createPrintPayloads } from '/Users/aaa/Desktop/door-main/app/src/utils/printPayloads'
export { buildGlassSheet2Html } from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/paginate'
export { buildDocumentHtml } from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/html'
export { createDefaultConfig } from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/defaults'
void ROOT
export { createQrSvgProvider } from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/html'
export { createQrEncoder } from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/qr'
