/*
 * 扫码生产页的「标签云打印」—— 数据构造层（旧版 `za`，`Qrscanner @43896`）。
 *
 * 依据：`docs/2026-09-19-qrscanner-analysis.md` §3.5，以及反混淆源码里 `za` 那一段的逐行核对。
 *
 * ## ⚠️ 为什么**不**复用 `utils/printData.ts` 的 `labelQuantity`
 *
 * 两个页面各有一份**长得像但不一样**的标签张数算法：
 *
 * | | 本页（`za`） | Hui / Home（`printData.labelQuantity`） |
 * |---|---|---|
 * | 分支依据 | **行有没有「扇数」** | 行的 `line_type`（`ping`/`diao`） |
 * | 移门张数 | `数量 × (k × diao.sheets + 1)` | `数量 × (n × diao.sheets + 1)` |
 * | 平开张数 | `数量 × ping.sheets` | `数量 × ping.sheets`（另有「钻石 → 4×数量」） |
 * | 租户特判 | `名甸门业`/`名扬门业` -1、`美居门业有限公司` 恒 1、`鑫隆迪门厂` 折叠恒 1 | 那份是另一串名单（含「宏叶芯诚 +3」等） |
 * | 型材特判 | 含 `哑口套` → `= 数量`；含 `+0` → `-1` | 含 `哑口套`/`门套` → `= 数量`；含 `+0` → `-1` |
 *
 * ⇒ **照抄本页那份**，别为了消重去改 `printData.ts`（那会动到 Hui/Home 已验收的打印张数）。
 *
 * ## ⚠️ 一处**有意偏离**：`套线单价` 这条分支在旧版是**死的**，新版**生效**
 *
 * 旧版 `za` 里有 `Number(t["套线单价"] || 0) > 0 && (l += diao_tabs.add_2)`，
 * 但它拿到的行是服务端 `labelRow`（`progress.service.ts:181`）的产物 ——
 * **那 18 个键里根本没有 `套线单价`** ⇒ 这一条**永远不成立**，是死分支
 * （分析文档 §8.6-(c) 已核）。
 *
 * 新版后端**返回整行**（有意如此：那 18 个键是「当时那个模板恰好用到的字段」的快照，
 * 不是业务边界），整行里**有** `casing_price`（就是「套线单价」列）⇒ 这条**会生效**。
 *
 * ★ **这是本文件唯一一处「标签张数可能与旧版不同」的地方**，特此标明。
 *   要退回旧版行为，把 `casingPrice` 传 `0` 即可（`ScanLabelOptions.casingPrice` 就是这么用的）。
 *
 * ## ⚠️ 顺带记两处旧版自己的坑（照抄，不修）
 *
 * 1. **张数串里没有 `8轨8扇` / `9轨9扇`** —— 那条三元链漏了这两个值，
 *    落到「一个都没匹配上」⇒ 张数停在 `parseInt(数量) || 1`（其余移门档位都乘了 `k×sheets+1`）。
 *    照抄：这两个档位的门少打标签，是旧版现状。
 * 2. **`型材` 未加空值保护**（`t["型材"]["includes"](...)`）—— 字段缺失时会抛异常。
 *    这里**加了保护**（取空串），因为新版整行返回、`profile` 理论上可为空；
 *    加了保护之后这一行的结果与旧版「不抛异常时」一致。
 */
import type { ProgressRowDto } from '../api/types'
import type { TabsConfig } from './printData'

/**
 * 一张标签的数据（旧版 `za` 里那个 `e4` 对象，11 个键，逐字照抄）。
 *
 * ⚠️ 那条 `[k: string]: string` 索引签名是**给打印引擎的类型用的**
 * （`printService.PrintData = Record<string, unknown>`）；值本来就全是字符串。
 */
export interface ScanLabelRow {
  [k: string]: string
  /** 二维码内容 —— **就是行级「单号」**（分析文档 §3.1 三处证实）。 */
  qrcode: string
  client: string
  door: string
  size: string
  color: string
  lockway: string
  remark: string
  orderID: string
  address: string
  glass: string
  /** 份号 `总张数-第几张`，从 1 数起。 */
  package: string
}

export interface ScanLabelOptions {
  /** 租户名（旧版 `userinfo.registrant`）—— 几处硬编码特判按它分支。 */
  registrant: string
  /** 平开标签参数（旧版 `registrant.ping_tabs`）。 */
  pingTabs: TabsConfig
  /** 移门标签参数（旧版 `registrant.diao_tabs`）。 */
  diaoTabs: TabsConfig
  /**
   * 该行的「套线单价」—— **默认请传 0**（= 旧版那条死分支的行为），见文件头。
   * 真要让它生效就传真值（新版整行里有 `casing_price`）。
   */
  casingPrice?: number
  /** 「固定标签数」开关开着时的张数（旧版 `rt` + `ut`）；`null`/`undefined` = 没开。 */
  fixedCount?: number | null
}

/**
 * 一行要打几张标签（旧版 `za` 里那个 `l`）。
 *
 * 逐段对应旧版（`const e = t["扇数"] && "" !== t["扇数"].trim()`）：
 * - **有扇数**（移门）→ `张数 × (k × diao.sheets + 1)`；亮窗总高 > 0 → `+ diao.add`；
 *   套线单价 > 0 → `+ diao.add_2`。
 * - **没扇数**（平开）→ `数量 × ping.sheets`；亮窗总高 > 0 → `+ ping.add`；墙厚 > 0 → `+ ping.add_2`。
 * - 再叠加：名甸门业/名扬门业 `-1`；美居门业有限公司 恒 `1`；型材含「哑口套」→ `= 数量`；
 *   型材含「+0」→ `-1`；最后「固定标签数」开着就**覆盖**成那个值。
 *
 * ⚠️ 顺序不能换：那几个租户/型材特判都在**基础公式之后**，而「固定标签数」在**最后**
 * （旧版原文就是 `rt.value && ut.value > 0 && (l = ut.value)`）。
 */
export function scanLabelCount(row: ProgressRowDto, opts: ScanLabelOptions): number {
  const registrant = opts.registrant
  const ping = opts.pingTabs
  const diao = opts.diaoTabs
  const qty = parseInt(String(row.quantity)) || 1
  const fans = String(row.fans ?? '').trim()
  const profile = String(row.profile ?? '')

  let l = qty
  /*
   * ⚠️ 名甸门业 / 名扬门业 的 `-1` **必须记在另一个变量里、最后再加**。
   *
   * 旧版原文是 `let l = parseInt(数量)||1, a = 0;`，那两处 `-1` 记的是 **`a`**，
   * 到分支**之后**才 `l += a`（`Qrscanner @43876`）。
   * 直接 `l -= 1` 会被紧接着的 `l = qty * ping.sheets`（平开）**整个覆盖掉**，
   * 移门那支也会把这个 -1 跟着一起乘 —— **两种都是错的**。
   */
  let adjust = 0
  if (registrant === '名甸门业') adjust = -1
  if (registrant === '名扬门业') adjust = -1

  if (fans) {
    // 移门档位 → k（旧版那串三元链；**没有 8轨8扇 / 9轨9扇**，见文件头坑 1）。
    const k = SLIDING_FACTOR[fans]
    if (k != null) l = l * (k * diao.sheets + 1)
    // 折叠扇数：鑫隆迪门厂 一律压成 1 张。
    if (fans.startsWith('折叠') && registrant === '鑫隆迪门厂') l = 1
    if (Number(row.light_window_height || 0) > 0) l += diao.add
    if (Number(opts.casingPrice || 0) > 0) l += diao.add_2
  } else {
    l = qty * ping.sheets
    if (Number(row.light_window_height || 0) > 0) l += ping.add
    if (Number(row.wall_thickness || 0) > 0) l += ping.add_2
  }

  l += adjust
  if (registrant === '美居门业有限公司') l = 1
  if (profile.includes('哑口套')) l = qty
  if (profile.includes('+0')) l -= 1

  if (opts.fixedCount != null && opts.fixedCount > 0) l = opts.fixedCount
  return l
}

/**
 * 移门扇数档位 → `k`。**逐项抄自旧版 `za` 那条三元链**，一个不多一个不少
 * —— ⚠️ 特别是**没有 `8轨8扇` / `9轨9扇`**（旧版漏了，见文件头坑 1）。
 * 表里没有的值 → 张数不乘 `k`（保持 `数量`）。
 */
const SLIDING_FACTOR: Record<string, number> = {
  '2轨2扇': 2, '2轨3扇': 3, '2轨4扇': 4, '3轨2扇1纱': 3, '3轨4扇2纱': 6,
  '3轨3扇': 3, '4轨4扇': 4, '5轨5扇': 5, '6轨6扇': 6, '7轨7扇': 7,
  '3轨6扇': 6, 单轨单扇: 1, 单轨2扇: 2,
  折叠2扇: 2, 折叠3扇: 3, 折叠4扇: 4, 折叠5扇: 5,
  折叠6扇: 6, 折叠7扇: 7, 折叠8扇: 8, 折叠9扇: 9,
  // 淋浴两档单独走 `×2×sheets+1`
  一固一活: 2, 双活: 2,
}

/**
 * 一行「开向」栏的文案（旧版 `za` 里 `lockway` 那段三元）。
 *
 * 原文（嵌套写得很绕，这里展开成等价的三种情况）：
 * ```
 * "" !== (套线种类||"")
 *   ? (套线种类||"") + (开向||"")
 *   : (型材.includes("哑口套") || 型材.includes("门套")) ? (开向||"") : (套线种类||"") + (扇数||"") + (开向||"")
 * ```
 * ⚠️ 注意第三种情况里的 `(套线种类||"")` **恒为空串**（能走到那儿就说明它是空的）
 * —— 原文留着这个拼接，展开后就是 `扇数 + 开向`。
 */
function lockwayOf(row: ProgressRowDto): string {
  const casing = String(row.casing ?? '')
  const direction = String(row.direction ?? '')
  const profile = String(row.profile ?? '')
  if (casing !== '') return '开向:' + casing + direction
  if (profile.includes('哑口套') || profile.includes('门套')) return '开向:' + direction
  return '开向:' + String(row.fans ?? '') + direction
}

/** 尺寸栏（旧版 `a`）：`尺寸:门洞高*门洞宽`，后面按需追加 `*墙厚` / `*吊脚` / `*亮窗总高`。 */
function sizeOf(row: ProgressRowDto): string {
  let s = '尺寸:' + (row.door_height || 0) + '*' + (row.door_width || 0)
  if (Number(row.wall_thickness || 0) > 0) s += '*' + row.wall_thickness
  if (Number(row.jiao || 0) > 0) s += '*' + row.jiao
  if (Number(row.light_window_height || 0) > 0) s += '*' + row.light_window_height
  return s
}

/**
 * 把扫码查出来的行铺成**标签行数组**（旧版 `za` 的 `M`）—— 一行按张数展开成多张，
 * 每张的 `package` 是 `总张数-第几张`。
 *
 * ⚠️ 旧版**没有排序**（`M.push` 的先后就是行的先后），这里也不排
 * —— 这与 Hui/Home 的 `labelRows('lable')` 不同（那边收尾会按 `orderID` 的数字段排序）。
 */
export function buildScanLabelRows(
  rows: ProgressRowDto[],
  opts: ScanLabelOptions,
): ScanLabelRow[] {
  const out: ScanLabelRow[] = []
  for (const row of rows) {
    const count = scanLabelCount(row, opts)
    const no = String(row['单号'] ?? '')
    const size = sizeOf(row)
    for (let i = 0; i < count; i++) {
      out.push({
        qrcode: no,
        client: String(row['客户'] ?? ''),
        door: '型材:' + String(row.profile ?? ''),
        size,
        color: '颜色:' + String(row.color ?? ''),
        lockway: lockwayOf(row),
        remark: '备注:' + String(row['备注'] ?? ''),
        orderID: no,
        address: '地址:' + String(row['安装地址'] ?? ''),
        glass: '玻璃:' + String(row.bottom_glass ?? '') + '-' + String(row.face_glass ?? ''),
        package: `${count}-${i + 1}`,
      })
    }
  }
  return out
}
