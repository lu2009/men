// 算料引擎：把「公式 parts → 打印/表格用的部件数组」这段从 `Hui.vue` 整体搬出，
// 供 Hui（页面表格）与 Home（批量打印）共用同一份实现 —— 两边对同一张订单必须算出同一批部件，
// 否则「页面上看到的料」与「打出来的料」会变成两套。
//
// 与原 Hui.vue 的差别只有一处：**`formulas` 由参数传入**（原先是组件 ref），其余逐字未动。
// `partsCache` 留在模块级：它以 `Line` 对象身份为键，放进工厂会随上下文重建而失效。
import type { FormulaDto } from '../api/types'
import type { Dimensions, PartsMap } from './formulaEngine'
import { evalForward } from './formulaEngine'
import type { MarkupItem } from './markupLines'

export interface PartPreview {
  key: string
  materialName: string
  quantity: number
  result: number
}

/**
 * 取部件的 **KEY** —— 旧版一切「关键词匹配 / 精确取件 / 含单玻判定」读的都是它，
 * 只有**显示名**才用 `materialName`。KEY 与 materialName 不等是常态，见
 * `docs/2026-09-15-parts-key-vs-materialname.md`。
 *
 * 历史订单的 `l.parts` 是**持久化**的算料结果，早期只存了 materialName，故回退到它以免炸。
 */
export const pk = (p: { key?: string; materialName?: string }) => p.key || p.materialName || ''

export const round2 = (v: number) => Math.round(v * 100) / 100

export interface Line {
  id: number | null
  line_type: 'ping' | 'diao'
  profile: string
  color: string
  direction: string
  fans: string
  track: string
  casing: string
  hardware: string
  bottom_glass: string
  face_glass: string
  glass_thickness: string
  door_width: number
  door_height: number
  light_window_height: number
  wall_thickness: number
  jiao: number
  mother_door_width: number
  quantity: number
  unit_price: number
  price_type: string
  discount: number
  square: number
  custom_square: number
  other_fee: number
  casing_price: number
  casing_amount: number
  amount: number
  parts: PartPreview[]
  markup: MarkupItem[]
  formula_id: number | null
  remark: string
  install_address: string
  open_img: string
  edge_seal_count: number | null
  seal_board_height: number
  track_length: number
  front_casing_add: number | null
  back_casing_add: number | null
  double_ding: string | null
  light_window_count: number
  image_id: string | null
  image_url: string | null
  progress: string
  hole_size: string
  isSelected?: boolean
}

export type EngineId = 'A' | 'B' | 'D' | 'P1' | 'C' | 'L1' | 'L2'

export const partsCache = new WeakMap<Line, Map<EngineId, { sig: string; val: PartPreview[] }>>()

export function createPartsEngine(formulas: FormulaDto[]) {
  // 取洞尺减法减量（原版 resetSize / TaoDong.SingleDong / TaoDong.DubleDong），来自公式级数据（extra）。
  // 兼容 {width,height} 与 {宽,高} 两种键；无减量返回 null。
  // 洞尺减量（原版）：改算料尺寸 w/h（有亮窗改 h1），不写回行。
  //   洞尺 → 公式 resetSize.{width,height}；单包/双包洞尺 → 公式 TaoDong.SingleDong/DubleDong.{宽减,高减}；净尺/空 → 零调整。
  function holeDeduction(l: Line): { dw: number; dh: number } | null {
    const extra = (formulaOf(l)?.extra ?? {}) as Record<string, unknown>
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    const node = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === 'object' ? (v as Record<string, unknown>) : null
    // DB 实际键：resetSize.{width,height}；TaoDong.{SingleDong,DubleDong}.{宽减,高减}（大写，兼容小写）
    const tao = (extra.TaoDong ?? extra.taoDong) as Record<string, unknown> | undefined
    switch ((l.hole_size || '').trim()) {
      case '洞尺': {
        const r = node(extra.resetSize ?? extra.ResetSize)
        return r ? { dw: num(r.width ?? r['宽']), dh: num(r.height ?? r['高']) } : null
      }
      case '单包洞尺': {
        const r = node(tao?.SingleDong ?? tao?.singleDong)
        return r ? { dw: num(r['宽减']), dh: num(r['高减']) } : null
      }
      case '双包洞尺': {
        const r = node(tao?.DubleDong ?? tao?.dubleDong)
        return r ? { dw: num(r['宽减']), dh: num(r['高减']) } : null
      }
      default:
        return null // 净尺 / 空 → 零调整
    }
  }
  // 墙型减量（原版 swingWall，公式级）：按行「单双丁」取减量——宽减 w、高减 h1(有亮窗)/h。
  function swingWallDeduction(l: Line, extra: Record<string, unknown>): { dw: number; dh: number } | null {
    const sw = extra.swingWall as { UpWall?: unknown; DoubleWall?: unknown; SingleWall?: unknown } | undefined
    const dd = String(l.double_ding ?? '').trim()
    if (!sw || !dd || dd === '正常') return null
    const n = (v: unknown) => Number(v) || 0
    let dw = 0
    let dh = 0
    switch (dd) {
      case '单丁墙': dw = n(sw.SingleWall); break
      case '双丁墙': dw = n(sw.DoubleWall); break
      case '上丁墙': dh = n(sw.UpWall); break
      case '上丁加单丁': dw = n(sw.SingleWall); dh = n(sw.UpWall); break
      case '上丁加双丁': dw = n(sw.DoubleWall); dh = n(sw.UpWall); break
      default: return null
    }
    return dw || dh ? { dw, dh } : null
  }
  function dimsOf(l: Line): Dimensions {
    const base = {
      w: l.door_width || 0,
      h: l.door_height || 0,
      h1: l.light_window_height || 0,
      t: l.wall_thickness || 0,
      j: l.jiao || 0,
      s: l.mother_door_width || 0,
    }
    // 洞尺减法（原版）：改 w / h，有亮窗(h1>h)时改 h1 不改 h；不算料不写回行字段。
    const d = holeDeduction(l)
    if (d && (d.dw || d.dh)) {
      base.w -= d.dw
      if (base.h1 > base.h) base.h1 -= d.dh
      else base.h -= d.dh
    }
    // 墙型减量（原版 swingWall）：按「单双丁」减 w/h（同样 h1>h 时改 h1）。
    const sw = swingWallDeduction(l, (formulaOf(l)?.extra ?? {}) as Record<string, unknown>)
    if (sw) {
      base.w -= sw.dw
      if (base.h1 > base.h) base.h1 -= sw.dh
      else base.h -= sw.dh
    }
    return base
  }

  function formulaOf(l: Line): FormulaDto | undefined {
    if (l.formula_id == null) return undefined
    return formulas.find((f) => f.id === l.formula_id)
  }

  /** 公式类型是否钻石型（淋浴房 diamondling）。 */
  function isDiamond(l: Line): boolean {
    const ft = formulaOf(l)?.formula_type ?? ''
    return ft === 'diamondling' || ft === 'diamond'
  }
  // 边封数增量（原版 widthIncrement，公式级）：边封数≠2 时，
  //   玻璃宽增量 = SheetIncrement×(2-边封数)，轨道增量 = TrackIncrement×(2-边封数)。
  //   应用：玻璃宽增量/扇数N → 加「扇数…上下方」的 v；轨道增量 → 减 轨道件(上滑/上轨/下滑/盖板)的 v。
  function applyWidthIncrement(parts: PartsMap, l: Line, f: FormulaDto) {
    // 原版 @389229（增量计算） + @390860/@391900（施加）：
    //   dw = 边封数!==2 && SheetIncrement!==0 ? SheetIncrement*(2-边封数) : 0
    //   dt = 边封数!==2 && TrackIncrement!==0 ? TrackIncrement*(2-边封数) : 0
    //   若 (dw||dt) 且 边封数!==2：从 扇数 里 match(/(\d+)扇/) 取 q →
    //       x = dw / q       （**只有 Sheet 增量除以扇数**）
    //       dt 原样
    const wi = (f.extra as { widthIncrement?: { SheetIncrement?: unknown; TrackIncrement?: unknown } } | undefined)?.widthIncrement
    const sheetInc = Number(wi?.SheetIncrement) || 0
    const trackInc = Number(wi?.TrackIncrement) || 0
    const n = Number(l.edge_seal_count) || 0
    const dw = n !== 2 && sheetInc !== 0 ? sheetInc * (2 - n) : 0
    const dt = n !== 2 && trackInc !== 0 ? trackInc * (2 - n) : 0
    const fans = l.fans || ''
    let x = 0
    let dtv = 0
    if ((dw !== 0 || dt !== 0) && Number(l.edge_seal_count) !== 2) {
      const m = fans.match(/(\d+)扇/)
      if (m) {
        const q = Number(m[1])
        if (dw !== 0) x = dw / q
        if (dt !== 0) dtv = dt
      }
    }
    // `a` 是状态位：**只有「上下方」被加过 x 之后**，封板宽与轨道件的减量才生效
    let a = 0
    const sbh = Number(l.seal_board_height) || 0
    const prefix = fans.substring(0, 2)
    for (const [key, p] of Object.entries(parts)) {
      if (key.includes(fans) && key.includes('上下方')) {
        p.v = (Number(p.v) || 0) + x
        a = 1
      }
      if (key.includes(fans) && key.includes('封板') && sbh > 0) {
        // ⚠️ 「封板高 → v = 封板高 - v」与「玻璃高 → v = 封板高 + v」两处 v 变换**只在 applyPartState 里做**，
        //    此处不重复（否则 `sbh - (sbh - v)` 会抵消、`sbh + sbh + v` 会翻倍）。
        if (key.includes('封板宽') && a === 1) p.v = (Number(p.v) || 0) - x
      }
      if (prefix.length === 2 && key.includes(prefix) && !key.includes('扇') && !key.includes('扣板') && a === 1 && dtv > 0 &&
          /上滑|上轨|下滑|左右盖板|上下盖板|轨道盖板/.test(key)) {
        p.v = (Number(p.v) || 0) - dtv
      }
      // 原版另有一处独立判断：门洞高 < 亮窗总高 的「上横」同样减 dt
      if (key.includes('上横') && l.door_height < l.light_window_height && a === 1 && dtv > 0) {
        p.v = (Number(p.v) || 0) - dtv
      }
    }
  }

  // 铰链减尺（原版 hinge，公式级）：行「五金」各项直接匹配 hinge 键（取第一个命中的）→
  //   hinge[项].{上下方减尺, 光企减尺寸} 取负后加到「上下方」/「光企(非亮窗)」部件的 v。
  function applyHinge(parts: PartsMap, l: Line, f: FormulaDto) {
    // 原版（@484816 等四处）：`行.五金` 若含 `_` 先按 `_` 拆分，trim 后**筛出含「合页」的项**，
    // **只取第一个**（多个时原版弹确认框），拿它去 `公式.hinge` 查配置：
    //   上下方减尺 / 光企减尺寸 均**取负**后加到对应部件的 v。
    // 命中不到配置时原版弹「合页匹配失败」确认框（不阻断）。找不到含「合页」的项 → 整体跳过。
    const hinge = (f.extra as { hinge?: Record<string, Record<string, unknown>> } | undefined)?.hinge
    if (!hinge || typeof hinge !== 'object') return
    const hw = String(l.hardware || '')
    const items = (hw.includes('_') ? hw.split('_') : hw ? [hw] : []).map((x) => x.trim())
    const hit = items.find((it) => it.includes('合页'))
    if (!hit) return
    const cfg = hinge[hit]
    if (!cfg) return
    const dw = -(Number(cfg['上下方减尺']) || 0)
    const dh = -(Number(cfg['光企减尺寸']) || 0)
    for (const [key, p] of Object.entries(parts)) {
      if (key.includes('上下方') && dw) p.v = (Number(p.v) || 0) + dw
      // 原版匹配的是「光企高」而非任意含「光企」的件
      if (key.includes('光企高') && !key.includes('亮窗') && dh) p.v = (Number(p.v) || 0) + dh
    }
  }

  // —— 部件激活（原版模型：`state` 服务端起手为 **false**，按固定顺序逐条规则置 true/false，
  //    组装时只收 `state===true`）——
  // 规则顺序 = 源码顺序，**后面的覆盖前面的**。清单见 docs/2026-09-10-template-field-audit.md §30。
  //   平开（B平 @485198–489281）：① 单玻替换 ② 双玻 ③ v调整+兜底块 ④ eval(<0) ⑤ 二次 eval ⑥ 扣板厚联动
  //   吊趟（B吊 @500279–507590）：① 单玻替换 ② 活扇块 ③ 39 条主规则 ④ eval(<0) ⑤ 二次 eval(<1 && !滑 && !单轨) ⑥ 联动
  // 算料引擎 id（原版每个打印入口各跑一套引擎，规则不同、**结果可能不同**）：
  //   A=玻璃合片单(A平/A吊)  B=生产单(B平/B吊)  D=生产单定制(D平/D吊)  P1=平开门定制(平开)  C=平开门定制(吊趟)
  // 规则族见 docs/2026-09-10-template-field-audit.md §52。
  function applyPartState(parts: PartsMap, l: Line, engine: EngineId = 'B'): void {
    const keys = Object.keys(parts)
    const diao = l.line_type === 'diao'
    const fans = (l.fans || '').trim()
    if (diao && !fans) return // 原版吊趟：无扇数直接 continue
    // ⚠️ **严格判字面量「无」，空串不算「无」** —— 旧版全篇 52 处底/面玻判定都是 `"无" === 行["底玻"]`，
    //    且**没有任何**「空值回落成无」的写法（全篇 `||"无"` 的 34 个命中全是布尔或，后面紧跟 `===`）。
    //    这里 `|| ''` 只为挡 undefined；正常流程下底玻/面玻恒有值（新建行默认 磨砂/白玻，见 newLine）。
    const bRaw = l.bottom_glass || ''
    const fRaw = l.face_glass || ''
    const wuBo = bRaw === '无' || fRaw === '无' // 单玻
    const shuangBo = bRaw !== '无' && fRaw !== '无' // 双玻
    const wall = Number(l.wall_thickness) || 0
    const lwH = Number(l.light_window_height) || 0
    const doorH = Number(l.door_height) || 0
    const lwN = Number(l.light_window_count) || 0
    const sbh = Number(l.seal_board_height) || 0
    const dir = l.direction || ''
    const track = l.track || ''
    const casing = l.casing || ''
    const set = (k: string, v: boolean) => {
      const p = parts[k]
      if (p) p.state = v
    }

    // ① 单玻替换（原版 B平 @485365 / B吊 @500608）：给「玻璃宽/高」找 `+单玻` 变体件，
    //    有变体就切过去，没有则本体照常启用。**原版这里没有 `亮窗` 排除** ——
    //    所以平开的 `上亮窗玻璃宽/高` 同样会被启用（用户实测：平开有亮窗玻璃件，命名 `上亮*`）。
    // L2（product10 移门）是特例：它有独立的 ① 块，且是**无条件**替换、**带** `亮窗`/`LiangChuang` 排除
    //   （`LiangChuang` 全文件仅此一处，§13）。先跑它，再走通用逻辑。
    if (engine === 'L2') {
      for (const k of keys) {
        if (!k.includes('亮窗') && !k.includes('LiangChuang') && (k.includes('玻璃宽') || k.includes('玻璃高')) && !k.includes('单玻')) {
          const alt = `${k}单玻`
          if (parts[alt]) {
            set(k, false)
            set(alt, true)
          } else set(k, true)
        }
      }
    }
    // 其余吊趟引擎**没有独立的单玻替换块** —— 等价逻辑在主规则块里（Q3.1/Q3.2，用 `扇数+'玻璃'`）。
    if (wuBo && !diao) {
      for (const k of keys) {
        if ((k.includes('玻璃宽') || k.includes('玻璃高')) && !k.includes('单玻')) {
          const alt = `${k}单玻`
          if (parts[alt]) {
            set(k, false)
            set(alt, true)
          } else set(k, true)
        }
      }
    }
    // ② 双玻（原版 B平 @485542 / B吊）：含「单玻」的禁用；含「玻璃」且非单玻的启用。**同样无 `亮窗` 排除**
    if (shuangBo && !diao) {
      for (const k of keys) {
        if (k.includes('单玻')) set(k, false)
        if (!k.includes('单玻') && k.includes('玻璃')) set(k, true)
      }
    }

    if (diao) {
      // ③ 活扇块。**两套变体**（原文逐字，整块门控都是 `扇数.includes('活')`）：
      //   A吊（@468374）：① `含(扇数)&&含'玻璃宽'` ② `含'玻璃高'&&track===行.轨道种类&&含(扇数)` ③ `亮窗总高>0&&含'玻璃'`
      //   B吊（@500279）/D吊/C吊：① `含'活'&&!含'玻璃高'` ② 同上 ③ `亮窗总高>0&&(含'玻璃'||含'亮窗')`
      if (fans.includes('活')) {
        const aDiao = engine === 'A' // A吊（G吊 我们未实现）
        for (const k of keys) {
          if (aDiao) {
            if (k.includes(fans) && k.includes('玻璃宽')) set(k, true)
            if (lwH > 0 && k.includes('玻璃')) set(k, true)
          } else {
            if (k.includes('活') && !k.includes('玻璃高')) set(k, true)
            if (lwH > 0 && (k.includes('玻璃') || k.includes('亮窗'))) set(k, true)
          }
          if (k.includes('玻璃高') && parts[k].track === track && k.includes(fans)) set(k, true)
        }
      }
      // ④ 主规则块。**三套变体**（§52.5 / §52.5b）：
      //   ③-A `{A吊,G吊}` 9 条 · ③-B `{B吊,D吊}` 39 条 · ③-C `{C吊}` 35 条。
      //   C吊 = B吊 − `固定` / `移动` / `收口+单轨2扇`（另「包高」写法等价）。
      const richDiao = engine !== 'A'
      const cDiao = engine === 'C'
      const r = fans.substring(0, 2)
      const lwTag = lwN > 0 ? `${lwN}格亮窗` : ''
      // §30.3 Q3.1/Q3.2：吊趟的单玻变体判定（`e` = 扇数+'玻璃'；`t` = 是否存在含 e 且含「单玻」的件）
      const eGlass = `${fans}玻璃`
      const hasSingleVariant = keys.some((k) => k.includes(eGlass) && k.includes('单玻'))
      const isSingleGlass = bRaw === '无' || fRaw === '无'
      const noLive = !fans.includes('活')
      // B/D/C 的 ① 是 `if (活扇) {活扇块} else {主规则块}` —— 活扇行**不跑**主规则块
      const runMain = !(richDiao && !noLive)
      // 光企/勾企/合页/锁 的 track 门控（原版 `part.track === 行.轨道种类`）。
      // 原版是**严格相等**，于是当公式里同一扇数只有一个变体（track 只是个标签）而用户偏巧选了
      // 另一个轨道种类（常见于下拉里的历史残留值）时，这些件会**整个消失**、什么都算不出来。
      // 这里放宽为「**该关键词下若有 track 匹配的件，就只取匹配的；一个都没匹配上，则退回该扇数的全部候选**」，
      // 既保留原版「多轨道变体时按轨道种类选」的语义，又保证**任何轨道种类都能算出结果**。
      const trackMatched = (kw: string) =>
        keys.some((k) => k.includes(kw) && k.includes(fans) && parts[k].track === track)
      const trackOk = (k: string, kw: string) => !trackMatched(kw) || parts[k].track === track
      for (const k of keys) {
        const p = parts[k]
        if (!runMain) continue
        if (hasSingleVariant && !isSingleGlass && k.includes(eGlass) && k.includes('单玻')) {
          set(k, false)
          continue
        }
        if (noLive && isSingleGlass && hasSingleVariant && k.includes(eGlass)) {
          set(k, k.includes('单玻'))
          continue
        }
        if (k.includes(fans) && k.includes('方')) set(k, true)
        if (richDiao) {
          if (!cDiao && k.includes(fans) && k.includes('固定')) set(k, true)
          if (!cDiao && k.includes(fans) && k.includes('移动')) set(k, true)
          if (k.includes(fans) && k.includes('封板') && sbh > 0) {
            set(k, true)
            if (k.includes('封板高')) p.v = sbh - (Number(p.v) || 0)
          }
        }
        if (k.includes(fans) && k.includes('玻璃')) {
          set(k, true)
          if (k.includes('玻璃高') && sbh > 0) p.v = sbh + (Number(p.v) || 0)
        }
        if (richDiao) {
          if (k.includes(fans) && k.includes('盖板')) set(k, true)
          if (r.length === 2 && k.includes(r) && !k.includes('扇') && !k.includes('扣板')) set(k, true)
        }
        if (k.includes('光企') && k.includes(fans) && trackOk(k, '光企')) set(k, true)
        if (k.includes('勾企') && k.includes(fans) && trackOk(k, '勾企')) set(k, true)
        if (k.includes('合页') && k.includes(fans) && trackOk(k, '合页')) set(k, true)
        if (k.includes('锁') && k.includes(fans) && trackOk(k, '锁')) set(k, true)
        // 以下规则族（边封/上横/包边/墙厚两套/收口）**只有 ③-B、③-C 有**：
        // ③-A（A吊/G吊，§52.5）只有 9 条 —— 方·上下方·玻璃·光企·勾企·合页·锁·亮窗数量。
        if (richDiao) {
          if (k.includes('边封') && doorH > lwH && k.includes('无')) set(k, true)
          if (k.includes('上横') && doorH < lwH) set(k, true)
          if (k.includes('边封') && doorH < lwH && !k.includes('无')) set(k, true)
          if (k.includes('包宽') && p.track === casing) set(k, true)
          // 包高：按**部件自身 formula** 是否含 `h1+` 分两支
          if (k.includes('包高') && !p.formula.includes('h1+') && p.track === casing && lwH < doorH) set(k, true)
          if (k.includes('包高') && p.formula.includes('h1+') && p.track === casing && lwH > doorH) set(k, true)
          if (wall > 0 && lwH === 0) {
            if (k.includes('F槽宽')) set(k, true)
            if (k.includes('扣板宽')) set(k, true)
            if (k.includes('F槽高') && !k.includes('亮窗')) set(k, true)
            if (k.includes('扣板高') && !k.includes('亮窗')) set(k, true)
            if (k.includes('扣板厚') && k.includes(r) && p.title === '') set(k, true)
            if (k.includes('扣板厚') && k.includes(r) && p.title !== '' && p.track === casing) set(k, true)
          }
          if (wall > 0 && lwH > 0) {
            if (k.includes('F槽宽')) set(k, true)
            if (k.includes('扣板宽')) set(k, true)
            if (k.includes('亮窗F槽高')) set(k, true)
            if (k.includes('亮窗扣板高')) set(k, true)
            if (k.includes('扣板厚') && k.includes(r) && p.title === '') set(k, true)
            if (k.includes('扣板厚') && k.includes(r) && p.title !== '' && p.track === casing) set(k, true)
          }
          if (k.includes('收口')) {
            if (fans.includes('4扇') && !fans.includes('折叠')) set(k, true)
            if (/[3456]扇/.test(fans) && fans.includes('折叠') && !dir.includes('0')) set(k, true)
            if (fans.includes('2轨3扇') || (!cDiao && fans.includes('单轨2扇'))) set(k, true)
          }
        }
        if (lwTag && k.includes(lwTag)) set(k, true)
      }
    } else {
      // ⑤ 平开兜底块。**逐引擎有差异**（§52.7）：
      //   `扣板|压线 → false`：A平/D平/P1平/G平 是「扣板**或压线**」；**B平/L1 只判「扣板」**
      //   `封板/封板高` 规则：B平/D平/P1平/L1 有；**A平/G平 无**
      const pingYaxian = engine === 'A' || engine === 'D' || engine === 'P1'
      const pingSealBoard = engine !== 'A'
      for (const k of keys) {
        const p = parts[k]
        if (k.includes('玻璃宽') || k.includes('玻璃高')) continue
        if (wall > 0) p.state = true
        else if (pingYaxian ? /扣板|压线/.test(k) : k.includes('扣板')) p.state = false
        else p.state = true
        if (pingSealBoard) {
          if (k.includes('封板') && sbh === 0) p.state = false
          if (k.includes('封板高') && sbh > 0) {
            p.state = true
            p.v = sbh - (Number(p.v) || 0)
          }
        }
        // 这条 v 变换各平开引擎都有（§52.7 第三行），且**不带 `includes(扇数)` 门控**
        if (k.includes('玻璃高') && sbh > 0 && !k.includes('亮窗')) p.v = sbh + (Number(p.v) || 0)
      }
    }
    // 平开上亮门控（用户要求，原版无此门控）：无上亮（亮窗总高 ≤ 门洞高）时禁用全部「上亮/压线」件。
    // 原版 state 规则里 `上亮窗玻璃宽 = w-v` 是纯宽公式、不随 h1 归零，所以没填亮窗总高也会漏出
    // `上亮横/上亮窗玻璃宽/压线宽`；`上亮窗玻璃高/压线高 = h1-h-v` 则因负值已被主 eval 关掉。
    if (!diao && lwH <= doorH) {
      for (const k of keys) {
        if (k.includes('上亮') || k.includes('压线')) set(k, false)
      }
    }
  }

  /**
   * 影响算料结果的行字段（缓存签名用）。任一变化都要重算。
   *
   * ⚠️ **凡是 `computePartsUncached` / `dimsOf` 链路读到的行字段，都必须列在这里**，
   * 漏一个就会出现「改了字段但算料结果不变、连点『算料』也救不回来」（缓存命中的是旧值）。
   * 已实测确认漏过并补上的：
   *   - `hole_size`（洞尺）—— `holeDeduction` 按它取公式 `resetSize` 的减尺去改 w/h
   *   - `double_ding`（单/双丁墙体）—— `swingWallDeduction` 按它取公式 `swingWall` 的减尺
   *   - `mother_door_width`—— `dimsOf` 的 `s`（子母门公式要用）
   *   - `light_window_count`—— `applyPartState` 按它定亮窗部件的 state
   */
  function partsSig(l: Line): string {
    return [
      l.formula_id, l.line_type, String(formulaOf(l)?.formula_type ?? ''), l.door_width, l.door_height, l.light_window_height, l.wall_thickness,
      l.jiao, l.track_length, l.bottom_glass, l.face_glass, l.glass_thickness, l.fans, l.direction,
      l.track, l.casing, l.edge_seal_count, l.seal_board_height, l.front_casing_add, l.back_casing_add,
      l.hardware, l.quantity,
      // ↓ 这四个原先漏了（洞尺填了不生效就是这么来的）
      l.hole_size, l.double_ding, l.mother_door_width, l.light_window_count,
    ].join('|')
  }
  // 算料结果缓存：一张单据页会被 17 个模板各取一次数据，逐次重算会明显卡（尤其行多时）。

  /** 按**指定引擎**算料。原版每个打印入口各跑一套引擎（A/B/D/P1/C），**规则不同、结果可能不同**，
   *  所以同一订单行在不同单据上出现的部件集本来就可能不一样 —— 不能共用一份算料结果。
   *  同步实现：公式取自已载入的 `formulas`；公式缺失时回退到 `l.parts`（页面最后一次算料结果）。 */
  function computeParts(l: Line, engine: EngineId = 'B'): PartPreview[] {
    const sig = partsSig(l)
    const hit = partsCache.get(l)?.get(engine)
    if (hit && hit.sig === sig) return hit.val
    const val = computePartsUncached(l, engine)
    let m = partsCache.get(l)
    if (!m) {
      m = new Map()
      partsCache.set(l, m)
    }
    m.set(engine, { sig, val })
    return val
  }

  function computePartsUncached(l: Line, engine: EngineId): PartPreview[] {
    const f = formulaOf(l)
    if (!f) return (l.parts ?? []) as PartPreview[]
    const src = f.parts as PartsMap
    if (!src || typeof src !== 'object' || Array.isArray(src)) return []
    const parts = JSON.parse(JSON.stringify(src)) as PartsMap
    // `_keyOrder` / `挖孔图` / `公式类型` 是**元数据**、不是部件 —— 原版遍历部件时一律跳过
    // （`Diao.deobfuscated.js` @125457/@149959 的 `filter(e => e !== "_keyOrder" && e !== "挖孔图" && e !== "公式类型")`；
    //  `Hui-d088417c.js` @320257 `if ("_keyOrder" === x) return`）。导入原版公式时会带上它们。
    for (const meta of ['_keyOrder', '挖孔图', '公式类型']) {
      delete (parts as unknown as Record<string, unknown>)[meta]
    }
    // ⚠️ 两条公式级减量**各有适用引擎**（§52/§53 引擎普查证实）：
    //   `widthIncrement`：只有 **A吊/B吊/D吊**（平开没有；C吊、G吊 也没有）
    //   `hinge`：只有 **平开**（A平/B平/D平/P1平）；**6 个吊趟引擎一律不读**
    const diaoLine = l.line_type === 'diao'
    if (diaoLine && engine !== 'C') applyWidthIncrement(parts, l, f)
    if (!diaoLine) applyHinge(parts, l, f)
    applyPartState(parts, l, engine) // 按规则定 state（默认 false 起手）
    const dims = dimsOf(l)
    const computed: Record<string, number> = {}
    let kbThickNeg = false
    const diao = l.line_type === 'diao'
    // ⚠️ **必须分两遍**（原版 `needsSecondPass`）：第一遍只算**不含跨部件引用**的部件
    // （`formula` 里没有 `.result`），第二遍才算引用型的。否则像「玻璃高 = 光企高.result - v」
    // 这种在「光企高」之前被求值就会得 0 —— 而且 `jsonb` 不保留键顺序，顺序本来就不可控。
    const secondPass: string[] = []
    // 阈值（原文）：**主 eval**（第一遍，不含 `.result` 的部件）—— 只有 **B吊(@506843)/L2(@396683)**
    //   用 `<1 && !滑 && !单轨`，其余引擎用 `<0`；**第二遍 eval**（含 `.result` 的部件）一律 `<0`。
    const mainLt1 = diao && (engine === 'B' || engine === 'L2')
    const evalOne = (name: string, isSecondPass: boolean): void => {
      const p = parts[name]
      if (!p || !p.formula || !p.state) return
      const r = evalForward(
        p.formula,
        dims,
        (ref: string) => (computed[ref] !== undefined ? String(computed[ref]) : '0'),
        Number(p.v) || 0,
        Number(p.result) || 0,
      )
      computed[name] = r
      // 主 eval 的阈值：B吊/L2 用 `<1 && !滑 && !单轨`；其余用 `<0`。第二遍一律 `<0`。
      const bad = !isSecondPass && mainLt1
        ? r < 1 && !name.includes('滑') && !name.includes('单轨')
        : r < 0
      if (bad) {
        p.state = false
        computed[name] = 0
        if (name.includes('扣板厚')) kbThickNeg = true
      }
    }
    // 第一遍：不含 `.result` 的
    for (const [name, p] of Object.entries(parts)) {
      if (!p.formula || !p.state) continue
      if (p.formula.includes('.result')) {
        secondPass.push(name)
        continue
      }
      evalOne(name, false)
    }
    // 第二遍：引用型的
    for (const name of secondPass) evalOne(name, true)
    // 扣板厚负值联动（§52.7 / 原文 @487868 平开 vs @507050 吊趟）：**两族杀的部件名不同** ——
    //   平开：`名含'扣板' || 名含'压条'`；吊趟：`名含'扣板高' || 名含'扣板宽'`
    const kbKill = diaoLine ? /扣板高|扣板宽/ : /扣板|压条/
    const out = Object.entries(parts)
      .filter(([key, p]) => !!p.formula && p.state && !(kbThickNeg && kbKill.test(key)))
      .map(([key, p]) => ({ key, materialName: p.materialName || key, quantity: p.quantity || 0, result: round2(computed[key] ?? 0) }))
    // 按公式的**部件声明序**重排（`extra._keyOrder` —— **原版自己的字段名**，见 `Diao.deobfuscated.js`
    // @141718 写 / @149913 读）。
    // 必要性：`parts` 落 JSONB 后对象键会被「长度+字节」重排，而原版各打印列（移门外框、全部 windows 列）
    // 直接按 `Object.entries(parts)` 的声明序输出；更要命的是 `applyWidthIncrement` 的状态位 `a`
    // 依赖「{扇数}上下方」是否**先于**轨道件出现 —— 顺序会改变**算出来的数值**（不只显示顺序）。
    // 顺序存成数组（JSONB 保序）故能穿过来。缺 `_keyOrder` 的旧数据保持现状，行为不变。
    // 详见 docs/2026-09-15-parts-order-fidelity.md
    const order = (f.extra as { _keyOrder?: unknown } | undefined)?._keyOrder
    if (Array.isArray(order) && order.length) {
      const rank = new Map(order.map((k, i) => [String(k), i]))
      // 不在声明序里的部件排到最后（`sort` 稳定，保持它们原有的相对次序）
      out.sort((a, b) => (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER))
    }
    return out
  }

  return { formulaOf, isDiamond, dimsOf, computeParts, partsSig }
}
