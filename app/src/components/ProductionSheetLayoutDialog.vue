<!--
  自定义生产单（ic=14）· **B 家族「布局编辑」全屏弹窗**。
  旧版 `ProductionSheetPrintManager` 的 `openLayoutEditor` 打开流程（`PS:1367-1392`）+ 模板（`PS:2935-4095`）。

  ⚠️⚠️ **不要照抄 `DocSheetLayoutDialog.vue`（C 家族）** —— 两边是**三套 UI 家族里的两族**
  （§骨架 §2.1）。逐条差异见施工图 §3.6，最要紧的四条：
    · 左栏固定 **380px**（C 家族 460px），右栏 `align-items/justify-content:center`；
    · 左栏是**五个分组**（纸张 / 字段设置 / 表格设置+列宽设置 / 门图框设置 / 字段列表），
      其中 2/3/4 组**随选中类别切换显隐**（C 家族三组恒在）；
    · 右栏是**三种绝对定位元素**拼的（字段 → 门图框 → 表格），只有表格那层用 `innerHTML`；
      C 家族是**整块 `innerHTML`**；
    · **3 套拖拽**（C 家族一套都没有，只有 ↑↓ 排序）。

  ⚠️ **class 名走 `PS_LAYOUT_CLASSES` 常量表**（核心层 `utils/productionsheet/profile.ts`）——
  它是 `ps-layout-**editor**-*`（带 `editor`、**无数字**），与 PS2 的 `ps2-layout-*`
  **没有一处相同**，**不能**从前缀派生（§0.3 CONFIRMED）。CSS 逐字来自
  `docs/custom-docs-recon/ps-layout.css`（原文件带 `[data-v-c55c9cb3]`，
  那是 Vue 的 scope 属性，本组件用 `<style scoped>` 让 Vue 自己加，**别抄进 CSS**）。

  **草稿 / 生效 成对**（旧版 `r` 生效 / `s` 布局草稿，`PS:246-250`），与 C 家族同构，但**多一步归一化**：
  · 打开 = `s = normalize(clone(生效))`（`PS:1370-1373`，★ 与 QL 同族：**两端都归一化**）；
  · 「保存布局」= `生效 ← normalize(clone(草稿))` → 落库 → 关窗 → 刷预览（`PS:771-778`）；
  · 「重置默认」= **只重置草稿**（`PS:768`），不写盘、不关窗；
  · 「取消」= 直接关窗（生效值全程没被碰过，无回滚逻辑）。

  ⚠️ 三套拖拽**都写草稿 `s`**、都不落库 —— 与 QL 的拖拽（写生效 + 立即落 localStorage）**完全不同**
  （§骨架 §2.5 CONFIRMED）。
-->
<template>
  <n-modal
    v-model:show="showModel"
    preset="card"
    :title="profile.text.layoutTitle"
    :bordered="false"
    display-directive="show"
    :style="fullscreenStyle"
    :content-style="contentStyle"
  >
    <div :class="L.editorWrap">
      <!-- ───────────────────── 左栏：五个分组（PS:2984-3905） ───────────────────── -->
      <div :class="L.editorLeft">
        <!-- A. 纸张 —— 无条件渲染（PS:2986-3073）。★ 没有方向下拉、没有常用尺寸按钮（那两样只在设置弹窗） -->
        <n-form label-placement="left" :label-width="80" size="small">
          <n-form-item label="纸张宽(mm)">
            <n-input-number
              :value="draft.paper.widthMm"
              :min="PS_UI_RANGES.paperWidthMm.min"
              :max="PS_UI_RANGES.paperWidthMm.max"
              :step="PS_UI_RANGES.paperWidthMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.paper.widthMm = v as number)"
            />
          </n-form-item>
          <n-form-item label="纸张高(mm)">
            <n-input-number
              :value="draft.paper.heightMm"
              :min="PS_UI_RANGES.paperHeightMm.min"
              :max="PS_UI_RANGES.paperHeightMm.max"
              :step="PS_UI_RANGES.paperHeightMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.paper.heightMm = v as number)"
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
        </n-form>

        <!-- B. 字段设置 —— 条件：选中了某个字段（PS:3074-3327）。label-width 70px -->
        <div v-if="selectedField" :class="L.fieldEditor">
          <div :class="L.fieldsTitle">字段设置：{{ selectedField.label }}</div>
          <n-form label-placement="left" :label-width="70" size="small">
            <n-form-item label="X(mm)">
              <n-input-number
                :value="selectedField.x"
                :min="PS_UI_RANGES.fieldX.min"
                :max="PS_UI_RANGES.fieldX.max"
                :step="PS_UI_RANGES.fieldX.step"
                style="width: 150px"
                @update:value="(v: number | null) => (selectedField!.x = v as number)"
              />
            </n-form-item>
            <n-form-item label="Y(mm)">
              <n-input-number
                :value="selectedField.y"
                :min="PS_UI_RANGES.fieldY.min"
                :max="PS_UI_RANGES.fieldY.max"
                :step="PS_UI_RANGES.fieldY.step"
                style="width: 150px"
                @update:value="(v: number | null) => (selectedField!.y = v as number)"
              />
            </n-form-item>
            <n-form-item label="宽(mm)">
              <n-input-number
                :value="selectedField.width"
                :min="PS_UI_RANGES.fieldWidth.min"
                :max="PS_UI_RANGES.fieldWidth.max"
                :step="PS_UI_RANGES.fieldWidth.step"
                style="width: 150px"
                @update:value="(v: number | null) => (selectedField!.width = v as number)"
              />
            </n-form-item>
            <!--
              ★ 下面五条只对「非 qrcode / 非 lockImg」的字段渲染（`PS:3164-3322` 的 `v-if`）。
              ⚠️ 本面板**没有** `visible` / `fontFamily` / `prefix` 控件：
                · `visible` 只能在下方「字段列表」里改；
                · `fontFamily` 在本弹窗**无处可改**，只能去设置弹窗「头部字段」tab 的「字体」列；
                · `prefix` 由 `normalizeProductionSheetConfig()` 强制取默认，**任何 UI 都改不了**（§2.4）。
            -->
            <template v-if="!isSquareField(selectedField.key)">
              <n-form-item label="字号(pt)">
                <n-input-number
                  :value="selectedField.fontSize"
                  :min="PS_UI_RANGES.fieldFontSize.min"
                  :max="PS_UI_RANGES.fieldFontSize.max"
                  :step="PS_UI_RANGES.fieldFontSize.step"
                  style="width: 150px"
                  @update:value="(v: number | null) => (selectedField!.fontSize = v as number)"
                />
              </n-form-item>
              <n-form-item label="颜色">
                <n-color-picker
                  :value="selectedField.fontColor"
                  size="small"
                  @update:value="(v: string | null) => (selectedField!.fontColor = v ?? '')"
                />
              </n-form-item>
              <n-form-item label="粗细">
                <n-select
                  :value="selectedField.fontWeight"
                  :options="FONT_WEIGHT_OPTIONS"
                  style="width: 100px"
                  @update:value="(v: string) => (selectedField!.fontWeight = v)"
                />
              </n-form-item>
              <n-form-item label="换行">
                <n-switch
                  :value="selectedField.wrap"
                  @update:value="(v: boolean) => (selectedField!.wrap = v)"
                />
              </n-form-item>
              <n-form-item label="行距">
                <n-input-number
                  :value="selectedField.lineHeight"
                  :min="PS_UI_RANGES.fieldLineHeight.min"
                  :max="PS_UI_RANGES.fieldLineHeight.max"
                  :step="PS_UI_RANGES.fieldLineHeight.step"
                  style="width: 150px"
                  @update:value="(v: number | null) => (selectedField!.lineHeight = v as number)"
                />
              </n-form-item>
            </template>
          </n-form>
        </div>

        <!-- C. 表格设置 + 列宽设置 —— 条件：选中了表格（PS:3329-3570）。label-width 80px -->
        <div v-if="selection === 'table'" :class="L.fieldEditor">
          <div :class="L.fieldsTitle">表格设置</div>
          <n-form label-placement="left" :label-width="80" size="small">
            <!-- ★ 绑的是可写 computed `T`（草稿的哨兵 `-1` → 自动值），不是裸字段（PS:620-630） -->
            <n-form-item label="Y位置(mm)">
              <n-input-number
                :value="tableTopMm"
                :min="PS_UI_RANGES.tableTopMm.min"
                :max="PS_UI_RANGES.tableTopMm.max"
                :step="PS_UI_RANGES.tableTopMm.step"
                style="width: 150px"
                @update:value="(v: number | null) => (tableTopMm = v as number)"
              />
            </n-form-item>
            <n-form-item label="字号(pt)">
              <n-input-number
                :value="draft.tableConfig.tableFontSize"
                :min="PS_UI_RANGES.tableFontSize.min"
                :max="PS_UI_RANGES.tableFontSize.max"
                :step="PS_UI_RANGES.tableFontSize.step"
                style="width: 150px"
                @update:value="(v: number | null) => (draft.tableConfig.tableFontSize = v as number)"
              />
            </n-form-item>
            <n-form-item label="行高(px)">
              <n-input-number
                :value="draft.tableConfig.rowHeight"
                :min="PS_UI_RANGES.tableRowHeight.min"
                :max="PS_UI_RANGES.tableRowHeight.max"
                :step="PS_UI_RANGES.tableRowHeight.step"
                style="width: 150px"
                @update:value="(v: number | null) => (draft.tableConfig.rowHeight = v as number)"
              />
            </n-form-item>
            <n-form-item label="外边框">
              <n-switch
                :value="draft.tableConfig.showBodyBorder"
                @update:value="(v: boolean) => (draft.tableConfig.showBodyBorder = v)"
              />
            </n-form-item>
            <n-form-item label="加下划线">
              <n-switch
                :value="draft.tableConfig.underlineBrElements"
                @update:value="(v: boolean) => (draft.tableConfig.underlineBrElements = v)"
              />
            </n-form-item>
          </n-form>
          <!--
            ★ 列宽设置里**没有 ↑↓ 排序**（C 家族才有，§diff §2）——
              PS 的列顺序**只能在设置弹窗的「表格」tab 里改**（§3.7），本表只改显隐与宽度。
          -->
          <div :class="L.fieldsTitle" style="margin-top: 6px">列宽设置</div>
          <n-data-table
            :data="draft.tableConfig.columns"
            :columns="columnWidthColumns"
            :row-key="columnRowKey"
            size="small"
            bordered
            :max-height="160"
            :style="{ width: '100%' }"
          />
        </div>

        <!-- D. 门图框设置 —— 条件：选中了门图框（PS:3571-3729）。label-width 70px -->
        <div v-if="selection === 'doorImgBox'" :class="L.fieldEditor">
          <div :class="L.fieldsTitle">门图框设置</div>
          <n-form label-placement="left" :label-width="70" size="small">
            <n-form-item label="启用">
              <n-switch
                :value="draft.doorImgBox.enabled"
                @update:value="(v: boolean) => (draft.doorImgBox.enabled = v)"
              />
            </n-form-item>
            <n-form-item label="X(mm)">
              <n-input-number
                :value="draft.doorImgBox.x"
                :min="PS_UI_RANGES.doorImgBoxX.min"
                :max="PS_UI_RANGES.doorImgBoxX.max"
                :step="PS_UI_RANGES.doorImgBoxX.step"
                style="width: 150px"
                @update:value="(v: number | null) => (draft.doorImgBox.x = v as number)"
              />
            </n-form-item>
            <n-form-item label="Y(mm)">
              <n-input-number
                :value="draft.doorImgBox.y"
                :min="PS_UI_RANGES.doorImgBoxY.min"
                :max="PS_UI_RANGES.doorImgBoxY.max"
                :step="PS_UI_RANGES.doorImgBoxY.step"
                style="width: 150px"
                @update:value="(v: number | null) => (draft.doorImgBox.y = v as number)"
              />
            </n-form-item>
            <!-- ★ 宽/高是 10–200 **step 1**（不是 0.5），与 X/Y 不同（PS:3616-3706） -->
            <n-form-item label="宽(mm)">
              <n-input-number
                :value="draft.doorImgBox.width"
                :min="PS_UI_RANGES.doorImgBoxWidth.min"
                :max="PS_UI_RANGES.doorImgBoxWidth.max"
                :step="PS_UI_RANGES.doorImgBoxWidth.step"
                style="width: 150px"
                @update:value="(v: number | null) => (draft.doorImgBox.width = v as number)"
              />
            </n-form-item>
            <n-form-item label="高(mm)">
              <n-input-number
                :value="draft.doorImgBox.height"
                :min="PS_UI_RANGES.doorImgBoxHeight.min"
                :max="PS_UI_RANGES.doorImgBoxHeight.max"
                :step="PS_UI_RANGES.doorImgBoxHeight.step"
                style="width: 150px"
                @update:value="(v: number | null) => (draft.doorImgBox.height = v as number)"
              />
            </n-form-item>
          </n-form>
        </div>

        <!-- E. 字段列表 —— 无条件渲染（PS:3730-3905）。行点击 = 选中该字段 -->
        <div :class="L.fieldsTitle" style="margin-top: 10px">字段列表</div>
        <n-data-table
          :data="draft.headerFields"
          :columns="fieldListColumns"
          :row-key="fieldRowKey"
          :row-props="fieldRowProps"
          size="small"
          bordered
          :max-height="240"
          :style="{ width: '100%' }"
        />
        <!-- 门图框开关（PS:3879-3905）—— 按钮在字段列表下方，不在「门图框设置」分组里 -->
        <div style="margin-top: 8px">
          <n-button
            size="small"
            :type="draft.doorImgBox.enabled ? 'success' : 'default'"
            @click="toggleDoorImgBox"
          >
            {{ draft.doorImgBox.enabled ? '门图框已启用' : '启用门图框' }}
          </n-button>
        </div>
      </div>

      <!-- ───────────────────── 右栏：画布（PS:3910-4095） ───────────────────── -->
      <div ref="rightEl" :class="L.editorRight">
        <div :class="L.canvasShell">
          <!-- 点空白取消选中：**没有命中判定**，靠三个子元素的 `onClick.stop` 反向实现（§3.5） -->
          <div :class="L.canvas" :style="canvasStyle" @click="selection = ''">
            <!-- ① 头部字段（PS:3930-4041）——`visible` 才渲染 -->
            <template v-for="f in draft.headerFields" :key="f.key">
              <div
                v-if="f.visible"
                :class="[L.node, { [L.nodeSelected]: selection === 'field' && f.key === selectedKey }]"
                :style="fieldNodeStyle(f)"
                @mousedown="onFieldMouseDown($event, f)"
                @click.stop="select('field', f.key)"
              >
                {{ fieldPreviewText(f) }}
              </div>
            </template>

            <!-- ② 门图框（PS:4042-4067）——`enabled` 才渲染 -->
            <div
              v-if="draft.doorImgBox.enabled"
              :class="[L.doorBox, { [L.nodeSelected]: selection === 'doorImgBox' }]"
              :style="doorBoxStyle"
              @mousedown="onDoorBoxMouseDown"
              @click.stop="select('doorImgBox', '')"
            >
              门图框
            </div>

            <!-- ③ 表格（PS:4068-4095）——`tableAreaStyle` 为 null（表格顶超出可打印区）时整块不渲染 -->
            <div
              v-if="tableAreaStyle"
              :class="[L.tablePreview, { [L.nodeSelected]: selection === 'table' }]"
              :style="tableAreaStyle"
              @mousedown="onTableMouseDown"
              @click.stop="select('table', '')"
              v-html="tablePreviewHtml"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- footer 三颗，顺序与语义照旧版（PS:2946-2982）：取消 / 重置默认 / 保存布局(primary) -->
    <template #footer>
      <div :class="cls.layoutFooter">
        <n-button @click="cancel">取消</n-button>
        <n-button @click="resetDraft">重置默认</n-button>
        <n-button type="primary" @click="saveLayout">保存布局</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, nextTick, ref, watch } from 'vue'
import {
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
  type DataTableColumns,
} from 'naive-ui'

import { PS_LAYOUT_CLASSES } from '../utils/productionsheet/profile'
import { normalizeProductionSheetConfig, PS_UI_RANGES } from '../utils/productionsheet'
import { readFieldValue, renderTable } from '../utils/productionsheet/html'
import type {
  HeaderField,
  ProductionSheetConfig,
  ProductionSheetRow,
  TableColumn,
} from '../utils/productionsheet/types'
import type { ProductionSheetUiProfile } from './productionSheetUiProfile'

/** 画布缩放里的换算常数：**1mm = 3.78px**（96dpi，`PS:681-710` 的 `k/3.78`）。 */
const MM_TO_PX = 3.78

const props = defineProps<{
  show: boolean
  /** 已生效的配置（父组件持有）。弹窗只读它，**打开时**归一化 + 深拷贝一份当草稿。 */
  config: ProductionSheetConfig
  /**
   * 预览行数据（旧版 `m`，`openLayoutEditor` 里取 `props.getData()[0]`，`PS:1378-1385`）。
   * ⚠️ 是**整份行数组**（不是单行）——本弹窗只用第 0 行当样本。
   */
  rows: ProductionSheetRow[]
  /** 本单据的组件层档案 —— 本弹窗只用它的文案、默认配置工厂与落库函数。 */
  profile: ProductionSheetUiProfile
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  /** 保存布局后触发：父组件据此重读配置 + 重渲染主预览（旧版 `_` 末尾的 `refreshPreview()`）。 */
  (e: 'saved'): void
}>()

const showModel = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

/** 布局编辑器的 class 全部来自常量表（**不能**从前缀派生，§0.3）。 */
const L = PS_LAYOUT_CLASSES
const cls = computed(() => props.profile.classes)

/**
 * 全屏（旧版 `el-dialog fullscreen`，`PS:2942`）。Naive 的 `n-modal` 没有 `fullscreen`，
 * 用「铺满视口的卡片 + 内容区不滚动」还原；滚动条在左栏与右栏各自身上，与旧版一致。
 *
 * TODO(未确认): 铺满的观感（卡片圆角/外边距/标题与 footer 的高度）没有对着旧版逐像素比过 ——
 * 左栏那些 `ps-layout-*` 是逐字照抄的，但「卡片外壳」这一层是 Naive 的，不是 el-dialog 的
 * （与 `DocSheetLayoutDialog` 的 TODO 同一条）。
 */
const fullscreenStyle = {
  width: '100vw',
  height: '100vh',
  maxWidth: '100vw',
  borderRadius: '0',
}
const contentStyle = { padding: '12px 16px', overflow: 'hidden' }

/** 旧版 `JSON.parse(JSON.stringify(x))` 的等价物（`PS:1370` / `PS:774`）。 */
function cloneConfig(cfg: ProductionSheetConfig): ProductionSheetConfig {
  return JSON.parse(JSON.stringify(cfg)) as ProductionSheetConfig
}

// ---------------------------------------------------------------------------
// 状态（旧版 `PS:244-252`：`c` 弹窗 / `s` 布局草稿 / `d` 选中 key / `V` 选中类别 / `m` 样本行 / `A` 画布尺寸）
// ---------------------------------------------------------------------------

/** 布局草稿（旧版 `s`）。初值与「重置默认」同源 —— 打开时立刻被覆盖（`PS:1370`）。 */
const draft = ref<ProductionSheetConfig>(props.profile.api.createDefaultConfig())
/** 选中的**字段** key（旧版 `d`）。⚠️ 取消选中只清 `V`、**不清它**（§3.5）。 */
const selectedKey = ref('')
/** 选中的**类别**（旧版 `V`）：`''` / `'field'` / `'table'` / `'doorImgBox'`。 */
const selection = ref<'' | 'field' | 'table' | 'doorImgBox'>('')
/** 样本行（旧版 `m`）—— 画布上的字段文本与表格预览都读它。 */
const sampleRow = ref<ProductionSheetRow | null>(null)

const rightEl = ref<HTMLElement | null>(null)
/** 右栏可用尺寸（旧版 `A`，初值 `{w:800,h:600}`）。**只在打开时量一次**（无 resize 监听）。 */
const canvasSize = ref({ w: 800, h: 600 })

/** 选中的字段对象（旧版 `w` computed，`PS:253-260`）：类别不是 `'field'` 时恒为 `null`。 */
const selectedField = computed<HeaderField | null>(() =>
  selection.value === 'field'
    ? (draft.value.headerFields.find((f) => f.key === selectedKey.value) ?? null)
    : null,
)

/**
 * 选中操作（旧版 `U`，`PS:589` 附近）：写类别，选字段时**顺带**记 key。
 * ⚠️ 传空类别时**不动** `selectedKey` —— 这就是「点空白后上次的字段 key 还在」的来源（§3.5）。
 */
function select(kind: '' | 'field' | 'table' | 'doorImgBox', key: string): void {
  selection.value = kind
  if (kind === 'field') selectedKey.value = key
}

/** `qrcode` / `lockImg` 两个字段是**正方形**（高 = 宽），且没有字号/颜色/换行/行距可改（`PS:3164`）。 */
function isSquareField(key: string): boolean {
  return key === 'qrcode' || key === 'lockImg'
}

// ---------------------------------------------------------------------------
// 画布几何（旧版 `k` / `P` / `I` / `O` / `H` / `S` / `T`，`PS:571-680`）
// ---------------------------------------------------------------------------

/** 旧版 `k`：`min(可用宽 / max(1,纸宽), 可用高 / max(1,纸高))` —— 单位是「1mm 对应多少 px」。 */
const scale = computed(() => {
  const paper = draft.value.paper
  return Math.min(
    canvasSize.value.w / Math.max(1, paper.widthMm),
    canvasSize.value.h / Math.max(1, paper.heightMm),
  )
})

/** 旧版 `P`：白纸本身。★ `Math.max(120, …)` 下限照抄，别去掉。 */
const canvasStyle = computed(() => {
  const paper = draft.value.paper
  const k = scale.value
  return {
    width: Math.max(120, paper.widthMm * k) + 'px',
    height: Math.max(120, paper.heightMm * k) + 'px',
    padding: paper.paddingMm * k + 'px',
  }
})

/**
 * 旧版 `I(e)`（`PS:589-608`）：单个字段节点的绝对定位样式。
 *
 * ★ 高度：`qrcode`/`lockImg` → `field.width * k`（**正方形**）；否则 `wrap ? "auto" : 字号px + 2`。
 * ★ 字号换算 `pt → px` 是 **0.3528**，下限 `max(7, …)`。
 */
function fieldNodeStyle(f: HeaderField): Record<string, string> {
  const k = scale.value
  const fontSizePx = Math.max(7, 0.3528 * f.fontSize * k)
  const height = isSquareField(f.key)
    ? f.width * k + 'px'
    : f.wrap
      ? 'auto'
      : fontSizePx + 2 + 'px'
  return {
    left: f.x * k + 'px',
    top: f.y * k + 'px',
    width: Math.max(8, f.width * k) + 'px',
    height,
    fontSize: fontSizePx + 'px',
    fontWeight: f.fontWeight,
    color: f.fontColor,
    lineHeight: '1',
    overflow: f.wrap ? 'visible' : 'hidden',
    whiteSpace: f.wrap ? 'normal' : 'nowrap',
    wordBreak: f.wrap ? 'break-all' : 'normal',
  }
}

/**
 * 旧版 `W(e)`（`PS:636-648`）：画布上的**预览文本**（不是打印产物）。
 * 无样本行 → `label`；`qrcode` → `"QR"`；`lockImg` → `"锁图"`；其余取真值 → `prefix + 值`，假值 → `label`。
 */
function fieldPreviewText(f: HeaderField): string {
  const row = sampleRow.value
  if (!row) return f.label
  if (f.key === 'qrcode') return 'QR'
  if (f.key === 'lockImg') return '锁图'
  const v = readFieldValue(row, f.key)
  return v ? f.prefix + v : f.label
}

/** 旧版 `O`（`PS:660-680` 之前的一段）：门图框样式 —— 纯 `x/y/width/height * k`，无下限。 */
const doorBoxStyle = computed(() => {
  const k = scale.value
  const box = draft.value.doorImgBox
  return {
    left: box.x * k + 'px',
    top: box.y * k + 'px',
    width: box.width * k + 'px',
    height: box.height * k + 'px',
  }
})

/**
 * 旧版 `S`（`PS:613-619`）：表格的**自动 Y 位置** = 可见字段的最大 `y` + 12；**全不可见时返回 45**。
 *
 * ⚠️ 这个「空数组 → 45」的分支**只有布局编辑器有**；核心层的分页（`build.ts`）里没照抄，
 * 那边是旧版的一处不一致/缺陷（§9.1）。这里保持与 `PS:613-619` 一致。
 */
const autoTableTopMm = computed(() => {
  const visible = draft.value.headerFields.filter((f) => f.visible)
  return visible.length === 0 ? 45 : Math.max(...visible.map((f) => f.y)) + 12
})

/** 旧版 `T`（`PS:620-630`）：**可写 computed** —— 草稿里 `-1` 是「自动」哨兵。 */
const tableTopMm = computed({
  get: () =>
    draft.value.tableConfig.tableTopMm < 0 ? autoTableTopMm.value : draft.value.tableConfig.tableTopMm,
  set: (v: number) => {
    draft.value.tableConfig.tableTopMm = v
  },
})

/**
 * 旧版 `H`（`PS:660-680`）：表格预览区的样式；**表格顶超出可打印区时返回 `null` ⇒ 整块不渲染**。
 * ⚠️ 与核心层 `renderSheet` 不同 —— 那里表格不渲染时页还在，这里连预览框都没有。
 */
const tableAreaStyle = computed<Record<string, string> | null>(() => {
  const k = scale.value
  const paper = draft.value.paper
  const top = tableTopMm.value
  if (top >= paper.heightMm - paper.paddingMm) return null
  const totalWidth = draft.value.tableConfig.columns
    .filter((c) => c.visible)
    .reduce((sum, c) => sum + c.width, 0)
  return {
    position: 'absolute',
    left: paper.paddingMm * k + 'px',
    top: top * k + 'px',
    width: Math.max(10, totalWidth * k) + 'px',
    height: Math.max(10, (paper.heightMm - paper.paddingMm - top) * k) + 'px',
  }
})

/**
 * 旧版 `G`（`PS:681-710`）：表格预览的 `innerHTML` —— **先 `$` 出表格串，再外套一层缩放 div**。
 *
 * ★ `k / 3.78` 是「画布缩放系数 ÷ 1mm 的 px 数」，与 C 家族的 `MM_TO_PX` 是同一个 3.78。
 * ★ 列宽和**取不到（=0）时**回退到 `纸宽 - 2×边距`（`||` 不是 `??`，§2.3 的「正好相等」）。
 */
const tablePreviewHtml = computed(() => {
  const row = sampleRow.value
  if (!row?.oldSheet || !Array.isArray(row.oldSheet) || row.oldSheet.length === 0) {
    // PS:683-688 —— 无数据占位（**不是**空表格）
    return '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#999;font-size:11px;">表格区域（无数据）</div>'
  }
  const table = renderTable(row.oldSheet, draft.value)
  if (!table) return ''
  const shrunk = scale.value / MM_TO_PX
  const totalWidth =
    draft.value.tableConfig.columns
      .filter((c) => c.visible)
      .reduce((sum, c) => sum + c.width, 0) ||
    draft.value.paper.widthMm - 2 * draft.value.paper.paddingMm
  return (
    '<div style="transform-origin:top left;transform:scale(' +
    shrunk +
    ');width:' +
    MM_TO_PX * totalWidth +
    'px;font-size:' +
    draft.value.tableConfig.tableFontSize +
    'pt;">' +
    table +
    '</div>'
  )
})

/**
 * 旧版 `L` 的等价物（`PS:1380-1392`）：量右栏可用尺寸 = `clientWidth/Height - 32`
 * （32 = `.ps-layout-canvas-shell` 的 `padding:16px` ×2）。
 *
 * ★ 兜底是 `max(600, innerWidth - **440**)` —— PS 是 **440**，与 C 家族的 500 **不同**
 *   （§骨架 §2.1 的对照表；`PS:1390` CONFIRMED）。别"顺手统一"。
 * ⚠️ **只在打开时量一次**，没有 resize 监听（`PS` 全文 `resize` 零命中，§3.1 CONFIRMED）。
 */
function measureContainer(): void {
  const el = rightEl.value
  if (el) {
    canvasSize.value = { w: el.clientWidth - 32, h: el.clientHeight - 32 }
  } else {
    canvasSize.value = {
      w: Math.max(600, window.innerWidth - 440),
      h: Math.max(400, window.innerHeight - 200),
    }
  }
}

// ---------------------------------------------------------------------------
// ★ 三套拖拽（§3.4 CONFIRMED）—— 全部写**草稿**、全部 0.5mm 吸附、mouseup 只摘监听
// ---------------------------------------------------------------------------

/** 共同的吸附：`Math.round(2 * v) / 2` = 0.5mm（三套逐字一致）。 */
function snap(value: number): number {
  return Math.round(2 * value) / 2
}

/**
 * ① 表格拖拽（旧版 `j`，`PS:711-736`）—— **只拖 Y**。
 *
 * `preventDefault + stopPropagation` → 选中表格 → 快照 `clientY` / `T.value` / `k`；
 * move：`round2(起点 + ΔclientY/k)`，clamp `[0, heightMm − paddingMm − 10]`，
 * 写 `draft.tableConfig.tableTopMm`。
 */
function onTableMouseDown(e: MouseEvent): void {
  e.preventDefault()
  e.stopPropagation()
  select('table', '')

  const startY = e.clientY
  const startTop = tableTopMm.value
  const k = scale.value
  const paper = draft.value.paper

  const onMove = (ev: MouseEvent) => {
    let next = startTop + (ev.clientY - startY) / k
    next = snap(next)
    next = Math.max(0, Math.min(paper.heightMm - paper.paddingMm - 10, next))
    draft.value.tableConfig.tableTopMm = next
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

/**
 * ② 门图框拖拽（旧版 `q`，`PS:737-767`）—— **两个方向**。
 *
 * clamp 减的是**门图框自身的宽/高**（与字段拖拽只减 1 不同，§3.4 的 ⚠️）。
 */
function onDoorBoxMouseDown(e: MouseEvent): void {
  e.preventDefault()
  e.stopPropagation()
  select('doorImgBox', '')

  const startX = e.clientX
  const startY = e.clientY
  const box = draft.value.doorImgBox
  const originX = box.x
  const originY = box.y
  const k = scale.value
  const paper = draft.value.paper

  const onMove = (ev: MouseEvent) => {
    let nextX = snap(originX + (ev.clientX - startX) / k)
    let nextY = snap(originY + (ev.clientY - startY) / k)
    nextX = Math.max(0, Math.min(paper.widthMm - box.width, nextX))
    nextY = Math.max(0, Math.min(paper.heightMm - box.height, nextY))
    box.x = nextX
    box.y = nextY
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

/**
 * ③ 头部字段拖拽（旧版 `PS:3957-4022` 的内联 IIFE）。
 *
 * ⚠️ 两处**别"顺手补齐"**（§3.4 的 ⚠️⚠️）：
 *   · 只 `preventDefault`，**没有 `stopPropagation`**（①② 都调了）；
 *   · clamp 的上界是 `widthMm − 1` / `heightMm − 1`，**不减字段自身的宽/高**。
 * 行为上没问题的理由：画布的取消选中挂在 **`click`**（不是 mousedown），而字段自身的
 * `@click.stop` 会把它拦掉。
 *
 * ⚠️ 写的是 `renderList` 传进来的那个**响应式字段对象**（`draft.headerFields[i]`），不是它的副本。
 */
function onFieldMouseDown(e: MouseEvent, field: HeaderField): void {
  e.preventDefault()

  const startX = e.clientX
  const startY = e.clientY
  const originX = field.x
  const originY = field.y
  const k = scale.value
  const paper = draft.value.paper

  const onMove = (ev: MouseEvent) => {
    let nextX = snap(originX + (ev.clientX - startX) / k)
    let nextY = snap(originY + (ev.clientY - startY) / k)
    nextX = Math.max(0, Math.min(paper.widthMm - 1, nextX))
    nextY = Math.max(0, Math.min(paper.heightMm - 1, nextY))
    field.x = nextX
    field.y = nextY
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

/** 旧版 `Y`（`PS:631-635`）：翻转门图框开关；**置真时顺带选中它**。 */
function toggleDoorImgBox(): void {
  draft.value.doorImgBox.enabled = !draft.value.doorImgBox.enabled
  if (draft.value.doorImgBox.enabled) select('doorImgBox', '')
}

// ---------------------------------------------------------------------------
// 左栏两张表（列宽设置 / 字段列表）
// ---------------------------------------------------------------------------

const FONT_WEIGHT_OPTIONS = [
  { label: '正常', value: 'normal' },
  { label: '加粗', value: 'bold' },
]

const columnRowKey = (row: TableColumn): string => row.key
const fieldRowKey = (row: HeaderField): string => row.key

/**
 * 字段列表的整行点击 = 选中该字段（旧版 `onRowClick: e => U("field", e.key)`，`PS:3730-3745`）。
 * Naive 用 `row-props` 承接；`highlight-current-row` 的观感用行 class 还原。
 */
function fieldRowProps(row: HeaderField): Record<string, unknown> {
  return {
    style: 'cursor:pointer',
    class: selection.value === 'field' && row.key === selectedKey.value ? 'ps1-row-current' : '',
    onClick: () => select('field', row.key),
  }
}

/**
 * ⚠️ 单元格里的 InputNumber / Checkbox 都带 `@click.stop`（旧版是 `.stop` 修饰符），
 * 否则点它们会顺带触发整行点击 ⇒ 选中跳回该行。照抄。
 */
function stopClick(e: MouseEvent): void {
  e.stopPropagation()
}

/** 列宽设置表（`PS:3486-3570`）：`显`(36) / `列名`(70，只读) / `宽(mm)`(80，**step 1**)。 */
const columnWidthColumns = computed<DataTableColumns<TableColumn>>(() => [
  {
    title: '显',
    key: 'visible',
    width: 36,
    render: (row) =>
      h(NCheckbox, {
        checked: row.visible,
        'onUpdate:checked': (v: boolean) => {
          row.visible = v
        },
      }),
  },
  { title: '列名', key: 'label', width: 70 },
  {
    title: '宽(mm)',
    key: 'width',
    width: 80,
    render: (row) =>
      h(NInputNumber, {
        value: row.width,
        min: PS_UI_RANGES.columnWidth.min,
        max: PS_UI_RANGES.columnWidth.max,
        step: PS_UI_RANGES.columnWidth.step,
        size: 'small',
        style: 'width:100%',
        'onUpdate:value': (v: number | null) => {
          row.width = v as number
        },
      }),
  },
])

/**
 * 字段列表 5 列（`PS:3730-3905`）：`显`(36) / `字段`(50，只读) / `X`(68) / `Y`(68) / `宽`(68)。
 *
 * ⚠️ 旧版这三个 InputNumber 都带 `controls-position:"right"` —— Naive 的加减按钮本来就固定在右侧
 * （`:show-button` 默认 true），观感一致，不做等价处理（与 `DocSheetLayoutDialog` 同一处置）。
 */
const fieldListColumns = computed<DataTableColumns<HeaderField>>(() => [
  {
    title: '显',
    key: 'visible',
    width: 36,
    render: (row) =>
      h(NCheckbox, {
        checked: row.visible,
        onClick: stopClick,
        'onUpdate:checked': (v: boolean) => {
          row.visible = v
        },
      }),
  },
  { title: '字段', key: 'label', width: 50 },
  {
    title: 'X',
    key: 'x',
    width: 68,
    render: (row) =>
      h(NInputNumber, {
        value: row.x,
        min: PS_UI_RANGES.listFieldX.min,
        max: PS_UI_RANGES.listFieldX.max,
        step: PS_UI_RANGES.listFieldX.step,
        size: 'small',
        style: 'width:100%',
        onClick: stopClick,
        'onUpdate:value': (v: number | null) => {
          row.x = v as number
        },
      }),
  },
  {
    title: 'Y',
    key: 'y',
    width: 68,
    render: (row) =>
      h(NInputNumber, {
        value: row.y,
        min: PS_UI_RANGES.listFieldY.min,
        max: PS_UI_RANGES.listFieldY.max,
        step: PS_UI_RANGES.listFieldY.step,
        size: 'small',
        style: 'width:100%',
        onClick: stopClick,
        'onUpdate:value': (v: number | null) => {
          row.y = v as number
        },
      }),
  },
  {
    title: '宽',
    key: 'width',
    width: 68,
    render: (row) =>
      h(NInputNumber, {
        value: row.width,
        min: PS_UI_RANGES.listFieldWidth.min,
        max: PS_UI_RANGES.listFieldWidth.max,
        step: PS_UI_RANGES.listFieldWidth.step,
        size: 'small',
        style: 'width:100%',
        onClick: stopClick,
        'onUpdate:value': (v: number | null) => {
          row.width = v as number
        },
      }),
  },
])

// ---------------------------------------------------------------------------
// 打开 / 保存 / 取消 / 重置（旧版 `PS:768-778` / `PS:1367-1392`）
// ---------------------------------------------------------------------------

/**
 * 旧版 `openLayoutEditor`（`PS:1367-1392`）：
 * `s = normalize(clone(r))` → `d = headerFields[0].key || ""` → `V = "field"`
 * → `m = getData()[0] ?? null` → 显示 → `await nextTick()` → 量右栏。
 *
 * ★ **两端都归一化**（打开与保存），与 QL 同族、与 PS2/GS2（纯深拷贝）不同（§骨架 §2.2 CONFIRMED）。
 * ★ 打开时**默认选中第一个字段、且类别是 `'field'`** —— 照抄（不是空选中）。
 */
watch(
  () => props.show,
  async (open) => {
    if (!open) return
    draft.value = normalizeProductionSheetConfig(cloneConfig(props.config))
    selectedKey.value = draft.value.headerFields[0]?.key || ''
    selection.value = 'field'
    sampleRow.value = props.rows.length > 0 ? props.rows[0] : null
    await nextTick()
    measureContainer()
  },
)

/** 「重置默认」（旧版 `J`，`PS:768`）：**只重置草稿** —— 不写盘、不关窗、不刷预览。 */
function resetDraft(): void {
  draft.value = props.profile.api.createDefaultConfig()
}

/** 「取消」：只关窗（生效值从未被改过，无需回滚）。 */
function cancel(): void {
  showModel.value = false
}

/**
 * 「保存布局」（旧版 `_`，`PS:771-778`）：
 * `r = normalize(clone(s))` → 落库 → 关窗 →（若预览打开）刷新。
 *
 * ⚠️ 旧版这里**有** `isActive()` 守卫（§7 末段的更正：骨架报告写的「PS 保存后无条件刷」与源码不符）。
 * 新版把「预览是否打开」交给父组件（抽屉恒有预览）⇒ 直接 emit `saved`，等价。
 */
function saveLayout(): void {
  const saved = normalizeProductionSheetConfig(cloneConfig(draft.value))
  props.profile.api.saveConfig(saved)
  draft.value = cloneConfig(saved)
  showModel.value = false
  emit('saved')
}
</script>

<style scoped>
/*
  ─────────────────────── 编辑器专属 CSS ───────────────────────
  逐字来自 `docs/custom-docs-recon/ps-layout.css`（PS 的 11+2 条 `ps-layout-*` 规则，
  抽自 `legacy/css/Home-97d96482.css`，原选择器都带 `data-v-c55c9cb3`）。
  ⚠️ 那个 `data-v-*` 是 Vue 的 scope 属性，**不抄进来** —— 本组件用 `<style scoped>`
  让 Vue 自己加（编译成 `[data-v-<本组件>]`），语义相同。

  ⚠️ 这些 class **不是** `profile.classes`，是常量表 `PS_LAYOUT_CLASSES` 里的字面量 ——
  所以这里可以**直接写死选择器**，不需要像 C 家族那样「把所有前缀并列」。
*/
.ps-layout-editor-wrap {
  display: flex;
  gap: 12px;
  height: calc(100vh - 160px);
  overflow: hidden;
}
.ps-layout-editor-left {
  width: 380px;
  min-width: 380px;
  border-right: 1px solid #eee;
  padding-right: 10px;
  overflow-y: auto;
}
.ps-layout-editor-right {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ps-layout-fields-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}
.ps-layout-field-editor {
  margin-top: 10px;
  border-top: 1px dashed #ddd;
  padding-top: 8px;
}
.ps-layout-canvas-shell {
  background: #e5e7eb;
  padding: 16px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}
.ps-layout-canvas {
  position: relative;
  background: #fff;
  box-sizing: border-box;
  box-shadow: 0 2px 10px #0003;
  overflow: hidden;
}
.ps-layout-node {
  position: absolute;
  border: 1px dashed #409eff;
  background: rgba(64, 158, 255, 0.1);
  color: #1f2937;
  padding: 0 2px;
  cursor: move;
  user-select: none;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  box-sizing: border-box;
}
.ps-layout-node-selected {
  border-color: #f56c6c;
  background: rgba(245, 108, 108, 0.15);
}
.ps-layout-door-box {
  position: absolute;
  border: 2px dashed #67c23a;
  background: rgba(103, 194, 58, 0.08);
  color: #67c23a;
  cursor: move;
  user-select: none;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.ps-layout-door-box.ps-layout-node-selected {
  border-color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}
.ps-layout-table-preview {
  position: absolute;
  border: 1px dashed #909399;
  background: transparent;
  color: #1f2937;
  font-size: 11px;
  overflow: hidden;
  cursor: ns-resize;
  box-sizing: border-box;
}
.ps-layout-table-preview.ps-layout-node-selected {
  border-color: #e6a23c;
  border-width: 2px;
}

/*
  以下是**新版自己的排版胶水**，不在上面那份 CSS 里：footer 三颗按钮的右对齐行、
  以及字段列表「当前行」的高亮（旧版用 el-table 的 `highlight-current-row`，
  Naive 没有等价属性，用行 class 还原 —— 纯观感，不影响任何产物）。
*/
.ps1-layout-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* `:deep` —— 这一行是 `n-data-table` 的 `row-props` 产出的，不是本组件的模板元素 */
:deep(.ps1-row-current) td {
  background-color: #f0f7ff;
}
</style>
