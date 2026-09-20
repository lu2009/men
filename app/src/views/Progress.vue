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
import { computed, h, onMounted, ref } from 'vue'
import type { VNodeChild } from 'vue'
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
  NSelect,
  useDialog,
  useMessage,
} from 'naive-ui'
import type { DataTableColumn } from 'naive-ui'
import { api } from '../api/client'
import type { ProcedureSlotDto, ProgressRowDto } from '../api/types'
import { getOriginalOpenDirection, loadOpenDirectionSettings } from '../composables/useOpenDirection'
import { useProgressColors } from '../composables/progress/useProgressColors'
import { useProgressDeleteRow } from '../composables/progress/useProgressDeleteRow'
import { SEARCH_FIELDS, useProgressHeader } from '../composables/progress/useProgressHeader'
import { useProgressPrint } from '../composables/progress/useProgressPrint'
import { useProgressQueryMore } from '../composables/progress/useProgressQueryMore'
import { useProgressToolbar, type ExcelJSInterop } from '../composables/progress/useProgressToolbar'
import { useProgressUpdateDialog } from '../composables/progress/useProgressUpdateDialog'
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
import type { ProgressRow } from '../utils/progressRow'
import ProgressDashboard from '../components/ProgressDashboard.vue'
import PrintDrawer from '../components/PrintDrawer.vue'
import PrintPreviewDialog from '../components/PrintPreviewDialog.vue'

const message = useMessage()
// 行内「删除」的二次确认（旧版是 `ElMessageBox.confirm`，同 Hui/Home 的做法用 `dialog.warning`）。
const dialog = useDialog()

// ---------------------------------------------------------------------------
// 「页面行」类型（REF `f097a9b1`:**362**）已归位到 **`app/src/utils/progressRow.ts`**
// （Progress 拆分 **Task 5** 建 —— 全计划唯一一处）。
// ⚠️ **它不属于任何一个搬迁块**：362 在壳区（P2 起点 828 之前）⇒ 这是本计划唯一一次
//   「搬一个不属于任何块的声明」。之所以单独成文件：`<script setup>` 里的 `type`
//   既搬不进别的 `.vue`、也 import 不进来，而它**有四个消费方**（壳 / P6 / P8 / P9）
//   ⇒ `export type` 一次、四处 `import type`，**别在任何一处再抄第二份**。
// ⚠️ 原先那 6 行 JSDoc（「页面行 = 后端行 + 勾选态」）**跟着类型一起搬过去了**，
//   本文件只留这段指路注释（上面 `import type { ProgressRow }` 那行就是接它的口）。
// ---------------------------------------------------------------------------

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

/*
 * 「更新进度」弹窗（旧版 `O` / `Y` / `S` / `W`）—— 2026-09-20 起**三段一并**搬进
 * `composables/progress/useProgressUpdateDialog.ts`（Progress 拆分 **P3**，纯搬迁、逐字未改）。
 * ⚠️ **留在本节里的是壳自己的两件东西，不归 P3**：`procedures`（P2 的颜色口径与下面的
 *   `loadSlots` 共用它）与 `loadSlots` —— 所以删段是三段具名区间，不是一整段。
 * ⚠️ 调用点**不在这里**：本块注入的 `selectedRows` 要到下面 `selectedRows` 声明处才存在，
 *   放这儿会 `TS2448` / 运行期 TDZ ⇒ 那句话挂在 `selectedRows` 之后（在那里有第二段说明）。
 * ⚠️ `const procedures` 头顶原来那行 JSDoc（「工序下拉：本租户配过的槽…」）**跟着 P3 走了**
 *   —— 它落在新家 `slotOptions` 的头顶（REF 的行段划分把它算在 P3 内）。所以这里看着「秃」，
 *   不是漏抄；那句话现在描述的是新家那个下拉候选 `computed`。
 */
const procedures = ref<ProcedureSlotDto[]>([])

async function loadSlots() {
  try {
    const r = await api.listProcedures()
    procedures.value = r?.slots ?? []
  } catch {
    // 读不到就让下拉空着 —— 不拦页面
  }
}

/*
 * 行内「删除」（旧版 §4.3）—— 2026-09-20 起整段搬进
 * `composables/progress/useProgressDeleteRow.ts`（Progress 拆分 **P4**，纯搬迁、逐字未改）。
 * 这里只接回段外真的用到的那个：`confirmDeleteRow` —— `columns` 里「删除」那格链接的 `onClick`。
 * 注入的 `rows` / `dialog` / `message` 都是页面自己的东西（ref / API 对象本身，不是 `.value` 副本）：
 * `rows` 本块要**写**（删成功后 `splice` 掉那一行），另两个是提示与二次确认。
 */
const { confirmDeleteRow } = useProgressDeleteRow({ rows, dialog, message })

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

// ---------------------------------------------------------------------------
// B. 列头交互（`matchesOrderNoOption` `columnFilterState` `onUpdateFilters`
//    `orderNoFilterValues` `orderNoInput` `orderNoQuery` `orderNoPopShow` `orderNoRestoring`
//    `confirmOrderNoQuery` `clearOrderNoQuery` `orderNoHeader` `colorFilter` `progressHeader`
//    `SEARCH_FIELDS` —— 连段首三行横幅与 B1/B2 两段旧版原文注释）已归位到
//    `composables/progress/useProgressHeader.ts`（Progress 拆分 **P5**，REF `f097a9b1`:998-1225）。
//    `SEARCH_FIELDS` 是模块级常量，由那边 `export`、本文件 import 进来给 `filteredRows` 用。
//
// ⚠️ **调用点为什么在下面（`moreActive` 之后）而不在这个位置**：本块注入的 `moreRows`(REF 1456)
//   / `moreActive`(REF 1465) 属 **P8**、在 REF 里**排在本块之后** ⇒ 放在这里会**早读两个 TDZ
//   变量**（`TS2448`）。本块 7 个产出全部只在 `computed` 体内或模板里被读 ⇒ 后移对求值时机零影响。
//   其余 5 个注入项（`rows` `page` `message` / P2 的 `colorKeyOf` `colorFilterOptions`）
//   都在调用点之前早就声明好了。
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// C. 工具条 + 行勾选（`exporting`/`searchText`/`selectedRows`/`refresh`/`allSelected`/
//    `toggleSelectAll`/`openBatchUpdate`，外加模块级 `type ExcelJSInterop`）已归位到
//    `composables/progress/useProgressToolbar.ts`（Progress 拆分 **P7**，
//    REF `f097a9b1`:1374–1417 ∪ 1599–1652 —— 两段同住一个文件）。
//
// ⚠️ **为什么这一块的位置比 P3 还靠前**：本块与 P3 是一对**环** —— 本块的 `selectedRows`
//   要喂给下面那处 `useProgressUpdateDialog(...)`，P3 的 `openUpdateDialog` 又要喂回本块。
//   ⇒ 环只能从一侧打破：本块先建，`openUpdateDialog` 传**一层 thunk**
//   （`(r) => progressUpdateDialog.openUpdateDialog(r)`），真调用发生在用户点「批量更新」时，
//   那时两者都已就绪。**不是凑数**：这里直接写 `openUpdateDialog` 会早读 TDZ（`TS2448`）。
//   ⇒ 连带把 P3 那处拆成「先接住工厂结果、再解构」，只为给这层 thunk 一个可引用的名字。
// ⚠️ 本块 **5 个注入项**：4 个**值**在这个位置都已声明（`rows` 379 / `load` 389 /
//   `message` 367 / `filteredRows` 733 —— 最晚的就是它），第 5 个 `openUpdateDialog` 来自
//   **下面**的 P3 ⇒ 正是靠上面那层 thunk 才敢这么排。复量：
//   `git show f097a9b1:app/src/views/Progress.vue | grep -nE '^const filteredRows|^async function load'`。
//   ⚠️ Task 7 把 P6 搬走之后，`filteredRows` 要改接 `useProgressColumns` 的回传
//   （与 `procedures` 改接 `useProgressColors` 的回传同形）。
// ⚠️ **7 个回传全部解构**（都有段外活读者 —— 少一个就是 `TS2304`，多一个就是死局部 `TS6133`）：
//   模板 `113`(`openBatchUpdate`) `114`(`selectedRows`) `126`(`refresh`)
//     `129`(`exporting` `searchText`) `138`/`166`/`167`(`searchText`)
//   + 脚本 `dateHeader`(`allSelected`/`toggleSelectAll`，REF **1295/1296**)
//   + 脚本 C3 打印段(`selectedRows`，REF **1734/1759/1775**)。
//   〔一律写 REF 行号：本文件行号会随后面每块搬走而漂，写当前行号必然过期。〕
// ⚠️ `ExcelJSInterop` **走 `export` 不走 `return`**（它是模块级 `type`，工厂体内不能
//   `export`，R44）⇒ 这里 `import type` 进来只为 P11 `exportTable`（REF **2005**）那一处；
//   Task 7 把 P11 搬进 `useProgressExport.ts` 后，这个 import 要跟着摘掉。
// ---------------------------------------------------------------------------
const { exporting, searchText, selectedRows, refresh, allSelected, toggleSelectAll, openBatchUpdate } =
  useProgressToolbar({
    rows,
    filteredRows,
    load,
    message,
    // 打破 P7 ↔ P3 的环：thunk 的真调用发生在用户点「批量更新」时（见上面的 ⚠️）。
    openUpdateDialog: (r) => progressUpdateDialog.openUpdateDialog(r),
  })

// ---------------------------------------------------------------------------
// 「更新进度」弹窗的声明已归位到 `composables/progress/useProgressUpdateDialog.ts`（Progress 拆分 P3）。
// ⚠️ **调用点为什么在这儿而不在原位置**：本块注入的 `selectedRows` 是**上面那块（P7 工厂）
//   刚解构出来的**，把 `useProgressUpdateDialog(...)` 放回 P3 的原位置会**早读一个 TDZ 变量**
//   （`TS2448`）。
// ⚠️ **这里为什么要先接住工厂结果再解构**（多出来的 `progressUpdateDialog` 那个名字）：
//   P7 工厂的 `openUpdateDialog` 注入靠一层 thunk 打破了 P7 ↔ P3 的环
//   （见上面 C 段那段 ⚠️），thunk 需要**一个能提前写下的名字**指到本工厂的结果。
//   语义与「直接解构」逐字等价 —— 只是把返回值先落到一个 `const` 上。
// ⚠️ 只解构段外真有活读者的 10 个：模板 264/268/272/276/278/282/283（模板一行不动 ⇒ 行号恒定）
//   + `columns` 里的 `openUpdate(`（REF `f097a9b1`:**1326**）。
//   〔脚本侧一律写 REF 行号：本文件行号会随后面每块搬走而漂，写当前行号必然过期。复量：
//     `git show f097a9b1:app/src/views/Progress.vue | grep -nE 'openUpdate\(r\)|openUpdateDialog\(null\)'`。〕
// ⚠️ **`openUpdateDialog` 从 11 降到 10**：Task 3 落地时它的第 11 个段外读者是
//   `openBatchUpdate` 里的 `openUpdateDialog(null)`（REF **1650**），而 P7 那次搬迁把这句
//   搬进了 `useProgressToolbar.ts` ⇒ 壳里再解构它就是死局部（`TS6133`，已实测抓到）。
//   它现在只经 `progressUpdateDialog.openUpdateDialog` 走 thunk 喂给 P7（见上面 C 段那段 ⚠️）。
//   另 3 个（`updTarget`/`updBatch`/`today`）段外零引用，
//   解构出来就是死局部（`TS6133`）。模板里 `updOpen`/`updSlot`/`updOperator`/`updDate` 是 `v-model`
//   的**写** ⇒ 必须解构，写成 `upd.updOpen` 会把 ref 整个换成字符串（**静默**）。
const progressUpdateDialog = useProgressUpdateDialog({ procedures, selectedRows, message, load })
const {
  updOpen, updSaving, updSlot, updOperator, updDate, slotOptions, updValue, updTitle,
  openUpdate, submitUpdate,
} = progressUpdateDialog
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// C1b. 「查询更多」开窗（`moreShow`/`moreLoading`/`moreRows`/`moreActive`/`moreForm`/
//      `dashboardRef`/`MORE_DATE_SHORTCUTS`/`AUTOCOMPLETE_ALWAYS_SHOW`/`moreClientOptions`/
//      `openMore`/`submitMore`/`onSearchInput`/`onSearchClear`，连段首横幅与那 31 行旧版原文
//      块注释）已归位到 `composables/progress/useProgressQueryMore.ts`
//      （Progress 拆分 **P8**，REF `f097a9b1`:1418–1598）。
// ⚠️ **调用点为什么在这儿**：本块注入的 `searchText` 是**上面 P7 工厂**的回传（REF 1396）
//   ⇒ 调用点必须排在它之后；而**下面**那处 `useProgressHeader(...)`（P5）又拿本块的
//   `moreRows`/`moreActive` 当注入 ⇒ 本工厂的调用必须**早于**它。两个约束把调用点夹在这里。
// ⚠️ **13 个回传全部解构**（都有段外活读者，一个不多一个不少 —— 多一个是死局部 `TS6133`，
//   少一个是 `TS2304`）：模板 11 个（`moreShow` 209/257 · `moreLoading` 258 ·
//   `moreForm` 223/228/232/236/246 · `dashboardRef` 189 · `MORE_DATE_SHORTCUTS` 238/248 ·
//   `AUTOCOMPLETE_ALWAYS_SHOW` 225 · `moreClientOptions` 224 · `openMore` 118/193 ·
//   `submitMore` 258 · `onSearchInput` 142 · `onSearchClear` 143）+ 脚本 2 个
//   （`moreRows`/`moreActive`，见下）。
//   〔一律写 REF 行号：本文件行号会随后面每块搬走而漂，写当前行号必然过期。〕
// ⚠️ **`moreRows`/`moreActive` 在 REF 里有两个段外读者、分属两个块**：
//   REF **1061**（`useProgressHeader` 候选集，**P5** —— 就是下面那处调用）与
//   REF **1251**（`filteredRows` 的 `computed` 体第一行，**P6** —— **此刻仍在壳里**）。
//   两处源码**逐字同形**（`moreActive.value ? moreRows.value : rows.value`）
//   ⇒ 靠 grep 只会看到「有 2 处」，**必须把引用点回落块区间**才知道是**两个**接点。
//   这里解构出来的这两个名字**同时**喂给那两处；Task 7 搬 P6 时再把 `filteredRows` 那一头
//   改成接 `useProgressColumns` 的回传。⚠️ 漏接 P6 那一头 ⇒「查询更多」的结果集不再参与
//   筛选（`filteredRows` 恒按 `rows` 算），**而 `vue-tsc` 与 37 台子都不会红**。
// ⚠️ 另 3 个（`moreClients`/`dayStart`/`toIsoDate`）段外零引用 ⇒ **不解构**（解构了就是
//   `TS6133`）；它们仍在本块内部被用（`moreClientOptions`/`MORE_DATE_SHORTCUTS`/`openMore`/
//   `submitMore`），跟着本块搬走了 —— **不是删掉**。
// ---------------------------------------------------------------------------
const {
  moreShow, moreLoading, moreRows, moreActive, moreForm, dashboardRef,
  MORE_DATE_SHORTCUTS, AUTOCOMPLETE_ALWAYS_SHOW, moreClientOptions,
  openMore, submitMore, onSearchInput, onSearchClear,
} = useProgressQueryMore({
  rows,
  dashboardShow,
  searchText,
  message,
})


// ---------------------------------------------------------------------------
// B. 列头交互的声明已归位到 `composables/progress/useProgressHeader.ts`（Progress 拆分 **P5**）。
// ⚠️ **调用点为什么在这儿而不在原位置**：本块注入的 `moreRows`(REF 1456) / `moreActive`(REF 1465)
//   是**上面 P8 工厂**的回传（Task 5 之前是壳里那两行 `ref`），
//   而它们在 REF 里**排在本块之后**（属 P8）⇒ 放回原位会早读两个 TDZ 变量（`TS2448`）。
//   理由与两端复量命令见上面 B 段那段指路注释。
// ⚠️ **7 个回传全部解构**（都有段外活读者，一个不多一个不少）：
//   模板 `182`(`onUpdateFilters`) ·
//   `filteredRows`(`matchesOrderNoOption` `orderNoFilterValues` `orderNoQuery` `colorFilter` ——
//     REF 1252/1253/1260/1261/1254/1256/1258) ·
//   `columns`(`matchesOrderNoOption` `orderNoFilterValues` `orderNoHeader` `progressHeader` ——
//     REF 1338/1346/1348/1353)。
//   另 6 个（`columnFilterState` `orderNoInput` `orderNoPopShow` `orderNoRestoring`
//   `confirmOrderNoQuery` `clearOrderNoQuery`）**只在本块内部用 ⇒ 不解构**
//   （解构了就是死局部 `TS6133`；R54 实测它们段外 0 引用、模板 0 引用）。**别以为它们没用**。
//   〔脚本侧一律写 REF 行号：本文件行号会随后面每块搬走而漂。〕
// ⚠️ Task 7 把 P6 搬走之后，这 7 个要喂给 `useProgressColumns`
//   （与 `procedures` 改接 `useProgressColors` 的回传同形）。
// ---------------------------------------------------------------------------
const {
  matchesOrderNoOption, orderNoFilterValues, orderNoQuery, orderNoHeader,
  colorFilter, progressHeader, onUpdateFilters,
} = useProgressHeader({
  page,
  rows,
  message,
  moreActive,
  moreRows,
  colorKeyOf,
  colorFilterOptions,
})

// ---------------------------------------------------------------------------
// C2. 行勾选（`allSelected`/`toggleSelectAll`/`openBatchUpdate`，连段首横幅与那段
//     旧版原文块注释）已归位到 `composables/progress/useProgressToolbar.ts`
//     （Progress 拆分 **P7** 的第二段，REF `f097a9b1`:1599–1652）。
//     ⚠️ 与上面 C 段**同住一个文件**是硬要求：`message`/`openUpdateDialog` 只在 C2 出现、
//        `selectedRows`/`filteredRows` 只在 C 段出现 ⇒ 拆开两边各自 `TS2448`。
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// C3. 「打印」链路（`printShow`/`printOrders`/`previewShow`/`previewMode`/`previewTitle`/
//      `printOrderCache`/`printOrdersOf`/`printToken`/`syncPrintOrders`/`openPrint`/
//      `onOpenPrintMode`，连段首横幅、那 29 行旧版原文块注释，**以及段尾那两条顶层
//      `watch`**）已归位到 `composables/progress/useProgressPrint.ts`
//      （Progress 拆分 **P9**，REF `f097a9b1`:1653–1799）。
// ⚠️ **调用点为什么还在原位**：本块 4 个注入项 —— `message`（REF 369）· `page`（REF 388）·
//   `searchText`/`selectedRows`（REF 676，P7 工厂的回传）—— **全部**在 REF 里就排在本块
//   之前 ⇒ **没有 TDZ 约束**；而本块段外的**脚本**引用为 **0**（真 TS 解析器数标识符节点，
//   不是 grep 裸名）⇒ 7 个回传**只被模板读**，模板与位置无关。两条合起来：调用点原地不动，
//   `useProgressHeader(...)`（P5，上面 775 行）那处也一个字不用改（它不吃本块任何名字）。
// ⚠️ **7 个回传全部解构**（都有段外活读者，一个不多一个不少 —— 多一个是死局部 `TS6133`，
//   少一个是 `TS2304`），而且**七个都只被模板用**（段外脚本引用 0）：
//   模板 `printShow` 294 · `printOrders` 296/307 · `previewShow` 306 · `previewMode` 308 ·
//   `previewTitle` 309 · `openPrint` 107 · `onOpenPrintMode` 297。
//   〔一律写 REF 行号/模板行号：本文件行号会随后面每块搬走而漂。〕
// ⚠️ **另 4 个（`printOrderCache`/`printOrdersOf`/`printToken`/`syncPrintOrders`）段外零引用**
//   ⇒ **不解构**；它们仍在本块内部被用，跟着本块搬走了 —— **不是删掉**。
//   ⚠️ 其中 `printOrderCache`/`printToken` 是**裸 `let`**（会被重新赋值）⇒ 必须**整体**搬进
//   工厂、靠闭包存活，别留半个在壳里（留半个 = `TS2304`）。
// ⚠️ **两条顶层 `watch` 也一起搬走了**（REF 1758 那条「抽屉开着时勾选变了重算」、
//   REF 1796 那条「搜索词一变回第 1 页」）。它们是**顶层非声明语句**，
//   `docs/progress-extract-movecheck.mjs` 的切片器**切不到**（memory `split-guard-blind-spots`
//   第 4 类）⇒ 守卫对它们**恒绿**。它们的逐字保真由**另一条独立脚本**核
//   （归一化工厂那层 +2 缩进、反向套完注入改写后与 REF 同区间逐字节比，残差 0）。
// ---------------------------------------------------------------------------
const {
  printShow, printOrders, previewShow, previewMode, previewTitle,
  openPrint, onOpenPrintMode,
} = useProgressPrint({
  page,
  selectedRows,
  searchText,
  message,
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
