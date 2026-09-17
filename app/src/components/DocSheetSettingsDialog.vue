<!--
  C 家族自绘单据 · **共用**「打印设置」弹窗 —— GS2 与 PS2 逐字相同的那一份
  （旧版 `GlassSheet2PrintManager.openSettingsDialog` / `ProductionSheet2PrintManager.openSettingsDialog`）。

  逆向定稿：`docs/custom-docs-recon/02-glasssheet2.md` §8（§6.2 的草稿/生效、§6.3 的两个键）；
  两单据对照见 `docs/custom-docs-recon/01-diff.md` §10（该节 CONFIRMED：**两个弹窗的全部控件
  （含 min/max/step、常用尺寸预设、方向下拉）逐字相同**，差异只有标题与类名前缀）。

  **只有两页**：纸张 / 打印机 —— 别把收据单那边的「字体调节」（6 类字号 + 品牌 + 8 个纸型 +
  头部元素 + 信息栏排序 + 底部元素）带过来。本家族**没有**任何字号输入、没有品牌、
  没有显隐开关、没有排序、没有元素几何；字号全在「布局设置」里按列改（§8 末的对照）。

  **草稿 / 生效 成对**（旧版 `i` 生效 / `c` 打印设置草稿，GS:102-103），与布局编辑器同构：
  · 打开 = `draft = 深拷贝(生效)`；「重置默认」只重置草稿；「保存并应用」才写盘 + 关窗 + 刷预览。
  · ⚠️ 与布局编辑弹窗**共用同一个 localStorage 键**（`profile.core.storageKeys.template`，§6.3）。

  **打印机这一块在本版是「降级态」**（新版没有 Electron，`getPrinters()` 取不到）——
  处理方式见文件末尾 `loadPrinters()` 的注释：整块照旧版渲染（非 Electron 时旧版也是这么渲染的），
  只是把必然无效的两个控件置灰，不报错、不抛异常。
-->
<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="profile.text.settingsTitle"
    style="width: 820px"
    :bordered="false"
    display-directive="show"
  >
    <n-tabs v-model:value="tab">
      <!-- ───────────────────────────── 纸张（GS:1050-1198） ───────────────────────────── -->
      <n-tab-pane label="纸张" name="paper">
        <n-form label-placement="left" :label-width="120" size="small">
          <n-form-item label="纸张宽(mm)">
            <n-input-number
              :value="draft.paper.widthMm"
              :min="PAPER_UI_RANGES.widthMm.min"
              :max="PAPER_UI_RANGES.widthMm.max"
              :step="PAPER_UI_RANGES.widthMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.paper.widthMm = v as number)"
            />
          </n-form-item>
          <n-form-item label="纸张高(mm)">
            <n-input-number
              :value="draft.paper.heightMm"
              :min="PAPER_UI_RANGES.heightMm.min"
              :max="PAPER_UI_RANGES.heightMm.max"
              :step="PAPER_UI_RANGES.heightMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.paper.heightMm = v as number)"
            />
          </n-form-item>
          <n-form-item label="内边距(mm)">
            <n-input-number
              :value="draft.paper.paddingMm"
              :min="PAPER_UI_RANGES.paddingMm.min"
              :max="PAPER_UI_RANGES.paddingMm.max"
              :step="PAPER_UI_RANGES.paddingMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.paper.paddingMm = v as number)"
            />
          </n-form-item>
          <!--
            ⚠️ 「方向」只写 `paper.orientation`，而该字段在**本组件里没有任何消费者**
            （不被 CSS 发生器读、不被分页读、不被量测读；§6.1 末尾 CONFIRMED）。
            照抄留着，但别指望它生效 —— 横/纵完全由上面两个数值决定。
          -->
          <n-form-item label="方向">
            <n-select v-model:value="draft.paper.orientation" :options="ORIENTATION_OPTIONS" style="width: 200px" />
          </n-form-item>
          <n-form-item label="常用尺寸">
            <!-- 只有 3 个预设（收据单是 8 个），且**不联动 orientation** —— 只写宽高两个数（§8） -->
            <div :class="cls.settingsPresets">
              <n-button v-for="p in PAPER_PRESETS" :key="p.label" size="small" @click="applyPaperPreset(p)">
                {{ p.label }}
              </n-button>
            </div>
          </n-form-item>
        </n-form>
      </n-tab-pane>

      <!-- ─────────────────────────── 打印机（GS:1205-1330） ─────────────────────────── -->
      <n-tab-pane label="打印机" name="printer">
        <n-form label-placement="left" :label-width="110" size="small">
          <!-- 非 Electron 才显示（GS:1209-1227）。新版恒为浏览器 ⇒ 恒显示，与旧版浏览器打开时一致 -->
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
          </n-form-item>
          <n-form-item label="打印份数">
            <!-- 1–99（`COPIES_RANGE`）。⚠️ 浏览器打印链路**不读**它，只有 Electron 静默打印读（§8 / §10.3） -->
            <n-input-number
              :value="draft.print.copies"
              :min="COPIES_RANGE.min"
              :max="COPIES_RANGE.max"
              :step="COPIES_RANGE.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.print.copies = v as number)"
            />
          </n-form-item>
        </n-form>
      </n-tab-pane>
    </n-tabs>

    <!-- footer 三颗，顺序照旧版（GS:1010-1048）：重置默认 / 取消 / 保存并应用(primary) -->
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
import { computed, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NInputNumber,
  NModal,
  NSelect,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui'

// 「与单据无关」的 UI 控件参数直接取自公共底座（两张单据逐字相同、无需 profile 转发）。
import {
  COPIES_RANGE,
  ORIENTATION_OPTIONS,
  PAPER_PRESETS,
  PAPER_UI_RANGES,
} from '../utils/docsheet/defaults'
import type { DocSheetConfig } from '../utils/docsheet/types'
import type { DocSheetUiProfile } from './docSheetUi'

const props = defineProps<{
  show: boolean
  /** 已生效的配置（父组件持有）。弹窗只读它，**打开时**深拷贝一份当草稿。 */
  config: DocSheetConfig
  /** 本单据的组件层档案（文案 / 外壳 class / 模块转出）。 */
  profile: DocSheetUiProfile
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

const cls = computed(() => props.profile.classes)

const message = useMessage()

/** 旧版 `settingsTab`：打开时**重置成 `"paper"`**（GS:784）。 */
const tab = ref<'paper' | 'printer'>('paper')

/** 旧版 `JSON.parse(JSON.stringify(i.value))`（GS:782）。 */
function cloneConfig(cfg: DocSheetConfig): DocSheetConfig {
  return JSON.parse(JSON.stringify(cfg)) as DocSheetConfig
}

/** 草稿（旧版 `c`，GS:103）。 */
const draft = ref<DocSheetConfig>(cloneConfig(props.config))

// ---------------------------------------------------------------------------
// 打印机（旧版的 Electron 专属区，新版降级处理）
// ---------------------------------------------------------------------------

/**
 * 旧版 `w = Vue.computed(() => !!window.electronAPI)`（打印设置里用它决定要不要显示 warning、
 * 以及 `x()` 要不要真去拉列表）。
 *
 * ⚠️ **新版没有 Electron**（项目只有浏览器宿主），所以这里恒 `false` —— 与「旧版在浏览器里打开」
 * 的取值完全一致，于是 warning 恒显示、`loadPrinters()` 恒走静默 return 那条分支。
 * 声明成最小接口只是为了 `window.electronAPI` 在 TS 下有个形状，**没有任何一处会真的调到它**。
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
/** 选中的打印机名 —— 旧版 `f`，存在 `profile.core.storageKeys.selectedPrinter`（**裸字符串，不 JSON**）。 */
const selectedPrinter = ref('')

/** 下拉选项：`isDefault` 的加「（默认）」后缀（GS:1240-1250）。列表为空（本版恒为空）时下拉无选项。 */
const printerOptions = computed(() =>
  printers.value.map((p) => ({
    label: p.isDefault ? p.displayName + '（默认）' : p.displayName,
    value: p.name,
  })),
)

/**
 * 旧版 `x`（GS:127-139）：
 * ```
 * if (!isElectron) return          // ← 非 Electron **静默 return**，连提示都不弹
 * loading = true
 * try { printers = await window.electronAPI.getPrinters() } catch { ElMessage.error("获取打印机列表失败") }
 * finally { loading = false }
 * ```
 * 新版把 `isElectron` 恒假那条分支原样保留 —— 所以**不会报错、不会抛异常**，
 * 按钮只是没有效果（旧版在浏览器里点它同样没有效果）。
 * 为了让这一点对用户诚实，模板里给下拉和刷新按钮挂了 `:disabled="!isElectronEnv"`
 * （**有意偏离**：旧版浏览器模式下这两颗是可点的死控件；置灰不改变任何产物，只是别让人白点）。
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

/** 旧版 `z`（GS:121-126）：**选中即写盘**（裸字符串），空选 → 写空串 = 用系统默认。 */
function onPrinterChange(v: string | null): void {
  selectedPrinter.value = v ?? ''
  props.profile.api.savePrinter(selectedPrinter.value)
}

// ---------------------------------------------------------------------------
// 常用尺寸（GS:1108-1197）
// ---------------------------------------------------------------------------

/** ⚠️ **只写宽高两个数**，不联动 `orientation`（§8 的 ⚠️，与收据单的 8 个预设不同）。 */
function applyPaperPreset(preset: { widthMm: number; heightMm: number }): void {
  draft.value.paper.widthMm = preset.widthMm
  draft.value.paper.heightMm = preset.heightMm
}

// ---------------------------------------------------------------------------
// 打开 / 三颗按钮
// ---------------------------------------------------------------------------

/**
 * 旧版 `openSettingsDialog`（GS:781-787）：
 * `c = clone(i)` → `settingsTab = "paper"` → 显示 →（Electron 且列表为空时）拉打印机列表。
 * ⚠️ 它**不关布局编辑弹窗**（两者可同时开着，§7.1）。
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

/** 「重置默认」（旧版 `B`，GS:140-142）：**只重置草稿** —— 不写盘、不关窗、不刷新预览。 */
function resetDraft(): void {
  draft.value = props.profile.api.createDefaultConfig()
}

/** 「取消」：只关窗（生效值从未被改过）。 */
function cancel(): void {
  show.value = false
}

/**
 * 「保存并应用」（旧版 `N`，GS:146-153）：
 * `i = clone(c)` → 落库 → 关窗 →（若预览打开）刷新预览。
 * 这里同样把清洗后的草稿回填一份，避免「关窗前最后一帧」与生效值不一致（观感，无行为差异）。
 */
function save(): void {
  const saved = cloneConfig(draft.value)
  props.profile.api.saveConfig(saved)
  draft.value = cloneConfig(saved)
  show.value = false
  emit('saved')
}
</script>

<style scoped>
/*
  以下两条是**新版自己的排版胶水**：旧版是 el-form-item 内两个/三个内联按钮，Naive 下用 flex 行还原。

  ⚠️ 与布局编辑器同样，两个前缀并列 —— 模板 class 由 `profile.classes` 运行时绑定，
  CSS 选择器只能是字面量（详见 `DocSheetLayoutDialog.vue` 的文件头注）。
*/
.gs2-settings-presets,
.ps2-settings-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.gs2-settings-footer,
.ps2-settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
