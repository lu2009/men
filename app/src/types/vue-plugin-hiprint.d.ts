// vue-plugin-hiprint 未自带类型声明（包内无 .d.ts），此处按实际用法补最小声明。
declare module 'vue-plugin-hiprint' {
  /** 内置元素类型提供者（含 text/image/table/longText/barcode/qrcode 等）。 */
  export const defaultElementTypeProvider: unknown
  export const hiprint: {
    init: (options?: Record<string, unknown>) => void
    PrintTemplate: new (options: { template: unknown }) => {
      print: (data: unknown, options?: Record<string, unknown>, ext?: Record<string, unknown>) => void
      getHtml: (data: unknown) => Promise<unknown>
      update: (json: unknown, panelIndex?: number, history?: boolean) => unknown
    }
  }
  export const hiPrintPlugin: unknown
  export function autoConnect(cb?: (status?: boolean, msg?: unknown) => void): void
  export function disAutoConnect(): void
}

declare module 'vue-plugin-hiprint/dist/print-lock.css'
