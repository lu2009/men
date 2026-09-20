/**
 * Progress 订单进度页的**单元格渲染件**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）：`Progress.vue:602-827` —— **连续一段**，
 * 23 个声明（拆分方案里的 **P1**）。段头那三行分区横幅（`// A. 单元格保真`）与段内所有注释
 * **原样搬来**。
 * ⚠️ 注释的保真**没有守卫**：`sliceFn` 从**声明**起切，注释不在任何切片里
 *   ⇒ 它们的保真只有 `git diff` 人工比对一条来源，别拿「守卫绿」当它的证据。
 *
 * 搬迁保真由 `docs/progress-extract-movecheck.mjs` 机核（P1 一条，参照 `f097a9b1`）。
 *
 * ⚠️ **注入 0 项、回传 0 项。** 这 23 个声明只读自己的形参 `r: ProgressRowDto` 与模块级导入
 *    （`h` / `VNodeChild` 类型 / `ProgressRowDto` 类型）—— **一处页面状态都不碰**
 *    （段内零 `ref`/`computed`/`message`/`api` 引用）。所以本文件是**纯模块**：
 *    没有工厂函数、没有 `deps`、没有形参注入。
 *
 * ⚠️ **方案 `task-1-brief.md` 的 Interfaces 有一句实测不成立**：
 *    「`va` 被**模板**用 ⇒ 必须 export 并 import 回 `.vue`」——
 *    实测：`Progress.vue` 的模板（1–322 行）与脚本里，`va` 只出现在**注释**中
 *    （模板 10/55/68 行的说明文 + 脚本 1351/2255/2256 的注释），**没有任何真实调用**；
 *    唯一的调用者是同段的 `progressCell`（已一起搬来）。
 *    ⇒ `va` 照旧 `export`（本块允许的改写只有「加 export」一类，不为它开例外），
 *      但 **`.vue` 不 import 它** —— 导回去就是个死导入（`noUnusedLocals` 会红）。
 *      见 `task-1-report.md`「与简报的偏离 1」。
 *
 * ⚠️ **`.vue` 侧要回接 11 个名字**（其余 12 个只在模块内部互相调用）：
 *    · `progressCell` `remarkCell` `profileColorCell` `glassCell` `fansDirectionCell`
 *      `trackCasingCell` `doorSizeCell` `lightWindowCell` `amountCell`
 *      —— 都被 `columns` 的 `render:` 用（那是 **P6** 的活，本笔仍在页面里）；
 *    · `line` —— 被 `columns` 里五处 `render: (r) => line(r['…'])` 用
 *      （客户/单号/打单人/业务员 + 日期列里的 `line(r['日期'])`）。
 *      ⚠️ **这一条是 `vue-tsc` 抓出来的**：我第一版漏了它（用 `grep` 数使用点时漏报），
 *      `npx vue-tsc --noEmit` 报了 **5 处 `TS2304: Cannot find name 'line'`**。
 *      守卫当时是**绿的** —— 它只管「搬的时候有没有偷偷改」，管不了「搬完接没接上」。
 *      这正是「守卫与 `vue-tsc` 必须成对跑」的活例（见守卫文件头能力边界 2）。
 *      复核改用**真 TS 解析器**遍历标识符引用点（grep 会漏、也会命中注释）。
 *    · `DATE_RE` —— 被 **P2** 的 `latestSegment` 用（同样仍在页面里）。
 */
import { h, type VNodeChild } from 'vue'
import type { ProgressRowDto } from '../api/types'

// ═══════════════════════════════════════════════════════════════════════════
// A. 单元格保真
// ═══════════════════════════════════════════════════════════════════════════
/*
 * 下面这堆 helper 全部对应旧版 `Progress-fb4def35.js` 里的**静态 VNode props 对象**，
 * 类名逐字照抄（旧版 CSS `Progress-4dee25cf.css` 的 `[data-v-95ebc180]` 段）：
 *
 *   `.glass-inputs-container`  `display:flex;flex-direction:column;gap:5px;width:100%`
 *   `.glass-inputs-container2` 同上，但 `gap:-3px`（负值，旧版原样，别"修"）
 *   `.glass-input-group`       `display:flex;align-items:center;gap:4px`
 *   `.glass-input-label`       `font-size:11px;white-space:nowrap;color:#1302fa`（小蓝标签）
 *   `.glass-input`             `flex:1`
 *
 * ⚠️ 别拿 `components/DetailLinesTable.vue` 的 `cCol`/`sub` 直接套 —— 那边是 **Hui 的可编辑表格**，
 *    标签（`型材：`/`底玻：`…）是**每格都写死**的。本页旧版**不是**：
 *      · 「型材/颜色」格**没有任何标签**（表头已经写了）；
 *      · 「玻璃」格的标签是 `数量：`（值取 `数量`，不是玻璃厚）—— 三行只有这一行有标签；
 *      · 「下轨道/套线」的标签是 `.glass-input-group` 的**兄弟节点**，不在组内。
 *    这些都是逐字读出来的（`label:"玻璃"` / `label:"下轨道/套线"` 那几段 render），不是笔误。
 */

/** `div.glass-inputs-container`（纵向，gap 5px）。 */
export const gContainer = (...vs: VNodeChild[]) => h('div', { class: 'glass-inputs-container' }, vs)
/** `div.glass-inputs-container2`（旧版 `gap:-3px`）。 */
export const gContainer2 = (...vs: VNodeChild[]) => h('div', { class: 'glass-inputs-container2' }, vs)
/** `div.glass-input-group`（横排：标签 + 值）。 */
export const gGroup = (...vs: VNodeChild[]) => h('div', { class: 'glass-input-group' }, vs)
/** `div.glass-input-label`（**小蓝标签**，`#1302fa`）。 */
export const gLabel = (text: string) => h('div', { class: 'glass-input-label' }, text)
/** 裸值 `<span>`（旧版格内绝大多数值就是这个，**空就是空 span**，没有 `—`）。 */
export const gSpan = (v: unknown) => h('span', null, v == null ? '' : String(v))
/** 有值才渲染（旧版格内大量 `v-if`）。 */
export const gMaybe = (v: unknown, node: VNodeChild) => (v ? node : null)

/** 单值格（客户/单号/打单人/业务员）：空值给 `—` —— **这一处是我们加的**，旧版是空 span。 */
export const line = (v: unknown) => h('div', { class: 'cell-line' }, v == null || v === '' ? '—' : String(v))

// ── A1. `va()`：生产进度串的渲染口径（旧版 `va`，§5.2）──────────────────────
/*
 * 旧版原文（逐字）：
 *
 *   va = e => {
 *     if (!e || e.trim() === '') return ''
 *     if (!e.includes('➞')) {
 *       if (e.includes('_')) { 拆 '_' → 前段 + '_' + <span 红15粗>(末段)</span> }
 *       return e                                     // 没有 '_' ⇒ 原样返回
 *     }
 *     const segs = e.split('➞'); const dated = []; const out = []
 *     segs.forEach((seg, i) => {
 *       if (seg.match(/\d{4}-\d{2}-\d{2}/)) { dated.push({part:seg, date, index:i}); out.push(seg) }
 *       else if (seg.includes('_')) { 前段 + '_' + <红>(末段)</红> }
 *       else { out.push(<红>整段</红>) }
 *     })
 *     if (dated.length > 0) {
 *       日期全同 ⇒ 把**最后一段**带日期的整个 part 换成 <红>part</红>
 *       否则     ⇒ 把**日期最大**的那一段整个 part 换成 <红>part</红>
 *     }
 *     return out.join('➞')
 *   }
 *
 * 三处**容易读错**的地方（我按原文核过，不是推断）：
 *  ① 带日期的段**先原样入 `out`**，最后只把**中选那一段**整个换掉 ——
 *     所以红的是 `工序名_操作员_2026-09-19` **整段**（含日期），**不是**只红末段；
 *     而**不带日期**的段红的**只是 `_` 之后那截**。
 *  ② `dated.every(...)` 比的是 `getTime()`；全同时取**下标最大的那一段**（不是最后一个 `dated` 元素？——
 *     是同一个，因为 `dated` 按出现顺序 push，所以 `dated[dated.length-1].index` 就是最后一段）。
 *  ③ 位置用 `index` 回写 `out` —— `out` 与 `segs` 一一对应，所以 `index` 直接可用。
 *  ④ 兜底：整串**不含** `➞` 且**不含** `_` ⇒ 原样（不标红）。含 `_` 才把末段标红。
 *
 * ⚠️ **唯一有意偏离**：旧版把结果直接塞进 `innerHTML`（`v-html` 同款），**不转义**。
 *    工序名/操作员是租户自己录的数据，但仍是从库里读出来的字符串 ⇒ 这里**转义非红色部分**，
 *    只拼我们自己造的 `<span>`。真实数据里不含 `<`/`>`/`&` 时，渲染结果与旧版**逐字节相同**。
 */
export const RED_STYLE = 'color: red; font-size: 15px; font-weight: bold;'
export const redSpan = (s: string) => `<span style="${RED_STYLE}">${s}</span>`
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const DATE_RE = /\d{4}-\d{2}-\d{2}/

/** 把 `_` 分隔的段渲染成「前段 + `_` + <红>末段</红>」；前段为空就整段红。 */
export function splitUnderscore(seg: string): string {
  const parts = seg.split('_')
  const last = parts[parts.length - 1]
  const head = parts.slice(0, -1).join('_')
  return head ? escapeHtml(head) + '_' + redSpan(escapeHtml(last)) : redSpan(escapeHtml(last))
}

export function va(input: unknown): string {
  const s = typeof input === 'string' ? input : input == null ? '' : String(input)
  if (!s || s.trim() === '') return ''
  if (!s.includes('➞')) {
    if (s.includes('_')) return splitUnderscore(s)
    return escapeHtml(s)
  }
  const segs = s.split('➞')
  const dated: { part: string; date: number; index: number }[] = []
  const out: string[] = []
  segs.forEach((seg, i) => {
    const m = seg.match(DATE_RE)
    if (m) {
      dated.push({ part: seg, date: new Date(m[0]).getTime(), index: i })
      out.push(escapeHtml(seg))
    } else if (seg.includes('_')) {
      out.push(splitUnderscore(seg))
    } else {
      out.push(redSpan(escapeHtml(seg)))
    }
  })
  if (dated.length > 0) {
    if (dated.every((d) => d.date === dated[0].date)) {
      const last = dated[dated.length - 1]
      out[last.index] = redSpan(escapeHtml(last.part))
    } else {
      const max = dated.reduce((a, b) => (b.date > a.date ? b : a))
      out[max.index] = redSpan(escapeHtml(max.part))
    }
  }
  return out.join('➞')
}

/** 「生产进度」格 **只有非空才渲染**（旧版 `v-if="row.生产进度"`）。 */
export const progressCell = (r: ProgressRowDto) =>
  r['生产进度']
    ? h('span', {
        // 旧版 `:class="{'progress-paid': 生产进度.includes('回款')}"`（`.progress-paid{color:red;font-weight:700}`）
        class: { 'progress-paid': r['生产进度'].includes('回款') },
        innerHTML: va(r['生产进度']),
      })
    : null

// ── A2. 别的小格（结构照旧版 render 逐字抄）───────────────────────────────

/** 「备注」：`地址：` 是 `.glass-input-label`，且**只在安装地址非空时**才渲染。 */
export const remarkCell = (r: ProgressRowDto) =>
  gContainer(
    gGroup(gMaybe(r['安装地址'], gLabel('地址：')), gSpan(r['安装地址'])),
    gGroup(gSpan(r['备注'])),
  )

/** 「型材/颜色」：**两行都没有标签**（旧版 `label:"型材/颜色"` 那段就是裸 span）。 */
export const profileColorCell = (r: ProgressRowDto) =>
  gContainer2(gGroup(gSpan(r.profile)), gGroup(gSpan(r.color)))

/**
 * 「玻璃」：底玻 / 面玻 两行裸值，第三行的标签是 `数量：`（值 = `数量`）。
 * ⚠️ 旧版就是 `数量：` + `row.数量`（**不是**玻璃厚）—— 逐字读出来的，别"顺手改对"。
 */
export const glassCell = (r: ProgressRowDto) =>
  gContainer(gGroup(gSpan(r.bottom_glass)), gGroup(gSpan(r.face_glass)), gGroup(gLabel('数量：'), gSpan(r.quantity)))

/** 「扇数/开向」：扇数**有才渲染**，开向恒渲染。 */
export const fansDirectionCell = (r: ProgressRowDto) =>
  gContainer(gGroup(gMaybe(r.fans, gSpan(r.fans))), gGroup(gSpan(r.direction)))

/**
 * 「下轨道/套线」的轨道行标签（旧版 `Re`）：
 * `null !== 吊脚 && "" !== 吊脚 ? "锁具：" : "轨道："`。
 *
 * ⚠️ 这个判据有个 **JS 陷阱**：`undefined !== null` 为**真** ⇒ 旧版里**字段缺失**也判成「锁具：」。
 *    新版 `jiao` 是**非空数字**（后端 `f64`，缺省 0）⇒ 照字面写就恒为「锁具：」，
 *    与旧版「door_specs JSON 里没有吊脚 ⇒ undefined ⇒ 锁具」的结果**一致**。
 *    保留字面写法，不"修正"成 `!= null`（那会把结果改反）。
 *    另：Column 是 `2轨2扇` 这类**串**时旧版也会命中（`"" !== "2轨2扇"`）。
 */
export function trackRowLabel(r: ProgressRowDto): string {
  const j = r.jiao as unknown
  return j !== null && j !== undefined && j !== '' ? '锁具：' : '轨道：'
}

/**
 * 「下轨道/套线」：⚠️ 两个标签都是 `.glass-input-group` 的**兄弟节点**（不在组内），
 * 旧版就是这么摆的（`Je` 容器的直接子节点序列：label → group → label → group）。
 */
export const trackCasingCell = (r: ProgressRowDto) =>
  gContainer2(
    gMaybe(r.track, gLabel(trackRowLabel(r))),
    gGroup(gSpan(r.track)),
    gMaybe(r.casing, gLabel('套线：')),
    gGroup(gSpan(r.casing)),
  )

/**
 * 「门洞尺寸」：高度 / 宽度（钻石型材 → `左宽：`）/ 母门宽（子母型材 → 渲染 `轨道长`）/
 * 墙厚（钻石 → `门宽：`）/ 洞尺（有才渲染，**无标签**）。
 */
export const doorSizeCell = (r: ProgressRowDto) => {
  const diamond = !!r.profile && r.profile.includes('钻石')
  return gContainer(
    gGroup(gLabel('高度：'), gSpan(r.door_height)),
    gGroup(gLabel(diamond ? '左宽：' : '宽度：'), gSpan(r.door_width)),
    // 旧版：`型材.includes('子母')` 才渲染这一行，且值是 `轨道长`（标签写的是「 母门宽: 」，前后带空格）
    gMaybe(
      !!r.profile && r.profile.includes('子母'),
      gGroup(gLabel(' 母门宽: '), gSpan(r.track_length)),
    ),
    gGroup(gLabel(diamond ? '门宽：' : '墙厚：'), gSpan(r.wall_thickness)),
    gMaybe(r['洞尺'], gGroup(gSpan(r['洞尺']))),
  )
}

/**
 * 「亮窗信息」：亮窗总高（钻石 → `右宽：`，**整行有才渲染**）/ 亮窗数量 / 封板高（>0 才渲染）。
 * ⚠️ 后两组的 label 与 group 也是**兄弟**（与「下轨道/套线」同款）。
 */
export const lightWindowCell = (r: ProgressRowDto) => {
  const diamond = !!r.profile && r.profile.includes('钻石')
  return gContainer2(
    gGroup(
      gMaybe(r.light_window_height, gLabel(diamond ? '右宽：' : '亮窗总高：')),
      gMaybe(r.light_window_height, gSpan(r.light_window_height)),
    ),
    gMaybe(r.light_window_count, gLabel('亮窗数量：')),
    gGroup(gMaybe(r.light_window_count, gSpan(r.light_window_count))),
    gMaybe(r['封板高'] > 0, gLabel('封板高：')),
    gGroup(gMaybe(r['封板高'] > 0, gSpan(r['封板高']))),
  )
}

/** 「金额」：`金额：` / `平方数：` 两个标签 + 各自的值（值那侧还多套一层 `div`，旧版原样）。 */
export const amountCell = (r: ProgressRowDto) =>
  gContainer2(
    gLabel('金额：'),
    gGroup(gSpan(r.amount)),
    gLabel('平方数：'),
    gGroup(h('div', null, gSpan(r.square))),
  )
