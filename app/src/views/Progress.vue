<template>
  <!--
    生产进度（旧版 `/Progress`）。

    逆向：`docs/2026-09-19-progress-analysis.md`（前端）、`-server.md`（服务端）、`-shell.md`（外壳/看板）。

    ## 本文件进展

    - 第一刀：骨架 —— 路由 / 导航项 / 拉全量数据 / **PC 14 列** / 分页（100 每页，可选 [10,20,50,100,200]）。
    - 第二刀（本笔）：**⏳3 单元格保真** + **⏳2 列头交互**。

    ## ⏳ 还没做（按旧版顺序，各自独立可验）

    1. **工具条**：打印选项 / 批量更新 / 查询更多 / 生产分析 / 刷新 / 导出表格 / 搜索框 + 统计行
       （旧版 `search-row`，见 §2.2）
    4. **行内动作**：「更新进度」✅ 已做（弹窗拼 `工序名_操作员_日期` → `POST /v1/progress/update`）；
       「删除」⏳ 未做
    5. **生产分析看板**（echarts，5 KPI + 4 饼图 + 趋势 + 4 个统计 tab）
       ⚠️ 它**不是**我们已有的 `DashboardBigScreen`，指标得重写
    6. **终端模式**（10 列）—— **本版不做**：旧版那条接口在服务端是写死 400，路本来就是坏的

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
    <div class="toolbar">
      <n-button size="small" :loading="loading" @click="load">刷新</n-button>
      <span class="grow-spacer" />
      <span class="count">共 {{ filteredRows.length }} 条</span>
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
import { computed, h, onMounted, ref } from 'vue'
import type { VNodeChild } from 'vue'
import {
  NButton,
  NDataTable,
  NInput,
  NModal,
  NPagination,
  NPopover,
  NSelect,
  useMessage,
} from 'naive-ui'
import type { DataTableColumn, DataTableFilterState } from 'naive-ui'
import { api } from '../api/client'
import type { ProcedureSlotDto, ProgressRowDto } from '../api/types'

const message = useMessage()

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
 *    —— **不含**搜索框那一步（本页还没做搜索框，见文件头 ⏳1）。
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

// ── B3. 筛选链 + 分页 ─────────────────────────────────────────────────────
/*
 * 旧版 §4.1 的链路：`K2`（原始）→ `oo` → `no`（最终）→ `io`（当页切片）。
 * 本页目前只做链里的三步（其余几步属于文件头 ⏳1 的工具条）：
 *
 *   `oo`（只看自己打单的行）—— 旧版 `b2 ? K2 : K2.filter(打单人 === 自己)`。
 *     ⚠️ 新版**还没做**：它依赖 `userinfo.registrant/name` 这套账号字段，
 *        旧版 §10 明确「`defaulted` 我们不复制，账号类型映射等做权限那一步再定」。
 *        这里先跳过，等权限那一步补 —— **不要**用「当前登录名」凑一个近似值。
 *   `ia` 单号列筛 → `Z2` 颜色筛 → `Va` 查单号前缀（**顺序照旧版**）
 *
 * ⚠️ 与 Home 同款的**有意偏离**：旧版的列头筛发生在分页切片**之后**（只筛当前页、总数不含它），
 *    新版把三步都并进 `filteredRows` ⇒ **全量筛选、总数跟随**。
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
  return list
})

const pageRows = computed(() =>
  filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)

// ── B4. 列定义 ────────────────────────────────────────────────────────────
const columns = computed<DataTableColumn<ProgressRowDto>[]>(() => [
  // 1 日期（旧版这一格还有行内 checkbox 与「更新进度/删除」两个链接 —— 见文件头 ⏳4）
  {
    title: '日期',
    key: '日期',
    width: 150,
    fixed: 'left',
    cellProps: cellPad,
    render: (r) =>
      h('div', { class: 'cell-col' }, [
        line(r['日期']),
        // 旧版这一格右边还有「删除」（未做，见文件头 ⏳4）
        h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: () => openUpdate(r) }, { default: () => '更新进度' }),
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
</script>

<style scoped>
.page {
  /* 减掉全局标题栏的高度（`App.vue` 的 `--app-header-h`）。 */
  min-height: calc(100vh - var(--app-header-h));
  background: #fff;
  padding: 12px 16px 24px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.grow-spacer {
  flex: 1;
}
.count {
  font-size: 13px;
  color: #909399;
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
