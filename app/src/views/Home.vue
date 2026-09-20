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
  onMounted,
  ref,
} from 'vue'
import { useRouter } from 'vue-router'
import {
  NAutoComplete,
  NButton,
  NCheckbox,
  NDataTable,
  NDatePicker,
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
import { useHomeRowEditing } from '../composables/home/useHomeRowEditing'
import { useHomeManualProgress } from '../composables/home/useHomeManualProgress'
import { useHomeCellRender } from '../composables/home/useHomeCellRender'
import { useHomeOrderNo } from '../composables/home/useHomeOrderNo'
import { AUTOCOMPLETE_ALWAYS_SHOW, PROGRESS_OPTIONS } from '../utils/homeConstants'
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
//   · B12 → `useHomeCellRender.ts`：`NDivider` / `progressSegments`（页面另外那两处 `progressSegments`
//     调用就在 B12 里，已随之走）+ `reactive` 与 `type Ref`（页面最后一处用处也都在 B12 里）
//   · B11 → `useHomeManualProgress.ts`：`InputHTMLAttributes`（页面只为 `manualNameInputProps` 用它）
//   · B4 → `useHomeOrderNo.ts`：`nextTick`（页面另外两处用处都在 `confirmOrderNoQuery` /
//     `clearOrderNoQuery` 里，随它们一起走；新家直接从 `vue` import）
//   · **整条** `import { legacyToday, localToday, pad } from '../utils/homeDate'` 也一并删了 ——
//     三个名字在 B11 搬完后**都没有页面上最后一处用处**了（`localToday` 随 `confirmAudit`、
//     `pad` 随 `isoDate`（与 T12 的 `submitDate`）、`legacyToday` 随 `openManualProgress`），
//     而它们的新家都直接 `import` 自 `utils/homeDate`，不经页面转发。
// 留着它们 `vue-tsc` 会报 TS6133/TS6196（而 `npm run build` 会因此红）—— 同类先例是
// Task 3 搬 B10 时删掉的 `DataTableRowData`。
import type { OrderSummaryDto } from '../api/types'

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

// 「手动更新进度」弹窗 + 自定义进度项（旧版 §4.7，审计 G3–G11/B30/C12）
// 2026-09-20 连同它那**四个模块级常量**（`MANUAL_ACTION_OPTIONS` / `MANUAL_ACTIONS_KEY` /
// `RECORD_DATE_KEY` / `PROGRESS_FIXED_FILTERS`）一起搬到
// `composables/home/useHomeManualProgress.ts`（逐字搬迁，零行为变化）—— 四个常量各自的旧版
// 依据（`Na`/`wr`/`gr`/`Bo`）随那段注释走了，调用点在下面「手动更新进度」那一节。

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
//
// 2026-09-20 本节的**声明**整块搬到 `composables/home/useHomeOrderNo.ts`（逐字搬迁，零行为变化）
// —— 含原本长在这里的 `orderNoInput` / `orderNoRestoring` / `orderNoPopShow` 三个 ref。
// **调用点在下面**「查单号的动作」那一节：它注入 B6（`useHomeExpand`）的回传，只能排在 B6 之后，
// 留不到本处（本处早于 B6）。本节剩下来的只有**页面自己的**东西：留在页面的 `columns` 里那一格
// （「单号集」列，`title`/`render` 里读写那三个 ref + 调 `orderNoCell`）。
// ⚠️ 这 6 个名字**在 `<template>` 里零命中**（实测）—— 别照别块的「模板绑定必须解构」类推。

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
// 改客户名 / 改日期（§4.4/§4.6，Phase 1 走 updateOrderHead 就地改）
// 2026-09-20 整段搬到 `composables/home/useHomeRowEditing.ts`（逐字搬迁，零行为变化），
// 这里只留调用点 —— 搬出的名字仍在同一作用域，所以下面的模板与 `columns` 一行都没改。
//
// ⚠️ **构造顺序**：`message`（页面顶部 `useMessage()`）与 `load`（B1 `useHomeData` 回传）
//    都是 setup 顶层即时求值，本行必须在它们**之后**；而 B12（`useHomeCellRender`，也就是
//    `columns` 里那个 `renderEditable`）还要读本块借出的 `editingId`/`draft`/`startEdit`
//    ⇒ 本行必须在那一步**之前**。往前挪 = 拿到 `undefined`，且**不一定报错**。
//
// ⚠️ **15 个名字全部解构**（不许写成 `rowEditing.xxx`）：`<script setup>` 的模板只对**顶层绑定**
//    自动解包 ref。模板 177 的 `renameValue` 与 200 的 `dateValue` 是 `v-model` **写入** ⇒
//    属性访问会把 **ref 对象整个换成字符串**（弹窗当场失效，**静默**）；
//    `renameShow`/`dateShow` 的显隐也不再响应。完整理由见新家文件头。
// ---------------------------------------------------------------------------
const {
  editingId, draft, startEdit, saveEdit, cancelEdit,
  renameShow, renameTarget, renameValue, openRename, submitRename,
  dateShow, dateTarget, dateValue, openDate, submitDate,
} = useHomeRowEditing({ message, load })

// ---------------------------------------------------------------------------
// 「审核确认」——声明已归位到 `composables/home/useHomeManualProgress.ts`
// ---------------------------------------------------------------------------
// 为什么和「手动更新进度」同住一个文件而不是单独一块：它体里走的正是那条既有通路
// （`headWithStatus` + `updateOrderHead`，与「手动更新进度」写的是同一个字段），
// 两者的调用点也都在 `columns` 里。
// 调用点见下面「手动更新进度」那一节（同一个 `useHomeManualProgress(...)`）。

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
// 「查单号」的动作（§3.2 旧版 `Yo`/`Wo`）—— 声明已归位到 `composables/home/useHomeOrderNo.ts`
// （2026-09-20 逐字搬迁，零行为变化），这里只留调用点 —— 搬出的名字仍在同一作用域，
// 所以下面 `columns` 里那一格一行都没改。
//
// ⚠️ **构造顺序**：11 项注入分属 B1 / B3 / B6 与页面（`message`）⇒ 本行必须在
//    `useHomeExpand`(B6) **之后**。这正是它不能留在原处的原因（那三个 ref 原本在「筛选」一节
//    下面，早于 B6）—— 往前挪 = 拿到 `undefined`，且**不一定报错**。
//
// ⚠️ **6 个名字全部解构**（写成 `orderNo.xxx` 也能跑，是**约定**）：实测它们在 `<template>`
//    里**零命中**，唯一的读者就是下面留在页面的 `columns`（它按 **显式 `.value`** 读写，
//    那是普通 JS、不吃模板自动解包）⇒ 解构的实际好处是**让 `columns` 一行都不用改**。
//    完整理由（含「别把这条类推到 B7 的 `rowClass`」）见新家文件头。
// ---------------------------------------------------------------------------
const {
  orderNoInput, orderNoRestoring, orderNoPopShow,
  orderNoCell, confirmOrderNoQuery, clearOrderNoQuery,
} = useHomeOrderNo({
  rawOrders, orderNoQuery, onlyUnproduced, filtered, page, queryRows, queryMode,
  expandedRowKeys, details, loadDetail, message,
})

// ---------------------------------------------------------------------------
// 手动更新进度 + 自定义进度项（§3 `Ea`/`La`/`ua`；§4.7 `Ha`/`ln`/`on`/`Ua`/`Ia`/`Sa`/`Ta`/`Ya`/`Wa`）
// 2026-09-20 整块（含「审核确认」与四个模块级常量）搬到
// `composables/home/useHomeManualProgress.ts`（逐字搬迁，零行为变化），
// 这里只留调用点 —— 搬出的名字仍在同一作用域，所以模板与 `columns` 一行都没改。
//
// ⚠️ **构造顺序**：`message`（页面顶部 `useMessage()`）· `load`（B1 `useHomeData` 回传）·
//    `progressFilter`（B3 `useHomeFilterView` 借出）都是 setup 顶层即时求值 ⇒ 本行必须在
//    那两块**之后**；而 B12（`useHomeCellRender`）的 `progressSegments(status, manualActions)`
//    要读本块借出的 `manualActions` ⇒ 本行必须在那一步**之前**。往前挪 = 拿到 `undefined`，
//    且**不一定报错**。
//
// ⚠️ **只解构页面真正用到的 16 个**（模板 14 处 + `columns` 4 处，逐项实测有活读者，见新家
//    文件头）：其余 12 个声明（`readManualActions`/`saveManualActions`/`rememberManualAction`/
//    `forgetManualAction`/`isoDate`/`onManualNameContextMenu`/`manualProgressParam`/`headWithStatus`
//    等）段外零命中，解构出来就是未使用变量，`vue-tsc` 的 TS6133 会报错。
//
// ⚠️ 模板 245/246 的 `manualName` 是**写**（`@update:value` / `@select`）⇒ 必须解构：
//    写成 `manual.manualName` 会退化成普通属性赋值，**把 ref 对象整个换成字符串**（**静默**）。
// ---------------------------------------------------------------------------
const {
  confirmAudit, customProgressOptions,
  manualShow, manualTarget, manualName, manualDate, manualRecordDate,
  manualNameOptions, manualNameInputProps, onManualNameBlur, onRecordDateChange,
  openManualProgress, closeManualProgress, submitManualProgress, deleteManualProgress,
  manualActions,
} = useHomeManualProgress({ message, load, progressFilter })

// ---------------------------------------------------------------------------
// 列定义（§3；Phase 1 = 工厂视图 Yt）
// 2026-09-20 把这一节里的**单元格渲染件**搬到 `composables/home/useHomeCellRender.ts`
// （逐字搬迁，零行为变化）：`progressPrefix`/`progressSuffix`/`renderProgress`、整段行提示
// （`rowTipShow`/`rowTipLines`/`rowTipPaid`/`rowTipEl`/`rowTipInitStyle`/`rowTipHandlers`）、
// `renderEditable`、`headerFilter`。`la()` 底色那 19 行说明、分隔符口径冲突注释、
// 两个大 JSDoc（`renderEditable` 22 行 + `headerFilter` 34 行）都随声明走了。
// ⚠️ `progressSegments` **不在这里** —— 它更早（Task 4）就归位到 `utils/homeConstants.ts` 了。
//
// ⚠️ **`columns` 仍留在本文件**（用户拍板），本行只是它上面那一节的入口 ——
//    `paymentPopShow`/`progressPopShow` 也留在页面上（它们是 `columns` 的弹窗状态）。
//
// ⚠️ **构造顺序**：`editingId`/`draft`/`startEdit` 来自 B8、`manualActions` 来自 B11、
//    `financeSummary` 来自 B1 ⇒ 本行必须在三块**之后**。往前挪 = 拿到 `undefined`，
//    且**不一定报错**。
//
// ⚠️ **9 个名字全部解构**（不许写成 `cell.xxx`）：`<script setup>` 的模板只对**顶层绑定**
//    自动解包 ref，属性访问会让模板 153/154/159 拿到 **Ref 对象**而不是值；
//    `rowTipEl` 更是**模板 ref**（`ref="rowTipEl"`），写成属性访问连挂载点都对不上。
//    其余 7 个声明（`progressPrefix`/`progressSuffix`/`rowTipContent`/`moveRowTip`/`hideRowTip`/
//    `showRowTip`/`rowTipMove`）段外零命中，解构出来就是未使用变量（TS6133）。
// ---------------------------------------------------------------------------
const {
  renderProgress,
  rowTipShow, rowTipLines, rowTipPaid, rowTipEl, rowTipInitStyle, rowTipHandlers,
  renderEditable, headerFilter,
} = useHomeCellRender({ editingId, draft, startEdit, manualActions, financeSummary })

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
      // `tip-cell` 是给 document 级 mousemove 判断「指针还在不在触发格里」用的（见 `useHomeCellRender.ts` 的 `showRowTip` —— 2026-09-20 随 B12 搬走，指针已改准）
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
 *    这里只上到这两个类上 —— 见 `renderEditable`（声明已归位到 `composables/home/useHomeCellRender.ts`，
 *    2026-09-20 随 B12 纯搬迁；本文件只留解构出来的同名绑定）。差别只在别处的输入框（工具栏搜索框等）
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
 * 选中态的 `color`/`fontWeight` 写在 `headerFilter` 的 style 里（逐项不同，不适合进 CSS）
 * —— `headerFilter` 的声明已归位到 `composables/home/useHomeCellRender.ts`（2026-09-20 随 B12 纯搬迁）。
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
