<!--
  「编辑生产单」弹窗 —— 旧版 **`ProductionEditOld`**（`Hui.formatted.js:6529-6860`，挂在 Home `HOME:12211`）。

  ⚠️⚠️ **ic=14 用的不是 `ProductionEdit`**（施工图 §6.5 CONFIRMED，三条独立证据）——
  它是**专为「配对行」写的另一个组件**，`DocEditDialog.vue`（平铺行 + 8 列固定定义）**顶不了**：
  · 数据形状是 **`oldSheet` 嵌套族**（`doorsheet`/`doorframe`/`windows` 在 `oldSheet[0]` 里）；
  · **双联**：第二联的输入框全部带 `void 0 !== e.orderID1` 一类条件，不存在就整块不渲染；
  · 保存时会**重建配对形状**（`size` 拆成数组、`oldSheet` 重新拼、临时键删掉）。

  ⇒ **方案选择（本轮拍板）**：**另写一个组件**，不动 `DocEditDialog`。
    理由有三：
      1. 它的**转换字段清单**与 `DocEditDialog` 完全不同 —— 后者是「`brFields` 里 5 个平铺键」，
         前者是「`oldSheet[0].{doorsheet,doorframe,windows}` + `remark`」（+ 第二联各一份）。
         加 adapter 要把「嵌套拆装 + 双联 + 每格守卫」全塞进 `DocEditDialog` 的参数里，
         而 `DocEditDialog` 现在服务两张已交付的单据（GS2/PS2）—— 风险和收益不成比例。
      2. 它的**列定义是两套 21 列**（第一联 11 + 第二联 10），且第二联每格有独立守卫，
         `DocEditDialog` 的 `columns: {key,label,width}[]` 参数化表达不了。
      3. 它的**按钮位置不同**：确认/取消在**表体上方**（旧版如此），不是在 footer。
     ⇒ 选择「另写」，但仍然**接进共用的 `DocSheetDrawer`**（它已参数化出 `editDialog` 注入口）。

  **数据回环是自洽的**（§6.5 CONFIRMED）：配对进、配对出 —— 编辑弹窗与预览读的是
  **同一份已配对的行**，保存后只回写这行、**不重新配对**（决策 D2/D3；旧版 `wc` 的二次配对
  是长期潜伏的脏数据源，新版不复刻，见 `DocSheetDrawer.onRowsSaved`）。

  ⚠️ **有意偏离（1 处，观感）**：旧版这个弹窗**完全没有 `title`**（`Hui.formatted.js:6585-6587`）。
    本组件接受并显示 `title`（抽屉传的是工具条那颗按钮的文案「编辑生产单」）——
    与 `DocEditDialog` 那条**已在仓库里成立**的新版自有偏离**同一条**（该组件头注已写明：
    「旧版那个弹窗本身没有 title，新版拿按钮文案当标题，这是新版自有的一处，GS2 已这么做」）。
    ⇒ 为保持两张单据的编辑弹窗观感一致，这里沿用，不单独分叉。
-->
<template>
  <n-modal
    v-model:show="showModel"
    preset="card"
    :title="title"
    :style="{ width: '1500px' }"
    :bordered="false"
    display-directive="show"
  >
    <div class="production-edit-old-wrapper">
      <!-- 旧版把三颗按钮放在**表体上方**（`Hui.formatted.js:6589-6600`），不是 footer -->
      <div class="button-group">
        <n-button type="primary" size="medium" round @click="confirm">确认修改</n-button>
        <n-button size="medium" round @click="cancel">取消</n-button>
      </div>

      <!-- 不给 `row-key`：本表没有选择/展开/树形，行身份对渲染无意义（Naive 退回按 index） -->
      <n-data-table
        :data="draft"
        :columns="columns"
        :scroll-x="scrollX"
        bordered
        size="small"
        :style="{ width: '100%' }"
      />
    </div>
  </n-modal>

  <!-- 上传弹窗（旧版 `Hui.formatted.js:6837-6857`）：宽 480px，**点遮罩不关** -->
  <n-modal
    v-model:show="uploadVisible"
    preset="card"
    title="上传图片"
    style="width: 480px"
    :mask-closable="false"
    display-directive="show"
  >
    <!--
      旧版是 `el-upload drag`（可拖入、也可点击）。这里用原生 `<input type=file>` + 一层 drop 区还原
      —— 与 `DocEditDialog.vue` 同一处置（它已经用原生 input 顶掉 el-upload），但**补回了拖拽**，
      因为旧版这块的提示文案就是「将图片拖到此处，或点击上传」，是**真的能拖**的。
    -->
    <div class="upload-dialog" @dragover.prevent @drop.prevent="onDrop">
      <input ref="fileEl" type="file" accept="image/*" @change="onFileChange" />
      <div class="upload-tip">将图片拖到此处，或点击上传</div>
      <div class="upload-tip">（只能上传 jpg/png 图片文件）</div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <n-button @click="uploadVisible = false">取消</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { NButton, NDataTable, NInput, NModal, useMessage, type DataTableColumns } from 'naive-ui'

/** 一行数据。`oldSheet` 是**数组**（旧版恒长 1），配对行的第二联键带 `1` 后缀。 */
type Row = Record<string, unknown>

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /**
     * 父组件的行数据 —— ★ **已配对的那一份**（`produceRows` 的产物），本弹窗只读它，
     * 编辑期改的是内部副本。
     */
    rows: Row[]
    /** 弹窗标题（新版自有，见文件头注的「有意偏离」）。 */
    title?: string
  }>(),
  { title: '编辑生产单' },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  save: [Row[]]
}>()

const message = useMessage()

const showModel = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

/** 草稿（旧版 `o`）—— 打开时由 `rows.map(toDraft)` 重建**新对象**，编辑期不污染父数据。 */
const draft = ref<Row[]>([])

/** 上传弹窗（旧版 `c` / `n` / `d`）。 */
const uploadVisible = ref(false)
const fileEl = ref<HTMLInputElement | null>(null)
/**
 * 当前上传的行与槽位（旧版 `n` / `d`）。
 * ⚠️ **非响应式**：它只在异步 `FileReader.onload` 里被用来定位要写的键，
 *    写成 `ref` 反而会被 Vue 包一层 —— 存**表格 render 给出的那个响应式行对象**才是旧版的语义。
 */
let uploadRow: Row | null = null
let uploadSlot = ''

/**
 * 第二联是否整组渲染（旧版 `r` computed，`Hui.formatted.js:6538`）：
 * `rows.length > 0 && rows.some(row => row.orderID1 !== undefined)`。
 *
 * ★ 这是**整组**的守卫；每格还有一道自己的守卫（`row.<字段> !== undefined` → 否则出 `-`）。
 */
const showSecond = computed(
  () => draft.value.length > 0 && draft.value.some((r) => r.orderID1 !== undefined),
)

/** 表体总宽 = 第一联 1820 + 第二联 1670（超出 1500px ⇒ 横向滚动，照旧版 el-table 的行为）。 */
const scrollX = computed(() => (showSecond.value ? 1820 + 1670 : 1820))

// ---------------------------------------------------------------------------
// 数据 ↔ 草稿（旧版 `s` / `u`，`Hui.formatted.js:6538-6559`）
// ---------------------------------------------------------------------------

/** `<br>` → `\n`（旧版一律 `/<br>/gi`，**大小写不敏感**、全局）。 */
function brToNl(v: unknown): string {
  return String(v ?? '').replace(/<br>/gi, '\n')
}

/** `\n` → `<br>`（旧版是 `/\n/g`，**没有 `i`**，写回字面 `<br>`）。 */
function nlToBr(v: unknown): string {
  return String(v ?? '').replace(/\n/g, '<br>')
}

/** 旧版 `size` 的两种形态：数组 → `join("\n")`；其它 → 原样（假值落空串）。 */
function sizeToDraft(v: unknown): string {
  return Array.isArray(v) ? v.join('\n') : v ? String(v) : ''
}

/** `oldSheet[0]`（拿不到就是 `{}`）。 */
function cellOf(v: unknown): Row {
  return Array.isArray(v) && v.length > 0 ? (v[0] as Row) : {}
}

/**
 * **数据 → 草稿**（旧版 `s`，`Hui.formatted.js:6538-6542`，逐字移植）。
 *
 * 要点（照抄，别"顺手补齐"）：
 * · `<br>`→`\n` 的字段是 `oldSheet[0].{doorsheet,doorframe,windows}` + `remark`（+ 第二联各一份），
 *   **不是** `ProductionEdit` 那 5 个平铺键（那是有意不同的两个组件，§6.5）；
 * · `_windows` 的取值链是 **`oldSheet[0].windows` 优先、退化到顶层 `e.windows`**；
 * · `_size` 两个分支都写（数组 `join("\n")` / 否则原样），`size` 原键**保留**在草稿里；
 * · `_doorsheet` 等三键**无论有没有 `oldSheet` 都会被写**（没数据时是空串）。
 */
function toDraft(e: Row): Row {
  const i: Row = { ...e }
  i._size = sizeToDraft(e.size)

  if (Array.isArray(e.oldSheet) && e.oldSheet.length > 0) {
    const cell = cellOf(e.oldSheet)
    i._doorsheet = brToNl(cell.doorsheet) || ''
    i._doorframe = brToNl(cell.doorframe) || ''
    i._windows = brToNl(cell.windows) || brToNl(e.windows) || ''
  } else {
    i._doorsheet = ''
    i._doorframe = ''
    i._windows = brToNl(e.windows) || ''
  }
  i.remark = brToNl(e.remark)

  // ★ 第二联只在 `orderID1 !== undefined` 时才有草稿键 —— 与渲染守卫同一条判据
  if (e.orderID1 !== undefined) {
    i._size1 = sizeToDraft(e.size1)
    if (Array.isArray(e.oldSheet1) && e.oldSheet1.length > 0) {
      const cell = cellOf(e.oldSheet1)
      i._doorsheet1 = brToNl(cell.doorsheet) || ''
      i._doorframe1 = brToNl(cell.doorframe) || ''
      i._windows1 = brToNl(cell.windows) || brToNl(e.windows1) || ''
    } else {
      i._doorsheet1 = ''
      i._doorframe1 = ''
      i._windows1 = brToNl(e.windows1) || ''
    }
    i.remark1 = brToNl(e.remark1)
  }
  return i
}

/**
 * **草稿 → 数据**（旧版 `u`，`Hui.formatted.js:6543-6559`，逐字移植）。
 *
 * 要点：
 * · `size` = `_size.split("\n").filter(s => s.trim() !== "")` —— **按 `trim` 丢空行**、保留行内容原样；
 * · `oldSheet` **无条件重建**（`{...旧 cell, doorsheet, doorframe, windows}`）；
 * · 删掉的临时键：`_size`/`_doorsheet`/`_doorframe`/`_windows`（第二联再删带 `1` 的四个）；
 * · `_*` 之外的键**一律原样透传**（`glass1`/`material1`/`color1`/`doorImg1` 都不是临时键）。
 */
function toData(e: Row): Row {
  const x: Row = { ...e }

  x.size = e._size ? String(e._size).split('\n').filter((s) => s.trim() !== '') : []
  delete x._size

  x.oldSheet = [
    {
      ...cellOf(e.oldSheet),
      doorsheet: nlToBr(e._doorsheet),
      doorframe: nlToBr(e._doorframe),
      windows: nlToBr(e._windows),
    },
  ]
  delete x._doorsheet
  delete x._doorframe
  delete x._windows

  x.remark = nlToBr(e.remark)

  if (e.orderID1 !== undefined) {
    x.size1 = e._size1 ? String(e._size1).split('\n').filter((s) => s.trim() !== '') : []
    delete x._size1

    x.oldSheet1 = [
      {
        ...cellOf(e.oldSheet1),
        doorsheet: nlToBr(e._doorsheet1),
        doorframe: nlToBr(e._doorframe1),
        windows: nlToBr(e._windows1),
      },
    ]
    delete x._doorsheet1
    delete x._doorframe1
    delete x._windows1

    x.remark1 = nlToBr(e.remark1)
  }
  return x
}

// ---------------------------------------------------------------------------
// 打开 / 关闭（旧版 `Hui.formatted.js:6560-6565`）
// ---------------------------------------------------------------------------

/**
 * ⚠️ 旧版**只在「由假变真」时重建草稿**，关闭时不重建（所以关窗那一刻的草稿会留到下次打开才被覆盖）。
 * Naive 这边 `display-directive="show"` 保持挂载，语义一致 —— 照抄。
 */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    draft.value = props.rows.map(toDraft)
  },
)

/** 「取消」（旧版 `b`）：**只关窗**，不做任何数据回滚（父数据从未被改过）。 */
function cancel(): void {
  showModel.value = false
}

/** 「确认修改」（旧版 `V`）：回写 → 关窗 → 提示。顺序照旧版（先 emit 再关）。 */
function confirm(): void {
  emit(
    'save',
    draft.value.map(toData),
  )
  showModel.value = false
  message.success('生产单已更新')
}

// ---------------------------------------------------------------------------
// 门图上传（旧版 `i` / `f`，`Hui.formatted.js:6566-6577`）—— **纯本地 DataURL，不发请求**
// ---------------------------------------------------------------------------

/** 旧版 `i(row, slot)`：`slot` 是 `""`（第一联）或 `"1"`（第二联），决定写 `doorImg` 还是 `doorImg1`。 */
function openUpload(row: Row, slot: string): void {
  uploadRow = row
  uploadSlot = slot
  uploadVisible.value = true
  // 每次重开都要清空，否则选同一个文件不触发 change
  requestAnimationFrame(() => {
    if (fileEl.value) fileEl.value.value = ''
  })
}

/**
 * 旧版 `f(file)`：
 * · 校验 `file.raw.type.startsWith("image/")`，否则 `ElMessage.error("只能上传图片文件!")`（半角 `!`）；
 * · 注意与上传框提示「（只能上传 jpg/png 图片文件）」是**两条不同的字符串**；
 * · `c.value = false`（关上传弹窗）在 `readAsDataURL` 之后**同步**执行，
 *   而 `onload` 稍后仍会写入 —— 因为 `n`（当前行）**没有被清空**。这里保持同样的顺序。
 */
function onFileChange(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) acceptFile(file)
}

/** 拖拽入口（旧版 `el-upload drag` 的 drop 分支）—— 与点击上传走**同一条**校验/读取路径。 */
function onDrop(e: DragEvent): void {
  const file = e.dataTransfer?.files?.[0]
  if (file) acceptFile(file)
}

/**
 * 旧版 `f(file)` 的公共体：校验类型 → `FileReader.readAsDataURL` → 写到当前行的 `doorImg`/`doorImg1`。
 *
 * ⚠️ 顺序照抄：`c.value = false`（关上传弹窗）在 `readAsDataURL` 之后**同步**执行，
 *    而 `onload` 稍后仍会写入 —— 因为「当前行」的引用**没有被清空**。
 */
function acceptFile(file: File): void {
  if (!uploadRow) return
  if (!file.type.startsWith('image/')) {
    message.error('只能上传图片文件!')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (uploadRow) uploadRow[uploadSlot ? 'doorImg' + uploadSlot : 'doorImg'] = String(reader.result || '')
  }
  reader.readAsDataURL(file)
  uploadVisible.value = false
}

// ---------------------------------------------------------------------------
// 两种单元格的 render
// ---------------------------------------------------------------------------

/** 可编辑文本框 —— 旧版 `el-input` 的 `:input-style="{fontSize:'18px',lineHeight:'1.6'}"`。 */
function textInput(row: Row, key: string): ReturnType<typeof h> {
  return h(NInput, {
    value: row[key] as string,
    size: 'small',
    inputProps: { style: 'font-size:18px;line-height:1.6' },
    'onUpdate:value': (v: string) => {
      row[key] = v
    },
  })
}

/** 多行文本框（`type="textarea"`）。`autosize` 只有**第一联**的四个键有（第二联没有，照抄）。 */
function textArea(row: Row, key: string, autosize = false): ReturnType<typeof h> {
  return h(NInput, {
    value: row[key] as string,
    type: 'textarea',
    size: 'small',
    autosize: autosize ? { minRows: 5, maxRows: 10 } : undefined,
    inputProps: { style: 'font-size:18px;line-height:1.6' },
    'onUpdate:value': (v: string) => {
      row[key] = v
    },
  })
}

/**
 * 门图单元格（旧版 `Hui.formatted.js:6697-6714` / 第二联同构）：
 * 有图出图、无图出 `-`，下面两颗按钮「上传」/「删除」。
 * 「删除」**只是把该键置空字符串**（不删键）—— 照抄。
 *
 * ⚠️ **有意偏离（观感）**：旧版是 `el-image fit="contain"`（80×80、无 `preview-src-list`），
 * 这里用原生 `<img>` + 同样的 80×80 + `object-fit:contain` —— 视觉等价，且不需要 Naive
 * 图片组件的加载态/错误槽。
 */
function imageCell(row: Row, key: string, slot: string): ReturnType<typeof h> {
  return h('div', { class: 'door-image-cell' }, [
    row[key]
      ? h('img', {
          src: String(row[key]),
          style: 'width:80px;height:80px;object-fit:contain;',
        })
      : h('span', '-'),
    h('div', { class: 'door-image-actions' }, [
      h(
        NButton,
        { size: 'small', type: 'primary', onClick: () => openUpload(row, slot) },
        { default: () => '上传' },
      ),
      h(
        NButton,
        {
          size: 'small',
          // ⚠️ 旧版是 Element Plus 的 `type="danger"`（红）。Naive 里红色对应 **`error`**
          //（它的 `ButtonType` 没有 `danger`）—— 观感等价，语义同一条。
          type: 'error',
          onClick: () => {
            row[key] = ''
          },
        },
        { default: () => '删除' },
      ),
    ]),
  ])
}

/**
 * 第二联每一格的守卫（旧版是 `void 0 !== e.<字段> ? <输入框> : <span>-</span>`）。
 *
 * ⚠️ 判据是 `row[key] === undefined`（不是假值）—— 空串、`0` 都照常渲染输入框。照抄。
 */
function guarded(
  key: string,
  render: (row: Row) => ReturnType<typeof h>,
): (row: Row) => ReturnType<typeof h> {
  return (row) => (row[key] === undefined ? h('span', '-') : render(row))
}

/**
 * 21 列 = 第一联 11 + 第二联 10（`Hui.formatted.js:6601-6835`）。
 *
 * ⚠️ 两处容易照搬错的细节（已按源码核对）：
 * · **第二联没有「地址2」**（10 列，不是 11 列）；
 * · 第二联**整组**由 `showSecond` 守卫，**每格**再各自守卫一次。
 */
const columns = computed<DataTableColumns<Row>>(() => {
  const first: DataTableColumns<Row> = [
    { title: '单号', key: 'orderID', width: 130, render: (row) => textInput(row, 'orderID') },
    { title: '型材', key: 'material', width: 180, render: (row) => textArea(row, 'material') },
    { title: '颜色', key: 'color', width: 120, render: (row) => textInput(row, 'color') },
    // 「尺寸」改的是**临时键** `_size`（旧版 `prop="_size"`），保存时拆回 `size` 数组
    { title: '尺寸', key: '_size', width: 150, render: (row) => textArea(row, '_size') },
    { title: '玻璃', key: 'glass', width: 150, render: (row) => textInput(row, 'glass') },
    { title: '地址', key: 'address', width: 150, render: (row) => textInput(row, 'address') },
    { title: '门扇材料', key: '_doorsheet', width: 200, render: (row) => textArea(row, '_doorsheet', true) },
    { title: '门框材料', key: '_doorframe', width: 200, render: (row) => textArea(row, '_doorframe', true) },
    { title: '亮窗/扣板', key: '_windows', width: 200, render: (row) => textArea(row, '_windows', true) },
    { title: '门图', key: 'doorImg', width: 160, render: (row) => imageCell(row, 'doorImg', '') },
    { title: '备注', key: 'remark', width: 180, render: (row) => textArea(row, 'remark') },
  ]

  if (!showSecond.value) return first

  const second: DataTableColumns<Row> = [
    // ⚠️ 第二联**没有「地址2」**（10 列，不是 11 列）
    // ⚠️ 第二联的四个多行框**没有 autosize**（第一联的 `_doorsheet`/`_doorframe`/`_windows` 有）
    { title: '单号2', key: 'orderID1', width: 130, render: guarded('orderID1', (row) => textInput(row, 'orderID1')) },
    { title: '型材2', key: 'material1', width: 180, render: guarded('material1', (row) => textArea(row, 'material1')) },
    { title: '颜色2', key: 'color1', width: 120, render: guarded('color1', (row) => textInput(row, 'color1')) },
    { title: '尺寸2', key: '_size1', width: 150, render: guarded('_size1', (row) => textArea(row, '_size1')) },
    { title: '玻璃2', key: 'glass1', width: 150, render: guarded('glass1', (row) => textInput(row, 'glass1')) },
    { title: '门扇2', key: '_doorsheet1', width: 200, render: guarded('_doorsheet1', (row) => textArea(row, '_doorsheet1')) },
    { title: '门框2', key: '_doorframe1', width: 200, render: guarded('_doorframe1', (row) => textArea(row, '_doorframe1')) },
    { title: '亮窗/扣板2', key: '_windows1', width: 200, render: guarded('_windows1', (row) => textArea(row, '_windows1')) },
    { title: '门图2', key: 'doorImg1', width: 160, render: guarded('doorImg1', (row) => imageCell(row, 'doorImg1', '1')) },
    { title: '备注2', key: 'remark1', width: 180, render: guarded('remark1', (row) => textArea(row, 'remark1')) },
  ]
  return [...first, ...second]
})
</script>

<style scoped>
/*
  ⚠️ **7 条 scoped CSS**（`legacy/css/Hui-39b802eb.css`，hash `data-v-da0814f4`）——
  这里把选择器从 Element Plus 的类名**翻译**成 Naive 的等价类名，规则本身逐字照抄
  （`!important`、无边框、透明背景、18px 全部保留）。渲染函数产出的元素不带本组件的
  scope 属性，所以一律走 `:deep()`。
*/
.production-edit-old-wrapper :deep(.n-data-table),
.production-edit-old-wrapper :deep(.n-data-table th),
.production-edit-old-wrapper :deep(.n-data-table td) {
  font-size: 18px !important;
}
.production-edit-old-wrapper :deep(.n-input__input-el),
.production-edit-old-wrapper :deep(.n-input__textarea-el) {
  border: none !important;
  padding: 2px 4px;
  background: transparent;
}
.production-edit-old-wrapper :deep(.n-input) {
  box-shadow: none !important;
  background: transparent;
  border: none !important;
}
.production-edit-old-wrapper :deep(.n-input__input-el),
.production-edit-old-wrapper :deep(.n-input input),
.production-edit-old-wrapper :deep(.n-input__textarea-el),
.production-edit-old-wrapper :deep(.n-input textarea),
.production-edit-old-wrapper :deep(.n-button),
.production-edit-old-wrapper :deep(.n-button span) {
  font-size: 18px !important;
}
.door-image-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.door-image-actions {
  display: flex;
  gap: 8px;
}
.button-group {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

/* 新版自有：上传弹窗内两行提示的排版（旧版靠 el-upload 的 drag 区域撑开，没有独立样式） */
.upload-tip {
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
