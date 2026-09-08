// hiprint 打印引擎封装。
// 模板 JSON 形如 { config: { panels: [{ printElements: [...] }] } }，
// 与后端 print_templates.template 字段直接对应（已从旧系统 getTemplates 导入）。
//
// 引擎按需动态加载（import() 分包），避免 hiprint 及其依赖拖累首屏体积。
import { api } from '../api/client'

export type PrintData = Record<string, unknown>

/** hiprint 支持单页数据对象或数组（数组每个元素渲染为一页/一张标签）。 */
export type PrintPayload = PrintData | PrintData[]

type HiprintModule = typeof import('@sv-print/hiprint')

let initialized = false
let mod: HiprintModule | null = null

async function loadHiprint(): Promise<HiprintModule> {
  if (!mod) mod = await import('@sv-print/hiprint')
  if (!initialized) {
    mod.hiprint.init({})
    initialized = true
  }
  return mod
}

/** 用模板 JSON + 数据直接打印（弹系统打印对话框）。 */
export async function printByJson(templateJson: unknown, data: PrintPayload): Promise<void> {
  const { hiprint } = await loadHiprint()
  const tpl = new hiprint.PrintTemplate({ template: templateJson as Record<string, unknown> })
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
