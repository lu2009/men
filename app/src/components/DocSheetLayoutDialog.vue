<!--
  C 家族自绘单据 · **共用**「布局编辑」全屏弹窗 —— GS2 与 PS2 逐字相同的那一份
  （旧版 `GlassSheet2PrintManager.openLayoutEditor` / `ProductionSheet2PrintManager.openLayoutEditor`）。

  逆向定稿：`docs/custom-docs-recon/02-glasssheet2.md` §7（§7.1 打开 / §7.2 骨架 / §7.3 控件全清单 /
  §7.4 右侧预览）；两单据对照见 `docs/custom-docs-recon/01-diff.md` §10 —— 该节 CONFIRMED：
  **「两个弹窗的全部控件、布局编辑器左栏、排序上下箭头、`el-table` 列、`el-input-number` 的
  min/max/step、常用尺寸预设、方向下拉」逐字相同**，差异只有标题与类名前缀。

  **它是三套弹窗里的 B**（不是「编辑XX」那个数据弹窗，也不是「打印设置」）——
  本弹窗改的是**版式**（纸张/标题/边框色/每列的显隐·宽·字号·行高·颜色·顺序），存在
  `{profile.core.storageKeys.template}` 里，跨会话生效。见报告 §15.6 的三套对照。

  **核心模式：草稿 / 生效 成对**（旧版 `i` 生效 / `s` 草稿 / `d` 行快照，GS:102-105）：
  · 打开 = `draft = 深拷贝(生效)`（GS:789）；
  · 「保存布局」= 深拷贝回生效 + 落库 + 关窗 + 刷预览（GS:154-161）；
  · 「重置默认」= **只重置草稿**（`draft = 默认`），不写盘、不关窗（GS:143-145）；
  · 「取消」= 直接关窗 —— 生效值全程没被碰过，所以不需要任何回滚逻辑。

  ⚠️ 与打印设置弹窗**共用同一个 localStorage 键**（§6.3）：两者写的是同一份配置。
  旧版两个弹窗**可以同时开着**（`openLayoutEditor` 不关设置弹窗），新版照抄 —— 谁后保存谁生效。

  ⚠️ **类名走 profile**（`profile.classes`）：GS2 是 `gs2-layout-*`、PS2 是 `ps2-layout-*`。
  两套前缀在旧版 CSS（`legacy/css/Home-97d96482.css`）里都存在且**只有 scoped hash 不同**
  （8 条规则逐字相同，已核对）。本文件的 `<style scoped>` 因此把**两个前缀都写出来** ——
  模板的 class 是运行时绑定的，CSS 选择器只能是字面量。
-->
<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="profile.text.layoutTitle"
    :bordered="false"
    display-directive="show"
    :style="fullscreenStyle"
    :content-style="contentStyle"
  >
    <div :class="cls.layoutWrap">
      <!-- ─────────────────────────── 左栏：控件（GS:1419-1824 / PS2:1445-1850） ─────────────────────────── -->
      <div :class="cls.layoutLeft">
        <!-- 区块一：纸张（GS:1419-1500）。**没有方向下拉、没有常用尺寸按钮** —— 那两样只在打印设置弹窗里 -->
        <div :class="cls.layoutSectionTitle">纸张</div>
        <n-form label-placement="left" :label-width="80" size="small">
          <n-form-item label="宽(mm)">
            <n-input-number
              :value="draft.paper.widthMm"
              :min="PAPER_UI_RANGES.widthMm.min"
              :max="PAPER_UI_RANGES.widthMm.max"
              :step="PAPER_UI_RANGES.widthMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => setPaperNumber('widthMm', v)"
            />
          </n-form-item>
          <n-form-item label="高(mm)">
            <n-input-number
              :value="draft.paper.heightMm"
              :min="PAPER_UI_RANGES.heightMm.min"
              :max="PAPER_UI_RANGES.heightMm.max"
              :step="PAPER_UI_RANGES.heightMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => setPaperNumber('heightMm', v)"
            />
          </n-form-item>
          <n-form-item label="边距(mm)">
            <n-input-number
              :value="draft.paper.paddingMm"
              :min="PAPER_UI_RANGES.paddingMm.min"
              :max="PAPER_UI_RANGES.paddingMm.max"
              :step="PAPER_UI_RANGES.paddingMm.step"
              style="width: 150px"
              @update:value="(v: number | null) => setPaperNumber('paddingMm', v)"
            />
          </n-form-item>
        </n-form>
        <!--
          ⚠️ 旧版**不能**在这里改的方向/份数：`paper.orientation`、`print.copies` 只出现在打印设置弹窗；
          本弹窗也**不能**新增/删除列、不能改 `column.key`（§7.3 末的「布局编辑器不能改的」）。
        -->

        <!-- 区块二：表格全局（GS:1500-1590） -->
        <div :class="cls.layoutSectionTitle">表格全局</div>
        <n-form label-placement="left" :label-width="80" size="small">
          <n-form-item label="标题">
            <!-- 旧版这个输入框写死 `style="width:160px"`，照抄 -->
            <n-input
              :value="draft.table.title"
              style="width: 160px"
              @update:value="(v: string) => (draft.table.title = v)"
            />
          </n-form-item>
          <n-form-item label="表头字号">
            <n-input-number
              :value="draft.table.headerFontSize"
              :min="TABLE_UI_RANGES.headerFontSize.min"
              :max="TABLE_UI_RANGES.headerFontSize.max"
              :step="TABLE_UI_RANGES.headerFontSize.step"
              style="width: 150px"
              @update:value="(v: number | null) => (draft.table.headerFontSize = v as number)"
            />
          </n-form-item>
          <n-form-item label="边框颜色">
            <n-color-picker
              :value="draft.table.borderColor"
              size="small"
              @update:value="(v: string | null) => (draft.table.borderColor = v ?? '')"
            />
          </n-form-item>
        </n-form>

        <!-- 区块三：各列设置（GS:1600-1824）—— 显 / 列名 / 宽mm / 字号pt / 行高mm / 颜色 / 排序 -->
        <div :class="cls.layoutSectionTitle">各列设置</div>
        <n-data-table
          :data="draft.table.columns"
          :columns="columnTableColumns"
          :row-key="columnRowKey"
          size="small"
          bordered
          :max-height="400"
          :style="{ width: '100%' }"
        />
      </div>

      <!-- ─────────────────────────── 右栏：实时预览（GS:1830-1850 + W GS:363-411） ─────────────────────────── -->
      <div ref="rightEl" :class="cls.layoutRight">
        <!-- 旧版是 `innerHTML` 直塞（报告 §1 的 `En = ["innerHTML"]`），照抄成 `v-html` -->
        <div :class="cls.layoutCanvasShell" v-html="previewHtml" />
      </div>
    </div>

    <!-- footer 三颗，顺序与语义照旧版（GS:1373-1417）：取消 / 重置默认 / 保存布局(primary) -->
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
  NInput,
  NInputNumber,
  NModal,
  type DataTableColumns,
} from 'naive-ui'

// 「与单据无关」的 UI 控件参数直接取自公共底座（两张单据逐字相同、无需 profile 转发）。
import { COLUMN_UI_RANGES, PAPER_UI_RANGES, TABLE_UI_RANGES } from '../utils/docsheet/defaults'
import type { ColumnConfig, DocSheetConfig, DocSheetRow, RenderOptions } from '../utils/docsheet/types'
import { MM_TO_PX, UI_PREVIEW_EMPTY, type DocSheetUiProfile } from './docSheetUi'

const props = defineProps<{
  show: boolean
  /**
   * 已生效的配置（父组件持有）。弹窗只读它，**打开时**深拷贝一份当草稿。
   * 用底座的 `DocSheetConfig` —— 两张单据的 `XxxSheet2Config` 都是它的别名。
   */
  config: DocSheetConfig
  /** 预览行数据 —— 旧版 `d`（`openLayoutEditor` 里每次重新取 `props.getData()`，GS:792-793）。 */
  rows: DocSheetRow[]
  /** 本单据的组件层档案（文案 / 外壳 class / 模块转出）。 */
  profile: DocSheetUiProfile
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  /** 保存布局后触发：父组件据此重读配置 + 重渲染主预览（旧版 `E` 里的 `refreshPreview()`）。 */
  (e: 'saved'): void
}>()

const show = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const cls = computed(() => props.profile.classes)

/**
 * 全屏（旧版 `el-dialog fullscreen`）。Naive 的 `n-modal` 没有 `fullscreen` 属性，
 * 用「铺满视口的卡片 + 内容区不滚动」来还原；真正的滚动条在左栏与右栏各自身上，与旧版一致。
 *
 * TODO(未确认): 铺满的观感（卡片圆角/外边距/标题与 footer 的高度）没有对着旧版逐像素比过 ——
 * 左栏那 8 条 `xxx2-layout-*` CSS 是逐字照抄的，但「卡片外壳」这一层是 Naive 的，不是 el-dialog 的。
 * 真机眼验时看两处：① 整屏无留白；② 两栏的高度（`calc(100vh - 160px)`）不出现双滚动条。
 */
const fullscreenStyle = {
  width: '100vw',
  height: '100vh',
  maxWidth: '100vw',
  borderRadius: '0',
}
const contentStyle = {
  padding: '12px 16px',
  overflow: 'hidden',
}

/** 二维码 provider：**每个弹窗实例一份**（旧版是模块级单例 + 模块级 Map 缓存，见 `html.ts` 的注释）。 */
const renderOpts: RenderOptions = {
  qr: props.profile.api.createQrSvgProvider(props.profile.api.createQrEncoder()),
}

/** 旧版 `JSON.parse(JSON.stringify(x))` 的等价物。三个 ref 全靠它断引用（GS:102-104）。 */
function cloneConfig(cfg: DocSheetConfig): DocSheetConfig {
  return JSON.parse(JSON.stringify(cfg)) as DocSheetConfig
}

// ---------------------------------------------------------------------------
// 草稿（旧版 `s`，GS:104）
// ---------------------------------------------------------------------------

const draft = ref<DocSheetConfig>(cloneConfig(props.config))

/** 「重置默认」（旧版 `M`，GS:143-145）：**只重置草稿**，不写盘、不关窗、不刷预览。 */
function resetDraft(): void {
  draft.value = props.profile.api.createDefaultConfig()
}

function cancel(): void {
  show.value = false
}

/**
 * 「保存布局」（旧版 `E`，GS:154-161）：生效 ← 深拷贝草稿 → 落库 → 关窗 →（若预览打开）刷新。
 * 「预览是否打开」在新版是父组件的事（抽屉恒有预览），所以直接让父组件去刷新。
 */
function saveLayout(): void {
  const saved = cloneConfig(draft.value)
  props.profile.api.saveConfig(saved)
  draft.value = cloneConfig(saved)
  show.value = false
  emit('saved')
}

// ---------------------------------------------------------------------------
// 左栏数值/颜色输入
// ---------------------------------------------------------------------------

/**
 * 数字框清空时 Naive 与 Element Plus 一样 emit `null`，旧版是**原样写进草稿**（不做钳位、
 * 不回退默认），这里照抄 —— 所以「清空宽(mm) → 右侧预览变成 `width:NaNmm`」是旧版就有的行为。
 * （读盘的清洗只发生在 `loadSettings`，见 `sanitize.ts`；编辑期的草稿不经清洗。）
 */
function setPaperNumber(key: 'widthMm' | 'heightMm' | 'paddingMm', v: number | null): void {
  draft.value.paper[key] = v as number
}

// ---------------------------------------------------------------------------
// 各列设置表（旧版 `el-table` 6+1 列，GS:1600-1824）
// ---------------------------------------------------------------------------

const columnRowKey = (row: ColumnConfig): string => row.key

/**
 * ⚠️ 旧版这三个 `el-input-number` 都带 `controls-position:"right"`（加号/减号钉在输入框右侧）。
 * Naive 的 `n-input-number` **没有这个属性**，它的加减按钮本来就固定在右侧（`:show-button` 默认 true），
 * 观感一致，所以这里不做等价处理 —— 记一笔免得后来人以为漏抄了。
 */

/**
 * ⚠️ 排序是**就地交换数组相邻两项**（GS:1748-1817），**不是拖拽** —— 收据单那边是拖拽，别串。
 * `↑` 在第一行时 disabled、`↓` 在最后一行时 disabled，越界由按钮挡住（函数里再挡一次照旧版）。
 */
function moveColumn(index: number, delta: number): void {
  const cols = draft.value.table.columns
  const target = index + delta
  if (target < 0 || target >= cols.length) return
  const tmp = cols[index]
  cols[index] = cols[target]
  cols[target] = tmp
}

const columnTableColumns = computed<DataTableColumns<ColumnConfig>>(() => [
  {
    title: '显',
    key: 'visible',
    width: 38,
    render: (row) =>
      h(NCheckbox, {
        checked: row.visible,
        'onUpdate:checked': (v: boolean) => {
          row.visible = v
        },
      }),
  },
  // 「列名」是**只读**的（GS:1741 直接给 `prop="label"`，没有任何编辑器）
  { title: '列名', key: 'label', width: 72 },
  {
    title: '宽mm',
    key: 'widthMm',
    width: 72,
    render: (row) =>
      h(NInputNumber, {
        value: row.widthMm,
        min: COLUMN_UI_RANGES.widthMm.min,
        max: COLUMN_UI_RANGES.widthMm.max,
        step: COLUMN_UI_RANGES.widthMm.step,
        size: 'small',
        style: 'width:100%',
        'onUpdate:value': (v: number | null) => {
          row.widthMm = v as number
        },
      }),
  },
  {
    title: '字号pt',
    key: 'fontSize',
    width: 72,
    render: (row) =>
      h(NInputNumber, {
        value: row.fontSize,
        min: COLUMN_UI_RANGES.fontSize.min,
        max: COLUMN_UI_RANGES.fontSize.max,
        step: COLUMN_UI_RANGES.fontSize.step,
        size: 'small',
        style: 'width:100%',
        'onUpdate:value': (v: number | null) => {
          row.fontSize = v as number
        },
      }),
  },
  {
    title: '行高mm',
    key: 'rowHeightMm',
    width: 72,
    render: (row) =>
      h(NInputNumber, {
        value: row.rowHeightMm,
        min: COLUMN_UI_RANGES.rowHeightMm.min,
        max: COLUMN_UI_RANGES.rowHeightMm.max,
        step: COLUMN_UI_RANGES.rowHeightMm.step,
        size: 'small',
        style: 'width:100%',
        'onUpdate:value': (v: number | null) => {
          row.rowHeightMm = v as number
        },
      }),
  },
  {
    title: '颜色',
    key: 'fontColor',
    width: 52,
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
    title: '排序',
    key: 'order',
    width: 70,
    render: (_row, index) =>
      h('div', { class: cls.value.columnOrder }, [
        h(
          NButton,
          { size: 'small', disabled: index === 0, onClick: () => moveColumn(index, -1) },
          { default: () => '↑' },
        ),
        h(
          NButton,
          {
            size: 'small',
            disabled: index === draft.value.table.columns.length - 1,
            onClick: () => moveColumn(index, 1),
          },
          { default: () => '↓' },
        ),
      ]),
  },
])

// ---------------------------------------------------------------------------
// 右栏预览（旧版 `L` GS:162-171 / `b` GS:172-181 / `W` GS:363-411）
// ---------------------------------------------------------------------------

const rightEl = ref<HTMLElement | null>(null)
/** 容器可用尺寸（旧版 `m`），由 `measureContainer()` 量出来。 */
const canvasSize = ref({ w: 0, h: 0 })

/**
 * 旧版 `L`（GS:162-171）：`clientWidth/Height - 32`（32 = `.xxx2-layout-canvas-shell` 的
 * `padding:16px` ×2）；ref 取不到时回退 `{w: max(600, innerWidth-500), h: max(400, innerHeight-200)}`。
 *
 * ⚠️ 旧版**只在打开时调一次**（没有 resize 监听，§7.3 末）—— 照抄，别加 window resize。
 */
function measureContainer(): void {
  const el = rightEl.value
  canvasSize.value = el
    ? { w: el.clientWidth - 32, h: el.clientHeight - 32 }
    : { w: Math.max(600, window.innerWidth - 500), h: Math.max(400, window.innerHeight - 200) }
}

/**
 * 旧版 `b`（GS:172-181）：`min(容器w / max(1,纸w), 容器h / max(1,纸h))`。
 * 单位是「**1mm 对应多少 px**」（§7.4 的 INTERPRETED 说明）。
 */
const scale = computed(() => {
  const paper = draft.value.paper
  return Math.min(
    canvasSize.value.w / Math.max(1, paper.widthMm),
    canvasSize.value.h / Math.max(1, paper.heightMm),
  )
})

/** 竞态令牌（旧版 `Y`，GS:364-368）：预览构建是异步的，过期结果直接丢弃。 */
let renderToken = 0

const previewHtml = ref('')

/**
 * 旧版 `W`（GS:363-411）—— 右侧实时预览。
 *
 * ⚠️ 四个要点：
 * 1. 分页用的是**草稿**配置（`H(rows, 草稿)`），所以改纸张/边距能立刻看到翻页变化；
 * 2. `shrunk = scale / 3.78` 里的 **3.78 是「1mm = 3.78px」**（96dpi），
 *    `3.78 * 可见列宽之和` 是表格在 96dpi 下的自然宽度；
 * 3. `cw/ch` 有 `Math.max(120, …)` 下限 —— 照抄，别去掉；
 * 4. 空数据 → 占位文案（**不是**空表格）—— 与打印路径的「一个空页」不同（§5.3）。
 *
 * ⚠️ 预览串里的 4 个 class（page-wrap / page-label / canvas）必须带**本单据的前缀**
 * （`profile.classes`）—— 旧版 CSS 里 `gs2-layout-*` 与 `ps2-layout-*` 是两套（见文件头注）。
 */
async function renderPreview(): Promise<void> {
  const token = ++renderToken
  const cfg = cloneConfig(draft.value) // 旧版也 clone 一份再分页，避免量测期间的修改串进来
  const rows = props.rows
  const c = props.profile.classes

  if (rows.length === 0) {
    previewHtml.value = UI_PREVIEW_EMPTY
    return
  }

  const pages = await props.profile.api.paginateWithMeasure(rows, cfg, renderOpts) // 旧版 `H(n, o)`
  if (token !== renderToken) return // 过期：已有更新的调用

  const s = scale.value
  const shrunk = s / MM_TO_PX
  const totalMm = cfg.table.columns
    .filter((col) => col.visible)
    .reduce((acc, col) => acc + col.widthMm, 0)
  const cw = Math.max(120, cfg.paper.widthMm * s)
  const ch = Math.max(120, cfg.paper.heightMm * s)
  const pd = cfg.paper.paddingMm * s

  previewHtml.value = pages
    .map(
      (page, i) =>
        '<div class="' +
        c.layoutPageWrap +
        '">' +
        (pages.length > 1
          ? '<div class="' + c.layoutPageLabel + '">第 ' + (i + 1) + ' / ' + pages.length + ' 页</div>'
          : '') +
        '<div class="' +
        c.layoutCanvas +
        '" style="width:' +
        cw +
        'px;height:' +
        ch +
        'px;padding:' +
        pd +
        'px;">' +
        '<div class="' +
        props.profile.core.classes.prevTable +
        '" style="transform-origin:top left;transform:scale(' +
        shrunk +
        ');width:' +
        MM_TO_PX * totalMm +
        'px;">' +
        props.profile.api.renderPreviewTable(page, cfg, renderOpts) + // 旧版 `S(t, o)`
        '</div>' +
        '</div>' +
        '</div>',
    )
    .join('')
}

/**
 * 打开流程（旧版 `openLayoutEditor`，GS:788-798）：草稿 ← 生效 → 取行 → 显示 → `nextTick` → 量容器 → 渲染。
 *
 * ⚠️ 旧版每次都重新取 `props.getData()`（与 Home 的 `oi` / `qr` 是**同一份引用**，不是快照）——
 * 新版由父组件把 `rows` 传进来，同样是引用，语义一致。
 */
watch(
  () => props.show,
  async (open) => {
    if (!open) return
    draft.value = cloneConfig(props.config) // GS:789
    await nextTick()
    measureContainer() // GS:796 `L()`
    await renderPreview() // GS:797 `W()`
  },
)

/** 旧版 `Vue.watch([s, d, b], …, {deep:true})`（GS:412-418）：弹窗可见时才重渲染。 */
watch(
  [draft, () => props.rows, scale],
  () => {
    if (show.value) void renderPreview()
  },
  { deep: true },
)
</script>

<style scoped>
/*
  ─────────────────────────── 编辑器专属 CSS（报告 §4.2 的 `xxx2-layout-*` 8 条） ───────────────────────────
  旧版这 8 条**不在**组件产出的 HTML 里，而在 scoped 样式表 `legacy/css/Home-97d96482.css`
  （GS2 是 `data-v-c251bbdd`，PS2 是 `data-v-d99d5e96`）。两套规则**除 hash 外逐字相同**
  （已逐条比对），新版原样收进本组件的 `<style scoped>`。

  ⚠️ **每个选择器都并列两个前缀**（`.gs2-x, .ps2-x`）：模板上的 class 是 `profile.classes`
  运行时绑定的，而 CSS 选择器只能是字面量 —— 这是本层唯一一处「两套前缀必须同时出现」的地方。
  **新增第三张 C 家族单据时，这 8 条要回来各补一个选择器。**
*/
.gs2-layout-wrap,
.ps2-layout-wrap {
  display: flex;
  gap: 12px;
  height: calc(100vh - 160px);
  overflow: hidden;
}
.gs2-layout-left,
.ps2-layout-left {
  width: 460px;
  min-width: 460px;
  border-right: 1px solid #eee;
  padding-right: 10px;
  overflow-y: auto;
}
.gs2-layout-right,
.ps2-layout-right {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.gs2-layout-section-title,
.ps2-layout-section-title {
  font-size: 13px;
  color: #333;
  font-weight: 600;
  margin: 8px 0 4px;
  padding-bottom: 2px;
  border-bottom: 1px dashed #ddd;
}
.gs2-layout-canvas-shell,
.ps2-layout-canvas-shell {
  background: #e5e7eb;
  padding: 16px;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 14px;
}

/*
  ⚠️ **有意偏离（1 处，只影响观感）**：下面 3 条的目标元素都在 **`v-html` 产出的字符串里**。
  旧版那 3 条是 `.gs2-layout-page-wrap[data-v-c251bbdd]{…}` 这种形式 —— Vue 的 scoped 属性
  **只加在模板编译出的元素上**，`innerHTML` 塞进去的元素**拿不到**，所以旧版这 3 条是**死规则**：
  编辑器里的「纸」没有白底、没有阴影、也不裁溢出的内容（章面看着是灰的，与打印出来的白纸对不上）。

  新版改用 `:deep()` 让它们真正生效 —— 理由与「二维码三处统一 17mm」（§7.4 决策 2）**完全同一条**：
  编辑器预览的意义就是所见即所得。`:deep()` 编译成 `[data-v-x] .gs2-layout-canvas`（后代选择器），
  无论子元素有没有 scope 属性都能命中，所以这是**只增不减**的改动（不影响另外 5 条的逐字保真）。

  TODO(未确认): 「这 3 条在旧版是死规则」是从「CSS 文件里选择器带 `[data-v-c251bbdd]`」+
  「Vue 的 scoped 属性不加到 `v-html` 内容上」推出来的，**没有在真实浏览器里看过旧版编辑器**。
  真机眼验时重点看一处即可：旧的编辑器里「纸」是**灰底**（死规则）还是**白底带阴影**（规则生效）。
*/
:deep(.gs2-layout-page-wrap),
:deep(.ps2-layout-page-wrap) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
:deep(.gs2-layout-page-label),
:deep(.ps2-layout-page-label) {
  color: #666;
  font-size: 12px;
  line-height: 18px;
  text-align: right;
}
:deep(.gs2-layout-canvas),
:deep(.ps2-layout-canvas) {
  position: relative;
  background: #fff;
  box-sizing: border-box;
  box-shadow: 0 2px 10px #0003;
  overflow: hidden;
}

/*
  以下是**新版自己的排版胶水**，不属于 §4.2 那 8 条（它们只覆盖编辑器外壳，不含 footer 与排序按钮）：
  footer 三颗按钮的右对齐行、以及列设置表里 ↑↓ 两颗按钮的排布。
*/
.gs2-layout-footer,
.ps2-layout-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* `:deep` —— 这两颗按钮是 `n-data-table` 的 render 函数产出的，不是本组件的模板元素 */
:deep(.gs2-column-order),
:deep(.ps2-column-order) {
  display: flex;
  gap: 2px;
}
</style>
