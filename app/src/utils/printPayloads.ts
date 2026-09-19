// 打印载荷构造层：把「订单 + 行 → 各张单据的数据」这段从 `Hui.vue` 整体搬出，
// 供 Hui（当前编辑的这一单）与 Home（选中 N 单批量打印）共用同一份实现。
//
// ⚠️ 数据形状由**模板列**决定，不由 mode 名决定 —— 见文件末尾 `templatePayload` 的分发注释。
// 搬运时只改了「组件状态从哪来」：原先直接读组件 ref（`lines.value` / `order` / `tenantName.value` …），
// 现在统一读 `ctx`。**格式化逻辑逐字未动**。
import type { ClientDto, FormulaDto, FormulaImageDto } from '../api/types'
import { DIRECTION_IMAGES, PING_DIRECTION_IMAGES } from '../data/directionImages'
import { displayDirection, getOriginalOpenDirection } from '../composables/useOpenDirection'
import { markupLines } from './markupLines'
import { labelQuantity } from './printData'
import { createPartsEngine, pk, round2, type Line, type EngineId, type PartPreview } from './partsEngine'

/**
 * 回执单底部「温馨提示」：原版 = `租户.declaration || "含安装费"`（token 1114）。
 * 后端 tenants 表暂无 declaration 列，故直接取原版回退值。
 */
export const LEGACY_DECLARATION = '含安装费'

/** 打印上下文：原先散在 Hui 组件里的那些「当前订单」状态。 */
export interface PrintContext {
  /** 订单头（回执表头 / 标签抬头用）。 */
  order: {
    receipt_no: string
    client_code: string
    client_name: string
    brand: string
    order_date: string
    production_days: number
    deposit: number
    remark: string
    install_address: string
    phone: string
  }
  /** 订单行（`parts`/`markup` 已落库）。 */
  lines: Line[]
  formulas: FormulaDto[]
  clients: ClientDto[]
  /** 工厂/门店名（原版 `userinfo.name`）—— 决定一批门店特判分支。 */
  tenantName: string
  /** 打单人（原版 `userinfo.name`）。 */
  maker: string
  /** 收款码（dataURL）。 */
  payQrcode: string
  /** 订单查询二维码落地页。 */
  terminalLink: string
  /** 回执族是否包含平开/吊趟行（原版两张表的显隐开关）。 */
  showPing: boolean
  showDiao: boolean
  /** 行序方式：`'order'` 按**行级单号**的数字前缀升序，其余按 formulaid→颜色。 */
  sortMethod: string
  /** 公式挖孔图缓存：`formula_id → 图列表`。 */
  formulaImages: Record<number, FormulaImageDto[]>
  /** 当天日期 `YYYY-MM-DD`（回执 `date` 为空时的兜底）。 */
  today: string
  /** 加价计算异常上报（可选，Home 传 undefined 即静默）。 */
  onMarkupError?: (message: string) => void
}

/**
 * 套线长度（米）：按套线种类子串解析（一高一宽/两高两宽/一高/一宽/默认 1宽2高）+ "-N" 增量。
 * 高 = max(门洞高, 亮窗总高)，宽 = 门洞宽。
 */
function casingLength(l: Line): number {
  let inc = 0
  const c = l.casing || ''
  if (c.includes('-')) {
    const parts = c.split('-')
    if (parts.length > 1) {
      const n = parts[1]
      if (n.trim() !== '' && !Number.isNaN(Number(n))) inc = Number(n)
    }
  }
  const w = l.door_width || 0
  const h = Math.max(l.door_height || 0, l.light_window_height || 0)
  if (c.includes('一高一宽')) return (w + h + inc) / 1000
  if (c.includes('两高两宽')) return (2 * w + 2 * h + 2 * inc) / 1000
  if (c.includes('一高')) return (h + inc) / 1000
  if (c.includes('一宽')) return (w + inc) / 1000
  return (w + 2 * h + 2 * inc) / 1000
}

/** 套线金额 = 套线长度 × 数量 × 套线单价。 */
export function casingAmountOf(l: Line): number {
  if (!(l.casing_price || 0)) return 0
  return round2(casingLength(l) * (l.quantity || 1) * (l.casing_price || 0))
}

// 移门/吊趟开向图：优先用从旧版提取的完整 DIRECTION_IMAGES 表（「扇数+开向」→ 图）。
export function diaoDirImage(fans: string, direction: string): string {
  const f = (fans || '').trim()
  const d = (direction || '').trim()
  if (!f || !d) return ''
  return DIRECTION_IMAGES[`${f}${d}`] || ''
}

// 方向图（原版 lockImg / openImg）：平开按开向查 PING 图标；移门按 扇数+开向 查 DIRECTION_IMAGES。
function lineLockImage(l: Line): string {
  // ⚠️ **两族的取图键不同**（原版逐处硬编码，不是统一走归一化）：
  //   平开：`directionImageMap[ getOriginalOpenDirection(开向) ]`
  //         —— @350462(回执平开) / @464353(A平) / @497357(B平)
  //   吊趟：`directionImageMap[ "" + 扇数 + 开向 ]`
  //         —— @476780(A吊) / @517793(B吊) / @556000(D吊)，**不过 getOriginalOpenDirection**
  //   （`getOriginalOpenDirection` 全篇只出现 5 处：定义 + 回执平开 + 三个平开 producer。）
  return l.line_type === 'diao'
    ? diaoDirImage(l.fans, l.direction)
    : PING_DIRECTION_IMAGES[getOriginalOpenDirection(l.direction)] || ''
}

export const TENANT_DS: string = 'smartdoor'
const NEW_SIZE_FORMAT = (() => {
  const m = /^smartdoor(\d+)?$/.exec(TENANT_DS)
  return m ? (!m[1] || Number(m[1]) === 408 || Number(m[1]) > 414) : false
})()


// 尺寸列（旧版回执）：平开 3 分支（钻石/子母/普通）× 移门 1 套，每套再按 NEW_SIZE_FORMAT 选拼法。
// 非新格式统一「值直接拼」；新格式带 `高:`/`<br/>宽:` 等标签。洞尺存在时前置。
function dimSizeLabel(l: Line): string {
  const h = l.door_height || 0
  const w = l.door_width || 0
  if (!h && !w) return ''
  const lw = l.light_window_height > 0
  const wall = l.wall_thickness > 0
  const jiao = l.jiao > 0
  const track = l.track_length > 0
  let s: string
  if (l.line_type === 'diao') {
    s = NEW_SIZE_FORMAT
      ? `高:${h}<br/>宽:${w}${lw ? `<br/>亮窗:${l.light_window_height}` : ''}${l.light_window_count > 0 ? `<br/>亮窗数:${l.light_window_count}` : ''}${wall ? `<br/>墙厚:${l.wall_thickness}` : ''}${track ? `<br/>轨道长:${l.track_length}` : ''}`
      : `高${h}宽${w}${lw ? ` 亮窗${l.light_window_height}` : ''}${l.light_window_count > 0 ? ` 亮窗数:${l.light_window_count}` : ''}${wall ? ` 墙厚:${l.wall_thickness}` : ''}${track ? ` 轨道长:${l.track_length}` : ''}`
  } else if (/钻石/.test(l.profile || '')) {
    s = NEW_SIZE_FORMAT
      ? `高:${h}<br/>左宽:${w}${lw ? `<br/>门宽:${l.light_window_height}` : ''}${wall ? `<br/>右宽:${l.wall_thickness}` : ''}`
      : `高${h}左宽${w}${lw ? `门宽${l.light_window_height}` : ''}${wall ? `右宽${l.wall_thickness}` : ''}`
  } else if (/子母/.test(l.profile || '')) {
    s = NEW_SIZE_FORMAT
      ? `高:${h}<br/>宽:${w}<br/>母门:${l.track_length}${lw ? `<br/>亮高:${l.light_window_height}` : ''}${wall ? `<br/>墙厚:${l.wall_thickness}` : ''}${jiao ? `<br/>吊脚:${l.jiao}` : ''}`
      : `高${h}宽${w}母门${l.track_length}${lw ? `*亮高${l.light_window_height}` : ''}${wall ? `*${l.wall_thickness}` : ''}${jiao ? `*${l.jiao}` : ''}`
  } else {
    s = NEW_SIZE_FORMAT
      ? `高:${h}<br/>宽:${w}${lw ? `<br/>亮高:${l.light_window_height}` : ''}${wall ? `<br/>墙厚:${l.wall_thickness}` : ''}${jiao ? `<br/>吊脚:${l.jiao}` : ''}`
      : `高${h}宽${w}${lw ? `*亮高${l.light_window_height}` : ''}${wall ? `*${l.wall_thickness}` : ''}${jiao ? `吊脚${l.jiao}` : ''}`
  }
  // 原版：`e["洞尺"] && (_.size = e["洞尺"] + "<br>" + _.size)`
  return l.hole_size ? `${l.hole_size}<br>${s}` : s
}

// 边封数 → 墙型文本（原版：0双丁墙/1单丁墙/3上丁墙/4上丁加单丁/5上丁加双丁）。
function wallTypeLabel(l: Line): string | null {
  // 原版门控是 `null != 边封数`：未填 → 不产生墙型（`Number(null)===0` 会误判成「双丁墙」）
  if (l.edge_seal_count == null) return null
  switch (Number(l.edge_seal_count)) {
    case 0: return '双丁墙'
    case 1: return '单丁墙'
    case 3: return '上丁墙'
    case 4: return '上丁加单丁'
    case 5: return '上丁加双丁'
    default: return null
  }
}

// 加价项目 → `加配：{名}-{名}`（原版：原始数据里 name 非数字的项，`-` 连接）。
// 原始数据可能是被 JSON 套了多层 string，最多剥 4 层。
function markupNames(l: Line): string {
  try {
    let v: unknown = l.markup
    for (let n = 0; typeof v === 'string' && n < 4; n++) v = JSON.parse(v)
    if (typeof v === 'string' || !v) return ''
    const arr = Array.isArray(v) ? v : [v]
    return arr
      .filter((e) => e && isNaN(Number((e as { name?: unknown }).name)))
      .map((e) => String((e as { name?: unknown }).name))
      .join('-')
  } catch {
    return ''
  }
}

// —— 原版门店白名单（`legacy/js/Hui-d088417c.js` @316101 `_0x743794`，44 家）——
// 命中时 `door` 列**不含客户名**（只 `[型材,颜色]`）；未命中（含本租户「昊艺门窗」）才拼客户名。
const STORE_DOOR_NO_CLIENT = [
  '万鑫门业', '德清顾家', '锦致轩门业', '欧盾门业', '吉雅轩门厂', '极简移门', '恒业门窗', '南海移门',
  '金雅轩门窗', '度勒门窗', '鑫豪轩门业', '广乐名门', '鑫瑞门业', '圣诺派门业', '帝奥名门', '美高移门',
  '鑫源移门加工厂', '鑫源名门', '皇丞门窗', '宏泰门业', '天润门业', '铂卫邦铝门', '欧莱富移门', '顾轩门窗',
  '润佳门窗', '宜居门窗厂', '欧铂尊门业', '鑫美龙家居', '皓雅门窗', '富嘉名门', '珊珊极简移门', '華宇推拉',
  '立泰金属制品有限公司', '皇牌博雅铝门窗厂', '爱德益钛镁合金厂', '宏辉门窗', '华顺门业', '喜迎门移门',
  '天成门业', '煜宸门业', '粤诗丽门窗', '浩扬移门', '嘉和门业', '美固建材经营部',
]
/**
 * 原版在 `_0x743794` **之外**硬编码的单家门店（§20.3 / 引擎普查 C12）。
 *
 * ⚠️ **只参与 `door` 列判断，不参与 `doorImg` 门控** —— 原版两处用的不是同一份名单：
 *   `door`    @515211 / @495…：`_0x743794.includes(店) || "鸿程鑫派门窗" === 店`
 *   `doorImg` @494870（平开）/ @515705（吊趟）/ @585217（C吊）：
 *             `!_0x743794.includes(店) && 行["图片ID"]` → **只有那 44 家**会被跳过取图
 */
const STORE_DOOR_NO_CLIENT_EXTRA = '鸿程鑫派门窗'
/** `door` 列（客户/门类）的白名单判断。 */
const isDoorNoClientStore = (name: string) =>
  STORE_DOOR_NO_CLIENT.includes(name) || name === STORE_DOOR_NO_CLIENT_EXTRA
/** 原版 product1 特判门店（@570279）：`kouHeigth` 改用「套线种类」、`kouWidth` 不再赋值。 */
const STORE_SHENGFEI = '晟斐门窗厂'
/** 原版 product1（@569290 `_0x1389a5`）逐字关键词清单 —— 部件遍历按它逐个分组命中。 */
const PRODUCT1_KW = [
  '门框高', '门框宽', '玻璃', '前框高', '后框高', '前框宽', '后框宽', '封板',
  '扣板高', '扣板宽', '扣板厚', '光企高', '上下方', '玻璃高', '玻璃宽',
]
/** 原版回执 glass 列特判门店（@351196）：不加 `*{玻璃厚}mm` 后缀。 */
const STORE_GLASS_NO_MM = ['家家发门业', '星之铝门窗']
/** 原版 glassHole 特判门店（@411200 `_0xa370fc`）：`remark` 整列为空。 */
const STORE_NO_GLASS_REMARK = ['皇帥滑动门', '尚航逸门窗', '嘉博门业']
/** 原版门店特判：该门店的部件文本用 `{名}:<br>{result}` 而非 `{名}:{result}`（只出现在引擎B 两套）。 */
const STORE_SHANSHAN = '杉杉铝木极简门'

const DS_KW = {
  ping: ['光企', '方', '封板高', '封板宽', '龙骨横', '龙骨竖', '门扇高', '门扇宽', '收口', '封边横', '封边竖', '玻璃高', '玻璃宽'],
  pingOld: ['光企', '方', '龙骨横', '龙骨竖', '门扇高', '门扇宽', '收口', '封边横', '封边竖', '玻璃高', '玻璃宽'],
  diao: ['光企', '勾企', '合页', '锁', '收口', '方', '封板高', '封板宽', '纱网', '玻璃高', '玻璃宽'],
  diaoOld: ['光企', '勾企', '合页', '锁', '收口', '方', '纱网', '玻璃高', '玻璃宽'],
  diamond: ['左固玻璃', '右固玻璃', '门玻璃'],
}

// 通用：从模板提取某字段(field)对应 table 的列定义（field+title），列结构=模板原样。
interface ProdCol { field: string; title: string }
function extractTableColumns(tpl: unknown, field: string): ProdCol[] {
  try {
    const d = tpl as { config?: { panels?: { printElements?: { printElementType?: { type?: string }; options?: { field?: string; columns?: unknown } }[] }[] } }
    for (const p of d?.config?.panels ?? []) {
      for (const e of p.printElements ?? []) {
        if (e.printElementType?.type === 'table' && e.options?.field === field) {
          const cols = e.options.columns as unknown
          const arr = Array.isArray(cols) && cols.length && Array.isArray((cols as unknown[])[0]) ? (cols as unknown[][])[0] : (cols as unknown[])
          return (arr as ProdCol[]).filter((c) => typeof c === 'object' && c?.field).map((c) => ({ field: c.field, title: c.title }))
        }
      }
    }
  } catch {
    // 忽略
  }
  return []
}
/**
 * 构造某一张订单的全部打印载荷。
 * 返回的每个函数都是**同步**的；图片（门图/挖孔图/收款码）必须由调用方**先**灌进 `ctx`。
 */
/** [`glassDoorsheetText`] 的全部输入 —— 从「一行 + 它的部件」里摘出来，便于单独差分。 */
export interface DoorsheetInput {
  /** 行类型。`diao` 走移门那一支，其余走平开那一支（旧版是两段独立代码）。 */
  lineType: string
  /** 扇数（移门专用）：`一固一活`/`双活` 时第一组数量固定 `2×`。 */
  fans?: string
  /** 公式类型：平开支的 `parentSubsidiary` / `diamond` 两个特例要用。 */
  formulaType: string
  /** 底玻 / 面玻（`无` 参与判据）。 */
  bottomGlass: string
  faceGlass: string
  /** 行的数量。 */
  quantity: number
  /** 引擎 A 算出来的部件（已滤掉没有 materialName 的）。 */
  parts: PartPreview[]
}

/**
 * 「玻璃合片单」里那一格 `doorsheet` 的文本 —— 把原来的内联块抽成**纯函数**，
 * 好让差分台能直接喂夹具、跟旧版真代码逐字比（同 `productionStats.ts` 的做法）。
 *
 * 两段分别对应旧版两个函数（`legacy/js/Hui.formatted.js`，都是引擎 A）：
 *
 * | 分支 | 旧版 | 位置 |
 * |---|---|---|
 * | 平开（`else`） | `_0xcfde65` | `:10730-10752` |
 * | 移门（`diao`） | `_0x4d28ce` | `:10897-10922` |
 *
 * ⚠️ 两段里的判据用的都是**部件 KEY**（`pk(p)`），显示名才用 `materialName`。
 *    旧版同样是 `Object.entries(parts).filter(([e]) => e.includes(...))` —— `e` 是 key。
 *
 * ⚠️ 旧版那段源码里的字符串是**编码过的**（`_0x59f9e4(847)` 之类），已用
 *    `legacy/` 的现解手法解出：`847` = `"parentSubsidiary"`、`986` = `"diamond"`
 *    —— 与 `formula_type` 的取值一致（**驼峰**，见迁移 0024）。
 *
 * 差分台：`docs/diao-print-doorsheet-logiccheck.mjs`。
 */
export function glassDoorsheetText(i: DoorsheetInput): string {
  const { lineType, fans, formulaType, bottomGlass: bRaw, faceGlass: fRaw, quantity: Q, parts } = i
  /** 双玻判据（旧版逐字）：`(底≠无 || 面=无 || 名含单玻) && (面≠无 || 底=无 || 名含单玻)`。 */
  const doubleGlass = (name: string) =>
    (bRaw !== '无' || fRaw === '无' || name.includes('单玻')) &&
    (fRaw !== '无' || bRaw === '无' || name.includes('单玻'))

  if (lineType === 'diao') {
    const g1 = parts.filter((p) => pk(p).includes('玻璃') && !pk(p).includes('亮窗'))
    const g2 = parts.filter((p) => pk(p).includes('亮窗玻璃') && !pk(p).includes('压线'))
    let n1 = g1.length
      ? doubleGlass(pk(g1[g1.length - 1]))
        ? g1[g1.length - 1].quantity * Q
        : (g1[g1.length - 1].quantity / 2) * Q
      : 0
    const n2 = g2.length
      ? bRaw !== '无' && fRaw !== '无' || pk(g2[g2.length - 1]).includes('单玻')
        ? g2[g2.length - 1].quantity * Q
        : (g2[g2.length - 1].quantity / 2) * Q
      : 0
    if (fans === '一固一活' || fans === '双活') n1 = 2 * Q
    // ⚠️ 两组都拼 `名:result` —— 差分台 `docs/diao-print-doorsheet-logiccheck.mjs` 钉住了这一点。
    //    （我一度读成「g1 只印裸名字」并照此改过，是**截断阅读**导致的误判，被那台差分台当场抓回。
    //      教训：旧版那些行又长又密，`cut -c` 截断后再读会把行尾的条件/拼接整个吃掉。）
    const t1 = g1.map((p) => `${p.materialName}:${p.result}`).join('<br>')
    if (n2 > 0) {
      const nn = n2 < 1 ? 1 : n2
      return `${t1}<br>数量:${n1}<br>${g2.map((p) => `${p.materialName}:${p.result}`).join('<br>')}<br>数量:${nn}`
    }
    return `${t1}<br>数量:${n1}`
  }

  // 平开（旧版 `_0xcfde65`）：`["玻璃","门扇"]` 用 `reduce((acc,kw)=>[...acc, ...命中的件])`
  // **按关键词逐个分组累积** —— 玻璃全在前、门扇全在后。
  // 一次 filter 保 parts 原序，在两族交错时顺序会不同。
  const g = ['玻璃', '门扇'].flatMap((kw) => parts.filter((p) => pk(p).includes(kw)))
  /*
   * ⚠️ **有意偏离旧版**：一件玻璃/门扇都没有时，旧版仍然输出 `"<br>数量:0"`
   *    （`[].join("<br>")` 得空串，再拼 `"<br>数量:" + 0`）—— 纸上会多一个**空行加一个 `数量:0`**。
   *    那是 `join()` 的副产物，不是有意的排版。我们返回空串。
   *
   *    判据（按本仓库口径）：「旧版算错」还是「旧版本身有毛病」—— 这是后者：
   *    一张没有玻璃的合片单印出「数量:0」没有任何意义，只会让人以为漏算了。
   *    差分台 `docs/diao-print-doorsheet-logiccheck.mjs` 把这条**登记成已知分歧**
   *    （⚠️ 而不是悄悄跳过），哪天产品要照旧版印，把这里改回去、把那面旗摘掉即可。
   */
  if (!g.length) return ''
  const last = g[g.length - 1]
  let n = doubleGlass(pk(last)) ? last.quantity * Q : (last.quantity / 2) * Q
  if (formulaType === 'parentSubsidiary') n = doubleGlass(pk(last)) ? 4 * Q : 2 * Q
  if (formulaType === 'diamond') n = 3 * Q
  return `${g.map((p) => `${p.materialName}:${p.result}`).join('<br>')}<br>数量:${n}`
}

export function createPrintPayloads(ctx: PrintContext) {
  const { formulaOf, isDiamond, dimsOf, computeParts, partsSig } = createPartsEngine(ctx.formulas)
  void dimsOf
  void partsSig

  // 玻璃列（旧版回执）：单玻/双玻/无，镜片 + 玻璃厚。
  // 回执玻璃列（原版，ping 判定顺序）：单玻 / 无 / 固玻(钻石) / 背板(厚0) / 底玻:面玻:。
  function glassSpecPrintable(l: Line): string {
    // 原版 @351196（平开）/ @442766（吊趟）**直接读 `e["底玻"]` 做 `"无"===` 严格比较**，无空值回落。
    const bottom = l.bottom_glass || ''
    const face = l.face_glass || ''
    const thick = l.glass_thickness || ''
    // 原版（@351196 平开 / @442766 吊趟）：`家家发门业` / `星之铝门窗` 两家**不加** `*{厚}mm`
    const mm = STORE_GLASS_NO_MM.includes(ctx.tenantName) ? '' : `*${thick}mm`
    if (bottom === '无' && face === '无') return '无'
    if (bottom === '无') return `单玻:${face}${mm}`
    // 钻石支**只在平开**：吊趟那条表达式没有 `型材含钻石` 判断，直接落到 `0==玻璃厚` / else
    if (isDiamond(l) && l.line_type !== 'diao') return `固玻:${bottom}<br>门玻:${face}${mm}`
    if (Number(thick) === 0) return `背板:${bottom}<br>面板:${face}`
    return `底玻:${bottom}<br>面玻:${face}${mm}`
  }

  // 计价明细（旧版回执）：●单价×数量=金额元（套）/ ●单价×平方=金额元（方）。
  // 计价明细（原版）：套 = `•单价元/套*数量=金额元`；方 = `•单价元/方*平方(3位)=金额元`。
  function pricingDetail(l: Line): string {
    let s = ''
    // 原版是两个**显式**分支：`计价方式==='套' && 单价>0` / `==='方' && 单价>0`；
    // 计价方式为其它值（含空）时两个分支都不走，只可能剩套线金额与加价项目。
    if (l.unit_price > 0 && l.price_type === '套') {
      s = `•${l.unit_price}元/套*${l.quantity}=${l.quantity * l.unit_price}元`
    } else if (l.unit_price > 0 && l.price_type === '方') {
      const sq = l.square || 0
      s = `•${l.unit_price}元/方*${sq.toFixed(3)}=${Number((Math.round(100 * sq * l.unit_price) / 100).toFixed(3))}元`
    }
    // 套线金额：套线种类形如 `一高一宽-30`，`-` 后为「丁」的个数。
    // 长度**必须**复用 `casingLength`（= 上方 `casingAmountOf` 算出 `casing_amount` 用的同一个函数），
    // 否则显示米数与实际计费米数会来自两套代码而悄悄对不上。
    if (l.casing_amount > 0) {
      const name = (l.casing || '').split('-')[0] || ''
      const len = casingLength(l)
      s += l.quantity === 1
        ? `•${name}${l.casing_price}元/米*${len} =${l.casing_amount}元`
        : `•${name}${l.casing_price}元/米*${len}*${l.quantity}=${l.casing_amount}元`
    }
    // 原版在单价行/套线行之后再追加上加价项目那几行（`Hui.formatted.js:8721` / `:8819`）：
    //   `加价项目 && (s += "<br>•" + 加价项目.replace(/\n/g, "<br>•"))`
    // 首行同样带前导 `<br>•` —— 计价方式为空（前面什么都没拼）时结果以 `<br>•` 开头，照抄。
    const add = markupLines(l, ctx.onMarkupError).join('\n')
    if (add) s += '<br>•' + add.replace(/\n/g, '<br>•')
    return s
  }

  // 回执备注列（原版）：打折 + [平开: 轨道种类/五金/墙型 | 移门: 扇数:/轨道种类:/五金/单双丁] + 安装地址 + 前后包 + 备注。
  function receiptRemark(l: Line): string {
    const items: (string | null)[] = []
    const discounted = (l.discount ?? 1) < 1
    if (discounted) items.push(`打折:${(100 * (l.discount ?? 1)).toString().replace(/0$/, '')}折`)
    if (l.line_type === 'diao') {
      const x = /哑口|垭口/.test(l.profile) || l.direction === '无' || (l.unit_price === 0 && (l.casing_price || 0) > 0)
      if (!x) items.push(`扇数:${l.profile.includes('+0') ? ' 口袋门' : l.fans || ''}`)
      // 原版只有「打折」分支对轨道种类做 `+0 → 口袋门` 替换，非打折分支不替换
      if (!x) items.push(`轨道种类:${discounted && l.profile.includes('+0') ? ' 口袋门' : l.track || ''}`)
      items.push(l.hardware || null)
      items.push(l.double_ding || null)
    } else {
      items.push(l.track || null)
      items.push(l.hardware || null)
      items.push(wallTypeLabel(l))
    }
    if (!ctx.order.install_address.trim()) items.push(l.install_address || null)
    if (l.line_type === 'ping') {
      // 原版 `前后包加长` 返回**数组**，作为列表单项被 String() 化 → 多项时以逗号相连
      const pack = [l.front_casing_add ? `前包加长${l.front_casing_add}` : '', l.back_casing_add ? `后包加长${l.back_casing_add}` : ''].filter(Boolean).join(' ')
      if (pack) items.push(pack)
    }
    items.push(l.remark || null)
    return items.filter(Boolean).join('<br>')
  }

  // 原版 `_0xc8b731(行, 公式)`：把**公式级** `hardware` 作为 `配件:{值}` 追加到 remark 末尾
  // （`\r\n`/`\r`/`\n` 一律先转 `<br>`；公式没有该字段则追加空串）。8 个 produce 构造器每个都调用它。
  // 注意：这只用于打印的 remark，与「五金下拉候选不读 extra.hardware」是两回事。
  function appendAccessory(remark: string, l: Line): string {
    const hw = (formulaOf(l)?.extra as { hardware?: unknown } | undefined)?.hardware
    if (typeof hw !== 'string' || hw === '') return remark
    const a = `配件:${hw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '<br>')}`
    return remark ? `${remark}<br>${a}` : a
  }

  // 生产单/玻璃合片 remark（原版 produces 行，两条引擎分别对应平开/吊趟）：
  //   平开 `_0x551a25` = [轨道种类, 五金, 安装地址, 备注] + 加配(`<br>`) + 墙型(`<br>`)
  //   吊趟 `_0x500ef9` = [五金, 单双丁(≠正常), 备注, 安装地址] + 加配(`<br>`)  —— **无墙型**
  /**
   * 「品牌」段（原版 @497060 生产平开 / @517540 生产吊趟 / @536200·@55xxxx product2·product3）：
   * 门控链是「**客户编号非空且 ≠ 0** → 查客户资料 → `品牌` 非 `null`/`''`/`' '`」
   * （原版走在线接口 `getLatestClientsInfo`；我们用本地 `clients`，与 `applyClient` 同源），
   * 命中后 `备注 += " " + "品牌:" + 品牌` —— **空格**分隔，**不是** `<br>`，且**在 `appendAccessory`(配件) 之前**。
   *
   * ⚠️ 只有这 4 个 producer 有；**玻璃合片单**（`glassRemark`）与 **product1**（`_0x4495e3`/`_0x1239ce`）
   *    逐个确认过 `_0xc8b731` 前没有品牌块 ⇒ 那边不要加。
   */
  function brandSegment(): string {
    const code = String(ctx.order.client_code ?? '')
    if (!code || code === '0') return ''
    const b = ctx.clients.find((c) => c.code === code)?.brand
    if (b == null || b === '' || b === ' ') return ''
    return `品牌:${b}`
  }

  function produceRemark(l: Line): string {
    const items = l.line_type === 'diao'
      ? [l.hardware || null, l.double_ding && l.double_ding !== '正常' ? l.double_ding : null, l.remark || null, l.install_address || null]
      : [l.track || null, l.hardware || null, l.install_address || null, l.remark || null]
    let s = items.filter(Boolean).join('<br>')
    const add = markupNames(l)
    if (add) s = s ? `${s}<br>加配：${add}` : `加配：${add}`
    if (l.line_type !== 'diao') {
      const wall = wallTypeLabel(l)
      if (wall) s = s ? `${s}<br>${wall}` : wall
    }
    const brand = brandSegment()
    if (brand) s = s ? `${s} ${brand}` : brand
    return appendAccessory(s, l)
  }

  // 玻璃合片单 remark（原版**引擎A** `_0xcfde65` 平开 / `_0x4d28ce` 吊趟）：
  //   [五金, 单双丁(≠正常), 备注, 安装地址] + 加配(`<br>`) —— **既无轨道种类、也无墙型**。
  //   注意：玻璃合片单的行由 `calculateGlass` 独占产生，与生产单（`calculateReceipt`→引擎B）**不是同一族**。
  function glassRemark(l: Line): string {
    const ding = l.double_ding && l.double_ding !== '正常' ? l.double_ding : null
    let s = [l.hardware || null, ding, l.remark || null, l.install_address || null].filter(Boolean).join('<br>')
    const add = markupNames(l)
    if (add) s = s ? `${s}<br>加配：${add}` : `加配：${add}`
    return appendAccessory(s, l)
  }

  // product2/3（oldSheet 行）remark（原版 `_0x192067`/`_0x34f4ac`）：
  //   [五金, 单双丁(≠正常), 备注].join("-") + 加配（**空格**追加）+ 墙型（**`-`**追加）
  function oldSheetRemark(l: Line): string {
    const ding = l.double_ding && l.double_ding !== '正常' ? l.double_ding : null
    let s = [l.hardware || null, ding, l.remark || null].filter(Boolean).join('-')
    const add = markupNames(l)
    if (add) {
      const t = `加配：${add}`
      s = s ? `${s} ${t}` : t
    }
    const wall = wallTypeLabel(l)
    if (wall) s = s ? `${s}-${wall}` : wall
    // 品牌段（product2/3 有，见 `brandSegment`）；分隔是**空格**，位置在 配件 之前。
    const brand = brandSegment()
    if (brand) s = s ? `${s} ${brand}` : brand
    return appendAccessory(s, l)
  }

  const installAddresses = () => {
    const set = new Set<string>()
    for (const l of ctx.lines) {
      const a = l.install_address || ctx.order.install_address
      if (a) set.add(a)
    }
    return [...set].join('_')
  }

  // 原版 `address = 订单安装地址 ? E(行地址去重) : 客户地址`；客户地址取自客户资料。
  const clientAddress = () => ctx.clients.find((c) => c.code === ctx.order.client_code)?.address || ''
  const orderInstallAddress = () => (ctx.order.install_address ? installAddresses() : clientAddress())

  /**
   * 行级「单号」—— 打印载荷里 `OrderID` / `orderID` / `qrcode` 一律取它。
   *
   * 旧版这三个键**全部**来自**明细行**的「单号」字段（不是订单头的回执单号）：
   *   `Hui.formatted.js:10028/10057/10087/10131/…`（十余处）`x["OrderID"] = row["单号"]`
   *   `:9075` 标签 `qrcode = String(row["单号"])`
   * ⚠️ 与订单级回执单号是**两个层级**：回执单号印在收据单2 的表头（`receiptPrintData.orderNo`，
   *    那个**保持**不变）。搞混的后果是**厂里扫二维码本应定位「哪一樘门」，却扫出订单号**。
   * 见 `docs/2026-09-18-order-no-semantics.md` §4.1。
   */
  const lineNoOf = (l: Line) => l.line_no || ''

  /**
   * 行级单号的数字前缀（旧版 comparator 逐字：`parseInt(OrderID.split("-")[0]) || 0`，
   * `Hui.formatted.js:9659` / `:10570`）。空单号 → `parseInt("")` = NaN → `|| 0` ⇒ 0，排最前。
   */
  const lineNoPrefix = (l: Line) => parseInt(String(l.line_no || '').split('-')[0], 10) || 0

  function orderedLines(sortByFormula = true): Line[] {
    const keep = (l: Line) => {
      if (l.formula_id == null || !formulaOf(l)) return false
      if (l.line_type === 'diao' && !String(l.fans || '').trim()) return false
      return true
    }
    const block = (t: 'ping' | 'diao') => {
      const arr = ctx.lines.filter((l) => l.line_type === t && keep(l))
      if (!sortByFormula) return arr
      return arr.slice().sort((a, b) => {
        const fa = String(a.formula_id)
        const fb = String(b.formula_id)
        return fa !== fb ? fa.localeCompare(fb) : (a.color || '').localeCompare(b.color || '')
      })
    }
    const all = [...block('ping'), ...block('diao')]
    if (ctx.sortMethod !== 'order') return all
    // 「序号优先」：按**各行自己的**单号数字前缀升序。
    // ⚠️ 先前这里读订单级回执单号 ⇒ 同一张单内所有行取到同一个值，`p - p` 恒为 0，
    //    排序**静默退化成原序**（设置项看着有效其实没做事）。现在行级单号有了，真正生效。
    return all.slice().sort((a, b) => lineNoPrefix(a) - lineNoPrefix(b))
  }

  // 回执行顺序（原版 @348915 / @353436）：**先全部平开行、再全部吊趟行**，各自**保持表格原序**
  // （回执构造器里 `.sort(` 出现 0 次，不排序）；且**只在对应表「显示」时才纳入**
  // （`if (showPingkai && pingTable)` / `if (showDiao && diaoTable)`）。
  // 缺 `formulaid` 的行**不会被剔除** —— 原版是先用「型材→formulaId」表回填。
  function receiptOrderedLines(): Line[] {
    return [
      ...(ctx.showPing ? ctx.lines.filter((l) => l.line_type === 'ping') : []),
      ...(ctx.showDiao ? ctx.lines.filter((l) => l.line_type === 'diao') : []),
    ]
  }

  // 回执模板（receipt / FinalReceipt / ReceiptList）的载荷：一份表头对象 + `receipt` 行数组。
  // 原版回执族由**同一个载荷构造器**服务，但 **brand 后缀逐模板不同**（Home chunk 实证）：
  //   `receipt`(客户回执单) 保持「回执单」；`FinalReceipt`(收据单) → 「收据单」；`ReceiptList`(出货清单) → 「订货清单」。
  function receiptPrintData(brandSuffix = '回执单') {
    const rows = receiptOrderedLines().map((l) => ({
      profile: l.profile,
      profile2: [l.profile, l.color].filter(Boolean).join('<br>'),
      color: l.color, // 原版回执行字段 `color`（FinalReceipt / ReceiptList 模板有该列）
      maker: ctx.maker || '',
      // 原版方向列：平开 = 套线种类+开向；移门 = 开向（无扇数前缀）
      direction: l.line_type === 'diao' ? displayDirection(l.direction) : `${l.casing || ''}${displayDirection(l.direction)}`,
      openImg: lineLockImage(l),
      doorImg: l.image_url || '',
      glass: glassSpecPrintable(l),
      size: dimSizeLabel(l),
      quantity: l.quantity,
      price: l.unit_price > 0 ? l.unit_price : '/', // 原版：无价 → "/"
      amount: Math.round(100 * (l.amount || 0)) / 100,
      pricing: pricingDetail(l),
      remark: receiptRemark(l),
      // 原版回执行字面量只有 {profile,profile2,direction,openImg,price,color,glass,size,
      // quantity,amount,pricing,remark,maker,doorImg} —— **没有 `date`/`payment`**。
    }))
    // 原版回执构造器（`receiptBuilder` 导出 `gs`）逐字：
    //   `let r=0,i=0; ping_hui.forEach(a=>{r+=Number(a["金额"]||0); i+=Number(a["数量"]||0)}); diao_hui.forEach(同)`
    //   `total:   Math.round(100*r)/100`        ← **两位小数**（不是整数）
    //   `balance: Math.round(100*(r-定金))/100` ← 先减定金**再**取整（我们原先先取整再减，有微差）
    //   `门数: i`（= Σ数量）、`deposit: a["定金"]||0`、`payQrcode: e`（**调用方入参**）
    const rawTotal = ctx.lines.reduce((s, l) => s + (l.amount || 0), 0)
    const total = round2(rawTotal)
    const deposit = ctx.order.deposit || 0
    return {
      // 原版：(品牌 || 门店名 || "客户") + 后缀（后缀逐模板不同，见函数注释）。
      // 首项是**品牌** `ctx.order.brand`，不是客户名。
      brand: `${ctx.order.brand || ctx.tenantName || '客户'}${brandSuffix}`,
      date: ctx.order.order_date || ctx.today,
      // ⚠️ **这里就该是订单级回执单号**，别跟着 `OrderID`/`qrcode` 一起改成行级！
      // 回执族（receipt / FinalReceipt / ReceiptList）的 `orderNo` 在旧版就是回执单号
      // （旁证：`ReceiptMobile` 拿它当 `finance_getOrderFinanceSummary` 的入参，而那个接口的键就是回执单号）。
      // 行级单号是 `OrderID`/`qrcode` 那一组，见 `lineNoOf`。
      orderNo: ctx.order.receipt_no || '',
      tel: ctx.order.phone || '',
      address: orderInstallAddress() || '',
      productionDays: ctx.order.production_days || 0,
      client: ctx.order.client_name || '',
      deposit,
      total,
      balance: round2(rawTotal - deposit),
      // 原版 `TotalBalance` = 服务端「客户账户余额」（开关开启且有客户编号时拉 `finance_getCustomerBalance`），
      // **取不到时为 `""`** —— 不要用 `total-deposit` 冒充（那是 `balance` 的语义）。
      TotalBalance: '',
      declaration: LEGACY_DECLARATION,
      // 原版 `payQrcode: e`（构造器入参），由调用方 `await getImage('qrcode') || ""` 取；
      // 我们预取到 `payQrcodeUrl`（见 `loadPayQrcode`），取不到时为 `''`。
      payQrcode: ctx.payQrcode || '',
      orderQrcode: ctx.terminalLink || '',
      receipt: rows,
    }
  }

  // —— 标签打印（lable 模板）：每行按 labelQuantity 生成对应张数 ——
  // 标签行（原版 lable 模板）：带前缀字面量。
  function lableRow(l: Line) {
    const h = l.door_height || 0
    const w = l.door_width || 0
    // 原版：`尺寸:{门洞高}*{门洞宽}` 后追加（>0 才加）——
    // 平开 吊脚→墙厚→亮窗总高（456475）；移门 墙厚→吊脚→亮窗总高（458517），**顺序不同**
    let size = `尺寸:${h}*${w}`
    const dims = l.line_type === 'diao' ? [l.wall_thickness, l.jiao, l.light_window_height] : [l.jiao, l.wall_thickness, l.light_window_height]
    for (const v of dims) if (v > 0) size += `*${v}`
    const dir = l.direction || ''
    // 原版：平开 套线种类非空 → `开向:{套线种类}{开向}`，否则 `开向:{开向}`（456475）；
    //       移门 → `开向:{扇数}{开向}`，但型材含「哑口套/门套」时退回 `开向:{开向}`（458517）
    const lockway = l.line_type === 'diao'
      ? (/哑口套|门套/.test(l.profile || '') ? `开向:${dir}` : `开向:${l.fans || ''}${dir}`)
      : l.casing ? `开向:${l.casing}${dir}` : `开向:${dir}`
    return {
      orderID: lineNoOf(l),
      qrcode: String(lineNoOf(l)),
      client: ctx.order.client_name || '',
      door: `型材:${l.profile}`,
      size,
      lockway,
      color: `颜色:${l.color}`,
      glass: `玻璃:${l.bottom_glass || ''}-${l.face_glass || ''}`,
      address: `地址:${l.install_address || ''}`,
      remark: [l.hardware || null, l.remark ? `备注:${l.remark}` : null].filter(Boolean).join('<br>'),
      package: '',
    }
  }

  // 生产标签行（原版 product10 模板）：无前缀，玻璃为 单玻:/底:-面:。
  function product10Row(l: Line) {
    const h = l.door_height || 0
    const w = l.door_width || 0
    // 原版 product10 有**两个构造器**（一门型一个），size 规则不同：
    //   平开 `_0x159bea`：`门洞高*门洞宽` + 吊脚>0 `*吊脚` + 墙厚>0 `*墙厚` + 亮窗总高>0 `*亮窗总高`
    //   吊趟 `_0x336291`：`门洞高*门洞宽` + 亮窗总高>0 `*亮窗总高`（**无吊脚、无墙厚**）
    let size = `${h}*${w}`
    if (l.line_type === 'ping') {
      if (l.jiao > 0) size += `*${l.jiao}`
      if (l.wall_thickness > 0) size += `*${l.wall_thickness}`
    }
    if (l.light_window_height > 0) size += `*${l.light_window_height}`
    const dir = l.direction || ''
    // 原版 remark = [备注].filter(Boolean).join("<br>") + 加配(`<br>`)，全无前缀
    let remark = l.remark || ''
    const add = markupNames(l)
    if (add) remark = remark ? `${remark}<br>加配：${add}` : `加配：${add}`
    // 原版 GlassSize（@386080）：部件值形如 `{result}*{quantity}`；
    //   **取第一个**含「玻璃高」的部件，配「**同前缀同后缀**」的「玻璃宽」部件：
    //   `GlassSize = 高.result + "*" + 宽.result + "*" + parseInt(宽.quantity || "1")`
    //   （原版先对 KEY 做拼音转写 `玻璃高→BoLiGao`、`玻璃宽→BoLiKuan`，再按前缀/后缀配对；
    //    转写是**逐字符**映射，故等价于直接对中文 KEY 做同前缀同后缀配对。）
    //   ❗不是「最后一个高 × 最后一个宽」—— 公式里若同时有 `玻璃高/宽` 与 `上亮窗玻璃高/宽`，
    //     `.pop()` 会取到**上亮**那一对，原版取的是声明在前的 `玻璃高`。
    // 部件集走 **L1/L2 专用映射**（自带数量修正 + ×行数量），不是引擎B 的原始结果。
    const parts = product10Parts(l).filter((p) => p && p.materialName)
    const glassSize = (() => {
      for (const p of parts) {
        const i = p.key.indexOf('玻璃高')
        if (i < 0) continue
        const w = parts.find((x) => x.key === `${p.key.slice(0, i)}玻璃宽${p.key.slice(i + 3)}`)
        if (!w) continue
        const n = parseInt(String(w.quantity), 10)
        return `${p.result}*${w.result}*${Number.isNaN(n) ? 1 : n}`
      }
      return ''
    })()
    return {
      orderID: lineNoOf(l),
      client: ctx.order.client_name || '',
      size,
      lockway: l.casing ? `${l.casing}${dir}` : dir,
      color: l.color,
      glass: (l.bottom_glass || '') === '无' ? `单玻:${l.face_glass || ''}` : `底:${l.bottom_glass || ''}-面:${l.face_glass || ''}`,
      address: l.install_address || '',
      remark,
      GlassSize: glassSize,
      package: '',
    }
  }

  // 标签行集合：kind = 'lable'（标签）| 'product10'（生产标签），按 labelQuantity 复制 N 张。
  // —— product10（生产标签）专用部件映射（引擎 L1/L2，原版 @399457）——
  // 与其它 10 个引擎最大的结构差异：**结果映射自带数量修正，且最后 `× 行数量`**。
  //   · 名含「边封」且 行.边封数 有值 → quantity = 行.边封数
  //   · 行.轨道长 > 0 且 名含 滑 / 左右盖板 / 轨道盖板 → result = 行.轨道长
  //   · 名含「玻璃」且不含「亮窗」：单玻且名不含「单玻」→ q/2；扇数=一固一活→1；扇数=双活→2
  //   · 名含「玻璃」且含「亮窗」：单玻且名不含「单玻」→ q/2
  //   · 最后一律 `q ×= 行.数量`
  // L1 ∈ B平 族（§52.1），故平开取引擎 B 的部件集再过这层映射；L2 独立成族（9 块 51 条），暂近似。
  function product10Parts(l: Line): PartPreview[] {
    const isDiao = l.line_type === 'diao'
    // 平开走 **L1**、移门走 **L2**（各自独立的 state 规则 + 结果映射，§13）
    const base = computeParts(l, isDiao ? 'L2' : 'L1')
    const Q = l.quantity || 1
    const single = (l.bottom_glass || '') === '无' || (l.face_glass || '') === '无'
    return base.map((p) => {
      // ⚠️ 谓词一律读 **KEY**（原版 L1 @384171 / L2 @399118：
      //   `Object.keys(部件).forEach(e => { e.includes("边封") … e.includes("滑")||e.includes("左右盖板")||e.includes("轨道盖板")
      //      e.includes("玻璃") && !e.includes("亮窗") … !e.includes("单玻") })`），
      //   且原版输出对象就是 `{ [KEY]: { materialName, result, quantity } }`（下游再对 KEY 做拼音转写）。
      const k = p.key
      let result = p.result
      let q = p.quantity
      if (k.includes('边封') && l.edge_seal_count != null) q = Number(l.edge_seal_count) || 0
      if (l.track_length > 0 && (k.includes('滑') || k.includes('左右盖板') || k.includes('轨道盖板'))) result = l.track_length
      if (k.includes('玻璃') && !k.includes('亮窗')) {
        if (single && !k.includes('单玻')) q /= 2
        if (l.fans === '一固一活') q = 1
        if (l.fans === '双活') q = 2
      }
      // L2 比 L1 多这一条（§13）：KEY 含「玻璃」且含「亮窗」的件同样折半
      if (isDiao && k.includes('玻璃') && k.includes('亮窗') && single && !k.includes('单玻')) q /= 2
      q *= Q
      return { ...p, result, quantity: q }
    })
  }

  // product10（生产标签）复制张数：公式部件同时含「玻璃宽」「玻璃高」时取玻璃宽部件的 quantity，否则 1。
  function product10Copies(l: Line): number {
    const parts = product10Parts(l).filter((p) => p && p.materialName)
    // 原版 @387340：门控是「行对象**同时**含 `*玻璃宽` 与 `*玻璃高` 两种键」；
    //   张数 = **第一个**含「玻璃宽」的键的 `parseInt(quantity || "1")`（不是最后一个）。
    const gW = parts.find((p) => p.key.includes('玻璃宽'))
    const gH = parts.find((p) => p.key.includes('玻璃高'))
    if (!gW || !gH) return 1
    const n = parseInt(String(gW.quantity), 10)
    return Math.max(1, Number.isNaN(n) ? 1 : n)
  }

  // 原版 product10 **预览**用的分组限量（@402331）：
  //   按 `orderID + "_" + GlassSize` 分组，每组只保留 `min(组内行数, glass含「单玻」?1:2)` 行。
  //   注意：原版**打印**走的是**未分组**的那一份 —— 预览/打印本身不一致，此处按原样复刻。
  function groupProduct10(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const map = new Map<string, Record<string, unknown>[]>()
    for (const r of rows) {
      const k = `${r.orderID ?? ''}_${r.GlassSize ?? ''}`
      const arr = map.get(k)
      if (arr) arr.push(r)
      else map.set(k, [r])
    }
    const out: Record<string, unknown>[] = []
    for (const arr of map.values()) {
      const max = String(arr[0]?.glass ?? '').includes('单玻') ? 1 : 2
      out.push(...arr.slice(0, Math.min(arr.length, max)))
    }
    return out
  }

  function labelRows(kind: 'lable' | 'product10' = 'lable'): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = []
    for (const l of ctx.lines) {
      // 原版 product10（mode 10）的**复制张数**不走 lable 那套算法（`_0xff5572`）：
      // 仅当公式部件同时含「玻璃宽(BoLiKuan)」与「玻璃高(BoLiGao)」时，张数 = 玻璃宽部件的 **quantity**
      // （部件值格式 `{result}*{quantity}`，取 `split('*')[1]`），否则 1 张。
      const n = kind === 'product10' ? product10Copies(l) : labelQuantity({
        lineType: l.line_type as 'ping' | 'diao',
        fans: l.fans,
        quantity: l.quantity,
        lightWindowHeight: l.light_window_height,
        wallThickness: l.wall_thickness,
        casingPrice: l.casing_price,
        profile: l.profile,
        registrant: ctx.tenantName,
      })
      for (let i = 0; i < n; i++) {
        const row = kind === 'product10' ? product10Row(l) : lableRow(l)
        row.package = `${n}-${i + 1}` // 原版份号：`t-i`（t=总份数，i=第几张）
        rows.push(row)
      }
    }
    // 原版 lable（@369992）：收尾**无条件**按 `orderID` 的首个「数字-」段升序；
    //   无 orderID 或首段非数字 → `Infinity`（排到最后）。
    if (kind === 'lable') {
      const key = (r: Record<string, unknown>) => {
        const m = String(r.orderID ?? '').match(/^(\d+)-/)
        return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY
      }
      return rows.slice().sort((a, b) => key(a) - key(b))
    }
    return rows
  }

  /**
   * 平开「挖孔图」取图键（原版 @418159 `_0x26a75e` 的键构造，逐字对照）：
   * ```
   * 开向.includes('双开') ? (开向.includes('左') ? '双开左'
   *                       : 开向.includes('右') ? '双开右'
   *                       :                       '双开左')
   *                      : 开向
   * ```
   * ⚠️ **双开族的图键不是开向本身** —— 画图端（Glass_draw 锁向下拉）只提供 `双开左`/`双开右`，
   * 而汇算行开向是 `双开内开`/`双开外开`/`双开内左`/`双开外左`/`双开内右`/`双开外右`。
   * 不做这层映射 ⇒ 双开门**六种开向全部取不到图**（内开/外开都白）。
   * 原版还会在 `轨道种类` 非空时追加 `_{轨道种类}`；新系统公式图按 (formula_id, direction) 存、
   * 无轨道种类维度，故不追加。
   */
  function holeKeyOf(direction: string): string {
    if (!direction) return ''
    if (!direction.includes('双开')) return direction
    return direction.includes('右') ? '双开右' : '双开左'
  }

  /**
   * 按**图键**取公式挖孔图（键 = `holeKeyOf(开向)` / `左`.`右` / `左固玻`.`右固玻`）。
   *
   * 只按 `direction` 精确取，**找不到就是空、绝不换方向**。
   * `mirrored` 在这里不参与 —— 哪个方向配哪张图是画图时定的（见 `GlassDraw` 的键规则），
   * 取图端不该再替它做判断。
   *
   * 注：同一 direction 理论上可能有多条（把互为左右的两个锁向都画过时，各自都会给对方
   * 写一条 `mirrored=true` 的），此时取 id 靠前的那条。实际数据里每个方向基本只有 1 条。
   */
  function holeImageByKey(l: Line, key: string): string {
    if (!key) return ''
    const imgs = l.formula_id != null ? ctx.formulaImages[l.formula_id] : undefined
    if (!imgs) return ''
    return imgs.find((i) => i.direction === key)?.data_url || ''
  }

  /**
   * 平开行的挖孔图（原版 `_0x3a3de5`）—— **只按 `holeKeyOf(开向)` 精确取，没有内/外兜底**。
   *
   * ⚠️ 曾一度加过「内开取不到就退到外开、反之亦然」的兜底，**已撤销**：直接在旧版服务端
   * （`param1=getimage&param2={formulaID}{方向}`）实测，**没有内↔外归一** ——
   * 公式 `复古平开门` 有 `左锁内开`（200）但没有 `左锁外开`（404）。
   * 而 `35*16平开` 的 左锁内开/左锁外开 返回**字节完全相同**的图（sha 一致），
   * 即店家两个方向**各存了一张内容相同的图** —— 看起来「内开外开一样」，是数据如此，不是取图兜底。
   * ⇒ 该公式没画过某方向时，原版就是空图 + 报 `获取开孔图片失败,请确认或联系管理员`，我们必须一致。
   */
  function holeImageOf(l: Line): string {
    return holeImageByKey(l, holeKeyOf(l.direction))
  }

  /** 按固定方向键取挖孔图（原版吊趟把图存在 `{formulaID}左` / `{formulaID}右` 下）。 */
  function holeImgByDir(l: Line, dir: '左' | '右'): string {
    return holeImageByKey(l, dir)
  }

  function glassProduces(): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = []
    // 玻璃合片单：ping→diao 分块但**入口不按 formulaid 排序**
    for (const l of orderedLines(false)) {
      const base = {
        client: ctx.order.client_name || '',
        // 引擎A：`door` = 型材+颜色（**不含客户**，与生产单引擎B不同）
        door: [l.profile, l.color].filter(Boolean).join('<br>'),
        OrderID: lineNoOf(l),
        basicInfo: basicInfoText(l, 'A'), // 引擎A：双无玻文案 = 「无」
        lockImg: lineLockImage(l),
        doorImg: l.image_url || '',
        remark: glassRemark(l),
      }
      const parts = computeParts(l, 'A').filter((p) => p && p.materialName) // 引擎A
      const ft = String(formulaOf(l)?.formula_type || '')
      const bRaw = l.bottom_glass || ''
      const fRaw = l.face_glass || ''
      const Q = l.quantity || 1
      // 原版（引擎A `_0xcfde65`/`_0x4d28ce`）：每组拼 `{名}:{result}`，组末补一个 `<br>数量:N`，
      // 其中 **N 取「该组最后一个命中件的 quantity」**（不是求和）：
      //   `(底玻!=='无' || 面玻==='无' || 名含单玻) && (面玻!=='无' || 底玻==='无' || 名含单玻)`
      //     → 双玻 N = qty×数量；否则 单玻 N = qty/2×数量
      //   平开另有 parentSubsidiary → 双玻 4×数量 / 单玻 2×数量；diamond → 一律 3×数量
      //   移门另有一组「亮窗玻璃」（排除压线），其 N 的判据是 `底玻≠无 && 面玻≠无 || 名含单玻`
      // ⚠️ 与其它列同规：**匹配读 KEY（`pk`），显示名读 `materialName`**。
      //    旧版引擎 A 这几处也都是 `Object.entries(parts).filter((([e]) => e.includes("玻璃") && !e.includes("亮窗")))`
      //    这类写法（`e` = KEY），`含单玻` 判定同理。
      // doorsheet 的算法抽在 `glassDoorsheetText`（纯函数），见那里的注释与差分台
      // `docs/diao-print-doorsheet-logiccheck.mjs`。
      const doorsheet = glassDoorsheetText({
        lineType: l.line_type ?? '',
        fans: l.fans,
        formulaType: ft,
        bottomGlass: bRaw,
        faceGlass: fRaw,
        quantity: Q,
        parts,
      })
      rows.push({ ...base, doorsheet })
    }
    return rows
  }


  function glassInfoProduces(): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = []
    for (const l of ctx.lines) {
      const parts = (l.parts ?? []).filter((p) => p && p.materialName)
      const find = (re: RegExp) => parts.find((p) => re.test(pk(p)))
      const ft = String(formulaOf(l)?.formula_type || '') // 'diamond' | 'parentSubsidiary' | 'double' | 其它
      const diao = l.line_type === 'diao'
      const bRaw = l.bottom_glass || ''
      const fRaw = l.face_glass || ''
      const Q = l.quantity || 1
      const img = holeImageOf(l) // 原版 `_0x3a3de5`：按 开向(+轨道种类) 取的挖孔图
      // 原版：吊趟循环 `if (底玻==='无' && 面玻==='无') continue`；**平开循环没有这句**
      if (diao && bRaw === '无' && fRaw === '无') continue
      const base = {
        OrderID: lineNoOf(l),
        client: ctx.order.client_name || '',
        date: ctx.today,
        thickness: l.glass_thickness || '',
        // 原版 @411200 `_0xa370fc`：这三家门店 remark 整列为空
        remark: STORE_NO_GLASS_REMARK.includes(ctx.tenantName) ? '' : [l.remark, l.install_address].filter(Boolean).join('<br>'),
      }
      const push = (o: Record<string, unknown>) => rows.push({ ...base, doorImg: '', ...o })
      // 原始判据是**部件名含「单玻」**，不是底玻/面玻的值
      const isSingle = (p: PartPreview) => pk(p).includes('单玻')
      const qv = (p: PartPreview, div = 1) =>
        (isSingle(p) ? (p.quantity / div) * Q : (p.quantity / 2 / div) * Q)

      if (diao) {
        const fans = l.fans || ''
        const dir = l.direction || ''
        const leftImg = holeImgByDir(l, '左')
        const rightImg = holeImgByDir(l, '右')
        // 原版：`扇数==='一固一活' && 开向不含该侧` 时该侧图不取（置空）
        const okL = !(fans === '一固一活' && !dir.includes('左')) && !!leftImg
        const okR = !(fans === '一固一活' && !dir.includes('右')) && !!rightImg
        const has = (list: string[]) => list.some((k) => fans.includes(k))
        // ⚠️ 原版左右两张扇数名单**不同**，且 D1 与 D2 的名单**恰好相反**（各有「6轨6扇」的一侧）
        const ONE_L_D1 = ['单轨2扇', '双活', '2轨2扇', '2轨3扇', '3轨3扇', '4轨4扇', '5轨5扇', '6轨6扇', '3轨4扇']
        const ONE_R_D1 = ['单轨2扇', '双活', '2轨2扇', '2轨3扇', '3轨3扇', '4轨4扇', '5轨5扇', '3轨4扇']
        const ONE_L_D2 = ['单轨2扇', '双活', '2轨2扇', '2轨3扇', '3轨3扇', '4轨4扇', '5轨5扇', '3轨4扇']
        const ONE_R_D2 = ['单轨2扇', '双活', '2轨2扇', '2轨3扇', '3轨3扇', '4轨4扇', '5轨5扇', '6轨6扇', '3轨4扇']
        const qv2 = (p: PartPreview, dl: number, dr: number) => qv(p) - dl - dr

        // ── D1：底玻支（扇数为一固一活/双活时整块跳过） ──
        if (bRaw !== '无' && fans !== '一固一活' && fans !== '双活') {
          const gW = parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗') && !pk(p).includes('玻璃宽小'))
          const gS = parts.find((p) => pk(p).includes('玻璃宽小') && !pk(p).includes('亮窗'))
          const gH = parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗'))
          const h = gH ? gH.result : 0
          let dl = 0
          let dr = 0
          if (okL && dir.includes('左')) dl = 1
          if (okL && has(ONE_L_D1)) dl = 1
          if (okL && fans.includes('2轨4扇')) dl = 2
          if (okL && fans.includes('3轨6扇')) dl = 2
          if (okR && dir.includes('右')) dr = 1
          if (okR && has(ONE_R_D1)) dr = 1
          if (okR && fans.includes('2轨4扇')) dr = 2
          if (okL && fans.includes('3轨6扇')) dr = 2 // 原文此处用的是**左图**变量
          // 主行（玻璃宽 / 玻璃宽小）：原版**不设 doorImg**，保持字面量的空串
          const mainRow = (p: PartPreview | undefined) => {
            if (!p) return
            const o = qv2(p, dl, dr)
            if (o > 0) push({ glassName: `底玻-${l.bottom_glass}`, width: p.result, height: h, quantity: o })
          }
          mainRow(gW)
          mainRow(gS)
          if (dl > 0) push({ glassName: `底玻-${l.bottom_glass}`, width: gW ? gW.result : 0, height: h, quantity: dl, doorImg: leftImg })
          if (dr > 0) push({ glassName: `底玻-${l.bottom_glass}`, width: gW ? gW.result : 0, height: h, quantity: dr, doorImg: rightImg })
        }

        // ── D2：面玻支（无扇数门控；一固一活另有「固玻-」行） ──
        if (fRaw !== '无') {
          const fW = parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗') && !pk(p).includes('固') && !pk(p).includes('玻璃宽小'))
          const fS = parts.find((p) => pk(p).includes('玻璃宽小') && !pk(p).includes('亮窗') && !pk(p).includes('固'))
          const fH = parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗') && !pk(p).includes('固'))
          const h = fH ? fH.result : 0
          let dl = 0
          let dr = 0
          if (okL && dir.includes('左')) dl = 1
          if (okL && has(ONE_L_D2)) dl = 1
          if (okL && fans.includes('2轨4扇')) dl = 2
          if (okL && fans.includes('3轨6扇')) dl = 2
          if (okR && dir.includes('右')) dr = 1
          if (okR && has(ONE_R_D2)) dr = 1
          if (okR && fans.includes('2轨4扇')) dr = 2
          if (okL && fans.includes('3轨6扇')) dr = 2
          // 一固一活专用部件（仅在 扇数==='一固一活' 时参与）
          const igW = fans === '一固一活' ? parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗') && pk(p).includes('一固一活固玻璃宽')) : undefined
          const igH = fans === '一固一活' ? parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗') && pk(p).includes('一固一活固玻璃高')) : undefined
          const imW = fans === '一固一活' ? parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗') && pk(p).includes('一固一活门玻璃宽')) : undefined
          const imH = fans === '一固一活' ? parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗') && pk(p).includes('一固一活门玻璃高')) : undefined
          let mainQ = fW ? qv2(fW, dl, dr) : 0
          // 一固一活：主行作废，扣减改为按开向取 1，且另推一行「固玻-」
          let guRow = false
          if (fans === '一固一活') {
            if (dir.includes('左')) {
              mainQ = 0
              dl = 1
              dr = 0
              guRow = true
            }
            if (dir.includes('右')) {
              mainQ = 0
              dl = 0
              dr = 1
              guRow = true
            }
          }
          if (mainQ > 0 && fW) push({ glassName: `面玻-${l.face_glass}`, width: fW.result, height: h, quantity: mainQ })
          if (fS) {
            const u = qv2(fS, dl, dr)
            if (u > 0) push({ glassName: `面玻-${l.face_glass}`, width: fS.result, height: h, quantity: u })
          }
          if (guRow) {
            // 原版是四个独立 if：`if (n===0 && 部件)` / `if (d===0 && 部件)` 各设一次
            // （一固一活时 dl/dr 必有一个为 0，故等价于「部件存在即取」）
            const useGu = dl === 0 || dr === 0
            push({
              glassName: `固玻-${l.face_glass}`,
              width: useGu && igW ? igW.result : 0,
              height: useGu && igH ? igH.result : 0,
              quantity: useGu && igW ? 1 : 0,
            })
          }
          const dedRow = (n: number, img: string) => {
            if (n <= 0) return
            push({
              glassName: fans.includes('一固一活') ? `门玻-${l.face_glass}` : `面玻-${l.face_glass}`,
              width: imW ? imW.result : fW ? fW.result : 0,
              height: imH ? imH.result : h,
              quantity: imW ? 1 : n,
              doorImg: img,
            })
          }
          dedRow(dl, leftImg)
          dedRow(dr, rightImg)
        }

        // ── D3 亮窗：两个独立 if，可各推一行 ──
        if (l.light_window_height) {
          const lwW = parts.find((p) => pk(p).includes('亮窗玻璃宽'))
          const lwH = parts.find((p) => pk(p).includes('亮窗玻璃高'))
          if (lwW && lwH && bRaw !== '无' && !fans.includes('活')) {
            push({ glassName: `亮窗底玻-${l.bottom_glass}`, width: lwW.result, height: lwH.result, quantity: (lwW.quantity / 2) * Q })
          }
          if (lwW && lwH && fRaw !== '无') {
            const q = (lwW.quantity / 2) * Q
            // 原文 token 557 = '亮窗面璃-'（错字照抄）；扇数含「活」时才是 '亮窗玻璃-'
            push({ glassName: fans.includes('活') ? `亮窗玻璃-${l.face_glass}` : `亮窗面璃-${l.face_glass}`, width: lwW.result, height: lwH.result, quantity: q < 1 ? 1 : q })
          }
        }
        continue
      }

      // —— 平开：B1 与 B2 是两个**互不排斥**的顶层 if，双玻时各推一行 ——
      // 原版 B1/B2 各自是 `if (该面 !== '无' && ft !== 'diamond') {…} else {…}` ——
      // **两条路径都恰好推 1 行**（B1.d/B2.d 是**外层 else**，已读原文 `}else{…push(e)}` 确认）。
      // ⇒ 普通/单玻/双玻 都 2 行；diamond 行 = B1.d + B2.d + B4×3 = **5 行**。
      const block = (which: 'bottom' | 'face') => {
        const on = which === 'bottom' ? bRaw !== '无' : fRaw !== '无'
        // 原版此处只排除「亮窗」，**不排除「玻璃宽小」**
        const gW = parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗'))
        const gH = parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗'))
        const fallbackName = which === 'bottom' ? `底玻-${l.bottom_glass}` : `面玻-${l.face_glass}`
        if (on && ft !== 'diamond') {
          if (ft === 'parentSubsidiary') {
            const w = find(which === 'bottom' ? /子门玻璃宽/ : /母门玻璃宽/)
            const hh = find(which === 'bottom' ? /子门玻璃高/ : /母门玻璃高/)
            push({
              glassName: fallbackName,
              width: w ? w.result : 0,
              height: hh ? hh.result : 0,
              quantity: w ? qv(w) : 0,
              doorImg: which === 'face' ? img : '',
            })
            return
          }
          const div = ft === 'double' && img ? 2 : 1
          // 原版 B2.c（double 且无图）的 glassName 仍是 `底玻-`（原文如此，照抄）
          const name = which === 'bottom' ? `底玻-${l.bottom_glass}`
            : ft === 'double' && !img ? `底玻-${l.bottom_glass}` : `面玻-${l.face_glass}`
          push({
            glassName: name,
            width: gW ? gW.result : 0,
            height: gH ? gH.result : 0,
            quantity: gW ? qv(gW, div) : 0,
            doorImg: which === 'bottom' ? img : ft === 'double' && !img ? '' : img,
          })
          return
        }
        // B1.d / B2.d：外层 else，仍推 1 行
        push({
          glassName: fallbackName,
          width: gW ? gW.result : 0,
          height: gH ? gH.result : 0,
          quantity: gW ? qv(gW) : 0,
          doorImg: img,
        })
      }
      block('bottom')
      block('face')
      // B3 亮窗（单块，`ft !== 'diamond'` 且至少一面非「无」）
      if (l.light_window_height && ft !== 'diamond' && (fRaw !== '无' || bRaw !== '无')) {
        const lwW = find(/亮窗玻璃宽/)
        const lwH = find(/亮窗玻璃高/)
        push({
          glassName: bRaw !== '无' ? `亮窗玻璃-${l.bottom_glass}` : `亮窗玻璃-${l.face_glass}`,
          width: lwW ? lwW.result : 0,
          height: lwH ? lwH.result : 0,
          quantity: lwW ? lwW.quantity * Q : 0,
        })
      }
      // B4 钻石：三行，部件按**精确名**取
      if (ft === 'diamond') {
        const exact = (n: string) => parts.find((p) => pk(p) === n)
        // 图：左固玻璃 = `{formulaID}左固玻` 图（原版 `_0x5692f6`）、右固玻璃 = `{formulaID}右固玻`
        // （原版 `_0x286ba9`）、门玻璃 = 行挖孔图（原版 `_0x3a3de5`）。**不是三行都用行挖孔图**
        // —— `左固玻`/`右固玻` 正是画图端锁向下拉里的两个键。
        for (const [kw, kh, name, dimg] of [
          ['左固玻璃宽', '左固玻璃高', `左固玻璃-${l.bottom_glass}`, holeImageByKey(l, '左固玻')],
          ['右固玻璃宽', '右固玻璃高', `右固玻璃-${l.bottom_glass}`, holeImageByKey(l, '右固玻')],
          ['门玻璃宽', '门玻璃高', `门玻璃-${l.face_glass}`, img],
        ] as [string, string, string, string][]) {
          const w = exact(kw)
          const hh = exact(kh)
          push({ glassName: name, width: w ? w.result : 0, height: hh ? hh.result : 0, quantity: Q, doorImg: dimg })
        }
      }
    }
    // 原版 @453705：厚度为 0 的行剔除；随后 `order` 模式按单号数字前缀升序
    const kept = rows.filter((r) => Number(r.thickness) !== 0)
    if (ctx.sortMethod === 'order') {
      kept.sort(
        (a, b) =>
          (parseInt(String(a.OrderID ?? '').split('-')[0], 10) || 0) -
          (parseInt(String(b.OrderID ?? '').split('-')[0], 10) || 0),
      )
    }
    return kept
  }

  // —— doorsheet 列（原版四个引擎共用同一套结构，只差关键词/排除词/修正项）——
  // 按**关键词数组顺序**收集：`name.includes(kw) && !name.includes(排除词)`；
  // 「玻璃宽/玻璃高」且单玻（底玻或面玻为「无」）且名字不含「单玻」→ 数量 `round(q/2)`（钻石型不折半）；
  // 吊趟引擎另加 `一固一活→1`、`双活→2`；
  // 文本 = `{部件名}:{result}*{数量×行数量}`，**「玻璃高」项前额外加一个 `<br>`**（原版如此，会多一个空行）。

  const isShanshanStore = () => ctx.tenantName === STORE_SHANSHAN
  /** 部件文本 `{名}{分隔}{result}*{数量}`；杉杉门店的分隔是 `:<br>`。 */
  const partLine = (name: string, rest: string) => `${name}${isShanshanStore() ? ':<br>' : ':'}${rest}`

  // —— doorframe 列（原版四引擎，规则见 docs/2026-09-10-template-field-audit.md §16）——
  // 平开：引擎B = 门框高组→门框宽组→前框组→后框组→门板组；oldSheet(D) = 门框(不分高宽)→前框→后框→门板；
  //       钻石型两侧都改为固定 4 键「左边/右边/斜长/竖框」按 hasOwnProperty 精确取。
  // 吊趟（两套同构）：轨道组（边封数覆盖数量、轨道长覆盖滑/盖板的结果）→「套线名：{套线种类}」→套线组（包宽/包高）。
  function doorframeText(l: Line, engine: EngineId): string {
    const oldSheetEngine = engine === 'D'
    const cEngine = engine === 'C'
    // 品牌分隔符 `:<br>` 在旧版是**逐分支硬编码**的，不是全局开关：
    //   B平/B吊 的**每一个**分支都判品牌；**D平/D吊/C吊 一个都不判**（恒 `:`）。
    //   我们原先按「非 D 引擎」一律 `partLine()` ⇒ B吊 的下轨/上滑/上轨/套线少 `<br>`、D 系多 `<br>`。
    const brand = engine === 'B'
    const parts = computeParts(l, engine).filter((p) => p && p.materialName)
    const Q = l.quantity || 1
    const fmt = (p: PartPreview, result?: number) => {
      const rest = `${result ?? p.result}*${p.quantity * Q}`
      return brand ? partLine(p.materialName, rest) : `${p.materialName}:${rest}`
    }

    if (l.line_type === 'diao') {
      const track = (l.track || '')
      // ⚠️ 筛选一律读部件 **KEY**，显示名才用 `materialName`（原版 B吊 @509947 / D吊 @548564 / C吊 @581434：
      //    `Object.entries(parts).filter((([e]) => ["边封","下轨","上轨","滑","固定","移动","上横","盖板"].some(t => e.includes(t))))`，
      //    分支判定同样是 `e.includes("滑")` / `e.includes("下滑")` / `e.includes("上滑")` …）。
      //    **唯一按 materialName 的是「多轨道时挑哪根下滑」**（原版 `t.materialName?.includes(行.轨道种类)`）。
      const src = parts
        .filter((p) => ['边封', '下轨', '上轨', '滑', '固定', '移动', '上横', '盖板'].some((k) => p.key.includes(k)))
        .filter((p) => !p.key.includes('企'))
        // 边封闸门照抄原版 `0 !== 行["边封数"]`：**宽松不等**，故 `null`/`''` 时**保留**边封
        //（我们原先 `Number(...) !== 0` 会把 `null` 也判成 0 而**整条边封消失**）。
        .filter(
          (p) =>
            (!p.key.includes('边封') || (l.edge_seal_count as unknown) !== 0) &&
            !(track.includes('吊轨') && p.key.includes('下滑')),
        )
      // C吊（@581383）**没有** multi 判定，也**没有**左右盖板/轨道盖板两条轨道长覆盖 —— 只有 `边封` + `滑`。
      const multi = !cEngine && src.filter((p) => p.key.includes('下滑')).length > 1
      const trackGrp = (multi ? src.filter((p) => !p.key.includes('下滑') || p.materialName.includes(track)) : src).map((p) => {
        const k = p.key
        const n = p.materialName
        let result = p.result
        let qty = p.quantity
        if (k.includes('边封') && l.edge_seal_count != null) qty = Number(l.edge_seal_count)
        if (k.includes('滑') && l.track_length > 0) result = l.track_length
        if (!cEngine && (k.includes('左右盖板') || k.includes('轨道盖板')) && l.track_length > 0) result = l.track_length
        const rest = `${result}*${qty * Q}`
        if (k.includes('下滑')) return brand ? partLine(multi && n.includes(track) ? n : `${track}${n}`, rest) : `${multi && n.includes(track) ? n : `${track}${n}`}:${rest}`
        if (k.includes('下轨')) return `${track}${n}:${rest}`
        if ((k.includes('上滑') || k.includes('上轨')) && track.includes('吊轨')) {
          const kw = k.includes('上滑') ? '上滑' : '上轨'
          return `${n.includes(kw) ? n.replace(kw, track) : `${track}-${n}`}:${rest}`
        }
        return brand ? partLine(n, rest) : `${n}:${rest}`
      })
      // 套线组：**按部件 key 匹配**（原版 `Object.entries(parts).filter(([e])=>e.includes("包宽")||e.includes("包高"))`
      // @512145），显示名取 `materialName`。二者不同名 —— 如公式 7 的 key
      // `无亮窗双包宽` 其 materialName 是 `套线宽`，按 materialName 匹配会整个漏掉。
      const casing = parts
        .filter((p) => p.key.includes('包宽') || p.key.includes('包高'))
        .flatMap((p) => {
          const n = p.materialName
          const c = (rest: string) => (brand ? `${n}:<br>${rest}` : `${n}:${rest}`)
          if (p.key.includes('包高') && ((l.front_casing_add || 0) > 0 || (l.back_casing_add || 0) > 0)) {
            const q = (p.quantity * Q) / 2
            return [c(`${p.result + (l.front_casing_add || 0)}*${q}`), c(`${p.result + (l.back_casing_add || 0)}*${q}`)]
          }
          return [c(`${p.result}*${p.quantity * Q}`)]
        })
      return casing.length > 0
        ? `${trackGrp.join('<br>')}<br>套线名：${l.casing || ''}<br>${casing.join('<br>')}`
        : trackGrp.join('<br>')
    }

    let base: string[]
    // ⚠️ 与吊趟同规：**筛选读 KEY，显示名读 materialName**。原版 B平 @490500-491700 / D平(oldSheet) @531974：
    //    钻石型 `e.filter(k => Object.prototype.hasOwnProperty.call(parts, k))`（**KEY**，不是 materialName）；
    //    非钻石型 `entries.forEach(([e,x]) => e.includes("门框高") ? 高组.push : e.includes("门框宽") && 宽组.push)`；
    //    前/后/门板同样 `Object.entries(parts).filter((([e]) => ["前框"].some(t => e.includes(t))))`。
    //    `前框高`/`后框高` 加包长的判定也是 `e.includes(...)`（KEY）。
    if (isDiamond(l)) {
      base = ['左边', '右边', '斜长', '竖框']
        .map((k) => parts.find((p) => p.key === k))
        .filter((p): p is PartPreview => !!p)
        .map((p) => fmt(p))
    } else if (oldSheetEngine) {
      base = parts.filter((p) => p.key.includes('门框')).map((p) => fmt(p))
    } else {
      const g = (kw: string) => parts.filter((p) => p.key.includes(kw)).map((p) => fmt(p))
      base = [...g('门框高'), ...g('门框宽')]
    }
    const front = parts.filter((p) => p.key.includes('前框')).map((p) => (p.key.includes('前框高') ? fmt(p, p.result + (l.front_casing_add || 0)) : fmt(p)))
    const back = parts.filter((p) => p.key.includes('后框')).map((p) => (p.key.includes('后框高') ? fmt(p, p.result + (l.back_casing_add || 0)) : fmt(p)))
    const board = parts.filter((p) => p.key.includes('门板')).map((p) => fmt(p))
    return [...base, ...front, ...back, ...board].join('<br>')
  }

  // —— windows 列（原版四引擎，规则见 §16）——
  // 平开：引擎B 关键词 [扣板,上亮横,上亮窗玻璃,压线]；oldSheet(D) 多一个「封板」。玻璃件单玻时 `Math.round(q/2)`（钻石不折半）。
  // 吊趟 引擎B：亮窗类[中柱,亮窗玻璃,槽,压线] + 扣板组（拼扣板厚，`*<br>` 分隔；扣板厚缺失时打 `*0`）。
  // 吊趟 oldSheet：可选亮窗段（仅 亮窗总高>门洞高）+ 主体段（[槽,封板高,封板宽] 按关键词下标排序后拆「非玻璃/玻璃」）
  //                + 扣板组（拼扣板厚，普通 `*` 分隔）。
  //
  // ⚠️ **匹配一律用部件 KEY，显示名才用 `materialName`** —— 原版四处实现都是
  //    `Object.entries(parts).filter((([e]) => 关键词.some(t => e.includes(t))))` 后
  //    `t.materialName + ":" + …`（@492734 平开引擎B、@533094 平开 oldSheet、
  //    @512847 吊趟引擎B、@550917/@551313 吊趟 oldSheet；token 解码见
  //    `legacy/decode-stringmap.mjs`）。KEY 与 materialName **不等**是常态
  //    （如 KEY `上亮窗玻璃高` / materialName `上亮玻璃高`、KEY `2轨扣板厚` / materialName `扣板厚`），
  //    按 materialName 匹配会**静默丢件**：`上亮玻璃高` 不含关键词 `上亮窗玻璃`。
  //    同理，`includes('玻璃')` / `includes('单玻')` / `includes('亮窗玻璃')` 这些判定
  //    在原版里**读的也是 KEY**（`e.includes(...)`），故一并改为 `p.key`。
  function windowsText(l: Line, engine: EngineId): string {
    const oldSheetEngine = engine === 'D'
    // 引擎C（C吊，只服务「生产单1」的吊趟行）：**原版不做任何玻璃修正**，
    // @583110 `_0x35fcb4 = Object.entries(parts).filter((([e]) => ["中柱","亮窗玻璃","槽","压线"].some(t => e.includes(t))))
    //   .map((([e,t]) => t.materialName + ":" + t.result + "*" + clamp(t.quantity*数量)))` —— 既无折半、也无扇数修正。
    const cEngine = engine === 'C'
    // 品牌分隔符 `:<br>` **只有引擎B（B平/B吊）有**；D平/D吊/C吊 原版一律硬编码 `:`
    // （@533034 平开D、@550882 吊趟D-head、@583110 吊趟C 都直接 `t.materialName+":"`）。
    const brand = engine === 'B'
    const sep = (name: string, rest: string) => (brand ? partLine(name, rest) : `${name}:${rest}`)
    const parts = computeParts(l, engine).filter((p) => p && p.materialName)
    const Q = l.quantity || 1
    const single = (l.bottom_glass || '') === '无' || (l.face_glass || '') === '无'
    const clamp01 = (v: number) => (v > 0 && v < 1 ? 1 : v)
    // 玻璃件数量修正（吊趟两套额外有扇数修正）
    const glassQty = (p: PartPreview, withFans: boolean) => {
      let q = p.quantity
      if (p.key.includes('玻璃')) {
        if (single && !p.key.includes('单玻')) q = withFans ? q / 2 : Math.round(q / 2)
        if (withFans && l.fans === '一固一活') q = 1
        if (withFans && l.fans === '双活') q = 2
      }
      return q
    }

    if (l.line_type === 'diao') {
      const thick = parts.find((p) => p.key.includes('扣板厚'))?.result ?? 0
      const padGroup = () =>
        parts
          .filter((p) => p.key.includes('扣板') && !p.key.includes('扣板厚'))
          .map((p) => {
            const o = clamp01(p.quantity * Q)
            return oldSheetEngine || cEngine
              ? `${p.materialName}:${p.result}*${thick}*${o}`
              : partLine(p.materialName, `${p.result}${thick > 0 ? `*<br>${thick}` : `*${thick}`}*${o}`)
          })
      if (!oldSheetEngine) {
        const lw = parts
          .filter((p) => ['中柱', '亮窗玻璃', '槽', '压线'].some((k) => p.key.includes(k)))
          .map((p) => sep(p.materialName, cEngine ? `${p.result}*${clamp01(p.quantity * Q)}` : `${p.result}*${clamp01(glassQty(p, true) * Q)}`))
        return [...lw, ...padGroup()].join('<br>')
      }
      let head = ''
      if (l.light_window_height > l.door_height) {
        head = parts
          .filter((p) => ['中柱', '亮窗玻璃', '压线'].some((k) => p.key.includes(k)))
          .map((p) => {
            const x = p.key.includes('亮窗玻璃') && (l.bottom_glass || '') === '无' ? Q / 2 : Q
            return `${p.materialName}:${p.result}*${clamp01(p.quantity * x)}`
          })
          .join('<br>')
      }
      const KW = ['槽', '封板高', '封板宽']
      const main = parts
        .filter((p) => KW.some((k) => p.key.includes(k)) && !p.key.includes('亮窗玻璃'))
        .map((p) => ({
          prio: KW.findIndex((k) => p.key.includes(k)),
          isGlass: p.key.includes('玻璃'),
          text: `${p.materialName}:${p.result}*${clamp01(glassQty(p, true) * Q)}`,
        }))
        .sort((a, b) => a.prio - b.prio)
      const mid = [...main.filter((x) => !x.isGlass), ...padGroup(), ...main.filter((x) => x.isGlass)].map((x) => (typeof x === 'string' ? x : x.text))
      return [head, mid.join('<br>')].filter(Boolean).join('<br>')
    }

    const kw = oldSheetEngine ? ['扣板', '上亮横', '压线', '封板', '上亮窗玻璃'] : ['扣板', '上亮横', '上亮窗玻璃', '压线']
    return parts
      .filter((p) => kw.some((k) => p.key.includes(k)))
      .map((p) => {
        let q = glassQty(p, false)
        if (isDiamond(l) && p.key.includes('玻璃') && single && !p.key.includes('单玻')) q = p.quantity
        return sep(p.materialName, `${p.result}*${q * Q}`)
      })
      .join('<br>')
  }

  function doorsheetText(l: Line, engine: EngineId): string {
    const oldSheetEngine = engine === 'D'
    const cEngine = engine === 'C'
    // 品牌分隔符 `:<br>` 与「玻璃高前插 `<br>`」**只存在于引擎B**：
    //   C吊（@580778 `_0x1239ce.doorsheet`）恒为 `x.materialName+":"+x.result+"*"+…`，**既无 `:<br>` 也无前插 `<br>`**，
    //   且关键词数组同 D吊（无 封板高/封板宽）—— 我们原先给 C 用了 `DS_KW.diao`（带封板）且套了 B 的两个变体，属引擎串味。
    const brand = engine === 'B'
    const parts = computeParts(l, engine).filter((p) => p && p.materialName)
    const diao = l.line_type === 'diao'
    const kws = isDiamond(l) ? DS_KW.diamond : diao ? (oldSheetEngine || cEngine ? DS_KW.diaoOld : DS_KW.diao) : oldSheetEngine ? DS_KW.pingOld : DS_KW.ping
    // 排除词：吊趟两套都是「亮窗」；平开 引擎B 是「亮窗玻璃」、旧 schema(引擎D) 是「上亮玻璃」
    const exclude = diao ? '亮窗' : oldSheetEngine ? '上亮玻璃' : '亮窗玻璃'
    const out: string[] = []
    // ⚠️ **关键词与排除词都按部件 KEY 判定，显示名才用 `materialName`**（原版 B平 @490039 / D平 @531100：
    //    `_0x5c8510.reduce((acc,t) => [...acc, ...Object.entries(parts)
    //        .filter((([e]) => e.includes(t) && !e.includes("上亮玻璃")))
    //        .map((([e,x]) => … x.materialName + ":" + x.result + "*" + l*数量))], [])`）。
    //    `includes("单玻")` 同样读 KEY。分组顺序 = **关键词数组顺序**（外层 reduce），非 parts 声明序。
    for (const kw of kws) {
      for (const p of parts) {
        const n = p.materialName
        if (!p.key.includes(kw) || p.key.includes(exclude)) continue
        let q = p.quantity
        if (kw === '玻璃宽' || kw === '玻璃高') {
          const single = (l.bottom_glass || '') === '无' || (l.face_glass || '') === '无'
          // 平开：`Math.round(q/2)`，且 diamond 不折半；吊趟：`q/2` **不取整**（原版两套写法不同，§15）
          if (single && !p.key.includes('单玻')) q = diao ? p.quantity / 2 : isDiamond(l) ? p.quantity : Math.round(p.quantity / 2)
          if (diao && l.fans === '一固一活') q = 1
          if (diao && l.fans === '双活') q = 2
        }
        const rest = `${p.result}*${q * (l.quantity || 1)}`
        // 杉杉门店变体只存在于引擎B（生产单）两套；oldSheet 两套与 C吊 恒用 `:`
        const c = brand ? partLine(n, rest) : `${n}:${rest}`
        out.push(kw === '玻璃高' && !cEngine ? `<br>${c}` : c)
      }
    }
    return out.join('<br>')
  }

  // 亮窗/扣板列文本：扣板厚不独立成行，只作为后缀拼进「扣板宽/高」（`材料:result*扣板厚*数量`）。
  // 订单信息（原版 basicInfo，offset 498404）：洞尺(前置) + 尺寸(门洞高*门洞宽*墙厚) + 亮窗(亮窗高：) + 吊脚(吊脚：) + 玻璃；末行 开向(/扇数)。
  // 订单信息列（basicInfo）。原版共 **5 处不同实现**，我们只用得到两类：
  //   引擎B（生产单 `_0x551a25`/`_0x500ef9`）与 引擎A（玻璃合片单 `_0xcfde65`/`_0x4d28ce`）。
  // 两者差异（原始 chunk 实证）：
  //   玻璃段单玻：B = `{面玻}*单玻`；A = `单玻*{面玻}*{厚}mm`
  //   玻璃段双无：B = 平开`无玻璃`/吊趟`无`；A = **平开`无`/吊趟`无玻璃`**（正好相反）
  //   玻璃段一般：B = `{面玻}+{底玻}*{厚}`；A = 同 + `mm`
  //   吊趟尾部抑制条件：B = 型材含「哑口套/门套」；A = 底玻与面玻都为「无」；**C = 不抑制（尾部恒 开向<br>扇数）**
  //   亮窗数量：**只有吊趟拼 `亮窗{N}格`**（A/B/C 一致）
  function basicInfoText(l: Line, engine: 'A' | 'B' | 'C' = 'B'): string {
    const engineA = engine === 'A'
    const items: string[] = []
    const diao = l.line_type === 'diao'
    const bRaw = l.bottom_glass || ''
    const fRaw = l.face_glass || ''
    const thick = l.glass_thickness || ''
    const dims = [l.door_height, l.door_width, l.wall_thickness].filter((v) => v && v !== 0)
    if (dims.length) items.push(dims.join('*'))
    const lw = l.light_window_height || 0
    if (lw) {
      if (diao) {
        // 吊趟（A/B 同）：`亮窗高：{lw}` + 亮窗数量≠0 时追加 `亮窗{N}格`
        let e = `亮窗高：${lw}`
        if ((l.light_window_count || 0) !== 0) e += `亮窗${l.light_window_count}格`
        items.push(e)
      } else {
        // 平开（A/B 同）：钻石型 `*{lw}`，否则 `亮窗高：{lw}`；**不拼亮窗数量**
        items.push(isDiamond(l) ? `*${lw}` : `亮窗高：${lw}`)
      }
    }
    // 吊脚段：平开 A/B 都有；两套吊趟都没有
    if (!diao && l.jiao) items.push(`吊脚：${l.jiao}`)
    const hole = String(l.hole_size ?? '').trim()
    if (hole) items.unshift(hole)
    if (bRaw || fRaw || thick) {
      // 严格判字面量「无」—— 原版 B吊 @518522 / D吊 @556765 / D平 @537103 / C吊 @587104 / A平 @477457 / A吊 @466398
      // 都是 `"无"===行["底玻"]`，**空串不算「无」**（空串会落到第三支）。
      const bottomNone = bRaw === '无'
      const faceNone = fRaw === '无'
      if (bottomNone && !faceNone) {
        items.push(engineA ? `单玻*${fRaw}*${thick}mm` : `${fRaw}*单玻`)
      } else if (bottomNone && faceNone) {
        items.push(engineA ? (diao ? '无玻璃' : '无') : (diao ? '无' : '无玻璃'))
      } else {
        items.push(`${fRaw}+${bRaw}*${thick}${engineA ? 'mm' : ''}`)
      }
    }
    const head = items.join('<br>')
    // 尾部用**原始 `开向`**，不做 displayDirection（原文：B平 @498631 `…+'<br>'+行["开向"]`，
    // B吊 @519038 `…+行["开向"]+"<br>"+行["扇数"]` —— 两处读的都是行字段原文，不走改名映射）。
    const dir = l.direction || ''
    let tail: string
    if (diao) {
      const suppress = engine === 'C'
        ? false // 引擎C（C吊）：尾部**恒** `开向<br>扇数`，无抑制（§D10）
        : engineA
          // 原版 A吊 @477760：`"无"===面玻 && "无"===底玻 ? "" : "<br>"+开向+"<br>"+扇数` —— **严格**，无空串支
          ? bRaw === '无' && fRaw === '无'
          : /哑口套|门套/.test(l.profile || '')
      tail = suppress ? '' : `${dir}<br>${l.fans || ''}`
    } else {
      tail = l.casing ? `${l.casing}${dir}` : dir
    }
    return [head, tail].filter(Boolean).join('<br>')
  }

  /** 标准生产单形状的一行（引擎可指定）。原版吊趟的常规生产单用 B吊，而 **product1 的吊趟用 C吊**
   *  （product1 producer 的 diao 分支收尾 `data:_0x1239ce`，即 C吊 producer 的同一对象 @587825）。 */
  function productionRow(l: Line, engine: 'B' | 'C'): Record<string, unknown> {
    return {
      // 原版：白名单门店不含客户名
      door: (isDoorNoClientStore(ctx.tenantName) ? [l.profile, l.color] : [ctx.order.client_name, l.profile, l.color]).filter(Boolean).join('<br>'),
      // 原版 @494870（平开）/ @515705（吊趟）/ @585217（C吊）：`!_0x743794.includes(店) && 行["图片ID"]` 才取图
      // ⇒ **那 44 家白名单门店的门图整列为空**（注意这里**不含** `鸿程鑫派门窗`）。
      // 对照：玻璃合片单（@464478）与 product2/3（@533xxx/@552xxx）**没有**白名单门控，只判 `行["图片ID"]`，
      //       那两族我们无条件取图是对的，别一并改。
      doorImg: STORE_DOOR_NO_CLIENT.includes(ctx.tenantName) ? '' : l.image_url || '',
      OrderID: lineNoOf(l),
      basicInfo: basicInfoText(l, engine),
      lockImg: lineLockImage(l),
      doorsheet: doorsheetText(l, engine),
      doorframe: doorframeText(l, engine),
      windows: windowsText(l, engine),
      remark: produceRemark(l),
    }
  }

  function productionProduces(): Record<string, unknown>[] {
    return orderedLines(true).map((l) => productionRow(l, 'B'))
  }

  // 生产单定制（product2/product3 模板，table.field=oldSheet）。
  // 原版数据形状（11759/11994）：**每个订单行一个数据对象**，外层字段平铺（material/size/color/…），
  // 表格数据嵌在 `oldSheet:[{doorsheet,doorframe,windows,doorImg}]`。整份数据是对象数组（每行一页）。
  // 调用方 `_0x283867` 直接把数组传给 hiprint（不是 `{oldSheet: rows}`）。
  // 原版 size 赋的是**数组**，hiprint 按 `String()` 渲染 → 实际打印为逗号连接（已实测）。
  //   平开 `_0x34f4ac`：[门洞高*门洞宽*墙厚, 亮窗高：{lw}(钻石→`*{lw}`), 吊脚：{jiao}]
  //   吊趟 `_0x192067`：[门洞高*门洞宽*墙厚, 总高{lw}[*{n}格]]（**无吊脚**）
  function oldSheetSize(l: Line): string {
    const dims = [l.door_height, l.door_width, l.wall_thickness].filter((v) => v && v !== 0)
    const items: string[] = []
    if (dims.length) items.push(dims.join('*'))
    if (l.light_window_height) {
      if (l.line_type === 'diao') items.push(`总高${l.light_window_height}${l.light_window_count > 0 ? `*${l.light_window_count}格` : ''}`)
      else items.push(isDiamond(l) ? `*${l.light_window_height}` : `亮窗高：${l.light_window_height}`)
    }
    if (l.line_type !== 'diao' && l.jiao) items.push(`吊脚：${l.jiao}`)
    if (l.hole_size && String(l.hole_size).trim()) items.unshift(String(l.hole_size))
    return items.join(',')
  }

  // oldSheet 行的 glass 列（原版三分支，平开/吊趟第三支不同）：
  //   底无面有 → `{面玻}*单玻`；双无 → `无`；否则 平开 `{面玻}+{底玻}*{厚}` / 吊趟 `面:{面玻}-底:{底玻}`
  function oldSheetGlass(l: Line): string {
    const bRaw = l.bottom_glass || ''
    const fRaw = l.face_glass || ''
    if (!bRaw && !fRaw && !l.glass_thickness) return ''
    // 同 basicInfo：严格判「无」，空串不算（原版三分支出处同上）
    const bottomNone = bRaw === '无'
    const faceNone = fRaw === '无'
    if (bottomNone && !faceNone) return `${fRaw}*单玻`
    if (bottomNone && faceNone) return '无'
    return l.line_type === 'diao' ? `面:${fRaw}-底:${bRaw}` : `${fRaw}+${bRaw}*${l.glass_thickness || ''}`
  }

  function oldSheetProduce(l: Line): Record<string, unknown> {
    const dir = l.direction || ''
    // 原版 lockway：平开 = 套线种类 + 开向；吊趟 = 型材含「哑口套/门套」则空，否则 开向+扇数（无「开向:」前缀、无套线）
    const lockway = l.line_type === 'diao'
      ? (/哑口套|门套/.test(l.profile || '') ? '' : `${dir}${l.fans || ''}`)
      : `${l.casing || ''}${dir}`
    return {
      client: ctx.order.client_name || '',
      material: l.profile,
      qrcode: String(lineNoOf(l)),
      orderID: lineNoOf(l),
      maker: ctx.maker || '',
      lockImg: lineLockImage(l),
      lockway,
      color: l.color,
      glass: oldSheetGlass(l),
      size: oldSheetSize(l),
      address: l.install_address || '',
      remark: oldSheetRemark(l),
      quantity: l.quantity,
      doorImg: l.image_url || '',
      oldSheet: [
        {
          doorsheet: doorsheetText(l, 'D'),
          doorframe: doorframeText(l, 'D'),
          windows: windowsText(l, 'D'),
          doorImg: l.image_url || '',
        },
      ],
    }
  }

  // 原版 product3 双联（`_0x1ebfe1`）：两行合一张，第二行所有键加 "1" 后缀（含 oldSheet1）；奇数行原样。
  function pairRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = []
    for (let i = 0; i < rows.length; i += 2) {
      const a = rows[i]
      const b = rows[i + 1]
      if (!b) {
        out.push(a)
        continue
      }
      const r: Record<string, unknown> = { ...a }
      for (const k of Object.keys(b)) r[`${k}1`] = b[k]
      out.push(r)
    }
    return out
  }

  function oldSheetProduces(paired = false): Record<string, unknown>[] {
    const rows = orderedLines(true).map(oldSheetProduce)
    return paired ? pairRows(rows) : rows
  }

  // product1（生产单1）：尺寸列从算料部件按名取值。映射（旧版 12318-12337）：
  //   sheetHeigth=光企高、sheetWidth=上下方、frameHeigth=门框高、kouWidth=扣板宽、kouHeigth=扣板高、kouThickness=扣板厚；
  //   glassSize=玻璃宽x玻璃高；doorSize=门洞高x门洞宽(+吊脚/亮窗总高/数量/洞尺)。部件缺失保持空串。
  function product1Produces(): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = []
    for (const l of orderedLines(true)) {
      // 原版 product1（mode 7，`calculateReceiptForCustomed`）：**平开走 product1 形状行、吊趟走标准生产单形状行**。
      // 证据：ping 块以 `data:_0x4495e3`（product1 键集）收尾 @568278，紧随的 diao 循环以 `data:_0x1239ce` 收尾 @587825，
      // 而 `_0x1239ce` 正是 C吊 producer 用的同一对象（其 doorsheet 写于 @581334）。故吊趟用引擎 C 产标准形状。
      if (l.line_type === 'diao') {
        rows.push(productionRow(l, 'C'))
        continue
      }
      // 引擎P1（平开）
      const parts = computeParts(l, 'P1').filter((p) => p && p.materialName)
      // 原版（@569700）走**部件遍历**、命中即赋值（同名多次=后者覆盖）
      const val = (name: string) => {
        // 原版 @569300 是「关键词数组 forEach → `Object.entries(parts).filter((([t]) => t.includes(关键词)))`」，
        // `t` 是部件 **KEY**；这里同样按 KEY 匹配（显示名不参与）。
        const p = parts.filter((x) => pk(x) === name || pk(x).includes(name)).pop()
        return p && !isNaN(Number(p.result)) ? Number(p.result) : 0
      }
      const s = (v: number) => (v ? String(v) : '')
      let glassH = 0
      let glassW = 0
      for (const p of parts) {
        const n = pk(p) // 同上：原版读 KEY
        const v = p.result && !isNaN(Number(p.result)) ? Number(p.result) : 0
        if (n.includes('玻璃高')) glassH = v
        if (n.includes('玻璃宽')) glassW = v
      }
      // 原版 product1 的部件关键词清单（@569290 `_0x1389a5`，逐字 15 项）；
      // 「部件遍历体内的语句是否被执行」= 是否存在部件命中其中任一关键词（见 `kouHeigth`）。
      const anyKwHit = parts.some((p) => PRODUCT1_KW.some((k) => pk(p).includes(k)))
      // 门框（原版）：门框高/宽 先赋，前框高→`前`+(前框高+前包加长)，后框高/宽 以 `<br>后` 追加
      let frameHeigth = s(val('门框高'))
      let frameWidth = s(val('门框宽'))
      const qianH = val('前框高')
      const qianW = val('前框宽')
      const houH = val('后框高')
      const houW = val('后框宽')
      if (qianH) frameHeigth = `前${qianH + (l.front_casing_add || 0)}`
      if (qianW) frameWidth = `前${qianW}`
      if (houW) frameWidth = `${frameWidth}<br>后${houW}`
      if (houH) frameHeigth = `${frameHeigth}<br>后${houH}`
      // sheetWidth：**只有 上下方**。
      // 原版 @570381 里确实还有两支 `Number(_0x55389d)>0 && (sheetWidth += "<br>封板宽"+…)` /
      // `Number(_0x41a723)>0 && (sheetHeight += "<br>封板高"+…)`，但 `_0x55389d`/`_0x41a723` 由
      // 赋值分支 `e===封板宽` / `e===封板高` 写入，而 **`e` 只遍历关键词数组 `_0x1389a5`，
      // 数组里是 `"封板"`（无宽/高）** ⇒ 两个分支**恒为死代码**，原版永不输出「封板宽/封板高」。
      // 我们原先会在 KEY 含「封板宽」时追加，属**多输出**，已去掉。
      const sheetWidth = s(val('上下方'))
      // doorSize：门洞高x门洞宽；吊脚>0 追加，**否则**亮窗总高>0 追加；数量>1 追加；洞尺前置
      let doorSize = `${l.door_height || 0}x${l.door_width || 0}`
      if (l.jiao > 0) doorSize += `x${l.jiao}`
      else if (l.light_window_height > 0) doorSize += `x${l.light_window_height}`
      if (l.quantity > 1) doorSize += `<br>数量:${l.quantity}`
      if (l.hole_size && String(l.hole_size).trim()) doorSize = `${l.hole_size}<br>${doorSize}`
      rows.push({
        client: ctx.order.client_name || '',
        OrderID: lineNoOf(l),
        goods: l.profile,
        color: l.color,
        lockway: l.direction || '', // 原版：**原始开向**（无扇数、无套线前缀）
        doorSize,
        glassSize: `${glassH}x${glassW}`, // 原版顺序是 玻璃高 x 玻璃宽
        thickness: l.wall_thickness ? String(l.wall_thickness) : '',
        sheetHeigth: s(val('光企高')),
        sheetWidth,
        frameHeigth,
        frameWidth,
        // 原版：晟斐门窗厂特判 —— `kouHeigth = 套线种类`，且 `kouWidth` 不再赋值（两个常规赋值都在 else 分支里）
        // 晟斐门窗厂特判（原版 @569254）：有「图片ID」时 `kouWidth` 取**行图片**
        //   `if (租户==='晟斐门窗厂' && 行.图片ID) try{ const e=await getImage(行.图片ID); e && (kouWidth=e) }catch{}`
        // 我们的行图片由 `hydrateRowImages` 预先水合到 `l.image_url`，故同步取它即可（取不到仍为空串）。
        kouWidth: STORE_SHENGFEI === ctx.tenantName ? (l.image_id && l.image_url) || '' : s(val('扣板宽')),
        // ⚠️ 原版这一句挂在**部件遍历体内**（@570381，且**没有 `&& l` 门控**）：
        //   `"晟斐门窗厂" === 租户 ? (kouHeigth = 行["套线种类"]) : (扣板高→…, 扣板宽→…)`
        //   ⇒ 只有「至少有一个部件的 KEY 命中 15 个关键词之一」时才会被赋值，
        //     一个都没命中时保持初始空串（我们用 `anyKwHit` 表达同一条件）。
        kouHeigth: STORE_SHENGFEI === ctx.tenantName ? (anyKwHit ? l.casing || '' : '') : s(val('扣板高')),
        kouThickness: s(val('扣板厚')),
        // 原版 product1 remark = [五金, 单双丁(≠正常), 备注, 安装地址].join("<br>") + 加配（**无轨道种类、无墙型**）
        remark: (() => {
          const ding = l.double_ding && l.double_ding !== '正常' ? l.double_ding : null
          let r = [l.hardware || null, ding, l.remark || null, l.install_address || null].filter(Boolean).join('<br>')
          const add = markupNames(l)
          if (add) r = r ? `${r}<br>加配：${add}` : `加配：${add}`
          return appendAccessory(r, l)
        })(),
      })
    }
    return rows
  }

  // 按模板**实际字段族**（而非 mode 名）分发数据：product2/3 是 oldSheet、
  // product4/10 是标签版式，按 mode 名判断会分错。key=null 表示 payload 即 data 本身。
  function templatePayload(tpl: unknown, _mode?: string, forPreview = false): { key: string | null; data: unknown; imgFields?: string[]; extra?: Record<string, unknown>; wrap?: boolean } {
    if (extractTableColumns(tpl, 'produces').length) {
      // `produces` 表被三族模板共用（product / product1 / glass），**按列特征**判别数据源，
      // 而不是按 mode 名 —— 否则模板改名或新增会静默喂错形状。
      //   ① 含 product1 专有列（doorSize/glassSize/sheetHeigth/kouWidth…）→ product1 尺寸列数据源
      //   ② 含 glass 特征（有 door/client 但**无 doorframe/windows**）→ 玻璃合片单数据源（引擎A）
      //   ③ 其余 → 生产单数据源（引擎B）
      const cols = new Set(extractTableColumns(tpl, 'produces').map((c) => c.field))
      const isProduct1 = ['doorSize', 'glassSize', 'sheetHeigth', 'kouWidth'].some((f) => cols.has(f))
      const isGlass = !cols.has('doorframe') && !cols.has('windows') && cols.has('door') && cols.has('client')
      if (isProduct1) return { key: 'produces', data: product1Produces() }
      return { key: 'produces', data: isGlass ? glassProduces() : productionProduces(), imgFields: ['doorImg', 'lockImg'] }
    }
    // 原版 glassHole 载荷：`[{ date, glassInfoList }]`（date 在表格外，绑顶层）
    if (extractTableColumns(tpl, 'glassInfoList').length)
      return { key: 'glassInfoList', data: glassInfoProduces(), imgFields: ['doorImg'], extra: { date: ctx.today }, wrap: true }
    // 原版 product2/3 载荷是**对象数组**（每行一页），非 `{oldSheet: rows}`；
    // product3（双联）：模板同时有 `oldSheet` 与 `oldSheet1` 两张表 —— 按此判别，不依赖 mode 名。
    if (extractTableColumns(tpl, 'oldSheet').length)
      return { key: null, data: oldSheetProduces(extractTableColumns(tpl, 'oldSheet1').length > 0), imgFields: ['doorImg'] }
    if (extractTableColumns(tpl, 'receipt').length) {
      // 回执族三张模板共用载荷，**brand 后缀**按列特征区分（不按 mode 名）：
      //   有 `payment` 列 → ReceiptList「订货清单」；有 `profile2` 列 → receipt「回执单」；其余 → FinalReceipt「收据单」
      const rc = new Set(extractTableColumns(tpl, 'receipt').map((c) => c.field))
      const suffix = rc.has('payment') ? '订货清单' : rc.has('profile2') ? '回执单' : '收据单'
      return { key: null, data: receiptPrintData(suffix), wrap: true }
    }
    // 无 table 的独立版式（标签）：product10 有 `GlassSize` 字段、lable 有 `qrcode`/`package` —— 按字段判别
    const hasGlassSize = JSON.stringify(tpl).includes('"GlassSize"')
    if (hasGlassSize) {
      const rows = labelRows('product10')
      // 原版：预览用分组版、打印用未分组版（自身不一致，按原样复刻）
      return { key: null, data: forPreview ? groupProduct10(rows) : rows }
    }
    return { key: null, data: labelRows('lable') }
  }
  return {
    // 单行文本工具（Hui 的表格单元格也在用）
    lineLockImage,
    casingAmountOf,
    // 三类单据载荷
    receiptPrintData,
    labelRows,
    groupProduct10,
    glassProduces,
    glassInfoProduces,
    productionProduces,
    oldSheetProduces,
    product1Produces,
    extractTableColumns,
    templatePayload,
    // 分发辅助
    orderedLines,
  }
}
