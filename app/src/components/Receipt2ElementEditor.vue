<!--
  「收据单2」元素微调浮层 —— 旧版 `Receipt2PrintManager` 的 `k`/`P`/`I`/`U`/`T` 那一组。

  旧版位置（`legacy/js/Receipt2.deobfuscated.js`）：
  · 状态机（草稿 `P` / 快照 `I` / 当前 key `k` / 定位 `U` / 目标节点 `T`）:181-211
  · 即时预览 `Y` :199-204 + `watch(P, …, {deep:true})` :205-211
  · 命中逻辑 `Ce` :947-982（**不在本组件里**，见文末说明）
  · 三个按钮 `xe`/`Be`/`Me` :989-1016
  · 面板模板 :2408-2628

  逆向依据：`docs/receipt2-recon/04-font-dialog-edit.md` §3（尤其 §3.5 的按钮差别表）、
  `docs/receipt2-recon/06-style-geometry.md` §1.4（浮层 CSS 原文，本文件逐字照抄）。

  三条容易做错的地方，都在下面的注释里标了：
  1. 「即时预览」是**直接改目标 DOM 的 style 属性**，不重渲染整个预览（旧版 `Y()`）；
  2. 「重置 / 取消 / 确认」三者语义完全不同（04 §3.5）；
  3. 面板定位用旧版写死的两个魔数 280×240（:965-971）。
-->
<template>
  <Teleport to="body">
    <template v-if="open">
      <!-- 遮罩：点空白（`.self`）等同「取消」—— 旧版 :2412-2416 -->
      <div class="r2-el-editor-mask" @click.self="onCancel" />
      <!-- 面板本体 :2418-2627 -->
      <div class="r2-el-editor" :style="{ top: pos.top + 'px', left: pos.left + 'px' }">
        <div class="r2-el-editor-title">{{ title }}</div>

        <div v-for="c in NUM_CONTROLS" :key="c.field" class="r2-el-editor-row">
          <label>{{ c.label }}</label>
          <n-input-number
            :value="draft[c.field]"
            :step="c.step"
            :precision="c.precision"
            :min="c.min"
            :max="c.max"
            size="small"
            style="width: 120px"
            @update:value="(v: number | null) => setNum(c.field, v)"
          />
          <!-- 「0=默认」灰字：旧版是内联样式（:2512-2524 / :2552-2564），逐字照抄 -->
          <span v-if="c.hint" style="color: #999; font-size: 11px; margin-left: 4px">{{ c.hint }}</span>
        </div>

        <!-- 显示 :2566-2586 —— 旧版是 `el-checkbox`，**这一行没有 label 元素**，勾选框自带文字「显示」 -->
        <div class="r2-el-editor-row">
          <n-checkbox v-model:checked="draft.visible">显示</n-checkbox>
        </div>

        <div class="r2-el-editor-actions">
          <n-button size="small" @click="onReset">重置</n-button>
          <n-button size="small" @click="onCancel">取消</n-button>
          <n-button size="small" type="primary" @click="onConfirm">确认</n-button>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NCheckbox, NInputNumber } from 'naive-ui'

import { ELEMENT_LABELS, defaultElementConfig } from '../utils/receipt2/defaults'
import { inlineStyle } from '../utils/receipt2/html'
import { saveElementConfigs } from '../utils/receipt2/storage'
import type { ElementConfig, ElementConfigs, ElementKey } from '../utils/receipt2/types'

/**
 * 锚点矩形（`element.getBoundingClientRect()` 的快照）。
 * 旧版定位只用到 `bottom` / `top` / `left` 三个值（:966-971），所以 `DOMRect` 与
 * 手写的 `{top,left,bottom}` 都结构兼容。
 */
interface AnchorRect {
  top: number
  left: number
  bottom: number
}

const PANEL_WIDTH = 280 // 旧版定位魔数 :970-971
const PANEL_HEIGHT = 240 // 旧版定位魔数 :968-969

const props = defineProps<{
  show: boolean
  /** 要编辑的元素 key（null = 没选中）。 */
  elementKey: ElementKey | null
  /** 锚点矩形 —— 面板定位用（旧版 `Ce` 里算好塞进 `U` 的就是它）。 */
  anchor: AnchorRect | null
  /**
   * 被编辑的预览 DOM 节点（带 `data-r2-el` 的那个）。
   * 即时预览直接改它的 `style` 属性 —— 旧版的 `T`。
   */
  target: HTMLElement | null
  /**
   * 已存的元素配置表（**父组件持有的响应式对象**）。
   * 「确认」时本组件**原地写回一项**并落盘，等价旧版 `b.value = {...b.value,[k]:{...P}}; A()` :993-994。
   * 父组件监听 `confirm` 事件重建预览即可，**不要重复写盘**。
   */
  configs: ElementConfigs
}>()

const emit = defineEmits<{
  'update:show': [boolean]
  /** 确认时抛出：key + 已落盘的新配置。父组件据此刷新预览（旧版 `xe` 里的 `await ve()`）。 */
  confirm: [ElementKey, ElementConfig]
}>()

/** 4 个数字框控件的范围/步长 —— 逐条对照 04 §3.3 的表格（旧版 :2437-2565）。 */
type NumField = 'offsetXMm' | 'offsetYMm' | 'fontSize' | 'widthMm'

interface NumControl {
  field: NumField
  label: string
  step: number
  /** 不设 = 旧版也没设（Element Plus 的 `precision` 默认不取整）。 */
  precision?: number
  /** **X/Y 偏移无 min/max**（可负），照旧版。 */
  min?: number
  max?: number
  /** 「0=默认」灰字提示：只有「字体(px)」「宽度(mm)」两项有。 */
  hint?: string
}

const NUM_CONTROLS: NumControl[] = [
  { field: 'offsetXMm', label: 'X偏移(mm)', step: 0.5, precision: 1 },
  { field: 'offsetYMm', label: 'Y偏移(mm)', step: 0.5, precision: 1 },
  { field: 'fontSize', label: '字体(px)', step: 1, min: 0, max: 60, hint: '0=默认' },
  { field: 'widthMm', label: '宽度(mm)', step: 0.5, precision: 1, min: 0, max: 300, hint: '0=默认' },
]

const open = computed(() => props.show && props.elementKey !== null)

/** 标题 = `ELEMENT_LABELS[key]`（旧版 `B[k] || k` :2434；新版 key 已被类型约束成合法值，不需要兜底）。 */
const title = computed(() => (props.elementKey ? ELEMENT_LABELS[props.elementKey] : ''))

/** 面板定位（旧版 `Ce` :965-972）。 */
const pos = ref({ top: 0, left: 0 })

/**
 * 草稿（旧版 `P` :182-188）—— 面板控件的绑定对象。
 * 快照（旧版 `I` :189-195）—— 打开那一刻的副本，只给「取消」用。
 */
const draft = ref<ElementConfig>(defaultElementConfig())
const snapshot = ref<ElementConfig>(defaultElementConfig())

/**
 * 即时预览（旧版 `Y` :199-204）。
 *
 * ⚠️ 用 `setAttribute("style", …)` **整条替换** style 属性（不是逐条 property 设置），
 * 全零配置时 `removeAttribute("style")` —— 旧版就是这么写的，照抄。
 * 副作用（旧版同样有，故不修）：会把 `data-shrink-fit` 三个字段（客户/电话/安装地址）
 * 上次缩字算出的内联 `font-size` 一起抹掉，要等下一次 `applyShrinkFit()` 才会重算。
 */
function applyDraft(): void {
  const el = props.target
  if (!el) return
  const style = inlineStyle(draft.value)
  if (style) el.setAttribute('style', style)
  else el.removeAttribute('style')
}

// 改控件即时生效（旧版 :205-211 的 `watch(P, () => Y(), {deep:!0})`）
watch(draft, () => applyDraft(), { deep: true })

/** 打开（或换一个元素）时：重算定位、草稿与快照都从已存配置复制（旧版 :972-981）。 */
function openPanel(): void {
  const key = props.elementKey
  if (!key) return
  pos.value = calcPosition(props.anchor)
  const saved = props.configs[key]
  const base: ElementConfig = saved ? { ...saved } : defaultElementConfig() // :974-980 的兜底零值
  snapshot.value = { ...base } // :981 `I.value = {...i}`
  draft.value = { ...base } // :981 `P.value = {...i}`（watcher 会顺手把同样的样式再写一遍 DOM，无副作用）
}

/** 定位：`top = 锚点.bottom + 8`，下方放不下（+240 超屏）翻到上方；左右同理。 */
function calcPosition(rect: AnchorRect | null): { top: number; left: number } {
  // 有意偏离：旧版一定有点击锚点，这里给个兜底位置，避免父组件传 null 时面板飞到 (0,0)。
  if (!rect) return { top: 8, left: 8 }
  let top = rect.bottom + 8 // :966
  let left = rect.left // :967
  if (top + PANEL_HEIGHT > window.innerHeight) top = Math.max(8, rect.top - PANEL_HEIGHT - 8) // :968-969
  if (left + PANEL_WIDTH > window.innerWidth) left = Math.max(8, window.innerWidth - PANEL_WIDTH - 8) // :970-971
  return { top, left }
}

/**
 * 数字框改动。
 *
 * 有意偏离：Naive UI 的 `n-input-number` 清空时 emit `null`（Element Plus 同样），
 * 旧版会把这个 `null` 原样写进 `P` 甚至落盘（`M(null)` 里 `null > 0` 为假，所以渲染上等价于 0，
 * 但会污染 localStorage，要等下次读盘才被归一成 0）。新版在控件层就归一成 `0`。
 */
function setNum(field: NumField, value: number | null): void {
  draft.value[field] = value ?? 0
}

function close(): void {
  emit('update:show', false)
}

/**
 * 「重置」（旧版 `Me` :1008-1016）—— **只把草稿置成零值对象**。
 * 不动快照、不改已存配置、不写盘、**不关面板**；之后点「确认」才会以零值写入。
 */
function onReset(): void {
  draft.value = defaultElementConfig()
}

/**
 * 「取消」（旧版 `Be` :1004-1007）—— 用快照还原草稿并当场刷回 DOM，然后关面板。
 * **不改已存配置、不写盘**（已存配置从头到尾没被改过，所以取消天然等价于回滚）。
 */
function onCancel(): void {
  draft.value = { ...snapshot.value } // 赋值会触发 watcher → applyDraft()（旧版这里还显式调了一次 Y()）
  close()
}

/**
 * 「确认」（旧版 `xe` :989-1003）—— 写回已存配置 + 落盘 + 关面板 + 通知父组件重建预览。
 * 不复位 DOM：目标节点上已经写着即时预览的样式，旧版 `xe` 也是把 `T` 置 null 就算了，
 * 随后由父级的重渲染（`ve()`）覆盖掉。
 */
function onConfirm(): void {
  const key = props.elementKey
  if (!key) return
  const next: ElementConfig = { ...draft.value }
  const configs: ElementConfigs = props.configs
  configs[key] = next // :993 `b.value = {...b.value, [t]: {...P.value}}`
  saveElementConfigs(configs) // :994 `A()`
  close()
  emit('confirm', key, next) // :997-1002 `isReceipt2Active() && await ve()`
}

// 打开时重置草稿/快照/定位；面板开着时换元素也重新初始化。
// （「关 → 开同一个元素」必须也走一遍：旧版每次点击都是一个全新的 `Ce`，没有「已开就不动」的分支。）
watch(
  () => [props.show, props.elementKey] as const,
  (
    [show, key]: readonly [boolean, ElementKey | null],
    prev?: readonly [boolean, ElementKey | null],
  ) => {
    const [prevShow, prevKey] = prev ?? ([false, null] as const)
    if (show && key && (!prevShow || key !== prevKey)) openPanel()
  },
  { immediate: true },
)
</script>

<style scoped>
/*
  以下 6 条**逐字照抄** `legacy/css/Home-97d96482.css`（逆向见 06 §1.4）。
  旧版挂在 Home 的全局样式表里，新版收进 `<style scoped>`。
  ⚠️ `.r2-el-editor-row label` 这条在旧版还会命中 Element Plus 复选框的内部 `<label>`；
  Naive UI 的 `n-checkbox` 内部没有 `label` 元素，所以「显示」那一行不会吃到 72px 缩进
  —— 有意保留（旧版那一行本来也没写自己的 label）。
*/
.r2-el-editor-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.15);
}
.r2-el-editor {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  box-shadow: 0 4px 20px #0000002e;
  padding: 14px 16px;
  min-width: 270px;
  font-size: 13px;
}
.r2-el-editor-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #ebeef5;
  color: #303133;
}
.r2-el-editor-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.r2-el-editor-row label {
  width: 72px;
  text-align: right;
  color: #606266;
  flex-shrink: 0;
}
.r2-el-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}
</style>
