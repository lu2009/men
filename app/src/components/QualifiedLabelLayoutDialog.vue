<!--
  「自定义合格标签」· **布局编辑**弹窗（旧版 `QualifiedLabelPrintManager.openLayoutEditor`，`ic=13`）。

  逆向定稿：`docs/custom-docs-recon/01-ql.md` §3（§3.1 容器与 class / §3.2 左栏控件 + §3.5 右栏 /
  §3.3「整体自适应」/ §3.4 拖拽）；逐字 scoped CSS 见 `docs/custom-docs-recon/ql-scoped.css`。

  ⚠️⚠️ **本弹窗与另外三张**（C 家族的 `DocSheetLayoutDialog.vue` 全屏、B 家族的
  `ProductionSheetLayoutDialog.vue`）**不是同一族**，四处结构性差异：
    1. **980px 浮层**，不是全屏（设置弹窗 640px，其余三张都是全屏/大卡片）；
    2. class 是**裸的** `layout-editor-*` / `layout-canvas*` / `layout-node*`
       （`QL_LAYOUT_CLASSES`），**不从任何前缀派生**、也不与产出 HTML 的
       `qlabel-root`/`qlabel`/`qfield` 共用前缀体系；
    3. **没有分页、没有预览表** —— 右栏画布上画的是**字段框**（每字段一个绝对定位 div，
       内容是 `field.label` 或字面量「二维码」），**不是真实数据的渲染结果**
       （旧版全文没有把样本数据画进画布的逻辑）；
    4. **只有 1 套拖拽**（画布字段拖拽，写**草稿**），见下。

  **草稿 / 生效 成对**（§1.1 的 `d` 草稿 / `r` 生效）：
  · 打开 = `draft = 归一化(深拷贝(生效))`（`QL:914`，★ 旧版**打开时也归一化**）；
  · 「重置默认」= **只重置草稿**（`d = a()` + 回读批量值，`QL:709-710`），不写盘、不关窗；
  · 「保存布局」= `生效 = 归一化(深拷贝(草稿))` → 落库 → 关窗 → 刷预览（`QL:711-716`）；
  · 「取消」= 直接关窗（生效值全程没被碰过，不需要回滚）。

  ⚠️ 与**设置弹窗共用同一个 localStorage 键**（`qualified_label_template_v2`）——
  两个弹窗可以同时开着，谁后保存谁生效（旧版「打开设置弹窗」不关布局弹窗）。

  ⚠️⚠️ **一处有意偏离（唯一一处，且只加不减）**：旧版这 13 条 scoped CSS **全部带
  `[data-v-1b2a6816]`**，而画布节点、字段框都是**模板元素**（不是 `v-html` 注入的），
  所以那些规则在旧版里**是生效的** —— 本条与 C 家族「预览在 innerHTML 里、规则死了」不同。
  新版用 `<style scoped>`，Vue 自己给模板元素加 scope 属性，**语义等价**，
  所以这次**不迁移任何 `:deep()`**（C 家族那三条是另一回事）。

  ⚠️ **3 条死规则不实现**（§3.1 CONFIRMED，`QL` 全文 `grep -c` = 0）：
  `layout-fields-list` / `layout-field-item` / `layout-field-item.active` —— 本单的字段列表走
  `el-table`（右栏），不是自定义列表，那三条是从别处抄来的残留。

  ⚠️ **不做「就地编辑」四件套**（`enterEditMode`/`exitEditMode`/`toggleEditMode`/`isEditMode`，
  §7 / §10.1 D2）：Home 全文**零调用点**、且四个名字**不在任何一张字符串表里** ⇒ 彻底的死 API。
  注意别与**本弹窗的拖拽**搞混 —— 那套拖拽改的是**生效配置并立刻落库**，
  本弹窗的拖拽改的是**草稿**（§3.4 的对照表）。
-->
<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="profile.text.layoutTitle"
    :bordered="false"
    display-directive="show"
    style="width: 980px"
  >
    <div :class="C.editorWrap">
      <!-- ───────────────────────── 左栏（`QL:1972-2760`，两条 scoped CSS 定宽 280px） ───────────────────────── -->
      <div :class="C.editorLeft">
        <!--
          第一组：**裸 el-form**（`QL:1972`，`label-width:98px size:small`，**没有分组标题**
          —— 与 C 家族那个「纸张 / 表格全局 / 各列设置」的三段式不同）。
        -->
        <n-form label-placement="left" :label-width="98" size="small">
          <n-form-item label="纸张宽(mm)">
            <n-input-number
              :value="draft.paper.widthMm"
              :min="PAPER_UI_RANGES.widthMm.min"
              :max="PAPER_UI_RANGES.widthMm.max"
              :step="PAPER_UI_RANGES.widthMm.step"
              @update:value="(v: number | null) => (draft.paper.widthMm = v as number)"
            />
          </n-form-item>
          <n-form-item label="纸张高(mm)">
            <n-input-number
              :value="draft.paper.heightMm"
              :min="PAPER_UI_RANGES.heightMm.min"
              :max="PAPER_UI_RANGES.heightMm.max"
              :step="PAPER_UI_RANGES.heightMm.step"
              @update:value="(v: number | null) => (draft.paper.heightMm = v as number)"
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
            默认字号 + 「应用到全部」（`QL:2058` / `QL:2099`）。
            ★ `applyToAllFontSize` **排除 `qrcode` 与 `package`**（§2.5 / §10.3 #1）——
            不排除会把包装行从 10pt 撑成 16.5pt。语义在核心层 `layout.ts` 里逐字钉死。
          -->
          <n-form-item label="默认字号(pt)">
            <n-input-number
              :value="draft.globalFont.fontSize"
              :min="GLOBAL_FONT_SIZE_UI_RANGE.min"
              :max="GLOBAL_FONT_SIZE_UI_RANGE.max"
              :step="GLOBAL_FONT_SIZE_UI_RANGE.step"
              @update:value="(v: number | null) => (draft.globalFont.fontSize = v as number)"
            />
            <!-- 旧版这颗按钮带 `style="margin-left:4px"`，照抄 -->
            <n-button size="small" style="margin-left: 4px" @click="onApplyToAll">应用到全部</n-button>
          </n-form-item>

          <!--
            字段宽度 + 「适应纸张宽度」（`QL:2103-2140`）。button 是 `size:"small" type:"info"`，
            后面跟一个灰字 `(宽-边距×2)`（`margin-left:4px; font-size:11px; color:#999`）。
            ⚠️ 旧版这一行**没有可输入的控件** —— label 叫「字段宽度」，但右侧只有按钮与说明。
            ⚠️ `fitPaperWidth` **只排除 `qrcode`**（`package` 会被改宽，与上一行不同）。
          -->
          <n-form-item label="字段宽度">
            <n-button size="small" type="info" @click="onFitPaperWidth">适应纸张宽度</n-button>
            <span class="hint-inline">(宽-边距×2)</span>
          </n-form-item>

          <!--
            默认粗细（`QL:2144`，下拉 `style:{width:"140px"}`）。
            ★ **没有「应用到全部粗细」的按钮** —— `globalFont.fontWeight` 只写 `<section>`，
            字段的粗细只能逐个在右栏/下方字段面板里改（§2.5）。
          -->
          <n-form-item label="默认粗细">
            <n-select
              :value="draft.globalFont.fontWeight"
              :options="fontWeightOptions"
              style="width: 140px"
              @update:value="(v: 'normal' | 'bold') => (draft.globalFont.fontWeight = v)"
            />
          </n-form-item>

          <n-form-item label="自动隐藏空">
            <n-switch
              :value="draft.autoHideEmpty"
              @update:value="(v: boolean) => (draft.autoHideEmpty = v)"
            />
          </n-form-item>

          <!--
            打印旋转 90°（`QL:2206`）。★ 它是**真开关**（§2.4 / §10.1 D3）：
            消费者是 CSS 的 `@page size` 交换 + `transform:rotate(-90deg)`（`css.ts`）。
            ⚠️ **`printDirect` 的 iframe 尺寸不旋转**（仍用 widthMm×heightMm，靠 CSS 自己转）。
          -->
          <n-form-item label="打印旋转90°">
            <n-switch
              :value="draft.paper.printRotate90"
              @update:value="(v: boolean) => (draft.paper.printRotate90 = v)"
            />
            <span class="hint-inline" style="margin-left: 6px">布局60×90→打印输出到90×60纸</span>
          </n-form-item>
        </n-form>

        <!--
          第二组：**字段设置：{label}**（`QL:2245`，`layout-field-editor` 面板，仅当有选中字段）。
          ⚠️ 面板 class 与下面第三组**共用同一个 `layout-field-editor`**（旧版就是复用，
          别给它编第二个名字）。
          ⚠️ `X/Y/宽` **对 qrcode 也显示**；其余 6 项带 `key !== "qrcode"` 条件。
          ⚠️ **没有 `height` / `visible` / `label` 输入框**（§2.3 / §3.2 的 ⚠️）——
          `visible` 只能在右栏勾，`label` 段内没有改的入口。
        -->
        <div v-if="selectedField" :class="C.fieldEditor">
          <div :class="C.fieldsTitle">字段设置：{{ selectedField.label }}</div>
          <n-form label-placement="left" :label-width="98" size="small">
            <n-form-item label="X(mm)">
              <n-input-number
                :value="selectedField.x"
                :min="FIELD_UI_RANGES.x.min"
                :max="FIELD_UI_RANGES.x.max"
                :step="FIELD_UI_RANGES.x.step"
                @update:value="(v: number | null) => setFieldNumber('x', v)"
              />
            </n-form-item>
            <n-form-item label="Y(mm)">
              <n-input-number
                :value="selectedField.y"
                :min="FIELD_UI_RANGES.y.min"
                :max="FIELD_UI_RANGES.y.max"
                :step="FIELD_UI_RANGES.y.step"
                @update:value="(v: number | null) => setFieldNumber('y', v)"
              />
            </n-form-item>
            <!--
              ★ **本处 `宽(mm)` 的下限是 4** —— 右栏字段表是 1、清洗 clamp 也是 1。
              三处不一致是旧版事实（§3.2 的 ⚠️ / §10.3），`FIELD_UI_RANGES` 与
              `FIELD_TABLE_UI_RANGES` 两个常量就是为了让这处刻意的不一致显式可见。**照抄。**
            -->
            <n-form-item label="宽(mm)">
              <n-input-number
                :value="selectedField.width"
                :min="FIELD_UI_RANGES.width.min"
                :max="FIELD_UI_RANGES.width.max"
                :step="FIELD_UI_RANGES.width.step"
                @update:value="(v: number | null) => setFieldNumber('width', v)"
              />
            </n-form-item>

            <template v-if="selectedField.key !== 'qrcode'">
              <n-form-item label="字号(pt)">
                <n-input-number
                  :value="selectedField.fontSize"
                  :min="FIELD_UI_RANGES.fontSize.min"
                  :max="FIELD_UI_RANGES.fontSize.max"
                  :step="FIELD_UI_RANGES.fontSize.step"
                  @update:value="(v: number | null) => setFieldNumber('fontSize', v)"
                />
              </n-form-item>
              <n-form-item label="粗细">
                <n-select
                  :value="selectedField.fontWeight"
                  :options="fontWeightOptions"
                  @update:value="(v: 'normal' | 'bold') => setFieldString('fontWeight', v)"
                />
              </n-form-item>
              <n-form-item label="换行">
                <n-switch
                  :value="selectedField.wrap"
                  @update:value="(v: boolean) => setFieldBoolean('wrap', v)"
                />
              </n-form-item>
              <!-- `最多行数` 仅 `wrap === true` 时出现（`QL:2438` 的 v-if） -->
              <n-form-item v-if="selectedField.wrap" label="最多行数">
                <n-input-number
                  :value="selectedField.maxLines"
                  :min="FIELD_UI_RANGES.maxLines.min"
                  :max="FIELD_UI_RANGES.maxLines.max"
                  :step="FIELD_UI_RANGES.maxLines.step"
                  @update:value="(v: number | null) => setFieldNumber('maxLines', v)"
                />
              </n-form-item>
              <!-- 左栏这三个下拉是**长标签**（左对齐/居中/右对齐）；右栏表格里是短标签（左/中/右） -->
              <n-form-item label="对齐">
                <n-select
                  :value="selectedField.textAlign"
                  :options="textAlignLongOptions"
                  @update:value="(v: 'left' | 'center' | 'right') => setFieldString('textAlign', v)"
                />
              </n-form-item>
              <n-form-item label="显示前缀">
                <n-switch
                  :value="selectedField.showPrefix"
                  @update:value="(v: boolean) => setFieldBoolean('showPrefix', v)"
                />
              </n-form-item>
            </template>
          </n-form>
        </div>

        <!--
          第三组：**快捷批量调整**（`QL:2546`，同样用 `layout-field-editor` 面板，
          form 的 `label-width` 是 **88px** —— 与上面那组的 98px 不同，照抄）。
        -->
        <div :class="C.fieldEditor">
          <div :class="C.fieldsTitle">快捷批量调整</div>
          <n-form label-placement="left" :label-width="88" size="small">
            <!--
              ★★ **整体自适应**（`QL:459-478`）—— ⚠️ **不是「按当前版式缩放」**！
              它的基准**恒为出厂的 70×90 版式**（函数内部 `createDefaultConfig()`），
              语义是「把 70×90 的出厂版式按新纸张**重铺一遍**」，
              ⇒ **用户之前的所有手工调整会被覆盖**。UI 提示语「基准 70×90mm」是准确的。
              三处不直观但都是旧版事实（`layout.ts` 的 `autoFitFields` 头注逐条列了）：
              `x/y/width` 各按**自己轴的比值**（非等比）、`height` 完全不缩放、
              `fontSize` 取到 **0.5** 而 `x/y/width` 取到 0.1。
            -->
            <n-form-item label="整体自适应">
              <n-button type="warning" size="small" @click="onAutoFit">按当前纸张比例</n-button>
              <span class="hint-inline" style="margin-left: 4px">基准 70×90mm</span>
            </n-form-item>
            <n-form-item label="正文字号(pt)">
              <n-input-number
                v-model:value="batch.fontSize"
                :min="BATCH_UI_RANGES.fontSize.min"
                :max="BATCH_UI_RANGES.fontSize.max"
                :step="BATCH_UI_RANGES.fontSize.step"
                @update:value="onBatchFontSize"
              />
            </n-form-item>
            <n-form-item label="正文行宽(mm)">
              <n-input-number
                v-model:value="batch.bodyWidth"
                :min="BATCH_UI_RANGES.bodyWidth.min"
                :max="BATCH_UI_RANGES.bodyWidth.max"
                :step="BATCH_UI_RANGES.bodyWidth.step"
                @update:value="onBatchBodyWidth"
              />
            </n-form-item>
            <n-form-item label="客户/单号宽">
              <n-input-number
                v-model:value="batch.orderWidth"
                :min="BATCH_UI_RANGES.orderWidth.min"
                :max="BATCH_UI_RANGES.orderWidth.max"
                :step="BATCH_UI_RANGES.orderWidth.step"
                @update:value="onBatchOrderWidth"
              />
            </n-form-item>
          </n-form>
        </div>
      </div>

      <!-- ───────────────────────── 右栏：画布 + 字段表（`QL:2740-3110`） ───────────────────────── -->
      <div :class="C.editorRight">
        <div :class="C.canvasShell">
          <div :class="C.canvas" :style="canvasStyle">
            <!--
              每个 `visible` 字段一个绝对定位 div。内容是 `qrcode` → 字面量「二维码」，
              其余 → `field.label`（**不是真实数据**，见文件头注第 3 条）。
              ★ `mousedown` 启拖拽（§3.4 左列）：写**草稿**、不落库、不刷预览。
            -->
            <template v-for="f in draft.fields" :key="f.key">
              <div
                v-if="f.visible"
                :class="[C.node, f.key === 'qrcode' ? C.nodeQr : C.nodeText]"
                :style="nodeStyle(f)"
                @mousedown="(e: MouseEvent) => startDrag(e, f)"
              >
                {{ f.key === 'qrcode' ? '二维码' : f.label }}
              </div>
            </template>
          </div>
        </div>

        <!-- 灰标题。⚠️ 与左栏「字段设置：X」**同一个 class**，这一份带 `margin-top:0` -->
        <div :class="C.fieldsTitle" style="margin-top: 0">字段列表（点击行选中可调位置）</div>

        <!--
          9 列字段表（§3.5）。⚠️ 与 C 家族那张「各列设置」不是一回事：
          · **没有 ↑/↓ 排序、没有增删字段** —— 字段集与顺序**恒为默认那 11 条**
            （清洗按 key 合并，见 `sanitize.ts`）；
          · 「字段」列是**只读**的 `row.label`；
          · `宽(mm)` 的下限在这里是 **1**（左栏是 4）。
          ⚠️ 后 4 列的「非 qrcode」条件在**单元格内**（旧版是 cell render 里的三元），
          **不是列级 v-if** —— 所以列标题恒在、qrcode 行的那几格是空的。
        -->
        <n-data-table
          :data="draft.fields"
          :columns="fieldTableColumns"
          :row-key="fieldRowKey"
          :row-props="fieldRowProps"
          :row-class-name="fieldRowClassName"
          size="small"
          bordered
          :style="{ width: '100%' }"
        />
      </div>
    </div>

    <!-- footer 三颗，顺序与语义照旧版（`QL:1930-1963`）：取消 / 重置默认 / 保存布局(primary) -->
    <template #footer>
      <div class="ql-layout-footer">
        <n-button @click="cancel">取消</n-button>
        <n-button @click="resetDraft">重置默认</n-button>
        <n-button type="primary" @click="saveLayout">保存布局</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import {
  NButton,
  NCheckbox,
  NDataTable,
  NForm,
  NFormItem,
  NInputNumber,
  NModal,
  NSelect,
  NSwitch,
  type DataTableColumns,
} from 'naive-ui'

import {
  applyBatchBodyWidth,
  applyBatchFontSize,
  applyBatchOrderWidth,
  applyToAllFontSize,
  autoFitFields,
  fitPaperWidth,
  normalizeQualifiedLabelConfig,
  readBatchValues,
  BATCH_INITIAL_VALUES,
  BATCH_UI_RANGES,
  createDefaultConfig,
  FIELD_TABLE_ALIGN_SELECT_WIDTH,
  FIELD_TABLE_COLUMN_WIDTHS,
  FIELD_TABLE_UI_RANGES,
  FIELD_UI_RANGES,
  FONT_WEIGHT_OPTIONS,
  GLOBAL_FONT_SIZE_UI_RANGE,
  PAPER_UI_RANGES,
  QL_LAYOUT_CLASSES,
} from '../utils/qualifiedlabel'
import type { BatchValues } from '../utils/qualifiedlabel/layout'
import type { LabelField, LabelRow, QualifiedLabelConfig } from '../utils/qualifiedlabel'
import type { QualifiedLabelUiProfile } from './qualifiedLabelUiProfile'

const props = defineProps<{
  show: boolean
  /** 已生效的配置（父组件持有）。弹窗只读它，**打开时**深拷贝 + 归一化一份当草稿。 */
  config: QualifiedLabelConfig
  /**
   * 行数据。⚠️ **本弹窗用不到**（画布画的是字段框，不是数据）——
   * 声明它只是因为抽屉的 `<component :is="layoutDialog">` 会一并传下来，
   * 不声明的话 Vue 会把它当 HTML attribute 落到根元素上。
   */
  rows: LabelRow[]
  /** 本单据的组件层档案（只用来取弹窗标题）。 */
  profile: QualifiedLabelUiProfile
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  /** 保存布局后触发：父组件据此重读配置 + 重渲染主预览（旧版 `oe` 末尾的 `await ne()`）。 */
  (e: 'saved'): void
}>()

const show = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

/** 布局编辑器的 class —— **裸 `layout-*`**，不从任何前缀派生（`QL_LAYOUT_CLASSES`）。 */
const C = QL_LAYOUT_CLASSES

/**
 * 旧版 `V`（`QL:214-220`）：画布缩放系数 = `min(320 / max(1,纸宽), 260 / max(1,纸高))`。
 * ★ 两个基准 **320 / 260 是写死的**（不像 B 家族那样实测右栏 DOM），所以画布尺寸不随窗口变。
 */
const canvasScale = computed(() => {
  const p = draft.value.paper
  return Math.min(320 / Math.max(1, p.widthMm), 260 / Math.max(1, p.heightMm))
})

/**
 * 旧版 `F`（`QL:662-670`）：画布自身尺寸，**带 `max(120, …)` 下限**（照抄，别去掉）。
 * `padding` 用内边距 × 缩放系数。
 */
const canvasStyle = computed(() => {
  const p = draft.value.paper
  return {
    width: Math.max(120, p.widthMm * canvasScale.value) + 'px',
    height: Math.max(120, p.heightMm * canvasScale.value) + 'px',
    padding: p.paddingMm * canvasScale.value + 'px',
  }
})

/**
 * 旧版 `$`（`QL:672-690`）：一个画布字段节点的样式。
 *
 * ⚠️ 三处照抄、别"修"：
 *   · 宽度下限 **8**、文本高度下限 **10**、字号下限 **8**（都是 px）；
 *   · 文本高度 = `0.3528 * fontSize * V` —— **1pt = 0.3528mm** 的换算，与 `pt` 无关；
 *   · `padding:"0"` 与 `lineHeight:"1"` 会**覆盖** `.layout-node` 类里的 `padding:2px 4px` /
 *     `line-height:1.2` ⇒ 那两条 CSS 声明在画布上其实是死的（旧版如此，照抄）。
 */
function nodeStyle(f: LabelField): Record<string, string> {
  const s = canvasScale.value
  const textHeight = Math.max(10, 0.3528 * f.fontSize * s)
  return {
    left: f.x * s + 'px',
    top: f.y * s + 'px',
    width: Math.max(8, f.width * s) + 'px',
    // `qrcode` 的高度取**宽度**（不看 height —— 渲染宽高本来就是同一个值，§2.3）
    height: (f.key === 'qrcode' ? Math.max(8, f.width * s) : textHeight) + 'px',
    fontSize: Math.max(8, 0.3528 * f.fontSize * s) + 'px',
    fontWeight: f.fontWeight,
    lineHeight: '1',
    padding: '0',
    overflow: 'hidden',
  }
}

// ---------------------------------------------------------------------------
// 草稿（旧版 `d`，`QL:213`）
// ---------------------------------------------------------------------------

/**
 * 旧版 `JSON.parse(JSON.stringify(x))` 的等价物。
 *
 * ⚠️ `QualifiedLabelConfig` 是纯数据（没有 `Date`/函数/`undefined`），
 * `JSON` 往返与结构化克隆等价 —— 三张单据的既有实现都是这个写法。
 */
function cloneConfig(cfg: QualifiedLabelConfig): QualifiedLabelConfig {
  return JSON.parse(JSON.stringify(cfg)) as QualifiedLabelConfig
}

const draft = ref<QualifiedLabelConfig>(normalizeQualifiedLabelConfig(cloneConfig(props.config)))

/** 当前选中的字段 key（旧版 `m`）。★ 打开时恒为 `fields[0].key` = `qrcode`（`QL:914`）。 */
const selectedKey = ref<string>('')

/** 选中的字段对象（旧版 `w` computed）—— **就是草稿里的那一份**，改它就是改草稿。 */
const selectedField = computed<LabelField | null>(
  () => draft.value.fields.find((f) => f.key === selectedKey.value) ?? null,
)

/**
 * 「快捷批量调整」三个控件的当前值（旧版 `S`/`T`/`Y`）。
 *
 * ⚠️ 必须显式标注 `BatchValues`：`BATCH_INITIAL_VALUES` 是 `as const` 的
 * （字面量类型 `16`/`66`/`48`），直接 `ref({...})` 会推出「只能是那三个字面量」的类型，
 * 之后任何赋值都报错。
 */
const batch = ref<BatchValues>({ ...BATCH_INITIAL_VALUES })

/**
 * 旧版 `W`（`QL:431-437`）：从草稿里**回读**批量调整的当前值。
 * ⚠️ 调用时机**只有三处**（打开 / 重置默认 / 整体自适应）—— 用户逐个字段改之后这三个数
 * **会变陈旧**，这是旧版行为（§3.2 的说明），照抄。
 */
function syncBatchValues(): void {
  batch.value = readBatchValues(draft.value.fields)
}

/** 打开流程（旧版 `openLayoutEditor`，`QL:911-919`）。 */
watch(
  () => props.show,
  (open) => {
    if (!open) return
    draft.value = normalizeQualifiedLabelConfig(cloneConfig(props.config)) // `QL:914` —— ★ 打开就归一化
    selectedKey.value = draft.value.fields[0]?.key || '' // `QL:916`
    syncBatchValues() // `QL:917`
  },
)

// ---------------------------------------------------------------------------
// 左栏：字段设置面板（写草稿里的选中字段）
// ---------------------------------------------------------------------------

/**
 * ⚠️ 数字框清空时 Naive 与 Element Plus 一样 emit `null`，旧版是**原样写进草稿**
 * （不钳位、不回退默认）—— 照抄，所以「清空 X → 画布节点跳到 `left:NaNpx`」是旧版就有的行为。
 * （归一化只发生在读盘与保存，编辑期的草稿不经归一化。）
 */
function setFieldNumber(key: 'x' | 'y' | 'width' | 'fontSize' | 'maxLines', v: number | null): void {
  const f = selectedField.value
  if (f) f[key] = v as number
}

function setFieldString(key: 'fontWeight' | 'textAlign', v: 'normal' | 'bold' | 'left' | 'center' | 'right'): void {
  const f = selectedField.value
  if (!f) return
  if (key === 'fontWeight') f.fontWeight = v as 'normal' | 'bold'
  else f.textAlign = v as 'left' | 'center' | 'right'
}

function setFieldBoolean(key: 'wrap' | 'showPrefix', v: boolean): void {
  const f = selectedField.value
  if (f) f[key] = v
}

// ---------------------------------------------------------------------------
// 左栏：三颗批量按钮（语义全在核心层 `layout.ts`）
// ---------------------------------------------------------------------------

/** 「应用到全部」字号（旧版 `ee`，`QL:691-701`）——★ 排除 `qrcode` 与 `package`。 */
function onApplyToAll(): void {
  applyToAllFontSize(draft.value.fields, draft.value.globalFont.fontSize)
}

/** 「适应纸张宽度」（旧版 `te`，`QL:701-708`）——★ 只排除 `qrcode`，可用宽下限 1。 */
function onFitPaperWidth(): void {
  fitPaperWidth(draft.value.fields, draft.value.paper)
}

/**
 * 「整体自适应」（旧版 `J`，`QL:500-508`）—— 就地重铺 11 条字段，**再回读批量值**
 * （`W()` 是旧版三个调用点里的最后一个）。
 * ⚠️ 旧版**不弹任何提示**（设置弹窗那侧的同名按钮 `q` 才弹 `ElMessage.success("已按 … 自适应完成")`）。
 */
function onAutoFit(): void {
  const p = draft.value.paper
  autoFitFields(draft.value.fields, p.widthMm, p.heightMm)
  syncBatchValues()
}

/** 批量：正文字号（旧版 `O`，`QL:438-444`，作用于 `BODY_FIELD_KEYS` 7 条）。 */
function onBatchFontSize(v: number | null): void {
  batch.value.fontSize = v as number
  applyBatchFontSize(draft.value.fields, v as number)
}

/** 批量：正文行宽（旧版 `H`，`QL:445-451`）。 */
function onBatchBodyWidth(v: number | null): void {
  batch.value.bodyWidth = v as number
  applyBatchBodyWidth(draft.value.fields, v as number)
}

/** 批量：客户/单号宽（旧版 `G`，`QL:452-458`，作用于 `client` + `orderID` 2 条）。 */
function onBatchOrderWidth(v: number | null): void {
  batch.value.orderWidth = v as number
  applyBatchOrderWidth(draft.value.fields, v as number)
}

// ---------------------------------------------------------------------------
// 右栏：画布拖拽（§3.4 左列 —— **A 家族唯一的一套拖拽**）
// ---------------------------------------------------------------------------

/**
 * 画布字段拖拽（旧版内联 `onMousedown` 的那个 IIFE，`QL:2723-2760`）。
 *
 * 逐字语义：
 * ```
 * e.preventDefault()
 * startX/startY = 鼠标起点;  x0/y0 = 字段起点;  V = 缩放系数;  paper = 草稿纸张
 * mousemove: dx = (clientX-startX)/V, dy = (clientY-startY)/V
 *            x = round(2*(x0+dx))/2;  y = round(2*(y0+dy))/2     ← 吸附 0.5mm
 *            x = max(0, min(纸宽-1, x));  y = max(0, min(纸高-1, y))
 *            field.x = x;  field.y = y
 * mouseup:   document 上摘掉两个监听
 * ```
 *
 * ⚠️ **三处与「就地编辑拖拽」的区别**（§3.4 的对照表，别混）：
 *   · 写的是**布局草稿**（`draft.fields[i]`），就地编辑写的是**生效配置**；
 *   · **不落库**（要等「保存布局」），就地编辑 mouseup 立刻写 localStorage；
 *   · **不刷预览**，就地编辑 mouseup 会重渲染并重进编辑模式。
 * ⚠️ clamp 的上界是 `纸宽-1` / `纸高-1`（**不是** 纸宽-字段宽）——
 *   所以字段能被拖到纸外，保存时由归一化的 `x ∈ [0, 纸宽-宽度]` 再夹回来（`sanitize.ts`）。
 * ⚠️ 拖拽期间**没有任何视觉反馈**（就地编辑那套会改 `outlineColor`）。
 */
function startDrag(e: MouseEvent, f: LabelField): void {
  e.preventDefault()
  const startX = e.clientX
  const startY = e.clientY
  const originX = f.x
  const originY = f.y
  const scale = canvasScale.value
  const paper = draft.value.paper

  const onMove = (ev: MouseEvent): void => {
    let x = originX + (ev.clientX - startX) / scale
    let y = originY + (ev.clientY - startY) / scale
    x = Math.round(2 * x) / 2 // 吸附 0.5mm（旧版 `Math.round(2 * V) / 2`）
    y = Math.round(2 * y) / 2
    x = Math.max(0, Math.min(paper.widthMm - 1, x))
    y = Math.max(0, Math.min(paper.heightMm - 1, y))
    f.x = x
    f.y = y
  }
  const onUp = (): void => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ---------------------------------------------------------------------------
// 右栏：9 列字段表（§3.5）
// ---------------------------------------------------------------------------

const fieldRowKey = (row: LabelField): string => row.key

/** 行点击 → 选中（旧版 `onRowClick`，`QL:2847`）。⚠️ 画布上点节点**不设选中**。 */
const fieldRowProps = (row: LabelField) => ({
  style: 'cursor:pointer',
  onClick: () => {
    selectedKey.value = row.key
  },
})

/** `highlight-current-row` 的等价物（A 家族**没有** `layout-node-selected`，高亮只在行上）。 */
const fieldRowClassName = (row: LabelField): string =>
  row.key === selectedKey.value ? 'ql-field-row-active' : ''

/** 「左/中/右」短标签 —— 右栏表格专用（左栏字段面板用长的「左对齐/居中/右对齐」）。 */
const textAlignShortOptions = [
  { label: '左', value: 'left' },
  { label: '中', value: 'center' },
  { label: '右', value: 'right' },
]

const fontWeightOptions = FONT_WEIGHT_OPTIONS
const textAlignLongOptions = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' },
]

/**
 * 每个单元格控件都包一层「吞掉 click」的 div —— 等价于旧版给**每一个**单元格控件挂的
 * `onClick` + `@click.stop`（`QL:2865, 2877, …` 共 12 处），防止点输入框触发 `row-click`
 * 改变选中。旧版是逐控件挂修饰符，这里在列定义里统一包一层，语义相同。
 */
function stopClick(node: ReturnType<typeof h>): ReturnType<typeof h> {
  return h('div', { onClick: (e: Event) => e.stopPropagation() }, [node])
}

/**
 * 9 列的列宽（旧版是 `width:"NN"` 的**字符串**，核心层 `FIELD_TABLE_COLUMN_WIDTHS` 照原样存着）。
 * 这里转成数字再交给 `n-data-table`（两种都收，数字更好排）。
 */
const TABLE_W = {
  visible: Number(FIELD_TABLE_COLUMN_WIDTHS.visible),
  label: Number(FIELD_TABLE_COLUMN_WIDTHS.label),
  x: Number(FIELD_TABLE_COLUMN_WIDTHS.x),
  y: Number(FIELD_TABLE_COLUMN_WIDTHS.y),
  width: Number(FIELD_TABLE_COLUMN_WIDTHS.width),
  fontSize: Number(FIELD_TABLE_COLUMN_WIDTHS.fontSize),
  textAlign: Number(FIELD_TABLE_COLUMN_WIDTHS.textAlign),
  wrap: Number(FIELD_TABLE_COLUMN_WIDTHS.wrap),
  showPrefix: Number(FIELD_TABLE_COLUMN_WIDTHS.showPrefix),
}

const fieldTableColumns = computed<DataTableColumns<LabelField>>(() => [
  {
    title: '显',
    key: 'visible',
    width: TABLE_W.visible,
    render: (row) =>
      stopClick(
        h(NCheckbox, {
          checked: row.visible,
          'onUpdate:checked': (v: boolean) => {
            row.visible = v
          },
        }),
      ),
  },
  // 「字段」是**只读**的 `row.label`（旧版 `prop:"label"`，无任何编辑器）
  { title: '字段', key: 'label', width: TABLE_W.label },
  {
    title: 'X',
    key: 'x',
    width: TABLE_W.x,
    render: (row) =>
      stopClick(
        h(NInputNumber, {
          value: row.x,
          min: FIELD_TABLE_UI_RANGES.x.min,
          max: FIELD_TABLE_UI_RANGES.x.max,
          step: FIELD_TABLE_UI_RANGES.x.step,
          size: 'small',
          style: 'width:100%',
          'onUpdate:value': (v: number | null) => {
            row.x = v as number
          },
        }),
      ),
  },
  {
    title: 'Y',
    key: 'y',
    width: TABLE_W.y,
    render: (row) =>
      stopClick(
        h(NInputNumber, {
          value: row.y,
          min: FIELD_TABLE_UI_RANGES.y.min,
          max: FIELD_TABLE_UI_RANGES.y.max,
          step: FIELD_TABLE_UI_RANGES.y.step,
          size: 'small',
          style: 'width:100%',
          'onUpdate:value': (v: number | null) => {
            row.y = v as number
          },
        }),
      ),
  },
  {
    title: '宽(mm)',
    key: 'width',
    width: TABLE_W.width,
    // ★ 这里的下限是 **1**（左栏字段面板是 4）—— 三处不一致是旧版事实，照抄
    render: (row) =>
      stopClick(
        h(NInputNumber, {
          value: row.width,
          min: FIELD_TABLE_UI_RANGES.width.min,
          max: FIELD_TABLE_UI_RANGES.width.max,
          step: FIELD_TABLE_UI_RANGES.width.step,
          size: 'small',
          style: 'width:100%',
          'onUpdate:value': (v: number | null) => {
            row.width = v as number
          },
        }),
      ),
  },
  {
    title: '字号',
    key: 'fontSize',
    width: TABLE_W.fontSize,
    // ⚠️ 条件在**单元格内**（旧版是 `e.key !== "qrcode" ? <input> : comment`），不是列级 v-if
    render: (row) =>
      row.key === 'qrcode'
        ? null
        : stopClick(
            h(NInputNumber, {
              value: row.fontSize,
              min: FIELD_TABLE_UI_RANGES.fontSize.min,
              max: FIELD_TABLE_UI_RANGES.fontSize.max,
              step: FIELD_TABLE_UI_RANGES.fontSize.step,
              size: 'small',
              style: 'width:100%',
              'onUpdate:value': (v: number | null) => {
                row.fontSize = v as number
              },
            }),
          ),
  },
  {
    title: '对齐',
    key: 'textAlign',
    width: TABLE_W.textAlign,
    render: (row) =>
      row.key === 'qrcode'
        ? null
        : stopClick(
            h(NSelect, {
              value: row.textAlign,
              options: textAlignShortOptions,
              size: 'small',
              // 旧版这个下拉写死 `style:{width:"68px"}`，照抄
              style: 'width:' + FIELD_TABLE_ALIGN_SELECT_WIDTH,
              'onUpdate:value': (v: 'left' | 'center' | 'right') => {
                row.textAlign = v
              },
            }),
          ),
  },
  {
    title: '换行',
    key: 'wrap',
    width: TABLE_W.wrap,
    render: (row) =>
      row.key === 'qrcode'
        ? null
        : stopClick(
            h(NCheckbox, {
              checked: row.wrap,
              'onUpdate:checked': (v: boolean) => {
                row.wrap = v
              },
            }),
          ),
  },
  {
    title: '前缀',
    key: 'showPrefix',
    width: TABLE_W.showPrefix,
    render: (row) =>
      row.key === 'qrcode'
        ? null
        : stopClick(
            h(NCheckbox, {
              checked: row.showPrefix,
              'onUpdate:checked': (v: boolean) => {
                row.showPrefix = v
              },
            }),
          ),
  },
])

// ---------------------------------------------------------------------------
// 三颗 footer 按钮
// ---------------------------------------------------------------------------

/** 「取消」：只关窗 —— 生效值全程没被碰过，所以不需要任何回滚逻辑。 */
function cancel(): void {
  show.value = false
}

/** 「重置默认」（旧版 `le`，`QL:709-710`）：**只重置草稿** + 回读批量值，不写盘、不关窗。 */
function resetDraft(): void {
  draft.value = createDefaultConfig()
  syncBatchValues()
}

/**
 * 「保存布局」（旧版 `oe`，`QL:711-716`）：
 * `生效 = 归一化(深拷贝(草稿))` → 落库 → 关窗 →（若预览打开）刷新预览。
 *
 * ⚠️ 归一化是**旧版事实**（`N(JSON.parse(JSON.stringify(d)))`），不是新版加的保险 ——
 * 它会把拖拽时越界的 `x/y` 夹回来、把清空的 `width:null` 之类修掉。
 */
function saveLayout(): void {
  const saved = normalizeQualifiedLabelConfig(cloneConfig(draft.value))
  props.profile.api.saveConfig(saved)
  draft.value = normalizeQualifiedLabelConfig(cloneConfig(saved))
  show.value = false
  emit('saved')
}
</script>

<style scoped>
/*
  ─────────────────── 编辑器专属 CSS：`ql-scoped.css` 的 13 条里**去掉 3 条死规则** ───────────────────
  逐字来源 `docs/custom-docs-recon/ql-scoped.css`（旧版 `<style scoped>`，带 `[data-v-1b2a6816]`）。
  ⚠️ 那个 `data-v-` 属性**不要抄进来** —— 新版 `<style scoped>` 由 Vue 自己加。

  未实现的 3 条（§3.1 CONFIRMED 死规则，`QL` 全文 `grep -c` = 0）：
    `.layout-fields-list` / `.layout-field-item` / `.layout-field-item.active`
  —— 本单的字段列表走 `el-table`，这三条是旧版从别处抄来的残留。

  ⚠️ 与 C 家族那三条「预览在 `v-html` 里所以规则是死的」不同：本弹窗的画布节点、字段框
  **全是模板元素**，所以下面每一条在新版都**真的生效**，不需要任何 `:deep()`。
  ★ 唯一一处例外见 `ql-field-row-active`（新版自有，见其注释）。
*/
.layout-editor-wrap {
  display: flex;
  gap: 12px;
}
.layout-editor-left {
  width: 280px;
  /* ⚠️ 旧版**没有** `min-width` / `overflow-y`（C 家族那套有）—— 照抄，别"补"上去 */
  border-right: 1px solid #eee;
  padding-right: 10px;
}
.layout-editor-right {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.layout-fields-title {
  margin-top: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #666;
}
/* ★ 字段设置面板 **与** 快捷批量调整面板**共用**这一个 class（`QL:2245` / `QL:2546`） */
.layout-field-editor {
  margin-top: 10px;
  border-top: 1px dashed #ddd;
  padding-top: 8px;
}
/* ⚠️ 本单是 `inline-flex` + `justify-content:center; align-items:flex-start`，
   **没有** C 家族的 `flex-direction:column` / `gap:14px` */
.layout-canvas-shell {
  background: #e5e7eb;
  padding: 16px;
  display: inline-flex;
  justify-content: center;
  align-items: flex-start;
}
.layout-canvas {
  position: relative;
  background: #fff;
  box-sizing: border-box;
  box-shadow: 0 2px 10px #0003;
  overflow: hidden;
}
.layout-node {
  position: absolute;
  border: 1px dashed #409eff;
  background: rgba(64, 158, 255, 0.12);
  color: #1f2937;
  padding: 2px 4px;
  cursor: move;
  user-select: none;
  line-height: 1.2;
}
.layout-node-qr {
  display: flex;
  align-items: center;
  justify-content: center;
}

/*
  以下是**新版自己的排版胶水**，不属于那 13 条：
  · `.hint-inline` —— 旧版是逐处内联 `style="margin-left:4px;font-size:11px;color:#999"`，
    收成一个 class 便于维护（**取值逐字相同**；个别处额外覆盖 margin-left，用内联写回）；
  · `.ql-layout-footer` —— footer 三颗按钮的右对齐行（旧版是 el-dialog footer 的默认排布）；
  · `.ql-field-row-active` —— 旧版 `el-table` 的 `highlight-current-row` 的等价物。
    ⚠️ **新版自有**：Naive 的 `n-data-table` 没有这个开关，用 `row-class-name` 手工做。
    A 家族**没有** `layout-node-selected`，所以**只**高亮表格行、画布上不高亮（与旧版一致）。
*/
.hint-inline {
  margin-left: 4px;
  font-size: 11px;
  color: #999;
}
.ql-layout-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
:deep(.ql-field-row-active) {
  background: #ecf5ff;
}
</style>
