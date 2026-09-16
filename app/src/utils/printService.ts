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
// ⚠️ print-lock.css 有**两条**引入途径，缺一不可：
//   ① `import('…print-lock.css')` —— 屏幕上的「模板预览」用（Vite 注入成 <style>）
//   ② `index.html` 里的 `<link media="print" href="/print-lock.css">` —— **实打**用
//      （hiprint 的 hiwprint 只从 `link[media=print][href*="print-lock"]` 收集 CSS 塞进打印
//       iframe；旧版也是这么引的，见 legacy/index.html:17）。文件在 `public/print-lock.css`。
//       （① 的 import 在下面 `loadHiprint()` 里按需做，别提到模块顶层。）

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
  // 与 `renderByJson` 同理：**必须先把 config 喂进去**（填充 printPanels），
  // 否则 `getHtml` 拿不到内容，`print()` 只会往打印 iframe 里写一个**空的**
  // `<div class="hiprint-printTemplate"></div>` —— 实打出来就是白纸。
  const cfg = (templateJson as { config?: unknown })?.config
  if (cfg) await tpl.update(cfg)
  tpl.print(data, {}, {
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
