<template>
  <!--
    明细表（平开 / 移门共用，由 `kind` 分派）—— 模板 + 列定义 + 全部单元格 + 行级编辑态。

    从 `app/src/views/Hui.vue` **整段搬来**（2026-09-19，分 3a/3b 两步），
    目的是让 Home 的展开行也能挂同一张表 —— 旧版那两张明细表本来就是两个独立 SFC
    （`Ping_hui` / `Diao_hui`），被 Hui 页与 Home 展开行同时使用
    （`legacy/js/Home.formatted.js:9`）。见 `docs/2026-09-18-detail-table-extraction.md`。

    搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机器核对（第二轮：51 个定义逐字比）。
  -->
  <section class="detail-table-shell" :class="`detail-table-shell--${kind}`" :aria-label="`${kind === 'ping' ? '平开门' : '移门'}订单明细`">
    <header class="detail-table-toolbar">
      <div class="detail-table-toolbar__identity">
        <span class="detail-table-toolbar__mark" aria-hidden="true"></span>
        <div>
          <p class="detail-table-toolbar__eyebrow">ORDER LINES</p>
          <h3>{{ kind === 'ping' ? '平开门明细' : '移门明细' }}</h3>
        </div>
        <span class="detail-table-toolbar__count">{{ rows.length }} 行</span>
      </div>

      <div class="detail-table-toolbar__actions">
        <n-tag v-if="selectedCount" size="small" type="info" round>
          已选 {{ selectedCount }}
        </n-tag>
        <n-button v-if="selectedCount" size="tiny" text type="error" @click="emit('batch-delete')">
          批量删除
        </n-button>
        <!-- ⚠️ 「填入单号」只有平开表有，保持原业务入口不变。 -->
        <n-button
          v-if="kind === 'ping'"
          size="tiny"
          secondary
          type="primary"
          :loading="filling"
          @click="emit('fill-line-numbers')"
        >
          填入单号
        </n-button>
        <n-button size="tiny" quaternary type="error" @click="emit('toggle-show')">隐藏</n-button>
      </div>
    </header>

    <div class="detail-table-scroll">
      <n-data-table
        class="detail-data-table"
        :columns="kind === 'diao' ? diaoColumns : pingColumns"
        :data="rows"
        :bordered="false"
        :row-key="rowKey"
        :row-class-name="rowClassName"
        :row-props="rowPropsOf"
        size="small"
        :max-height="560"
        :scroll-x="scrollX"
      />
    </div>

    <footer class="detail-table-footer">
      <n-button class="custom-button-btn" size="small" @click="emit('add-row')">
        <span class="detail-table-footer__plus" aria-hidden="true">＋</span>
        添加明细行
      </n-button>
      <span class="detail-table-footer__hint">点击任意行进入编辑</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, h, reactive, watch } from 'vue'
import {
  NButton, NCheckbox, NDataTable, NInput, NInputNumber,
  NSelect, NTag, NTooltip, useDialog, useMessage,
} from 'naive-ui'
import type { DataTableColumn } from 'naive-ui'
import { api } from '../api/client'
import type { OrderLineInput } from '../api/types'
import { markupLines } from '../utils/markupLines'
import type { Line } from '../utils/partsEngine'
import { diaoDirImage } from '../utils/printPayloads'
import { PING_DIRECTION_IMAGES } from '../data/directionImages'
import { markupCatalog, markupCatalogOptions } from '../composables/useMarkupCatalog'
import type { Ref } from 'vue'
import type { FormulaDto } from '../api/types'
import { useOrderLines, type OrderLines } from '../composables/useOrderLines'

const props = defineProps<{
  kind: 'ping' | 'diao'
  rows: Line[]
  /** 本表可显隐列。平开传 props.colVis、移门传 props.colVis（两表各一份）。 */
  colVis: Record<string, boolean>
  /** 订单级的「客户 / 客户编号」—— 列上直接显示，行上没有这两个字段。 */
  client: { name: string; code: string }
  /**
   * 行编辑引擎（`composables/useOrderLines`）。
   *
   * · **Hui 页**：传页面那份 —— 页面自己的 `saveOrder`/打印/脏检查都要用同一个引擎。
   * · **Home 展开行**：**不传**，改用下面的 `engineDeps` 让组件自己建一份。
   *   原因是 Home 每个展开行各有自己的 `lines`（同一时刻可能展开多张单），
   *   而引擎的依赖里 `lines` 是**一个** ref —— 共享一份会张冠李戴。
   *   也不违反「引擎唯一」那条：`createPartsEngine(formulas)` 对同一份 `formulas` 是确定性的，
   *   两份实例算出来的 `isDiamond`/候选/算料结果一致（旧版两个 SFC 本来就是各持一套）。
   */
  engine?: OrderLines
  /** 不传 `engine` 时用它自建（两者**二选一**；都不给会在运行时报错）。 */
  engineDeps?: {
    lines: Ref<Line[]>
    formulas: Ref<FormulaDto[]>
    order: { client_code: string }
    orderId: Ref<number | null>
    disableAutoMarkup: Ref<boolean>
  }
  /** 已保存订单 id；`null` = 还没落库（行级保存与删除走不了接口）。 */
  savedOrderId: number | null
  /** 跨两表的勾选数（表头「批量删除(N)」）。两表共用一个计数。 */
  selectedCount: number
  /** 「填入单号」进行中。 */
  filling: boolean
  /** 页面级的回调。组件不持有这些弹窗/流程（它们跨两表或在页面里）。 */
  hooks: {
    openSquareDialog: (l: Line) => void
    openAddMarkup: (l: Line) => void
    pickDoorImg: (l: Line) => void
    removeDoorImg: (l: Line) => void
    openTextImg: (l: Line) => void
    previewImage: (url: string) => void
    calcSingleRow: (l: Line) => void
    onSelectChange: () => void
    lineInputOf: (l: Line) => OrderLineInput
  }
}>()

const emit = defineEmits<{
  (e: 'add-row'): void
  (e: 'batch-delete'): void
  (e: 'toggle-show'): void
  (e: 'fill-line-numbers'): void
}>()

// ── 组件化时补进来的引用（原来靠 Hui.vue 的页面作用域，现在两边都要用）──
import { CASING_OPTIONS, DIRECTION_SUFFIXES, FANS, FOLD_DIRECTION_SUFFIXES, GLASS_OPTIONS, GLASS_THICKNESS_OPTIONS } from '../utils/detailOptions'
import { displayDirection, getOriginalOpenDirection, openOpenDirSettings, pingDirectionOptions } from '../composables/useOpenDirection'
import type { SizeField } from '../composables/useOrderLines'

const fansOptions = FANS.map((f) => ({ label: f, value: f }))
const glassOptions = GLASS_OPTIONS.map((g) => ({ label: g, value: g }))
const glassThicknessOptions = GLASS_THICKNESS_OPTIONS.map((g) => ({ label: g, value: g }))
const casingKindOptions = CASING_OPTIONS.map((e) => ({ label: e, value: e }))
const priceTypeOptions = [
  { label: '套', value: '套' },
  { label: '方', value: '方' },
]
const directionSuffixOptions = computed(() =>
  [...DIRECTION_SUFFIXES, ...FOLD_DIRECTION_SUFFIXES].map((d) => ({ label: displayDirection(d), value: d })),
)

const message = useMessage()
const dialog = useDialog()

// ⚠️ 全部**解构成与迁出前同名的局部变量**，所以下面 900 行搬迁过来的函数体一个字都不用改
//    （同 `useOrderLines.ts` 的手法；搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核）。
/**
 * 引擎：Hui 传进来的那份，或（Home 展开行）自己建一份。
 *
 * ⚠️ `??` 是**短路**的：传了 `engine` 就不会调 `useOrderLines()` —— 与 `message`/`dialog`
 *    同一手法（那边也是传了就不调 `useMessage()`）。
 */
const engine: OrderLines =
  props.engine ?? useOrderLines(props.engineDeps as NonNullable<typeof props.engineDeps>)

const {
  lineRefresh, isDiamond, needsMotherWidth,
  partsTrackOptions, hardwareOptionsFor, pingProfileOptions, diaoProfileOptions,
  pingCasingOptions, colorOptions, rememberField, rememberDefaultBottomGlass,
  rememberDefaultGlassThickness, resolveRow, removeLine, copyRow,
  syncSizeMarkup, onGlassSelection, markupError, sanitizeNum, sanitizeFloat,
} = engine

/** 列显隐：缺省都显示（与页面同名同义）。 */
function colVis(map: Record<string, boolean>, key: string): boolean {
  return map[key] !== false
}

/**
 * 非编辑行只渲染轻量文本节点；点击行后才挂载输入/下拉控件。
 * 明细表一行包含大量 Naive UI 控件，这是滚动性能的关键边界：
 * 默认视图不应该为每一行创建几十个交互组件。
 */
function detailValue(value: unknown, fallback = '—') {
  const text = value == null || String(value).trim() === '' ? fallback : String(value)
  return h('span', { class: 'detail-value', title: text }, text)
}

function detailMultiline(value: unknown, fallback = '—') {
  const text = value == null || String(value).trim() === '' ? fallback : String(value)
  return h('span', { class: 'detail-value detail-value--multiline', title: text }, text)
}

/** 两表不同的 `scroll-x`（旧版列宽不同：平开 2000 / 移门 2200）。 */
const scrollX = computed(() => (props.kind === 'diao' ? 2320 : 2120))

// ════ 搬迁自 Hui.vue 1442-1701：A 单元格 ════
function wallThicknessCell(l: Line) {
  if (!isEditing(l)) return detailValue(l.wall_thickness)
  return h(
    NInputNumber,
    {
      ...CELL,
      class: 'red-number-input',
      status: cellError(l, 'wall_thickness') ? 'error' : undefined,
      value: l.wall_thickness,
      showButton: false,
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        l.wall_thickness = sanitizeNum(v, 0)
        lineRefresh(l)
      },
      // 原版 `Qt` 挂在 onBlur：吊趟会在 ≥2 候选时弹窗，随输入触发会连弹
      onBlur: () => syncSizeMarkup(l, 'wall_thickness'),
    },
  )
}

// 玻璃单元格（面玻/底玻）：onSelect 需拿改前值做「元/方」加价项联动，故此处自行实现。
function glassSelectCell(l: Line, field: 'face_glass' | 'bottom_glass') {
  if (!isEditing(l)) return detailValue((l as unknown as Record<string, string>)[field])
  const oldByField = new WeakMap<object, string>()
  return h(
    NSelect,
    {
      ...CELL,
      virtualScroll: false,
      consistentMenuWidth: false,
      widthMode: 'max-content',
      menuProps: { class: 'detail-select-menu' },
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      options: glassOptions,
      filterable: true,
      // ⚠️ **不加 `clearable`** —— 原版底玻/面玻两格都没有（@75060 / @73314），
      //    配合「必填」校验与新建行默认值（磨砂·白玻 / 白玻·白玻）⇒ 空串根本产生不出来。
      onUpdateValue: (v: string | null) => {
        const old = oldByField.get(l) ?? (l as unknown as Record<string, string>)[field] ?? ''
        ;(l as unknown as Record<string, string>)[field] = (v as string) ?? ''
        oldByField.set(l, (v as string) ?? '')
        onGlassSelection(l, (v as string) ?? '', old)
        // 「改底玻 → 设为默认」只在**平开表**（原版 `le` 仅挂在平开表底玻格的 onSelect/onBlur）。
        if (field === 'bottom_glass' && l.line_type === 'ping') rememberDefaultBottomGlass((v as string) ?? '')
      },
    },
  )
}

// 就地控件 helpers（h() 渲染）
const CELL = {
  size: 'small' as const,
  style: { width: '100%' },
  // 旧版的 el-input / el-select 在不写 placeholder 时是**空的**；
  // naive-ui 不给就是英文默认值（"Please Input" / "Please Select"），必须显式清空。
  placeholder: '',
}

// 校验红框：必填但为空的字段 → status=error（仿旧版 error-cell 红框标单元格）
function cellError(l: Line, field: string): boolean {
  const t = l.line_type
  switch (field) {
    case 'profile': return !l.profile.trim()
    // 门洞宽/高**不标红** —— 原版从不给 `errorFields["门洞高"/"门洞宽"]` 写 true（死代码，见
    // `missingFieldsOf` 的注释），单元格上的 `error-cell` 绑定恒为 false。
    case 'color': return !l.color.trim()
    // 底玻/面玻 也是必填：原版两格都挂了 `error-cell`（`{["error-cell"]: 校验结果["底玻"]}`），
    // 且**没有 `clearable`**（见 @75060 平开 / @185271 吊趟 的底玻格、@73314 / @183565 的面玻格）。
    case 'bottom_glass': return !l.bottom_glass.trim()
    case 'face_glass': return !l.face_glass.trim()
    case 'glass_thickness': return !l.glass_thickness.trim()
    case 'direction': return !l.direction.trim()
    case 'quantity': return t === 'ping' && !(l.quantity >= 1)
    case 'price_type': return t === 'ping' && !l.price_type.trim()
    case 'fans': return t === 'diao' && !l.fans.trim()
    case 'track': return t === 'diao' && !l.track.trim()
    default: return false
  }
}

function tCell(l: Line, field: string, onBlur?: (l: Line) => void) {
  if (!isEditing(l)) return detailMultiline((l as unknown as Record<string, string>)[field])
  return h(
    NInput,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      onUpdateValue: (v: string) => {
        ;(l as unknown as Record<string, string>)[field] = v
        lineRefresh(l)
      },
      onBlur: onBlur ? () => onBlur(l) : undefined,
    },
  )
}

/**
 * 数字格红字（旧版 `.red-number-input .el-input__inner{color:red}`）挂在哪些格子上：
 *   平开：门洞高 / 门洞宽 / 墙厚 / 钻石型门洞尺寸里的「右宽」那一格（绑的也是 亮窗总高）
 *   移门：门洞高 / 门洞宽 / 墙厚 / 封板高
 * 注意 **独立的「亮窗总高」列不红**（原版那一格没挂 class）—— 同一字段在钻石型里才红，
 * 两种渲染互斥，所以这里按 `isDiamond` 判断即可。吊脚 / 轨道长 / 边封数 都是黑字。
 */
function isRedNum(l: Line, field: string): boolean {
  if (field === 'door_width' || field === 'door_height' || field === 'wall_thickness') return true
  if (field === 'light_window_height') return isDiamond(l)
  if (field === 'seal_board_height') return l.line_type === 'diao'
  return false
}

function intCell(l: Line, field: string, min = 0) {
  if (!isEditing(l)) return detailValue((l as unknown as Record<string, number>)[field])
  // 门洞宽/门洞高在**失焦**时触发尺寸类自动加价（原版 `Qt` 挂在 onBlur 上，不是随输入）
  const sizeField =
    field === 'door_width' || field === 'door_height' ? (field as SizeField) : null
  return h(
    NInputNumber,
    {
      ...CELL,
      class: isRedNum(l, field) ? 'red-number-input' : undefined,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, number>)[field],
      min,
      showButton: false,
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        ;(l as unknown as Record<string, number>)[field] = sanitizeNum(v, min)
        lineRefresh(l)
      },
      onBlur: sizeField ? () => syncSizeMarkup(l, sizeField) : undefined,
    },
  )
}

function moneyCell(l: Line, field: string, min = 0) {
  if (!isEditing(l)) return detailValue((l as unknown as Record<string, number>)[field])
  return h(
    NInputNumber,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, number>)[field],
      min,
      showButton: false,
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        ;(l as unknown as Record<string, number>)[field] = sanitizeFloat(v, min)
        lineRefresh(l)
      },
    },
  )
}

function optCell(
  l: Line,
  field: string,
  options: { label: string; value: string }[],
  onChange?: (l: Line) => void,
  allowCreate = false,
  historyKey?: string,
) {
  if (!isEditing(l)) return detailValue((l as unknown as Record<string, string>)[field])
  return h(
    NSelect,
    {
      ...CELL,
      virtualScroll: false,
      consistentMenuWidth: false,
      widthMode: 'max-content',
      menuProps: { class: 'detail-select-menu' },
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      options,
      filterable: true,
      clearable: true,
      ...(allowCreate ? { tag: true } : {}),
      onUpdateValue: (v: string | null) => {
        const next = (v as string) ?? ''
        ;(l as unknown as Record<string, string>)[field] = next
        if (historyKey) rememberField(historyKey, next)
        ;(onChange ?? lineRefresh)(l)
      },
    },
  )
}

// 型材/颜色：带候选下拉（可搜索 + 可输入新值，仿旧版 autocomplete），型材变化即取价/算料
// 型材候选按行门型过滤（平开不显示移门公式）
function profileCell(l: Line) {
  if (!isEditing(l)) return detailValue(l.profile)
  const opts = l.line_type === 'diao' ? diaoProfileOptions.value : pingProfileOptions.value
  // 不加 `historyKey`：原版型材**不写候选库**（见 `profileOptionsFor` 注释），故无需记忆。
  return optCell(l, 'profile', opts, (x) => void resolveRow(x), true)
}


function colorCell(l: Line) {
  if (!isEditing(l)) return detailValue(l.color)
  return h(
    NSelect,
    {
      ...CELL,
      virtualScroll: false,
      consistentMenuWidth: false,
      widthMode: 'max-content',
      menuProps: { class: 'detail-select-menu' },
      status: cellError(l, 'color') ? 'error' : undefined,
      value: l.color,
      options: colorOptions.value,
      filterable: true,
      clearable: true,
      tag: true,
      onUpdateValue: (v: string | null) => {
        const next = (v as string) ?? ''
        l.color = next
        rememberField('color', next)
        lineRefresh(l)
      },
    },
  )
}
function trackCell(l: Line) {
  if (!isEditing(l)) return detailValue(l.track)
  // 轨道候选按当前行公式 parts 的 track 提取（随型材联动），合并历史
  const opts = partsTrackOptions(l, 'track') // 轨道候选仅来自公式 parts + 历史，无内置兜底
  return optCell(l, 'track', opts, undefined, true, 'track')
}
function casingCell(l: Line) {
  if (!isEditing(l)) return detailValue(l.casing)
  // 套线候选仅来自当前行公式 parts 的单包/双包 + 历史，无内置候选（原版）
  const opts = partsTrackOptions(l, 'casing')
  return optCell(l, 'casing', opts, undefined, true, 'casing')
}
// 平开「包边」＝原版「套线种类」（Hui.formatted.js:2132 的「包边:」标签即绑 `e["套线种类"]`）。
// 平开公式常无 包宽/包高 件，纯靠 parts 提候选会空，故候选 = 原版枚举 + 公式套线件 track + 历史。
/**
 * 五金格 —— 原版是**多选** el-select（:2387-2434）：
 *   · 行字段 `五金` 存的是**下划线分隔的字符串**（`a_b_c`），候选里要去掉已选的；
 *   · `multiple/filterable/allow-create/collapse-tags`，`placeholder:"选择或填写五金"`；
 *   · 已选项会在下方另起一行 `join("、")` 展示（:2434-2435，style margin-top:4px/font-size:12px/color:#606266）。
 * 我们原来是**单选**（`optCell` + tag），只能存一个五金 —— 与旧版不符，这里改成多选。
 */
function hardwareCell(l: Line) {
  const selected = String(l.hardware || '')
    .split('_')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!isEditing(l)) return detailMultiline(selected.join('、'))
  const options = hardwareOptionsFor(l).filter((o) => !selected.includes(o.value))
  return h('div', { class: 'glass-inputs-container' }, [
    h(NSelect, {
      ...CELL,
      virtualScroll: false,
      consistentMenuWidth: false,
      widthMode: 'max-content',
      menuProps: { class: 'detail-select-menu' },
      multiple: true,
      filterable: true,
      tag: true,
      options,
      value: selected,
      placeholder: '选择或填写五金',
      onUpdateValue: (vals: string[]) => {
        // 去重后写回下划线串（原版 `m(行, 值数组)`：`[...new Set(v)].join("_")`）
        l.hardware = [...new Set(vals.map((v) => String(v)))].join('_')
        rememberField('hardware', l.hardware)
        lineRefresh(l)
      },
    }),
    selected.length
      ? h(
          'div',
          { style: 'margin-top:4px;font-size:12px;color:#606266;line-height:1.4' },
          selected.join('、'),
        )
      : null,
  ])
}
// 洞尺选项 —— **两张表的取值集不同**（原版 ping :2341-2345 只有 2 项，diao :5136-5141 有 4 项）
const PING_HOLE_SIZE_OPTS = ['洞尺', '净尺'].map((v) => ({ label: v, value: v }))
const DIAO_HOLE_SIZE_OPTS = ['洞尺', '净尺', '单包洞尺', '双包洞尺'].map((v) => ({ label: v, value: v }))
function holeCell(l: Line, options: { label: string; value: string }[]) {
  return optCell(l, 'hole_size', options)
}

// ════ 搬迁自 Hui.vue 1703-1718：B selCol ════
// 批量选择列：行首复选框，选中后可批量删除
const selCol = (): DataTableColumn<Line> => ({
  title: ' ',
  key: 'selection',
  width: 34,
  fixed: 'left',
  render: (l: Line) =>
    h(NCheckbox, {
      size: 'small',
      checked: !!l.isSelected,
      onUpdateChecked: (v: boolean) => {
        l.isSelected = v
        props.hooks.onSelectChange()
      },
    }),
})

// ════ 搬迁自 Hui.vue 1756-1781：C partsTooltip ════
function partsTooltip(l: Line) {
  const parts = (l.parts ?? []).filter((p) => p && p.materialName)
  if (!parts.length) return '点「算料」后在此显示部件数量与下料长度'
  return parts
    .map((p) => `${p.materialName} ×${p.quantity} → ${p.result.toFixed(2)}`)
    .join('\n')
}

// 操作列。**表头文字就是「平开门」/「移门」**（原版 :1723 / :4517 `label:"平开门"/"移门"`，
// width:"50"）——旧版没有额外的表格标题栏，门型名就挂在第一列表头上。
// 原版这一格的按钮是 **删除 / 复制 / 查看3D**（`div.upload-buttons` 竖排、文案前后带空格）。
// ⚠️ **第三颗是「查看3D」，我们这里是空的** —— 3D 那一摊用户已拍板暂缓
//   （memory `3d-module-deferred`），做 3D 模块时补在第二位。
//   2026-09-19 之前这里放的是「算料」，注释写着"把查看3D换成算料" —— **位置错了**：
//   旧版的算料在**门花图列**（`:1880` / `:4682`），已挪回 `doorImgCell`。
//   见 `docs/2026-09-08-hui-table-gap.md` 那条「未复核」的结论。
// ===== 行级编辑态（旧版「点单元格 → 该行可 保存/取消」三件套）=====
//
// 旧版平开 `Hui.formatted.js:1335` 的 `ht=ref(new Map)` / `vt=ref(new Set)` / `pt=ref({})`；
// 移门 `:3769-3770` 的 `ae`/`xe`/`_e`。**两个 SFC 各持一份**，所以这里也是两份。
//
// | 本文件 | 旧版平开 | 旧版移门 | 是什么 |
// |---|---|---|---|
// | `editing`  | `ht` | `xe` | rowKey → 该行在表里的下标。**同时只允许一行**（进新行前 `clear()`） |
// | `snapshot` | `pt` | `ae` | rowKey → 进入编辑态那一刻的行副本（「取消」靠它回滚） |
// | `dirty`    | `vt` | `_e` | rowKey 集合；判定见 `recomputeDirty` |
//
// ⚠️ 新建行在服务端落库前没有 `id`，但仍必须支持就地编辑。
//    因此为无 id 的行分配组件实例内的稳定临时 key；它只用于编辑态、脏状态和表格行识别，
//    不会写入 API 或数据库。保存/取消/删除后对象离开表格，WeakMap 也会自然释放。

// ════ 搬迁自 Hui.vue 1782-1924：D 行级编辑态 ════
type EditState = {
  editing: Map<string, number>
  snapshot: Record<string, Line>
  dirty: Set<string>
}
const pingEdit = reactive<EditState>({ editing: new Map(), snapshot: {}, dirty: new Set() })
const diaoEdit = reactive<EditState>({ editing: new Map(), snapshot: {}, dirty: new Set() })

/**
 * 行键：已落库行使用服务端 `id`；新建行使用组件实例内的临时 key。
 * 临时 key 只用于 Vue / Naive UI 的行识别和编辑状态，不会写入业务字段。
 */
const ephemeralRowKeys = new WeakMap<object, string>()
let ephemeralRowKeySeed = 0
const rowKeyOf = (l: Line): string => {
  if (l.id != null) return String(l.id)
  const objectKey = l as unknown as object
  let key = ephemeralRowKeys.get(objectKey)
  if (!key) {
    key = `new-line-${++ephemeralRowKeySeed}`
    ephemeralRowKeys.set(objectKey, key)
  }
  return key
}
/** 该行归哪张表的编辑态。 */
const editOf = (l: Line): EditState => (l.line_type === 'diao' ? diaoEdit : pingEdit)

/**
 * 脏判定用的投影（旧版 `Bt`/`ce`：剔掉一组**客户端专用**键）。
 * 旧版剔的是 `["平开门","门花图","开向图","errorFields","imageUrl","isSelected","生产进度"]`。
 * 换到我们的字段：`开向图`/`imageUrl`/`生产进度` 是**要落库的列**（`open_img`/`image_url`/`progress`），
 * 不能剔（剔了 `update_line` 会把它们抹空）；`errorFields` 我们没有；操作列标签不是字段。
 * ⇒ **只剔 `isSelected`**。
 */
function stripForDirty(l: Line): Record<string, unknown> {
  const out: Record<string, unknown> = { ...l }
  delete out.isSelected
  return out
}

/** 脏判定（旧版 `Et`/`ne`）：没有快照 ⇒ 不脏；有快照 ⇒ 与快照逐字段比。 */
function recomputeDirty(l: Line) {
  const st = editOf(l)
  const k = rowKeyOf(l)
  if (!k) return
  const snap = st.snapshot[k]
  if (!snap) {
    st.dirty.delete(k)
    return
  }
  if (JSON.stringify(stripForDirty(l)) !== JSON.stringify(stripForDirty(snap))) st.dirty.add(k)
  else st.dirty.delete(k)
}

/** 该行是否处于编辑态（决定操作列出「确认修改/取消」还是「删除/复制/算料」）。 */
const isEditing = (l: Line) => {
  const k = rowKeyOf(l)
  return !!k && editOf(l).editing.has(k)
}
/** 该行是否有未保存改动（`unsaved-row` 粉底的唯一来源）。 */
const isDirty = (l: Line) => {
  const k = rowKeyOf(l)
  return !!k && editOf(l).dirty.has(k)
}

/**
 * 「上一行还有未保存改动」守卫（旧版 `It`）。
 * 返回 `true` = 可以继续（该保存的已保存）；`false` = 用户选了「继续编辑」，别往下走。
 *
 * 旧版 `ElMessageBox.confirm(…, { distinguishCancelAndClose: true })`：
 * 确认 → 保存并切换；**取消与关闭都算「继续编辑」**（`catch` 一支）。
 */
async function confirmLeaveDirtyRow(target?: Line): Promise<boolean> {
  for (const st of [pingEdit, diaoEdit]) {
    const key = st.editing.keys().next().value as string | undefined
    if (!key || !st.dirty.has(key)) continue
    // ⚠️ **同一行里换格子不算「切行」**，直接放行 —— 旧版 `It` 的第二个判据
    //    `if (!a || !_ || a === _ || !vt.has(a)) return true`（`Hui.formatted.js:1362-1368`）。
    //    2026-09-19 补：漏了它，在同一行里点第二个格子就会莫名弹「未保存提醒」。
    if (target && rowKeyOf(target) === key) continue
    const row = engine.lines.value.find((x) => rowKeyOf(x) === key)
    if (!row) continue
    const go = await new Promise<boolean>((resolve) => {
      dialog.warning({
        title: '未保存提醒',
        content: '当前行有未保存修改，是否先保存？',
        positiveText: '保存并切换',
        negativeText: '继续编辑',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
        onAfterLeave: () => resolve(false),
      })
    })
    if (!go) return false
    await saveRow(row)
    if (st.dirty.has(key)) return false
  }
  return true
}

/**
 * 点单元格进入编辑态（旧版 `kt`）。
 *
 * ⚠️ 旧版 `kt` 挂在 Element Plus 的 `@cell-click`，**每次点单元格都跑一遍** ——
 *    所以同一行里换个格子再点，快照会被**重新拍**（`pt[key]={...row}`）。
 *    后果：「取消」只回滚到**最后一次点击**那一刻，不是进入该行编辑的那一刻。
 *    这是旧版原样行为，**照抄**；是否算缺陷另行确认（见方案文档 §7）。
 *    另一处：旧版首个判据是 `column.property === "平开门"` 跳过操作列 ——
 *    我们改在操作列那格 `stopPropagation`（naive-ui 的 `n-data-table` 没有 cell-click 事件，
 *    只有 `row-props`，拿不到列信息）。
 */
async function enterEdit(l: Line) {
  if (!(await confirmLeaveDirtyRow(l))) return
  const st = editOf(l)
  st.editing.clear()
  const k = rowKeyOf(l)
  if (!k) return
  const rows = l.line_type === 'diao' ? props.rows : props.rows
  st.snapshot[k] = { ...l }
  st.editing.set(k, rows.indexOf(l))
  recomputeDirty(l)
}

/** 「取消」：用快照回滚（旧版 `kt` 旁边那颗按钮，`:1735-1741`）。 */
function cancelEdit(l: Line) {
  const st = editOf(l)
  const k = rowKeyOf(l)
  if (!k) return
  const snap = st.snapshot[k]
  if (snap) Object.assign(l, snap)
  st.editing.delete(k)
  delete st.snapshot[k]
  st.dirty.delete(k)
}

/**
 * 单行保存（旧版 `Ut` / 移门 `fe`）→ `PUT /orders/{id}/lines/{line_id}`。
 *
 * 旧版先 POST `param1=updateRowData`；我们走 RESTful 端点（同一个东西）。
 *
 * ⚠️ **平开那侧的「锁具没有指定」只是警告、不拦截**（旧版 `Ut` 第一行是个 `&&` 链，
 *    `ElMessage.warning` 是最后一个操作数，没有 `return`）。移门侧**没有这条**。
 */
async function saveRow(l: Line) {
  if (l.line_type === 'ping' && colVis(props.colVis, 'track') && !(l.track || '').trim()) {
    message.warning('锁具没有指定，请确认是否遗漏！')
  }
  const k = rowKeyOf(l)
  // ⚠️ 这三条**必须出声**：静默 return 会表现成「点了没反应」，查起来极费劲
  //    （2026-09-19 踩过）。用户点了按钮就该有反馈，哪怕是「这行还没落库」。
  if (!k || l.id == null) {
    message.warning('该行还没落库，无法单独保存 —— 请先用页面上的「保存回执单」整单保存')
    return
  }
  if (props.savedOrderId == null) {
    message.warning('该订单还没落库，无法单独保存 —— 请先整单保存')
    return
  }
  try {
    await api.updateOrderLine(props.savedOrderId, l.id, props.hooks.lineInputOf(l))
    message.success('数据更新成功')
    const st = editOf(l)
    st.editing.delete(k)
    delete st.snapshot[k]
    st.dirty.delete(k)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '更新失败')
  }
}

// ════ 搬迁自 Hui.vue 1926-1966：E opsCol ════
const opsCol = (label: string): DataTableColumn<Line> => ({
  title: label,
  key: 'actions',
  width: 96,
  fixed: 'left',
  // 两个分支（旧版 `:1729-1735` 起）：
  //   编辑中 → 「确认修改」「取消」（标签逐字：`" 确认修改 "` 前后带空格，`:674`）
  //   否则   → 「删除」「复制」+ 第三个按钮
  // ⚠️ 外层 `stopPropagation`：我们的「进入编辑态」挂在 `row-props` 的 onClick 上，
  //    不拦住的话点「删除」会先把该行推进编辑态（旧版靠 `column.property === "平开门"` 跳过）。
  render: (l) =>
    h(
      'div',
      {
        style:
          'display:flex;flex-wrap:wrap;gap:0 6px;align-items:center;line-height:1.5;font-size:11px;white-space:nowrap',
        onClick: (e: MouseEvent) => e.stopPropagation(),
      },
      isEditing(l)
        ? [
            h(NButton, { size: 'tiny', text: true, onClick: () => void saveRow(l) }, { default: () => ' 确认修改 ' }),
            h(NButton, { size: 'tiny', text: true, type: 'error', onClick: () => cancelEdit(l) }, { default: () => '取消' }),
          ]
        : [
            h(NButton, { size: 'tiny', text: true, type: 'error', onClick: () => removeLine(l) }, { default: () => '删除' }),
            h(NButton, { size: 'tiny', text: true, onClick: () => copyRow(l) }, { default: () => '复制' }),
            // ⚠️ 旧版这一列的**第三颗是「查看3D」**，不是「算料」——
            //    算料在**门花图列**（旧版 `Hui.formatted.js:1880` 平开 / `:4682` 移门），
            //    见 `doorImgCell` 里那颗。这里**不补**：查看3D 属 3D 那一摊，用户已拍板暂缓
            //    （见 memory `3d-module-deferred`），做 3D 模块时补在这两位。
            //    2026-09-19 之前这里放的是「算料」（当时的注释写着"把查看3D换成算料"）—— 位置错了。
          ],
    ),
})

// 金额格的「平方数」那一行：**只读输入框**，唯一入口是右键打开「修改平方数」浮窗
// （原版 :2482-2491：外层 div 挂 onContextmenu，内层 el-input `modelValue:行["平方数"] readonly`）。

// ════ 搬迁自 Hui.vue 1967-2061：F sqCell/amountCell/remarkCell/markupSelectCell/markupCol ════
const sqCell = (l: Line) => {
  if (!isEditing(l)) return detailValue(l.square.toFixed(2))
  return h(
    'div',
    {
      onContextmenu: (e: MouseEvent) => {
        e.preventDefault()
        props.hooks.openSquareDialog(l)
      },
    },
    [h(NInput, { ...CELL, readonly: true, value: l.square.toFixed(2) })],
  )
}

// 金额格的「金额」那一行：原版是 `el-input readonly:!we["金额"][id]`，
// 而 `we` 只在 onBlur 里被写成 `false`（`!false` 仍是 true）⇒ **恒只读**，不会变成可编辑。
const amountCell = (l: Line) =>
  isEditing(l) ? h(NInput, { ...CELL, readonly: true, value: l.amount.toFixed(2) }) : detailValue(l.amount.toFixed(2))

// 备注格：原版是 `el-input type="textarea" :autosize="{minRows:1}"`，不是单行输入框。
function remarkCell(l: Line) {
  if (!isEditing(l)) return detailMultiline(l.remark)
  return h(NInput, {
    ...CELL,
    type: 'textarea',
    autosize: { minRows: 1 },
    value: l.remark,
    onUpdateValue: (v: string) => {
      l.remark = v
      lineRefresh(l)
    },
  })
}

// 加价项目列：行内摘要（名称+金额），点击进入行编辑抽屉管理
// 行内加价：多选目录 + 明细行 + 点击添加（自定义→抽屉）
function markupSelectCell(l: Line) {
  const selected = (l.markup ?? [])
    .filter((m) => m && m.name)
    .map((m) => {
      const idx = markupCatalog.value.findIndex((c) => c.name === m.name)
      return idx >= 0 ? `${idx}_${m.name}` : `x_${m.name}__${m.price}__${m.unit}`
    })
  // 明细多行：原版把 `wt`/`ft` 产出的文本按 `\n` 渲染成 `.expression-line`（`Hui.formatted.js:2515`），
  // 内容是**带算式的文本**（如 `超宽: 5元/公分*3.5公分*2=35元`），不是「名称 ¥金额」。
  // 文本可现算（与金额同源、同一批分支），故不必落库。
  const lines = markupLines(l, markupError)
  if (!isEditing(l)) return detailMultiline(lines.join(' · '))
  const opts = markupCatalogOptions.value
  // ⚠️ 结构与类名照抄原版（平开 @2497-2520 / 吊趟 @5288-5300 两处同构）：
  //   div.extra-items-container
  //     ├ div.glass-input-label  文案 `" 点击添加： "`（**前后各一个空格 + 全角冒号**）cursor:pointer
  //     ├ el-select              multiple/collapse-tags/collapse-tags-tooltip/filterable，宽 **100%**
  //     └ div.extra-items-expressions（有内容才渲染）
  //   四个类的样式见 <style scoped> 末尾（从 legacy/css/Hui-39b802eb.css 抄的）。
  return h('div', { class: 'extra-items-container' }, [
    h(
      'div',
      { class: 'glass-input-label', style: { cursor: 'pointer' }, onClick: () => props.hooks.openAddMarkup(l) },
      ' 点击添加： ',
    ),
    h(NSelect, {
      size: 'small',
      virtualScroll: false,
      consistentMenuWidth: false,
      widthMode: 'max-content',
      menuProps: { class: 'detail-select-menu' },
      multiple: true,
      'collapse-tags': true,
      'collapse-tags-tooltip': true,
      filterable: true,
      options: opts,
      value: selected,
      placeholder: '请选择加价项目',
      style: { width: '100%' },
      onUpdateValue: (vals: (string | number)[]) => {
        const names = vals.map((v) => String(v))
        l.markup = names.map((n) => {
          const m = n.match(/x_(.+)__([\d.]+)__(.+)/)
          if (m) return { name: m[1], price: Number(m[2]), unit: m[3], amount: 0 }
          const idx = Number(n.split('_')[0])
          const c = markupCatalog.value[idx]
          return c ? { ...c, amount: 0 } : { name: n, price: 0, unit: '元/套', amount: 0 }
        })
        lineRefresh(l)
      },
    }),
    lines.length
      ? h(
          'div',
          { class: 'extra-items-expressions' },
          lines.map((t) => h('div', { class: 'expression-line' }, t)),
        )
      : null,
  ])
}
const markupCol = (): DataTableColumn<Line> => ({
  title: '加价项目',
  key: 'markup_summary',
  width: 168,
  render: (l) => markupSelectCell(l),
})

// ===== 门花图（行图片）：传图/文字传图/预览/删除 =====

// ════ 搬迁自 Hui.vue 2178-2211：G doorImgCell ════
function doorImgCell(l: Line) {
  if (l.image_url) {
    return h('div', { key: 'door-img', style: 'position:relative;display:inline-block' }, [
      h('img', {
        src: l.image_url,
        style: 'display:block;width:76px;height:52px;object-fit:contain;border:1px solid #dcdfe6;border-radius:3px;cursor:zoom-in;background:#fff',
        onClick: () => {
          props.hooks.previewImage(l.image_url ?? '')
        },
      }),
      h(
        NButton,
        { size: 'tiny', quaternary: true, circle: true, type: 'error', title: '删除门图', style: 'position:absolute;top:-6px;right:-6px', onClick: () => props.hooks.removeDoorImg(l) },
        { icon: () => '×' },
      ),
    ])
  }
  return h(
    'div',
    {
      key: 'door-img-empty',
      style:
        'display:flex;align-items:center;justify-content:center;gap:2px;width:76px;height:52px;border:1px dashed #c0c4cc;border-radius:3px;background:#fafafa;cursor:pointer',
      onClick: (e: MouseEvent) => e.stopPropagation(),
    },
    [
      h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: () => props.hooks.pickDoorImg(l) }, { default: () => '传图' }),
      h(NButton, { size: 'tiny', text: true, onClick: () => props.hooks.openTextImg(l) }, { default: () => '文字' }),
      // ★ **算料在这里**，不在操作列 —— 旧版两张表的门花图列（无图态）都是 传图 / 文字 / 算料，
      //   算料排在最后、`type:"warning"`、且**要先判 `row.formulaid` 非空**：
      //   `a.formulaid && "" !== a.formulaid.trim() ? emit("calculateSingleRow") : 警告`
      //   （平开 `Hui.formatted.js:1880` / 移门 `:4682`；触发点表见
      //    `docs/2026-09-18-detail-sfc-recon.md` §5）。
      //   2026-09-19 之前我们把它错放在操作列（占着查看3D 那位），门花图列反而没有。
      h(
        NTooltip,
        { trigger: 'hover', placement: 'left', rawContent: false },
        {
          trigger: () =>
            h(NButton, { size: 'tiny', text: true, type: 'warning', onClick: () => void props.hooks.calcSingleRow(l) }, { default: () => '算料' }),
          default: () => h('pre', { style: 'margin:0;font-size:12px;white-space:pre-wrap;max-width:340px' }, partsTooltip(l)),
        },
      ),
    ],
  )
}

// 载入订单后：有 image_id 但无 image_url 的行，从 IndexedDB 回读

// ════ 搬迁自 Hui.vue 2233-2269：H cCol/sub/DOUBLE_DING_OPTS/orderNoCell/moneyCell_2/doorImgCol ════
const cCol = (...vs: (import('vue').VNodeChild | null)[]) =>
  h('div', { class: 'glass-inputs-container' }, vs)
const sub = (label: string, ctrl: import('vue').VNodeChild | null) =>
  h('div', { class: 'glass-input-group' }, [
    h('div', { class: 'glass-input-label' }, label),
    ctrl == null ? null : h('div', { class: 'glass-input' }, [ctrl]),
  ])

const DOUBLE_DING_OPTS = ['正常', '单丁墙', '双丁墙', '上丁墙', '上丁加单丁', '上丁加双丁'].map((v) => ({
  label: v,
  value: v,
}))
/**
 * 「单号」列。
 *
 * ⚠️ 这里曾显示 `order.receipt_no`（订单的**回执单号**）—— **层级错了**：
 * 旧版这列是**行级**单号（每樘门一个，`N-YY/MM/DD`），且**可编辑**
 * （`Hui.formatted.js:2597-2602`，列 label `:6287`）。
 * 搞混的后果不只是显示错：打印的 `OrderID`/`qrcode` 全取这列，
 * 于是**二维码扫出来是订单号而不是「哪一樘门」**（见 `docs/2026-09-18-order-no-semantics.md` §4.1）。
 *
 * 未填时显示 `—`；「填入单号」按钮会向服务端取号后回填（等同旧版 `:8491` 那颗按钮）。
 */
const orderNoCell = (l: Line) =>
  h('span', { style: 'font-size:11px;color:#606266' }, l.line_no || '—')
// 金额列（平方+金额 同格）
// 金额格（原版 :2471-2492）：`金额：`（只读输入框）+ `平方数：`（只读输入框，右键改）
const moneyCell_2 = (l: Line) => cCol(sub('金额：', amountCell(l)), sub('平方数：', sqCell(l)))

const doorImgCol = (): DataTableColumn<Line> => ({
  title: '门花图',
  key: 'door_img',
  width: 72,
  fixed: 'left',
  render: (l) => doorImgCell(l),
})


// ════ 搬迁自 Hui.vue 2270-2548：I pingCols/diaoCols ════
function pingCols(): DataTableColumn<Line>[] {
  return [
    selCol(),
    opsCol('平开门'),
    doorImgCol(),
    {
      title: '型材/颜色',
      key: 'profile_color',
      width: 142,
      render: (l) => cCol(sub('型材：', profileCell(l)), sub('颜色：', colorCell(l))),
    },
    {
      title: '单价/数量',
      key: 'unit_quantity',
      width: 96,
      render: (l) => cCol(sub('单价：', moneyCell(l, 'unit_price')), sub('数量：', intCell(l, 'quantity', 1))),
    },
    {
      title: '玻璃',
      key: 'glass',
      width: 150,
      render: (l) =>
        cCol(
          // 面玻标签**随公式类型变**（原版 :1992-1998：
          //   `formulaid && L.value[formulaid] ? (=== 'diamond' ? '门玻：' : '面玻：') : '面玻：'`）。
          sub(isDiamond(l) ? '门玻：' : '面玻：', glassSelectCell(l, 'face_glass')),
          // 底玻标签同样随公式类型变（原版 :2042-2048：钻石型 '固玻：'，否则 '底玻：'）。
          sub(isDiamond(l) ? '固玻：' : '底玻：', glassSelectCell(l, 'bottom_glass')),
          // 厚度一格**不分支**：原版此处恒为 '厚度：'，钻石型也照旧。
          // 平开表改厚度即「设为默认玻璃厚度」（原版 `ne`，:887）。
          sub(
            '厚度：',
            optCell(l, 'glass_thickness', glassThicknessOptions, (row) => {
              if (row.line_type === 'ping') rememberDefaultGlassThickness(row.glass_thickness)
              lineRefresh(row)
            }),
          ),
        ),
    },
    {
      // 原版这一列**没有 `label`**，标题完全由 header 插槽给出：
      //   `span.clickable-header(onClick=M)` 文本 `" 开向 "`（前后各一个空格）+ 设置图标。
      title: () =>
        h('span', { class: 'clickable-header', onClick: openOpenDirSettings }, [
          ' 开向 ',
          h('span', { style: 'font-size:11px' }, '⚙'),
        ]),
      key: 'open_dir',
      width: 150,
      render: (l) => {
        // ⚠️ 开向图要**先把自定义开向名还原成原始开向**再查表（原版 `ve.value[C(行["开向"])]`，
        //    `C` = `getOriginalOpenDirection`）。直接用显示名查会漏图。
        const img = PING_DIRECTION_IMAGES[getOriginalOpenDirection(l.direction)]
        return cCol(
          ...(colVis(props.colVis, 'casing')
            ? [sub('包边：', optCell(l, 'casing', pingCasingOptions(l, casingKindOptions), undefined, true, 'casing'))]
            : []),
          ...(colVis(props.colVis, 'track') ? [sub('锁具：', trackCell(l))] : []),
          sub('开向：', optCell(l, 'direction', pingDirectionOptions.value, undefined, true)),
          h('div', { class: 'image-cell2 image-cell2--ping' }, [
            img ? h('img', { src: img, alt: l.direction, class: 'direction-image' }) : null,
          ]),
        )
      },
    },
    // 原版 ping 表 门洞尺寸格（:2222-2348）从上到下：
    //   高度： → 宽度：/左宽： → ( 母门宽: ) → 墙厚：/门宽： → (右宽：, 钻石型) → (洞/净尺：)
    // `l.value` 那个三元（决定高/宽谁在前）在旧版恒走 key:0，即**高度在上**。
    {
      title: '门洞尺寸',
      key: 'door_size',
      width: 96,
      render: (l) =>
        cCol(
          sub('高度：', intCell(l, 'door_height')),
          // 门洞宽标签随公式类型变（原版 :2231-2236：钻石型 '左宽：'，否则 '宽度：'）。
          sub(isDiamond(l) ? '左宽：' : '宽度：', intCell(l, 'door_width')),
          // 母门宽：标签原文是 `" 母门宽: "`（**前后空格 + 半角冒号**），闸门是
          // `L.value[formulaid] === 'parentSubsidiary'`（子母门公式类型）。
          ...(needsMotherWidth(l) ? [sub(' 母门宽: ', intCell(l, 'mother_door_width'))] : []),
          // 墙厚一格也分支：钻石型显示 '门宽：'（仅 ping 表如此，diao 表恒为 '墙厚：'）。
          sub(isDiamond(l) ? '门宽：' : '墙厚：', wallThicknessCell(l)),
          // 钻石型时「亮窗总高」这个字段**搬进本列**并改名「右宽」（原版 :2314-2335）。
          // 非钻石时它在下面独立的「亮窗总高」列里 —— 两处互斥。
          ...(isDiamond(l) ? [sub('右宽：', intCell(l, 'light_window_height'))] : []),
          // ⚠️ 「洞尺」**不是独立列**，而是门洞尺寸格里的最后一块（原版 :2336-2346，
          //    `_["value"]["洞尺"]` 闸门 + `"洞/净尺："` 标签 + 下拉「洞尺/净尺」两项）。
          ...(colVis(props.colVis, 'hole_size')
            ? [sub('洞/净尺：', holeCell(l, PING_HOLE_SIZE_OPTS))]
            : []),
        ),
    },
    // 原版 ping 表里「吊脚」与「亮窗总高」是**两个独立列**（`Hui-d088417c` @86619 / @86995），
    // 槽内直接渲染输入框、无内嵌小标签。吊脚列由 `列显隐表['吊脚']` 闸门；亮窗总高列**无闸门**（原版如此）。
    {
      title: '吊脚',
      key: 'jiao',
      width: 62,
      render: (l) => intCell(l, 'jiao'),
    },
    {
      title: '亮窗总高',
      key: 'lightwin',
      width: 62,
      // 原版该列自带互斥条件：`L.value[formulaid] !== 'diamond'` 才渲染输入框，钻石型整格为空
      // （else 分支是 `createCommentVNode`）。无公式时渲染（与原版 `return true` 一致）。
      render: (l) => (isDiamond(l) ? null : intCell(l, 'light_window_height')),
    },
    // 原版「五金」（`["五金"]` 闸门）与「封板高」是两个独立列
    { title: '五金', key: 'hardware', width: 110, render: (l) => hardwareCell(l) },
    { title: '封板高', key: 'seal_board', width: 62, render: (l) => intCell(l, 'seal_board_height') },
    {
      title: '备注',
      key: 'remark',
      width: 110,
      render: (l) => cCol(sub('地址：', tCell(l, 'install_address')), sub('备注：', remarkCell(l))),
    },
    { title: '金额', key: 'money', width: 96, render: (l) => moneyCell_2(l) },
    markupCol(),
    // 原版平开表尾部列序：加价项目 → 计价方式 → 打折 → 前包加长 → 后包加长 → 单双丁 → 单号 → …
    { title: '计价方式', key: 'price_type', width: 88, render: (l) => optCell(l, 'price_type', priceTypeOptions) },
    { title: '打折', key: 'discount', width: 62, render: (l) => moneyCell(l, 'discount') },
    { title: '前包加长', key: 'front_casing', width: 84, render: (l) => intCell(l, 'front_casing_add') },
    { title: '后包加长', key: 'back_casing', width: 84, render: (l) => intCell(l, 'back_casing_add') },
    { title: '单/双丁墙体', key: 'double_ding', width: 110, render: (l) => optCell(l, 'double_ding', DOUBLE_DING_OPTS) },
    { title: '单号', key: 'order_no', width: 78, render: (l) => orderNoCell(l) },
    { title: '图片ID', key: 'image_id', width: 80, render: (l) => h('span', { style: 'font-size:11px;color:#606266' }, l.image_id || '—') },
    // 原版「客户」「客户编号」是**订单级**（行上无此字段），故取 order 而非 l
    { title: '客户', key: 'client', width: 88, render: () => h('span', { style: 'font-size:11px;color:#606266' }, props.client.name || '—') },
    { title: '客户编号', key: 'client_code', width: 84, render: () => h('span', { style: 'font-size:11px;color:#606266' }, props.client.code || '—') },
    { title: '其它费用', key: 'other_fee', width: 78, render: (l) => moneyCell(l, 'other_fee') },
  ]
}

function diaoCols(): DataTableColumn<Line>[] {
  return [
    selCol(),
    opsCol('移门'),
    doorImgCol(),
    {
      title: '型材/颜色',
      key: 'profile_color',
      width: 142,
      render: (l) => cCol(sub('型材：', profileCell(l)), sub('颜色：', colorCell(l))),
    },
    // 原版移门表列序与列内容见 `Hui-d088417c` @176837..@207080（表头 label 偏移即列序）：
    //   门花图 | 型材/颜色 | 单价/数量 | 玻璃 | 扇数/开向 | 下轨道/套线 | 门洞尺寸 | 洞尺 |
    //   亮窗信息 | 五金 | 备注 | 金额 | 加价项目 | 上轨/边封 | 前包加长 | 后包加长 |
    //   单双丁 | 计价方式 | 打折 | 单号 | 图片ID | 客户 | 客户编号 | 其它费用
    // 其中「单价/数量」列内还含 套线单价，且**生产进度是「单价」框上的 tooltip**（不是可编辑格子）；
    // 「亮窗信息」列内含 亮窗总高/亮窗数量/封板高。
    {
      title: '单价/数量',
      key: 'unit_qty',
      width: 112,
      render: (l) =>
        cCol(
          // 原版 @181691：`el-tooltip :disabled="!e[…]" :content="e['生产进度']"` 包住单价输入框
          sub(
            '单价：',
            h(
              NTooltip,
              { disabled: !l.progress, trigger: 'hover' },
              { trigger: () => moneyCell(l, 'unit_price'), default: () => l.progress },
            ),
          ),
          sub('数量：', intCell(l, 'quantity', 1)),
          sub('套线单价：', moneyCell(l, 'casing_price')),
        ),
    },
    {
      title: '玻璃',
      key: 'glass',
      width: 150,
      render: (l) =>
        cCol(
          // 移门表**不分支**（原版 :4803-4870 恒为「面玻：/底玻：/厚度：」，无 diamond 变体）
          sub('面玻：', glassSelectCell(l, 'face_glass')),
          sub('底玻：', glassSelectCell(l, 'bottom_glass')),
          sub('厚度：', optCell(l, 'glass_thickness', glassThicknessOptions)),
        ),
    },
    {
      title: '扇数/开向',
      key: 'fans_dir',
      width: 150,
      render: (l) => {
        // 原版 :4962-4963 是 img 的 v-if = 「开向 && 图表[扇数+开向]」，class="direction-image"，
        // 图取自「扇数+开向」联合键（**不过 getOriginalOpenDirection**，与平开不同）。
        const img = diaoDirImage(l.fans, l.direction)
        return cCol(
          sub(
            '扇数：',
            optCell(l, 'fans', fansOptions, (x) => {
              lineRefresh(x)
              void resolveRow(x)
            }, true),
          ),
          sub('开向：', optCell(l, 'direction', directionSuffixOptions.value, undefined, true)),
          h('div', { class: 'image-cell2 image-cell2--diao' }, [
            img ? h('img', { src: img, alt: l.direction, class: 'direction-image' }) : null,
          ]),
        )
      },
    },
    {
      title: '下轨道/套线',
      key: 'track_line',
      width: 108,
      render: (l) =>
        cCol(
          // 原版 :4973-5000 这两格**都没有 v-if 闸门**，恒渲染。
          sub('轨道：', trackCell(l)),
          sub('套线：', casingCell(l)),
        ),
    },
    // 原版移门表 门洞尺寸格（:5003-5143）从上到下：高度： → 宽度： → 墙厚： → (洞/净尺：)
    // **没有母门宽、没有钻石型「右宽」**（那两格是平开表独有的）。
    // 决定高/宽先后顺序的那个三元在旧版恒走 key:0，即**高度在上**。
    {
      title: '门洞尺寸',
      key: 'door_size',
      width: 96,
      render: (l) =>
        cCol(
          sub('高度：', intCell(l, 'door_height')),
          sub('宽度：', intCell(l, 'door_width')),
          // 移门表墙厚标签**不分支**（原版恒为 '墙厚：'，:3458）
          sub('墙厚：', wallThicknessCell(l)),
          ...(colVis(props.colVis, 'hole_size')
            ? [sub('洞/净尺：', holeCell(l, DIAO_HOLE_SIZE_OPTS))]
            : []),
        ),
    },
    // 原版「亮窗信息」列内含三格：亮窗总高 / 亮窗数量 / 封板高
    {
      title: '亮窗信息',
      key: 'lightwin',
      width: 98,
      render: (l) =>
        cCol(
          sub('亮窗总高：', intCell(l, 'light_window_height')),
          sub('亮窗数量：', intCell(l, 'light_window_count')),
          // 「封板高」也挂在 列显隐表['封板高'] 闸门上（原版 :5147 / :5165）
          ...(colVis(props.colVis, 'seal_board') ? [sub('封板高：', intCell(l, 'seal_board_height'))] : []),
        ),
    },
    // 原版「五金」是独立列（`["五金"]` 闸门）
    { title: '五金', key: 'hardware', width: 110, render: (l) => hardwareCell(l) },
    {
      title: '备注',
      key: 'remark',
      width: 110,
      render: (l) => cCol(sub('地址：', tCell(l, 'install_address')), sub('备注：', remarkCell(l))),
    },
    { title: '金额', key: 'money', width: 96, render: (l) => moneyCell_2(l) },
    markupCol(),
    // 以下列序严格照原版：加价项目 → 上轨/边封 → 前包加长 → 后包加长 → 单双丁 →
    // 计价方式 → 打折 → 单号 → 图片ID → 客户 → 客户编号 → 其它费用
    {
      title: '上轨/边封',
      key: 'up_track_seal',
      width: 92,
      render: (l) => cCol(sub('轨道长：', intCell(l, 'track_length')), sub('边封数：', intCell(l, 'edge_seal_count', 2))),
    },
    { title: '前包加长', key: 'front_casing', width: 84, render: (l) => intCell(l, 'front_casing_add') },
    { title: '后包加长', key: 'back_casing', width: 84, render: (l) => intCell(l, 'back_casing_add') },
    { title: '单双丁', key: 'double_ding', width: 110, render: (l) => optCell(l, 'double_ding', DOUBLE_DING_OPTS) },
    { title: '计价方式', key: 'price_type', width: 88, render: (l) => optCell(l, 'price_type', priceTypeOptions) },
    { title: '打折', key: 'discount', width: 62, render: (l) => moneyCell(l, 'discount') },
    { title: '单号', key: 'order_no', width: 78, render: (l) => orderNoCell(l) },
    // 原版「图片ID」列不可编辑（只展示），故用只读 span
    { title: '图片ID', key: 'image_id', width: 80, render: (l) => h('span', { style: 'font-size:11px;color:#606266' }, l.image_id || '—') },
    // 原版「客户」「客户编号」是**订单级**（行上无此字段），故取 order 而非 l
    { title: '客户', key: 'client', width: 88, render: () => h('span', { style: 'font-size:11px;color:#606266' }, props.client.name || '—') },
    { title: '客户编号', key: 'client_code', width: 84, render: () => h('span', { style: 'font-size:11px;color:#606266' }, props.client.code || '—') },
    { title: '其它费用', key: 'other_fee', width: 78, render: (l) => moneyCell(l, 'other_fee') },
  ]
}

// ════ 搬迁自 Hui.vue 2550-2581：J rowKey/rowClassName/rowPropsOf/pingColumns/diaoColumns ════
const rowKey = (r: Line) => rowKeyOf(r)

/**
 * `unsaved-row` 粉底 —— **语义改过了**（2026-09-19）。
 *
 * 旧版 `Nt`（`:1359-1370`）/ 移门 `de`（`:3783-3792`）是
 * `dirty.has(rowKey) ? "unsaved-row" : ""`，即**有未保存改动**。
 * 我们原先写的是「行还没有 id」——那是另一回事（新建行就永远是粉的）。
 * 照旧版改回「脏」；新建行在旧版靠客户端临时 id + 无快照 ⇒ 永不判脏 ⇒ 不标粉。
 */
const rowClassName = (r: Line) => (isDirty(r) ? 'unsaved-row' : '')

// 点单元格进入编辑态（旧版 `@cell-click: kt`）。naive-ui 的 `n-data-table` 没有 cell-click，
// 只有 `row-props`；拿不到列信息，所以「跳过操作列」改在那一格 `stopPropagation`（见 `opsCol`）。
const rowPropsOf = (row: Line) => ({ onClick: () => void enterEdit(row) })

// 行内任何改动 → 重算所有已开编辑态行的脏标记（旧版 `Vue.watch(ue, …, {deep:true})`，`:1394-1400`）。
watch(
  () => engine.lines.value,
  () => {
    for (const l of engine.lines.value) if (rowKeyOf(l) && editOf(l).snapshot[rowKeyOf(l)]) recomputeDirty(l)
  },
  { deep: true },
)

type KeyedCol = DataTableColumn<Line> & { key: string }
const pingColumns = computed<DataTableColumn<Line>[]>(() =>
  pingCols().filter((c) => colVis(props.colVis, (c as KeyedCol).key ?? '')),
)
const diaoColumns = computed<DataTableColumn<Line>[]>(() =>
  diaoCols().filter((c) => colVis(props.colVis, (c as KeyedCol).key ?? '')),
)
</script>

<style scoped>
/* ── 搬迁：原 Hui.vue 3234-3280（单元格 :deep 组（.glass-inputs-container 等））── */
:deep(.glass-inputs-container) {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
}
:deep(.glass-input-group) {
  display: flex;
  align-items: center;
  gap: 4px;
}
:deep(.glass-input) {
  flex: 1;
  min-width: 0;
}
/* 「 开向 」列表头是个可点链接（旧版 `.clickable-header{cursor:pointer;display:inline-flex;
   align-items:center;gap:4px;color:#409eff}`，hover #66b1ff） */
:deep(.clickable-header) {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #409eff;
}
:deep(.clickable-header:hover) {
  color: #66b1ff;
}
:deep(.extra-items-container) {
  display: flex;
  flex-direction: column;
  width: 100%;
}
:deep(.glass-input-label) {
  font-size: 11px;
  white-space: nowrap;
  color: #1302fa;
  min-width: 0px;
}
:deep(.extra-items-expressions) {
  margin-top: 4px;
  white-space: pre-line;
  font-size: 12px;
  line-height: 1.5;
}
:deep(.expression-line) {
  margin-bottom: 2px;
}

/* ── 搬迁：原 Hui.vue 3342-3344（.grow-spacer（与页面共用，组件内重复一份））── */
.grow-spacer {
  flex: 1;
}

/* ── 搬迁：原 Hui.vue 3371-3376（.table-head）── */
.table-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

/* ── 搬迁：原 Hui.vue 3387-3398（.table-wrap / .table-footer）── */
.table-wrap {
  border: 1px solid #ebeef5;
  background: #fff;
}
/* 表尾「 添加行 」按钮（旧版 `div.table-footer{margin-top:10px;display:flex;justify-content:center}`
   + `.custom-button-btn{background-color:#7caaf3;color:#fff;border-color:#7caaf3}`，hover #0965fa） */
.table-footer {
  margin-top: 10px;
  padding-bottom: 10px;
  display: flex;
  justify-content: center;
}

/* ── 搬迁：原 Hui.vue 3399-3409（.table-wrap :deep(.custom-button-btn…)）── */
.table-wrap :deep(.custom-button-btn.n-button) {
  background-color: #7caaf3;
  border-color: #7caaf3;
  color: #fff;
}
.table-wrap :deep(.custom-button-btn.n-button:hover),
.table-wrap :deep(.custom-button-btn.n-button:focus) {
  background-color: #0965fa;
  border-color: #0965fa;
  color: #fff;
}
/* ── 搬迁：原 Hui.vue 3410-3419（.table-wrap .table-head）── */
.table-wrap .table-head {
  padding: 6px 8px;
  background: #f7f8fa;
  border-bottom: 1px solid #ebeef5;
}
/*
 * 表头：照抄旧版 `legacy/css/Hui-39b802eb.css`
 *   .el-table__header-wrapper th{font-weight:700;background-color:#f0f9eb!important;color:#000!important;text-align:center!important}
 *   .el-table__header-wrapper .cell{font-weight:700;color:#000!important;text-align:center!important}
 * （我们原来是浅绿底 + 深绿字，旧版是**浅绿底 + 纯黑加粗居中**。）
 */
/* ── 搬迁：原 Hui.vue 3421-3498（.table-wrap :deep(表格/控件密度) 大组）── */
.table-wrap :deep(.n-data-table .n-data-table-th) {
  background: #f0f9eb;
}
.table-wrap :deep(.n-data-table .n-data-table-th .n-data-table-th__title) {
  font-size: 12px;
  font-weight: 700;
  color: #000;
  justify-content: center;
  text-align: center;
}
/*
 * 单元格内边距：旧版 `cell-style:{padding:"1px"}`（td 内联）+ `.el-table .cell{padding:2px 5px}`
 * + `.el-table__cell{padding-top:5px!important;padding-bottom:5px!important}`（覆盖内联）
 * ⇒ 实际 垂直 5+2=7px、水平 1+5=6px。naive-ui 没有 `.cell` 内层，合并成一条。
 */
.table-wrap :deep(.n-data-table .n-data-table-td) {
  padding: 5px 6px;
  font-size: 12px;
  line-height: 1.35;
}
.table-wrap :deep(.n-data-table .n-data-table-tr .n-data-table-td) {
  height: auto;
}
.table-wrap :deep(.n-input),
.table-wrap :deep(.n-base-selection),
.table-wrap :deep(.n-input-number) {
  font-size: 12px;
}
/* 强制输入/下拉高度与内边距收紧 */
.table-wrap :deep(.n-input .n-input__input-el),
.table-wrap :deep(.n-input .n-input__border),
.table-wrap :deep(.n-base-selection .n-base-selection-label) {
  height: 22px;
  line-height: 22px;
  font-size: 12px;
  padding: 0 4px;
}
.table-wrap :deep(.n-input .n-input__state-border),
.table-wrap :deep(.n-base-selection .n-base-selection__border) {
  top: 2px;
  bottom: 2px;
}
.table-wrap :deep(.n-base-selection .n-base-selection-input),
.table-wrap :deep(.n-input-number .n-input__input-el) {
  height: 22px;
  font-size: 12px;
}
/* 数字类输入右对齐，下拉/文本不被截断 */
.table-wrap :deep(.n-input-number .n-input__input-el) {
  text-align: right;
  padding-right: 6px;
}
.table-wrap :deep(.n-input-number .n-input__input-el),
.table-wrap :deep(.n-input .n-input__input-el) {
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}
/* 带后缀(㎡)的平方输入不被后缀挤压 */
.table-wrap :deep(.n-input .n-input__input) {
  min-width: 0;
  flex: 1;
}
.table-wrap :deep(.n-input .n-input__suffix) {
  flex: none;
}
/* 下拉选中区不再强制裁剪文字 */
.table-wrap :deep(.n-base-selection-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-wrap :deep(.n-button--tiny-type-text),
.table-wrap :deep(.n-button--tiny) {
  font-size: 12px;
  padding: 0 2px;
  height: 18px;
}
/* ── 搬迁：原 Hui.vue 3567-3608（unsaved-row / highlight / red-number / image-cell2 / direction-image）── */
.table-wrap :deep(.n-data-table .unsaved-row .n-data-table-td) {
  background: #ffe6ef;
}
.table-wrap :deep(.n-data-table .unsaved-row:hover .n-data-table-td) {
  background: #ffd6e6;
}
/* ⚠️ **这两条目前是「悬空样式」—— 全仓库没有任何代码加 `.highlight-matched-order` 这个类**
   （2026-09-19 全库 grep 过）。它是旧版「查单号命中后把该行滚到居中并高亮」那条路的配套
   （旧版由子表按 `row.单号.startsWith(po)` 加类，`Hui.formatted.js:1352-1356` / `:3788-3792`）。
   **为什么留着不删**：那个功能现在**做得了只是没做** —— 迁移 `0020` 之后
   `OrderLineDto.line_no` 已经存在（`app/src/api/types.ts:162`），挡路的那个数据模型问题没了；
   删掉这里、将来做的时候还得照抄一遍。所以要删就**和功能一起删**。
   跟踪：`docs/home-audit/02-actions.md` 的 **I4**（判定已从 ✅ 改成 ⚠️）。 */
.table-wrap :deep(.n-data-table .highlight-matched-order .n-data-table-td) {
  background: #d4edda;
}
.table-wrap :deep(.n-data-table .highlight-matched-order:hover .n-data-table-td) {
  background: #c3e6cb;
}
/* 尺寸类数字输入红字（旧版 `.red-number-input .el-input__inner{color:red}`）：
   平开 门洞高/门洞宽/墙厚/钻石型「右宽」；移门 门洞高/门洞宽/墙厚/封板高。 */
.table-wrap :deep(.n-input-number.red-number-input .n-input__input-el),
.table-wrap :deep(.n-input.red-number-input .n-input__input-el) {
  color: red;
}
/*
 * 开向示意图。旧版靠 `.image-cell2` 的**百分比宽度**给图封顶：
 *   平开 `.image-cell2{width:70%;height:70%}` ／ 移门 `.image-cell2{width:50%;height:40%}`
 * 加上 `img.direction-image{max-width:100%;object-fit:contain}`。
 * ⚠️ 这两条 width 不能省：图是**原始尺寸**渲染的，而移门那批图最大到 **479×126**
 * （平开那批只有 80~115 宽），不封顶就会把整个格子撑爆。
 * 百分比高度对着 auto 高度的父元素等于没用，真正起作用的是 width —— 照抄即可。
 */
.table-wrap :deep(.image-cell2) {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto;
}
.table-wrap :deep(.image-cell2--ping) {
  width: 70%;
}
.table-wrap :deep(.image-cell2--diao) {
  width: 50%;
}
.table-wrap :deep(.direction-image) {
  max-width: 100%;
  object-fit: contain;
}


.detail-value {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: var(--sd-color-text);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
  font-variant-numeric: tabular-nums;
  line-height: var(--sd-line-height-tight);
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.detail-value--multiline {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

/* ── SmartDoor detail table redesign ───────────────────────────────────────
 * 业务逻辑仍由本组件原有的列定义、行编辑与 hooks 驱动；这里重新组织的是
 * 信息层级、滚动容器和反馈，不改变字段/API/交互契约。
 */
.detail-table-shell {
  min-width: 0;
  overflow: hidden;
  border: var(--sd-border-width) solid var(--sd-color-border);
  border-radius: var(--sd-radius-md);
  background: var(--sd-color-bg-surface);
  box-shadow: var(--sd-shadow-sm);
}

.detail-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sd-space-3);
  min-height: 56px;
  padding: var(--sd-space-3) var(--sd-space-4);
  border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
  background: var(--sd-color-bg-subtle);
}

.detail-table-toolbar__identity,
.detail-table-toolbar__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sd-space-2);
}

.detail-table-toolbar__identity {
  min-width: 0;
}

.detail-table-toolbar__mark {
  width: 8px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-action);
  box-shadow: var(--sd-shadow-action);
}

.detail-table-shell--diao .detail-table-toolbar__mark {
  background: var(--sd-color-process);
  box-shadow: var(--sd-shadow-status-soft);
}

.detail-table-toolbar__eyebrow {
  margin: 0;
  color: var(--sd-color-text-muted);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-strong);
  letter-spacing: var(--sd-letter-spacing-eyebrow);
  line-height: var(--sd-line-height-tight);
}

.detail-table-toolbar h3 {
  margin: 1px 0 0;
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-md);
  font-weight: var(--sd-font-weight-strong);
  line-height: var(--sd-line-height-tight);
}

.detail-table-toolbar__count {
  padding: 3px var(--sd-space-2);
  border: var(--sd-border-width) solid var(--sd-color-border);
  border-radius: var(--sd-radius-pill);
  color: var(--sd-color-text-muted);
  background: var(--sd-color-bg-surface);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.detail-table-toolbar__actions :deep(.n-button) {
  border-radius: var(--sd-radius-control);
  transition:
    background-color var(--sd-duration-fast) var(--sd-ease-standard),
    color var(--sd-duration-fast) var(--sd-ease-standard),
    transform var(--sd-duration-fast) var(--sd-ease-standard);
}

.detail-table-toolbar__actions :deep(.n-button:hover) {
  transform: translateY(var(--sd-motion-hover-y));
}

.detail-table-toolbar__actions :deep(.n-button:active) {
  transform: scale(var(--sd-motion-press-scale));
}

.detail-table-scroll {
  min-width: 0;
  overflow: hidden;
  background: var(--sd-color-bg-surface);
}

.detail-table-scroll :deep(.n-data-table) {
  --n-th-color: var(--sd-color-bg-subtle);
  --n-td-color: var(--sd-color-bg-surface);
  --n-td-color-hover: var(--sd-color-bg-hover);
  --n-th-text-color: var(--sd-color-text-muted);
  --n-td-text-color: var(--sd-color-text);
  --n-border-color: var(--sd-color-divider);
  font-family: var(--sd-font-sans);
}

.detail-table-scroll :deep(.n-data-table-base-table-header) {
  background: var(--sd-color-bg-subtle);
}

.detail-table-scroll :deep(.n-data-table-base-table-body) {
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
  touch-action: pan-x pan-y;
}

.detail-table-scroll :deep(.n-data-table .n-data-table-th) {
  min-height: var(--sd-control-height-small);
  padding: var(--sd-space-2) var(--sd-space-2-5);
  border-bottom: var(--sd-border-width) solid var(--sd-color-border);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-strong);
  letter-spacing: 0.02em;
  text-transform: none;
}

.detail-table-scroll :deep(.n-data-table .n-data-table-td) {
  border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-xs);
  line-height: var(--sd-line-height-tight);
  transition: background-color var(--sd-duration-fast) var(--sd-ease-standard);
}

.detail-table-scroll :deep(.n-data-table .n-data-table-tr:last-child .n-data-table-td) {
  border-bottom: 0;
}

.detail-table-scroll :deep(.n-data-table .n-data-table-tr:hover .n-data-table-td) {
  background: var(--sd-color-bg-hover);
}

.detail-table-scroll :deep(.n-data-table .n-data-table-tr:focus-within .n-data-table-td) {
  background: var(--sd-color-action-soft);
}

.detail-table-scroll :deep(.n-data-table .n-data-table-tr .n-data-table-td:first-child),
.detail-table-scroll :deep(.n-data-table .n-data-table-tr .n-data-table-th:first-child) {
  padding-left: var(--sd-space-3);
}

.detail-table-scroll :deep(.n-data-table .n-data-table-tr .n-data-table-td:last-child),
.detail-table-scroll :deep(.n-data-table .n-data-table-tr .n-data-table-th:last-child) {
  padding-right: var(--sd-space-3);
}

.detail-table-scroll :deep(.n-data-table .n-data-table-td .n-input),
.detail-table-scroll :deep(.n-data-table .n-data-table-td .n-base-selection),
.detail-table-scroll :deep(.n-data-table .n-data-table-td .n-input-number) {
  border-radius: var(--sd-radius-xs);
}

/*
 * 明细表列宽是固定的，NSelect 默认会为箭头预留较大的左右空间。
 * 这里仅压缩表格内触发器的无效留白，避免中文选中值只剩一两个字；
 * 下拉菜单本身通过 widthMode=max-content 展开，不会被触发器宽度锁死。
 */
.detail-table-scroll :deep(.n-data-table .n-data-table-td .n-base-selection) {
  --n-padding-single-left: var(--sd-space-1) !important;
  --n-padding-single-right: var(--sd-space-2-5) !important;
  --n-padding-multiple-left: var(--sd-space-1) !important;
  --n-padding-multiple-right: var(--sd-space-2-5) !important;
}

.detail-table-scroll :deep(.n-data-table .n-data-table-td .n-base-selection-label__render-label) {
  min-width: 0;
}

/* NSelect 的弹出层 Teleport 到 body，使用专用 class 控制菜单不被触发器窄宽锁死。 */
:global(.detail-select-menu) {
  width: max-content !important;
  min-width: var(--sd-control-select-menu-min-width);
  max-width: calc(100vw - var(--sd-space-6));
  overflow-x: auto;
}

:global(.detail-select-menu .n-base-select-option__content) {
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}

.detail-table-scroll :deep(.n-data-table .n-data-table-td .n-input:focus-within),
.detail-table-scroll :deep(.n-data-table .n-data-table-td .n-base-selection:focus-within),
.detail-table-scroll :deep(.n-data-table .n-data-table-td .n-input-number:focus-within) {
  box-shadow: var(--sd-focus-ring-soft);
}

.detail-table-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--sd-space-2);
  min-height: 50px;
  padding: var(--sd-space-2) var(--sd-space-4) var(--sd-space-3);
  border-top: var(--sd-border-width) solid var(--sd-color-divider);
  background: var(--sd-color-bg-subtle);
}

.detail-table-footer :deep(.custom-button-btn) {
  border: var(--sd-border-width) solid var(--sd-color-action-border);
  border-radius: var(--sd-radius-control);
  color: var(--sd-color-action);
  background: var(--sd-color-action-soft);
  font-weight: var(--sd-font-weight-strong);
  transition:
    background-color var(--sd-duration-fast) var(--sd-ease-standard),
    border-color var(--sd-duration-fast) var(--sd-ease-standard),
    transform var(--sd-duration-fast) var(--sd-ease-standard);
}

.detail-table-footer :deep(.custom-button-btn:hover) {
  border-color: var(--sd-color-action);
  background: var(--sd-color-bg-pressed);
  transform: translateY(var(--sd-motion-hover-y));
}

.detail-table-footer :deep(.custom-button-btn:active) {
  transform: scale(var(--sd-motion-press-scale));
}

.detail-table-footer__plus {
  margin-right: var(--sd-space-1);
  font-size: var(--sd-font-size-lg);
  line-height: 1;
}

.detail-table-footer__hint {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

@media (max-width: 768px) {
  .detail-table-toolbar {
    align-items: flex-start;
    padding: var(--sd-space-3);
  }

  .detail-table-toolbar__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .detail-table-scroll :deep(.n-data-table .n-data-table-th),
  .detail-table-scroll :deep(.n-data-table .n-data-table-td) {
    padding-left: var(--sd-space-2);
    padding-right: var(--sd-space-2);
  }
}
</style>
