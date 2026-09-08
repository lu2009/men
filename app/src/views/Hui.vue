<template>
  <div class="page">
    <!-- 命令行（仿旧版：清空 / 添加门类 / 保存回执单 / 3D画图 · 更多▾ 收高级入口） -->
    <div class="top-bar">
      <div class="toolbar-row">
        <n-button size="small" @click="newOrder">1.清空</n-button>
        <n-button size="small" type="error" @click="addTypeOpen = true">2.添加门类</n-button>
        <n-button size="small" type="warning" :loading="saving" @click="saveOrder">3.保存回执单</n-button>
        <n-tooltip>
          <template #trigger>
            <n-button size="small" disabled>3D画图</n-button>
          </template>
          3D 画图（本期后置，另行排期）
        </n-tooltip>
        <n-button size="small" @click="refreshPage">刷新</n-button>
        <span class="grow-spacer" />
        <n-dropdown
          trigger="click"
          :options="moreMenuOptions"
          @select="onMoreSelect"
        >
          <n-button size="small">更多功能 ▾</n-button>
        </n-dropdown>
      </div>

      <!-- 客户/订单头：就地编辑表单行（仿旧版浅边框行） -->
      <div class="header-form">
        <div class="field">
          <span class="label">客户:</span>
          <n-select
            v-model:value="order.client_code"
            filterable
            clearable
            placeholder="输入客户信息"
            :options="clientOptions"
            style="width: 190px"
            @update:value="onClientChange"
          />
        </div>
        <div class="field">
          <span class="label">电话:</span>
          <n-input v-model:value="order.phone" style="width: 110px" placeholder="电话" />
        </div>
        <div class="field">
          <span class="label">安装地址:</span>
          <n-input v-model:value="order.install_address" size="small" style="width: 170px" placeholder="全局默认安装地址（行内为空时自动回填）" />
        </div>
        <div class="field">
          <span class="label">业务员:</span>
          <n-input v-model:value="order.salesperson" style="width: 90px" placeholder="业务员" />
        </div>
        <div class="field">
          <span class="label">生产天数:</span>
          <n-input-number v-model:value="order.production_days" :min="1" :show-button="true" style="width: 96px" />
        </div>
        <div class="field">
          <span class="label">订金(元):</span>
          <n-input-number v-model:value="order.deposit" :min="0" :show-button="true" style="width: 110px" />
        </div>
        <div class="field">
          <span class="label">品牌:</span>
          <n-input v-model:value="order.brand" style="width: 90px" placeholder="品牌" />
        </div>
        <div class="field">
          <span class="label">日期:</span>
          <n-date-picker
            v-model:value="orderDateTs"
            type="date"
            size="small"
            style="width: 130px"
            @update:value="onOrderDate"
          />
        </div>
        <div class="field readonly-meta">
          <span class="label">编号:</span><b>{{ order.receipt_no || '（未生成）' }}</b>
          <span v-if="dueDate" class="due">截止 {{ dueDate }}</span>
        </div>
      </div>
    </div>

    <!-- 两表区域：平开门 / 移门左右并排网格（仿旧版） -->
    <div v-if="!showPing && !showDiao" class="empty-hint">
      点击顶部「2.添加门类」选择要录的门类（平开门 / 移门）。
    </div>

    <div class="tables-grid">
      <section v-if="showPing" class="table-wrap">
        <div class="table-head">
          <span class="tbl-title">平开门</span>
          <n-button size="tiny" ghost @click="addRowOf('ping')">＋添加行</n-button>
          <n-button v-if="selectedLines.length" size="tiny" text type="error" @click="batchDeleteRows">批量删除({{ selectedLines.length }})</n-button>
          <span class="grow-spacer" />
          <n-button size="tiny" text type="error" @click="toggleShow('ping')">隐藏</n-button>
        </div>
        <n-data-table
          :columns="pingColumns"
          :data="pingRows"
          :bordered="true"
          :row-key="rowKey"
          :row-class-name="rowClassName"
          size="small"
          :max-height="560"
          :scroll-x="2000"
        />
      </section>

      <section v-if="showDiao" class="table-wrap">
        <div class="table-head">
          <span class="tbl-title">移门</span>
          <n-button size="tiny" ghost @click="addRowOf('diao')">＋添加行</n-button>
          <n-button v-if="selectedLines.length" size="tiny" text type="error" @click="batchDeleteRows">批量删除({{ selectedLines.length }})</n-button>
          <span class="grow-spacer" />
          <n-button size="tiny" text type="error" @click="toggleShow('diao')">隐藏</n-button>
        </div>
        <n-data-table
          :columns="diaoColumns"
          :data="diaoRows"
          :bordered="true"
          :row-key="rowKey"
          :row-class-name="rowClassName"
          size="small"
          :max-height="560"
          :scroll-x="2200"
        />
      </section>
    </div>

    <!-- 底部合计条 -->
    <div class="totals-strip" v-if="lines.length">
      <n-tag v-if="showPing" size="small">平开门 {{ pingRows.reduce((s,l)=>s+(l.quantity||0),0) }} 樘 / ¥ {{ pingRows.reduce((s,l)=>s+(l.amount||0),0).toFixed(2) }}</n-tag>
      <n-tag v-if="showDiao" size="small">移门 {{ diaoRows.reduce((s,l)=>s+(l.quantity||0),0) }} 樘 / ¥ {{ diaoRows.reduce((s,l)=>s+(l.amount||0),0).toFixed(2) }}</n-tag>
      <span class="grand">合计 ¥ <b>{{ totalPrice.toFixed(2) }}</b> · 门数 {{ doorCount }}</span>
      <span class="bal">余款 ¥ {{ (totalPrice - (order.deposit || 0)).toFixed(2) }}</span>
    </div>

    <!-- 添加门类抽屉（仿旧版：平开门/移门 独立 toggle，可同显） -->
    <n-drawer v-model:show="addTypeOpen" :width="240" placement="right">
      <n-drawer-content title="添加门类" closable>
        <div class="addtype-list">
          <n-button block :type="showPing ? 'error' : 'primary'" @click="toggleShow('ping')">
            平开门{{ showPing ? '（已显示）' : '' }}
          </n-button>
          <n-button block :type="showDiao ? 'error' : 'primary'" @click="toggleShow('diao')">
            移门{{ showDiao ? '（已显示）' : '' }}
          </n-button>
          <n-button block @click="importLastOrder">导入上次订单</n-button>
          <div class="hint">勾选要录入的门类（两表并列显示，可同时打开）。下方各自有「＋添加行」。</div>
        </div>
      </n-drawer-content>
    </n-drawer>

    <!-- 新增加价项目 -->
    <n-modal v-model:show="addMarkupOpen" preset="card" title="新增加价项目" style="width: 480px">
      <div class="vis-col">
        <div class="mgmt-row">
          <span class="mgmt-name">加价项目名</span>
          <n-input v-model:value="addMarkupForm.name" placeholder="加价项目名" style="width: 240px" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">单价</span>
          <n-input-number v-model:value="addMarkupForm.price" :show-button="false" placeholder="单价" style="width: 150px" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">计价方式</span>
          <n-select v-model:value="addMarkupForm.unit" :options="markupUnitOptions" style="width: 150px" />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="addMarkupOpen = false">取消</n-button>
          <n-button @click="addMarkupOnce">单次添加</n-button>
          <n-button type="primary" @click="addMarkupSync">同步保存</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 加价项目管理 -->
    <n-modal v-model:show="markupMgmtOpen" preset="card" title="加价项目管理" style="width: 560px">
      <div class="mgmt-row">
        <n-input v-model:value="mgmtItem.name" placeholder="加价项目名" style="width: 180px" />
        <n-input-number v-model:value="mgmtItem.price" :show-button="false" placeholder="单价" style="width: 110px" />
        <n-select v-model:value="mgmtItem.unit" :options="markupUnitOptions" style="width: 120px" />
        <n-button type="primary" @click="addCatalogItemForMgmt">添加</n-button>
      </div>
      <n-divider style="margin: 10px 0" />
      <div class="mgmt-list">
        <div v-for="(m, i) in markupCatalog" :key="i" class="mgmt-row">
          <span class="mgmt-name">{{ m.name }}</span>
          <span class="mgmt-price">¥{{ m.price }}</span>
          <span class="mgmt-unit">{{ m.unit }}</span>
          <n-button size="tiny" text type="error" @click="removeCatalogItem(i)">删除</n-button>
        </div>
      </div>
      <template #footer>
        <div class="footer"><n-button @click="markupMgmtOpen = false">关闭</n-button></div>
      </template>
    </n-modal>

    <!-- 自动加价设置 -->
    <n-modal v-model:show="autoMarkupOpen" preset="dialog" title="自动加价设置"
      positive-text="确定" negative-text="取消" @positive-click="autoMarkupOpen = false" @negative-click="autoMarkupOpen = false">
      <div class="vis-col">
        <n-checkbox :checked="disableAutoMarkup" @update:checked="toggleAutoMarkup" label="关闭自动加价（超宽/超高/超墙厚/轨道超长/超平米 不自动计算）" />
      </div>
    </n-modal>

    <!-- 开向模式设置 -->
    <n-modal v-model:show="openDirSettingsOpen" preset="card" title="开向模式设置" style="width: 460px">
      <div class="vis-col">
        <n-radio-group v-model:value="modeRadio">
          <n-radio value="">全部模式</n-radio>
          <n-radio value="1">模式1（锁命名）</n-radio>
          <n-radio value="2">模式2（开命名）</n-radio>
        </n-radio-group>
        <p class="hint" style="margin-top: 10px">模式仅影响平开门开向下拉的过滤范围。</p>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="openCustomNames">自定义开向</n-button>
          <n-button @click="onReverseOpenDirNames">反向</n-button>
          <n-button @click="openDirSettingsOpen = false">取消</n-button>
          <n-button type="primary" @click="onConfirmOpenDirMode">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 自定义开向命名 -->
    <n-modal v-model:show="customNamesOpen" preset="card" title="自定义开向命名" style="width: 560px">
      <div class="custom-name-grid">
        <div v-for="d in PING_DIRECTIONS" :key="d" class="custom-name-row">
          <span class="orig">{{ d }}</span>
          <n-input v-model:value="customNamesDraft[d]" size="small" placeholder="留空用原始名" style="width: 200px" />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button type="error" dashed @click="resetCustomNames">重置</n-button>
          <n-button @click="customNamesOpen = false">取消</n-button>
          <n-button type="primary" @click="onConfirmCustomNames">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 列显隐设置（仿旧版 ping_column/diao_column） -->
    <n-modal v-model:show="visOpen" preset="card" title="列显隐设置" style="width: 720px">
      <div class="vis-grid">
        <div class="vis-col">
          <div class="vis-head">平开门</div>
          <n-checkbox
            v-for="c in PING_VIS_KEYS"
            :key="c.key"
            v-model:checked="visDraft.ping_columns[c.key]"
            :label="c.label"
          />
        </div>
        <div class="vis-col">
          <div class="vis-head">移门</div>
          <n-checkbox
            v-for="c in DIAO_VIS_KEYS"
            :key="c.key"
            v-model:checked="visDraft.diao_columns[c.key]"
            :label="c.label"
          />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="visOpen = false">取消</n-button>
          <n-button type="primary" :loading="savingVis" @click="saveVisDialog">保存</n-button>
        </div>
      </template>
    </n-modal>


    <!-- 修改平方数（平方单元格右键，仿旧版） -->
    <n-modal v-model:show="squareDialog" preset="dialog" title="修改平方数" positive-text="确定" negative-text="取消"
      @positive-click="confirmSquare" @negative-click="squareDialog = false">
      <div class="square-dialog">
        <p>当前行自动平方：{{ squareTarget ? squareTarget.square.toFixed(2) : '' }} ㎡</p>
        <n-input-number v-model:value="squareInput" :show-button="false" placeholder="填数字覆盖；-1=恢复自动" style="width: 100%" />
        <p class="hint">-1 表示按门洞宽×高自动计算。</p>
      </div>
    </n-modal>

    <!-- 门图大图预览 -->
    <n-modal v-model:show="previewOpen" preset="card" style="width: 480px" :on-after-leave="() => (previewImg = null)">
      <img v-if="previewImg" :src="previewImg" style="width: 100%; object-fit: contain" />
    </n-modal>

    <!-- 文字传图：输入门图名字生成 PNG -->
    <n-modal v-model:show="textImgOpen" preset="dialog" title="门图名字" positive-text="确认" negative-text="取消"
      @positive-click="confirmTextImg" @negative-click="textImgOpen = false">
      <n-input v-model:value="textImgName" maxlength="24" placeholder="最多 24 个字" @keydown.enter="confirmTextImg" />
    </n-modal>

    <!-- 订单列表 -->
    <n-drawer v-model:show="listOpen" :width="760" placement="right">
      <n-drawer-content title="订单列表" closable>
        <n-data-table
          :columns="orderColumns"
          :data="orders"
          :loading="loadingOrders"
          :bordered="true"
          :row-key="(r: OrderSummaryDto) => r.id"
          :scroll-x="900"
        />
      </n-drawer-content>
    </n-drawer>

    <!-- 回执单预览 -->
    <n-drawer v-model:show="receiptOpen" :width="900" placement="right">
      <n-drawer-content title="回执单预览" closable>
        <div class="receipt-host" v-html="receiptHtml"></div>
        <template #footer>
          <div class="footer">
            <n-button @click="receiptOpen = false">关闭</n-button>
            <n-button @click="downloadReceipt">下载回执单</n-button>
            <n-button @click="shareReceipt">分享</n-button>
            <n-button type="primary" :loading="printing" @click="printReceipt">打印</n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  NButton,
  NCheckbox,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  useDialog,
  useMessage,
} from 'naive-ui'
import type { DataTableColumn, DataTableColumns } from 'naive-ui'
import { api } from '../api/client'
import type {
  ClientDto,
  FormulaDto,
  OrderInput,
  OrderLineInput,
  OrderSummaryDto,
} from '../api/types'
import { isActivePartKey, isCasingTrackActive, recalcForward, type Dimensions, type PartsMap } from '../utils/formulaEngine'
import { printByMode } from '../utils/printService'
import { calculateGlassCount, glassPiecesOf, labelQuantity } from '../utils/printData'
import type { GlassPiece } from '../utils/printData'
import {
  fileToDataUrl,
  genImageId,
  idbGetImage,
  idbPutImage,
  idbRemoveImage,
  textToImageDataUrl,
} from '../utils/imageStore'
import { DIRECTION_IMAGES, PING_DIRECTION_IMAGES } from '../data/directionImages'
import {
  loadMarkupCatalog,
  markupCatalog,
  markupCatalogOptions,
  markupUnitOptions,
  removeCatalogItem,
  sessionAddCatalogItem,
  syncAddCatalogItem,
} from '../composables/useMarkupCatalog'
import {
  confirmCustomNames,
  confirmOpenDirMode,
  customNamesDraft,
  customNamesOpen,
  DIRECTION_STORAGE_KEYS,
  displayDirection,
  loadOpenDirectionSettings,
  modeRadio,
  openCustomNames,
  openDirSettingsOpen,
  openOpenDirSettings,
  PING_DIRECTIONS,
  pingDirectionOptions,
  resetCustomNames,
  reverseOpenDirNames,
} from '../composables/useOpenDirection'

interface PartPreview {
  key: string
  materialName: string
  quantity: number
  result: number
}

interface MarkupItem {
  name: string
  price: number
  unit: string
  amount: number
}

interface Line {
  id: number | null
  line_type: 'ping' | 'diao'
  profile: string
  color: string
  direction: string
  fans: string
  track: string
  casing: string
  edge_binding: string
  hardware: string
  bottom_glass: string
  face_glass: string
  glass_thickness: string
  door_width: number
  door_height: number
  light_window_height: number
  wall_thickness: number
  jiao: number
  mother_door_width: number
  quantity: number
  unit_price: number
  price_type: string
  discount: number
  square: number
  custom_square: number
  other_fee: number
  casing_price: number
  casing_amount: number
  amount: number
  parts: PartPreview[]
  markup: MarkupItem[]
  formula_id: number | null
  remark: string
  install_address: string
  open_img: string
  edge_seal_count: number | null
  seal_board_height: number
  track_length: number
  front_casing_add: number | null
  back_casing_add: number | null
  link_no: string | null
  double_ding: string | null
  light_window_count: number
  image_id: string | null
  image_url: string | null
  progress: string
  hole_size: string
  markup_raw: string
  isSelected?: boolean
}

const message = useMessage()
const dialog = useDialog()

const FANS = [
  '2轨2扇', '2轨3扇', '2轨4扇', '3轨3扇', '单轨单扇', '单轨2扇',
  '3轨4扇2纱', '3轨2扇1纱', '3轨6扇', '4轨4扇', '5轨5扇', '6轨6扇', '7轨7扇',
  '一固一活', '双活',
  '折叠2扇', '折叠3扇', '折叠4扇', '折叠5扇', '折叠6扇',
  '折叠7扇', '折叠8扇', '折叠9扇', '折叠10扇',
]

// 移门/折叠门开向 = 扇数 × 方向后缀；后缀为独立枚举。
const DIRECTION_SUFFIXES = [
  '左前', '右前', '左外', '右外', '左外开', '右外开', '左右外开',
  '左内开', '右内开', '左右内开', '中内开', '中外开', '中开',
  '左前内纱', '右前内纱', '无方向',
]

// 玻璃枚举（面玻/底玻），「无」=单玻。旧版面玻为 白玻/无/磨砂/普通长虹。
const GLASS_OPTIONS = ['白玻', '无', '磨砂', '普通长虹']
// 玻璃厚（旧版顺序 4,8,5,6,10,12,0）
const GLASS_THICKNESS_OPTIONS = ['4', '8', '5', '6', '10', '12', '0']

// 包边类型（套线单/双包，匹配部件 track）。旧版套线种类 autocomplete 为 双包/外包/内包/平框，
// 新版模板同时含「单包」套线部件（1宽2高），故补入「单包」。
const EDGE_BINDING_OPTIONS = ['双包', '单包', '外包', '内包', '平框']

// 套线种类（旧版 autocomplete 候选项；允许自由输入增量语法如「一高一宽」「两高两宽」「-10」）
const CASING_OPTIONS = ['一高一宽', '两高两宽', '一高', '一宽', '双包套线', '单包套线']

// 五金（旧版 getOptions("hardware") 候选）
const HARDWARE_OPTIONS = ['铰链', '锁具1', '锁具2', '拉手', '合页', '执手', '传动器', '天地锁']

// 折叠门开向后缀（旧版 M+P 内折/外折，随折叠N扇选）
const FOLD_DIRECTION_SUFFIXES = [
  '2+0内折', '2+0外折', '0+2内折', '0+2外折',
  '3+0内折', '3+0外折', '0+3内折', '0+3外折', '1+2内折', '1+2外折', '2+1内折', '2+1外折',
  '4+0内折', '4+0外折', '0+4内折', '0+4外折', '1+3内折', '1+3外折', '3+1内折', '3+1外折', '2+2内折', '2+2外折',
  '5+0内折', '5+0外折', '0+5内折', '0+5外折', '4+1内折', '4+1外折', '1+4内折', '1+4外折', '2+3内折', '2+3外折', '3+2内折', '3+2外折',
  '6+0内折', '6+0外折', '0+6内折', '0+6外折', '5+1内折', '5+1外折', '1+5内折', '1+5外折', '4+2内折', '4+2外折', '2+4内折', '2+4外折',
  '7+0内折', '7+0外折', '0+7内折', '0+7外折', '5+2内折', '5+2外折', '2+5内折', '2+5外折', '4+3内折', '4+3外折', '3+4内折', '3+4外折',
  '8+0内折', '8+0外折', '0+8内折', '0+8外折', '4+4内折', '4+4外折',
  '9+0内折', '9+0外折', '0+9内折', '0+9外折',
  '10+0内折', '10+0外折', '0+10内折', '0+10外折', '5+5内折', '5+5外折',
]

// ===== 加价项目目录已抽到 ../composables/useMarkupCatalog（仿旧版 useAddPriceItems）=====

// 新增加价项目弹窗（仿旧版：加价项目名/单价/计价方式 + 取消/单次添加/同步保存）
const addMarkupOpen = ref(false)
const addMarkupTarget = ref<Line | null>(null)
const addMarkupForm = reactive({ name: '', price: 0, unit: '元/套' })

function openAddMarkup(l: Line) {
  addMarkupTarget.value = l
  addMarkupForm.name = ''
  addMarkupForm.price = 0
  addMarkupForm.unit = '元/套'
  addMarkupOpen.value = true
}

// 单次添加：仅加到当前行 + 内存目录（本次会话可选，不持久化）
function addMarkupOnce() {
  const name = addMarkupForm.name.trim()
  if (!name) {
    message.warning('请输入加价项目名')
    return
  }
  const l = addMarkupTarget.value
  if (!l) return
  l.markup = l.markup ?? []
  l.markup.push({ name, price: addMarkupForm.price || 0, unit: addMarkupForm.unit || '元/套', amount: 0 })
  lineRefresh(l)
  sessionAddCatalogItem({ name, price: addMarkupForm.price || 0, unit: addMarkupForm.unit || '元/套' })
  addMarkupOpen.value = false
}

// 同步保存：加到当前行 + 后端持久化目录（永久，其它行/之后可选）
async function addMarkupSync() {
  const name = addMarkupForm.name.trim()
  if (!name) {
    message.warning('请输入加价项目名')
    return
  }
  const l = addMarkupTarget.value
  if (!l) return
  l.markup = l.markup ?? []
  l.markup.push({ name, price: addMarkupForm.price || 0, unit: addMarkupForm.unit || '元/套', amount: 0 })
  lineRefresh(l)
  await syncAddCatalogItem({ name, price: addMarkupForm.price || 0, unit: addMarkupForm.unit || '元/套' })
  addMarkupOpen.value = false
}

// 开向模式/自定义命名已抽到 ../composables/useOpenDirection（仿原版 _0x5a7707）
const directionSuffixOptions = computed(() =>
  [...DIRECTION_SUFFIXES, ...FOLD_DIRECTION_SUFFIXES].map((d) => ({ label: displayDirection(d), value: d })),
)
const fansOptions = FANS.map((f) => ({ label: f, value: f }))
const glassOptions = GLASS_OPTIONS.map((g) => ({ label: g, value: g }))
const glassThicknessOptions = GLASS_THICKNESS_OPTIONS.map((g) => ({ label: g, value: g }))
const edgeBindingOptions = EDGE_BINDING_OPTIONS.map((e) => ({ label: e, value: e }))
const priceTypeOptions = [
  { label: '套', value: '套' },
  { label: '方', value: '方' },
]

const round2 = (v: number) => Math.round(v * 100) / 100

// localStorage 存取（隐私模式 / 配额异常时静默降级）
const LS = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, val: string) {
    try {
      localStorage.setItem(key, val)
    } catch {
      // 忽略
    }
  },
}

// 记忆默认：新建行读取，提交行写回「上一次使用值」。
// 数字清洗：n-input-number 清空时给 null/NaN，统一归零（数量≥1），防后端 400。
// 非负整数先 round 再 clamp；其余尺寸四舍五入到 0 位（毫米/元）。
function sanitizeNum(v: number | null | undefined, min = 0): number {
  const n = Number.isFinite(v) ? (v as number) : 0
  const r = Math.round(n)
  return Math.max(min, r)
}
function sanitizeFloat(v: number | null | undefined, min = 0): number {
  const n = Number.isFinite(v) ? (v as number) : 0
  const r = round2(n)
  return Math.max(min, r)
}

// 自定义方数：空/NaN → -1（自动），其余保留小数，不因 clamp 丢失 -1 哨兵。
function sanitizeCustomSquare(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v as number)) return -1
  if (v === -1) return -1
  return Math.max(-1, round2(v as number))
}

// 行 → 请求体（数字清洗 + 去掉仅前端用的 id）。
function lineInputOf(l: Line): OrderLineInput {
  const { id: _id, ...rest } = l
  return {
    ...rest,
    quantity: sanitizeNum(l.quantity, 1),
    unit_price: sanitizeFloat(l.unit_price),
    // 打折：保留可 <1；0 由后端视为不打折（与原逻辑一致）
    discount: sanitizeFloat(l.discount),
    square: sanitizeFloat(l.square),
    custom_square: sanitizeCustomSquare(l.custom_square),
    other_fee: sanitizeFloat(l.other_fee),
    casing_price: sanitizeFloat(l.casing_price),
    casing_amount: sanitizeFloat(l.casing_amount),
    amount: sanitizeFloat(l.amount),
    door_width: sanitizeNum(l.door_width),
    door_height: sanitizeNum(l.door_height),
    light_window_height: sanitizeNum(l.light_window_height),
    wall_thickness: sanitizeNum(l.wall_thickness),
    jiao: sanitizeNum(l.jiao),
    mother_door_width: sanitizeNum(l.mother_door_width),
    seal_board_height: sanitizeNum(l.seal_board_height),
    track_length: sanitizeNum(l.track_length),
    light_window_count: sanitizeNum(l.light_window_count),
    edge_seal_count:
      l.edge_seal_count == null ? null : sanitizeNum(l.edge_seal_count),
    front_casing_add: l.front_casing_add == null ? null : sanitizeNum(l.front_casing_add),
    back_casing_add: l.back_casing_add == null ? null : sanitizeNum(l.back_casing_add),
  } as unknown as OrderLineInput
}

// 回执单底部「温馨提示」默认文案（后续接入租户配置表后按租户读取）。
const DEFAULT_DECLARATION =
  '1、下单尺寸为包框尺寸（洞口尺寸减去安装空位），如需见光尺寸、包边尺寸请明确说明。\n2、确认后预付订金，出货前付清余款。\n3、订单确认后请在约定时间内修改，超过时间需另付工料费。'

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function today() {
  return fmtDate(new Date())
}

// 订单头
const order = reactive({
  receipt_no: '',
  client_code: '',
  client_name: '',
  phone: '',
  brand: '',
  order_date: today(),
  production_days: 0,
  deposit: 0,
  remark: '',
  salesperson: '',
  install_address: '', // 表头全局默认安装地址（仿原版 _0x17ac36）
})

// 行数据
const lines = ref<Line[]>([])
const saving = ref(false)
// 当前已保存订单 id（null = 尚未保存的新订单）。保存时据此决定 create 还是 update。
const orderId = ref<number | null>(null)
// 两表显隐（仿旧版：平开/移门默认都显示、上下各占整宽）
const showPing = ref(true)
const showDiao = ref(true)
const addTypeOpen = ref(false)

function toggleShow(kind: 'ping' | 'diao') {
  if (kind === 'ping') showPing.value = !showPing.value
  else showDiao.value = !showDiao.value
}

function ensureShown(kind: 'ping' | 'diao') {
  if (kind === 'ping') showPing.value = true
  else showDiao.value = true
}

// 更多功能（次级菜单）—— 高级入口收进这里，主按钮行贴近旧版
const moreMenuOptions = [
  { label: '新建订单', key: 'new' },
  { label: '订单列表', key: 'orders' },
  { label: '回执单预览', key: 'receipt' },
  { label: '标签打印', key: 'labels' },
  { label: '玻璃合片单', key: 'glass' },
  { label: '终端链接', key: 'terminal' },
  { label: '加价项目管理', key: 'markupMgmt' },
  { label: '自动加价设置', key: 'autoMarkup' },
  { label: '开向模式设置', key: 'openDir' },
  { label: '列显隐设置', key: 'columns' },
]

function refreshPage() {
  message.info('已刷新')
}

// ===== 列显隐（仿旧版 ping_column/diao_column，租户级）=====
// 可配置列：key 与列构建里一致；缺省不配置(=显示)。
const PING_VIS_KEYS = [
  { key: 'profile_color', label: '型材/颜色' },
  { key: 'unit_quantity', label: '单价/数量' },
  { key: 'glass', label: '玻璃' },
  { key: 'open_dir', label: '开向' },
  { key: 'track', label: '开向内·锁具(轨道)' },
  { key: 'edge_binding', label: '开向内·包边(套线)' },
  { key: 'door_size', label: '门洞尺寸' },
  { key: 'jiao_lw', label: '吊脚/亮窗' },
  { key: 'hw_board', label: '五金/封板' },
  { key: 'remark', label: '备注' },
  { key: 'progress', label: '生产进度' },
  { key: 'money', label: '金额' },
  { key: 'markup_summary', label: '加价' },
  { key: 'price', label: '计价/打折' },
  { key: 'double_ding', label: '单/双丁' },
  { key: 'wrap', label: '前/后包' },
  { key: 'order_no', label: '单号' },
]
const DIAO_VIS_KEYS = [
  { key: 'profile_color', label: '型材/颜色' },
  { key: 'fans_dir', label: '扇数/开向' },
  { key: 'unit_q_casing', label: '单价/数量/套线' },
  { key: 'glass', label: '玻璃' },
  { key: 'track_line', label: '轨道/套线' },
  { key: 'track', label: '轨道/套线内·轨道' },
  { key: 'edge_binding', label: '轨道/套线内·包边' },
  { key: 'door_size', label: '门洞尺寸' },
  { key: 'lightwin', label: '亮窗' },
  { key: 'jiao_seal', label: '吊脚/边封' },
  { key: 'up_track_hw', label: '上轨/五金' },
  { key: 'remark', label: '备注' },
  { key: 'progress', label: '生产进度' },
  { key: 'money', label: '金额' },
  { key: 'markup_summary', label: '加价' },
  { key: 'price', label: '计价/打折' },
  { key: 'double_ding', label: '单/双丁' },
  { key: 'wrap', label: '前/后包' },
  { key: 'order_no', label: '单号' },
]
// 是否显示某列（缺省都显示）
const pingColVis = reactive<Record<string, boolean>>({})
const diaoColVis = reactive<Record<string, boolean>>({})
function colVis(map: Record<string, boolean>, key: string): boolean {
  return map[key] !== false // 仅当显式 false 才隐藏
}
// 列显隐设置弹窗
const visOpen = ref(false)
const visDraft = reactive({ ping_columns: {} as Record<string, boolean>, diao_columns: {} as Record<string, boolean> })
const savingVis = ref(false)

function openVisDialog() {
  // 从当前生效值初始化草稿（缺省都显示）
  visDraft.ping_columns = {}
  visDraft.diao_columns = {}
  for (const c of PING_VIS_KEYS) visDraft.ping_columns[c.key] = colVis(pingColVis, c.key)
  for (const c of DIAO_VIS_KEYS) visDraft.diao_columns[c.key] = colVis(diaoColVis, c.key)
  visOpen.value = true
}

async function saveVisDialog() {
  savingVis.value = true
  try {
    await api.updateColumnConfig({
      ping_columns: { ...visDraft.ping_columns },
      diao_columns: { ...visDraft.diao_columns },
    })
    // 回写到生效值
    Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
    Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
    for (const [k, v] of Object.entries(visDraft.ping_columns)) pingColVis[k] = v
    for (const [k, v] of Object.entries(visDraft.diao_columns)) diaoColVis[k] = v
    visOpen.value = false
    message.success('列显隐已保存')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存列配置失败')
  } finally {
    savingVis.value = false
  }
}

// 加价项目管理弹窗：管理 markupCatalog（增/删），localStorage 持久化
const markupMgmtOpen = ref(false)
const mgmtItem = reactive({ name: '', price: 0, unit: '元/套' })

function openMarkupMgmt() {
  markupMgmtOpen.value = true
}

async function addCatalogItemForMgmt() {
  const name = mgmtItem.name.trim()
  if (!name) {
    message.warning('请输入加价项目名')
    return
  }
  await syncAddCatalogItem({ name, price: mgmtItem.price || 0, unit: mgmtItem.unit || '元/套' })
  mgmtItem.name = ''
  mgmtItem.price = 0
}

// 自动加价设置（本地开关，仿旧版 smartdoor_disable_auto_markup）
const autoMarkupOpen = ref(false)
const disableAutoMarkup = ref(LS.get('smartdoor_disable_auto_markup') === '1')
function toggleAutoMarkup(v: boolean) {
  disableAutoMarkup.value = v
  LS.set('smartdoor_disable_auto_markup', v ? '1' : '0')
}

async function loadColumnConfig() {
  try {
    const c = await api.getColumnConfig()
    Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
    Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
    for (const [k, v] of Object.entries(c.ping_columns || {})) pingColVis[k] = v
    for (const [k, v] of Object.entries(c.diao_columns || {})) diaoColVis[k] = v
  } catch {
    // 忽略：缺省全显
  }
}

function onConfirmOpenDirMode() {
  message.success(confirmOpenDirMode())
}
function onConfirmCustomNames() {
  message.success(confirmCustomNames())
}
// 反向：打开自定义命名并互换左/右（原版为后端反转+重载，此处做本地等价）
function onReverseOpenDirNames() {
  openCustomNames()
  reverseOpenDirNames()
}

function onMoreSelect(key: string) {
  switch (key) {
    case 'new': newOrder(); break
    case 'orders': void openOrderList(); break
    case 'receipt': openReceipt(); break
    case 'labels': void printLabels(); break
    case 'glass': void printGlass(); break
    case 'terminal': void copyTerminalLink(); break
    case 'markupMgmt': openMarkupMgmt(); break
    case 'autoMarkup': autoMarkupOpen.value = true; break
    case 'openDir': openOpenDirSettings(); break
    case 'columns': openVisDialog(); break
  }
}

const pingRows = computed(() => lines.value.filter((l) => l.line_type === 'ping'))
const diaoRows = computed(() => lines.value.filter((l) => l.line_type === 'diao'))
const totalPrice = computed(() =>
  round2(lines.value.reduce((s, l) => s + (l.amount || 0), 0)),
)
const doorCount = computed(() =>
  lines.value.reduce((s, l) => s + (l.quantity || 0), 0),
)
const dueDate = computed(() => {
  const d = new Date(`${order.order_date || today()}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + (order.production_days || 0) + 1)
  return fmtDate(d)
})

// 顶栏日期（n-date-picker 用时间戳，order.order_date 保持 'YYYY-MM-DD'）
function strToTs(s: string): number {
  const d = new Date(`${s || today()}T00:00:00`)
  return Number.isNaN(d.getTime()) ? new Date().getTime() : d.getTime()
}
const orderDateTs = ref<number>(strToTs(order.order_date))
function onOrderDate(ts: number | null) {
  if (ts == null) return
  order.order_date = fmtDate(new Date(ts))
  orderDateTs.value = ts
}

// 每表底部「添加行」→ 直接往表里插一行默认空行，就地编辑（仿旧版，不弹窗）
function addRowOf(kind: 'ping' | 'diao') {
  ensureShown(kind)
  const l = newLine(kind)
  l.price_type = kind === 'ping' ? LS.get('PriceType') || '套' : '方'
  lines.value.push(l)
  lineRefresh(l)
  message.info(`已添加一行${kind === 'ping' ? '平开门' : '移门'}，直接在表内填写`)
}

// 客户
const clients = ref<ClientDto[]>([])
const clientOptions = computed(() =>
  clients.value.map((c) => ({ label: `${c.name}（${c.code}）`, value: c.code })),
)
let lastAppliedClient = ''

function applyClient(code: string | null) {
  const c = clients.value.find((x) => x.code === code)
  order.client_name = c?.name ?? ''
  order.phone = c?.phone ?? ''
  order.brand = c?.brand ?? ''
  lastAppliedClient = c?.code ?? ''
}

function onClientChange(code: string | null) {
  // 仅当「已有归属客户（加载的订单或已选客户）」且切换到另一客户时，才二次确认是否清空订单行。
  // 新订单首次选择客户不弹窗（已有门类但无归属客户，直接套用客户资料）。
  if (
    lines.value.length > 0 &&
    code &&
    lastAppliedClient &&
    code !== lastAppliedClient
  ) {
    dialog.warning({
      title: '切换客户',
      content: '当前订单已有门类，切换客户将清空现有订单行。是否继续？',
      positiveText: '清空并切换',
      negativeText: '取消',
      onPositiveClick: () => {
        lines.value = []
        applyClient(code)
      },
      onNegativeClick: () => {
        order.client_code = lastAppliedClient || ''
      },
    })
    return
  }
  applyClient(code)
}

// 公式（算料用）
const formulas = ref<FormulaDto[]>([])

// 型材候选（常见型材预设 + 公式名 + 已录入型材历史；旧版来自 material 接口）
// 型材候选按门型分类（仿旧版 initializPing→pingMaterial / initializDiao→diaoMaterial）：
// 平开表只看平开类，移门表只看移门类，避免串型。来源 = 对应门型预设 + 对应 formula_type 公式名 + 对应门型的历史型材。
const PING_PROFILE_PRESETS = ['科蓝108', '108断桥', '平开系统窗', '极简窄边框']
const DIAO_PROFILE_PRESETS = ['90型推拉', '重型推拉门', '108推拉', '中窄边框移门']

function profileOptionsFor(type: 'ping' | 'diao'): { label: string; value: string }[] {
  const presets = type === 'ping' ? PING_PROFILE_PRESETS : DIAO_PROFILE_PRESETS
  const seen = new Set<string>()
  const out: { label: string; value: string }[] = []
  const push = (p: string) => {
    const v = (p || '').trim()
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push({ label: v, value: v })
    }
  }
  for (const p of presets) push(p)
  for (const l of lines.value) if (l.line_type === type) push(l.profile)
  for (const f of formulas.value) {
    const ft = (f.formula_type || '').trim()
    // 型别匹配优先；无型别的公式两边都放（避免隐藏已有数据）
    if (ft === type || ft === '') push(f.name)
  }
  return out
}

const pingProfileOptions = computed(() => profileOptionsFor('ping'))
const diaoProfileOptions = computed(() => profileOptionsFor('diao'))

// 颜色候选（常用色 + 已录入颜色历史）
const COLOR_PRESETS = ['肌肤白', '肌肤黑', '香槟', '砂灰', '深空灰', '象牙白', '星空灰', '哑黑']
const colorOptions = computed<{ label: string; value: string }[]>(() => {
  const seen = new Set<string>()
  const out: { label: string; value: string }[] = []
  const push = (c: string) => {
    const v = (c || '').trim()
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push({ label: v, value: v })
    }
  }
  for (const l of lines.value) push(l.color)
  for (const c of COLOR_PRESETS) push(c)
  return out
})

// 候选源构建通用函数：预设 + 已录入历史
function buildOptions(presets: string[], field: (l: Line) => string): { label: string; value: string }[] {
  const seen = new Set<string>()
  const out: { label: string; value: string }[] = []
  const push = (v: string) => {
    const s = (v || '').trim()
    if (s && !seen.has(s)) {
      seen.add(s)
      out.push({ label: s, value: s })
    }
  }
  for (const p of presets) push(p)
  for (const l of lines.value) push(field(l))
  return out
}

const casingOptions = computed(() => buildOptions(CASING_OPTIONS, (l) => l.casing))
const trackOptions = computed(() => buildOptions(['标配', '重型', '轻轨', '隐形轨道'], (l) => l.track))
const hardwareOptions = computed(() => buildOptions(HARDWARE_OPTIONS, (l) => l.hardware))

function newLine(type: 'ping' | 'diao'): Line {
  // 计价默认：平开门读 PriceType（默认套），吊趟门旧版硬编码「方」。
  const defPriceType = type === 'diao' ? '方' : LS.get('PriceType') || '套'
  let defGlassThickness = LS.get('GlassThickness') || ''
  const defBottomGlass = LS.get('BottomGlass') || ''
  // 底玻=无（单玻）时玻璃厚不得 <8（旧版 ce() 联动）
  if (defBottomGlass === '无' && !(Number(defGlassThickness) >= 8)) defGlassThickness = '8'
  return {
    id: null,
    line_type: type,
    profile: '', color: '', direction: '', fans: '', track: '', casing: '', edge_binding: '', hardware: '',
    bottom_glass: defBottomGlass, face_glass: '白玻', glass_thickness: defGlassThickness,
    door_width: 0, door_height: 0, light_window_height: 0, wall_thickness: 0, jiao: 0,
    mother_door_width: 0,
    quantity: 1, unit_price: 0, price_type: defPriceType, discount: 1,
    square: 0, custom_square: -1, other_fee: 0, casing_price: 0, casing_amount: 0, amount: 0,
    parts: [],
    markup: [],
    formula_id: null, remark: '', install_address: '',
    open_img: '', edge_seal_count: type === 'diao' ? 2 : null, seal_board_height: 0, track_length: 0,
    front_casing_add: null, back_casing_add: null, link_no: null, double_ding: null,
    light_window_count: 0, image_id: null, image_url: null, progress: '', hole_size: '',
    markup_raw: '',
  }
}

// 行编辑（已改行内就地编辑 + 每表底部添加行，无弹窗抽屉）

function dimsOf(l: Line): Dimensions {
  return {
    w: l.door_width || 0,
    h: l.door_height || 0,
    h1: l.light_window_height || 0,
    t: l.wall_thickness || 0,
    j: l.jiao || 0,
    s: l.mother_door_width || 0,
  }
}

function formulaOf(l: Line): FormulaDto | undefined {
  if (l.formula_id == null) return undefined
  return formulas.value.find((f) => f.id === l.formula_id)
}

/** 公式类型是否钻石型（淋浴房 diamondling）。 */
function isDiamond(l: Line): boolean {
  const ft = formulaOf(l)?.formula_type ?? ''
  return ft === 'diamondling' || ft === 'diamond'
}

/** 母门宽显隐：仅子母门/钻石型类公式（或型材含「子母」）才需要/显示（仿原版）。 */
function needsMotherWidth(l: Line): boolean {
  if (isDiamond(l)) return true
  const ft = formulaOf(l)?.formula_type ?? ''
  if (ft === 'mother' || ft === 'childmother' || ft === '子母') return true
  return (l.profile || '').includes('子母')
}

/** 单樘面积（未乘数量）。钻石型：(宽+墙厚+亮窗高)×高/1e6；普通：宽×max(高,亮窗高)/1e6。 */
function singleArea(l: Line): number {
  const w = l.door_width || 0
  const h = l.door_height || 0
  if (isDiamond(l)) {
    return ((w + (l.wall_thickness || 0) + (l.light_window_height || 0)) * h) / 1_000_000
  }
  return (w * Math.max(h, l.light_window_height || 0)) / 1_000_000
}

/** 扇数 N（最小平方倍数：取「扇」前一位数字；活=2；单扇=1）。 */
function fanCount(l: Line): number {
  const fan = l.fans || ''
  if (fan.includes('活')) return 2
  const m = fan.match(/(\d+)\s*扇/)
  if (m) return Number(m[1])
  if (fan.includes('单扇')) return 1
  return 0
}

/** 最小平方数：来自公式 square 配置（数字 或 {扇数:"min-max"}）。0 表示无最小。 */
function minSquareOf(l: Line): number {
  const f = formulaOf(l)
  if (!f) return 0
  const raw = (f.square ?? '').trim()
  if (!raw || raw === '0') return 0
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw)
      const v = obj[l.fans]
      if (v === undefined) return 0
      if (typeof v === 'string' && v.includes('-')) {
        const [lo, hi] = v.split('-').map((x) => Number(x.trim()) || 0)
        return (l.light_window_height || 0) > 0 ? hi : lo
      }
      const n = Number(v)
      return n > 0 ? n : 0
    } catch {
      return 0
    }
  }
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  // 移门：扇数 N × 最小平方
  if (l.line_type === 'diao') return fanCount(l) * n
  return n
}

/** 平方数：自定义方数(>-1) 优先；否则 max(单樘面积, 最小平方) × 数量。 */
function computeSquare(l: Line): number {
  if ((l.custom_square ?? -1) > -1) return l.custom_square
  const min = minSquareOf(l)
  return round2(Math.max(singleArea(l), min) * (l.quantity || 1))
}

/**
 * 套线长度（米）：按套线种类子串解析（一高一宽/两高两宽/一高/一宽/默认 1宽2高）+ "-N" 增量。
 * 高 = max(门洞高, 亮窗总高)，宽 = 门洞宽。
 */
function casingLength(l: Line): number {
  let inc = 0
  const c = l.casing || ''
  if (c.includes('-')) {
    const parts = c.split('-')
    if (parts.length > 1) {
      const n = parts[1]
      if (n.trim() !== '' && !Number.isNaN(Number(n))) inc = Number(n)
    }
  }
  const w = l.door_width || 0
  const h = Math.max(l.door_height || 0, l.light_window_height || 0)
  if (c.includes('一高一宽')) return (w + h + inc) / 1000
  if (c.includes('两高两宽')) return (2 * w + 2 * h + 2 * inc) / 1000
  if (c.includes('一高')) return (h + inc) / 1000
  if (c.includes('一宽')) return (w + inc) / 1000
  return (w + 2 * h + 2 * inc) / 1000
}

/** 套线金额 = 套线长度 × 数量 × 套线单价。 */
function casingAmountOf(l: Line): number {
  if (!(l.casing_price || 0)) return 0
  return round2(casingLength(l) * (l.quantity || 1) * (l.casing_price || 0))
}

/** 金额 = (单价×计价量 + 其它费用 + 套线金额) × 打折，四舍五入。 */
function computeAmount(l: Line): number {
  const base =
    l.price_type === '方'
      ? (l.unit_price || 0) * (l.square || 0)
      : (l.unit_price || 0) * (l.quantity || 1)
  const subtotal = base + (l.other_fee || 0) + (l.casing_amount || 0)
  return round2(subtotal * (l.discount || 0))
}

/** 解析「超宽1500」「超高2200」「超墙厚20」「轨道超长3000」「超平米2」等自动加价项名。 */
function parseAutoMarkup(name: string): { kind: string; threshold: number } | null {
  const m = name.trim().match(/^(超宽|超高|超墙厚|轨道超长|超平米)(\d+(?:\.\d+)?)$/)
  if (!m) return null
  return { kind: m[1], threshold: Number(m[2]) }
}

/** 单条加价项金额：自动加价按阈值与实际尺寸动态计算，普通项按单位公式。 */
function markupAmount(item: MarkupItem, l: Line): number {
  const p = item.price || 0
  const q = l.quantity || 1
  const w = l.door_width || 0
  const h = Math.max(l.door_height || 0, l.light_window_height || 0)
  const t = l.wall_thickness || 0
  const sq = l.square || 0

  const auto = parseAutoMarkup(item.name)
  if (auto) {
    const th = auto.threshold
    switch (auto.kind) {
      case '超宽':
        return l.price_type === '套' && w > th ? ((w - th) / 10) * p * q : 0
      case '超高':
        return l.price_type === '套' && h > th ? ((h - th) / 10) * p * q : 0
      case '超墙厚':
        return t > th ? ((t - th) / 10) * p * q : 0
      case '轨道超长':
        // 直接用阈值数字 / 10（非「实际−N」）
        return (th / 10) * p * q
      case '超平米':
        return sq > th ? (sq - th) * p * q : 0
    }
  }

  switch (item.unit) {
    case '元/方':
      return sq * p
    case '元/米':
      return ((2 * h + w) / 1000) * p * q
    case '元/公分':
      // 无「超*」前缀时按门洞高为基准、阈值 0
      return (h / 10) * p * q
    default: // 元/套、元/支、无
      return p * q
  }
}

/**
 * 重算整行加价：自动加价项按前缀分组，每组仅保留「阈值 ≤ 实际且差值最小」的一项，
 * 其余未匹配的自动项计 0；普通项按单位公式。合计写入 other_fee。
 */
function recalcMarkup(l: Line): number {
  const h = Math.max(l.door_height || 0, l.light_window_height || 0)
  const actualOf = (kind: string): number => {
    switch (kind) {
      case '超宽': return l.door_width || 0
      case '超高': return h
      case '超墙厚': return l.wall_thickness || 0
      case '超平米': return l.square || 0
      case '轨道超长': return Number.POSITIVE_INFINITY
      default: return 0
    }
  }
  const applies = (kind: string, th: number): boolean => {
    if (kind === '超宽' || kind === '超高') return l.price_type === '套' && actualOf(kind) > th
    if (kind === '轨道超长') return true
    return actualOf(kind) > th
  }

  const winners = new Set<MarkupItem>()
  const groups = new Map<string, MarkupItem[]>()
  for (const item of l.markup) {
    const auto = parseAutoMarkup(item.name)
    if (!auto) continue
    const arr = groups.get(auto.kind) ?? []
    arr.push(item)
    groups.set(auto.kind, arr)
  }
  for (const [kind, arr] of groups) {
    const valid = arr.filter((it) => applies(kind, parseAutoMarkup(it.name)!.threshold))
    if (!valid.length) continue
    valid.sort((a, b) => parseAutoMarkup(b.name)!.threshold - parseAutoMarkup(a.name)!.threshold)
    winners.add(valid[0])
  }

  let total = 0
  for (const item of l.markup) {
    if (parseAutoMarkup(item.name) && !winners.has(item)) {
      item.amount = 0
    } else {
      item.amount = round2(markupAmount(item, l))
    }
    total += item.amount
  }
  l.other_fee = round2(total)
  return l.other_fee
}

// —— 取价 / 公式匹配（型材失焦自动回填）已改行内 resolveRow；无弹窗抽屉 ——

// —— 离开拦截（仿旧版 onBeforeRouteLeave / beforeunload）——
function serializeOrder(): string {
  try {
    return JSON.stringify({
      h: { ...order },
      l: lines.value.map((x) => ({ ...x, markup: x.markup, parts: x.parts })),
    })
  } catch {
    return ''
  }
}
let savedSnap = serializeOrder()
function dirtyNow() {
  return serializeOrder() !== savedSnap
}
function markSaved() {
  savedSnap = serializeOrder()
}
onBeforeRouteLeave(() => {
  if (!dirtyNow()) return true
  return window.confirm('存在未保存的修改，离开后将丢失，是否继续离开？')
})
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirtyNow()) return
  e.preventDefault()
  e.returnValue = ''
}

// 导入上次订单：恢复本地草稿（仿旧版「导入上次订单」读 smartdoor_last_order）
function importLastOrder() {
  const raw = LS.get(LS_DRAFT_KEY)
  if (!raw) {
    message.info('没有可导入的上次订单')
    return
  }
  try {
    const data = JSON.parse(raw)
    if (data?.header) Object.assign(order, data.header)
    if (Array.isArray(data.lines)) lines.value = data.lines
    orderId.value = data?.order_id ?? null
    lastAppliedClient = order.client_code ?? ''
    if (order.client_code) applyClient(order.client_code)
    markSaved()
    message.success('已导入上次订单')
  } catch {
    message.error('导入失败：草稿数据损坏')
  }
}

function resetOrder() {
  orderId.value = null
  order.receipt_no = ''
  order.client_code = ''
  order.client_name = ''
  order.phone = ''
  order.brand = ''
  order.order_date = today()
  order.production_days = 0
  order.deposit = 0
  order.remark = ''
  order.salesperson = ''
  order.install_address = ''
  lines.value = []
  lastAppliedClient = ''
  markSaved()
  persistDraft()
}

function newOrder() {
  if (lines.value.length > 0 || orderId.value != null) {
    dialog.warning({
      title: '新建订单',
      content: '新建订单将清空当前订单（未保存的更改会丢失）。是否继续？',
      positiveText: '新建',
      negativeText: '取消',
      onPositiveClick: () => resetOrder(),
    })
  } else {
    resetOrder()
  }
}

// —— 保存整单校验（旧版 makeReceipt 语义，反混淆核对）——
// 必填只在「保存整单」拦截，允许先添加半空行；保存前自动剔除全空行。
// ping：型材/数量/颜色/底玻/面玻/玻璃厚/开向/计价方式；diao：型材/颜色/底玻/面玻/玻璃厚/开向/扇数/轨道种类。
// （旧码门洞宽/高检查是死代码、平开轨道检查是告警不拦截——本版统一补强门洞宽/高，吊趟轨道保留必填。）
function missingFieldsOf(l: Line): string[] {
  const m: string[] = []
  const add = (ok: boolean, name: string) => {
    if (!ok) m.push(name)
  }
  add(!!l.profile.trim(), '型材')
  add(l.door_width > 0, '门洞宽')
  add(l.door_height > 0, '门洞高')
  add(!!l.color.trim(), '颜色')
  add(!!l.bottom_glass.trim(), '底玻')
  add(!!l.face_glass.trim(), '面玻')
  add(!!l.glass_thickness.trim(), '玻璃厚')
  add(!!l.direction.trim(), '开向')
  if (l.line_type === 'ping') {
    add(l.quantity >= 1, '数量')
    add(!!l.price_type.trim(), '计价方式')
  } else {
    add(!!l.fans.trim(), '扇数')
    add(!!l.track.trim(), '轨道种类')
  }
  return m
}

// 整行无任何内容 → 保存前自动剔除（旧版 splice 语义）
function rowHasContent(l: Line): boolean {
  return !!(
    l.profile.trim() ||
    l.door_width > 0 ||
    l.door_height > 0 ||
    l.color.trim() ||
    l.bottom_glass.trim() ||
    l.face_glass.trim() ||
    l.glass_thickness.trim() ||
    l.direction.trim() ||
    l.fans.trim() ||
    l.track.trim() ||
    l.price_type.trim()
  )
}

function removeLine(l: Line) {
  // 已录入行（订单已保存且行有 id）→ 旧版「已录单删除确认」：后端永久删除
  if (orderId.value != null && l.id != null) {
    dialog.warning({
      title: '已录单删除确认',
      content: '该单已经录入成功，删除后将从后台永久删除，慎重操作。',
      positiveText: '永久删除',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          await api.deleteOrderLine(orderId.value!, l.id!)
          lines.value = lines.value.filter((x) => x !== l)
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败')
        }
      },
    })
    return
  }
  dialog.warning({
    title: '删除行',
    content: '确定要删除这一行吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      lines.value = lines.value.filter((x) => x !== l)
    },
  })
}

// ===== 行内就地编辑（仿旧版 Excel 式表格）=====
// 值变更即重算（平方/套线金额/金额/加价），型材失焦触发取价+公式。
const lineRefresh = (l: Line) => {
  l.square = computeSquare(l)
  recalcMarkup(l)
  l.casing_amount = casingAmountOf(l)
  l.amount = computeAmount(l)
}

const lastProf = new WeakMap<object, string>()

// 行内型材取价 + 自动公式（与抽屉 onProfileBlur 同一套，映射到行）
async function resolveRow(l: Line) {
  const profile = l.profile.trim()
  if (!profile || profile === lastProf.get(l)) return
  lastProf.set(l, profile)
  try {
    const r = await api.resolvePrice(l.line_type, profile, order.client_code || undefined)
    if (r) {
      l.unit_price = r.unit_price
      l.price_type = r.price_type === '方' ? '方' : '套'
      if (l.line_type === 'diao' && r.casing_price != null) l.casing_price = r.casing_price
    }
    const m = await api.resolveFormulaMatch(l.line_type, profile, l.fans || undefined)
    if (m) l.formula_id = m.formula_id
  } catch {
    // 静默
  }
  lineRefresh(l)
}

function onBottomGlassRow(l: Line) {
  if (l.bottom_glass === '无' && !(Number(l.glass_thickness) >= 8)) l.glass_thickness = '8'
  lineRefresh(l)
}

// 就地控件 helpers（h() 渲染）
const CELL = { size: 'small' as const }

// 校验红框：必填但为空的字段 → status=error（仿旧版 error-cell 红框标单元格）
function cellError(l: Line, field: string): boolean {
  const t = l.line_type
  switch (field) {
    case 'profile': return !l.profile.trim()
    case 'door_width': return !(l.door_width > 0)
    case 'door_height': return !(l.door_height > 0)
    case 'color': return !l.color.trim()
    case 'bottom_glass': return !l.bottom_glass.trim()
    case 'face_glass': return !l.face_glass.trim()
    case 'glass_thickness': return !l.glass_thickness.trim()
    case 'direction': return !l.direction.trim()
    case 'quantity': return t === 'ping' && !(l.quantity >= 1)
    case 'price_type': return t === 'ping' && !l.price_type.trim()
    case 'fans': return t === 'diao' && !l.fans.trim()
    case 'track': return t === 'diao' && !l.track.trim()
    default: return false
  }
}

function tCell(l: Line, field: string, width: number, onBlur?: (l: Line) => void) {
  return h(
    NInput,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      style: { width: `${width}px` },
      onUpdateValue: (v: string) => {
        ;(l as unknown as Record<string, string>)[field] = v
        lineRefresh(l)
      },
      onBlur: onBlur ? () => onBlur(l) : undefined,
    },
  )
}

function intCell(l: Line, field: string, width: number, min = 0) {
  return h(
    NInputNumber,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, number>)[field],
      min,
      showButton: false,
      style: { width: `${width}px` },
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        ;(l as unknown as Record<string, number>)[field] = sanitizeNum(v, min)
        lineRefresh(l)
      },
    },
  )
}

function moneyCell(l: Line, field: string, width: number, min = 0) {
  return h(
    NInputNumber,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, number>)[field],
      min,
      showButton: false,
      style: { width: `${width}px` },
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        ;(l as unknown as Record<string, number>)[field] = sanitizeFloat(v, min)
        lineRefresh(l)
      },
    },
  )
}

function optCell(
  l: Line,
  field: string,
  width: number,
  options: { label: string; value: string }[],
  onChange?: (l: Line) => void,
  allowCreate = false,
) {
  return h(
    NSelect,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      options,
      filterable: true,
      clearable: true,
      ...(allowCreate ? { tag: true } : {}),
      style: { width: `${width}px` },
      onUpdateValue: (v: string | null) => {
        ;(l as unknown as Record<string, string>)[field] = (v as string) ?? ''
        ;(onChange ?? lineRefresh)(l)
      },
    },
  )
}

// 型材/颜色：带候选下拉（可搜索 + 可输入新值，仿旧版 autocomplete），型材变化即取价/算料
// 型材候选按行门型过滤（平开不显示移门公式）
function profileCell(l: Line, width: number) {
  const opts = l.line_type === 'diao' ? diaoProfileOptions.value : pingProfileOptions.value
  return optCell(l, 'profile', width, opts, (x) => void resolveRow(x), true)
}
// 移门/吊趟开向图：优先用从旧版提取的完整 DIRECTION_IMAGES 表（「扇数+开向」→ 图）。
function diaoDirImage(fans: string, direction: string): string {
  const f = (fans || '').trim()
  const d = (direction || '').trim()
  if (!f || !d) return ''
  return DIRECTION_IMAGES[`${f}${d}`] || ''
}

function colorCell(l: Line, width: number) {
  return optCell(l, 'color', width, colorOptions.value, undefined, true)
}
function trackCell(l: Line, width: number) {
  return optCell(l, 'track', width, trackOptions.value, undefined, true)
}
function casingCell(l: Line, width: number) {
  return optCell(l, 'casing', width, casingOptions.value, undefined, true)
}
function hardwareCell(l: Line, width: number) {
  return optCell(l, 'hardware', width, hardwareOptions.value, undefined, true)
}
// 洞尺/净尺
const HOLE_SIZE_OPTS = ['洞尺', '净尺', '单包洞尺', '双包洞尺'].map((v) => ({ label: v, value: v }))
function holeCell(l: Line, width: number) {
  return optCell(l, 'hole_size', width, HOLE_SIZE_OPTS, undefined, true)
}

// 批量选择列：行首复选框，选中后可批量删除
const selCol = (): DataTableColumn<Line> => ({
  title: ' ',
  key: 'selection',
  width: 34,
  fixed: 'left',
  render: (l: Line) =>
    h(NCheckbox, {
      size: 'small',
      checked: !!l.isSelected,
      onUpdateChecked: (v: boolean) => {
        l.isSelected = v
        checkboxTick.value++
      },
    }),
})
const checkboxTick = ref(0)

// 选中行（跨两表）
const selectedLines = computed(() => {
  void checkboxTick.value
  return lines.value.filter((l) => l.isSelected)
})

function batchDeleteRows() {
  const sel = selectedLines.value
  if (!sel.length) {
    message.warning('请先勾选要删除的行')
    return
  }
  dialog.warning({
    title: '批量删除',
    content: `确定删除选中的 ${sel.length} 行吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      for (const l of sel) {
        if (orderId.value != null && l.id != null) {
          try {
            await api.deleteOrderLine(orderId.value, l.id)
          } catch {
            // 单行删除失败继续
          }
        }
        lines.value = lines.value.filter((x) => x !== l)
      }
      message.success('已删除选中行')
    },
  })
}

// 列构造：操作列 = 一排小链接（仿旧版 保存单行/删除/复制/删图/添加图片/算料/文字传图）
const opsCol = (): DataTableColumn<Line> => ({
  title: '操作',
  key: 'actions',
  width: 96,
  fixed: 'left',
  render: (l) =>
    h(
      'div',
      {
        style:
          'display:flex;flex-wrap:wrap;gap:0 6px;align-items:center;line-height:1.5;font-size:11px;white-space:nowrap',
      },
      [
        h(NButton, { size: 'tiny', text: true, type: 'error', onClick: () => removeLine(l) }, { default: () => '删除' }),
        h(NButton, { size: 'tiny', text: true, onClick: () => copyRow(l) }, { default: () => '复制' }),
        h(NButton, { size: 'tiny', text: true, type: 'warning', onClick: () => void calcSingleRow(l) }, { default: () => '算料' }),
      ],
    ),
})

const sqCell = (l: Line) =>
  h(
    NInput,
    {
      size: 'small',
      readonly: true,
      value: l.square.toFixed(2),
      style: { width: '78px' },
      inputStyle: { textAlign: 'right' },
      onContextmenu: (e: MouseEvent) => {
        e.preventDefault()
        openSquareDialog(l)
      },
      placeholder: '平方',
    },
    { suffix: () => '㎡' },
  )

const amountCell = (l: Line) =>
  h(
    'span',
    { style: 'display:inline-block;min-width:74px;text-align:right;font-weight:600;white-space:nowrap' },
    `¥ ${l.amount.toFixed(2)}`,
  )

// 加价项目列：行内摘要（名称+金额），点击进入行编辑抽屉管理
// 行内加价：多选目录 + 明细行 + 点击添加（自定义→抽屉）
function markupSelectCell(l: Line) {
  const opts = markupCatalogOptions.value
  const selected = (l.markup ?? [])
    .filter((m) => m && m.name)
    .map((m) => {
      const idx = markupCatalog.value.findIndex((c) => c.name === m.name)
      return idx >= 0 ? `${idx}_${m.name}` : `x_${m.name}__${m.price}__${m.unit}`
    })
  const detail = (l.markup ?? []).filter((m) => m && (m.name || (m.amount ?? 0) > 0))
  return h('div', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0' }, [
    h(NSelect, {
      size: 'small',
      multiple: true,
      options: opts,
      value: selected,
      placeholder: '加价…',
      style: { width: '150px' },
      onUpdateValue: (vals: (string | number)[]) => {
        const names = vals.map((v) => String(v))
        l.markup = names.map((n) => {
          const m = n.match(/x_(.+)__([\d.]+)__(.+)/)
          if (m) return { name: m[1], price: Number(m[2]), unit: m[3], amount: 0 }
          const idx = Number(n.split('_')[0])
          const c = markupCatalog.value[idx]
          return c ? { ...c, amount: 0 } : { name: n, price: 0, unit: '元/套', amount: 0 }
        })
        recalcMarkup(l)
      },
    }),
    ...detail.map((m) =>
      h('span', { style: 'font-size:11px;color:#606266;white-space:nowrap' }, `${m.name} ¥${(m.amount ?? 0).toFixed(0)}`),
    ),
    h(
      NButton,
      { size: 'tiny', text: true, type: 'primary', onClick: () => openAddMarkup(l) },
      { default: () => '点击添加…' },
    ),
  ])
}
const markupCol = (): DataTableColumn<Line> => ({
  title: '加价',
  key: 'markup_summary',
  width: 168,
  render: (l) => markupSelectCell(l),
})

// ===== 门花图（行图片）：传图/文字传图/预览/删除 =====
const previewImg = ref<string | null>(null)
const previewOpen = ref(false)
const textImgOpen = ref(false)
const textImgName = ref('')
const textImgTarget = ref<Line | null>(null)

async function applyDoorImg(l: Line, dataUrl: string) {
  const id = genImageId()
  l.image_id = id
  l.image_url = dataUrl
  await idbPutImage(id, dataUrl)
}

function pickDoorImg(l: Line) {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = 'image/*'
  inp.onchange = async () => {
    const f = inp.files?.[0]
    if (!f) return
    try {
      const url = await fileToDataUrl(f)
      await applyDoorImg(l, url)
      message.success('已上传门图')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '上传图片失败')
    }
  }
  inp.click()
}

function removeDoorImg(l: Line) {
  dialog.warning({
    title: '删除门图',
    content: '确定删除该行的门图吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (l.image_id) await idbRemoveImage(l.image_id)
      l.image_id = null
      l.image_url = null
    },
  })
}

function openTextImg(l: Line) {
  textImgTarget.value = l
  textImgName.value = ''
  textImgOpen.value = true
}

function confirmTextImg() {
  const l = textImgTarget.value
  const name = textImgName.value.trim()
  textImgOpen.value = false
  if (!l || !name) return
  if (name.length > 24) {
    message.warning('门图名字最多 24 个字')
    return
  }
  void applyDoorImg(l, textToImageDataUrl(name)).then(() => message.success('已生成文字门图'))
}

// 单行算料：有 formula_id 才计算（仿旧版门图列「算料」）
async function calcSingleRow(l: Line) {
  if (l.formula_id == null) {
    message.warning('该行没有型材数据，无法计算')
    return
  }
  try {
    const f = await api.getFormula(l.formula_id)
    const parts = f.parts as PartsMap
    if (!parts || typeof parts !== 'object' || Array.isArray(parts)) {
      l.parts = []
      return
    }
    const computed = recalcForward(parts, dimsOf(l))
    l.parts = Object.entries(parts)
      .filter(
        ([key, p]) =>
          !!p.formula &&
          isActivePartKey(key, l.fans) &&
          isCasingTrackActive(p.track, l.edge_binding),
      )
      .map(([key, p]) => ({
        key,
        materialName: p.materialName || key,
        quantity: p.quantity || 0,
        result: round2(computed[key] ?? 0),
      }))
    lineRefresh(l)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '算料失败')
  }
}

function doorImgCell(l: Line) {
  if (l.image_url) {
    return h('div', { style: 'position:relative;display:inline-block' }, [
      h('img', {
        src: l.image_url,
        style: 'display:block;width:76px;height:52px;object-fit:contain;border:1px solid #dcdfe6;border-radius:3px;cursor:zoom-in;background:#fff',
        onClick: () => {
          previewImg.value = l.image_url
          previewOpen.value = true
        },
      }),
      h(
        NButton,
        { size: 'tiny', quaternary: true, circle: true, type: 'error', title: '删除门图', style: 'position:absolute;top:-6px;right:-6px', onClick: () => removeDoorImg(l) },
        { icon: () => '×' },
      ),
    ])
  }
  return h(
    'div',
    {
      style:
        'display:flex;align-items:center;justify-content:center;gap:2px;width:76px;height:52px;border:1px dashed #c0c4cc;border-radius:3px;background:#fafafa;cursor:pointer',
      onClick: (e: MouseEvent) => e.stopPropagation(),
    },
    [
      h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: () => pickDoorImg(l) }, { default: () => '传图' }),
      h(NButton, { size: 'tiny', text: true, onClick: () => openTextImg(l) }, { default: () => '文字' }),
    ],
  )
}

// 载入订单后：有 image_id 但无 image_url 的行，从 IndexedDB 回读
async function hydrateRowImages(rows: Line[]) {
  for (const l of rows) {
    if (l.image_id && !l.image_url) {
      const url = await idbGetImage(l.image_id)
      if (url) l.image_url = url
    }
  }
}

// —— 组合单元格工具：一格多控件、紧凑（仿旧版）——
// cRow/cCol：控件可增长（min-width:0）避免文字截断；cRow 的 justify 参数可设为 right/center。
const cRow = (...vs: (import('vue').VNodeChild | null)[]) =>
  h('div', { style: 'display:flex;gap:2px;align-items:center;justify-content:flex-start;white-space:nowrap;min-width:0' }, vs)
const cCol = (...vs: (import('vue').VNodeChild | null)[]) =>
  h('div', { style: 'display:flex;flex-direction:column;gap:1px;align-items:stretch;min-width:0' }, vs)
const sub = (label: string, ctrl: import('vue').VNodeChild | null) =>
  h('div', { style: 'display:flex;align-items:center;gap:2px;min-width:0' }, [
    h('span', { style: 'flex:none;font-size:10px;color:#909399;white-space:nowrap' }, label),
    h('div', { style: 'flex:1;min-width:0' }, [ctrl ?? null]),
  ])

const DOUBLE_DING_OPTS = ['正常', '单丁墙', '双丁墙', '上丁墙', '上丁加单丁', '上丁加双丁'].map((v) => ({
  label: v,
  value: v,
}))
// 单号列（只读，显示所属订单回执单号）
const orderNoCell = () =>
  h('span', { style: 'font-size:11px;color:#606266' }, order.receipt_no || '—')
// 金额列（平方+金额 同格）
const moneyCell_2 = (l: Line) => cCol(amountCell(l), sqCell(l))

const doorImgCol = (): DataTableColumn<Line> => ({
  title: '门图',
  key: 'door_img',
  width: 72,
  fixed: 'left',
  render: (l) => doorImgCell(l),
})

function pingCols(): DataTableColumn<Line>[] {
  return [
    selCol(),
    opsCol(),
    doorImgCol(),
    {
      title: '型材/颜色',
      key: 'profile_color',
      width: 108,
      render: (l) => cCol(profileCell(l, 100), colorCell(l, 100)),
    },
    {
      title: '单价/数量',
      key: 'unit_quantity',
      width: 92,
      render: (l) => cCol(sub('单价', moneyCell(l, 'unit_price', 72)), sub('数量', intCell(l, 'quantity', 72, 1))),
    },
    {
      title: '玻璃',
      key: 'glass',
      width: 118,
      render: (l) =>
        cCol(
          sub('面', optCell(l, 'face_glass', 88, glassOptions)),
          sub('底', optCell(l, 'bottom_glass', 88, glassOptions, onBottomGlassRow)),
          sub('厚', optCell(l, 'glass_thickness', 88, glassThicknessOptions)),
        ),
    },
    {
      title: () =>
        h('div', { style: 'display:flex;align-items:center;gap:3px;cursor:pointer', onClick: openOpenDirSettings }, [
          h('span', '开向'),
          h('span', { style: 'color:#1a7f3c;font-size:11px' }, '⚙'),
        ]),
      key: 'open_dir',
      width: 124,
      render: (l) =>
        cCol(
          ...(colVis(pingColVis, 'edge_binding')
            ? [sub('包边', optCell(l, 'edge_binding', 88, edgeBindingOptions))]
            : []),
          ...(colVis(pingColVis, 'track') ? [sub('锁具', trackCell(l, 88))] : []),
          optCell(l, 'direction', 108, pingDirectionOptions.value),
          h('div', { style: 'display:flex;justify-content:center;padding-top:1px' }, [
            PING_DIRECTION_IMAGES[l.direction]
              ? h('img', {
                  src: PING_DIRECTION_IMAGES[l.direction],
                  style: 'height:26px;width:96px;object-fit:contain;background:#fafafa;border:1px solid #ebeef5;border-radius:2px',
                })
              : h('span', { style: 'color:#c0c4cc;font-size:10px' }, '—'),
          ]),
        ),
    },
    {
      title: '门洞尺寸',
      key: 'door_size',
      width: 76,
      render: (l) =>
        cCol(
          sub('高', intCell(l, 'door_height', 60)),
          sub('宽', intCell(l, 'door_width', 60)),
          sub('墙厚', intCell(l, 'wall_thickness', 60)),
          ...(needsMotherWidth(l) ? [sub('母门宽', intCell(l, 'mother_door_width', 60))] : []),
          sub('洞尺', holeCell(l, 60)),
        ),
    },
    {
      title: '吊脚/亮窗',
      key: 'jiao_lw',
      width: 76,
      render: (l) => cCol(sub('吊脚', intCell(l, 'jiao', 62)), sub('亮窗高', intCell(l, 'light_window_height', 62))),
    },
    {
      title: '五金/封板',
      key: 'hw_board',
      width: 98,
      render: (l) => cCol(sub('五金', hardwareCell(l, 76)), sub('封板高', intCell(l, 'seal_board_height', 76))),
    },
    { title: '生产进度', key: 'progress', width: 92, render: (l) => tCell(l, 'progress', 86) },
    {
      title: '备注',
      key: 'remark',
      width: 96,
      render: (l) => cCol(sub('地址', tCell(l, 'install_address', 80)), sub('备注', tCell(l, 'remark', 80))),
    },
    { title: '金额', key: 'money', width: 140, render: (l) => moneyCell_2(l) },
    markupCol(),
    {
      title: '计价/打折',
      key: 'price',
      width: 100,
      render: (l) => cRow(optCell(l, 'price_type', 50, priceTypeOptions), moneyCell(l, 'discount', 48)),
    },
    { title: '单/双丁', key: 'double_ding', width: 82, render: (l) => optCell(l, 'double_ding', 74, DOUBLE_DING_OPTS) },
    {
      title: '前/后包',
      key: 'wrap',
      width: 96,
      render: (l) =>
        cCol(
          sub('前包', intCell(l, 'front_casing_add', 74)),
          sub('后包', intCell(l, 'back_casing_add', 74)),
        ),
    },
    { title: '单号', key: 'order_no', width: 78, render: () => orderNoCell() },
  ]
}

function diaoCols(): DataTableColumn<Line>[] {
  return [
    selCol(),
    opsCol(),
    doorImgCol(),
    {
      title: '型材/颜色',
      key: 'profile_color',
      width: 108,
      render: (l) => cCol(profileCell(l, 100), colorCell(l, 100)),
    },
    {
      title: '扇数/开向',
      key: 'fans_dir',
      width: 124,
      render: (l) => {
        const img = diaoDirImage(l.fans, l.direction)
        return cCol(
          optCell(l, 'fans', 108, fansOptions, (x) => {
            lineRefresh(x)
            void resolveRow(x)
          }),
          optCell(l, 'direction', 108, directionSuffixOptions.value),
          h('div', { style: 'display:flex;justify-content:center;padding-top:1px' }, [
            img
              ? h('img', {
                  src: img,
                  style: 'height:52px;width:96px;object-fit:contain;background:#fafafa;border:1px solid #ebeef5;border-radius:2px',
                })
              : h('span', { style: 'color:#c0c4cc;font-size:10px;line-height:52px' }, '选扇数/开向显示图'),
          ]),
        )
      },
    },
    {
      title: '单价/数量/套线',
      key: 'unit_q_casing',
      width: 104,
      render: (l) =>
        cCol(
          sub('单价', moneyCell(l, 'unit_price', 84)),
          sub('数量', intCell(l, 'quantity', 84, 1)),
          sub('套线¥', moneyCell(l, 'casing_price', 84)),
        ),
    },
    {
      title: '玻璃',
      key: 'glass',
      width: 118,
      render: (l) =>
        cCol(
          sub('面', optCell(l, 'face_glass', 88, glassOptions)),
          sub('底', optCell(l, 'bottom_glass', 88, glassOptions, onBottomGlassRow)),
          sub('厚', optCell(l, 'glass_thickness', 88, glassThicknessOptions)),
        ),
    },
    {
      title: '轨道/套线',
      key: 'track_line',
      width: 108,
      render: (l) =>
        cCol(
          ...(colVis(diaoColVis, 'track') ? [sub('轨道', trackCell(l, 88))] : []),
          sub('套线', casingCell(l, 88)),
          ...(colVis(diaoColVis, 'edge_binding') ? [sub('包边', optCell(l, 'edge_binding', 88, edgeBindingOptions))] : []),
        ),
    },
    {
      title: '门洞尺寸',
      key: 'door_size',
      width: 76,
      render: (l) =>
        cCol(
          sub('高', intCell(l, 'door_height', 60)),
          sub('宽', intCell(l, 'door_width', 60)),
          sub('墙厚', intCell(l, 'wall_thickness', 60)),
          ...(needsMotherWidth(l) ? [sub('母门宽', intCell(l, 'mother_door_width', 60))] : []),
          sub('洞尺', holeCell(l, 60)),
        ),
    },
    {
      title: '亮窗',
      key: 'lightwin',
      width: 76,
      render: (l) => cCol(sub('总高', intCell(l, 'light_window_height', 62)), sub('数量', intCell(l, 'light_window_count', 62))),
    },
    {
      title: '吊脚/边封',
      key: 'jiao_seal',
      width: 76,
      render: (l) => cCol(sub('吊脚', intCell(l, 'jiao', 62)), sub('边封数', intCell(l, 'edge_seal_count', 62, 2))),
    },
    {
      title: '上轨/五金',
      key: 'up_track_hw',
      width: 98,
      render: (l) => cCol(sub('轨道长', intCell(l, 'track_length', 76)), sub('五金', hardwareCell(l, 76))),
    },
    { title: '生产进度', key: 'progress', width: 92, render: (l) => tCell(l, 'progress', 86) },
    {
      title: '备注',
      key: 'remark',
      width: 96,
      render: (l) => cCol(sub('地址', tCell(l, 'install_address', 80)), sub('备注', tCell(l, 'remark', 80))),
    },
    { title: '金额', key: 'money', width: 140, render: (l) => moneyCell_2(l) },
    markupCol(),
    {
      title: '计价/打折',
      key: 'price',
      width: 100,
      render: (l) => cRow(optCell(l, 'price_type', 50, priceTypeOptions), moneyCell(l, 'discount', 48)),
    },
    { title: '单/双丁', key: 'double_ding', width: 82, render: (l) => optCell(l, 'double_ding', 74, DOUBLE_DING_OPTS) },
    {
      title: '前/后包',
      key: 'wrap',
      width: 96,
      render: (l) =>
        cCol(
          sub('前包', intCell(l, 'front_casing_add', 74)),
          sub('后包', intCell(l, 'back_casing_add', 74)),
        ),
    },
    { title: '单号', key: 'order_no', width: 78, render: () => orderNoCell() },
  ]
}

const rowKey = (r: Line) => (r.id ?? r) as unknown as number
// 未保存行（尚未录入、id=null）高亮，仿旧版 unsaved-row
const rowClassName = (r: Line) => (r.id == null ? 'unsaved-row' : '')
type KeyedCol = DataTableColumn<Line> & { key: string }
const pingColumns = computed<DataTableColumn<Line>[]>(() =>
  pingCols().filter((c) => colVis(pingColVis, (c as KeyedCol).key ?? '')),
)
const diaoColumns = computed<DataTableColumn<Line>[]>(() =>
  diaoCols().filter((c) => colVis(diaoColVis, (c as KeyedCol).key ?? '')),
)

// 复制行（仿旧版：清生产进度/单号/图片）
function copyRow(l: Line) {
  const copy: Line = JSON.parse(JSON.stringify(l))
  copy.id = null
  copy.progress = ''
  copy.link_no = null
  copy.image_id = null
  copy.image_url = null
  lines.value.push(copy)
  lineRefresh(copy)
  message.success('复制成功')
}

// 修改平方数（平方单元格右键，仿旧版）
const squareDialog = ref(false)
const squareTarget = ref<Line | null>(null)
const squareInput = ref(-1)

function openSquareDialog(l: Line) {
  squareTarget.value = l
  squareInput.value = l.custom_square >= 0 ? l.custom_square : -1
  squareDialog.value = true
}

function confirmSquare() {
  if (squareTarget.value) {
    squareTarget.value.custom_square = sanitizeCustomSquare(squareInput.value)
    lineRefresh(squareTarget.value)
  }
  squareDialog.value = false
}

// 保存
async function saveOrder() {
  if (lines.value.length === 0) {
    message.warning('请先添加门类，填写订单信息！')
    return
  }
  if (!order.client_name) {
    message.warning('请先选择客户')
    return
  }
  // 剔除整行空行；其余行按门型检查必填，缺失则拦保存并列出（旧版 makeReceipt 语义）
  lines.value = lines.value.filter(rowHasContent)
  if (lines.value.length === 0) {
    message.warning('请先添加门类，填写订单信息！')
    return
  }
  const problems = lines.value
    .map((l, i) => ({ row: i + 1, missing: missingFieldsOf(l) }))
    .filter((p) => p.missing.length > 0)
  if (problems.length) {
    const detail = problems
      .map((p) => `第${p.row}行缺：${p.missing.join('、')}`)
      .join('\n')
    message.error(`请补充必填信息！\n${detail}`)
    return
  }
  saving.value = true
  try {
    // 表头全局默认安装地址：行内地址为空的行用默认值回填（仿原版）
    if (order.install_address.trim()) {
      for (const l of lines.value) {
        if (!l.install_address.trim()) l.install_address = order.install_address.trim()
      }
    }
    const payload: OrderInput = {
      receipt_no: order.receipt_no,
      client_code: order.client_code,
      client_name: order.client_name,
      phone: order.phone,
      brand: order.brand,
      order_date: order.order_date,
      production_days: order.production_days,
      deposit: order.deposit,
      remark: order.remark,
      salesperson: order.salesperson,
      lines: lines.value.map(lineInputOf),
    }
    const saved =
      orderId.value != null
        ? await api.updateOrder(orderId.value, payload)
        : await api.createOrder(payload)
    orderId.value = saved.id
    order.receipt_no = saved.receipt_no
    // 回填/刷新服务端分配的行 id（create 与整单 update 后行顺序一致）
    saved.lines.forEach((sl, i) => {
      const local = lines.value[i]
      if (local) local.id = sl.id
    })
    persistDraft()
    markSaved()
    message.success(`订单已保存（${saved.receipt_no}）`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

// 订单列表
const listOpen = ref(false)
const orders = ref<OrderSummaryDto[]>([])
const loadingOrders = ref(false)

const orderColumns: DataTableColumns<OrderSummaryDto> = [
  { title: '回执单号', key: 'receipt_no', width: 120 },
  { title: '客户', key: 'client_name', minWidth: 120 },
  { title: '日期', key: 'order_date', width: 110 },
  { title: '截止', key: 'due_date', width: 110 },
  { title: '门数', key: 'door_count', width: 60 },
  { title: '总价', key: 'total_price', width: 100, render: (o) => o.total_price.toFixed(2) },
  { title: '定金', key: 'deposit', width: 90, render: (o) => o.deposit.toFixed(2) },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    render: (o) =>
      h(NSpace, { size: 4 }, {
        default: () => [
          h(NButton, { size: 'tiny', type: 'primary', onClick: () => loadOrder(o.id) }, { default: () => '载入' }),
          h(NButton, { size: 'tiny', type: 'error', onClick: () => removeOrder(o) }, { default: () => '删除' }),
        ],
      }),
  },
]

async function openOrderList() {
  listOpen.value = true
  await refreshOrders()
}

async function refreshOrders() {
  loadingOrders.value = true
  try {
    orders.value = await api.listOrders()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载订单失败')
  } finally {
    loadingOrders.value = false
  }
}

async function loadOrder(id: number) {
  try {
    const o = await api.getOrder(id)
    orderId.value = o.id
    order.receipt_no = o.receipt_no
    order.client_code = o.client_code
    lastAppliedClient = o.client_code
    order.client_name = o.client_name
    order.phone = o.phone
    order.brand = o.brand
    order.order_date = o.order_date
    order.production_days = o.production_days
    order.deposit = o.deposit
    order.remark = o.remark
    order.salesperson = o.salesperson
    lines.value = o.lines.map((l) => ({
      id: l.id,
      line_type: l.line_type === 'diao' ? 'diao' : 'ping',
      profile: l.profile, color: l.color, direction: l.direction, fans: l.fans,
      track: l.track, casing: l.casing, edge_binding: l.edge_binding, hardware: l.hardware,
      bottom_glass: l.bottom_glass, face_glass: l.face_glass, glass_thickness: l.glass_thickness,
      door_width: l.door_width, door_height: l.door_height, light_window_height: l.light_window_height,
      wall_thickness: l.wall_thickness, jiao: l.jiao, mother_door_width: l.mother_door_width,
      quantity: l.quantity, unit_price: l.unit_price, price_type: l.price_type, discount: l.discount,
      square: l.square, custom_square: l.custom_square, other_fee: l.other_fee,
      casing_price: l.casing_price, casing_amount: l.casing_amount, amount: l.amount,
      parts: (l.parts as PartPreview[]) ?? [], markup: (l.markup as MarkupItem[]) ?? [],
      formula_id: l.formula_id, remark: l.remark, install_address: l.install_address,
      open_img: l.open_img, edge_seal_count: l.edge_seal_count, seal_board_height: l.seal_board_height,
      track_length: l.track_length, front_casing_add: l.front_casing_add, back_casing_add: l.back_casing_add,
      link_no: l.link_no, double_ding: l.double_ding, light_window_count: l.light_window_count,
      image_id: l.image_id, image_url: l.image_url, progress: l.progress, hole_size: l.hole_size,
      markup_raw: l.markup_raw,
    }))
    void hydrateRowImages(lines.value)
    listOpen.value = false
    markSaved()
    message.success('已载入订单')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '载入失败')
  }
}

function removeOrder(o: OrderSummaryDto) {
  dialog.warning({
    title: '删除订单',
    content: `确定删除订单「${o.receipt_no}」吗？删除后不可恢复！`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.deleteOrder(o.id)
        message.success('删除成功')
        await refreshOrders()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '删除失败')
      }
    },
  })
}

// 回执单预览 / 打印
const receiptOpen = ref(false)

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const num = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '0.00')

const typeName = (t: string) => (t === 'diao' ? '吊趟门' : '平开门')

function lineOpenLabel(l: Line): string {
  const dir = displayDirection(l.direction)
  return l.line_type === 'diao' ? [l.fans, dir].filter(Boolean).join('') : dir
}

const installAddresses = computed(() => {
  const set = new Set<string>()
  for (const l of lines.value) if (l.install_address) set.add(l.install_address)
  return [...set].join('、')
})

// 展示用安装地址：表头默认优先，否则取行聚合。
const orderInstallAddress = computed(() => order.install_address || installAddresses.value)

const receiptHtml = computed(() => {
  const rows = lines.value
    .map((l, i) => {
      const size = l.door_width || l.door_height ? `${l.door_width}×${l.door_height}` : '—'
      const glass = [l.bottom_glass, l.face_glass].filter(Boolean).join('/')
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(typeName(l.line_type))}</td>
        <td>${esc(l.profile)}</td>
        <td>${esc(l.color)}</td>
        <td>${esc(lineOpenLabel(l))}</td>
        <td class="c">${esc(size)}</td>
        <td>${esc(glass)}</td>
        <td class="r">${num(l.square)}</td>
        <td class="c">${l.quantity}</td>
        <td class="r">${num(l.unit_price)}</td>
        <td class="r">${num(l.amount)}</td>
        <td>${esc(l.remark)}</td>
      </tr>`
    })
    .join('')

  const empty = rows ? '' : '<tr><td colspan="12" class="empty">暂无订单行</td></tr>'

  return `<style>
    .rcp{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2329;font-size:13px;line-height:1.5}
    .rcp-title{font-size:20px;font-weight:700;text-align:center;letter-spacing:2px}
    .rcp-sub{text-align:center;color:#999;font-size:12px;margin:2px 0 12px}
    .rcp-meta{display:flex;flex-wrap:wrap;gap:6px 18px;margin-bottom:12px}
    .rcp-meta b{color:#1f2329}
    .rcp-table{width:100%;border-collapse:collapse;table-layout:fixed}
    .rcp-table th,.rcp-table td{border:1px solid #d9d9d9;padding:4px 6px;word-break:break-all;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rcp-table th{background:#f5f7fa;font-weight:600;text-align:center;font-size:12px}
    .rcp-table td{font-size:12px}
    .rcp-table .c{text-align:center}
    .rcp-table .r{text-align:right}
    .rcp-table .empty{text-align:center;color:#999;padding:16px}
    .rcp-summary{display:flex;justify-content:flex-end;gap:24px;margin-top:12px;font-size:14px;align-items:center}
    .rcp-balance{color:#d03050;font-weight:700;font-size:18px}
    .rcp-foot{margin-top:12px;padding-top:10px;border-top:1px dashed #d9d9d9;color:#555}
    .rcp-foot div{white-space:pre-wrap}
    @media print{@page{size:A4;margin:12mm}body{margin:0}}
  </style>
  <div class="rcp">
    <div class="rcp-title">智能门窗 · 回执单</div>
    <div class="rcp-sub">订单确认单</div>
    <div class="rcp-meta">
      <span>回执单号：<b>${esc(order.receipt_no || '（未生成）')}</b></span>
      <span>客户：<b>${esc(order.client_name || '—')}${order.client_code ? `（${esc(order.client_code)}）` : ''}</b></span>
      <span>电话：${esc(order.phone || '—')}</span>
      <span>品牌：${esc(order.brand || '—')}</span>
      <span>下单日期：${esc(order.order_date || '—')}</span>
      <span>截止日期：${esc(dueDate.value || '—')}</span>
      <span>业务员：${esc(order.salesperson || '—')}</span>
      <span>生产周期：${order.production_days || 0} 天</span>
    </div>
    <table class="rcp-table">
      <thead>
        <tr>
          <th style="width:32px">#</th>
          <th style="width:56px">类型</th>
          <th>型材</th>
          <th style="width:60px">颜色</th>
          <th style="width:96px">开向/扇数</th>
          <th style="width:84px">尺寸(mm)</th>
          <th style="width:60px">玻璃</th>
          <th style="width:56px">平方</th>
          <th style="width:40px">数量</th>
          <th style="width:60px">单价</th>
          <th style="width:72px">金额</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>${rows}${empty}</tbody>
    </table>
    <div class="rcp-summary">
      <span>门数：<b>${doorCount.value}</b></span>
      <span>总价：<b>¥ ${num(totalPrice.value)}</b></span>
      <span>定金：¥ ${num(order.deposit || 0)}</span>
      <span class="rcp-balance">余款：¥ ${num(totalPrice.value - (order.deposit || 0))}</span>
    </div>
    <div class="rcp-foot">
      <div>订单备注：${esc(order.remark || '—')}</div>
      <div>安装地址：${esc(orderInstallAddress.value || '—')}</div>
    </div>
  </div>`
})

function openReceipt() {
  receiptOpen.value = true
}

function buildReceiptDoc(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>回执单 ${esc(order.receipt_no || '')}</title>
<style>*{box-sizing:border-box}body{background:#fff}</style>
</head>
<body>${receiptHtml.value}</body>
</html>`
}

// —— 回执单打印：优先走 hiprint 真实模板（print_templates.receipt），失败兜底 HTML ——
const printing = ref(false)

function receiptPrintData() {
  const rows = lines.value.map((l) => ({
    profile2: l.profile,
    direction: lineOpenLabel(l),
    openImg: l.open_img || '',
    doorImg: l.image_url || '',
    glass: [l.bottom_glass, l.face_glass].filter(Boolean).join('/'),
    size: l.door_width || l.door_height ? `${l.door_width}×${l.door_height}` : '',
    quantity: l.quantity,
    price: l.unit_price,
    amount: l.amount,
    pricing: l.price_type,
    remark: l.remark,
  }))
  const total = totalPrice.value
  const deposit = order.deposit || 0
  return {
    brand: tenantName.value || '智能门窗',
    date: order.order_date || today(),
    orderNo: order.receipt_no || '',
    tel: order.phone || '',
    address: orderInstallAddress.value || '',
    productionDays: order.production_days || 0,
    client: order.client_name || '',
    deposit,
    total,
    balance: total - deposit,
    TotalBalance: total - deposit,
    declaration: DEFAULT_DECLARATION,
    payQrcode: '',
    orderQrcode: terminalLink.value || '',
    receipt: rows,
  }
}

async function printReceipt() {
  if (printing.value) return
  printing.value = true
  try {
    await printByMode('receipt', receiptPrintData())
  } catch (e) {
    // 模板缺失 / hiprint 初始化失败 → 回退 HTML 打印
    printReceiptHtml()
  } finally {
    printing.value = false
  }
}

function printReceiptHtml() {
  const doc = buildReceiptDoc()
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  if (!win) {
    message.error('无法打开打印窗口')
    return
  }
  win.document.open()
  win.document.write(doc)
  win.document.close()
  // 等样式/字体就绪后再打印
  setTimeout(() => {
    win.focus()
    win.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, 250)
}

// —— 标签打印（lable 模板）：每行按 labelQuantity 生成对应张数 ——
function labelRow(l: Line) {
  return {
    orderID: order.receipt_no || '',
    qrcode: terminalLink.value || '',
    client: order.client_name || '',
    door: typeName(l.line_type),
    size: l.door_width || l.door_height ? `${l.door_width}×${l.door_height}` : '',
    lockway: lineOpenLabel(l),
    color: l.color,
    glass: [l.bottom_glass, l.face_glass].filter(Boolean).join('/'),
    address: l.install_address || '',
    remark: l.remark,
    package: '',
  }
}

function labelRows(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const l of lines.value) {
    const n = labelQuantity({
      lineType: l.line_type as 'ping' | 'diao',
      fans: l.fans,
      quantity: l.quantity,
      lightWindowHeight: l.light_window_height,
      wallThickness: l.wall_thickness,
      casingPrice: l.casing_price,
      profile: l.profile,
      registrant: tenantName.value,
    })
    const row = labelRow(l)
    for (let i = 0; i < n; i++) rows.push(row)
  }
  return rows
}

async function printLabels() {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  const rows = labelRows()
  if (!rows.length) {
    message.warning('标签数量为 0，无需打印')
    return
  }
  try {
    await printByMode('lable', rows)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '标签打印失败')
  }
}

// —— 玻璃合片单打印（glass 模板）——
// 玻璃部件 → 尺寸映射：从算料部件识别玻璃部件（含「玻」且以宽/高结尾），按前缀配对成一片玻璃，
// 宽/高沿用算料 result，张数按单/双玻计算。有玻璃部件时每片一行，否则退化为每行一条汇总。
function glassSpecText(l: Line): string {
  const bottom = l.bottom_glass || '无'
  const face = l.face_glass || '无'
  if (bottom === '无' && face === '无') return '无'
  if (bottom === '无') return `单玻:${face}`
  if (face === '无') return `单玻:${bottom}`
  return `${bottom}/${face}`
}

function glassCountOf(l: Line): number {
  const ft = formulaOf(l)?.formula_type ?? ''
  return calculateGlassCount({
    partName: '玻璃',
    partQuantity: 1,
    bottomGlass: l.bottom_glass || '无',
    faceGlass: l.face_glass || '无',
    formulaType: ft,
    quantity: l.quantity,
  })
}

function glassPiecesOfLine(l: Line): GlassPiece[] {
  return glassPiecesOf(l.parts, {
    bottomGlass: l.bottom_glass,
    faceGlass: l.face_glass,
    glassThickness: l.glass_thickness ? `${l.glass_thickness}mm` : '',
    quantity: l.quantity,
  })
}

function glassProduces(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const l of lines.value) {
    const base = {
      client: order.client_name || '',
      door: typeName(l.line_type),
      OrderID: order.receipt_no || '',
      basicInfo: l.door_width || l.door_height ? `${l.door_width}×${l.door_height}` : '',
      lockImg: l.open_img || '',
      doorImg: l.image_url || '',
      remark: l.remark,
    }
    const pieces = glassPiecesOfLine(l)
    if (pieces.length) {
      const spec = glassSpecText(l)
      for (const p of pieces) {
        const label = p.name !== '玻璃' ? `${p.name} ` : ''
        const doorsheet = [`${label}${p.width}×${p.height}`, p.thickness, spec, `${p.count}片`]
          .filter(Boolean)
          .join(' ')
        rows.push({ ...base, doorsheet })
      }
    } else {
      // 无玻璃部件（未选公式/无玻璃）→ 一行汇总，无逐片尺寸
      const spec = glassSpecText(l)
      const thick = l.glass_thickness ? `${l.glass_thickness}mm` : ''
      const count = glassCountOf(l)
      const doorsheet = spec === '无' ? '无' : [thick, spec, `${count}片`].filter(Boolean).join(' ')
      rows.push({ ...base, doorsheet })
    }
  }
  return rows
}

async function printGlass() {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  try {
    await printByMode('glass', { produces: glassProduces() })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '玻璃单打印失败')
  }
}

// —— 回执单分享 / 下载（无外部依赖：下载独立 HTML、分享文本摘要） ——
function receiptTextSummary(): string {
  const head = [
    `回执单号：${order.receipt_no || '未生成'}`,
    `客户：${order.client_name || '—'}${order.client_code ? `（${order.client_code}）` : ''}`,
    `电话：${order.phone || '—'}`,
    `下单日期：${order.order_date || '—'}`,
    `截止日期：${dueDate.value || '—'}`,
  ].join('\n')
  const rows = lines.value
    .map((l, i) => {
      const size = l.door_width || l.door_height ? `${l.door_width}×${l.door_height}` : '—'
      const glass = [l.bottom_glass, l.face_glass].filter(Boolean).join('/')
      return `${i + 1}. ${typeName(l.line_type)} ${l.profile} ${l.color} ${lineOpenLabel(l)} ${size} ${glass} ×${l.quantity} ¥${num(l.amount)}`
    })
    .join('\n')
  const foot = `门数：${doorCount.value} | 总价：¥${num(totalPrice.value)} | 定金：¥${num(order.deposit || 0)} | 余款：¥${num(totalPrice.value - (order.deposit || 0))}`
  return [head, rows, foot].join('\n')
}

function downloadReceipt() {
  const blob = new Blob([buildReceiptDoc()], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `回执单_${order.receipt_no || '未生成'}.html`
  a.click()
  URL.revokeObjectURL(url)
}

async function shareReceipt() {
  const text = receiptTextSummary()
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: '回执单', text })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      // 分享被拒/失败 → 回退复制
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    message.success('回执单内容已复制')
  } catch {
    message.error('分享失败，请手动复制')
  }
}

// —— 终端链接 token ——
// 兼容旧版算法：a = tenant_id + 1000, x = 7 × 客户编号 + 1987, t = 时间戳 + 888。
// 终端页（只读订单视图）后续接入后消费 param2 token；当前仅生成并复制链接。
const tenantId = ref(0)
const tenantName = ref('')

const currentClient = computed(() =>
  clients.value.find((c) => c.code === order.client_code),
)

function buildTerminalToken(clientId: number): string {
  const a = tenantId.value + 1000
  const x = 7 * clientId + 1987
  const t = Date.now() + 888
  return `${a}af${x}wy${t}`
}

const terminalLink = computed(() => {
  const c = currentClient.value
  if (!c) return ''
  const token = buildTerminalToken(c.id)
  const p = new URLSearchParams({
    param1: order.client_name || c.name,
    param2: token,
    receiptNo: order.receipt_no,
  })
  return `${window.location.origin}/terminal?${p.toString()}`
})

async function copyTerminalLink() {
  if (!currentClient.value) {
    message.warning('请先选择客户')
    return
  }
  try {
    await navigator.clipboard.writeText(terminalLink.value)
    message.success('终端链接已复制')
  } catch {
    message.error('复制失败，请手动复制')
  }
}

// —— 订单草稿持久化（localStorage 断点续传） ——
const LS_DRAFT_KEY = 'hui_order_draft_v1'

function persistDraft() {
  try {
    localStorage.setItem(
      LS_DRAFT_KEY,
      JSON.stringify({ header: { ...order }, lines: lines.value }),
    )
  } catch {
    // 忽略（隐私模式 / 配额）
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(LS_DRAFT_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data?.header) Object.assign(order, data.header)
    if (Array.isArray(data.lines)) lines.value = data.lines
    lastAppliedClient = order.client_code
    message.success('已恢复上次未保存的订单')
  } catch {
    // 忽略损坏数据
  }
}

let persistTimer: number | undefined
watch(
  [() => ({ ...order }), lines],
  () => {
    if (persistTimer !== undefined) window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(persistDraft, 400)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onMounted(async () => {
  restoreDraft()
  loadOpenDirectionSettings()
  void loadMarkupCatalog()
  void loadColumnConfig()
  markSaved()
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('storage', (e) => {
    if (DIRECTION_STORAGE_KEYS.includes(e.key || '')) {
      loadOpenDirectionSettings()
    }
  })
  try {
    const me = await api.me()
    tenantId.value = me.tenant.id
    tenantName.value = me.tenant.name
  } catch {
    // 忽略：终端链接回退 tenant_id=0
  }
  try {
    clients.value = await api.listClients()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载客户失败')
  }
  try {
    formulas.value = await api.listFormulas()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载公式失败')
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #fff;
  padding: 12px 16px 24px;
}
.header-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
}
.field {
  display: flex;
  align-items: center;
  gap: 6px;
}
.field .label {
  white-space: nowrap;
  color: #666;
  font-size: 13px;
}
.field.grow {
  flex: 1;
  min-width: 220px;
}
.summary-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 6px;
}
.summary-bar .total {
  font-size: 15px;
  margin-left: auto;
}
.summary-bar .total b {
  color: #e8801f;
  font-size: 20px;
}
.summary-bar .balance {
  color: #18a058;
  font-size: 14px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.lines-card {
  margin-top: 16px;
}
.dims-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}
.dims-grid .n-form-item {
  width: calc(50% - 8px);
}
.dims-grid .n-form-item.grow {
  width: 100%;
}
.calc-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.parts-preview {
  margin-top: 12px;
}
.markup-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.markup-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.markup-amount {
  min-width: 90px;
  text-align: right;
  color: #e8801f;
  font-weight: 600;
}
.markup-total {
  margin-top: 8px;
  text-align: right;
  color: #18a058;
  font-weight: 600;
}
.receipt-host {
  overflow-x: auto;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* —— 新版骨架（仿旧版命令行 + 就地表单行 + 两表并排网格）—— */
.top-bar {
  border-top: 2px solid #1a7f3c;
  border-bottom: 1px solid #ebeef5;
  background: #fafbfc;
  padding: 8px 10px 12px;
  margin-bottom: 10px;
}
.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
}
.grow-spacer {
  flex: 1;
}
.readonly-meta {
  white-space: nowrap;
}
.readonly-meta .due {
  color: #999;
  font-size: 12px;
  margin-left: 8px;
}
.addr-readonly {
  color: #666;
  font-size: 13px;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
}
.empty-hint {
  padding: 48px 20px;
  text-align: center;
  color: #909399;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  background: #fff;
  margin-top: 12px;
}
.table-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.tbl-title {
  font-weight: 600;
  font-size: 14px;
}
/* 两表并排网格：两张表同排，各自横向滚动（仿旧版） */
.tables-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.table-wrap {
  border: 1px solid #ebeef5;
  background: #fff;
}
.table-wrap .table-head {
  padding: 6px 8px;
  background: #f7f8fa;
  border-bottom: 1px solid #ebeef5;
}
/* 表头列名绿色（仿旧版） */
.table-wrap :deep(.n-data-table .n-data-table-th) {
  background: #f0f4f1;
}
.table-wrap :deep(.n-data-table .n-data-table-th .n-data-table-th__title) {
  font-size: 12px;
  font-weight: 600;
  color: #1a7f3c;
}
.table-wrap :deep(.n-data-table .n-data-table-th .n-data-table-th__title,
  .table-wrap :deep(.n-data-table .n-data-table-th) .n-data-table-th__title) {
  color: #1a7f3c;
}
/* 紧凑密排：缩小控件与单元格，贴近旧版 */
.table-wrap :deep(.n-data-table .n-data-table-td) {
  padding: 1px 2px;
  font-size: 12px;
  line-height: 1.35;
}
.table-wrap :deep(.n-data-table .n-data-table-tr .n-data-table-td) {
  height: auto;
}
.table-wrap :deep(.n-input),
.table-wrap :deep(.n-base-selection),
.table-wrap :deep(.n-input-number) {
  font-size: 12px;
}
/* 强制输入/下拉高度与内边距收紧 */
.table-wrap :deep(.n-input .n-input__input-el),
.table-wrap :deep(.n-input .n-input__border),
.table-wrap :deep(.n-base-selection .n-base-selection-label) {
  height: 22px;
  line-height: 22px;
  font-size: 12px;
  padding: 0 4px;
}
.table-wrap :deep(.n-input .n-input__state-border),
.table-wrap :deep(.n-base-selection .n-base-selection__border) {
  top: 2px;
  bottom: 2px;
}
.table-wrap :deep(.n-base-selection .n-base-selection-input),
.table-wrap :deep(.n-input-number .n-input__input-el) {
  height: 22px;
  font-size: 12px;
}
/* 数字类输入右对齐，下拉/文本不被截断 */
.table-wrap :deep(.n-input-number .n-input__input-el) {
  text-align: right;
  padding-right: 6px;
}
.table-wrap :deep(.n-input-number .n-input__input-el),
.table-wrap :deep(.n-input .n-input__input-el) {
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}
/* 带后缀(㎡)的平方输入不被后缀挤压 */
.table-wrap :deep(.n-input .n-input__input) {
  min-width: 0;
  flex: 1;
}
.table-wrap :deep(.n-input .n-input__suffix) {
  flex: none;
}
/* 下拉选中区不再强制裁剪文字 */
.table-wrap :deep(.n-base-selection-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-wrap :deep(.n-button--tiny-type-text),
.table-wrap :deep(.n-button--tiny) {
  font-size: 12px;
  padding: 0 2px;
  height: 18px;
}

.totals-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-top: none;
  border-radius: 0 0 6px 6px;
  font-size: 13px;
  margin-bottom: 8px;
}
.totals-strip .grand b {
  color: #e8801f;
  font-size: 16px;
}
.totals-strip .bal {
  color: #18a058;
  margin-left: auto;
  font-weight: 600;
}
.addtype-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}
.square-dialog p {
  margin: 4px 0 10px;
}
.vis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
}
.vis-col .vis-head {
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a7f3c;
}
.vis-col .n-checkbox {
  display: block;
  margin-bottom: 6px;
}
.mgmt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.mgmt-name {
  flex: 1;
  min-width: 0;
}
/* 未保存行高亮（id=null） */
.table-wrap :deep(.n-data-table .unsaved-row .n-data-table-td) {
  background: #fdf6e3;
}
/* 自定义开向命名 */
.custom-name-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
}
.custom-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.custom-name-row .orig {
  flex: none;
  width: 80px;
  font-size: 12px;
}
.mgmt-price {
  width: 80px;
  text-align: right;
}
.mgmt-unit {
  width: 80px;
}
</style>
