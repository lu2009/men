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
const isSubsidiary = computed(() => formulaType.value === 'parentsubsidiary')
// 吊脚仅简单门型显示（复刻旧版 _0x1d0fcc = 平开/双开/子母/钻石）。
const showJiao = computed(() => isSimpleSquare.value)
// 必填弹窗中的吊脚（复刻旧版 _0x17e61b：仅平开/中开门）。
const showJiaoInDialog = computed(() => formulaType.value === 'ping' || formulaType.value === 'double')

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
  const isPingLike = ['ping', 'parentsubsidiary'].includes(formulaType.value)
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
const commonRemaining = ref<string[]>(Object.keys(COMMON_MATERIALS))

function materialTypeLabel(key: string): string {
  return TEMPLATE_LIST.find((t) => t.key === key)?.label ?? key
}

// 常规材料：一次性恢复，加入后从列表移除
function addCommon(key: string) {
  const def = COMMON_MATERIALS[key]
  if (!def) return
  parts[key] = { ...def, result: 0, v: 0 }
  commonRemaining.value = commonRemaining.value.filter((k) => k !== key)
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

function applyTemplate(key: string) {
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

async function removeFormula(row: FormulaDto) {
  if (!window.confirm(`确定要删除公式「${row.name}」吗？此操作不可恢复。`)) return
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
  <div class="page">
    <n-card>
      <template #header>
        <div class="header">
          <div class="title-box">
            <span class="title">公式管理（吊）</span>
            <router-link class="back" to="/">← 返回首页</router-link>
          </div>
          <div class="actions">
            <n-button v-if="isAdminUser" type="primary" @click="openList">查询/修改/删除公式</n-button>
            <n-button v-if="isAdminUser" type="success" @click="templateDrawer = true">公式模板</n-button>
            <n-button @click="glassModal = true">开孔图</n-button>
            <n-button @click="videoDrawer = true">视频</n-button>
          </div>
        </div>
      </template>

      <!-- 尺寸输入区 -->
      <div class="dims">
        <div class="dim-item">
          <label>公式名称:</label>
          <n-input v-model:value="formulaName" size="small" style="width: 160px" />
        </div>
        <div v-if="isSimpleSquare" class="dim-item">
          <label>单扇最小平方数:</label>
          <n-input v-model:value="square" size="small" style="width: 90px" @blur="squareBlur" />
        </div>
        <div v-if="!isSimpleSquare" class="dim-item">
          <n-button size="small" type="primary" @click="openMinSquare">移门最低方数设置</n-button>
        </div>
        <div class="dim-item">
          <label>门洞高:</label>
          <n-input v-model:value="dimH" size="small" style="width: 90px" @blur="dimBlur('h')" />
        </div>
        <div class="dim-item">
          <label>{{ dimLabel('w') }}:</label>
          <n-input v-model:value="dimW" size="small" style="width: 90px" @blur="dimBlur('w')" />
        </div>
        <div v-if="isSubsidiary" class="dim-item">
          <label>母门宽:</label>
          <n-input v-model:value="dimS" size="small" style="width: 90px" @blur="dimBlur('s')" />
        </div>
        <div class="dim-item">
          <label>{{ dimLabel('h1') }}:</label>
          <n-input v-model:value="dimH1" size="small" style="width: 90px" @blur="dimBlur('h1')" />
        </div>
        <div class="dim-item">
          <label>{{ dimLabel('t') }}:</label>
          <n-input v-model:value="dimT" size="small" style="width: 90px" @blur="dimBlur('t')" />
        </div>
        <div v-if="showJiao" class="dim-item">
          <label>吊脚:</label>
          <n-input v-model:value="dimJ" size="small" style="width: 90px" @blur="dimBlur('j')" />
        </div>
      </div>

      <!-- 附加配置 -->
      <div class="config-row">
        <n-button size="small" @click="openResetSize">洞尺设置</n-button>
        <span v-if="resetSizeSummary" class="config-summary">{{ resetSizeSummary }}</span>
        <n-button size="small" @click="openTaoDong">包边洞尺</n-button>
        <span v-if="taoDongSummary" class="config-summary">{{ taoDongSummary }}</span>
        <n-button size="small" @click="openSwingWall">平开门丁墙</n-button>
        <span v-if="swingWallSummary" class="config-summary">{{ swingWallSummary }}</span>
        <n-button size="small" @click="openHinge">平开门合页</n-button>
        <span v-if="hingeSummary" class="config-summary config-summary-multi">{{ hingeSummary }}</span>
        <n-button size="small" @click="openWidthIncrement">边封增量</n-button>
        <span v-if="widthIncrementSummary" class="config-summary">{{ widthIncrementSummary }}</span>
        <n-button size="small" @click="openHardware">固定配件</n-button>
        <span v-if="hardwareSummary" class="config-summary">{{ hardwareSummary }}</span>
      </div>

      <!-- 材料搜索 + 亮窗示意图 -->
      <div class="search-row">
        <n-input
          v-model:value="materialSearch"
          placeholder="搜索材料名称,如：光企"
          clearable
          size="small"
          style="width: 240px"
        />
        <n-button size="small" @click="lightWindowModal = true">亮窗示意图</n-button>
      </div>

      <!-- 部件表。结构与类名照抄原版（旧版是 el-table，列宽固定像素；
           四个类的样式来自 legacy/css/Diao-15870f7d.css 的 [data-v-6ed0eb3d] 作用域）。 -->
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
                 部件带 `title` 时，再跟一个 `glass-input-label`(如「套线名称: 」) + 第二个输入框填
                 套线名/轨道名/下轨名。tooltip 内容是 `row.name.split('_')[0]` —— 列窄、名字会被截断，靠它看全。 -->
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
              <!-- 旧版操作列：`div` `display:flex; justify-content:space-around` + 三个 `el-button link`
                   （查看3D 条件 / 删除 / 复制）。我们没有 3D，故只有后两个；顺序照旧版是**删除在前**。 -->
              <div style="display: flex; justify-content: space-around">
                <n-popconfirm @positive-click="deleteRow(row.name)">
                  <template #trigger>
                    <n-button size="small" text type="primary">删除</n-button>
                  </template>
                  确定删除该行吗?
                </n-popconfirm>
                <n-button size="small" text type="primary" @click="copyRow(row.name)">复制</n-button>
              </div>
            </td>
            <td class="cat-cell">{{ row.name }}</td>
          </tr>
          <tr v-if="filteredRows.length === 0">
            <td colspan="5" class="empty-cell">
              点击「公式模板」选择门型开始录入
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 内联挖孔图展示（复刻旧版 _0x44ca5e） -->
      <div v-if="glassImages.length" class="glass-images">
        <div v-for="img in glassImages" :key="img.id" class="glass-image-item">
          <img :src="img.data_url" :alt="img.direction" />
          <div class="glass-image-dir">{{ img.direction }}{{ img.mirrored ? '（镜像）' : '' }}</div>
        </div>
      </div>

      <!-- 表格下方操作（复刻旧版「新增材料」+「确认」） -->
      <div class="formula-actions">
        <n-button type="primary" @click="addMaterialDrawer = true">新增材料</n-button>
        <n-button type="primary" :loading="saving" @click="save">确认</n-button>
      </div>
    </n-card>

    <!-- 查询 / 修改 / 删除 -->
    <n-modal v-model:show="listModal">
      <n-card style="width: 820px" title="查询 / 修改 / 删除公式" :bordered="false" role="dialog">
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
    <n-drawer v-model:show="templateDrawer" title="公式模板" placement="right" :width="420">
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
    </n-drawer>

    <!-- 必填参数弹窗（复刻旧版 requiredFieldsDialog） -->
    <n-modal v-model:show="requiredFieldsModal">
      <n-card style="width: 420px" title="请填写必要参数" :bordered="false" role="dialog">
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
    <n-drawer v-model:show="addMaterialDrawer" title="添加材料" placement="right" :width="460">
      <div v-if="commonRemaining.length" class="mat-section">
        <h3>常规材料</h3>
        <div class="mat-grid">
          <n-button
            v-for="k in commonRemaining"
            :key="k"
            size="small"
            @click="addCommon(k)"
          >
            {{ COMMON_MATERIALS[k]?.materialName }}
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
    </n-drawer>

    <!-- 开孔图 -->
    <n-modal v-model:show="glassModal">
      <n-card style="width: 720px" title="挖孔图（玻璃开孔图）" :bordered="false" role="dialog">
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
      <n-card style="width: 400px" title="洞尺设置" :bordered="false" role="dialog">
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
      <n-card style="width: 460px" title="包边洞尺" :bordered="false" role="dialog">
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
      <n-card style="width: 440px" title="平开门丁墙" :bordered="false" role="dialog">
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
      <n-card style="width: 560px" title="平开门合页" :bordered="false" role="dialog">
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
      <n-card style="width: 440px" title="边封增量" :bordered="false" role="dialog">
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
      <n-card style="width: 520px" title="配件设置" :bordered="false" role="dialog">
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
      <n-card style="width: 520px" title="移门最低方数设置" :bordered="false" role="dialog">
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
      <n-card style="width: 480px" title="亮窗示意图" :bordered="false" role="dialog">
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
    <n-drawer v-model:show="videoDrawer" title="视频教程" placement="right" :width="320">
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
    </n-drawer>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 24px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.title-box {
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.back {
  font-size: 13px;
  color: #409eff;
  text-decoration: none;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dims {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px;
  background: #fafbfc;
  border-radius: 6px;
}
.dim-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dim-item label {
  font-size: 13px;
  white-space: nowrap;
}
.parts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.parts-table th,
.parts-table td {
  border: 1px solid #e5e6eb;
  padding: 4px 6px;
  vertical-align: middle;
}
.parts-table th {
  background: #f5f7fa;
  font-weight: 600;
  text-align: center;
}
/* ===== 部件表：列宽固定 + 旧版四个类（照抄 legacy/css/Diao-15870f7d.css 的 [data-v-6ed0eb3d]）=====
   旧版是 el-table：列宽 材料名100 / 数量30 / 计算结果65 / 操作80或120 / 公式类别120，
   输入框统一 60px 宽、28px 粗体居中；窄列靠 `el-table .cell{overflow:hidden}` 裁掉两侧，
   因为文字居中，数字仍看得见。 */
.parts-table {
  table-layout: fixed;
}
.parts-table td {
  overflow: hidden;
}
.glass-inputs-container2 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0px;
  width: 100%;
}
.glass-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.glass-input-label {
  font-size: 11px;
  white-space: nowrap;
  color: #1302fa;
  margin-right: 0;
  flex-shrink: 0;
}
/* ⚠️ 旧版这条写的是 `width:60px; font-size:28px; font-weight:700; text-align:center`，
   但**实测两者都不生效**：`.formula-input` 所在的 el-input 根元素会被 flex 拉伸
   （实测 176px，不是 60px），而 `font-size:28px` 够不到内层 `<input>`（EP 自己给它定了 16px）。
   所以只保留肉眼可见的那一条 `text-align:center`，别照抄那两个无效声明。
   （验证方式：用 legacy/vendor 的 vue + element-plus + legacy/css/Diao-15870f7d.css
     把这张表单独渲染出来实测 —— 列宽实测 336/101/218/403/403，声明的 100/30/65/120/120 全被拉伸。） */
.formula-input {
  text-align: center;
}
.cat-cell {
  color: #888;
  font-size: 12px;
  text-align: center;
}
.empty-cell {
  text-align: center;
  color: #999;
  padding: 24px;
}
.list-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}
.tpl-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.tpl-btn {
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background 0.15s;
}
.tpl-btn:hover {
  background: #f0f6ff;
}
.tpl-label {
  font-size: 14px;
  font-weight: 600;
}
.tpl-key {
  font-size: 12px;
  color: #999;
}
.mat-section {
  margin-bottom: 16px;
}
.mat-section h3 {
  margin: 0 0 8px;
  font-size: 14px;
  border-left: 3px solid #409eff;
  padding-left: 8px;
}
.mat-section h4 {
  margin: 8px 0 4px;
  font-size: 13px;
  color: #666;
}
.mat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mat-group {
  margin-bottom: 6px;
}
.config-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px;
  background: #fafbfc;
  border-radius: 6px;
}
.config-summary {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}
.config-summary-multi {
  white-space: pre-line;
}
.cfg-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.cfg-form label {
  font-size: 13px;
  white-space: nowrap;
}
.min-square-header,
.min-square-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.min-square-header {
  font-weight: 600;
  margin-bottom: 6px;
  border-bottom: 1px solid #eee;
  padding-bottom: 6px;
}
.min-square-row {
  margin-bottom: 6px;
}
.min-square-type {
  flex: 0 0 120px;
  font-size: 13px;
}
.min-square-col {
  flex: 1;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.glass-images {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}
.glass-image-item {
  text-align: center;
}
.glass-image-item img {
  width: 90px;
  height: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.glass-image-dir {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}
.formula-actions {
  display: flex;
  gap: 8px;
  margin-top: 15px;
}
.video-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.light-window-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.light-window-legend {
  font-size: 13px;
  color: #555;
  text-align: left;
}
.light-window-legend p {
  margin: 4px 0;
}
</style>
