// 公式附加配置（extra JSONB）类型与常量，复刻旧版「吊」页保存时写入的附加字段。
// 与旧版 _0x5c69df 保存结构一一对应。

/**
 * 单扇最小平方数（简单门型：平开/子母/双开/钻石）。存于 square 字段，为数字。
 *
 * ⚠️ 这就是旧版 `_0x3ccfb0`（`Diao.deobfuscated.js:912-914`）的那个集合，**逐字**：
 * `["ping","parentSubsidiary","double","diamond"]` —— **`parentSubsidiary` 是驼峰**。
 * （2026-09-19 之前我们这里写的是小写，与旧版和 `printPayloads.ts` 都不符，已对齐。）
 */
export const SIMPLE_SQUARE_TYPES = ['ping', 'parentSubsidiary', 'double', 'diamond']

/** 移门最低方数设置的类型键（20 种）。存于 square 字段，为 { 类型: "最小-最大" } 对象。 */
export const MIN_SQUARE_TYPES = [
  '2轨2扇', '2轨3扇', '2轨4扇', '3轨3扇', '单轨单扇', '单轨2扇', '3轨4扇2纱', '3轨2扇1纱',
  '3轨6扇', '4轨4扇', '5轨5扇', '6轨6扇', '7轨7扇', '一固一活', '双活',
  '折叠2扇', '折叠3扇', '折叠4扇', '折叠5扇', '折叠6扇',
] as const

/** extra JSONB 的完整结构（所有字段可选，缺省即未设置）。 */
export interface FormulaExtra {
  resetSize?: { width: number; height: number }
  widthIncrement?: { SheetIncrement: number; TrackIncrement: number }
  swingWall?: { SingleWall: number; DoubleWall: number; UpWall: number }
  TaoDong?: {
    SingleDong: { 宽减: number; 高减: number }
    DubleDong: { 宽减: number; 高减: number }
  }
  hardware?: string
  hinge?: Record<string, { 上下方减尺: number; 光企减尺寸: number }>
  /**
   * 部件**声明顺序**（`Object.keys(parts)` 的保存时快照）。
   *
   * **这是原版自己的机制，不是我们发明的**（字段名亦照抄原版）：
   * - 写：`Diao.deobfuscated.js` @141718 → `t._keyOrder = 部件列表.map(a => a.name).filter(Boolean)`
   * - 读：@149913 → `const a = parts._keyOrder || []`，据此**重建编辑器行序**，
   *   并把 `_keyOrder`/`挖孔图`/`公式类型` 当**元数据**从部件遍历里剔除
   *   （`Hui-d088417c.js` @320257 亦有 `if ("_keyOrder" === x) return`）
   *
   * 为什么必须存：`parts` 是 JSONB **对象**，PostgreSQL 按「长度+字节」重排键、
   * `serde_json::Value::Object`（BTreeMap）再按字节序排一次 —— 顺序被丢两次。
   * 而原版各打印列（移门外框、全部 windows 列）**直接按 `Object.entries(parts)` 的声明序输出**，
   * 且 `applyWidthIncrement` 的状态位 `a` 依赖「{扇数}上下方」是否先出现 —— **顺序会改数值**。
   *
   * 存成**数组**即可（数组在 JSONB 与 serde_json 里**都保序**）。
   * 详见 `docs/2026-09-15-parts-order-fidelity.md`。
   */
  _keyOrder?: string[]
}

/** 移门最低方数设置：square 字段的复杂门型形态。 */
export type MinSquareMap = Record<string, string>

/** 六个尺寸的默认值（都是**字符串**，与输入框同型 —— 尺寸列在库里也是 TEXT）。 */
export interface DimDefaults {
  /** 门洞宽 */ w: string
  /** 门洞高 */ h: string
  /** 亮窗总高 */ h1: string
  /** 墙厚 */ t: string
  /** 吊脚 */ j: string
  /** 母门宽 */ s: string
}

/** 部件的最小子集 —— 这里只用到「名字类」四个字段。 */
type PartLike = { materialName?: string; title?: string; track?: string }

/**
 * 「这个名字算不算亮窗件」—— 旧版 `_0xd7eaf8`（`Diao.deobfuscated.js:1804-1806`）**逐字**：
 * `t = String(e||""); return t.includes("亮窗") && !t.includes("无亮窗")`。
 *
 * ⚠️ `"无亮窗"` 那条排除**不能省** —— 部件里真有叫「无亮窗…」的。
 */
function isLightWindowName(t: unknown): boolean {
  const s = String(t ?? '')
  return s.includes('亮窗') && !s.includes('无亮窗')
}

/**
 * 这批部件里有没有亮窗件 —— 旧版 `_0x59130c`（`Diao.deobfuscated.js:1807-1812`）。
 *
 * 遍历部件的**键名与 materialName/title/track 四个名字**，任一命中即真；
 * 并**跳过三个元数据键**（`_keyOrder`/`挖孔图`/`公式类型`，旧版同款排除）。
 */
function hasLightWindowPart(parts: Record<string, PartLike | undefined>): boolean {
  return Object.entries(parts).some(([k, v]) => {
    if (k === '_keyOrder' || k === '挖孔图' || k === '公式类型') return false
    return (
      isLightWindowName(k) ||
      isLightWindowName(v?.materialName) ||
      isLightWindowName(v?.title) ||
      isLightWindowName(v?.track)
    )
  })
}

/**
 * 按门型给出六个尺寸的**默认值** —— 复刻旧版「查询出公式后回填尺寸」那一段硬编码
 * （`Diao.deobfuscated.js:2233-2236`，逐字核过）。
 *
 * ## ⚠️ 与旧版**有意不同**：旧版是「无条件覆盖」，我们是「谁空补谁」
 *
 * 旧版**根本不存尺寸**（保存载荷只有 `formulaName/formulaType/square/diao` 加六个可选扩展块，
 * 见 `:2089-2128`），所以它每次打开公式都**无条件**把六个框刷成下面这套值
 * （门洞高恒 `2000`、墙厚恒 `300` …）。
 *
 * 我们**存**尺寸（`formulas` 表的六个 TEXT 列），照抄「无条件覆盖」等于
 * **每次打开都把用户存的尺寸冲掉、再存回去就是永久丢失**。
 * 所以这里只做「**空着才补**」—— 既拿到旧版「打开公式不会看到一片空框」的好处，
 * 又不动已有数据。调用方负责判断空不空，见 `Formulas.vue` 的 `fillEmptyDims`。
 *
 * ## 默认值出处（`:2233-2236` 逐条）
 *
 * | 字段 | 默认 |
 * |---|---|
 * | 门洞高 `h` | 恒 `"2000"` |
 * | 墙厚 `t` | 恒 `"300"` |
 * | 亮窗总高 `h1` | 平开类或 `diao` ⇒（有亮窗件 ? `"2500"` : `"0"`）；否则 `"2500"` |
 * | 门洞宽 `w` | `diao`→`2400`；`ling`→`1600`；`diamond`→`580`；`parentSubsidiary`→`900`；其余 `800` |
 * | 母门宽 `s` | 仅 `parentSubsidiary` 被置 `"200"`，其余留空 |
 * | 吊脚 `j` | 见下 |
 *
 * 「平开类」判据是旧版 `_0x3ccfb0`（`:912-914`）= `["ping","parentSubsidiary","double","diamond"]`
 * —— **与 [`SIMPLE_SQUARE_TYPES`] 是同一个集合**，故直接复用，不另立一份。
 *
 * 另外三条**跨字段**的副作用也照抄了：`diamond` 顺带把墙厚改 `"560"`、亮窗总高改 `"580"`；
 * `ling` 顺带把墙厚改 `"0"`；`parentSubsidiary` 顺带把母门宽置 `"200"`。
 *
 * ⚠️ **吊脚是唯一「抄不了」的一个**：旧版取的是**用户数据** `registrant.ping_column["吊脚"]`
 * （`:3314-3316` → `_0x49f71f` `:908-911`：`Number(...)||0`，`>0 ? a : 0`）。
 * 我们**没有这份用户数据**，所以取 `"0"` —— 也就是旧版**取不到时的值**。
 * 空框与 `"0"` 在计算上是等价的（`num('')===0`），只是显示不同。
 *
 * ⚠️ `ling` 那一支**我们永远走不到**：`formulaType` 只有 5 个取值
 * （`ping`/`diao`/`double`/`diamond`/`parentSubsidiary`），旧版自己也不产生 `ling`
 * —— 它只在旧版从历史数据读回 `formulaType` 时才可能出现。**照抄是为了逐字对齐，不代表可达。**
 *
 * ⚠️ 大小写：这里比较的 `'parentSubsidiary'` 是**驼峰**，与旧版逐字一致
 * （旧版 `_0x3ccfb0`、`:2213`、`:2236`、`:2133` 全是驼峰）。
 * 2026-09-19 之前我们用的是全小写，与旧版和自家 `printPayloads.ts` 都不符
 * —— 已对齐并迁移数据（迁移 0024），见 `docs/2026-09-19-diao-audit.md` §3.1。**别再改回小写。**
 */
/**
 * 把 `defaults` 里**我们这边空着的**那些字段补上，已有值**原样保留**。
 *
 * 「空」的判据是 `trim()` 后为空串（含 `undefined`）—— 一个只有空白的输入框
 * 在计算上等同于空（`num('  ')===0`），但 `!v` 判不出来，所以要 `trim`。
 *
 * ⚠️ **这是本仓库相对旧版的**有意偏离**，不是抄漏**：旧版每次打开公式都**无条件覆盖**
 * 六个框（因为它根本不存尺寸）；我们存，覆盖会冲掉用户数据。
 * 详见 [`defaultDims`] 的注释与 `docs/2026-09-19-diao-audit.md` §3.2。
 *
 * 抽成纯函数是为了能机器验 —— `docs/diao-default-dims-logiccheck.mjs` 有一节专门断言
 * 「非空的不动、空的才补」。
 */
export function applyDimDefaults(
  current: Partial<DimDefaults>,
  defaults: DimDefaults,
): DimDefaults {
  const pick = (k: keyof DimDefaults): string => {
    const v = current[k]
    return v !== undefined && String(v).trim() !== '' ? String(v) : defaults[k]
  }
  return { w: pick('w'), h: pick('h'), h1: pick('h1'), t: pick('t'), j: pick('j'), s: pick('s') }
}

export function defaultDims(
  formulaType: string,
  parts: Record<string, PartLike | undefined> = {},
): DimDefaults {
  const simple = SIMPLE_SQUARE_TYPES.includes(formulaType)
  const d: DimDefaults = {
    h: '2000',
    t: '300',
    h1: simple || formulaType === 'diao' ? (hasLightWindowPart(parts) ? '2500' : '0') : '2500',
    w: '800',
    j: '0',
    s: '',
  }
  if (formulaType === 'diao') {
    d.w = '2400'
  } else if (formulaType === 'ling') {
    d.w = '1600'
    d.t = '0'
  } else if (formulaType === 'diamond') {
    d.w = '580'
    d.t = '560'
    d.h1 = '580'
  } else if (formulaType === 'parentSubsidiary') {
    d.w = '900'
    d.s = '200'
  }
  return d
}

function numOrZero(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 将后端返回的 extra JSON 归一化为安全对象。 */
export function normalizeExtra(raw: unknown): FormulaExtra {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as FormulaExtra
  return {}
}

/** 将后端返回的 square 字段归一化：简单门型返回数字，复杂门型返回 {类型:最小-最大}。 */
export function normalizeSquare(raw: string, formulaType: string): number | MinSquareMap {
  if (SIMPLE_SQUARE_TYPES.includes(formulaType)) return numOrZero(raw)
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as MinSquareMap
  } catch {
    // 非 JSON，视为未设置
  }
  return {}
}

/** 将 square 值序列化为后端存储的字符串：数字直接转字符串，对象 JSON 序列化。 */
export function serializeSquare(value: number | MinSquareMap): string {
  if (typeof value === 'number') return String(value)
  const entries = Object.entries(value).filter(([, v]) => v && String(v).trim() !== '')
  if (!entries.length) return '0'
  return JSON.stringify(Object.fromEntries(entries))
}
