<template>
  <div class="page">
    <!-- 命令行（仿旧版：清空 / 添加门类 / 保存回执单 / 3D画图 · 更多▾ 收高级入口） -->
    <div class="top-bar">
      <div class="toolbar-row">
        <n-button size="small" @click="clearOrder">1.清空</n-button>
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

    <!-- 新增加价项目（汇算页行内入口；旧版 title/宽 500、label 加价项目/单价/计价方式，:2640-2688） -->
    <n-modal v-model:show="addMarkupOpen" preset="card" title="新增加价项目" style="width: 500px">
      <div class="vis-col">
        <div class="mgmt-row">
          <span class="mgmt-name">加价项目</span>
          <!-- 旧版这一格不给宽度（撑满），只有单价/计价方式是 30%（:2660/:2668/:2676） -->
          <n-input v-model:value="addMarkupForm.name" placeholder="请输入加价项目名称" style="flex: 1" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">单价</span>
          <!-- 原版单价 min 随单位变：元/套 允许负数（`-Infinity`），其余必须 ≥0（:2652） -->
          <n-input-number
            v-model:value="addMarkupForm.price"
            :show-button="false"
            :min="addMarkupForm.unit === '元/套' ? undefined : 0"
            placeholder="单价"
            style="width: 30%"
          />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">计价方式</span>
          <n-select v-model:value="addMarkupForm.unit" :options="markupUnitOptions" style="width: 30%" />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="addMarkupOpen = false">取消</n-button>
          <!-- 按钮 type 照旧版：单次添加 = primary，同步保存 = success（:2647/:2651） -->
          <n-button type="primary" @click="addMarkupOnce">单次添加</n-button>
          <n-button type="success" @click="addMarkupSync">同步保存</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 加价项目管理：一个入口 → 两个按钮（复刻旧版 Hui.formatted.js:13107-13117，width 400 居中） -->
    <n-modal v-model:show="markupMgmtOpen" preset="card" title="加价项目管理" style="width: 400px" :bordered="false">
      <div class="footer" style="justify-content: center">
        <n-button type="primary" @click="openMarkupAdd">新增加价项目</n-button>
        <n-button type="warning" @click="openMarkupEdit">修改/删除加价项目</n-button>
      </div>
    </n-modal>

    <!-- 新增加价项目（目录，写后端）：width 500（旧版 :13119） -->
    <n-modal v-model:show="markupAddOpen" preset="card" title="新增加价项目" style="width: 500px">
      <div class="vis-col">
        <div class="mgmt-row">
          <span class="mgmt-name">加价项目</span>
          <n-input v-model:value="mgmtAdd.name" placeholder="请输入加价项目名称" style="flex: 1" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">单价</span>
          <n-input-number v-model:value="mgmtAdd.price" :show-button="false" min="0" placeholder="单价" style="width: 30%" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">计价方式</span>
          <n-select v-model:value="mgmtAdd.unit" :options="markupUnitOptions" style="width: 30%" />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="markupAddOpen = false">取消</n-button>
          <n-button type="primary" @click="confirmMarkupAdd">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 修改加价项目（footer 取消 / 删除 / 确认修改，旧版 :13164-13180） -->
    <n-modal v-model:show="markupEditOpen" preset="card" title="修改加价项目" style="width: 500px">
      <div class="vis-col">
        <div class="mgmt-row">
          <span class="mgmt-name">选择项目</span>
          <n-select
            :value="mgmtEdit.index"
            :options="markupEditOptions"
            placeholder="选择修改或删除的项目"
            style="width: 100%"
            @update:value="pickMarkupEdit"
          />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">加价项目</span>
          <n-input v-model:value="mgmtEdit.name" placeholder="请输入加价项目名称" style="flex: 1" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">单价</span>
          <n-input-number v-model:value="mgmtEdit.price" :show-button="false" min="0" placeholder="单价" style="width: 30%" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">计价方式</span>
          <n-select v-model:value="mgmtEdit.unit" :options="markupUnitOptions" style="width: 30%" />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="markupEditOpen = false">取消</n-button>
          <n-button type="error" @click="confirmMarkupDelete">删除</n-button>
          <n-button type="primary" @click="confirmMarkupEdit">确认修改</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 自动加价设置：文案与旧版一致（:13228-13247，width 320） -->
    <n-modal v-model:show="autoMarkupOpen" preset="card" title="自动加价设置" style="width: 320px">
      <!-- 结构/内联样式照抄旧版 :13238-13246：外层 div `padding:10px 0`；
           提示行是**内联** `color:#909399; font-size:12px; margin-top:8px`（不走 .hint 类，
           以免带上它多出来的 line-height:1.6）。 -->
      <div style="padding: 10px 0">
        <n-checkbox :checked="disableAutoMarkup" @update:checked="onAutoMarkupDraft" label="去除自动加价" />
        <div style="color: #909399; font-size: 12px; margin-top: 8px">勾选后，玻璃和尺寸相关加价项目将不再自动选中</div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="autoMarkupOpen = false">取消</n-button>
          <n-button type="primary" @click="saveAutoMarkup">保存</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 排序方式（原版 @324476 打开 / @324531 保存；全 legacy 唯一写入 `smartdoor_sort_method` 的地方）-->
    <n-modal v-model:show="sortMethodOpen" preset="card" title="排序方式" style="width: 420px">
      <div class="vis-col">
        <n-radio-group v-model:value="sortMethodDraft">
          <n-radio value="profile">型材优先（默认）</n-radio>
          <n-radio value="order">序号优先</n-radio>
        </n-radio-group>
        <div style="color:#909399;font-size:12px;margin-top:8px">
          影响生产单/玻璃合片单/玻璃订单/标签等单据的行顺序；「型材优先」按型材分组顺序，「序号优先」按单号数字前缀。
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="sortMethodOpen = false">取消</n-button>
          <n-button type="primary" @click="saveSortMethod">保存</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 收款码设置（对应原版 `getImage('qrcode')`，供回执单/收据单打印） -->
    <n-modal v-model:show="payQrcodeOpen" preset="card" title="收款码设置" style="width: 420px">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="color:#909399;font-size:12px">
          回执单 / 收据单上的收款二维码。图片仅保存在本机（浏览器 IndexedDB，键 <code>qrcode</code>）。
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <img
            v-if="payQrcodeUrl"
            :src="payQrcodeUrl"
            style="width:132px;height:132px;object-fit:contain;border:1px solid #ebeef5;border-radius:4px;background:#fafafa"
          />
          <span v-else style="width:132px;height:132px;display:flex;align-items:center;justify-content:center;color:#c0c4cc;font-size:12px;border:1px dashed #dcdfe6;border-radius:4px">未上传</span>
          <n-space vertical>
            <n-button size="small" @click="pickPayQrcode">{{ payQrcodeUrl ? '重新上传' : '上传图片' }}</n-button>
            <n-button size="small" :disabled="!payQrcodeUrl" @click="removePayQrcode">删除</n-button>
          </n-space>
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button type="primary" @click="payQrcodeOpen = false">关闭</n-button>
        </div>
      </template>
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
      <!-- 原版这个弹窗里**只有一个数字输入框**（`:2733-2747`，placeholder「请输入平方数」，回车=确认），
           没有我们原先加的那两行提示。 -->
      <div class="square-dialog">
        <n-input-number
          v-model:value="squareInput"
          :show-button="false"
          placeholder="请输入平方数"
          style="width: 100%"
        />
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

    <!-- 通用模板预览 -->
    <n-modal v-model:show="templatePreviewOpen" preset="card" title="模板预览" style="width: 1040px" :loading="templatePreviewLoading">
      <n-select v-model:value="templatePreviewMode" :options="templateList.map(t=>({label:t.name,value:t.mode}))" filterable style="width: 260px;margin-bottom:8px" @update:value="(v:string)=>renderTemplatePreview(v)" />
      <div class="production-host" v-html="templatePreviewHtml"></div>
      <template #footer>
        <div class="footer">
          <n-button @click="templatePreviewOpen = false">关闭</n-button>
          <n-button type="primary" :disabled="!templatePreviewMode" @click="printCurrentTemplate">打印</n-button>
        </div>
      </template>
    </n-modal>
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
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NTooltip,
  useDialog,
  useMessage,
} from 'naive-ui'
import type { DataTableColumn, DataTableColumns } from 'naive-ui'
import { api } from '../api/client'
import type {
  ClientDto,
  FormulaDto,
  FormulaImageDto,
  OrderInput,
  OrderLineInput,
  OrderSummaryDto,
} from '../api/types'
import { evalForward, type Dimensions, type PartsMap } from '../utils/formulaEngine'
import { printByMode, renderByMode } from '../utils/printService'
import { labelQuantity } from '../utils/printData'
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
  updateCatalogItem,
} from '../composables/useMarkupCatalog'
import {
  confirmCustomNames,
  confirmOpenDirMode,
  customNamesDraft,
  customNamesOpen,
  DIRECTION_STORAGE_KEYS,
  displayDirection,
  getOriginalOpenDirection,
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

/**
 * 取部件的 **KEY** —— 旧版一切「关键词匹配 / 精确取件 / 含单玻判定」读的都是它，
 * 只有**显示名**才用 `materialName`（`Object.entries(parts).filter((([e,t]) => …e.includes(kw)…)`
 * 后 `t.materialName + ":"`）。KEY 与 materialName 不等是常态，见
 * `docs/2026-09-15-parts-key-vs-materialname.md`。
 *
 * 历史订单的 `l.parts` 是**持久化**的算料结果，早期只存了 materialName，故回退到它以免炸。
 */
const pk = (p: { key?: string; materialName?: string }) => p.key || p.materialName || ''

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
  double_ding: string | null
  light_window_count: number
  image_id: string | null
  image_url: string | null
  progress: string
  hole_size: string
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

// 「套线种类」枚举（原版 `ref(["双包","外包","内包","平框"])`，Hui.formatted.js:758）。
// 原版平开行的「包边:」标签绑的就是这个字段（同文件 2132：`modelValue: e["套线种类"]`），
// 它一身三职：单据展示、算料时匹配 `part.track`、套线长度模式（`-N` 后缀 / 一高一宽…）。
// 新版模板另含「单包」套线部件（1宽2高），故补入「单包」。
const CASING_OPTIONS = ['双包', '单包', '外包', '内包', '平框']


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

/**
 * 提交「新增加价项目」弹窗（旧版 `ea`，Hui.formatted.js:1657-1690）。
 *
 * 关键：**先去重目录，通过了才挂到当前行**。目录里已有的项走多选下拉选，不走这里 ——
 * 所以重复时原版是 `加价项目已存在！` 且**弹窗不关**、行上也不加。
 * `同步保存`(sync=true) 额外 POST `addAddPrice` 并提示成败；`单次添加`(false) 只进内存、不提示。
 */
async function submitAddMarkup(sync: boolean) {
  const name = addMarkupForm.name.trim()
  if (!name) {
    message.warning('请输入加价项目名称')
    return
  }
  const price = Number(addMarkupForm.price)
  if (addMarkupForm.price == null || Number.isNaN(price)) {
    message.warning('请输入有效单价')
    return
  }
  const unit = addMarkupForm.unit || '元/套'
  // 原版校验：`unit !== '元/套' && Number(t) < 0` → 报错（元/套 允许负数）
  if (unit !== '元/套' && price < 0) {
    message.warning('除元/套外，单价必须大于等于0')
    return
  }
  const l = addMarkupTarget.value
  if (!l) return

  const item = { name, price, unit }
  if (markupCatalog.value.some((c) => c.name === name && c.price === price && c.unit === unit)) {
    message.warning('加价项目已存在！') // 不关窗、不加到行上（原版如此）
    return
  }
  const ok = sync ? await syncAddCatalogItem(item) : sessionAddCatalogItem(item)
  if (sync && !ok) message.error('加价项目添加失败')
  else if (sync) message.success('加价项目添加成功')

  l.markup = l.markup ?? []
  l.markup.push({ ...item, amount: 0 })
  lineRefresh(l)
  addMarkupOpen.value = false
}

// 单次添加：只进内存目录（本次会话可选，不持久化）
function addMarkupOnce() {
  void submitAddMarkup(false)
}

// 同步保存：写后端持久化目录（永久，其它行/之后可选）
async function addMarkupSync() {
  await submitAddMarkup(true)
}

// 开向模式/自定义命名已抽到 ../composables/useOpenDirection（仿原版 _0x5a7707）
const directionSuffixOptions = computed(() =>
  [...DIRECTION_SUFFIXES, ...FOLD_DIRECTION_SUFFIXES].map((d) => ({ label: displayDirection(d), value: d })),
)
const fansOptions = FANS.map((f) => ({ label: f, value: f }))
const glassOptions = GLASS_OPTIONS.map((g) => ({ label: g, value: g }))
const glassThicknessOptions = GLASS_THICKNESS_OPTIONS.map((g) => ({ label: g, value: g }))
const casingKindOptions = CASING_OPTIONS.map((e) => ({ label: e, value: e }))
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

// —— 旧版「默认值」机制 ——
// 键名照抄原版（平开 @36957 / 移门 @147180 两个 ref 初始化）：
//   底玻   `BottomGlass`     两表**共用同一个键**，但**首次运行回落值不同**：平开「磨砂」、移门「白玻」
//   玻璃厚 `GlassThickness`  两表共用，回落 4
//   开向   `OpenDirection`   **只有移门表**读，回落「左前」（平开表开向硬编码 `""`）
// 且**平开表**在用户改这三项时会「顺带设为默认」并弹提示（`le`/`ne`/`te`，定义 @36957、调用 @75380/@75890/@77100/@93688），
// 守卫一致：**非空 且 与当前默认不同** 才写并提示。
const LS_BOTTOM_GLASS = 'BottomGlass'
const LS_GLASS_THICKNESS = 'GlassThickness'
const LS_OPEN_DIRECTION = 'OpenDirection'
/** 默认底玻：平开「磨砂」/ 移门「白玻」（等价于原版 `F.value` / `O.value`）。 */
const defaultBottomGlass = (type: 'ping' | 'diao') => LS.get(LS_BOTTOM_GLASS) || (type === 'diao' ? '白玻' : '磨砂')
/** 默认玻璃厚（等价于原版 `ee.value` / `P.value`）。 */
const defaultGlassThickness = () => Number(LS.get(LS_GLASS_THICKNESS)) || 4
/** 改底玻 → 设为默认（原版 `le`）。 */
function rememberDefaultBottomGlass(v: string) {
  const next = (v || '').trim()
  if (!next || next === defaultBottomGlass('ping')) return
  LS.set(LS_BOTTOM_GLASS, next)
  message.success(`已将"${next}"设为默认底玻`)
}
/** 改玻璃厚 → 设为默认（原版 `ne`）。 */
function rememberDefaultGlassThickness(v: string) {
  const n = Number(v)
  if (!v || Number.isNaN(n) || n === defaultGlassThickness()) return
  LS.set(LS_GLASS_THICKNESS, String(n))
  message.success(`已将"${n}mm"设为默认玻璃厚度`)
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

// 回执单底部「温馨提示」：原版 = `租户.declaration || "含安装费"`（token 1114）。
// 后端 tenants 表暂无 declaration 列，故直接取原版回退值。
const LEGACY_DECLARATION = '含安装费'

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

// 收款码（原版 `getImage('qrcode')`）：
//   原文 @5345 从服务端拉图后 `y.images.put({ id:'qrcode', imageBlob:r })` —— **缓存到本地 images 表**；
//   读取见 `index-c3b16e3f.js` 的 `L` @3999：`if (id === 'qrcode') return { imageUrl: await I(n.imageBlob) }`
//   （token 494='qrcode'、462='imageBlob'、497='imageUrl'，均已解码确认）。
// 我们无服务端图片库，但那半边的本地缓存与我们的 `imageStore`（IndexedDB 按 id 存）完全同构，
// 故用**固定键 'qrcode'** 存/取即可。
const PAY_QRCODE_KEY = 'qrcode'
const payQrcodeUrl = ref('')
async function loadPayQrcode() {
  try {
    payQrcodeUrl.value = (await idbGetImage(PAY_QRCODE_KEY)) || ''
  } catch {
    payQrcodeUrl.value = ''
  }
}
const payQrcodeOpen = ref(false)
function pickPayQrcode() {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = 'image/*'
  inp.onchange = async () => {
    const f = inp.files?.[0]
    if (!f) return
    try {
      const url = await fileToDataUrl(f)
      await idbPutImage(PAY_QRCODE_KEY, url)
      payQrcodeUrl.value = url
      message.success('已上传收款码')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '上传收款码失败')
    }
  }
  inp.click()
}
async function removePayQrcode() {
  await idbRemoveImage(PAY_QRCODE_KEY)
  payQrcodeUrl.value = ''
  message.success('已删除收款码')
}

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
  { label: '订单列表', key: 'orders' },
  { label: '模板预览', key: 'templates' },
  { label: '标签打印', key: 'labels' },
  { label: '玻璃合片单', key: 'glass' },
  { label: '玻璃订单', key: 'glassHole' },
  { label: '生产单定制打印', key: 'productionCustom' },
  { label: '生产单3打印（双联）', key: 'productionCustom3' },
  { label: '终端链接', key: 'terminal' },
  { label: '加价项目管理', key: 'markupMgmt' },
  { label: '自动加价设置', key: 'autoMarkup' },
  { label: '排序方式', key: 'sortMethod' },
  { label: '收款码设置', key: 'payQrcode' },
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
  { key: 'casing', label: '开向内·包边(套线)' },
  { key: 'door_size', label: '门洞尺寸' },
  { key: 'hole_size', label: '洞尺' },
  { key: 'jiao', label: '吊脚' },
  // 「亮窗总高」原版**无显隐闸门**，故不进本表（仍照常显示）
  { key: 'hardware', label: '五金' },
  { key: 'seal_board', label: '封板高' },
  { key: 'remark', label: '备注' },
  { key: 'money', label: '金额' },
  { key: 'markup_summary', label: '加价' },
  { key: 'price_type', label: '计价方式' },
  { key: 'discount', label: '打折' },
  { key: 'front_casing', label: '前包加长' },
  { key: 'back_casing', label: '后包加长' },
  { key: 'double_ding', label: '单/双丁' },
  { key: 'order_no', label: '单号' },
  { key: 'image_id', label: '图片ID' },
  { key: 'client', label: '客户' },
  { key: 'client_code', label: '客户编号' },
  { key: 'other_fee', label: '其它费用' },
]
// 移门表可显隐列（列序同原版，见 diaoCols 注释）

const DIAO_VIS_KEYS = [
  { key: 'profile_color', label: '型材/颜色' },
  { key: 'unit_qty', label: '单价/数量' },
  { key: 'glass', label: '玻璃' },
  { key: 'fans_dir', label: '扇数/开向' },
  { key: 'track_line', label: '下轨道/套线' },
  { key: 'track', label: '下轨道/套线内·轨道' },
  { key: 'door_size', label: '门洞尺寸' },
  { key: 'hole_size', label: '洞尺' },
  { key: 'lightwin', label: '亮窗信息' },
  { key: 'hardware', label: '五金' },
  { key: 'remark', label: '备注' },
  { key: 'money', label: '金额' },
  { key: 'markup_summary', label: '加价' },
  { key: 'up_track_seal', label: '上轨/边封' },
  { key: 'front_casing', label: '前包加长' },
  { key: 'back_casing', label: '后包加长' },
  { key: 'double_ding', label: '单/双丁' },
  { key: 'price_type', label: '计价方式' },
  { key: 'discount', label: '打折' },
  { key: 'order_no', label: '单号' },
  { key: 'image_id', label: '图片ID' },
  { key: 'client', label: '客户' },
  { key: 'client_code', label: '客户编号' },
  { key: 'other_fee', label: '其它费用' },
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

// ===== 加价项目管理（复刻旧版主页三弹窗：管理 → 新增 / 修改删除）=====
// 旧版：`加价项目管理`(400) → 两个按钮；`新增加价项目`(500)；`修改加价项目`(500)
//       Hui.formatted.js:13107-13226；目录增删改走 addAddPrice / editPrice / deleteAddPrice
const markupMgmtOpen = ref(false)
const markupAddOpen = ref(false)
const markupEditOpen = ref(false)

/** 新增弹窗的表单（旧版 `_0x4956b9`，打开时重置为 name:'', price:0, unit:'元/套'）。 */
const mgmtAdd = reactive({ name: '', price: 0, unit: '元/套' })
function openMarkupMgmt() {
  markupMgmtOpen.value = true
}
function openMarkupAdd() {
  mgmtAdd.name = ''
  mgmtAdd.price = 0
  mgmtAdd.unit = '元/套'
  markupMgmtOpen.value = false
  markupAddOpen.value = true
}
async function confirmMarkupAdd() {
  const name = mgmtAdd.name.trim()
  // 旧版校验：名称「请输入加价项目名称」；单价「单价必须大于0」（管理弹窗这份是 min:.01，:7986-7993）
  if (!name) {
    message.warning('请输入加价项目名称')
    return
  }
  if (!(mgmtAdd.price > 0)) {
    message.warning('单价必须大于0')
    return
  }
  const ok = await syncAddCatalogItem({ name, price: mgmtAdd.price, unit: mgmtAdd.unit || '元/套' })
  if (!ok) {
    message.warning('加价项目已存在！') // 去重失败即已存在，原版提示后**不关窗**
    return
  }
  message.success('加价项目添加成功')
  markupAddOpen.value = false
}

/** 「修改/删除加价项目」：打开前重载目录（旧版 `_0x2612ea` 先 `await _0x51e171()`）。 */
const mgmtEdit = reactive({ index: -1, name: '', price: 0, unit: '元/套' })
const markupEditOptions = computed(() =>
  markupCatalog.value.map((m, i) => ({ label: `${m.name} ${m.price}${m.unit}`, value: i })),
)
async function openMarkupEdit() {
  if (!(await loadMarkupCatalog())) message.error('初始化失败')
  mgmtEdit.index = -1
  mgmtEdit.name = ''
  mgmtEdit.price = 0
  mgmtEdit.unit = '元/套'
  markupMgmtOpen.value = false
  markupEditOpen.value = true
}
function pickMarkupEdit(i: number) {
  const a = markupCatalog.value[i]
  mgmtEdit.index = i
  if (!a) return
  mgmtEdit.name = a.name
  mgmtEdit.price = a.price
  mgmtEdit.unit = a.unit
}
async function confirmMarkupEdit() {
  if (mgmtEdit.index < 0) {
    message.warning('请先选择一个项目')
    return
  }
  if (!mgmtEdit.name.trim()) {
    message.warning('请输入加价项目名称')
    return
  }
  if (!(mgmtEdit.price > 0)) {
    message.warning('单价必须大于0')
    return
  }
  // 同名（除自己外）判重 —— 旧版 `_0x3cdb91` 的 `.some(...)`
  const dup = markupCatalog.value.some(
    (c, i) => i !== mgmtEdit.index && c.name === mgmtEdit.name.trim() && c.price === mgmtEdit.price && c.unit === mgmtEdit.unit,
  )
  if (dup) {
    message.warning('加价项目已存在！')
    return
  }
  const ok = await updateCatalogItem(mgmtEdit.index, {
    name: mgmtEdit.name.trim(),
    price: mgmtEdit.price,
    unit: mgmtEdit.unit || '元/套',
  })
  if (!ok) {
    message.error('编辑失败，请重试')
    return
  }
  message.success('加价项目修改成功')
  markupEditOpen.value = false
}
async function confirmMarkupDelete() {
  if (mgmtEdit.index < 0) {
    message.warning('请先选择一个项目')
    return
  }
  const target = markupCatalog.value[mgmtEdit.index]
  dialog.warning({
    title: '提示',
    content: '确定要删除此加价项目吗?',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      const ok = await removeCatalogItem(mgmtEdit.index)
      message[ok ? 'success' : 'error'](ok ? '加价项目删除成功' : '加价项目删除失败')
      mgmtEdit.index = -1
      mgmtEdit.name = ''
      mgmtEdit.price = 0
      mgmtEdit.unit = '元/套'
    },
    onNegativeClick: () => message.info('已取消删除'),
  })
  void target
}

// 自动加价设置（本地开关，仿旧版 smartdoor_disable_auto_markup）
// ⚠️ 存的是**布尔值的字符串**（`"true"` / `"false"`），不是 `"1"`/`"0"` ——
//   旧版读写都是 `=== "true"` / `String(v)`（`Hui.formatted.js:835` / `:8009-8014`），
//   必须一致，否则从旧版迁过来的浏览器里那份设置会被读反。
//   旧版点「保存」才落盘，故这里也用草稿态。
const autoMarkupOpen = ref(false)
const disableAutoMarkup = ref(LS.get('smartdoor_disable_auto_markup') === 'true')
const autoMarkupDraft = ref(disableAutoMarkup.value)
function onAutoMarkupDraft(v: boolean) {
  autoMarkupDraft.value = v
}
function saveAutoMarkup() {
  disableAutoMarkup.value = autoMarkupDraft.value
  LS.set('smartdoor_disable_auto_markup', String(autoMarkupDraft.value))
  autoMarkupOpen.value = false
  message.success('设置已保存')
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
    case 'orders': void openOrderList(); break
    case 'templates': void openTemplatePreview(); break
    case 'labels': void printLabels(); break
    case 'glass': void printGlass(); break
    case 'glassHole': void printGlassHole(); break
    case 'productionCustom': void printProductionCustom('product2'); break
    case 'productionCustom3': void printProductionCustom('product3'); break
    case 'terminal': void copyTerminalLink(); break
    case 'markupMgmt': openMarkupMgmt(); break
    // 打开时把草稿同步成已存值（旧版点「保存」才落盘，取消应丢弃改动）
    case 'autoMarkup': autoMarkupDraft.value = disableAutoMarkup.value; autoMarkupOpen.value = true; break
    case 'sortMethod': openSortMethod(); break
    case 'payQrcode': payQrcodeOpen.value = true; break
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
// 平开族的 formula_type 取值。**不能只认 'ping'**：原版没有 formula_type 这层过滤 ——
// 行.formulaid 是「型材名 → formulaID」直接查服务端 material 字典得到的
// （Hui.formatted.js:1459-1475 `const _=O.value[x]; _?a.formulaid=String(_):…`），
// 下拉候选就是该字典的 key 集合（同文件 1898 `Object.keys(O.value)`）。
// 所以钻石型(diamond)/子母(parentsubsidiary)/双开(double) 这些平开族公式同样在平开表里。
// 若按 `ft === type` 字面判等，它们会被两张表同时排除 —— 这正是「钻石型公式选不到」的根因。
const PING_FAMILY_TYPES = ['ping', 'double', 'parentsubsidiary', 'diamond']

/** 公式是否属于某张表：移门只收 diao，平开收平开族；无型别的两边都放（避免隐藏已有数据）。 */
function belongsToTable(formulaType: string | undefined, type: 'ping' | 'diao'): boolean {
  const ft = (formulaType || '').trim()
  if (ft === '') return true
  return type === 'diao' ? ft === 'diao' : PING_FAMILY_TYPES.includes(ft)
}

// 型材候选按门型分类（仿旧版 initializPing→pingMaterial / initializDiao→diaoMaterial）：
// 平开表只看平开族，移门表只看移门类，避免串型。来源 = 对应门型的历史型材 + 对应族的公式名。
function profileOptionsFor(type: 'ping' | 'diao'): { label: string; value: string }[] {
  const seen = new Set<string>()
  const out: { label: string; value: string }[] = []
  const push = (p: string) => {
    const v = (p || '').trim()
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push({ label: v, value: v })
    }
  }
  // 候选**只有公式名一个来源** —— 原版型材格子的 `fetch-suggestions` 逐字是
  //   `const x = Object.keys(O.value); t((e ? x.filter(t=>t.includes(e)) : x).map(e=>({value:e})))`
  // 其中 `O.value` = **服务端「基础信息」接口返回的 material 字典**（型材名 → formulaID）。
  // 原版**没有**本地候选历史、**也不能右键删除**（那 15 处 `onContextmenu` 只在 颜色/面玻/底玻/
  // 套线种类/轨道种类/金额 上，**不含型材**），写侧 `je`(算列宽)/`Ye`(解析 formulaID) 也都不写候选库。
  // 所以我们原先额外挂的 `readFieldHistory('profile_*')` 与「当前页面的行」两个来源是**自己加的**，
  // 会造成「公式都删了、型材下拉里还有旧记录」—— 已移除。
  // （`formulas` 表名即我们对 `O.value` 的等价物；按表归属过滤仍保留。）
  for (const f of formulas.value) {
    if (belongsToTable(f.formula_type, type)) push(f.name)
  }
  return out
}

const pingProfileOptions = computed(() => profileOptionsFor('ping'))
const diaoProfileOptions = computed(() => profileOptionsFor('diao'))

// 通用候选历史持久化（仿旧版 saveOptions(选项库)）：录入/载入的候选写入 localStorage，刷新仍保留。
// 每个字段一个 key，如 color/casing/track/hardware/profile。
function readFieldHistory(key: string): string[] {
  try {
    const raw = LS.get(`smartdoor_field_history_${key}`)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim()) : []
  } catch {
    return []
  }
}
function writeFieldHistory(key: string, list: string[]) {
  try {
    LS.set(`smartdoor_field_history_${key}`, JSON.stringify(list))
  } catch {
    // 忽略
  }
}
function rememberField(key: string, value: string) {
  const v = (value || '').trim()
  if (!v) return
  const list = readFieldHistory(key)
  if (!list.includes(v)) {
    list.unshift(v)
    writeFieldHistory(key, list.slice(0, 50))
  }
}

// 颜色候选（本地持久化历史 + 当前已录入颜色；与旧版 autocomplete 一致，无内置色卡）
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
  for (const c of readFieldHistory('color')) push(c)
  for (const l of lines.value) push(l.color)
  return out
})

// 候选源构建通用函数：预设 + 已录入历史

// 从当前行公式 parts 提取轨道/套线候选（原版部件 track 语义，按型材联动）。
//   track：部件 track 非空且非单包/双包（如"标配"）；套线：track==单包/双包 → 单包/双包（无"套线"后缀）。
function partsTrackOptions(l: Line, kind: 'track' | 'casing'): { label: string; value: string }[] {
  const f = formulaOf(l)
  const parts = (f?.parts ?? {}) as Record<string, { track?: string; materialName?: string }>
  const history = readFieldHistory(kind)
  const seen = new Set<string>()
  const out: { label: string; value: string }[] = []
  const push = (v: string) => {
    const s = (v || '').trim()
    if (s && !seen.has(s)) {
      seen.add(s)
      out.push({ label: s, value: s })
    }
  }
  for (const h of history) push(h)
  for (const p of Object.values(parts)) {
    if (!p || typeof p !== 'object') continue
    const t = (p.track || '').trim()
    if (!t) continue
    if (kind === 'track') {
      if (t !== '单包' && t !== '双包') push(t)
    } else {
      // 套线候选 = 原版单包/双包(无"套线"后缀)，来自部件 track
      if (t === '单包' || t === '双包') push(t)
    }
  }
  return out
}

// 锁具候选（原版 getOptions("lock") + 取价接口 lock 数组）
const lockOptions = ref<string[]>([])
function rememberLocks(vals: unknown) {
  if (!Array.isArray(vals)) return
  for (const v of vals) {
    const s = String(v ?? '').trim()
    if (!s) continue
    if (!lockOptions.value.includes(s)) lockOptions.value.push(s)
    rememberField('lock', s)
  }
}

// 五金候选（原版）：公式 hinge 的键（合页名）+ 历史录入（getOptions("hardware")）+ 锁具（getOptions("lock") + 取价 lock 数组）。
// 无内置预设、不读 extra.hardware。
function hardwareOptionsFor(l: Line): { label: string; value: string }[] {
  const seen = new Set<string>()
  const out: { label: string; value: string }[] = []
  const push = (v: unknown) => {
    const s = String(v ?? '').trim()
    if (s && !seen.has(s)) {
      seen.add(s)
      out.push({ label: s, value: s })
    }
  }
  // ① 本行公式 hinge 的键（合页名）优先
  const hinge = (formulaOf(l)?.extra as { hinge?: Record<string, unknown> } | undefined)?.hinge
  if (hinge && typeof hinge === 'object') for (const k of Object.keys(hinge)) push(k)
  // ② 原版（@89220）：五金格候选主体来自服务端 `initializPing.hingeNames` —— 一个**全局合页名列表**，
  //    与本行公式无关（渲染时 `hingeNames.filter(e => !已选.includes(e))`）。
  //    本系统无该字段，用「**所有公式 `extra.hinge` 键的并集**」等价近似（同一语义：租户的合页名清单）。
  for (const f of formulas.value) {
    const h = (f.extra as { hinge?: Record<string, unknown> } | undefined)?.hinge
    if (h && typeof h === 'object') for (const k of Object.keys(h)) push(k)
  }
  for (const h of readFieldHistory('hardware')) push(h)
  for (const k of readFieldHistory('lock')) push(k)
  for (const k of lockOptions.value) push(k)
  return out
}

function newLine(type: 'ping' | 'diao'): Line {
  // 计价默认：平开门读 PriceType（默认套），吊趟门旧版硬编码「方」。
  const defPriceType = type === 'diao' ? '方' : LS.get('PriceType') || '套'
  // 底玻/面玻/玻璃厚/开向 的初值**逐字照抄原版新建行工厂**（平开 @39301 / 移门 @149781）：
  //   `{"底玻": F.value, "面玻": "白玻", "玻璃厚": ce(), "开向": ""}`  ← 平开
  //   `{"底玻": O.value, "面玻": "白玻", "玻璃厚": …,   "开向": L.value}` ← 移门
  // 注意 **面玻是硬编码「白玻」**（不读 localStorage），且**底玻一定有值** ——
  // 原版从不产生「底玻为空」的行，故 `"无" === 底玻` 的严格判定不会误伤。
  const defBottomGlass = defaultBottomGlass(type)
  const defFaceGlass = '白玻'
  // 原版 `ce()`：底玻为「无」且默认厚度 < 8 时取 8，否则取默认厚度。
  const t = defaultGlassThickness()
  const defGlassThickness = String(defBottomGlass === '无' && t < 8 ? 8 : t)
  return {
    id: null,
    line_type: type,
    profile: '',
    color: '',
    // 移门开向回落「左前」（localStorage `OpenDirection`）；平开恒空串。
    direction: type === 'diao' ? LS.get(LS_OPEN_DIRECTION) || '左前' : '',
    fans: '', track: '', casing: '', hardware: '',
    bottom_glass: defBottomGlass, face_glass: defFaceGlass, glass_thickness: defGlassThickness,
    door_width: 0, door_height: 0, light_window_height: 0, wall_thickness: 0, jiao: 0,
    mother_door_width: 0,
    quantity: 1, unit_price: 0, price_type: defPriceType, discount: 1,
    square: 0, custom_square: -1, other_fee: 0, casing_price: 0, casing_amount: 0, amount: 0,
    parts: [],
    markup: [],
    formula_id: null, remark: '', install_address: '',
    open_img: '', edge_seal_count: type === 'diao' ? 2 : null, seal_board_height: 0, track_length: 0,
    front_casing_add: null, back_casing_add: null, double_ding: null,
    light_window_count: 0, image_id: null, image_url: null, progress: '', hole_size: '',
  }
}

// 行编辑（已改行内就地编辑 + 每表底部添加行，无弹窗抽屉）

// 取洞尺减法减量（原版 resetSize / TaoDong.SingleDong / TaoDong.DubleDong），来自公式级数据（extra）。
// 兼容 {width,height} 与 {宽,高} 两种键；无减量返回 null。
// 洞尺减量（原版）：改算料尺寸 w/h（有亮窗改 h1），不写回行。
//   洞尺 → 公式 resetSize.{width,height}；单包/双包洞尺 → 公式 TaoDong.SingleDong/DubleDong.{宽减,高减}；净尺/空 → 零调整。
function holeDeduction(l: Line): { dw: number; dh: number } | null {
  const extra = (formulaOf(l)?.extra ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const node = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  // DB 实际键：resetSize.{width,height}；TaoDong.{SingleDong,DubleDong}.{宽减,高减}（大写，兼容小写）
  const tao = (extra.TaoDong ?? extra.taoDong) as Record<string, unknown> | undefined
  switch ((l.hole_size || '').trim()) {
    case '洞尺': {
      const r = node(extra.resetSize ?? extra.ResetSize)
      return r ? { dw: num(r.width ?? r['宽']), dh: num(r.height ?? r['高']) } : null
    }
    case '单包洞尺': {
      const r = node(tao?.SingleDong ?? tao?.singleDong)
      return r ? { dw: num(r['宽减']), dh: num(r['高减']) } : null
    }
    case '双包洞尺': {
      const r = node(tao?.DubleDong ?? tao?.dubleDong)
      return r ? { dw: num(r['宽减']), dh: num(r['高减']) } : null
    }
    default:
      return null // 净尺 / 空 → 零调整
  }
}

// 墙型减量（原版 swingWall，公式级）：按行「单双丁」取减量——宽减 w、高减 h1(有亮窗)/h。
function swingWallDeduction(l: Line, extra: Record<string, unknown>): { dw: number; dh: number } | null {
  const sw = extra.swingWall as { UpWall?: unknown; DoubleWall?: unknown; SingleWall?: unknown } | undefined
  const dd = String(l.double_ding ?? '').trim()
  if (!sw || !dd || dd === '正常') return null
  const n = (v: unknown) => Number(v) || 0
  let dw = 0
  let dh = 0
  switch (dd) {
    case '单丁墙': dw = n(sw.SingleWall); break
    case '双丁墙': dw = n(sw.DoubleWall); break
    case '上丁墙': dh = n(sw.UpWall); break
    case '上丁加单丁': dw = n(sw.SingleWall); dh = n(sw.UpWall); break
    case '上丁加双丁': dw = n(sw.DoubleWall); dh = n(sw.UpWall); break
    default: return null
  }
  return dw || dh ? { dw, dh } : null
}

function dimsOf(l: Line): Dimensions {
  const base = {
    w: l.door_width || 0,
    h: l.door_height || 0,
    h1: l.light_window_height || 0,
    t: l.wall_thickness || 0,
    j: l.jiao || 0,
    s: l.mother_door_width || 0,
  }
  // 洞尺减法（原版）：改 w / h，有亮窗(h1>h)时改 h1 不改 h；不算料不写回行字段。
  const d = holeDeduction(l)
  if (d && (d.dw || d.dh)) {
    base.w -= d.dw
    if (base.h1 > base.h) base.h1 -= d.dh
    else base.h -= d.dh
  }
  // 墙型减量（原版 swingWall）：按「单双丁」减 w/h（同样 h1>h 时改 h1）。
  const sw = swingWallDeduction(l, (formulaOf(l)?.extra ?? {}) as Record<string, unknown>)
  if (sw) {
    base.w -= sw.dw
    if (base.h1 > base.h) base.h1 -= sw.dh
    else base.h -= sw.dh
  }
  return base
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

/**
 * 平方数 = 每樘方数 × 数量。每樘方数：
 *   自定义方数 > -1  →  取自定义方数（**覆盖**，可升可降）
 *   否则             →  `max(单樘面积, 公式的最低平方数)`
 *
 * ⚠️ **这里有意偏离旧版**（用户 2026-09-16 拍板：「业务上真要手动改小」）。
 *
 * 旧版 `gt`（`Hui.formatted.js:1314-1331`）是 `l = 自定义方数` → `Math.max(面积, l)`，
 * 调用方 `平方数 = gt(行) * 数量`（`:1478`）—— 即自定义方数只是**每樘下限**，
 * 填得比面积小就抬不动，等于白填。我们照旧版实现过（`556ed7eb`），实测确实如此：
 * 面积 2.0 填 1 → 平方数仍是 2.0，表格不变、只有弹窗里的数字变了。
 * 老板要的是「手改小」，所以改成**覆盖**：填多少就是多少（含低于面积、低于最低平方数）。
 *
 * 清空输入框（空 → -1）即回到自动。除此之外与旧版一致：仍是**每樘**值，外层乘数量。
 */
function computeSquare(l: Line): number {
  const custom = l.custom_square ?? -1
  const per = custom > -1 ? custom : Math.max(singleArea(l), minSquareOf(l))
  return round2(per * (l.quantity || 1))
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

/** 金额（旧版 wt+round）：套线金额只在「方」时计入；金额取整元。
 *   套 = 单价×数量 + 其它费用；方 = 单价×平方 + 套线金额 + 其它费用；金额 = Math.round(基准×打折)。 */
function computeAmount(l: Line): number {
  const isSquare = l.price_type === '方'
  let base = (l.unit_price || 0) * (isSquare ? l.square || 0 : l.quantity || 1)
  if (isSquare) base += l.casing_amount || 0 // 套线金额仅在「方」时计入；套不含套线
  const subtotal = base + (l.other_fee || 0)
  return Math.round(subtotal * (l.discount || 0))
}

/**
 * 单条加价项：算出 **金额** 与 **明细文本**。
 *
 * ⚠️ 平开与吊趟是**两套**分支，旧版各写了一份，不能共用（这是本次拆分的唯一原因）：
 *   - 平开 `wt`  `Hui.formatted.js:1256-1307`
 *   - 吊趟 `ft`  `Hui.formatted.js:4170-4204`
 * 三处实质差异（金额会不同）：
 *   ① `元/方`：平开有「超平米」特判 → `(平方数 − N)`；**吊趟没有**，就是 `price × 平方数`
 *   ② `元/米`：平开**只有名字含「门套」才算**，长度 `(2×max(门洞高,亮窗总高)+门洞宽)/1000`；
 *              **吊趟不判门套**，长度恒为 `门洞宽/1000`
 *   ③ `元/公分`：平开只有 超高/超宽/超墙厚；**吊趟多一个「轨道超长」**，且结果 `Math.round` 取整
 *
 * ⚠️ 两处**原版就有的怪癖，照抄**：
 *   - 平开的基准量 `o`、吊趟的 `c` 都是**循环外变量**（`:1259` / `:4173`），
 *     `元/公分` 项的名字若不含任何已知前缀，会**沿用上一条算出来的值**；平开 `元/米` 不含「门套」时
 *     连 `o` 也一并沿用。这里用 `carry` 复刻同一行为。
 *   - 吊趟 `超宽N` 的基准是 `Math.max(门洞宽)`（单参数取 max，等于原值），照抄。
 */
type MarkupDetail = { amount: number; text: string }

/** 平开 `wt`（`Hui.formatted.js:1256-1307`）。 */
function markupDetailPing(item: MarkupItem, l: Line, carry: { v: number }): MarkupDetail {
  const p = item.price || 0
  const q = l.quantity || 0
  const w = l.door_width || 0
  const h = Math.max(l.door_height || 0, l.light_window_height || 0)
  const t = l.wall_thickness || 0
  const sq = l.square || 0
  const name = item.name
  let r = 0
  let s = ''

  if (item.unit === '元/套' || item.unit === '元/支') {
    // 文案条件原版是 `r>0||r<0`（等价于 r!==0，且 -0 走 else）
    r = p * q
    s = r > 0 || r < 0 ? `${name} ${p}${item.unit}*${q}=${r}元` : `${name} `
  } else if (item.unit === '元/方') {
    try {
      if (name.includes('超平米')) {
        carry.v = Number((sq - Number(name.replace(/超平米/g, ''))).toFixed(3))
        r = p * carry.v * q
        s = r > 0 ? `超平米: ${p}${item.unit}*${carry.v}平方*${q}=${r}元` : `${name} `
      } else {
        r = Number((p * sq).toFixed(3))
        s = r > 0 ? `${name} ${p}${item.unit}*${sq}=${r}元` : `${name} `
      }
    } catch {
      message.error('计算金额失败')
    }
  } else if (item.unit === '元/米') {
    try {
      // 不含「门套」时 r/s 保持初值，**carry 也保持上一轮的值**（原版如此）
      if (name.includes('门套')) {
        carry.v = (2 * h + w) / 1e3
        r = Number((p * carry.v * q).toFixed(3))
        s = r > 0 ? `${name} ${p}${item.unit}*${carry.v}米*${q}=${r}元` : `${name} `
      }
    } catch {
      message.error('计算金额失败')
    }
  } else if (item.unit === '元/公分') {
    try {
      let x = ''
      if (name.includes('超高')) {
        carry.v = (h - Number(name.replace(/超高/g, ''))) / 10
        x = '超高:'
      } else if (name.includes('超宽')) {
        carry.v = (w - Number(name.replace(/超宽/g, ''))) / 10
        x = '超宽:'
      } else if (name.includes('超墙厚')) {
        carry.v = (t - Number(name.replace(/超墙厚/g, ''))) / 10
        x = '超墙厚:'
      }
      r = p * carry.v * q
      s = r > 0 ? `${x} ${p}${item.unit}*${carry.v}公分*${q}=${r}元` : `${x} `
    } catch {
      message.error('计算金额失败')
    }
  } else if (item.unit === '无') {
    r = p * q
    if (q > 1) s = `${name} ${p}*${q}=${r}元`
    else if (q === 1) s = `${name} ${p}元`
  }
  return { amount: r, text: s }
}

/** 吊趟 `ft`（`Hui.formatted.js:4170-4204`）。 */
function markupDetailDiao(item: MarkupItem, l: Line, carry: { v: number }): MarkupDetail {
  const p = item.price || 0
  const q = l.quantity || 0
  const w = l.door_width || 0
  const h = Math.max(l.door_height || 0, l.light_window_height || 0)
  const t = l.wall_thickness || 0
  const sq = l.square || 0
  const name = item.name
  let d = 0
  let s = ''

  if (item.unit === '元/套' || item.unit === '元/支') {
    d = p * q
    s = d !== 0 ? `${name} ${p}${item.unit}*${q}=${d}元` : `${name} `
  } else if (item.unit === '元/方') {
    // 吊趟**没有**「超平米」特判
    d = Number((p * sq).toFixed(3))
    s = d > 0 ? `${name} ${p}${item.unit}*${sq}=${d}元` : `${name} `
  } else if (item.unit === '元/公分') {
    try {
      let x = ''
      if (name.includes('超高')) {
        carry.v = (h - Number(name.replace(/超高/g, ''))) / 10
        x = '超高:'
      } else if (name.includes('超宽')) {
        // 原版是 `Math.max(门洞宽)`（单参数，等于原值）
        carry.v = (Math.max(w) - Number(name.replace(/超宽/g, ''))) / 10
        x = '超宽:'
      } else if (name.includes('超墙厚')) {
        carry.v = (t - Number(name.replace(/超墙厚/g, ''))) / 10
        x = '超墙厚:'
      } else if (name.includes('轨道超长')) {
        carry.v = Number(name.replace(/轨道超长/g, '')) / 10
        x = '轨道超长:'
      }
      d = Math.round(p * carry.v * q)
      s = d > 0 ? `${x} ${p}${item.unit}*${carry.v}公分*${q}=${d}元` : `${name} `
    } catch {
      message.error('计算金额失败')
    }
  } else if (item.unit === '元/米') {
    // 吊趟不判「门套」，长度恒为 门洞宽/1000
    carry.v = w / 1e3
    d = Number((p * carry.v * q).toFixed(3))
    s = d > 0 ? `${name} ${p}${item.unit}*${carry.v}米*${q}=${d}元` : `${name} `
  } else if (item.unit === '无') {
    d = p * q
    s = `${name} ${d}元`
  }
  return { amount: d, text: s }
}

/** 按行类型分发到平开 / 吊趟两套分支。`carry` 由调用方在**一次重算内**贯穿整行（复刻原版的循环外变量）。 */
function markupDetail(item: MarkupItem, l: Line, carry: { v: number }): MarkupDetail {
  return l.line_type === 'diao' ? markupDetailDiao(item, l, carry) : markupDetailPing(item, l, carry)
}

/**
 * 行上加价项目的**明细文本**多行（对应原版行上的 `加价项目` 字段）。
 *
 * 原版在 `wt`/`ft` 里把每项算出的文本 `join("\n")` 写进行字段（`Hui.formatted.js:1308`），
 * 单元格按 `\n` 渲染成 `.expression-line`（`:2515`），打印的计价明细也用它（`:8721`/`:8819`）。
 *
 * 新版**不加这个字段、改为现算**，依据是：该文本是
 *   (已选项的 name/price/unit) × (行上 数量/门洞宽/门洞高/亮窗总高/墙厚/平方数) × line_type
 * 的**纯函数**，而这些输入两边都持久化（旧版存 `加价项目原始数据` + 行字段；新版存 `markup` + 行字段），
 * 且旧版大 watch（`:1470`）的依赖数组恰好覆盖 `markupDetail` 用到的全部字段
 * —— 因此现算的串与原版存下来的串逐字相同。
 *
 * ⚠️ 注意：该字段**是会落库的**（保存行时除黑名单 `zt`（`:1336`）外所有字段都发服务端，`:1434`），
 * 不是「原版不存所以我们不存」。等价性来自上面那条「纯函数」，别记错。
 */
function markupLines(l: Line): string[] {
  const carry = { v: 0 }
  return (l.markup ?? []).filter((m) => m && m.name).map((m) => markupDetail(m, l, carry).text)
}

/**
 * 重算整行加价：逐条算金额，合计写入 `other_fee`。
 *
 * ⚠️ 这里**只算钱，不增删任何项**。
 *   原版 `wt`/`ft`（`Hui.formatted.js:1256-1307` / `:4170-4204`）就是遍历「已挂的项」算钱，
 *   一个 `splice`/`filter` 都没有（已逐行核过）。**该挂哪些自动项，全部由字段失焦钩子决定**：
 *     平开 `Qt`（`:1578-1626`，门洞宽/门洞高/墙厚）、玻璃 `_e`（`:845-871`）
 *     吊趟 `:5075-5125`（只墙厚，≥2 候选弹窗）
 *   原先这里按「阈值最大者胜」把落选的自动项**直接剔除** —— 后果是：
 *   关掉自动加价后，只要行上任何一个字段变化触发重算，用户手动挂的 `超宽N` 也会被悄悄删掉；
 *   原版此时是不动的（钩子被开关挡住，`wt` 又从不删项）。
 */
function recalcMarkup(l: Line): number {
  let total = 0
  // `carry` 贯穿整行 —— 复刻原版把基准量声明在**循环外**（平开 `o` @:1259 / 吊趟 `c` @:4173）
  const carry = { v: 0 }
  for (const item of l.markup ?? []) {
    item.amount = round2(markupDetail(item, l, carry).amount)
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

// 「1.清空」：清空当前订单内容（不新建的口吻）
function clearOrder() {
  if (lines.value.length === 0 && orderId.value == null) {
    message.info('当前订单已为空')
    return
  }
  dialog.warning({
    title: '清空订单',
    content: '将清空当前订单的所有内容（未保存的更改会丢失）。是否继续？',
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: () => resetOrder(),
  })
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
  // 必填清单**逐字照抄旧版**（平开 @349085 / 吊趟 @353602）：
  //   平开 `["型材","数量","颜色","底玻","面玻", 玻璃厚,"开向", 计价方式]`
  //   吊趟 `["型材","颜色","底玻","面玻", 玻璃厚,"开向","扇数", 轨道种类]`
  // ⚠️ **底玻/面玻是必填**（原版两格都没有 `clearable`，配合新建行默认值 ⇒ 空串在旧版产生不出来）。
  // ⚠️ **原版清单里没有 门洞宽/门洞高**（用户确认「按照原版改」）。
  //    @349301 校验循环里那两条 `"门洞高"===e && _[e]<=0` / `"门洞宽"===e && _[e]<=0`
  //    是**死代码** —— `e` 只遍历清单 `x`，而这两项不在 `x` 中，永不命中
  //    （形态像当初漏加了清单项）。故原版**实际不校验尺寸**：`errorFields["门洞高"]` 也没有
  //    任何地方会写 `true`（单元格上挂着 `error-cell` 绑定但永远是 false）。
  //    ⇒ 我们同步去掉这两项必填（**这是一处放宽**；要恢复只需把两行 `add` 加回来）。
  add(!!l.profile.trim(), '型材')
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
  // 行上任何字段变了都丢掉该行的算料缓存。
  // `partsSig` 已经把所有影响算料的字段列全，这里是**兜底**：万一以后又新增了
  // 影响算料结果的行字段却忘了加进签名，也不会再出现「改了字段、算料结果不变、
  // 点『算料』也没用」的幽灵 bug（洞尺/单双丁 都栽过这个）。
  partsCache.delete(l)
  l.square = computeSquare(l)
  recalcMarkup(l)
  l.casing_amount = casingAmountOf(l)
  l.amount = computeAmount(l)
}

const lastProf = new WeakMap<object, string>()

// 型材名 ↔ 公式名 兜底匹配：resolveFormulaMatch(空表) 查不到时，按公式名直接命中 formulas。
// 表归属用 belongsToTable（平开收平开族，**不是** formula_type 字面判等），否则 diamond 等选不到。
function matchFormulaByName(l: Line): FormulaDto | undefined {
  const profile = l.profile.trim()
  if (!profile) return undefined
  return formulas.value.find(
    (f) =>
      belongsToTable(f.formula_type, l.line_type) &&
      (f.name.trim() === profile || (f.name && profile.includes(f.name)) || (f.name && f.name.includes(profile))),
  )
}

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
      rememberLocks(r.lock_rules) // 取价返回的锁具可选项 → 并入五金/锁具候选（原版 getPingPrice 的 lock）
    }
    const m = await api.resolveFormulaMatch(l.line_type, profile, l.fans || undefined)
    if (m) {
      l.formula_id = m.formula_id
    } else {
      const fm = matchFormulaByName(l)
      if (fm) l.formula_id = fm.id
    }
  } catch {
    // 静默
  }
  lineRefresh(l)
}

// 玻璃切换→加价项联动（旧版 Y()）：玻璃改选后，移除名=旧玻璃、单位=元/方的加价项，
// 并自动加入目录中名=新玻璃、单位=元/方的项。newValue 为空时只移除不新增。
function syncGlassMarkup(l: Line, newValue: string, oldValue: string) {
  const isSquare = (m: MarkupItem) => m.unit === '元/方'
  // 先移除旧玻璃对应的「元/方」加价项
  const old = (oldValue || '').trim()
  if (old) {
    l.markup = (l.markup ?? []).filter((m) => !(isSquare(m) && m.name === old))
  }
  // 加入新玻璃对应的「元/方」加价项（来自目录，避免重复）
  const next = (newValue || '').trim()
  if (next) {
    const targets = markupCatalog.value.filter((c) => c.name === next && c.unit === '元/方')
    for (const c of targets) {
      if (!(l.markup ?? []).some((m) => m.name === c.name && m.unit === '元/方')) {
        l.markup.push({ ...c, amount: 0 })
      }
    }
  }
  lineRefresh(l)
}

// 面玻/底玻合并联动：改任一玻璃都同步玻璃厚（按当前两玻状态）与「元/方」玻璃加价项。
function onGlassSelection(l: Line, newValue: string, oldValue: string) {
  syncGlassMarkup(l, newValue, oldValue)
  // 逐字照抄旧版 `oe`（@38200 一带），与本次改的是哪个字段无关（对两者 blur 都触发）：
  //   if ("无" === 底玻)                                     → 玻璃厚 = 8
  //   else if ("无" !== 底玻 && "无" !== 面玻 && 8 === 厚)    → 玻璃厚 = 默认厚（默认厚非法或为 8 时取 4）
  // **严格判字面量「无」** —— 空串不算「无」（原版新建行底玻恒有值，不会出现空串）。
  // 原版第二支**只在厚恰好为 8 时**才改写，且取的是「默认玻璃厚」而非写死 4。
  const bottom = (l.bottom_glass || '').trim()
  const face = (l.face_glass || '').trim()
  if (bottom === '无') {
    l.glass_thickness = '8'
  } else if (face !== '无' && Number(l.glass_thickness) === 8) {
    const t = defaultGlassThickness()
    l.glass_thickness = String(Number.isFinite(t) && t !== 8 ? t : 4)
  }
  lineRefresh(l)
}

// ===== 尺寸类自动加价（平开 / 吊趟两套）=====
// 平开 `Qt`  Hui.formatted.js:1578-1626
// 吊趟      Hui.formatted.js:5075-5125
// 触发时机都是**失焦**（不是随输入），且都受「自动加价」开关控制。

type SizeField = 'door_width' | 'door_height' | 'wall_thickness'

/** 候选：目录里 `^前缀\d+$` 且 元/公分，且**阈值严格小于**实际值（原版 `n > e`）。 */
function sizeMarkupCandidates(prefix: string, actual: number) {
  const re = new RegExp(`^${prefix}\\d+$`)
  return markupCatalog.value
    .map((c) => ({ c, th: Number((c.name.trim().match(/\d+$/) || [])[0] || 0) }))
    .filter((x) => re.test(x.c.name.trim()) && x.c.unit === '元/公分' && actual > x.th)
}

/**
 * 平开尺寸类自动带出（原版 `Qt`）。
 * - 门洞宽→`超宽`、门洞高→`超高`、墙厚→`超墙厚`
 * - **门洞宽/门洞高 仅当 `计价方式==='套'`**；墙厚恒触发
 * - 先按 `startsWith(前缀)` 清掉本行旧项（比候选筛选用 `^前缀\d+$` 更松，原版如此），
 *   再取「阈值最大（= 差值最小）」的一条挂上
 */
function syncSizeMarkupPing(l: Line, field: SizeField) {
  if (disableAutoMarkup.value) return
  if (field !== 'wall_thickness' && l.price_type !== '套') return
  const prefix = field === 'door_width' ? '超宽' : field === 'door_height' ? '超高' : '超墙厚'
  const actual =
    field === 'door_width' ? l.door_width || 0 : field === 'door_height' ? l.door_height || 0 : l.wall_thickness || 0

  l.markup = (l.markup ?? []).filter(
    (m) => !(m.name.trim().startsWith(prefix) && m.unit === '元/公分'),
  )
  const cands = sizeMarkupCandidates(prefix, actual)
  if (cands.length) {
    cands.sort((a, b) => b.th - a.th)
    l.markup.push({ ...cands[0].c, amount: 0 })
  }
  lineRefresh(l)
}

/** 吊趟「超墙厚」多候选择一（原版 `ElMessageBox.confirm(html,"选择加价项目",{dangerouslyUseHTMLString})` @:5108-5125）。 */
function pickDiaoWallMarkup(l: Line, cands: { c: { name: string; price: number; unit: string }; th: number }[]) {
  const sel = ref(0)
  dialog.warning({
    title: '选择加价项目',
    content: () =>
      h('div', { style: 'max-height:300px;overflow-y:auto' }, [
        h('p', { style: 'margin-bottom:12px;font-weight:bold' }, '检测到多个超墙厚选项，请选择一个：'),
        h(
          NRadioGroup,
          { value: sel.value, 'onUpdate:value': (v: number) => (sel.value = v) },
          {
            default: () =>
              cands.map((x, i) =>
                h(NRadio, { key: i, value: i, label: `${x.c.name} ${x.c.price}${x.c.unit}` }),
              ),
          },
        ),
      ]),
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      const pick = cands[sel.value]
      if (!pick) return
      l.markup.push({ ...pick.c, amount: 0 })
      lineRefresh(l)
    },
  })
}

/**
 * 吊趟墙厚自动带出（原版 `:5075-5125`）。
 * ⚠️ 与平开有两处不同，**照抄**：
 *   ① 只处理 `墙厚 → 超墙厚`（没有 超宽/超高）
 *   ② 候选数 **`<=1` 直接 return** —— 只有 1 个候选时**不自动加**；≥2 才弹窗让用户选
 */
function syncSizeMarkupDiao(l: Line) {
  if (disableAutoMarkup.value) return
  const actual = l.wall_thickness || 0
  l.markup = (l.markup ?? []).filter(
    (m) => !(m.name.trim().startsWith('超墙厚') && m.unit === '元/公分'),
  )
  const cands = sizeMarkupCandidates('超墙厚', actual)
  if (cands.length <= 1) {
    lineRefresh(l)
    return
  }
  pickDiaoWallMarkup(l, cands)
}

/** 尺寸类自动加价统一入口（按行类型分发）。 */
function syncSizeMarkup(l: Line, field: SizeField) {
  if (l.line_type === 'diao') {
    if (field === 'wall_thickness') syncSizeMarkupDiao(l)
    return
  }
  syncSizeMarkupPing(l, field)
}

// 墙厚单元格：输入后同步「超墙厚」加价项（旧版 blur 联动）。
function wallThicknessCell(l: Line, width: number) {
  return h(
    NInputNumber,
    {
      ...CELL,
      status: cellError(l, 'wall_thickness') ? 'error' : undefined,
      value: l.wall_thickness,
      showButton: false,
      style: { width: `${width}px` },
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        l.wall_thickness = sanitizeNum(v, 0)
        lineRefresh(l)
      },
      // 原版 `Qt` 挂在 onBlur：吊趟会在 ≥2 候选时弹窗，随输入触发会连弹
      onBlur: () => syncSizeMarkup(l, 'wall_thickness'),
    },
  )
}

// 玻璃单元格（面玻/底玻）：onSelect 需拿改前值做「元/方」加价项联动，故此处自行实现。
function glassSelectCell(l: Line, field: 'face_glass' | 'bottom_glass', width: number) {
  const oldByField = new WeakMap<object, string>()
  return h(
    NSelect,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      options: glassOptions,
      filterable: true,
      // ⚠️ **不加 `clearable`** —— 原版底玻/面玻两格都没有（@75060 / @73314），
      //    配合「必填」校验与新建行默认值（磨砂·白玻 / 白玻·白玻）⇒ 空串根本产生不出来。
      style: { width: `${width}px` },
      onUpdateValue: (v: string | null) => {
        const old = oldByField.get(l) ?? (l as unknown as Record<string, string>)[field] ?? ''
        ;(l as unknown as Record<string, string>)[field] = (v as string) ?? ''
        oldByField.set(l, (v as string) ?? '')
        onGlassSelection(l, (v as string) ?? '', old)
        // 「改底玻 → 设为默认」只在**平开表**（原版 `le` 仅挂在平开表底玻格的 onSelect/onBlur）。
        if (field === 'bottom_glass' && l.line_type === 'ping') rememberDefaultBottomGlass((v as string) ?? '')
      },
    },
  )
}

// 就地控件 helpers（h() 渲染）
const CELL = { size: 'small' as const }

// 校验红框：必填但为空的字段 → status=error（仿旧版 error-cell 红框标单元格）
function cellError(l: Line, field: string): boolean {
  const t = l.line_type
  switch (field) {
    case 'profile': return !l.profile.trim()
    // 门洞宽/高**不标红** —— 原版从不给 `errorFields["门洞高"/"门洞宽"]` 写 true（死代码，见
    // `missingFieldsOf` 的注释），单元格上的 `error-cell` 绑定恒为 false。
    case 'color': return !l.color.trim()
    // 底玻/面玻 也是必填：原版两格都挂了 `error-cell`（`{["error-cell"]: 校验结果["底玻"]}`），
    // 且**没有 `clearable`**（见 @75060 平开 / @185271 吊趟 的底玻格、@73314 / @183565 的面玻格）。
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
  // 门洞宽/门洞高在**失焦**时触发尺寸类自动加价（原版 `Qt` 挂在 onBlur 上，不是随输入）
  const sizeField =
    field === 'door_width' || field === 'door_height' ? (field as SizeField) : null
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
      onBlur: sizeField ? () => syncSizeMarkup(l, sizeField) : undefined,
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
  historyKey?: string,
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
        const next = (v as string) ?? ''
        ;(l as unknown as Record<string, string>)[field] = next
        if (historyKey) rememberField(historyKey, next)
        ;(onChange ?? lineRefresh)(l)
      },
    },
  )
}

// 型材/颜色：带候选下拉（可搜索 + 可输入新值，仿旧版 autocomplete），型材变化即取价/算料
// 型材候选按行门型过滤（平开不显示移门公式）
function profileCell(l: Line, width: number) {
  const opts = l.line_type === 'diao' ? diaoProfileOptions.value : pingProfileOptions.value
  // 不加 `historyKey`：原版型材**不写候选库**（见 `profileOptionsFor` 注释），故无需记忆。
  return optCell(l, 'profile', width, opts, (x) => void resolveRow(x), true)
}
// 移门/吊趟开向图：优先用从旧版提取的完整 DIRECTION_IMAGES 表（「扇数+开向」→ 图）。
function diaoDirImage(fans: string, direction: string): string {
  const f = (fans || '').trim()
  const d = (direction || '').trim()
  if (!f || !d) return ''
  return DIRECTION_IMAGES[`${f}${d}`] || ''
}

// 方向图（原版 lockImg / openImg）：平开按开向查 PING 图标；移门按 扇数+开向 查 DIRECTION_IMAGES。
function lineLockImage(l: Line): string {
  // ⚠️ **两族的取图键不同**（原版逐处硬编码，不是统一走归一化）：
  //   平开：`directionImageMap[ getOriginalOpenDirection(开向) ]`
  //         —— @350462(回执平开) / @464353(A平) / @497357(B平)
  //   吊趟：`directionImageMap[ "" + 扇数 + 开向 ]`
  //         —— @476780(A吊) / @517793(B吊) / @556000(D吊)，**不过 getOriginalOpenDirection**
  //   （`getOriginalOpenDirection` 全篇只出现 5 处：定义 + 回执平开 + 三个平开 producer。）
  return l.line_type === 'diao'
    ? diaoDirImage(l.fans, l.direction)
    : PING_DIRECTION_IMAGES[getOriginalOpenDirection(l.direction)] || ''
}

function colorCell(l: Line, width: number) {
  return h(
    NSelect,
    {
      ...CELL,
      status: cellError(l, 'color') ? 'error' : undefined,
      value: l.color,
      options: colorOptions.value,
      filterable: true,
      clearable: true,
      tag: true,
      style: { width: `${width}px` },
      onUpdateValue: (v: string | null) => {
        const next = (v as string) ?? ''
        l.color = next
        rememberField('color', next)
        lineRefresh(l)
      },
    },
  )
}
function trackCell(l: Line, width: number) {
  // 轨道候选按当前行公式 parts 的 track 提取（随型材联动），合并历史
  const opts = partsTrackOptions(l, 'track') // 轨道候选仅来自公式 parts + 历史，无内置兜底
  return optCell(l, 'track', width, opts, undefined, true, 'track')
}
function casingCell(l: Line, width: number) {
  // 套线候选仅来自当前行公式 parts 的单包/双包 + 历史，无内置候选（原版）
  const opts = partsTrackOptions(l, 'casing')
  return optCell(l, 'casing', width, opts, undefined, true, 'casing')
}
// 平开「包边」＝原版「套线种类」（Hui.formatted.js:2132 的「包边:」标签即绑 `e["套线种类"]`）。
// 平开公式常无 包宽/包高 件，纯靠 parts 提候选会空，故候选 = 原版枚举 + 公式套线件 track + 历史。
function pingCasingOptions(l: Line): { label: string; value: string }[] {
  const seen = new Set<string>()
  const out: { label: string; value: string }[] = []
  for (const o of [...casingKindOptions, ...partsTrackOptions(l, 'casing')]) {
    if (o.value && !seen.has(o.value)) {
      seen.add(o.value)
      out.push(o)
    }
  }
  return out
}
function hardwareCell(l: Line, width: number) {
  return optCell(l, 'hardware', width, hardwareOptionsFor(l), undefined, true, 'hardware')
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
// 算料部件明细 tooltip 内容
function partsTooltip(l: Line) {
  const parts = (l.parts ?? []).filter((p) => p && p.materialName)
  if (!parts.length) return '点「算料」后在此显示部件数量与下料长度'
  return parts
    .map((p) => `${p.materialName} ×${p.quantity} → ${p.result.toFixed(2)}`)
    .join('\n')
}

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
        h(
          NTooltip,
          { trigger: 'hover', placement: 'left', rawContent: false },
          {
            trigger: () =>
              h(NButton, { size: 'tiny', text: true, type: 'warning', onClick: () => void calcSingleRow(l) }, { default: () => '算料' }),
            default: () => h('pre', { style: 'margin:0;font-size:12px;white-space:pre-wrap;max-width:340px' }, partsTooltip(l)),
          },
        ),
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
  // 明细多行：原版把 `wt`/`ft` 产出的文本按 `\n` 渲染成 `.expression-line`（`Hui.formatted.js:2515`），
  // 内容是**带算式的文本**（如 `超宽: 5元/公分*3.5公分*2=35元`），不是「名称 ¥金额」。
  // 文本可现算（与金额同源、同一批分支），故不必落库。
  const lines = markupLines(l)
  // ⚠️ 结构与类名照抄原版（平开 @2497-2520 / 吊趟 @5288-5300 两处同构）：
  //   div.extra-items-container
  //     ├ div.glass-input-label  文案 `" 点击添加： "`（**前后各一个空格 + 全角冒号**）cursor:pointer
  //     ├ el-select              multiple/collapse-tags/collapse-tags-tooltip/filterable，宽 **100%**
  //     └ div.extra-items-expressions（有内容才渲染）
  //   四个类的样式见 <style scoped> 末尾（从 legacy/css/Hui-39b802eb.css 抄的）。
  return h('div', { class: 'extra-items-container' }, [
    h(
      'div',
      { class: 'glass-input-label', style: { cursor: 'pointer' }, onClick: () => openAddMarkup(l) },
      ' 点击添加： ',
    ),
    h(NSelect, {
      size: 'small',
      multiple: true,
      'collapse-tags': true,
      'collapse-tags-tooltip': true,
      filterable: true,
      options: opts,
      value: selected,
      placeholder: '请选择加价项目',
      style: { width: '100%' },
      onUpdateValue: (vals: (string | number)[]) => {
        const names = vals.map((v) => String(v))
        l.markup = names.map((n) => {
          const m = n.match(/x_(.+)__([\d.]+)__(.+)/)
          if (m) return { name: m[1], price: Number(m[2]), unit: m[3], amount: 0 }
          const idx = Number(n.split('_')[0])
          const c = markupCatalog.value[idx]
          return c ? { ...c, amount: 0 } : { name: n, price: 0, unit: '元/套', amount: 0 }
        })
        lineRefresh(l)
      },
    }),
    lines.length
      ? h(
          'div',
          { class: 'extra-items-expressions' },
          lines.map((t) => h('div', { class: 'expression-line' }, t)),
        )
      : null,
  ])
}
const markupCol = (): DataTableColumn<Line> => ({
  title: '加价项目',
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

// 边封数增量（原版 widthIncrement，公式级）：边封数≠2 时，
//   玻璃宽增量 = SheetIncrement×(2-边封数)，轨道增量 = TrackIncrement×(2-边封数)。
//   应用：玻璃宽增量/扇数N → 加「扇数…上下方」的 v；轨道增量 → 减 轨道件(上滑/上轨/下滑/盖板)的 v。
function applyWidthIncrement(parts: PartsMap, l: Line, f: FormulaDto) {
  // 原版 @389229（增量计算） + @390860/@391900（施加）：
  //   dw = 边封数!==2 && SheetIncrement!==0 ? SheetIncrement*(2-边封数) : 0
  //   dt = 边封数!==2 && TrackIncrement!==0 ? TrackIncrement*(2-边封数) : 0
  //   若 (dw||dt) 且 边封数!==2：从 扇数 里 match(/(\d+)扇/) 取 q →
  //       x = dw / q       （**只有 Sheet 增量除以扇数**）
  //       dt 原样
  const wi = (f.extra as { widthIncrement?: { SheetIncrement?: unknown; TrackIncrement?: unknown } } | undefined)?.widthIncrement
  const sheetInc = Number(wi?.SheetIncrement) || 0
  const trackInc = Number(wi?.TrackIncrement) || 0
  const n = Number(l.edge_seal_count) || 0
  const dw = n !== 2 && sheetInc !== 0 ? sheetInc * (2 - n) : 0
  const dt = n !== 2 && trackInc !== 0 ? trackInc * (2 - n) : 0
  const fans = l.fans || ''
  let x = 0
  let dtv = 0
  if ((dw !== 0 || dt !== 0) && Number(l.edge_seal_count) !== 2) {
    const m = fans.match(/(\d+)扇/)
    if (m) {
      const q = Number(m[1])
      if (dw !== 0) x = dw / q
      if (dt !== 0) dtv = dt
    }
  }
  // `a` 是状态位：**只有「上下方」被加过 x 之后**，封板宽与轨道件的减量才生效
  let a = 0
  const sbh = Number(l.seal_board_height) || 0
  const prefix = fans.substring(0, 2)
  for (const [key, p] of Object.entries(parts)) {
    if (key.includes(fans) && key.includes('上下方')) {
      p.v = (Number(p.v) || 0) + x
      a = 1
    }
    if (key.includes(fans) && key.includes('封板') && sbh > 0) {
      // ⚠️ 「封板高 → v = 封板高 - v」与「玻璃高 → v = 封板高 + v」两处 v 变换**只在 applyPartState 里做**，
      //    此处不重复（否则 `sbh - (sbh - v)` 会抵消、`sbh + sbh + v` 会翻倍）。
      if (key.includes('封板宽') && a === 1) p.v = (Number(p.v) || 0) - x
    }
    if (prefix.length === 2 && key.includes(prefix) && !key.includes('扇') && !key.includes('扣板') && a === 1 && dtv > 0 &&
        /上滑|上轨|下滑|左右盖板|上下盖板|轨道盖板/.test(key)) {
      p.v = (Number(p.v) || 0) - dtv
    }
    // 原版另有一处独立判断：门洞高 < 亮窗总高 的「上横」同样减 dt
    if (key.includes('上横') && l.door_height < l.light_window_height && a === 1 && dtv > 0) {
      p.v = (Number(p.v) || 0) - dtv
    }
  }
}

// 铰链减尺（原版 hinge，公式级）：行「五金」各项直接匹配 hinge 键（取第一个命中的）→
//   hinge[项].{上下方减尺, 光企减尺寸} 取负后加到「上下方」/「光企(非亮窗)」部件的 v。
function applyHinge(parts: PartsMap, l: Line, f: FormulaDto) {
  // 原版（@484816 等四处）：`行.五金` 若含 `_` 先按 `_` 拆分，trim 后**筛出含「合页」的项**，
  // **只取第一个**（多个时原版弹确认框），拿它去 `公式.hinge` 查配置：
  //   上下方减尺 / 光企减尺寸 均**取负**后加到对应部件的 v。
  // 命中不到配置时原版弹「合页匹配失败」确认框（不阻断）。找不到含「合页」的项 → 整体跳过。
  const hinge = (f.extra as { hinge?: Record<string, Record<string, unknown>> } | undefined)?.hinge
  if (!hinge || typeof hinge !== 'object') return
  const hw = String(l.hardware || '')
  const items = (hw.includes('_') ? hw.split('_') : hw ? [hw] : []).map((x) => x.trim())
  const hit = items.find((it) => it.includes('合页'))
  if (!hit) return
  const cfg = hinge[hit]
  if (!cfg) return
  const dw = -(Number(cfg['上下方减尺']) || 0)
  const dh = -(Number(cfg['光企减尺寸']) || 0)
  for (const [key, p] of Object.entries(parts)) {
    if (key.includes('上下方') && dw) p.v = (Number(p.v) || 0) + dw
    // 原版匹配的是「光企高」而非任意含「光企」的件
    if (key.includes('光企高') && !key.includes('亮窗') && dh) p.v = (Number(p.v) || 0) + dh
  }
}


// —— 部件激活（原版模型：`state` 服务端起手为 **false**，按固定顺序逐条规则置 true/false，
//    组装时只收 `state===true`）——
// 规则顺序 = 源码顺序，**后面的覆盖前面的**。清单见 docs/2026-09-10-template-field-audit.md §30。
//   平开（B平 @485198–489281）：① 单玻替换 ② 双玻 ③ v调整+兜底块 ④ eval(<0) ⑤ 二次 eval ⑥ 扣板厚联动
//   吊趟（B吊 @500279–507590）：① 单玻替换 ② 活扇块 ③ 39 条主规则 ④ eval(<0) ⑤ 二次 eval(<1 && !滑 && !单轨) ⑥ 联动
// 算料引擎 id（原版每个打印入口各跑一套引擎，规则不同、**结果可能不同**）：
//   A=玻璃合片单(A平/A吊)  B=生产单(B平/B吊)  D=生产单定制(D平/D吊)  P1=平开门定制(平开)  C=平开门定制(吊趟)
// 规则族见 docs/2026-09-10-template-field-audit.md §52。
type EngineId = 'A' | 'B' | 'D' | 'P1' | 'C' | 'L1' | 'L2'

function applyPartState(parts: PartsMap, l: Line, engine: EngineId = 'B'): void {
  const keys = Object.keys(parts)
  const diao = l.line_type === 'diao'
  const fans = (l.fans || '').trim()
  if (diao && !fans) return // 原版吊趟：无扇数直接 continue
  // ⚠️ **严格判字面量「无」，空串不算「无」** —— 旧版全篇 52 处底/面玻判定都是 `"无" === 行["底玻"]`，
  //    且**没有任何**「空值回落成无」的写法（全篇 `||"无"` 的 34 个命中全是布尔或，后面紧跟 `===`）。
  //    这里 `|| ''` 只为挡 undefined；正常流程下底玻/面玻恒有值（新建行默认 磨砂/白玻，见 newLine）。
  const bRaw = l.bottom_glass || ''
  const fRaw = l.face_glass || ''
  const wuBo = bRaw === '无' || fRaw === '无' // 单玻
  const shuangBo = bRaw !== '无' && fRaw !== '无' // 双玻
  const wall = Number(l.wall_thickness) || 0
  const lwH = Number(l.light_window_height) || 0
  const doorH = Number(l.door_height) || 0
  const lwN = Number(l.light_window_count) || 0
  const sbh = Number(l.seal_board_height) || 0
  const dir = l.direction || ''
  const track = l.track || ''
  const casing = l.casing || ''
  const set = (k: string, v: boolean) => {
    const p = parts[k]
    if (p) p.state = v
  }

  // ① 单玻替换（原版 B平 @485365 / B吊 @500608）：给「玻璃宽/高」找 `+单玻` 变体件，
  //    有变体就切过去，没有则本体照常启用。**原版这里没有 `亮窗` 排除** ——
  //    所以平开的 `上亮窗玻璃宽/高` 同样会被启用（用户实测：平开有亮窗玻璃件，命名 `上亮*`）。
  // L2（product10 移门）是特例：它有独立的 ① 块，且是**无条件**替换、**带** `亮窗`/`LiangChuang` 排除
  //   （`LiangChuang` 全文件仅此一处，§13）。先跑它，再走通用逻辑。
  if (engine === 'L2') {
    for (const k of keys) {
      if (!k.includes('亮窗') && !k.includes('LiangChuang') && (k.includes('玻璃宽') || k.includes('玻璃高')) && !k.includes('单玻')) {
        const alt = `${k}单玻`
        if (parts[alt]) {
          set(k, false)
          set(alt, true)
        } else set(k, true)
      }
    }
  }
  // 其余吊趟引擎**没有独立的单玻替换块** —— 等价逻辑在主规则块里（Q3.1/Q3.2，用 `扇数+'玻璃'`）。
  if (wuBo && !diao) {
    for (const k of keys) {
      if ((k.includes('玻璃宽') || k.includes('玻璃高')) && !k.includes('单玻')) {
        const alt = `${k}单玻`
        if (parts[alt]) {
          set(k, false)
          set(alt, true)
        } else set(k, true)
      }
    }
  }
  // ② 双玻（原版 B平 @485542 / B吊）：含「单玻」的禁用；含「玻璃」且非单玻的启用。**同样无 `亮窗` 排除**
  if (shuangBo && !diao) {
    for (const k of keys) {
      if (k.includes('单玻')) set(k, false)
      if (!k.includes('单玻') && k.includes('玻璃')) set(k, true)
    }
  }

  if (diao) {
    // ③ 活扇块。**两套变体**（原文逐字，整块门控都是 `扇数.includes('活')`）：
    //   A吊（@468374）：① `含(扇数)&&含'玻璃宽'` ② `含'玻璃高'&&track===行.轨道种类&&含(扇数)` ③ `亮窗总高>0&&含'玻璃'`
    //   B吊（@500279）/D吊/C吊：① `含'活'&&!含'玻璃高'` ② 同上 ③ `亮窗总高>0&&(含'玻璃'||含'亮窗')`
    if (fans.includes('活')) {
      const aDiao = engine === 'A' // A吊（G吊 我们未实现）
      for (const k of keys) {
        if (aDiao) {
          if (k.includes(fans) && k.includes('玻璃宽')) set(k, true)
          if (lwH > 0 && k.includes('玻璃')) set(k, true)
        } else {
          if (k.includes('活') && !k.includes('玻璃高')) set(k, true)
          if (lwH > 0 && (k.includes('玻璃') || k.includes('亮窗'))) set(k, true)
        }
        if (k.includes('玻璃高') && parts[k].track === track && k.includes(fans)) set(k, true)
      }
    }
    // ④ 主规则块。**三套变体**（§52.5 / §52.5b）：
    //   ③-A `{A吊,G吊}` 9 条 · ③-B `{B吊,D吊}` 39 条 · ③-C `{C吊}` 35 条。
    //   C吊 = B吊 − `固定` / `移动` / `收口+单轨2扇`（另「包高」写法等价）。
    const richDiao = engine !== 'A'
    const cDiao = engine === 'C'
    const r = fans.substring(0, 2)
    const lwTag = lwN > 0 ? `${lwN}格亮窗` : ''
    // §30.3 Q3.1/Q3.2：吊趟的单玻变体判定（`e` = 扇数+'玻璃'；`t` = 是否存在含 e 且含「单玻」的件）
    const eGlass = `${fans}玻璃`
    const hasSingleVariant = keys.some((k) => k.includes(eGlass) && k.includes('单玻'))
    const isSingleGlass = bRaw === '无' || fRaw === '无'
    const noLive = !fans.includes('活')
    // B/D/C 的 ① 是 `if (活扇) {活扇块} else {主规则块}` —— 活扇行**不跑**主规则块
    const runMain = !(richDiao && !noLive)
    // 光企/勾企/合页/锁 的 track 门控（原版 `part.track === 行.轨道种类`）。
    // 原版是**严格相等**，于是当公式里同一扇数只有一个变体（track 只是个标签）而用户偏巧选了
    // 另一个轨道种类（常见于下拉里的历史残留值）时，这些件会**整个消失**、什么都算不出来。
    // 这里放宽为「**该关键词下若有 track 匹配的件，就只取匹配的；一个都没匹配上，则退回该扇数的全部候选**」，
    // 既保留原版「多轨道变体时按轨道种类选」的语义，又保证**任何轨道种类都能算出结果**。
    const trackMatched = (kw: string) =>
      keys.some((k) => k.includes(kw) && k.includes(fans) && parts[k].track === track)
    const trackOk = (k: string, kw: string) => !trackMatched(kw) || parts[k].track === track
    for (const k of keys) {
      const p = parts[k]
      if (!runMain) continue
      if (hasSingleVariant && !isSingleGlass && k.includes(eGlass) && k.includes('单玻')) {
        set(k, false)
        continue
      }
      if (noLive && isSingleGlass && hasSingleVariant && k.includes(eGlass)) {
        set(k, k.includes('单玻'))
        continue
      }
      if (k.includes(fans) && k.includes('方')) set(k, true)
      if (richDiao) {
        if (!cDiao && k.includes(fans) && k.includes('固定')) set(k, true)
        if (!cDiao && k.includes(fans) && k.includes('移动')) set(k, true)
        if (k.includes(fans) && k.includes('封板') && sbh > 0) {
          set(k, true)
          if (k.includes('封板高')) p.v = sbh - (Number(p.v) || 0)
        }
      }
      if (k.includes(fans) && k.includes('玻璃')) {
        set(k, true)
        if (k.includes('玻璃高') && sbh > 0) p.v = sbh + (Number(p.v) || 0)
      }
      if (richDiao) {
        if (k.includes(fans) && k.includes('盖板')) set(k, true)
        if (r.length === 2 && k.includes(r) && !k.includes('扇') && !k.includes('扣板')) set(k, true)
      }
      if (k.includes('光企') && k.includes(fans) && trackOk(k, '光企')) set(k, true)
      if (k.includes('勾企') && k.includes(fans) && trackOk(k, '勾企')) set(k, true)
      if (k.includes('合页') && k.includes(fans) && trackOk(k, '合页')) set(k, true)
      if (k.includes('锁') && k.includes(fans) && trackOk(k, '锁')) set(k, true)
      // 以下规则族（边封/上横/包边/墙厚两套/收口）**只有 ③-B、③-C 有**：
      // ③-A（A吊/G吊，§52.5）只有 9 条 —— 方·上下方·玻璃·光企·勾企·合页·锁·亮窗数量。
      if (richDiao) {
        if (k.includes('边封') && doorH > lwH && k.includes('无')) set(k, true)
        if (k.includes('上横') && doorH < lwH) set(k, true)
        if (k.includes('边封') && doorH < lwH && !k.includes('无')) set(k, true)
        if (k.includes('包宽') && p.track === casing) set(k, true)
        // 包高：按**部件自身 formula** 是否含 `h1+` 分两支
        if (k.includes('包高') && !p.formula.includes('h1+') && p.track === casing && lwH < doorH) set(k, true)
        if (k.includes('包高') && p.formula.includes('h1+') && p.track === casing && lwH > doorH) set(k, true)
        if (wall > 0 && lwH === 0) {
          if (k.includes('F槽宽')) set(k, true)
          if (k.includes('扣板宽')) set(k, true)
          if (k.includes('F槽高') && !k.includes('亮窗')) set(k, true)
          if (k.includes('扣板高') && !k.includes('亮窗')) set(k, true)
          if (k.includes('扣板厚') && k.includes(r) && p.title === '') set(k, true)
          if (k.includes('扣板厚') && k.includes(r) && p.title !== '' && p.track === casing) set(k, true)
        }
        if (wall > 0 && lwH > 0) {
          if (k.includes('F槽宽')) set(k, true)
          if (k.includes('扣板宽')) set(k, true)
          if (k.includes('亮窗F槽高')) set(k, true)
          if (k.includes('亮窗扣板高')) set(k, true)
          if (k.includes('扣板厚') && k.includes(r) && p.title === '') set(k, true)
          if (k.includes('扣板厚') && k.includes(r) && p.title !== '' && p.track === casing) set(k, true)
        }
        if (k.includes('收口')) {
          if (fans.includes('4扇') && !fans.includes('折叠')) set(k, true)
          if (/[3456]扇/.test(fans) && fans.includes('折叠') && !dir.includes('0')) set(k, true)
          if (fans.includes('2轨3扇') || (!cDiao && fans.includes('单轨2扇'))) set(k, true)
        }
      }
      if (lwTag && k.includes(lwTag)) set(k, true)
    }
  } else {
    // ⑤ 平开兜底块。**逐引擎有差异**（§52.7）：
    //   `扣板|压线 → false`：A平/D平/P1平/G平 是「扣板**或压线**」；**B平/L1 只判「扣板」**
    //   `封板/封板高` 规则：B平/D平/P1平/L1 有；**A平/G平 无**
    const pingYaxian = engine === 'A' || engine === 'D' || engine === 'P1'
    const pingSealBoard = engine !== 'A'
    for (const k of keys) {
      const p = parts[k]
      if (k.includes('玻璃宽') || k.includes('玻璃高')) continue
      if (wall > 0) p.state = true
      else if (pingYaxian ? /扣板|压线/.test(k) : k.includes('扣板')) p.state = false
      else p.state = true
      if (pingSealBoard) {
        if (k.includes('封板') && sbh === 0) p.state = false
        if (k.includes('封板高') && sbh > 0) {
          p.state = true
          p.v = sbh - (Number(p.v) || 0)
        }
      }
      // 这条 v 变换各平开引擎都有（§52.7 第三行），且**不带 `includes(扇数)` 门控**
      if (k.includes('玻璃高') && sbh > 0 && !k.includes('亮窗')) p.v = sbh + (Number(p.v) || 0)
    }
  }
  // 平开上亮门控（用户要求，原版无此门控）：无上亮（亮窗总高 ≤ 门洞高）时禁用全部「上亮/压线」件。
  // 原版 state 规则里 `上亮窗玻璃宽 = w-v` 是纯宽公式、不随 h1 归零，所以没填亮窗总高也会漏出
  // `上亮横/上亮窗玻璃宽/压线宽`；`上亮窗玻璃高/压线高 = h1-h-v` 则因负值已被主 eval 关掉。
  if (!diao && lwH <= doorH) {
    for (const k of keys) {
      if (k.includes('上亮') || k.includes('压线')) set(k, false)
    }
  }
}

/**
 * 影响算料结果的行字段（缓存签名用）。任一变化都要重算。
 *
 * ⚠️ **凡是 `computePartsUncached` / `dimsOf` 链路读到的行字段，都必须列在这里**，
 * 漏一个就会出现「改了字段但算料结果不变、连点『算料』也救不回来」（缓存命中的是旧值）。
 * 已实测确认漏过并补上的：
 *   - `hole_size`（洞尺）—— `holeDeduction` 按它取公式 `resetSize` 的减尺去改 w/h
 *   - `double_ding`（单/双丁墙体）—— `swingWallDeduction` 按它取公式 `swingWall` 的减尺
 *   - `mother_door_width`—— `dimsOf` 的 `s`（子母门公式要用）
 *   - `light_window_count`—— `applyPartState` 按它定亮窗部件的 state
 */
function partsSig(l: Line): string {
  return [
    l.formula_id, l.line_type, String(formulaOf(l)?.formula_type ?? ''), l.door_width, l.door_height, l.light_window_height, l.wall_thickness,
    l.jiao, l.track_length, l.bottom_glass, l.face_glass, l.glass_thickness, l.fans, l.direction,
    l.track, l.casing, l.edge_seal_count, l.seal_board_height, l.front_casing_add, l.back_casing_add,
    l.hardware, l.quantity,
    // ↓ 这四个原先漏了（洞尺填了不生效就是这么来的）
    l.hole_size, l.double_ding, l.mother_door_width, l.light_window_count,
  ].join('|')
}
// 算料结果缓存：一张单据页会被 17 个模板各取一次数据，逐次重算会明显卡（尤其行多时）。
const partsCache = new WeakMap<Line, Map<EngineId, { sig: string; val: PartPreview[] }>>()

/** 按**指定引擎**算料。原版每个打印入口各跑一套引擎（A/B/D/P1/C），**规则不同、结果可能不同**，
 *  所以同一订单行在不同单据上出现的部件集本来就可能不一样 —— 不能共用一份算料结果。
 *  同步实现：公式取自已载入的 `formulas`；公式缺失时回退到 `l.parts`（页面最后一次算料结果）。 */
function computeParts(l: Line, engine: EngineId = 'B'): PartPreview[] {
  const sig = partsSig(l)
  const hit = partsCache.get(l)?.get(engine)
  if (hit && hit.sig === sig) return hit.val
  const val = computePartsUncached(l, engine)
  let m = partsCache.get(l)
  if (!m) {
    m = new Map()
    partsCache.set(l, m)
  }
  m.set(engine, { sig, val })
  return val
}

function computePartsUncached(l: Line, engine: EngineId): PartPreview[] {
  const f = formulaOf(l)
  if (!f) return (l.parts ?? []) as PartPreview[]
  const src = f.parts as PartsMap
  if (!src || typeof src !== 'object' || Array.isArray(src)) return []
  const parts = JSON.parse(JSON.stringify(src)) as PartsMap
  // `_keyOrder` / `挖孔图` / `公式类型` 是**元数据**、不是部件 —— 原版遍历部件时一律跳过
  // （`Diao.deobfuscated.js` @125457/@149959 的 `filter(e => e !== "_keyOrder" && e !== "挖孔图" && e !== "公式类型")`；
  //  `Hui-d088417c.js` @320257 `if ("_keyOrder" === x) return`）。导入原版公式时会带上它们。
  for (const meta of ['_keyOrder', '挖孔图', '公式类型']) {
    delete (parts as unknown as Record<string, unknown>)[meta]
  }
  // ⚠️ 两条公式级减量**各有适用引擎**（§52/§53 引擎普查证实）：
  //   `widthIncrement`：只有 **A吊/B吊/D吊**（平开没有；C吊、G吊 也没有）
  //   `hinge`：只有 **平开**（A平/B平/D平/P1平）；**6 个吊趟引擎一律不读**
  const diaoLine = l.line_type === 'diao'
  if (diaoLine && engine !== 'C') applyWidthIncrement(parts, l, f)
  if (!diaoLine) applyHinge(parts, l, f)
  applyPartState(parts, l, engine) // 按规则定 state（默认 false 起手）
  const dims = dimsOf(l)
  const computed: Record<string, number> = {}
  let kbThickNeg = false
  const diao = l.line_type === 'diao'
  // ⚠️ **必须分两遍**（原版 `needsSecondPass`）：第一遍只算**不含跨部件引用**的部件
  // （`formula` 里没有 `.result`），第二遍才算引用型的。否则像「玻璃高 = 光企高.result - v」
  // 这种在「光企高」之前被求值就会得 0 —— 而且 `jsonb` 不保留键顺序，顺序本来就不可控。
  const secondPass: string[] = []
  // 阈值（原文）：**主 eval**（第一遍，不含 `.result` 的部件）—— 只有 **B吊(@506843)/L2(@396683)**
  //   用 `<1 && !滑 && !单轨`，其余引擎用 `<0`；**第二遍 eval**（含 `.result` 的部件）一律 `<0`。
  const mainLt1 = diao && (engine === 'B' || engine === 'L2')
  const evalOne = (name: string, isSecondPass: boolean): void => {
    const p = parts[name]
    if (!p || !p.formula || !p.state) return
    const r = evalForward(
      p.formula,
      dims,
      (ref: string) => (computed[ref] !== undefined ? String(computed[ref]) : '0'),
      Number(p.v) || 0,
      Number(p.result) || 0,
    )
    computed[name] = r
    // 主 eval 的阈值：B吊/L2 用 `<1 && !滑 && !单轨`；其余用 `<0`。第二遍一律 `<0`。
    const bad = !isSecondPass && mainLt1
      ? r < 1 && !name.includes('滑') && !name.includes('单轨')
      : r < 0
    if (bad) {
      p.state = false
      computed[name] = 0
      if (name.includes('扣板厚')) kbThickNeg = true
    }
  }
  // 第一遍：不含 `.result` 的
  for (const [name, p] of Object.entries(parts)) {
    if (!p.formula || !p.state) continue
    if (p.formula.includes('.result')) {
      secondPass.push(name)
      continue
    }
    evalOne(name, false)
  }
  // 第二遍：引用型的
  for (const name of secondPass) evalOne(name, true)
  // 扣板厚负值联动（§52.7 / 原文 @487868 平开 vs @507050 吊趟）：**两族杀的部件名不同** ——
  //   平开：`名含'扣板' || 名含'压条'`；吊趟：`名含'扣板高' || 名含'扣板宽'`
  const kbKill = diaoLine ? /扣板高|扣板宽/ : /扣板|压条/
  const out = Object.entries(parts)
    .filter(([key, p]) => !!p.formula && p.state && !(kbThickNeg && kbKill.test(key)))
    .map(([key, p]) => ({ key, materialName: p.materialName || key, quantity: p.quantity || 0, result: round2(computed[key] ?? 0) }))
  // 按公式的**部件声明序**重排（`extra._keyOrder` —— **原版自己的字段名**，见 `Diao.deobfuscated.js`
  // @141718 写 / @149913 读）。
  // 必要性：`parts` 落 JSONB 后对象键会被「长度+字节」重排，而原版各打印列（移门外框、全部 windows 列）
  // 直接按 `Object.entries(parts)` 的声明序输出；更要命的是 `applyWidthIncrement` 的状态位 `a`
  // 依赖「{扇数}上下方」是否**先于**轨道件出现 —— 顺序会改变**算出来的数值**（不只显示顺序）。
  // 顺序存成数组（JSONB 保序）故能穿过来。缺 `_keyOrder` 的旧数据保持现状，行为不变。
  // 详见 docs/2026-09-15-parts-order-fidelity.md
  const order = (f.extra as { _keyOrder?: unknown } | undefined)?._keyOrder
  if (Array.isArray(order) && order.length) {
    const rank = new Map(order.map((k, i) => [String(k), i]))
    // 不在声明序里的部件排到最后（`sort` 稳定，保持它们原有的相对次序）
    out.sort((a, b) => (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER))
  }
  return out
}

// 单行算料：有 formula_id 才计算（仿旧版门图列「算料」）
async function calcSingleRow(l: Line) {
  if (!l.profile.trim()) {
    message.warning('请先填写型材')
    return
  }
  if (l.formula_id == null) {
    // 填了型材但未选/未匹配到公式 → 尝试按型材自动匹配公式（resolveFormulaMatch 或公式名兜底）
    await resolveRow(l)
    if (l.formula_id == null) {
      const fm = matchFormulaByName(l)
      if (fm) l.formula_id = fm.id
    }
    if (l.formula_id == null) {
      message.warning('未找到对应公式，请检查型材名称是否正确')
      return
    }
  }
  try {
    const f = await api.getFormula(l.formula_id)
    const parts = f.parts as PartsMap
    if (!parts || typeof parts !== 'object' || Array.isArray(parts)) {
      l.parts = []
      return
    }
    await loadFormulaImages(l.formula_id) // 拉公式挖孔图（glassHole doorImg 用）
    // 页面上的算料明细按**生产单引擎（B）**算
    l.parts = computeParts(l, 'B')
    lineRefresh(l)
    message.success(`算料完成：${l.parts.length} 个部件`)
    void openTemplatePreview('product')
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
// cCol：控件可增长（min-width:0）避免文字截断。
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
  title: '门花图',
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
          // 面玻标签**随公式类型变**（原版：`L.value[formulaid]==='diamond' ? '门玻：' : '面玻：'`，
          // 见 Hui-d088417c 偏移 72852 起的 ping 玻璃列；无公式时回退 '面玻：'）。
          // 我们整列用缩写标签（面/底/厚），故钻石型对应缩成「门」。
          sub(isDiamond(l) ? '门' : '面', glassSelectCell(l, 'face_glass', 88)),
          // 底玻标签同样随公式类型变（原版：钻石型 '固玻：'，否则 '底玻：'），缩写为「固/底」。
          sub(isDiamond(l) ? '固' : '底', glassSelectCell(l, 'bottom_glass', 88)),
          // 厚度一格**不分支**：原版此处恒为 '厚度：'，钻石型也照旧。
          // 平开表改厚度即「设为默认玻璃厚度」（原版 `ne`，@77100）。
          sub(
            '厚',
            optCell(l, 'glass_thickness', 88, glassThicknessOptions, (row) => {
              if (row.line_type === 'ping') rememberDefaultGlassThickness(row.glass_thickness)
              lineRefresh(row)
            }),
          ),
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
          ...(colVis(pingColVis, 'casing')
            ? [sub('包边', optCell(l, 'casing', 88, pingCasingOptions(l), undefined, true, 'casing'))]
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
          // 门洞宽标签随公式类型变（原版：钻石型 '左宽：'，否则 '宽：'）。
          sub(isDiamond(l) ? '左宽' : '宽', intCell(l, 'door_width', 60)),
          // 墙厚一格也分支：钻石型显示 '门宽：'（仅 ping 表如此，diao 表无此分支）。
          sub(isDiamond(l) ? '门宽' : '墙厚', wallThicknessCell(l, 60)),
          ...(needsMotherWidth(l) ? [sub('母门宽', intCell(l, 'mother_door_width', 60))] : []),
          // 钻石型时「亮窗总高」这个字段**搬进本列**并改名「右宽」（原版 @85386 的 v-if 块，
          // 标签 token `t(251)='右宽：'`）。非钻石时它在下面独立的「亮窗总高」列里 —— 两处互斥。
          ...(isDiamond(l) ? [sub('右宽', intCell(l, 'light_window_height', 60))] : []),
        ),
    },
    // 原版 ping 表「洞尺」是**独立列**（@86403 起），槽内是「洞尺/净尺」单选组、无内嵌小标签；
    // 由 `列显隐表['洞尺']` 闸门。（我们沿用 optCell 下拉表达同一字段，取值集见 HOLE_SIZE_OPTS。）
    {
      title: '洞尺',
      key: 'hole_size',
      width: 60,
      render: (l) => holeCell(l, 60),
    },
    // 原版 ping 表里「吊脚」与「亮窗总高」是**两个独立列**（`Hui-d088417c` @86619 / @86995），
    // 槽内直接渲染输入框、无内嵌小标签。吊脚列由 `列显隐表['吊脚']` 闸门；亮窗总高列**无闸门**（原版如此）。
    {
      title: '吊脚',
      key: 'jiao',
      width: 62,
      render: (l) => intCell(l, 'jiao', 62),
    },
    {
      title: '亮窗总高',
      key: 'lightwin',
      width: 62,
      // 原版该列自带互斥条件：`L.value[formulaid] !== 'diamond'` 才渲染输入框，钻石型整格为空
      // （else 分支是 `createCommentVNode`）。无公式时渲染（与原版 `return true` 一致）。
      render: (l) => (isDiamond(l) ? null : intCell(l, 'light_window_height', 62)),
    },
    // 原版「五金」（`["五金"]` 闸门）与「封板高」是两个独立列
    { title: '五金', key: 'hardware', width: 82, render: (l) => hardwareCell(l, 76) },
    { title: '封板高', key: 'seal_board', width: 62, render: (l) => intCell(l, 'seal_board_height', 62) },
    {
      title: '备注',
      key: 'remark',
      width: 96,
      render: (l) => cCol(sub('地址', tCell(l, 'install_address', 80)), sub('备注', tCell(l, 'remark', 80))),
    },
    { title: '金额', key: 'money', width: 140, render: (l) => moneyCell_2(l) },
    markupCol(),
    // 原版平开表尾部列序：加价项目 → 计价方式 → 打折 → 前包加长 → 后包加长 → 单双丁 → 单号 → …
    { title: '计价方式', key: 'price_type', width: 74, render: (l) => optCell(l, 'price_type', 68, priceTypeOptions) },
    { title: '打折', key: 'discount', width: 62, render: (l) => moneyCell(l, 'discount', 56) },
    { title: '前包加长', key: 'front_casing', width: 84, render: (l) => intCell(l, 'front_casing_add', 78) },
    { title: '后包加长', key: 'back_casing', width: 84, render: (l) => intCell(l, 'back_casing_add', 78) },
    { title: '单/双丁墙体', key: 'double_ding', width: 96, render: (l) => optCell(l, 'double_ding', 88, DOUBLE_DING_OPTS) },
    { title: '单号', key: 'order_no', width: 78, render: () => orderNoCell() },
    { title: '图片ID', key: 'image_id', width: 80, render: (l) => h('span', { style: 'font-size:11px;color:#606266' }, l.image_id || '—') },
    // 原版「客户」「客户编号」是**订单级**（行上无此字段），故取 order 而非 l
    { title: '客户', key: 'client', width: 88, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_name || '—') },
    { title: '客户编号', key: 'client_code', width: 84, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_code || '—') },
    { title: '其它费用', key: 'other_fee', width: 78, render: (l) => moneyCell(l, 'other_fee', 72) },
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
    // 原版移门表列序与列内容见 `Hui-d088417c` @176837..@207080（表头 label 偏移即列序）：
    //   门花图 | 型材/颜色 | 单价/数量 | 玻璃 | 扇数/开向 | 下轨道/套线 | 门洞尺寸 | 洞尺 |
    //   亮窗信息 | 五金 | 备注 | 金额 | 加价项目 | 上轨/边封 | 前包加长 | 后包加长 |
    //   单双丁 | 计价方式 | 打折 | 单号 | 图片ID | 客户 | 客户编号 | 其它费用
    // 其中「单价/数量」列内还含 套线单价，且**生产进度是「单价」框上的 tooltip**（不是可编辑格子）；
    // 「亮窗信息」列内含 亮窗总高/亮窗数量/封板高。
    {
      title: '单价/数量',
      key: 'unit_qty',
      width: 104,
      render: (l) =>
        cCol(
          // 原版 @181691：`el-tooltip :disabled="!e[…]" :content="e['生产进度']"` 包住单价输入框
          sub(
            '单价',
            h(
              NTooltip,
              { disabled: !l.progress, trigger: 'hover' },
              { trigger: () => moneyCell(l, 'unit_price', 84), default: () => l.progress },
            ),
          ),
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
          sub('面', glassSelectCell(l, 'face_glass', 88)),
          sub('底', glassSelectCell(l, 'bottom_glass', 88)),
          sub('厚', optCell(l, 'glass_thickness', 88, glassThicknessOptions)),
        ),
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
      title: '下轨道/套线',
      key: 'track_line',
      width: 108,
      render: (l) =>
        cCol(
          ...(colVis(diaoColVis, 'track') ? [sub('轨道', trackCell(l, 88))] : []),
          sub('套线', casingCell(l, 88)),
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
          sub('墙厚', wallThicknessCell(l, 60)),
          ...(needsMotherWidth(l) ? [sub('母门宽', intCell(l, 'mother_door_width', 60))] : []),
        ),
    },
    // 原版「洞尺」是独立列（`["洞尺"]` 闸门，单选 洞尺/净尺/单包洞尺/双包洞尺）
    {
      title: '洞尺',
      key: 'hole_size',
      width: 60,
      render: (l) => holeCell(l, 60),
    },
    // 原版「亮窗信息」列内含三格：亮窗总高 / 亮窗数量 / 封板高
    {
      title: '亮窗信息',
      key: 'lightwin',
      width: 82,
      render: (l) =>
        cCol(
          sub('总高', intCell(l, 'light_window_height', 62)),
          sub('数量', intCell(l, 'light_window_count', 62)),
          sub('封板高', intCell(l, 'seal_board_height', 62)),
        ),
    },
    // 原版「五金」是独立列（`["五金"]` 闸门）
    { title: '五金', key: 'hardware', width: 82, render: (l) => hardwareCell(l, 76) },
    {
      title: '备注',
      key: 'remark',
      width: 96,
      render: (l) => cCol(sub('地址', tCell(l, 'install_address', 80)), sub('备注', tCell(l, 'remark', 80))),
    },
    { title: '金额', key: 'money', width: 140, render: (l) => moneyCell_2(l) },
    markupCol(),
    // 以下列序严格照原版：加价项目 → 上轨/边封 → 前包加长 → 后包加长 → 单双丁 →
    // 计价方式 → 打折 → 单号 → 图片ID → 客户 → 客户编号 → 其它费用
    {
      title: '上轨/边封',
      key: 'up_track_seal',
      width: 92,
      render: (l) => cCol(sub('轨道长', intCell(l, 'track_length', 76)), sub('边封数', intCell(l, 'edge_seal_count', 76, 2))),
    },
    { title: '前包加长', key: 'front_casing', width: 84, render: (l) => intCell(l, 'front_casing_add', 78) },
    { title: '后包加长', key: 'back_casing', width: 84, render: (l) => intCell(l, 'back_casing_add', 78) },
    { title: '单双丁', key: 'double_ding', width: 82, render: (l) => optCell(l, 'double_ding', 74, DOUBLE_DING_OPTS) },
    { title: '计价方式', key: 'price_type', width: 74, render: (l) => optCell(l, 'price_type', 68, priceTypeOptions) },
    { title: '打折', key: 'discount', width: 62, render: (l) => moneyCell(l, 'discount', 56) },
    { title: '单号', key: 'order_no', width: 78, render: () => orderNoCell() },
    // 原版「图片ID」列不可编辑（只展示），故用只读 span
    { title: '图片ID', key: 'image_id', width: 80, render: (l) => h('span', { style: 'font-size:11px;color:#606266' }, l.image_id || '—') },
    // 原版「客户」「客户编号」是**订单级**（行上无此字段），故取 order 而非 l
    { title: '客户', key: 'client', width: 88, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_name || '—') },
    { title: '客户编号', key: 'client_code', width: 84, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_code || '—') },
    { title: '其它费用', key: 'other_fee', width: 78, render: (l) => moneyCell(l, 'other_fee', 72) },
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

// 复制行（仿旧版：清生产进度/图片）
function copyRow(l: Line) {
  const copy: Line = JSON.parse(JSON.stringify(l))
  copy.id = null
  copy.progress = ''
  copy.image_id = null
  copy.image_url = null
  lines.value.push(copy)
  lineRefresh(copy)
  message.success('复制成功')
}

// 修改平方数（平方单元格右键，仿旧版）
const squareDialog = ref(false)
const squareTarget = ref<Line | null>(null)
// 空 = 未填（旧版输入框初值就是空串 `Mt=Vue.ref("")`，`Hui.formatted.js:4386`）。
// 确认时为空 → 回到「自动」（custom_square = -1）。
const squareInput = ref<number | null>(null)

function openSquareDialog(l: Line) {
  squareTarget.value = l
  squareInput.value = l.custom_square >= 0 ? l.custom_square : null
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
      track: l.track, casing: l.casing, hardware: l.hardware,
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
      double_ding: l.double_ding, light_window_count: l.light_window_count,
      image_id: l.image_id, image_url: l.image_url, progress: l.progress, hole_size: l.hole_size,
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

// 原版 `shouldUseNewSizeFormat(ds)`：ds 形如 smartdoor / smartdoor408；无数字后缀或 408 / >414 用新格式。
// 生产环境 ds = 'smartdoor' → 新格式（带 `高:`/`<br/>宽:` 标签那种）。后端 tenants 暂无 ds 列，先常量占位。
const TENANT_DS: string = 'smartdoor'
const NEW_SIZE_FORMAT = (() => {
  const m = /^smartdoor(\d+)?$/.exec(TENANT_DS)
  return m ? (!m[1] || Number(m[1]) === 408 || Number(m[1]) > 414) : false
})()

// 尺寸列（旧版回执）：平开 3 分支（钻石/子母/普通）× 移门 1 套，每套再按 NEW_SIZE_FORMAT 选拼法。
// 非新格式统一「值直接拼」；新格式带 `高:`/`<br/>宽:` 等标签。洞尺存在时前置。
function dimSizeLabel(l: Line): string {
  const h = l.door_height || 0
  const w = l.door_width || 0
  if (!h && !w) return ''
  const lw = l.light_window_height > 0
  const wall = l.wall_thickness > 0
  const jiao = l.jiao > 0
  const track = l.track_length > 0
  let s: string
  if (l.line_type === 'diao') {
    s = NEW_SIZE_FORMAT
      ? `高:${h}<br/>宽:${w}${lw ? `<br/>亮窗:${l.light_window_height}` : ''}${l.light_window_count > 0 ? `<br/>亮窗数:${l.light_window_count}` : ''}${wall ? `<br/>墙厚:${l.wall_thickness}` : ''}${track ? `<br/>轨道长:${l.track_length}` : ''}`
      : `高${h}宽${w}${lw ? ` 亮窗${l.light_window_height}` : ''}${l.light_window_count > 0 ? ` 亮窗数:${l.light_window_count}` : ''}${wall ? ` 墙厚:${l.wall_thickness}` : ''}${track ? ` 轨道长:${l.track_length}` : ''}`
  } else if (/钻石/.test(l.profile || '')) {
    s = NEW_SIZE_FORMAT
      ? `高:${h}<br/>左宽:${w}${lw ? `<br/>门宽:${l.light_window_height}` : ''}${wall ? `<br/>右宽:${l.wall_thickness}` : ''}`
      : `高${h}左宽${w}${lw ? `门宽${l.light_window_height}` : ''}${wall ? `右宽${l.wall_thickness}` : ''}`
  } else if (/子母/.test(l.profile || '')) {
    s = NEW_SIZE_FORMAT
      ? `高:${h}<br/>宽:${w}<br/>母门:${l.track_length}${lw ? `<br/>亮高:${l.light_window_height}` : ''}${wall ? `<br/>墙厚:${l.wall_thickness}` : ''}${jiao ? `<br/>吊脚:${l.jiao}` : ''}`
      : `高${h}宽${w}母门${l.track_length}${lw ? `*亮高${l.light_window_height}` : ''}${wall ? `*${l.wall_thickness}` : ''}${jiao ? `*${l.jiao}` : ''}`
  } else {
    s = NEW_SIZE_FORMAT
      ? `高:${h}<br/>宽:${w}${lw ? `<br/>亮高:${l.light_window_height}` : ''}${wall ? `<br/>墙厚:${l.wall_thickness}` : ''}${jiao ? `<br/>吊脚:${l.jiao}` : ''}`
      : `高${h}宽${w}${lw ? `*亮高${l.light_window_height}` : ''}${wall ? `*${l.wall_thickness}` : ''}${jiao ? `吊脚${l.jiao}` : ''}`
  }
  // 原版：`e["洞尺"] && (_.size = e["洞尺"] + "<br>" + _.size)`
  return l.hole_size ? `${l.hole_size}<br>${s}` : s
}

// 玻璃列（旧版回执）：单玻/双玻/无，镜片 + 玻璃厚。
// 回执玻璃列（原版，ping 判定顺序）：单玻 / 无 / 固玻(钻石) / 背板(厚0) / 底玻:面玻:。
function glassSpecPrintable(l: Line): string {
  // 原版 @351196（平开）/ @442766（吊趟）**直接读 `e["底玻"]` 做 `"无"===` 严格比较**，无空值回落。
  const bottom = l.bottom_glass || ''
  const face = l.face_glass || ''
  const thick = l.glass_thickness || ''
  // 原版（@351196 平开 / @442766 吊趟）：`家家发门业` / `星之铝门窗` 两家**不加** `*{厚}mm`
  const mm = STORE_GLASS_NO_MM.includes(tenantName.value) ? '' : `*${thick}mm`
  if (bottom === '无' && face === '无') return '无'
  if (bottom === '无') return `单玻:${face}${mm}`
  // 钻石支**只在平开**：吊趟那条表达式没有 `型材含钻石` 判断，直接落到 `0==玻璃厚` / else
  if (isDiamond(l) && l.line_type !== 'diao') return `固玻:${bottom}<br>门玻:${face}${mm}`
  if (Number(thick) === 0) return `背板:${bottom}<br>面板:${face}`
  return `底玻:${bottom}<br>面玻:${face}${mm}`
}

// 计价明细（旧版回执）：●单价×数量=金额元（套）/ ●单价×平方=金额元（方）。
// 计价明细（原版）：套 = `•单价元/套*数量=金额元`；方 = `•单价元/方*平方(3位)=金额元`。
function pricingDetail(l: Line): string {
  let s = ''
  // 原版是两个**显式**分支：`计价方式==='套' && 单价>0` / `==='方' && 单价>0`；
  // 计价方式为其它值（含空）时两个分支都不走，只可能剩套线金额与加价项目。
  if (l.unit_price > 0 && l.price_type === '套') {
    s = `•${l.unit_price}元/套*${l.quantity}=${l.quantity * l.unit_price}元`
  } else if (l.unit_price > 0 && l.price_type === '方') {
    const sq = l.square || 0
    s = `•${l.unit_price}元/方*${sq.toFixed(3)}=${Number((Math.round(100 * sq * l.unit_price) / 100).toFixed(3))}元`
  }
  // 套线金额：套线种类形如 `一高一宽-30`，`-` 后为「丁」的个数。
  // 长度**必须**复用 `casingLength`（= 上方 `casingAmountOf` 算出 `casing_amount` 用的同一个函数），
  // 否则显示米数与实际计费米数会来自两套代码而悄悄对不上。
  if (l.casing_amount > 0) {
    const name = (l.casing || '').split('-')[0] || ''
    const len = casingLength(l)
    s += l.quantity === 1
      ? `•${name}${l.casing_price}元/米*${len} =${l.casing_amount}元`
      : `•${name}${l.casing_price}元/米*${len}*${l.quantity}=${l.casing_amount}元`
  }
  // 原版在单价行/套线行之后再追加上加价项目那几行（`Hui.formatted.js:8721` / `:8819`）：
  //   `加价项目 && (s += "<br>•" + 加价项目.replace(/\n/g, "<br>•"))`
  // 首行同样带前导 `<br>•` —— 计价方式为空（前面什么都没拼）时结果以 `<br>•` 开头，照抄。
  const add = markupLines(l).join('\n')
  if (add) s += '<br>•' + add.replace(/\n/g, '<br>•')
  return s
}

// 边封数 → 墙型文本（原版：0双丁墙/1单丁墙/3上丁墙/4上丁加单丁/5上丁加双丁）。
function wallTypeLabel(l: Line): string | null {
  // 原版门控是 `null != 边封数`：未填 → 不产生墙型（`Number(null)===0` 会误判成「双丁墙」）
  if (l.edge_seal_count == null) return null
  switch (Number(l.edge_seal_count)) {
    case 0: return '双丁墙'
    case 1: return '单丁墙'
    case 3: return '上丁墙'
    case 4: return '上丁加单丁'
    case 5: return '上丁加双丁'
    default: return null
  }
}

// 回执备注列（原版）：打折 + [平开: 轨道种类/五金/墙型 | 移门: 扇数:/轨道种类:/五金/单双丁] + 安装地址 + 前后包 + 备注。
function receiptRemark(l: Line): string {
  const items: (string | null)[] = []
  const discounted = (l.discount ?? 1) < 1
  if (discounted) items.push(`打折:${(100 * (l.discount ?? 1)).toString().replace(/0$/, '')}折`)
  if (l.line_type === 'diao') {
    const x = /哑口|垭口/.test(l.profile) || l.direction === '无' || (l.unit_price === 0 && (l.casing_price || 0) > 0)
    if (!x) items.push(`扇数:${l.profile.includes('+0') ? ' 口袋门' : l.fans || ''}`)
    // 原版只有「打折」分支对轨道种类做 `+0 → 口袋门` 替换，非打折分支不替换
    if (!x) items.push(`轨道种类:${discounted && l.profile.includes('+0') ? ' 口袋门' : l.track || ''}`)
    items.push(l.hardware || null)
    items.push(l.double_ding || null)
  } else {
    items.push(l.track || null)
    items.push(l.hardware || null)
    items.push(wallTypeLabel(l))
  }
  if (!order.install_address.trim()) items.push(l.install_address || null)
  if (l.line_type === 'ping') {
    // 原版 `前后包加长` 返回**数组**，作为列表单项被 String() 化 → 多项时以逗号相连
    const pack = [l.front_casing_add ? `前包加长${l.front_casing_add}` : '', l.back_casing_add ? `后包加长${l.back_casing_add}` : ''].filter(Boolean).join(' ')
    if (pack) items.push(pack)
  }
  items.push(l.remark || null)
  return items.filter(Boolean).join('<br>')
}

// 加价项目 → `加配：{名}-{名}`（原版：原始数据里 name 非数字的项，`-` 连接）。
// 原始数据可能是被 JSON 套了多层 string，最多剥 4 层。
function markupNames(l: Line): string {
  try {
    let v: unknown = l.markup
    for (let n = 0; typeof v === 'string' && n < 4; n++) v = JSON.parse(v)
    if (typeof v === 'string' || !v) return ''
    const arr = Array.isArray(v) ? v : [v]
    return arr
      .filter((e) => e && isNaN(Number((e as { name?: unknown }).name)))
      .map((e) => String((e as { name?: unknown }).name))
      .join('-')
  } catch {
    return ''
  }
}

// 原版 `_0xc8b731(行, 公式)`：把**公式级** `hardware` 作为 `配件:{值}` 追加到 remark 末尾
// （`\r\n`/`\r`/`\n` 一律先转 `<br>`；公式没有该字段则追加空串）。8 个 produce 构造器每个都调用它。
// 注意：这只用于打印的 remark，与「五金下拉候选不读 extra.hardware」是两回事。
function appendAccessory(remark: string, l: Line): string {
  const hw = (formulaOf(l)?.extra as { hardware?: unknown } | undefined)?.hardware
  if (typeof hw !== 'string' || hw === '') return remark
  const a = `配件:${hw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '<br>')}`
  return remark ? `${remark}<br>${a}` : a
}

// 生产单/玻璃合片 remark（原版 produces 行，两条引擎分别对应平开/吊趟）：
//   平开 `_0x551a25` = [轨道种类, 五金, 安装地址, 备注] + 加配(`<br>`) + 墙型(`<br>`)
//   吊趟 `_0x500ef9` = [五金, 单双丁(≠正常), 备注, 安装地址] + 加配(`<br>`)  —— **无墙型**
/**
 * 「品牌」段（原版 @497060 生产平开 / @517540 生产吊趟 / @536200·@55xxxx product2·product3）：
 * 门控链是「**客户编号非空且 ≠ 0** → 查客户资料 → `品牌` 非 `null`/`''`/`' '`」
 * （原版走在线接口 `getLatestClientsInfo`；我们用本地 `clients`，与 `applyClient` 同源），
 * 命中后 `备注 += " " + "品牌:" + 品牌` —— **空格**分隔，**不是** `<br>`，且**在 `appendAccessory`(配件) 之前**。
 *
 * ⚠️ 只有这 4 个 producer 有；**玻璃合片单**（`glassRemark`）与 **product1**（`_0x4495e3`/`_0x1239ce`）
 *    逐个确认过 `_0xc8b731` 前没有品牌块 ⇒ 那边不要加。
 */
function brandSegment(): string {
  const code = String(order.client_code ?? '')
  if (!code || code === '0') return ''
  const b = clients.value.find((c) => c.code === code)?.brand
  if (b == null || b === '' || b === ' ') return ''
  return `品牌:${b}`
}

function produceRemark(l: Line): string {
  const items = l.line_type === 'diao'
    ? [l.hardware || null, l.double_ding && l.double_ding !== '正常' ? l.double_ding : null, l.remark || null, l.install_address || null]
    : [l.track || null, l.hardware || null, l.install_address || null, l.remark || null]
  let s = items.filter(Boolean).join('<br>')
  const add = markupNames(l)
  if (add) s = s ? `${s}<br>加配：${add}` : `加配：${add}`
  if (l.line_type !== 'diao') {
    const wall = wallTypeLabel(l)
    if (wall) s = s ? `${s}<br>${wall}` : wall
  }
  const brand = brandSegment()
  if (brand) s = s ? `${s} ${brand}` : brand
  return appendAccessory(s, l)
}

// 玻璃合片单 remark（原版**引擎A** `_0xcfde65` 平开 / `_0x4d28ce` 吊趟）：
//   [五金, 单双丁(≠正常), 备注, 安装地址] + 加配(`<br>`) —— **既无轨道种类、也无墙型**。
//   注意：玻璃合片单的行由 `calculateGlass` 独占产生，与生产单（`calculateReceipt`→引擎B）**不是同一族**。
function glassRemark(l: Line): string {
  const ding = l.double_ding && l.double_ding !== '正常' ? l.double_ding : null
  let s = [l.hardware || null, ding, l.remark || null, l.install_address || null].filter(Boolean).join('<br>')
  const add = markupNames(l)
  if (add) s = s ? `${s}<br>加配：${add}` : `加配：${add}`
  return appendAccessory(s, l)
}

// product2/3（oldSheet 行）remark（原版 `_0x192067`/`_0x34f4ac`）：
//   [五金, 单双丁(≠正常), 备注].join("-") + 加配（**空格**追加）+ 墙型（**`-`**追加）
function oldSheetRemark(l: Line): string {
  const ding = l.double_ding && l.double_ding !== '正常' ? l.double_ding : null
  let s = [l.hardware || null, ding, l.remark || null].filter(Boolean).join('-')
  const add = markupNames(l)
  if (add) {
    const t = `加配：${add}`
    s = s ? `${s} ${t}` : t
  }
  const wall = wallTypeLabel(l)
  if (wall) s = s ? `${s}-${wall}` : wall
  // 品牌段（product2/3 有，见 `brandSegment`）；分隔是**空格**，位置在 配件 之前。
  const brand = brandSegment()
  if (brand) s = s ? `${s} ${brand}` : brand
  return appendAccessory(s, l)
}

// 原版：逐个订单行取「行安装地址」，为空则回填订单级安装地址；去重后以 **`_`** 连接（不是「、」）。
const installAddresses = computed(() => {
  const set = new Set<string>()
  for (const l of lines.value) {
    const a = l.install_address || order.install_address
    if (a) set.add(a)
  }
  return [...set].join('_')
})

// 原版 `address = 订单安装地址 ? E(行地址去重) : 客户地址`；客户地址取自客户资料。
const clientAddress = computed(() => clients.value.find((c) => c.code === order.client_code)?.address || '')
const orderInstallAddress = computed(() => (order.install_address ? installAddresses.value : clientAddress.value))

// —— 生产类单据的行顺序（原版各 produces 构造器统一，见 docs/2026-09-11-row-order-exhaustive.md）——
//   ① 平开块在前、吊趟块在后（`_0x4d19f5` 里 ping<i>/diao<i> 两段）
//   ② 块内按 `formulaid → 颜色` 排序（**玻璃合片单入口不排**，故用参数区分）
//   ③ 过滤：丢弃无公式/查不到公式的行；吊趟另丢弃无扇数的行
//   ④ 收尾：`smartdoor_sort_method === 'order'` 时把 ping+diao 合起来按单号数字前缀升序，
//      否则保持 ② 的顺序（原版按 `produce.timestamp` 升序，而 timestamp 就是 ② 迭代时写入的，等价）
const sortMethod = ref(localStorage.getItem('smartdoor_sort_method') || 'profile')
// 「排序方式」对话框（原版 `_0xff1972` 打开 / `_0x2a0b61` 保存）
const sortMethodOpen = ref(false)
const sortMethodDraft = ref(sortMethod.value)
function openSortMethod() {
  sortMethodDraft.value = sortMethod.value
  sortMethodOpen.value = true
}
function saveSortMethod() {
  sortMethod.value = sortMethodDraft.value === 'order' ? 'order' : 'profile'
  localStorage.setItem('smartdoor_sort_method', sortMethod.value)
  sortMethodOpen.value = false
  message.success('排序方式已保存')
}
// 原版按**每行自己的「单号」**的数字前缀排（`parseInt(OrderID.split('-')[0]) || 0`）。
// 行级单号（原版 `单号` 列，可逐行编辑）本次做减法时已删除，故退回**订单级**单号；
// 同一张订单内所有行取到同一个前缀，"序号优先" 等价于保持原序。
const orderPrefix = () => parseInt(String(order.receipt_no || '').split('-')[0] || '0', 10) || 0

function orderedLines(sortByFormula = true): Line[] {
  const keep = (l: Line) => {
    if (l.formula_id == null || !formulaOf(l)) return false
    if (l.line_type === 'diao' && !String(l.fans || '').trim()) return false
    return true
  }
  const block = (t: 'ping' | 'diao') => {
    const arr = lines.value.filter((l) => l.line_type === t && keep(l))
    if (!sortByFormula) return arr
    return arr.slice().sort((a, b) => {
      const fa = String(a.formula_id)
      const fb = String(b.formula_id)
      return fa !== fb ? fa.localeCompare(fb) : (a.color || '').localeCompare(b.color || '')
    })
  }
  const all = [...block('ping'), ...block('diao')]
  if (sortMethod.value !== 'order') return all
  // 「序号优先」：前缀退化为订单级单号（同单内恒定）→ 当前恒为原序，保留分支以维持设置项语义。
  const p = orderPrefix()
  return all.slice().sort(() => p - p)
}

// 回执行顺序（原版 @348915 / @353436）：**先全部平开行、再全部吊趟行**，各自**保持表格原序**
// （回执构造器里 `.sort(` 出现 0 次，不排序）；且**只在对应表「显示」时才纳入**
// （`if (showPingkai && pingTable)` / `if (showDiao && diaoTable)`）。
// 缺 `formulaid` 的行**不会被剔除** —— 原版是先用「型材→formulaId」表回填。
function receiptOrderedLines(): Line[] {
  return [
    ...(showPing.value ? lines.value.filter((l) => l.line_type === 'ping') : []),
    ...(showDiao.value ? lines.value.filter((l) => l.line_type === 'diao') : []),
  ]
}

// 回执模板（receipt / FinalReceipt / ReceiptList）的载荷：一份表头对象 + `receipt` 行数组。
// 原版回执族由**同一个载荷构造器**服务，但 **brand 后缀逐模板不同**（Home chunk 实证）：
//   `receipt`(客户回执单) 保持「回执单」；`FinalReceipt`(收据单) → 「收据单」；`ReceiptList`(出货清单) → 「订货清单」。
function receiptPrintData(brandSuffix = '回执单') {
  const rows = receiptOrderedLines().map((l) => ({
    profile: l.profile,
    profile2: [l.profile, l.color].filter(Boolean).join('<br>'),
    color: l.color, // 原版回执行字段 `color`（FinalReceipt / ReceiptList 模板有该列）
    maker: currentUserName.value || '',
    // 原版方向列：平开 = 套线种类+开向；移门 = 开向（无扇数前缀）
    direction: l.line_type === 'diao' ? displayDirection(l.direction) : `${l.casing || ''}${displayDirection(l.direction)}`,
    openImg: lineLockImage(l),
    doorImg: l.image_url || '',
    glass: glassSpecPrintable(l),
    size: dimSizeLabel(l),
    quantity: l.quantity,
    price: l.unit_price > 0 ? l.unit_price : '/', // 原版：无价 → "/"
    amount: Math.round(100 * (l.amount || 0)) / 100,
    pricing: pricingDetail(l),
    remark: receiptRemark(l),
    // 原版回执行字面量只有 {profile,profile2,direction,openImg,price,color,glass,size,
    // quantity,amount,pricing,remark,maker,doorImg} —— **没有 `date`/`payment`**。
  }))
  // 原版回执构造器（`receiptBuilder` 导出 `gs`）逐字：
  //   `let r=0,i=0; ping_hui.forEach(a=>{r+=Number(a["金额"]||0); i+=Number(a["数量"]||0)}); diao_hui.forEach(同)`
  //   `total:   Math.round(100*r)/100`        ← **两位小数**（不是整数）
  //   `balance: Math.round(100*(r-定金))/100` ← 先减定金**再**取整（我们原先先取整再减，有微差）
  //   `门数: i`（= Σ数量）、`deposit: a["定金"]||0`、`payQrcode: e`（**调用方入参**）
  const rawTotal = lines.value.reduce((s, l) => s + (l.amount || 0), 0)
  const total = round2(rawTotal)
  const deposit = order.deposit || 0
  return {
    // 原版：(品牌 || 门店名 || "客户") + 后缀（后缀逐模板不同，见函数注释）。
    // 首项是**品牌** `order.brand`，不是客户名。
    brand: `${order.brand || tenantName.value || '客户'}${brandSuffix}`,
    date: order.order_date || today(),
    orderNo: order.receipt_no || '',
    tel: order.phone || '',
    address: orderInstallAddress.value || '',
    productionDays: order.production_days || 0,
    client: order.client_name || '',
    deposit,
    total,
    balance: round2(rawTotal - deposit),
    // 原版 `TotalBalance` = 服务端「客户账户余额」（开关开启且有客户编号时拉 `finance_getCustomerBalance`），
    // **取不到时为 `""`** —— 不要用 `total-deposit` 冒充（那是 `balance` 的语义）。
    TotalBalance: '',
    declaration: LEGACY_DECLARATION,
    // 原版 `payQrcode: e`（构造器入参），由调用方 `await getImage('qrcode') || ""` 取；
    // 我们预取到 `payQrcodeUrl`（见 `loadPayQrcode`），取不到时为 `''`。
    payQrcode: payQrcodeUrl.value || '',
    orderQrcode: terminalLink.value || '',
    receipt: rows,
  }
}





// —— 标签打印（lable 模板）：每行按 labelQuantity 生成对应张数 ——
// 标签行（原版 lable 模板）：带前缀字面量。
function lableRow(l: Line) {
  const h = l.door_height || 0
  const w = l.door_width || 0
  // 原版：`尺寸:{门洞高}*{门洞宽}` 后追加（>0 才加）——
  // 平开 吊脚→墙厚→亮窗总高（456475）；移门 墙厚→吊脚→亮窗总高（458517），**顺序不同**
  let size = `尺寸:${h}*${w}`
  const dims = l.line_type === 'diao' ? [l.wall_thickness, l.jiao, l.light_window_height] : [l.jiao, l.wall_thickness, l.light_window_height]
  for (const v of dims) if (v > 0) size += `*${v}`
  const dir = l.direction || ''
  // 原版：平开 套线种类非空 → `开向:{套线种类}{开向}`，否则 `开向:{开向}`（456475）；
  //       移门 → `开向:{扇数}{开向}`，但型材含「哑口套/门套」时退回 `开向:{开向}`（458517）
  const lockway = l.line_type === 'diao'
    ? (/哑口套|门套/.test(l.profile || '') ? `开向:${dir}` : `开向:${l.fans || ''}${dir}`)
    : l.casing ? `开向:${l.casing}${dir}` : `开向:${dir}`
  return {
    orderID: order.receipt_no || '',
    qrcode: String(order.receipt_no || ''),
    client: order.client_name || '',
    door: `型材:${l.profile}`,
    size,
    lockway,
    color: `颜色:${l.color}`,
    glass: `玻璃:${l.bottom_glass || ''}-${l.face_glass || ''}`,
    address: `地址:${l.install_address || ''}`,
    remark: [l.hardware || null, l.remark ? `备注:${l.remark}` : null].filter(Boolean).join('<br>'),
    package: '',
  }
}

// 生产标签行（原版 product10 模板）：无前缀，玻璃为 单玻:/底:-面:。
function product10Row(l: Line) {
  const h = l.door_height || 0
  const w = l.door_width || 0
  // 原版 product10 有**两个构造器**（一门型一个），size 规则不同：
  //   平开 `_0x159bea`：`门洞高*门洞宽` + 吊脚>0 `*吊脚` + 墙厚>0 `*墙厚` + 亮窗总高>0 `*亮窗总高`
  //   吊趟 `_0x336291`：`门洞高*门洞宽` + 亮窗总高>0 `*亮窗总高`（**无吊脚、无墙厚**）
  let size = `${h}*${w}`
  if (l.line_type === 'ping') {
    if (l.jiao > 0) size += `*${l.jiao}`
    if (l.wall_thickness > 0) size += `*${l.wall_thickness}`
  }
  if (l.light_window_height > 0) size += `*${l.light_window_height}`
  const dir = l.direction || ''
  // 原版 remark = [备注].filter(Boolean).join("<br>") + 加配(`<br>`)，全无前缀
  let remark = l.remark || ''
  const add = markupNames(l)
  if (add) remark = remark ? `${remark}<br>加配：${add}` : `加配：${add}`
  // 原版 GlassSize（@386080）：部件值形如 `{result}*{quantity}`；
  //   **取第一个**含「玻璃高」的部件，配「**同前缀同后缀**」的「玻璃宽」部件：
  //   `GlassSize = 高.result + "*" + 宽.result + "*" + parseInt(宽.quantity || "1")`
  //   （原版先对 KEY 做拼音转写 `玻璃高→BoLiGao`、`玻璃宽→BoLiKuan`，再按前缀/后缀配对；
  //    转写是**逐字符**映射，故等价于直接对中文 KEY 做同前缀同后缀配对。）
  //   ❗不是「最后一个高 × 最后一个宽」—— 公式里若同时有 `玻璃高/宽` 与 `上亮窗玻璃高/宽`，
  //     `.pop()` 会取到**上亮**那一对，原版取的是声明在前的 `玻璃高`。
  // 部件集走 **L1/L2 专用映射**（自带数量修正 + ×行数量），不是引擎B 的原始结果。
  const parts = product10Parts(l).filter((p) => p && p.materialName)
  const glassSize = (() => {
    for (const p of parts) {
      const i = p.key.indexOf('玻璃高')
      if (i < 0) continue
      const w = parts.find((x) => x.key === `${p.key.slice(0, i)}玻璃宽${p.key.slice(i + 3)}`)
      if (!w) continue
      const n = parseInt(String(w.quantity), 10)
      return `${p.result}*${w.result}*${Number.isNaN(n) ? 1 : n}`
    }
    return ''
  })()
  return {
    orderID: order.receipt_no || '',
    client: order.client_name || '',
    size,
    lockway: l.casing ? `${l.casing}${dir}` : dir,
    color: l.color,
    glass: (l.bottom_glass || '') === '无' ? `单玻:${l.face_glass || ''}` : `底:${l.bottom_glass || ''}-面:${l.face_glass || ''}`,
    address: l.install_address || '',
    remark,
    GlassSize: glassSize,
    package: '',
  }
}

// 标签行集合：kind = 'lable'（标签）| 'product10'（生产标签），按 labelQuantity 复制 N 张。
// —— product10（生产标签）专用部件映射（引擎 L1/L2，原版 @399457）——
// 与其它 10 个引擎最大的结构差异：**结果映射自带数量修正，且最后 `× 行数量`**。
//   · 名含「边封」且 行.边封数 有值 → quantity = 行.边封数
//   · 行.轨道长 > 0 且 名含 滑 / 左右盖板 / 轨道盖板 → result = 行.轨道长
//   · 名含「玻璃」且不含「亮窗」：单玻且名不含「单玻」→ q/2；扇数=一固一活→1；扇数=双活→2
//   · 名含「玻璃」且含「亮窗」：单玻且名不含「单玻」→ q/2
//   · 最后一律 `q ×= 行.数量`
// L1 ∈ B平 族（§52.1），故平开取引擎 B 的部件集再过这层映射；L2 独立成族（9 块 51 条），暂近似。
function product10Parts(l: Line): PartPreview[] {
  const isDiao = l.line_type === 'diao'
  // 平开走 **L1**、移门走 **L2**（各自独立的 state 规则 + 结果映射，§13）
  const base = computeParts(l, isDiao ? 'L2' : 'L1')
  const Q = l.quantity || 1
  const single = (l.bottom_glass || '') === '无' || (l.face_glass || '') === '无'
  return base.map((p) => {
    // ⚠️ 谓词一律读 **KEY**（原版 L1 @384171 / L2 @399118：
    //   `Object.keys(部件).forEach(e => { e.includes("边封") … e.includes("滑")||e.includes("左右盖板")||e.includes("轨道盖板")
    //      e.includes("玻璃") && !e.includes("亮窗") … !e.includes("单玻") })`），
    //   且原版输出对象就是 `{ [KEY]: { materialName, result, quantity } }`（下游再对 KEY 做拼音转写）。
    const k = p.key
    let result = p.result
    let q = p.quantity
    if (k.includes('边封') && l.edge_seal_count != null) q = Number(l.edge_seal_count) || 0
    if (l.track_length > 0 && (k.includes('滑') || k.includes('左右盖板') || k.includes('轨道盖板'))) result = l.track_length
    if (k.includes('玻璃') && !k.includes('亮窗')) {
      if (single && !k.includes('单玻')) q /= 2
      if (l.fans === '一固一活') q = 1
      if (l.fans === '双活') q = 2
    }
    // L2 比 L1 多这一条（§13）：KEY 含「玻璃」且含「亮窗」的件同样折半
    if (isDiao && k.includes('玻璃') && k.includes('亮窗') && single && !k.includes('单玻')) q /= 2
    q *= Q
    return { ...p, result, quantity: q }
  })
}

// product10（生产标签）复制张数：公式部件同时含「玻璃宽」「玻璃高」时取玻璃宽部件的 quantity，否则 1。
function product10Copies(l: Line): number {
  const parts = product10Parts(l).filter((p) => p && p.materialName)
  // 原版 @387340：门控是「行对象**同时**含 `*玻璃宽` 与 `*玻璃高` 两种键」；
  //   张数 = **第一个**含「玻璃宽」的键的 `parseInt(quantity || "1")`（不是最后一个）。
  const gW = parts.find((p) => p.key.includes('玻璃宽'))
  const gH = parts.find((p) => p.key.includes('玻璃高'))
  if (!gW || !gH) return 1
  const n = parseInt(String(gW.quantity), 10)
  return Math.max(1, Number.isNaN(n) ? 1 : n)
}

// 原版 product10 **预览**用的分组限量（@402331）：
//   按 `orderID + "_" + GlassSize` 分组，每组只保留 `min(组内行数, glass含「单玻」?1:2)` 行。
//   注意：原版**打印**走的是**未分组**的那一份 —— 预览/打印本身不一致，此处按原样复刻。
function groupProduct10(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const k = `${r.orderID ?? ''}_${r.GlassSize ?? ''}`
    const arr = map.get(k)
    if (arr) arr.push(r)
    else map.set(k, [r])
  }
  const out: Record<string, unknown>[] = []
  for (const arr of map.values()) {
    const max = String(arr[0]?.glass ?? '').includes('单玻') ? 1 : 2
    out.push(...arr.slice(0, Math.min(arr.length, max)))
  }
  return out
}

function labelRows(kind: 'lable' | 'product10' = 'lable'): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const l of lines.value) {
    // 原版 product10（mode 10）的**复制张数**不走 lable 那套算法（`_0xff5572`）：
    // 仅当公式部件同时含「玻璃宽(BoLiKuan)」与「玻璃高(BoLiGao)」时，张数 = 玻璃宽部件的 **quantity**
    // （部件值格式 `{result}*{quantity}`，取 `split('*')[1]`），否则 1 张。
    const n = kind === 'product10' ? product10Copies(l) : labelQuantity({
      lineType: l.line_type as 'ping' | 'diao',
      fans: l.fans,
      quantity: l.quantity,
      lightWindowHeight: l.light_window_height,
      wallThickness: l.wall_thickness,
      casingPrice: l.casing_price,
      profile: l.profile,
      registrant: tenantName.value,
    })
    for (let i = 0; i < n; i++) {
      const row = kind === 'product10' ? product10Row(l) : lableRow(l)
      row.package = `${n}-${i + 1}` // 原版份号：`t-i`（t=总份数，i=第几张）
      rows.push(row)
    }
  }
  // 原版 lable（@369992）：收尾**无条件**按 `orderID` 的首个「数字-」段升序；
  //   无 orderID 或首段非数字 → `Infinity`（排到最后）。
  if (kind === 'lable') {
    const key = (r: Record<string, unknown>) => {
      const m = String(r.orderID ?? '').match(/^(\d+)-/)
      return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY
    }
    return rows.slice().sort((a, b) => key(a) - key(b))
  }
  return rows
}

async function printLabels() {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  const rows = labelRows('lable')
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

// 公式挖孔图缓存（原版 glassHole doorImg = 按行开向取公式图片）
const formulaImages = ref<Record<number, FormulaImageDto[]>>({})
async function loadFormulaImages(fid: number | null) {
  if (fid == null || formulaImages.value[fid]) return
  try {
    formulaImages.value[fid] = await api.listFormulaImages(fid)
  } catch {
    formulaImages.value[fid] = []
  }
}
/**
 * 平开「挖孔图」取图键（原版 @418159 `_0x26a75e` 的键构造，逐字对照）：
 * ```
 * 开向.includes('双开') ? (开向.includes('左') ? '双开左'
 *                       : 开向.includes('右') ? '双开右'
 *                       :                       '双开左')
 *                      : 开向
 * ```
 * ⚠️ **双开族的图键不是开向本身** —— 画图端（Glass_draw 锁向下拉）只提供 `双开左`/`双开右`，
 * 而汇算行开向是 `双开内开`/`双开外开`/`双开内左`/`双开外左`/`双开内右`/`双开外右`。
 * 不做这层映射 ⇒ 双开门**六种开向全部取不到图**（内开/外开都白）。
 * 原版还会在 `轨道种类` 非空时追加 `_{轨道种类}`；新系统公式图按 (formula_id, direction) 存、
 * 无轨道种类维度，故不追加。
 */
function holeKeyOf(direction: string): string {
  if (!direction) return ''
  if (!direction.includes('双开')) return direction
  return direction.includes('右') ? '双开右' : '双开左'
}

/**
 * 按**图键**取公式挖孔图（键 = `holeKeyOf(开向)` / `左`.`右` / `左固玻`.`右固玻`）。
 *
 * 只按 `direction` 精确取，**找不到就是空、绝不换方向**。
 * `mirrored` 在这里不参与 —— 哪个方向配哪张图是画图时定的（见 `GlassDraw` 的键规则），
 * 取图端不该再替它做判断。
 *
 * 注：同一 direction 理论上可能有多条（把互为左右的两个锁向都画过时，各自都会给对方
 * 写一条 `mirrored=true` 的），此时取 id 靠前的那条。实际数据里每个方向基本只有 1 条。
 */
function holeImageByKey(l: Line, key: string): string {
  if (!key) return ''
  const imgs = l.formula_id != null ? formulaImages.value[l.formula_id] : undefined
  if (!imgs) return ''
  return imgs.find((i) => i.direction === key)?.data_url || ''
}

/**
 * 平开行的挖孔图（原版 `_0x3a3de5`）—— **只按 `holeKeyOf(开向)` 精确取，没有内/外兜底**。
 *
 * ⚠️ 曾一度加过「内开取不到就退到外开、反之亦然」的兜底，**已撤销**：直接在旧版服务端
 * （`param1=getimage&param2={formulaID}{方向}`）实测，**没有内↔外归一** ——
 * 公式 `复古平开门` 有 `左锁内开`（200）但没有 `左锁外开`（404）。
 * 而 `35*16平开` 的 左锁内开/左锁外开 返回**字节完全相同**的图（sha 一致），
 * 即店家两个方向**各存了一张内容相同的图** —— 看起来「内开外开一样」，是数据如此，不是取图兜底。
 * ⇒ 该公式没画过某方向时，原版就是空图 + 报 `获取开孔图片失败,请确认或联系管理员`，我们必须一致。
 */
function holeImageOf(l: Line): string {
  return holeImageByKey(l, holeKeyOf(l.direction))
}

/** 按固定方向键取挖孔图（原版吊趟把图存在 `{formulaID}左` / `{formulaID}右` 下）。 */
function holeImgByDir(l: Line, dir: '左' | '右'): string {
  return holeImageByKey(l, dir)
}

/**
 * 打印/预览「玻璃订单」前，确保**各行公式的挖孔图都已加载**。
 *
 * ⚠️ `loadFormulaImages` 原先**只在「算料」里调用一次**（`calcSingleRow`），而 `holeImageOf` /
 * `holeImgByDir` 是同步查缓存的 ⇒ **载入一张已保存的订单后直接打印玻璃订单，挖孔图整列为空**
 * （必须先在页面上点一次「算料」才会出现）。这里在打印/预览入口补一次兜底加载
 * （`loadFormulaImages` 自带缓存，重复调用是 no-op）。
 */
async function ensureFormulaImages() {
  const ids = [...new Set(lines.value.map((l) => l.formula_id).filter((v): v is number => v != null))]
  await Promise.all(ids.map((id) => loadFormulaImages(id)))
}

function glassProduces(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  // 玻璃合片单：ping→diao 分块但**入口不按 formulaid 排序**
  for (const l of orderedLines(false)) {
    const base = {
      client: order.client_name || '',
      // 引擎A：`door` = 型材+颜色（**不含客户**，与生产单引擎B不同）
      door: [l.profile, l.color].filter(Boolean).join('<br>'),
      OrderID: order.receipt_no || '',
      basicInfo: basicInfoText(l, 'A'), // 引擎A：双无玻文案 = 「无」
      lockImg: lineLockImage(l),
      doorImg: l.image_url || '',
      remark: glassRemark(l),
    }
    const parts = computeParts(l, 'A').filter((p) => p && p.materialName) // 引擎A
    const ft = String(formulaOf(l)?.formula_type || '')
    const bRaw = l.bottom_glass || ''
    const fRaw = l.face_glass || ''
    const Q = l.quantity || 1
    // 原版（引擎A `_0xcfde65`/`_0x4d28ce`）：每组拼 `{名}:{result}`，组末补一个 `<br>数量:N`，
    // 其中 **N 取「该组最后一个命中件的 quantity」**（不是求和）：
    //   `(底玻!=='无' || 面玻==='无' || 名含单玻) && (面玻!=='无' || 底玻==='无' || 名含单玻)`
    //     → 双玻 N = qty×数量；否则 单玻 N = qty/2×数量
    //   平开另有 parentSubsidiary → 双玻 4×数量 / 单玻 2×数量；diamond → 一律 3×数量
    //   移门另有一组「亮窗玻璃」（排除压线），其 N 的判据是 `底玻≠无 && 面玻≠无 || 名含单玻`
    // ⚠️ 与其它列同规：**匹配读 KEY（`pk`），显示名读 `materialName`**。
    //    旧版引擎 A 这几处也都是 `Object.entries(parts).filter((([e]) => e.includes("玻璃") && !e.includes("亮窗")))`
    //    这类写法（`e` = KEY），`含单玻` 判定同理。
    const doubleGlass = (name: string) =>
      ((bRaw !== '无' || fRaw === '无' || name.includes('单玻')) && (fRaw !== '无' || bRaw === '无' || name.includes('单玻')))
    const groupText = (list: PartPreview[], lastQty: (p: PartPreview) => number) => {
      if (!list.length) return ''
      const last = list[list.length - 1]
      let n = lastQty(last)
      return `${list.map((p) => `${p.materialName}:${p.result}`).join('<br>')}<br>数量:${n}`
    }
    let doorsheet: string
    if (l.line_type === 'diao') {
      const g1 = parts.filter((p) => pk(p).includes('玻璃') && !pk(p).includes('亮窗'))
      const g2 = parts.filter((p) => pk(p).includes('亮窗玻璃') && !pk(p).includes('压线'))
      let n1 = g1.length ? (doubleGlass(pk(g1[g1.length - 1])) ? g1[g1.length - 1].quantity * Q : (g1[g1.length - 1].quantity / 2) * Q) : 0
      const n2 = g2.length ? (bRaw !== '无' && fRaw !== '无' || pk(g2[g2.length - 1]).includes('单玻') ? g2[g2.length - 1].quantity * Q : (g2[g2.length - 1].quantity / 2) * Q) : 0
      if (l.fans === '一固一活' || l.fans === '双活') n1 = 2 * Q
      const t1 = g1.map((p) => `${p.materialName}:${p.result}`).join('<br>')
      if (n2 > 0) {
        const nn = n2 < 1 ? 1 : n2
        doorsheet = `${t1}<br>数量:${n1}<br>${g2.map((p) => `${p.materialName}:${p.result}`).join('<br>')}<br>数量:${nn}`
      } else {
        doorsheet = `${t1}<br>数量:${n1}`
      }
    } else {
      // 原版 A平（`_0xcfde65`）：`_0x413ea2 = ["玻璃","门扇"]` 后用 `reduce((acc,kw)=>[...acc, ...命中的件])`
      // **按关键词数组逐个分组累积** —— 玻璃全在前、门扇全在后。一次 filter 保 parts 原序在两族交错时顺序会不同。
      const g = ['玻璃', '门扇'].flatMap((kw) => parts.filter((p) => pk(p).includes(kw)))
      doorsheet = groupText(g, (p) => {
        let n = doubleGlass(pk(p)) ? p.quantity * Q : (p.quantity / 2) * Q
        if (ft === 'parentSubsidiary') n = doubleGlass(pk(p)) ? 4 * Q : 2 * Q
        if (ft === 'diamond') n = 3 * Q
        return n
      })
    }
    rows.push({ ...base, doorsheet })
  }
  return rows
}


function glassInfoProduces(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const l of lines.value) {
    const parts = (l.parts ?? []).filter((p) => p && p.materialName)
    const find = (re: RegExp) => parts.find((p) => re.test(pk(p)))
    const ft = String(formulaOf(l)?.formula_type || '') // 'diamond' | 'parentSubsidiary' | 'double' | 其它
    const diao = l.line_type === 'diao'
    const bRaw = l.bottom_glass || ''
    const fRaw = l.face_glass || ''
    const Q = l.quantity || 1
    const img = holeImageOf(l) // 原版 `_0x3a3de5`：按 开向(+轨道种类) 取的挖孔图
    // 原版：吊趟循环 `if (底玻==='无' && 面玻==='无') continue`；**平开循环没有这句**
    if (diao && bRaw === '无' && fRaw === '无') continue
    const base = {
      OrderID: order.receipt_no || '',
      client: order.client_name || '',
      date: today(),
      thickness: l.glass_thickness || '',
      // 原版 @411200 `_0xa370fc`：这三家门店 remark 整列为空
      remark: STORE_NO_GLASS_REMARK.includes(tenantName.value) ? '' : [l.remark, l.install_address].filter(Boolean).join('<br>'),
    }
    const push = (o: Record<string, unknown>) => rows.push({ ...base, doorImg: '', ...o })
    // 原始判据是**部件名含「单玻」**，不是底玻/面玻的值
    const isSingle = (p: PartPreview) => pk(p).includes('单玻')
    const qv = (p: PartPreview, div = 1) =>
      (isSingle(p) ? (p.quantity / div) * Q : (p.quantity / 2 / div) * Q)

    if (diao) {
      const fans = l.fans || ''
      const dir = l.direction || ''
      const leftImg = holeImgByDir(l, '左')
      const rightImg = holeImgByDir(l, '右')
      // 原版：`扇数==='一固一活' && 开向不含该侧` 时该侧图不取（置空）
      const okL = !(fans === '一固一活' && !dir.includes('左')) && !!leftImg
      const okR = !(fans === '一固一活' && !dir.includes('右')) && !!rightImg
      const has = (list: string[]) => list.some((k) => fans.includes(k))
      // ⚠️ 原版左右两张扇数名单**不同**，且 D1 与 D2 的名单**恰好相反**（各有「6轨6扇」的一侧）
      const ONE_L_D1 = ['单轨2扇', '双活', '2轨2扇', '2轨3扇', '3轨3扇', '4轨4扇', '5轨5扇', '6轨6扇', '3轨4扇']
      const ONE_R_D1 = ['单轨2扇', '双活', '2轨2扇', '2轨3扇', '3轨3扇', '4轨4扇', '5轨5扇', '3轨4扇']
      const ONE_L_D2 = ['单轨2扇', '双活', '2轨2扇', '2轨3扇', '3轨3扇', '4轨4扇', '5轨5扇', '3轨4扇']
      const ONE_R_D2 = ['单轨2扇', '双活', '2轨2扇', '2轨3扇', '3轨3扇', '4轨4扇', '5轨5扇', '6轨6扇', '3轨4扇']
      const qv2 = (p: PartPreview, dl: number, dr: number) => qv(p) - dl - dr

      // ── D1：底玻支（扇数为一固一活/双活时整块跳过） ──
      if (bRaw !== '无' && fans !== '一固一活' && fans !== '双活') {
        const gW = parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗') && !pk(p).includes('玻璃宽小'))
        const gS = parts.find((p) => pk(p).includes('玻璃宽小') && !pk(p).includes('亮窗'))
        const gH = parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗'))
        const h = gH ? gH.result : 0
        let dl = 0
        let dr = 0
        if (okL && dir.includes('左')) dl = 1
        if (okL && has(ONE_L_D1)) dl = 1
        if (okL && fans.includes('2轨4扇')) dl = 2
        if (okL && fans.includes('3轨6扇')) dl = 2
        if (okR && dir.includes('右')) dr = 1
        if (okR && has(ONE_R_D1)) dr = 1
        if (okR && fans.includes('2轨4扇')) dr = 2
        if (okL && fans.includes('3轨6扇')) dr = 2 // 原文此处用的是**左图**变量
        // 主行（玻璃宽 / 玻璃宽小）：原版**不设 doorImg**，保持字面量的空串
        const mainRow = (p: PartPreview | undefined) => {
          if (!p) return
          const o = qv2(p, dl, dr)
          if (o > 0) push({ glassName: `底玻-${l.bottom_glass}`, width: p.result, height: h, quantity: o })
        }
        mainRow(gW)
        mainRow(gS)
        if (dl > 0) push({ glassName: `底玻-${l.bottom_glass}`, width: gW ? gW.result : 0, height: h, quantity: dl, doorImg: leftImg })
        if (dr > 0) push({ glassName: `底玻-${l.bottom_glass}`, width: gW ? gW.result : 0, height: h, quantity: dr, doorImg: rightImg })
      }

      // ── D2：面玻支（无扇数门控；一固一活另有「固玻-」行） ──
      if (fRaw !== '无') {
        const fW = parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗') && !pk(p).includes('固') && !pk(p).includes('玻璃宽小'))
        const fS = parts.find((p) => pk(p).includes('玻璃宽小') && !pk(p).includes('亮窗') && !pk(p).includes('固'))
        const fH = parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗') && !pk(p).includes('固'))
        const h = fH ? fH.result : 0
        let dl = 0
        let dr = 0
        if (okL && dir.includes('左')) dl = 1
        if (okL && has(ONE_L_D2)) dl = 1
        if (okL && fans.includes('2轨4扇')) dl = 2
        if (okL && fans.includes('3轨6扇')) dl = 2
        if (okR && dir.includes('右')) dr = 1
        if (okR && has(ONE_R_D2)) dr = 1
        if (okR && fans.includes('2轨4扇')) dr = 2
        if (okL && fans.includes('3轨6扇')) dr = 2
        // 一固一活专用部件（仅在 扇数==='一固一活' 时参与）
        const igW = fans === '一固一活' ? parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗') && pk(p).includes('一固一活固玻璃宽')) : undefined
        const igH = fans === '一固一活' ? parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗') && pk(p).includes('一固一活固玻璃高')) : undefined
        const imW = fans === '一固一活' ? parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗') && pk(p).includes('一固一活门玻璃宽')) : undefined
        const imH = fans === '一固一活' ? parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗') && pk(p).includes('一固一活门玻璃高')) : undefined
        let mainQ = fW ? qv2(fW, dl, dr) : 0
        // 一固一活：主行作废，扣减改为按开向取 1，且另推一行「固玻-」
        let guRow = false
        if (fans === '一固一活') {
          if (dir.includes('左')) {
            mainQ = 0
            dl = 1
            dr = 0
            guRow = true
          }
          if (dir.includes('右')) {
            mainQ = 0
            dl = 0
            dr = 1
            guRow = true
          }
        }
        if (mainQ > 0 && fW) push({ glassName: `面玻-${l.face_glass}`, width: fW.result, height: h, quantity: mainQ })
        if (fS) {
          const u = qv2(fS, dl, dr)
          if (u > 0) push({ glassName: `面玻-${l.face_glass}`, width: fS.result, height: h, quantity: u })
        }
        if (guRow) {
          // 原版是四个独立 if：`if (n===0 && 部件)` / `if (d===0 && 部件)` 各设一次
          // （一固一活时 dl/dr 必有一个为 0，故等价于「部件存在即取」）
          const useGu = dl === 0 || dr === 0
          push({
            glassName: `固玻-${l.face_glass}`,
            width: useGu && igW ? igW.result : 0,
            height: useGu && igH ? igH.result : 0,
            quantity: useGu && igW ? 1 : 0,
          })
        }
        const dedRow = (n: number, img: string) => {
          if (n <= 0) return
          push({
            glassName: fans.includes('一固一活') ? `门玻-${l.face_glass}` : `面玻-${l.face_glass}`,
            width: imW ? imW.result : fW ? fW.result : 0,
            height: imH ? imH.result : h,
            quantity: imW ? 1 : n,
            doorImg: img,
          })
        }
        dedRow(dl, leftImg)
        dedRow(dr, rightImg)
      }

      // ── D3 亮窗：两个独立 if，可各推一行 ──
      if (l.light_window_height) {
        const lwW = parts.find((p) => pk(p).includes('亮窗玻璃宽'))
        const lwH = parts.find((p) => pk(p).includes('亮窗玻璃高'))
        if (lwW && lwH && bRaw !== '无' && !fans.includes('活')) {
          push({ glassName: `亮窗底玻-${l.bottom_glass}`, width: lwW.result, height: lwH.result, quantity: (lwW.quantity / 2) * Q })
        }
        if (lwW && lwH && fRaw !== '无') {
          const q = (lwW.quantity / 2) * Q
          // 原文 token 557 = '亮窗面璃-'（错字照抄）；扇数含「活」时才是 '亮窗玻璃-'
          push({ glassName: fans.includes('活') ? `亮窗玻璃-${l.face_glass}` : `亮窗面璃-${l.face_glass}`, width: lwW.result, height: lwH.result, quantity: q < 1 ? 1 : q })
        }
      }
      continue
    }

    // —— 平开：B1 与 B2 是两个**互不排斥**的顶层 if，双玻时各推一行 ——
    // 原版 B1/B2 各自是 `if (该面 !== '无' && ft !== 'diamond') {…} else {…}` ——
    // **两条路径都恰好推 1 行**（B1.d/B2.d 是**外层 else**，已读原文 `}else{…push(e)}` 确认）。
    // ⇒ 普通/单玻/双玻 都 2 行；diamond 行 = B1.d + B2.d + B4×3 = **5 行**。
    const block = (which: 'bottom' | 'face') => {
      const on = which === 'bottom' ? bRaw !== '无' : fRaw !== '无'
      // 原版此处只排除「亮窗」，**不排除「玻璃宽小」**
      const gW = parts.find((p) => pk(p).includes('玻璃宽') && !pk(p).includes('亮窗'))
      const gH = parts.find((p) => pk(p).includes('玻璃高') && !pk(p).includes('亮窗'))
      const fallbackName = which === 'bottom' ? `底玻-${l.bottom_glass}` : `面玻-${l.face_glass}`
      if (on && ft !== 'diamond') {
        if (ft === 'parentSubsidiary') {
          const w = find(which === 'bottom' ? /子门玻璃宽/ : /母门玻璃宽/)
          const hh = find(which === 'bottom' ? /子门玻璃高/ : /母门玻璃高/)
          push({
            glassName: fallbackName,
            width: w ? w.result : 0,
            height: hh ? hh.result : 0,
            quantity: w ? qv(w) : 0,
            doorImg: which === 'face' ? img : '',
          })
          return
        }
        const div = ft === 'double' && img ? 2 : 1
        // 原版 B2.c（double 且无图）的 glassName 仍是 `底玻-`（原文如此，照抄）
        const name = which === 'bottom' ? `底玻-${l.bottom_glass}`
          : ft === 'double' && !img ? `底玻-${l.bottom_glass}` : `面玻-${l.face_glass}`
        push({
          glassName: name,
          width: gW ? gW.result : 0,
          height: gH ? gH.result : 0,
          quantity: gW ? qv(gW, div) : 0,
          doorImg: which === 'bottom' ? img : ft === 'double' && !img ? '' : img,
        })
        return
      }
      // B1.d / B2.d：外层 else，仍推 1 行
      push({
        glassName: fallbackName,
        width: gW ? gW.result : 0,
        height: gH ? gH.result : 0,
        quantity: gW ? qv(gW) : 0,
        doorImg: img,
      })
    }
    block('bottom')
    block('face')
    // B3 亮窗（单块，`ft !== 'diamond'` 且至少一面非「无」）
    if (l.light_window_height && ft !== 'diamond' && (fRaw !== '无' || bRaw !== '无')) {
      const lwW = find(/亮窗玻璃宽/)
      const lwH = find(/亮窗玻璃高/)
      push({
        glassName: bRaw !== '无' ? `亮窗玻璃-${l.bottom_glass}` : `亮窗玻璃-${l.face_glass}`,
        width: lwW ? lwW.result : 0,
        height: lwH ? lwH.result : 0,
        quantity: lwW ? lwW.quantity * Q : 0,
      })
    }
    // B4 钻石：三行，部件按**精确名**取
    if (ft === 'diamond') {
      const exact = (n: string) => parts.find((p) => pk(p) === n)
      // 图：左固玻璃 = `{formulaID}左固玻` 图（原版 `_0x5692f6`）、右固玻璃 = `{formulaID}右固玻`
      // （原版 `_0x286ba9`）、门玻璃 = 行挖孔图（原版 `_0x3a3de5`）。**不是三行都用行挖孔图**
      // —— `左固玻`/`右固玻` 正是画图端锁向下拉里的两个键。
      for (const [kw, kh, name, dimg] of [
        ['左固玻璃宽', '左固玻璃高', `左固玻璃-${l.bottom_glass}`, holeImageByKey(l, '左固玻')],
        ['右固玻璃宽', '右固玻璃高', `右固玻璃-${l.bottom_glass}`, holeImageByKey(l, '右固玻')],
        ['门玻璃宽', '门玻璃高', `门玻璃-${l.face_glass}`, img],
      ] as [string, string, string, string][]) {
        const w = exact(kw)
        const hh = exact(kh)
        push({ glassName: name, width: w ? w.result : 0, height: hh ? hh.result : 0, quantity: Q, doorImg: dimg })
      }
    }
  }
  // 原版 @453705：厚度为 0 的行剔除；随后 `order` 模式按单号数字前缀升序
  const kept = rows.filter((r) => Number(r.thickness) !== 0)
  if (sortMethod.value === 'order') {
    kept.sort(
      (a, b) =>
        (parseInt(String(a.OrderID ?? '').split('-')[0], 10) || 0) -
        (parseInt(String(b.OrderID ?? '').split('-')[0], 10) || 0),
    )
  }
  return kept
}

// —— doorsheet 列（原版四个引擎共用同一套结构，只差关键词/排除词/修正项）——
// 按**关键词数组顺序**收集：`name.includes(kw) && !name.includes(排除词)`；
// 「玻璃宽/玻璃高」且单玻（底玻或面玻为「无」）且名字不含「单玻」→ 数量 `round(q/2)`（钻石型不折半）；
// 吊趟引擎另加 `一固一活→1`、`双活→2`；
// 文本 = `{部件名}:{result}*{数量×行数量}`，**「玻璃高」项前额外加一个 `<br>`**（原版如此，会多一个空行）。
// —— 原版门店白名单（`legacy/js/Hui-d088417c.js` @316101 `_0x743794`，44 家）——
// 命中时 `door` 列**不含客户名**（只 `[型材,颜色]`）；未命中（含本租户「昊艺门窗」）才拼客户名。
const STORE_DOOR_NO_CLIENT = [
  '万鑫门业', '德清顾家', '锦致轩门业', '欧盾门业', '吉雅轩门厂', '极简移门', '恒业门窗', '南海移门',
  '金雅轩门窗', '度勒门窗', '鑫豪轩门业', '广乐名门', '鑫瑞门业', '圣诺派门业', '帝奥名门', '美高移门',
  '鑫源移门加工厂', '鑫源名门', '皇丞门窗', '宏泰门业', '天润门业', '铂卫邦铝门', '欧莱富移门', '顾轩门窗',
  '润佳门窗', '宜居门窗厂', '欧铂尊门业', '鑫美龙家居', '皓雅门窗', '富嘉名门', '珊珊极简移门', '華宇推拉',
  '立泰金属制品有限公司', '皇牌博雅铝门窗厂', '爱德益钛镁合金厂', '宏辉门窗', '华顺门业', '喜迎门移门',
  '天成门业', '煜宸门业', '粤诗丽门窗', '浩扬移门', '嘉和门业', '美固建材经营部',
]
/**
 * 原版在 `_0x743794` **之外**硬编码的单家门店（§20.3 / 引擎普查 C12）。
 *
 * ⚠️ **只参与 `door` 列判断，不参与 `doorImg` 门控** —— 原版两处用的不是同一份名单：
 *   `door`    @515211 / @495…：`_0x743794.includes(店) || "鸿程鑫派门窗" === 店`
 *   `doorImg` @494870（平开）/ @515705（吊趟）/ @585217（C吊）：
 *             `!_0x743794.includes(店) && 行["图片ID"]` → **只有那 44 家**会被跳过取图
 */
const STORE_DOOR_NO_CLIENT_EXTRA = '鸿程鑫派门窗'
/** `door` 列（客户/门类）的白名单判断。 */
const isDoorNoClientStore = (name: string) =>
  STORE_DOOR_NO_CLIENT.includes(name) || name === STORE_DOOR_NO_CLIENT_EXTRA
/** 原版 product1 特判门店（@570279）：`kouHeigth` 改用「套线种类」、`kouWidth` 不再赋值。 */
const STORE_SHENGFEI = '晟斐门窗厂'
/** 原版 product1（@569290 `_0x1389a5`）逐字关键词清单 —— 部件遍历按它逐个分组命中。 */
const PRODUCT1_KW = [
  '门框高', '门框宽', '玻璃', '前框高', '后框高', '前框宽', '后框宽', '封板',
  '扣板高', '扣板宽', '扣板厚', '光企高', '上下方', '玻璃高', '玻璃宽',
]
/** 原版回执 glass 列特判门店（@351196）：不加 `*{玻璃厚}mm` 后缀。 */
const STORE_GLASS_NO_MM = ['家家发门业', '星之铝门窗']
/** 原版 glassHole 特判门店（@411200 `_0xa370fc`）：`remark` 整列为空。 */
const STORE_NO_GLASS_REMARK = ['皇帥滑动门', '尚航逸门窗', '嘉博门业']
/** 原版门店特判：该门店的部件文本用 `{名}:<br>{result}` 而非 `{名}:{result}`（只出现在引擎B 两套）。 */
const STORE_SHANSHAN = '杉杉铝木极简门'
const isShanshanStore = () => tenantName.value === STORE_SHANSHAN
/** 部件文本 `{名}{分隔}{result}*{数量}`；杉杉门店的分隔是 `:<br>`。 */
const partLine = (name: string, rest: string) => `${name}${isShanshanStore() ? ':<br>' : ':'}${rest}`

const DS_KW = {
  ping: ['光企', '方', '封板高', '封板宽', '龙骨横', '龙骨竖', '门扇高', '门扇宽', '收口', '封边横', '封边竖', '玻璃高', '玻璃宽'],
  pingOld: ['光企', '方', '龙骨横', '龙骨竖', '门扇高', '门扇宽', '收口', '封边横', '封边竖', '玻璃高', '玻璃宽'],
  diao: ['光企', '勾企', '合页', '锁', '收口', '方', '封板高', '封板宽', '纱网', '玻璃高', '玻璃宽'],
  diaoOld: ['光企', '勾企', '合页', '锁', '收口', '方', '纱网', '玻璃高', '玻璃宽'],
  diamond: ['左固玻璃', '右固玻璃', '门玻璃'],
}

// —— doorframe 列（原版四引擎，规则见 docs/2026-09-10-template-field-audit.md §16）——
// 平开：引擎B = 门框高组→门框宽组→前框组→后框组→门板组；oldSheet(D) = 门框(不分高宽)→前框→后框→门板；
//       钻石型两侧都改为固定 4 键「左边/右边/斜长/竖框」按 hasOwnProperty 精确取。
// 吊趟（两套同构）：轨道组（边封数覆盖数量、轨道长覆盖滑/盖板的结果）→「套线名：{套线种类}」→套线组（包宽/包高）。
function doorframeText(l: Line, engine: EngineId): string {
  const oldSheetEngine = engine === 'D'
  const cEngine = engine === 'C'
  // 品牌分隔符 `:<br>` 在旧版是**逐分支硬编码**的，不是全局开关：
  //   B平/B吊 的**每一个**分支都判品牌；**D平/D吊/C吊 一个都不判**（恒 `:`）。
  //   我们原先按「非 D 引擎」一律 `partLine()` ⇒ B吊 的下轨/上滑/上轨/套线少 `<br>`、D 系多 `<br>`。
  const brand = engine === 'B'
  const parts = computeParts(l, engine).filter((p) => p && p.materialName)
  const Q = l.quantity || 1
  const fmt = (p: PartPreview, result?: number) => {
    const rest = `${result ?? p.result}*${p.quantity * Q}`
    return brand ? partLine(p.materialName, rest) : `${p.materialName}:${rest}`
  }

  if (l.line_type === 'diao') {
    const track = (l.track || '')
    // ⚠️ 筛选一律读部件 **KEY**，显示名才用 `materialName`（原版 B吊 @509947 / D吊 @548564 / C吊 @581434：
    //    `Object.entries(parts).filter((([e]) => ["边封","下轨","上轨","滑","固定","移动","上横","盖板"].some(t => e.includes(t))))`，
    //    分支判定同样是 `e.includes("滑")` / `e.includes("下滑")` / `e.includes("上滑")` …）。
    //    **唯一按 materialName 的是「多轨道时挑哪根下滑」**（原版 `t.materialName?.includes(行.轨道种类)`）。
    const src = parts
      .filter((p) => ['边封', '下轨', '上轨', '滑', '固定', '移动', '上横', '盖板'].some((k) => p.key.includes(k)))
      .filter((p) => !p.key.includes('企'))
      // 边封闸门照抄原版 `0 !== 行["边封数"]`：**宽松不等**，故 `null`/`''` 时**保留**边封
      //（我们原先 `Number(...) !== 0` 会把 `null` 也判成 0 而**整条边封消失**）。
      .filter(
        (p) =>
          (!p.key.includes('边封') || (l.edge_seal_count as unknown) !== 0) &&
          !(track.includes('吊轨') && p.key.includes('下滑')),
      )
    // C吊（@581383）**没有** multi 判定，也**没有**左右盖板/轨道盖板两条轨道长覆盖 —— 只有 `边封` + `滑`。
    const multi = !cEngine && src.filter((p) => p.key.includes('下滑')).length > 1
    const trackGrp = (multi ? src.filter((p) => !p.key.includes('下滑') || p.materialName.includes(track)) : src).map((p) => {
      const k = p.key
      const n = p.materialName
      let result = p.result
      let qty = p.quantity
      if (k.includes('边封') && l.edge_seal_count != null) qty = Number(l.edge_seal_count)
      if (k.includes('滑') && l.track_length > 0) result = l.track_length
      if (!cEngine && (k.includes('左右盖板') || k.includes('轨道盖板')) && l.track_length > 0) result = l.track_length
      const rest = `${result}*${qty * Q}`
      if (k.includes('下滑')) return brand ? partLine(multi && n.includes(track) ? n : `${track}${n}`, rest) : `${multi && n.includes(track) ? n : `${track}${n}`}:${rest}`
      if (k.includes('下轨')) return `${track}${n}:${rest}`
      if ((k.includes('上滑') || k.includes('上轨')) && track.includes('吊轨')) {
        const kw = k.includes('上滑') ? '上滑' : '上轨'
        return `${n.includes(kw) ? n.replace(kw, track) : `${track}-${n}`}:${rest}`
      }
      return brand ? partLine(n, rest) : `${n}:${rest}`
    })
    // 套线组：**按部件 key 匹配**（原版 `Object.entries(parts).filter(([e])=>e.includes("包宽")||e.includes("包高"))`
    // @512145），显示名取 `materialName`。二者不同名 —— 如公式 7 的 key
    // `无亮窗双包宽` 其 materialName 是 `套线宽`，按 materialName 匹配会整个漏掉。
    const casing = parts
      .filter((p) => p.key.includes('包宽') || p.key.includes('包高'))
      .flatMap((p) => {
        const n = p.materialName
        const c = (rest: string) => (brand ? `${n}:<br>${rest}` : `${n}:${rest}`)
        if (p.key.includes('包高') && ((l.front_casing_add || 0) > 0 || (l.back_casing_add || 0) > 0)) {
          const q = (p.quantity * Q) / 2
          return [c(`${p.result + (l.front_casing_add || 0)}*${q}`), c(`${p.result + (l.back_casing_add || 0)}*${q}`)]
        }
        return [c(`${p.result}*${p.quantity * Q}`)]
      })
    return casing.length > 0
      ? `${trackGrp.join('<br>')}<br>套线名：${l.casing || ''}<br>${casing.join('<br>')}`
      : trackGrp.join('<br>')
  }

  let base: string[]
  // ⚠️ 与吊趟同规：**筛选读 KEY，显示名读 materialName**。原版 B平 @490500-491700 / D平(oldSheet) @531974：
  //    钻石型 `e.filter(k => Object.prototype.hasOwnProperty.call(parts, k))`（**KEY**，不是 materialName）；
  //    非钻石型 `entries.forEach(([e,x]) => e.includes("门框高") ? 高组.push : e.includes("门框宽") && 宽组.push)`；
  //    前/后/门板同样 `Object.entries(parts).filter((([e]) => ["前框"].some(t => e.includes(t))))`。
  //    `前框高`/`后框高` 加包长的判定也是 `e.includes(...)`（KEY）。
  if (isDiamond(l)) {
    base = ['左边', '右边', '斜长', '竖框']
      .map((k) => parts.find((p) => p.key === k))
      .filter((p): p is PartPreview => !!p)
      .map((p) => fmt(p))
  } else if (oldSheetEngine) {
    base = parts.filter((p) => p.key.includes('门框')).map((p) => fmt(p))
  } else {
    const g = (kw: string) => parts.filter((p) => p.key.includes(kw)).map((p) => fmt(p))
    base = [...g('门框高'), ...g('门框宽')]
  }
  const front = parts.filter((p) => p.key.includes('前框')).map((p) => (p.key.includes('前框高') ? fmt(p, p.result + (l.front_casing_add || 0)) : fmt(p)))
  const back = parts.filter((p) => p.key.includes('后框')).map((p) => (p.key.includes('后框高') ? fmt(p, p.result + (l.back_casing_add || 0)) : fmt(p)))
  const board = parts.filter((p) => p.key.includes('门板')).map((p) => fmt(p))
  return [...base, ...front, ...back, ...board].join('<br>')
}

// —— windows 列（原版四引擎，规则见 §16）——
// 平开：引擎B 关键词 [扣板,上亮横,上亮窗玻璃,压线]；oldSheet(D) 多一个「封板」。玻璃件单玻时 `Math.round(q/2)`（钻石不折半）。
// 吊趟 引擎B：亮窗类[中柱,亮窗玻璃,槽,压线] + 扣板组（拼扣板厚，`*<br>` 分隔；扣板厚缺失时打 `*0`）。
// 吊趟 oldSheet：可选亮窗段（仅 亮窗总高>门洞高）+ 主体段（[槽,封板高,封板宽] 按关键词下标排序后拆「非玻璃/玻璃」）
//                + 扣板组（拼扣板厚，普通 `*` 分隔）。
//
// ⚠️ **匹配一律用部件 KEY，显示名才用 `materialName`** —— 原版四处实现都是
//    `Object.entries(parts).filter((([e]) => 关键词.some(t => e.includes(t))))` 后
//    `t.materialName + ":" + …`（@492734 平开引擎B、@533094 平开 oldSheet、
//    @512847 吊趟引擎B、@550917/@551313 吊趟 oldSheet；token 解码见
//    `legacy/decode-stringmap.mjs`）。KEY 与 materialName **不等**是常态
//    （如 KEY `上亮窗玻璃高` / materialName `上亮玻璃高`、KEY `2轨扣板厚` / materialName `扣板厚`），
//    按 materialName 匹配会**静默丢件**：`上亮玻璃高` 不含关键词 `上亮窗玻璃`。
//    同理，`includes('玻璃')` / `includes('单玻')` / `includes('亮窗玻璃')` 这些判定
//    在原版里**读的也是 KEY**（`e.includes(...)`），故一并改为 `p.key`。
function windowsText(l: Line, engine: EngineId): string {
  const oldSheetEngine = engine === 'D'
  // 引擎C（C吊，只服务「生产单1」的吊趟行）：**原版不做任何玻璃修正**，
  // @583110 `_0x35fcb4 = Object.entries(parts).filter((([e]) => ["中柱","亮窗玻璃","槽","压线"].some(t => e.includes(t))))
  //   .map((([e,t]) => t.materialName + ":" + t.result + "*" + clamp(t.quantity*数量)))` —— 既无折半、也无扇数修正。
  const cEngine = engine === 'C'
  // 品牌分隔符 `:<br>` **只有引擎B（B平/B吊）有**；D平/D吊/C吊 原版一律硬编码 `:`
  // （@533034 平开D、@550882 吊趟D-head、@583110 吊趟C 都直接 `t.materialName+":"`）。
  const brand = engine === 'B'
  const sep = (name: string, rest: string) => (brand ? partLine(name, rest) : `${name}:${rest}`)
  const parts = computeParts(l, engine).filter((p) => p && p.materialName)
  const Q = l.quantity || 1
  const single = (l.bottom_glass || '') === '无' || (l.face_glass || '') === '无'
  const clamp01 = (v: number) => (v > 0 && v < 1 ? 1 : v)
  // 玻璃件数量修正（吊趟两套额外有扇数修正）
  const glassQty = (p: PartPreview, withFans: boolean) => {
    let q = p.quantity
    if (p.key.includes('玻璃')) {
      if (single && !p.key.includes('单玻')) q = withFans ? q / 2 : Math.round(q / 2)
      if (withFans && l.fans === '一固一活') q = 1
      if (withFans && l.fans === '双活') q = 2
    }
    return q
  }

  if (l.line_type === 'diao') {
    const thick = parts.find((p) => p.key.includes('扣板厚'))?.result ?? 0
    const padGroup = () =>
      parts
        .filter((p) => p.key.includes('扣板') && !p.key.includes('扣板厚'))
        .map((p) => {
          const o = clamp01(p.quantity * Q)
          return oldSheetEngine || cEngine
            ? `${p.materialName}:${p.result}*${thick}*${o}`
            : partLine(p.materialName, `${p.result}${thick > 0 ? `*<br>${thick}` : `*${thick}`}*${o}`)
        })
    if (!oldSheetEngine) {
      const lw = parts
        .filter((p) => ['中柱', '亮窗玻璃', '槽', '压线'].some((k) => p.key.includes(k)))
        .map((p) => sep(p.materialName, cEngine ? `${p.result}*${clamp01(p.quantity * Q)}` : `${p.result}*${clamp01(glassQty(p, true) * Q)}`))
      return [...lw, ...padGroup()].join('<br>')
    }
    let head = ''
    if (l.light_window_height > l.door_height) {
      head = parts
        .filter((p) => ['中柱', '亮窗玻璃', '压线'].some((k) => p.key.includes(k)))
        .map((p) => {
          const x = p.key.includes('亮窗玻璃') && (l.bottom_glass || '') === '无' ? Q / 2 : Q
          return `${p.materialName}:${p.result}*${clamp01(p.quantity * x)}`
        })
        .join('<br>')
    }
    const KW = ['槽', '封板高', '封板宽']
    const main = parts
      .filter((p) => KW.some((k) => p.key.includes(k)) && !p.key.includes('亮窗玻璃'))
      .map((p) => ({
        prio: KW.findIndex((k) => p.key.includes(k)),
        isGlass: p.key.includes('玻璃'),
        text: `${p.materialName}:${p.result}*${clamp01(glassQty(p, true) * Q)}`,
      }))
      .sort((a, b) => a.prio - b.prio)
    const mid = [...main.filter((x) => !x.isGlass), ...padGroup(), ...main.filter((x) => x.isGlass)].map((x) => (typeof x === 'string' ? x : x.text))
    return [head, mid.join('<br>')].filter(Boolean).join('<br>')
  }

  const kw = oldSheetEngine ? ['扣板', '上亮横', '压线', '封板', '上亮窗玻璃'] : ['扣板', '上亮横', '上亮窗玻璃', '压线']
  return parts
    .filter((p) => kw.some((k) => p.key.includes(k)))
    .map((p) => {
      let q = glassQty(p, false)
      if (isDiamond(l) && p.key.includes('玻璃') && single && !p.key.includes('单玻')) q = p.quantity
      return sep(p.materialName, `${p.result}*${q * Q}`)
    })
    .join('<br>')
}

function doorsheetText(l: Line, engine: EngineId): string {
  const oldSheetEngine = engine === 'D'
  const cEngine = engine === 'C'
  // 品牌分隔符 `:<br>` 与「玻璃高前插 `<br>`」**只存在于引擎B**：
  //   C吊（@580778 `_0x1239ce.doorsheet`）恒为 `x.materialName+":"+x.result+"*"+…`，**既无 `:<br>` 也无前插 `<br>`**，
  //   且关键词数组同 D吊（无 封板高/封板宽）—— 我们原先给 C 用了 `DS_KW.diao`（带封板）且套了 B 的两个变体，属引擎串味。
  const brand = engine === 'B'
  const parts = computeParts(l, engine).filter((p) => p && p.materialName)
  const diao = l.line_type === 'diao'
  const kws = isDiamond(l) ? DS_KW.diamond : diao ? (oldSheetEngine || cEngine ? DS_KW.diaoOld : DS_KW.diao) : oldSheetEngine ? DS_KW.pingOld : DS_KW.ping
  // 排除词：吊趟两套都是「亮窗」；平开 引擎B 是「亮窗玻璃」、旧 schema(引擎D) 是「上亮玻璃」
  const exclude = diao ? '亮窗' : oldSheetEngine ? '上亮玻璃' : '亮窗玻璃'
  const out: string[] = []
  // ⚠️ **关键词与排除词都按部件 KEY 判定，显示名才用 `materialName`**（原版 B平 @490039 / D平 @531100：
  //    `_0x5c8510.reduce((acc,t) => [...acc, ...Object.entries(parts)
  //        .filter((([e]) => e.includes(t) && !e.includes("上亮玻璃")))
  //        .map((([e,x]) => … x.materialName + ":" + x.result + "*" + l*数量))], [])`）。
  //    `includes("单玻")` 同样读 KEY。分组顺序 = **关键词数组顺序**（外层 reduce），非 parts 声明序。
  for (const kw of kws) {
    for (const p of parts) {
      const n = p.materialName
      if (!p.key.includes(kw) || p.key.includes(exclude)) continue
      let q = p.quantity
      if (kw === '玻璃宽' || kw === '玻璃高') {
        const single = (l.bottom_glass || '') === '无' || (l.face_glass || '') === '无'
        // 平开：`Math.round(q/2)`，且 diamond 不折半；吊趟：`q/2` **不取整**（原版两套写法不同，§15）
        if (single && !p.key.includes('单玻')) q = diao ? p.quantity / 2 : isDiamond(l) ? p.quantity : Math.round(p.quantity / 2)
        if (diao && l.fans === '一固一活') q = 1
        if (diao && l.fans === '双活') q = 2
      }
      const rest = `${p.result}*${q * (l.quantity || 1)}`
      // 杉杉门店变体只存在于引擎B（生产单）两套；oldSheet 两套与 C吊 恒用 `:`
      const c = brand ? partLine(n, rest) : `${n}:${rest}`
      out.push(kw === '玻璃高' && !cEngine ? `<br>${c}` : c)
    }
  }
  return out.join('<br>')
}

// 亮窗/扣板列文本：扣板厚不独立成行，只作为后缀拼进「扣板宽/高」（`材料:result*扣板厚*数量`）。
// 订单信息（原版 basicInfo，offset 498404）：洞尺(前置) + 尺寸(门洞高*门洞宽*墙厚) + 亮窗(亮窗高：) + 吊脚(吊脚：) + 玻璃；末行 开向(/扇数)。
// 订单信息列（basicInfo）。原版共 **5 处不同实现**，我们只用得到两类：
//   引擎B（生产单 `_0x551a25`/`_0x500ef9`）与 引擎A（玻璃合片单 `_0xcfde65`/`_0x4d28ce`）。
// 两者差异（原始 chunk 实证）：
//   玻璃段单玻：B = `{面玻}*单玻`；A = `单玻*{面玻}*{厚}mm`
//   玻璃段双无：B = 平开`无玻璃`/吊趟`无`；A = **平开`无`/吊趟`无玻璃`**（正好相反）
//   玻璃段一般：B = `{面玻}+{底玻}*{厚}`；A = 同 + `mm`
//   吊趟尾部抑制条件：B = 型材含「哑口套/门套」；A = 底玻与面玻都为「无」；**C = 不抑制（尾部恒 开向<br>扇数）**
//   亮窗数量：**只有吊趟拼 `亮窗{N}格`**（A/B/C 一致）
function basicInfoText(l: Line, engine: 'A' | 'B' | 'C' = 'B'): string {
  const engineA = engine === 'A'
  const items: string[] = []
  const diao = l.line_type === 'diao'
  const bRaw = l.bottom_glass || ''
  const fRaw = l.face_glass || ''
  const thick = l.glass_thickness || ''
  const dims = [l.door_height, l.door_width, l.wall_thickness].filter((v) => v && v !== 0)
  if (dims.length) items.push(dims.join('*'))
  const lw = l.light_window_height || 0
  if (lw) {
    if (diao) {
      // 吊趟（A/B 同）：`亮窗高：{lw}` + 亮窗数量≠0 时追加 `亮窗{N}格`
      let e = `亮窗高：${lw}`
      if ((l.light_window_count || 0) !== 0) e += `亮窗${l.light_window_count}格`
      items.push(e)
    } else {
      // 平开（A/B 同）：钻石型 `*{lw}`，否则 `亮窗高：{lw}`；**不拼亮窗数量**
      items.push(isDiamond(l) ? `*${lw}` : `亮窗高：${lw}`)
    }
  }
  // 吊脚段：平开 A/B 都有；两套吊趟都没有
  if (!diao && l.jiao) items.push(`吊脚：${l.jiao}`)
  const hole = String(l.hole_size ?? '').trim()
  if (hole) items.unshift(hole)
  if (bRaw || fRaw || thick) {
    // 严格判字面量「无」—— 原版 B吊 @518522 / D吊 @556765 / D平 @537103 / C吊 @587104 / A平 @477457 / A吊 @466398
    // 都是 `"无"===行["底玻"]`，**空串不算「无」**（空串会落到第三支）。
    const bottomNone = bRaw === '无'
    const faceNone = fRaw === '无'
    if (bottomNone && !faceNone) {
      items.push(engineA ? `单玻*${fRaw}*${thick}mm` : `${fRaw}*单玻`)
    } else if (bottomNone && faceNone) {
      items.push(engineA ? (diao ? '无玻璃' : '无') : (diao ? '无' : '无玻璃'))
    } else {
      items.push(`${fRaw}+${bRaw}*${thick}${engineA ? 'mm' : ''}`)
    }
  }
  const head = items.join('<br>')
  // 尾部用**原始 `开向`**，不做 displayDirection（原文：B平 @498631 `…+'<br>'+行["开向"]`，
  // B吊 @519038 `…+行["开向"]+"<br>"+行["扇数"]` —— 两处读的都是行字段原文，不走改名映射）。
  const dir = l.direction || ''
  let tail: string
  if (diao) {
    const suppress = engine === 'C'
      ? false // 引擎C（C吊）：尾部**恒** `开向<br>扇数`，无抑制（§D10）
      : engineA
        // 原版 A吊 @477760：`"无"===面玻 && "无"===底玻 ? "" : "<br>"+开向+"<br>"+扇数` —— **严格**，无空串支
        ? bRaw === '无' && fRaw === '无'
        : /哑口套|门套/.test(l.profile || '')
    tail = suppress ? '' : `${dir}<br>${l.fans || ''}`
  } else {
    tail = l.casing ? `${l.casing}${dir}` : dir
  }
  return [head, tail].filter(Boolean).join('<br>')
}

/** 标准生产单形状的一行（引擎可指定）。原版吊趟的常规生产单用 B吊，而 **product1 的吊趟用 C吊**
 *  （product1 producer 的 diao 分支收尾 `data:_0x1239ce`，即 C吊 producer 的同一对象 @587825）。 */
function productionRow(l: Line, engine: 'B' | 'C'): Record<string, unknown> {
  return {
    // 原版：白名单门店不含客户名
    door: (isDoorNoClientStore(tenantName.value) ? [l.profile, l.color] : [order.client_name, l.profile, l.color]).filter(Boolean).join('<br>'),
    // 原版 @494870（平开）/ @515705（吊趟）/ @585217（C吊）：`!_0x743794.includes(店) && 行["图片ID"]` 才取图
    // ⇒ **那 44 家白名单门店的门图整列为空**（注意这里**不含** `鸿程鑫派门窗`）。
    // 对照：玻璃合片单（@464478）与 product2/3（@533xxx/@552xxx）**没有**白名单门控，只判 `行["图片ID"]`，
    //       那两族我们无条件取图是对的，别一并改。
    doorImg: STORE_DOOR_NO_CLIENT.includes(tenantName.value) ? '' : l.image_url || '',
    OrderID: order.receipt_no || '',
    basicInfo: basicInfoText(l, engine),
    lockImg: lineLockImage(l),
    doorsheet: doorsheetText(l, engine),
    doorframe: doorframeText(l, engine),
    windows: windowsText(l, engine),
    remark: produceRemark(l),
  }
}

function productionProduces(): Record<string, unknown>[] {
  return orderedLines(true).map((l) => productionRow(l, 'B'))
}

// 生产单定制（product2/product3 模板，table.field=oldSheet）。
// 原版数据形状（11759/11994）：**每个订单行一个数据对象**，外层字段平铺（material/size/color/…），
// 表格数据嵌在 `oldSheet:[{doorsheet,doorframe,windows,doorImg}]`。整份数据是对象数组（每行一页）。
// 调用方 `_0x283867` 直接把数组传给 hiprint（不是 `{oldSheet: rows}`）。
// 原版 size 赋的是**数组**，hiprint 按 `String()` 渲染 → 实际打印为逗号连接（已实测）。
//   平开 `_0x34f4ac`：[门洞高*门洞宽*墙厚, 亮窗高：{lw}(钻石→`*{lw}`), 吊脚：{jiao}]
//   吊趟 `_0x192067`：[门洞高*门洞宽*墙厚, 总高{lw}[*{n}格]]（**无吊脚**）
function oldSheetSize(l: Line): string {
  const dims = [l.door_height, l.door_width, l.wall_thickness].filter((v) => v && v !== 0)
  const items: string[] = []
  if (dims.length) items.push(dims.join('*'))
  if (l.light_window_height) {
    if (l.line_type === 'diao') items.push(`总高${l.light_window_height}${l.light_window_count > 0 ? `*${l.light_window_count}格` : ''}`)
    else items.push(isDiamond(l) ? `*${l.light_window_height}` : `亮窗高：${l.light_window_height}`)
  }
  if (l.line_type !== 'diao' && l.jiao) items.push(`吊脚：${l.jiao}`)
  if (l.hole_size && String(l.hole_size).trim()) items.unshift(String(l.hole_size))
  return items.join(',')
}

// oldSheet 行的 glass 列（原版三分支，平开/吊趟第三支不同）：
//   底无面有 → `{面玻}*单玻`；双无 → `无`；否则 平开 `{面玻}+{底玻}*{厚}` / 吊趟 `面:{面玻}-底:{底玻}`
function oldSheetGlass(l: Line): string {
  const bRaw = l.bottom_glass || ''
  const fRaw = l.face_glass || ''
  if (!bRaw && !fRaw && !l.glass_thickness) return ''
  // 同 basicInfo：严格判「无」，空串不算（原版三分支出处同上）
  const bottomNone = bRaw === '无'
  const faceNone = fRaw === '无'
  if (bottomNone && !faceNone) return `${fRaw}*单玻`
  if (bottomNone && faceNone) return '无'
  return l.line_type === 'diao' ? `面:${fRaw}-底:${bRaw}` : `${fRaw}+${bRaw}*${l.glass_thickness || ''}`
}

function oldSheetProduce(l: Line): Record<string, unknown> {
  const dir = l.direction || ''
  // 原版 lockway：平开 = 套线种类 + 开向；吊趟 = 型材含「哑口套/门套」则空，否则 开向+扇数（无「开向:」前缀、无套线）
  const lockway = l.line_type === 'diao'
    ? (/哑口套|门套/.test(l.profile || '') ? '' : `${dir}${l.fans || ''}`)
    : `${l.casing || ''}${dir}`
  return {
    client: order.client_name || '',
    material: l.profile,
    qrcode: String(order.receipt_no || ''),
    orderID: order.receipt_no || '',
    maker: currentUserName.value || '',
    lockImg: lineLockImage(l),
    lockway,
    color: l.color,
    glass: oldSheetGlass(l),
    size: oldSheetSize(l),
    address: l.install_address || '',
    remark: oldSheetRemark(l),
    quantity: l.quantity,
    doorImg: l.image_url || '',
    oldSheet: [
      {
        doorsheet: doorsheetText(l, 'D'),
        doorframe: doorframeText(l, 'D'),
        windows: windowsText(l, 'D'),
        doorImg: l.image_url || '',
      },
    ],
  }
}

// 原版 product3 双联（`_0x1ebfe1`）：两行合一张，第二行所有键加 "1" 后缀（含 oldSheet1）；奇数行原样。
function pairRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i]
    const b = rows[i + 1]
    if (!b) {
      out.push(a)
      continue
    }
    const r: Record<string, unknown> = { ...a }
    for (const k of Object.keys(b)) r[`${k}1`] = b[k]
    out.push(r)
  }
  return out
}

function oldSheetProduces(paired = false): Record<string, unknown>[] {
  const rows = orderedLines(true).map(oldSheetProduce)
  return paired ? pairRows(rows) : rows
}

// product1（生产单1）：尺寸列从算料部件按名取值。映射（旧版 12318-12337）：
//   sheetHeigth=光企高、sheetWidth=上下方、frameHeigth=门框高、kouWidth=扣板宽、kouHeigth=扣板高、kouThickness=扣板厚；
//   glassSize=玻璃宽x玻璃高；doorSize=门洞高x门洞宽(+吊脚/亮窗总高/数量/洞尺)。部件缺失保持空串。
function product1Produces(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const l of orderedLines(true)) {
    // 原版 product1（mode 7，`calculateReceiptForCustomed`）：**平开走 product1 形状行、吊趟走标准生产单形状行**。
    // 证据：ping 块以 `data:_0x4495e3`（product1 键集）收尾 @568278，紧随的 diao 循环以 `data:_0x1239ce` 收尾 @587825，
    // 而 `_0x1239ce` 正是 C吊 producer 用的同一对象（其 doorsheet 写于 @581334）。故吊趟用引擎 C 产标准形状。
    if (l.line_type === 'diao') {
      rows.push(productionRow(l, 'C'))
      continue
    }
    // 引擎P1（平开）
    const parts = computeParts(l, 'P1').filter((p) => p && p.materialName)
    // 原版（@569700）走**部件遍历**、命中即赋值（同名多次=后者覆盖）
    const val = (name: string) => {
      // 原版 @569300 是「关键词数组 forEach → `Object.entries(parts).filter((([t]) => t.includes(关键词)))`」，
      // `t` 是部件 **KEY**；这里同样按 KEY 匹配（显示名不参与）。
      const p = parts.filter((x) => pk(x) === name || pk(x).includes(name)).pop()
      return p && !isNaN(Number(p.result)) ? Number(p.result) : 0
    }
    const s = (v: number) => (v ? String(v) : '')
    let glassH = 0
    let glassW = 0
    for (const p of parts) {
      const n = pk(p) // 同上：原版读 KEY
      const v = p.result && !isNaN(Number(p.result)) ? Number(p.result) : 0
      if (n.includes('玻璃高')) glassH = v
      if (n.includes('玻璃宽')) glassW = v
    }
    // 原版 product1 的部件关键词清单（@569290 `_0x1389a5`，逐字 15 项）；
    // 「部件遍历体内的语句是否被执行」= 是否存在部件命中其中任一关键词（见 `kouHeigth`）。
    const anyKwHit = parts.some((p) => PRODUCT1_KW.some((k) => pk(p).includes(k)))
    // 门框（原版）：门框高/宽 先赋，前框高→`前`+(前框高+前包加长)，后框高/宽 以 `<br>后` 追加
    let frameHeigth = s(val('门框高'))
    let frameWidth = s(val('门框宽'))
    const qianH = val('前框高')
    const qianW = val('前框宽')
    const houH = val('后框高')
    const houW = val('后框宽')
    if (qianH) frameHeigth = `前${qianH + (l.front_casing_add || 0)}`
    if (qianW) frameWidth = `前${qianW}`
    if (houW) frameWidth = `${frameWidth}<br>后${houW}`
    if (houH) frameHeigth = `${frameHeigth}<br>后${houH}`
    // sheetWidth：**只有 上下方**。
    // 原版 @570381 里确实还有两支 `Number(_0x55389d)>0 && (sheetWidth += "<br>封板宽"+…)` /
    // `Number(_0x41a723)>0 && (sheetHeight += "<br>封板高"+…)`，但 `_0x55389d`/`_0x41a723` 由
    // 赋值分支 `e===封板宽` / `e===封板高` 写入，而 **`e` 只遍历关键词数组 `_0x1389a5`，
    // 数组里是 `"封板"`（无宽/高）** ⇒ 两个分支**恒为死代码**，原版永不输出「封板宽/封板高」。
    // 我们原先会在 KEY 含「封板宽」时追加，属**多输出**，已去掉。
    const sheetWidth = s(val('上下方'))
    // doorSize：门洞高x门洞宽；吊脚>0 追加，**否则**亮窗总高>0 追加；数量>1 追加；洞尺前置
    let doorSize = `${l.door_height || 0}x${l.door_width || 0}`
    if (l.jiao > 0) doorSize += `x${l.jiao}`
    else if (l.light_window_height > 0) doorSize += `x${l.light_window_height}`
    if (l.quantity > 1) doorSize += `<br>数量:${l.quantity}`
    if (l.hole_size && String(l.hole_size).trim()) doorSize = `${l.hole_size}<br>${doorSize}`
    rows.push({
      client: order.client_name || '',
      OrderID: order.receipt_no || '',
      goods: l.profile,
      color: l.color,
      lockway: l.direction || '', // 原版：**原始开向**（无扇数、无套线前缀）
      doorSize,
      glassSize: `${glassH}x${glassW}`, // 原版顺序是 玻璃高 x 玻璃宽
      thickness: l.wall_thickness ? String(l.wall_thickness) : '',
      sheetHeigth: s(val('光企高')),
      sheetWidth,
      frameHeigth,
      frameWidth,
      // 原版：晟斐门窗厂特判 —— `kouHeigth = 套线种类`，且 `kouWidth` 不再赋值（两个常规赋值都在 else 分支里）
      // 晟斐门窗厂特判（原版 @569254）：有「图片ID」时 `kouWidth` 取**行图片**
      //   `if (租户==='晟斐门窗厂' && 行.图片ID) try{ const e=await getImage(行.图片ID); e && (kouWidth=e) }catch{}`
      // 我们的行图片由 `hydrateRowImages` 预先水合到 `l.image_url`，故同步取它即可（取不到仍为空串）。
      kouWidth: STORE_SHENGFEI === tenantName.value ? (l.image_id && l.image_url) || '' : s(val('扣板宽')),
      // ⚠️ 原版这一句挂在**部件遍历体内**（@570381，且**没有 `&& l` 门控**）：
      //   `"晟斐门窗厂" === 租户 ? (kouHeigth = 行["套线种类"]) : (扣板高→…, 扣板宽→…)`
      //   ⇒ 只有「至少有一个部件的 KEY 命中 15 个关键词之一」时才会被赋值，
      //     一个都没命中时保持初始空串（我们用 `anyKwHit` 表达同一条件）。
      kouHeigth: STORE_SHENGFEI === tenantName.value ? (anyKwHit ? l.casing || '' : '') : s(val('扣板高')),
      kouThickness: s(val('扣板厚')),
      // 原版 product1 remark = [五金, 单双丁(≠正常), 备注, 安装地址].join("<br>") + 加配（**无轨道种类、无墙型**）
      remark: (() => {
        const ding = l.double_ding && l.double_ding !== '正常' ? l.double_ding : null
        let r = [l.hardware || null, ding, l.remark || null, l.install_address || null].filter(Boolean).join('<br>')
        const add = markupNames(l)
        if (add) r = r ? `${r}<br>加配：${add}` : `加配：${add}`
        return appendAccessory(r, l)
      })(),
    })
  }
  return rows
}

// 通用：从模板提取某字段(field)对应 table 的列定义（field+title），列结构=模板原样。
interface ProdCol { field: string; title: string }
function extractTableColumns(tpl: unknown, field: string): ProdCol[] {
  try {
    const d = tpl as { config?: { panels?: { printElements?: { printElementType?: { type?: string }; options?: { field?: string; columns?: unknown } }[] }[] } }
    for (const p of d?.config?.panels ?? []) {
      for (const e of p.printElements ?? []) {
        if (e.printElementType?.type === 'table' && e.options?.field === field) {
          const cols = e.options.columns as unknown
          const arr = Array.isArray(cols) && cols.length && Array.isArray((cols as unknown[])[0]) ? (cols as unknown[][])[0] : (cols as unknown[])
          return (arr as ProdCol[]).filter((c) => typeof c === 'object' && c?.field).map((c) => ({ field: c.field, title: c.title }))
        }
      }
    }
  } catch {
    // 忽略
  }
  return []
}

// 按模板**实际字段族**（而非 mode 名）分发数据：product2/3 是 oldSheet、
// product4/10 是标签版式，按 mode 名判断会分错。key=null 表示 payload 即 data 本身。
function templatePayload(tpl: unknown, _mode?: string, forPreview = false): { key: string | null; data: unknown; imgFields?: string[]; extra?: Record<string, unknown>; wrap?: boolean } {
  if (extractTableColumns(tpl, 'produces').length) {
    // `produces` 表被三族模板共用（product / product1 / glass），**按列特征**判别数据源，
    // 而不是按 mode 名 —— 否则模板改名或新增会静默喂错形状。
    //   ① 含 product1 专有列（doorSize/glassSize/sheetHeigth/kouWidth…）→ product1 尺寸列数据源
    //   ② 含 glass 特征（有 door/client 但**无 doorframe/windows**）→ 玻璃合片单数据源（引擎A）
    //   ③ 其余 → 生产单数据源（引擎B）
    const cols = new Set(extractTableColumns(tpl, 'produces').map((c) => c.field))
    const isProduct1 = ['doorSize', 'glassSize', 'sheetHeigth', 'kouWidth'].some((f) => cols.has(f))
    const isGlass = !cols.has('doorframe') && !cols.has('windows') && cols.has('door') && cols.has('client')
    if (isProduct1) return { key: 'produces', data: product1Produces() }
    return { key: 'produces', data: isGlass ? glassProduces() : productionProduces(), imgFields: ['doorImg', 'lockImg'] }
  }
  // 原版 glassHole 载荷：`[{ date, glassInfoList }]`（date 在表格外，绑顶层）
  if (extractTableColumns(tpl, 'glassInfoList').length)
    return { key: 'glassInfoList', data: glassInfoProduces(), imgFields: ['doorImg'], extra: { date: today() }, wrap: true }
  // 原版 product2/3 载荷是**对象数组**（每行一页），非 `{oldSheet: rows}`；
  // product3（双联）：模板同时有 `oldSheet` 与 `oldSheet1` 两张表 —— 按此判别，不依赖 mode 名。
  if (extractTableColumns(tpl, 'oldSheet').length)
    return { key: null, data: oldSheetProduces(extractTableColumns(tpl, 'oldSheet1').length > 0), imgFields: ['doorImg'] }
  if (extractTableColumns(tpl, 'receipt').length) {
    // 回执族三张模板共用载荷，**brand 后缀**按列特征区分（不按 mode 名）：
    //   有 `payment` 列 → ReceiptList「订货清单」；有 `profile2` 列 → receipt「回执单」；其余 → FinalReceipt「收据单」
    const rc = new Set(extractTableColumns(tpl, 'receipt').map((c) => c.field))
    const suffix = rc.has('payment') ? '订货清单' : rc.has('profile2') ? '回执单' : '收据单'
    return { key: null, data: receiptPrintData(suffix), wrap: true }
  }
  // 无 table 的独立版式（标签）：product10 有 `GlassSize` 字段、lable 有 `qrcode`/`package` —— 按字段判别
  const hasGlassSize = JSON.stringify(tpl).includes('"GlassSize"')
  if (hasGlassSize) {
    const rows = labelRows('product10')
    // 原版：预览用分组版、打印用未分组版（自身不一致，按原样复刻）
    return { key: null, data: forPreview ? groupProduct10(rows) : rows }
  }
  return { key: null, data: labelRows('lable') }
}

async function printCurrentTemplate() {
  const mode = templatePreviewMode.value
  if (!mode) return
  try {
    const tpl = (await api.getPrintTemplatesByMode(mode))[0]?.template
    if (!tpl) {
      message.warning('未找到该模板')
      return
    }
    const { key, data, extra, wrap } = templatePayload(tpl, mode)
    const payload = key ? { ...extra, [key]: data } : data
    await printByMode(mode, (wrap ? [payload] : payload) as Record<string, unknown>[])
  } catch (e) {
    message.error(e instanceof Error ? e.message : '打印失败')
  }
}

// ===== 通用模板预览（按字段族渲染）=====
const templatePreviewOpen = ref(false)
const templatePreviewLoading = ref(false)
const templatePreviewHtml = ref('')
const templateList = ref<{ mode: string; name: string }[]>([])
const templatePreviewMode = ref<string | null>(null)

async function openTemplatePreview(initialMode?: string) {
  templatePreviewOpen.value = true
  templatePreviewLoading.value = true
  try {
    const all = await api.listPrintTemplates()
    templateList.value = all.map((t) => ({ mode: t.mode, name: t.name }))
    const want = initialMode ?? templatePreviewMode.value ?? all[0]?.mode
    templatePreviewMode.value = want || all[0]?.mode || null
    await renderTemplatePreview(templatePreviewMode.value!)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载模板失败')
  } finally {
    templatePreviewLoading.value = false
  }
}

async function renderTemplatePreview(mode: string) {
  templatePreviewLoading.value = true
  try {
    // 玻璃订单的 `doorImg` 是**公式挖孔图**，先兜底加载（原先只有「算料」会加载）
    await ensureFormulaImages()
    const templates = await api.getPrintTemplatesByMode(mode)
    const tpl = templates[0]?.template
    if (!tpl) {
      templatePreviewHtml.value = ''
      message.warning('未找到该模板')
      return
    }
    // 预览 = **hiprint 真渲染**（与打印同一套渲染核心）：样式/间距/分页/二维码/图片位置都与实打一致。
    // 17 张模板已逐一实测可渲染（见 docs/2026-09-10-template-field-audit.md §37），故不再保留自绘表格回退。
    // `forPreview = true`：product10 预览按原版走**分组限量**版（打印走未分组版，原版本身不一致）。
    const { key, data, extra, wrap } = templatePayload(tpl, mode, true)
    const payload = key ? { ...extra, [key]: data } : data
    const html = await renderByMode(mode, (wrap ? [payload] : payload) as Record<string, unknown>[])
    templatePreviewHtml.value = html || ''
    if (!html) message.warning('该模板渲染为空')
  } catch (e) {
    templatePreviewHtml.value = ''
    message.error(e instanceof Error ? e.message : '渲染失败')
  } finally {
    templatePreviewLoading.value = false
  }
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

// 玻璃订单（glassHole 模板，table.field=glassInfoList）
async function printGlassHole() {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  try {
    await ensureFormulaImages()
    await printByMode('glassHole', { glassInfoList: glassInfoProduces() })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '玻璃订单打印失败')
  }
}

// 生产单定制（product2，mode 8）/ 生产单3（product3，mode 9）—— 均走 `oldSheet` 载荷。
// **product3 需要配对**：`_0x1ebfe1` 把相邻两行合成一张，第二行的所有键加 `1` 后缀
// （模板里同时有 `oldSheet` 与 `oldSheet1` 两张表，正是为此）。原版 mode 9 有独立分支，
// 我们原先只有 product2 一个出口，product3 只能从「模板预览」里打。
async function printProductionCustom(mode: 'product2' | 'product3' = 'product2') {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  try {
    await printByMode(mode, oldSheetProduces(mode === 'product3'))
  } catch (e) {
    message.error(e instanceof Error ? e.message : '生产单定制打印失败')
  }
}

// —— 回执单分享 / 下载（无外部依赖：下载独立 HTML、分享文本摘要） ——


// —— 终端链接 token ——
// 兼容旧版算法：a = tenant_id + 1000, x = 7 × 客户编号 + 1987, t = 时间戳 + 888。
// 终端页（只读订单视图）后续接入后消费 param2 token；当前仅生成并复制链接。
const tenantName = ref('')
// 当前登录用户（原版 maker = userinfo.name，打单人）
const currentUserName = ref('')

const currentClient = computed(() =>
  clients.value.find((c) => c.code === order.client_code),
)

// 原版（@448151 邻近）token = `{a}af{x}wy{now+888}`：
//   `ds === 'smartdoor'` → a = 1000；否则 a = Number(ds.split('smartdoor')[1]) + 1000
//   x = 7 × 客户编号 + 1987
// 注意 a **与租户 id 无关**（原版没有用 tenant.id）。
function buildTerminalToken(clientId: number): string {
  const a = TENANT_DS === 'smartdoor' ? 1000 : Number(TENANT_DS.split('smartdoor')[1]) + 1000
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
  void loadPayQrcode()
  // 旧版拉目录失败会弹「初始化失败」（Hui.formatted.js:979）
  void loadMarkupCatalog().then((ok) => { if (!ok) message.error('初始化失败') })
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
    currentUserName.value = (me.user as unknown as { name?: string })?.name || ''
    tenantName.value = me.tenant.name
  } catch {
    // 忽略：取不到租户信息时沿用空值（门店名回退为空）
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
/* ===== 加价项目单元格（照抄 legacy/css/Hui-39b802eb.css，与旧版逐字一致）=====
   ⚠️ 必须用 `:deep()`：这一格是在 **DataTable 的 `render` 回调**里渲染的，
   回调执行时 `currentRenderingInstance` 是 NDataTable 而非本组件，vnode 拿不到本组件的
   `data-v` 标记 ⇒ 不带 `:deep()` 的话 `<style scoped>` 的规则一条都不会命中
   （实测：display 仍是 block、字号仍是 12px、颜色不是 #1302fa）。
   `:deep(X)` 编译成 `[data-v-本组件] X`，靠祖先命中，正好绕开这一点。
   —— 旧版能用普通 scoped 是因为它走 Element Plus 的**作用域插槽**，插槽内容在父作用域渲染。 */
:deep(.extra-items-container) {
  display: flex;
  flex-direction: column;
  width: 100%;
}
:deep(.glass-input-label) {
  font-size: 11px;
  white-space: nowrap;
  color: #1302fa;
  min-width: 0px;
}
:deep(.extra-items-expressions) {
  margin-top: 4px;
  white-space: pre-line;
  font-size: 12px;
  line-height: 1.5;
}
:deep(.expression-line) {
  margin-bottom: 2px;
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
.production-host {
  overflow: auto;
  max-height: 70vh;
}
/*
 * ⚠️ 这里**故意不给预览内容加任何样式**。
 * 预览就是 hiprint 真渲染（与打印同一套核心），样式一律由 `print-lock.css` 决定，
 * 这样「预览」和「实打」才一致。
 *
 * 曾经加过 `:deep(td) { border/padding/vertical-align: top/white-space }` 和
 * `:deep(img) { max-width: 80px }` —— 它们的**特异性 (0,2,1) 高于** hiprint 的
 * `.hiprint-printElement-tableTarget td` (0,1,1)，会把 hiprint 的
 * `vertical-align: middle` 盖成 `top`，导致预览里所有单据的单元格**变成上对齐**（实打仍是居中，
 * 于是"预览 ≠ 实打"）。要调预览外观，请改模板 JSON 或 print-lock.css，别在这里加覆盖。
 */
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
  /* 旧版三个加价项目弹窗都是 el-form `label-width: 100px`（:2655 / :13130 / :13179） */
  width: 100px;
  flex: none;
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
