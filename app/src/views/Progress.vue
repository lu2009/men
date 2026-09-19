<template>
  <!--
    生产进度（旧版 `/Progress`）。

    逆向：`docs/2026-09-19-progress-analysis.md`（前端）、`-server.md`（服务端）、`-shell.md`（外壳/看板）。

    ## 本文件进展

    - 第一刀：骨架 —— 路由 / 导航项 / 拉全量数据 / **PC 14 列** / 分页（100 每页，可选 [10,20,50,100,200]）。
    - 第二刀：**单元格保真** + **列头交互**（`va()` 渲染 / 颜色 / 表头筛 / 查单号 / 颜色筛选）。
    - 第三刀：**工具条 + 统计行**（旧版 `search-row`，§2.2 / §5.4）+ **导出表格**（§4.6）。
    - 第四刀（本笔）：**行内「删除」**（§4.3）—— 日期列那颗红字链接补齐（「更新进度」上一刀已做）。

    ## ⏳ 还没做（按旧版顺序，各自独立可验）

    1. ~~**工具条**~~ ✅ **已做（本笔）**：打印选项 / 批量更新(n) / 查询更多 / 生产分析 / 刷新 /
       导出表格 / 搜索框 / 统计行。⚠️ 其中三颗的**目标 UI 还没做**（见下面 2/3/5），
       它们做成「**置灰 + 点了给提示**」而不是死链；「批量更新」按旧版条件（已选 > 1）渲染，
       本页还没有勾选 UI ⇒ 现在**恒不出现**（与旧版「没勾选时」的表现一致）。
    2. **打印抽屉**（旧版 §4.5：标签 / 生产标签 / 料标签 / 生产单 / … / 收据单 共 12 类）
       —— 「打印选项」那颗按钮的目标 UI。
    3. **更多查询对话框**（旧版 `Lo`）—— 「查询更多」那颗按钮的目标 UI。
       要**先补后端**（`getMoreProgress` / `getClientsInfo`，见 §3.1）；
       它同时会引入旧版的 `Bo`/`xo`（查询结果集生效标志），`filteredRows` 里已留了说明。
    4. **行内动作**：「更新进度」✅ 已做（弹窗拼 `工序名_操作员_日期` → `POST /v1/progress/update`）；
       「删除」✅ 已做（本笔，§4.3 —— 确认框 → `DELETE /v1/orders/{id}/lines/{lineId}`，见 `confirmDeleteRow`）；
       **「日期」列的行勾选 checkbox** ⏳ 未做（「批量更新」依赖它）。
    5. **生产分析看板**（echarts，5 KPI + 4 饼图 + 趋势 + 4 个统计 tab）
       ⚠️ 它**不是**我们已有的 `DashboardBigScreen`，指标得重写
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

      ⚠️ 三颗按钮的**目标 UI 本版还没做**（打印抽屉 / 更多查询对话框 / 生产分析看板）——
         按本项目对死链的态度做成「**置灰 + 点了给提示**」（机制见 `notYet()` 的注释）。

      ⚠️ 「批量更新」**连按钮都不渲染**（不是置灰）—— 依据是 §2.2 表格第 2 行给的出现条件
         「`已选条数 > 1` 且 PC 模式」（`ea = te.ping_hui.length + te.diao_hui.length`）：
         本页还没有行勾选 UI（文件头 ⏳4）⇒ 已选恒为 0 ⇒ **按旧版口径它此刻本来就不该出现在屏幕上**，
         置灰反而会多出一颗旧版此时不会有的按钮。
         这里仍把 `v-if` 条件与文案照旧版写上（今天恒假），等勾选列落地即可自动生效。
    -->
    <div class="search-row">
      <n-tooltip>
        <template #trigger>
          <!-- ⚠️ 提示语是**给厂里用人看的**，别往里塞 `§`/函数名这类文档记号（那些写在代码注释里） -->
          <span class="pending-slot" @click="notYet('打印选项', '标签 / 生产单 / 玻璃合片单 / 收据单等打印')">
            <n-button type="primary" disabled>打印选项</n-button>
          </span>
        </template>
        打印抽屉本版还没做
      </n-tooltip>

      <n-tooltip v-if="selectedRows.length > 1">
        <template #trigger>
          <span class="pending-slot" @click="openBatchUpdate">
            <n-button type="warning" disabled>批量更新 ({{ selectedRows.length }})</n-button>
          </span>
        </template>
        批量更新本版还没做（要先有行勾选）
      </n-tooltip>

      <!-- 「查询更多」旧版恒出现（§2.2 表格第 3 行）。⚠️ 它要的**后端也没有**：
           `getMoreProgress` / `getClientsInfo` 在新版后端**不存在**（见 §3.1 与文件头 ⏳3），
           所以这颗要落地得前后端一起补，不是只差一个弹窗组件。 -->
      <n-tooltip>
        <template #trigger>
          <span class="pending-slot" @click="notYet('查询更多', '按客户 / 安装地址 / 日期范围查询')">
            <n-button type="primary" disabled>查询更多</n-button>
          </span>
        </template>
        更多查询本版还没做
      </n-tooltip>

      <n-tooltip>
        <template #trigger>
          <span class="pending-slot" @click="notYet('生产分析', '生产分析看板（KPI / 饼图 / 趋势 / 分客户业务员工序型材统计）')">
            <n-button type="primary" disabled>生产分析</n-button>
          </span>
        </template>
        生产分析看板本版还没做
      </n-tooltip>

      <n-button type="success" :loading="loading" @click="refresh">刷新</n-button>

      <!-- 旧版：只有搜索词/更多查询条件非空（`zo`）时才出现 -->
      <n-button v-if="searchText" type="warning" :loading="exporting" @click="exportTable">导出表格</n-button>

      <n-input
        v-model:value="searchText"
        class="search-input"
        clearable
        placeholder="输入关键词搜索（可用空格分隔多个关键词）"
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

    <!-- 更新进度（旧版行内那颗链接开的弹窗） -->
    <n-modal v-model:show="updOpen" preset="card" title="更新进度" style="width: 420px" :bordered="false">
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
import { computed, h, onMounted, ref, watch } from 'vue'
import type { VNodeChild } from 'vue'
import type { Workbook as ExcelJSWorkbook } from 'exceljs'
import {
  NButton,
  NDataTable,
  NInput,
  NModal,
  NPagination,
  NPopover,
  NSelect,
  NTooltip,
  useDialog,
  useMessage,
} from 'naive-ui'
import type { DataTableColumn, DataTableFilterState } from 'naive-ui'
import { api } from '../api/client'
import type { ProcedureSlotDto, ProgressRowDto } from '../api/types'
import { getOriginalOpenDirection, loadOpenDirectionSettings } from '../composables/useOpenDirection'

const message = useMessage()
// 行内「删除」的二次确认（旧版是 `ElMessageBox.confirm`，同 Hui/Home 的做法用 `dialog.warning`）。
const dialog = useDialog()

const rows = ref<ProgressRowDto[]>([])
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
    rows.value = r?.progressData ?? []
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

// ===== 更新进度 =====
// 旧版是行内那颗「更新进度」链接开的弹窗；值是三段拼的 `工序名[_操作员]_YYYY-MM-DD`。
// ⚠️ 服务端**不校验**这个格式（它只当字符串存），拼错了也是自己负责。
const updOpen = ref(false)
const updSaving = ref(false)
const updTarget = ref<ProgressRowDto | null>(null)
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

function openUpdate(r: ProgressRowDto) {
  updTarget.value = r
  updSlot.value = null
  updOperator.value = ''
  updDate.value = today()
  updOpen.value = true
}

async function submitUpdate() {
  const r = updTarget.value
  if (!r || !updSlot.value || !updValue.value) return
  updSaving.value = true
  try {
    await api.updateProgress([r.id], updSlot.value, updValue.value)
    updOpen.value = false
    message.success('进度已更新')
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

// ═══════════════════════════════════════════════════════════════════════════
// A. 单元格保真
// ═══════════════════════════════════════════════════════════════════════════
/*
 * 下面这堆 helper 全部对应旧版 `Progress-fb4def35.js` 里的**静态 VNode props 对象**，
 * 类名逐字照抄（旧版 CSS `Progress-4dee25cf.css` 的 `[data-v-95ebc180]` 段）：
 *
 *   `.glass-inputs-container`  `display:flex;flex-direction:column;gap:5px;width:100%`
 *   `.glass-inputs-container2` 同上，但 `gap:-3px`（负值，旧版原样，别"修"）
 *   `.glass-input-group`       `display:flex;align-items:center;gap:4px`
 *   `.glass-input-label`       `font-size:11px;white-space:nowrap;color:#1302fa`（小蓝标签）
 *   `.glass-input`             `flex:1`
 *
 * ⚠️ 别拿 `components/DetailLinesTable.vue` 的 `cCol`/`sub` 直接套 —— 那边是 **Hui 的可编辑表格**，
 *    标签（`型材：`/`底玻：`…）是**每格都写死**的。本页旧版**不是**：
 *      · 「型材/颜色」格**没有任何标签**（表头已经写了）；
 *      · 「玻璃」格的标签是 `数量：`（值取 `数量`，不是玻璃厚）—— 三行只有这一行有标签；
 *      · 「下轨道/套线」的标签是 `.glass-input-group` 的**兄弟节点**，不在组内。
 *    这些都是逐字读出来的（`label:"玻璃"` / `label:"下轨道/套线"` 那几段 render），不是笔误。
 */

/** `div.glass-inputs-container`（纵向，gap 5px）。 */
const gContainer = (...vs: VNodeChild[]) => h('div', { class: 'glass-inputs-container' }, vs)
/** `div.glass-inputs-container2`（旧版 `gap:-3px`）。 */
const gContainer2 = (...vs: VNodeChild[]) => h('div', { class: 'glass-inputs-container2' }, vs)
/** `div.glass-input-group`（横排：标签 + 值）。 */
const gGroup = (...vs: VNodeChild[]) => h('div', { class: 'glass-input-group' }, vs)
/** `div.glass-input-label`（**小蓝标签**，`#1302fa`）。 */
const gLabel = (text: string) => h('div', { class: 'glass-input-label' }, text)
/** 裸值 `<span>`（旧版格内绝大多数值就是这个，**空就是空 span**，没有 `—`）。 */
const gSpan = (v: unknown) => h('span', null, v == null ? '' : String(v))
/** 有值才渲染（旧版格内大量 `v-if`）。 */
const gMaybe = (v: unknown, node: VNodeChild) => (v ? node : null)

/** 单值格（客户/单号/打单人/业务员）：空值给 `—` —— **这一处是我们加的**，旧版是空 span。 */
const line = (v: unknown) => h('div', { class: 'cell-line' }, v == null || v === '' ? '—' : String(v))

// ── A1. `va()`：生产进度串的渲染口径（旧版 `va`，§5.2）──────────────────────
/*
 * 旧版原文（逐字）：
 *
 *   va = e => {
 *     if (!e || e.trim() === '') return ''
 *     if (!e.includes('➞')) {
 *       if (e.includes('_')) { 拆 '_' → 前段 + '_' + <span 红15粗>(末段)</span> }
 *       return e                                     // 没有 '_' ⇒ 原样返回
 *     }
 *     const segs = e.split('➞'); const dated = []; const out = []
 *     segs.forEach((seg, i) => {
 *       if (seg.match(/\d{4}-\d{2}-\d{2}/)) { dated.push({part:seg, date, index:i}); out.push(seg) }
 *       else if (seg.includes('_')) { 前段 + '_' + <红>(末段)</红> }
 *       else { out.push(<红>整段</红>) }
 *     })
 *     if (dated.length > 0) {
 *       日期全同 ⇒ 把**最后一段**带日期的整个 part 换成 <红>part</红>
 *       否则     ⇒ 把**日期最大**的那一段整个 part 换成 <红>part</红>
 *     }
 *     return out.join('➞')
 *   }
 *
 * 三处**容易读错**的地方（我按原文核过，不是推断）：
 *  ① 带日期的段**先原样入 `out`**，最后只把**中选那一段**整个换掉 ——
 *     所以红的是 `工序名_操作员_2026-09-19` **整段**（含日期），**不是**只红末段；
 *     而**不带日期**的段红的**只是 `_` 之后那截**。
 *  ② `dated.every(...)` 比的是 `getTime()`；全同时取**下标最大的那一段**（不是最后一个 `dated` 元素？——
 *     是同一个，因为 `dated` 按出现顺序 push，所以 `dated[dated.length-1].index` 就是最后一段）。
 *  ③ 位置用 `index` 回写 `out` —— `out` 与 `segs` 一一对应，所以 `index` 直接可用。
 *  ④ 兜底：整串**不含** `➞` 且**不含** `_` ⇒ 原样（不标红）。含 `_` 才把末段标红。
 *
 * ⚠️ **唯一有意偏离**：旧版把结果直接塞进 `innerHTML`（`v-html` 同款），**不转义**。
 *    工序名/操作员是租户自己录的数据，但仍是从库里读出来的字符串 ⇒ 这里**转义非红色部分**，
 *    只拼我们自己造的 `<span>`。真实数据里不含 `<`/`>`/`&` 时，渲染结果与旧版**逐字节相同**。
 */
const RED_STYLE = 'color: red; font-size: 15px; font-weight: bold;'
const redSpan = (s: string) => `<span style="${RED_STYLE}">${s}</span>`
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const DATE_RE = /\d{4}-\d{2}-\d{2}/

/** 把 `_` 分隔的段渲染成「前段 + `_` + <红>末段</红>」；前段为空就整段红。 */
function splitUnderscore(seg: string): string {
  const parts = seg.split('_')
  const last = parts[parts.length - 1]
  const head = parts.slice(0, -1).join('_')
  return head ? escapeHtml(head) + '_' + redSpan(escapeHtml(last)) : redSpan(escapeHtml(last))
}

function va(input: unknown): string {
  const s = typeof input === 'string' ? input : input == null ? '' : String(input)
  if (!s || s.trim() === '') return ''
  if (!s.includes('➞')) {
    if (s.includes('_')) return splitUnderscore(s)
    return escapeHtml(s)
  }
  const segs = s.split('➞')
  const dated: { part: string; date: number; index: number }[] = []
  const out: string[] = []
  segs.forEach((seg, i) => {
    const m = seg.match(DATE_RE)
    if (m) {
      dated.push({ part: seg, date: new Date(m[0]).getTime(), index: i })
      out.push(escapeHtml(seg))
    } else if (seg.includes('_')) {
      out.push(splitUnderscore(seg))
    } else {
      out.push(redSpan(escapeHtml(seg)))
    }
  })
  if (dated.length > 0) {
    if (dated.every((d) => d.date === dated[0].date)) {
      const last = dated[dated.length - 1]
      out[last.index] = redSpan(escapeHtml(last.part))
    } else {
      const max = dated.reduce((a, b) => (b.date > a.date ? b : a))
      out[max.index] = redSpan(escapeHtml(max.part))
    }
  }
  return out.join('➞')
}

/** 「生产进度」格 **只有非空才渲染**（旧版 `v-if="row.生产进度"`）。 */
const progressCell = (r: ProgressRowDto) =>
  r['生产进度']
    ? h('span', {
        // 旧版 `:class="{'progress-paid': 生产进度.includes('回款')}"`（`.progress-paid{color:red;font-weight:700}`）
        class: { 'progress-paid': r['生产进度'].includes('回款') },
        innerHTML: va(r['生产进度']),
      })
    : null

// ── A2. 别的小格（结构照旧版 render 逐字抄）───────────────────────────────

/** 「备注」：`地址：` 是 `.glass-input-label`，且**只在安装地址非空时**才渲染。 */
const remarkCell = (r: ProgressRowDto) =>
  gContainer(
    gGroup(gMaybe(r['安装地址'], gLabel('地址：')), gSpan(r['安装地址'])),
    gGroup(gSpan(r['备注'])),
  )

/** 「型材/颜色」：**两行都没有标签**（旧版 `label:"型材/颜色"` 那段就是裸 span）。 */
const profileColorCell = (r: ProgressRowDto) =>
  gContainer2(gGroup(gSpan(r.profile)), gGroup(gSpan(r.color)))

/**
 * 「玻璃」：底玻 / 面玻 两行裸值，第三行的标签是 `数量：`（值 = `数量`）。
 * ⚠️ 旧版就是 `数量：` + `row.数量`（**不是**玻璃厚）—— 逐字读出来的，别"顺手改对"。
 */
const glassCell = (r: ProgressRowDto) =>
  gContainer(gGroup(gSpan(r.bottom_glass)), gGroup(gSpan(r.face_glass)), gGroup(gLabel('数量：'), gSpan(r.quantity)))

/** 「扇数/开向」：扇数**有才渲染**，开向恒渲染。 */
const fansDirectionCell = (r: ProgressRowDto) =>
  gContainer(gGroup(gMaybe(r.fans, gSpan(r.fans))), gGroup(gSpan(r.direction)))

/**
 * 「下轨道/套线」的轨道行标签（旧版 `Re`）：
 * `null !== 吊脚 && "" !== 吊脚 ? "锁具：" : "轨道："`。
 *
 * ⚠️ 这个判据有个 **JS 陷阱**：`undefined !== null` 为**真** ⇒ 旧版里**字段缺失**也判成「锁具：」。
 *    新版 `jiao` 是**非空数字**（后端 `f64`，缺省 0）⇒ 照字面写就恒为「锁具：」，
 *    与旧版「door_specs JSON 里没有吊脚 ⇒ undefined ⇒ 锁具」的结果**一致**。
 *    保留字面写法，不"修正"成 `!= null`（那会把结果改反）。
 *    另：Column 是 `2轨2扇` 这类**串**时旧版也会命中（`"" !== "2轨2扇"`）。
 */
function trackRowLabel(r: ProgressRowDto): string {
  const j = r.jiao as unknown
  return j !== null && j !== undefined && j !== '' ? '锁具：' : '轨道：'
}

/**
 * 「下轨道/套线」：⚠️ 两个标签都是 `.glass-input-group` 的**兄弟节点**（不在组内），
 * 旧版就是这么摆的（`Je` 容器的直接子节点序列：label → group → label → group）。
 */
const trackCasingCell = (r: ProgressRowDto) =>
  gContainer2(
    gMaybe(r.track, gLabel(trackRowLabel(r))),
    gGroup(gSpan(r.track)),
    gMaybe(r.casing, gLabel('套线：')),
    gGroup(gSpan(r.casing)),
  )

/**
 * 「门洞尺寸」：高度 / 宽度（钻石型材 → `左宽：`）/ 母门宽（子母型材 → 渲染 `轨道长`）/
 * 墙厚（钻石 → `门宽：`）/ 洞尺（有才渲染，**无标签**）。
 */
const doorSizeCell = (r: ProgressRowDto) => {
  const diamond = !!r.profile && r.profile.includes('钻石')
  return gContainer(
    gGroup(gLabel('高度：'), gSpan(r.door_height)),
    gGroup(gLabel(diamond ? '左宽：' : '宽度：'), gSpan(r.door_width)),
    // 旧版：`型材.includes('子母')` 才渲染这一行，且值是 `轨道长`（标签写的是「 母门宽: 」，前后带空格）
    gMaybe(
      !!r.profile && r.profile.includes('子母'),
      gGroup(gLabel(' 母门宽: '), gSpan(r.track_length)),
    ),
    gGroup(gLabel(diamond ? '门宽：' : '墙厚：'), gSpan(r.wall_thickness)),
    gMaybe(r['洞尺'], gGroup(gSpan(r['洞尺']))),
  )
}

/**
 * 「亮窗信息」：亮窗总高（钻石 → `右宽：`，**整行有才渲染**）/ 亮窗数量 / 封板高（>0 才渲染）。
 * ⚠️ 后两组的 label 与 group 也是**兄弟**（与「下轨道/套线」同款）。
 */
const lightWindowCell = (r: ProgressRowDto) => {
  const diamond = !!r.profile && r.profile.includes('钻石')
  return gContainer2(
    gGroup(
      gMaybe(r.light_window_height, gLabel(diamond ? '右宽：' : '亮窗总高：')),
      gMaybe(r.light_window_height, gSpan(r.light_window_height)),
    ),
    gMaybe(r.light_window_count, gLabel('亮窗数量：')),
    gGroup(gMaybe(r.light_window_count, gSpan(r.light_window_count))),
    gMaybe(r['封板高'] > 0, gLabel('封板高：')),
    gGroup(gMaybe(r['封板高'] > 0, gSpan(r['封板高']))),
  )
}

/** 「金额」：`金额：` / `平方数：` 两个标签 + 各自的值（值那侧还多套一层 `div`，旧版原样）。 */
const amountCell = (r: ProgressRowDto) =>
  gContainer2(
    gLabel('金额：'),
    gGroup(gSpan(r.amount)),
    gLabel('平方数：'),
    gGroup(h('div', null, gSpan(r.square))),
  )

// ═══════════════════════════════════════════════════════════════════════════
// B. 颜色口径（旧版 §5.3 的 `J` / `R` / `re` / `$`）
// ═══════════════════════════════════════════════════════════════════════════
/*
 * ★ 颜色来源**与旧版不同**：
 *   旧版 `procedure_name_color_map` = localStorage 里的 `{工序名: 颜色}`，全局键、按**名字**存；
 *   新版 = `GET /v1/procedures` 的 `slots[].color`（迁移 `0022`），按 **slot** 存。
 *   ⇒ 本页**不读写任何 localStorage**。
 *   ⇒ 匹配仍然按**工序名**（进度串里只有名字），所以要先摊成 `名字 → 颜色`。
 *     好处（旧版没有的）：改名不丢色（颜色挂在 slot 上）。
 */
const UNPRODUCED_KEY = '__unproduced__'
/** 旧版 `F`：去空白 + 小写。颜色键统一用它归一化。 */
const normColor = (c: string) => (c || '').replace(/\s+/g, '').toLowerCase()
const EMPTY_COLOR = '#b71c1c'

/** 点了颜色筛但**颜色表里没命中**时，旧版按关键词兜底（与配置无关，照抄）。 */
const BUILTIN_COLORS: [string, string][] = [
  ['#90EE90', '发货/收据单/回款'],
  ['#FFC0CB', '标签'],
  ['#87CEEB', '玻璃订单'],
  ['#FFFF99', '生产单'],
  ['#FFA500', '自助下单'],
]

/** 名字 → 颜色（名和色都 trim 后非空才收；旧版 `procedure_name_color_map` 的写入侧也是这个规则）。 */
const nameColorMap = computed(() => {
  const m = new Map<string, string>()
  for (const p of procedures.value) {
    const name = (p.name || '').trim()
    const color = (p.color || '').trim()
    if (name && color) m.set(name, color)
  }
  return m
})

const slotNo = (slot: string) => {
  const m = slot.match(/(\d+)/)
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY
}

/**
 * 工序名列表，**按槽号从大到小** —— 这是旧版 `procedure_name_order_list` 的**等价物**。
 *
 * ⚠️ **旧版那个 localStorage 键新版不存在**（`docs/2026-09-19-qrscanner-analysis.md` §4.3：
 *    它是 `/Qrscanner` 保存时写的 `[工序名,…]`，**按槽号升序、且不含工序10**）。旧版 `J()` 的用法是
 *    「**从后往前**找第一个 `进度串.includes(名字)`」⇒ 等价于「**按槽号从高到低**找第一个命中的名字」。
 *    所以这里直接把 `procedures` 按槽号**降序**排 —— 与旧版 order_list 的实际效果一致，
 *    且**不排掉工序10**（新版已去掉「回款→工序10」的全部特判，见文件头「有意偏离」）。
 *
 *    旧版在 order_list **为空**时还有一条「取日期最大那一段再按名字长度倒序匹配」的退路 ——
 *    这里保留（`latestSegment`），只是新版有工序名时走不到它。
 */
const orderedProcedureNames = computed(() =>
  procedures.value
    .filter((p) => (p.name || '').trim())
    .slice()
    .sort((a, b) => slotNo(b.slot) - slotNo(a.slot))
    .map((p) => p.name.trim()),
)

/**
 * 旧版 `J()` 里那条退路用的辅助：取「日期最大的那一段」（日期全同取最后一段，都没日期也取最后一段）。
 * 空串/无段返回 `''`。
 */
function latestSegment(text: string): string {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t) return ''
  if (!t.includes('➞')) return t
  const segs = t
    .split('➞')
    .map((x) => x.trim())
    .filter(Boolean)
  if (segs.length === 0) return ''
  const dated = segs
    .map((part, index) => {
      const m = part.match(DATE_RE)
      return m ? { index, part, date: new Date(m[0]).getTime() } : null
    })
    .filter((x): x is { index: number; part: string; date: number } => !!x)
  if (dated.length === 0) return segs[segs.length - 1]
  if (dated.every((d) => d.date === dated[0].date)) return dated[dated.length - 1].part
  return dated.reduce((a, b) => (b.date > a.date ? b : a)).part
}

/** 旧版 `J()`：按配置表解析出**原始**颜色（没命中返回 `null`）。 */
function resolveConfiguredColor(text: string): string | null {
  const names = orderedProcedureNames.value
  if (names.length > 0) {
    // 「从后往前找第一个命中」⇒ 上面已经按槽号降序排好了，正序扫即可
    for (const n of names) {
      const c = nameColorMap.value.get(n)
      if (c && text.includes(n)) return c
    }
    return null
  }
  // 退路：一个工序名都没配 ⇒ 取「日期最大那一段」，颜色表的 key 按**长度倒序**匹配
  const seg = latestSegment(text)
  if (!seg) return null
  const keys = [...nameColorMap.value.keys()].sort((a, b) => b.length - a.length)
  for (const k of keys) if (seg.includes(k)) return nameColorMap.value.get(k) || null
  return null
}

/** 旧版 `R()`：**归一化**的颜色键；空串 → `#b71c1c`；都没命中 → `''`。 */
function colorKeyOf(text: unknown): string {
  const s = typeof text === 'string' ? text.trim() : text == null ? '' : String(text).trim()
  if (!s) return normColor(EMPTY_COLOR)
  const c = rawColorOf(s)
  return c ? normColor(c) : ''
}

/** 旧版 `R()`/`re()` 共用的「原始颜色」解析（配置表 → 5 个关键词兜底 → 空）。 */
function rawColorOf(s: string): string {
  const hit = resolveConfiguredColor(s)
  if (hit) return hit
  if (s.includes('发货')) return '#90EE90'
  if (s.includes('收据单') || s.includes('回款')) return '#90EE90'
  if (s.includes('标签')) return '#FFC0CB'
  if (s.includes('玻璃订单')) return '#87CEEB'
  if (s.includes('生产单')) return '#FFFF99'
  if (s.includes('自助下单')) return '#FFA500'
  return ''
}

/**
 * 旧版 `re()`：**整格**的样式（不是内容）——
 * 空进度 ⇒ 红底白字粗体；命中 ⇒ 该色底 + 粗体；都没命中 ⇒ 只有 `padding`。
 * ⚠️ 旧版挂在 `el-table` 的 `cell-style`，只对「生产进度」列生效 ⇒ 这里走 naive 的 `cellProps`。
 */
function progressCellStyle(text: unknown) {
  const s = typeof text === 'string' ? text.trim() : text == null ? '' : String(text).trim()
  if (!s) return { backgroundColor: EMPTY_COLOR, color: '#fff', fontWeight: 'bold' }
  const c = rawColorOf(s)
  return c ? { backgroundColor: c, fontWeight: 'bold' } : {}
}

/** 旧版 `ue`：**所有**格都拿 `padding:1px`；「生产进度」再叠底色。 */
const cellPad = () => ({ style: { padding: '1px' } })

/**
 * 旧版 `$`（「颜色筛选」下拉项）：`未生产` + 5 个内置关键词色 + **颜色表里出现过的颜色**，
 * 同色合并、`label` = 该色下所有工序名用 `' / '` 连接（去重、按加入顺序）。
 *
 * ★ 第 2 项的来源改了：旧版从 localStorage 的 `procedure_name_color_map` 取，
 *   新版从 `GET /v1/procedures` 的 `slots[].color` 取（配置在 `/Qrscanner` 的「设置工序」里改）。
 */
const colorFilterOptions = computed(() => {
  const map = new Map<string, { color: string; labels: Set<string> }>()
  const add = (color: string, label: string) => {
    const c = (color || '').trim()
    const n = (label || '').trim()
    if (!c || !n) return
    const k = normColor(c)
    if (!k) return
    if (!map.has(k)) map.set(k, { color: c, labels: new Set() })
    map.get(k)!.labels.add(n)
  }
  for (const [c, l] of BUILTIN_COLORS) add(c, l)
  for (const p of procedures.value) add(p.color, p.name)
  return [
    { colorKey: UNPRODUCED_KEY, color: '#f44336', label: '未生产' },
    ...[...map.entries()].map(([k, v]) => ({
      colorKey: k,
      color: v.color,
      label: [...v.labels].join(' / '),
    })),
  ]
})

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
  let pool = rows.value
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
 *    `Bo` 置回 `false`，退回全量 `oo`）。本版「查询更多」还没做 ⇒ 这里没有 `Bo`/`xo` 这一层，
 *    搜索永远作用在 `oo`（= 本页的 `rows`）上。等 ⏳「查询更多」落地时要把它补回来。
 */
const filteredRows = computed(() => {
  let list = rows.value
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

// ── B4. 列定义 ────────────────────────────────────────────────────────────
const columns = computed<DataTableColumn<ProgressRowDto>[]>(() => [
  // 1 日期（旧版这一格还有行内 checkbox —— 未做，见文件头 ⏳4）
  {
    title: '日期',
    key: '日期',
    width: 150,
    fixed: 'left',
    cellProps: cellPad,
    render: (r) =>
      h('div', { class: 'cell-col' }, [
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
 * 「批量更新」的显隐与计数只用到前两个数组的长度和（`ea`）。
 * ⚠️ **本页还没有行勾选 UI**（旧版那个 checkbox 在「日期」列里，属于文件头 ⏳4），
 *    所以这里恒为空数组 ⇒ 那颗按钮现在恒不出现。**不要**为了让它出现而写死一个假计数。
 */
const selectedRows = ref<ProgressRowDto[]>([])

/** 旧版 `pa()`：重拉数据 + **清空勾选**（`Ta()` + 逐个 `isSelected=false` + 重置 `te`）。 */
async function refresh() {
  selectedRows.value = []
  await load()
}

/**
 * 三颗「目标 UI 本版还没做」的按钮的点击反馈（置灰 + 给提示，**不做死链**）。
 *
 * ⚠️ 为什么要有外层 `span`：`<button disabled>` 在 Chrome 里**根本不派发 click**
 *    （事件被浏览器吞掉），所以监听挂在 button 上是收不到的。
 *    模板里把 button 设成 `pointer-events: none`（见 `.pending-slot` 的样式），
 *    命中测试就落到这个 span 上 ⇒ 点得到、也提示得到。
 */
function notYet(name: string, what: string) {
  message.info(`「${name}」本版还没做：${what}`)
}

/**
 * 「批量更新」的入口（旧版 `ta`）。
 * 按钮现在恒不出现（见 `selectedRows` 的注释），走到这里只可能是将来补了勾选列但没接弹窗。
 */
function openBatchUpdate() {
  notYet('批量更新', '要先勾选多行，且批量弹窗本版还没做')
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
/*
 * 「本版还没做」的按钮外层的可点容器（见 `notYet()` 的注释）：
 * 里面那颗 button 是 `disabled` 的，Chrome **不会**从它派发 click ⇒ 用 `pointer-events:none`
 * 把它从命中测试里摘出去，事件就落到这个 span 上。`cursor: not-allowed` 也得挪到这儿来
 * （button 自己收不到 hover 了）。
 */
.pending-slot {
  display: inline-flex;
  cursor: not-allowed;
}
.pending-slot :deep(button) {
  pointer-events: none;
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
