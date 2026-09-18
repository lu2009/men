<template>
  <div class="home-container">
    <!-- 顶部：按钮组 + 搜索框 + 汇总信息条（仿旧版 search-section） -->
    <div class="header-container">
      <div class="toolbar-row">
        <n-button size="small" :loading="loading" @click="load">刷新</n-button>
        <!--
          「查询更多」（旧版工具栏按钮 `Home.formatted.js:11269-11273`，class `custom-search-btn`
          = `dr(1009)`，文案 `dr(1355)` = " 查询更多 "，onClick `ms`）。位置上旧版紧跟在「刷新」之后
          （中间那颗是终端视图专用的「电子回执单」，新版不做），所以放这儿。
        -->
        <n-button size="small" @click="openQuery">查询更多</n-button>
        <n-button
          size="small"
          :type="onlyUnproduced ? 'error' : 'default'"
          @click="onlyUnproduced = !onlyUnproduced"
        >
          {{ onlyUnproduced ? '未生产' : '显示全部' }}
        </n-button>
        <n-button
          size="small"
          :type="checkedRowKeys.length ? 'warning' : 'default'"
          @click="openPrint"
        >
          打印选中订单{{ checkedRowKeys.length ? `（${checkedRowKeys.length}）` : '' }}
        </n-button>
        <!--
          ⚠️ 自定义单据与标签的入口**不在这里** —— 它们在「打印选项」抽屉里。
          旧版工具栏**只有一个**按钮（工厂「打印选中订单」/ 终端「查看回执单」，onClick 是同一个 `Gi`），
          那 ~24 个单据入口（含 `自定义单据：` 分组）全在抽屉内。我们先前平铺在工具条上是偏离，
          2026-09-18 按用户要求改回原样。见 `docs/2026-09-17-home-print.md` §4。
        -->
        <n-button size="small" type="error" @click="deleteSelected">删除选中数据</n-button>
        <n-button size="small" type="success" @click="clearAccounts">清账</n-button>
        <!--
          「合并订单」（旧版 `:11287-11289`，class `custom-combine-btn`，文案 ` 合并订单 (N) `，
          onClick `Ii`）。**只在选中 ≥2 条时出现** —— 旧版是 `Fl.value.length>1 ? … : createCommentVNode`。
        -->
        <n-button
          v-if="checkedRowKeys.length > 1"
          size="small"
          class="custom-combine-btn"
          @click="combineSelected"
        >
          合并订单 ({{ checkedRowKeys.length }})
        </n-button>
        <span class="grow-spacer" />
        <n-button size="small" @click="dashboardShow = true">经营看板</n-button>
        <n-button size="small" type="primary" @click="router.push({ name: 'hui' })">汇算下单</n-button>
        <n-button size="small" @click="router.push({ name: 'clients' })">客户信息</n-button>
        <n-button size="small" @click="router.push({ name: 'formulas' })">公式管理</n-button>
        <n-button size="small" quaternary @click="onLogout">退出登录</n-button>
      </div>

      <div class="search-row">
        <n-input
          v-model:value="searchText"
          class="search-input"
          placeholder="搜索客户、安装地址等"
          clearable
        >
          <template #prefix>🔍</template>
        </n-input>
        <!--
          汇总条 = 旧版 `:11251` 那颗**二选一**的 `v-if/v-else-if`（同一行里就是这俩分支）：
            · 有搜索词（`Rc` 非空，`:11244`）→ 「 当前筛选: …」
            · **无搜索词**且 `_l.length > 0`（原始列表非空）→ 「 总计: N 条记录 …」
          两分支的**字段集与顺序完全相同**（旧版共用同一串 `dr` token）：
            时间 → 门数 → 总价 → 已付 → 未付 → 未付单数 → 未审核
          各自 token：`dr(1364)`=" | 时间: "、`dr(1444)`=" 总计: "、`dr(954)`=" | 门数: "、
          `dr(742)`=" | 总价: "、`dr(525)`=" | 未付: "、`dr(792)`="未付单数: "、`dr(1134)`="未审核: "，
          `已付` / `至` 是旧版模板里的字面量。两分支的数字都取自**筛选后**的列表（旧版 `ps`）。
          ⚠️ 旧版条件用的是 `_l`（原始列表）而不是 `ps`（筛选后），所以「筛选后为空但原始非空」时
             仍会显示一条「总计: 0 条记录」——照抄。
        -->
        <div v-if="searchText.trim()" class="summary-info">
          当前筛选: {{ searchText.trim() }}（{{ filtered.length }} 条结果）
          | 时间: {{ summary.earliest || '—' }} 至 {{ summary.latest || '—' }}
          | 门数: {{ summary.doors }} | 总价: {{ fmt(summary.total) }}
          | 已付: {{ fmt(summary.paid) }} | 未付: {{ fmt(summary.unpaid) }}
          | 未付单数: {{ summary.unpaidCount }} | 未审核: {{ summary.unaudited }}
        </div>
        <!--
          **无搜索词时的常驻汇总条**（旧版 `:11251` 那颗 `v-if/v-else-if` 的 else-if 分支）。
          两分支的**字段集与顺序完全相同**，只有开头一个是「当前筛选: X（N 条结果）」、
          一个是「总计: N 条记录」。
          ⚠️ 条件用的是 `rawOrders`（旧版 `_l`，**原始列表**）而不是 `filtered`（旧版 `ps`）——
             所以「筛选后为空但原始非空」时仍会显示一条「总计: 0 条记录」，**照抄**。
        -->
        <div v-else-if="rawOrders.length > 0" class="summary-info">
          总计: {{ filtered.length }} 条记录
          | 时间: {{ summary.earliest || '—' }} 至 {{ summary.latest || '—' }}
          | 门数: {{ summary.doors }} | 总价: {{ fmt(summary.total) }}
          | 已付: {{ fmt(summary.paid) }} | 未付: {{ fmt(summary.unpaid) }}
          | 未付单数: {{ summary.unpaidCount }} | 未审核: {{ summary.unaudited }}
        </div>
        <div v-else-if="rawOrders.length" class="summary-info">
          总计: {{ filtered.length }} 条记录
          | 时间: {{ summary.earliest || '—' }} 至 {{ summary.latest || '—' }}
          | 门数: {{ summary.doors }} | 总价: {{ fmt(summary.total) }}
          | 已付: {{ fmt(summary.paid) }} | 未付: {{ fmt(summary.unpaid) }}
          | 未付单数: {{ summary.unpaidCount }} | 未审核: {{ summary.unaudited }}
        </div>
      </div>
    </div>

    <!-- 订单主表 -->
    <div class="table-container">
      <n-data-table
        ref="tableRef"
        :columns="columns"
        :data="paged"
        :row-key="(row: OrderSummaryDto) => row.id"
        :loading="loading"
        :max-height="tableHeight"
        :scroll-x="1750"
        :checked-row-keys="checkedRowKeys"
        :expanded-row-keys="expandedRowKeys"
        :row-class-name="rowClass"
        :bordered="false"
        size="small"
        @update:checked-row-keys="onCheckedKeys"
        @update:expanded-row-keys="onExpandedKeys"
        @update:filters="onUpdateFilters"
      />
    </div>

    <!-- 分页 -->
    <div class="pagination-container">
      <n-pagination
        v-model:page="page"
        :page-size="pageSize"
        :item-count="filtered.length"
        :page-sizes="[10, 20, 50, 100, 200]"
        show-size-picker
        :display-order="['size-picker', 'pages']"
        @update:page-size="onPageSizeChange"
        @update:page="onPageChange"
      >
        <!--
          旧版 `layout: "total,sizes,prev, pager, next"`（`:11607`，`s(531)`）——
          顺序是「共 N 条 → 每页条数 → 上一页/页码/下一页」，**没有跳页输入框**（E3）。
          naive 的默认 `displayOrder` 是 `["pages","size-picker","quick-jumper"]` ⇒
          ① 用 `#prefix` 补「共 N 条」（Element 的 `total` 文案就是「共 {total} 条」）；
          ② `display-order` 把 size-picker 提到 pages 前面；
          ③ **不传** `show-quick-jumper`（旧版没有那把输入框；先前新版反而有、且没有总数 —— 正好反过来）。
        -->
        <template #prefix>共 {{ filtered.length }} 条</template>
      </n-pagination>
    </div>

    <!--
      单元格 hover tooltip（旧版 `:11600-11605` 的 `Teleport to="body"`）。
      样式逐字取自旧版那串内联样式；位置只在**进入单元格那一刻**取一次（旧版的跟手函数 `Va` 是死码）。
    -->
    <Teleport to="body">
      <div v-if="rowTipShow" ref="rowTipEl" class="row-tip" :style="rowTipInitStyle">
        <div v-for="(l, i) in rowTipLines" :key="i">
          <span :style="{ color: l.done ? '#52c41a' : '#bbb' }">
            {{ (l.done ? '✓' : '○') + '\u00a0' + l.text }}
          </span>
        </div>
        <div v-if="rowTipPaid">
          <span style="color: #52c41a; font-weight: 700">✓ 已付清</span>
        </div>
      </div>
    </Teleport>

    <!-- 改客户名弹窗 -->
    <n-modal
      v-model:show="renameShow"
      preset="card"
      title="修改客户名称"
      style="width: 460px"
    >
      <n-form label-placement="left" label-width="90">
        <n-form-item label="原客户">
          <n-input :value="renameTarget?.client_name" disabled />
        </n-form-item>
        <n-form-item label="修改为">
          <n-input v-model:value="renameValue" placeholder="新客户名称" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button size="small" @click="renameShow = false">取消</n-button>
          <n-button size="small" type="primary" @click="submitRename">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 修改下单日期弹窗 -->
    <n-modal
      v-model:show="dateShow"
      preset="card"
      title="修改下单日期"
      style="width: 400px"
    >
      <n-form label-placement="left" label-width="90">
        <n-form-item label="原日期">
          <n-input :value="dateTarget?.order_date" disabled />
        </n-form-item>
        <n-form-item label="新日期">
          <n-date-picker v-model:value="dateValue" type="date" style="width: 100%" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button size="small" @click="dateShow = false">取消</n-button>
          <n-button size="small" type="primary" @click="submitDate">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!--
      「手动更新进度」弹窗（旧版 §4.7 `Ha`，`:510090` 区）：点「打单操作」格子打开。
      宽 460px / label-width 110px（旧版 `dr(1294)` / `dr(1335)`）；四个控件逐条对齐旧版：
      回执单号(disabled) · 操作名称(autocomplete，失焦入库、右键删自定义项) · 日期 · 记录日期(持久化偏好)。
      第 4 项旧版是 `<el-form-item label=" ">` 占住那 110px 的 label 列，让勾选框与上面输入框左对齐 —— 照抄。

      ⚠️ `:auto-focus="false"` 是**对齐旧版**，不是随手关的：
      旧版 `el-dialog` 的 focus-trap 硬编码 `"focus-start-el": "container"`
      （`element-plus/es/components/dialog/src/dialog.vue_vue_type_script_setup_true_lang.mjs`）
      ⇒ 开窗时焦点落在**容器**上，**没有任何输入框被聚焦**。
      Naive 的 `n-modal` 相反（focus-trap `autoFocus` 默认 `true` 且没给 `initialFocusTo`
      ⇒ `resetFocusTo('first')`），而本弹窗第一个可聚焦控件是「操作名称」（回执单号 disabled）。
      两者一叠加就出事：开窗即聚焦 ⇒ 聚焦即弹（`:get-show`）⇒ **下拉在弹窗入场动画途中自己弹出来**，
      浮层按动画中途的位置算 ⇒ 看着还偏。关掉它，下拉就只在**用户真的点进输入框**时才弹。
    -->
    <n-modal
      v-model:show="manualShow"
      preset="card"
      title="手动更新进度"
      style="width: 460px"
      :auto-focus="false"
    >
      <n-form label-placement="left" label-width="110" label-align="right">
        <n-form-item label="回执单号">
          <n-input :value="manualTarget?.receipt_no || ''" disabled />
        </n-form-item>
        <n-form-item label="操作名称">
          <n-auto-complete
            :value="manualName"
            :options="manualNameOptions"
            :input-props="manualNameInputProps"
            :get-show="AUTOCOMPLETE_ALWAYS_SHOW"
            placeholder="选择或输入操作名"
            clearable
            @update:value="(v: string | null) => (manualName = v ?? '')"
            @select="(v: string) => (manualName = v)"
            @blur="onManualNameBlur"
          />
        </n-form-item>
        <n-form-item label="日期">
          <n-date-picker
            v-model:value="manualDate"
            type="date"
            placeholder="选择日期"
            clearable
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label=" ">
          <n-checkbox
            :checked="manualRecordDate"
            @update:checked="onRecordDateChange"
          >
            记录日期
          </n-checkbox>
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button size="small" @click="closeManualProgress">取消</n-button>
          <!-- 旧版这颗是 `type="danger"`；Naive 没有 danger，红色对应 `error`（有意偏离：仅取名差异）。 -->
          <n-button size="small" type="error" @click="deleteManualProgress">删除</n-button>
          <n-button size="small" type="primary" @click="submitManualProgress">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!--
      「查询更多」弹窗（审计 C21；旧版 `:12118-12176`，`el-dialog` 标题 `dr(980)`=「查询订单」，width 500px）。
      字段与两侧证据逐条对齐（旧版顺序 = 客户 → 安装地址 → 起始日期 → 结束日期 → 只含生产单）：
        · 客户       仅 `Yt`（工厂）时显示；新版恒工厂 ⇒ 恒显示（`:12135`）
        · 安装地址   仅 `rl` 时显示；`rl` 恒 true（弹窗只由 `ms` 开，见脚本区注释）⇒ 恒显示（`:12147`）
        · 起始日期   `value-format:"YYYY-MM-DD"` + 快捷项 `Ds`（今天/昨天/一周前），默认 = 去年今天
        · 结束日期   同上，默认 = 今天；两个 picker **各自**挂一份快捷项（旧版 `:12153` 与 `:12160` 各一份）
        · 只含生产单 `Vs.includeProductionOrder`（`:12166`）
      footer：取消 + 「确认」(`ys`)。「确认统计」(`vs`) 分支在旧版不可达，不实现（见脚本区注释）。

      ⚠️ `:auto-focus="false"` 同「手动更新进度」弹窗 —— 旧版 `el-dialog` 只聚焦容器，
      这里若让 Naive 聚焦第一个控件，客户 autocomplete 会在开窗瞬间自己弹下拉（理由详见上一处注释）。
    -->
    <n-modal
      v-model:show="queryShow"
      preset="card"
      title="查询订单"
      style="width: 500px"
      :auto-focus="false"
    >
      <n-form label-placement="left" label-width="100">
        <n-form-item label="客户">
          <!--
            客户框是 `type: "autocomplete"`，旧版带 `trigger-on-focus` + `clearable`。
            ⚠️ Naive 的 `n-auto-complete` 清空时 `update:value` 抛的是 **null**（`handleClear` →
            `doUpdateValue(null)`），所以要显式收口成空串，别用 `v-model:value` 直接绑 `string`。
          -->
          <n-auto-complete
            :value="queryForm.client"
            :options="clientSuggestions"
            :get-show="AUTOCOMPLETE_ALWAYS_SHOW"
            placeholder="输入客户信息"
            clearable
            @update:value="(v: string | null) => (queryForm.client = v ?? '')"
          />
        </n-form-item>
        <n-form-item label="安装地址">
          <n-input v-model:value="queryForm.address" placeholder="请输入安装地址" clearable />
        </n-form-item>
        <n-form-item label="起始日期">
          <n-date-picker
            v-model:value="queryForm.startTs"
            type="date"
            :shortcuts="DATE_SHORTCUTS"
            placeholder="选择起始日期"
            clearable
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="结束日期">
          <n-date-picker
            v-model:value="queryForm.endTs"
            type="date"
            :shortcuts="DATE_SHORTCUTS"
            placeholder="选择结束日期"
            clearable
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="只含生产单">
          <n-checkbox v-model:checked="queryForm.onlyProduction">只含生产单</n-checkbox>
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button size="small" @click="queryShow = false">取消</n-button>
          <n-button size="small" type="primary" :loading="queryLoading" @click="submitQuery">
            确认
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- 财务抽屉（§5 FinanceDrawer） -->
    <FinanceDrawer v-model:show="financeShow" :order="financeOrder" @saved="onFinanceSaved" />

    <!-- 打印选项抽屉（§4.2 打印选中订单） -->
    <!--
      「打印选项」抽屉只列入口；点了 hiprint 模板走 `openMode` → 下面的预览弹窗，
      点了自绘单据走 `openDoc` → 各自那张的抽屉（见 `onOpenDoc`）。
    -->
    <PrintDrawer
      v-model:show="printShow"
      :orders="printOrders"
      @open-mode="onOpenMode"
      @open-doc="onOpenDoc"
      @open-receipt-other="onOpenReceiptOther"
    />

    <!--
      「回执单-其它」（旧版「打印选项」抽屉顶部的第二颗，`Nn` :8184）：
      手动打印 / 复制 / 分享 / 下载 四颗单据动作，**没有预览**
      （旧版还有第五颗「直接打印回执单」，是云中转/hiprint 客户端静默打印，新版无载体 ⇒ 略，见组件头注释）。
      旧版它是「打印选项」抽屉里**嵌套**的第二层抽屉；新版按本文件 `onOpenDoc` 的口径先关外层再开。
    -->
    <ReceiptOtherDialog v-model:show="receiptOtherShow" :orders="receiptOtherOrders" />

    <!-- 打印预览弹窗（旧版那个 `el-dialog`，宽 1180px）：预览 + 该单据的操作栏 -->
    <PrintPreviewDialog
      v-model:show="previewShow"
      :orders="printOrders"
      :mode="previewMode"
      :title="previewTitle"
      :auto-line-numbers="previewAutoLineNumbers"
    />

    <!-- 收据单2（§旧版 ic=12 的自绘单据）：与打印抽屉并列的另一个入口 -->
    <Receipt2Dialog v-model:show="receipt2Show" :orders="receipt2Orders" />

    <!-- 自定义玻璃合片单（旧版 ic=16）：入口文案取自 `dr[529]` = ` 自定义玻璃合片单 ` -->
    <GlassSheet2Dialog v-model:show="glassSheet2Show" :orders="glassSheet2Orders" />

    <!-- 自定义生产单2（旧版 ic=15）：与玻璃合片单同属 C 家族，差在行数据来源与列集 -->
    <ProductionSheet2Dialog v-model:show="productionSheet2Show" :orders="productionSheet2Orders" />

    <!-- 自定义生产单（旧版 ic=14）：B 家族，行数据来自 oldSheetProduces() -->
    <ProductionSheetDialog v-model:show="productionSheetShow" :orders="productionSheetOrders" />

    <!--
      自定义合格标签族（旧版 ic=13）：**三个入口共用这一个抽屉**，只差 `entry`（= 行过滤）。
      旧版三个 handler 打开的就是同一个组件实例（施工图 §6.1 CONFIRMED），新版照此。
    -->
    <QualifiedLabelDialog
      v-model:show="qualifiedLabelShow"
      :orders="qualifiedLabelOrders"
      :entry="qualifiedLabelEntry"
    />

    <!-- 经营看板（§1.2 DashboardBigScreen，数据全部来自前端订单列表） -->
    <DashboardBigScreen v-model:show="dashboardShow" :orders="dashboardOrders" />

    <!-- 展开行明细表的四个弹窗（新增加价项目 / 修改平方数 / 门图预览 / 门图名字）。
         与 Hui 页挂的是**同一个组件**（状态在 `useDetailLineDialogs`）。 -->
    <DetailLineDialogs :d="homeDialogs" />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  h,
  nextTick,
  onMounted,
  reactive,
  ref,
  watch,
  type InputHTMLAttributes,
  type Ref,
} from 'vue'
import { useRouter } from 'vue-router'
import {
  NAutoComplete,
  NButton,
  NCheckbox,
  NDataTable,
  NDatePicker,
  NDivider,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NPopover,
  NSpin,
  useDialog,
  useMessage,
  type DataTableColumns,
  type DataTableFilterState,
  type DataTableInst,
  type DataTableRowData,
  type DataTableRowKey,
} from 'naive-ui'
import { api } from '../api/client'
import { LS, useOrderLines } from '../composables/useOrderLines'
import { useDetailLineDialogs } from '../composables/useDetailLineDialogs'
import type { Line } from '../utils/partsEngine'
import { useAuthStore } from '../stores/auth'
import FinanceDrawer from '../components/FinanceDrawer.vue'
import DashboardBigScreen from '../components/DashboardBigScreen.vue'
import PrintDrawer from '../components/PrintDrawer.vue'
import DetailLinesTable from '../components/DetailLinesTable.vue'
import DetailLineDialogs from '../components/DetailLineDialogs.vue'
import PrintPreviewDialog from '../components/PrintPreviewDialog.vue'
import ReceiptOtherDialog from '../components/ReceiptOtherDialog.vue'
import Receipt2Dialog from '../components/Receipt2Dialog.vue'
import GlassSheet2Dialog from '../components/GlassSheet2Dialog.vue'
import ProductionSheet2Dialog from '../components/ProductionSheet2Dialog.vue'
import ProductionSheetDialog from '../components/ProductionSheetDialog.vue'
import QualifiedLabelDialog from '../components/QualifiedLabelDialog.vue'
import type { QualifiedLabelEntry } from '../components/qualifiedLabelUiProfile'
import type {
  ClientDto,
  OrderDto,
  OrderFinance,
  OrderHeadInput,
  OrderLineDto,
  FormulaDto,
  OrderLineInput,
  OrderSummaryDto,
} from '../api/types'

const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()

// ---------------------------------------------------------------------------
// 常量（文档 §2.2/§2.3/§3 口径）
// ---------------------------------------------------------------------------
// ⚠️ **顺序照抄旧版的渲染顺序**（C7/C13）：清除项（全部显示 / 显示全部）在**最后**。
//    旧版「未付」列头 `:11482-11507`：已付 → 未付 → 部分付 → 全部显示；
//    旧版「打单操作」列头 `:11547-11581`：4 固定项 → 分隔线 → 自定义项 → 显示全部。
const PAYMENT_OPTIONS = ['已付', '未付', '部分付', '全部显示']
const PAYMENT_CLEAR = '全部显示'
const PROGRESS_OPTIONS = ['已打生产单', '未打生产单', '已订玻璃', '未订玻璃']
const PROGRESS_CLEAR = '显示全部'
// 打单操作 5 固定步骤（§3 `ua`）：label + 完成色 + flex 比例。
const PROGRESS_STEPS = [
  { label: '确认下单', color: '#389e0d', flex: 1 },
  { label: '生产单', color: '#d48806', flex: 2 },
  { label: '玻璃订单', color: '#096dd9', flex: 2 },
  { label: '标签', color: '#c41d7f', flex: 2 },
  { label: '收据单', color: '#237804', flex: 2 },
]

// 「手动更新进度」弹窗 + 自定义进度项（旧版 §4.7，审计 G3–G11/B30/C12）。常量逐个有据：
//   `Na`（`:8036`）      = autocomplete 的 4 个固定候选
//   `wr`（`:7568`）      = localStorage 键：自定义操作项数组
//   `gr`（`:7568`）      = localStorage 键：`记录日期` 持久化偏好
//   `dr(1012)`（`:7968`）= 自定义进度段的颜色
//   `Bo`（`:7673`）      = 「打单操作」列头 popover 的 4 个固定项（新版把「显示全部」并进了同一个列表）
const MANUAL_ACTION_OPTIONS = ['玻璃订单', '生产单', '收据单', '确认生产']
const MANUAL_ACTIONS_KEY = 'home_manual_progress_actions'
const RECORD_DATE_KEY = 'home_manual_progress_record_date'
const CUSTOM_SEGMENT_COLOR = '#531dab'
const PROGRESS_FIXED_FILTERS = ['已打生产单', '未打生产单', '已订玻璃', '未订玻璃']
// `ua`（`:7964`）：自定义段总 flex = 3（5 个固定段 1+2+2+2+2 = 9，合计 12）。
const CUSTOM_SEGMENT_FLEX = 3

/**
 * Naive 的 `n-auto-complete` **默认「框里有值才弹」** —— `getShow` 缺省是 `!!value`
 * （`naive-ui/es/auto-complete/src/AutoComplete.mjs` 的 `mergedShowOptionsRef`），
 * 所以空框聚焦时什么都不显示。
 *
 * 旧版用的是 `el-autocomplete`，**聚焦即弹**：Home 里三处（`:12058` 客户编辑弹窗、
 * `:12097` 手动更新进度的「操作名称」、`:12141` 查询订单的「客户」）前两处逐字写了
 * `"trigger-on-focus":!0`，第三处没写 —— 而 Element Plus 这个 prop 的默认值就是 `true`
 * （`element-plus/es/components/autocomplete/src/autocomplete.mjs`，`triggerOnFocus.default = true`）。
 * 又因为 `Sa`/`jl` 在查询词为空时回的是**全量候选**（`Sa`：`e ? o.filter(...) : o`），
 * 旧版点进空框就能看到整份下拉。
 *
 * 传 `() => true` 把这层补回来。**不会**导致面板乱弹：Naive 真正决定显隐的是
 * `active = 本函数 && 聚焦中(canBeActivated) && 有候选`，失焦、选中、点面板外都会把它关掉；
 * 查询词滤不出候选时面板同样不弹（Naive 比旧版少一个「空面板」的瞬间，属有意）。
 */
const AUTOCOMPLETE_ALWAYS_SHOW = () => true

// ---------------------------------------------------------------------------
// 数据 / 加载
// ---------------------------------------------------------------------------
const loading = ref(false)
const rawOrders = ref<OrderSummaryDto[]>([])
// 财务摘要：{order_id → 未收金额}，供主表「未收 = 未收金额 ?? 总价-定金」口径（§7.1）。
const financeSummary = ref<Record<string, OrderFinance>>({})

async function load() {
  loading.value = true
  try {
    const [orders, summary] = await Promise.all([
      api.listOrders(),
      api.getOrderFinanceSummary().catch(() => ({})),
    ])
    rawOrders.value = orders
    financeSummary.value = summary
  } catch (e) {
    message.error((e as Error).message || '加载订单失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!(await auth.loadMe())) {
    router.push({ name: 'login' })
    return
  }
  load()
  // 展开行的明细表要 formulas（算料/候选）。旧版 Home 把整个 Hui 页面组件内嵌进来用它的；
  // 新版不那样做，自己拉一份。
  void api.listFormulas().then((f) => (homeFormulas.value = f)).catch(() => {})
})

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}

// ---------------------------------------------------------------------------
// 财务/进度口径（§7.1）
// ---------------------------------------------------------------------------
const fmt = (v: number) => (v ?? 0).toFixed(2)
// 未收金额：优先取财务摘要（服务端下发的「未收金额」），否则回退 总价-定金（§7.1）。
const unpaidOf = (r: OrderSummaryDto) => {
  const s = financeSummary.value[r.id]
  return s ? s.unpaid_amount : r.total_price - r.deposit
}

function paymentStatus(r: OrderSummaryDto): string {
  const unpaid = unpaidOf(r)
  if (unpaid <= 0) return '已付'
  if (r.total_price > 0 && unpaid >= r.total_price) return '未付'
  return '部分付'
}

function progressMatch(r: OrderSummaryDto, opt: string): boolean {
  const s = r.production_status || ''
  if (opt === '已打生产单') return s.includes('生产单')
  if (opt === '未打生产单') return !s.includes('生产单')
  if (opt === '已订玻璃') return s.includes('玻璃订单')
  if (opt === '未订玻璃') return !s.includes('玻璃订单')
  if (opt === '显示全部') return true
  // 旧版 `Ao`（`:7684-7686`）的收尾分支：`n.includes(a)` —— 自定义项按「打单操作里含该串」命中。
  return s.includes(opt)
}

// ---------------------------------------------------------------------------
// 筛选（§3.1：未生产 → 付款状态 → 进度 → 搜索文本）
// ---------------------------------------------------------------------------
const searchText = ref('')
const onlyUnproduced = ref(false)
const paymentFilter = ref('全部显示')
const progressFilter = ref('显示全部')

// ---------------------------------------------------------------------------
// 「查单号」（§3.2，旧版 `po`/`fo`/`ho`/`Co` @ `:7671`）
// ---------------------------------------------------------------------------
/** 生效中的查单号关键字（旧版 `po`）—— 参与筛选，也决定单元格显示哪一段。 */
const orderNoQuery = ref('')
/** 弹窗里输入框的内容（旧版 `fo`）。确认时会被补齐年份后缀后写回。 */
const orderNoInput = ref('')
/** 「恢复中…」标志（旧版 `ho`）—— 清除按钮在做收起动画期间显示这个字。 */
const orderNoRestoring = ref(false)
/** 「查单号」popover 的显隐（旧版 `Co`，受控，因为确认/清除都要主动关它）。 */
const orderNoPopShow = ref(false)

/**
 * 单号集 → 单号数组（旧版 `Uo`，`:7694-7697`）：
 * ```js
 * Uo = e => { const l = String(e ?? "").trim()
 *             return l ? l.split("_").map(x => String(x ?? "").trim()).filter(Boolean) : [] }
 * ```
 * ⚠️ **按下划线 `_` 切**（不是空白）。`backend/migrations/0018_home_order_head_fields.sql:4`
 * 的注释写的是「空格串」，与旧版源码不符 —— 这里沿用本文件对 `打单操作` 已经定下的口径
 * （**以旧版源码为准**，见 `progressPrefix` 上方那段说明），两处保持同一套。
 */
function splitOrderNos(v: unknown): string[] {
  const s = String(v ?? '').trim()
  if (!s) return []
  return s
    .split('_')
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
}
const orderNosOf = (r: OrderSummaryDto) => splitOrderNos(r.order_no_set)

/**
 * 单号集单元格显示什么（旧版 `To`，`:7699-7701`）：
 * ```js
 * To = e => { const l = So(e)                       // So = Uo(单号集)
 *             if (!l.length) return ""
 *             const o = String(po.value || "").trim().toLowerCase()
 *             return o ? (l.find(x => String(x||"").toLowerCase().startsWith(o)) || l[0] || "")
 *                      : (l[0] || "") }
 * ```
 * ⇒ **查单号生效时显示「以关键字开头的那一段」**，否则显示第一段。
 * （旧版 `:7700` 用的是 `startsWith`，不是 `includes` —— 别按「包含」理解。）
 */
function orderNoCell(r: OrderSummaryDto): string {
  const parts = orderNosOf(r)
  if (!parts.length) return ''
  const q = orderNoQuery.value.trim().toLowerCase()
  if (!q) return parts[0] || ''
  return parts.find((p) => p.toLowerCase().startsWith(q)) || parts[0] || ''
}

function matchSearch(r: OrderSummaryDto): boolean {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return true
  const fields = [
    r.client_name,
    String(r.deposit),
    String(r.total_price),
    r.install_address,
    r.remark,
    r.production_status,
    r.salesperson,
    r.order_date,
    r.receipt_no,
  ]
  return fields.some((f) => (f ?? '').toLowerCase().includes(q))
}

// 「查询更多」的结果集与其生效标志 —— 完整口径见下方「查询更多（审计 C21）」一节。
// 旧版 `ps` 的头一句就是 `gs.value ? ws.value : fs.value`（`:11153`/`:11172`，`fs` 读全量 `_l`）：
// **查询态下主表显示的是查询结果集，不是全量列表**。
const queryRows = ref<OrderSummaryDto[]>([])
const queryMode = ref(false)

const filtered = computed(() => {
  // 非管理员只看自己打的单（§3.1 `fs`）。
  let list = queryMode.value ? queryRows.value : rawOrders.value
  if (auth.user?.role !== 'admin') {
    list = list.filter((r) => r.creator_name === auth.user?.name)
  }
  if (onlyUnproduced.value) {
    list = list.filter((r) => !r.production_status || r.production_status.trim() === '')
  }
  // 查单号（旧版 `ps` 里紧跟「未生产」那一步，`:11160-11163` / `:11176-11179`）：
  // **单号集里任一段以关键字开头**即命中（`startsWith`，不是 `includes`）。
  if (orderNoQuery.value) {
    const q = orderNoQuery.value.toLowerCase()
    list = list.filter((r) => orderNosOf(r).some((s) => s.toLowerCase().startsWith(q)))
  }
  if (paymentFilter.value !== '全部显示') {
    list = list.filter((r) => paymentStatus(r) === paymentFilter.value)
  }
  if (progressFilter.value !== '显示全部') {
    list = list.filter((r) => progressMatch(r, progressFilter.value))
  }
  list = list.filter(matchSearch)
  // 列头筛选（C16–C18）。**有意偏离旧版**：旧版这一步发生在分页切片之后（只筛当前页、
  // 总数也不含它），新版放在这里 ⇒ **全量筛选、总数跟随**。见下方 `columnFilterState` 的说明。
  return list.filter(matchesColumnFilters)
})

// ---------------------------------------------------------------------------
// 列头原生筛选（C16–C18，旧版 `Home.formatted.js:7933-8003`）
// ---------------------------------------------------------------------------
/*
 * ⚠️ 顺序：旧版这套筛选**不在 `ps` 链里**，而是交给 el-table 自己在 `:data="Cs"` 上做 ——
 *    `:11296` `data:Cs.value`，而 `Cs` = `ps.slice(...)`（`:11180-11183`）。
 *    所以旧版是：筛选链（未生产→付款状态→进度→搜索）→ **分页切片** → 列头筛选，
 *    即**只筛当前页**；分页总数 `zs`（= `ps.length`）也不含它。
 *
 *    ★ **新版有意不照抄这一条**（用户 2026-09-18 拍板）：列头筛选并进 `filtered` 链 ⇒ 全量筛选、
 *      总数跟随。理由见 `matchesColumnFilters` 的注释 —— 旧版那个行为大概率是 bug。
 *
 * 选项取值来源：旧版 `ta`/`ma`/`wa` 全部读 `_l`（**全量**原始列表，`:7934`/`:7987`/`:7992`），
 * 不是当前筛选结果 —— 新版对应 `rawOrders`（连非管理员的「只看自己」过滤都不算在内，与旧版一致）。
 */
const columnFilterState = ref<DataTableFilterState>({})

// 旧版 `ta` 里 `unshift` 的哨兵（`:7937-7939`）：value = 字符串表 dr(1196) = "__EMPTY__"，
// text = dr(1470) = "未生产"。只挂在「打单操作」这一列上。
const EMPTY_FILTER_VALUE = '__EMPTY__'
const EMPTY_FILTER_LABEL = '未生产'

// Naive 的 `FilterOption` / `FilterOptionValue` 没有从包入口导出，这里按结构声明。
type ColumnFilterOption = { label: string; value: string | number }

// 旧版 `ta(prop)`（`:7933-7939`）= `new Set(_l.map(t => t[prop]))` → `Array.from` → `{text:v, value:v}`。
//   · 只做 distinct，**不排序**（保持首次出现顺序，`Set` 的插入序）；
//   · **不剔除空值**（空串同样会成为一个选项）；
//   · `text` 取原值，Element 用插值渲染 → 新版 `label` 取 `String(v)`，数值列显示一致。
function distinctOptions(pick: (r: OrderSummaryDto) => string | number): ColumnFilterOption[] {
  const seen = new Set<string | number>()
  const out: ColumnFilterOption[] = []
  for (const r of rawOrders.value) {
    const v = pick(r)
    if (seen.has(v)) continue
    seen.add(v)
    out.push({ label: String(v), value: v })
  }
  return out
}

// 旧版 `ma`（`:7986-7991`，已付列 `:11469`）：distinct 的是 **`co(row)` 金额数字**，不是「已付」标签。
// `co`（`:7660`）= `Ht && 已分配金额 != null ? 已分配金额 : 定金||0`；
// 新版财务摘要的 `allocated_amount`（后端注释即「已分配金额」，finance/service.rs:39-42）就是那个字段，
// 取不到摘要时回退 `定金||0` —— 与既有 `unpaidOf`（旧版 `so`）同构。
function paidOf(r: OrderSummaryDto): number {
  const s = financeSummary.value[r.id]
  return s ? s.allocated_amount : r.deposit || 0
}

// 旧版 `ga(value,row,column)`（`:7996-8002`）：
//   ① 打单操作列 + 哨兵值 → 该列值为空/纯空白即命中（`!v || (typeof v==='string' && v.trim()==='')`）；
//   ② 其余一律 `row[prop] === value` **严格相等**（不是模糊匹配，也不做类型转换）。
type TextFilterKey =
  | 'client_name'
  | 'order_date'
  | 'install_address'
  | 'production_status'
  | 'door_count'
  | 'total_price'
  | 'remark'
  | 'salesperson'
  | 'creator_name'

function textColumnFilter(key: TextFilterKey, value: string | number, row: OrderSummaryDto): boolean {
  if (key === 'production_status' && value === EMPTY_FILTER_VALUE) {
    const v = row.production_status
    return !v || (typeof v === 'string' && v.trim() === '')
  }
  return row[key] === value
}

// 旧版 `ya`（`:8003`）= `co(row)===e`；`fa`（`:8003`）= `so(row)===e`。
const paidColumnFilter = (value: string | number, row: OrderSummaryDto) => paidOf(row) === value
const unpaidColumnFilter = (value: string | number, row: OrderSummaryDto) => unpaidOf(row) === value

/**
 * 所有列头筛选的**合并判定**（多值 OR、列间 AND —— 与 naive / Element 的 `filter-multiple` 语义一致）。
 *
 * ★ **有意偏离旧版**：旧版把这一步交给 el-table 自己做，而它的 `:data` 是**分页切片**
 *   （`Home.formatted.js:11180-11183` 的 `Cs = ps.slice(...)`），所以旧版**只筛当前页**、
 *   分页总数（`zs = ps.length`）也不含列头筛选。
 *   新版放进 `filtered` 链 ⇒ 全量筛选、`item-count` 跟着变。
 *
 *   取舍理由：旧版那个行为大概率是 bug —— 勾「客户=张三」只筛出当前页里的张三、翻页结果又变，
 *   没人会那样预期。这正是 `docs/home-audit/00-summary.md` 里请用户拍板的那条，用户选了「做对」。
 *
 * 列定义的 `filter` 仍保留：naive 用它渲染勾选态，且它作用在**已筛过的**行上，等于空操作。
 */
function matchesColumnFilters(r: OrderSummaryDto): boolean {
  for (const key of TEXT_FILTER_KEYS) {
    const sel = columnFilterValues(key)
    if (sel.length && !sel.some((v) => textColumnFilter(key, v, r))) return false
  }
  const paid = columnFilterValues('deposit')
  if (paid.length && !paid.some((v) => paidColumnFilter(v, r))) return false
  const unpaid = columnFilterValues('unpaid')
  if (unpaid.length && !unpaid.some((v) => unpaidColumnFilter(v, r))) return false
  return true
}

/** 9 个文本列的 key（与列定义里的 `filterOptionValues` 一一对应）。 */
const TEXT_FILTER_KEYS: TextFilterKey[] = [
  'client_name',
  'order_date',
  'install_address',
  'production_status',
  'door_count',
  'total_price',
  'remark',
  'salesperson',
  'creator_name',
]

// 选项（受控列定义用量，`rawOrders`/`financeSummary` 变化时自动重算）。
const clientFilterOptions = computed(() => distinctOptions((r) => r.client_name))
const dateFilterOptions = computed(() => distinctOptions((r) => r.order_date))
const addressFilterOptions = computed(() => distinctOptions((r) => r.install_address))
const doorCountFilterOptions = computed(() => distinctOptions((r) => r.door_count))
const totalPriceFilterOptions = computed(() => distinctOptions((r) => r.total_price))
const remarkFilterOptions = computed(() => distinctOptions((r) => r.remark))
const salespersonFilterOptions = computed(() => distinctOptions((r) => r.salesperson))
const creatorFilterOptions = computed(() => distinctOptions((r) => r.creator_name))
// 打单操作：distinct 之后把哨兵 **unshift 到最前**（旧版 `:7937-7939`）。
const productionStatusFilterOptions = computed(() => {
  const opts = distinctOptions((r) => r.production_status)
  opts.unshift({ label: EMPTY_FILTER_LABEL, value: EMPTY_FILTER_VALUE })
  return opts
})
// 已付 / 未付（旧版 `ma` `:7986-7991` / `wa` `:7991-7995`）：选项同样是 distinct 的金额数字。
const paidFilterOptions = computed(() => distinctOptions(paidOf))
const unpaidFilterOptions = computed(() => distinctOptions(unpaidOf))

// 受控写法：Naive 2.45 的 n-data-table **没有表级 `filters` prop**，受控只能落在列的
// `filterOptionValues` 上（`use-table-data.mjs:58-68` 的 `mergedFilterStateRef`）。
// 不能用 `defaultFilterOptionValues` —— 那是非受控初值，之后组件内部状态说了算，会与
// `searchText`/`onlyUnproduced` 的「筛选即重算」预期打架。
function columnFilterValues(key: string): (string | number)[] {
  const v = columnFilterState.value[key]
  if (v == null) return []
  return Array.isArray(v) ? [...v] : [v]
}

// Naive 每次变更都会把**整个**筛选状态回抛（`FilterButton.mjs:68-69` `doUpdateFilters`）。
function onUpdateFilters(state: DataTableFilterState) {
  columnFilterState.value = { ...state }
}

const summary = computed(() => {
  const list = filtered.value
  let earliest = ''
  let latest = ''
  for (const r of list) {
    if (!earliest || r.order_date < earliest) earliest = r.order_date
    if (!latest || r.order_date > latest) latest = r.order_date
  }
  const doors = list.reduce((s, r) => s + r.door_count, 0)
  const total = list.reduce((s, r) => s + r.total_price, 0)
  // 已付（旧版 `as` `:10994-10996`）：`Σ (已分配金额 ?? 定金||0)` —— 与列头筛选用的
  // `paidOf`（旧版 `co`，`:7660-7662`）**同一个口径**，直接复用。
  const paid = list.reduce((s, r) => s + paidOf(r), 0)
  const unpaid = list.reduce((s, r) => s + unpaidOf(r), 0)
  const unpaidCount = list.filter((r) => unpaidOf(r) > 0).length
  const unaudited = list.filter(
    (r) => !r.production_status?.trim() && !r.order_no_set?.trim(),
  ).length
  return { earliest, latest, doors, total, paid, unpaid, unpaidCount, unaudited }
})

// ---------------------------------------------------------------------------
// 分页（§3.1 客户端分页，默认 50）
// ---------------------------------------------------------------------------
const page = ref(1)
const pageSize = ref(50)
// n-data-table 实例（只用来在翻页后复位滚动条，见 `onPageChange`）。
const tableRef = ref<DataTableInst | null>(null)
const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

// 翻页复位滚动条（旧版 `xs` `:11184-11195` 的收尾两句）：
//   `const l = document.querySelector(".table-container"); l && (l.scrollTop = 0)`
// ⚠️ 旧版只在**翻页**（`xs`）复位，**改页大小**（`Bs` `:11196-11206`）**不复位** —— 这里照抄，
//    所以挂在 `@update:page` 上而不是 `watch(page)`（改 page-size 时 Naive 会顺带改页，若用 watch 就会误复位）。
// ⚠️ 新版 `.table-container` 是 `flex:1; min-height:0`（**不是**滚动容器），真正滚动的是
//    n-data-table 因 `:max-height` 生成的内层 scrollbar（`.n-data-table-base-table-body`）。
//    旧版写 `.table-container` 能生效是因为它那条 CSS 是 `height:calc(100vh - 10px);overflow:hidden`
//    ——`overflow:hidden` 仍是滚动容器，能被子元素聚焦等程序化滚动。新版没有那层，
//    所以这里改用 n-data-table 暴露的 `scrollTo({ top: 0 })`（`DataTableInst`），
//    等价且不依赖内层 class 名。放在 `nextTick` 里：旧版是同步置 0，但它那层不参与重渲染；
//    Naive 换页要重渲染 body，渲染后置 0 才不会被 scrollbar 的 sync 覆盖。
function onPageChange() {
  // 页大小刚变过 ⇒ 这次 `update:page` 是 naive 的**夹页**，不是用户翻页 —— 不复位滚动条。
  if (pageSizeJustChanged) return
  void nextTick(() => {
    tableRef.value?.scrollTo({ top: 0 })
  })
}

/**
 * 页大小刚变过的一次性标志（同 tick 内有效）。见 `onPageSizeChange`。
 * 用普通变量而不是 ref：它不参与渲染，只做「同一次同步流程里传个话」。
 */
let pageSizeJustChanged = false

/**
 * 改页大小（旧版 `Bs`，`:11196-11206`）。
 *
 * ⚠️ 旧版末尾是 **`Kl.value = 1`（无条件回第 1 页）**。naive 不是：
 *    `pagination/src/Pagination.mjs` 的 `doUpdatePageSize` 只在
 *    `mergedPageCountRef.value < mergedPageRef.value`（当前页超出新页数）时才动 page，
 *    而且动的是 **`doUpdatePage(mergedPageCount)`——夹到最后一页，不是回第 1 页**。
 *    ⇒ 「第 3 页 → 换成 200/页」会停在原页码，必须显式置 1。
 *    （第二轮审计把 E6 记成「✅ 已做」是**错的**：那条 watch 里只有四个筛选条件，没有 `pageSize`。）
 *
 * ⚠️ `pageSizeJustChanged`：naive 那次夹页会**发 `update:page`**，而 `onPageChange` 里有滚动复位；
 *    旧版 `Bs` **不复位滚动条**（只有翻页 `xs` 复位）⇒ 得把它挡掉。
 *    naive 是先发 size 事件、再做夹页（同一个同步流程），所以在这里置真就能挡住那一次。
 */
function onPageSizeChange(size: number) {
  pageSize.value = size
  pageSizeJustChanged = true
  page.value = 1
  void nextTick(() => {
    pageSizeJustChanged = false
  })
}

watch([searchText, onlyUnproduced, paymentFilter, progressFilter], () => {
  page.value = 1
})

// 退出查询态：旧版 `Es`（搜索框 `onInput`，`:11099` 附近）与 `Ms`（`onClear`，`:11096-11100`）
// 都会把 `gs` 置回 `false` —— 即「用户一动搜索框就回到全量列表」。
// 新版 `n-input` 没有可用的输入事件钩子（`v-model:value` 下 `@update:value` 只在用户交互时发，
// 拿不到「是否用户触发」这层区别），改用 watch：只要框里的值不再是进查询态时写进去的那串就退出。
// 进查询态时 `submitQuery` 是先写 `querySearchPreset` 再写 `searchText`，所以那一次不会误退出。
watch(searchText, (v) => {
  if (v !== querySearchPreset.value) queryMode.value = false
})

// ---------------------------------------------------------------------------
// 行状态色（§3）
//
// 旧版一共 5 个状态色类，分三层挂钩，新版一一对应：
//   · **行级** `Qo`（`:7842-7849`，挂在 el-table 的 `row-class-name` 上）——`expanded-row` /
//     `loaded-row` / `paid-row` / `duplicate-order-row` ⇒ 新版 `rowClass()`，见「展开明细」一节末尾
//     （它同时依赖 `expandedRowKeys`，所以放在那边）。
//   · **单元格级** `Ls`（`:11221-11227`）——`date-audit` / `date-warning` ⇒ 下面 `dateCellClass()`。
//   · **单元格级** `.paid-customer`（`:11402-11404`）——挂在**客户列**的 `render` 上。
//
// ⚠️ **更正一条旧注释**：这里先前写着「`.paid-row`/`.paid-customer`/`.duplicate` 无清晰口径、
//    暂不实现」——**与源码不符**。口径全部写死在 `Zo`(`:7827`) / `Xo`(`:7830`) / `Vo`(`:7664`) /
//    `Qo`(`:7842`) 里，且 `legacy/css/Home-97d96482.css` 里是**活样式**（不是死码）。
//    `.paid-row` 现在仍不实现，但理由换成了真实的那个：**`grep -r paid-row legacy/` 零 CSS 命中**，
//    旧版加了类却没有对应规则，是不生效的死码。
// ---------------------------------------------------------------------------
/**
 * 日期单元格的状态类（旧版 `Ls`，`:11221-11227`）—— **两个类互斥**，且**挂在单元格上**（不是整行）。
 *
 * ```js
 * Ls = e => bs(e) ? "date-audit"                       // 未审核优先，命中就 return
 *                : (0 !== so(e) && 截止日期 &&
 *                   Math.floor((new Date(截止日期) - now) / 864e5) < 4) ? "date-warning"
 *                : ""
 * ```
 *
 * ⚠️ **与旧版对齐时踩过三处，别再改回去**：
 *   ① **`< 4` 没有下界** ⇒ **已逾期（负数）同样命中**。先前写成 `diff >= 0 && diff <= 4`，
 *      把逾期的排除了 —— 而逾期恰恰是最该标红的。
 *   ② **开区间** `< 4`，先前 `<= 4` 多含一天。
 *   ③ 要求 **`未收 != 0`**（已付清不加），先前完全不看付款状态。
 *   另：`Ls` 是**互斥**的（`date-audit` 命中就 return）；先前两个类可以同时命中，
 *      而 CSS 里 `.date-warning` 在后面 ⇒ 后者胜，于是「未审核 + 临近截止」的行颜色也错了。
 *
 * ⚠️ 层级：旧版 CSS 是 **cell 级**（`.date-audit` / `.date-warning`），挂在日期那一格上。
 *    先前用 `rowProps` 挂到了整行 —— 一并改成挂在日期单元格。
 */
function dateCellClass(r: OrderSummaryDto): string {
  if (isUnaudited(r)) return 'date-audit'
  const due = r.due_date
  if (!due || unpaidOf(r) === 0) return ''
  const [y, m, d] = due.split('-').map(Number)
  if (!y || !m || !d) return ''
  const diff = Math.floor((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000)
  return diff < 4 ? 'date-warning' : ''
}

/**
 * 「未审核」判据（旧版 `bs`）。`dateCellClass` 与「审核确认」按钮两处共用 —— 抽出来免得两处漂开。
 */
function isUnaudited(r: OrderSummaryDto): boolean {
  return !r.production_status?.trim() && !r.order_no_set?.trim()
}

// ---------------------------------------------------------------------------
// 内联编辑（§4.5：定金/安装地址/订单备注/业务员/打单人）
// ---------------------------------------------------------------------------
const editingId = ref<number | null>(null)
const draft = reactive<OrderHeadInput>({})

function startEdit(row: OrderSummaryDto) {
  editingId.value = row.id
  draft.client_code = row.client_code
  draft.client_name = row.client_name
  draft.phone = row.phone
  draft.brand = row.brand
  draft.order_date = row.order_date
  draft.production_days = row.production_days
  draft.deposit = row.deposit
  draft.remark = row.remark
  draft.salesperson = row.salesperson
  // `order_no_set` 不再抄进草稿 —— 它是服务端派生值（= 各行 line_no 去重后 `_` 连接），
  // 发回去也不会被采纳。见 `docs/2026-09-18-order-no-semantics.md` §6.B。
  draft.install_address = row.install_address
  draft.production_status = row.production_status
  draft.creator_name = row.creator_name
  draft.lock_direction = row.lock_direction
}

async function saveEdit() {
  if (editingId.value == null) return
  const id = editingId.value
  try {
    await api.updateOrderHead(id, { ...draft })
    message.success('修改成功')
    editingId.value = null
    await load()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  }
}

function cancelEdit() {
  editingId.value = null
}

// ---------------------------------------------------------------------------
// 改客户名 / 改日期（§4.4/§4.6，Phase 1 走 updateOrderHead 就地改）
// ---------------------------------------------------------------------------
const renameShow = ref(false)
const renameTarget = ref<OrderSummaryDto | null>(null)
const renameValue = ref('')

function openRename(row: OrderSummaryDto) {
  renameTarget.value = row
  renameValue.value = row.client_name
  renameShow.value = true
}

async function submitRename() {
  if (!renameTarget.value) return
  try {
    await api.updateOrderHead(renameTarget.value.id, { client_name: renameValue.value })
    message.success('修改成功')
    renameShow.value = false
    await load()
  } catch (e) {
    message.error((e as Error).message || '修改失败')
  }
}

const dateShow = ref(false)
const dateTarget = ref<OrderSummaryDto | null>(null)
const dateValue = ref<number | null>(null)

function openDate(row: OrderSummaryDto) {
  // 旧版 `:11412-11419`：**只有「打单操作」为空（未生产）才让改生产日期**，
  // 否则 `ElMessage.warning("已生产的单不能修改生产日期")` 并**不开弹窗**。
  // 判据逐字：`"" === (打单操作 ?? "").toString().trim()` 才放行。
  if ((row.production_status ?? '').toString().trim() !== '') {
    message.warning('已生产的单不能修改生产日期')
    return
  }
  dateTarget.value = row
  dateValue.value = row.order_date ? Date.parse(row.order_date) : null
  dateShow.value = true
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 「今天」的 **YYYY-MM-DD**，按**本地时区**（旧版口径：`getFullYear/getMonth/getDate`）。
 *
 * ⚠️ 别与 `legacyToday()` 混 —— 那个返回的是 date-picker 用的**时间戳**、且走 `toISOString()`（**UTC**）。
 * 跨层写日期一律用本函数（`submitDate` 早就自己拼了一份等价的，这里抽出来共用）。
 */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 「审核确认」（旧版 `Ba`/`Ma`/`rn`，`:476268-476400`，审计 `02-actions.md` G2）。
 *
 * 旧版两步：① 把**下单日期改成今天**（`Ma` = 今天 → `rn()`，那条路会重算截止日期）；
 * ② `Hl("确认下单", [回执单号])` = `updataProgress`，把「确认下单」追加进进度串。
 *
 * ⚠️ 新版**不需要**手动重算截止日期 —— `due_date` 由 SQL 推导
 * （`orders/service.rs` 的 `HEADER_COLUMNS`：`order_date + production_days + 1`），改日期自动跟随。
 *
 * 进度串的追加沿用 `submitManualProgress` 那条既有通路（`headWithStatus` + `updateOrderHead`），
 * 不另开后端接口 —— 与「手动更新进度」写的是同一个字段。
 * 文案照旧版：成功 `dr(1279)`=「更新成功」。
 */
async function confirmAudit(row: OrderSummaryDto) {
  try {
    await api.updateOrderHead(row.id, {
      ...headWithStatus(row, '确认下单'),
      // ⚠️ **必须用本地日期，不能用 `legacyToday()`** —— 那个走 `toISOString()`（UTC）。
      // 旧版 `:11425-11426` 用的是本地 `getFullYear/getMonth/getDate`。
      // 实测（`TZ=Asia/Shanghai`）：本地 2026-09-18 03:00 时，
      //   走 `legacyToday()` 写的是 **2026-09-17**（早一天，推导出的截止日期也跟着早一天）；
      //   走本地口径写的才是 2026-09-18。
      // ⇒ UTC+8 每天 00:00–08:00 点「审核确认」，日期与截止日期都会错一天。
      order_date: localToday(),
    })
    message.success('更新成功')
    await load()
  } catch (e) {
    message.error((e as Error).message || '更新失败')
  }
}

/**
 * 「合并订单」（旧版 `Ii`，`Home.formatted.js:9190-9219`）。
 *
 * 旧版前端自己算存活单（按 `parseInt(回执单号)` 升序取最小）再 POST `{merged, record}`；
 * **新版只把 id 列表交给服务端**，存活单由服务端算 —— 见 `api.combineOrders` 的说明。
 * 所以这里的确认文案「以最早的回执单号为准」是**服务端真的会执行**的规则，不再是前端口头承诺。
 *
 * 文案逐字对齐旧版：确认框标题 `dr(1005)`=「合并订单确认」，
 * 正文 `"确定要合并选中的 N 条订单吗？" + dr(1224)`（=「…合并后将以最早的回执单号为准，合并后不可恢复。」）；
 * 选不满 2 条时 `dr(639)`=「请选择至少两条数据进行合并」（按钮本身只在 ≥2 条时出现，
 * 但键盘/程序化触发仍可能到这儿，保留守卫）。
 */
function combineSelected() {
  const ids = checkedRowKeys.value.map(Number)
  if (ids.length < 2) {
    message.warning('请选择至少两条数据进行合并')
    return
  }
  dialog.warning({
    title: '合并订单确认',
    content: `确定要合并选中的 ${ids.length} 条订单吗？合并后将以最早的回执单号为准，合并后不可恢复。`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.combineOrders(ids)
        checkedRowKeys.value = []
        await load()
        message.success('合并成功')
      } catch (e) {
        message.error((e as Error).message || '订单合并操作失败')
      }
    },
  })
}

async function submitDate() {
  if (!dateTarget.value || dateValue.value == null) return
  const d = new Date(dateValue.value)
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  try {
    await api.updateOrderHead(dateTarget.value.id, { order_date: iso })
    message.success('日期修改成功')
    dateShow.value = false
    await load()
  } catch (e) {
    message.error((e as Error).message || '修改失败')
  }
}

// ---------------------------------------------------------------------------
// 「查询更多」弹窗（审计 C21 —— 旧版唯一的**日期范围**筛选入口）
// ---------------------------------------------------------------------------
/*
 * 旧版坐标：
 *   · 入口按钮      `:11269-11273`（工具栏 ` 查询更多 `，class `custom-search-btn`，onClick `ms`）
 *   · 开弹窗        `:11029-11045`（`ms`：重置表单 → 开弹窗 → 顺手拉一次客户列表）
 *   · 弹窗模板      `:12118-12176`（`el-dialog` 标题 `dr(980)`=「查询订单」，width 500px）
 *   · 确认          `:11047-11120`（`ys`）
 *   · 结果并入主表  `:11078-11083`
 *
 * ⚠️ **审计 C22「查询更多的结果预览表」不存在**（已回源码核）：审计把 `:12132` **之前**那段
 *    认成了结果表格，但那其实是 **「手动更新进度」弹窗**（`dr(1017)`，width 460px，
 *    字段 = 回执单号/操作名称/日期/记录日期）。审计引的 `{key:0,label:"客户"}` / `{key:1,…安装地址}`
 *    是查询弹窗里两个 `el-form-item` 的 **`v-if` 分支 key**（`:12136`/`:12148`），不是表格列。
 *    旧版查询结果**没有**任何预览表，直接进主表（见下 `queryMode`）。故 C22 无落点，不实现。
 *
 * ⚠️ **`rl` 那个「确认统计」分支不实现**：同一只弹窗靠 `rl`（`:7599` `Vue.ref(!1)`）分两态 ——
 *    `rl=true` → 有「安装地址」+ 底部「确认」(`ys` → `getMoreTableDate`)；
 *    `rl=false` → 无「安装地址」+ 底部「确认统计」(`vs` → `getMoreOrders` → 直接出 PDF)。
 *    全组件里 `rl` **只在 `ms` 里被置 true**（`:11031`，它的唯一赋值点），弹窗也只在 `ms` 里开
 *    （`cs` 唯一的 `=!0` 也在 `:11031`）⇒ `rl=false` / `vs` / `getMoreOrders` 在旧版是**不可达的死分支**，
 *    新版不做不算漏。
 *
 * ⚠️ **`Yt`（工厂/终端视图开关）**：`Yt` 的赋值只有两处 —— 初值 `!0`（`:7581`）、
 *    终端视图时置 `!1`（`:7885`/`:8147`）。新版明确只做工厂视图（既有先例，见 `Home.vue:929` 注释），
 *    ⇒ `Yt` 恒真 ⇒ 「客户」字段**恒显示**（旧版 `:12135` 的 `Yt ? … : createCommentVNode`）。
 */
const queryShow = ref(false)
const queryLoading = ref(false)
/** 客户候选 = 旧版 `nl`（`getClientsInfo` 的结果，`ms` 里灌入）。旧版初值是 3 条假数据（张三/李四/王五），新版不播种。 */
const queryClients = ref<ClientDto[]>([])
const queryForm = reactive<{
  client: string
  address: string
  startTs: number | null
  endTs: number | null
  onlyProduction: boolean
}>({ client: '', address: '', startTs: null, endTs: null, onlyProduction: false })
/** 进查询态时写进搜索框的那串（旧版 `Rc`，`:11083`）。搜索框一旦被改动即退出查询态。 */
const querySearchPreset = ref('')

/**
 * 本地「今天 00:00」起算的 `offsetDays` 天前的时间戳（`n-date-picker` 的 model 是时间戳）。
 * 用它而不是 `Date.now() - n*86400000`：跨夏令时的地区后者会飘到前一天的 23 点。
 */
function dayStart(offsetDays = 0): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.getTime()
}

/**
 * 弹窗默认起始日期 = **去年今天**（旧版 `ds`，`:11024-11027`：
 * `t.setFullYear(t.getFullYear() - 1)` 后取 ISO 日期）；默认结束日期 = 今天（旧版 `ss`，`:11025`）。
 */
function yearAgoStart(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setFullYear(d.getFullYear() - 1)
  return d.getTime()
}

// 快捷项（旧版 `Ds`，`:11228-11241`）：今天 / 昨天 / 一周前，顺序与文案逐个对齐。
// ⚠️ 有意的写法差异：旧版 `Ds` 是 setup 里算好的**定值数组**，跨零点就会把「今天」选成昨天；
//    这里用函数形态（Naive 的 `shortcuts` 值可以是 `() => number`，点击时才求值）。
const DATE_SHORTCUTS: Record<string, () => number> = {
  今天: () => dayStart(0),
  昨天: () => dayStart(-1),
  一周前: () => dayStart(-7),
}

/** 时间戳 → 本地 `YYYY-MM-DD`（旧版 `value-format:"YYYY-MM-DD"`，Element 按本地日期格式化）。 */
function toIsoDate(ts: number | null): string {
  if (ts == null) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 旧版 `jl`（`:7644-7646`）：按 `name` 子串（不区分大小写）过滤 `nl`；查询词为空则给全量。
// Naive 的 `n-auto-complete` **没有**内置过滤（props 里没有 `filter`），候选要自己算 —— 口径与旧版一致。
const clientSuggestions = computed(() => {
  const q = queryForm.client.trim().toLowerCase()
  return queryClients.value
    .filter((c) => !q || (c.name ?? '').toLowerCase().includes(q))
    .map((c) => ({ label: c.name, value: c.name }))
})

/** 旧版 `ms`（`:11029-11045`）：重置表单 + 开弹窗 + 拉客户列表。 */
async function openQuery() {
  queryForm.client = ''
  queryForm.address = ''
  queryForm.startTs = yearAgoStart()
  queryForm.endTs = dayStart(0)
  queryForm.onlyProduction = false
  queryShow.value = true
  try {
    queryClients.value = await api.listClients()
  } catch {
    // 旧版此处文案 `dr(850)` =「初始化客户信息失败」。
    message.error('初始化客户信息失败')
  }
}

/** 旧版 `ys`（`:11047-11120`）：取数 → 过滤 → 并入主表 → 进查询态。 */
async function submitQuery() {
  queryLoading.value = true
  try {
    // ① 取数。旧版 URL 只有 4 个条件（`:11074`）：
    //    `param3=客户 &param4=安装地址 &param5=起始日期 &param6=结束日期`。
    //    旧版在 fetch 前还调了一次 `ts()`（`:11047`），那只是清 `es` 这张
    //    `getLatestClientsInfo` 的缓存（`:10986`）—— 新版没有这张缓存，无对应动作。
    let rows = await api.searchOrders({
      client_name: queryForm.client,
      install_address: queryForm.address,
      start_date: toIsoDate(queryForm.startTs),
      end_date: toIsoDate(queryForm.endTs),
    })

    // ② 非管理员只看自己打的单（旧版 `:11076` `!qt.value && (s = s.filter(t => t["打单人"] === _t.value))`）。
    //    必须在**并入主表之前**做：旧版并进 `_l` 的就是过滤后的 `s`，而列头筛选的候选值读的是 `_l`。
    if (auth.user?.role !== 'admin') {
      rows = rows.filter((r) => r.creator_name === auth.user?.name)
    }

    /*
     * ③ 只含生产单。
     * ⚠️ **有意偏离（旧版这颗 checkbox 在查询路径上是死的）**：旧版 `ys` 的 URL 只拼了
     *    param3–param6，**没有** `Vs.includeProductionOrder`（`:11074` 那一行）；
     *    该标志只被隔壁 `vs`（`getMoreOrders`）当 param6 用（`:11095`）。
     *    但弹窗里这颗 checkbox 名叫「只含生产单」，语义明确，摆着不动会被当成新版的 bug。
     *    这里按标签本义接上，口径取现有「已打生产单」（`progressMatch`，旧版 `Ao` `:7682`）——
     *    即 `打单操作` 含「生产单」。**如需 100% 照旧版（勾了等于没勾），删这 3 行即可。**
     */
    if (queryForm.onlyProduction) {
      rows = rows.filter((r) => progressMatch(r, '已打生产单'))
    }

    queryRows.value = rows
    queryMode.value = true

    // ④ 并入主表 `_l`（旧版 `:11078-11083`）：同 `回执单号` 的**替换**成查询回来的这条，
    //    新的**追加到末尾**（旧版这段不排序；`_l` 原本的降序只体现在原有行上）。
    //    注：新版两个接口（`/orders` 与 `/orders/search`）都是本租户全量，所以实际只会刷到已有行。
    const existing = new Set(rawOrders.value.map((r) => r.receipt_no))
    const byReceipt = new Map(rows.map((r) => [r.receipt_no, r]))
    rawOrders.value = [
      ...rawOrders.value.map((r) => byReceipt.get(r.receipt_no) ?? r),
      ...rows.filter((r) => !existing.has(r.receipt_no)),
    ]

    // ⑤ 搜索框回显「客户 地址」（旧版 `Rc = ((selectedClient||"")+" "+(selectedAddress||"")).trim()`，`:11083`）。
    // ⚠️ 照抄的旧版行为：`Rc` 会在 150ms 后灌进 `Fc`，而 `ps` 拿 `Fc` 做**整串** `includes` 过滤
    //    （`:11176-11179`，9 个字段 OR，不切词）。所以**同时填了客户和地址**时（"张三 幸福路1号"）
    //    没有任何字段能整串命中 ⇒ 查询结果会被搜成 0 行。只填日期、或只填客户则正常。
    //    这是旧版自身的缺陷，本轮按**保真优先**原样保留；要修的话改成两块分开 OR 即可。
    querySearchPreset.value = `${queryForm.client} ${queryForm.address}`.trim()
    searchText.value = querySearchPreset.value

    queryShow.value = false

    // ⑥ 财务字段（旧版 `:11085-11101`，仅在 `Yt && Ht`（工厂 + 启用财务）时执行）。
    //    新版没有 `Ht` 开关、财务恒开，而 `financeSummary` 又已被主表 `load()` 拉过一份 ——
    //    这里按查询的起始日期把窗口放大后重取一次，保证查出来的老单在「已付/未付」列上
    //    也能读到 `已分配金额`（否则回退成 总价-定金）。窗口只会变大，不会比 `load()` 的 60 天小。
    const startIso = toIsoDate(queryForm.startTs)
    if (startIso) {
      const days = Math.max(60, Math.ceil((Date.now() - Date.parse(startIso)) / 86400000))
      financeSummary.value = await api.getOrderFinanceSummary(days).catch(() => financeSummary.value)
    }
  } catch (e) {
    // 旧版失败文案 `dr(722)` =「查询数据失败」。
    message.error((e as Error).message || '查询数据失败')
  } finally {
    queryLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// 财务抽屉（§5 FinanceDrawer）
// ---------------------------------------------------------------------------
const financeShow = ref(false)
const financeOrder = ref<{
  id: number
  receipt_no: string
  client_code: string
  client_name: string
  total_price: number
} | null>(null)

function openFinance(row: OrderSummaryDto) {
  financeOrder.value = {
    id: row.id,
    receipt_no: row.receipt_no,
    client_code: row.client_code,
    client_name: row.client_name,
    total_price: row.total_price,
  }
  financeShow.value = true
}

async function onFinanceSaved() {
  await load()
}

// ---------------------------------------------------------------------------
// 打印选中订单（§4.2：工具栏 →「打印选项」抽屉 → 单据 × 预览/打印）
// ---------------------------------------------------------------------------
const printShow = ref(false)
const printOrders = ref<OrderDto[]>([])
/** 打印预览弹窗（旧版那个 `el-dialog`）：入口在「打印选项」抽屉里，点 hiprint 模板即开。 */
const previewShow = ref(false)
const previewMode = ref('')
const previewTitle = ref('')
/** 见 `calcSingleRowInExpand`：**算料**开着预览时**不许补号**（旧版算料不补）。 */
const previewAutoLineNumbers = ref(true)
/** 「回执单-其它」抽屉（旧版嵌套在「打印选项」里的第二层，`Mn`）。 */
const receiptOtherShow = ref(false)
const receiptOtherOrders = ref<OrderDto[]>([])
const receipt2Show = ref(false)
const receipt2Orders = ref<OrderDto[]>([])
const glassSheet2Show = ref(false)
const glassSheet2Orders = ref<OrderDto[]>([])
const productionSheet2Show = ref(false)
const productionSheet2Orders = ref<OrderDto[]>([])
const productionSheetShow = ref(false)
const productionSheetOrders = ref<OrderDto[]>([])
const qualifiedLabelShow = ref(false)
const qualifiedLabelOrders = ref<OrderDto[]>([])
/** 合格标签族的入口（三个按钮唯一的差别，见 `qualifiedLabelUiProfile.ts`）。 */
const qualifiedLabelEntry = ref<QualifiedLabelEntry>('all')

async function openPrint() {
  const ids = checkedRowKeys.value.map((k) => Number(k))
  if (!ids.length) {
    message.warning('请先勾选要打印的订单')
    return
  }
  // 已展开过的订单用缓存，其余现拉（旧版不补拉，没展开过就打空白 —— 这是有意的行为改进）。
  try {
    printOrders.value = await Promise.all(ids.map((id) => details[id] ?? api.getOrder(id)))
  } catch (e) {
    message.error((e as Error).message || '读取订单明细失败')
    return
  }
  printShow.value = true
}

/**
 * 「打印选项」抽屉里点了**自绘单据**的入口 —— 开对应的抽屉。
 *
 * 旧版工具栏只有一个按钮，那 ~24 个单据入口全在抽屉里（含 `自定义单据：` 分组），
 * 所以这一层是**入口分派**，与「打印选中订单」共用同一套选中订单。
 *
 * ⚠️ **复用 `printOrders`，不再重新请求** —— 打开打印抽屉时已经做过明细兜底
 * （未展开过的订单会 `getOrder` 补全），这里重复拉一遍是白费。
 *
 * ⚠️ **先关自己再开目标**：两个 `n-drawer` 都从右侧出，叠着会互相压。
 */
/**
 * 「打印选项」抽屉里点了 **hiprint 模板** → 开打印预览弹窗。
 *
 * 结构照原版：抽屉只列入口，点了设 `ic`（这里是 `mode`）并开预览弹窗，
 * 该单据的操作按钮栏长在**弹窗**里（见 `PrintPreviewDialog.vue`）。
 *
 * ⚠️ 与 `onOpenDoc` 一样**复用 `printOrders`**：打开打印抽屉时已做过明细兜底。
 */
function onOpenMode(mode: string, title: string) {
  printShow.value = false // 先关抽屉再开弹窗，两者都占屏幕
  previewAutoLineNumbers.value = true // 打印面照旧补号
  previewMode.value = mode
  previewTitle.value = title
  previewShow.value = true
}

/**
 * 「打印选项」抽屉顶部点了「回执单-其它」（旧版 `Nn`，:8184）。
 *
 * 旧版那里只是 `Mn.value = true` —— **外层抽屉不关**，第二层嵌套抽屉直接叠上去
 * （`append-to-body` + `direction:"rtl"` + `size:350`，与外层同宽同侧）。
 * 新版沿用本文件 `onOpenDoc` 的口径：先关外层再开 —— 两层 `n-drawer` 都从右侧出，叠着会互相压。
 *
 * 数据复用 `printOrders`（`openPrint` 已做过明细兜底），不重复请求。
 */
function onOpenReceiptOther() {
  receiptOtherOrders.value = printOrders.value
  printShow.value = false
  receiptOtherShow.value = true
}

function onOpenDoc(doc: string, entry?: string) {
  const orders = printOrders.value
  printShow.value = false

  const open = (
    target: typeof receipt2Orders,
    show: typeof receipt2Show,
  ) => {
    target.value = orders
    show.value = true
  }

  switch (doc) {
    case 'receipt2':
      open(receipt2Orders, receipt2Show)
      break
    case 'glassSheet2':
      open(glassSheet2Orders, glassSheet2Show)
      break
    case 'productionSheet2':
      open(productionSheet2Orders, productionSheet2Show)
      break
    case 'productionSheet':
      open(productionSheetOrders, productionSheetShow)
      break
    case 'qlabel':
      // 合格标签族三个入口共用同一个抽屉，只差 `entry`（= 行过滤）
      qualifiedLabelEntry.value = (entry ?? 'all') as QualifiedLabelEntry
      open(qualifiedLabelOrders, qualifiedLabelShow)
      break
  }
}

// ---------------------------------------------------------------------------
// 电子回执单（§6.2 ReceiptView / ReceiptShare）
// ---------------------------------------------------------------------------
function openReceipt(row: OrderSummaryDto) {
  if (!row.receipt_no) {
    message.warning('该订单没有回执单号，无法生成回执单')
    return
  }
  router.push({ name: 'receipt-view', params: { receiptNo: row.receipt_no } })
}

// ---------------------------------------------------------------------------
// 经营看板（§1.2 DashboardBigScreen）：全量订单（按角色过滤），看板内自带日期/客户/业务员筛选
// ---------------------------------------------------------------------------
const dashboardShow = ref(false)
const dashboardOrders = computed(() =>
  auth.user?.role !== 'admin'
    ? rawOrders.value.filter((r) => r.creator_name === auth.user?.name)
    : rawOrders.value,
)

// ---------------------------------------------------------------------------
// 删除选中（§4.3：先查财务记录，红冲，再删除）
//
// ⚠️ **红冲必须排在删除之前**（与旧版「先删后冲」的顺序相反，见下）：
//    `addOrderPayment`（本单收款那条腿）内部要 `order_finance(order_id)` 取「本单已分配金额」
//    做校验，订单删掉之后那个查询会 `not_found`。
//    顺带也更安全：红冲失败时订单还在，可以重试；反过来则会留下「删了但没冲」的孤儿。
// ---------------------------------------------------------------------------
const checkedRowKeys = ref<DataTableRowKey[]>([])

/**
 * 跨页全选（旧版 `Oo` `:7743-7759`，挂在 el-table 的 `onSelectAll` 上 —— 见 `:11300`
 * `onSelectAll:Oo`）。
 *
 * ⚠️ 先纠正一处审计误判：**旧版没有「工具栏全选 checkbox」**。`Oo` 是 el-table
 * **表头全选格**的事件处理函数；审计里当作「工具栏 checkbox 状态」的 `Ol`（`:7611`）
 * 全仓库只被**写**过、从没在 render 里被**读**过 —— 是死变量。
 *
 * 旧版语义（逐句）：
 *   ```js
 *   Oo = () => {
 *     Wl.value ? (Wl.value = false) : (Wl.value = true)      // 翻转「全选模式」开关
 *     if (Wl.value)  { Vn.clearSelection(); ps.forEach(r => Vn.toggleRowSelection(r, true)) }
 *     else           { Vn.clearSelection() }
 *     …再级联到展开行里的两张子表（新版无子表，随 A3 一起缺）
 *   }
 *   ```
 *   ElTable 的 `toggleRowSelection` 是**按行对象**进出 `selection` 数组的，不要求该行
 *   在当前页的 `data` 里 ⇒ 它一次就把**整个筛选结果 `ps`**（跨页）塞进选中集，
 *   这也是 `Fl`（选中行）/ 删除 `Si` 读到的集合。两个后果：
 *     ① 表头全选 = 选中**当前筛选结果的全部行**（不止当前页）；
 *     ② 之后翻页/改页大小，`xs`(`:11185-11193`) / `Bs`(`:11198-11206`) 会在 `nextTick` 里
 *        `clearSelection()` 后重新全选 `ps` —— 因为 el-table 换页会丢选择，得重刷。
 *   新版 `:checked-row-keys` 是**受控**的，且 Naive 的 TreeMate 对「不在当前 data 里的 key」
 *   只增不删（`treemate/es/check.js:166` `getExtendedCheckedKeySet` 以 `new Set(checkedKeys)`
 *   起步，扁平表 `treeNodeMap.get(key)` 取不到就跳过），所以 ② 那步重刷**不需要**了：
 *   key 一直在受控数组里，翻页后新页的勾选框自然勾上。
 *
 * 因此这里只保留 ① 的语义，`selectAllMode` 就是旧版那个 `Wl`（纯开关记忆，不参与渲染）：
 *   · 表头全选（`action === 'checkAll'`）/ 表头取消全选（`'uncheckAll'`）→ 翻转开关，
 *     开 → 选中**全部筛选结果**；关 → **清空全部**。
 *     （旧版是按 `Wl` 翻转决定清空/全选，而不是看表头 checkbox 当前状态 —— 例如「手动勾满
 *      当前页」时表头已显示为勾选，旧版点它仍是『置 Wl=true 并全选』，这里照抄。）
 *   · 单行勾选（`'check'` / `'uncheck'`）→ 用 Naive 回抛的 keys 原样写回。
 *
 * Naive 把动作类型放在 `update:checked-row-keys` 的**第三个参数**里
 * （`data-table/src/use-check.mjs:82-88` 的 `{ row, action }`），所以能精确区分，
 * 不需要「回抛的 keys 恰好等于本页 keys 就当成全选」这种会误伤手点的启发式。
 */
const selectAllMode = ref(false)

function onCheckedKeys(
  keys: DataTableRowKey[],
  // Naive 的 `OnUpdateCheckedRowKeys` 第二参是 `InternalRowData[]`（未从包根导出），
  // 这里用它导出的等价别名 `DataTableRowData`（`Record<string, any>`）。本函数用不到这个参数。
  _rows: DataTableRowData[],
  meta?: { row?: unknown; action?: 'check' | 'uncheck' | 'checkAll' | 'uncheckAll' },
) {
  if (meta?.action === 'checkAll' || meta?.action === 'uncheckAll') {
    selectAllMode.value = !selectAllMode.value
    checkedRowKeys.value = selectAllMode.value ? filtered.value.map((r) => r.id) : []
    return
  }
  checkedRowKeys.value = keys
}

/**
 * 删除选中（旧版 `Si` `:9224-9305`）。
 *
 * ⚠️⚠️ **旧版在删除前有一步「管理员密码二次校验」，新版【刻意未实现】—— 这里只留结论与出处，
 * 别照着补一个本地口令。** 回源码查证如下（`usePasswordVerify-b6115859.js`，即审计里的 `y(...)`）：
 *
 * ```js
 * // 旧版 `Si` 里（`:9229`，在「已选为空」判断之后、`自助下单||工厂` 守卫之前）：
 * if (!(await y("删除"))) return
 *
 * // `y` = `usePasswordVerify()` 的 `verifyPassword`（`Home.formatted.js:7568-7572`
 * //   `const { verifyPassword: y } = St()`，`St` 即该模块的 `u` 导出）。它的实现是：
 * verifyPassword: async (action = "操作", skipGate = false) => {
 *   const m = await getUserData()                       // index chunk 的 `g`
 *   if (!m) return ElMessage.error("无法获取用户数据"), false
 *   const registrant = m.userinfo.registrant
 *   // 只有写死的这 3 个租户才需要口令，其它租户直接放行：
 *   if (!skipGate && !["恒泰智门33", "恒祥门业", "临泉县品匠移门"].includes(registrant)) return true
 *   const { value: pwd } = await ElMessageBox.prompt(
 *     "请输入管理员密码以确认" + action + "操作", "身份验证",
 *     { confirmButtonText: "确认", cancelButtonText: "取消", inputType: "password",
 *       inputPlaceholder: "请输入密码",
 *       inputValidator: v => !(!v || v.trim().length === 0) || "密码不能为空" })
 *   // ↓ 关键：**服务端**校验，目标是【旧版生产域名】
 *   const r = (await axios.get("https://www.samrtdoor.com.cn/1", {
 *     params: { param1: "login", param2: registrant, param3: pwd } })).data[0]
 *   return !(!r || r.statu !== 1) || (ElMessage.error("密码错误，无权" + action), false)
 * }
 * // 取消：ElMessage.info("已取消" + action)；其它异常：ElMessage.error("验证请求失败，请重试")
 * // 返回 false ⇒ `Si` 那句 `if (!(await y(...))) return` 直接静默返回，不走后面的确认框。
 * ```
 *
 * 结论（逐条都有出处，非推测）：
 *   ① **不是本地口令**，是服务端校验：`GET https://www.samrtdoor.com.cn/1`，
 *      `param1=login`、`param2=<userinfo.registrant>`、`param3=<明文密码>`，
 *      成功判据是响应 `data[0].statu === 1`（旧版把 `status` 拼成了 `statu`）。
 *   ② 它**不是全租户生效**：写死 3 个租户名才弹窗，其余租户 `y` 直接 `return true`。
 *   ③ 弹窗文案 `"请输入管理员密码以确认" + action + "操作"`（action="删除"），
 *      标题 `"身份验证"`，按钮 `确认`/`取消`，密码框带一个「小眼睛」显隐切换
 *      （`usePasswordVerify` 里那段 DOM 注入，`:c()`）。
 *
 * **新版后端没有对应接口**（`backend/src/modules/auth/mod.rs` 只有
 * `/auth/login` `/auth/logout` `/auth/me` `/auth/change-password`，没有「拿租户名+口令换一次
 * 动作授权」这种），前端也没有任何一处调过这个旧域名（全仓库只有
 * `ReceiptEditDialog.vue:682` 的注释提到过它，那处同样是「刻意不发」）。
 * 因此**按本仓库既有口径不发这条跨系统请求**（同 `ReceiptEditDialog.vue:695-701` 的理由①：
 * 目标是旧版生产域名，从新版发出去是跨系统的对外写）。
 *
 * TODO(未确认): 待产品拍板后再补。三条候选路径，任选其一：
 *   (a) 新版后端加一个 `POST /api/v1/auth/verify-action`（校验当前用户口令，返回是否放行），
 *       前端只做弹窗 + 调它 —— 需先定「哪些租户/哪些动作要校验」是否还沿用那 3 个写死租户名；
 *   (b) 沿用旧域名转发 —— 需要先确认旧域名在可预见的将来仍可用、且允许新版跨域调用；
 *   (c) 明确不做（旧版这 3 个租户之外本来就不校验，去掉它不影响绝大多数租户）。
 * 在拍板之前，这里**保持无二次校验**，以免落一个「看起来在验、其实验不了」的假闸门。
 */
function deleteSelected() {
  const ids = checkedRowKeys.value.map(Number)
  if (ids.length === 0) {
    message.warning('请选择要删除的数据')
    return
  }

  // 先查财务记录，有红冲需求时提示（§A3：只对 >0 的合计取负）。
  api
    .checkOrderPayment(ids)
    .then((items) => {
      interface Group {
        code: string
        name: string
        allocated: number
        adjustment: number
        /** 该客户下**逐单**的红冲清单 —— 收款红冲必须逐单做，见下方 `onPositiveClick`。 */
        orders: { id: number; receipt: string; orderPaid: number; allocation: number }[]
      }
      const byCustomer = new Map<string, Group>()
      let totalAlloc = 0
      let totalAdj = 0
      for (const it of items) {
        const g =
          byCustomer.get(it.customer_code) ?? {
            code: it.customer_code,
            name: it.customer_name,
            allocated: 0,
            adjustment: 0,
            orders: [],
          }
        const receipt = rawOrders.value.find((o) => o.id === it.order_id)?.receipt_no ?? String(it.order_id)
        g.orders.push({
          id: it.order_id,
          receipt,
          orderPaid: it.order_paid_amount,
          allocation: it.allocation_amount,
        })
        if (it.allocated_amount > 0) {
          g.allocated += it.allocated_amount
          totalAlloc += it.allocated_amount
        }
        if (it.adjustment_amount > 0) {
          g.adjustment += it.adjustment_amount
          totalAdj += it.adjustment_amount
        }
        byCustomer.set(it.customer_code, g)
      }
      const groups = [...byCustomer.values()].filter((g) => g.allocated > 0 || g.adjustment > 0)

      let content = `确定删除选中的 ${ids.length} 条订单吗？删除后不可恢复。`
      if (totalAlloc > 0 || totalAdj > 0) {
        const lines = ['选中的订单有以下财务记录：']
        if (totalAlloc > 0) lines.push(`• 已分配收款 ¥${fmt(totalAlloc)}`)
        if (totalAdj > 0) lines.push(`• 订单抹零 ¥${fmt(totalAdj)}`)
        lines.push('删除订单时将自动进行红冲。')
        content = lines.join('\n')
      }

      dialog.warning({
        title: '删除确认',
        content,
        positiveText: '删除',
        negativeText: '取消',
        onPositiveClick: async () => {
          try {
            // ① 先红冲（顺序理由见本函数上方的说明）。
            //
            //  ⚠️ **收款红冲按「来源」拆成两条腿**，这是本文件与旧版唯一实质不同的一处：
            //     旧版把整笔「已分配收款」写成**一条客户级负收款**（`order_id = NULL`）。
            //     在我们的账务模型里那会**同一笔钱扣两次** ——
            //       净收款 = Σ finance_payments（按客户，含负数）              ← 负收款减的是它
            //       `已分配总额` = Σ finance_payments(order_id NOT NULL) + Σ finance_allocations
            //                                                  ↑ 只认带 order_id 的，减不到
            //     被删订单对 `已分配总额` 的贡献仍在（两处都按 order_id 聚合，订单删了行还留着）
            //     ⇒ 未分配余额多降 2×金额。实测（事务内 ROLLBACK）：
            //       池分配 300 的订单删掉后 700 → 400，正确应为 1000。
            //     所以：本单直接收款 → 带 `order_id` 的负收款（走 addOrderPayment，它的负数分支
            //     和「红冲金额绝对值不能超过本单已分配金额」那条校验就是为这个留的）；
            //           资金池分配   → 负的分配行（`reverseOrderAllocation`）。
            //     两条腿各自让「净收款」与「已分配总额」同额下降、或只降后者，未分配余额才算得对。
            //     ⚠️ 别拿接口上的 `实收金额` 来推这套账：它 2026-09-18 起是**累计充值**
            //     （只算客户级 `order_id IS NULL` 且只累加正数，红冲不减，对齐旧版 totalTopup），
            //     与「未分配余额」用的净收款不是同一个数，见 finance/service.rs 文件头的口径块。
            const payDate = new Date().toISOString().slice(0, 10)
            for (const g of groups) {
              for (const o of g.orders) {
                if (o.orderPaid > 0) {
                  await api.addOrderPayment(o.id, {
                    customer_code: g.code,
                    customer_name: g.name,
                    receipt_no: o.receipt,
                    amount: -o.orderPaid,
                    pay_date: payDate,
                    method: '其他',
                    remark: '删除订单红冲收款 ' + o.receipt,
                    use_prepay_discount: false,
                    discount_rate: 0,
                  })
                }
                if (o.allocation > 0) await api.reverseOrderAllocation(o.id)
              }
              // 抹零红冲**保持旧版原样**（客户级负调整），照抄旧版 C7。理由 2026-09-18 变了，
              // 结论没变：现在 `customer_balance` = max(0, Σ 逐单未收 − 客户调整合计)（对齐旧版
              // svc:763），**不再含订单调整那一项**。订单删掉后它就不再贡献「欠款」，而这条
              // 客户级负调整仍在 ⇒ 两边相抵后的数与旧版同式（旧版删单时 finance_orders 行
              // 一并消失，同样只剩客户调整）⇒ 冲在客户级才与旧版对得上，别改成订单级。
              if (g.adjustment > 0) {
                await api.addCustomerAdjustment(g.code, {
                  customer_code: g.code,
                  customer_name: g.name,
                  amount: -g.adjustment,
                  type: '删除订单冲销',
                  remark: '删除订单红冲抹零 ' + g.orders.map((o) => o.receipt).join(','),
                })
              }
            }
            // ② 再删除。
            for (const id of ids) await api.deleteOrder(id)
            message.success('删除成功')
            checkedRowKeys.value = []
            await load()
          } catch (e) {
            message.error((e as Error).message || '删除失败')
          }
        },
      })
    })
    .catch((e) => {
      message.error((e as Error).message || '查询财务记录失败')
    })
}

// ---------------------------------------------------------------------------
// 清账（全单回款，§5.4 C7：按客户分组，逐客户 finance_addPayment）
// ---------------------------------------------------------------------------
function clearAccounts() {
  const ids = checkedRowKeys.value.map(Number)
  if (ids.length === 0) {
    message.warning('请选择要清账的数据')
    return
  }
  const rows = rawOrders.value.filter((o) => ids.includes(o.id))

  interface CGroup {
    code: string
    name: string
    count: number
    unpaid: number
    allocs: Array<{
      order_id: number
      receipt_no: string
      order_date: string
      total_price: number
      amount: number
      remaining_after: number
    }>
  }
  const byCustomer = new Map<string, CGroup>()
  for (const r of rows) {
    const unpaid = unpaidOf(r)
    if (unpaid <= 0) continue
    const g =
      byCustomer.get(r.client_code) ??
      { code: r.client_code, name: r.client_name, count: 0, unpaid: 0, allocs: [] }
    g.count++
    g.unpaid += unpaid
    g.allocs.push({
      order_id: r.id,
      receipt_no: r.receipt_no,
      order_date: r.order_date,
      total_price: r.total_price,
      amount: unpaid,
      remaining_after: 0,
    })
    byCustomer.set(r.client_code, g)
  }
  const groups = [...byCustomer.values()]
  const total = groups.reduce((s, g) => s + g.unpaid, 0)
  if (total <= 0) {
    message.warning('选中的订单没有未收金额，无需清账')
    return
  }

  const lines = [`将为选中的 ${ids.length} 条订单录入未收金额作为收款：`]
  for (const g of groups) lines.push(`${g.name}：${g.count}单，未收 ¥${fmt(g.unpaid)}`)
  lines.push(`合计 ¥${fmt(total)}`)

  dialog.warning({
    title: '清账确认',
    content: lines.join('\n'),
    positiveText: '清账',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        for (const g of groups) {
          await api.addCustomerPayment(g.code, {
            customer_code: g.code,
            customer_name: g.name,
            amount: g.unpaid,
            pay_date: new Date().toISOString().slice(0, 10),
            method: '清账',
            remark: '批量清账 ',
            allocations: g.allocs,
          })
        }
        message.success('清账成功')
        checkedRowKeys.value = []
        await load()
      } catch (e) {
        message.error((e as Error).message || '清账失败')
      }
    },
  })
}

// ---------------------------------------------------------------------------
// 展开明细（§4.1：fetch detail → 平开/移门只读子表）
// ---------------------------------------------------------------------------
const expandedRowKeys = ref<DataTableRowKey[]>([])
const details = reactive<Record<number, OrderDto>>({})
const loadingDetail = reactive<Record<number, boolean>>({})

// ── 展开行 = 与 Hui 同一张明细表（2026-09-19，方案第 5c 步）────────────────────
// 旧版 Home 挂的就是 Hui 那两个 SFC 本体（`Home.formatted.js:9` import 自 Hui chunk）。
// 新版挂 `components/DetailLinesTable.vue`，它按 `kind` 分派平开/移门。
//
// ⚠️ **引擎是「每张单一份」**：引擎依赖里 `lines` 是一个 ref，而 Home 同时可能展开多张单。
//    组件为此提供了 `engineDeps` 自建模式（见该组件 `props.engine` 的注释）。
const homeFormulas = ref<FormulaDto[]>([])
/** 「自动加价设置」在 Hui 页设置、存 localStorage；Home 只读它，好让两边口径一致。 */
const homeDisableAutoMarkup = ref(LS.get('smartdoor_disable_auto_markup') === 'true')

/**
 * 每张单一个行数组 ref，**指向同一个数组本体**（`details[id].lines`），
 * 这样表格里改一行、下面别处读到的就是同一份数据。
 */
const lineRefs = new Map<number, Ref<Line[]>>()
function lineRefOf(id: number): Ref<Line[]> {
  let r = lineRefs.get(id)
  if (!r) {
    r = ref<Line[]>([])
    lineRefs.set(id, r)
  }
  return r
}

/** 明细行的归一：`OrderLineDto.parts/markup` 落库是 JSON，非数组一律当空（同 `useOrderPrint.toLines`）。 */
function normalizeLines(lines: OrderLineDto[]): Line[] {
  for (const l of lines) {
    const raw = l as unknown as Line
    if (!Array.isArray(raw.parts)) raw.parts = []
    if (!Array.isArray(raw.markup)) raw.markup = []
  }
  return lines as unknown as Line[]
}

/**
 * 页面级回调 —— 与 Hui 的 `detailHooks` 同形。
 *
 * ⚠️ `calcSingleRow` 目前**只算料、不自动开预览**：旧版 Home 会顺手开「生产单」预览
 *    （`Home.formatted.js:8221-8263`，靠内嵌整个 Hui 页面组件）。新版不走那条路，
 *    预览要接 Home 自己的打印链路 —— **这一小条尚未接**，见方案 §3.5 / §5c。
 */
const homeDialogs = useDetailLineDialogs({
  // 行内重算只看行本身 + formulas，用哪一份引擎实例都一样；挑一个稳定的。
  lineRefresh: (l: Line) => homeCalcEngine.lineRefresh(l),
})
const homeDetailHooks = {
  openSquareDialog: (l: Line) => homeDialogs.openSquareDialog(l),
  openAddMarkup: (l: Line) => homeDialogs.openAddMarkup(l),
  pickDoorImg: (l: Line) => homeDialogs.pickDoorImg(l),
  removeDoorImg: (l: Line) => homeDialogs.removeDoorImg(l),
  openTextImg: (l: Line) => homeDialogs.openTextImg(l),
  previewImage: (url: string) => homeDialogs.previewImage(url),
  // 占位：展开行是**每张单一份 hooks**（下面 `renderExpandDetail` 会覆盖它，好把 id 绑进去）
  calcSingleRow: (l: Line) => void homeCalcEngine.calcRowParts(l),
  // 勾选计数是**每张单各一份**（Home 的展开行各是独立的表）—— 用 tick 触发重算。
  onSelectChange: () => {
    homeSelectTick.value++
  },
  lineInputOf: (l: Line) => homeLineInputOf(l),
}
/** 勾选计数用的 tick（Home 每张单自己算，不像 Hui 那样两表共用）。 */
const homeSelectTick = ref(0)
/** 展开行里每张单的平开/移门显隐（旧版 `uo(row, kind)`，初值都是 true）。 */
const tableShown = reactive<Record<number, { ping: boolean; diao: boolean }>>({})
function shownOf(id: number) {
  if (!tableShown[id]) tableShown[id] = { ping: true, diao: true }
  return tableShown[id]
}
/** 展开行的行级保存要发完整行 —— 与 Hui 的 `lineInputOf` 同一件事。 */
function homeLineInputOf(l: Line): OrderLineInput {
  // ⚠️ 必须发**完整行**：后端 `service::update_line` 是 45 列 SET 全字段替换（见 client.ts 的注释）。
  const { isSelected: _drop, ...rest } = l
  void _drop
  return rest as unknown as OrderLineInput
}

/**
 * 供「弹窗 / 单行算料」用的**一个**引擎实例（Home 的表格各自在组件内自建引擎，
 * 那些实例在 setup 里拿不到，而 `useDetailLineDialogs` 与 `calcSingleRow` 都需要一个）。
 */
const homeCalcEngine = useOrderLines({
  lines: ref<Line[]>([]),
  formulas: homeFormulas,
  order: reactive({ client_code: '' }),
  orderId: ref<number | null>(null),
  disableAutoMarkup: homeDisableAutoMarkup,
})
/**
 * 明细**已加载成功**的订单 id（旧版 `_o`，`:7792`）—— 用于行类 `loaded-row`。
 *
 * ⚠️ 只有 detail 接口**返回 200** 才加进去（旧版 `:7792` 在 `if(200===o.code)` 分支里 add）；
 *    失败/报错**不加**。与 `details`（有值即算）不完全等价，所以单独记一个集合。
 */
const loadedIds = ref<Set<number>>(new Set())

function onExpandedKeys(keys: DataTableRowKey[]) {
  expandedRowKeys.value = keys
  for (const k of keys) {
    const id = Number(k)
    if (!details[id]) loadDetail(id)
  }
}

async function loadDetail(id: number) {
  loadingDetail[id] = true
  try {
    details[id] = await api.getOrder(id)
    // 展开行的表格读的是这个 ref —— **指向同一个数组本体**（`details[id].lines`），
    // 这样表里改一行、打印链路读到的就是同一份数据。见 `lineRefOf` 的注释。
    lineRefOf(id).value = normalizeLines(details[id].lines ?? [])
    // 旧版 `:7792` `_o.value.add(回执单号)` —— 只在 detail 成功那支里做。
    loadedIds.value = new Set(loadedIds.value).add(id)
  } catch (e) {
    message.error((e as Error).message || '加载明细失败')
  } finally {
    loadingDetail[id] = false
  }
}

// ---------------------------------------------------------------------------
// 行级状态类（旧版 `Qo`，`:7842-7849`）
// ---------------------------------------------------------------------------
/**
 * 重复单判据键（旧版 `Zo`，`:7827-7831`）：
 *
 * ```js
 * Ko = e => e == null ? "" : String(e).trim()
 * Zo = e => { const t=Ko(e.客户), l=Ko(e.门数), o=Ko(e.总价)
 *             return t && l && o ? t + "__" + l + "__" + o : "" }
 * ```
 *
 * 三个字段**各自 trim 后都非空**才成键；任一个为空（`""` 是 falsy）⇒ 返回 `""` ⇒ **不参与重复判定**。
 * ⚠️ 数值 `0` 经 `String()` 是 `"0"`（真值）⇒ 门数/总价为 0 的单**仍然参与**。
 */
function dupKey(r: OrderSummaryDto): string {
  const k = (v: unknown) => (v == null ? '' : String(v).trim())
  const client = k(r.client_name)
  const doors = k(r.door_count)
  const total = k(r.total_price)
  return client && doors && total ? `${client}__${doors}__${total}` : ''
}

/**
 * 「重复单」键集合（旧版 `Xo`，`:7830-7841`）—— 在样本里出现**超过 1 次**的键。
 *
 * ⚠️ **样本是 `ps`**（旧版 `:7832` 读 `ps.value`）＝ **筛选链的全量结果，不是当前页**
 *    （分页切片 `Cs` 是 `ps.slice(...)`，`:11180-11183`）。新版对应 `filtered`。
 *
 * ⚠️ **有意偏离**：新版 `filtered` 里还含**列头筛选**，而旧版那一步在 el-table 内部、**分页之后**
 *    （见 `columnFilterState` 的注释）。⇒ 勾了列头筛选时，新版做重复判定的样本**比旧版大**。
 *    这是「列头筛选改全量」那次拍板（用户 2026-09-18）的连带结果，不另开分支。
 */
const duplicateKeys = computed(() => {
  const counts = new Map<string, number>()
  for (const r of filtered.value) {
    const k = dupKey(r)
    if (!k) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const out = new Set<string>()
  counts.forEach((n, k) => {
    if (n > 1) out.add(k)
  })
  return out
})

/** 当前展开的订单 id（旧版 `jo`，`:7772` 展开时 add、`:7826` 收起时 delete）。 */
const expandedIds = computed(() => new Set(expandedRowKeys.value.map((k) => Number(k))))

/**
 * `n-data-table` 的 `row-class-name`（旧版 `Qo`，`:7842-7849`）：
 *
 * ```js
 * Qo = ({ row }) => {
 *   const l = []
 *   jo.value.has(row.回执单号) && l.push("expanded-row")
 *   _o.value.has(row.回执单号) && l.push("loaded-row")
 *   0 === so(row) && l.push("paid-row")            // ← 死码，不实现，见下
 *   const o = Zo(row)
 *   o && Xo.value.has(o) && l.push("duplicate-order-row")
 *   return l.join(" ")
 * }
 * ```
 *
 * ⚠️ **`paid-row` 不实现**：`grep -r paid-row legacy/` **零命中** —— 旧版加了类，但
 *    `legacy/css/*.css`（含 `Home-97d96482.css`）里**没有任何 `.paid-row` 规则**，
 *    渲染出来不产生任何效果。照抄只会多一个不生效的类名，故略去（旧版侧是死码）。
 *
 * ⚠️ **键的等价映射**：旧版这三个集合都按 `回执单号` 建，因为旧版的 `row-key` 就是它
 *    （`:11300` `"row-key":s(467)`，`dr(467)` = 回执单号）。新版 `row-key` 是 DB `id`
 *    （见模板）⇒ 这里一并换成 `id`。
 *    唯一不严格等价的边角：`receipt_no` 在新库里**允许为空串**（`0009_orders.sql:8`
 *    `TEXT NOT NULL DEFAULT ''`，唯一索引是 `WHERE receipt_no <> ''`）。旧版按 `''` 成键时，
 *    展开**任意一条**空号单会让**所有**空号单一起亮；新版按 `id` 只亮展开的那一条。
 *    取值更合理的一侧（真实数据里回执单号必填），且与旧版在「回执单号非空」时逐字一致。
 *
 * ⚠️ 类的**顺序**与旧版一致（`expanded-row` → `loaded-row` → `duplicate-order-row`）；
 *    但 CSS 的层叠不靠顺序，见 `<style>` 里那段说明。
 */
function rowClass(r: OrderSummaryDto): string {
  const classes: string[] = []
  if (expandedIds.value.has(r.id)) classes.push('expanded-row')
  if (loadedIds.value.has(r.id)) classes.push('loaded-row')
  const k = dupKey(r)
  if (k && duplicateKeys.value.has(k)) classes.push('duplicate-order-row')
  return classes.join(' ')
}



/*
 * 展开行明细（§4.1）：平开/移门只读子表，逐行 fetch detail。
 *
 * ⚠️ 更正审计 `01-table.md` F5 的一处误判（已回源码核实，2026-09-18）：
 *    审计写「旧版两张子表用 `v-show` **互斥**切换，新版『有就都渲染』」——**「互斥」不成立**。
 *    旧版 `:11306-11317` 的实况是**两个各自独立的 `v-show`**，且两者的初值都是 `true`：
 *      ```js
 *      no = reactive({})                                    // `:7650`
 *      uo = (e, t) => { if (!no[e]) no[e] = { ping: true, diao: true }; return no[e][t] }
 *      // 模板：
 *      <div v-show="uo(row.回执单号,'ping')" > <平开子表 v-model:showPingkai="uo(row.回执单号,'ping')" … /> </div>
 *      <div v-show="uo(row.回执单号,'diao')" > <移门子表 v-model:showDiao   ="uo(row.回执单号,'diao')" … /> </div>
 *      ```
 *    ⇒ 展开任何一行，**两张子表默认都渲染**（即使某一类一行明细都没有，也只是渲出一张空表）。
 *    所谓「切换」来自子组件的 `v-model:showXxx` 回写：子表只在**删掉自己最后一行**时
 *    emit `update:showPingkai/showDiao = (rows.length > 0)`（Hui 侧
 *    `Hui.formatted.js:1571-1572` 平开 / `:4358-4359` 移门，都在 `removeFirstRow` 里），
 *    从而把自己整个藏掉。两张表之间没有任何联动。
 *
 * **有意偏离（保留现状，不改成「都渲染」）**：新版 `if (ping.length)` / `if (diao.length)`
 * 只在**该类有明细时**才出一块。理由两条：
 *   ① 新版这两张是**只读**自绘表，没有「删最后一行」这条路径，旧版那个 `v-model:showXxx`
 *      回写在新型里没有对应物 ⇒ 就算照抄「无条件都渲染」，也只是多出一张空表，拿不到旧版的语义；
 *   ② 旧版那张空表来自「复用 Hui 汇算表」这一整套策略（审计 F3/A3 的架构级偏离），
 *      不是这里能补的 —— 补它要先把 `Hui.vue` 的两张表拆成可复用组件，属独立立项。
 * 若将来说要做 F3（复用 Hui 子表），这条要跟着一起回退。
 */
function renderExpandDetail(row: OrderSummaryDto) {
  const id = row.id
  if (loadingDetail[id]) {
    return h('div', { class: 'expand-detail' }, [h(NSpin, { show: true }, { default: () => '加载明细…' })])
  }
  const detail = details[id]
  if (!detail) return h('span')

  const rows = lineRefOf(id).value
  const ping = rows.filter((l) => l.line_type === 'ping')
  const diao = rows.filter((l) => l.line_type === 'diao')
  const shown = shownOf(id)
  // 勾选数每张单自己算（`homeSelectTick` 只是触发重算）
  void homeSelectTick.value
  const selectedCount = rows.filter((l) => l.isSelected).length

  /** 一张表。`engineDeps` 让组件为**这张单**自建一份引擎（引擎的 `lines` 只能有一个 ref）。 */
  const table = (kind: 'ping' | 'diao', data: Line[]) =>
    h(DetailLinesTable, {
      kind,
      rows: data,
      // 列显隐：Home 不提供逐列开关，全显（空对象 ⇒ `colVis` 恒 true）
      colVis: {},
      client: { name: detail.client_name || '', code: detail.client_code || '' },
      engineDeps: {
        lines: lineRefOf(id),
        formulas: homeFormulas,
        order: { client_code: detail.client_code || '' },
        orderId: ref(id),
        disableAutoMarkup: homeDisableAutoMarkup,
      },
      savedOrderId: id,
      selectedCount,
      filling: false,
      // ⚠️ hooks 是**每张单一份**：`calcSingleRow` 要绑上本单 id（算完要开这一单的生产单预览）
      hooks: { ...homeDetailHooks, calcSingleRow: (l: Line) => void calcSingleRowInExpand(id, l) },
      'onAdd-row': () => addRowToExpand(id, kind),
      'onBatch-delete': () => batchDeleteInExpand(id),
      'onToggle-show': () => (shown[kind] = !shown[kind]),
      'onFill-line-numbers': () => void fillLineNumbersFor(id),
    })

  const children: (ReturnType<typeof h> | null)[] = []
  if (shown.ping && ping.length) children.push(table('ping', ping))
  if (shown.diao && diao.length) children.push(table('diao', diao))
  if (!rows.length) children.push(h(NEmpty, { description: '暂无明细', size: 'small' }))
  return h('div', { class: 'expand-detail' }, children)
}

/**
 * 展开行「添加行」（旧版子表底部那颗）。Home 里没有引擎实例可直接用，
 * 用 `newLine` 造一行推进该单的行数组 —— 口径与 Hui 一致（默认值都走引擎）。
 */
function addRowToExpand(id: number, kind: 'ping' | 'diao') {
  const rows = lineRefOf(id).value
  rows.push(homeCalcEngine.newLine(kind))
}

/** 展开行「批量删除(选中)」——只删本地行，落库要逐行走行级保存（旧版也是即时 `deleteRow`，见方案 §3.3）。 */
function batchDeleteInExpand(id: number) {
  const r = lineRefOf(id)
  const sel = r.value.filter((l) => l.isSelected)
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
        if (l.id != null) {
          try {
            await api.deleteOrderLine(id, l.id)
          } catch {
            // 单行失败继续（与 Hui 的 batchDeleteRows 同）
          }
        }
        // ⚠️ 用 splice 而不是 r.value = filter(...)：后者会把 ref 换成**新数组**，
        // 与 `details[id].lines` 脱钩，打印链路就读不到删干净的行了。
        const i = r.value.indexOf(l)
        if (i >= 0) r.value.splice(i, 1)
      }
      message.success('已删除选中行')
    },
  })
}

/**
 * 展开行的「算料」：算完**顺手开「生产单」预览**。
 *
 * 旧版 Home 就是这么做的（`Home.formatted.js:8221-8263`：调内嵌 Hui 页面的 `calculateReceipt`
 * → 拿 `produces` → 用「生产单」模板构造 → 开预览弹窗）。新版不内嵌 Hui 页面，
 * 改成「引擎算料 + 复用本页现成的打印预览弹窗」—— 结果一样，路更短。
 */
async function calcSingleRowInExpand(id: number, l: Line) {
  const ok = await homeCalcEngine.calcRowParts(l)
  if (!ok) return
  message.success(`算料完成：${l.parts.length} 个部件`)
  const detail = details[id]
  if (!detail) return
  // 预览读的是 `printOrders`（与「打印选项」抽屉同一条链路），这里换成这一张单。
  printOrders.value = [detail]
  onOpenMode('product', '生产单')
  // ⚠️ **算料不补行级单号** —— 旧版 `In`/`Un` 只算料 + 开预览，补号是打印时才做的。
  //    放在 onOpenMode 之后（它会把标志置回 true）。
  previewAutoLineNumbers.value = false
}

/** 展开行「填入单号」（只有平开表有这颗按钮，见组件内 `kind === 'ping'`）。 */
async function fillLineNumbersFor(id: number) {
  try {
    const map = await api.fillLineNumbers(id)
    for (const l of lineRefOf(id).value) {
      const v = map?.[String(l.id)]
      if (v) l.line_no = v
    }
    message.success('已填入单号')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '填入单号失败')
  }
}

// ---------------------------------------------------------------------------
// 「查单号」的两个动作（旧版 `Yo`/`Wo`，`:7702-7743`）
// ---------------------------------------------------------------------------
/**
 * 「确认」/输入框回车（旧版 `Yo`，`:7702-7729`）。
 *
 * 四步，逐字对齐：
 *  ① **补年份后缀**：输入里若没有 `-两位数字`（正则 `-\d{2}\b`）就补 `-` + 当前年份后两位。
 *     `String((new Date).getFullYear()).slice(-2)`（`dr(962)`=getFullYear、`dr(1001)`=slice）。
 *  ② 在「查询结果集 / 全量列表」`gs ? ws : fs` 里找，**再叠「未生产」那一步** ——
 *     注意：旧版这一步**不含**进度/付款/搜索/列头筛选，与主表 `ps` 的样本不同，照抄。
 *  ③ 没命中 → `warning("查不到「{关键字}」单号！")`，且 **`po` 清空**（不留下一个筛不出东西的关键字）。
 *  ④ 命中 → 写 `po`、回第 1 页、关弹窗、**展开筛选结果的第一行**。
 */
async function confirmOrderNoQuery() {
  const raw = orderNoInput.value.trim()
  // ① 补年份后缀（旧版 :7703-7709）
  const q = raw ? (/-\d{2}\b/.test(raw) ? raw : `${raw}-${String(new Date().getFullYear()).slice(-2)}`) : ''
  orderNoInput.value = q
  if (!q) {
    orderNoQuery.value = ''
    page.value = 1
    orderNoPopShow.value = false
    return
  }
  // ② 找（旧版 :7710-7716）
  let pool = queryMode.value ? queryRows.value : rawOrders.value
  if (onlyUnproduced.value) {
    pool = pool.filter((r) => !r.production_status || r.production_status.trim() === '')
  }
  const key = q.toLowerCase()
  const hit = pool.some((r) => orderNosOf(r).some((s) => s.toLowerCase().startsWith(key)))
  // ③ 没命中（旧版 :7717-7718）
  if (!hit) message.warning(`查不到「${q}」单号！`)
  orderNoQuery.value = hit ? q : ''
  page.value = 1
  orderNoPopShow.value = false
  if (!hit) return
  // ④ 展开第一条（旧版 :7719-7728）
  await nextTick()
  const first = filtered.value[0]
  if (!first) return
  if (!expandedRowKeys.value.some((k) => Number(k) === first.id)) {
    expandedRowKeys.value = [...expandedRowKeys.value, first.id]
    if (!details[first.id]) loadDetail(first.id)
  }
  // ⚠️ 旧版这里还有一段 800ms 后「滚到居中」：它找的是 `.highlight-matched-order`，
  //    而那个类由 **Hui 子表**按 `row.单号.startsWith(po)` 加（`Hui.formatted.js:1352-1356`
  //    / `:3788-3792`，靠 Home 往下传 `highlightOrderQuery`）。**新版做不了**：
  //    `OrderLineDto` 里**没有「单号」字段**（`app/src/api/types.ts:109-159`）——
  //    旧版一行明细属于某个单号，新版把单号收在回执单号上了（`0009_orders.sql`：单号不单设列）。
  //    所以这里**刻意不写**滚动：`Hui.vue:3893` 那两条 `.highlight-matched-order` 样式
  //    目前也是悬空的（没有任何地方加这个类），补它要先把「明细行的单号」这条数据补回模型。
  //    （旧版在找不到该元素时同样直接 return，不滚。）
}

/**
 * 「清除」（旧版 `Wo`，`:7730-7743`）：清关键字 → 清输入 → 关弹窗 →
 * **收起所有已展开的行**（`jo` 遍历 → `toggleRowExpansion(row, false)` → `jo.clear()`）。
 *
 * ⚠️ 时间轴照抄：先置 `ho=true`（按钮变「恢复中…」），**50ms 后**才干活，干完才 `ho=false`。
 *    那个 `setTimeout(..., 50)` 是旧版原样（`:7741-7743`），不是我们加的。
 */
function clearOrderNoQuery() {
  orderNoRestoring.value = true
  setTimeout(async () => {
    orderNoQuery.value = ''
    orderNoInput.value = ''
    orderNoPopShow.value = false
    await nextTick()
    if (expandedRowKeys.value.length) {
      expandedRowKeys.value = []
    }
    page.value = 1
    orderNoRestoring.value = false
  }, 50)
}

// ---------------------------------------------------------------------------
// 手动更新进度 + 自定义进度项（§3 `Ea`/`La`/`ua`；§4.7 `Ha`/`ln`/`on`/`Ua`/`Ia`/`Sa`/`Ta`/`Ya`/`Wa`）
// ---------------------------------------------------------------------------
// 旧版 `Ea`（`:8036`）：读 localStorage 的 JSON 数组，只留非空字符串；解析失败/非数组 ⇒ []。
function readManualActions(): string[] {
  try {
    const raw = localStorage.getItem(MANUAL_ACTIONS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  } catch {
    return []
  }
}

// 旧版是 `Vue.ref(立即求值)` —— 只在组件建立时读一次，不跨标签页同步。新版照此。
const manualActions = ref<string[]>(readManualActions())

// 旧版 `Ia`（`:8030`）：整数组回写。
function saveManualActions() {
  localStorage.setItem(MANUAL_ACTIONS_KEY, JSON.stringify(manualActions.value))
}

// 旧版 `La`（`:8036`）：列头 popover 追加的自定义项 = 自定义项里不在固定表 `Bo` 里的那些。
// （`Ua` 只挡 `Na` 的 4 项，`Ea` 里仍可能出现与 `Bo` 同名的项，所以这里要再滤一次。）
const customProgressOptions = computed(() =>
  Array.from(new Set(manualActions.value.filter((v) => !PROGRESS_FIXED_FILTERS.includes(v)))),
)

// 旧版 `Ua`（`:8032`）：失焦/确认时把新名字入库；固定候选与已有项不重复入库。
function rememberManualAction(name: string) {
  const v = name.trim()
  if (!v || MANUAL_ACTION_OPTIONS.includes(v) || manualActions.value.includes(v)) return
  manualActions.value.push(v)
  saveManualActions()
}

// 旧版 `Ya` 内联的删除逻辑（`:8044-8049`）：固定项一律 false。
function forgetManualAction(name: string): boolean {
  const v = name.trim()
  if (!v || MANUAL_ACTION_OPTIONS.includes(v)) return false
  const before = manualActions.value.length
  manualActions.value = manualActions.value.filter((a) => a !== v)
  if (manualActions.value.length === before) return false
  saveManualActions()
  return true
}

// 弹窗状态（旧版 `ba`/`Da`/`Aa`/`ka`/`Pa`，`:8036-:8064`）。
const manualShow = ref(false)
const manualTarget = ref<OrderSummaryDto | null>(null)
const manualName = ref('')
const manualDate = ref<number | null>(null)
// 旧版 `Pa = ref("1" === localStorage.getItem(gr))` —— 持久化偏好：
// 从未设置过 ⇒ false；存过 "1" ⇒ 勾上。**不是**每次默认勾选。
const manualRecordDate = ref(localStorage.getItem(RECORD_DATE_KEY) === '1')

// 旧版 `ka` 初值（`:8036`）= `new Date().toISOString().split("T")[0]` —— **UTC** 日期串。
// 这里取同一个串再按本地日历还原成时间戳，保证与旧版显示同一天
//（含 UTC+8 凌晨会取到"昨天"这一旧版行为，属有意保真）。
function legacyToday(): number {
  const [y, m, d] = new Date()
    .toISOString()
    .split('T')[0]
    .split('-')
    .map(Number)
  return new Date(y, m - 1, d).getTime()
}

// 旧版 `value-format: "YYYY-MM-DD"` ⇒ 提交时拼进操作名的是 `YYYY-MM-DD` 串。
function isoDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 旧版 `Sa`（`:8041`）：候选 = 固定 4 项 + 自定义项，按**输入原值**（不 trim）`includes` 过滤。
// 旧版给 Element Plus 的只有 `{value}`（它的 value 同时当显示文本）；Naive 的 autocomplete
// 用 `label` 显示、选中回填的也是 `label`，故这里两者都填同一个串。
const manualNameOptions = computed(() => {
  const all = [...MANUAL_ACTION_OPTIONS, ...manualActions.value]
  const q = manualName.value
  return (q ? all.filter((v) => v.includes(q)) : all).map((v) => ({ label: v, value: v }))
})

// 旧版 `Ta`（`:8040`）：失焦即入库。
function onManualNameBlur() {
  rememberManualAction(manualName.value)
}

// 旧版 `Ya`（`:8042`）：在「操作名称」输入框上右键 = 删除自定义操作项。
function onManualNameContextMenu(e: MouseEvent) {
  e.preventDefault()
  const v = manualName.value.trim()
  if (!v) {
    message.warning('请先输入要删除的操作项')
    return
  }
  if (MANUAL_ACTION_OPTIONS.includes(v)) {
    message.warning('固定项不允许删除')
    return
  }
  if (!forgetManualAction(v)) {
    message.warning('未找到该自定义操作项')
    return
  }
  // 旧版 `Mo.value === l && Po()`：删掉的正是当前筛选值时清掉筛选（新版「清掉」= 显示全部）。
  if (progressFilter.value === v) progressFilter.value = '显示全部'
  manualName.value = ''
  message.success('已删除自定义操作项')
}

// Naive 的 AutoComplete 不认 `onContextmenu` 顶层 prop，要走 `inputProps` 透传到内层 input。
const manualNameInputProps: InputHTMLAttributes = { onContextmenu: onManualNameContextMenu }

// 旧版 `Wa`（`:8057`）：`记录日期` 是持久化偏好，写 "1"/"0"。
function onRecordDateChange(v: boolean) {
  manualRecordDate.value = v
  localStorage.setItem(RECORD_DATE_KEY, v ? '1' : '0')
}

// 旧版 `Ha`（`:8067`）：无回执单号 ⇒ warning 不开窗；开窗时重置操作名与日期（**不动** `记录日期`）。
function openManualProgress(row: OrderSummaryDto) {
  if (!row.receipt_no) {
    message.warning('当前行缺少回执单号，无法更新进度')
    return
  }
  manualTarget.value = row
  manualName.value = ''
  manualDate.value = legacyToday()
  manualShow.value = true
}

// 旧版 `tn`（`:8072`）：取消。
function closeManualProgress() {
  manualShow.value = false
  manualTarget.value = null
  manualName.value = ''
}

// 旧版 `ln`（`:8079`）/`on`（`:8089`）：勾了「记录日期」就把日期拼在操作名后面（`param3`）。
function manualProgressParam(): string {
  const name = manualName.value.trim()
  const date = manualDate.value
  return manualRecordDate.value && date != null ? `${name}${isoDate(date)}` : name
}

// `PATCH /orders/{id}` 是**整头覆盖**（后端 `update_head` 绑的是全字段），
// 所以必须带上原行的全部头字段，只换 `production_status`。
function headWithStatus(row: OrderSummaryDto, productionStatus: string): OrderHeadInput {
  return {
    client_code: row.client_code,
    client_name: row.client_name,
    phone: row.phone,
    brand: row.brand,
    order_date: row.order_date,
    production_days: row.production_days,
    deposit: row.deposit,
    remark: row.remark,
    salesperson: row.salesperson,
    // `order_no_set` 是服务端派生值，不回传（发过去也会被忽略）。
    install_address: row.install_address,
    production_status: productionStatus,
    creator_name: row.creator_name,
    lock_direction: row.lock_direction,
  }
}

// 旧版 `ln`（`:8074`）：确认 → `Hl(param3 = 操作名[+日期])` → 「进度更新成功」。
// 旧版紧接着 `t["打单操作"] = o`（**整串覆盖**，不是追加），新版照此语义写 `production_status`。
// 旧版的 `updataProgress` 是旧服务端不透明接口，新版后端没有对应端点 ⇒ 落到订单头字段。
// TODO(未确认): 旧服务端 `updataProgress` 自身是否还会做合并/追加（旧版前端不刷新，看不到服务端结果），
//               无法从 bundle 观测；新版按旧版**前端可见**的「整串覆盖」实现。
async function submitManualProgress() {
  const row = manualTarget.value
  if (!row) return
  if (!row.receipt_no) {
    message.error('缺少回执单号，无法更新进度')
    return
  }
  if (!manualName.value.trim()) {
    message.warning('请先选择或输入操作名称')
    return
  }
  rememberManualAction(manualName.value)
  try {
    await api.updateOrderHead(row.id, headWithStatus(row, manualProgressParam()))
    message.success('进度更新成功')
    closeManualProgress()
    await load()
  } catch (e) {
    message.error((e as Error).message || '更新进度失败')
  }
}

// 旧版 `on`（`:8088`）：删除 → `deleteProgressForFullOrder` → 「进度删除成功」，
// 成功后从 `打单操作` 串里摘掉该段（处理 `x` / `x_` / `_x` 三种形态）。
// 旧版对旧服务端最多重试 5 次；新版后端自洽，PATCH 即持久化 ⇒ 无重试（有意偏离，理由见上）。
async function deleteManualProgress() {
  const row = manualTarget.value
  if (!row) return
  if (!row.receipt_no) {
    message.error('缺少回执单号，无法删除进度')
    return
  }
  if (!manualName.value.trim()) {
    message.warning('请先选择或输入要删除的操作名称')
    return
  }
  const param = manualProgressParam()
  let status = row.production_status
  if (status) {
    if (status === param) status = ''
    else if (status.includes(`_${param}`)) status = status.replace(`_${param}`, '')
    else if (status.includes(`${param}_`)) status = status.replace(`${param}_`, '')
  }
  try {
    await api.updateOrderHead(row.id, headWithStatus(row, status))
    message.success('进度删除成功')
    closeManualProgress()
    await load()
  } catch (e) {
    message.error((e as Error).message || '删除进度失败')
  }
}

// ---------------------------------------------------------------------------
// 列定义（§3；Phase 1 = 工厂视图 Yt）
// ---------------------------------------------------------------------------
/*
 * ⚠️ 旧版 `la`（`:7940-7942`）那套底色（收据单/标签/玻璃订单/生产单/自助下单）
 * **本系统里不渲染，已删** —— 不是漏做，是**到不了**。
 *
 * `la()` 全组件只有两个调用点（`grep` 实测：`:11589` 业务员、`:11597` 打单人），
 * 两处都长这样：
 *   ```js
 *   qt.value ? <el-input class="borderless-input" onFocus={nn}>
 *            : <div style={la(row["业务员"])}>{row["业务员"]}</div>
 *   ```
 * 即带底色的 `div` 是 **`!qt`（只读）分支**。而 `qt`（`:8147`）是
 *   `qt.value = data.registrant === userinfo.name`
 * ——「**正在看的这份数据是不是自己租户的**」，是旧版**租户切换/代看**的只读闸门。
 * 新版没有租户切换 ⇒ **`qt ≡ true`** ⇒ 永远走输入框那一支，`la()` 分支不可达。
 *
 * ★ 这同时更正了本文件先前的一处改动（`a70ac477`）：那次把 `la()` 的底色挂到了
 *   业务员/打单人的「非编辑态显示」上 —— 挂是挂对了函数，但**挂到了一个我们永远进不去的分支**。
 *   正确形态是这两列**常驻输入框**（见 `renderEditable`），没有任何底色。
 */

// 旧版 `ua`（`:7964-7970`）：5 固定段 + 自定义段（flex = 3/个数，色 `#531dab`）。
type ProgressSegment = { label: string; color: string; flex: number; done: boolean }

function progressSegments(status: string): ProgressSegment[] {
  const custom = manualActions.value
  const flex = custom.length > 0 ? CUSTOM_SEGMENT_FLEX / custom.length : 0
  return [
    ...PROGRESS_STEPS.map((step) => ({
      label: step.label,
      color: step.color,
      flex: step.flex,
      // 旧版 `:7967`：`确认下单` 段只看整串是否非空，不要求真的含「确认下单」四个字。
      done: step.label === '确认下单' ? status.length > 0 : status.includes(step.label),
    })),
    ...custom.map((label) => ({
      label,
      color: CUSTOM_SEGMENT_COLOR,
      flex,
      done: status.includes(label),
    })),
  ]
}

// ⚠️ 分隔符口径冲突（需上游拍板）：旧版源码**只用下划线**——`oa`/`aa`（`:7943-7952`）`split("_")`，
// 删除时摘段也是 `x_` / `_x`（`:8100-8103`），全 bundle 查不到按空格切 `打单操作` 的地方；
// 而 `backend/migrations/0018_home_order_head_fields.sql` 的注释把 `打单操作 -> production_status`
// 写成「"生产单 玻璃订单 标签 收据单" 等，**空格串**」（同一段注释里 `单号集` 才是空格串）。
// 这里按**旧版源码**取 `_`；新版自身写入的是单个 token（无分隔符），所以只影响旧数据/多段串。
// 若上游确认新口径是空格串，改这两处的 split 即可。
// 旧版 `oa`（`:7943-7947`）：按 `_` 切分去空段，去掉最后一段后**再补回一个 `_`**；只有一段时返回空串。
function progressPrefix(status: string): string {
  if (!status) return ''
  const parts = status.split('_').filter((p) => p !== '')
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('_') + '_'
}

// 旧版 `aa`（`:7948-7952`）：最后一段；全是空段时原样返回。
function progressSuffix(status: string): string {
  if (!status) return ''
  const parts = status.split('_').filter((p) => p !== '')
  return parts.length ? parts[parts.length - 1] : status
}

// 旧版 `Yt` 分支的格子内容（`:11578-11582`）：色条 + 一行「`前段_` + **深红加粗末段**」+ `✓已付` 徽标。
function renderProgress(row: OrderSummaryDto) {
  const status = row.production_status || ''
  const prefix = progressPrefix(status)
  return [
    h(
      'div',
      { class: 'progress-bar' },
      progressSegments(status).map((seg) =>
        h('div', {
          class: 'progress-seg',
          title: `${seg.label}${seg.done ? ' ✓' : ''}`,
          style: {
            flex: seg.flex,
            minWidth: '4px',
            background: seg.done ? seg.color : '#e0e0e0',
          },
        }),
      ),
    ),
    h('span', null, [
      // 旧版 `qu` 样式：`{font-weight:400}`。
      prefix ? h('span', { style: { fontWeight: '400' } }, prefix) : null,
      // 旧版 `Ju` 样式：`{color:#d9001b; font-weight:700}`。
      h('span', { style: { color: '#d9001b', fontWeight: '700' } }, progressSuffix(status)),
    ]),
    // 旧版 `Vo(row)` = 未收 **=== 0**（是 `===` 不是 `<=`，见 `:7664`）；徽标样式 `_u`。
    unpaidOf(row) === 0
      ? h(
          'span',
          {
            style: {
              marginLeft: '4px',
              color: '#52c41a',
              fontSize: '10px',
              fontWeight: '700',
              verticalAlign: 'middle',
            },
          },
          '✓已付',
        )
      : null,
  ]
}

// ---------------------------------------------------------------------------
// 单元格 hover tooltip（旧版 `sa`/`da`，`:7973-7985`）
// ---------------------------------------------------------------------------
/** 是否显示（旧版 `ra`）。 */
const rowTipShow = ref(false)
/** 内容（旧版 `ia`，那边存的是 HTML 串；我们用 VNode 渲染）。 */
const rowTipLines = ref<{ text: string; done: boolean }[]>([])
const rowTipPaid = ref(false)
/** 提示元素本身 —— 位置**直接写它的 `style`**，不走响应式（见下）。 */
const rowTipEl = ref<HTMLElement | null>(null)
/** 首帧位置。只在**刚显示**那一下用；之后跟随鼠标都是直接改 DOM。 */
const rowTipInitStyle = reactive({ left: '0px', top: '0px' })

/**
 * 打单操作 / 客户两列 hover 时的进度提示（旧版 `sa`/`da`，`:7973-7985`）。
 *
 * ## 旧版行为
 * ```js
 * sa = (row, column, event) => { …… ca.x = event.clientX; ca.y = event.clientY; ra.value = true }
 * da = () => { ra.value = false }
 * ```
 * 内容为空时不显示（旧版 `n && (…)`）。
 *
 * ## ⚠️ 三处**有意偏离**（先前照着旧版做，用户实测报了三样毛病）
 *
 * ① **跟随鼠标**。旧版另有个 `Va`（`:7983`）就是干这个的
 *    （`ra.value && (ca.x = e.clientX, ca.y = e.clientY)`），但 **`Va(` 全文件零调用**——
 *    写了没接上。结果是提示只在鼠标**进入单元格那一刻**的位置出现、之后不动，
 *    鼠标一动就显得「挂在那儿」。这里把旧版的意图接上：**跟随鼠标**。
 *
 * ② **收起不再依赖单元格的 `mouseleave`**。先前把它挂在单元格内层 div 上，
 *    而 `rowTipShow` 一变 Home 就整体重渲染 ⇒ Naive 重建那一行 ⇒ **承载 `mouseleave`
 *    的节点被换掉**。节点被移除时浏览器**不会**补发 `mouseleave` ⇒ 提示**永远收不掉**。
 *    现在改为：显示期间挂一个 **document 级 `mousemove`**，每次移动检查指针是否还在
 *    触发格（`.tip-cell`）里，不在就收 —— 不管节点有没有被重建都能收尾。
 *
 * ③ **位置直接写 DOM，不走响应式**。先前坐标是 `reactive`，鼠标每动一次就触发一轮
 *    Vue 重渲染（整个表格跟着重渲）⇒ 卡顿。现在 `mousemove` 里只改 `el.style.left/top`，
 *    零重渲染。内容仍然走响应式（它变得少）。
 */
function rowTipContent(row: OrderSummaryDto) {
  const segs = progressSegments(row.production_status)
  if (!segs.length && unpaidOf(row) !== 0) return null
  return { lines: segs.map((s) => ({ text: s.label, done: s.done })), paid: unpaidOf(row) === 0 }
}

/** 把提示挪到鼠标处（和旧版 `Va` 的意图一致）。 */
function moveRowTip(ev: MouseEvent) {
  const el = rowTipEl.value
  if (!el) return
  el.style.left = `${ev.clientX}px`
  el.style.top = `${ev.clientY}px`
}

/** 显示期间挂在 document 上的移动监听（一次性装上，收起时摘掉）。 */
let rowTipMove: ((ev: MouseEvent) => void) | null = null

function hideRowTip() {
  rowTipShow.value = false
  if (rowTipMove) {
    document.removeEventListener('mousemove', rowTipMove)
    document.removeEventListener('mouseleave', hideRowTip)
    rowTipMove = null
  }
}

/** 鼠标进入「客户」「打单操作」两列的单元格（旧版 `sa`）。 */
function showRowTip(row: OrderSummaryDto, ev: MouseEvent) {
  const content = rowTipContent(row)
  if (!content) return
  rowTipLines.value = content.lines
  rowTipPaid.value = content.paid
  rowTipInitStyle.left = `${ev.clientX}px`
  rowTipInitStyle.top = `${ev.clientY}px`
  rowTipShow.value = true

  if (!rowTipMove) {
    rowTipMove = (e: MouseEvent) => {
      const t = e.target
      // 指针已经离开触发格（或跑出文档）⇒ 收掉。**不依赖节点还在**，所以重建也能收。
      // `e.target` 可能是 document/Window，`closest` 得先确认是 Element。
      if (!(t instanceof Element) || !t.closest('.tip-cell')) {
        hideRowTip()
        return
      }
      moveRowTip(e)
    }
    document.addEventListener('mousemove', rowTipMove, { passive: true })
    // 指针直接移出整个窗口时不会有 mousemove，再兜一层
    document.addEventListener('mouseleave', hideRowTip, { passive: true })
  }
}

/** 挂在「客户」「打单操作」两列单元格上的处理（`mouseleave` 只作兜底）。 */
const rowTipHandlers = {
  onMouseenter: (row: OrderSummaryDto) => (ev: MouseEvent) => showRowTip(row, ev),
  onMouseleave: () => hideRowTip,
}

/**
 * 可编辑单元格：**常驻一个无边框输入框**（旧版 `订单备注`/`安装地址` `:11527-11531`、
 * `业务员`/`打单人` `:11583-11598`）。旧版**没有「先显示文本、点击才变输入框」这一态**：
 *
 * ```js
 * // 订单备注 / 安装地址（无条件）
 * <el-input type="textarea" autosize={{minRows:1,maxRows:3}} class="input-style"
 *           modelValue={row[字段]} onUpdate:modelValue={v => row[字段] = v} onFocus={() => nn(row)} />
 * // 业务员 / 打单人
 * qt ? <el-input class="borderless-input" onFocus={() => nn(row)} /> : <div style={la(值)}>…
 * ```
 *
 * `nn(row)`（`:8112-8114`）就是「进编辑态」：`za.value = row` 并把
 * 定金/订单备注/安装地址三个字段快照进草稿（`:8112-8114`）。`qt` 恒真，见上面那段说明。
 *
 * 所以这里也**始终**渲染输入框：
 *   · 非编辑态 → 显示行上的值，`onFocus` 进编辑态（旧版的 `onFocus={nn}`）；
 *   · 编辑态   → 绑定草稿。
 *
 * ⚠️ `onUpdate:value` 里要**先确保已进编辑态**再写草稿：极快的一次输入可能赶在
 *    `editingId` 触发的重渲染之前到达，那时 `draft` 还没快照过。先 `startEdit` 再写，两种情况都对。
 */
function renderEditable(
  row: OrderSummaryDto,
  field: 'install_address' | 'remark' | 'salesperson' | 'creator_name',
) {
  const editing = editingId.value === row.id
  // 旧版这两列是 `type="textarea"`、`autosize {minRows:1, maxRows:3}`、`class="input-style"`；
  // 业务员/打单人是单行 `el-input`、`class="borderless-input"`。
  const isTextarea = field === 'install_address' || field === 'remark'
  return h(NInput, {
    value: editing ? (draft as unknown as Record<string, string>)[field] : row[field] || '',
    size: 'small',
    type: isTextarea ? 'textarea' : 'text',
    autosize: isTextarea ? { minRows: 1, maxRows: 3 } : undefined,
    borderless: true,
    class: isTextarea ? 'input-style' : 'borderless-input',
    onFocus: () => {
      if (editingId.value !== row.id) startEdit(row)
    },
    'onUpdate:value': (v: string) => {
      if (editingId.value !== row.id) startEdit(row)
      ;(draft as unknown as Record<string, string>)[field] = v
    },
  })
}

/**
 * 列头筛选 popover（旧版「未付」`:11475-11508`、「打单操作」`:11534-11581`）。
 *
 * 结构逐字对齐旧版：
 * ```html
 * <div>                                        <!-- 列头容器 -->
 *   <span>列名</span>
 *   <el-popover placement="bottom" trigger="click" width="220">
 *     #reference <el-button text size="small"> 按钮名 (当前值) </el-button>
 *     #default
 *       <div>
 *         固定项…                               <!-- 每项 text 按钮，flex-start / 宽 100% -->
 *         分隔线                                <!-- 仅当有自定义项（旧版 `La.length`） -->
 *         自定义项…
 *         清除项                                <!-- 「全部显示 / 显示全部」，**无**选中色 -->
 *       </div>
 *   </el-popover>
 * </div>
 * ```
 *
 * ⚠️ 三处先前与旧版不符（C7/C8/C13/C14），别再改回去：
 *   ① **顺序**：旧版清除项「全部显示 / 显示全部」排在**最后**，先前放**最前**。
 *   ② **当前值回显**：旧版按钮后面带 ` (值)`（`:11481` / `:11541`），先前完全没有。
 *   ③ **popover 里没有标题**：旧版 `#default` 只有选项；先前多渲染了一行 `filter-title`。
 *   另：先前触发器自带一个 `▾`，旧版没有 —— 旧版靠 `text` 按钮自己的观感表示可点。
 *
 * ⚠️ **选中判定**：旧版比的是 `Mo`/`zo`，而「清除」时它俩被置成**空串** ⇒ 清除项**永不选中**，
 *    所以它连 `color`/`fontWeight` 两个条件都没有（`:11507` 那条 style 只有布局三项）。
 *    新版清除态用的是哨兵值（`'全部显示'` / `'显示全部'`，与选项文字同一个串），
 *    必须**显式排除**，否则没筛选时「全部显示」会一直高亮成蓝色加粗。
 *
 * ⚠️ 旧版每个选项的 `onClick` 都带 `.stop`（`:11491` 等的 `withModifiers(..., ["stop"])`）——
 *    列头在 el-table 里，不拦会冒泡到排序/筛选处理器。这里照抄 `stopPropagation`。
 */
function headerFilter(opt: {
  /** 列名（旧版 `<span>未付</span>` / `打单操作`） */
  columnLabel: string
  /** 按钮上的名字（` 付款状态 ` / ` 生产进度 `） */
  buttonLabel: string
  /** 全部选项，**按旧版渲染顺序**（清除项在最后） */
  items: string[]
  /** 哪一项是「清除」（旧版 `bo`/`Po`：置空 + 关弹窗 + 回第 1 页） */
  clearLabel: string
  /** 在这一项**之前**插分隔线（旧版只在「有自定义项」时插；不传就不插） */
  dividerBefore?: string
  /**
   * 当前值那一段要不要高亮。
   * ⚠️ **两列不一样，别统一**：`打单操作` 的值包在
   *    `<span style="color:#409eff;font-weight:700;margin-left:4px"> (" 生产进度 " 的 `Ou`，`:11541`)；
   *    `未付` 的值是**裸文本节点**（`:11481`，无任何样式）。
   */
  highlightValue?: boolean
  current: Ref<string>
  show: Ref<boolean>
  onPick: (v: string) => void
  onClear: () => void
}) {
  return () =>
    h('div', { class: 'header-filter' }, [
      h('span', null, opt.columnLabel),
      h(
        NPopover,
        {
          placement: 'bottom',
          trigger: 'click',
          width: 220,
          show: opt.show.value,
          'onUpdate:show': (v: boolean) => (opt.show.value = v),
        },
        {
          trigger: () =>
            h(
              NButton,
              { text: true, size: 'small' },
              // 当前值回显（旧版 `dr(779)`「 付款状态 」/ `dr(1216)`「 生产进度 」+ `" ("+值+") "`）
              {
                default: () =>
                  opt.current.value
                    ? [
                        opt.buttonLabel,
                        opt.highlightValue
                          ? h(
                              'span',
                              { style: { color: '#409eff', fontWeight: '700', marginLeft: '4px' } },
                              ` (${opt.current.value}) `,
                            )
                          : ` (${opt.current.value}) `,
                      ]
                    : opt.buttonLabel,
              },
            ),
          default: () =>
            h(
              // 旧版选项容器 `Yu`(`:11485 区`) / `Hu`(`:11545 区`)：
              // `display:flex; flex-direction:column; gap:6px`
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
              opt.items.flatMap((item) => {
                const isClear = item === opt.clearLabel
                // 清除项永不选中（见上方说明）
                const active = !isClear && opt.current.value === item
                const node = h(
                  'div',
                  {
                    class: 'filter-item',
                    style: {
                      // 旧版四项的布局完全一样，只有 color/fontWeight 分岔
                      justifyContent: 'flex-start',
                      width: '100%',
                      marginLeft: '0',
                      color: isClear ? undefined : active ? '#409eff' : '#606266',
                      fontWeight: isClear ? undefined : active ? '700' : '400',
                    },
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      opt.show.value = false
                      if (isClear) opt.onClear()
                      else opt.onPick(item)
                    },
                  },
                  item,
                )
                // 旧版 `<el-divider style="margin:4px 0"/>`，插在自定义项之前
                return opt.dividerBefore === item
                  ? [h(NDivider, { style: { margin: '4px 0' } }), node]
                  : [node]
              }),
            ),
        },
      ),
    ])
}

const paymentPopShow = ref(false)
const progressPopShow = ref(false)

const columns = computed<DataTableColumns<OrderSummaryDto>>(() => [
  { type: 'selection' },
  { type: 'expand', renderExpand: (row) => renderExpandDetail(row) },
  {
    title: '操作',
    key: 'actions',
    width: editingId.value != null ? 150 : 140,
    render: (row) =>
      editingId.value === row.id
        ? h('div', { class: 'action-buttons' }, [
            h(NButton, { size: 'tiny', type: 'primary', onClick: saveEdit }, { default: () => '保存' }),
            h(NButton, { size: 'tiny', onClick: cancelEdit }, { default: () => '取消' }),
          ])
        : h('div', { class: 'action-buttons' }, [
            h(NButton, { size: 'tiny', quaternary: true, type: 'info', onClick: () => openFinance(row) }, { default: () => '财务' }),
            // 电子回执单：进预览页，分享链接在那边一键复制（旧版 Home 是直接复制链接到剪贴板，
            // 但那样看不到内容、剪贴板失败也没提示 —— 新版多一步、两件事都能干）。
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => openReceipt(row) }, { default: () => '电子回执单' }),
          ]),
  },
  {
    // 列头（旧版 `:11366-11384`）：`label` 下面挂一块 ——
    //   `po` 非空 → 一颗 text 按钮（`ho` 时显示「恢复中...」）；
    //   `po` 为空 → `查单号` 按钮开的 popover（宽 240），内含输入框 + 清除 / 确认。
    // 旧版这段全是**内联样式**（`Cu`/`zu`/`xu`/`Bu`），不是 CSS 类，所以这里也写内联。
    title: () =>
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            alignItems: 'center',
            textAlign: 'center',
          },
        },
        [
          h('span', null, '单号集'),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
            orderNoQuery.value
              ? h(
                  NButton,
                  { text: true, size: 'small', onClick: clearOrderNoQuery },
                  { default: () => (orderNoRestoring.value ? '恢复中...' : '清除') },
                )
              : h(
                  NPopover,
                  {
                    show: orderNoPopShow.value,
                    'onUpdate:show': (v: boolean) => (orderNoPopShow.value = v),
                    placement: 'bottom',
                    trigger: 'click',
                    width: 240,
                  },
                  {
                    trigger: () => h(NButton, { text: true, size: 'small' }, { default: () => '查单号' }),
                    default: () =>
                      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
                        h(NInput, {
                          value: orderNoInput.value,
                          'onUpdate:value': (v: string) => (orderNoInput.value = v),
                          size: 'small',
                          placeholder: '可只输入单号“-”前数字即可，如199.',
                          clearable: true,
                          // 旧版是 `onKeyup:withKeys(Yo,["enter"])`（`:473922`）——
                          // naive 的 NInput 不接 `onKeyup`，走 `inputProps` 透传到原生 input。
                          inputProps: {
                            onKeyup: (e: KeyboardEvent) => {
                              if (e.key === 'Enter') void confirmOrderNoQuery()
                            },
                          },
                        }),
                        h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, [
                          h(NButton, { size: 'small', onClick: clearOrderNoQuery }, { default: () => '清除' }),
                          h(
                            NButton,
                            { type: 'primary', size: 'small', onClick: () => void confirmOrderNoQuery() },
                            { default: () => '确认' },
                          ),
                        ]),
                      ]),
                  },
                ),
          ]),
        ],
      ),
    key: 'order_no_set',
    minWidth: 120,
    // 单元格（旧版 `:11388-11394`）：hover popover 列出**全部**单号，
    // 引用那一格显示 `To(row)`（查单号生效时是以关键字开头的那一段，否则第一段）。
    // `placement:bottom`(`dr(886)`)、`width:220`(`dr(1083)`)、引用 span `cursor:pointer`(`Eu`)。
    render: (row) => {
      const parts = orderNosOf(row)
      if (!parts.length) return h('span')
      return h(
        NPopover,
        { placement: 'bottom', trigger: 'hover', width: 220 },
        {
          trigger: () => h('span', { style: { cursor: 'pointer' } }, orderNoCell(row)),
          default: () => h('div', { class: 'order-no-pop' }, parts.map((s) => h('div', { key: s }, s))),
        },
      )
    },
  },
  {
    title: '客户',
    key: 'client_name',
    minWidth: 100,
    // 列头原生筛选（C16/C17）：旧版 `:11400` `filters:ta("客户")` + `"filter-method":ga`
    filterOptions: clientFilterOptions.value,
    filter: (v, row) => textColumnFilter('client_name', v, row),
    filterOptionValues: columnFilterValues('client_name'),
    // 旧版 `:11400-11407`（工厂态那一支）：
    //   `<div :class="{'paid-customer': Vo(row)}" style="cursor:pointer" title="点击修改客户名称">客户</div>`
    // 三个细节都要：①「已付清」绿块（`Vo(row)` = 未收为 0）；②`cursor:pointer`（新版走 `.clickable-cell`）；
    // ③ `title`（旧版 `dr(1490)`）。第二轮审计抓到 ②③ 先前都缺。
    // ④ hover tooltip（旧版 `sa`/`da` 挂在 el-table 的 `onCellMouseEnter/Leave` 上，只对这两列生效）
    render: (row) => {
      // `tip-cell` 是给 document 级 mousemove 判断「指针还在不在触发格里」用的（见 `showRowTip`）
      const cls = `tip-cell ${unpaidOf(row) === 0 ? 'clickable-cell paid-customer' : 'clickable-cell'}`
      return h(
        'div',
        {
          class: cls,
          title: '点击修改客户名称',
          onClick: () => openRename(row),
          onMouseenter: rowTipHandlers.onMouseenter(row),
          onMouseleave: rowTipHandlers.onMouseleave,
        },
        row.client_name,
      )
    },
  },
  {
    title: '日期',
    key: 'order_date',
    minWidth: 90,
    // ⚠️ naive 的列属性叫 **`sorter`**，不是 `sortable` —— 写错了**会被静默忽略**
    // （不报错、不警告，只是列头不出排序图标、点了没反应）。第二轮审计用 SSR 探针实测出来的：
    // `sortable:true` → `<th class="n-data-table-th">`（无图标）；
    // `sorter:true`   → `<th class="n-data-table-th--sortable">` + `<span class="n-data-table-sorter">`。
    sorter: true,
    filterOptions: dateFilterOptions.value,
    filter: (v, row) => textColumnFilter('order_date', v, row),
    filterOptionValues: columnFilterValues('order_date'),
    render: (row) => {
      const cells: ReturnType<typeof h>[] = [
        h(
          'div',
          { class: `clickable-cell ${dateCellClass(row)}`, onClick: () => openDate(row) },
          row.order_date,
        ),
      ]
      // 旧版 `:11423-11438`（G1）：**未审核**时在日期下方追加一颗 `el-button primary small`
      // 「审核确认」，`margin-top:4px`。
      if (isUnaudited(row)) {
        cells.push(
          h(
            NButton,
            {
              size: 'tiny',
              type: 'primary',
              style: { marginTop: '4px' },
              onClick: () => confirmAudit(row),
            },
            { default: () => '审核确认' },
          ),
        )
      }
      return h('div', cells)
    },
  },
  {
    title: '门数',
    key: 'door_count',
    minWidth: 80,
    filterOptions: doorCountFilterOptions.value,
    filter: (v, row) => textColumnFilter('door_count', v, row),
    filterOptionValues: columnFilterValues('door_count'),
  },
  {
    title: '总价',
    key: 'total_price',
    minWidth: 100,
    filterOptions: totalPriceFilterOptions.value,
    filter: (v, row) => textColumnFilter('total_price', v, row),
    filterOptionValues: columnFilterValues('total_price'),
    render: (row) => fmt(row.total_price),
  },
  {
    title: '已付',
    key: 'deposit',
    minWidth: 100,
    // 旧版 `:11469` `filters:ma` + `"filter-method":ya` —— 选项是 `co(row)` 的**金额数字**，
    // 不是「已付」这种标签（C18，最容易做错的一处）。
    filterOptions: paidFilterOptions.value,
    filter: paidColumnFilter,
    filterOptionValues: columnFilterValues('deposit'),
    render: (row) => {
      // 旧版 `:11468-11473` 的渲染分支（B37，**本次补上**）：
      //   `已分配金额 != null ? <span style="font-weight:600;color:#409eff">{已分配金额}</span>
      //                       : <el-input 定金>`
      // 即**有财务分配时恒为蓝色加粗 span（不可编辑）**，没有才是可编辑的定金输入框。
      //
      // ⚠️ 补它的直接原因：筛选口径 `co`（见 `paidOf`）本来就是 `已分配金额 ?? 定金`，
      //   而本列原先**恒显示 `deposit`** ⇒ 两者不等时「下拉里能选的数字，格子里一个都找不到」。
      //   照旧版修了显示，两边自动一致。
      //
      // ⚠️⚠️ **判据是 `> 0` 而不是 `!= null`（这里踩过一次，别再改回去）**：
      //   旧版 `:11470` 判的是**订单行上的 `已分配金额 != null`** —— 那个字段在没有分配时**是 null**。
      //   而新版摘要里的 `allocated_amount` 是 **`number`（非可空）**，后端用
      //   `COALESCE(SUM(amount), 0.0)` 再相加（`finance/service.rs:64-77`）⇒ **没有分配时是 0，不是 null**。
      //   照抄 `!= null` 会让条件**恒真**（摘要覆盖近 60 天的每一张单）⇒ **编辑框变成死代码**：
      //   凡用户实际会编辑的订单，已付列都恒为蓝色只读 `0.00`。**实测复现过**（第二轮审计）。
      //
      //   等价性：后端 `allocated = 已收 + 已分配`，没有分配/收款时为 0 ⟺ 旧版的 `null`。
      //   唯一不等价的边角：**分配额恰好为 0** 的单 —— 旧版显示只读 `0.00`、新版可编辑。
      //   那是退化情形（没有人为 0 元的分配记录），可接受。
      const s = financeSummary.value[row.id]
      if (s && s.allocated_amount > 0) {
        return h('span', { style: { fontWeight: 600, color: '#409eff' } }, fmt(s.allocated_amount))
      }
      if (editingId.value === row.id) {
        return h(NInputNumber, {
          value: draft.deposit,
          size: 'small',
          'onUpdate:value': (v: number | null) => {
            draft.deposit = v ?? 0
          },
        })
      }
      return h('div', { class: 'editable-cell', onClick: () => startEdit(row) }, fmt(row.deposit))
    },
  },
  {
    title: headerFilter({
      columnLabel: '未付',
      buttonLabel: '付款状态',
      items: PAYMENT_OPTIONS,
      clearLabel: PAYMENT_CLEAR,
      current: paymentFilter,
      show: paymentPopShow,
      onPick: (v) => (paymentFilter.value = v),
      onClear: () => (paymentFilter.value = PAYMENT_CLEAR),
    }),
    key: 'unpaid',
    minWidth: 100,
    // 旧版 `:11475` `filters:wa` + `"filter-method":fa` —— 同样是 `so(row)` 的金额数字。
    filterOptions: unpaidFilterOptions.value,
    filter: unpaidColumnFilter,
    filterOptionValues: columnFilterValues('unpaid'),
    render: (row) => {
      const u = unpaidOf(row)
      return h('span', { style: { color: u <= 0 ? '#67c23a' : '#f56c6c', fontWeight: 'bold' } }, fmt(u))
    },
  },
  {
    title: '订单备注',
    key: 'remark',
    minWidth: 220,
    filterOptions: remarkFilterOptions.value,
    filter: (v, row) => textColumnFilter('remark', v, row),
    filterOptionValues: columnFilterValues('remark'),
    render: (row) => renderEditable(row, 'remark'),
  },
  {
    title: '安装地址',
    key: 'install_address',
    minWidth: 220,
    filterOptions: addressFilterOptions.value,
    filter: (v, row) => textColumnFilter('install_address', v, row),
    filterOptionValues: columnFilterValues('install_address'),
    render: (row) => renderEditable(row, 'install_address'),
  },
  {
    // popover 选项 = 固定 4 项(`Bo`) → 分隔线 → 自定义项(`La`) → 显示全部，旧版渲染顺序见 `:11547-11581`。
    // 分隔线只在**有自定义项时**才插（旧版 `v-if="La.length"`，`:11553`）——
    // 所以这里把 `dividerBefore` 挂在「第一个自定义项」上：没有自定义项时那个值取不到，自然不插。
    title: headerFilter({
      columnLabel: '打单操作',
      buttonLabel: '生产进度',
      items: [...PROGRESS_OPTIONS, ...customProgressOptions.value, PROGRESS_CLEAR],
      clearLabel: PROGRESS_CLEAR,
      dividerBefore: customProgressOptions.value[0],
      highlightValue: true,
      current: progressFilter,
      show: progressPopShow,
      onPick: (v) => (progressFilter.value = v),
      onClear: () => (progressFilter.value = PROGRESS_CLEAR),
    }),
    key: 'production_status',
    minWidth: 150,
    filterOptions: productionStatusFilterOptions.value,
    filter: (v, row) => textColumnFilter('production_status', v, row),
    filterOptionValues: columnFilterValues('production_status'),
    // 旧版 `:11571-11582`：整格 `cursor:pointer`，点击（`.stop`）→ 开「手动更新进度」弹窗（`Ha`）。
    render: (row) =>
      h(
        'div',
        {
          class: 'progress-cell tip-cell',
          onMouseenter: rowTipHandlers.onMouseenter(row),
          onMouseleave: rowTipHandlers.onMouseleave,
          // ⚠️ **这里没有底色** —— 先前挂了 `statusBg(production_status)`，那是挂错列了。
          // 旧版 `la()` 全组件只有两个调用点（`:11589` 业务员 / `:11597` 打单人），
          // 而且都在 **`!qt`（代看别的租户）** 那一支 ⇒ 本系统里不可达，已整体删掉。
          // 详见「可编辑单元格」上方那段说明；打单操作格子旧版只设 `cursor:pointer`。
          style: { cursor: 'pointer' },
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            openManualProgress(row)
          },
        },
        renderProgress(row),
      ),
  },
  {
    title: '业务员',
    key: 'salesperson',
    minWidth: 80,
    filterOptions: salespersonFilterOptions.value,
    filter: (v, row) => textColumnFilter('salesperson', v, row),
    filterOptionValues: columnFilterValues('salesperson'),
    render: (row) => renderEditable(row, 'salesperson'),
  },
  {
    title: '打单人',
    key: 'creator_name',
    minWidth: 80,
    filterOptions: creatorFilterOptions.value,
    filter: (v, row) => textColumnFilter('creator_name', v, row),
    filterOptionValues: columnFilterValues('creator_name'),
    render: (row) => renderEditable(row, 'creator_name'),
  },
])

const tableHeight = 'calc(100vh - 300px)'
</script>

<style scoped>
.home-container {
  padding: 10px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.header-container {
  flex-shrink: 0;
}

.toolbar-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.grow-spacer {
  flex: 1;
}

.search-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}

.search-input {
  width: 320px;
}

.summary-info {
  font-size: 13px;
  color: #606266;
}

.table-container {
  flex: 1;
  min-height: 0;
}

/* 表头米色 + 16px bold 左对齐；单元格 16px（§3 `ha`/`dn`） */
:deep(.n-data-table-th) {
  background-color: #faeBD7 !important;
  color: #000 !important;
  font-size: 16px;
  font-weight: bold;
  text-align: left;
}
:deep(.n-data-table-td) {
  font-size: 16px;
}

/* 旧版 `legacy/css/Home-97d96482.css`：
     .pagination-container{display:flex;justify-content:center;align-items:center;margin-top:0;padding:5px 0}
     [data-v-…] .el-pagination{display:flex;align-items:center;gap:8px}
   元素间距那条：Element 是给 `__total`/`__sizes`/`__jump` 各加 `margin:0 5px`，
   naive 用自己的 `--n-item-margin`；这里统一成 `gap:8px`（两者的净观感以 8px 为基准）。 */
.pagination-container {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 0;
  padding: 5px 0;
}
.pagination-container :deep(.n-pagination) {
  gap: 8px;
}

/*
 * 可编辑列的**常驻输入框**（旧版 `[data-v] .el-input__inner` / `.el-textarea__inner`，
 * 见 `legacy/css/Home-97d96482.css`）：
 *   border:none; padding:2px 5px; transition:all .3s; background-color:transparent
 *   :hover        → background-color:#f5f7fa
 *   :focus        → background-color:#ecf5ff; box-shadow:0 0 0 2px #409eff33
 *   `.input-style`（textarea 两列）= 额外 `font-size:16px` + `word-break:break-all; white-space:pre-wrap`
 *
 * ⚠️ 旧版那两条 `[data-v-…] .el-input__inner{…}` 是**全局**的（Home 里所有输入框都吃），
 *    这里只上到这两个类上 —— 见 `renderEditable`。差别只在别处的输入框（工具栏搜索框等）
 *    有没有同样的无边框观感，属另一条线，不在本次审计条目里。
 */
.input-style :deep(.n-input__textarea-el) {
  padding: 2px 5px;
  transition: all 0.3s;
  background-color: transparent;
  resize: none;
  font-size: 16px;
  word-break: break-all;
  white-space: pre-wrap;
}
.input-style:hover :deep(.n-input__textarea-el) {
  background-color: #f5f7fa;
}
.input-style:focus-within :deep(.n-input__textarea-el) {
  background-color: #ecf5ff;
  box-shadow: 0 0 0 2px #409eff33;
}
.borderless-input :deep(.n-input__input-el) {
  padding: 2px 5px;
  transition: all 0.3s;
  background-color: transparent;
}
.borderless-input:hover :deep(.n-input__input-el) {
  background-color: #f5f7fa;
}
.borderless-input:focus-within :deep(.n-input__input-el) {
  background-color: #ecf5ff;
  box-shadow: 0 0 0 2px #409eff33;
}

/* 其余可点击格（客户 / 日期 / 单号集 / 定金）：无边框，hover 提示 */
.editable-cell,
.clickable-cell {
  min-height: 26px;
  line-height: 26px;
  cursor: pointer;
  border-radius: 3px;
  padding: 0 4px;
}
.editable-cell:hover,
.clickable-cell:hover {
  background: #f5f7fa;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

/* 打单操作进度条 */
.progress-cell {
  padding: 2px;
  border-radius: 3px;
}
.progress-bar {
  display: flex;
  height: 16px;
  border-radius: 3px;
  overflow: hidden;
  /* 旧版 `Au`/`ju`（`:7446-7449`）有 `margin-bottom:4px` —— 条下方现在有文字行，需要这段间距。 */
  margin-bottom: 4px;
}
.progress-seg {
  height: 100%;
}

/*
 * 列头筛选（旧版「未付」`:11475-11508` / 「打单操作」`:11534-11581`）。
 *
 * 旧版全是**内联样式**，没有可抄的 CSS 类 —— 除了 el-button 自己的默认样式。
 * 所以这里只补三件 Element 默认给、naive 不给的东西：
 *   · 列名与按钮**竖排居中**（旧版列头容器 `Su`/`Wu` 是 `display:flex;flex-direction:column;align-items:center`）；
 *   · 选项是**整行可点**的（旧版 `width:100%;justifyContent:flex-start` 写在按钮 style 上）；
 *   · hover 底色（el-button 默认的 hover 背景）。
 * 选中态的 `color`/`fontWeight` 写在 `headerFilter` 的 style 里（逐项不同，不适合进 CSS）。
 */
.header-filter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}
.filter-item {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.5;
  user-select: none;
}
.filter-item:hover {
  background: #f5f7fa;
}

/*
 * 单元格 hover tooltip —— 逐字取自旧版 `:11602-11604` 那串内联样式：
 *   position:fixed; transform:translateX(12px) translateY(calc(-100% - 8px));
 *   background:#fff; border:1px solid #e4e7ed; border-radius:4px; padding:8px 12px;
 *   box-shadow:0 2px 12px rgba(0,0,0,0.15); font-size:13px; line-height:2;
 *   zIndex:9999; pointerEvents:none; minWidth:120px
 * `left/top` 是动态的（进入单元格那一刻的 clientX/clientY），写在行内 `:style` 上。
 */
.row-tip {
  position: fixed;
  transform: translateX(12px) translateY(calc(-100% - 8px));
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  font-size: 13px;
  line-height: 2;
  z-index: 9999;
  pointer-events: none;
  min-width: 120px;
}

.order-no-pop {
  padding: 4px 6px;
  font-size: 13px;
}

/* 展开明细 */
.expand-detail {
  padding: 8px 16px 8px 60px;
  background: #fafafa;
}
.detail-block {
  margin-bottom: 8px;
}
.detail-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/*
 * 日期单元格状态色（旧版**单元格级**，样式逐字取自 `legacy/css/Home-97d96482.css`）。
 *
 * ⚠️ 先前写成了行级（`:deep(.date-audit) td`）且**只有背景色** —— 旧版是挂在日期那一格上的
 * 完整样式（含 `color`/`padding`/`border-radius`/`font-weight`），两者观感不同。
 * 现在类挂在日期单元格内层的 `div` 上（见 `dateCellClass` 与日期列的 `render`）。
 */
:deep(.date-audit) {
  background-color: #ffb6c1 !important;
  color: #721c24;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 700;
}
:deep(.date-warning) {
  background-color: #fff3cd !important;
  color: #856404;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 700;
}

/*
 * 客户列「已付清」绿块（旧版 `.paid-customer`，**单元格级**，`:11402-11404` 的 `Vo(row)`）。
 * 样式逐字取自 `legacy/css/Home-97d96482.css` —— 注意它有 `color`/`padding`/`border-radius`/
 * `font-weight`，不只是背景色。
 */
:deep(.paid-customer) {
  background-color: #90ee90 !important;
  padding: 4px 8px;
  border-radius: 4px;
  color: #000;
  font-weight: 700;
}

/*
 * 行状态底色（类由 `rowClass()` 产出）。样式逐字取自 `legacy/css/Home-97d96482.css`：
 *
 *   [data-v-…] .el-table__row, [data-v-…] .el-table__row.expanded-row { background-color:#fff!important }
 *   [data-v-…] .loaded-row                 { background-color:#dbdbd8!important }
 *   [data-v-…] .loaded-row.expanded-row    { background-color:#e2e2e0!important }
 *   [data-v-…] .el-table__body tr.duplicate-order-row>td.el-table__cell       { background-color:#ffe4ec!important }
 *   [data-v-…] .el-table__body tr.duplicate-order-row:hover>td.el-table__cell { background-color:#ffd6e4!important }
 *
 * ⚠️ **不能照抄到 `tr` 上。** 旧版挂在 `<tr>` 上能看见，是因为 Element Plus 的 `td` 是透明的；
 *    而 Naive 的 `.n-data-table-td` **自带** `background-color: var(--n-merged-td-color)`（= `#fff`，
 *    见 `naive-ui/es/data-table/src/styles/index.cssr.mjs`）⇒ 挂 `tr` 上会被 `td` 整片盖住、**完全看不见**。
 *    所以改成挂在 `td` 上（用 `>` 与旧版 `>td.el-table__cell` 同构）。
 *
 * ⚠️ 权重必须算准 —— 而且**不能靠读源码猜**：`{ a: 1 }` 那种 cssr 写法要展开成选择器才知道
 *    真实权重（`:not(...)` 是**要计入**的）。下面这张表是**实测**出来的：
 *    `node docs/home-audit/probe-naive-css.mjs` 把 Naive 真实生成的 CSS 打出来核对。
 *
 *   Naive 侧（实测的真实选择器）：
 *     `.n-data-table .n-data-table-td`                                            (0,2,0)  基准白
 *     `.n-data-table .n-data-table-tr:not(.n-data-table-tr--summary):hover
 *        > .n-data-table-td`                                                      (0,5,0)  悬停色
 *
 *   新版侧（`:deep(X)` 编译成 `[data-v-…] X`，那个**属性选择器自带 (0,1,0)**）：
 *     `.n-data-table-tr.loaded-row > .n-data-table-td`                            (0,4,0)
 *     `.n-data-table-tr.loaded-row.expanded-row > .n-data-table-td`               (0,5,0)
 *     `.n-data-table-tr.loaded-row:hover > .n-data-table-td`                      (0,5,0)  ↓ 手动还原悬停色
 *     `.n-data-table-tr.duplicate-order-row > .n-data-table-td`   + `!important`  (0,4,0)
 *     `.n-data-table-tr.duplicate-order-row:hover > .n-data-table-td` + `!important` (0,5,0)
 *
 *   逐种情形核对（「旧版」列＝按旧版 CSS 推出来的可见结果）：
 *     · 仅 loaded                → (0,4,0) > 基准白 (0,2,0) ⇒ `#dbdbd8` ✓
 *     · 仅 loaded + 悬停          → 新版那条 (0,5,0) 与 Naive 悬停 (0,5,0) **打平且同值** ⇒ 都对 ✓
 *     · loaded+expanded          → (0,5,0) 压基准白 ⇒ `#e2e2e0` ✓
 *     · loaded+expanded + 悬停    → 悬停条与它同为 (0,5,0)，**写在后面**⇒ 悬停色 ✓
 *     · 仅 expanded（未 loaded）  → 无规则命中 ⇒ 基准白，与旧版
 *                                  `.el-table__row.expanded-row{background-color:#fff!important}` 同 ✓
 *     · duplicate（± loaded/expanded）→ `!important` 通吃 ⇒ `#ffe4ec`；悬停 `#ffd6e4` ✓
 *                                  （旧版靠「`td` 上的 `!important` 盖住 `tr` 上的底色」，
 *                                    新版两类同落在一个 `td` 上，只能用 `!important` 复现）
 *
 *    ⇒ 悬停时回到 Naive 的 hover 底，与旧版等效（旧版底色在 `tr`、hover 把 `td` 涂掉，
 *      灰底同样被覆盖）。**悬停还原那一条必须显式写**：`.loaded-row.expanded-row` 是 (0,5,0)，
 *      比 Naive 悬停的旧假设值高，不写的话「已加载+已展开」的行**悬停不变色**（旧版会变）。
 *
 * ⚠️ 还原悬停色用了 Naive 自己的变量 `--n-merged-td-color-hover`（不是硬编码颜色）——
 *    表格在弹窗/气泡里时 Naive 会把它换成对应变体，写死颜色就会串。
 *    后面的 `#f5f7fa` 只是**兜底**：万一将来 Naive 改了这个变量名，声明会退回它，
 *    而不是变成 `transparent`（`var()` 无兜底且变量缺失时整个声明按 unset 处理）。
 */
:deep(.n-data-table-tr.loaded-row > .n-data-table-td) {
  background-color: #dbdbd8;
}
:deep(.n-data-table-tr.loaded-row.expanded-row > .n-data-table-td) {
  background-color: #e2e2e0;
}
/* 悬停还原：权重 (0,5,0) 与上面 `.loaded-row.expanded-row` 打平 ⇒ 靠**写在后面**决胜。 */
:deep(.n-data-table-tr.loaded-row:hover > .n-data-table-td) {
  background-color: var(--n-merged-td-color-hover, #f5f7fa);
}

/*
 * 重复单底色。**这两条带 `!important`，是照抄旧版**（旧版就是
 * `tr.duplicate-order-row>td.el-table__cell{background-color:#ffe4ec!important}`）。
 * 必须保留，因为它要压过 `loaded-row`：旧版靠「`td` 上的 `!important` 盖住 `tr` 上的底色」
 * 实现（两个不同元素，`td` 在上层），新版两类落在同一个 `td` 上 ⇒ 只能靠 `!important`
 * 复现同一结果（`loaded-row.expanded-row` 是 (0,5,0)，比重复单的 (0,4,0) 高）。
 */
:deep(.n-data-table-tr.duplicate-order-row > .n-data-table-td) {
  background-color: #ffe4ec !important;
}
:deep(.n-data-table-tr.duplicate-order-row:hover > .n-data-table-td) {
  background-color: #ffd6e4 !important;
}
</style>
