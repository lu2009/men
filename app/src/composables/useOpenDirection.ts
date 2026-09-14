import { computed, ref } from 'vue'

// ===== 开向模式 + 自定义开向命名（仿原版 _0x5a7707 开向设置）=====

// 平开门开向固定枚举（14 项，原版 B）。
export const PING_DIRECTIONS = [
  '左锁内开', '右锁内开', '左锁外开', '右锁外开',
  '内左', '内右', '外左', '外右',
  '双开内开', '双开外开', '双开内左', '双开内右', '双开外左', '双开外右',
]
// mode=1 剔除的开方向 / mode=2 剔除的锁方向（原版精确）。
const PING_OPEN_DIRS = ['内左', '内右', '外左', '外右']
const PING_LOCK_DIRS = ['左锁内开', '右锁内开', '左锁外开', '右锁外开']

const OPEN_DIRECTION_MODE_KEY = 'openDirectionMode'
const OPEN_DIRECTION_CUSTOM_NAMES_KEY = 'openDirectionCustomNames'

// 会话默认（"1"/"2"）→ 文案（原版提示语）。
const MODE_LABEL: Record<string, string> = { '': '全部模式', '1': '模式1', '2': '模式2' }

const readLS = (k: string): string | null => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const writeLS = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    // 忽略
  }
}

// 双向状态（模块级单例）
const openDirectionMode = ref('')
const customDirectionNames = ref<Record<string, string>>({})

export function loadOpenDirectionSettings() {
  openDirectionMode.value = readLS(OPEN_DIRECTION_MODE_KEY) || ''
  try {
    const raw = readLS(OPEN_DIRECTION_CUSTOM_NAMES_KEY)
    if (!raw) {
      customDirectionNames.value = {}
      return
    }
    const obj = JSON.parse(raw)
    const clean: Record<string, string> = {}
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj)) if (typeof v === 'string') clean[k] = v
    }
    customDirectionNames.value = clean
  } catch {
    customDirectionNames.value = {}
  }
}

function persistCustomNames(map: Record<string, string>) {
  writeLS(OPEN_DIRECTION_CUSTOM_NAMES_KEY, JSON.stringify(map))
}

/** 原始开向 → 显示名（无自定义则原样）。 */
export function displayDirection(direction: string): string {
  return customDirectionNames.value[direction] || direction
}

/**
 * 显示名 → 原始开向（原版 `getOriginalOpenDirection`，openDirectionNaming 模块导出 `g`）。
 * 逐字复刻其语义：本身是映射的 key（即已是原始开向）→ 原样返回；
 * 否则按**显示名 trim 后**反查 key；查不到原样返回。
 * 用途：回执行/生产单的开向图按**原始开向**查图，避免自定义改名后查不到图。
 */
export function getOriginalOpenDirection(direction: string): string {
  if (!direction) return direction
  const map = customDirectionNames.value
  if (map[direction]) return direction
  for (const [k, v] of Object.entries(map || {})) {
    if (typeof v === 'string' && v.trim() && v.trim() === direction.trim()) return k
  }
  return direction
}

/** 开向选项（按模式过滤 + 显示名替换）。 */
export const pingDirectionOptions = computed(() =>
  PING_DIRECTIONS.filter((d) => {
    const m = openDirectionMode.value
    if (m === '1') return !PING_OPEN_DIRS.includes(d)
    if (m === '2') return !PING_LOCK_DIRS.includes(d)
    return true
  }).map((d) => ({ label: displayDirection(d), value: d })),
)

// ===== 弹窗状态与处理器（仿原版 开向模式设置 / 自定义开向命名）=====
export const openDirSettingsOpen = ref(false)
export const modeRadio = ref('')
export const customNamesOpen = ref(false)
export const customNamesDraft = ref<Record<string, string>>({})

/** 打开开向模式设置（原版 M）。 */
export function openOpenDirSettings() {
  modeRadio.value = openDirectionMode.value || ''
  openDirSettingsOpen.value = true
}

/** 确认模式（原版 A）：写 localStorage + 提示语。返回提示文案。 */
export function confirmOpenDirMode(): string {
  const m = modeRadio.value
  openDirectionMode.value = m
  writeLS(OPEN_DIRECTION_MODE_KEY, m)
  openDirSettingsOpen.value = false
  return m ? `已切换到${MODE_LABEL[m]}` : '已切换到全部模式其它设备请重新登录'
}

/** 反向：把自定义名里的 左/右 互换（原版为后端反转重载，此处做本地等价）。 */
export function reverseOpenDirNames() {
  const draft = customNamesDraft.value
  for (const d of PING_DIRECTIONS) {
    const cur = draft[d]
    if (!cur || cur === d) continue
    const swapped = cur.split('左').join('L').split('右').join('左').split('L').join('右')
    draft[d] = swapped === cur ? cur : swapped
  }
}

/** 重置自定义命名（原版 h）。 */
export function resetCustomNames() {
  const draft: Record<string, string> = {}
  for (const d of PING_DIRECTIONS) draft[d] = d
  customNamesDraft.value = draft
}

/** 打开自定义开向命名（原版 v）：从当前显示名建草稿。 */
export function openCustomNames() {
  const draft: Record<string, string> = {}
  for (const d of PING_DIRECTIONS) draft[d] = displayDirection(d)
  customNamesDraft.value = draft
  customNamesOpen.value = true
}

/** 确认自定义命名（原版 p）：存 localStorage + 刷新显示。 */
export function confirmCustomNames() {
  const clean: Record<string, string> = {}
  for (const d of PING_DIRECTIONS) {
    const v = customNamesDraft.value[d]?.trim() || ''
    if (v) clean[d] = v
  }
  persistCustomNames(clean)
  customNamesOpen.value = false
  loadOpenDirectionSettings()
  return '自定义开向命名已保存'
}

// 供外部监听 localStorage 变更（跨页同步）使用的 key。
export const DIRECTION_STORAGE_KEYS = [OPEN_DIRECTION_MODE_KEY, OPEN_DIRECTION_CUSTOM_NAMES_KEY]
