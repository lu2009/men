<!--
  「编辑玻璃单」弹窗 —— 旧版 **`GlassEdit`**（`legacy/js/Hui.formatted.js:5662-5871`，`__name:"GlassEdit"`），
  对应旧版 `ic=3`（Home 抽屉入口 `玻璃订单`，`docs/edit-dialog-recon/01-edit-table.md` §1/§2/§3.3）。

  挂载点（CONFIRMED，`Home.formatted.js:12196` / 偏移 515349）：
      createVNode(n /* Hui 导出 c = GlassEdit */, {
        modelValue: Ec.value, "glass-data": Nc.value, onSave: Ac
      })
  打开（`Dc`，偏移 431378）：`Nc.value.length ? Ec.value = true : ElMessage.warning('暂无玻璃单数据')`。
  保存（`Ac`，偏移 431502）：`Nc.value = e`；**再把 `rc[0].glassInfoList = Nc.value`**；
  预览开着（`eo && ic===3`）→ 用 `template.glassHole` + `rc` 重渲。

  ⚠️ **本弹窗是「平铺行 + 纯拷贝」**：跟 `LabelEdit` 一样**一个字段都不做 `<br>` ↔ `\n` 转换**
  （进出场都是 `map(e => ({...e}))`）。别把它当成 `ProductionEdit`（那个要转 5 个字段）。

  ⚠️ **为什么不复用 `DocEditDialog.vue`**（该组件是「列定义 + `brFields` + `imageField` 参数化」的通用弹窗）：
  本弹窗的差异不止「列/字段集」，有 4 处结构件它表达不了 ——
    1. **操作列**（`fixed:"right"`，`增加`/`删除` 两颗按钮）——`DocEditDialog` 没有操作列；
    2. **图片列的按钮形态不同**：本弹窗是「有图出图、无图出 `-`」+ `上传`/`删除` 两颗按钮，
       而 `DocEditDialog` 是「整格可点 = 上传」且**没有删除按钮**；
    3. **上传子弹窗的形状不同**：本弹窗是 `el-upload drag`（可拖入）+ `将图片拖到此处，或点击上传`
       两行提示，`DocEditDialog` 只有一个裸 `<input type=file>`；
    4. **列宽全是逐列写死的像素值**（单号 155 / 客户 140 / … / 操作 100），且**表体字号 18px/20px**
       —— `DocEditDialog` 的表是等宽自适应的 `table-layout` 观感。
  改 `DocEditDialog` 把这 4 条塞进参数，会动到它已经在服务的 GS2/PS2 两张单据 —— 风险大于收益。
  ⇒ 与 `ProductionSheetEditDialog.vue` / `QualifiedLabelEditDialog.vue` **同一处置**：另写一个。

  ⚠️ **有意偏离（1 处，观感）**：旧版这个弹窗**完全没有 `title`**（`el-dialog` 只给了 width）。
    本组件接受并显示 `title` —— 与 `DocEditDialog.vue` / `ProductionSheetEditDialog.vue`
    已在仓库里成立的那条新版自有偏离**同一条**（拿工具条按钮文案当标题）。
    ⚠️ 与 `QualifiedLabelEditDialog.vue` 的选择**不一致**（那个收了 title 但不渲染）；
    两派都在仓库里存在，这里跟「C 家族」那一派，因为 `玻璃订单` 与 GS2/PS2 是同一排按钮。

  ⚠️ **所有编辑只改内存**（施工图 §5 CONFIRMED）：`Ac` 只写 `Nc` + `rc[0].glassInfoList`，
    不落库、不回写 Hui。刷新页面即回退。本组件只负责 `emit('save', rows)`，回灌由调用方做。

  行为逐条照旧版：
  · 打开时 `draft = rows.map(r => ({...r}))`（**新对象** ⇒ 编辑期不污染父数据、取消即丢弃）；
  · 「确认修改」→ `emit('save', draft.map(r => ({...r})))` + 关窗 + `ElMessage.success('玻璃单已更新')`；
  · 「取消」/ESC/右上 X → 丢弃副本（旧版 `onClose: r` 与取消按钮同一个 handler）；
  · 操作列「增加」→ 在本行**之后**插入一条**新建的空白行**
    （`{OrderID:"",client:"",glassName:"",width:0,height:0,thickness:0,quantity:1,doorImg:"",remark:""}`），
    索引非法（不是 number / 越界）时退回 `push`；
  · 操作列「删除」→ `splice(index,1)`。**没有「至少保留一行」的守卫**（这一点与 `LabelEdit` 不同，
    别照抄 LabelEdit 那条 warning）。
  · 图片格「上传」→ 开上传子弹窗，「删除」→ 把 `doorImg` 置空串（**不删键**）。
-->
<template>
  <n-modal
    v-model:show="showModel"
    preset="card"
    :title="title"
    :style="{ width: '1200px' }"
    :bordered="false"
    display-directive="show"
  >
    <div class="glass-edit-wrapper">
      <!-- 旧版把两颗按钮放在**表体上方**（`Hui.formatted.js:5701-5708`），不是 footer -->
      <div class="button-group">
        <n-button type="primary" @click="confirm">确认修改</n-button>
        <n-button @click="cancel">取消</n-button>
      </div>

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

  <!-- 上传弹窗（`Hui.formatted.js:5848-5868`）：宽 480px，**点遮罩不关** -->
  <n-modal
    v-model:show="uploadVisible"
    preset="card"
    title="上传图片"
    style="width: 480px"
    :mask-closable="false"
    display-directive="show"
  >
    <div class="upload-dialog" @dragover.prevent @drop.prevent="onDrop">
      <input ref="fileEl" type="file" accept="image/*" @change="onFileChange" />
      <div class="upload-tip">将图片拖到此处，或<em>点击上传</em></div>
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
import {
  NButton,
  NDataTable,
  NInput,
  NInputNumber,
  NModal,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'

/**
 * 玻璃单的一行。这 9 个键**就是 `GlassEdit` 的 9 个可编辑列**，与
 * `utils/printPayloads.ts` 的 `glassInfoProduces()` 产出的行**逐键同名**
 * （`date` 是表格外的模板字段，不在这里编辑；用索引签名兜住它，免得调用方还要拆）。
 */
export interface GlassEditRow {
  OrderID?: string
  client?: string
  glassName?: string
  width?: number | string
  height?: number | string
  thickness?: number | string
  quantity?: number | string
  doorImg?: string
  remark?: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /**
     * 父组件的玻璃单行 —— 即旧版的 `glass-data`（= `Nc.value` = `rc[0].glassInfoList`）。
     * **本弹窗只读它**，编辑期改的是内部副本。
     */
    rows: GlassEditRow[]
    /** 弹窗标题（新版自有，见文件头注的「有意偏离」）。 */
    title?: string
  }>(),
  { title: '编辑玻璃单' },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  /** 「确认修改」：回传**编辑后的整份行数组**（旧版 `d` 里那个 `emit("save", …)`）。 */
  save: [GlassEditRow[]]
}>()

const message = useMessage()

const showModel = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

/** 草稿（旧版 `l`）—— 打开时由 `rows.map(r => ({...r}))` 重建**新对象**。 */
const draft = ref<GlassEditRow[]>([])

/** 上传子弹窗（旧版 `o`）与当前上传目标行（旧版 `c`，存的是**表格 render 给出的那个响应式行对象**）。 */
const uploadVisible = ref(false)
const fileEl = ref<HTMLInputElement | null>(null)
let uploadRow: GlassEditRow | null = null

/**
 * 打开时纯浅拷贝（旧版 `Vue.watch(modelValue)` → `l = glassData.map(e => ({...e}))`）。
 *
 * ⚠️ **必须是新对象**：旧版就是靠这个做到「编辑期不污染父数据、取消即丢弃」，
 * 别改成直接引用父数组。**不做任何字段变换**（本弹窗的核心特征，与 `LabelEdit` 同）。
 */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    draft.value = props.rows.map((row) => ({ ...row }))
  },
  { immediate: true },
)

/**
 * 「确认修改」（旧版 `d`）：再拷一份回写 → 关窗 → `ElMessage.success('玻璃单已更新')`。
 *
 * ⚠️ 回传的是**整份数组**（不是增量）—— 调用方照旧版 `Ac` 的写法直接 `rows = e` 覆盖即可。
 * 旧版还会把结果写回 `rc[0].glassInfoList`，那是**调用方**的责任，不在本组件。
 */
function confirm(): void {
  emit(
    'save',
    draft.value.map((row) => ({ ...row })),
  )
  showModel.value = false
  message.success('玻璃单已更新')
}

/** 「取消」/ESC/右上 X（旧版 `r`）：丢弃副本 —— 父数据从未被改。 */
function cancel(): void {
  showModel.value = false
}

/**
 * 操作列「增加」（旧版 `Hui.formatted.js:5831-5838`）：在本行**之后**插一条**新建的**空白行。
 *
 * ⚠️ 三个易错点，逐条照抄：
 *  1. 插入位置是 `index + 1`（**不是**表尾）；
 *  2. 空白行是**每次点击现构造的对象**（旧版在 handler 里写对象字面量），别提到外面共用引用；
 *  3. 索引非法时（`typeof index !== 'number'` 或越界）**退回 `push`**，不是直接 return。
 */
function addRow(index: number): void {
  const blank: GlassEditRow = {
    OrderID: '',
    client: '',
    glassName: '',
    width: 0,
    height: 0,
    thickness: 0,
    quantity: 1,
    doorImg: '',
    remark: '',
  }
  if (typeof index === 'number' && index >= 0 && index < draft.value.length) {
    draft.value.splice(index + 1, 0, blank)
  } else {
    draft.value.push(blank)
  }
}

/**
 * 操作列「删除」（旧版 `Hui.formatted.js:5839-5842`）：越界直接 return，否则 `splice(index,1)`。
 *
 * ⚠️ **没有「至少保留一行」的守卫** —— 删到 0 行是允许的（旧版如此）。
 *   别照抄 `LabelEdit` 那条 `至少需要保留一个标签`。
 */
function deleteRow(index: number): void {
  if (index < 0 || index >= draft.value.length) return
  draft.value.splice(index, 1)
}

// ------------------------------------------------------------------ 表格列 //

/** 单行文本输入（旧版逐格写的 `input-style` 字号/行高照抄）。 */
function textInput(row: GlassEditRow, key: string, fontSize = '18px'): ReturnType<typeof h> {
  return h(NInput, {
    value: row[key] as string,
    size: 'small',
    inputProps: { style: `font-size:${fontSize};line-height:1.6` },
    'onUpdate:value': (v: string) => {
      row[key] = v
    },
  })
}

/**
 * 多行文本输入。旧版这几格都是 `type="textarea"`，`rows` 逐列不同：
 * 客户 3 / 玻璃名称 **没给 rows ⇒ el-input 默认 2** / 备注 3。
 */
function textArea(row: GlassEditRow, key: string, rows: number, fontSize = '18px'): ReturnType<typeof h> {
  return h(NInput, {
    value: row[key] as string,
    type: 'textarea',
    rows,
    size: 'small',
    inputProps: { style: `font-size:${fontSize};line-height:1.6` },
    'onUpdate:value': (v: string) => {
      row[key] = v
    },
  })
}

/**
 * 数字格（旧版是 `el-input type="number"` + `modelModifiers:{number:true}`）。
 *
 * ⚠️ **有意偏离（观感 + 粗存类型）**：Naive 的 `n-input` **没有 `type="number"`**
 * （只有 text/password/textarea），对应物是 `n-input-number`；为保住「数据原样往返」，用
 * `n-input-number` + `v-model:value` 桥接 —— 原来不是数字的值（如 `thickness` 在载荷里可能是
 * 空串，`l.glass_thickness || ''`）读进来显示为 `null`、写回时仍还原成 `''`，**不改数据类型**；
 * 且**只有用户真的改过那一格才会触发桥**，没碰过的值原样留在草稿里。
 * INTERPRETED：旧版 `el-input` 不处理组件级 `modelModifiers.number`（没声明这个 prop），
 * 故旧版实际存的是**字符串**；本版存数字。打印模板只做文本插值，两者渲染一致。
 */
function numberInput(row: GlassEditRow, key: string, fontSize = '18px'): ReturnType<typeof h> {
  const raw = row[key]
  return h(NInputNumber, {
    value: typeof raw === 'number' || typeof raw === 'string' ? (Number.isFinite(Number(raw)) && raw !== '' ? Number(raw) : null) : null,
    size: 'small',
    showButton: false,
    style: 'width:100%',
    inputProps: { style: `font-size:${fontSize};line-height:1.6` },
    'onUpdate:value': (v: number | null) => {
      row[key] = v === null ? '' : v
    },
  })
}

/**
 * 挖孔图格（旧版 `Hui.formatted.js:5792-5814`）：有图出图、无图出 `-`，下面两颗按钮。
 *
 * ⚠️ 图片尺寸是**宽 70px × 高 130px**（`el-image` 的 `style:{width:"70px",height:"130px"}`，
 * `fit:"contain"` —— 已用 `_0x309a` 解码表逐位复核，不是常见的正方形）。别「顺手改成 80×80」。
 * 「删除」**只把 `doorImg` 置空串**（不删键）；「上传」开子弹窗并记录目标行。
 */
function imageCell(row: GlassEditRow): ReturnType<typeof h> {
  return h('div', { class: 'glass-image-cell' }, [
    row.doorImg
      ? h('img', { src: String(row.doorImg), style: 'width:70px;height:130px;object-fit:contain;' })
      : h('span', '-'),
    h('div', { class: 'glass-image-actions' }, [
      h(NButton, { size: 'small', type: 'primary', onClick: () => openUpload(row) }, { default: () => '上传' }),
      h(
        NButton,
        {
          size: 'small',
          // ⚠️ 旧版是 Element Plus 的 `type="danger"`（红）。Naive 的 ButtonType 没有 `danger`，
          // 对应物是 `error`（同一档语义色）—— 与 `ProductionSheetEditDialog.vue` 同一处置。
          type: 'error',
          onClick: () => {
            row.doorImg = ''
          },
        },
        { default: () => '删除' },
      ),
    ]),
  ])
}

/** 操作列（旧版 `fixed:"right"`、宽 100）：`增加`（success）/ `删除`（danger→error）。 */
function opsCell(_row: GlassEditRow, index: number): ReturnType<typeof h> {
  return h('div', { class: 'glass-edit-ops' }, [
    h(NButton, { size: 'small', type: 'success', onClick: () => addRow(index) }, { default: () => '增加' }),
    h(NButton, { size: 'small', type: 'error', onClick: () => deleteRow(index) }, { default: () => '删除' }),
  ])
}

/**
 * 9 列 + 「操作」列，**顺序与宽度逐字照抄**旧版 `Hui.formatted.js:5714-5846`。
 * 列 key 就是**行对象的键**（`OrderID`/`client`/…），不做任何改名。
 */
const columns = computed<DataTableColumns<GlassEditRow>>(() => [
  { title: '单号', key: 'OrderID', width: 155, render: (row) => textInput(row, 'OrderID') },
  { title: '客户', key: 'client', width: 140, render: (row) => textArea(row, 'client', 3) },
  { title: '玻璃名称', key: 'glassName', width: 160, render: (row) => textArea(row, 'glassName', 2) },
  { title: '宽度(mm)', key: 'width', width: 110, render: (row) => numberInput(row, 'width') },
  // 高度/厚度/数量三格旧版写的是 **20px**（其余列 18px）—— 照抄
  { title: '高度(mm)', key: 'height', width: 110, render: (row) => numberInput(row, 'height', '20px') },
  { title: '厚度(mm)', key: 'thickness', width: 110, render: (row) => numberInput(row, 'thickness', '20px') },
  { title: '数量', key: 'quantity', width: 70, render: (row) => numberInput(row, 'quantity', '20px') },
  { title: '挖孔图', key: 'doorImg', width: 120, render: (row) => imageCell(row) },
  // 备注列旧版**没有 width**（其余列都有）—— 给一个 minWidth，让它吃掉剩余宽度，观感等价
  { title: '备注', key: 'remark', minWidth: 180, render: (row) => textArea(row, 'remark', 3) },
  { title: '操作', key: '__ops', width: 100, fixed: 'right', render: opsCell },
])

/** 横向滚动宽 = 各定宽列之和（备注列是弹性列，不计入）。 */
const scrollX = 155 + 140 + 160 + 110 + 110 + 110 + 70 + 120 + 100

// ------------------------------------------------------------------ 上传 //

/** 记录目标行并开子弹窗（旧版「上传」按钮的 onClick：`c.value = row; o.value = true`）。 */
function openUpload(row: GlassEditRow): void {
  uploadRow = row
  uploadVisible.value = true
  // 每次重开都要清空，否则选同一个文件不触发 change。
  requestAnimationFrame(() => {
    if (fileEl.value) fileEl.value.value = ''
  })
}

/**
 * 旧版 `n`（`Hui.formatted.js:5680-5688`）：非图片先报错、否则 `FileReader.readAsDataURL`
 * 把结果写进目标行的 `doorImg`，**随后无条件关掉子弹窗**。
 *
 * ⚠️ 旧版走的是 `el-upload`（`action:"#"` + `auto-upload:false` + `before-upload:()=>false`）
 * 保证**不发请求**；这里用原生 `<input type=file>`（+ 拖放），天然不发请求。
 */
function pickFile(raw: File | undefined): void {
  if (!uploadRow || !raw) return
  if (!raw.type.startsWith('image/')) {
    message.error('只能上传图片文件!')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (uploadRow) uploadRow.doorImg = String(reader.result || '')
  }
  reader.readAsDataURL(raw)
  uploadVisible.value = false
}

function onFileChange(e: Event): void {
  pickFile((e.target as HTMLInputElement).files?.[0])
}

/** 拖放（旧版 `el-upload drag` 的拖入路径）。 */
function onDrop(e: DragEvent): void {
  pickFile(e.dataTransfer?.files?.[0])
}
</script>

<style scoped>
/*
  旧版的 scoped 样式只有 4 个空壳 class（`.glass-edit-wrapper` / `.button-group` /
  `.glass-image-cell` / `.glass-image-actions`），表格与输入框观感全靠 el-table/el-input 默认样式
  + 两处内联样式（表格 `width:100%; font-size:18px`；每格 `input-style` 字号/行高）。
  下面是**新版自己的排版胶水**（原生容器 + Naive 组件还原同一观感）。
*/
.glass-edit-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.button-group {
  display: flex;
  gap: 8px;
}
.glass-image-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.glass-image-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.glass-edit-ops {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.upload-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
}
.upload-tip {
  font-size: 13px;
  color: #909399;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
