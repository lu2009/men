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
      <!-- 旧版没有表格标题栏：门型名是**操作列的表头**（`label:"平开门"/"移门"`）。
           这一条只留我们自己的「批量删除 / 隐藏」入口，不再是标题。 -->
      <section v-if="showPing" class="table-wrap">
        <div class="table-head">
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
        <!-- 「 添加行 」在**表格下方**居中，蓝色实心带 + 图标（原版 :2635-2639：
             `div.table-footer > el-button.custom-button-btn(icon=plus) 文案 " 添加行 "`） -->
        <div class="table-footer">
          <n-button class="custom-button-btn" size="small" @click="addRowOf('ping')">＋ 添加行 </n-button>
        </div>
      </section>

      <section v-if="showDiao" class="table-wrap">
        <div class="table-head">
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
        <div class="table-footer">
          <n-button class="custom-button-btn" size="small" @click="addRowOf('diao')">＋ 添加行 </n-button>
        </div>
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

    <!-- 列显隐设置（两表共 40 多个复选框，比旧版多，**必须限高可滚** ——
         否则卡片会长到 1390px 高、在 900px 屏上把底部的取消/保存顶出视口） -->
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
          <n-button quaternary @click="resetVisDraft">恢复默认</n-button>
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
import type { PartsMap } from '../utils/formulaEngine'
import { printByMode, renderByMode } from '../utils/printService'
import { markupDetail, markupLines, type MarkupItem } from '../utils/markupLines'
import {
  createPartsEngine,
  partsCache,
  round2,
  type EngineId,
  type Line,
  type PartPreview,
} from '../utils/partsEngine'
import {
  casingAmountOf,
  createPrintPayloads,
  diaoDirImage,
  TENANT_DS,
  type PrintContext,
} from '../utils/printPayloads'
import {
  fileToDataUrl,
  genImageId,
  idbGetImage,
  idbPutImage,
  idbRemoveImage,
  textToImageDataUrl,
} from '../utils/imageStore'
import { PING_DIRECTION_IMAGES } from '../data/directionImages'
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
  // ⚠️ 下面三个是 **Home 那边在写的头字段**（打单操作 / 单号集 / 锁向）。
  // Hui 界面不显示、也不编辑它们，但**必须原样带回去** —— 因为
  // `PUT /orders/{id}` 是**整头覆盖**（`orders/service.rs:456-465` 无条件
  // `SET ... order_no_set=$11, install_address=$12, production_status=$13, lock_direction=$14`），
  // 而 `model.rs` 里这几个字段是 `#[serde(default)]` ⇒ 载荷里缺键 = 反序列化成 `""` = **抹空**。
  // 见 `docs/home-audit/hui-save-clobber-check.mjs`（实测：存一次抹掉四个字段）。
  order_no_set: '',
  production_status: '',
  lock_direction: '',
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
  { key: 'hole_size', label: '洞尺（门洞尺寸格内「洞/净尺」）' },
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
  { key: 'door_size', label: '门洞尺寸' },
  { key: 'hole_size', label: '洞尺（门洞尺寸格内「洞/净尺」）' },
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

/** 「恢复默认」：把草稿勾回旧版租户配置那套（见 `PING_COL_DEFAULTS`），**要再点保存才生效**。 */
function resetVisDraft() {
  for (const c of PING_VIS_KEYS) visDraft.ping_columns[c.key] = PING_COL_DEFAULTS[c.key] !== false
  for (const c of DIAO_VIS_KEYS) visDraft.diao_columns[c.key] = DIAO_COL_DEFAULTS[c.key] !== false
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

/**
 * 列显隐默认值 —— 取自**旧版租户配置**（`GET /1?param1=login` 返回的
 * `registrant.ping_column` / `registrant.diao_column`，2026-09-16 实查）：
 *
 *   ping_column = {"五金":1,"前包加长":1,"单双丁":1,"吊脚":0,"后包加长":1,"套线种类":1,
 *                  "封板高":1,"平方数":0,"开向模式":1,"打折":0,"洞尺":1,"轨道种类":0,"锁向":1}
 *   diao_column = {"五金":0,"单双丁":1,"封板高":1,"打折":1,"数量":0,"洞尺":1,"计价方式":0}
 *
 * 旧版的闸门是「真值才渲染」；另外 **日期/回执单号/图片ID/客户/客户编号/其它费用 六列
 * 在旧版里恒 false**（闸门变量 `he`/`ge` = `Vue.ref(!1)`，全组件无赋值），从来没显示过，
 * 所以这里也默认隐藏（仍可在「列显隐设置」里打开）。
 */
const PING_COL_DEFAULTS: Record<string, boolean> = {
  jiao: false, // 吊脚:0
  discount: false, // 打折:0
  track: false, // 轨道种类:0（开向格里的「锁具」那一行）
  image_id: false,
  client: false,
  client_code: false,
  other_fee: false,
}
const DIAO_COL_DEFAULTS: Record<string, boolean> = {
  hardware: false, // 五金:0
  price_type: false, // 计价方式:0
  image_id: false,
  client: false,
  client_code: false,
  other_fee: false,
}
function seedColumnDefaults() {
  Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
  Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
  Object.assign(pingColVis, PING_COL_DEFAULTS)
  Object.assign(diaoColVis, DIAO_COL_DEFAULTS)
}

async function loadColumnConfig() {
  seedColumnDefaults()
  try {
    const c = await api.getColumnConfig()
    // 后端存过就用存过的（整表覆盖；未存过保留上面的旧版默认）
    if (c.ping_columns && Object.keys(c.ping_columns).length) {
      Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
      Object.assign(pingColVis, c.ping_columns)
    }
    if (c.diao_columns && Object.keys(c.diao_columns).length) {
      Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
      Object.assign(diaoColVis, c.diao_columns)
    }
  } catch {
    // 忽略：保留旧版默认
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

// —— 算料引擎 ——
// 原先在本组件内，2026-09-17 搬到 `utils/partsEngine.ts`，与 Home 的批量打印共用同一份实现
// （同一张订单在页面上看到的料，必须和打出来的一致）。这里只留薄封装，调用点一行都不用改。
const partsEngine = computed(() => createPartsEngine(formulas.value))
/** 该行对应的公式（按 `formula_id`）。 */
const formulaOf = (l: Line) => partsEngine.value.formulaOf(l)
/** 该行公式是否钻石型（淋浴房 diamondling）。 */
const isDiamond = (l: Line) => partsEngine.value.isDiamond(l)
/** 按**指定引擎**算料。原版每个打印入口各跑一套引擎（A/B/D/P1/C），规则不同、结果可能不同。 */
const computeParts = (l: Line, engine: EngineId = 'B') => partsEngine.value.computeParts(l, engine)

// 行编辑（已改行内就地编辑 + 每表底部添加行，无弹窗抽屉）




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
 * 实现见 `utils/markupLines.ts` —— 与**电子回执单**（`utils/receiptBuilder.ts`）共用同一份，
 * 旧版 `ps` 的 `加价项目` 与打印回执的 `pricingDetail` 本来就取同一个串（`Hui.formatted.js:1308`）。
 */

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
/** 加价计算异常上报（原版 catch 里就是 `ElMessage.error('计算金额失败')`）。 */
function markupError(msg: string) {
  message.error(msg)
}

function recalcMarkup(l: Line): number {
  let total = 0
  // `carry` 贯穿整行 —— 复刻原版把基准量声明在**循环外**（平开 `o` @:1259 / 吊趟 `c` @:4173）
  const carry = { v: 0 }
  for (const item of l.markup ?? []) {
    item.amount = round2(markupDetail(item, l, carry, markupError).amount)
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
  // ⚠️ 这三个同上：忘一个，保存时那一个就被抹空（见 `order` 声明处的说明）。
  order.order_no_set = ''
  order.production_status = ''
  order.lock_direction = ''
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
function wallThicknessCell(l: Line) {
  return h(
    NInputNumber,
    {
      ...CELL,
      class: 'red-number-input',
      status: cellError(l, 'wall_thickness') ? 'error' : undefined,
      value: l.wall_thickness,
      showButton: false,
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
function glassSelectCell(l: Line, field: 'face_glass' | 'bottom_glass') {
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
const CELL = {
  size: 'small' as const,
  style: { width: '100%' },
  // 旧版的 el-input / el-select 在不写 placeholder 时是**空的**；
  // naive-ui 不给就是英文默认值（"Please Input" / "Please Select"），必须显式清空。
  placeholder: '',
}

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

function tCell(l: Line, field: string, onBlur?: (l: Line) => void) {
  return h(
    NInput,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      onUpdateValue: (v: string) => {
        ;(l as unknown as Record<string, string>)[field] = v
        lineRefresh(l)
      },
      onBlur: onBlur ? () => onBlur(l) : undefined,
    },
  )
}

/**
 * 数字格红字（旧版 `.red-number-input .el-input__inner{color:red}`）挂在哪些格子上：
 *   平开：门洞高 / 门洞宽 / 墙厚 / 钻石型门洞尺寸里的「右宽」那一格（绑的也是 亮窗总高）
 *   移门：门洞高 / 门洞宽 / 墙厚 / 封板高
 * 注意 **独立的「亮窗总高」列不红**（原版那一格没挂 class）—— 同一字段在钻石型里才红，
 * 两种渲染互斥，所以这里按 `isDiamond` 判断即可。吊脚 / 轨道长 / 边封数 都是黑字。
 */
function isRedNum(l: Line, field: string): boolean {
  if (field === 'door_width' || field === 'door_height' || field === 'wall_thickness') return true
  if (field === 'light_window_height') return isDiamond(l)
  if (field === 'seal_board_height') return l.line_type === 'diao'
  return false
}

function intCell(l: Line, field: string, min = 0) {
  // 门洞宽/门洞高在**失焦**时触发尺寸类自动加价（原版 `Qt` 挂在 onBlur 上，不是随输入）
  const sizeField =
    field === 'door_width' || field === 'door_height' ? (field as SizeField) : null
  return h(
    NInputNumber,
    {
      ...CELL,
      class: isRedNum(l, field) ? 'red-number-input' : undefined,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, number>)[field],
      min,
      showButton: false,
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        ;(l as unknown as Record<string, number>)[field] = sanitizeNum(v, min)
        lineRefresh(l)
      },
      onBlur: sizeField ? () => syncSizeMarkup(l, sizeField) : undefined,
    },
  )
}

function moneyCell(l: Line, field: string, min = 0) {
  return h(
    NInputNumber,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, number>)[field],
      min,
      showButton: false,
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
function profileCell(l: Line) {
  const opts = l.line_type === 'diao' ? diaoProfileOptions.value : pingProfileOptions.value
  // 不加 `historyKey`：原版型材**不写候选库**（见 `profileOptionsFor` 注释），故无需记忆。
  return optCell(l, 'profile', opts, (x) => void resolveRow(x), true)
}


function colorCell(l: Line) {
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
      onUpdateValue: (v: string | null) => {
        const next = (v as string) ?? ''
        l.color = next
        rememberField('color', next)
        lineRefresh(l)
      },
    },
  )
}
function trackCell(l: Line) {
  // 轨道候选按当前行公式 parts 的 track 提取（随型材联动），合并历史
  const opts = partsTrackOptions(l, 'track') // 轨道候选仅来自公式 parts + 历史，无内置兜底
  return optCell(l, 'track', opts, undefined, true, 'track')
}
function casingCell(l: Line) {
  // 套线候选仅来自当前行公式 parts 的单包/双包 + 历史，无内置候选（原版）
  const opts = partsTrackOptions(l, 'casing')
  return optCell(l, 'casing', opts, undefined, true, 'casing')
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
/**
 * 五金格 —— 原版是**多选** el-select（:2387-2434）：
 *   · 行字段 `五金` 存的是**下划线分隔的字符串**（`a_b_c`），候选里要去掉已选的；
 *   · `multiple/filterable/allow-create/collapse-tags`，`placeholder:"选择或填写五金"`；
 *   · 已选项会在下方另起一行 `join("、")` 展示（:2434-2435，style margin-top:4px/font-size:12px/color:#606266）。
 * 我们原来是**单选**（`optCell` + tag），只能存一个五金 —— 与旧版不符，这里改成多选。
 */
function hardwareCell(l: Line) {
  const selected = String(l.hardware || '')
    .split('_')
    .map((s) => s.trim())
    .filter(Boolean)
  const options = hardwareOptionsFor(l).filter((o) => !selected.includes(o.value))
  return h('div', { class: 'glass-inputs-container' }, [
    h(NSelect, {
      ...CELL,
      multiple: true,
      filterable: true,
      tag: true,
      options,
      value: selected,
      placeholder: '选择或填写五金',
      onUpdateValue: (vals: string[]) => {
        // 去重后写回下划线串（原版 `m(行, 值数组)`：`[...new Set(v)].join("_")`）
        l.hardware = [...new Set(vals.map((v) => String(v)))].join('_')
        rememberField('hardware', l.hardware)
        lineRefresh(l)
      },
    }),
    selected.length
      ? h(
          'div',
          { style: 'margin-top:4px;font-size:12px;color:#606266;line-height:1.4' },
          selected.join('、'),
        )
      : null,
  ])
}
// 洞尺选项 —— **两张表的取值集不同**（原版 ping :2341-2345 只有 2 项，diao :5136-5141 有 4 项）
const PING_HOLE_SIZE_OPTS = ['洞尺', '净尺'].map((v) => ({ label: v, value: v }))
const DIAO_HOLE_SIZE_OPTS = ['洞尺', '净尺', '单包洞尺', '双包洞尺'].map((v) => ({ label: v, value: v }))
function holeCell(l: Line, options: { label: string; value: string }[]) {
  return optCell(l, 'hole_size', options)
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

// 操作列。**表头文字就是「平开门」/「移门」**（原版 :1723 / :4517 `label:"平开门"/"移门"`，
// width:"50"）——旧版没有额外的表格标题栏，门型名就挂在第一列表头上。
// 原版这一格的按钮是 删除 / 复制 / 查看3D（`div.upload-buttons` 竖排、文案前后带空格）；
// 我们把「查看3D」换成「算料」（3D 未做），文案保持原样。
const opsCol = (label: string): DataTableColumn<Line> => ({
  title: label,
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

// 金额格的「平方数」那一行：**只读输入框**，唯一入口是右键打开「修改平方数」浮窗
// （原版 :2482-2491：外层 div 挂 onContextmenu，内层 el-input `modelValue:行["平方数"] readonly`）。
const sqCell = (l: Line) =>
  h(
    'div',
    {
      onContextmenu: (e: MouseEvent) => {
        e.preventDefault()
        openSquareDialog(l)
      },
    },
    [h(NInput, { ...CELL, readonly: true, value: l.square.toFixed(2) })],
  )

// 金额格的「金额」那一行：原版是 `el-input readonly:!we["金额"][id]`，
// 而 `we` 只在 onBlur 里被写成 `false`（`!false` 仍是 true）⇒ **恒只读**，不会变成可编辑。
const amountCell = (l: Line) => h(NInput, { ...CELL, readonly: true, value: l.amount.toFixed(2) })

// 备注格：原版是 `el-input type="textarea" :autosize="{minRows:1}"`，不是单行输入框。
function remarkCell(l: Line) {
  return h(NInput, {
    ...CELL,
    type: 'textarea',
    autosize: { minRows: 1 },
    value: l.remark,
    onUpdateValue: (v: string) => {
      l.remark = v
      lineRefresh(l)
    },
  })
}

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
  const lines = markupLines(l, markupError)
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

/**
 * 门花图格。
 *
 * ⚠️ **两个分支的 `key` 不能省**（踩过一次）：
 * 两个分支都是同层同类型的 `div`，子节点又都是无 key 的 `NButton` 数组 —— Vue 走
 * `patchUnkeyedChildren`，第 1 个子节点「旧=「文字」按钮 / 新=「×」删除按钮」**类型相同**，
 * 于是**原地复用同一个 DOM 元素**（只是把 props 换成「删除门图」）。
 * 而 naive-ui 的 `FocusTrap` 关闭时会 `lastFocusedElement.focus()` —— 那个"上次聚焦的元素"
 * 正是「文字」按钮。结果：**文字传图按 Enter 之后，焦点悄悄落到了"删除"按钮上**，
 * 再来一次 Enter（键重复/再按一下）就弹出「删除门图」。
 * 实测复现：一次 Enter keydown 之后即出现 `["门图名字 …", "删除门图 …"]` 两个弹窗，
 * 焦点 trace 由 INPUT → BUTTON(取消) → BUTTON(×)。
 * 给两个分支不同 key，Vue 就会卸载旧的、挂新的，DOM 不再被复用。
 */
function doorImgCell(l: Line) {
  if (l.image_url) {
    return h('div', { key: 'door-img', style: 'position:relative;display:inline-block' }, [
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
      key: 'door-img-empty',
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

// —— 组合单元格工具：一格多控件、紧凑 ——
// **结构与类名逐字照抄旧版**（`legacy/css/Hui-39b802eb.css`）：
//   div.glass-inputs-container{display:flex;flex-direction:column;gap:5px;width:100%}
//     └ div.glass-input-group{display:flex;align-items:center;gap:4px}
//         ├ div.glass-input-label{font-size:11px;white-space:nowrap;color:#1302fa}   ← 蓝色小标签
//         └ div.glass-input{flex:1}  → 控件
// 旧版多数格子是「label 与控件同层、控件自己带 .glass-input」；个别格子中间还夹一层 div
// （如 `_hoisted_27$1`）。我们统一在控件外面包一层 `.glass-input`，视觉等价且不必逐格分支。
//
// ⚠️ 样式必须写成 `:deep(.glass-inputs-container)` 等（见文件末尾样式表）：
// 这些 vnode 是在 NDataTable 的 `render` 回调里创建的，`currentRenderingInstance` 是表本身，
// 拿不到本组件的 `data-v` 标记，普通 `<style scoped>` 规则一条都不会命中。
const cCol = (...vs: (import('vue').VNodeChild | null)[]) =>
  h('div', { class: 'glass-inputs-container' }, vs)
const sub = (label: string, ctrl: import('vue').VNodeChild | null) =>
  h('div', { class: 'glass-input-group' }, [
    h('div', { class: 'glass-input-label' }, label),
    ctrl == null ? null : h('div', { class: 'glass-input' }, [ctrl]),
  ])

const DOUBLE_DING_OPTS = ['正常', '单丁墙', '双丁墙', '上丁墙', '上丁加单丁', '上丁加双丁'].map((v) => ({
  label: v,
  value: v,
}))
// 单号列（只读，显示所属订单回执单号）
const orderNoCell = () =>
  h('span', { style: 'font-size:11px;color:#606266' }, order.receipt_no || '—')
// 金额列（平方+金额 同格）
// 金额格（原版 :2471-2492）：`金额：`（只读输入框）+ `平方数：`（只读输入框，右键改）
const moneyCell_2 = (l: Line) => cCol(sub('金额：', amountCell(l)), sub('平方数：', sqCell(l)))

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
    opsCol('平开门'),
    doorImgCol(),
    {
      title: '型材/颜色',
      key: 'profile_color',
      width: 118,
      render: (l) => cCol(sub('型材：', profileCell(l)), sub('颜色：', colorCell(l))),
    },
    {
      title: '单价/数量',
      key: 'unit_quantity',
      width: 96,
      render: (l) => cCol(sub('单价：', moneyCell(l, 'unit_price')), sub('数量：', intCell(l, 'quantity', 1))),
    },
    {
      title: '玻璃',
      key: 'glass',
      width: 128,
      render: (l) =>
        cCol(
          // 面玻标签**随公式类型变**（原版 :1992-1998：
          //   `formulaid && L.value[formulaid] ? (=== 'diamond' ? '门玻：' : '面玻：') : '面玻：'`）。
          sub(isDiamond(l) ? '门玻：' : '面玻：', glassSelectCell(l, 'face_glass')),
          // 底玻标签同样随公式类型变（原版 :2042-2048：钻石型 '固玻：'，否则 '底玻：'）。
          sub(isDiamond(l) ? '固玻：' : '底玻：', glassSelectCell(l, 'bottom_glass')),
          // 厚度一格**不分支**：原版此处恒为 '厚度：'，钻石型也照旧。
          // 平开表改厚度即「设为默认玻璃厚度」（原版 `ne`，:887）。
          sub(
            '厚度：',
            optCell(l, 'glass_thickness', glassThicknessOptions, (row) => {
              if (row.line_type === 'ping') rememberDefaultGlassThickness(row.glass_thickness)
              lineRefresh(row)
            }),
          ),
        ),
    },
    {
      // 原版这一列**没有 `label`**，标题完全由 header 插槽给出：
      //   `span.clickable-header(onClick=M)` 文本 `" 开向 "`（前后各一个空格）+ 设置图标。
      title: () =>
        h('span', { class: 'clickable-header', onClick: openOpenDirSettings }, [
          ' 开向 ',
          h('span', { style: 'font-size:11px' }, '⚙'),
        ]),
      key: 'open_dir',
      width: 132,
      render: (l) => {
        // ⚠️ 开向图要**先把自定义开向名还原成原始开向**再查表（原版 `ve.value[C(行["开向"])]`，
        //    `C` = `getOriginalOpenDirection`）。直接用显示名查会漏图。
        const img = PING_DIRECTION_IMAGES[getOriginalOpenDirection(l.direction)]
        return cCol(
          ...(colVis(pingColVis, 'casing')
            ? [sub('包边：', optCell(l, 'casing', pingCasingOptions(l), undefined, true, 'casing'))]
            : []),
          ...(colVis(pingColVis, 'track') ? [sub('锁具：', trackCell(l))] : []),
          sub('开向：', optCell(l, 'direction', pingDirectionOptions.value, undefined, true)),
          h('div', { class: 'image-cell2 image-cell2--ping' }, [
            img ? h('img', { src: img, alt: l.direction, class: 'direction-image' }) : null,
          ]),
        )
      },
    },
    // 原版 ping 表 门洞尺寸格（:2222-2348）从上到下：
    //   高度： → 宽度：/左宽： → ( 母门宽: ) → 墙厚：/门宽： → (右宽：, 钻石型) → (洞/净尺：)
    // `l.value` 那个三元（决定高/宽谁在前）在旧版恒走 key:0，即**高度在上**。
    {
      title: '门洞尺寸',
      key: 'door_size',
      width: 96,
      render: (l) =>
        cCol(
          sub('高度：', intCell(l, 'door_height')),
          // 门洞宽标签随公式类型变（原版 :2231-2236：钻石型 '左宽：'，否则 '宽度：'）。
          sub(isDiamond(l) ? '左宽：' : '宽度：', intCell(l, 'door_width')),
          // 母门宽：标签原文是 `" 母门宽: "`（**前后空格 + 半角冒号**），闸门是
          // `L.value[formulaid] === 'parentSubsidiary'`（子母门公式类型）。
          ...(needsMotherWidth(l) ? [sub(' 母门宽: ', intCell(l, 'mother_door_width'))] : []),
          // 墙厚一格也分支：钻石型显示 '门宽：'（仅 ping 表如此，diao 表恒为 '墙厚：'）。
          sub(isDiamond(l) ? '门宽：' : '墙厚：', wallThicknessCell(l)),
          // 钻石型时「亮窗总高」这个字段**搬进本列**并改名「右宽」（原版 :2314-2335）。
          // 非钻石时它在下面独立的「亮窗总高」列里 —— 两处互斥。
          ...(isDiamond(l) ? [sub('右宽：', intCell(l, 'light_window_height'))] : []),
          // ⚠️ 「洞尺」**不是独立列**，而是门洞尺寸格里的最后一块（原版 :2336-2346，
          //    `_["value"]["洞尺"]` 闸门 + `"洞/净尺："` 标签 + 下拉「洞尺/净尺」两项）。
          ...(colVis(pingColVis, 'hole_size')
            ? [sub('洞/净尺：', holeCell(l, PING_HOLE_SIZE_OPTS))]
            : []),
        ),
    },
    // 原版 ping 表里「吊脚」与「亮窗总高」是**两个独立列**（`Hui-d088417c` @86619 / @86995），
    // 槽内直接渲染输入框、无内嵌小标签。吊脚列由 `列显隐表['吊脚']` 闸门；亮窗总高列**无闸门**（原版如此）。
    {
      title: '吊脚',
      key: 'jiao',
      width: 62,
      render: (l) => intCell(l, 'jiao'),
    },
    {
      title: '亮窗总高',
      key: 'lightwin',
      width: 62,
      // 原版该列自带互斥条件：`L.value[formulaid] !== 'diamond'` 才渲染输入框，钻石型整格为空
      // （else 分支是 `createCommentVNode`）。无公式时渲染（与原版 `return true` 一致）。
      render: (l) => (isDiamond(l) ? null : intCell(l, 'light_window_height')),
    },
    // 原版「五金」（`["五金"]` 闸门）与「封板高」是两个独立列
    { title: '五金', key: 'hardware', width: 82, render: (l) => hardwareCell(l) },
    { title: '封板高', key: 'seal_board', width: 62, render: (l) => intCell(l, 'seal_board_height') },
    {
      title: '备注',
      key: 'remark',
      width: 110,
      render: (l) => cCol(sub('地址：', tCell(l, 'install_address')), sub('备注：', remarkCell(l))),
    },
    { title: '金额', key: 'money', width: 96, render: (l) => moneyCell_2(l) },
    markupCol(),
    // 原版平开表尾部列序：加价项目 → 计价方式 → 打折 → 前包加长 → 后包加长 → 单双丁 → 单号 → …
    { title: '计价方式', key: 'price_type', width: 74, render: (l) => optCell(l, 'price_type', priceTypeOptions) },
    { title: '打折', key: 'discount', width: 62, render: (l) => moneyCell(l, 'discount') },
    { title: '前包加长', key: 'front_casing', width: 84, render: (l) => intCell(l, 'front_casing_add') },
    { title: '后包加长', key: 'back_casing', width: 84, render: (l) => intCell(l, 'back_casing_add') },
    { title: '单/双丁墙体', key: 'double_ding', width: 96, render: (l) => optCell(l, 'double_ding', DOUBLE_DING_OPTS) },
    { title: '单号', key: 'order_no', width: 78, render: () => orderNoCell() },
    { title: '图片ID', key: 'image_id', width: 80, render: (l) => h('span', { style: 'font-size:11px;color:#606266' }, l.image_id || '—') },
    // 原版「客户」「客户编号」是**订单级**（行上无此字段），故取 order 而非 l
    { title: '客户', key: 'client', width: 88, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_name || '—') },
    { title: '客户编号', key: 'client_code', width: 84, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_code || '—') },
    { title: '其它费用', key: 'other_fee', width: 78, render: (l) => moneyCell(l, 'other_fee') },
  ]
}

function diaoCols(): DataTableColumn<Line>[] {
  return [
    selCol(),
    opsCol('移门'),
    doorImgCol(),
    {
      title: '型材/颜色',
      key: 'profile_color',
      width: 118,
      render: (l) => cCol(sub('型材：', profileCell(l)), sub('颜色：', colorCell(l))),
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
      width: 112,
      render: (l) =>
        cCol(
          // 原版 @181691：`el-tooltip :disabled="!e[…]" :content="e['生产进度']"` 包住单价输入框
          sub(
            '单价：',
            h(
              NTooltip,
              { disabled: !l.progress, trigger: 'hover' },
              { trigger: () => moneyCell(l, 'unit_price'), default: () => l.progress },
            ),
          ),
          sub('数量：', intCell(l, 'quantity', 1)),
          sub('套线单价：', moneyCell(l, 'casing_price')),
        ),
    },
    {
      title: '玻璃',
      key: 'glass',
      width: 128,
      render: (l) =>
        cCol(
          // 移门表**不分支**（原版 :4803-4870 恒为「面玻：/底玻：/厚度：」，无 diamond 变体）
          sub('面玻：', glassSelectCell(l, 'face_glass')),
          sub('底玻：', glassSelectCell(l, 'bottom_glass')),
          sub('厚度：', optCell(l, 'glass_thickness', glassThicknessOptions)),
        ),
    },
    {
      title: '扇数/开向',
      key: 'fans_dir',
      width: 124,
      render: (l) => {
        // 原版 :4962-4963 是 img 的 v-if = 「开向 && 图表[扇数+开向]」，class="direction-image"，
        // 图取自「扇数+开向」联合键（**不过 getOriginalOpenDirection**，与平开不同）。
        const img = diaoDirImage(l.fans, l.direction)
        return cCol(
          sub(
            '扇数：',
            optCell(l, 'fans', fansOptions, (x) => {
              lineRefresh(x)
              void resolveRow(x)
            }, true),
          ),
          sub('开向：', optCell(l, 'direction', directionSuffixOptions.value, undefined, true)),
          h('div', { class: 'image-cell2 image-cell2--diao' }, [
            img ? h('img', { src: img, alt: l.direction, class: 'direction-image' }) : null,
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
          // 原版 :4973-5000 这两格**都没有 v-if 闸门**，恒渲染。
          sub('轨道：', trackCell(l)),
          sub('套线：', casingCell(l)),
        ),
    },
    // 原版移门表 门洞尺寸格（:5003-5143）从上到下：高度： → 宽度： → 墙厚： → (洞/净尺：)
    // **没有母门宽、没有钻石型「右宽」**（那两格是平开表独有的）。
    // 决定高/宽先后顺序的那个三元在旧版恒走 key:0，即**高度在上**。
    {
      title: '门洞尺寸',
      key: 'door_size',
      width: 96,
      render: (l) =>
        cCol(
          sub('高度：', intCell(l, 'door_height')),
          sub('宽度：', intCell(l, 'door_width')),
          // 移门表墙厚标签**不分支**（原版恒为 '墙厚：'，:3458）
          sub('墙厚：', wallThicknessCell(l)),
          ...(colVis(diaoColVis, 'hole_size')
            ? [sub('洞/净尺：', holeCell(l, DIAO_HOLE_SIZE_OPTS))]
            : []),
        ),
    },
    // 原版「亮窗信息」列内含三格：亮窗总高 / 亮窗数量 / 封板高
    {
      title: '亮窗信息',
      key: 'lightwin',
      width: 98,
      render: (l) =>
        cCol(
          sub('亮窗总高：', intCell(l, 'light_window_height')),
          sub('亮窗数量：', intCell(l, 'light_window_count')),
          // 「封板高」也挂在 列显隐表['封板高'] 闸门上（原版 :5147 / :5165）
          ...(colVis(diaoColVis, 'seal_board') ? [sub('封板高：', intCell(l, 'seal_board_height'))] : []),
        ),
    },
    // 原版「五金」是独立列（`["五金"]` 闸门）
    { title: '五金', key: 'hardware', width: 82, render: (l) => hardwareCell(l) },
    {
      title: '备注',
      key: 'remark',
      width: 110,
      render: (l) => cCol(sub('地址：', tCell(l, 'install_address')), sub('备注：', remarkCell(l))),
    },
    { title: '金额', key: 'money', width: 96, render: (l) => moneyCell_2(l) },
    markupCol(),
    // 以下列序严格照原版：加价项目 → 上轨/边封 → 前包加长 → 后包加长 → 单双丁 →
    // 计价方式 → 打折 → 单号 → 图片ID → 客户 → 客户编号 → 其它费用
    {
      title: '上轨/边封',
      key: 'up_track_seal',
      width: 92,
      render: (l) => cCol(sub('轨道长：', intCell(l, 'track_length')), sub('边封数：', intCell(l, 'edge_seal_count', 2))),
    },
    { title: '前包加长', key: 'front_casing', width: 84, render: (l) => intCell(l, 'front_casing_add') },
    { title: '后包加长', key: 'back_casing', width: 84, render: (l) => intCell(l, 'back_casing_add') },
    { title: '单双丁', key: 'double_ding', width: 82, render: (l) => optCell(l, 'double_ding', DOUBLE_DING_OPTS) },
    { title: '计价方式', key: 'price_type', width: 74, render: (l) => optCell(l, 'price_type', priceTypeOptions) },
    { title: '打折', key: 'discount', width: 62, render: (l) => moneyCell(l, 'discount') },
    { title: '单号', key: 'order_no', width: 78, render: () => orderNoCell() },
    // 原版「图片ID」列不可编辑（只展示），故用只读 span
    { title: '图片ID', key: 'image_id', width: 80, render: (l) => h('span', { style: 'font-size:11px;color:#606266' }, l.image_id || '—') },
    // 原版「客户」「客户编号」是**订单级**（行上无此字段），故取 order 而非 l
    { title: '客户', key: 'client', width: 88, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_name || '—') },
    { title: '客户编号', key: 'client_code', width: 84, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_code || '—') },
    { title: '其它费用', key: 'other_fee', width: 78, render: (l) => moneyCell(l, 'other_fee') },
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
      // ⚠️ 这四个 Hui 界面上没有、也编辑不了，但**必须原样回传** —— PUT 是整头覆盖，
      // 少一个就抹空一个（实测见 `docs/home-audit/hui-save-clobber-check.mjs`）。
      install_address: order.install_address,
      order_no_set: order.order_no_set,
      production_status: order.production_status,
      lock_direction: order.lock_direction,
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
    // ⚠️ 四个「Hui 不显示但 Home 在写」的头字段必须读回来，否则保存时被整头覆盖抹空。
    // （`install_address` 原先就漏在这里 + 漏在载荷里，是同一个坑的另一半。）
    order.install_address = o.install_address
    order.order_no_set = o.order_no_set
    order.production_status = o.production_status
    order.lock_direction = o.lock_direction
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










// 原版：逐个订单行取「行安装地址」，为空则回填订单级安装地址；去重后以 **`_`** 连接（不是「、」）。

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







async function printLabels() {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  const rows = printApi.value.labelRows('lable')
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







async function printCurrentTemplate() {
  const mode = templatePreviewMode.value
  if (!mode) return
  try {
    const tpl = (await api.getPrintTemplatesByMode(mode))[0]?.template
    if (!tpl) {
      message.warning('未找到该模板')
      return
    }
    const { key, data, extra, wrap } = printApi.value.templatePayload(tpl, mode)
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
    const { key, data, extra, wrap } = printApi.value.templatePayload(tpl, mode, true)
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
    await printByMode('glass', { produces: printApi.value.glassProduces() })
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
    await printByMode('glassHole', { glassInfoList: printApi.value.glassInfoProduces() })
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
    await printByMode(mode, printApi.value.oldSheetProduces(mode === 'product3'))
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

// ---------------------------------------------------------------------------
// 打印载荷（Hui 这一单）—— 构造层已搬到 `utils/printPayloads.ts`，与 Home 批量打印共用。
// ---------------------------------------------------------------------------
const printCtx = computed<PrintContext>(() => ({
  order,
  lines: lines.value,
  formulas: formulas.value,
  clients: clients.value,
  tenantName: tenantName.value,
  maker: currentUserName.value,
  payQrcode: payQrcodeUrl.value,
  terminalLink: terminalLink.value,
  showPing: showPing.value,
  showDiao: showDiao.value,
  sortMethod: sortMethod.value,
  formulaImages: formulaImages.value,
  today: today(),
  onMarkupError: markupError,
}))
const printApi = computed(() => createPrintPayloads(printCtx.value))

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
/* 明细表格「一格多控件」的布局类，同样照抄 legacy/css/Hui-39b802eb.css。 */
:deep(.glass-inputs-container) {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
}
:deep(.glass-input-group) {
  display: flex;
  align-items: center;
  gap: 4px;
}
:deep(.glass-input) {
  flex: 1;
  min-width: 0;
}
/* 「 开向 」列表头是个可点链接（旧版 `.clickable-header{cursor:pointer;display:inline-flex;
   align-items:center;gap:4px;color:#409eff}`，hover #66b1ff） */
:deep(.clickable-header) {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #409eff;
}
:deep(.clickable-header:hover) {
  color: #66b1ff;
}
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
/* 表尾「 添加行 」按钮（旧版 `div.table-footer{margin-top:10px;display:flex;justify-content:center}`
   + `.custom-button-btn{background-color:#7caaf3;color:#fff;border-color:#7caaf3}`，hover #0965fa） */
.table-footer {
  margin-top: 10px;
  padding-bottom: 10px;
  display: flex;
  justify-content: center;
}
.table-wrap :deep(.custom-button-btn.n-button) {
  background-color: #7caaf3;
  border-color: #7caaf3;
  color: #fff;
}
.table-wrap :deep(.custom-button-btn.n-button:hover),
.table-wrap :deep(.custom-button-btn.n-button:focus) {
  background-color: #0965fa;
  border-color: #0965fa;
  color: #fff;
}
.table-wrap .table-head {
  padding: 6px 8px;
  background: #f7f8fa;
  border-bottom: 1px solid #ebeef5;
}
/*
 * 表头：照抄旧版 `legacy/css/Hui-39b802eb.css`
 *   .el-table__header-wrapper th{font-weight:700;background-color:#f0f9eb!important;color:#000!important;text-align:center!important}
 *   .el-table__header-wrapper .cell{font-weight:700;color:#000!important;text-align:center!important}
 * （我们原来是浅绿底 + 深绿字，旧版是**浅绿底 + 纯黑加粗居中**。）
 */
.table-wrap :deep(.n-data-table .n-data-table-th) {
  background: #f0f9eb;
}
.table-wrap :deep(.n-data-table .n-data-table-th .n-data-table-th__title) {
  font-size: 12px;
  font-weight: 700;
  color: #000;
  justify-content: center;
  text-align: center;
}
/*
 * 单元格内边距：旧版 `cell-style:{padding:"1px"}`（td 内联）+ `.el-table .cell{padding:2px 5px}`
 * + `.el-table__cell{padding-top:5px!important;padding-bottom:5px!important}`（覆盖内联）
 * ⇒ 实际 垂直 5+2=7px、水平 1+5=6px。naive-ui 没有 `.cell` 内层，合并成一条。
 */
.table-wrap :deep(.n-data-table .n-data-table-td) {
  padding: 5px 6px;
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
  /* 限高可滚：见模板里的说明 */
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 6px;
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
/* 未保存行 / 命中单号行高亮 —— 颜色照抄旧版：
   .el-table__row.unsaved-row>td.el-table__cell{background-color:#ffe6ef!important}
   hover → #ffd6e6；.highlight-matched-order → #d4edda / hover #c3e6cb */
.table-wrap :deep(.n-data-table .unsaved-row .n-data-table-td) {
  background: #ffe6ef;
}
.table-wrap :deep(.n-data-table .unsaved-row:hover .n-data-table-td) {
  background: #ffd6e6;
}
.table-wrap :deep(.n-data-table .highlight-matched-order .n-data-table-td) {
  background: #d4edda;
}
.table-wrap :deep(.n-data-table .highlight-matched-order:hover .n-data-table-td) {
  background: #c3e6cb;
}
/* 尺寸类数字输入红字（旧版 `.red-number-input .el-input__inner{color:red}`）：
   平开 门洞高/门洞宽/墙厚/钻石型「右宽」；移门 门洞高/门洞宽/墙厚/封板高。 */
.table-wrap :deep(.n-input-number.red-number-input .n-input__input-el),
.table-wrap :deep(.n-input.red-number-input .n-input__input-el) {
  color: red;
}
/*
 * 开向示意图。旧版靠 `.image-cell2` 的**百分比宽度**给图封顶：
 *   平开 `.image-cell2{width:70%;height:70%}` ／ 移门 `.image-cell2{width:50%;height:40%}`
 * 加上 `img.direction-image{max-width:100%;object-fit:contain}`。
 * ⚠️ 这两条 width 不能省：图是**原始尺寸**渲染的，而移门那批图最大到 **479×126**
 * （平开那批只有 80~115 宽），不封顶就会把整个格子撑爆。
 * 百分比高度对着 auto 高度的父元素等于没用，真正起作用的是 width —— 照抄即可。
 */
.table-wrap :deep(.image-cell2) {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto;
}
.table-wrap :deep(.image-cell2--ping) {
  width: 70%;
}
.table-wrap :deep(.image-cell2--diao) {
  width: 50%;
}
.table-wrap :deep(.direction-image) {
  max-width: 100%;
  object-fit: contain;
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
