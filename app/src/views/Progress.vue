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
       见 `useProgressQueryMore.ts` 里 `openMore`/`submitMore` 上方那两段、以及
       `useProgressColumns.ts` 里 `filteredRows` 上方那段（Task 7 起都在各自的新家）。
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
import { computed, onMounted, ref } from 'vue'
import {
  NAutoComplete,
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
import { api } from '../api/client'
// ⚠️ `ProgressRowDto` **只在模板里用**（模板 178 的 `:row-key="(r: ProgressRowDto) => r.id"`）——
//   脚本侧 Task 7 之后一处都没有了，但**不能从这行删掉**（删了就是模板绑定静默变空 /
//   `TS2552`）。脚本侧只数标识符节点的量法会把它记成「0 处使用」⇒ 必须配整文件纯文本搜（R46 ②）。
import type { ProcedureSlotDto, ProgressRowDto } from '../api/types'
import { loadOpenDirectionSettings } from '../composables/useOpenDirection'
import { useProgressColors } from '../composables/progress/useProgressColors'
import { useProgressColumns } from '../composables/progress/useProgressColumns'
import { useProgressDeleteRow } from '../composables/progress/useProgressDeleteRow'
import { useProgressExport } from '../composables/progress/useProgressExport'
import { useProgressHeader } from '../composables/progress/useProgressHeader'
import { useProgressPrint } from '../composables/progress/useProgressPrint'
import { useProgressQueryMore } from '../composables/progress/useProgressQueryMore'
import { useProgressStats } from '../composables/progress/useProgressStats'
import { useProgressToolbar } from '../composables/progress/useProgressToolbar'
import { useProgressUpdateDialog } from '../composables/progress/useProgressUpdateDialog'
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
 *     （`b ? K : K.filter(打单人 === 自己)`），本页**尚未实现**（理由见 `useProgressColumns.ts`
 *     里 `filteredRows` 上方那段（Task 7 起搬到了新家）：
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
 * 这里只接回**段外真的用到**的那几个（⚠️ **Task 7 起下面这四处读者里，`filteredRows` / `columns`
 * 已经在 `useProgressColumns.ts` 里了** —— 本块那 4 个名字现在是**喂给 P6 工厂**的，
 * 不再是「喂给壳里那两个 `computed`」；名字不变、调用点也不变，只是消费方换了文件）：
 *   · `colorKeyOf` —— `confirmOrderNoQuery`（查单号，P5 体内）与 `filteredRows`（颜色筛，P6）
 *   · `UNPRODUCED_KEY` —— `filteredRows`（P6）
 *   · `colorFilterOptions` —— `progressHeader` 的「颜色筛选」下拉（P5 体内）
 *   · `cellPad` / `progressCellStyle` —— `columns` 的 `cellProps`（P6）
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
//    `SEARCH_FIELDS` 是模块级常量，由那边 `export`。⚠️ **Task 7 起本文件不再 import 它** ——
//    唯一的消费者是 `filteredRows`（REF 1273），已随 **P6** 搬进 `useProgressColumns.ts`，
//    由那个新文件自己 import（理由与那 10 个单元格渲染函数同一条：谁用谁 import）。
//
// ⚠️ **调用点为什么在下面（`moreActive` 之后）而不在这个位置**：本块注入的 `moreRows`(REF 1456)
//   / `moreActive`(REF 1465) 属 **P8**、在 REF 里**排在本块之后** ⇒ 放在这里会**早读两个 TDZ
//   变量**（`TS2448`）。本块 7 个产出全部只在 `computed` 体内或模板里被读 ⇒ 后移对求值时机零影响。
//   其余 5 个注入项（`rows` `page` `message` / P2 的 `colorKeyOf` `colorFilterOptions`）
//   都在调用点之前早就声明好了。
// ---------------------------------------------------------------------------
/*
 * B3/B4 —— 筛选链 + 分页（旧版 `no`/`io`）与列定义（`pe` + 列数组），**连段首两行横幅、
 * 那段 25 行的旧版 §4.1 链路注释、以及 `// ── B4. 列定义…`**，2026-09-20 起整段搬进
 * `composables/progress/useProgressColumns.ts`（Progress 拆分 **P6**，纯搬迁、逐字未改）。
 *
 * ⚠️ **调用点没有留在这里**：它是下面 `useProgressColumns({…})` 那处（在 **P5 之后**）——
 *   本块注入面 30 项，其中 P8 / P5 / P7 / P3 的产出在 REF 里都排在本块之后 ⇒ 放回原位会
 *   早读一串 TDZ 变量（`TS2448`）。**P6 ↔ P7 还是一对环**（本块要 P7 的 `searchText` /
 *   `allSelected` / `toggleSelectAll`，P7 又要本块的 `filteredRows`）⇒ 环只能从 P7 那一侧
 *   用一层前向 `computed` 打破，理由写在那个调用点上（照破 P7↔P3 那个环的 thunk 同一手法）。
 *
 * ⚠️ 段外消费点（**一律写 REF 行号**：本文件行号会随后面每块搬走而漂）：
 *   · `filteredRows` —— **4 个接点**：壳 `load()`(383) · P7(1622×2/1630) · P10(1876/1899/1913/
 *     1924/1942/1961) · P11(2054/2075)，外加**模板 3 处**（167 / 170 / 316）；
 *   · `pageRows` —— **只被模板用**（模板 176 `:data="pageRows"`）；
 *   · `columns` —— **只被模板用**（模板 175 `:columns="columns"`；⚠️ 数这一处时别把
 *     属性名 `:columns` 也算成消费者 —— 裸名正则会虚增 1）；
 *   · `dateHeader` —— 段外 0、模板 0，**跟着块走**（它是 `columns` 第一列的列头辅助）。
 */

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
// ⚠️ 本块 **5 个注入项**：3 个**值**在这个位置早已声明（`rows` REF 364 / `load` REF 374 /
//   `message` REF 352）；第 4 个 `filteredRows`（REF 1250）与第 5 个 `openUpdateDialog`
//   （P3，REF 1640）都来自**下面** ⇒ 各靠一层迟求值的写法才敢这么排（前者见下面的 ⚠️、
//   后者是上面那层 thunk）。复量：
//   `git show f097a9b1:app/src/views/Progress.vue | grep -nE '^const rows|^const message|^async function load'`。
//   〔一律写 REF 行号 —— 本文件行号会随后面每块搬走而漂。〕
// ⚠️ **`filteredRows` 这一项从 Task 7（P6 搬走）起又是一层前向引用**：它现在由**下面**的
//   `useProgressColumns(...)` 产出（P6），而那个调用点**不可能**排到这里之前 ——
//   本块要 P7 的 `searchText`/`allSelected`/`toggleSelectAll`（P7 的产出），而 P8 要本块的
//   `searchText`、P5 要 P8 的 `moreRows`/`moreActive`、P6 又要 P5 的 6 个 ⇒
//   **P6 必须排在 P7→P8→P5 这条链之后**，而 P7 必须排在 P6 之前才拿得到 `filteredRows`
//   —— **P6 ↔ P7 是一对环**。打破方式与本块破 P7↔P3 同一个手法（一层迟求值的 thunk），
//   只是这里要的是个 `ComputedRef`，所以包成 `computed(() => …)`：
//   ⚠️ **为什么用 `computed` 包、而不是把 P7 的 `filteredRows` 形参改成 thunk**：后者要动
//     `useProgressToolbar.ts`（P7 在守卫里是逐字比的，形参一改就红）；`computed` 转发**一个别的
//     文件都不碰**，且与原对象给出**同一个值**、同一条依赖链（只多一个节点）⇒ 语义零变化。
// ⚠️ **7 个回传全部解构**（都有段外活读者 —— 少一个就是 `TS2304`，多一个就是死局部 `TS6133`）：
//   模板 `113`(`openBatchUpdate`) `114`(`selectedRows`) `126`(`refresh`)
//     `129`(`exporting` `searchText`) `138`/`166`/`167`(`searchText`)
//   + 脚本 `dateHeader`(`allSelected`/`toggleSelectAll` —— **Task 7 起这两处读者搬到了 P6**，
//     即下面 `useProgressColumns(...)` 的注入面，REF **1295/1296**)
//   + 脚本 C3 打印段(`selectedRows`，REF **1734/1759/1775**)。
//   〔一律写 REF 行号：本文件行号会随后面每块搬走而漂，写当前行号必然过期。〕
// ⚠️ `ExcelJSInterop` **走 `export` 不走 `return`**（它是模块级 `type`，工厂体内不能
//   `export`，R44）。Task 7 起本文件**不再 import 它**：P11 已搬进 `useProgressExport.ts`，
//   由那个新文件从本文件 `import type`（它段内只有 REF 2005 一处用它）。
// ---------------------------------------------------------------------------
const { exporting, searchText, selectedRows, refresh, allSelected, toggleSelectAll, openBatchUpdate } =
  useProgressToolbar({
    rows,
    // P6 ↔ P7 的环从这一侧打破（见上面的 ⚠️）：**前向** computed，箭头体迟求值。
    filteredRows: computed(() => filteredRows.value),
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
//   + `columns` 里的 `openUpdate(`（REF `f097a9b1`:**1326** —— Task 7 起那个 `columns` 在
//     `useProgressColumns.ts` 里，本文件把它喂给 P6 工厂，所以这个读者照旧在）。
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
//   其余 6 个**全部**是 **P6** `useProgressColumns` 的注入面（Task 7 之前它们的读者是壳里那份
//   `filteredRows` / `columns` —— 那两个 `computed` 与 P11 的 `exportTable` 都还在本文件里，
//   所以当时也是「有活读者」）：
//     `matchesOrderNoOption`(REF 1253/1346) `orderNoFilterValues`(1252/1348)
//     `orderNoQuery`(1260/1261) `colorFilter`(1254/1256/1258) `orderNoHeader`(1338)
//     `progressHeader`(1353)。
//   另 6 个（`columnFilterState` `orderNoInput` `orderNoPopShow` `orderNoRestoring`
//   `confirmOrderNoQuery` `clearOrderNoQuery`）**只在本块内部用 ⇒ 不解构**
//   （解构了就是死局部 `TS6133`；R54 实测它们段外 0 引用、模板 0 引用）。**别以为它们没用**。
//   〔脚本侧一律写 REF 行号：本文件行号会随后面每块搬走而漂。〕
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
// C. B3/B4 的调用点（**P6**，2026-09-20 搬进 `composables/progress/useProgressColumns.ts`）。
//
// ⚠️ **为什么在这里**：本块注入面 **30 项**，其中最晚的几个 —— P8 的 `moreActive`/`moreRows`、
//   P5 的 6 个（就在上面）、P7 的 `searchText`/`allSelected`/`toggleSelectAll`（本文件 532）、
//   P3 的 `openUpdate`（本文件 586）—— 在 REF 里都排在本块（1226）之后，或由后面的工厂产出
//   ⇒ 放回 B3 的原位置会**早读一串 TDZ 变量**（`TS2448`）。
//   **本块 3 个产出全部只在 `computed` 体内或模板里被读** ⇒ 后移对求值时机零影响
//   （与 P5 后移是同一条理由）。
// ⚠️ **P6 ↔ P7 是一对环**，从 P7 那一侧用一层前向 `computed` 打破 —— 见上面
//   `useProgressToolbar({…})` 的 ⚠️（那里写着为什么不能反过来动 P7 的形参）。
// ⚠️ **回传 3 项，一个不多一个不少**（4 个声明里真被段外消费的 3 个）：
//   · `filteredRows` —— **4 个接点 + 模板**：本壳 `load()`(REF 383) ·
//     上面 P7 的 `filteredRows:`(1622×2/1630) · 下面 P10 的 `useProgressStats`(1876/1899/1913/
//     1924/1942/1961) · 下面 P11 的 `exportTable`(2054/2075) · 模板 167/170/316。
//     ⚠️ 多一个就是死局部 `TS6133`，少一个就是 `TS2304`。
//   · `pageRows` —— **只被模板用**（模板 176 `:data="pageRows"`）；
//   · `columns` —— **只被模板用**（模板 175 `:columns="columns"`）。
//   ⚠️ `dateHeader` **不解构**：段外脚本 0、模板 0（它是 `columns` 第一列的列头辅助，
//     在 REF 1307 被 `columns` 自己用）—— 解构出来就是死局部 `TS6133`。
// ---------------------------------------------------------------------------
const { filteredRows, pageRows, columns } = useProgressColumns({
  rows,
  page,
  pageSize,
  openUpdate,
  confirmDeleteRow,
  UNPRODUCED_KEY,
  colorKeyOf,
  cellPad,
  progressCellStyle,
  searchText,
  allSelected,
  toggleSelectAll,
  moreActive,
  moreRows,
  matchesOrderNoOption,
  orderNoFilterValues,
  orderNoQuery,
  orderNoHeader,
  colorFilter,
  progressHeader,
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

// ---------------------------------------------------------------------------
// C1. 「统计数字」（`MOVE_FAN_NAMES` / `PING_SINGLE_DIRECTIONS` / `PING_DOUBLE_DIRECTIONS` /
//      `ALL_PING_DIRECTIONS` / `normDirection` / `moveFans` / `pingFans` / `lightWindows` /
//      `showerFans` / `others` / `dateRange` / `statsTail`，**连段首横幅与那 11 行块注释**）
//      已归位到 `composables/progress/useProgressStats.ts`
//      （Progress 拆分 **P10**，REF `f097a9b1`:1800–1983）。
// ⚠️ **调用点的位置**：本块**只注入 1 项** —— `filteredRows`（REF 1250 的 `computed`）。
//   Task 7 之前它在壳里，所以「原地不动」；**Task 7 把 P6 搬走之后 `filteredRows` 由上面的
//   `useProgressColumns(...)` 产出**，而那个调用点也在这条线之前 ⇒ **这行一个字不用改**
//   （解构名不变、`deps` 里的名字自动继续指向 P6 的回传）。
//   本块段外的**脚本**引用（6 处，全在 `exportTable` 里，REF 2055–2058）**全部排在本块之后**
//   ⇒ 也不需要提前。上面 `useProgressPrint(...)`（P9）那处同样不吃本块任何名字。
// ⚠️ **7 个回传里本块只解构 1 个**（`statsTail`）—— **不是 7 个**：
//   · 模板 1 个 —— `statsTail`（模板 REF 167 / 170）；
//   · 段外脚本 6 个（`moveFans` 2056 · `pingFans` 2056 · `lightWindows` 2057 · `showerFans` 2057 ·
//     `others` 2058 · `dateRange` 2055 同行两处）**全部只被 P11 的 `exportTable` 用**
//     ⇒ Task 7 起**由下面那处 `useProgressExport(...)` 从工厂结果里直接取**
//     （`progressStats.moveFans` …），**壳里不再解构它们** —— 解构了就是死局部（`TS6133`）。
//     ⚠️ 这正是「Task 7 才炸」的那一类：P11 没搬走之前它们在壳里有活读者，编译器不红。
//   〔一律写 REF 行号/模板行号：本文件行号会随后面每块搬走而漂。〕
// ⚠️ **另 5 个（`MOVE_FAN_NAMES` / `PING_SINGLE_DIRECTIONS` / `PING_DOUBLE_DIRECTIONS` /
//   `ALL_PING_DIRECTIONS` / `normDirection`）段外零引用** ⇒ **不解构**；它们仍在本块内部被用，
//   跟着本块搬走了 —— **不是删掉**。
// ⚠️ **为什么要「先接住工厂结果、再解构」**：下面的 `useProgressExport(...)` 要从中取 6 个统计量
//   ⇒ 需要一个能提前写下的名字指到本工厂的结果。语义与「直接解构」逐字等价
//   （与 P3 那处为了给 thunk 一个名字而先接住 `progressUpdateDialog` 同形）。
// ---------------------------------------------------------------------------
const progressStats = useProgressStats({ filteredRows })
const { statsTail } = progressStats

/*
 * C2. 「导出表格」（旧版 `z`，§4.6）—— 2026-09-20 起整段搬进
 * `composables/progress/useProgressExport.ts`（Progress 拆分 **P11**，纯搬迁、逐字未改），
 * **连段首横幅与它下面 13 行的块注释**（五条反直觉的照抄点）。
 *
 * ⚠️ **调用点的位置**：本块注入 P10 的 6 个统计量 ⇒ 必须排在 `useProgressStats(...)` 之后
 *   （放回 C2 原位会早读一串 TDZ 变量，`TS2448`）⇒ 只好「先接住工厂结果、再取那 6 个」
 *   （见上面那段 ⚠️）。其余 4 项（`filteredRows` P6 · `searchText`/`exporting` P7 · `message` 壳）
 *   都在本行之前早已就绪。
 * ⚠️ **回传 1 项**：`exportTable` —— **只被模板用**（模板 REF **129** 的 `@click="exportTable"`
 *   与同一行 `:loading="exporting"`）。
 *   ⚠️ **`exportStamp` 不回传、也不解构**：段外脚本 0、模板 0，它只被 `exportTable` 内部用
 *   （REF **2128**）⇒ 跟着本块走（解构出来就是死局部 `TS6133`）。
 * ⚠️ **`exporting` 继续留在上面 P7 那处解构**（模板 129 的 `:loading` 要用）——
 *   本块只是把它**写**进 `useProgressExport` 的 `deps` 里，别顺手从这里删掉。
 */
const { exportTable } = useProgressExport({
  filteredRows,
  searchText,
  exporting,
  message,
  dateRange: progressStats.dateRange,
  moveFans: progressStats.moveFans,
  pingFans: progressStats.pingFans,
  lightWindows: progressStats.lightWindows,
  showerFans: progressStats.showerFans,
  others: progressStats.others,
})
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
