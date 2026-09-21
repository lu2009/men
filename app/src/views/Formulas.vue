<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, type Ref } from 'vue'
import { NButton, NSpace, NTooltip, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { api } from '../api/client'
import type { FormulaDto, FormulaImageDto, FormulaInput } from '../api/types'
import { useAuthStore } from '../stores/auth'
import {
  checkReverseRefs,
  computeV,
  NO_EFFECT,
  recalcForward,
  type Dimensions,
  type PartsMap,
} from '../utils/formulaEngine'
import { isAdmin } from '../utils/roles'
import { FORMULA_TYPE_LABELS, TEMPLATE_LIST, TEMPLATES } from '../data/formulaTemplates'
import { COMMON_MATERIALS, EXTRA_MATERIAL_GROUPS, MATERIAL_LIBRARY } from '../data/formulaMaterials'
import {
  applyDimDefaults,
  defaultDims,
  insertKeyAt,
  MIN_SQUARE_TYPES,
  SIMPLE_SQUARE_TYPES,
  normalizeExtra,
  normalizeSquare,
  serializeSquare,
  type FormulaExtra,
  type MinSquareMap,
} from '../data/formulaExtra'
import GlassDraw from '../components/GlassDraw.vue'

const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()

// 口径在 `utils/roles.ts` 的 `isAdmin`（本文件不再自带 `'admin'` 字面量）。
// ⚠️ 计算属性叫 `isAdminUser` 而不是 `isAdmin` —— 否则会**遮蔽**导入进来的那个函数。
const isAdminUser = computed(() => isAdmin(auth.user?.role))

/**
 * 编辑器（尺寸区 + 配置区 + 搜索区 + 「新增材料」「确认」两颗按钮）是否可见。
 *
 * 复刻旧版 `_0x579c3d`（`Diao.deobfuscated.js:947` 声明为 `Vue.ref(!1)`，渲染区**三处**
 * `v-show`：`:3428` 尺寸/配置/搜索区、新增材料按钮、确认按钮）。
 *
 * ⚠️ **它是个单向闩**：19 处赋值**全是 `!0`、从不回 `false`** —— 一旦显示就永远显示。
 * 打开它的动作：10 个模板加载器（`:2395`–`:2564`）、公式模板按钮（`:1178`）、
 * 3D创建公式（`:1181`，我们没做）、复制（`:2203`）。
 *
 * 打开它的动作：10 个模板加载器（`:2395`–`:2564`）、公式模板按钮（`:1178`）、
 * 3D创建公式（`:1181`，我们没做）、复制（`:2203`）、
 * **查询/加载公式**（在 `_0x23658f` 里 `queryFormula` 成功返回的那一刻：
 * `if(200===r.code&&r["data"]){ _0x579c3d["value"]=!0; …`）。
 *
 * ⚠️ 写这段注释时我一度以为「查询那条路径不设它」，还据此写了一条"有意偏离" ——
 * **是错的**：我把另一处的行号归到了这个函数上。核对函数边界（`_0x23658f` 从
 * 偏移 146034 到 152100，里面 `_0x579c3d` 出现 1 次）才纠正过来。
 * **我们 `loadFormula` 里那一行是照抄，不是偏离。**
 */
const editorVisible = ref(false)

// —— 尺寸与元信息 ——
const formulaName = ref('')
const formulaType = ref('')
const templateKey = ref('')
const square = ref('1.5')
const editingId = ref<number | null>(null)

const dimW = ref('')
const dimH = ref('')
const dimH1 = ref('')
const dimT = ref('300')
const dimJ = ref('')
const dimS = ref('')

const dimRefs: Record<'w' | 'h' | 'h1' | 't' | 'j' | 's', Ref<string>> = {
  w: dimW,
  h: dimH,
  h1: dimH1,
  t: dimT,
  j: dimJ,
  s: dimS,
}

const isDiamond = computed(() => formulaType.value === 'diamond')
const isSimpleSquare = computed(() => SIMPLE_SQUARE_TYPES.includes(formulaType.value))
// ⚠️ 驼峰 `parentSubsidiary` —— 与旧版（`Diao.deobfuscated.js:2213` 等）逐字一致，**别改成小写**。
const isSubsidiary = computed(() => formulaType.value === 'parentSubsidiary')
// 吊脚仅简单门型显示（复刻旧版 _0x1d0fcc = 平开/双开/子母/钻石）。
const showJiao = computed(() => isSimpleSquare.value)
// 必填弹窗中的吊脚（复刻旧版 _0x17e61b：仅平开/中开门）。
const showJiaoInDialog = computed(() => formulaType.value === 'ping' || formulaType.value === 'double')

/**
 * 把**空着**的尺寸按门型补上默认值（复刻旧版 `Diao.deobfuscated.js:2233-2236`）。
 *
 * ⚠️ **只补空的，不覆盖已有的。** 旧版是**无条件覆盖** —— 因为它根本不存尺寸
 * （保存载荷只有 `formulaName/formulaType/square/diao` + 六个可选扩展块，`:2089-2128`），
 * 每次打开都必然是一组全新默认值。我们**存**尺寸，照抄覆盖 = 每次打开把用户存的冲掉，
 * 再存回去就永久丢了。所以取「空才补」：拿到旧版「打开公式不会看到一片空框」的好处，
 * 又不动已有数据。默认值表与依据见 `data/formulaExtra.ts` 的 `defaultDims`。
 *
 * 为什么要补：`门洞高/宽/墙厚` 在保存时是必填（`validate()`），但
 * **`亮窗总高`/`吊脚`/`母门宽` 不是** —— 库里的行完全可能是空串，
 * 那样 `refreshPlaceholders()` 会按 `h1=0 / j=0` 去算，**整表占位值全错而界面上没有任何提示**。
 */
function fillEmptyDims() {
  const filled = applyDimDefaults(
    { w: dimW.value, h: dimH.value, h1: dimH1.value, t: dimT.value, j: dimJ.value, s: dimS.value },
    defaultDims(formulaType.value, parts),
  )
  dimW.value = filled.w
  dimH.value = filled.h
  dimH1.value = filled.h1
  dimT.value = filled.t
  dimJ.value = filled.j
  dimS.value = filled.s
}

function dimLabel(key: 'w' | 'h' | 'h1' | 't' | 'j' | 's'): string {
  if (isDiamond.value) {
    return { w: '左宽', h: '门洞高', h1: '右宽', t: '门宽', j: '吊脚', s: '母门宽' }[key]
  }
  return { w: '门洞宽', h: '门洞高', h1: '亮窗总高', t: '墙厚', j: '吊脚', s: '母门宽' }[key]
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function dims(): Dimensions {
  return {
    w: num(dimW.value),
    h: num(dimH.value),
    h1: num(dimH1.value),
    t: num(dimT.value),
    j: num(dimJ.value),
    s: num(dimS.value),
  }
}

// —— 附加配置（洞尺/包边/丁墙/合页/边封增量/固定配件）——
const extra = reactive<FormulaExtra>({})
const minSquare = reactive<Record<string, string>>({})

const resetSizeSummary = computed(() => {
  const w = extra.resetSize?.width || 0
  const h = extra.resetSize?.height || 0
  return w === 0 && h === 0 ? '' : `宽减${w} 高减${h}`
})
const taoDongSummary = computed(() => {
  const td = extra.TaoDong
  if (!td) return ''
  const a = td.SingleDong?.宽减 || 0
  const b = td.SingleDong?.高减 || 0
  const c = td.DubleDong?.宽减 || 0
  const d = td.DubleDong?.高减 || 0
  return a === 0 && b === 0 && c === 0 && d === 0
    ? ''
    : `单包边洞 宽减${a} 高减${b} | 双包边洞 宽减${c} 高减${d}`
})
const swingWallSummary = computed(() => {
  const sw = extra.swingWall
  if (!sw) return ''
  const a = sw.SingleWall || 0
  const b = sw.DoubleWall || 0
  const c = sw.UpWall || 0
  return a === 0 && b === 0 && c === 0 ? '' : `单丁:${a} 双丁:${b} 上丁:${c}`
})
const hingeSummary = computed(() => {
  const hinge = extra.hinge
  if (!hinge) return ''
  return Object.entries(hinge)
    .map(([name, v]) => `${name}(上下:${v.上下方减尺} 光企:${v.光企减尺寸})`)
    .join('\n')
})
const widthIncrementSummary = computed(() => {
  const wi = extra.widthIncrement
  if (!wi) return ''
  return wi.SheetIncrement === 0 && wi.TrackIncrement === 0
    ? ''
    : `边封增量:${wi.SheetIncrement} 轨道增量:${wi.TrackIncrement}`
})
const hardwareSummary = computed(() => (extra.hardware ? `配件:${extra.hardware}` : ''))

// 洞尺设置
const resetSizeOpen = ref(false)
const resetSizeDraft = reactive({ width: '', height: '' })
function openResetSize() {
  resetSizeDraft.width = extra.resetSize?.width ? String(extra.resetSize.width) : ''
  resetSizeDraft.height = extra.resetSize?.height ? String(extra.resetSize.height) : ''
  resetSizeOpen.value = true
}
function confirmResetSize() {
  const w = num(resetSizeDraft.width)
  const h = num(resetSizeDraft.height)
  if (w === 0 && h === 0) delete extra.resetSize
  else extra.resetSize = { width: w, height: h }
  resetSizeOpen.value = false
}

// 包边洞尺
const taoDongOpen = ref(false)
const taoDongDraft = reactive({ sKuan: '', sGao: '', dKuan: '', dGao: '' })
function openTaoDong() {
  const td = extra.TaoDong
  taoDongDraft.sKuan = td?.SingleDong?.宽减 ? String(td.SingleDong.宽减) : ''
  taoDongDraft.sGao = td?.SingleDong?.高减 ? String(td.SingleDong.高减) : ''
  taoDongDraft.dKuan = td?.DubleDong?.宽减 ? String(td.DubleDong.宽减) : ''
  taoDongDraft.dGao = td?.DubleDong?.高减 ? String(td.DubleDong.高减) : ''
  taoDongOpen.value = true
}
function confirmTaoDong() {
  const sKuan = num(taoDongDraft.sKuan)
  const sGao = num(taoDongDraft.sGao)
  const dKuan = num(taoDongDraft.dKuan)
  const dGao = num(taoDongDraft.dGao)
  if (sKuan === 0 && sGao === 0 && dKuan === 0 && dGao === 0) delete extra.TaoDong
  else
    extra.TaoDong = {
      SingleDong: { 宽减: sKuan, 高减: sGao },
      DubleDong: { 宽减: dKuan, 高减: dGao },
    }
  taoDongOpen.value = false
}

// 平开门丁墙
const swingWallOpen = ref(false)
const swingWallDraft = reactive({ SingleWall: '', DoubleWall: '', UpWall: '' })
function openSwingWall() {
  swingWallDraft.SingleWall = extra.swingWall?.SingleWall ? String(extra.swingWall.SingleWall) : ''
  swingWallDraft.DoubleWall = extra.swingWall?.DoubleWall ? String(extra.swingWall.DoubleWall) : ''
  swingWallDraft.UpWall = extra.swingWall?.UpWall ? String(extra.swingWall.UpWall) : ''
  swingWallOpen.value = true
}
function confirmSwingWall() {
  const a = num(swingWallDraft.SingleWall)
  const b = num(swingWallDraft.DoubleWall)
  const c = num(swingWallDraft.UpWall)
  if (a === 0 && b === 0 && c === 0) delete extra.swingWall
  else extra.swingWall = { SingleWall: a, DoubleWall: b, UpWall: c }
  swingWallOpen.value = false
}

// 平开门合页
const hingeOpen = ref(false)
const hingeDraft = ref<{ name: string; topBottomReduce: string; lightDoorReduce: string }[]>([])
function openHinge() {
  hingeDraft.value = extra.hinge
    ? Object.entries(extra.hinge).map(([name, v]) => ({
        name,
        topBottomReduce: String(v.上下方减尺),
        lightDoorReduce: String(v.光企减尺寸),
      }))
    : []
  hingeOpen.value = true
}
function addHingeRow() {
  hingeDraft.value.push({ name: '', topBottomReduce: '', lightDoorReduce: '' })
}
function removeHingeRow(i: number) {
  hingeDraft.value.splice(i, 1)
}
function confirmHinge() {
  const map: NonNullable<FormulaExtra['hinge']> = {}
  for (const it of hingeDraft.value) {
    if (!it.name.trim()) continue
    map[it.name.trim()] = {
      上下方减尺: num(it.topBottomReduce),
      光企减尺寸: num(it.lightDoorReduce),
    }
  }
  if (Object.keys(map).length) extra.hinge = map
  else delete extra.hinge
  hingeOpen.value = false
}

// 边封增量
const widthIncrementOpen = ref(false)
const widthIncrementDraft = reactive({ SheetIncrement: '', TrackIncrement: '' })
function openWidthIncrement() {
  widthIncrementDraft.SheetIncrement = extra.widthIncrement?.SheetIncrement
    ? String(extra.widthIncrement.SheetIncrement)
    : ''
  widthIncrementDraft.TrackIncrement = extra.widthIncrement?.TrackIncrement
    ? String(extra.widthIncrement.TrackIncrement)
    : ''
  widthIncrementOpen.value = true
}
function confirmWidthIncrement() {
  const a = num(widthIncrementDraft.SheetIncrement)
  const b = num(widthIncrementDraft.TrackIncrement)
  if (a === 0 && b === 0) delete extra.widthIncrement
  else extra.widthIncrement = { SheetIncrement: a, TrackIncrement: b }
  widthIncrementOpen.value = false
}

// 固定配件
const hardwareOpen = ref(false)
const hardwareDraft = ref('')
function openHardware() {
  hardwareDraft.value = extra.hardware || ''
  hardwareOpen.value = true
}
function confirmHardware() {
  if (hardwareDraft.value.trim()) extra.hardware = hardwareDraft.value
  else delete extra.hardware
  hardwareOpen.value = false
}

// 移门最低方数设置
const minSquareOpen = ref(false)
const minSquareDraft = reactive<Record<string, { noLight: string; light: string }>>({})
function openMinSquare() {
  for (const k of MIN_SQUARE_TYPES) {
    const raw = minSquare[k] ?? ''
    const [a, b] = raw.split('-')
    minSquareDraft[k] = { noLight: a ?? '', light: b ?? '' }
  }
  minSquareOpen.value = true
}
function confirmMinSquare() {
  Object.keys(minSquare).forEach((k) => delete minSquare[k])
  for (const k of MIN_SQUARE_TYPES) {
    const d = minSquareDraft[k]
    const min = num(d?.noLight ?? '')
    const max = num(d?.light ?? '')
    if (min === 0 && max === 0) continue
    minSquare[k] = `${min}-${max}`
  }
  minSquareOpen.value = false
  message.success('移门最低方数设置已保存')
}

function currentSquare(): string {
  if (isSimpleSquare.value) return square.value
  return serializeSquare(minSquare as unknown as MinSquareMap)
}

function resetExtra() {
  Object.keys(extra).forEach((k) => delete (extra as Record<string, unknown>)[k])
  Object.keys(minSquare).forEach((k) => delete minSquare[k])
}

function squareBlur() {
  const v = square.value
  if (v === '') {
    square.value = '0'
    return
  }
  const n = Number(v)
  if (Number.isNaN(n)) {
    square.value = '0'
    message.warning('最小平方数只能输入数字')
    return
  }
  square.value = String(n)
}

// —— 部件表 ——
const parts = reactive<PartsMap>({})
const placeholders = reactive<Record<string, number>>({})
const countText = reactive<Record<string, string>>({})
const resultText = reactive<Record<string, string>>({})

const rows = computed(() => Object.entries(parts).map(([name, def]) => ({ name, def })))

const COLOR_BG: Record<string, string> = {
  lightgreen: '#e6f4ea',
  yellow: '#fef7e0',
  red: '#fdecea',
  pink: '#fdeef4',
  lightblue: '#e8f4fd',
  lightpink: '#fbe4ec',
  green: '#e6f4ea',
}
function rowBg(color?: string): string {
  return COLOR_BG[color ?? ''] ?? 'transparent'
}
function placeholderText(name: string): string {
  const v = placeholders[name]
  return v === undefined ? '请输入计算结果' : String(v)
}

// 原版 `_0x301055`（轨道/套线/下轨名 输入框的 blur）：公式没命名就提示，否则把名字写回部件的 `track`。
// 我们是 `:value` + `@update:value` 直接改 `row.def.track`（def 就是部件本体），等价。
// `onInput` 照抄原版 `String(v ?? '').replace(/\s/g,'')`：名字里不允许空白。
function onTrackInput(row: { def: { track: string } }, v: string) {
  row.def.track = String(v ?? '').replace(/\s/g, '')
}
function onTrackBlur() {
  if (!formulaName.value.trim()) {
    message.warning('请填写公式名称')
    return
  }
  refreshPlaceholders()
}

function refreshPlaceholders() {
  const r = recalcForward(parts, dims())
  for (const k of Object.keys(parts)) placeholders[k] = r[k] ?? 0
}

function syncRowTexts() {
  for (const [name, def] of Object.entries(parts)) {
    countText[name] = def.quantity ? String(def.quantity) : ''
    resultText[name] = def.result ? String(def.result) : ''
  }
}

function dimBlur(key: 'w' | 'h' | 'h1' | 't' | 'j' | 's') {
  const refVal = dimRefs[key]
  const v = refVal.value
  if (v === '') {
    refVal.value = '0'
    refreshPlaceholders()
    return
  }
  const n = Number(v)
  if (Number.isNaN(n)) {
    refVal.value = '0'
    message.warning(`${dimLabel(key)}只能输入数字`)
    return
  }
  refVal.value = String(n)
  refreshPlaceholders()
}

function quantityBlur(name: string) {
  const def = parts[name]
  if (!formulaName.value.trim()) {
    message.warning('请填写公式名称')
    return
  }
  const raw = countText[name] ?? ''
  if (raw === '' || Number.isNaN(Number(raw))) {
    def.quantity = 0
    countText[name] = ''
    return
  }
  def.quantity = Number(raw)
  countText[name] = String(Number(raw))
}

function resultBlur(name: string) {
  const def = parts[name]
  if (!formulaName.value.trim()) {
    message.warning('请填写公式名称')
    return
  }
  const raw = resultText[name] ?? ''
  if (raw === '' || Number.isNaN(Number(raw))) {
    def.result = 0
    resultText[name] = ''
    return
  }
  const val = Number(raw)
  if (def.calculate && val !== 0) {
    if (!num(dimH.value)) {
      message.warning('请填写门洞高')
      return
    }
    if (!num(dimW.value)) {
      message.warning('请填写门洞宽')
      return
    }
    const check = checkReverseRefs(parts, name)
    if (!check.ok) {
      message.warning(check.message!)
      def.result = 0
      resultText[name] = ''
      return
    }
    const v = computeV(parts, dims(), name, val)
    if (v === NO_EFFECT) {
      def.result = 0
      resultText[name] = ''
      return
    }
    def.v = v
  }
  def.result = val
  resultText[name] = String(val)
}

function deleteRow(name: string) {
  // 删之前先存进暂存区（含**当时的行号**）—— 旧版 `_0x332bf3`（`:1774-1783`）：
  // `stash[name] = {...def, position: index}` 之后才 `delete defs[name]`。
  // 抽屉里「常规材料」那一段就是拿它渲染的，恢复时按这个 position 插回原位置。
  const def = parts[name]
  if (def) deletedStash[name] = { ...def, position: Object.keys(parts).indexOf(name) }
  delete parts[name]
  delete countText[name]
  delete resultText[name]
  delete placeholders[name]
  refreshPlaceholders()
}

// —— 复制行（复刻旧版 _0x26a9b2 的多重判断）——
let copySeq = 0

function uniqueCopyName(base: string): string {
  let candidate = `${base}_copy_${++copySeq}`
  while (parts[candidate]) candidate = `${base}_copy_${++copySeq}`
  return candidate
}

function confirmCopyDialog(content: string): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.warning({
      title: '提示',
      content,
      positiveText: '是',
      negativeText: '否',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
    })
  })
}

function confirmCopyOptions(): Promise<boolean | null> {
  return new Promise((resolve) => {
    const checked = ref(false)
    dialog.create({
      title: '复制选项',
      content: () =>
        h('label', { style: 'display:inline-flex;align-items:center;gap:8px' }, [
          h('input', {
            type: 'checkbox',
            onChange: (e: Event) => {
              checked.value = (e.target as HTMLInputElement).checked
            },
          }),
          h('span', '复制大小扇上下方及玻璃'),
        ]),
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => resolve(checked.value),
      onNegativeClick: () => resolve(null),
      onClose: () => resolve(null),
    })
  })
}

async function copyRow(name: string) {
  const def = parts[name]
  if (!def) return

  const t = name || ''
  const hasGlass = t.includes('玻璃')
  const hasTrack = t.includes('轨')
  const hasFan = t.includes('扇')
  const upDown = t.match(/^(.*轨|折叠)(\d+)扇上下方$/)
  const isUpDown = Boolean(upDown)
  // 旧版 `_0x26a9b2` 那张表（`Diao.deobfuscated.js:1976`）写了 8 项，但后 6 项是**模板键**
  // （`ping1`/`pingWindows*`/`parentSubsidiaryWindow`…）拿去比 formulaType，**永远比不中**
  // ⇒ 实际等价于 `{ping, parentSubsidiary}`。见审计 §2.4b，**别照抄成 8 项**。
  const isPingLike = ['ping', 'parentSubsidiary'].includes(formulaType.value)
  const hasGlassWH = t.includes('玻璃宽') || t.includes('玻璃高')
  const canCopyGlass =
    (hasGlass && hasTrack && hasFan) || (isPingLike && hasGlassWH && !t.includes('亮窗'))

  // 含"玻璃"但不符合复制条件 → 拦截
  if (hasGlass && !canCopyGlass) {
    message.warning('含有"玻璃"的行不能复制')
    return
  }

  const singleName = t.includes('单玻') ? t : `${t}单玻`

  if (canCopyGlass) {
    const ok = await confirmCopyDialog(`只能复制成${singleName}情况，是否继续?`)
    if (!ok) return
    if (parts[singleName]) {
      message.warning('该名称已存在，不能重复复制')
      return
    }
  }

  // 上下方行 → 弹「复制选项」，勾选则同时复制大小扇上下方及玻璃
  let copySmallFan = false
  if (isUpDown) {
    const res = await confirmCopyOptions()
    if (res === null) return
    copySmallFan = res
  }

  const targetName = canCopyGlass ? singleName : t
  const halfQty = canCopyGlass ? Math.ceil((def.quantity || 0) / 2) : def.quantity

  // 复制大小扇上下方及玻璃（两行固定公式）
  if (copySmallFan && upDown) {
    const n = Number(upDown[2])
    const upSmall = `${upDown[1]}${upDown[2]}扇上下方小`
    const glassSmall = `${upDown[1]}${upDown[2]}扇玻璃宽小`
    if (parts[upSmall] || parts[glassSmall]) {
      message.warning('大小扇上下方及玻璃名称已存在，不能重复复制')
      return
    }
    parts[upSmall] = {
      state: false,
      quantity: n,
      materialName: '上下方小',
      track: '',
      formula: `=w/${n}+v`,
      result: 0,
      v: 0,
      title: '',
      calculate: `=result-w/${n}`,
      color: 'pink',
    }
    parts[glassSmall] = {
      state: false,
      quantity: n,
      materialName: '玻璃宽小',
      track: '',
      formula: `=${upSmall}.result-v`,
      result: 0,
      v: 0,
      title: '',
      calculate: `=${upSmall}.result-result`,
      color: 'pink',
    }
    message.success('复制大小扇上下方及玻璃成功')
    syncRowTexts()
    refreshPlaceholders()
    return
  }

  // 光企高 → 同时复制勾企高
  if (targetName.includes('光企高')) {
    const gongName = targetName.replace('光企', '勾企')
    const dKey = canCopyGlass ? targetName : uniqueCopyName(targetName)
    const gKey = canCopyGlass ? gongName : uniqueCopyName(gongName)
    parts[dKey] = { ...def, state: false, color: 'pink', quantity: halfQty }
    parts[gKey] = {
      ...def,
      state: false,
      color: 'pink',
      quantity: halfQty,
      materialName: (def.materialName || '').replace('光企', '勾企'),
    }
    message.success('复制成功（同时复制勾企高）')
    syncRowTexts()
    refreshPlaceholders()
    return
  }

  // 普通复制
  const newKey = canCopyGlass ? targetName : uniqueCopyName(targetName)
  parts[newKey] = { ...def, state: false, color: 'pink', quantity: halfQty }
  message.success('复制成功')
  syncRowTexts()
  refreshPlaceholders()
}

// —— 添加材料 ——
const addMaterialDrawer = ref(false)
/**
 * 「已删除的行」暂存区 —— 复刻旧版 `_0x3a3e48.value.delete`
 * （`Diao.deobfuscated.js:1777-1781` 写入、`:3524-3531` 渲染、`:1785-1794` 恢复）。
 *
 * ⚠️ **抽屉里「常规材料」那一段其实是「撤销删除」，不是"常用材料库"** ——
 * 我们原先把它当成后者：拿一张静态的 `COMMON_MATERIALS` 当"还没加过的材料"，
 * 加过就从列表里划掉。**数据是对的（就是下面预置的那 5 个），模型是错的**：
 *
 * | | 旧版 | 我们（改前） |
 * |---|---|---|
 * | 数据源 | **预置 5 个 + 用户删掉的行**（任意行，不限"常规材料"） | 只有那 5 个静态项 |
 * | 恢复后位置 | 带 `position` 的 ⇒ **原位置**；预置那 5 个没有 `position` ⇒ 追加 | 一律追加 |
 * | 恢复的 def | **暂存的那一份原样写回**（用户删的行保留其 quantity/track/color） | 重置成模板值 `result:0,v:0` |
 * | 加过之后 | **还在列表里**（只有"恢复"这个动作会移除它） | 从候选里划掉，再也加不回来 |
 *
 * ⇒ 删除任意一行都会进这里。所以「常规材料」三个字是旧版自己的措辞（有点名不副实），
 *   **照抄不改**；但要知道它装的是"删过的行"。
 *
 * ## 预置的那 5 个（`Diao.deobfuscated.js:1196-1215` 的 `_0x3a3e48.value.delete`）
 *
 * `分体亮窗边封 / 单轨2扇收口 / 单轨2扇上下方 / 亮窗扣板高 / 亮窗F槽高`
 * —— 与 `data/formulaMaterials.ts` 的 `COMMON_MATERIALS` **逐条同源**。
 * 它们**没有 `position`**，所以「恢复」时走**追加**（旧版 `typeof t==="number"` 为假 ⇒ `push`）。
 */
const deletedStash = reactive<Record<string, PartsMap[string] & { position?: number }>>(
  Object.fromEntries(
    Object.entries(COMMON_MATERIALS).map(([k, v]) => [k, { ...v, result: 0, v: 0 }]),
  ),
)

function materialTypeLabel(key: string): string {
  return TEMPLATE_LIST.find((t) => t.key === key)?.label ?? key
}

/**
 * 恢复一行被删掉的部件 —— 旧版 `_0x59235b`（`Diao.deobfuscated.js:1785-1794`）逐条对齐：
 * def **原样写回**（`{...stash[name]}` 去掉 `position`），再按 `position` **插回原位置**
 * （越界才退化成追加）。
 *
 * ⚠️ 旧版是用 DOM id 编码名字（`"delete-"+name`，点击时 `split("-")[1]` 取回来）——
 * 名字里含 `-` 就会被截断（旧版的坑）。我们直接传名字，不需要这个技巧。
 */
function restoreDeleted(name: string) {
  const entry = deletedStash[name]
  if (!entry) return
  const { position, ...def } = entry
  // 「插回原位置」= 重建键序（`parts` 是普通对象，键序就是行序）。规则在 `insertKeyAt` 里
  // （含边界），有差分台 `docs/diao-material-stash-logiccheck.mjs` 钉着。
  const byKey = new Map(Object.entries(parts))
  const entries = insertKeyAt(Object.keys(parts), name, position).map(
    (k) => [k, k === name ? def : byKey.get(k)!] as const,
  )
  for (const k of Object.keys(parts)) delete parts[k]
  for (const [k, v] of entries) parts[k] = v
  delete deletedStash[name]
  syncRowTexts()
  refreshPlaceholders()
  message.success('恢复成功')
}

// 新增材料：加入整组材料（颜色统一 lightblue）
function addGroup(groupName: string) {
  const group = EXTRA_MATERIAL_GROUPS[groupName]
  if (!group) return
  for (const [name, def] of Object.entries(group)) {
    if (parts[name]) continue
    parts[name] = { ...def, result: 0, v: 0, color: 'lightblue' }
  }
  syncRowTexts()
  refreshPlaceholders()
  message.success(`已添加 ${groupName} 的所有材料`)
}

// 已有材料：加入单个材料（重名自动加 _N 后缀）
function addMaterial(typeKey: string, name: string) {
  const def = MATERIAL_LIBRARY[typeKey]?.[name]
  if (!def) return
  let finalName = name
  let n = 1
  while (parts[finalName] !== undefined) {
    finalName = `${name}_${n}`
    n++
  }
  parts[finalName] = { ...def, result: 0, v: 0 }
  syncRowTexts()
  refreshPlaceholders()
  message.success(`已添加材料: ${def.materialName}`)
}

// —— 模板 ——
const templateDrawer = ref(false)
const requiredFieldsModal = ref(false)

/** 「公式模板」按钮：开抽屉 **并把编辑器放出来**（旧版 `D:1178` 设 `_0x579c3d`）。 */
function openTemplateDrawer() {
  editorVisible.value = true
  templateDrawer.value = true
}

function applyTemplate(key: string) {
  editorVisible.value = true // 旧版 10 个模板加载器每个都设 `_0x579c3d`（`D:2395`–`:2564`）
  const tpl = TEMPLATES[key]
  if (!tpl) return
  const cloned: PartsMap = {}
  for (const [name, def] of Object.entries(tpl)) {
    cloned[name] = { ...def, result: 0, v: 0, state: false }
  }
  Object.keys(parts).forEach((k) => delete parts[k])
  Object.assign(parts, cloned)
  glassImages.value = []
  const meta = TEMPLATE_LIST.find((t) => t.key === key)
  formulaType.value = meta?.formulaType ?? ''
  templateKey.value = key
  formulaName.value = ''
  editingId.value = null
  square.value = '1.5'
  resetExtra()
  syncRowTexts()
  refreshPlaceholders()
  templateDrawer.value = false
  requiredFieldsModal.value = true
}

// —— 保存 / 校验 ——
const saving = ref(false)

function validate(): string | null {
  if (!formulaName.value.trim()) return '请输入公式名称'
  if (!num(dimH.value)) return '请输入门洞高'
  if (!num(dimW.value)) return '请输入门洞宽'
  if (!dimT.value.trim()) return '请输入墙厚'
  if (isSubsidiary.value && !num(dimS.value)) return '请输入母门宽度'
  return null
}

function confirmRequiredFields() {
  const err = validate()
  if (err) {
    message.error(err)
    return
  }
  requiredFieldsModal.value = false
}

async function save() {
  const err = validate()
  if (err) {
    message.error(err)
    return
  }
  const payload: FormulaInput = {
    name: formulaName.value.trim(),
    formula_type: formulaType.value,
    template_key: templateKey.value,
    door_width: dimW.value,
    door_height: dimH.value,
    light_window_height: dimH1.value,
    wall_thickness: dimT.value,
    jiao: dimJ.value,
    mother_door_width: dimS.value,
    square: currentSquare(),
    parts: JSON.parse(JSON.stringify(parts)),
    // `_keyOrder`：部件**声明序快照**（**原版自己的字段名与机制**，见 `formulaExtra.ts` 注释与
    // `docs/2026-09-15-parts-order-fidelity.md`）。`parts` 落 JSONB 后键序会被重排（长度+字节），
    // 而原版打印列按声明序输出、`applyWidthIncrement` 更依赖它决定减量是否生效 —— 顺序会改数值。
    // 数组在 JSONB 里保序，故把顺序单独存一份。
    extra: { ...JSON.parse(JSON.stringify(extra)), _keyOrder: Object.keys(parts) },
    remark: '',
  }
  saving.value = true
  try {
    if (editingId.value) {
      await api.updateFormula(editingId.value, payload)
      message.success('更新成功')
    } else {
      const created = await api.createFormula(payload)
      editingId.value = created.id
      message.success('保存成功')
    }
    await loadList()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function resetNew() {
  editingId.value = null
  formulaName.value = ''
  formulaType.value = ''
  templateKey.value = ''
  square.value = '1.5'
  dimW.value = ''
  dimH.value = ''
  dimH1.value = ''
  dimT.value = '300'
  dimJ.value = ''
  dimS.value = ''
  Object.keys(parts).forEach((k) => delete parts[k])
  Object.keys(countText).forEach((k) => delete countText[k])
  Object.keys(resultText).forEach((k) => delete resultText[k])
  Object.keys(placeholders).forEach((k) => delete placeholders[k])
  glassImages.value = []
  resetExtra()
}

// —— 查询 / 修改 / 删除 ——
const listModal = ref(false)
const listRows = ref<FormulaDto[]>([])
const listLoading = ref(false)
const listSearch = ref('')

const TYPE_LABEL: Record<string, string> = { ...FORMULA_TYPE_LABELS }

const columns: DataTableColumns<FormulaDto> = [
  { title: '名称', key: 'name', minWidth: 140 },
  {
    title: '类型',
    key: 'formula_type',
    width: 130,
    render: (row) => {
      const fine = row.template_key
        ? TEMPLATE_LIST.find((t) => t.key === row.template_key)?.label
        : undefined
      return fine ?? TYPE_LABEL[row.formula_type] ?? (row.formula_type || '-')
    },
  },
  {
    title: '门洞宽×高',
    key: 'size',
    width: 130,
    render: (row) => `${row.door_width || '-'} × ${row.door_height || '-'}`,
  },
  { title: '更新时间', key: 'updated_at', width: 170 },
  {
    title: '操作',
    key: 'actions',
    width: 170,
    render: (row) =>
      h(NSpace, { size: 4 }, {
        default: () => [
          h(
            NButton,
            { size: 'small', type: 'primary', onClick: () => editFormula(row.id) },
            { default: () => '修改' },
          ),
          h(NButton, { size: 'small', onClick: () => copyFormula(row.id) }, { default: () => '复制' }),
          h(NButton, { size: 'small', type: 'error', onClick: () => removeFormula(row) }, { default: () => '删除' }),
        ],
      }),
  },
]

async function loadList() {
  listLoading.value = true
  try {
    listRows.value = await api.listFormulas(listSearch.value.trim() || undefined)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    listLoading.value = false
  }
}

function openList() {
  listSearch.value = ''
  listModal.value = true
  loadList()
}

async function loadFormula(id: number, asCopy: boolean) {
  try {
    const f = await api.getFormula(id)
    // 加载成功就把编辑器放出来 —— 旧版 `_0x23658f` 里 `queryFormula` 返回 200 后正是这么做的
    // （`_0x579c3d["value"]=!0`，见 `editorVisible` 的注释）。**照抄，不是偏离。**
    editorVisible.value = true
    editingId.value = asCopy ? null : f.id
    formulaName.value = asCopy ? '' : f.name
    formulaType.value = f.formula_type
    templateKey.value = f.template_key
    const ex = normalizeExtra(f.extra)
    Object.keys(extra).forEach((k) => delete (extra as Record<string, unknown>)[k])
    Object.assign(extra, ex)
    const sq = normalizeSquare(f.square, f.formula_type)
    if (typeof sq === 'number') {
      square.value = String(sq)
      Object.keys(minSquare).forEach((k) => delete minSquare[k])
    } else {
      square.value = '0'
      Object.keys(minSquare).forEach((k) => delete minSquare[k])
      Object.assign(minSquare, sq)
    }
    dimW.value = f.door_width
    dimH.value = f.door_height
    dimH1.value = f.light_window_height
    dimT.value = f.wall_thickness
    dimJ.value = f.jiao
    dimS.value = f.mother_door_width
    const p =
      f.parts && typeof f.parts === 'object' && !Array.isArray(f.parts)
        ? (f.parts as unknown as PartsMap)
        : {}
    Object.keys(parts).forEach((k) => delete parts[k])
    Object.assign(parts, p)
    delete parts['挖孔图'] // 旧版哨兵/历史脏数据：加载时剔除，不进明细行
    // 尺寸补齐要排在 `refreshPlaceholders()` **之前** —— 它按当前尺寸算占位值。见函数注释。
    fillEmptyDims()
    syncRowTexts()
    refreshPlaceholders()
    listModal.value = false
    await syncGlass()
    if (asCopy) message.success('已复制公式，请修改名称后保存')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  }
}

function editFormula(id: number) {
  loadFormula(id, false)
}

function copyFormula(id: number) {
  loadFormula(id, true)
}

/**
 * 删除公式的确认框 —— 复刻旧版 `_0x436e63`（`Diao.deobfuscated.js:2250-2251`）那句
 * `ElMessageBox.confirm("确定要删除该公式吗？此操作不可恢复。", "删除确认",
 *   { confirmButtonText:"确定", cancelButtonText:"取消", type:"warning" })`。
 *
 * ⚠️ **两处与旧版逐字对齐，别"顺手优化"**：
 * 1. 文案里**没有公式名**。我们原先用的是原生 `window.confirm` 且带了名字
 *    （`确定要删除公式「X」吗？…`）—— 旧版没有，这里照旧版。
 *    （旧版只有「一个自动完成框 + 一颗删除按钮」，本就没有"当前行"可言；
 *      我们是表格逐行按钮，名字确实更有用 —— 要加回去是一行的事，但那是**偏离**，得先拍板。）
 * 2. 按钮是 **确定/取消**，不是 naive 默认的「确认/取消」。
 */
function confirmDeleteFormula(): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.warning({
      title: '删除确认',
      content: '确定要删除该公式吗？此操作不可恢复。',
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
    })
  })
}

async function removeFormula(row: FormulaDto) {
  if (!(await confirmDeleteFormula())) return
  try {
    await api.deleteFormula(row.id)
    message.success('删除成功')
    if (editingId.value === row.id) resetNew()
    loadList()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '删除失败')
  }
}

// —— 开孔图 ——
const glassModal = ref(false)

// —— 材料搜索（复刻旧版 _0x5746ef 按 materialName/name/track/color 过滤）——
const materialSearch = ref('')
const filteredRows = computed(() => {
  const q = materialSearch.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(
    (r) =>
      (r.def.materialName || '').toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      (r.def.track || '').toLowerCase().includes(q) ||
      (r.def.color || '').toLowerCase().includes(q),
  )
})

// —— 挖孔图图片（独立表 formula_images，复刻旧版 _0x44ca5e 下方展示；不再使用旧版“挖孔图”哨兵部件键）——
const glassImages = ref<FormulaImageDto[]>([])

async function syncGlass() {
  if (!editingId.value) {
    glassImages.value = []
    return
  }
  try {
    glassImages.value = await api.listFormulaImages(editingId.value)
  } catch {
    glassImages.value = []
  }
}

// —— 亮窗示意图 ——
const lightWindowModal = ref(false)

// —— 视频教程（外链抖音，复刻旧版 _0x244224）——
const videoDrawer = ref(false)
const VIDEO_LINKS: Array<[string, string]> = [
  ['平开门公式', 'https://v.douyin.com/vpV0QTlRZpU/'],
  ['平开门前后框', 'https://v.douyin.com/vLhnLdKUz8E/'],
  ['推拉门公式', 'https://v.douyin.com/6-0MqxeHo6I/'],
  ['3联动等', 'https://v.douyin.com/XhyVP2og9nc/'],
  ['推拉门添加下轨', 'https://v.douyin.com/m4HoSXc41Po/'],
  ['推拉门增加亮窗', 'https://v.douyin.com/P8HTfKjE1JE/'],
  ['复制公式', 'https://v.douyin.com/hEavI9pRzAI/'],
  ['哑口套公式', 'https://v.douyin.com/rKMP-5X9940/'],
  ['屏风公式', 'https://v.douyin.com/T9Oz-rhmiR0/'],
  ['查询删除公式', 'https://v.douyin.com/LvdolhhCswk/'],
]
function openVideo(link: string) {
  window.open(link, '_blank')
}

onMounted(() => {
  // 还**不认为**自己是管理员时补一次 `/me` —— 这一句同时兜住「刷新瞬间 role 还是空」：
  // 那时 `isAdmin(undefined)` = `false` ⇒ 补拉一次，role 到位后两颗按钮才显出来。
  if (!isAdmin(auth.user?.role)) auth.loadMe()
})
</script>

<template>
  <div class="formula-page">
    <div class="formula-page__inner">
      <header class="formula-hero" aria-labelledby="formula-page-title">
        <div class="formula-hero__identity">
          <div class="formula-mark" aria-hidden="true">
            <span>ƒ</span><small>x</small>
          </div>
          <div class="formula-hero__copy">
            <div class="formula-eyebrow">产品数据 · 计算规则</div>
            <h1 id="formula-page-title">公式工作台</h1>
            <p>集中维护门型尺寸、材料计算与配件规则，减少录入与校验之间的来回切换。</p>
          </div>
        </div>
        <div class="formula-hero__status" :class="{ 'is-active': editorVisible }">
          <span class="formula-status-dot" aria-hidden="true"></span>
          <div>
            <span>当前状态</span>
            <strong>{{ editorVisible ? (editingId ? '正在修改' : '新建公式') : '等待选择' }}</strong>
          </div>
        </div>
      </header>

      <main class="formula-workbench">
        <div class="formula-workbench__toolbar">
          <div class="formula-context">
            <div class="formula-context__topline">
              <span class="formula-context__label">当前公式</span>
              <span v-if="editorVisible" class="formula-context__type">
                {{ TYPE_LABEL[formulaType] || '未选择门型' }}
              </span>
            </div>
            <h2>{{ formulaName || (editorVisible ? '未命名公式' : '尚未打开公式') }}</h2>
            <p>
              {{
                editorVisible
                  ? `已载入 ${filteredRows.length} 项材料规则，请按流程完成校验并保存。`
                  : '从门型模板开始，或打开已有公式继续维护。'
              }}
            </p>
          </div>

          <div class="formula-toolbar-actions" aria-label="公式工作台操作">
            <!-- 旧版这颗按钮点下去就把编辑器放出来（`D:1178` 设 `_0x579c3d`）。 -->
            <n-button v-if="isAdminUser" type="primary" @click="openTemplateDrawer">选择模板</n-button>
            <n-button v-if="isAdminUser" @click="openList">管理公式</n-button>
            <n-button secondary @click="glassModal = true">管理开孔图</n-button>
            <n-button secondary @click="videoDrawer = true">操作教程</n-button>
          </div>
        </div>

        <div v-if="!editorVisible" class="formula-empty">
          <div class="formula-empty__symbol" aria-hidden="true">
            <span class="formula-empty__line"></span>
            <span class="formula-empty__operator">=</span>
            <span class="formula-empty__result">ƒx</span>
          </div>
          <div class="formula-empty__copy">
            <span class="formula-eyebrow">标准工作流</span>
            <h2>先选择门型，再开始配置</h2>
            <p>公式模板会带入对应材料规则，后续只需确认尺寸、附加条件和计算结果。</p>
          </div>
          <ol class="formula-empty__steps">
            <li><span>01</span><div><strong>选择门型模板</strong><small>载入对应的基础材料结构</small></div></li>
            <li><span>02</span><div><strong>确认基础尺寸</strong><small>补全门洞与工艺参数</small></div></li>
            <li><span>03</span><div><strong>校验并保存</strong><small>检查材料结果后提交公式</small></div></li>
          </ol>
        </div>

        <div v-show="editorVisible" class="formula-editor">
          <!-- 尺寸区 / 配置区 / 搜索区 三块都受 `editorVisible` 控制 —— 复刻旧版把这一整片
               包在一个 `v-show="_0x579c3d"` 里（`Diao.deobfuscated.js:3365-3428`）。 -->
          <section class="formula-section" aria-labelledby="formula-dimensions-title">
            <div class="formula-section__heading">
              <span class="formula-section__index">01</span>
              <div>
                <h3 id="formula-dimensions-title">基础尺寸</h3>
                <p>确认名称与门洞参数，失焦后自动重新计算。</p>
              </div>
            </div>
            <div class="dims">
              <div class="dim-item dim-item--name">
                <label>公式名称</label>
                <n-input v-model:value="formulaName" size="small" class="formula-name-input" />
              </div>
              <div v-if="isSimpleSquare" class="dim-item">
                <label>单扇最小平方数</label>
                <n-input v-model:value="square" size="small" class="dimension-input" @blur="squareBlur" />
              </div>
              <div v-if="!isSimpleSquare" class="dim-item dim-item--action">
                <label>最低方数</label>
                <n-button size="small" @click="openMinSquare">移门最低方数设置</n-button>
              </div>
              <div class="dim-item">
                <label>门洞高</label>
                <n-input v-model:value="dimH" size="small" class="dimension-input" @blur="dimBlur('h')" />
              </div>
              <div class="dim-item">
                <label>{{ dimLabel('w') }}</label>
                <n-input v-model:value="dimW" size="small" class="dimension-input" @blur="dimBlur('w')" />
              </div>
              <div v-if="isSubsidiary" class="dim-item">
                <label>母门宽</label>
                <n-input v-model:value="dimS" size="small" class="dimension-input" @blur="dimBlur('s')" />
              </div>
              <div class="dim-item">
                <label>{{ dimLabel('h1') }}</label>
                <n-input v-model:value="dimH1" size="small" class="dimension-input" @blur="dimBlur('h1')" />
              </div>
              <div class="dim-item">
                <label>{{ dimLabel('t') }}</label>
                <n-input v-model:value="dimT" size="small" class="dimension-input" @blur="dimBlur('t')" />
              </div>
              <div v-if="showJiao" class="dim-item">
                <label>吊脚</label>
                <n-input v-model:value="dimJ" size="small" class="dimension-input" @blur="dimBlur('j')" />
              </div>
            </div>
          </section>

          <section class="formula-section" aria-labelledby="formula-config-title">
            <div class="formula-section__heading">
              <span class="formula-section__index">02</span>
              <div>
                <h3 id="formula-config-title">附加规则</h3>
                <p>按需设置减尺、丁墙、合页与固定配件等工艺条件。</p>
              </div>
            </div>
            <div class="config-row">
              <div class="config-item">
                <n-button size="small" @click="openResetSize">洞尺设置</n-button>
                <span class="config-summary">{{ resetSizeSummary || '未设置' }}</span>
              </div>
              <div class="config-item">
                <n-button size="small" @click="openTaoDong">包边洞尺</n-button>
                <span class="config-summary">{{ taoDongSummary || '未设置' }}</span>
              </div>
              <div class="config-item">
                <n-button size="small" @click="openSwingWall">平开门丁墙</n-button>
                <span class="config-summary">{{ swingWallSummary || '未设置' }}</span>
              </div>
              <div class="config-item">
                <n-button size="small" @click="openHinge">平开门合页</n-button>
                <span class="config-summary config-summary-multi">{{ hingeSummary || '未设置' }}</span>
              </div>
              <div class="config-item">
                <n-button size="small" @click="openWidthIncrement">边封增量</n-button>
                <span class="config-summary">{{ widthIncrementSummary || '未设置' }}</span>
              </div>
              <div class="config-item">
                <n-button size="small" @click="openHardware">固定配件</n-button>
                <span class="config-summary">{{ hardwareSummary || '未设置' }}</span>
              </div>
            </div>
          </section>

          <section class="formula-section formula-section--materials" aria-labelledby="formula-materials-title">
            <div class="formula-section__heading formula-section__heading--split">
              <div class="formula-section__heading-main">
                <span class="formula-section__index">03</span>
                <div>
                  <h3 id="formula-materials-title">材料计算</h3>
                  <p>共 {{ filteredRows.length }} 项规则；可搜索、复制或补充材料。</p>
                </div>
              </div>
              <div class="search-row">
                <n-input
                  v-model:value="materialSearch"
                  placeholder="搜索材料名称，如：光企"
                  clearable
                  size="small"
                  class="material-search-input"
                />
                <n-button size="small" @click="lightWindowModal = true">亮窗示意图</n-button>
              </div>
            </div>

            <!-- 部件表。结构与类名照抄原版（旧版是 el-table，列宽固定像素；
                 四个类的样式来自 legacy/css/Diao-15870f7d.css 的 [data-v-6ed0eb3d] 作用域）。 -->
            <div class="parts-table-shell" tabindex="0" aria-label="材料计算表，可横向滚动">
              <table class="parts-table">
                <thead>
                  <tr>
                    <th>材料名</th>
                    <th>数量</th>
                    <th>计算结果</th>
                    <th>操作</th>
                    <th>公式类别</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in filteredRows" :key="row.name" :style="{ background: rowBg(row.def.color) }">
                    <!-- 材料名格（原版 @236617-237600）：`glass-inputs-container2` >(`glass-input-group` > tooltip+输入框)；
                         部件带 `title` 时，再跟一个 `glass-input-label` + 第二个输入框。 -->
                    <td>
                      <div class="glass-inputs-container2">
                        <div class="glass-input-group">
                          <n-tooltip
                            :content="(row.name || '无公式类别').split('_')[0]"
                            placement="top"
                            :delay="100"
                            :duration="100"
                          >
                            <template #trigger>
                              <n-input
                                class="formula-input"
                                size="small"
                                v-model:value="row.def.materialName"
                                @blur="refreshPlaceholders"
                              />
                            </template>
                          </n-tooltip>
                        </div>
                        <template v-if="row.def.title">
                          <div class="glass-input-label">{{ row.def.title }}</div>
                          <div class="glass-input-group">
                            <n-input
                              class="formula-input"
                              size="small"
                              :value="row.def.track"
                              @update:value="(v: string) => onTrackInput(row, v)"
                              @blur="onTrackBlur()"
                            />
                          </div>
                        </template>
                      </div>
                    </td>
                    <td>
                      <n-input
                        class="formula-input"
                        :value="countText[row.name]"
                        size="small"
                        @update:value="(v: string) => (countText[row.name] = v)"
                        @blur="quantityBlur(row.name)"
                      />
                    </td>
                    <td>
                      <n-tooltip
                        :content="(row.name || '无公式类别').split('_')[0]"
                        placement="top"
                        :delay="100"
                        :duration="100"
                      >
                        <template #trigger>
                          <n-input
                            class="formula-input"
                            :value="resultText[row.name]"
                            :placeholder="placeholderText(row.name)"
                            size="small"
                            @update:value="(v: string) => (resultText[row.name] = v)"
                            @blur="resultBlur(row.name)"
                          />
                        </template>
                      </n-tooltip>
                    </td>
                    <td>
                      <div class="row-actions">
                        <n-popconfirm
                          positive-text="确定"
                          negative-text="取消"
                          @positive-click="deleteRow(row.name)"
                        >
                          <template #trigger>
                            <n-button size="small" text type="error">删除</n-button>
                          </template>
                          确定删除该行吗?
                        </n-popconfirm>
                        <n-button size="small" text type="primary" @click="copyRow(row.name)">复制</n-button>
                      </div>
                    </td>
                    <td class="cat-cell">{{ row.name }}</td>
                  </tr>
                  <tr v-if="filteredRows.length === 0">
                    <td colspan="5" class="empty-cell">没有匹配的材料规则，请调整搜索条件或新增材料。</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 内联挖孔图展示（复刻旧版 _0x44ca5e） -->
            <div v-if="glassImages.length" class="glass-images">
              <div v-for="img in glassImages" :key="img.id" class="glass-image-item">
                <img :src="img.data_url" :alt="img.direction" />
                <div class="glass-image-dir">{{ img.direction }}{{ img.mirrored ? '（镜像）' : '' }}</div>
              </div>
            </div>

            <!-- 表格下方操作（复刻旧版「新增材料」+「确认」） -->
            <div class="formula-actions">
              <n-button @click="addMaterialDrawer = true">新增材料</n-button>
              <n-button type="primary" :loading="saving" @click="save">保存公式</n-button>
            </div>
          </section>
        </div>
      </main>
    </div>
    <!-- 查询 / 修改 / 删除 -->
    <n-modal v-model:show="listModal">
      <n-card style="width: min(820px, calc(100vw - 24px))" title="查询 / 修改 / 删除公式" :bordered="false" role="dialog">
        <div class="list-toolbar">
          <n-input
            v-model:value="listSearch"
            placeholder="搜索公式名称"
            clearable
            style="width: 220px"
            @keyup.enter="loadList"
          />
          <n-button type="primary" @click="loadList">查询</n-button>
        </div>
        <n-data-table
          :columns="columns"
          :data="listRows"
          :loading="listLoading"
          :bordered="true"
          :row-key="(r: FormulaDto) => r.id"
          :pagination="{ pageSize: 8 }"
          style="margin-top: 12px"
        />
      </n-card>
    </n-modal>

    <!-- 公式模板 -->
    <n-drawer v-model:show="templateDrawer" placement="right" width="min(420px, 100vw)">
      <n-drawer-content title="公式模板" closable>
        <div class="tpl-group">
        <div
          v-for="tpl in TEMPLATE_LIST"
          :key="tpl.key"
          class="tpl-btn"
          @click="applyTemplate(tpl.key)"
        >
          <span class="tpl-label">{{ tpl.label }}</span>
          <span class="tpl-key">{{ tpl.key }}</span>
        </div>
        </div>
      </n-drawer-content>
    </n-drawer>

    <!-- 必填参数弹窗（复刻旧版 requiredFieldsDialog） -->
    <n-modal v-model:show="requiredFieldsModal">
      <n-card style="width: min(420px, calc(100vw - 24px))" title="请填写必要参数" :bordered="false" role="dialog">
        <div class="cfg-form">
          <label>公式名称:</label>
          <n-input v-model:value="formulaName" size="small" placeholder="请输入公式名称" style="width: 220px" />
        </div>
        <div v-if="isSimpleSquare" class="cfg-form">
          <label>单扇最小平方数:</label>
          <n-input v-model:value="square" size="small" placeholder="请输入最小平方数" style="width: 120px" @blur="squareBlur" />
        </div>
        <div class="cfg-form">
          <label>门洞高:</label>
          <n-input v-model:value="dimH" size="small" placeholder="请输入门洞高" style="width: 120px" @blur="dimBlur('h')" />
        </div>
        <div class="cfg-form">
          <label>{{ dimLabel('w') }}:</label>
          <n-input v-model:value="dimW" size="small" :placeholder="'请输入' + dimLabel('w')" style="width: 120px" @blur="dimBlur('w')" />
        </div>
        <div v-if="isSubsidiary" class="cfg-form">
          <label>母门宽:</label>
          <n-input v-model:value="dimS" size="small" placeholder="请输入母门宽" style="width: 120px" @blur="dimBlur('s')" />
        </div>
        <div class="cfg-form">
          <label>{{ dimLabel('t') }}:</label>
          <n-input v-model:value="dimT" size="small" :placeholder="'请输入' + dimLabel('t')" style="width: 120px" @blur="dimBlur('t')" />
        </div>
        <div v-if="showJiaoInDialog" class="cfg-form">
          <label>吊脚:</label>
          <n-input v-model:value="dimJ" size="small" placeholder="请输入吊脚" style="width: 120px" @blur="dimBlur('j')" />
        </div>
        <div class="cfg-form">
          <label>{{ dimLabel('h1') }}:</label>
          <n-input v-model:value="dimH1" size="small" :placeholder="'请输入' + dimLabel('h1')" style="width: 120px" @blur="dimBlur('h1')" />
        </div>
        <template #footer>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <n-button v-if="!isSimpleSquare" size="small" @click="openMinSquare">移门最低方数设置</n-button>
            <n-space>
              <n-button @click="requiredFieldsModal = false">取消</n-button>
              <n-button type="primary" @click="confirmRequiredFields">确认</n-button>
            </n-space>
          </div>
        </template>
      </n-card>
    </n-modal>

    <!-- 添加材料 -->
    <n-drawer v-model:show="addMaterialDrawer" placement="right" width="min(460px, 100vw)">
      <n-drawer-content title="添加材料" closable>
      <!-- ⚠️「常规材料」= **撤销删除**（见 `deletedStash` 的注释），不是"常用材料库"。
           标题**恒显**（旧版那个 `<h3>` 是静态节点，没有 v-if），按钮才看有没有删过的行。 -->
      <div class="mat-section">
        <h3>常规材料</h3>
        <div class="mat-grid">
          <n-button
            v-for="(def, name) in deletedStash"
            :key="name"
            size="small"
            @click="restoreDeleted(String(name))"
          >
            {{ def.materialName }}
          </n-button>
        </div>
      </div>
      <div class="mat-section">
        <h3>新增材料</h3>
        <div class="mat-grid">
          <n-button
            v-for="(_, g) in EXTRA_MATERIAL_GROUPS"
            :key="g"
            size="small"
            @click="addGroup(g)"
          >
            {{ g }}
          </n-button>
        </div>
      </div>
      <div class="mat-section">
        <h3>已有材料</h3>
        <div v-for="(_, typeKey) in MATERIAL_LIBRARY" :key="typeKey" class="mat-group">
          <h4>{{ materialTypeLabel(typeKey) }}</h4>
          <div class="mat-grid">
            <n-button
              v-for="(def, name) in MATERIAL_LIBRARY[typeKey]"
              :key="name"
              size="small"
              @click="addMaterial(typeKey, name)"
            >
              {{ def.materialName }}
            </n-button>
          </div>
        </div>
      </div>
      </n-drawer-content>
    </n-drawer>

    <!-- 开孔图 -->
    <n-modal v-model:show="glassModal">
      <n-card style="width: min(720px, calc(100vw - 24px))" title="挖孔图（玻璃开孔图）" :bordered="false" role="dialog">
        <GlassDraw
          :formula-id="editingId"
          :formula-name="formulaName"
          :formula-type="formulaType"
          @updated="syncGlass"
        />
      </n-card>
    </n-modal>

    <!-- 洞尺设置 -->
    <n-modal v-model:show="resetSizeOpen">
      <!-- ⚠️ 标题是「洞尺减尺」而**不是**触发它的那颗按钮文案「洞尺设置」——
           旧版这两处本来就不一样（`Diao.deobfuscated.js:3811` / 按钮 `:3407`）。
           同类的还有「平开门单双丁」「增量设置」，见各自弹窗上的注释。 -->
      <n-card style="width: min(400px, calc(100vw - 24px))" title="洞尺减尺" :bordered="false" role="dialog">
        <div class="cfg-form">
          <label>宽减:</label>
          <n-input v-model:value="resetSizeDraft.width" size="small" style="width: 160px" />
        </div>
        <div class="cfg-form">
          <label>高减:</label>
          <n-input v-model:value="resetSizeDraft.height" size="small" style="width: 160px" />
        </div>
        <template #footer>
          <n-space justify="end">
            <n-button @click="resetSizeOpen = false">取消</n-button>
            <n-button type="primary" @click="confirmResetSize">确认</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>

    <!-- 包边洞尺 -->
    <n-modal v-model:show="taoDongOpen">
      <n-card style="width: min(460px, calc(100vw - 24px))" title="包边洞尺" :bordered="false" role="dialog">
        <div class="cfg-form">
          <label>单包边洞 宽减:</label>
          <n-input v-model:value="taoDongDraft.sKuan" size="small" style="width: 120px" />
          <label>高减:</label>
          <n-input v-model:value="taoDongDraft.sGao" size="small" style="width: 120px" />
        </div>
        <div class="cfg-form">
          <label>双包边洞 宽减:</label>
          <n-input v-model:value="taoDongDraft.dKuan" size="small" style="width: 120px" />
          <label>高减:</label>
          <n-input v-model:value="taoDongDraft.dGao" size="small" style="width: 120px" />
        </div>
        <template #footer>
          <n-space justify="end">
            <n-button @click="taoDongOpen = false">取消</n-button>
            <n-button type="primary" @click="confirmTaoDong">确认</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>

    <!-- 平开门丁墙 -->
    <n-modal v-model:show="swingWallOpen">
      <!-- ⚠️ 标题是「平开门单双丁」，按钮文案才是「平开门丁墙」（旧版 `:3895` / `:3415`）。 -->
      <n-card style="width: min(440px, calc(100vw - 24px))" title="平开门单双丁" :bordered="false" role="dialog">
        <div class="cfg-form">
          <label>单丁:</label>
          <n-input v-model:value="swingWallDraft.SingleWall" size="small" style="width: 120px" />
          <label>双丁:</label>
          <n-input v-model:value="swingWallDraft.DoubleWall" size="small" style="width: 120px" />
          <label>上丁:</label>
          <n-input v-model:value="swingWallDraft.UpWall" size="small" style="width: 120px" />
        </div>
        <template #footer>
          <n-space justify="end">
            <n-button @click="swingWallOpen = false">取消</n-button>
            <n-button type="primary" @click="confirmSwingWall">确认</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>

    <!-- 平开门合页 -->
    <n-modal v-model:show="hingeOpen">
      <n-card style="width: min(560px, calc(100vw - 24px))" title="平开门合页" :bordered="false" role="dialog">
        <div v-for="(it, i) in hingeDraft" :key="i" class="cfg-form">
          <n-input v-model:value="it.name" size="small" placeholder="合页名称" style="width: 140px" />
          <n-input
            v-model:value="it.topBottomReduce"
            size="small"
            placeholder="上下方减尺"
            style="width: 130px"
          />
          <n-input
            v-model:value="it.lightDoorReduce"
            size="small"
            placeholder="光企减尺寸"
            style="width: 130px"
          />
          <n-button size="tiny" quaternary type="error" @click="removeHingeRow(i)">删除</n-button>
        </div>
        <n-button size="small" dashed block @click="addHingeRow">+ 添加合页</n-button>
        <template #footer>
          <n-space justify="end">
            <n-button @click="hingeOpen = false">取消</n-button>
            <n-button type="primary" @click="confirmHinge">确认</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>

    <!-- 边封增量 -->
    <n-modal v-model:show="widthIncrementOpen">
      <!-- ⚠️ 标题是「增量设置」，按钮文案才是「边封增量」（旧版 `:3996` / `:3423`）。 -->
      <n-card style="width: min(440px, calc(100vw - 24px))" title="增量设置" :bordered="false" role="dialog">
        <div class="cfg-form">
          <label>边封增量:</label>
          <n-input
            v-model:value="widthIncrementDraft.SheetIncrement"
            size="small"
            style="width: 120px"
          />
          <label>轨道增量:</label>
          <n-input
            v-model:value="widthIncrementDraft.TrackIncrement"
            size="small"
            style="width: 120px"
          />
        </div>
        <template #footer>
          <n-space justify="end">
            <n-button @click="widthIncrementOpen = false">取消</n-button>
            <n-button type="primary" @click="confirmWidthIncrement">确认</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>

    <!-- 固定配件 -->
    <n-modal v-model:show="hardwareOpen">
      <n-card style="width: min(520px, calc(100vw - 24px))" title="配件设置" :bordered="false" role="dialog">
        <n-input
          v-model:value="hardwareDraft"
          type="textarea"
          :autosize="{ minRows: 6, maxRows: 14 }"
          placeholder="请输入配件信息（支持换行和空格）"
        />
        <template #footer>
          <n-space justify="end">
            <n-button @click="hardwareOpen = false">取消</n-button>
            <n-button type="primary" @click="confirmHardware">确认</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>

    <!-- 移门最低方数设置 -->
    <n-modal v-model:show="minSquareOpen">
      <n-card style="width: min(520px, calc(100vw - 24px))" title="移门最低方数设置" :bordered="false" role="dialog">
        <div class="min-square-header">
          <span class="min-square-type">类型</span>
          <span class="min-square-col">无亮窗</span>
          <span class="min-square-col">亮窗</span>
        </div>
        <div v-for="k in MIN_SQUARE_TYPES" :key="k" class="min-square-row">
          <label class="min-square-type">{{ k }}:</label>
          <n-input v-model:value="minSquareDraft[k].noLight" size="small" class="min-square-col" />
          <n-input v-model:value="minSquareDraft[k].light" size="small" class="min-square-col" />
        </div>
        <template #footer>
          <n-space justify="end">
            <n-button @click="minSquareOpen = false">取消</n-button>
            <n-button type="primary" @click="confirmMinSquare">确认</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>

    <!-- 亮窗示意图 -->
    <n-modal v-model:show="lightWindowModal">
      <n-card style="width: min(480px, calc(100vw - 24px))" title="亮窗示意图" :bordered="false" role="dialog">
        <div class="light-window-diagram">
          <svg :width="300" :height="420" viewBox="0 0 300 420">
            <rect x="60" y="30" width="180" height="90" fill="#f0f6ff" stroke="#333" stroke-width="2" />
            <text x="150" y="82" text-anchor="middle" font-size="14">上亮（亮窗）</text>
            <rect x="60" y="120" width="180" height="240" fill="#f5f7fa" stroke="#333" stroke-width="2" />
            <text x="150" y="245" text-anchor="middle" font-size="14">门扇</text>
            <line x1="258" y1="30" x2="258" y2="120" stroke="#e74c3c" stroke-width="2" />
            <text x="270" y="80" font-size="13" fill="#e74c3c">h1</text>
            <line x1="282" y1="120" x2="282" y2="360" stroke="#e67e22" stroke-width="2" />
            <text x="270" y="245" font-size="13" fill="#e67e22">h</text>
            <line x1="60" y1="380" x2="240" y2="380" stroke="#2e86de" stroke-width="2" />
            <text x="150" y="396" text-anchor="middle" font-size="13" fill="#2e86de">w（门洞宽）</text>
          </svg>
          <div class="light-window-legend">
            <p><b>门洞高 h</b>：门扇从地面到上亮下沿的高度</p>
            <p><b>亮窗总高 h1</b>：含上亮在内的整门高度（h1 = h + 上亮高）</p>
            <p><b>门洞宽 w</b>：门的宽度</p>
            <p><b>墙厚 t</b>：墙体厚度</p>
          </div>
        </div>
        <template #footer>
          <n-space justify="end">
            <n-button @click="lightWindowModal = false">关闭</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>

    <!-- 视频教程 -->
    <n-drawer v-model:show="videoDrawer" placement="right" width="min(320px, 100vw)">
      <n-drawer-content title="视频教程" closable>
        <div class="video-list">
        <n-button
          v-for="[label, link] in VIDEO_LINKS"
          :key="label"
          size="small"
          @click="openVideo(link)"
        >
          {{ label }}
        </n-button>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.formula-page {
  min-height: 100vh;
  padding: var(--sd-page-padding);
  background: var(--sd-color-bg-page);
  color: var(--sd-color-text);
  font-family: var(--sd-font-sans);
}

.formula-page__inner {
  display: grid;
  gap: var(--sd-page-gap);
  width: min(100%, var(--sd-content-max-width));
  margin: 0 auto;
}

.formula-hero,
.formula-workbench {
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  background: var(--sd-material-surface);
  box-shadow: var(--sd-shadow-material-card);
  backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
}

.formula-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sd-space-8);
  padding: var(--sd-space-6) var(--sd-space-7);
  border-radius: var(--sd-radius-material);
  animation: formula-surface-enter var(--sd-duration-enter) var(--sd-ease-enter) both;
}

.formula-hero__identity {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--sd-space-5);
}

.formula-mark {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 72px;
  width: 72px;
  height: 72px;
  border: var(--sd-border-width) solid var(--sd-border-action-subtle);
  border-radius: var(--sd-radius-card);
  background: var(--sd-material-brand-glass);
  color: var(--sd-color-action);
  box-shadow: var(--sd-shadow-brand-mark);
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1;
}

.formula-mark::after {
  content: "";
  position: absolute;
  inset: var(--sd-space-2);
  border: var(--sd-border-width) solid var(--sd-border-action-faint);
  border-radius: var(--sd-radius-md);
  pointer-events: none;
}

.formula-mark span {
  transform: translate(-2px, 1px);
  font-size: var(--sd-font-size-display);
  font-style: italic;
}

.formula-mark small {
  position: absolute;
  right: 16px;
  bottom: 14px;
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-bold);
}

.formula-eyebrow {
  color: var(--sd-color-action);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: var(--sd-letter-spacing-eyebrow);
  text-transform: uppercase;
}

.formula-hero__copy h1 {
  margin: var(--sd-space-1) 0 var(--sd-space-1-5);
  color: var(--sd-color-text-strong);
  font-size: clamp(var(--sd-font-size-2xl), 3vw, var(--sd-font-size-3xl));
  font-weight: var(--sd-font-weight-bold);
  line-height: var(--sd-line-height-tight);
  letter-spacing: -0.025em;
}

.formula-hero__copy p,
.formula-context p,
.formula-section__heading p,
.formula-empty__copy p {
  margin: 0;
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-sm);
  line-height: var(--sd-line-height-base);
}

.formula-hero__status {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: var(--sd-space-3);
  min-width: 148px;
  padding: var(--sd-space-3) var(--sd-space-4);
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-control);
  background: var(--sd-material-control);
}

.formula-hero__status > div {
  display: grid;
  gap: 2px;
}

.formula-hero__status span:not(.formula-status-dot) {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

.formula-hero__status strong {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
}

.formula-status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-text-disabled);
  box-shadow: var(--sd-shadow-status-soft);
  transition:
    background var(--sd-duration-base) var(--sd-ease-standard),
    box-shadow var(--sd-duration-base) var(--sd-ease-standard);
}

.formula-hero__status.is-active .formula-status-dot {
  background: var(--sd-color-success);
  box-shadow: var(--sd-shadow-status);
}

.formula-workbench {
  overflow: hidden;
  border-radius: var(--sd-radius-material);
  animation: formula-surface-enter var(--sd-duration-enter) var(--sd-ease-enter) 50ms both;
}

.formula-workbench__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sd-space-6);
  padding: var(--sd-space-5) var(--sd-space-6);
  border-bottom: var(--sd-border-width) solid var(--sd-border-glass-divider);
  background: var(--sd-material-surface-strong);
}

.formula-context {
  min-width: 220px;
}

.formula-context__topline {
  display: flex;
  align-items: center;
  gap: var(--sd-space-2);
}

.formula-context__label {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-strong);
  letter-spacing: 0.04em;
}

.formula-context__type {
  padding: 2px var(--sd-space-2);
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-action-soft);
  color: var(--sd-color-action);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-bold);
}

.formula-context h2 {
  margin: var(--sd-space-1) 0 2px;
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-xl);
  font-weight: var(--sd-font-weight-bold);
  line-height: var(--sd-line-height-tight);
}

.formula-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--sd-space-2);
}

.formula-page :deep(.n-button) {
  border-radius: var(--sd-radius-control);
  font-weight: var(--sd-font-weight-medium);
  transition:
    transform var(--sd-duration-fast) var(--sd-ease-standard),
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard),
    color var(--sd-duration-fast) var(--sd-ease-standard),
    background-color var(--sd-duration-fast) var(--sd-ease-standard);
}

.formula-page :deep(.n-button:not(.n-button--disabled):hover) {
  transform: translateY(var(--sd-motion-hover-y));
}

.formula-page :deep(.n-button:not(.n-button--disabled):active) {
  transform: scale(var(--sd-motion-press-scale));
}

.formula-page :deep(.n-input) {
  border-radius: var(--sd-radius-control);
  background: var(--sd-material-control);
  transition:
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard),
    background var(--sd-duration-fast) var(--sd-ease-standard);
}

.formula-page :deep(.n-input.n-input--focus) {
  background: var(--sd-material-control-focus);
  box-shadow: var(--sd-focus-ring-soft);
}

.formula-empty {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(240px, 1.15fr) minmax(300px, 1.4fr);
  align-items: center;
  gap: var(--sd-space-8);
  min-height: 320px;
  padding: var(--sd-space-10) clamp(var(--sd-space-6), 5vw, var(--sd-space-14));
  background: var(--sd-color-bg-surface);
}

.formula-empty__symbol {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sd-space-4);
  min-height: 150px;
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-card);
  background: var(--sd-material-highlight-faint);
  color: var(--sd-color-action);
}

.formula-empty__line {
  width: 54px;
  height: 2px;
  background: var(--sd-material-measure-line);
}

.formula-empty__operator {
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-2xl);
  color: var(--sd-color-text-muted);
}

.formula-empty__result {
  font-family: Georgia, "Times New Roman", serif;
  font-size: var(--sd-font-size-3xl);
  font-style: italic;
  font-weight: var(--sd-font-weight-bold);
}

.formula-empty__copy h2 {
  margin: var(--sd-space-2) 0 var(--sd-space-2);
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-xl);
  font-weight: var(--sd-font-weight-bold);
}

.formula-empty__steps {
  display: grid;
  gap: var(--sd-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.formula-empty__steps li {
  display: flex;
  align-items: center;
  gap: var(--sd-space-3);
  padding: var(--sd-space-3);
  border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
}

.formula-empty__steps li:last-child {
  border-bottom: 0;
}

.formula-empty__steps li > span {
  color: var(--sd-color-action);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-bold);
}

.formula-empty__steps li > div {
  display: grid;
  gap: 2px;
}

.formula-empty__steps strong {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-sm);
}

.formula-empty__steps small {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

.formula-editor {
  padding: 0 var(--sd-space-6) var(--sd-space-6);
  background: var(--sd-color-bg-surface);
}

.formula-section {
  padding: var(--sd-space-6) 0;
  border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
}

.formula-section:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.formula-section__heading,
.formula-section__heading-main {
  display: flex;
  align-items: flex-start;
  gap: var(--sd-space-3);
}

.formula-section__heading {
  margin-bottom: var(--sd-space-4);
}

.formula-section__heading--split {
  align-items: center;
  justify-content: space-between;
  gap: var(--sd-space-6);
}

.formula-section__index {
  display: inline-grid;
  place-items: center;
  flex: 0 0 34px;
  width: 34px;
  height: 24px;
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-action-soft);
  color: var(--sd-color-action);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-bold);
}

.formula-section__heading h3 {
  margin: 0 0 2px;
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-lg);
  font-weight: var(--sd-font-weight-bold);
  line-height: var(--sd-line-height-tight);
}

.dims {
  display: grid;
  grid-template-columns: minmax(220px, 1.5fr) repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--sd-space-3);
  padding: var(--sd-space-4);
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-card);
  background: var(--sd-color-bg-subtle);
}

.dim-item {
  display: grid;
  align-content: start;
  gap: var(--sd-space-1-5);
  min-width: 0;
}

.dim-item label,
.cfg-form label {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-strong);
  white-space: nowrap;
}

.dim-item--action :deep(.n-button) {
  width: 100%;
}

.formula-name-input,
.dimension-input,
.material-search-input {
  width: 100%;
}

.config-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sd-space-2);
}

.config-item {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--sd-space-2);
  padding: var(--sd-space-2);
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-control);
  background: var(--sd-color-bg-subtle);
  transition:
    border-color var(--sd-duration-fast) var(--sd-ease-standard),
    background var(--sd-duration-fast) var(--sd-ease-standard);
}

.config-item:hover {
  border-color: var(--sd-color-action-border);
  background: var(--sd-color-bg-hover);
}

.config-item :deep(.n-button) {
  flex: 0 0 auto;
}

.config-summary {
  overflow: hidden;
  min-width: 0;
  color: var(--sd-color-text-muted);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
  line-height: var(--sd-line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-summary-multi {
  white-space: pre-line;
}

.search-row {
  display: flex;
  align-items: center;
  flex: 0 1 390px;
  justify-content: flex-end;
  gap: var(--sd-space-2);
}

.material-search-input {
  max-width: 260px;
}

.parts-table-shell {
  overflow: auto;
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-card);
  background: var(--sd-color-bg-surface);
  outline: none;
  scrollbar-color: var(--sd-color-border) transparent;
  scrollbar-width: thin;
}

.parts-table-shell:focus-visible {
  box-shadow: var(--sd-focus-ring);
}

.parts-table {
  width: 100%;
  min-width: 900px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: var(--sd-font-size-sm);
}

.parts-table th,
.parts-table td {
  height: 46px;
  padding: var(--sd-space-1-5) var(--sd-space-2);
  border-right: var(--sd-border-width) solid var(--sd-color-divider);
  border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
  vertical-align: middle;
}

.parts-table th:last-child,
.parts-table td:last-child {
  border-right: 0;
}

.parts-table tbody tr:last-child td {
  border-bottom: 0;
}

.parts-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--sd-color-bg-subtle);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: 0.02em;
  text-align: center;
}

.parts-table th:nth-child(1) { width: 24%; }
.parts-table th:nth-child(2) { width: 12%; }
.parts-table th:nth-child(3) { width: 22%; }
.parts-table th:nth-child(4) { width: 16%; }
.parts-table th:nth-child(5) { width: 26%; }

.parts-table td {
  overflow: hidden;
  transition: filter var(--sd-duration-fast) var(--sd-ease-standard);
}

.parts-table tbody tr:hover td {
  filter: saturate(1.02) brightness(0.99);
}

.glass-inputs-container2 {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--sd-space-1);
  width: 100%;
}

.glass-input-group {
  display: flex;
  align-items: center;
  width: 100%;
  gap: var(--sd-space-1);
}

.glass-input-group :deep(.n-tooltip-trigger) {
  width: 100%;
}

.glass-input-label {
  color: var(--sd-color-action);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-strong);
  white-space: nowrap;
}

.formula-input {
  width: 100%;
  text-align: center;
}

.formula-input :deep(input) {
  font-family: var(--sd-font-data);
  text-align: center;
}

.cat-cell {
  color: var(--sd-color-text-muted);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
  text-align: center;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sd-space-3);
}

.empty-cell {
  padding: var(--sd-space-8) !important;
  color: var(--sd-color-text-muted);
  text-align: center;
}

.glass-images {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sd-space-3);
  margin-top: var(--sd-space-4);
}

.glass-image-item {
  padding: var(--sd-space-2);
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-control);
  background: var(--sd-color-bg-subtle);
  text-align: center;
}

.glass-image-item img {
  display: block;
  width: 90px;
  height: auto;
  border-radius: var(--sd-radius-xs);
}

.glass-image-dir {
  margin-top: var(--sd-space-1);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

.formula-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sd-space-2);
  padding: var(--sd-space-4) 0 var(--sd-space-1);
}

.formula-actions :deep(.n-button) {
  min-width: 112px;
}

.list-toolbar,
.cfg-form,
.min-square-header,
.min-square-row {
  display: flex;
  align-items: center;
  gap: var(--sd-space-2);
}

.list-toolbar {
  flex-wrap: wrap;
}

.cfg-form {
  flex-wrap: wrap;
  margin-bottom: var(--sd-space-2-5);
}

.min-square-header,
.min-square-row {
  gap: var(--sd-space-2);
}

.min-square-header {
  margin-bottom: var(--sd-space-1-5);
  padding-bottom: var(--sd-space-1-5);
  border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
  color: var(--sd-color-text-strong);
  font-weight: var(--sd-font-weight-strong);
}

.min-square-row {
  margin-bottom: var(--sd-space-1-5);
}

.min-square-type {
  flex: 0 0 120px;
  font-size: var(--sd-font-size-sm);
}

.min-square-col {
  flex: 1;
}

.tpl-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sd-space-2);
  padding: var(--sd-space-2);
}

.tpl-btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sd-space-3);
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-control);
  background: var(--sd-color-bg-surface);
  cursor: pointer;
  transition:
    transform var(--sd-duration-fast) var(--sd-ease-standard),
    border-color var(--sd-duration-fast) var(--sd-ease-standard),
    background var(--sd-duration-fast) var(--sd-ease-standard),
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard);
}

.tpl-btn:hover {
  transform: translateY(var(--sd-motion-hover-y));
  border-color: var(--sd-color-action-border);
  background: var(--sd-color-action-soft);
  box-shadow: var(--sd-shadow-sm);
}

.tpl-btn:active {
  transform: scale(var(--sd-motion-press-scale));
}

.tpl-label {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-md);
  font-weight: var(--sd-font-weight-strong);
}

.tpl-key {
  color: var(--sd-color-text-muted);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
}

.mat-section {
  margin-bottom: var(--sd-space-4);
}

.mat-section h3 {
  margin: 0 0 var(--sd-space-2);
  padding-left: var(--sd-space-2);
  border-left: 3px solid var(--sd-color-action);
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-md);
}

.mat-section h4 {
  margin: var(--sd-space-2) 0 var(--sd-space-1);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-sm);
}

.mat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sd-space-1-5);
}

.mat-group {
  margin-bottom: var(--sd-space-1-5);
}

.video-list {
  display: flex;
  flex-direction: column;
  gap: var(--sd-space-2);
  padding: var(--sd-space-2);
}

.video-list :deep(.n-button) {
  justify-content: flex-start;
}

.light-window-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sd-space-3);
}

.light-window-diagram svg {
  max-width: 100%;
  height: auto;
}

.light-window-legend {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-sm);
  text-align: left;
}

.light-window-legend p {
  margin: var(--sd-space-1) 0;
}

@keyframes formula-surface-enter {
  from {
    opacity: 0;
    transform: translateY(var(--sd-motion-enter-y));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1024px) {
  .formula-hero {
    align-items: flex-start;
  }

  .formula-workbench__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .formula-toolbar-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .formula-empty {
    grid-template-columns: minmax(180px, 0.8fr) minmax(300px, 1.4fr);
  }

  .formula-empty__copy {
    align-self: end;
  }

  .formula-empty__steps {
    grid-column: 1 / -1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .formula-empty__steps li {
    align-items: flex-start;
    border-right: var(--sd-border-width) solid var(--sd-color-divider);
    border-bottom: 0;
  }

  .formula-empty__steps li:last-child {
    border-right: 0;
  }

  .config-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .formula-section__heading--split {
    align-items: flex-start;
    flex-direction: column;
  }

  .search-row {
    flex-basis: auto;
    justify-content: flex-start;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .formula-page {
    padding-bottom: calc(var(--sd-shell-mobile-dock-reserve) + var(--sd-page-padding));
  }

  .formula-hero {
    align-items: stretch;
    flex-direction: column;
    gap: var(--sd-space-4);
    padding: var(--sd-space-5);
    border-radius: var(--sd-radius-card);
  }

  .formula-mark {
    flex-basis: 58px;
    width: 58px;
    height: 58px;
    border-radius: var(--sd-radius-control);
  }

  .formula-mark span {
    font-size: var(--sd-font-size-3xl);
  }

  .formula-mark small {
    right: 12px;
    bottom: 10px;
  }

  .formula-hero__status {
    min-width: 0;
  }

  .formula-workbench {
    border-radius: var(--sd-radius-card);
  }

  .formula-workbench__toolbar,
  .formula-editor {
    padding-right: var(--sd-space-4);
    padding-left: var(--sd-space-4);
  }

  .formula-toolbar-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .formula-toolbar-actions :deep(.n-button) {
    width: 100%;
  }

  .formula-empty {
    grid-template-columns: 1fr;
    min-height: 0;
    padding: var(--sd-space-6) var(--sd-space-4);
  }

  .formula-empty__symbol {
    min-height: 112px;
  }

  .formula-empty__steps {
    grid-column: auto;
    grid-template-columns: 1fr;
  }

  .formula-empty__steps li,
  .formula-empty__steps li:last-child {
    border-right: 0;
    border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
  }

  .formula-empty__steps li:last-child {
    border-bottom: 0;
  }

  .dims,
  .config-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dim-item--name {
    grid-column: 1 / -1;
  }

  .config-item {
    align-items: stretch;
    flex-direction: column;
  }

  .config-item :deep(.n-button) {
    width: 100%;
  }

  .config-summary {
    min-height: 16px;
    padding: 0 var(--sd-space-1);
  }

  .parts-table-shell {
    border-radius: var(--sd-radius-control);
  }

  .formula-actions {
    position: sticky;
    bottom: calc(var(--sd-shell-mobile-dock-reserve) - var(--sd-space-1));
    z-index: 2;
    margin: var(--sd-space-3) calc(var(--sd-space-4) * -1) calc(var(--sd-space-4) * -1);
    padding: var(--sd-space-3) var(--sd-space-4);
    border-top: var(--sd-border-width) solid var(--sd-border-glass-strong);
    background: var(--sd-material-surface-strong);
    box-shadow: var(--sd-shadow-md);
    backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
    -webkit-backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
  }

  .formula-actions :deep(.n-button) {
    flex: 1;
    min-width: 0;
  }

  .tpl-group {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .formula-hero__identity {
    align-items: flex-start;
  }

  .formula-hero__copy p {
    font-size: var(--sd-font-size-xs);
  }

  .formula-workbench__toolbar {
    padding: var(--sd-space-4);
  }

  .formula-toolbar-actions {
    grid-template-columns: 1fr;
  }

  .formula-section {
    padding: var(--sd-space-5) 0;
  }

  .formula-section__heading,
  .formula-section__heading-main {
    gap: var(--sd-space-2);
  }

  .dims,
  .config-row {
    grid-template-columns: 1fr;
  }

  .dim-item--name {
    grid-column: auto;
  }

  .search-row {
    align-items: stretch;
    flex-direction: column;
  }

  .material-search-input {
    max-width: none;
  }

  .search-row :deep(.n-button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .formula-hero,
  .formula-workbench {
    animation: none;
  }
}
</style>
