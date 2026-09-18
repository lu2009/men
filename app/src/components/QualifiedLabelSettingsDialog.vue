<!--
  「自定义合格标签」· **设置**弹窗（旧版 `QualifiedLabelPrintManager.openSettingsDialog`，`ic=13`）。

  逆向定稿：`docs/custom-docs-recon/01-ql.md`（§2.1 配置模型 / §2.4 纸张 / §2.5 全局字体 /
  §3.3 整体自适应 / §5.2 固定张数 / §5.3 保存的四条副作用）。

  ⚠️ **640px 浮层**（旧版 `QL:1085`，别的三张都是全屏 / 820px），**三个 tab**：
  `纸张` / `字体` / `打印机`。`字体` 这个 tab 是**本单据独有**的 —— C 家族只有两页；
  `打印份数` 与 `固定标签数` 在**打印机** tab 里（不在纸张 tab）。

  **草稿 / 生效 成对**（旧版 `i` 草稿 / `r` 生效）：
  · 打开 = `草稿 = 深拷贝(生效)`（**纯拷贝，不归一化** —— 与布局编辑器那侧不同，见 `watch` 里的注）
    + tab 复位 `'paper'` + 固定张数草稿 ← 生效（`QL:903-909`）；
  · 「重置默认」= **只重置草稿**（`i = a()`，**并且把固定张数的草稿也复位成 `关/1`**）——`QL:399-402`；
  · 「保存并应用」= 归一化回生效 → 落库（**1 个 JSON 键 + 2 个裸串键**）→ 关窗 → 刷预览；
  · 「取消」= 直接关窗。

  ⚠️ 与**布局编辑弹窗共用同一个 localStorage 键**（`qualified_label_template_v2`）——
  两个弹窗可以同时开着，谁后保存谁生效。

  **保存的四条副作用**（`k`，`QL:401-421`，逐字，见 `save()` 的注释）：
    ① 配置：`生效 = 归一化(深拷贝(草稿))` → 写 `qualified_label_template_v2`；
    ② 固定张数：`生效 = 草稿`（数量再 clamp 一次）→ 写 `_quantity_enabled` / `_quantity_value`
       两个**裸串**键（`"1"`/`"0"` 与数字串）；
    ③ 关窗；
    ④ 只有预览面板正开着（旧版 `isActive()`）才回调宿主重建 HTML ⇒ 新版是抽屉的 `saved` 事件。
  ⚠️ `k` **不重置 tab、不重置打印机列表**（只有「重置默认」`A` 才重置草稿）。

  ⚠️ **打印机这一块在本版是「降级态」**（新版没有 Electron，`getPrinters()` 取不到）——
  处理方式与 `DocSheetSettingsDialog.vue`（C 家族）**逐字相同**：整块照旧版渲染
  （非 Electron 时旧版也是这么渲染的），只把必然无效的两个控件置灰，不报错、不抛异常。
-->
<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="profile.text.settingsTitle"
    :bordered="false"
    display-directive="show"
    style="width: 640px"
  >
    <n-tabs v-model:value="tab">
      <!-- ───────────────────────────── 纸张（`QL:1120-1480`） ───────────────────────────── -->
      <n-tab-pane label="纸张" name="paper">
        <n-form label-placement="left" :label-width="110" size="small">
          <n-form-item label="纸张宽度(mm)">
            <n-input-number
              :value="draft.paper.widthMm"
              :min="PAPER_UI_RANGES.widthMm.min"
              :max="PAPER_UI_RANGES.widthMm.max"
              :step="PAPER_UI_RANGES.widthMm.step"
              @update:value="(v: number | null) => (draft.paper.widthMm = v as number)"
            />
          </n-form-item>
          <n-form-item label="纸张高度(mm)">
            <n-input-number
              :value="draft.paper.heightMm"
              :min="PAPER_UI_RANGES.heightMm.min"
              :max="PAPER_UI_RANGES.heightMm.max"
              :step="PAPER_UI_RANGES.heightMm.step"
              @update:value="(v: number | null) => (draft.paper.heightMm = v as number)"
            />
          </n-form-item>

          <!--
            ⚠️ 「方向」在本单**只写 `paper.orientation`**：它不进 CSS 发生器（`css.ts`），
            也不是旋转的开关 —— 旋转是旁边的 `printRotate90`（在**布局编辑器**里）。
            新版没有 Electron ⇒ 它在本仓库里**暂时没有消费者**，但它是配置项的一部分、用户能改，
            **照抄存着**（`printSilent` 的替代物出现时要读它，见 `types.ts` 的 `LabelPaper`）。
          -->
          <n-form-item label="方向">
            <n-select
              :value="draft.paper.orientation"
              :options="ORIENTATION_OPTIONS"
              style="width: 200px"
              @update:value="(v: 'landscape' | 'portrait') => (draft.paper.orientation = v)"
            />
          </n-form-item>

          <n-form-item label="内边距(mm)">
            <n-input-number
              :value="draft.paper.paddingMm"
              :min="PAPER_UI_RANGES.paddingMm.min"
              :max="PAPER_UI_RANGES.paddingMm.max"
              :step="PAPER_UI_RANGES.paddingMm.step"
              @update:value="(v: number | null) => (draft.paper.paddingMm = v as number)"
            />
          </n-form-item>

          <!--
            常用尺寸：**7 个**（`QL:1293-1419`，C 家族只有 3 个）。
            ⚠️ 点击**只写宽高两个数**、**不重排字段**（`applyPaperPreset` / 旧版 `P`）——
            字段还停在旧坐标上，要用户再点一次「整体自适应」。照抄，别顺手联动。
          -->
          <n-form-item label="常用尺寸">
            <div class="ql-settings-presets">
              <n-button
                v-for="p in PAPER_PRESETS"
                :key="p.label"
                size="small"
                @click="applyPaperPreset(p)"
              >
                {{ p.label }}
              </n-button>
            </div>
          </n-form-item>

          <!--
            ★★ 「整体自适应」（旧版 `q`，`QL:479-494`）—— **不是「按当前版式缩放」**！
            基准**恒为出厂的 70×90 版式**（`autoFitFields` 内部 `createDefaultConfig()`），
            ⇒ **用户之前的所有手工调整会被覆盖**。灰字提示语逐字照抄（它就是为此写的）。
            ⚠️ 本处与布局编辑器的那颗按钮**同名不同文案**：这里「按当前纸张比例自适应」+
            下方独立一行灰字提示；布局编辑器是「按当前纸张比例」+ 同行 `基准 70×90mm`。
            ⚠️ **只有这一处**（设置弹窗）会弹 `ElMessage.success("已按 W×Hmm 自适应完成")`（`QL:481-486`）。
          -->
          <n-form-item label="整体自适应">
            <n-button type="warning" size="small" @click="onAutoFit">按当前纸张比例自适应</n-button>
            <div class="ql-settings-hint">
              以 70×90mm 为基准，按比例缩放所有字段位置、宽度、字号及二维码
            </div>
          </n-form-item>
        </n-form>
      </n-tab-pane>

      <!-- ───────────────────────────── 字体（`QL:1482-1680`，本单据独有） ───────────────────────────── -->
      <n-tab-pane label="字体" name="font">
        <n-form label-placement="left" :label-width="110" size="small">
          <!-- 字体族下拉（5 项，引号形式照抄，见 `FONT_FAMILY_OPTIONS`） -->
          <n-form-item label="字体">
            <n-select
              :value="draft.globalFont.fontFamily"
              :options="FONT_FAMILY_OPTIONS"
              style="width: 240px"
              @update:value="(v: string) => (draft.globalFont.fontFamily = v)"
            />
          </n-form-item>

          <!--
            ⚠️ 「默认字号」**只写 `<section>` 的 `font-size`**，**不会**改任何字段
            （每个字段的字号一律取自己的；「应用到全部」那颗按钮**只在布局编辑器**里，
            `QL:2083` —— 设置弹窗的字体 tab 里**没有**它，这是旧版事实，§2.5）。
          -->
          <n-form-item label="默认字号(pt)">
            <n-input-number
              :value="draft.globalFont.fontSize"
              :min="GLOBAL_FONT_SIZE_UI_RANGE.min"
              :max="GLOBAL_FONT_SIZE_UI_RANGE.max"
              :step="GLOBAL_FONT_SIZE_UI_RANGE.step"
              @update:value="(v: number | null) => (draft.globalFont.fontSize = v as number)"
            />
          </n-form-item>

          <n-form-item label="默认粗细">
            <n-select
              :value="draft.globalFont.fontWeight"
              :options="FONT_WEIGHT_OPTIONS"
              @update:value="(v: 'normal' | 'bold') => (draft.globalFont.fontWeight = v)"
            />
          </n-form-item>

          <!--
            ★ **`globalFont` 里唯一「一键改全部」的键**（§2.5）：它既写 `<section>` 的
            `line-height`，**又写进每个文本字段的 inline `line-height`** ⇒ 改它全局即时生效。
            ⚠️ 步长是 **0.05**（别抄成 0.5），范围 1–2。
          -->
          <n-form-item label="行高">
            <n-input-number
              :value="draft.globalFont.lineHeight"
              :min="LINE_HEIGHT_UI_RANGE.min"
              :max="LINE_HEIGHT_UI_RANGE.max"
              :step="LINE_HEIGHT_UI_RANGE.step"
              @update:value="(v: number | null) => (draft.globalFont.lineHeight = v as number)"
            />
          </n-form-item>

          <!-- `autoHideEmpty` **不影响固定张数**，只影响单张标签里有啥（§5.2 末） -->
          <n-form-item label="自动隐藏空字段">
            <n-switch
              :value="draft.autoHideEmpty"
              @update:value="(v: boolean) => (draft.autoHideEmpty = v)"
            />
          </n-form-item>
        </n-form>
      </n-tab-pane>

      <!-- ──────────────────────────── 打印机（`QL:1681-1900`） ──────────────────────────── -->
      <n-tab-pane label="打印机" name="printer">
        <n-form label-placement="left" :label-width="110" size="small">
          <!-- 非 Electron 才显示（`QL:1689-1710`）。新版恒为浏览器 ⇒ 恒显示，与旧版浏览器打开时一致 -->
          <n-form-item v-if="!isElectronEnv" label="">
            <n-alert
              type="warning"
              :closable="false"
              title="仅Electron客户端支持静默打印，当前为浏览器模式"
            />
          </n-form-item>

          <!--
            下拉选项：`isDefault` 的加「（默认）」后缀；`value` 取 `name`（不是 `displayName`）。
            ⚠️ 空白提示是「使用系统默认打印机」（**不是**「请选择打印机」）。
          -->
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
            <span class="ql-settings-selected">已选：{{ selectedPrinter || '系统默认' }}</span>
          </n-form-item>

          <!-- ⚠️ 浏览器打印链路**不读**打印份数，只有 Electron 静默打印读（新版不做）—— 照抄留着 -->
          <n-form-item label="打印份数">
            <n-input-number
              :value="draft.print.copies"
              :min="COPY_RANGE.min"
              :max="COPY_RANGE.max"
              :step="COPY_RANGE.step"
              @update:value="(v: number | null) => (draft.print.copies = v as number)"
            />
          </n-form-item>

          <!--
            ★★ **固定标签数**（本单据独有，§5.2）—— ⚠️ 它改的是**行集长度**，不是页数：
            它把标签行**循环取模补齐**到 N 条（`padToFixedQuantity`），不截断语义上的分页。
            ⚠️ 与上面的「打印份数」**不是一回事**，虽然范围都是 1–99：
            `copies` 只进 Electron 静默打印，本项进的是「生成几张标签」。
          -->
          <n-form-item label="固定标签数">
            <n-switch v-model:value="fixedEnabled" />
            <span class="ql-settings-selected">开启后按指定页数生成标签</span>
          </n-form-item>

          <!-- 只有开关打开才出现（`QL:1875`） -->
          <n-form-item v-if="fixedEnabled" label="打印数量">
            <n-input-number
              v-model:value="fixedValue"
              :min="COPY_RANGE.min"
              :max="COPY_RANGE.max"
              :step="COPY_RANGE.step"
            />
          </n-form-item>
        </n-form>
      </n-tab-pane>
    </n-tabs>

    <!-- footer 三颗，顺序照旧版（`QL:1097-1138`）：重置默认 / 取消 / 保存并应用(primary) -->
    <template #footer>
      <div class="ql-settings-footer">
        <n-button @click="resetDraft">重置默认</n-button>
        <n-button @click="cancel">取消</n-button>
        <n-button type="primary" @click="save">保存并应用</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NInputNumber,
  NModal,
  NSelect,
  NSwitch,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui'

import {
  autoFitFields,
  COPY_RANGE,
  createDefaultConfig,
  FONT_FAMILY_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  GLOBAL_FONT_SIZE_UI_RANGE,
  LINE_HEIGHT_UI_RANGE,
  loadFixedQuantitySetting,
  normalizeQualifiedLabelConfig,
  PAPER_PRESETS,
  PAPER_UI_RANGES,
  saveFixedQuantitySetting,
} from '../utils/qualifiedlabel'
import type { QualifiedLabelConfig } from '../utils/qualifiedlabel'
import type { QualifiedLabelUiProfile } from './qualifiedLabelUiProfile'

const props = defineProps<{
  show: boolean
  /** 已生效的配置（父组件持有）。弹窗只读它，**打开时**深拷贝 + 归一化一份当草稿。 */
  config: QualifiedLabelConfig
  /** 行数据。**本弹窗用不到** —— 同 `QualifiedLabelLayoutDialog`，只是抽屉会一并传下来。 */
  rows?: unknown
  /** 本单据的组件层档案（只用来取弹窗标题）。 */
  profile: QualifiedLabelUiProfile
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  /** 「保存并应用」之后触发：父组件据此重读配置 + 重渲染主预览。 */
  (e: 'saved'): void
}>()

const show = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const message = useMessage()

/**
 * 旧版 `JSON.parse(JSON.stringify(x))` 的等价物。
 *
 * ⚠️ 草稿必须是**新对象**（不是引用共享）：靠这个做到「编辑期不污染生效值、取消即丢弃」。
 * `QualifiedLabelConfig` 是纯数据，`JSON` 往返与结构化克隆等价。
 */
function cloneConfig(cfg: QualifiedLabelConfig): QualifiedLabelConfig {
  return JSON.parse(JSON.stringify(cfg)) as QualifiedLabelConfig
}

/** 旧版 `u`：打开时**复位成 `'paper'`**（`openSettingsDialog`，`QL:903-909`）。 */
const tab = ref<'paper' | 'font' | 'printer'>('paper')

/**
 * 草稿（旧版 `i`，`QL:210`）。
 *
 * ⚠️ 初值取生效配置的纯拷贝（旧版初值是 `a()` = 出厂默认）—— 两者都**只在第一次打开前**存在，
 * 而打开时 `watch` 会无条件重新拷贝一份，所以实际渲染出来的永远是「打开那一刻的生效配置」。
 * 新版取生效配置只是为了少一次「先默认、后覆盖」的中间态（与 C 家族的设置弹窗同一写法）。
 */
const draft = ref<QualifiedLabelConfig>(cloneConfig(props.config))

/** 纸张方向下拉的选项（**只有两项**，`QL:1215-1225`）。 */
const ORIENTATION_OPTIONS = [
  { label: '纵向', value: 'portrait' },
  { label: '横向', value: 'landscape' },
]

// ---------------------------------------------------------------------------
// 固定张数（旧版 `x` 草稿开关 / `B` 草稿数量，`QL:233-234`）
// ---------------------------------------------------------------------------

const fixedEnabled = ref(false)
const fixedValue = ref(1)

// ---------------------------------------------------------------------------
// 打印机（旧版的 Electron 专属区，新版降级处理；与 C 家族逐字同一套做法）
// ---------------------------------------------------------------------------

/**
 * 旧版 `v = Vue.computed(() => !!window.electronAPI)`（`QL:227`）。
 * ⚠️ **新版没有 Electron**，所以这里恒 `false` —— 与「旧版在浏览器里打开」的取值完全一致：
 * warning 恒显示、`loadPrinters()` 恒走静默 return 那条分支（不报错、不抛异常）。
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
/** 选中的打印机名（旧版 `h`）—— 存在 `qualified_label_printer`，**裸字符串，不 JSON**。 */
const selectedPrinter = ref('')

/** 下拉选项：`isDefault` 的加「（默认）」后缀（`QL:1735-1750`）。 */
const printerOptions = computed(() =>
  printers.value.map((p) => ({
    label: p.isDefault ? p.displayName + '（默认）' : p.displayName,
    value: p.name,
  })),
)

/**
 * 旧版 `b`（`QL:376-392`）：非 Electron **静默 return**（连提示都不弹），
 * 失败才 `ElMessage.error("获取打印机列表失败")`。
 * 新版把 `isElectron` 恒假那条分支原样保留；模板里给下拉与按钮挂了 `:disabled="!isElectronEnv"`
 * （**有意偏离，与 C 家族同一条**：旧版浏览器模式下这两颗是可点的死控件；置灰不改变任何产物）。
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

/** 旧版 `E`（`QL:369-374`）：**选中即写盘**（裸字符串），空选 → 写空串 = 用系统默认。 */
function onPrinterChange(v: string | null): void {
  selectedPrinter.value = v ?? ''
  props.profile.api.savePrinter(selectedPrinter.value)
}

// ---------------------------------------------------------------------------
// 纸张：常用尺寸 / 整体自适应
// ---------------------------------------------------------------------------

/** ⚠️ **只写宽高两个数**，不联动 `orientation`、不重排字段（旧版 `P`，`QL:422-425`）。 */
function applyPaperPreset(preset: { widthMm: number; heightMm: number }): void {
  draft.value.paper.widthMm = preset.widthMm
  draft.value.paper.heightMm = preset.heightMm
}

/**
 * 「整体自适应」（旧版 `q`，`QL:479-494`）：就地重铺草稿的 11 条字段，然后弹成功提示。
 * 提示语是拼出来的：`已按 {宽}×{高}mm 自适应完成`（**只有设置弹窗这一处会弹**）。
 */
function onAutoFit(): void {
  const p = draft.value.paper
  autoFitFields(draft.value.fields, p.widthMm, p.heightMm)
  message.success('已按 ' + p.widthMm + '×' + p.heightMm + 'mm 自适应完成')
}

// ---------------------------------------------------------------------------
// 打开 / 三颗按钮
// ---------------------------------------------------------------------------

/**
 * 旧版 `openSettingsDialog`（`QL:903-909`）：
 * `草稿 = 归一化(深拷贝(生效))` → 固定张数草稿 ← 生效 → tab 复位 `'paper'` → 显示
 * →（Electron 且列表为空时）拉打印机列表（`onOpen: D`，`QL:393-397`）。
 * ⚠️ 它**不关布局编辑弹窗**（两者可同时开着）。
 *
 * ⚠️ **固定张数的「生效值」在新版是从 localStorage 现读的**（`loadFixedQuantitySetting`）——
 * 新版没有 QL 组件实例那份常驻状态（旧版是 `C`/`z` 两个 ref），而这两个键**只在保存时写**，
 * 所以「现读」与旧版的「常驻」逐条等价。
 */
watch(
  () => props.show,
  (open) => {
    if (!open) return
    /**
     * ⚠️ **打开时是「纯深拷贝」，不归一化**（旧版 `openSettingsDialog` 逐字是
     * `i.value = JSON.parse(JSON.stringify(r.value))`，**没有** `N(...)`）。
     * ★ 这与**布局编辑器**不同：那边的打开是 `d = N(JSON.parse(JSON.stringify(r)))`，
     * **两端都归一化**（§2.2 的 CONFIRMED 差异就出在这一对函数上，别把两者混为一谈）。
     * 产物上通常看不出差别（生效值本来就已被归一化过），但照抄才能保证「读盘后被手工改坏的
     * 存档」在这两个弹窗里表现一致。
     */
    draft.value = cloneConfig(props.config)
    const fixed = loadFixedQuantitySetting()
    fixedEnabled.value = fixed.enabled
    fixedValue.value = fixed.value
    tab.value = 'paper'
    selectedPrinter.value = props.profile.api.loadSettings().selectedPrinter
    if (isElectronEnv && printers.value.length === 0) void loadPrinters()
  },
)

/**
 * 「重置默认」（旧版 `A`，`QL:399-402`）：**只重置草稿** ——
 * ★ 它**还把固定张数的草稿复位成 `关` / `1`**（不是只重置配置），照抄。
 * 不写盘、不关窗、不刷预览。
 */
function resetDraft(): void {
  draft.value = createDefaultConfig()
  fixedEnabled.value = false
  fixedValue.value = 1
}

/** 「取消」：只关窗（生效值从未被改过）。 */
function cancel(): void {
  show.value = false
}

/**
 * 「保存并应用」（旧版 `k`，`QL:401-421`）—— **四条副作用**，逐条照抄：
 * ```
 * r.value = N(JSON.parse(JSON.stringify(i.value)))   // ① 草稿 → 生效（深拷贝 + 归一化）
 * C.value = x.value;  z.value = L(B.value)           // ② 固定张数：草稿 → 生效
 * M()                                                // ②' 写 qualified_label_template_v2
 * IIFE: z.value = L(z.value); 写 _quantity_enabled / _quantity_value
 * n.value = false                                    // ③ 关弹窗
 * if (props.isActive?.())                            // ④ 只有预览面板开着才刷
 *    props.onFixedQuantityChange ? await … : await ne()
 * ```
 * ⚠️ **不重置 tab、不重置打印机列表**（`A` 才做那些）。
 * ⚠️ 固定张数写盘走 `saveFixedQuantitySetting`：它**先 clamp 再写**两个裸串键
 * （`"1"`/`"0"` 与数字串），并把归一化后的值返回给调用方 —— 与旧版 IIFE 的分工一致。
 */
function save(): void {
  const saved = normalizeQualifiedLabelConfig(cloneConfig(draft.value))
  props.profile.api.saveConfig(saved) // ①
  draft.value = normalizeQualifiedLabelConfig(cloneConfig(saved))
  const fixed = saveFixedQuantitySetting(fixedEnabled.value, fixedValue.value) // ②
  fixedEnabled.value = fixed.enabled
  fixedValue.value = fixed.value
  show.value = false // ③
  emit('saved') // ④（新版：抽屉恒有预览，无条件重建行 + 重渲染）
}
</script>

<style scoped>
/*
  以下三条是**新版自己的排版胶水**（旧版是 el-form-item 内的内联按钮组 / 内联灰字 span），
  取值逐字照抄旧版那几处内联样式：
  · `常用尺寸` 的按钮行 —— 旧版是连续的 `el-button`，这里 flex-wrap 防溢出；
  · 灰字提示 —— 旧版 `style="color:#999;font-size:12px;margin-top:4px"`；
  · 「已选：X」—— 旧版 `style="margin-left:8px;color:#999;font-size:12px"`。
*/
.ql-settings-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ql-settings-hint {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
}
.ql-settings-selected {
  margin-left: 8px;
  color: #999;
  font-size: 12px;
}
.ql-settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
