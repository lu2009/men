<!--
  共用「编辑行数据」弹窗 —— 旧版 Home 侧那三个（`ProductionEdit` / `ProductionEditOld` / `LabelEdit`）
  的合并版。它们 props/emits 签名完全一致，只有「数据形状 + 列定义 + 转换字段」不同，
  所以新版**只做一个**，把差异做成参数。

  旧版三个分别在 `Hui.formatted.js` 的 6227 / 6529 / 5954，由 Home 挂载（不在各单据组件里）。
  对应旧版 `ic`：
    · ProductionEdit    → ic=1(hiprint 玻璃合片单) / ic=2(生产单) / ic=15(生产单2) / **ic=16(玻璃合片单)**
    · ProductionEditOld → ic=14(自定义生产单)，数据是 oldSheet 嵌套族 + 双联
    · LabelEdit         → ic=13(合格标签族)，标签行纯拷贝、一个字段都不做换行转换

  ⚠️ **新版只实现「平铺行」这一种**（`ProductionEdit`）。另两个的数据形状不同
  （oldSheet 嵌套拆装 / 门店特判多一列），要用的话各自包一层 adapter —— 先把扩展点留出来。

  行为逐条照旧版（`ProductionEdit`，Hui.formatted.js:6227-6412）：
    · **打开时**把父数据 `map` 成**新对象**再改 —— 编辑期间不污染父数据，直到「确认修改」才回写
    · 只对 `brFields` 里的字段做 `<br>` ↔ `\n` 转换（旧版是 5 个：basicInfo/doorsheet/
      doorframe/windows/door；`remark`/`OrderID`/`doorImg` **不转**）
    · 「取消」/ESC/点遮罩 = 丢弃副本（父数据从未被改）
    · 门图上传是**纯本地**（FileReader → dataURL），旧版靠 `before-upload:()=>false` +
      `auto-upload:false` + `action:"#"` 保证不发请求
-->
<template>
  <n-modal
    :show="show"
    :style="{ width: widthPx }"
    preset="card"
    :title="title"
    :bordered="false"
    @update:show="onShowChange"
  >
    <div class="doc-edit-table-wrap">
      <table class="doc-edit-table">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" :style="{ width: c.width + 'px' }">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in draft" :key="i">
            <td v-for="c in columns" :key="c.key">
              <!-- 图片列：只读展示 + 点击换图 -->
              <template v-if="c.key === imageField">
                <div class="doc-edit-img" @click="openUpload(row)">
                  <img v-if="row[c.key]" :src="String(row[c.key])" alt="" />
                  <span v-else class="doc-edit-img-empty">点击上传</span>
                </div>
              </template>
              <!-- 其余列：多行走 textarea（brFields），单行走 input -->
              <textarea
                v-else-if="brFields.includes(c.key)"
                v-model="row[c.key] as string"
                class="doc-edit-textarea"
                rows="2"
              />
              <n-input v-else v-model:value="row[c.key] as string" size="small" />
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!draft.length" class="doc-edit-empty">没有可编辑的行</div>
    </div>

    <template #footer>
      <div class="doc-edit-actions">
        <n-button @click="cancel">取消</n-button>
        <n-button type="primary" @click="confirm">确认修改</n-button>
      </div>
    </template>
  </n-modal>

  <!-- 门图上传（纯本地，不发请求） -->
  <n-modal :show="uploadShow" preset="card" title="上传图片" style="width: 480px" @update:show="uploadShow = $event">
    <input ref="fileEl" type="file" accept="image/*" @change="onFileChange" />
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NInput, NModal, useMessage } from 'naive-ui'

/** 一列的定义。`width` 单位 px（照旧版每列写死的宽度）。 */
export interface DocEditColumn {
  key: string
  label: string
  width: number
}

type Row = Record<string, unknown>

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 父组件的行数据。**本弹窗只读它**，编辑期改的是内部副本。 */
    rows: Row[]
    columns: DocEditColumn[]
    /** 需要做 `<br>` ↔ `\n` 转换的字段。旧版只转 5 个，且 `remark`/`OrderID` 不转。 */
    brFields?: string[]
    /** 图片字段（点击换图）。旧版是 `doorImg`。 */
    imageField?: string
    title?: string
    /** 「确认修改」后的成功提示。旧版是「生产单已更新」。 */
    successText?: string
    widthPx?: string
  }>(),
  {
    brFields: () => [],
    imageField: 'doorImg',
    title: '编辑',
    successText: '已更新',
    widthPx: '1400px',
  },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  save: [Row[]]
}>()

const message = useMessage()
const draft = ref<Row[]>([])
const uploadShow = ref(false)
const fileEl = ref<HTMLInputElement | null>(null)
let uploadRow: Row | null = null

const show = ref(props.modelValue)

/**
 * 打开时拷贝 + 换行转换。
 *
 * ⚠️ 必须是**新对象**（`{...row}`）：旧版就是靠这个做到「编辑期不污染父数据、
 * 取消即丢弃」。别改成直接引用父数组。
 */
watch(
  () => props.modelValue,
  (open) => {
    show.value = open
    if (!open) return
    draft.value = props.rows.map((row) => {
      const copy: Row = { ...row }
      for (const f of props.brFields) {
        const v = copy[f]
        copy[f] = typeof v === 'string' ? v.replace(/<br>/gi, '\n') : ''
      }
      return copy
    })
  },
  { immediate: true },
)

/** 关闭时同步 v-model（旧版也是靠 watch 关闭态回传）。 */
watch(show, (v) => {
  if (!v) emit('update:modelValue', false)
})

function onShowChange(v: boolean) {
  show.value = v
}

/** 「确认修改」：换行转回 → 回写父组件。转回的字段与转出去的**严格对应**。 */
function confirm() {
  const mapped = draft.value.map((row) => {
    const copy: Row = { ...row }
    for (const f of props.brFields) {
      const v = copy[f]
      copy[f] = typeof v === 'string' ? v.replace(/\n/g, '<br>') : ''
    }
    return copy
  })
  emit('save', mapped)
  show.value = false
  message.success(props.successText)
}

/** 「取消」/ESC/点遮罩：丢弃副本，父数据从未被改。 */
function cancel() {
  show.value = false
}

// ---------------------------------------------------------------- 门图上传 //

function openUpload(row: Row) {
  uploadRow = row
  uploadShow.value = true
  // 每次重开都要清空，否则选同一个文件不触发 change。
  requestAnimationFrame(() => {
    if (fileEl.value) fileEl.value.value = ''
  })
}

/**
 * 纯本地读取（照旧版：`FileReader.readAsDataURL`）。
 * 旧版用 `before-upload:()=>false` + `auto-upload:false` + `action:"#"` 保证不发请求 ——
 * 这里用原生 `<input type=file>`，天然不发请求。
 */
function onFileChange(e: Event) {
  const raw = (e.target as HTMLInputElement).files?.[0]
  if (!raw || !uploadRow) return
  if (!raw.type.startsWith('image/')) {
    message.error('只能上传图片文件!')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (uploadRow) uploadRow[props.imageField] = String(reader.result)
    uploadShow.value = false
  }
  reader.readAsDataURL(raw)
}
</script>

<style scoped>
/* 类名与结构照旧版 `.production-edit-wrapper` 那套，换成 scoped 收进组件。 */
.doc-edit-table-wrap {
  overflow: auto;
  max-height: 62vh;
}
.doc-edit-table {
  border-collapse: collapse;
  width: 100%;
}
.doc-edit-table th,
.doc-edit-table td {
  border: 1px solid #dcdfe6;
  padding: 4px 6px;
  vertical-align: top;
  font-size: 13px;
}
.doc-edit-table th {
  background: #f5f7fa;
  font-weight: 600;
  white-space: nowrap;
}
.doc-edit-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: vertical;
  font: inherit;
  line-height: 1.4;
  background: transparent;
}
.doc-edit-img {
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
}
.doc-edit-img img {
  max-width: 100%;
  max-height: 80px;
  object-fit: contain;
}
.doc-edit-img-empty {
  color: #999;
  font-size: 12px;
}
.doc-edit-empty {
  text-align: center;
  color: #999;
  padding: 24px 0;
}
.doc-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
