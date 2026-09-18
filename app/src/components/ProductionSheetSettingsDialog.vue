<!--
  自定义生产单（ic=14）· **「自定义生产单 - 设置」弹窗**。
  旧版 `ProductionSheetPrintManager` 的设置弹窗模板 `PS:1500-2935`（`openSettingsDialog` 是 `PS:1361-1366`）。

  ⚠️ **不要照抄 `DocSheetSettingsDialog.vue`（C 家族）** —— 那是**两页**（纸张 / 打印机），
  本单据是**四页**（纸张 / 头部字段 / 表格 / 打印机），左栏控件与语义没有一处能复用：
    · 纸张页多「方向」下拉 + **7 个**常用尺寸预设（C 家族 3 个且不联动 `orientation`，
      本单据的 `L()` **连 orientation 一起写**，§2.5）；
    · 「头部字段」页是整族独有的（4 个「统一」项 + 11 列字段表 + 一颗「统一应用」）；
    · 「表格」页是整族独有的（表体边框/下划线/行高 px/字号 pt + **列排序 ↑↓**）；
    · 「打印机」页多一个 `print.itemsPerPage`（**本单据唯一有**，§7）。

  ★ **列排序（↑↓）是本单据唯一的列顺序入口**（§3.7）：布局编辑器的「列宽设置」表里
  **没有** ↑↓（C 家族才有）。文案「列显示与排序（拖拽行调整顺序）：」承诺拖拽、
  **实现只有 ↑↓**（`PS:2580` vs `PS:2625-2707`）—— 新版按**实现**做，文案照抄（lead 拍板）。

  **草稿 / 生效 成对**（旧版 `r` 生效 / `i` 设置草稿，`PS:246-247`）：
  · 打开 = `clone(生效)`，**不归一化**（`PS:1361-1366`，与布局编辑器**相反**，§2.4）；
  · 「保存并应用」= `生效 ← normalize(clone(草稿))` → 落库 → 关窗 → 刷预览（`PS:540-547`）；
  · 「重置默认」只重置草稿；「取消」直接关窗。
  ⚠️ 与布局编辑弹窗**共用同一个 localStorage 键**（`production_sheet_template_v1`）。

  **打印机这一块在本版是「降级态」**（新版没有 Electron，`getPrinters()` 取不到）——
  与 `DocSheetSettingsDialog` 同一处置：整块照旧版渲染，把必然无效的控件置灰，不报错。
-->
<template>
  <n-modal
    v-model:show="showModel"
    preset="card"
    :title="profile.text.settingsTitle"
    style="width: 720px"
    :bordered="false"
    display-directive="show"
  >
    <n-tabs v-model:value="tab">
      <!-- ───────────────────────── 纸张（PS:1570-1880） ───────────────────────── -->
      <n-tab-pane label="纸张" name="paper">
        <n-form label-placement="left" :label-width="110">
          <n-form-item label="纸张宽度(mm)">
            <n-input-number
              :value="draft.paper.widthMm"
              :min="PS_UI_RANGES.paperWidthMm.min"
              :max="PS_UI_RANGES.paperWidthMm.max"
              :step="PS_UI_RANGES.paperWidthMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.paper.widthMm = v as number)"
            />
          </n-form-item>
          <n-form-item label="纸张高度(mm)">
            <n-input-number
              :value="draft.paper.heightMm"
              :min="PS_UI_RANGES.paperHeightMm.min"
              :max="PS_UI_RANGES.paperHeightMm.max"
              :step="PS_UI_RANGES.paperHeightMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.paper.heightMm = v as number)"
            />
          </n-form-item>
          <!--
            ⚠️ 「方向」仍是**死字段**（§2.1 注 4）：不被 CSS 发生器读、不被分页读、不被量测读；
            `printSilent` 用 `widthMm > heightMm` 判横向。只有本下拉与 `normalize()` 读写它。
            照抄留着，别指望它生效。
          -->
          <n-form-item label="方向">
            <n-select
              v-model:value="draft.paper.orientation"
              :options="ORIENTATION_OPTIONS"
              style="width: 200px"
            />
          </n-form-item>
          <n-form-item label="内边距(mm)">
            <n-input-number
              :value="draft.paper.paddingMm"
              :min="PS_UI_RANGES.paperPaddingMm.min"
              :max="PS_UI_RANGES.paperPaddingMm.max"
              :step="PS_UI_RANGES.paperPaddingMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.paper.paddingMm = v as number)"
            />
          </n-form-item>
          <n-form-item label="常用尺寸">
            <!-- ★ 7 个预设（C 家族是 3 个），且**连 orientation 一起写**（`L()`，§2.5） -->
            <div :class="cls.settingsPresets">
              <n-button
                v-for="preset in PS_PAPER_PRESETS"
                :key="preset.label"
                size="small"
                @click="applyPaperPreset(preset)"
              >
                {{ preset.label }}
              </n-button>
            </div>
          </n-form-item>
        </n-form>
      </n-tab-pane>

      <!-- ─────────────────────── 头部字段（PS:2225-2707 的前半） ─────────────────────── -->
      <n-tab-pane label="头部字段" name="headerFields">
        <div style="margin-bottom: 10px">
          <n-button size="small" type="primary" @click="applyGlobalHeaderFont">
            统一应用下方设置到所有字段
          </n-button>
        </div>
        <n-form
          label-placement="left"
          :label-width="90"
          size="small"
          style="margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 10px"
        >
          <n-form-item label="统一字体">
            <n-select
              v-model:value="draft.globalHeaderFont.fontFamily"
              :options="FONT_FAMILY_OPTIONS"
              style="width: 200px"
            />
          </n-form-item>
          <n-form-item label="统一字号(pt)">
            <n-input-number
              v-model:value="draft.globalHeaderFont.fontSize"
              :min="PS_UI_RANGES.fieldFontSize.min"
              :max="PS_UI_RANGES.fieldFontSize.max"
              :step="PS_UI_RANGES.fieldFontSize.step"
              style="width: 150px"
            />
          </n-form-item>
          <n-form-item label="统一颜色">
            <n-color-picker
              :value="draft.globalHeaderFont.fontColor"
              @update:value="(v: string | null) => (draft.globalHeaderFont.fontColor = v ?? '')"
            />
          </n-form-item>
          <n-form-item label="统一粗细">
            <n-select
              v-model:value="draft.globalHeaderFont.fontWeight"
              :options="FONT_WEIGHT_OPTIONS"
              style="width: 120px"
            />
          </n-form-item>
        </n-form>
        <!--
          11 列字段表（`PS:2287-2600`）—— 顺序与宽度逐字照抄。
          ⚠️ 最后三列（字体 / 换行 / 行距）对 `qrcode`、`lockImg` **整格不渲染**
          （旧版是 `v-if` + `createCommentVNode`，不是「禁用」）。
        -->
        <n-data-table
          :data="draft.headerFields"
          :columns="headerFieldColumns"
          :row-key="(row: HeaderField) => row.key"
          size="small"
          bordered
          :style="{ width: '100%' }"
        />
      </n-tab-pane>

      <!-- ─────────────────────────── 表格（PS:2415-2715） ─────────────────────────── -->
      <n-tab-pane label="表格" name="table">
        <n-form label-placement="left" :label-width="130" size="small">
          <n-form-item label="表体外边框">
            <n-switch
              :value="draft.tableConfig.showBodyBorder"
              @update:value="(v: boolean) => (draft.tableConfig.showBodyBorder = v)"
            />
          </n-form-item>
          <n-form-item label="换行元素加下划线">
            <n-switch
              :value="draft.tableConfig.underlineBrElements"
              @update:value="(v: boolean) => (draft.tableConfig.underlineBrElements = v)"
            />
          </n-form-item>
          <n-form-item label="表体行高(px)">
            <n-input-number
              :value="draft.tableConfig.rowHeight"
              :min="PS_UI_RANGES.tableRowHeight.min"
              :max="PS_UI_RANGES.tableRowHeight.max"
              :step="PS_UI_RANGES.tableRowHeight.step"
              style="width: 150px"
            />
            <!-- ★ 旁注「默认22」与真实默认 37 矛盾 —— 旧版残留文案，照抄（§2.3 的 ⚠️） -->
            <span style="margin-left: 6px; font-size: 11px; color: #999">
              {{ PS_STALE_HINT_TEXT.rowHeight }}
            </span>
          </n-form-item>
          <n-form-item label="表体字号(pt)">
            <n-input-number
              :value="draft.tableConfig.tableFontSize"
              :min="PS_UI_RANGES.tableFontSize.min"
              :max="PS_UI_RANGES.tableFontSize.max"
              :step="PS_UI_RANGES.tableFontSize.step"
              style="width: 150px"
            />
            <!-- ★ 旁注「默认10」与真实默认 16.5 矛盾 —— 同上，照抄 -->
            <span style="margin-left: 6px; font-size: 11px; color: #999">
              {{ PS_STALE_HINT_TEXT.tableFontSize }}
            </span>
          </n-form-item>
        </n-form>
        <!-- ★ 文案承诺拖拽、实现只有 ↑↓ —— 照抄文案（§3.7 的 ⚠️） -->
        <div style="margin-top: 12px; font-size: 13px; color: #666">
          {{ PS_STALE_HINT_TEXT.columnSort }}
        </div>
        <n-data-table
          :data="draft.tableConfig.columns"
          :columns="columnOrderColumns"
          :row-key="(row: TableColumn) => row.key"
          size="small"
          bordered
          :style="{ width: '100%', marginTop: '6px' }"
        />
      </n-tab-pane>

      <!-- ─────────────────────────── 打印机（PS:2719-2880） ─────────────────────────── -->
      <n-tab-pane label="打印机" name="printer">
        <n-form label-placement="left" :label-width="110">
          <!-- 非 Electron 才显示（`PS:1229-1246` 的反向分支）。新版恒为浏览器 ⇒ 恒显示 -->
          <n-form-item v-if="!isElectronEnv" label="">
            <n-alert
              type="warning"
              :closable="false"
              title="仅Electron客户端支持静默打印，当前为浏览器模式"
            />
          </n-form-item>
          <n-form-item label="选择打印机">
            <n-select
              :value="selectedPrinter"
              :options="printerOptions"
              :disabled="!isElectronEnv"
              placeholder="使用系统默认打印机"
              clearable
              style="width: 100%"
              @update:value="onPrinterChange"
            />
          </n-form-item>
          <n-form-item>
            <n-button size="small" :loading="loadingPrinters" :disabled="!isElectronEnv" @click="loadPrinters">
              刷新打印机列表
            </n-button>
            <span style="margin-left: 8px; color: #999; font-size: 12px">
              已选：{{ selectedPrinter || '系统默认' }}
            </span>
          </n-form-item>
          <n-form-item label="打印份数">
            <!-- 1–99。⚠️ 浏览器打印链路**不读**它，只有 Electron 静默打印读（§7，新版无载体） -->
            <n-input-number
              :value="draft.print.copies"
              :min="COPIES_RANGE_MIN"
              :max="COPIES_RANGE_MAX"
              :step="1"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.print.copies = v as number)"
            />
          </n-form-item>
          <n-form-item label="每页数据数">
            <!-- ★ 本单据唯一有（§7）；`normalize()` 只认严格等于 2（`PS:430-438`） -->
            <n-select
              :value="draft.print.itemsPerPage"
              :options="ITEMS_PER_PAGE_OPTIONS"
              style="width: 200px"
              @update:value="(v: number) => (draft.print.itemsPerPage = v)"
            />
          </n-form-item>
        </n-form>
      </n-tab-pane>
    </n-tabs>

    <!-- footer 三颗，顺序照旧版（`PS:1521-1568`）：重置默认 / 取消 / 保存并应用(primary) -->
    <template #footer>
      <div :class="cls.settingsFooter">
        <n-button @click="resetDraft">重置默认</n-button>
        <n-button @click="cancel">取消</n-button>
        <n-button type="primary" @click="save">保存并应用</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NCheckbox,
  NColorPicker,
  NDataTable,
  NForm,
  NFormItem,
  NInputNumber,
  NModal,
  NSelect,
  NSwitch,
  NTabPane,
  NTabs,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'

import {
  normalizeProductionSheetConfig,
  PAPER_PRESETS,
  PS_STALE_HINT_TEXT,
  PS_UI_RANGES,
} from '../utils/productionsheet'
import type { HeaderField, ProductionSheetConfig, TableColumn } from '../utils/productionsheet/types'
import type { ProductionSheetUiProfile } from './productionSheetUiProfile'

const props = defineProps<{
  show: boolean
  /** 已生效的配置（父组件持有）。弹窗只读它，**打开时**深拷贝一份当草稿（**不归一化**）。 */
  config: ProductionSheetConfig
  /** 本单据的组件层档案 —— 本弹窗只用它的文案、默认配置工厂与落库函数。 */
  profile: ProductionSheetUiProfile
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  /** 「保存并应用」之后触发：父组件据此重读配置 + **重建行**（D3）+ 重渲染主预览。 */
  (e: 'saved'): void
}>()

const showModel = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const cls = computed(() => props.profile.classes)
const message = useMessage()

/** 旧版 `u`：四个 tab —— `paper` / `headerFields` / `table` / `printer`（`PS:1574` 起）。 */
const tab = ref<'paper' | 'headerFields' | 'table' | 'printer'>('paper')

/** 旧版 `JSON.parse(JSON.stringify(r.value))`（`PS:1363`）—— ★ **不调 `z()`**，与布局编辑器相反。 */
function cloneConfig(cfg: ProductionSheetConfig): ProductionSheetConfig {
  return JSON.parse(JSON.stringify(cfg)) as ProductionSheetConfig
}

/** 草稿（旧版 `i`，`PS:247`）。 */
const draft = ref<ProductionSheetConfig>(cloneConfig(props.config))

// ---------------------------------------------------------------------------
// 常量（本弹窗专用）
// ---------------------------------------------------------------------------

/** 方向下拉 —— 旧版是 `el-option` 两条，值 `portrait` / `landscape`（`PS:1655-1673`）。 */
const ORIENTATION_OPTIONS = [
  { label: '纵向', value: 'portrait' },
  { label: '横向', value: 'landscape' },
]

/**
 * 「统一字体」/每行「字体」的下拉值 —— **同一组值，两套文案**：
 * 统一那栏是「微软雅黑」，行内那栏是「雅黑」（`PS:2419-2465` vs `PS:2790-2830`）。照抄，别统一。
 */
const FONT_FAMILY_OPTIONS = [
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: '楷体', value: 'KaiTi' },
  { label: 'Arial', value: 'Arial' },
]
const FONT_FAMILY_SHORT_OPTIONS = [
  { label: '雅黑', value: 'Microsoft YaHei' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: '楷体', value: 'KaiTi' },
  { label: 'Arial', value: 'Arial' },
]

/** 「统一粗细」是「正常/加粗」，每行「粗细」是「正常/粗」—— **两套文案**（`PS:2539-2563` vs `PS:2672-2692`）。 */
const FONT_WEIGHT_OPTIONS = [
  { label: '正常', value: 'normal' },
  { label: '加粗', value: 'bold' },
]
const FONT_WEIGHT_SHORT_OPTIONS = [
  { label: '正常', value: 'normal' },
  { label: '粗', value: 'bold' },
]

/** 「每页数据数」两条 —— `PS:2877-2900`。 */
const ITEMS_PER_PAGE_OPTIONS = [
  { label: '1 条/页', value: 1 },
  { label: '2 条/页', value: 2 },
]

/** 打印份数 —— 旧版内联 `:min="1" :max="99" :step="1"`（`PS:2848-2856`）。 */
const COPIES_RANGE_MIN = 1
const COPIES_RANGE_MAX = 99

/** `PS:1722-1854` 的 7 个预设（核心层 `PAPER_PRESETS`）。 */
const PS_PAPER_PRESETS = PAPER_PRESETS

/** `qrcode` / `lockImg` 两个字段没有字体/换行/行距可改（`PS:2788-2905` 的三处 `v-if`）。 */
function isSquareField(key: string): boolean {
  return key === 'qrcode' || key === 'lockImg'
}

// ---------------------------------------------------------------------------
// 常用尺寸（旧版 `L`，`PS:548-553`）
// ---------------------------------------------------------------------------

/** ★ **连 `orientation` 一起写**（与 C 家族「只写宽高」的 3 个预设不同，§2.5）。`L()` 不做 clamp。 */
function applyPaperPreset(preset: { widthMm: number; heightMm: number; orientation: 'portrait' | 'landscape' }): void {
  draft.value.paper.widthMm = preset.widthMm
  draft.value.paper.heightMm = preset.heightMm
  draft.value.paper.orientation = preset.orientation
}

// ---------------------------------------------------------------------------
// 「统一应用」（旧版 `b`，`PS:554-567`）
// ---------------------------------------------------------------------------

/**
 * 把 `globalHeaderFont` 的四项刷到**所有非 `qrcode`/`lockImg`** 的字段上（**就地改草稿**），
 * 然后弹「已统一应用到所有头部字段」。
 *
 * ⚠️ 与设置弹窗其它控件一样：**只改草稿**，要点「保存并应用」才落库。
 */
function applyGlobalHeaderFont(): void {
  const global = draft.value.globalHeaderFont
  draft.value.headerFields.forEach((field) => {
    if (isSquareField(field.key)) return
    field.fontFamily = global.fontFamily
    field.fontSize = global.fontSize
    field.fontColor = global.fontColor
    field.fontWeight = global.fontWeight
  })
  message.success('已统一应用到所有头部字段')
}

// ---------------------------------------------------------------------------
// 头部字段表（11 列，`PS:2287-2600`）
// ---------------------------------------------------------------------------

/**
 * ⚠️ 旧版这些 `el-input-number` 都带 `controls-position:"right"` —— Naive 的加减按钮本来就固定在
 * 右侧，观感一致，不做等价处理（与另两个弹窗同一处置）。
 */
const headerFieldColumns = computed<DataTableColumns<HeaderField>>(() => [
  {
    title: '显',
    key: 'visible',
    width: 42,
    render: (row) =>
      h(NCheckbox, {
        checked: row.visible,
        'onUpdate:checked': (v: boolean) => {
          row.visible = v
        },
      }),
  },
  { title: '字段', key: 'label', width: 60 },
  {
    title: '字号',
    key: 'fontSize',
    width: 80,
    render: (row) =>
      h(NInputNumber, {
        value: row.fontSize,
        min: PS_UI_RANGES.fieldFontSize.min,
        max: PS_UI_RANGES.fieldFontSize.max,
        step: PS_UI_RANGES.fieldFontSize.step,
        size: 'small',
        style: 'width:100%',
        'onUpdate:value': (v: number | null) => {
          row.fontSize = v as number
        },
      }),
  },
  {
    title: '颜色',
    key: 'fontColor',
    width: 60,
    render: (row) =>
      h(NColorPicker, {
        value: row.fontColor,
        size: 'small',
        'onUpdate:value': (v: string | null) => {
          row.fontColor = v ?? ''
        },
      }),
  },
  {
    title: '粗细',
    key: 'fontWeight',
    width: 80,
    render: (row) =>
      h(NSelect, {
        value: row.fontWeight,
        options: FONT_WEIGHT_SHORT_OPTIONS,
        size: 'small',
        style: 'width:70px',
        'onUpdate:value': (v: string) => {
          row.fontWeight = v
        },
      }),
  },
  {
    title: 'X(mm)',
    key: 'x',
    width: 75,
    render: (row) =>
      h(NInputNumber, {
        value: row.x,
        min: PS_UI_RANGES.fieldX.min,
        max: PS_UI_RANGES.fieldX.max,
        step: PS_UI_RANGES.fieldX.step,
        size: 'small',
        style: 'width:100%',
        'onUpdate:value': (v: number | null) => {
          row.x = v as number
        },
      }),
  },
  {
    title: 'Y(mm)',
    key: 'y',
    width: 75,
    render: (row) =>
      h(NInputNumber, {
        value: row.y,
        min: PS_UI_RANGES.fieldY.min,
        max: PS_UI_RANGES.fieldY.max,
        step: PS_UI_RANGES.fieldY.step,
        size: 'small',
        style: 'width:100%',
        'onUpdate:value': (v: number | null) => {
          row.y = v as number
        },
      }),
  },
  {
    title: '宽(mm)',
    key: 'width',
    width: 75,
    render: (row) =>
      h(NInputNumber, {
        value: row.width,
        min: PS_UI_RANGES.fieldWidth.min,
        max: PS_UI_RANGES.fieldWidth.max,
        step: PS_UI_RANGES.fieldWidth.step,
        size: 'small',
        style: 'width:100%',
        'onUpdate:value': (v: number | null) => {
          row.width = v as number
        },
      }),
  },
  {
    // ★ 对 qrcode / lockImg **整格不渲染**（旧版是 `v-if`，不是禁用）
    title: '字体',
    key: 'fontFamily',
    width: 100,
    render: (row) =>
      isSquareField(row.key)
        ? null
        : h(NSelect, {
            value: row.fontFamily,
            options: FONT_FAMILY_SHORT_OPTIONS,
            size: 'small',
            style: 'width:90px',
            'onUpdate:value': (v: string) => {
              row.fontFamily = v
            },
          }),
  },
  {
    title: '换行',
    key: 'wrap',
    width: 42,
    render: (row) =>
      isSquareField(row.key)
        ? null
        : h(NCheckbox, {
            checked: row.wrap,
            'onUpdate:checked': (v: boolean) => {
              row.wrap = v
            },
          }),
  },
  {
    title: '行距',
    key: 'lineHeight',
    width: 65,
    render: (row) =>
      isSquareField(row.key)
        ? null
        : h(NInputNumber, {
            value: row.lineHeight,
            min: PS_UI_RANGES.fieldLineHeight.min,
            max: PS_UI_RANGES.fieldLineHeight.max,
            step: PS_UI_RANGES.fieldLineHeight.step,
            size: 'small',
            style: 'width:100%',
            'onUpdate:value': (v: number | null) => {
              row.lineHeight = v as number
            },
          }),
  },
])

// ---------------------------------------------------------------------------
// 列排序表（3 列，`PS:2570-2707`）—— ★ 本单据唯一的列顺序入口
// ---------------------------------------------------------------------------

/**
 * ↑↓ **就地交换数组相邻两项**（`PS:2625-2707`），**不是拖拽**。
 * `↑` 在第一行时 disabled、`↓` 在最后一行时 disabled，越界由按钮挡住（函数里再挡一次，照旧版）。
 */
function moveColumn(index: number, delta: number): void {
  const cols = draft.value.tableConfig.columns
  const target = index + delta
  if (target < 0 || target >= cols.length) return
  const tmp = cols[index]
  cols[index] = cols[target]
  cols[target] = tmp
}

const columnOrderColumns = computed<DataTableColumns<TableColumn>>(() => [
  {
    title: '显',
    key: 'visible',
    width: 42,
    render: (row) =>
      h(NCheckbox, {
        checked: row.visible,
        'onUpdate:checked': (v: boolean) => {
          row.visible = v
        },
      }),
  },
  // 「列名」是**只读**的（旧版直接给 `prop="label"`，没有任何编辑器）
  { title: '列名', key: 'label', width: 100 },
  {
    title: '排序',
    key: 'order',
    width: 100,
    render: (_row, index) =>
      h('div', { style: 'display:flex;gap:4px' }, [
        h(
          NButton,
          { size: 'small', disabled: index === 0, onClick: () => moveColumn(index, -1) },
          { default: () => '↑' },
        ),
        h(
          NButton,
          {
            size: 'small',
            disabled: index === draft.value.tableConfig.columns.length - 1,
            onClick: () => moveColumn(index, 1),
          },
          { default: () => '↓' },
        ),
      ]),
  },
])

// ---------------------------------------------------------------------------
// 打印机（旧版的 Electron 专属区，新版降级处理）
// ---------------------------------------------------------------------------

/**
 * 旧版 `v = computed(() => !!window.electronAPI)`（`PS:261`）—— 决定 warning 显示与否、
 * 以及拉列表要不要真拉。
 *
 * ⚠️ **新版没有 Electron** ⇒ 恒 `false`，与「旧版在浏览器里打开」的取值完全一致。
 */
interface ElectronPrinterInfo {
  name: string
  displayName: string
  isDefault?: boolean
}
interface ElectronAPI {
  getPrinters?: () => Promise<ElectronPrinterInfo[]>
}
const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
const isElectronEnv = !!electronAPI?.getPrinters

const printers = ref<ElectronPrinterInfo[]>([])
const loadingPrinters = ref(false)
/** 选中的打印机名（旧版 `h`）—— 存在 `production_sheet_printer`（**裸字符串，不 JSON，也没有 `_v1`**）。 */
const selectedPrinter = ref('')

/** 下拉选项：`isDefault` 的加「（默认）」后缀（`PS:2818-2830`）。列表为空（本版恒为空）时无选项。 */
const printerOptions = computed(() =>
  printers.value.map((p) => ({
    label: p.isDefault ? p.displayName + '（默认）' : p.displayName,
    value: p.name,
  })),
)

/**
 * 旧版 `B`（`PS:520-531`）：
 * ```
 * if (!isElectron) return          // ← 非 Electron **静默 return**，连提示都不弹
 * loading = true
 * try { printers = await window.electronAPI.getPrinters() } catch { ElMessage.error("获取打印机列表失败") }
 * finally { loading = false }
 * ```
 * 新版把 `isElectron` 恒假那条分支原样保留 —— **不报错、不抛异常**，按钮只是没有效果。
 * 模板里给下拉与刷新按钮挂了 `:disabled="!isElectronEnv"`（**有意偏离**：旧版浏览器模式下
 * 这两颗是可点的死控件；置灰不改变任何产物，只是别让人白点）—— 与 `DocSheetSettingsDialog` 同一条。
 */
async function loadPrinters(): Promise<void> {
  if (!isElectronEnv || !electronAPI?.getPrinters) return
  loadingPrinters.value = true
  try {
    printers.value = await electronAPI.getPrinters()
  } catch {
    message.error('获取打印机列表失败')
  } finally {
    loadingPrinters.value = false
  }
}

/** 旧版 `x`（`PS:514-519`）：**选中即写盘**（裸字符串），空选 → 写空串 = 用系统默认。 */
function onPrinterChange(v: string | null): void {
  selectedPrinter.value = v ?? ''
  props.profile.api.savePrinter(selectedPrinter.value)
}

// ---------------------------------------------------------------------------
// 打开 / 保存 / 取消 / 重置
// ---------------------------------------------------------------------------

/**
 * 旧版 `openSettingsDialog`（`PS:1361-1366`）：
 * `i = clone(r)` → `u = "paper"` → 显示；`onOpen: M`（`PS:533-536`）在 Electron 且列表为空时拉打印机。
 *
 * ★ 它**不归一化**（与布局编辑器的 `z()` 相反，§2.4），也**不关布局编辑弹窗**（两者可同时开着）。
 */
watch(
  () => props.show,
  (open) => {
    if (!open) return
    draft.value = cloneConfig(props.config)
    tab.value = 'paper'
    selectedPrinter.value = props.profile.api.loadSettings().selectedPrinter
    if (isElectronEnv && printers.value.length === 0) void loadPrinters()
  },
)

/** 「重置默认」（旧版 `N`，`PS:537-539`）：**只重置草稿** —— 不写盘、不关窗、不刷预览。 */
function resetDraft(): void {
  draft.value = props.profile.api.createDefaultConfig()
}

/** 「取消」：只关窗（生效值从未被改过）。 */
function cancel(): void {
  showModel.value = false
}

/**
 * 「保存并应用」（旧版 `E`，`PS:540-547`）：
 * `r = normalize(clone(i))` → 落库 → 关窗 →（若预览打开）刷新。
 *
 * ★ **两端都归一化**是 PS/QL 这一族的特征（§骨架 §2.2）：草稿里可能留着 `tableTopMm` 的超界值、
 *   `itemsPerPage=3` 这类非法值，写盘前由 `normalize()` 夹一次 —— 与布局编辑器的保存同一条。
 * ⚠️ 旧版这里**有** `isActive()` 守卫（§7 末段的更正）。新版把「预览是否打开」交给父组件
 *   （抽屉恒有预览）⇒ 直接 emit `saved`，等价。
 */
function save(): void {
  const saved = normalizeProductionSheetConfig(cloneConfig(draft.value))
  props.profile.api.saveConfig(saved)
  draft.value = cloneConfig(saved)
  showModel.value = false
  emit('saved')
}
</script>

<style scoped>
/*
  两条**新版自己的排版胶水**（旧版是 el-form-item 内的内联按钮/原生 div，Naive 下用 flex 行还原）。
  ⚠️ class 名来自 `profile.classes`（`ps1-*`）—— 与 `DocSheetSettingsDialog.vue` 里
  「预埋」的那两条选择器**同名但不同组件**：那份 `<style scoped>` 只作用于它自己的模板，
  所以本组件必须**自己再声明一遍**（这就是 scoped 的语义，不是重复）。
*/
.ps1-settings-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ps1-settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
