<!--
  「编辑收据单 / 编辑回执单」弹窗 —— 旧版 **`ReceiptEdit`**（`legacy/js/Hui.formatted.js:6981-7540`，
  `__name:"ReceiptEdit"`）。施工图 `docs/edit-dialog-recon/01-edit-table.md` §1 / §3.5 / §4 / §7。

  它有**两个**挂载点（都是同一个组件，只是 `customer-data` 与 `onSave` 不同）：

  | 谁开 | 打开开关 | 数据 | onSave | 挂载偏移 / formatted 行 |
  |---|---|---|---|---|
  | 打印预览弹窗 `ic=5` 的「 编辑收据单 」 | `_n`（按钮直接置 true，偏移 495453） | `jn[0]` | `qi`（415407） | 515794 / 12200 |
  | 另一个弹窗里的「 编辑回执单 」（§7） | `Jn`（`qn.length > 0` 才是） | `qn[0]` | `ji`（415162） | 515551 / 12198 |

  `qi` 保存后：`jn[0] = e`；`ic===5` → `await Rn()` 重渲；提示「收据单预览已更新」。
  `ji` 保存后：`qn[0] = e`；`Yn = It.preview('receipt', qn)[0].outerHTML`。

  ⚠️ **弹窗标题硬编码为 `编辑回执单`**（`_0x4407(308)`，CONFIRMED）—— 即使它是被 `ic=5` 的
  「 编辑收据单 」按钮打开的，标题也写「回执单」。这是旧版**已核实**的不一致（施工图 §10.5），
  本组件**照抄**：`title` 默认值就是 `编辑回执单`。

  ⚠️ **本弹窗不是纯平铺表**：它是「`el-form` 表头（10 项，含 3 行栅格）+ 门洞图片区 +
  `el-table` 明细（9 列）+ 二维码图片区」四段，与 `DocEditDialog.vue`（平铺行 + `brFields`）
  和 `GlassEditDialog.vue`（9 列 + 操作列）都不是一回事 ⇒ 另写一个。

  ⚠️ **换行转换是 4 个字段，且和显示列不对应**（CONFIRMED，`Hui.formatted.js:7049` / `7160`）：
    进：`glass` / `remark` / `pricing` / `profile` 做 `<br>`(gi) → `\n`
    出：同 4 个做 `\n` → `<br>`
  其中 **`pricing`（计价明细）根本没有对应的列**，它在弹窗里不可见，但**照样来回转换** ——
  这是旧版的一处「顺手」，本组件照抄（不转换会让它带着 `\n` 回到打印载荷里）。
  另外 `size`/`direction`/`color`/`openImg`/`amount`/`quantity` **不转**。

  ⚠️ **保存回传的是整份 `customerData`**，并且**重算 `balance`**：
    `g()` = `{...l.value, balance: total - deposit, receipt: [转换后的行]}`
  `total` 用的是**用户改过的 `total`**（不是重算）；旧版**不四舍五入**（与 `receiptBuilder`
  那边的 `round2` 不同 —— 那是另一套代码，别混）。

  ⚠️ **所有编辑只改内存**（施工图 §5 CONFIRMED）：`qi`/`ji` 都只写 `jn[0]`/`qn[0]`，不落库。
  刷新页面即回退。**唯一例外是弹窗内那条账号级「声明」的 POST** —— 见本文件
  `saveDeclaration()` 的 `TODO(未确认)`，本次**未实现**。

  ⚠️ **有意偏离（3 处，逐条列在对应函数上方）**：
    1. 数字格用 `n-input-number` 顶 `el-input type="number"`（Naive 的 `n-input` 没有 number 类型）；
    2. 「二维码」的上传**没有**复刻 `BarcodeDetector` 裁切 + `saveImage()` 服务端落盘 + 强制重登；
    3. 「声明」的 POST **未发**（只做本地回显）。

  ⚠️ **数据层缺口（不是本弹窗的 bug，同 `QualifiedLabelEditDialog.vue` 的 `storeAddress` 那条）**：
    · 表头「门店地址」`storeAddress`：`printPayloads.receiptPrintData()` **不产出**这个键
      ⇒ 这一格在本版恒为空、改了也不影响产出；
    · 「门洞图片」区（`doorImg<N>` 键）：载荷同样不产出 ⇒ `doorImageKeys` 恒为空 ⇒ 该区恒不渲染。
    两处都照旧版结构实现（有就渲染），只是当前数据源下取不到值。
-->
<template>
  <n-modal
    v-model:show="showModel"
    preset="card"
    :title="title"
    :style="{ width: '1400px' }"
    :bordered="false"
    display-directive="show"
  >
    <div class="receipt-edit-wrapper">
      <!-- 旧版两颗按钮在**表体上方**（`Hui.formatted.js:7170-7177`），不是 footer -->
      <div class="button-group">
        <n-button type="primary" @click="confirm">确认修改</n-button>
        <n-button @click="cancel">取消</n-button>
      </div>

      <!-- ── 表头（`el-form` label-width:80px，三行栅格） ── -->
      <n-form :model="draft" label-width="80px" label-placement="left" size="medium">
        <div class="form-row">
          <n-form-item label="客户" class="cell">
            <n-input v-model:value="draft.client as string" />
          </n-form-item>
          <n-form-item label="电话" class="cell">
            <n-input v-model:value="draft.tel as string" />
          </n-form-item>
          <n-form-item label="日期" class="cell">
            <n-input v-model:value="draft.date as string" />
          </n-form-item>
          <n-form-item label="生产天数" class="cell">
            <n-input-number
              :value="numOf(draft.productionDays)"
              style="width: 100%"
              :show-button="false"
              @update:value="(v: number | null) => (draft.productionDays = v ?? '')"
            />
          </n-form-item>
        </div>

        <div class="form-row">
          <n-form-item label="总价" class="cell">
            <n-input-number
              :value="numOf(draft.total)"
              style="width: 100%"
              :show-button="false"
              @update:value="(v: number | null) => (draft.total = v ?? '')"
            />
          </n-form-item>
          <n-form-item label="定金" class="cell">
            <n-input-number
              :value="numOf(draft.deposit)"
              style="width: 100%"
              :show-button="false"
              @update:value="(v: number | null) => (draft.deposit = v ?? '')"
            />
          </n-form-item>
          <!-- 余款是**只读派生值**（旧版 `:model-value` + `disabled`，没有 v-model） -->
          <n-form-item label="余款" class="cell">
            <n-input :value="balanceText" disabled />
          </n-form-item>
          <n-form-item label="单号" class="cell">
            <n-input v-model:value="draft.orderNo as string" />
          </n-form-item>
        </div>

        <div class="form-row">
          <n-form-item label="安装地址" class="cell-wide">
            <n-input v-model:value="draft.address as string" />
          </n-form-item>
          <!-- ⚠️ `storeAddress` 当前载荷不产出（见文件头注的数据层缺口）—— 结构照旧版保留 -->
          <n-form-item label="门店地址" class="cell-wide">
            <n-input v-model:value="draft.storeAddress as string" />
          </n-form-item>
        </div>

        <n-form-item label="声明">
          <div class="declaration-row">
            <n-input :value="draft.declaration as string" type="textarea" :rows="2" readonly />
            <n-button type="primary" @click="openDeclarationEditor">修改</n-button>
          </div>
        </n-form-item>
      </n-form>

      <!-- ── 门洞图片区（旧版 `b.value.length` 守卫：主键里存在 `doorImg<数字>` 才渲染） ── -->
      <div v-if="doorImageKeys.length" class="door-images-section">
        <div class="section-title">门洞图片</div>
        <div class="door-images-row">
          <div v-for="key in doorImageKeys" :key="key" class="door-image-item">
            <img
              v-if="draft[key]"
              :src="String(draft[key])"
              class="img-80"
              alt=""
            />
            <span v-else class="no-image">暂无图片</span>
            <div class="image-actions">
              <n-button size="small" type="primary" @click="openDoorUpload(key)">上传</n-button>
              <n-button size="small" type="error" @click="draft[key] = ''">删除</n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 回执项目（明细表，9 列） ── -->
      <div class="section-title" style="margin-top: 16px">回执项目</div>
      <n-data-table
        :data="receiptRows"
        :columns="columns"
        :scroll-x="1150"
        bordered
        size="small"
        :style="{ width: '100%', fontSize: '16px', marginTop: '8px' }"
      />

      <!-- ── 二维码图片区（支付二维码 / 订单二维码） ── -->
      <div class="door-images-section">
        <div class="section-title">二维码图片</div>
        <div class="door-images-row">
          <div class="door-image-item">
            <div class="image-label">支付二维码</div>
            <img v-if="draft.payQrcode" :src="String(draft.payQrcode)" class="img-80" alt="" />
            <span v-else class="no-image">暂无图片</span>
            <div class="image-actions">
              <n-button size="small" type="primary" @click="openQrcodeUpload('payQrcode')">上传</n-button>
              <n-button size="small" type="error" @click="draft.payQrcode = ''">删除</n-button>
            </div>
          </div>
          <div class="door-image-item">
            <div class="image-label">订单二维码</div>
            <img v-if="draft.orderQrcode" :src="String(draft.orderQrcode)" class="img-80" alt="" />
            <span v-else class="no-image">暂无图片</span>
            <div class="image-actions">
              <n-button size="small" type="primary" @click="openQrcodeUpload('orderQrcode')">上传</n-button>
              <n-button size="small" type="error" @click="draft.orderQrcode = ''">删除</n-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </n-modal>

  <!-- ── 上传子弹窗（`Hui.formatted.js:7485-7504`）：宽 480px，**点遮罩不关** ── -->
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

  <!-- ── 「修改声明」子弹窗（`Hui.formatted.js:7505-7537`）：宽 900px，**点遮罩不关** ── -->
  <n-modal
    v-model:show="declarationVisible"
    preset="card"
    title="修改声明"
    style="width: 900px"
    :mask-closable="false"
    display-directive="show"
  >
    <div class="declaration-list">
      <div v-for="i in declarationLines.length" :key="i" class="declaration-line">
        <div class="declaration-index">{{ i }}、</div>
        <n-input v-model:value="declarationLines[i - 1]" type="textarea" :rows="2" />
        <n-button type="error" @click="removeDeclarationLine(i - 1)">删除</n-button>
      </div>
      <div>
        <n-button @click="addDeclarationLine">新增一行</n-button>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <n-button @click="declarationVisible = false">取消</n-button>
        <n-button type="primary" :loading="declarationSaving" @click="saveDeclaration">确认修改</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import {
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'

import { useAuthStore } from '../stores/auth'

/** 回执明细的一行（旧版 `customerData.receipt[i]`）。9 个可编辑键见 `columns`。 */
export interface ReceiptEditLine {
  profile?: string
  direction?: string
  color?: string
  glass?: string
  size?: string
  quantity?: number | string
  amount?: number | string
  remark?: string
  openImg?: string
  /** `pricing`（计价明细）/ `price` / `maker` / `doorImg` / `profile2` 都**随行携带但不显示**。 */
  [key: string]: unknown
}

/**
 * 弹窗的数据（旧版 props 名就叫 `customer-data`）。
 * 形状 = `utils/printPayloads.ts` 的 `receiptPrintData()` 的返回值，逐键对上。
 */
export interface ReceiptEditCustomerData {
  client?: string
  tel?: string
  date?: string
  productionDays?: number | string
  total?: number | string
  deposit?: number | string
  /** 旧版只在**保存时**重算（`g()`），打开时不保证有。 */
  balance?: number | string
  orderNo?: string
  address?: string
  storeAddress?: string
  declaration?: string
  payQrcode?: string
  orderQrcode?: string
  receipt?: ReceiptEditLine[]
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 父数据 —— 旧版的 `customer-data`（= `jn[0]` / `qn[0]`）。**本弹窗只读它**。 */
    customerData: ReceiptEditCustomerData
    /** ⚠️ 旧版**硬编码**「编辑回执单」；默认值照抄，一般不用传（见文件头注）。 */
    title?: string
  }>(),
  { title: '编辑回执单' },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  /** 「确认修改」：回传**整份 `customerData`**（`balance` 已重算、`receipt` 已转回 `<br>`）。 */
  save: [ReceiptEditCustomerData]
}>()

const message = useMessage()
const auth = useAuthStore()

const showModel = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

/** 草稿（旧版 `l`）。**不是**整份深拷贝 —— 见打开时的 watch。 */
const draft = ref<ReceiptEditCustomerData>({})

/**
 * 需要做 `<br>` ↔ `\n` 转换的明细字段。
 *
 * ⚠️ 是 **4 个**，且 `pricing` **没有对应的列**（弹窗里看不见）却照样来回转 —— 照抄旧版。
 *    顺序与 `Hui.formatted.js:7049` / `7160` 一致。
 */
const BR_FIELDS = ['glass', 'remark', 'pricing', 'profile'] as const

/** 明细行（`draft.receipt` 的响应式视图；回执族载荷里它恒是数组）。 */
const receiptRows = computed<ReceiptEditLine[]>(() =>
  Array.isArray(draft.value.receipt) ? draft.value.receipt : [],
)

/**
 * 「门洞图片」区的键（旧版 `b` computed）：主键里形如 `doorImg<数字>` 的那些。
 *
 * ⚠️ 当前载荷（`receiptPrintData()`）**不产出**这类键 ⇒ 这一区在本版恒不渲染。
 *    结构照旧版保留，等数据层补齐即自动生效。
 */
const doorImageKeys = computed(() =>
  Object.keys(draft.value).filter((k) => /^doorImg\d+$/.test(k)),
)

/**
 * 「余款」= 总价 − 定金（旧版 `:model-value="l.value.total - l.value.deposit"`，**不四舍五入**）。
 * 缺值时按 0 计 —— 只有载荷残缺时才有差别（旧版会显示 `NaN`，那种情形下两边都没意义）。
 */
const balanceText = computed(() => String(balanceOf(draft.value)))

function balanceOf(d: ReceiptEditCustomerData): number {
  return (numOf(d.total) ?? 0) - (numOf(d.deposit) ?? 0)
}

/** 数字格的桥（`n-input-number` 只吃 `number | null`；载荷里的值可能是空串，见文件头注偏离 1）。 */
function numOf(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

/**
 * 打开时重建草稿（旧版 `Vue.watch(modelValue)`，`Hui.formatted.js:7043-7052`）：
 *
 *     l.value = { ...customerData, receipt: (customerData.receipt || []).map(r => ({...r, 4 个字段转回 \n})) }
 *
 * ⚠️ **顶层是浅拷贝、明细行是新对象** —— 这就是「编辑期不污染父数据、取消即丢弃」的全部机制。
 *    别改成直接引用父对象（那会让「取消」失效）。
 * ⚠️ 旧版对 `receipt` 为 undefined 的情况会抛（`l.value.receipt.map` 无保护）；这里按
 *    `|| []` 兜底 —— 载荷正常时无差别，只在脏数据下少一次崩溃。
 */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    const src = props.customerData || {}
    const rows = Array.isArray(src.receipt) ? src.receipt : []
    draft.value = {
      ...src,
      receipt: rows.map((row) => {
        const copy: ReceiptEditLine = { ...row }
        for (const f of BR_FIELDS) {
          const v = copy[f]
          // ⚠️ 进场是 **gi**（大小写不敏感）—— 旧版逐字如此，出场只是 `/\n/g`
          copy[f] = typeof v === 'string' ? v.replace(/<br>/gi, '\n') : ''
        }
        return copy
      }),
    }
  },
  { immediate: true },
)

/**
 * 「确认修改」（旧版 `g`，`Hui.formatted.js:7157-7162`）：
 *
 *     { ...draft, balance: total - deposit, receipt: 行.map(4 个字段 \n → <br>) }
 *
 * ⚠️ 回传的是**整份对象**（不是增量）—— 调用方照旧版 `qi` 的写法 `jn[0] = e` 覆盖即可。
 * ⚠️ `balance` 是**覆盖式重算**，`total` 用用户改过的值（不重算）。
 */
function confirm(): void {
  const out: ReceiptEditCustomerData = {
    ...draft.value,
    balance: balanceOf(draft.value),
    receipt: receiptRows.value.map((row) => {
      const copy: ReceiptEditLine = { ...row }
      for (const f of BR_FIELDS) {
        const v = copy[f]
        copy[f] = typeof v === 'string' ? v.replace(/\n/g, '<br>') : ''
      }
      return copy
    }),
  }
  emit('save', out)
  showModel.value = false
  message.success('回执单数据已更新，正在重新生成预览...')
}

/** 「取消」/ESC/右上 X（旧版 `y`）：丢弃副本 —— 父数据从未被改。 */
function cancel(): void {
  showModel.value = false
}

// ------------------------------------------------------------------ 明细列 //

/** 单行文本输入（旧版这几格是 `el-input`，`input-style` 字号 18px / 行高 1.6）。 */
function textInput(row: ReceiptEditLine, key: string): ReturnType<typeof h> {
  return h(NInput, {
    value: row[key] as string,
    size: 'small',
    inputProps: { style: 'font-size:18px;line-height:1.6' },
    'onUpdate:value': (v: string) => {
      row[key] = v
    },
  })
}

/** 多行文本输入（旧版的 `type="textarea"` + `rows:2`）。 */
function textArea(row: ReceiptEditLine, key: string): ReturnType<typeof h> {
  return h(NInput, {
    value: row[key] as string,
    type: 'textarea',
    rows: 2,
    size: 'small',
    inputProps: { style: 'font-size:18px;line-height:1.6' },
    'onUpdate:value': (v: string) => {
      row[key] = v
    },
  })
}

/**
 * 数字格（旧版 `el-input type="number"` + `modelModifiers:{number:true}`）。
 *
 * ⚠️ **有意偏离 1/3（观感 + 粗存类型）**：Naive 的 `n-input` **没有 `type="number"`**
 *    （只有 text/password/textarea），对应物是 `n-input-number`；为保住「数据原样往返」，
 *    非数字值读进来显示为 `null`、写回时还原成 `''`（`numOf` + `v ?? ''`）。
 *    INTERPRETED：旧版 `el-input` **不处理组件级 `modelModifiers.number`**（它没声明这个 prop），
 *    故旧版实际存的是**字符串**；本版存数字。打印模板只做文本插值，渲染一致。
 */
function numberInput(row: ReceiptEditLine, key: string): ReturnType<typeof h> {
  return h(NInputNumber, {
    value: numOf(row[key]),
    size: 'small',
    showButton: false,
    style: 'width:100%',
    inputProps: { style: 'font-size:18px;line-height:1.6' },
    'onUpdate:value': (v: number | null) => {
      row[key] = v === null ? '' : v
    },
  })
}

/**
 * 「开向图」格（旧版 `Hui.formatted.js:7430-7452`）：60×60 `object-fit:contain`，无图出 `-`，
 * 下面两颗按钮。「删除」把 `openImg` 置空串；「上传」开子弹窗并记录 `{type:'receipt', row}`。
 */
function imageCell(row: ReceiptEditLine): ReturnType<typeof h> {
  return h('div', { class: 'door-image-cell' }, [
    row.openImg
      ? h('img', { src: String(row.openImg), style: 'width:60px;height:60px;object-fit:contain;' })
      : h('span', { class: 'no-image' }, '-'),
    h('div', { class: 'image-actions' }, [
      h(
        NButton,
        { size: 'small', type: 'primary', onClick: () => openReceiptUpload(row) },
        { default: () => '上传' },
      ),
      h(
        NButton,
        {
          size: 'small',
          // Element Plus 的 `type="danger"` → Naive 的 `type="error"`（同 `GlassEditDialog.vue`）
          type: 'error',
          onClick: () => {
            row.openImg = ''
          },
        },
        { default: () => '删除' },
      ),
    ]),
  ])
}

/**
 * 9 列，**顺序与宽度逐字照抄**旧版 `Hui.formatted.js:7346-7452`。
 *
 * ⚠️ 旧版**没有**「计价明细 / 门图」两列，虽然行对象里有 `pricing` / `doorImg` —— 照抄不加。
 * ⚠️ 备注列**没有 width**（其余都有）—— 给 `minWidth` 吃掉剩余宽度，观感等价。
 * ⚠️ 加价 `pricing` 虽不可见，但**仍参与 `<br>` ↔ `\n` 转换**（见 `BR_FIELDS`）。
 */
const columns = computed<DataTableColumns<ReceiptEditLine>>(() => [
  { title: '型材', key: 'profile', width: 140, render: (row) => textArea(row, 'profile') },
  { title: '开向', key: 'direction', width: 120, render: (row) => textInput(row, 'direction') },
  { title: '颜色', key: 'color', width: 100, render: (row) => textInput(row, 'color') },
  { title: '玻璃', key: 'glass', width: 180, render: (row) => textArea(row, 'glass') },
  { title: '尺寸', key: 'size', width: 160, render: (row) => textInput(row, 'size') },
  { title: '数量', key: 'quantity', width: 70, render: (row) => numberInput(row, 'quantity') },
  { title: '金额', key: 'amount', width: 90, render: (row) => numberInput(row, 'amount') },
  { title: '备注', key: 'remark', minWidth: 150, render: (row) => textArea(row, 'remark') },
  { title: '开向图', key: 'openImg', width: 140, render: (row) => imageCell(row) },
])

// ------------------------------------------------------------------ 上传 //

/** 上传目标（旧版 `c`）：`{type:'door',key}` / `{type:'receipt',row}` / `{type:'qrcode',key}`。 */
type UploadTarget =
  | { type: 'door'; key: string }
  | { type: 'receipt'; row: ReceiptEditLine }
  | { type: 'qrcode'; key: 'payQrcode' | 'orderQrcode' }

const uploadVisible = ref(false)
const fileEl = ref<HTMLInputElement | null>(null)
/**
 * ⚠️ **非响应式**：它只在 `FileReader.onload` 里被用来定位要写的键，且旧版就是 `Vue.ref(null)`
 *    存**表格 render 给出的那个响应式行对象** —— 这里同样存行对象本身（`uploadRow` 走 target）。
 */
let uploadTarget: UploadTarget | null = null

/**
 * 权限闸（旧版 `m`，`Hui.formatted.js:7056-7061`）：`userinfo.registrant === userinfo.name`
 * 才允许传二维码。新版取 `auth.tenant.name` / `auth.user.name`。
 *
 * TODO(未确认): `userinfo.registrant` 与 `TenantDto.name`、`userinfo.name` 与 `UserDto.name`
 * 是否**同一字段**没有实证 —— 依据是「`registrant` 在本仓库的既有落点就是 `ctx.tenantName`
 * （= `auth.tenant?.name`）」，见 `printPayloads.ts` 的工厂特判一脉；
 * `QualifiedLabelEditDialog.vue` 的同名 TODO 是同一类推断。
 */
function permitted(): boolean {
  const registrant = auth.tenant?.name || ''
  const userName = auth.user?.name || ''
  if (!registrant || !userName) {
    message.error('未登录或缺少用户信息')
    return false
  }
  if (registrant !== userName) {
    message.error('无权限操作')
    return false
  }
  return true
}

/** 「支付/订单二维码」的上传（旧版 `m` → `c = {type:'qrcode', key}`）。 */
function openQrcodeUpload(key: 'payQrcode' | 'orderQrcode'): void {
  if (!permitted()) return
  uploadTarget = { type: 'qrcode', key }
  openUploadDialog()
}

/** 「门洞图片」的上传（旧版模板内联：`c = {type:'door', key}`）。**不设权限闸** —— 照抄。 */
function openDoorUpload(key: string): void {
  uploadTarget = { type: 'door', key }
  openUploadDialog()
}

/** 「开向图」的上传（旧版模板内联：`c = {type:'receipt', row}`）。**不设权限闸** —— 照抄。 */
function openReceiptUpload(row: ReceiptEditLine): void {
  uploadTarget = { type: 'receipt', row }
  openUploadDialog()
}

function openUploadDialog(): void {
  uploadVisible.value = true
  // 每次重开都要清空，否则选同一个文件不触发 change。
  requestAnimationFrame(() => {
    if (fileEl.value) fileEl.value.value = ''
  })
}

/**
 * 旧版 `w`（`Hui.formatted.js:7062-7156`）。**只复刻了「普通图片」那两支**：
 *
 *   · `type==='receipt'` → `c.row.openImg = dataURL`
 *   · `type==='door'`    → `draft[c.key] = dataURL`（旧版是 `l.value[c.key] = o`）
 *
 * ⚠️ **有意偏离 2/3（`type==='qrcode'` 那一支）**：旧版这块**根本不走 FileReader 直存**，
 *    而是先 `createImageBitmap` + `BarcodeDetector`（`_0x52e3f2`）逐级缩放（1/.8/.65/.5/.4）
 *    识别出二维码四角、`getImageData` 裁切留 2% 边距、`canvas.toBlob(jpeg, .95)`，
 *    再 `await saveImage(type, type, blob)` **上传到服务端换回一个 URL**；成功后弹
 *    「所有设备必须重新登陆，二维码才生效。」并清 token + `router.replace('/login')` +
 *    `window.location.reload()`。新版**没有** `saveImage` 这个服务端图片接口
 *    （后端 `receipts`/`settings` 路由里都没有上传口；收款码在本版是本地 IndexedDB
 *    `idbGetImage('qrcode')`，见 `composables/useOrderPrint.ts`）。
 *    ⇒ 这里退化成**本地读取**（与其余所有编辑「只改内存」同一条），**不裁切、不上传、不强制重登**。
 *    TODO(未确认): 若要复刻，需要先定「新版二维码存哪」（后端接口 or IndexedDB）。
 */
function pickFile(raw: File | undefined): void {
  const target = uploadTarget
  if (!target || !raw) return
  if (!raw.type.startsWith('image/')) {
    message.error('只能上传图片文件!')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result || '')
    if (target.type === 'receipt') target.row.openImg = dataUrl
    else draft.value[target.key] = dataUrl
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

// -------------------------------------------------------------- 修改声明 //

/** 「修改声明」子弹窗（旧版 `d` / `r` / `s`）。 */
const declarationVisible = ref(false)
const declarationSaving = ref(false)
const declarationLines = ref<string[]>([])

/**
 * 打开「修改声明」（旧版 `u`，`Hui.formatted.js:6990-6996`）：先过**权限闸**（与 `m` 同一套），
 * 再把当前 `declaration` 拆成行。
 *
 * 拆行规则逐字照抄：先 `replace(/\\n/g, '\n')`（把**两字符的 `\n`** 反转义成真换行 ——
 * 旧版 DB 里存的就是转义过的），再按 `/\r?\n/` 拆、逐行 `trim()`、丢掉空行；
 * **一行都不剩时给 `[""]`**（保证编辑器里恒有至少一个输入框）。
 */
function openDeclarationEditor(): void {
  if (!permitted()) return
  declarationLines.value = splitDeclaration(draft.value.declaration)
  declarationVisible.value = true
}

function splitDeclaration(v: unknown): string[] {
  const lines = String(v || '')
    .replace(/\\n/g, '\n')
    .split(/\r?\n/)
    .map((s) => String(s || '').trim())
    .filter((s) => s.length > 0)
  return lines.length > 0 ? lines : ['']
}

/** 「新增一行」（旧版 `i`）：`s.push("")`。 */
function addDeclarationLine(): void {
  declarationLines.value.push('')
}

/**
 * 删一行（旧版模板内联）：**只剩 1 行时不是拒绝，而是把那一行清空**（`s[0] = ""`），
 * 否则 `splice(i,1)`。⚠️ 别照抄 `LabelEdit` 那种「至少保留一个」的 warning —— 旧版这里没有。
 */
function removeDeclarationLine(index: number): void {
  if (declarationLines.value.length <= 1) declarationLines.value[0] = ''
  else declarationLines.value.splice(index, 1)
}

/**
 * 「确认修改」（旧版 `f`，`Hui.formatted.js:7000-7027`）。
 *
 * ⚠️⚠️ **有意偏离 3/3 + 本次最重要的逆向结论**：旧版这里会发一条**账号级**的写请求 ——
 *
 *     POST https://www.samrtdoor.com.cn/1?param1=changeDecleration&param2=<encodeURIComponent(registrant)>
 *     headers: { "Content-Type": "application/json" }
 *     body:    { "declaration": "<各行 trim 后丢空行、以 \n 连接>" }
 *
 *   成功（`json.code === 200`）后：`draft.declaration = 该串` → 提示「声明已更新」→ 关子弹窗 →
 *   **强制重新登录**（`ElMessageBox.alert("新的温馨提示要重新登陆账号才生效！", "提示",
 *   {confirmButtonText:"确定", closeOnClickModal:false, closeOnPressEscape:false})` →
 *   `localStorage.removeItem("token")` + `sessionStorage.clear()` + `clearUserData()` →
 *   `router.replace("/login")` + `window.location.reload()`）。
 *   失败：`ElMessage.error(json.message || json.msg || "声明更新失败")`；网络异常同文案。
 *
 *   **这是 `ReceiptEdit` 里唯一一条把编辑结果写出去的操作**（订单数据本身仍然只改内存），
 *   而且它写的是**账号/租户级**的「温馨提示」，不是这一单 —— 与施工图 §5「全部只改内存」不矛盾。
 *
 *   **新版未复刻**，理由三条：
 *     ① 目标是**旧版生产域名**（`www.samrtdoor.com.cn`），从新版发出去是跨系统的对外写；
 *     ② 新版后端**没有**对应接口（`backend/src/modules/tenants` 无 declaration 列，
 *        `printPayloads.ts` 里 `LEGACY_DECLARATION = '含安装费'` 就是「后端没这列」的直接后果）；
 *     ③ 成功后**强制登出 + 刷新整页**是破坏性副作用，得产品先拍板。
 *   ⇒ 这里只做**本地回显**（让预览能看到新声明），**不发请求、不登出**。
 *   TODO(未确认): 待定「新版声明存哪」后补齐（后端加列 / 保留旧域名转发，二选一）。
 */
function saveDeclaration(): void {
  const joined = declarationLines.value
    .map((s) => String(s || '').trim())
    .filter((s) => s.length > 0)
    .join('\n')
  declarationSaving.value = true
  try {
    draft.value.declaration = joined
    declarationVisible.value = false
    message.success('声明已更新')
  } finally {
    declarationSaving.value = false
  }
}
</script>

<style scoped>
/*
  旧版的 scoped 样式也只有几个空壳 class（`.receipt-edit-wrapper` / `.button-group` /
  `.customer-form` / `.door-images-section` / `.door-images-row` / `.door-image-item` /
  `.door-image-cell` / `.image-actions` / `.image-label` / `.no-image` / `.section-title` /
  `.upload-dialog`），观感全靠 Element Plus 默认样式 + 内联样式
  （明细表 `width:100%; font-size:16px; margin-top:8px`；`el-image` 逐处 60/80px + contain）。
  下面是**新版自己的排版胶水**。
*/
.receipt-edit-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 72vh;
  overflow: auto;
}
.button-group {
  display: flex;
  gap: 8px;
}
/*
  表头栅格：旧版是 `el-row gutter:16` + `el-col span:6`（每行 4 格）/ `span:12`（每行 2 格）。
  这里按仓库的响应式约定用 flex 行 + flex-wrap + gap 还原（见 `frontend-layout-convention`）。
*/
.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.form-row .cell {
  flex: 1 1 260px;
  min-width: 220px;
}
.form-row .cell-wide {
  flex: 1 1 520px;
  min-width: 320px;
}
.declaration-row {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: flex-start;
}
.section-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
}
.door-images-section {
  margin-top: 8px;
}
.door-images-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.door-image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.door-image-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.image-label {
  font-size: 13px;
  color: #606266;
}
.image-actions {
  display: flex;
  gap: 4px;
}
.no-image {
  color: #909399;
  font-size: 13px;
}
/* `el-image` 在本弹窗里逐处写的是 80×80（门洞/二维码）与 60×60（开向图），fit 都是 contain */
.img-80 {
  width: 80px;
  height: 80px;
  object-fit: contain;
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
.declaration-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.declaration-line {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.declaration-index {
  width: 40px;
  padding-top: 6px;
  color: #909399;
  text-align: right;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
