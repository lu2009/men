// 明细行「引擎」—— 行级算钱/算方/候选源/校验/落库动作。
//
// ## 为什么有这个文件
//
// 旧版的平开/移门明细表是**两个独立 SFC**（`Ping_hui` / `Diao_hui`），编译进 Hui chunk 后
// export 出来，被 **Hui 页面**和 **Home 的展开行**同时使用
// （`legacy/js/Home.formatted.js:9` `import { _ as l, a as o } from "./Hui-d088417c.js"`）。
// 新版从没拆过，Home 的展开行是自绘的一张只读 13 列表 —— 这是审计 A3/F3 那条架构级偏离。
//
// 要复用就得先把「表格」从 Hui.vue 里拆出来，而表格背后是一整套行编辑引擎。
// 本文件就是那套引擎，从 `Hui.vue` **整段搬过来，函数体逐字未改**。
//
// ## 搬迁保真
//
// 为了让「搬过去的代码和原来一字不差」这件事**可被机器验证**（而不是靠人眼看），
// 本文件在顶部把依赖**解构成与 Hui.vue 里同名的局部变量**：
//
// ```ts
// const { lines, formulas, order, orderId, disableAutoMarkup } = deps
// const message = useMessage()
// const dialog = useDialog()
// ```
//
// 于是每个函数体里的 `lines.value` / `formulas.value` / `order.client_code` /
// `orderId.value` / `disableAutoMarkup.value` / `message.xxx` / `dialog.xxx`
// **一个字都不用改**。搬迁检查脚本（`docs/home-audit/hui-extract-movecheck.mjs`）
// 拿 `git show HEAD:app/src/views/Hui.vue` 里那些函数体与本文件逐字比对，
// 不一致就报错 —— 详见该脚本头部。
//
// ## 边界
//
// - **进本文件**：算钱/算方/几何、候选源（型材·颜色·轨道·套线·五金·锁具）、
//   字段历史持久化、默认值（localStorage）、行级动作（改行重算/删除/复制/取价）、
//   自动加价（尺寸类）。
// - **留在页面**：`saveOrder`/`loadOrder`/打印/路由守卫/脏检查/页面弹窗。
// - **留在组件**（`components/DetailLinesTable.vue`）：`h()` 单元格渲染、列定义、模板、CSS。
// - **算料核心**：`calcRowParts`（单行算料）—— 2026-09-19 从 Hui.vue 的 `calcSingleRow` 抽来，
//   页面只留「挖孔图缓存 + 模板预览」两件页面能力（经 `beforeCompute` 回调注入）。
//   这一条是**新写的**（不是搬迁），所以搬迁保真检查不覆盖它 —— 它由 `hui-row-save-check` /
//   Home 接线后的回归管。

import { computed, h, ref } from 'vue'
import { NRadio, NRadioGroup, useDialog, useMessage } from 'naive-ui'
import { api } from '../api/client'
import type { FormulaDto } from '../api/types'
import type { PartsMap } from '../utils/formulaEngine'
import { markupDetail, type MarkupItem } from '../utils/markupLines'
import {
  createPartsEngine,
  partsCache,
  round2,
  type EngineId,
  type Line,
  type PartPreview,
} from '../utils/partsEngine'
import { casingAmountOf } from '../utils/printPayloads'
import { markupCatalog } from './useMarkupCatalog'
import type { Ref } from 'vue'

/**
 * 尺寸类字段（触发自动加价的那三个）。
 *
 * ⚠️ **必须导出**：单元格（`wallThicknessCell` / `intCell`）在视图侧签名里要用它。
 * 原来它声明在 Hui.vue 内部，搬走后视图侧就找不到了。
 */
export type SizeField = 'door_width' | 'door_height' | 'wall_thickness'

/** 引擎的外部依赖。全部由调用方（页面/组件 setup）持有，引擎只读写、不拥有。 */
export interface OrderLinesDeps {
  /** **整张订单的行数组**（两张表共用一份，按 `line_type` 过滤成两张表）。 */
  lines: Ref<Line[]>
  /** 公式表 —— 算料引擎与型材/五金候选都靠它。 */
  formulas: Ref<FormulaDto[]>
  /** 订单头。引擎只读 `client_code`（取价要传）。 */
  order: { client_code: string }
  /** 订单 id；`null` = 尚未落库（决定删除走不走接口）。 */
  orderId: Ref<number | null>
  /** 页面「自动加价设置」开关。 */
  disableAutoMarkup: Ref<boolean>
  /**
   * 提示 / 确认框。**默认取组件上下文里的**（`useMessage`/`useDialog`），
   * 传了就用手上这份 —— 好让引擎能在**组件外**（验收脚本）被驱动。
   *
   * ⚠️ `??` 是**短路**的：传了就不调 `useMessage()`，所以脚本里不会触发
   *    「no active component instance」那条告警。组件里永远不传，行为与搬迁前一致。
   */
  message?: MessageApi
  dialog?: DialogApi
}

/** `useMessage()` 的返回类型（不直接 import naive-ui 的内部类型，避免版本耦合）。 */
export type MessageApi = ReturnType<typeof useMessage>
/** `useDialog()` 的返回类型。 */
export type DialogApi = ReturnType<typeof useDialog>

// localStorage 存取（隐私模式 / 配额异常时静默降级）。
// **模块级导出**（不是工厂内部）：页面里 `disableAutoMarkup` 等初始化也要用它，
// 而那时引擎还没实例化；各存一份会漂。
export const LS = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, val: string) {
    try {
      localStorage.setItem(key, val)
    } catch {
      // 忽略
    }
  },
}

export function useOrderLines(deps: OrderLinesDeps) {
  // ⚠️ 名字必须与 Hui.vue 里一致 —— 见文件头「搬迁保真」。别改名。
  const { lines, formulas, order, orderId, disableAutoMarkup } = deps
  const message = deps.message ?? useMessage()
  const dialog = deps.dialog ?? useDialog()

  // —— 旧版「默认值」机制 ——
  // 键名照抄原版（平开 @36957 / 移门 @147180 两个 ref 初始化）：
  //   底玻   `BottomGlass`     两表**共用同一个键**，但**首次运行回落值不同**：平开「磨砂」、移门「白玻」
  //   玻璃厚 `GlassThickness`  两表共用，回落 4
  //   开向   `OpenDirection`   **只有移门表**读，回落「左前」（平开表开向硬编码 `""`）
  // 且**平开表**在用户改这三项时会「顺带设为默认」并弹提示（`le`/`ne`/`te`，定义 @36957、调用 @75380/@75890/@77100/@93688），
  // 守卫一致：**非空 且 与当前默认不同** 才写并提示。
  const LS_BOTTOM_GLASS = 'BottomGlass'
  const LS_GLASS_THICKNESS = 'GlassThickness'
  const LS_OPEN_DIRECTION = 'OpenDirection'
  /** 默认底玻：平开「磨砂」/ 移门「白玻」（等价于原版 `F.value` / `O.value`）。 */
  const defaultBottomGlass = (type: 'ping' | 'diao') => LS.get(LS_BOTTOM_GLASS) || (type === 'diao' ? '白玻' : '磨砂')
  /** 默认玻璃厚（等价于原版 `ee.value` / `P.value`）。 */
  const defaultGlassThickness = () => Number(LS.get(LS_GLASS_THICKNESS)) || 4
  /** 改底玻 → 设为默认（原版 `le`）。 */
  function rememberDefaultBottomGlass(v: string) {
    const next = (v || '').trim()
    if (!next || next === defaultBottomGlass('ping')) return
    LS.set(LS_BOTTOM_GLASS, next)
    message.success(`已将"${next}"设为默认底玻`)
  }
  /** 改玻璃厚 → 设为默认（原版 `ne`）。 */
  function rememberDefaultGlassThickness(v: string) {
    const n = Number(v)
    if (!v || Number.isNaN(n) || n === defaultGlassThickness()) return
    LS.set(LS_GLASS_THICKNESS, String(n))
    message.success(`已将"${n}mm"设为默认玻璃厚度`)
  }

  // 记忆默认：新建行读取，提交行写回「上一次使用值」。
  // 数字清洗：n-input-number 清空时给 null/NaN，统一归零（数量≥1），防后端 400。
  // 非负整数先 round 再 clamp；其余尺寸四舍五入到 0 位（毫米/元）。
  function sanitizeNum(v: number | null | undefined, min = 0): number {
    const n = Number.isFinite(v) ? (v as number) : 0
    const r = Math.round(n)
    return Math.max(min, r)
  }
  function sanitizeFloat(v: number | null | undefined, min = 0): number {
    const n = Number.isFinite(v) ? (v as number) : 0
    const r = round2(n)
    return Math.max(min, r)
  }

  // 通用候选历史持久化（仿旧版 saveOptions(选项库)）：录入/载入的候选写入 localStorage，刷新仍保留。
  // 每个字段一个 key，如 color/casing/track/hardware/profile。
  function readFieldHistory(key: string): string[] {
    try {
      const raw = LS.get(`smartdoor_field_history_${key}`)
      if (!raw) return []
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim()) : []
    } catch {
      return []
    }
  }
  function writeFieldHistory(key: string, list: string[]) {
    try {
      LS.set(`smartdoor_field_history_${key}`, JSON.stringify(list))
    } catch {
      // 忽略
    }
  }
  function rememberField(key: string, value: string) {
    const v = (value || '').trim()
    if (!v) return
    const list = readFieldHistory(key)
    if (!list.includes(v)) {
      list.unshift(v)
      writeFieldHistory(key, list.slice(0, 50))
    }
  }

  // 颜色候选（本地持久化历史 + 当前已录入颜色；与旧版 autocomplete 一致，无内置色卡）
  const colorOptions = computed<{ label: string; value: string }[]>(() => {
    const seen = new Set<string>()
    const out: { label: string; value: string }[] = []
    const push = (c: string) => {
      const v = (c || '').trim()
      if (v && !seen.has(v)) {
        seen.add(v)
        out.push({ label: v, value: v })
      }
    }
    for (const c of readFieldHistory('color')) push(c)
    for (const l of lines.value) push(l.color)
    return out
  })

  // 候选源构建通用函数：预设 + 已录入历史

  // 从当前行公式 parts 提取轨道/套线候选（原版部件 track 语义，按型材联动）。
  //   track：部件 track 非空且非单包/双包（如"标配"）；套线：track==单包/双包 → 单包/双包（无"套线"后缀）。
  function partsTrackOptions(l: Line, kind: 'track' | 'casing'): { label: string; value: string }[] {
    const f = formulaOf(l)
    const parts = (f?.parts ?? {}) as Record<string, { track?: string; materialName?: string }>
    const history = readFieldHistory(kind)
    const seen = new Set<string>()
    const out: { label: string; value: string }[] = []
    const push = (v: string) => {
      const s = (v || '').trim()
      if (s && !seen.has(s)) {
        seen.add(s)
        out.push({ label: s, value: s })
      }
    }
    for (const h of history) push(h)
    for (const p of Object.values(parts)) {
      if (!p || typeof p !== 'object') continue
      const t = (p.track || '').trim()
      if (!t) continue
      if (kind === 'track') {
        if (t !== '单包' && t !== '双包') push(t)
      } else {
        // 套线候选 = 原版单包/双包(无"套线"后缀)，来自部件 track
        if (t === '单包' || t === '双包') push(t)
      }
    }
    return out
  }

  // 锁具候选（原版 getOptions("lock") + 取价接口 lock 数组）
  const lockOptions = ref<string[]>([])
  function rememberLocks(vals: unknown) {
    if (!Array.isArray(vals)) return
    for (const v of vals) {
      const s = String(v ?? '').trim()
      if (!s) continue
      if (!lockOptions.value.includes(s)) lockOptions.value.push(s)
      rememberField('lock', s)
    }
  }

  // 五金候选（原版）：公式 hinge 的键（合页名）+ 历史录入（getOptions("hardware")）+ 锁具（getOptions("lock") + 取价 lock 数组）。
  // 无内置预设、不读 extra.hardware。
  function hardwareOptionsFor(l: Line): { label: string; value: string }[] {
    const seen = new Set<string>()
    const out: { label: string; value: string }[] = []
    const push = (v: unknown) => {
      const s = String(v ?? '').trim()
      if (s && !seen.has(s)) {
        seen.add(s)
        out.push({ label: s, value: s })
      }
    }
    // ① 本行公式 hinge 的键（合页名）优先
    const hinge = (formulaOf(l)?.extra as { hinge?: Record<string, unknown> } | undefined)?.hinge
    if (hinge && typeof hinge === 'object') for (const k of Object.keys(hinge)) push(k)
    // ② 原版（@89220）：五金格候选主体来自服务端 `initializPing.hingeNames` —— 一个**全局合页名列表**，
    //    与本行公式无关（渲染时 `hingeNames.filter(e => !已选.includes(e))`）。
    //    本系统无该字段，用「**所有公式 `extra.hinge` 键的并集**」等价近似（同一语义：租户的合页名清单）。
    for (const f of formulas.value) {
      const h = (f.extra as { hinge?: Record<string, unknown> } | undefined)?.hinge
      if (h && typeof h === 'object') for (const k of Object.keys(h)) push(k)
    }
    for (const h of readFieldHistory('hardware')) push(h)
    for (const k of readFieldHistory('lock')) push(k)
    for (const k of lockOptions.value) push(k)
    return out
  }

  function newLine(type: 'ping' | 'diao'): Line {
    // 计价默认：平开门读 PriceType（默认套），吊趟门旧版硬编码「方」。
    const defPriceType = type === 'diao' ? '方' : LS.get('PriceType') || '套'
    // 底玻/面玻/玻璃厚/开向 的初值**逐字照抄原版新建行工厂**（平开 @39301 / 移门 @149781）：
    //   `{"底玻": F.value, "面玻": "白玻", "玻璃厚": ce(), "开向": ""}`  ← 平开
    //   `{"底玻": O.value, "面玻": "白玻", "玻璃厚": …,   "开向": L.value}` ← 移门
    // 注意 **面玻是硬编码「白玻」**（不读 localStorage），且**底玻一定有值** ——
    // 原版从不产生「底玻为空」的行，故 `"无" === 底玻` 的严格判定不会误伤。
    const defBottomGlass = defaultBottomGlass(type)
    const defFaceGlass = '白玻'
    // 原版 `ce()`：底玻为「无」且默认厚度 < 8 时取 8，否则取默认厚度。
    const t = defaultGlassThickness()
    const defGlassThickness = String(defBottomGlass === '无' && t < 8 ? 8 : t)
    return {
      id: null,
      line_type: type,
      profile: '',
      color: '',
      // 移门开向回落「左前」（localStorage `OpenDirection`）；平开恒空串。
      direction: type === 'diao' ? LS.get(LS_OPEN_DIRECTION) || '左前' : '',
      fans: '', track: '', casing: '', hardware: '',
      bottom_glass: defBottomGlass, face_glass: defFaceGlass, glass_thickness: defGlassThickness,
      door_width: 0, door_height: 0, light_window_height: 0, wall_thickness: 0, jiao: 0,
      mother_door_width: 0,
      quantity: 1, unit_price: 0, price_type: defPriceType, discount: 1,
      square: 0, custom_square: -1, other_fee: 0, casing_price: 0, casing_amount: 0, amount: 0,
      parts: [],
      markup: [],
      formula_id: null, remark: '', install_address: '',
      open_img: '', edge_seal_count: type === 'diao' ? 2 : null, seal_board_height: 0, track_length: 0,
      front_casing_add: null, back_casing_add: null, double_ding: null,
      light_window_count: 0, image_id: null, image_url: null, progress: '', hole_size: '',
      line_no: '',
    }
  }

  // —— 算料引擎 ——
  // 原先在本组件内，2026-09-17 搬到 `utils/partsEngine.ts`，与 Home 的批量打印共用同一份实现
  // （同一张订单在页面上看到的料，必须和打出来的一致）。这里只留薄封装，调用点一行都不用改。
  const partsEngine = computed(() => createPartsEngine(formulas.value))
  /** 该行对应的公式（按 `formula_id`）。 */
  const formulaOf = (l: Line) => partsEngine.value.formulaOf(l)
  /** 该行公式是否钻石型（淋浴房 diamondling）。 */
  const isDiamond = (l: Line) => partsEngine.value.isDiamond(l)
  /** 按**指定引擎**算料。原版每个打印入口各跑一套引擎（A/B/D/P1/C），规则不同、结果可能不同。 */
  const computeParts = (l: Line, engine: EngineId = 'B') => partsEngine.value.computeParts(l, engine)

  /** 母门宽显隐：仅子母门/钻石型类公式（或型材含「子母」）才需要/显示（仿原版）。 */
  function needsMotherWidth(l: Line): boolean {
    if (isDiamond(l)) return true
    const ft = formulaOf(l)?.formula_type ?? ''
    if (ft === 'mother' || ft === 'childmother' || ft === '子母') return true
    return (l.profile || '').includes('子母')
  }

  /** 单樘面积（未乘数量）。钻石型：(宽+墙厚+亮窗高)×高/1e6；普通：宽×max(高,亮窗高)/1e6。 */
  function singleArea(l: Line): number {
    const w = l.door_width || 0
    const h = l.door_height || 0
    if (isDiamond(l)) {
      return ((w + (l.wall_thickness || 0) + (l.light_window_height || 0)) * h) / 1_000_000
    }
    return (w * Math.max(h, l.light_window_height || 0)) / 1_000_000
  }

  /** 扇数 N（最小平方倍数：取「扇」前一位数字；活=2；单扇=1）。 */
  function fanCount(l: Line): number {
    const fan = l.fans || ''
    if (fan.includes('活')) return 2
    const m = fan.match(/(\d+)\s*扇/)
    if (m) return Number(m[1])
    if (fan.includes('单扇')) return 1
    return 0
  }

  /** 最小平方数：来自公式 square 配置（数字 或 {扇数:"min-max"}）。0 表示无最小。 */
  function minSquareOf(l: Line): number {
    const f = formulaOf(l)
    if (!f) return 0
    const raw = (f.square ?? '').trim()
    if (!raw || raw === '0') return 0
    if (raw.startsWith('{')) {
      try {
        const obj = JSON.parse(raw)
        const v = obj[l.fans]
        if (v === undefined) return 0
        if (typeof v === 'string' && v.includes('-')) {
          const [lo, hi] = v.split('-').map((x) => Number(x.trim()) || 0)
          return (l.light_window_height || 0) > 0 ? hi : lo
        }
        const n = Number(v)
        return n > 0 ? n : 0
      } catch {
        return 0
      }
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) return 0
    // 移门：扇数 N × 最小平方
    if (l.line_type === 'diao') return fanCount(l) * n
    return n
  }

  /**
   * 平方数 = 每樘方数 × 数量。每樘方数：
   *   自定义方数 > -1  →  取自定义方数（**覆盖**，可升可降）
   *   否则             →  `max(单樘面积, 公式的最低平方数)`
   *
   * ⚠️ **这里有意偏离旧版**（用户 2026-09-16 拍板：「业务上真要手动改小」）。
   *
   * 旧版 `gt`（`Hui.formatted.js:1314-1331`）是 `l = 自定义方数` → `Math.max(面积, l)`，
   * 调用方 `平方数 = gt(行) * 数量`（`:1478`）—— 即自定义方数只是**每樘下限**，
   * 填得比面积小就抬不动，等于白填。我们照旧版实现过（`556ed7eb`），实测确实如此：
   * 面积 2.0 填 1 → 平方数仍是 2.0，表格不变、只有弹窗里的数字变了。
   * 老板要的是「手改小」，所以改成**覆盖**：填多少就是多少（含低于面积、低于最低平方数）。
   *
   * 清空输入框（空 → -1）即回到自动。除此之外与旧版一致：仍是**每樘**值，外层乘数量。
   */
  function computeSquare(l: Line): number {
    const custom = l.custom_square ?? -1
    const per = custom > -1 ? custom : Math.max(singleArea(l), minSquareOf(l))
    return round2(per * (l.quantity || 1))
  }

  /** 金额（旧版 wt+round）：套线金额只在「方」时计入；金额取整元。
   *   套 = 单价×数量 + 其它费用；方 = 单价×平方 + 套线金额 + 其它费用；金额 = Math.round(基准×打折)。 */
  function computeAmount(l: Line): number {
    const isSquare = l.price_type === '方'
    let base = (l.unit_price || 0) * (isSquare ? l.square || 0 : l.quantity || 1)
    if (isSquare) base += l.casing_amount || 0 // 套线金额仅在「方」时计入；套不含套线
    const subtotal = base + (l.other_fee || 0)
    return Math.round(subtotal * (l.discount || 0))
  }

  /**
   * 单条加价项：算出 **金额** 与 **明细文本**。
   *
   * 实现见 `utils/markupLines.ts` —— 与**电子回执单**（`utils/receiptBuilder.ts`）共用同一份，
   * 旧版 `ps` 的 `加价项目` 与打印回执的 `pricingDetail` 本来就取同一个串（`Hui.formatted.js:1308`）。
   */

  /**
   * 重算整行加价：逐条算金额，合计写入 `other_fee`。
   *
   * ⚠️ 这里**只算钱，不增删任何项**。
   *   原版 `wt`/`ft`（`Hui.formatted.js:1256-1307` / `:4170-4204`）就是遍历「已挂的项」算钱，
   *   一个 `splice`/`filter` 都没有（已逐行核过）。**该挂哪些自动项，全部由字段失焦钩子决定**：
   *     平开 `Qt`（`:1578-1626`，门洞宽/门洞高/墙厚）、玻璃 `_e`（`:845-871`）
   *     吊趟 `:5075-5125`（只墙厚，≥2 候选弹窗）
   *   原先这里按「阈值最大者胜」把落选的自动项**直接剔除** —— 后果是：
   *   关掉自动加价后，只要行上任何一个字段变化触发重算，用户手动挂的 `超宽N` 也会被悄悄删掉；
   *   原版此时是不动的（钩子被开关挡住，`wt` 又从不删项）。
   */
  /** 加价计算异常上报（原版 catch 里就是 `ElMessage.error('计算金额失败')`）。 */
  function markupError(msg: string) {
    message.error(msg)
  }

  function recalcMarkup(l: Line): number {
    let total = 0
    // `carry` 贯穿整行 —— 复刻原版把基准量声明在**循环外**（平开 `o` @:1259 / 吊趟 `c` @:4173）
    const carry = { v: 0 }
    for (const item of l.markup ?? []) {
      item.amount = round2(markupDetail(item, l, carry, markupError).amount)
      total += item.amount
    }
    l.other_fee = round2(total)
    return l.other_fee
  }

  // ===== 行内就地编辑（仿旧版 Excel 式表格）=====
  // 值变更即重算（平方/套线金额/金额/加价），型材失焦触发取价+公式。
  const lineRefresh = (l: Line) => {
    // 行上任何字段变了都丢掉该行的算料缓存。
    // `partsSig` 已经把所有影响算料的字段列全，这里是**兜底**：万一以后又新增了
    // 影响算料结果的行字段却忘了加进签名，也不会再出现「改了字段、算料结果不变、
    // 点『算料』也没用」的幽灵 bug（洞尺/单双丁 都栽过这个）。
    partsCache.delete(l)
    l.square = computeSquare(l)
    recalcMarkup(l)
    l.casing_amount = casingAmountOf(l)
    l.amount = computeAmount(l)
  }

  const lastProf = new WeakMap<object, string>()

  // 型材名 ↔ 公式名 兜底匹配：resolveFormulaMatch(空表) 查不到时，按公式名直接命中 formulas。
  // 表归属用 belongsToTable（平开收平开族，**不是** formula_type 字面判等），否则 diamond 等选不到。
  function matchFormulaByName(l: Line): FormulaDto | undefined {
    const profile = l.profile.trim()
    if (!profile) return undefined
    return formulas.value.find(
      (f) =>
        belongsToTable(f.formula_type, l.line_type) &&
        (f.name.trim() === profile || (f.name && profile.includes(f.name)) || (f.name && f.name.includes(profile))),
    )
  }

  // 行内型材取价 + 自动公式（与抽屉 onProfileBlur 同一套，映射到行）
  async function resolveRow(l: Line) {
    const profile = l.profile.trim()
    if (!profile || profile === lastProf.get(l)) return
    lastProf.set(l, profile)
    try {
      const r = await api.resolvePrice(l.line_type, profile, order.client_code || undefined)
      if (r) {
        l.unit_price = r.unit_price
        l.price_type = r.price_type === '方' ? '方' : '套'
        if (l.line_type === 'diao' && r.casing_price != null) l.casing_price = r.casing_price
        rememberLocks(r.lock_rules) // 取价返回的锁具可选项 → 并入五金/锁具候选（原版 getPingPrice 的 lock）
      }
      const m = await api.resolveFormulaMatch(l.line_type, profile, l.fans || undefined)
      if (m) {
        l.formula_id = m.formula_id
      } else {
        const fm = matchFormulaByName(l)
        if (fm) l.formula_id = fm.id
      }
    } catch {
      // 静默
    }
    lineRefresh(l)
  }

  // 玻璃切换→加价项联动（旧版 Y()）：玻璃改选后，移除名=旧玻璃、单位=元/方的加价项，
  // 并自动加入目录中名=新玻璃、单位=元/方的项。newValue 为空时只移除不新增。
  function syncGlassMarkup(l: Line, newValue: string, oldValue: string) {
    const isSquare = (m: MarkupItem) => m.unit === '元/方'
    // 先移除旧玻璃对应的「元/方」加价项
    const old = (oldValue || '').trim()
    if (old) {
      l.markup = (l.markup ?? []).filter((m) => !(isSquare(m) && m.name === old))
    }
    // 加入新玻璃对应的「元/方」加价项（来自目录，避免重复）
    const next = (newValue || '').trim()
    if (next) {
      const targets = markupCatalog.value.filter((c) => c.name === next && c.unit === '元/方')
      for (const c of targets) {
        if (!(l.markup ?? []).some((m) => m.name === c.name && m.unit === '元/方')) {
          l.markup.push({ ...c, amount: 0 })
        }
      }
    }
    lineRefresh(l)
  }

  // 面玻/底玻合并联动：改任一玻璃都同步玻璃厚（按当前两玻状态）与「元/方」玻璃加价项。
  function onGlassSelection(l: Line, newValue: string, oldValue: string) {
    syncGlassMarkup(l, newValue, oldValue)
    // 逐字照抄旧版 `oe`（@38200 一带），与本次改的是哪个字段无关（对两者 blur 都触发）：
    //   if ("无" === 底玻)                                     → 玻璃厚 = 8
    //   else if ("无" !== 底玻 && "无" !== 面玻 && 8 === 厚)    → 玻璃厚 = 默认厚（默认厚非法或为 8 时取 4）
    // **严格判字面量「无」** —— 空串不算「无」（原版新建行底玻恒有值，不会出现空串）。
    // 原版第二支**只在厚恰好为 8 时**才改写，且取的是「默认玻璃厚」而非写死 4。
    const bottom = (l.bottom_glass || '').trim()
    const face = (l.face_glass || '').trim()
    if (bottom === '无') {
      l.glass_thickness = '8'
    } else if (face !== '无' && Number(l.glass_thickness) === 8) {
      const t = defaultGlassThickness()
      l.glass_thickness = String(Number.isFinite(t) && t !== 8 ? t : 4)
    }
    lineRefresh(l)
  }

  // ===== 尺寸类自动加价（平开 / 吊趟两套）=====
  // 平开 `Qt`  Hui.formatted.js:1578-1626
  // 吊趟      Hui.formatted.js:5075-5125
  // 触发时机都是**失焦**（不是随输入），且都受「自动加价」开关控制。

  /** 候选：目录里 `^前缀\d+$` 且 元/公分，且**阈值严格小于**实际值（原版 `n > e`）。 */
  function sizeMarkupCandidates(prefix: string, actual: number) {
    const re = new RegExp(`^${prefix}\\d+$`)
    return markupCatalog.value
      .map((c) => ({ c, th: Number((c.name.trim().match(/\d+$/) || [])[0] || 0) }))
      .filter((x) => re.test(x.c.name.trim()) && x.c.unit === '元/公分' && actual > x.th)
  }

  /**
   * 平开尺寸类自动带出（原版 `Qt`）。
   * - 门洞宽→`超宽`、门洞高→`超高`、墙厚→`超墙厚`
   * - **门洞宽/门洞高 仅当 `计价方式==='套'`**；墙厚恒触发
   * - 先按 `startsWith(前缀)` 清掉本行旧项（比候选筛选用 `^前缀\d+$` 更松，原版如此），
   *   再取「阈值最大（= 差值最小）」的一条挂上
   */
  function syncSizeMarkupPing(l: Line, field: SizeField) {
    if (disableAutoMarkup.value) return
    if (field !== 'wall_thickness' && l.price_type !== '套') return
    const prefix = field === 'door_width' ? '超宽' : field === 'door_height' ? '超高' : '超墙厚'
    const actual =
      field === 'door_width' ? l.door_width || 0 : field === 'door_height' ? l.door_height || 0 : l.wall_thickness || 0

    l.markup = (l.markup ?? []).filter(
      (m) => !(m.name.trim().startsWith(prefix) && m.unit === '元/公分'),
    )
    const cands = sizeMarkupCandidates(prefix, actual)
    if (cands.length) {
      cands.sort((a, b) => b.th - a.th)
      l.markup.push({ ...cands[0].c, amount: 0 })
    }
    lineRefresh(l)
  }

  /** 吊趟「超墙厚」多候选择一（原版 `ElMessageBox.confirm(html,"选择加价项目",{dangerouslyUseHTMLString})` @:5108-5125）。 */
  function pickDiaoWallMarkup(l: Line, cands: { c: { name: string; price: number; unit: string }; th: number }[]) {
    const sel = ref(0)
    dialog.warning({
      title: '选择加价项目',
      content: () =>
        h('div', { style: 'max-height:300px;overflow-y:auto' }, [
          h('p', { style: 'margin-bottom:12px;font-weight:bold' }, '检测到多个超墙厚选项，请选择一个：'),
          h(
            NRadioGroup,
            { value: sel.value, 'onUpdate:value': (v: number) => (sel.value = v) },
            {
              default: () =>
                cands.map((x, i) =>
                  h(NRadio, { key: i, value: i, label: `${x.c.name} ${x.c.price}${x.c.unit}` }),
                ),
            },
          ),
        ]),
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => {
        const pick = cands[sel.value]
        if (!pick) return
        l.markup.push({ ...pick.c, amount: 0 })
        lineRefresh(l)
      },
    })
  }

  /**
   * 吊趟墙厚自动带出（原版 `:5075-5125`）。
   * ⚠️ 与平开有两处不同，**照抄**：
   *   ① 只处理 `墙厚 → 超墙厚`（没有 超宽/超高）
   *   ② 候选数 **`<=1` 直接 return** —— 只有 1 个候选时**不自动加**；≥2 才弹窗让用户选
   */
  function syncSizeMarkupDiao(l: Line) {
    if (disableAutoMarkup.value) return
    const actual = l.wall_thickness || 0
    l.markup = (l.markup ?? []).filter(
      (m) => !(m.name.trim().startsWith('超墙厚') && m.unit === '元/公分'),
    )
    const cands = sizeMarkupCandidates('超墙厚', actual)
    if (cands.length <= 1) {
      lineRefresh(l)
      return
    }
    pickDiaoWallMarkup(l, cands)
  }

  /** 尺寸类自动加价统一入口（按行类型分发）。 */
  function syncSizeMarkup(l: Line, field: SizeField) {
    if (l.line_type === 'diao') {
      if (field === 'wall_thickness') syncSizeMarkupDiao(l)
      return
    }
    syncSizeMarkupPing(l, field)
  }

  /**
   * 单行算料（「算料」按钮那条链路的核心）。
   *
   * ## 为什么抽到这里
   *
   * 旧版 Home 的算料是**内嵌整个 Hui 页面组件**、调它的 `calculateReceipt({ping,diao,single,singleRowData})`
   * （`Home.formatted.js:8221-8263`）。新版不照抄那条路 —— 核心抽进引擎，两个页面各自接自己的预览。
   * 见 `docs/2026-09-18-detail-table-extraction.md` §3.5。
   *
   * ## 参数
   *
   * `beforeCompute` 是「算之前先干的那件页面事」：Hui 传的是 `loadFormulaImages`（拉公式挖孔图，
   * 给 `glassHole`/`doorImg` 用）。**顺序不能变** —— 原版就是先拉图再 `computeParts`。
   *
   * ## 返回
   *
   * `true` = 真的算过（调用方可以去开预览 / 报「算料完成」）；`false` = 中途拦下了（提示已由本函数给出）。
   * 提示文案逐字照抄迁出前，别改。
   */
  async function calcRowParts(
    l: Line,
    beforeCompute?: (formulaId: number) => Promise<void>,
  ): Promise<boolean> {
    if (!l.profile.trim()) {
      message.warning('请先填写型材')
      return false
    }
    if (l.formula_id == null) {
      // 填了型材但未选/未匹配到公式 → 尝试按型材自动匹配公式（resolveFormulaMatch 或公式名兜底）
      await resolveRow(l)
      if (l.formula_id == null) {
        const fm = matchFormulaByName(l)
        if (fm) l.formula_id = fm.id
      }
      if (l.formula_id == null) {
        message.warning('未找到对应公式，请检查型材名称是否正确')
        return false
      }
    }
    try {
      const f = await api.getFormula(l.formula_id)
      const parts = f.parts as PartsMap
      if (!parts || typeof parts !== 'object' || Array.isArray(parts)) {
        l.parts = []
        return false
      }
      if (beforeCompute) await beforeCompute(l.formula_id)
      // 页面上的算料明细按**生产单引擎（B）**算
      l.parts = computeParts(l, 'B')
      lineRefresh(l)
      return true
    } catch (e) {
      message.error(e instanceof Error ? e.message : '算料失败')
      return false
    }
  }

  function removeLine(l: Line) {
    // 已录入行（订单已保存且行有 id）→ 旧版「已录单删除确认」：后端永久删除
    if (orderId.value != null && l.id != null) {
      dialog.warning({
        title: '已录单删除确认',
        content: '该单已经录入成功，删除后将从后台永久删除，慎重操作。',
        positiveText: '永久删除',
        negativeText: '取消',
        onPositiveClick: async () => {
          try {
            await api.deleteOrderLine(orderId.value!, l.id!)
            lines.value = lines.value.filter((x) => x !== l)
          } catch (e) {
            message.error(e instanceof Error ? e.message : '删除失败')
          }
        },
      })
      return
    }
    dialog.warning({
      title: '删除行',
      content: '确定要删除这一行吗？',
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => {
        lines.value = lines.value.filter((x) => x !== l)
      },
    })
  }

  // 复制行（仿旧版：清生产进度/图片）
  function copyRow(l: Line) {
    const copy: Line = JSON.parse(JSON.stringify(l))
    copy.id = null
    copy.progress = ''
    copy.image_id = null
    copy.image_url = null
    lines.value.push(copy)
    lineRefresh(copy)
    message.success('复制成功')
  }

  // ===== 表归属（型材候选用）=====
  // 平开族的 formula_type 取值。**不能只认 'ping'**：原版没有 formula_type 这层过滤 ——
  // 行.formulaid 是「型材名 → formulaID」直接查服务端 material 字典得到的
  // （Hui.formatted.js:1459-1475 `const _=O.value[x]; _?a.formulaid=String(_):…`），
  // 下拉候选就是该字典的 key 集合（同文件 1898 `Object.keys(O.value)`）。
  // 所以钻石型(diamond)/子母(parentsubsidiary)/双开(double) 这些平开族公式同样在平开表里。
  // 若按 `ft === type` 字面判等，它们会被两张表同时排除 —— 这正是「钻石型公式选不到」的根因。
  const PING_FAMILY_TYPES = ['ping', 'double', 'parentsubsidiary', 'diamond']

  /** 公式是否属于某张表：移门只收 diao，平开收平开族；无型别的两边都放（避免隐藏已有数据）。 */
  function belongsToTable(formulaType: string | undefined, type: 'ping' | 'diao'): boolean {
    const ft = (formulaType || '').trim()
    if (ft === '') return true
    return type === 'diao' ? ft === 'diao' : PING_FAMILY_TYPES.includes(ft)
  }

  // 型材候选按门型分类（仿旧版 initializPing→pingMaterial / initializDiao→diaoMaterial）：
  // 平开表只看平开族，移门表只看移门类，避免串型。来源 = 对应门型的历史型材 + 对应族的公式名。
  function profileOptionsFor(type: 'ping' | 'diao'): { label: string; value: string }[] {
    const seen = new Set<string>()
    const out: { label: string; value: string }[] = []
    const push = (p: string) => {
      const v = (p || '').trim()
      if (v && !seen.has(v)) {
        seen.add(v)
        out.push({ label: v, value: v })
      }
    }
    // 候选**只有公式名一个来源** —— 原版型材格子的 `fetch-suggestions` 逐字是
    //   `const x = Object.keys(O.value); t((e ? x.filter(t=>t.includes(e)) : x).map(e=>({value:e})))`
    // 其中 `O.value` = **服务端「基础信息」接口返回的 material 字典**（型材名 → formulaID）。
    // 原版**没有**本地候选历史、**也不能右键删除**（那 15 处 `onContextmenu` 只在 颜色/面玻/底玻/
    // 套线种类/轨道种类/金额 上，**不含型材**），写侧 `je`(算列宽)/`Ye`(解析 formulaID) 也都不写候选库。
    // 所以我们原先额外挂的 `readFieldHistory('profile_*')` 与「当前页面的行」两个来源是**自己加的**，
    // 会造成「公式都删了、型材下拉里还有旧记录」—— 已移除。
    // （`formulas` 表名即我们对 `O.value` 的等价物；按表归属过滤仍保留。）
    for (const f of formulas.value) {
      if (belongsToTable(f.formula_type, type)) push(f.name)
    }
    return out
  }

  const pingProfileOptions = computed(() => profileOptionsFor('ping'))
  const diaoProfileOptions = computed(() => profileOptionsFor('diao'))

  // 平开「包边」＝原版「套线种类」（Hui.formatted.js:2132 的「包边:」标签即绑 `e["套线种类"]`）。
  // 平开公式常无 包宽/包高 件，纯靠 parts 提候选会空，故候选 = 原版枚举 + 公式套线件 track + 历史。
  function pingCasingOptions(l: Line, casingKindOptions: { label: string; value: string }[]) {
    const seen = new Set<string>()
    const out: { label: string; value: string }[] = []
    for (const o of [...casingKindOptions, ...partsTrackOptions(l, 'casing')]) {
      if (o.value && !seen.has(o.value)) {
        seen.add(o.value)
        out.push(o)
      }
    }
    return out
  }

  return {
    // 依赖里的行数组原样透出 —— 明细表组件要跨两表找「当前编辑行」（旧版 `It` 里的
    // `ue.value.find(...)`），只拿本表 rows 是找不到的。
    lines,
    // 常量 / 工具
    LS_BOTTOM_GLASS,
    LS_GLASS_THICKNESS,
    LS_OPEN_DIRECTION,
    sanitizeNum,
    sanitizeFloat,
    // 默认值
    defaultBottomGlass,
    defaultGlassThickness,
    rememberDefaultBottomGlass,
    rememberDefaultGlassThickness,
    // 字段历史 / 候选
    readFieldHistory,
    writeFieldHistory,
    rememberField,
    colorOptions,
    partsTrackOptions,
    lockOptions,
    rememberLocks,
    hardwareOptionsFor,
    profileOptionsFor,
    pingProfileOptions,
    diaoProfileOptions,
    pingCasingOptions,
    belongsToTable,
    // 行
    newLine,
    copyRow,
    removeLine,
    lineRefresh,
    // 算料 / 算钱
    partsEngine,
    formulaOf,
    isDiamond,
    computeParts,
    needsMotherWidth,
    singleArea,
    fanCount,
    minSquareOf,
    computeSquare,
    computeAmount,
    markupError,
    recalcMarkup,
    // 取价
    resolveRow,
    matchFormulaByName,
    calcRowParts,
    // 联动
    syncGlassMarkup,
    onGlassSelection,
    sizeMarkupCandidates,
    syncSizeMarkup,
    syncSizeMarkupPing,
    syncSizeMarkupDiao,
    pickDiaoWallMarkup,
  }
}

export type OrderLines = ReturnType<typeof useOrderLines>
export type { Line, PartPreview }
