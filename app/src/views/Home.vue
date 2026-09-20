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
        <!-- ⚠️ 2026-09-19 删掉了一块**永不命中**的重复 `v-else-if="rawOrders.length"`：
             它紧跟在 `v-else-if="rawOrders.length > 0"` 之后、条件被后者完全覆盖，
             且两块内容**逐字相同** ⇒ 死代码。留着会让人以为还有第三种情形。 -->
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
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NPopover,
  useDialog,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { api } from '../api/client'
import { useHomeData } from '../composables/home/useHomeData'
import { useHomeFilterView } from '../composables/home/useHomeFilterView'
import { useHomeSelection } from '../composables/home/useHomeSelection'
import { useHomeQueryMore } from '../composables/home/useHomeQueryMore'
import { useHomeExpand } from '../composables/home/useHomeExpand'
import { useHomePrint } from '../composables/home/useHomePrint'
import { AUTOCOMPLETE_ALWAYS_SHOW, PROGRESS_OPTIONS, progressSegments } from '../utils/homeConstants'
import { legacyToday, localToday, pad } from '../utils/homeDate'
import { dateCellClass, fmt, isUnaudited, unpaidOf } from '../utils/homeMetrics'
import { orderNosOf } from '../utils/homeOrderNo'
import { useAuthStore } from '../stores/auth'
import FinanceDrawer from '../components/FinanceDrawer.vue'
import DashboardBigScreen from '../components/DashboardBigScreen.vue'
import PrintDrawer from '../components/PrintDrawer.vue'
import DetailLineDialogs from '../components/DetailLineDialogs.vue'
import PrintPreviewDialog from '../components/PrintPreviewDialog.vue'
import ReceiptOtherDialog from '../components/ReceiptOtherDialog.vue'
import Receipt2Dialog from '../components/Receipt2Dialog.vue'
import GlassSheet2Dialog from '../components/GlassSheet2Dialog.vue'
import ProductionSheet2Dialog from '../components/ProductionSheet2Dialog.vue'
import ProductionSheetDialog from '../components/ProductionSheetDialog.vue'
import QualifiedLabelDialog from '../components/QualifiedLabelDialog.vue'
// 2026-09-20 随搬迁一并删掉的 import（它们在页面里**只剩那一处用处**）：
//   · B9 → `useHomePrint.ts`：`QualifiedLabelEntry`
//   · B6 → `useHomeExpand.ts`：`OrderDto` / `OrderLineDto` / `FormulaDto` / `OrderLineInput` /
//     `Line` / `DetailLinesTable` / `useDetailLineDialogs` / `LS` / `useOrderLines` /
//     `NSpin` / `NEmpty` / `DataTableRowKey`
//   · B1 → `useHomeData.ts`：`OrderFinance`
// 留着它们 `vue-tsc` 会报 TS6133/TS6196（而 `npm run build` 会因此红）—— 同类先例是
// Task 3 搬 B10 时删掉的 `DataTableRowData`。
import type { OrderHeadInput, OrderSummaryDto } from '../api/types'

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
const PROGRESS_CLEAR = '显示全部'

// 「手动更新进度」弹窗 + 自定义进度项（旧版 §4.7，审计 G3–G11/B30/C12）。以下**四个**常量逐个有据：
//   `Na`（`:8036`）      = autocomplete 的 4 个固定候选
//   `wr`（`:7568`）      = localStorage 键：自定义操作项数组
//   `gr`（`:7568`）      = localStorage 键：`记录日期` 持久化偏好
//   `Bo`（`:7673`）      = 「打单操作」列头 popover 的 4 个固定项（新版把「显示全部」并进了同一个列表）
// ⚠️ 这段注释**原文描述的是六个常量**。第六行（`dr(1012)` = 自定义进度段的颜色）与后面 `ua` 那行
//    **已随 `CUSTOM_SEGMENT_COLOR` / `CUSTOM_SEGMENT_FLEX` 归位到 `app/src/utils/homeConstants.ts`**
//    （2026-09-20，纯搬迁）—— 「四个」就是照此改的，别再当回那份「六个常量」的原文。
const MANUAL_ACTION_OPTIONS = ['玻璃订单', '生产单', '收据单', '确认生产']
const MANUAL_ACTIONS_KEY = 'home_manual_progress_actions'
const RECORD_DATE_KEY = 'home_manual_progress_record_date'
const PROGRESS_FIXED_FILTERS = ['已打生产单', '未打生产单', '已订玻璃', '未订玻璃']

// ---------------------------------------------------------------------------
// 数据 / 加载（`loading` / `rawOrders` / `financeSummary` / `load`）
// 2026-09-20 整段搬到 `composables/home/useHomeData.ts`（逐字搬迁，零行为变化），
// 这里只留调用点 —— 搬出的名字仍在同一作用域，所以下面的模板一行都没改。
//
// ⚠️ **构造顺序**：本行必须是 setup 里**最早读这几个名字的顶层代码之前** ——
//    `filtered` 的 computed、`columns` 的回调、`onMounted` 里的 `load()` 都在它后面读，
//    而 `useHomeSelection` 更是把 `rawOrders` / `financeSummary` / `load` 三个都当注入项收。
//    往前挪 = 拿到 `undefined`，且**不一定报错**。
//
// ⚠️ **必须解构**（不许写成 `homeData.rawOrders`）：`<script setup>` 只对**顶层绑定**
//    自动解包 ref，模板读的是 `loading`(6) / `dashboardShow`(48) / `dashboardOrders`(407)。
// ---------------------------------------------------------------------------
const { loading, rawOrders, financeSummary, load, dashboardShow, dashboardOrders } =
  useHomeData({ message, auth })

// ---------------------------------------------------------------------------
// 筛选 / 列头筛选 / 分页（B3）—— 逻辑已搬出到 `composables/home/useHomeFilterView.ts`
// ---------------------------------------------------------------------------
// ⚠️ **构造顺序（Ruling 54）**：`B1 → B3 → B6 → B7 → B4 → B5` —— 本块**紧跟 B1**，
//    必须在 `useHomeSelection`（Task 3，注入 `filtered`/`rawOrders`/`financeSummary`）**之前**。
// ⚠️ 只解构**被段外真正引用**的名字（模板 / `columns` / 别的块）。纯内部件
//    （`matchSearch`/`distinctOptions`/`matchesColumnFilters`/`EMPTY_FILTER_LABEL`/`TEXT_FILTER_KEYS`/
//    `columnFilterState`/`pageSizeJustChanged` 及两个 `type`）解构出来就是未使用变量，`vue-tsc` 会报 TS6133。
const {
  searchText, onlyUnproduced, filtered, summary, paged, page, pageSize, tableRef,
  onPageChange, onPageSizeChange,
  paymentFilter, progressFilter, orderNoQuery, columnFilterValues, textColumnFilter,
  paidColumnFilter, unpaidColumnFilter, onUpdateFilters,
  clientFilterOptions, dateFilterOptions, addressFilterOptions, doorCountFilterOptions,
  totalPriceFilterOptions, remarkFilterOptions, salespersonFilterOptions, creatorFilterOptions,
  productionStatusFilterOptions, paidFilterOptions, unpaidFilterOptions,
  queryRows, queryMode, querySearchPreset,
} = useHomeFilterView({ rawOrders, financeSummary, auth })

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
// 「查单号」（§3.2，旧版 `po`/`fo`/`ho`/`Co` @ `:7671`）
// ---------------------------------------------------------------------------
/** 弹窗里输入框的内容（旧版 `fo`）。确认时会被补齐年份后缀后写回。 */
const orderNoInput = ref('')
/** 「恢复中…」标志（旧版 `ho`）—— 清除按钮在做收起动画期间显示这个字。 */
const orderNoRestoring = ref(false)
/** 「查单号」popover 的显隐（旧版 `Co`，受控，因为确认/清除都要主动关它）。 */
const orderNoPopShow = ref(false)

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

// 「查询更多」的结果集与其生效标志 —— 完整口径见下方「查询更多（审计 C21）」一节。
// 旧版 `ps` 的头一句就是 `gs.value ? ws.value : fs.value`（`:11153`/`:11172`，`fs` 读全量 `_l`）：
// **查询态下主表显示的是查询结果集，不是全量列表**。

// ---------------------------------------------------------------------------
// 行状态色（§3）
//
// 旧版一共 5 个状态色类，分三层挂钩，新版一一对应：
//   · **行级** `Qo`（`:7842-7849`，挂在 el-table 的 `row-class-name` 上）——`expanded-row` /
//     `loaded-row` / `paid-row` / `duplicate-order-row` ⇒ 新版 `rowClass()`，见「展开明细」一节末尾
//     （它同时依赖 `expandedRowKeys`，所以放在那边）。
//   · **单元格级** `Ls`（`:11221-11227`）——`date-audit` / `date-warning` ⇒ `dateCellClass()`（已搬到 `utils/homeMetrics.ts`）。
//   · **单元格级** `.paid-customer`（`:11402-11404`）——挂在**客户列**的 `render` 上。
//
// ⚠️ **更正一条旧注释**：这里先前写着「`.paid-row`/`.paid-customer`/`.duplicate` 无清晰口径、
//    暂不实现」——**与源码不符**。口径全部写死在 `Zo`(`:7827`) / `Xo`(`:7830`) / `Vo`(`:7664`) /
//    `Qo`(`:7842`) 里，且 `legacy/css/Home-97d96482.css` 里是**活样式**（不是死码）。
//    `.paid-row` 现在仍不实现，但理由换成了真实的那个：**`grep -r paid-row legacy/` 零 CSS 命中**，
//    旧版加了类却没有对应规则，是不生效的死码。
// ---------------------------------------------------------------------------
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
  // 旧版 `:11412-11419`：**只有「单号集」为空才让改生产日期**，
  // 否则 `ElMessage.warning("已生产的单不能修改生产日期")` 并**不开弹窗**。
  // 判据逐字：`"" === (单号集 ?? "").toString().trim()` 才放行。
  //
  // ⚠️ **这条注释 2026-09-19 更正过**：原写「打单操作」，与源码不符 ——
  //    旧版取的是 `dr(1362)`，`node legacy/decode-token.mjs dr 1362` = **「单号集」**。
  // ⚠️ **而下面的代码判的是 `production_status`（打单操作），两者不等价**：
  //    点过「审核确认」（打单操作非空）但**还没「填入单号」**的单，旧版**放行**改日期、我们**拦住**
  //    （反向亦然）。已记为待拍板的行为偏离（`docs/home-audit/00-summary.md` §五.1），**别照这行改代码**。
  if ((row.production_status ?? '').toString().trim() !== '') {
    message.warning('已生产的单不能修改生产日期')
    return
  }
  dateTarget.value = row
  dateValue.value = row.order_date ? Date.parse(row.order_date) : null
  dateShow.value = true
}

/**
 * 「审核确认」（旧版 `Ba`/`Ma`/`rn`，`:476268-476400`，审计 `02-actions.md` G2）。
 *
 * 旧版两步：① 把**下单日期改成今天**（`Ma` = 今天 → `rn()`，那条路会重算截止日期）；
 * ② `Hl("确认下单", [回执单号])` = `updataProgress`，把「确认下单」追加进进度串。
 *
 * ⚠️ 新版**不需要**手动重算截止日期 —— `due_date` 由 SQL 推导
 * （`orders/service.rs` 的 `HEADER_COLUMNS`：`order_date + production_days`），改日期自动跟随。
 * （旧版重算那一步算的是 `今天 + ceil((旧截止−旧日期)/天)`，而旧版 `截止 = 日期 + 生产天数`
 *  ⇒ 等价于「今天 + 生产天数」，与我们这条推导一致。2026-09-19 修掉了我们多算的那一天。）
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
// 2026-09-20 与「数据 / 加载」一起搬到 `composables/home/useHomeData.ts`
//（逐字搬迁，零行为变化）—— `dashboardShow` / `dashboardOrders` 的调用点在 setup 顶部。
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 选中集 + 三个批量动作（删除选中 / 清账 / 合并订单）
// 2026-09-20 整段搬到 `composables/home/useHomeSelection.ts`（逐字搬迁，零行为变化），
// 这里只留调用点 —— 搬出的名字仍在同一作用域，所以下面的模板一行都没改。
//
// ⚠️ **构造顺序**：`filtered` / `rawOrders` / `financeSummary` / `load` 都是 setup 顶层
//    即时求值，本行必须在它们**之后**（这里正是原先 `checkedRowKeys` 的位置，满足）；
//    往前挪会拿到 `undefined`，且**不一定报错**。
//
// ⚠️ **`selectAllMode` 故意不在这里解构**：它只在 `onCheckedKeys` 内部用（旧版那个 `Wl`
//    是纯开关记忆、**不参与渲染**），模板从不读它 —— 解构出来就是一个未使用变量，
//    `vue-tsc --noEmit` 的 TS6133 会直接报错。它在 composable 的返回值里（接口完整），
//    只是本页不需要。
// ---------------------------------------------------------------------------
const { checkedRowKeys, onCheckedKeys, deleteSelected, clearAccounts, combineSelected } =
  useHomeSelection({ filtered, rawOrders, financeSummary, load, message, dialog })

// ---------------------------------------------------------------------------
// 「查询更多」弹窗（审计 C21）—— 逻辑已搬出到 `composables/home/useHomeQueryMore.ts`
// ---------------------------------------------------------------------------
// ⚠️ **构造顺序（Ruling 54）**：本块在 `B1 → B3 → B6 → B7 → B4 → B5` 里**排最后**，
//    必须在 B3（`searchText`/`queryRows`/`queryMode`/`querySearchPreset`）与 B4（`useHomeOrderNo`）
//    之后 —— 传早了拿到的是 `undefined`，且**只有点「确定查询」那一下才炸**（编译/启动都不报）。
// ⚠️ 只解构模板与页面真正用到的 7 个：`queryClients`/`dayStart`/`yearAgoStart`/`toIsoDate`
//    是纯内部件（实测段外零读点），解构出来就是未使用变量，`vue-tsc` 的 TS6133 会报错。
const {
  queryShow, queryLoading, queryForm, DATE_SHORTCUTS, clientSuggestions,
  openQuery, submitQuery,
} = useHomeQueryMore({
  rawOrders, financeSummary, searchText, queryRows, queryMode, querySearchPreset, auth, message,
})

// ---------------------------------------------------------------------------
// 展开明细（§4.1：fetch detail → 平开/移门只读子表）—— 逻辑已搬出到 `composables/home/useHomeExpand.ts`
// ---------------------------------------------------------------------------
// ⚠️ **构造顺序**：必须在 `message` / `dialog`（页面顶部就建好）之后、`useHomePrint(...)`（下一块）**之上**。
//    两条边的方向是相反的：B9 的 `openPrint` 要读本块的 `details`（⇒ B6 在前），
//    而本块的「算料」要调 B9 的 `openPrintPreview`（⇒ 那条边只能靠**前向引用**的转发函数）。
// ⚠️ 只解构页面真正用到的 8 个（每一项都有实测的外部读者，见新家文件头那张表）：
//    其余 15 个声明**段外零命中**（实测），解构出来就是未使用变量，`vue-tsc` 的 TS6133 会报错。
const {
  expandedRowKeys, details, homeFormulas, homeDialogs, loadedIds,
  onExpandedKeys, loadDetail, renderExpandDetail,
} = useHomeExpand({
  message,
  dialog,
  // ⚠️ **前向引用**：`openPrintPreview` 由下面的 `useHomePrint(...)` 借出，而它要等本块交出 `details`
  //    才能构造 ⇒ 这里只能转一道。箭头体在**点击「算料」时**才求值，setup 期间不会被调，
  //    所以 `const` 的 TDZ 不构成问题（REF 里那三句原本也是「运行时才写」）。
  openPrintPreview: (orders, autoLineNumbers) => openPrintPreviewFn(orders, autoLineNumbers),
})

// ---------------------------------------------------------------------------
// 打印选中订单（§4.2）—— 逻辑已搬出到 `composables/home/useHomePrint.ts`
// ---------------------------------------------------------------------------
// ⚠️ **构造顺序**：必须在 `checkedRowKeys`（B10）与 `details`（B6，上面那一摊）**之后** ——
//    两者都是 setup 顶层即时求值，传早了拿到 `undefined`，且**不一定报错**。
// ⚠️ 23 个名字**全部解构**（不许写成 `print.xxx`）：`<script setup>` 的模板只对**顶层绑定**
//    自动解包 ref，写成属性访问会让 7 处 `v-model:show` 把 ref 对象整个换成布尔值（**静默**坏）。
//    完整理由见新家文件头。
const {
  printShow, printOrders, previewShow, previewMode, previewTitle, previewAutoLineNumbers,
  receiptOtherShow, receiptOtherOrders, receipt2Show, receipt2Orders,
  glassSheet2Show, glassSheet2Orders, productionSheet2Show, productionSheet2Orders,
  productionSheetShow, productionSheetOrders,
  qualifiedLabelShow, qualifiedLabelOrders, qualifiedLabelEntry,
  openPrint, onOpenMode, onOpenReceiptOther, onOpenDoc,
  // ⚠️ 这一项**页面自己不用**，只被上面 useHomeExpand 那个前向引用消费 —— 改名加 `Fn`，
  //    免得读的人以为页面上还有别处直接调它（改名不影响行为；不留原名会撞 TS2448 那种误读）。
  openPrintPreview: openPrintPreviewFn,
} = useHomePrint({ checkedRowKeys, details, message })

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
  //    / `:3788-3792`，靠 Home 往下传 `highlightOrderQuery`）。
  //
  //    ⚠️ **这条注释 2026-09-19 更正过**：原写「新版做不了，`OrderLineDto` 里没有『单号』字段」
  //    —— **已过期**。迁移 `0020` 之后 `OrderLineDto.line_no` **已经存在**
  //    （`app/src/api/types.ts:162`），样式也随组件搬到了 `components/DetailLinesTable.vue:1366-1371`。
  //    ⇒ 现在**做得了、只是没做**（这一点属「数据模型补回之前无落点」那个理由的失效，
  //    见 `docs/home-audit/02-actions.md` 的 I4，判定已从 ✅ 改成 ⚠️）。
  //    所以这里仍然刻意不写滚动 —— 但**理由变了**：不是「做不了」，是**还没做**。
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
      progressSegments(status, manualActions).map((seg) =>
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
    unpaidOf(row, financeSummary.value) === 0
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
  const segs = progressSegments(row.production_status, manualActions)
  if (!segs.length && unpaidOf(row, financeSummary.value) !== 0) return null
  return { lines: segs.map((s) => ({ text: s.label, done: s.done })), paid: unpaidOf(row, financeSummary.value) === 0 }
}

/**
 * 把提示挪到鼠标处。
 *
 * ⚠️ **这是有意偏离**（2026-09-19 更正注释）：原写「和旧版 `Va` 的意图一致」——
 *   而旧版那个 `Va`（`Home.formatted.js:7983`）**全文件零调用，是死码**，
 *   所以旧版**根本不跟手**（位置只在进入单元格那一刻取一次）。
 *   我们是照它的「意图」实现的 ⇒ 行为与旧版不同，已按 ⚠️ 记在
 *   `docs/home-audit/00-summary.md` §五.2（**改回「不跟手」与否待拍板**）。
 */
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
      const cls = `tip-cell ${unpaidOf(row, financeSummary.value) === 0 ? 'clickable-cell paid-customer' : 'clickable-cell'}`
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
          { class: `clickable-cell ${dateCellClass(row, financeSummary.value)}`, onClick: () => openDate(row) },
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
      const u = unpaidOf(row, financeSummary.value)
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
/* 减掉全局标题栏的高度（`App.vue` 的 `--app-header-h`），否则整页会被顶出去 60px。 */
.home-container {
  padding: 10px;
  height: calc(100vh - var(--app-header-h));
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
