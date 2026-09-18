<!--
  「自定义合格标签」· **编辑标签**弹窗（旧版 Home 侧的 `LabelEdit`，`ic=13`）。

  逆向定稿：旧版源码 `legacy/js/Hui.formatted.js:5954-6135`（`__name:"LabelEdit"`），
  由 Home 挂载（`Home.formatted.js:12202`，`modelValue`/`label-data`/`onSave`），
  由工具条的「 编辑标签 」按钮打开（`kc`，`Home.formatted.js:10352`）。

  ⚠️ **本弹窗是「平铺行 + 纯拷贝」**：它直接编辑 `labelRows('lable')` 产出的那 11 个键，
  **一个字段都不做变换**（没有 `LabelEdit` 的 `<br>` ↔ `\n`，也没有 `doorImg` 那样的图片列）——
  与 C 家族的 `ProductionEdit`（转 5 个字段 + 换门图）**不是一回事**。
  这也是为什么新版**没有**复用它旁边的共用 `DocEditDialog.vue`：那个只做「平铺行 + brFields + 图片列」，
  缺本弹窗的两个结构件 ——**门店特判多出来的「位置」列**与**逐行的「复制 / 删除」**。

  ⚠️⚠️ **门店特判（旧版 `QL` 之外唯一一处按租户分支的逻辑）**：旧版在 `onMounted` 里
  `getUserData()` 之后判 `userinfo.registrant === '杉杉铝木极简门'`，是则**多渲染一列「位置」**
  （`prop: "storeAddress"`）。新版用 `auth.tenant.name` 判（`TenantDto` 只有 `id`/`name`；
  `registrant` 在全仓库的既有落点是 `ctx.tenantName = auth.tenant.name`，见
  `printPayloads.ts` 的 `lableRow`/`labelQuantity` 的「工厂特判」）——
  **这层映射是 INTERPRETED**，见下方 `isStoreTenant` 的 TODO。

  ⚠️ **另一个已知缺口**：`printPayloads.labelRows('lable')` **不产出 `storeAddress`**
  （§9 的 11 键表里没有它），而 `utils/qualifiedlabel/fieldAliases.ts` 的别名表里也没有它 ——
  ⇒ 这一列在本版**恒为空**、改了也不影响产出。它不是本弹窗的 bug，是**数据层的缺口**，
  见文件末尾的 TODO（修它要动 `printPayloads.ts`，超出本次「不改 utils/」的边界）。

  行为逐条照旧版：
  · 打开时 `draft = rows.map(r => ({...r}))`（**新对象** ⇒ 编辑期不污染父数据、取消即丢弃）；
  · 「确认修改」→ `emit('save', draft.map(r => ({...r})))` + 关窗 + `ElMessage.success('标签已更新')`；
  · 「取消」/ESC/点遮罩 → 丢弃副本；
  · 「复制」→ 在**本行之后**插入该行的一份浅拷贝，提示 `已复制标签`；
  · 「删除」→ **只剩 1 行时拒绝**并提示 `至少需要保留一个标签`，否则删掉并提示 `已删除标签`。
-->
<template>
  <n-modal v-model:show="show" preset="card" style="width: 1400px" :bordered="false">
    <!-- 旧版没有 title（`el-dialog` 只有 width），所以这里也不给 -->
    <div class="ql-edit-wrapper">
      <!-- 工具条在**表格上方**（旧版 `.button-group` 就是表格的同级前一个 div） -->
      <div class="ql-edit-button-group">
        <n-button type="primary" round @click="confirm">确认修改</n-button>
        <n-button round @click="cancel">取消</n-button>
        <!--
          「位置」列开关 —— **新版新增**（旧版按门店名硬编码，除那一家谁都看不到）。
          改动即落盘（与固定张数同款），不做「等确认修改才生效」。
        -->
        <span class="ql-edit-location-toggle">
          <n-switch :value="showLocationColumn" size="small" @update:value="toggleLocationColumn" />
          <span class="ql-edit-location-label">显示「位置」列</span>
        </span>
      </div>

      <div class="ql-edit-table-wrap">
        <table class="ql-edit-table">
          <thead>
            <tr>
              <th v-for="c in columns" :key="c.key" :style="headStyle(c)">{{ c.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in draft" :key="i">
              <td v-for="c in columns" :key="c.key" :style="bodyStyle(c)">
                <!--
                  操作列：复制 / 删除（旧版是 el-table-column + fixed:"right"）。
                  ⚠️ 「删除」在旧版是 `type:"danger"`（Element Plus）—— Naive **没有 `danger`**，
                  对应物是 `type="error"`（同一档语义色），这是**新版自有的等价映射**。
                -->
                <template v-if="c.key === '__ops'">
                  <div class="ql-edit-ops">
                    <n-button type="primary" size="small" @click="duplicateRow(i)">复制</n-button>
                    <n-button type="error" size="small" @click="deleteRow(i)">删除</n-button>
                  </div>
                </template>
                <!-- 备注：3 行 textarea；其余多行走 textarea rows=2；颜色/单号/包号是**单行 input** -->
                <textarea
                  v-else-if="(c.rows ?? 1) > 1"
                  v-model="row[c.key] as string"
                  class="ql-edit-textarea"
                  :rows="c.rows ?? 1"
                />
                <n-input v-else v-model:value="row[c.key] as string" size="small" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NInput, NModal, NSwitch, useMessage } from 'naive-ui'

import {
  loadLocationColumnSetting,
  saveLocationColumnSetting,
} from '../utils/qualifiedlabel/locationColumn'

type Row = Record<string, unknown>

/** 一列的定义。`width` 单位 px（照抄旧版每列写死的宽度）；`rows > 1` → 多行 textarea。 */
interface EditColumn {
  key: string
  label: string
  width: number
  /** textarea 的行数；1（缺省）= 单行 input。旧版：备注 3 行，绝大多数列 2 行，颜色/单号/包号单行。 */
  rows?: number
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 父组件的标签行（`labelRows('lable')` 的产物）。**本弹窗只读它**，编辑期改的是内部副本。 */
    rows: Row[]
    /** 抽屉的注入契约要求有 `title`，但**旧版本弹窗没有标题** ⇒ 收下但不渲染。 */
    title?: string
  }>(),
  { title: '' },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  save: [Row[]]
}>()

const message = useMessage()

const show = ref(props.modelValue)
const draft = ref<Row[]>([])

/**
 * 「位置」列的显隐 —— **用户可控的开关，不再按门店名特判**（用户 2026-09-18 拍板）。
 *
 * ⚠️ **有意偏离旧版**。旧版是 `getUserData()` → `userinfo.registrant === '杉杉铝木极简门'`
 * 才多渲这一列，等于**除那一家门店外谁都用不到**，且换门店名就得改代码。
 * 新版改成持久化开关：**默认关，要的人自己开**（存储见 `utils/qualifiedlabel/locationColumn.ts`）。
 *
 * 这个改动还有个直接动因：`storeAddress` 在新版数据层**原本根本不存在**
 * （`labelRows('lable')` 不产它），所以旧版那套特判**即使门店名对上、列也是恒为空的**。
 * 本次已在 `printPayloads.ts` 的 `lableRow` 里补上（取**客户资料地址**，不是订单安装地址）。
 *
 * 旧版那条 TODO（`userinfo.registrant` 与 `TenantDto.name` 是否同一字段）随本次改动一并作废。
 */
const showLocationColumn = ref(loadLocationColumnSetting())

/** 开关变更：立即落盘（与固定张数同款，不走「确认修改」）。 */
function toggleLocationColumn(v: boolean) {
  showLocationColumn.value = saveLocationColumnSetting(v)
}

/**
 * 列清单（旧版 11 列 + 可选「位置」 + 「操作」），**顺序与宽度逐字照抄**。
 *
 * ⚠️ 列 key 就是**行对象的键**（`client`/`door`/…），**不做任何改名或前缀处理** ——
 * 本弹窗是纯拷贝（与 C 家族那个要转 `<br>` 的 `ProductionEdit` 不同）。
 * ⚠️ `storeAddress` 是**门店特判**才出现的第 2 列（插在 `client` 之后）。
 */
const columns = computed<EditColumn[]>(() => {
  const list: EditColumn[] = [
    { key: 'client', label: '客户', width: 130, rows: 2 },
  ]
  if (showLocationColumn.value) list.push({ key: 'storeAddress', label: '位置', width: 130, rows: 2 })
  list.push(
    { key: 'door', label: '门型', width: 160, rows: 2 },
    { key: 'size', label: '尺寸', width: 180, rows: 2 },
    // ⚠️ 颜色/单号/包号在旧版里**没有** `type:"textarea"` —— 它们是单行 input（照抄）
    { key: 'color', label: '颜色', width: 110 },
    { key: 'lockway', label: '开向', width: 130, rows: 2 },
    { key: 'orderID', label: '单号', width: 135 },
    { key: 'address', label: '地址', width: 120, rows: 2 },
    { key: 'glass', label: '玻璃', width: 130, rows: 2 },
    { key: 'package', label: '包号', width: 90 },
    // 备注是 `min-width:"150"`（其余都是 `width`）+ **3 行** textarea
    { key: 'remark', label: '备注', width: 150, rows: 3 },
    // 「操作」列（旧版 `fixed:"right"`，宽度 150）
    { key: '__ops', label: '操作', width: 150 },
  )
  return list
})

/** 「操作」列在旧版是 `fixed:"right"` —— 这里用 sticky 右贴（宽表横向滚动时保持可见）。 */
function headStyle(c: EditColumn): Record<string, string> {
  const base: Record<string, string> = { width: c.width + 'px', minWidth: c.width + 'px' }
  if (c.key === '__ops') {
    base.position = 'sticky'
    base.right = '0'
    base.zIndex = '2'
  }
  return base
}

function bodyStyle(c: EditColumn): Record<string, string> {
  const base: Record<string, string> = headStyle(c)
  if (c.key === '__ops') base.background = '#fff'
  return base
}

/**
 * 打开时拷贝一份（旧版 `Vue.watch(modelValue)` → `o = labelData.map(e => ({...e}))`）。
 *
 * ⚠️ **必须是新对象**：旧版就是靠这个做到「编辑期不污染父数据、取消即丢弃」，
 * 别改成直接引用父数组。**纯浅拷贝，不做任何字段变换**（本弹窗的核心特征）。
 */
watch(
  () => props.modelValue,
  (open) => {
    show.value = open
    if (!open) return
    draft.value = props.rows.map((row) => ({ ...row }))
  },
  { immediate: true },
)

/** 关闭时同步 v-model（旧版也是靠 watch 关闭态回传 `update:modelValue`）。 */
watch(show, (v) => {
  if (!v) emit('update:modelValue', false)
})

/** 「确认修改」（旧版 `n`）：再拷一份回写 → 关窗 → `ElMessage.success('标签已更新')`。 */
function confirm(): void {
  emit(
    'save',
    draft.value.map((row) => ({ ...row })),
  )
  show.value = false
  message.success('标签已更新')
}

/** 「取消」/ESC/点遮罩（旧版 `d`）：丢弃副本 —— 父数据从未被改。 */
function cancel(): void {
  show.value = false
}

/**
 * 「复制」（旧版操作列的第一颗按钮）：把**本行的一份浅拷贝**插到本行**之后**，
 * 提示 `已复制标签`。⚠️ 旧版是 `o.splice(index + 1, 0, {...o[index]})` —— **浅拷贝**，
 * 复制出来的行与源行不共享引用（但嵌套对象若存在则共享；本单据的行是纯平铺标量，无影响）。
 */
function duplicateRow(index: number): void {
  const copy = { ...draft.value[index] }
  draft.value.splice(index + 1, 0, copy)
  message.success('已复制标签')
}

/**
 * 「删除」（旧版操作列的第二颗按钮）：`length <= 1` 时**拒绝**并警告
 * `至少需要保留一个标签`（旧版用的是 `ElMessage.warning`），否则删掉并提示 `已删除标签`。
 */
function deleteRow(index: number): void {
  if (draft.value.length <= 1) {
    message.warning('至少需要保留一个标签')
    return
  }
  draft.value.splice(index, 1)
  message.success('已删除标签')
}
</script>

<style scoped>
/*
  旧版的 scoped 样式只有两条：`.label-edit-wrapper` 与 `.button-group`（都是空的 hoisted
  style 对象，只用来挂 class），表格与输入框的观感全靠 el-table / el-input 的默认样式 +
  两处内联样式（表格 `width:100%; font-size:18px`；输入框 `font-size:18px; line-height:1.6`）。

  下面是**新版自己的排版胶水**（把「el-table 默认外观 + 两处内联样式」在原生 table 上还原）：
  取值与 `DocEditDialog.vue` 那套保持一致（同一族观感），字号/行高按旧版的内联值放大。
*/
.ql-edit-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ql-edit-button-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* 「位置」列开关：靠右，与两颗按钮拉开距离（新版新增，旧版没有这个控件） */
.ql-edit-location-toggle {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
}
.ql-edit-location-label {
  user-select: none;
  cursor: pointer;
}
.ql-edit-table-wrap {
  overflow: auto;
  max-height: 66vh;
}
.ql-edit-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 18px;
}
.ql-edit-table th,
.ql-edit-table td {
  border: 1px solid #dcdfe6;
  padding: 4px 6px;
  vertical-align: top;
  font-size: 18px;
  /* 旧版给每格输入框写的内联样式 `line-height:1.6` */
  line-height: 1.6;
}
.ql-edit-table th {
  background: #f5f7fa;
  font-weight: 600;
  white-space: nowrap;
}
.ql-edit-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: vertical;
  font: inherit;
  line-height: 1.6;
  background: transparent;
}
.ql-edit-ops {
  display: flex;
  gap: 4px;
}
</style>
