// hiprint 打印引擎封装。
// 模板 JSON 形如 { config: { panels: [{ printElements: [...] }] } }，
// 与后端 print_templates.template 字段直接对应（已从旧系统 getTemplates 导入）。
//
// 引擎用 **vue-plugin-hiprint 0.0.60**（旧版 bundle 内嵌的正是该版本）。
// 注意别换回 @sv-print/hiprint：那个 fork 没有注册 barcode/qrcode 元素类型，
// 而生产单/回执/标签模板都含 qrcode 元素，会导致 update() 抛「类型元素无法创建」、打印空白。
//
// 引擎按需动态加载（import() 分包），避免 hiprint 及其依赖拖累首屏体积。
import { api } from '../api/client'
// hiprint 的打印流程（`$el.hiwprint`）**只会**从页面里的
// `<link media="print" href="*print-lock.css">` 收集样式塞进打印 iframe：
//     $('link[media=print]').each(el => { if (el.href 含 'print-lock.css') a += '<link …>' })
// 而我们是 `import('…print-lock.css')` 引的（Vite 注入成 `<style>`，没有那个 `<link>`），
// 于是 **实打 iframe 里一个样式表都没有** —— 单元格 vertical-align / 内边距 / 表头加粗 /
// 边框色全丢，变成「预览有、实打没有」。
// 用 hiprint 自己的扩展点 `styleHandler`（`print(data, options, ext)` 的第三个参数）把 CSS
// 原文直接塞进 iframe 的 head：dev 与构建都成立，也不受资源哈希改名影响。
import printLockCssText from 'vue-plugin-hiprint/dist/print-lock.css?raw'

export type PrintData = Record<string, unknown>

/** hiprint 支持单页数据对象或数组（数组每个元素渲染为一页/一张标签）。 */
export type PrintPayload = PrintData | PrintData[]

/** hiprint 构造函数类型（仅取本文件用到的方法）。 */
interface HiprintCtor {
  init: (options?: Record<string, unknown>) => void
  PrintTemplate: new (options: { template: unknown }) => {
    print: (data: unknown, options?: Record<string, unknown>, ext?: Record<string, unknown>) => void
    getHtml: (data: unknown) => Promise<unknown>
    update: (json: unknown, panelIndex?: number, history?: boolean) => unknown
  }
}

// 该包是 UMD/CJS，dev 下 Vite 预打包只暴露 default，故同时兼容两种取法。
type HiprintModule = {
  hiprint?: HiprintCtor
  defaultElementTypeProvider?: unknown
  default?: { hiprint?: HiprintCtor; defaultElementTypeProvider?: unknown }
} & Partial<HiprintCtor>

let initialized = false
let hip: HiprintCtor | null = null

function pick(mod: HiprintModule): { hiprint: HiprintCtor; providers: unknown[] } {
  const d = mod.default
  const hiprint = (mod.hiprint ?? d?.hiprint ?? (mod as unknown as HiprintCtor))!
  // providers 会被 `t.addElementTypes(...)` 直接调用，故必须是**实例**（该导出是构造函数）。
  const P = (mod.defaultElementTypeProvider ?? d?.defaultElementTypeProvider) as (new () => unknown) | undefined
  return { hiprint, providers: P ? [new P()] : [] }
}

async function loadHiprint(): Promise<HiprintCtor> {
  if (!hip) {
    const mod = (await import('vue-plugin-hiprint')) as unknown as HiprintModule
    await import('vue-plugin-hiprint/dist/print-lock.css')
    const picked = pick(mod)
    // 必须显式传 providers，否则 barcode/qrcode 元素类型缺失（模板含二维码会整张打不出来）。
    picked.hiprint.init({ providers: picked.providers })
    hip = picked.hiprint
    initialized = true
  } else if (!initialized) {
    hip.init({})
  }
  return hip
}

/** 用模板 JSON + 数据直接打印（弹系统打印对话框）。 */
export async function printByJson(templateJson: unknown, data: PrintPayload): Promise<void> {
  const hiprint = await loadHiprint()
  const tpl = new hiprint.PrintTemplate({ template: templateJson as Record<string, unknown> })
  tpl.print(data, {}, {
    // ⚠️ 必须给：否则实打 iframe 里没有任何 hiprint 样式（见文件头注释）
    styleHandler: () => `<style>${printLockCssText}</style>`,
    callback: () => {
      // 打印窗口关闭后无额外清理。
    },
  })
}

/** 按 mode 从后端拉模板并打印。 */
export async function printByMode(mode: string, data: PrintPayload): Promise<void> {
  const templates = await api.getPrintTemplatesByMode(mode)
  const tpl = templates[0]
  if (!tpl) throw new Error(`未配置打印模板：${mode}`)
  await printByJson(tpl.template, data)
}

/** 用模板 JSON 渲染成 HTML（**不打印**）——页面上的「单据预览」用，与打印走同一套渲染核心。 */
export async function renderByJson(templateJson: unknown, data: PrintPayload): Promise<string> {
  const hiprint = await loadHiprint()
  const tpl = new hiprint.PrintTemplate({ template: templateJson as Record<string, unknown> })
  // 必须先把模板喂进去（填充 printPanels），否则 getHtml 会抛 getLayoutStyle of undefined
  const cfg = (templateJson as { config?: unknown })?.config
  if (cfg) await tpl.update(cfg)
  const html = await tpl.getHtml(data)
  const arr = Array.isArray(html) ? html : html && (html as Record<number, unknown>)[0] ? Array.from(html as ArrayLike<unknown>) : [html]
  return arr.map((n) => (n as { outerHTML?: string })?.outerHTML || '').join('')
}

/** 按 mode 拉模板并渲染成 HTML。 */
export async function renderByMode(mode: string, data: PrintPayload): Promise<string> {
  const templates = await api.getPrintTemplatesByMode(mode)
  const tpl = templates[0]
  if (!tpl) throw new Error(`未配置打印模板：${mode}`)
  return renderByJson(tpl.template, data)
}
