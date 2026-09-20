<template>
  <!--
    生产进度（旧版 `/Progress`）。

    逆向：`docs/2026-09-19-progress-analysis.md`（前端）、`-server.md`（服务端）、`-shell.md`（外壳/看板）。

    ## 本文件进展

    - 第一刀：骨架 —— 路由 / 导航项 / 拉全量数据 / **PC 14 列** / 分页（100 每页，可选 [10,20,50,100,200]）。
    - 第二刀：**单元格保真** + **列头交互**（`va()` 渲染 / 颜色 / 表头筛 / 查单号 / 颜色筛选）。
    - 第三刀：**工具条 + 统计行**（旧版 `search-row`，§2.2 / §5.4）+ **导出表格**（§4.6）。
    - 第四刀：**行内「删除」**（§4.3）—— 日期列那颗红字链接补齐（「更新进度」上一刀已做）。
    - 第五刀：**生产分析看板**（`components/ProgressDashboard.vue`）。
    - 第六刀：**打印抽屉**（§4.5，`PrintDrawer` 的 `preset="progress"`）
      + **「日期」列的行勾选**（表头全选 / 行内勾选框）⇒ 「批量更新」**真的能出现了**。
    - 第七刀（本笔）：**「查询更多」对话框**（§3.3 / §4.1 的 `Bo`/`xo` 那一层）
      ⇒ 工具条 **7 颗按钮全部接上真目标**，本页不再有任何「置灰占位」按钮。
      顺带把看板那条 `customQuery → 查询更多 → setCustomDateRange` 的环接上（看板 §3.5）。

    ## ⏳ 还没做（按旧版顺序，各自独立可验）

    1. ~~**工具条**~~ ✅ **全做完**：打印选项 / 批量更新(n) / 查询更多 / 生产分析 / 刷新 /
       导出表格 / 搜索框 / 统计行 —— **七颗都有真目标**，`notYet()` 与 `.pending-slot` 已删。
    2. ~~**打印抽屉**~~ ✅ **已做**（旧版 §4.5）：「打印选项」→ `PrintDrawer`
       `preset="progress"` 那 **12 类**单据 → `PrintPreviewDialog` 预览。
       ⚠️ **两类置灰**（「平开门生产单 / 移门生产单」，旧版的 ping/diao 拆分 + 单行分页本版没有），
       逐条理由写在 `PrintDrawer.vue` 的 `PROGRESS_ITEMS` 注释里。
    3. ~~**更多查询对话框**~~ ✅ **已做（本笔）**（旧版 `Lo` + `Io`）：「查询更多」→
       「查询订单」对话框 → `GET /v1/progress/more` → 换底表（`Bo`/`xo`）+ 并入全量 + 搜索框回显。
       见 `openMore` / `submitMore` / `filteredRows` 上方那三段注释。
    4. ~~**行内动作**~~ ✅ **全做完**：「更新进度」/「删除」已做（§4.2 / §4.3）；
       **「日期」列的行勾选 checkbox** ✅ 本笔补上（表头 = 全选/取消全选，范围是**当前筛选结果**）。
       ⇒ 工具条「批量更新 (n)」按旧版条件（已选 > 1）**自动出现**，点开是同一个更新进度弹窗的批量版
       （标题 `批量更新进度 (n条)`、先过「有没有缺单号的行」那道闸），见 `openBatchUpdate`。
    5. ~~**生产分析看板**~~ ✅ **已做（第五刀）**：`components/ProgressDashboard.vue`
       （5 KPI + 4 饼图 + 趋势 + 4 个统计 tab + 导出 xlsx），口径层在 `utils/productionStats.ts`，
       与旧版逐字段对过（`docs/progress-dashboard-logiccheck.mjs`）。
       ⚠️ 它**不是**我们已有的 `DashboardBigScreen`（那个是 Home 的经营数据，零 echarts）。
       ⚠️ 本版**有意偏离**旧版的 4 处：数据范围、图表 resize、`" "` 日期、重置口径、
       本周起点 —— 逐条写在 `ProgressDashboard.vue` 与 `productionStats.ts` 的注释里。
    6. **终端模式**（10 列）—— **本版不做**：旧版那条接口在服务端是写死 400，路本来就是坏的

    ## ✅ 第三刀做了什么（逐条对着 §2.2 / §4.6 / §5.4）

    - **工具条**（`.search-row`）：7 颗按钮 + 搜索框，**顺序、类型色、出现条件**照旧版
      （`type` 依次是 primary / warning / primary / primary / success / warning）。
    - **搜索框**：空格分词、**每个词都要命中**十个字段之一（字段顺序照旧版）；
      加了「词一变就回第 1 页」（旧版不重置页码，那是毛病，见 `watch(searchText)` 的注释）。
    - **统计行**：两种形态（有搜索词 → 「当前筛选」；否则 → 「总计」，且**一条数据都没有时整行不渲染**）。
    - **导出表格**：ExcelJS 造「筛选结果」表（§4.6），列 / 底色 / 行高 / 文案逐项照抄。
      依赖 `exceljs@4.4.0`（**动态 import**，只在点导出时才下载那个 ~940KB 的 chunk）。

    ## ✅ 第二刀做了什么（逐条对着 §5.2 / §5.3 / §2.3 / §4.1）

    - 「生产进度」格：`va()` **逐字照搬**（红字加粗 15px 标出「当前工序」）+ 含「回款」时整段 `.progress-paid`（红字）。
    - 「生产进度」格的**底色**：旧版走 `el-table` 的 `cell-style`，不是单元格内容 —— 这里走 naive 的 `cellProps`。
    - 各格的「一格多控件」小标签：**类名与结构照抄旧版**（`.glass-inputs-container` /
      `.glass-inputs-container2` / `.glass-input-group` / `.glass-input-label`）。
    - 列头：「单号」= 表头筛（有单号/空单号）+「查单号」popover；「生产进度」=「颜色筛选」popover。

    ## ⚠️ 三处**与旧版不同**（都有理由，别当成抄错）

    1. **颜色不再读 localStorage**。旧版读全局键 `procedure_name_color_map`（键是**工序名**，
       换账号会串租户）；新版颜色落在 `procedures` 表的 `color` 列，按 **slot** 存，
       从 `GET /v1/procedures` 拿。见 `docs/2026-09-19-qrscanner-analysis.md` §4.6 / §8.3-2。
    2. **旧版的 `procedure_name_order_list` 这个键新版没有**，见 `orderedProcedureNames` 的注释
       —— 用「按槽号从后往前」等价替代。
    3. **`va()` 里的原文做了 HTML 转义**（旧版是裸 `innerHTML`）。见 `va()` 的注释。

    ## 有意偏离（照抄会出错的地方）

    - 旧版表格有 `v-if="K2.value.length > 1"` —— **只有 1 条时整表不渲染**（连表头都没有）。
      那是毛病，新版用 `> 0`（见 §9「旧版本身的两处毛病」）。
    - 旧版「回款 → 工序10」有前端硬编码 + 服务端 merge 特判，能写出脏数据。新版两处一起去掉。
    - 旧版「更新进度」下拉把空槽丢掉（旧版也是），本页沿用。

    ## ⚠️ 用之前得先有工序名

    「更新进度」的下拉只列**配过名字**的槽（旧版也是先丢掉空槽）。而工序名的唯一配置入口
    在**另一个模块** —— 旧版是 `/Qrscanner` 的「设置工序」弹窗。

    ✅ **2026-09-19 已补**：`views/Qrscanner.vue`（导航「📱 扫码生产」）。
    去那里把工序名配上，本页的下拉才有东西可选；没配就是**空的**。
    **颜色筛选的分组同理** —— 没配颜色就没有可选项（只剩内置的「未生产」+ 5 个关键词兜底色）。
  -->
  <div class="page">
    <!--
      工具条（旧版 `.search-row`，从左到右逐项对着 `docs/2026-09-19-progress-analysis.md` §2.2）：
        打印选项 · 批量更新(n) · 查询更多 · 生产分析 · 刷新 · 导出表格 · 搜索框 · 统计行

      ✅ **七颗按钮全部接上真目标了**（打印抽屉 / 批量更新弹窗 / 更多查询对话框 / 看板 / 刷新 /
         导出 / 搜索框）—— **本页已经没有任何「置灰 + 点了给提示」的占位按钮**，
         `.pending-slot` 那套机制连同 `notYet()` 一起删掉了（别再从别处抄回来）。

      ⚠️ 「批量更新」是**按条件渲染**（不是置灰）—— 依据 §2.2 表格第 2 行给的出现条件
         「`已选条数 > 1` 且 PC 模式」（`ea = te.ping_hui.length + te.diao_hui.length`）。
         本笔补上「日期」列的行勾选之后它就能真的出现了；**没勾选时仍然一颗都不渲染**
         （旧版此刻本来就没有这颗按钮，置灰反而会多出一颗）。
    -->
    <div class="search-row">
      <!--
        打印选项（旧版 `zl=true` 开抽屉）：抽屉内容 = `PrintDrawer` 的 `preset="progress"`
        —— 旧版那 **12 类**单据，不是 Home 那 24 个入口（两页抽屉本来就不同，见组件文件头）。
        ⚠️ 旧版这颗**没有**「没勾选就不给开」的守卫：抽屉照样打开，只是里面 12 颗全灰
           （每颗的 `disabled` 条件都是「已选条数 = 0」）⇒ 这里同样不守卫。
      -->
      <n-button type="primary" @click="openPrint">打印选项</n-button>

      <!--
        批量更新 (n)：旧版条件 `已选条数 > 1`（`ea.value > 1 && D.value`，`D` = PC 模式）。
        勾选 UI 见「日期」列（表头全选 + 行内勾选框）。
      -->
      <n-button v-if="selectedRows.length > 1" type="warning" @click="openBatchUpdate">
        批量更新 ({{ selectedRows.length }})
      </n-button>

      <!-- 「查询更多」旧版恒出现（§2.2 表格第 3 行）—— 开「查询订单」对话框（旧版 `Lo`）。 -->
      <n-button type="primary" @click="openMore">查询更多</n-button>

      <!-- 生产分析看板（旧版 `@141816`）。⚠️ 旧版这颗按钮的出现条件是
           `userinfo.registrant === userinfo.name || userinfo.name === '开门红'` ——
           新版没有 `registrant`/`defaulted` 那套账号字段（文件头已记），所以这里**常驻**。
           一行数据都没有时点它会「开一下就自己关」（旧版**有意**行为，见看板内部）。 -->
      <n-button type="primary" @click="dashboardShow = true">生产分析</n-button>

      <n-button type="success" :loading="loading" @click="refresh">刷新</n-button>

      <!-- 旧版：只有搜索词/更多查询条件非空（`zo`）时才出现 -->
      <n-button v-if="searchText" type="warning" :loading="exporting" @click="exportTable">导出表格</n-button>

      <!--
        ⚠️ `@input` / `@clear` 是**旧版的行为**，别当多余：
          · 旧版 `zo` 的 `onInput: ao` → `Bo = false`（一动手打字就退出「查询更多」的结果集）；
          · `onClear: lo` → `zo = ''` 且 `Bo = false`。
        两者都**不**清 `xo`（结果集留着，再点一次「查询更多」还能用）。
      -->
      <n-input
        v-model:value="searchText"
        class="search-input"
        clearable
        placeholder="输入关键词搜索（可用空格分隔多个关键词）"
        @input="onSearchInput"
        @clear="onSearchClear"
      >
        <template #prefix>
          <!-- 旧版前缀是 index chunk 里的图标组件（`h as u`），我们没那个件 ⇒ 用同形的放大镜 SVG -->
          <svg viewBox="0 0 1024 1024" width="14" height="14" aria-hidden="true">
            <path
              fill="currentColor"
              d="M909.6 854.5L649.9 594.8C690.2 542.7 712 479 712 412c0-80.2-31.3-155.4-87.9-212.1-56.6-56.7-132-87.9-212.1-87.9s-155.5 31.3-212.1 87.9C143.2 256.5 112 331.8 112 412c0 80.1 31.3 155.5 87.9 212.1C256.5 680.8 331.8 712 412 712c67 0 130.6-21.8 182.7-62l259.7 259.6a8.2 8.2 0 0 0 11.6 0l43.6-43.5a8.2 8.2 0 0 0 0-11.6zM570.4 570.4C528 612.7 471.8 636 412 636s-116-23.3-158.4-65.6C211.3 528 188 471.8 188 412s23.3-116.1 65.6-158.4C296 211.3 352.2 188 412 188s116.1 23.2 158.4 65.6S636 352.2 636 412s-23.3 116.1-65.6 158.4z"
            />
          </svg>
        </template>
      </n-input>

      <!--
        统计行（旧版两种形态，见 §2.2 / §5.4）。注意两段的**文案与分段位置**是逐字抄的：
          · 「当前筛选」形态：正文是 `" 当前筛选: {词} ({n} 条结果)"`（**开头带空格**），
            后面那个 `<span class="total-info">` 从 `" | 时间: …"` 开始；
          · 「总计」形态：` 总计: {n} 条记录 | 时间: … ` **整段都在** `total-info` 里。
        后者的外层条件不是「搜索词为空」，而是旧版的 `K.length > 0`（**一条数据都没有时整行不渲染**）。
        （旧版「当前筛选」那句在 `条结果)` 后还有一个尾空格，和 span 开头的空格连成两个 ——
          模板编译器会把节点末尾的空白吃掉，这里只剩一个；HTML 本来就会把连续空白并成一个，
          渲染结果没有差别，不去人为补 `&#32;`。）
      -->
      <div v-if="searchText" class="search-info">
        当前筛选: {{ searchText }} ({{ filteredRows.length }} 条结果)<span class="total-info">{{ statsTail }}</span>
      </div>
      <div v-else-if="rows.length > 0" class="search-info">
        <span class="total-info"> 总计: {{ filteredRows.length }} 条记录{{ statsTail }}</span>
      </div>
    </div>

    <n-data-table
      :columns="columns"
      :data="pageRows"
      :bordered="true"
      :row-key="(r: ProgressRowDto) => r.id"
      size="small"
      :max-height="tableHeight"
      :scroll-x="1500"
      @update:filters="onUpdateFilters"
    />

    <!-- 生产分析看板（旧版 `ProductionDashboard`）：全屏对话框，口径见
         `docs/2026-09-19-progress-dashboard.md`。
         `@custom-query` = 看板里选「自定义查询」→ 开下面那个「查询订单」对话框（旧版 §3.5 那条环）。 -->
    <ProgressDashboard
      ref="dashboardRef"
      v-model:show="dashboardShow"
      :table-data="dashboardRows"
      :procedures="procedures"
      @custom-query="openMore"
    />

    <!--
      「查询更多」（旧版 `ho` 那个 `el-dialog`，标题 `查询订单`、宽 500px、`label-width:100px`）。
      字段与文案逐字照旧版：客户（自动完成）/ 安装地址 / 起始日期 / 结束日期。
      ⚠️ 旧版那个「客户」项外面还有一层 `D2`（**终端模式就不显示它**）；本版不做终端分支
         （见文件头 ⏳6），所以它**恒显示** —— 与其余恒显示的 PC 专有项同一个口径。

      ⚠️ 两条**有意偏离**（都写在 `openMore` / `submitMore` 的注释里）：
        ① 旧版客户下拉在旧服务端上是**坏的**（返回 camelCase，前端读四个中文键全 undefined，
           `l.name.toLowerCase()` 直接抛）⇒ 新版走现成的 `GET /v1/clients`，不当它是参照；
        ② 旧版那颗「客户」框身上的 `.error-input`（红框）在这个页面里**从来没被置真过**
           （`Eo` 只有 `onInput` 里那一处写 `false`）⇒ 死代码，不复刻。
    -->
    <n-modal
      v-model:show="moreShow"
      preset="card"
      title="查询订单"
      style="width: 500px"
      :auto-focus="false"
    >
      <n-form label-placement="left" label-width="100">
        <n-form-item label="客户">
          <!--
            旧版是 `el-autocomplete`：`trigger-on-focus`（聚焦即出候选）+ `clearable` + 本地 `name.includes` 过滤。
            ⚠️ naive 的 `n-auto-complete` 清空时 `update:value` 抛的是 **null**（同 Home 那处），
               所以要显式收口成空串，别直接 `v-model:value` 绑 `string`。
          -->
          <n-auto-complete
            :value="moreForm.client"
            :options="moreClientOptions"
            :get-show="AUTOCOMPLETE_ALWAYS_SHOW"
            placeholder="输入客户信息"
            clearable
            @update:value="(v: string | null) => (moreForm.client = v ?? '')"
          />
        </n-form-item>
        <n-form-item label="安装地址">
          <n-input v-model:value="moreForm.address" placeholder="请输入安装地址" />
        </n-form-item>
        <n-form-item label="起始日期">
          <n-date-picker
            v-model:value="moreForm.startTs"
            type="date"
            :shortcuts="MORE_DATE_SHORTCUTS"
            placeholder="选择起始日期"
            clearable
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="结束日期">
          <n-date-picker
            v-model:value="moreForm.endTs"
            type="date"
            :shortcuts="MORE_DATE_SHORTCUTS"
            placeholder="选择结束日期"
            clearable
            style="width: 100%"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="upd-footer">
          <n-button @click="moreShow = false">取消</n-button>
          <n-button type="primary" :loading="moreLoading" @click="submitMore">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 更新进度（旧版行内那颗链接开的弹窗） -->
    <n-modal v-model:show="updOpen" preset="card" :title="updTitle" style="width: 420px" :bordered="false">
      <div class="upd-form">
        <div class="upd-row">
          <span class="upd-label">工序</span>
          <n-select v-model:value="updSlot" :options="slotOptions" style="flex: 1" />
        </div>
        <div class="upd-row">
          <span class="upd-label">操作员</span>
          <n-input v-model:value="updOperator" placeholder="可留空" style="flex: 1" />
        </div>
        <div class="upd-row">
          <span class="upd-label">日期</span>
          <n-input v-model:value="updDate" placeholder="YYYY-MM-DD" style="flex: 1" />
        </div>
        <div class="upd-preview">将写入：<code>{{ updValue || '（先选工序）' }}</code></div>
      </div>
      <template #footer>
        <div class="upd-footer">
          <n-button @click="updOpen = false">取消</n-button>
          <n-button type="primary" :disabled="!updSlot" :loading="updSaving" @click="submitUpdate">确定</n-button>
        </div>
      </template>
    </n-modal>

    <!--
      打印选项抽屉（旧版 `zl`，`el-drawer` `title:"打印选项"` `size:350`）。
      `preset="progress"` = 旧版这一页那 **12 类**单据（不是 Home 那 24 个入口）。
      数据：勾选的门行折算出的订单（只保留勾选的那些行，见 `printOrdersOf`）。
    -->
    <PrintDrawer
      v-model:show="printShow"
      preset="progress"
      :orders="printOrders"
      @open-mode="onOpenPrintMode"
    />

    <!--
      打印预览弹窗（旧版 `ml` 那个 `el-dialog`，宽 `1180px`，工具条 = 关闭/云打印/手动打印 + 按 ic 的编辑类）。
      与 Home / Hui 共用同一个组件（新版的「抽屉只列入口，预览与操作栏在弹窗里」就是照旧版拆的）。
      旧版 Progress 页自己也有一份预览弹窗，且**没有**加东西 —— 直接用共用件。
    -->
    <PrintPreviewDialog
      v-model:show="previewShow"
      :orders="printOrders"
      :mode="previewMode"
      :title="previewTitle"
    />

    <div class="table-footer">
      <n-pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :item-count="filteredRows.length"
        :page-sizes="[10, 20, 50, 100, 200]"
        show-size-picker
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import type { VNodeChild } from 'vue'
import type { Workbook as ExcelJSWorkbook } from 'exceljs'
import {
  NAutoComplete,
  NButton,
  NCheckbox,
  NDataTable,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPagination,
  NPopover,
  NSelect,
  useDialog,
  useMessage,
} from 'naive-ui'
import type { DataTableColumn, DataTableFilterState } from 'naive-ui'
import { api } from '../api/client'
import type { ClientDto, OrderDto, ProcedureSlotDto, ProgressRowDto } from '../api/types'
import { getOriginalOpenDirection, loadOpenDirectionSettings } from '../composables/useOpenDirection'
import { useProgressColors } from '../composables/progress/useProgressColors'
import {
  amountCell,
  doorSizeCell,
  fansDirectionCell,
  glassCell,
  lightWindowCell,
  line,
  profileColorCell,
  progressCell,
  remarkCell,
  trackCasingCell,
} from '../utils/progressCells'
import ProgressDashboard from '../components/ProgressDashboard.vue'
import PrintDrawer from '../components/PrintDrawer.vue'
import PrintPreviewDialog from '../components/PrintPreviewDialog.vue'

const message = useMessage()
// 行内「删除」的二次确认（旧版是 `ElMessageBox.confirm`，同 Hui/Home 的做法用 `dialog.warning`）。
const dialog = useDialog()

/**
 * 页面行 = 后端行 + 前端的**勾选态**。
 *
 * 旧版也是把 `isSelected` 直接挂在行对象上（`…map(e => ({...e, isSelected:!1, "生产进度": …}))`，
 * §3.1 末），勾选框就是 `modelValue: row.isSelected` —— 新版照同一套，不另开一张「已选 id」表。
 */
type ProgressRow = ProgressRowDto & { isSelected: boolean }

const rows = ref<ProgressRow[]>([])
const loading = ref(false)

// 分页：旧版 `page=1`、`pageSize=100`、可选 [10,20,50,100,200]（§2.4）。
const page = ref(1)
const pageSize = ref(100)

/** 旧版表格高度是 `calc(100vh - 240px)`；这里减去顶栏 + 工具条 + 分页。 */
const tableHeight = computed(() => Math.max(320, window.innerHeight - 240))

async function load() {
  loading.value = true
  try {
    const r = await api.listProgress()
    // 每行补 `isSelected:false`（旧版在 map 那一步做，见 §3.1 末）。
    // ⚠️ 这里**整份换掉 `rows`** ⇒ 勾选态自然被清掉，与旧版 `pa()` 的「重拉 + 清空勾选」等价
    //    （旧版还要额外逐个 `isSelected=false`，是因为它不重建数组）。
    rows.value = (r?.progressData ?? []).map((x) => ({ ...x, isSelected: false }))
    // 数据换了要回到第一页（否则可能停在越界的页码上）
    if ((page.value - 1) * pageSize.value >= filteredRows.value.length) page.value = 1
  } catch (e) {
    message.error(e instanceof Error ? e.message : '读取生产进度失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // ⚠️ 开向自定义命名（localStorage `openDirectionCustomNames`）**必须显式载入**：
  //    旧版是每次算统计时现读 localStorage（`t = l()`），我们这份是模块级 ref，
  //    目前只有 `views/Hui.vue` 在加载它 ⇒ 不在这里补一句，「平开门扇数/其它」会漏掉改名后的开向。
  loadOpenDirectionSettings()
  await Promise.all([load(), loadSlots()])
})

// ===== 生产分析看板（旧版 `ProductionDashboard`） =====
/*
 * 看板的数据集：**必须是过了「数据范围」的行，不是页面筛选后的行**。
 *
 *  🔴 **有意偏离旧版**（用户拍板，见看板文档 §16②）：旧版看板的 `tableData` 直连页面那个
 *     **原始全量** ref —— 连「只看自己打单」的数据范围都不吃，于是一个业务员账号能看到
 *     **全公司**的生产数据。新版不照抄：看板的数据范围**与页面一致**。
 *     ⚠️ 别以后有人「照旧版改回去」。
 *
 *  ⚠️ **但页面这一层现在还是空的**：旧版的「数据范围」是 `oo` 那一步
 *     （`b ? K : K.filter(打单人 === 自己)`），本页**尚未实现**（理由见 `filteredRows` 上方那段：
 *     它依赖 `userinfo.registrant/name` 那套账号字段；且后端 `progress/service.rs` 的
 *     `build_row` 目前把 `打单人` **恒置 null**，前端拿不到行的打单人）。
 *     ⇒ 「与页面一致」今天 = 与页面同源（`rows`）。
 *     这里**单独留一个 computed**（而不是直接传 `rows`）就是为了让「看板走数据范围」这件事
 *     在代码里有个落点：等 `oo` 落地时，**改这一处**，别去改看板组件里的 props 名。
 *     看板本身**不碰**页面的列头筛 / 搜索框 / 分页（它有自己的一套筛选条，见 §3）。
 */
const dashboardRows = computed(() => rows.value)
const dashboardShow = ref(false)

// ===== 更新进度 =====
// 旧版是行内那颗「更新进度」链接开的弹窗；值是三段拼的 `工序名[_操作员]_YYYY-MM-DD`。
// ⚠️ 服务端**不校验**这个格式（它只当字符串存），拼错了也是自己负责。
const updOpen = ref(false)
const updSaving = ref(false)
const updTarget = ref<ProgressRowDto | null>(null)
/** 批量模式（旧版 `O`）：勾选多行时开的是同一个弹窗，只换标题、改发一批 id。 */
const updBatch = ref(false)
const updSlot = ref<string | null>(null)
const updOperator = ref('')
const updDate = ref(today())

/** 工序下拉：本租户配过的槽。没配名的槽**不给选**（旧版也是先丢掉空槽）。 */
const procedures = ref<ProcedureSlotDto[]>([])
const slotOptions = computed(() =>
  procedures.value.filter((p) => p.name.trim()).map((p) => ({ label: p.name, value: p.slot })),
)

function today() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

async function loadSlots() {
  try {
    const r = await api.listProcedures()
    procedures.value = r?.slots ?? []
  } catch {
    // 读不到就让下拉空着 —— 不拦页面
  }
}

/** 拼值：`工序名_操作员_日期`，操作员留空就省略那一段（旧版也是可省）。 */
const updValue = computed(() => {
  const name = procedures.value.find((p) => p.slot === updSlot.value)?.name || ''
  if (!name) return ''
  const parts = [name]
  if (updOperator.value.trim()) parts.push(updOperator.value.trim())
  parts.push(updDate.value.trim() || today())
  return parts.join('_')
})

/**
 * 打开「更新进度」弹窗。`r = null` ⇒ **批量模式**（旧版 `O=true`，标题换成
 * `批量更新进度 (n条)`、footer 不出现「收款/删除」那两颗）。
 *
 * ⚠️ 单行模式旧版有一道 `if (!row.单号) return ElMessage.warning("未开始生产的单无法更新进度")`
 *    —— 那颗链接本来就是 `v-if="单号"`，够不着，新版同样不加。
 */
function openUpdateDialog(r: ProgressRowDto | null) {
  updBatch.value = r === null
  updTarget.value = r
  updSlot.value = null
  updOperator.value = ''
  updDate.value = today()
  updOpen.value = true
}

function openUpdate(r: ProgressRowDto) {
  openUpdateDialog(r)
}

/** 弹窗标题：旧版 `O.value ? "批量更新进度 (" + ea + "条)" : "更新进度"`。 */
const updTitle = computed(() =>
  updBatch.value ? `批量更新进度 (${selectedRows.value.length}条)` : '更新进度',
)

async function submitUpdate() {
  const batch = updBatch.value
  const r = updTarget.value
  if (!batch && !r) return
  if (!updSlot.value || !updValue.value) return
  const ids = batch ? selectedRows.value.map((x) => x.id) : [r!.id]
  if (!ids.length) return
  updSaving.value = true
  try {
    // 旧版批量时发的是**行 id**（槽 = 工序10）或**行级单号**（其余槽）——那是它服务端的分流口径。
    // 新版 `/v1/progress/update` **两种都收**（`line_ids` / `line_nos`，二选一取并集；
    // 见 `api.updateProgress` 的注释，以及分析文档 §10 去掉的「回款→工序10」特判）。
    // 这一页手里本来就是行 id ⇒ 继续发 id，与旧版那条批量路一致。
    await api.updateProgress({ slot: updSlot.value, value: updValue.value, lineIds: ids })
    updOpen.value = false
    // 成功提示照旧版分两种：批量「批量更新成功，共 N 条」/ 单行「进度已更新」。
    message.success(batch ? `批量更新成功，共 ${ids.length} 条` : '进度已更新')
    await load()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '更新失败')
  } finally {
    updSaving.value = false
  }
}

// ===== 行内「删除」（§4.3）=====
/*
 * 旧版原文（`Progress-fb4def35.js` 反混淆后，日期列的第二个 `<span class="update-progress-link">`）：
 *
 *   onClick: async row => {
 *     await E("删除") && ElMessageBox.confirm("确定要删除这一行吗？", "提示", {
 *       confirmButtonText: "确定", cancelButtonText: "取消", type: "warning",
 *     }).then(async () => {
 *       const u = await o(); if (!u) return void ElMessage.error("无法获取用户数据")
 *       const ds = u.userinfo.ds
 *       if (row.id) {
 *         const r = await fetch("…?param1=deleteRow&param2=" + ds, {
 *           method: "POST", headers: { "Content-Type": "application/json" },
 *           body: JSON.stringify({ id: row.id, 数量: row.数量, 金额: row.金额, 安装地址: row.安装地址 }),
 *         }), j = await r.json()
 *         if (200 !== j.code) return void ElMessage.error(j.message || "删除失败")
 *       }
 *       row.图片ID && await s(row.图片ID, String(row.id))     // 顺带删门图
 *       const i = K2.value.findIndex(x => x.id === row.id)
 *       -1 !== i && K2.value.splice(i, 1)                     // ← 局部删，不重拉整表
 *       ElMessage.success("删除成功"), await ae()
 *     }).catch(() => ElMessage.info("已取消删除"))
 *   }
 *
 * ⚠️⚠️ **这一格删的不是「进度」，是整条门行**。分析文档 §4.3 把这个链接收在「删除进度」标题下、
 *    且把 `.then(...)` 省略成 `...`，只看那一节会以为它调的是 `deleteProgress` —— **不是**。
 *    它调的是 `deleteRow`（服务端 `legacy-dispatch.ts:132` 的 `deleterow` 分支：
 *    POST + 有 body ⇒ `orderServ.deleteDetailRow(ds, body.id)`，把该 `id` 的明细行从
 *    `doorSpecs` 里摘掉，并重算整单 `totalAmount` / `unpaidAmount` / `doorCount` +
 *    `financeOrder` 的 `statusText`）。**已回源码逐字核对**，别再按标题理解。
 *
 * 调什么：**新版已有等价端点**，且不是新造的 —— `DELETE /api/v1/orders/{orderId}/lines/{lineId}`
 *   （`backend/src/modules/orders/mod.rs`，`service::delete_line`：删 `order_lines` 行 +
 *   `recompute_header` 重算总价/门数/单号集）。语义与旧版 `deleteDetailRow` 对齐。
 *   ⚠️ 它挂在 **orders 模块**下，`modules/progress/` 里没有删除 handler ——
 *   「行」本来就属于订单，不是进度模块的东西。
 *   前端封装 `api.deleteOrderLine(orderId, lineId)`（`Home.vue` / `Hui.vue` 的行删除同一条）。
 *
 * 为什么用 `row.order.id` 而不是别的：进度行的 `id` 是**行** id（= `order_lines.id`），
 *   订单 id 后端挂在 `row.order.id` 上（见 `progress/service.rs` 的 `build_row`，以及
 *   `ProgressRowDto.order` 的类型注释）。
 *
 * ⚠️ **旧版那一步密码校验（`await E("删除")`）新版【刻意不做】**，理由与 `Home.vue:1605-1659`
 *    那段结论**完全相同**（那里逐条查证过 `usePasswordVerify` 的实现），别在这里另起炉灶：
 *    ① 它不是本地口令，是**拿 `<registrant>` + 明文口令去旧版生产域名换授权**
 *       （`GET https://www.samrtdoor.com.cn/1?param1=login&param2=…&param3=…`）；
 *    ② 只对**写死的 3 个租户**生效，其余租户旧版直接放行；
 *    ③ 新版后端没有对应端点，从新版发这条请求是**跨系统的对外写**。
 *    ⇒ 按本仓库既有口径**不发**，也**不补一个「看起来在验、其实验不了」的假闸门**。
 *    `Home.vue` 那处的三条候选路径（加了就一起改）记在那段 TODO 里，未拍板前保持一致。
 */
function confirmDeleteRow(r: ProgressRowDto) {
  dialog.warning({
    title: '提示',
    // 逐字照抄旧版 `ElMessageBox.confirm` 的正文与按钮文案（`type:"warning"` ⇒ 这里的 warning 弹窗）。
    content: '确定要删除这一行吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.deleteOrderLine(r.order.id, r.id)
      } catch (e) {
        // 旧版：服务端回非 200 时显示它自己的 message（兜底「删除失败」），
        //       抛异常/断网才走「删除失败，请重试」。新版 `request()` 两种都抛
        //       （HTTP 错带服务端 message、断网带 fetch 的 reason）⇒ 合并成一句。
        message.error(e instanceof Error ? e.message : '删除失败，请重试')
        // ⚠️ 失败时**必须 `return false`** 拦住弹窗关闭：naive 的 `onPositiveClick` 返回
        //    `false` 才不关；返回 undefined 会照关不误 —— 那样用户会以为删成功了。
        return false
      }
      // ⚠️ **局部删，不调 `refresh()`**：旧版删成功后只是把行从 `K2` 里 `splice` 掉
      //    （那份代码里**没有**重拉整表）。照抄这个表现，顺带也不会把当前页码/滚动位置抖掉。
      // 用 `splice` 而不是 `rows.value = rows.value.filter(...)`：后者会把 ref 换成**新数组**，
      // 与其它持有 `rows` 的地方脱钩（同 `Home.vue` `batchDeleteInExpand` 的注释）。
      const i = rows.value.findIndex((x) => x.id === r.id)
      if (i !== -1) rows.value.splice(i, 1)
      message.success('删除成功')
      // 旧版这里还调了一句 `ae()`，它只重算「已选 id 列表」`le`（`ae` 的定义里就只写 `le.value`），
      // **不重拉数据**；而本页还没有行勾选 UI（`selectedRows` 恒空，见它的注释）⇒ 无对应物，
      // 不为了对齐而伪造一次调用。
    },
    // 旧版 `.catch` 的那句「已取消删除」：Element Plus 在点「取消」/点遮罩/按 Esc 时都走 catch。
    // naive 的 `onNegativeClick` 只覆盖「取消」按钮 —— 遮罩/Esc 关掉时旧版会提示、这里不会。
    // （同 `Hui.vue` 的「已取消删除」，保持全站一致；不为此加 `onClose`：那会在**确认后**
    //   也触发一次，等于删成功还弹一句「已取消删除」。）
    onNegativeClick: () => message.info('已取消删除'),
  })
}

/*
 * 颜色口径（旧版 §5.3 的 `J` / `R` / `re` / `$`）—— 2026-09-20 起整段搬进
 * `composables/progress/useProgressColors.ts`（Progress 拆分 **P2**，纯搬迁、逐字未改）。
 * 这里只接回**段外真的用到**的那几个：
 *   · `colorKeyOf` —— `confirmOrderNoQuery`（查单号）与 `filteredRows`（颜色筛）
 *   · `UNPRODUCED_KEY` —— `filteredRows`
 *   · `colorFilterOptions` —— `progressHeader` 的「颜色筛选」下拉
 *   · `cellPad` / `progressCellStyle` —— `columns` 的 `cellProps`
 * ⚠️ 其余 9 个**不要**解构回来：段外零引用，解构了就是死局部（`noUnusedLocals` 会红）。
 * ⚠️ `orderedProcedureNames` 也在「不要解构」那一列 —— 方案点名的「模板 66 行」实际是
 *    模板顶部那段注释里的一个词，**没有任何真实调用**（本笔用真 TS 解析器数的引用点）。
 */
const { colorKeyOf, UNPRODUCED_KEY, colorFilterOptions, cellPad, progressCellStyle } =
  useProgressColors({ procedures })

// ═══════════════════════════════════════════════════════════════════════════
// B. 列头交互
// ═══════════════════════════════════════════════════════════════════════════

// ── B1. 「单号」列：表头筛（有单号 / 空单号）+「查单号」popover ─────────────
/*
 * 旧版 `filter-method: ga` + `filters:[{text:"有单号",…},{text:"空单号",…}]`：
 *
 *   ga = (value, row) =>
 *     value === '有单号' ? (row.单号 && row.单号.toString().trim() !== '')
 *                       : (value !== '空单号' || (!row.单号 || row.单号.toString().trim() === ''))
 *
 * ⚠️ 第二个分支的写法（`value !== '空单号' || …`）等价于「**不是空单号这个选项** 就放行」，
 *    也就是「选了未知选项不筛」。照抄，别化简。
 */
function matchesOrderNoOption(value: string | number, r: ProgressRowDto): boolean {
  if (value === '有单号') return !!r['单号'] && String(r['单号']).trim() !== ''
  return value !== '空单号' || !r['单号'] || String(r['单号']).trim() === ''
}

// 受控写法，与 `views/Home.vue:852-865` 同一套路：naive 2.45 的 n-data-table **没有表级
// `filters` prop**，受控只能落在列的 `filterOptionValues` 上；每次变更回抛**整个**筛选状态。
const columnFilterState = ref<DataTableFilterState>({})
function onUpdateFilters(state: DataTableFilterState) {
  columnFilterState.value = { ...state }
  page.value = 1
}
function orderNoFilterValues(): (string | number)[] {
  const v = columnFilterState.value['单号']
  if (v == null) return []
  return Array.isArray(v) ? [...v] : [v]
}

// 「查单号」（旧版 `ca` = 输入框、`Va` = 已生效的关键字、`wa` = popover 开关、`da` = 「恢复中」闪一下）
const orderNoInput = ref('')
const orderNoQuery = ref('')
const orderNoPopShow = ref(false)
const orderNoRestoring = ref(false)

/**
 * 「确认」/ 输入框回车（旧版 `ya`）。
 *
 * ① **补年份后缀**：输入里若没有 `-两位数字`（`/-\d{2}\b/`）就补 `-` + 当前年份后两位。
 *    ⚠️ 与 `views/Home.vue:2262` 同一套规则（Home 的「查单号」是另一个函数，但正则/后缀一致）。
 * ② 候选集 = 已过「单号列筛 `ia`」「颜色筛 `Z`」的行（旧版 `ya` 里 `a` 就是这么构造的）
 *    —— **不含**搜索框那一步。⚠️ 这是**旧版原样**（`ya` 里那两句只筛 `ia`/`Z`），
 *    不是「搜索框还没做」：搜索框已经做了（见 `filteredRows`），但这里**照旧版**不带上它 ——
 *    带上会让「查单号」的命中判定依赖当前搜索词，行为就和旧版不一样了。
 * ③ 没命中 → `warning("查不到「{关键字}」单号！")`，且**清空** `Va`（不留下一个筛不出东西的关键字）。
 * ④ 命中 → 写 `Va`、回第 1 页、关 popover。
 */
function confirmOrderNoQuery() {
  const raw = orderNoInput.value.trim()
  const q = raw ? (/-\d{2}\b/.test(raw) ? raw : `${raw}-${String(new Date().getFullYear()).slice(-2)}`) : ''
  orderNoInput.value = q
  if (!q) {
    orderNoQuery.value = ''
    page.value = 1
    orderNoPopShow.value = false
    return
  }
  // ⚠️ 候选集同样走 `Bo ? xo : oo`（旧版 `ya` 的第一句就是 `let a = (Bo.value ? xo.value : oo.value) || []`）
  //    —— 查出来的结果集生效时，「查单号」只在这个结果集里找，不去全量里捞。
  let pool = moreActive.value ? moreRows.value : rows.value
  const sel = orderNoFilterValues()
  if (sel.length) pool = pool.filter((r) => sel.some((v) => matchesOrderNoOption(v, r)))
  if (colorFilter.value) pool = pool.filter((r) => colorKeyOf(r['生产进度']) === colorFilter.value)
  const key = q.toLowerCase()
  const hit = pool.some((r) => String(r['单号'] ?? '').toLowerCase().startsWith(key))
  if (!hit) message.warning(`查不到「${q}」单号！`)
  orderNoQuery.value = hit ? q : ''
  page.value = 1
  orderNoPopShow.value = false
}

/**
 * 「清除」（旧版 `ma`）：先置 `da=true`（按钮变红字「恢复中...」），**50ms 后**才真清，
 * 干完才 `da=false`。那个 `setTimeout(..., 50)` 是旧版原样（`:7741-7743` 同款），不是我们加的。
 */
function clearOrderNoQuery() {
  orderNoRestoring.value = true
  setTimeout(() => {
    orderNoInput.value = ''
    orderNoQuery.value = ''
    page.value = 1
    orderNoPopShow.value = false
    orderNoRestoring.value = false
  }, 50)
}

/** 「单号」列表头（旧版 `Ne` + `Be` + 内联样式，逐字照搬）。 */
const orderNoHeader = (): VNodeChild =>
  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', textAlign: 'center' } },
    [
      h('span', null, '单号'),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        orderNoQuery.value
          ? h(
              NButton,
              { text: true, size: 'small', onClick: clearOrderNoQuery },
              {
                default: () =>
                  // 旧版这里是 `<span style="color:red">恢复中...</span>`（`Me`）
                  orderNoRestoring.value
                    ? h('span', { style: { color: 'red' } }, '恢复中...')
                    : h('span', null, '清除'),
              },
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
                  // 旧版这两层是内联样式（`ze`/`xe`），不是类 —— 这里也写内联
                  h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
                    h(NInput, {
                      value: orderNoInput.value,
                      'onUpdate:value': (v: string) => (orderNoInput.value = v),
                      size: 'small',
                      placeholder: '可只输入单号“-”前数字即可，如199.',
                      clearable: true,
                      // 旧版 `onKeyup:withKeys(ya,["enter"])` —— naive 的 NInput 不接 `onKeyup`，
                      // 走 `inputProps` 透传到原生 input（同 `views/Home.vue:3008-3014`）。
                      inputProps: {
                        onKeyup: (e: KeyboardEvent) => {
                          if (e.key === 'Enter') confirmOrderNoQuery()
                        },
                      },
                    }),
                    h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, [
                      h(NButton, { size: 'small', onClick: clearOrderNoQuery }, { default: () => '清除' }),
                      h(
                        NButton,
                        { type: 'primary', size: 'small', onClick: confirmOrderNoQuery },
                        { default: () => '确认' },
                      ),
                    ]),
                  ]),
              },
            ),
      ]),
    ],
  )

// ── B2. 「生产进度」列：颜色筛选 popover ───────────────────────────────────
/*
 * 旧版 `Z`（选中的颜色键）—— **不是** el-table 的列筛，而是一个自绘 popover（带色块）。
 * 所以这里**不用** naive 的 `filterOptions`（它是纯文字复选框，画不了色块），
 * 用「自己的 ref + 自己的 title popover」实现，过滤放在 `filteredRows` 里做。
 * ⚠️ 与「单号」列不同：那一列旧版用的是 el-table 原生 `filters` ⇒ 走 naive 的 `filterOptions`。
 */
const colorFilter = ref('')

const progressHeader = (): VNodeChild =>
  h('div', { class: 'progress-header-tools' }, [
    h('span', null, '生产进度'),
    h(
      NPopover,
      { placement: 'bottom', trigger: 'click', width: 320 },
      {
        trigger: () =>
          h(NButton, { text: true, size: 'small', class: 'progress-color-filter-btn' }, { default: () => '颜色筛选' }),
        default: () =>
          h('div', { class: 'progress-color-filter-panel' }, [
            h('div', { class: 'progress-color-filter-actions' }, [
              h(
                NButton,
                {
                  size: 'small',
                  onClick: () => {
                    colorFilter.value = ''
                    page.value = 1
                  },
                },
                { default: () => '清除筛选' },
              ),
            ]),
            ...colorFilterOptions.value.map((o) =>
              h(
                'div',
                {
                  key: o.colorKey,
                  class: ['progress-color-filter-item', { active: colorFilter.value === o.colorKey }],
                  onClick: () => {
                    colorFilter.value = o.colorKey
                    page.value = 1
                  },
                },
                [
                  h('span', { class: 'progress-color-swatch', style: { backgroundColor: o.color } }),
                  h('span', { class: 'progress-color-label' }, o.label),
                ],
              ),
            ),
          ]),
      },
    ),
  ])

/**
 * 搜索框命中的十个字段 —— **顺序与旧版逐字一致**
 * （旧版：`客户 日期 型材 安装地址 备注 单号 业务员 打单人 生产进度 回执单号`）。
 * ⚠️ 这里的键名按 `ProgressRowDto` 的真实字段写：后端 DTO 是英文列名（见 `api/types.ts`
 *    的 `OrderLineDto`），所以「型材」在这个 DTO 里叫 **`profile`** —— 其余九个恰好是中文键。
 *    别照抄旧版的中文 `型材`（那个键在 `ProgressRowDto` 上不存在，会静默筛不到东西）。
 */
const SEARCH_FIELDS = [
  '客户',
  '日期',
  'profile',
  '安装地址',
  '备注',
  '单号',
  '业务员',
  '打单人',
  '生产进度',
  '回执单号',
] as const satisfies readonly (keyof ProgressRowDto)[]

// ── B3. 筛选链 + 分页 ─────────────────────────────────────────────────────
/*
 * 旧版 §4.1 的链路：`K2`（原始）→ `oo` → `no`（最终）→ `io`（当页切片）。
 * 本页目前做了链里的四步（剩下没做的只有 `oo` 那一步，理由见下）：
 *
 *   `oo`（只看自己打单的行）—— 旧版 `b2 ? K2 : K2.filter(打单人 === 自己)`。
 *     ⚠️ 新版**还没做**：它依赖 `userinfo.registrant/name` 这套账号字段，
 *        旧版 §10 明确「`defaulted` 我们不复制，账号类型映射等做权限那一步再定」。
 *        这里先跳过，等权限那一步补 —— **不要**用「当前登录名」凑一个近似值。
 *   `ia` 单号列筛 → `Z2` 颜色筛 → `Va` 查单号前缀 → `zo` 搜索框（**顺序照旧版**）
 *
 * ⚠️ 与 Home 同款的**有意偏离**：旧版的列头筛发生在分页切片**之后**（只筛当前页、总数不含它），
 *    新版把这几步都并进 `filteredRows` ⇒ **全量筛选、总数跟随**。
 *
 * ⚠️ 旧版 `no` 的第一句是 `let t = Bo.value ? xo.value : oo.value` —— `Bo`/`xo` 是
 *    **「查询更多」的结果集与其生效标志**（点确认后 `xo=d, Bo=true`；**动搜索框或清空**就把
 *    `Bo` 置回 `false`，退回全量）。新版这一层 = `moreActive ? moreRows : rows`，
 *    退出条件照旧版放在搜索框的 `@input` / `@clear` 上（见 `onSearchInput` / `onSearchClear`）。
 *
 * ⚠️ 与 `oo`（只看自己打单的行）**不是一回事**，别合并：`oo` 是**数据范围**（本版仍未做，
 *    理由见上），`Bo`/`xo` 是**用户主动查出来的结果集**。旧版是 `no = (Bo ? xo : oo)`，
 *    即结果集**优先于**数据范围 —— 但结果集本身在 `Io` 里已经被数据范围滤过一遍
 *    （`!b2 && (d = d.filter(打单人 === 自己))`），两处都做才对。
 */
const filteredRows = computed(() => {
  let list = moreActive.value ? moreRows.value : rows.value
  const sel = orderNoFilterValues()
  if (sel.length) list = list.filter((r) => sel.some((v) => matchesOrderNoOption(v, r)))
  if (colorFilter.value) {
    list =
      colorFilter.value === UNPRODUCED_KEY
        ? list.filter((r) => !String(r['单号'] ?? '').trim())
        : list.filter((r) => colorKeyOf(r['生产进度']) === colorFilter.value)
  }
  if (orderNoQuery.value) {
    const q = orderNoQuery.value.toLowerCase()
    list = list.filter((r) => String(r['单号'] ?? '').toLowerCase().startsWith(q))
  }
  // 搜索框：空格分词，**每个词都要命中**十个字段里的任意一个（全部 `toLowerCase()` 后 `includes`）。
  // 逐字对着旧版 `no` 的最后一段抄：字段顺序、`String(x ?? '')` 的空值处理都一样。
  // ⚠️ 旧版用 `?.toString().toLowerCase().includes(w)`，null/undefined 会短路成 falsy；
  //    这里等价写成 `String(x ?? '')`（`null` → `''`，`''.includes(w)` 只有 `w` 为空才真，
  //    而 `w` 已经 `filter(Boolean)` 过了 ⇒ 同样恒 false）。
  const words = searchText.value.toLowerCase().split(/\s+/).filter((w) => w)
  if (words.length) {
    list = list.filter((r) =>
      words.every((w) =>
        SEARCH_FIELDS.some((k) => String(r[k] ?? '').toLowerCase().includes(w)),
      ),
    )
  }
  return list
})

const pageRows = computed(() =>
  filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)

/**
 * 「日期」列表头（旧版 `pe` 那个 div）：**全选 checkbox + 「日期」**竖排。
 *
 * ⚠️ 旧版这个 checkbox 的 `title` 就是下面这句 —— 它同时也是**唯一的范围说明**
 *    （全选盖的是「当前筛选结果」而不是当前页，见 `toggleSelectAll` 的注释）。
 *    naive 的 `n-checkbox` 没有 `title` prop，用原生 `title` 属性（浏览器悬停提示）。
 */
const dateHeader = (): VNodeChild =>
  h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' } }, [
    h('span', { title: '全选/取消全选（当前筛选结果）' }, [
      h(NCheckbox, {
        checked: allSelected.value,
        'onUpdate:checked': (v: boolean) => toggleSelectAll(v),
      }),
    ]),
    h('span', null, '日期'),
  ])

// ── B4. 列定义 ────────────────────────────────────────────────────────────
const columns = computed<DataTableColumn<ProgressRow>[]>(() => [
  // 1 日期（表头带全选 checkbox，行内带勾选框 —— 见 §2.3 第 1 行；两者都是素 `D2`=PC 才有，
  //   本版不做终端分支 ⇒ 恒显示）
  {
    title: dateHeader,
    key: '日期',
    width: 150,
    fixed: 'left',
    cellProps: cellPad,
    render: (r) =>
      h('div', { class: 'cell-col' }, [
        // 行勾选框（旧版 `m` = ElCheckbox，`modelValue: row.isSelected` + `onChange: Jl(row, t)`）。
        // ⚠️ 直接改行对象上的标志（`rows` 是深响应式），`selectedRows` 是它的派生 computed。
        h(NCheckbox, {
          checked: r.isSelected,
          'onUpdate:checked': (v: boolean) => {
            r.isSelected = v
          },
        }),
        line(r['日期']),
        // 两个链接都是 `v-if="D2"`（PC 模式）—— 本版不做终端模式，故恒显示。
        // 旧版这一格是 `{display:flex;flex-direction:column;align-items:center;gap:4px}` 的**竖排**
        // （`he`，见 §2.3 第 1 行「右侧两个链接」）⇒ 「更新进度」「删除」是**上下两行**，不是并排。
        h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: () => openUpdate(r) }, { default: () => '更新进度' }),
        // 「删除」旧版是**红字**（`<span class="update-progress-link" style="color:#f56c6c">`）。
        // ⚠️ 这里用 naive 的 `type="error"` 表达「危险」，**不是**旧版那个 `#f56c6c` ——
        //    与紧邻的「更新进度」（旧版 `#409eff`，这里用 `type="primary"`）是同一套取舍：
        //    这一列的两颗都按 naive 语义色走。要改成旧版原色，**两颗一起改**，
        //    别只把「删除」单独拧回 `#f56c6c`（那会让这一格看起来像两种风格拼的）。
        h(NButton, { size: 'tiny', text: true, type: 'error', onClick: () => confirmDeleteRow(r) }, { default: () => '删除' }),
      ]),
  },
  { title: '客户', key: '客户', width: 110, cellProps: cellPad, render: (r) => line(r['客户']) },
  // 3 单号：表头筛（有单号/空单号）+「查单号」popover
  {
    title: orderNoHeader,
    key: '单号',
    width: 110,
    cellProps: cellPad,
    filterOptions: [
      { label: '有单号', value: '有单号' },
      { label: '空单号', value: '空单号' },
    ],
    filter: (v, r) => matchesOrderNoOption(v as string | number, r),
    // 受控：`computed` 里读 `columnFilterState`，变更时整列重算
    filterOptionValues: orderNoFilterValues(),
    render: (r) => line(r['单号']),
  },
  // 4 生产进度：`va()` 渲染 + 含「回款」标红 + 整格底色（`cellProps`）+ 表头颜色筛选
  {
    title: progressHeader,
    key: '生产进度',
    width: 220,
    cellProps: (r: ProgressRowDto) => ({
      style: { padding: '1px', ...progressCellStyle(r['生产进度']) },
    }),
    render: progressCell,
  },
  { title: '型材/颜色', key: 'profile_color', width: 130, cellProps: cellPad, render: profileColorCell },
  { title: '玻璃', key: 'glass', width: 120, cellProps: cellPad, render: glassCell },
  { title: '扇数/开向', key: 'fans_dir', width: 110, cellProps: cellPad, render: fansDirectionCell },
  { title: '下轨道/套线', key: 'track_casing', width: 120, cellProps: cellPad, render: trackCasingCell },
  { title: '门洞尺寸', key: 'door_size', width: 130, cellProps: cellPad, render: doorSizeCell },
  { title: '亮窗信息', key: 'lightwin', width: 120, cellProps: cellPad, render: lightWindowCell },
  // 11 备注（PC 模式下在这一位；终端模式会前移到第 5 位 —— 本版不做终端）
  { title: '备注', key: 'remark', width: 140, cellProps: cellPad, render: remarkCell },
  { title: '金额', key: 'amount', width: 130, cellProps: cellPad, render: amountCell },
  { title: '打单人', key: '打单人', width: 90, cellProps: cellPad, render: (r) => line(r['打单人']) },
  { title: '业务员', key: '业务员', width: 90, cellProps: cellPad, render: (r) => line(r['业务员']) },
])

// ═══════════════════════════════════════════════════════════════════════════
// C. 工具条 + 统计行（旧版 §2.2 / §5.4）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `await import('exceljs')` 的结果形状。
 * exceljs 的 `browser` 字段指向 UMD 包，**没有 ESM 默认导出**，Rollup 的 CJS interop
 * 有可能只给到 `default` ⇒ 运行期两个位置都取一下（见 `exportTable`）。
 */
type ExcelJSInterop = {
  Workbook?: typeof ExcelJSWorkbook
  default?: { Workbook: typeof ExcelJSWorkbook }
}

/** 导出中（按钮 loading，防止连点两次生成两个文件）。旧版没有这个 flag，是本页加的。 */
const exporting = ref(false)

/**
 * 搜索词（旧版 `zo`）。
 * ⚠️ 它**同时**是「导出表格」按钮的显隐开关 —— 旧版那颗按钮的条件就是 `zo` 非空
 * （见 §2.2 与 §4.6），不是「有没有数据」也不是「有没有筛选」。
 */
const searchText = ref('')

/**
 * 行勾选（旧版 `te = {ping_hui:[], diao_hui:[], customerInfo:{}, hui_picture:[]}`）——
 * 「批量更新」的显隐与计数只用到前两个数组的长度和（`ea`），而每一行**必然**只落进其中一个
 * （旧版 `Jl` 按 `吊脚` 是否为空二分），所以 `ea` ≡ 勾选行数。
 *
 * ⚠️ 新版**不留那两个数组**：它们存在的唯一理由是旧版打印要拿它们去拼标签/生产单的行
 *    （`Ca` / `So` 那些 `push({qty…})`）。新版打印走的是「订单 + 行」那套共用链路
 *    （见 `printOrdersOf`）⇒ 留一份只有长度有用的副本反而容易和 `rows` 上的标志不同步。
 *    于是**唯一事实来源是行上的 `isSelected`**，这里只做一次派生。
 */
const selectedRows = computed(() => rows.value.filter((r) => r.isSelected))

/**
 * 旧版 `pa()`：重拉数据 + **清空勾选**（`Ta()` + 逐个 `isSelected=false` + 重置 `te`）。
 * 新版不用手动清 —— `load()` 会把 `rows` 整份换成新对象（见那里的注释）。
 */
async function refresh() {
  await load()
}

// ── C1b. 查询更多（旧版 `Lo` 开窗 + `Io` 确认）—— 也就是 `no` 链路里的 `Bo`/`xo` 那一层 ──
/*
 * 旧版原文（反混淆后，逐字）：
 *
 *   ko = 30 天前、Mo = 今天（两个 ISO 日期串）；Ao = 最近一周 / 最近一个月 / 最近三个月 三个快捷项
 *   Lo = async () => { Co=""; Do.selectedClient=""; Do.selectedAddress=""; Do.startDate=ko; Do.endDate=Mo;
 *                      ho=true; 拉 getClientsInfo → No = data.map(e => ({name:e.客户, tel:e.电话, address:e.地址, id:e.编号}))
 *                      拿不到 → ElMessage.error("初始化客户信息失败") }
 *   Io = async () => { …Do.selectedClient = Co…          // ← 提交时取**输入框文本**，不是下拉里选中的那条
 *                      GET getMoreProgress&param3=客户&param4=地址&param5=起始&param6=结束
 *                      非 200 → error(msg || "查询数据失败")
 *                      d = progressData.map(e => ({...e, isSelected:!1, "生产进度": e["生产进度"]||""}))
 *                                       .sort((a,b) => parseInt(b["回执单号"]) - parseInt(a["回执单号"]))  // 倒序
 *                      xo.value = d; Bo.value = true
 *                      并入 K：已有 id 的**换成新的那条**（位置不变）、新 id **追加到末尾**
 *                      zo.value = (客户 + " " + 地址).trim()   // ← 搜索框被赋值，「当前筛选」那句就是它
 *                      ho.value = false; ElMessage.success("查询成功") }
 *
 * ⚠️ 两处**有意偏离**（其余逐字照抄）：
 *
 * ① **默认日期按本地时区算**。旧版那两个默认值是 `new Date().toISOString().split("T")[0]`（**UTC**）
 *    ⇒ UTC+8 每天 00:00–08:00 打开弹窗，默认区间整体早一天。本仓库对 `toISOString()` 的同类问题
 *    已有定论（见 `Home.vue` 的 `localToday()` 那段「必须用本地日期，不能用 `legacyToday()`」），
 *    这里沿用同一口径：默认起始 = **本地**今天 − 30 天、默认结束 = **本地**今天。
 * ② **客户候选走 `GET /v1/clients`**（不照抄旧版那个口）。旧版 `getClientsInfo` 在旧服务端上返回的是
 *    prisma 行（**camelCase**），而旧前端读的是 `e["客户"]/["电话"]/["地址"]/["编号"]` —— 四个键全是
 *    `undefined`，紧接着 `bo` 里的 `l.name.toLowerCase()` 会**直接抛**。⇒ **那个口本来就是坏的，
 *    别拿它当参照**（分析文档 §8.3 与服务端文档各自独立证过同一件事）。
 *    字段映射按新版：`{ name, tel: phone, address, id: code }`。
 * ③ 旧版那颗客户框身上的 `.error-input`（红框）在这个页面里**从没被置真过**（`Eo` 只在 `onInput` 里被
 *    写成 `false`）⇒ 死代码，不复刻。
 */
const moreShow = ref(false)
/** 「查询中…」（旧版是 `ElLoading.service`，新版用按钮 loading）。 */
const moreLoading = ref(false)
/** 客户候选（旧版 `No`）。⚠️ 只是给下拉用，取不到也不拦查询。 */
const moreClients = ref<ClientDto[]>([])
/** 结果集（旧版 `xo`）。 */
const moreRows = ref<ProgressRow[]>([])
/**
 * 结果集生效标志（旧版 `Bo`）：为真时筛选链的底表从全量换成 `moreRows`，退出的条件只有两个 ——
 * **动搜索框**或**点搜索框的清除**（旧版 `ao` / `lo`）。
 *
 * ⚠️ **「刷新」不会退出结果集**：旧版 `pa()` 只重拉 `K`，`Bo`/`xo` 原样留着 ⇒ 刷新之后表里显示的
 *    仍是上一次查出来的那批行（且是旧对象）。看着像 bug，但那是旧版的行为，**照抄**
 *    （要退出结果集就按旧版那两条路：动一下搜索框、或点它的清除）。
 */
const moreActive = ref(false)
const moreForm = reactive<{
  client: string
  address: string
  startTs: number | null
  endTs: number | null
}>({ client: '', address: '', startTs: null, endTs: null })
/** 看板组件引用（旧版 `N`）—— 确认后把日期区间回灌给它（旧版 §3.5 那条环）。 */
const dashboardRef = ref<InstanceType<typeof ProgressDashboard> | null>(null)

/** 本地「今天 00:00」起算的 `offsetDays` 天前的时间戳（`n-date-picker` 的 model 是时间戳）。 */
function dayStart(offsetDays = 0): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.getTime()
}

/** 时间戳 → 本地 `YYYY-MM-DD`（旧版 `value-format:"YYYY-MM-DD"`，Element 按本地日期格式化）。 */
function toIsoDate(ts: number | null): string {
  if (ts == null) return ''
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 日期快捷项（旧版 `Ao`）：最近一周 / 最近一个月 / 最近三个月，**顺序与文案照抄**
 * （旧版是 `now - 6048e5 / -2592e6 / -7776e6` 三个定值）。
 * ⚠️ 旧版是 setup 里算好的**定值**（跨零点会把「最近一周」选成昨天），这里用函数形态按点击时求值
 * —— 与 `DATE_SHORTCUTS` 同一个口径（该声明已随 B5 归位到
 * `app/src/composables/home/useHomeQueryMore.ts`，2026-09-20 纯搬迁）。
 */
const MORE_DATE_SHORTCUTS: Record<string, () => number> = {
  最近一周: () => dayStart(-7),
  最近一个月: () => dayStart(-30),
  最近三个月: () => dayStart(-90),
}

/** 自动完成永远展示候选（旧版 `trigger-on-focus`；与 `Home.vue` 的 `AUTOCOMPLETE_ALWAYS_SHOW` 同一招 —— 该常量的**声明**已于 2026-09-20 归位到 `app/src/utils/homeConstants.ts`，纯搬迁，`Home.vue` 那边只剩 import 与模板里两处 `:get-show`）。 */
const AUTOCOMPLETE_ALWAYS_SHOW = () => true

/** 客户候选：按 `name` 子串（忽略大小写）本地过滤；查询词为空给全量（旧版 `bo`）。 */
const moreClientOptions = computed(() => {
  const q = moreForm.client.trim().toLowerCase()
  return moreClients.value
    .filter((c) => !q || (c.name ?? '').toLowerCase().includes(q))
    .map((c) => ({ label: c.name, value: c.name }))
})

/** 旧版 `Lo`：重置表单 + 开窗 + （异步）拉客户候选。看板那条环也走这里。 */
async function openMore() {
  moreForm.client = ''
  moreForm.address = ''
  moreForm.startTs = dayStart(-30)
  moreForm.endTs = dayStart(0)
  moreShow.value = true
  try {
    // ⚠️ 旧版这里按 `{name: 客户, tel: 电话, address: 地址, id: 编号}` 映射（那四个键永远读不到，
    //    见上面第 ② 条）—— 新版直接用 `ClientDto` 的字段。
    moreClients.value = await api.listClients()
  } catch {
    message.error('初始化客户信息失败')
  }
}

/** 旧版 `Io`：取数 → 排序 → 换底表 → 并入全量 → 搜索框回显 → 关窗。 */
async function submitMore() {
  moreLoading.value = true
  try {
    const d = await api.listProgressMore({
      client_name: moreForm.client,
      install_address: moreForm.address,
      start_date: toIsoDate(moreForm.startTs),
      end_date: toIsoDate(moreForm.endTs),
    })
    const list: ProgressRow[] = (d?.progressData ?? [])
      // 同旧版：补 `isSelected`（勾选态随新对象归零）+ `生产进度` 兜底成空串
      .map((r) => ({ ...r, isSelected: false, 生产进度: r['生产进度'] || '' }))
      // 旧版按 `parseInt(回执单号)` **倒序**。⚠️ `parseInt` 解不出来的（空/非数字）是 `NaN`，
      // 比较函数返回 `NaN` ⇒ 被引擎当成 0（这几行的相对次序不保证）—— 旧版就是这个表现，照抄。
      .sort((a, b) => parseInt(b['回执单号']) - parseInt(a['回执单号']))

    moreRows.value = list
    moreActive.value = true

    /*
     * 并入全量 `K`（旧版 `Io` 末段，逐字）：
     *   V = new Set(K.map(id)); w = d.filter(r => V.has(r.id)); y = d.filter(r => !V.has(r.id))
     *   K = K.map(e => w.find(t => t.id === e.id) || e);  K = [...K, ...y]
     * ⇒ 查回来的**已有行换成新的那条对象**（位置保持在全量里的原位），**新行追加到末尾**。
     * ⚠️ 副作用照抄：被换掉的那些行对象上的勾选态没了（新对象是 `isSelected:false`）。
     */
    const existing = new Set(rows.value.map((r) => r.id))
    const byId = new Map(list.filter((r) => existing.has(r.id)).map((r) => [r.id, r]))
    rows.value = [
      ...rows.value.map((r) => byId.get(r.id) ?? r),
      ...list.filter((r) => !existing.has(r.id)),
    ]

    // 搜索框回显「客户 地址」（旧版 `zo = (selectedClient + " " + selectedAddress).trim()`）。
    // ⚠️ 照抄旧版的两个后果：① 它**同时**是「当前筛选」那句文案与「导出表格」那颗按钮的开关；
    //    ② 空条件时它是空串 ⇒ 仍按「总计」显示。两者都与旧版一致，别当成 bug 去"修"。
    searchText.value = `${moreForm.client} ${moreForm.address}`.trim()

    // 看板开着才回灌（旧版 `B.value && N.value`）：`setCustomDateRange` 顺手把时间档位切到「自定义查询」。
    if (dashboardShow.value && dashboardRef.value) {
      dashboardRef.value.setCustomDateRange([
        toIsoDate(moreForm.startTs),
        toIsoDate(moreForm.endTs),
      ])
    }

    moreShow.value = false
    // 旧版文案。
    message.success('查询成功')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '查询数据失败')
  } finally {
    moreLoading.value = false
  }
}

/** 旧版 `ao`：搜索框一动就打字退出「查询更多」的结果集（**不清** `xo`，也不清 `zo`）。 */
function onSearchInput() {
  moreActive.value = false
}

/** 旧版 `lo`：点清除按钮 —— 清空搜索词**并且**退出结果集。 */
function onSearchClear() {
  searchText.value = ''
  moreActive.value = false
}

// ── C2. 行勾选（旧版「日期」列里的 checkbox，表头那颗是全选）────────────────
/*
 * 旧版原文（反混淆后，逐字）：
 *
 *   // 表头（「日期」列 title）：ElCheckbox `model-value: Rl` + `onChange: $l`
 *   //   标题 = "全选/取消全选（当前筛选结果）"
 *   Rl = computed(() => { const t = no.value; return !(!t || 0 === t.length) && t.every(r => r.isSelected) })
 *   $l = e => { if (e) { no.value.forEach(l => { l.isSelected !== e && (l.isSelected = e, Jl(l, e)) }) }
 *               else { te.ping_hui = []; te.diao_hui = []; K.value.forEach(r => r.isSelected = false); ae() } }
 *
 *   // 行内：ElCheckbox `modelValue: row.isSelected` + `onUpdate:modelValue` + `onChange: t => Jl(row, t)`
 *   Jl = (row, checked) => { checked ? (吊脚 非空 ? push ping_hui : push diao_hui) : (从对应数组里 splice) }
 *
 * 三处**必须照抄**的语义，别顺手"改好"：
 *
 *  ① **表头全选的范围是「当前筛选结果」`no`，不是当前页** —— 旧版自己在 title 里都写明了。
 *     本页 `filteredRows` 就是 `no`（筛完但**没分页**，见那里的注释）⇒ 用它对。
 *  ② **取消全选清的是「全部行」`K`**（不是 `no`）—— 旧版那个分支直接 `K.value.forEach`。
 *     看着别扭，但结果就是「一取消全选，翻到哪页都没有勾」；用 `filteredRows` 会漏掉
 *     被筛掉的页上的勾。**照抄**。
 *  ③ 勾选**不影响**搜索/筛选/分页的任何一步（旧版 `isSelected` 从不参与 `no` 的计算）。
 */
const allSelected = computed(
  () => filteredRows.value.length > 0 && filteredRows.value.every((r) => r.isSelected),
)

/** 表头「全选/取消全选」（旧版 `$l`）。 */
function toggleSelectAll(v: boolean) {
  if (v) {
    // 旧版只对 `isSelected` **有变化**的行调 `Jl`（勾选态得靠它同步进 te 数组）；
    // 新版没有那个数组，这里只需设置标志，仍保留 `!r.isSelected` 的写法以对应原文。
    for (const r of filteredRows.value) if (!r.isSelected) r.isSelected = true
  } else {
    for (const r of rows.value) r.isSelected = false
  }
}

/**
 * 「批量更新」的入口（旧版 `ta`）—— 先过「有没有缺单号的行」那道闸，再开同一个弹窗。
 *
 * 旧版原文（逐字，提醒语的标点别改）：
 *   if ([...te.ping_hui, ...te.diao_hui].some(e => !e["单号"]))
 *     ElMessage.error("存在未生产的订单（缺少单号），不允许批量更新，请取消勾选未生产的订单")
 *   else { O = true（批量模式）; Y = null; S = true（loading）; …拉 GetProcedures…; W 复位; I = true }
 */
function openBatchUpdate() {
  if (selectedRows.value.some((r) => !r['单号'])) {
    message.error('存在未生产的订单（缺少单号），不允许批量更新，请取消勾选未生产的订单')
    return
  }
  // 批量模式：`updTarget` 留空（单行那套「未开始生产的单无法更新进度」的守卫也随之不生效 —— 旧版同理）
  openUpdateDialog(null)
}

// ── C3. 打印（旧版 §4.5：工具条「打印选项」→ 抽屉里 12 类单据 → 预览弹窗）────
/*
 * ## 旧版这条链
 *
 * 抽屉 `zl` 里那 12 颗按钮**每一颗都是同一个形状**：
 *
 *   ① 从勾选的行（`te.ping_hui` / `te.diao_hui`）算出该单据的行
 *      （`Ca`/`Pa`/`La`/`Ba`/`Ma`/`ka`/`So` … 各自一段，很短：`Dl.value.calculateReceipt(...)`、
 *       `lableForProduct(...)`、`Glasslist()` … —— 调的是**内嵌子组件**的方法）；
 *   ② `commentPreview(registrant.template.xxx, rows)` 生成 HTML；
 *   ③ 开预览弹窗 `ml`（宽 1180px），并把 `pl`（= ic）设成该单据，弹窗据此出现对应的编辑按钮。
 *
 * ## 新版怎么接（**一行旧代码都没搬，全走共用件**）
 *
 *   勾选的行 ──(order.id 去重 + getOrder)──▶ 订单（**只留勾选的那些行**）──▶ PrintDrawer(preset="progress")
 *     ──▶ PrintPreviewDialog（= 上面①②③ 的新版等价物：`printPayloads` + hiprint 预览）
 *
 * **为什么不照旧版把子组件的方法也搬过来**：那 12 段的产出（标签行 / 生产单行 / 玻璃行…）
 * 新版**已经全部**在 `utils/printPayloads.ts` 里实现过了，而且是按**模板字段族**分发
 * （`templatePayload`），Home / Hui 打印走的就是它。再抄一份 = 同一套口径两份实现。
 *
 * ## ⚠️ 一处**有意的粒度差异**（不是等价物，别当成抄漏）
 *
 * 旧版打印的输入是**勾选的门行**（`te.ping_hui`/`diao_hui` 里就是门行本身），
 * 新版共用链路是**订单级**的（`PrintContext` 吃 `OrderDto`）。为了不把「没勾的樘数」也打出来，
 * 这里把勾选行折算成订单时**只保留勾选的那些行**（`printOrdersOf`）——
 * 于是「打出来的门」与旧版一致，差异只在「订单头字段来自整单」（旧版也是整单的：
 * `enrichDoorRow` 的客户/单号/日期本来就取自订单头）。
 */

const printShow = ref(false)
/** 打印用的订单（勾选行折算出来的一份**新对象**，不写回 `rows`）。 */
const printOrders = ref<OrderDto[]>([])
const previewShow = ref(false)
const previewMode = ref('')
const previewTitle = ref('')

/** 已拉过的整单（一次抽屉会话里同一张单只拉一次；抽屉关掉就清，免得看到旧数据）。 */
let printOrderCache = new Map<number, OrderDto>()

/**
 * 勾选行 → 订单：按 `order.id` 归并，**每单只保留被勾选的那些行**。
 *
 * 单个订单拉失败**不拦整体**（旧版也没有「有一行取不到就整批失败」这种逻辑）——
 * 拉不到的订单直接不进打印批次，用户看到的就是少一单。
 *
 * ⚠️ **单据里各单/各行出现的顺序**：这里是**表里的顺序**（`selectedRows` 逐行过滤出来的顺序）。
 *    旧版是**点击顺序**（`Jl` 往数组里 `push`）。旧版那个顺序纯属操作痕迹（同一批勾选、
 *    换个勾选次序就换个出单次序），照抄它反而不可复现 ⇒ 取表序。**有意偏离**。
 */
async function printOrdersOf(selected: ProgressRow[]): Promise<OrderDto[]> {
  const byOrder = new Map<number, Set<number>>()
  for (const r of selected) {
    const oid = r.order?.id
    if (!oid) continue
    if (!byOrder.has(oid)) byOrder.set(oid, new Set())
    byOrder.get(oid)!.add(r.id)
  }
  const out: OrderDto[] = []
  for (const [oid, lineIds] of byOrder) {
    try {
      let full = printOrderCache.get(oid)
      if (!full) {
        full = await api.getOrder(oid)
        printOrderCache.set(oid, full)
      }
      // ⚠️ **必须留非空的行数组**：`PrintPreviewDialog` 的明细兜底是
      //    `o.lines?.length ? o : await api.getOrder(o.id)` —— 空数组会被它当成「没展开过」
      //    再拉一整单回来，勾选过滤就白做了。（本函数只在选了该单的行时才建条目，故必然非空。）
      out.push({ ...full, lines: (full.lines ?? []).filter((l) => lineIds.has(l.id)) })
    } catch {
      // 静默跳过（见上）
    }
  }
  return out
}

/** 派生 `printOrders`（带一个 token：慢的响应不许盖掉新的）。 */
let printToken = 0
async function syncPrintOrders() {
  const token = ++printToken
  const selected = selectedRows.value
  // 没勾选就别去拉订单了：抽屉照开，里面 12 颗按钮会因为 `orders` 为空而全灰（= 旧版的表现）。
  const list = selected.length ? await printOrdersOf(selected) : []
  if (token === printToken) printOrders.value = list
}

/**
 * 工具条「打印选项」（旧版 `zl=true`）—— 旧版**没有**「没勾选就不给开」的守卫，这里同样不守卫。
 * 抽屉会照常打开，只是没勾选时里面 12 颗全灰（每颗的 `disabled` 就是「已选条数 = 0」）。
 */
async function openPrint() {
  printOrderCache = new Map()
  await syncPrintOrders()
  printShow.value = true
}

/*
 * 抽屉**开着的时候**勾选变了要跟着变。
 *
 * 旧版那 12 颗按钮是**在点击时**现读 `te.ping_hui`/`diao_hui` 的（勾选框在左侧固定列，
 * 抽屉只占右边 350px，两者同屏可点）⇒ 开着抽屉改勾选，旧版立刻按新勾选出单。
 * 新版这份 `printOrders` 是快照，不跟就会打错单据 —— 所以补这个 watch
 * （`printOrdersOf` 有整单缓存，重复触发不会重复请求；token 保证慢响应不覆盖新结果）。
 */
watch(
  () => (printShow.value ? selectedRows.value.map((r) => r.id).join(',') : ''),
  () => {
    if (printShow.value) void syncPrintOrders()
  },
)

/**
 * 抽屉里点了某类单据 → 开预览弹窗（与 `Home.vue` 的 `onOpenMode` 同一个口径：先关抽屉）。
 *
 * ⚠️ 多一道**「收据单不能跨客户」**的闸 —— 这是旧版 `So` 里的原话：
 *    `if (new Set(客户编号).size > 1) return ElMessage.error("所选数据包含不同客户，不能构建收据单")`
 *    （旧版一张收据单只服务一个客户；新版回执族载荷是**每单一份**，不加这道闸会把
 *     「两个客户的收据」一次全打出来 —— 那是旧版明确拒绝的事。）
 */
function onOpenPrintMode(mode: string, title: string) {
  if (mode === 'FinalReceipt') {
    const codes = new Set(selectedRows.value.map((r) => String(r['客户编号'] ?? '')))
    if (codes.size > 1) {
      message.error('所选数据包含不同客户，不能构建收据单')
      return
    }
  }
  printShow.value = false
  previewMode.value = mode
  previewTitle.value = title
  previewShow.value = true
}

/**
 * 搜索词一变就回第 1 页。
 *
 * ⚠️ **有意偏离**：旧版动搜索框**不重置页码**（`zo` 只被 v-model 写、`ao` 只清 `Bo`），
 *    在旧版上「停在第 2 页搜一个只剩 3 条的词」就会看到空表 —— 那是毛病。
 *    本页本就把筛选放在分页**之前**（见 `filteredRows` 的注释），不重置页码只会更容易撞上它。
 *    另：旧版 `onClear`（`lo`）只清 `zo` 和 `Bo`，在「还没有查询更多」的本版里是纯空操作
 *    ⇒ 这里不复刻那个 handler，靠 `clearable` + 这个 watch 覆盖。
 */
watch(searchText, () => {
  page.value = 1
})

// ── C1. 统计数字（旧版 `yo` / `vo` / `mo` / `go` / `fo` / `po`，全部作用在 `no` = 筛选后）──
/*
 * ⚠️ 五个数都是**前端逐行算的**，后端不参与；口径与看板的 `ke2` **不完全一样**（看板另有
 *    「不含单玻」开关），**别把这两处合并**。
 *
 * ⚠️ 全部读的是**筛选后**的 `filteredRows`（= 旧版 `no`）。
 *
 * ⚠️ 旧版这一大段是从 `ProgressRowDto` 的**中文键**上读的（`型材` / `扇数` / `开向` / `数量` /
 *    `亮窗总高` / `轨道种类`）；我们的 DTO 是英文列名 ⇒ 逐项换成
 *    `profile` / `fans` / `direction` / `quantity` / `light_window_height` / `track`。
 */

/**
 * 「移门」判据用的扇数枚举（**旧版 `fo` 里那张独立数组** `d` 的原样，顺序照抄）。
 *
 * ⚠️ 旧版把同一批字面量写了**两份**：`yo` 是一条 if 链（每项还带「每樘几扇」的值）、
 *    `fo` 是这张只看「是不是移门扇数」的数组。改动时**两处都要改**
 *    （`moveFans` 的 if 链 / 这张表），差分台 `docs/progress-toolbar-logiccheck.mjs`
 *    里有一条自检会比对这两份的字面量集合，漏改一处会红。
 */
const MOVE_FAN_NAMES = [
  '2轨2扇',
  '2轨3扇',
  '2轨4扇',
  '3轨2扇1纱',
  '3轨4扇2纱',
  '3轨3扇',
  '4轨4扇',
  '5轨5扇',
  '6轨6扇',
  '7轨7扇',
  '8轨8扇',
  '9轨9扇',
  '单轨单扇',
  '单轨2扇',
  '折叠2扇',
  '折叠3扇',
  '折叠4扇',
  '折叠5扇',
  '折叠6扇',
  '折叠7扇',
  '折叠8扇',
  '折叠9扇',
] as const

/** 平开门「单开」的 8 个开向（旧版 `vo` 的 `o` 数组，顺序照抄）。 */
const PING_SINGLE_DIRECTIONS = [
  '内左',
  '内右',
  '外左',
  '外右',
  '左锁内开',
  '右锁内开',
  '左锁外开',
  '右锁外开',
]

/** 平开门「双开」的 6 个开向（旧版 `vo` 的 `n` 数组）。 */
const PING_DOUBLE_DIRECTIONS = ['双开内开', '双开外开', '双开内左', '双开内右', '双开外左', '双开外右']

/** `其它` 用的 14 项合并表（旧版 `fo` 的 `o` 数组 = 单开 8 + 双开 6）。 */
const ALL_PING_DIRECTIONS = [...PING_SINGLE_DIRECTIONS, ...PING_DOUBLE_DIRECTIONS]

/** 旧版 `vo`/`fo` 都用的开向归一化：显示名 → 原始开向（`openDirectionNaming` 的 `g`）。 */
const normDirection = (d: string) => getOriginalOpenDirection(d)

/**
 * `yo` 移门扇数：逐行按 `扇数` 查表得「每樘几扇」，再乘 `数量` 累加。
 *
 * ⚠️ 三处照抄的细节：
 *  ① 型材含「哑口」的行**直接跳过**（注意：只在这里跳，不影响「其它」的判定 —— 见 `others`）；
 *  ② 查不到对应扇数 ⇒ `r` 保持 0 ⇒ **跳过**（不按 1 扇算）；
 *  ③ 旧版那句 `(l["型材"]&&l["型材"].includes("+0"), t+o*r)` 里 `includes("+0")` 是个
 *     **没有任何作用的残留表达式**（逗号运算符左边），不复制。
 */
const moveFans = computed(() =>
  filteredRows.value.reduce((acc, r) => {
    if (r.profile && r.profile.includes('哑口')) return acc
    const n = r.fans
    let per = 0
    if (n === '2轨2扇' || n === '单轨2扇' || n === '折叠2扇') per = 2
    else if (n === '2轨3扇' || n === '3轨3扇' || n === '折叠3扇' || n === '3轨2扇1纱') per = 3
    else if (n === '2轨4扇' || n === '4轨4扇' || n === '折叠4扇') per = 4
    else if (n === '3轨4扇2纱' || n === '折叠6扇' || n === '6轨6扇') per = 6
    else if (n === '单轨单扇') per = 1
    else if (n === '折叠5扇' || n === '5轨5扇') per = 5
    else if (n === '折叠7扇' || n === '7轨7扇') per = 7
    else if (n === '折叠8扇' || n === '8轨8扇') per = 8
    else if (n === '折叠9扇' || n === '9轨9扇') per = 9
    if (per === 0) return acc
    return acc + (r.quantity || 0) * per
  }, 0),
)

/**
 * `vo` 平开门扇数：型材含「钻石」跳过；归一化后的开向 ∈ 单开 8 项 `+数量`、
 * ∈ 双开 6 项 `+2×数量`、其余不计。
 */
const pingFans = computed(() =>
  filteredRows.value.reduce((acc, r) => {
    if (r.profile && r.profile.includes('钻石')) return acc
    const d = normDirection(r.direction)
    if (PING_SINGLE_DIRECTIONS.includes(d)) return acc + (r.quantity || 0)
    if (PING_DOUBLE_DIRECTIONS.includes(d)) return acc + 2 * (r.quantity || 0)
    return acc
  }, 0),
)

/**
 * `mo` 移门亮窗个数：`亮窗总高 > 0` 且 `轨道种类` 非空且**不等于字符串 `"NULL"`** ⇒ `+数量`。
 * ⚠️ `"NULL"` 是**四个字母的字符串**（旧库里真出现过），不是 `null` —— 别改成 `!= null`。
 */
const lightWindows = computed(() =>
  filteredRows.value.reduce(
    (acc, r) =>
      r.light_window_height > 0 && r.track && r.track !== 'NULL' && r.track !== ''
        ? acc + (r.quantity || 0)
        : acc,
    0,
  ),
)

/** `go` 淋浴房扇数：扇数 ∈ {一固一活, 双活} ⇒ `+2×数量`；否则型材含「钻石」⇒ `+数量`。 */
const showerFans = computed(() =>
  filteredRows.value.reduce((acc, r) => {
    if (r.fans === '一固一活' || r.fans === '双活') return acc + 2 * (r.quantity || 0)
    if (r.profile && r.profile.includes('钻石')) return acc + (r.quantity || 0)
    return acc
  }, 0),
)

/**
 * `fo` 其它：**不属于上面任何一类**的行才 `+数量`。
 *
 * ⚠️ 这里有个**容易照文档写错**的地方：分析文档 §5.4 把「其它」写成「（且非哑口）」，
 *    但旧版源码里「哑口」**只参与「移门」那一条判据**（`d = 是移门扇数 && !哑口`），
 *    并没有一个总的「哑口 ⇒ 不算其它」的分支。所以一行「哑口」如果没有亮窗 / 不是淋浴 /
 *    不是钻石 / 开向不在 14 项里，它**是会被算进「其它」的**。
 *    这里**照源码写**（`includes(哑口)` 只影响 `isMove`），并已在
 *    `docs/2026-09-19-progress-analysis.md` §5.4 记明这处措辞与源码的差别。
 */
const others = computed(() =>
  filteredRows.value.reduce((acc, r) => {
    const isYakou = !!r.profile && r.profile.includes('哑口')
    const isMove = (MOVE_FAN_NAMES as readonly string[]).includes(r.fans) && !isYakou
    const isLight =
      r.light_window_height > 0 && !!r.track && r.track !== 'NULL' && r.track !== ''
    const isShower = r.fans === '一固一活' || r.fans === '双活'
    const isDiamond = !!r.profile && r.profile.includes('钻石')
    const isPing = ALL_PING_DIRECTIONS.includes(normDirection(r.direction))
    return isMove || isLight || isShower || isDiamond || isPing ? acc : acc + (r.quantity || 0)
  }, 0),
)

/**
 * `po` 时间区间：`no` 里所有 `日期` 的 min/max，格式化成 `YYYY-MM-DD`（`toISOString().slice(0,10)`）。
 * 空集 ⇒ `{earliest:'', latest:''}`。
 * ⚠️ 旧版对**解析不出来的日期**没有防护（`new Date(x)` 得到 Invalid Date ⇒ `toISOString()` 会抛）。
 *    日期是后端 `dateText()` 格式化过的串，这里不改口径、也不加兜底。
 */
const dateRange = computed(() => {
  const list = filteredRows.value
  if (list.length === 0) return { earliest: '', latest: '' }
  const stamps = list
    .map((r) => r['日期'])
    .filter((d) => d)
    .map((d) => new Date(d).getTime())
  if (stamps.length === 0) return { earliest: '', latest: '' }
  const fmt = (ms: number) => new Date(ms).toISOString().split('T')[0]
  return { earliest: fmt(Math.min(...stamps)), latest: fmt(Math.max(...stamps)) }
})

/**
 * 统计行的后半段（旧版那个 `<span class="total-info">` 的内容，**含开头的空格与竖线**）。
 * ⚠️ 导出用的那句**不是**直接拼它 —— 旧版两处文案**有两处不同**（见 `exportTable` 的注释）。
 */
const statsTail = computed(
  () =>
    ` | 时间: ${dateRange.value.earliest} 至 ${dateRange.value.latest}` +
    ` | 移门扇数: ${moveFans.value} | 平开门扇数: ${pingFans.value}` +
    ` | 移门亮窗个数: ${lightWindows.value} | 淋浴房扇数: ${showerFans.value}` +
    ` | 其它: ${others.value}`,
)

// ── C2. 导出表格（旧版 `z`，§4.6）──────────────────────────────────────────
/*
 * 旧版是**纯前端** ExcelJS 造一个「筛选结果」表 → `writeBuffer()` → Blob → `<a download>`。
 * 列 / 底色 / 行高 / 文案**逐项照抄**，包括下面这些反直觉的地方：
 *
 *  ① 导的是**筛选后**的 `no`（= 本页 `filteredRows`），不是当前页、也不是全量；
 *  ② 标题行 `筛选结果: {搜索词}`、统计行 `统计信息: {n}条记录 | …`（⚠️ 见下面的文案差异）；
 *  ③ **会多出一行重复表头** —— `ws.columns = cols` 让 ExcelJS 自己插了一行表头，
 *     随后旧版又 `addRow(cols.map(c => c.header))` 手工加了一行带样式（蓝底/居中/高 25）的表头，
 *     于是成品里 row3 / row4 是两行一样的表头。**这是旧版线上导出的真实样子，照抄不清理**
 *     （真要清理属于「改输出」，得先拍板；已记在 `docs/2026-09-19-progress-analysis.md` §4.6）。
 *  ④ 行高按 `生产进度` 里 `➞` 的个数算：`max(22, 18*(n+1))`（`n=0` 时按 1 算 ⇒ 22）；
 *  ⑤ 「生产进度」是**第 4 列**，只有它的对齐带 `wrapText`。
 */
async function exportTable() {
  exporting.value = true
  try {
    // exceljs 只在**真点导出**时才下载（浏览器包 ~950KB，不能进主 chunk）。
    // ⚠️ 写法与 `utils/printService.ts` 引 vue-plugin-hiprint 同一套路：exceljs 的
    //    `browser` 字段指向 UMD 包（`dist/exceljs.min.js`），**没有 ESM 默认导出**，
    //    所以「类型走 type-only import、运行期双取（命名空间 / default）」。
    const mod = (await import('exceljs')) as unknown as ExcelJSInterop
    const WorkbookCtor = mod.Workbook ?? mod.default?.Workbook
    if (!WorkbookCtor) throw new Error('exceljs 未正确加载')
    const wb = new WorkbookCtor()
    const ws = wb.addWorksheet('筛选结果')

    // 列定义（header / key / width）逐字照抄旧版。
    const cols = [
      { header: '日期', key: 'date', width: 15 },
      { header: '客户', key: 'customer', width: 15 },
      { header: '单号', key: 'orderNo', width: 15 },
      { header: '生产进度', key: 'progress', width: 30 },
      { header: '型材', key: 'profile', width: 12 },
      { header: '颜色', key: 'color', width: 12 },
      { header: '底玻', key: 'bottomGlass', width: 12 },
      { header: '面玻', key: 'topGlass', width: 12 },
      { header: '玻璃厚', key: 'glassThick', width: 10 },
      { header: '开向', key: 'direction', width: 12 },
      { header: '扇数', key: 'fanCount', width: 12 },
      { header: '门洞高', key: 'height', width: 10 },
      { header: '门洞宽', key: 'width', width: 10 },
      { header: '墙厚', key: 'wallThick', width: 10 },
      { header: '轨道长', key: 'trackLen', width: 10 },
      { header: '亮窗总高', key: 'brightHeight', width: 12 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '平方数', key: 'area', width: 10 },
      { header: '金额', key: 'amount', width: 12 },
      { header: '备注', key: 'remark', width: 20 },
      { header: '安装地址', key: 'address', width: 20 },
      { header: '打单人', key: 'creator', width: 12 },
      { header: '业务员', key: 'salesman', width: 12 },
    ]
    ws.columns = cols

    // 第 1 行：标题（合并 → 蓝底 FFE6F4FF → 16 号粗体居中 → 高 30）
    ws.insertRow(1, [`筛选结果: ${searchText.value}`])
    ws.mergeCells(1, 1, 1, cols.length)
    const title = ws.getRow(1)
    title.height = 30
    title.font = { size: 16, bold: true }
    title.alignment = { vertical: 'middle', horizontal: 'center' }
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4FF' } }

    // 第 2 行：统计（黄底 FFFFF7E6；行高按**字符数** `max(25, 18*ceil(len/80))`，不是按行数）
    //
    // ⚠️ 这句与工具条上的 `statsTail` **不是同一串**，两处措辞不同、别合并成一个函数：
    //    · 「N条记录」后面**直接**跟 `" | 时间:"`（工具条那句是「N 条记录 | 时间:」，中间有空格）；
    //    · 这里是「**移门亮窗**」，工具条上是「**移门亮窗个数**」。
    const statLine =
      `统计信息: ${filteredRows.value.length}条记录` +
      ` | 时间: ${dateRange.value.earliest} 至 ${dateRange.value.latest}` +
      ` | 移门扇数: ${moveFans.value} | 平开门扇数: ${pingFans.value}` +
      ` | 移门亮窗: ${lightWindows.value} | 淋浴房扇数: ${showerFans.value}` +
      ` | 其它: ${others.value}`
    ws.insertRow(2, [statLine])
    ws.mergeCells(2, 1, 2, cols.length)
    const statRow = ws.getRow(2)
    statRow.height = Math.max(25, 18 * Math.ceil(statLine.length / 80))
    statRow.font = { size: 11, bold: true }
    statRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    statRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E6' } }

    // 第 3/4 行：表头（见函数头 ③，旧版就是这么摆的）
    const header = ws.addRow(cols.map((c) => c.header))
    header.height = 25
    header.font = { bold: true, size: 10 }
    header.alignment = { vertical: 'middle', horizontal: 'center' }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9ECFF' } }

    // 数据行：值全部 `|| ''`（`0` 也会落成空串，与旧版一致）；整行居中，第 4 列带 wrapText。
    for (const r of filteredRows.value) {
      const row = ws.addRow([
        r['日期'] || '',
        r['客户'] || '',
        r['单号'] || '',
        r['生产进度'] || '',
        r.profile || '',
        r.color || '',
        r.bottom_glass || '',
        r.face_glass || '',
        r.glass_thickness || '',
        r.direction || '',
        r.fans || '',
        r.door_height || '',
        r.door_width || '',
        r.wall_thickness || '',
        r.track_length || '',
        r.light_window_height || '',
        r.quantity || '',
        r.square || '',
        r.amount || '',
        r.remark || '',
        r.install_address || '',
        r['打单人'] || '',
        r['业务员'] || '',
      ])
      row.alignment = { vertical: 'middle', horizontal: 'center' }
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      const arrows = ((r['生产进度'] || '').match(/➞/g) || []).length
      row.height = Math.max(22, 18 * (arrows > 0 ? arrows + 1 : 1))
    }

    // 所有单元格加细边框（旧版在写完数据后统一 `eachRow`/`eachCell` 刷一遍）
    ws.eachRow((row) =>
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      }),
    )

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 文件名：`筛选结果_{YYYY-MM-DD_HH-mm-ss}.xlsx`（旧版把 `toLocaleString('zh-CN')` 的
    // `/` `:` 空格分别换成 `-` `-` `_`；照抄它的**字符替换**而不是手写日期格式）
    a.download = `筛选结果_${exportStamp()}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch (e) {
    message.error('导出失败: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    exporting.value = false
  }
}

/** 旧版导出文件名里的时间戳（`toLocaleString('zh-CN', …)` 后逐字符替换）。 */
function exportStamp(): string {
  return new Date()
    .toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/\//g, '-')
    .replace(/:/g, '-')
    .replace(/\s/g, '_')
}
</script>

<style scoped>
.page {
  /* 减掉全局标题栏的高度（`App.vue` 的 `--app-header-h`）。 */
  min-height: calc(100vh - var(--app-header-h));
  background: #fff;
  padding: 12px 16px 24px;
}
/*
 * 工具条 / 统计行的四条规则**逐字抄** `legacy/css/Progress-4dee25cf.css` 的
 * `[data-v-95ebc180]` 段（`.search-row` / `.search-input` / `.search-info` / `.total-info`）：
 *
 *   .search-row  {margin-bottom:15px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
 *   .search-input{width:300px;margin-right:10px}
 *   .search-info {margin-top:8px;font-size:14px;color:#606266}
 *   .total-info  {font-weight:500}
 *
 * ⚠️ 值别"顺手改成" 8px/gap:8px：旧版就是 10px 的 gap + 300px 的输入框。
 * ⚠️ 这几条是**本组件自己的模板元素**（不在 naive 的 render 里）⇒ scoped 就能命中，
 *    不需要 `:deep()`；带上 `[data-v-*]` 也**正是我们要的**（旧版同样带 scope）。
 */
.search-row {
  margin-bottom: 15px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.search-input {
  width: 300px;
  margin-right: 10px;
}
.search-info {
  margin-top: 8px;
  font-size: 14px;
  color: #606266;
}
.total-info {
  font-weight: 500;
}
.table-footer {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
/*
 * ⚠️ 格内的类**必须走 `:deep()`**，而且原因和直觉不一样，别顺手"清理"掉：
 *
 *   ① naive 的 `n-data-table` 在自己的 render 里调 `column.render`，此时 Vue 的「当前渲染实例」
 *      是 naive 的内部组件（没有 `__scopeId`）⇒ 那些 VNode **拿不到本组件的 `data-v-*` 属性**。
 *   ② 而 `:deep(.x)` **整条选择器就是它本身**时（前面没有祖先选择器），
 *      `@vue/compiler-sfc` 找不到可以挂 `[data-v-x]` 的位置，于是**原样输出成全局规则 `.x`**。
 *
 *   两条合起来才成立：**正是"退化成全局规则"这一点让它能命中格内的元素**。
 *   （写成裸的 `.cell-line{…}` 反而会被编译成 `.cell-line[data-v-x]{…}` —— 一条都匹配不上。）
 *   已实测：`app/dist/assets/index-*.css` 里 `.cell-line` / `.progress-paid` 都是**不带**
 *   `[data-v-*]` 的全局规则。`DetailLinesTable.vue` 的 `.glass-input-*` 同理。
 *   ⇒ 副作用是这些类名**全应用可见**，取名时要保证不撞车（`.cell-line` / `.cell-col` 全仓唯一）。
 */
:deep(.cell-col) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
:deep(.cell-line) {
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 旧版单元格小件（`Progress-4dee25cf.css` 的 `[data-v-95ebc180]` 段，逐字抄）。
   `.glass-inputs-container2` 的 `gap:-3px` 是旧版原样（负值），照抄。 */
:deep(.glass-inputs-container) {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
}
:deep(.glass-inputs-container2) {
  display: flex;
  flex-direction: column;
  gap: -3px;
  width: 100%;
}
:deep(.glass-input-group) {
  display: flex;
  align-items: center;
  gap: 4px;
}
:deep(.glass-input-label) {
  font-size: 11px;
  white-space: nowrap;
  color: #1302fa;
  min-width: 0px;
}
:deep(.glass-input) {
  flex: 1;
}
/* 「生产进度」格：旧版 `.progress-paid{color:red;font-weight:700}` —— 含「回款」时整格文字标红。
   ⚠️ 这是 **class**（不是 `va()` 里那些内联样式），所以必须有这条规则，
      否则「含回款」就只有 `va()` 的加粗没有整体变红。 */
:deep(.progress-paid) {
  color: red;
  font-weight: 700;
}
/* 旧版 `.el-table .cell{padding:2px 5px;white-space:normal;word-break:break-word}` 与
   `.el-table__cell{height:auto!important;padding-top:5px!important;padding-bottom:5px!important}`。
   naive 没有 `.cell` 这层壳，等价写在 `td` 上。**换行**是关键：工序串长了必须能折行撑高，
   否则「当前工序」被 ellipsis 截掉。 */
:deep(.n-data-table-td) {
  white-space: normal;
  word-break: break-word;
  padding-top: 5px;
  padding-bottom: 5px;
}
/* 表头底色照旧版（`Progress-4dee25cf.css`：`#f0f9eb`）。 */
:deep(.n-data-table .n-data-table-th) {
  background: #f0f9eb;
}
:deep(.n-data-table .n-data-table-th .n-data-table-th__title) {
  font-size: 12px;
  font-weight: 700;
  color: #000;
  justify-content: center;
  text-align: center;
}
.upd-form { display: flex; flex-direction: column; gap: 10px; }
.upd-row { display: flex; align-items: center; gap: 8px; }
.upd-label { width: 60px; flex: none; font-size: 13px; color: #606266; }
.upd-preview { font-size: 12px; color: #909399; }
.upd-footer { display: flex; justify-content: flex-end; gap: 8px; }
</style>

<!--
  「颜色筛选」弹窗的样式放在非 scoped 块里 —— 这是一处**保险**，理由说清楚免得后人"整理"回去：

  naive 的 NPopover 默认把内容 **teleport 到 body**。那段的 VNode 是**插槽函数**产出的，
  插槽由 Vue 用 `withCtx` 绑定到父实例 ⇒ 元素**大概率**会带上本组件的 `data-v-*`（没实测），
  带上就说明放 scoped 块里也能命中 —— **但这是推理，不是验证过的**。
  放在非 scoped 块里**两种情况下都必然生效**，所以选它。类名与旧版 `Progress-4dee25cf.css` 同名
  （`progress-color-filter-*` / `progress-header-tools`），旧版本来就是全局的，不会撞别的页面。
-->
<style>
.progress-header-tools {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.progress-color-filter-btn {
  padding: 0;
  font-size: 12px;
}
.progress-color-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.progress-color-filter-actions {
  display: flex;
  justify-content: flex-end;
}
.progress-color-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.progress-color-filter-item:hover {
  background: #f5f7fa;
}
.progress-color-filter-item.active {
  background: #ecf5ff;
}
.progress-color-swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  flex-shrink: 0;
}
.progress-color-label {
  line-height: 1.2;
  word-break: break-all;
}
</style>
