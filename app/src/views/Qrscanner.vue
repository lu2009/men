<template>
  <!--
    扫码生产（旧版 `/Qrscanner`）—— 车间/扫码工的手机端扫码作业页。

    逆向：`docs/2026-09-19-qrscanner-analysis.md`（下称「分析文档」）。
    整页骨架见 §2，扫码流程见 §3，「设置工序」见 §4，接口清单见 §5，权限见 §6，
    后端端点落地情况见 §8.6（**这张表是本文与后端对齐的唯一口径，写代码前先读它**）。

    ## 这页是干嘛的

    手机开摄像头扫门单上的二维码（**二维码内容就是行级「单号」**，分析文档 §3.1 三处证实过）
    → 把单号勾进「扫码结果」→ 从**工序下拉**里选一道工序 → 「确认」把这批门的该工序槽
    写成 `工序名_员工名_YYYY-MM-DD`（走 `POST /v1/progress/update`，与 `/Progress` 同一个接口）。

    另有「设置工序」（工序名的**唯一配置入口**，已拆成 `components/ProcedureSettingsDialog.vue`）
    与「扫码统计」（`components/ScanStatsPanel.vue`）。

    ## ✅ 做了什么 / ⛔ 置灰了什么

    | # | 旧版功能 | 本版 |
    |---|---|---|
    | 1 | 扫码录单 / 停止扫码（摄像头 + ZXing 连续扫码） | ✅ `composables/useQrScanner.ts` |
    | 2 | 手动录单（拼 `单号-YY/MM/DD`，**只本地入列、不调接口**） | ✅ |
    | 3 | 设置工序 | ✅ `components/ProcedureSettingsDialog.vue` |
    | 4 | 选工序 + 员工名 → **确认提交进度** | ✅ `POST /v1/progress/update` |
    | 5 | 扫码查单 / 手动查单 | ✅ **客户端过滤** `GET /v1/progress`（见下） |
    | 6 | 扫码统计看板（3 KPI + 按工序统计 + 26 列详情 + 导出 CSV） | ✅ `components/ScanStatsPanel.vue` |
    | 7 | 标签云打印（`getLabelData` + 云打印） | ✅ 数据面 `POST /v1/scan/labels`；**打印走浏览器**（见下） |
    | 8 | 扫码账号管理（`AddScanner` / `DeleteScanner`） | ⛔ **置灰** —— 后端**决定不做**，见下 |
    | 9 | 两块死代码面板（「🔧 调试信息」「⚙️ QR码识别高级设置」） | **不做**（旧版 `ref(false)` 全文零赋值，分析文档 §2.3–2.5） |
    | 10 | 「指定打印机」弹窗（仅租户名 `恒泰智门`） | **不做** —— 那是**云打印**的选打印机，本版走浏览器打印，没有「打印机名」这个概念 |

    ### 🔀 第 5 条：扫码查单**不再新开端点**（后端拍板）

    旧版走 `param1=getScanQRcode`，是一条**纯过滤**接口（拿单号去 `row['单号']` 做 trim 后精确匹配）。
    后端结论（分析文档 §8.6-(a)）：`GET /v1/progress` 已经把**全量门行连 `单号` 一起**给了前端
    ⇒ 前端 `rows.filter(r => r.单号.trim() === code.trim())` **逐字等价**，再开一条就是重复造。
    所以这里**一次拉全量、前端自己筛**（与 `Progress.vue` 一样的有意偏离）。

    ### 🔀 第 6 条：统计看板的「扫码日期/扫码员工」是**现推**的

    旧版 `getProcessCounts` 按每行的 `扫码日期` + `扫码员工` 筛，而新版**没有这两列**。
    后端结论（分析文档 §8.6-(b)）：**不加列**，读的时候从 `procedure_slots` 用
    `parseScanMarker` 那个正则**现推**（取日期最大的那条）—— 因为库里那些值本来就带着员工和日期，
    加列等于再存一份缓存、且历史行永远空。
    ⇒ 前端按这个口径筛，实现全在 `utils/scanStats.ts` 的 `deriveScanMarker` / `filterScanRows`。

    ⚠️ **代价要知道**：那个正则要**两个下划线**才匹配，所以只有 `/Qrscanner` 提交的值
    （`工序名_员工名_日期`）算得进去；`/Progress` 页提交的 `工序名_日期` **不算**。
    这不是我们的取舍 —— 旧版正则就是这个语义（看板统计的本来就是「扫码页干过的活」）。

    ### 🔀 第 7 条：标签**打印**走浏览器，不走云打印

    旧版后半截 `d.transitPrintSingle(templateId, rows, {silent:true, printer, copies, color:true})`
    是 `mutilPrintService` 的**云打印**（hiprint socket 推给装了打印客户端的机器），
    失败只 `warning("云打印失败")`。新版全栈没有那套服务，**统一走浏览器打印对话框**
    （与 Home / Hui 的 `printService.printByMode` 同一条路）。

    连带没做的（都属于云打印那套）：`templateId` 取 `registrant.template.lable`、
    `printer` 取 `localStorage.qr_label_printer || registrant.pagesize.lable`、`copies` 取
    `registrant.copy.lable` —— 新版按 **mode `lable`** 从 `GET /v1/print-templates/lable` 取模板，
    份数与打印机交给浏览器对话框。
    数据构造（张数算法 + 11 个字段）在 `utils/scanLabels.ts`，**是照旧版 `za` 逐行抄的**。

    ### ⛔ 第 8 条：扫码账号管理为什么是置灰而不是硬做

    后端**决定整条不做**（分析文档 §8.6-(d)）：旧版这两个接口是**开账号**
    （`isDefaultPw: 2` + `mutilUser: 1`），而新栈的账号体系只有
    `login` / `logout` / `me` / `change-password` —— **没有「建号」这条产品线**，
    `role` 也没有任何地方按它分支（旧版那套 `defaulted` 决定导航与落地页的机制我们没有）。
    ★ **这里缺的是「账号语义」不是「端点」** —— 建出来的号登录后落在哪、能看到哪些菜单，
    旧版是靠 `defaulted=2` 决定的，我们没有这套语义；光补两个写 `users` 行的端点，
    等于造出一批**登录后行为未定义**的账号。所以是**产品决定**，不是补个端点的事。
    ⇒ 按本项目对**死链**的态度：**按钮置灰 + 点了给提示「本版还没做」**（机制同 `Progress.vue` 的 `notYet`）。

    ## 🔀 其余**有意偏离**（照抄会出错）

    1. **不支持扫码枪键盘楔。** 旧版全文**没有 `keydown`/`keypress`**（分析文档 §3.2 末尾），
       只走摄像头 ⇒ 这里也一条键盘监听都没有。**别自作主张加。**
    2. **提交的日期用本地日期。** 旧版是 `new Date().toISOString().split("T")[0]`（**UTC**），
       东八区晚 8 点后会把进度日期写到**第二天**（分析文档 §9 第 7 条）。
       新版按 §8.4 的建议改用**本地日期**。导出的文件名同理。
    3. **工序下拉的 `value` 是槽号（`工序N`）不是工序名。** 旧版 `dl` 是 `{label:名, value:名}`，
       再用 `pa()` 反查槽号 —— 两个槽同名时只命中第一个（§4.4-(d) / §9 第 4 条）。
       新版直接 `{label: 工序名, value: 槽号}`，与 `Progress.vue:134` 一致（§8.3-3）。
    4. **扫码结果去重口径修正。** 旧版 `w`（去重表）在**取消勾选**时会把单号 `splice` 掉，
       而显示列表 `Xe` 不动 ⇒ 取消勾选后再扫同一个码，`Xe` 里会出现**第二条重复项**。
       新版只维护一份「已录入列表」，去重对着它做（见 `addCode()`）。
    5. **员工名称输入框常驻。** 旧版只在 `rl`（主账号 或 `主账号+生产`）时显示，子账号会从账号名里
       自动剥出员工名。新版没有那种账号命名结构（`Progress.vue` 文件头已记同样的结论）
       ⇒ 常驻显示，初值仍从 `localStorage.staffName` 读（旧版同键）。
       连带：统计查询的「员工」参数**没有**「子账号默认按自己查」那一支，
       只有「输入框有值就按它，否则 `"1"`（全部员工）」—— `"1"` 是旧版服务端的哨兵值。

    ## 权限（旧版 §6）

    旧版这页的按钮由 `userinfo.defaulted` / `userinfo.name === registrant` 门控。
    新版**没有 `defaulted` / `registrant` 那套账号字段** ⇒ 本页用**登录态**代替：
    能进这一页就是已登录，所以「设置工序」对**所有登录用户**显示。
  -->
  <div class="qr-scanner">
    <!--
      工具条（旧版 `.button-group`，分析文档 §2.1）。
      顺序、类型色、出现条件逐条照旧版：1/2 互斥（`!ot` / `ot`）、6 只要 defaulted===1、7 只要主账号。
      ⚠️ Element Plus 的 `plain`（浅底 + 同色边框）在 naive-ui 里没有同名 prop，
         用视觉上最接近的 `secondary`（浅底 + 同色字）。这页的 `plain` 只出现在第 3、5 两颗。
    -->
    <div class="button-group">
      <n-button v-if="!scanning" type="primary" :loading="submitting" @click="startScanEntry">
        扫码录单
      </n-button>
      <n-button v-else type="primary" class="confirm-btn" @click="stopScan">停止扫码</n-button>

      <n-button type="primary" secondary @click="openManual('entry')">手动录单</n-button>

      <n-button type="success" :loading="querying" @click="startScanQuery">扫码查单</n-button>
      <n-button type="success" secondary :loading="querying" @click="openManual('query')">
        手动查单
      </n-button>

      <n-button type="info" @click="settingsShow = true">设置工序</n-button>

      <!-- ⛔ 扫码账号管理：后端决定不做（见文件头第 8 条），按死链态度置灰 + 提示。 -->
      <span class="pending-slot" @click="notYet('扫码账号管理', '给车间同事开扫码账号、停用旧账号')">
        <n-button type="warning" disabled>扫码账号管理</n-button>
      </span>
    </div>

    <!--
      日期范围（旧版 `.date-range-actions`，分析文档 §2.2）。
      四颗文字按钮，「更多」展开日期选择：PC 一个区间选择器、手机两个独立选择器（旧版如此）。
      ⚠️ 只有「更多」下**两个日期都齐**才查（旧版先 `ea()` 校验「开始日期不能晚于结束日期」）。
    -->
    <div class="date-range-actions">
      <n-button
        v-for="label in RANGE_LABELS"
        :key="label"
        text
        class="range-btn"
        :class="{ active: rangeLabel === label }"
        :loading="label === rangeLabel && statsLoading"
        @click="pickRange(label)"
      >
        {{ label }}
      </n-button>
    </div>

    <div v-if="rangeLabel === '更多'" class="custom-date-picker">
      <template v-if="isMobile">
        <n-date-picker v-model:value="rangeStart" type="date" :editable="false" />
        <span class="range-sep">至</span>
        <n-date-picker v-model:value="rangeEnd" type="date" :editable="false" />
      </template>
      <n-date-picker v-else v-model:value="rangePair" type="daterange" range-separator="至" />
      <n-button type="primary" size="small" @click="queryStats('更多')">查询</n-button>
    </div>

    <!--
      员工名称 + 工序下拉（旧版 §2.6）。
      ⚠️ 员工名既是**提交进度**用的操作员名，也是**统计查询**的员工筛选（留空 = 全部员工）。
      ⚠️ 工序下拉的选项**只列配过名字的槽**（旧版 `Ca` 也是 `filter(v => v)` 丢掉空槽），
         但**不过滤工序10** —— 旧版这里本来就不排工序10（分析文档 §4.4-(d)），新版 15 槽一视同仁。
    -->
    <n-input
      v-model:value="staffName"
      class="staff-name-input"
      placeholder="请输入员工名称"
      @blur="saveStaffName"
    />
    <n-select
      v-model:value="procedureSlot"
      class="procedure-select"
      placeholder="请选择工序"
      :options="procedureOptions"
    />

    <!-- 扫码容器（旧版 `div.scanner-container`，§2.7）。⚠️ `<video>` 放模板里而不是 `createElement`。 -->
    <div v-show="scanning" class="scanner-container">
      <video ref="videoRef" class="scanner-video" autoplay playsinline muted />
    </div>

    <!--
      扫码结果区（旧版 `div.scan-results`，§2.8）—— 列表非空才出现。

      ⚠️ 标题显示的是**勾选数**（旧版 `et2.length`）**不是**扫到的数量（`Xe.length`），
         这不是笔误：旧版原文就是 `选中门单数： {et2.length}个`。
      ⚠️ 旧版扫到一个码**不会自动勾上**（`na()` 只往列表里加、`el-checkbox` 要用户自己点），
         这里照旧。厂里用的人是「扫一批、核对一遍、再全勾」的流程。
    -->
    <div v-if="codes.length > 0" class="scan-results">
      <h3 class="result-count">选中门单数：{{ checked.length }}个</h3>

      <div class="result-toolbar">
        <n-button type="success" class="print-btn" :loading="printing" @click="printLabels">
          打印标签
        </n-button>
        <!--
          固定标签数（旧版 `rt` / `ut`，持久化在 `label_quantity_enabled` / `label_quantity_value`）。
          开着时**覆盖**算出来的张数（见 `utils/scanLabels.ts` 的顺序说明）。
        -->
        <span class="fixed-count">
          <n-switch v-model:value="fixedCountOn" size="small" @update:value="saveFixedCount" />
          <span class="fixed-count-label">固定标签数</span>
          <n-input-number
            v-if="fixedCountOn"
            v-model:value="fixedCount"
            size="small"
            :min="1"
            :max="99"
            class="fixed-count-input"
            @update:value="saveFixedCount"
          />
        </span>
      </div>

      <n-checkbox-group v-model:value="checked">
        <div v-for="code in codes" :key="code" class="result-item">
          <n-checkbox :value="code" :label="code" />
        </div>
      </n-checkbox-group>

      <div class="button-group-bottom">
        <n-button type="primary" :loading="submitting" @click="submitProgress">确认</n-button>
      </div>
    </div>

    <!--
      扫码统计面板（旧版 `div.process-stats-mobile`）。⚠️ 旧版的 `pl` 只有置 `true`、**从不置回 false**
         ⇒ 面板一旦出现就不会自己消失，这里也**不给关闭按钮**（由它挂着）。
         内容与口径全在 `components/ScanStatsPanel.vue` / `utils/scanStats.ts`。
    -->
    <ScanStatsPanel
      v-if="statsOpen"
      :rows="statsRows"
      :title="statsTitle"
      :employee="statsEmployee"
      :procedures="procedures"
    />

    <!-- 手动录入单号 / 手动查单（旧版 `vt`，§2.10 第 4 个弹窗 / §3.3-(c)） -->
    <n-modal
      v-model:show="manualShow"
      preset="card"
      :title="manualMode === 'query' ? '手动查单' : '手动录入单号'"
      style="width: 90%; max-width: 420px"
      :bordered="false"
      :mask-closable="false"
    >
      <div class="manual-form">
        <div class="manual-row">
          <span class="manual-label">单号</span>
          <n-input
            v-model:value="manual.number"
            placeholder="请输入单号数字"
            :maxlength="10"
            @input="onNumberInput"
          />
        </div>
        <div class="manual-row">
          <span class="manual-label">年</span>
          <n-select v-model:value="manual.year" :options="yearOptions" placeholder="年" filterable tag />
        </div>
        <div class="manual-row">
          <span class="manual-label">月</span>
          <n-select v-model:value="manual.month" :options="monthOptions" placeholder="月" filterable tag />
        </div>
        <div class="manual-row">
          <span class="manual-label">日</span>
          <n-input v-model:value="manual.day" placeholder="日" :maxlength="2" @input="onDayInput" />
        </div>

        <!-- 旧版 `kt`：**只在 2–11 月预填年份**（1 月/12 月跨年边界要手选），此时提示这句。 -->
        <div v-if="yearPrefilled" class="manual-hint">默认预录入当前年份，请根据实际录入</div>

        <div class="manual-preview">将要录入：<code>{{ manualPreview }}</code></div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <n-button @click="manualShow = false">取消</n-button>
          <n-button type="primary" :loading="querying" @click="confirmManual">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 设置工序（旧版 `ml`，§2.10 第 2 个弹窗 / §4）—— 表单与保存语义都在组件里。 -->
    <ProcedureSettingsDialog
      v-model:show="settingsShow"
      :slots="procedures"
      :loaded="proceduresLoaded"
      @saved="loadProcedures"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NDatePicker,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSwitch,
  useMessage,
} from 'naive-ui'
import { api } from '../api/client'
import type { ProcedureSlotDto, ProgressRowDto } from '../api/types'
import { useQrScanner } from '../composables/useQrScanner'
import { useAuthStore } from '../stores/auth'
import ProcedureSettingsDialog from '../components/ProcedureSettingsDialog.vue'
import ScanStatsPanel from '../components/ScanStatsPanel.vue'
import {
  deriveScanMarker,
  filterScanRows,
  matchByScanCode,
  resolveDateLabel,
  type ScanDateLabel,
} from '../utils/scanStats'
import { buildScanLabelRows } from '../utils/scanLabels'
import { DEFAULT_DIAO_TABS, DEFAULT_PING_TABS } from '../utils/printData'
import { printByMode } from '../utils/printService'

const message = useMessage()
const auth = useAuthStore()

/** 「本版还没做」的统一提示。文案是**给厂里用人看的**，别塞 `§`/函数名（那些写在注释里）。 */
function notYet(name: string, what: string) {
  message.info(`「${name}」本版还没做：${what}`)
}

// ===== 摄像头扫码（旧版 `ot` / `nt2`）=====
const { scanning, videoRef, start, stop } = useQrScanner()

/** 已扫到/录入过的单号，原序（旧版 `Xe`）。 */
const codes = ref<string[]>([])
/** 勾选的子集（旧版 `et2`）—— 提交进度、打印标签用的都是它。 */
const checked = ref<string[]>([])
const submitting = ref(false)
const printing = ref(false)
const querying = ref(false)

/**
 * 往列表里加一个单号（旧版 `na`）。
 *
 * ⚠️ 旧版的去重表 `w` 与显示列表 `Xe` 是两份，取消勾选会改 `w` 而不动 `Xe`
 * ⇒ 取消勾选后再扫同一个码会出现**重复行**（分析文档 §2.8 的 `onChange`）。
 * 新版只维护一份 `codes`，去重对着它做。
 */
function addCode(code: string): boolean {
  if (codes.value.includes(code)) return false
  codes.value.push(code)
  return true
}

/**
 * 「扫码录单」（旧版 `!ot` 那颗的内联 handler，§3.3-(a)）。
 *
 * 连续模式：每解到一个**新**码就入列并提示，**不自动停** —— 可以连着扫一整批门单。
 */
async function startScanEntry() {
  try {
    await start((text) => {
      if (addCode(text)) message.success(`识别到新二维码: ${text}`)
    })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '开启摄像头失败')
  }
}

/**
 * 「扫码查单」（旧版 `ua`，§3.3-(b)）—— 与扫码录单共用取流，差别只在**只认第一个码**。
 *
 * 旧版这一步还先判 `1 === userinfo.defaulted`，不通过时报的是
 * 「您没有权限进行**工序设置**」（文案串了，分析文档 §9 第 6 条）。
 * 新版没有 `defaulted` ⇒ 不判（能进这页就是已登录，见文件头「权限」）。
 */
async function startScanQuery() {
  // ⚠️ 这里**不置 `querying`** —— `start()` 在解码循环**开起来**之后就返回了（不等扫到码），
  //    在这句话里置 loading 会在摄像头刚开时就被 `finally` 关掉，等于没有。
  //    loading 交给真正在等接口的 `runScanQuery` 管；摄像头开没开由「扫码容器出现」本身提示。
  try {
    // 旧版扫码查单也是「解到第一个就立刻停摄像头」，所以回调里第一件事就是 `stopScan()`。
    await start((text) => {
      stopScan()
      void runScanQuery(text)
    })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '开启摄像头失败')
  }
}

/** 「停止扫码」（旧版 `al`）。 */
function stopScan() {
  stop()
}

// ===== 工序下拉（旧版 §2.6 / §6.1）=====
const procedures = ref<ProcedureSlotDto[]>([])
/** 工序清单是否**成功读到过** —— 读不到时设置工序弹窗不给保存（免得一片空点确认把 15 槽清掉）。 */
const proceduresLoaded = ref(false)
const procedureSlot = ref<string | null>(null)
const settingsShow = ref(false)

/**
 * 下拉选项：**只列配过名字的槽**，`value` 是**槽号**不是工序名（见文件头偏离 3）。
 * 旧版 `dl` 还要求键以「工序」开头（服务端恒 15 键，这条件恒真）。
 */
const procedureOptions = computed(() =>
  procedures.value.filter((p) => p.name.trim()).map((p) => ({ label: p.name.trim(), value: p.slot })),
)

/** 选中槽位的工序名 —— 拼提交值用。 */
const selectedName = computed(
  () => procedures.value.find((p) => p.slot === procedureSlot.value)?.name.trim() ?? '',
)

async function loadProcedures() {
  try {
    const r = await api.listProcedures()
    procedures.value = r?.slots ?? []
    proceduresLoaded.value = true
  } catch (e) {
    procedures.value = []
    proceduresLoaded.value = false
    message.error(e instanceof Error ? e.message : '读取工序清单失败')
  }
}

// ===== 员工名称（旧版 `sl` / `fa`）=====
/** 旧版 `Qrscanner @40408` 读、`fa` 在 blur 时写回（空则删键）—— 键名逐字照抄。 */
const STAFF_NAME_KEY = 'staffName'
const staffName = ref(localStorage.getItem(STAFF_NAME_KEY) ?? '')

function saveStaffName() {
  const v = staffName.value.trim()
  if (v) localStorage.setItem(STAFF_NAME_KEY, v)
  else localStorage.removeItem(STAFF_NAME_KEY)
}

/**
 * 统计查询用的员工参数（旧版 `Zl` 里的 `i`）。
 *
 * 旧版三段：输入框有值 → 用它；否则 **子账号**（`name !== registrant`）→ 用 `userinfo.name`；
 * 否则 → 字面量 `"1"`。服务端 `getProcessCounts` 里
 * `if (operatorName !== '1' && scanEmployee !== operatorName) continue`
 * ⇒ **`"1"` 就是「全部员工」的哨兵值**。
 *
 * ⚠️ 新版**没有**「子账号」那一支（没有旧版那种「租户名+后缀」的账号命名，见文件头偏离 5）
 * ⇒ 只有「输入框有值 / 全部」两种。
 */
const queryEmployee = computed(() => staffName.value.trim() || '1')
/** 副标题里显示的那个（旧版 `ul` = `输入框 || userinfo.name`）—— 用登录用户名兜底。 */
const employeeLabel = computed(() => staffName.value.trim() || auth.user?.name || '')

// ===== 日期范围（旧版 §2.2）=====
const RANGE_LABELS = ['当天', '本周', '本月', '更多'] as const
type RangeLabel = (typeof RANGE_LABELS)[number]

/** 当前选中的档位（旧版 `zl`，初值 `"当天"`）。 */
const rangeLabel = ref<RangeLabel>('当天')
/**
 * ⚠️ naive 的日期选择器 `v-model:value` 收的是**时间戳**（`number` / `[number, number]`），
 * 不是 `yyyy-MM-dd` 字符串 —— 用它的 `value-format` 能把值变成字符串，但**类型不会跟着变**。
 * 所以这里存时间戳、查询前自己格式化（`ymdOf`），免得为了一处显示去和类型系统打架。
 */
const rangePair = ref<[number, number] | null>(null)
const rangeStart = ref<number | null>(null)
const rangeEnd = ref<number | null>(null)
const statsLoading = ref(false)

/** 旧版 `Pl`：`window.innerWidth <= 768` 时「更多」用两个独立的日期选择器，不是一个区间选择器。 */
const isMobile = window.innerWidth <= 768

function pickRange(label: RangeLabel) {
  rangeLabel.value = label
  // 「更多」只是展开选择区，**不立刻查**（旧版要等日期齐了、点确认才查）。
  if (label === '更多') return
  void queryStats(label)
}

/** 时间戳 → **本地** `YYYY-MM-DD`（不用 `toISOString` —— 那是 UTC，会把东八区的凌晨算到前一天）。 */
function ymdOf(ts: number): string {
  return todayYmd(new Date(ts))
}

/** 「更多」的日期校验（旧版 `ea()`）：开始不能晚于结束。 */
function validateRange(): [string, string] | null {
  const [s, e] = isMobile
    ? [rangeStart.value, rangeEnd.value]
    : (rangePair.value ?? [null, null])
  if (!s || !e) {
    message.warning('请先选择日期范围')
    return null
  }
  if (s > e) {
    message.warning('开始日期不能晚于结束日期')
    return null
  }
  return [ymdOf(s), ymdOf(e)]
}

// ===== 统计查询（旧版 `Zl` → 现在的「拉全量 + 前端按扫码标记筛」）=====
const statsOpen = ref(false)
/** 面板副标题里的日期口径（旧版 `zl`）。 */
const statsTitle = ref<string>('当天')
const statsEmployee = ref<string>('')
const statsRows = ref<ProgressRowDto[]>([])

/**
 * 查询扫码统计（旧版 `Zl`）。
 *
 * 🔀 旧版是 `param1=getProcessCounts&param3={员工}&param4={当天|本周|本月|起,止}`，
 * **服务端**按 `扫码日期`/`扫码员工` 过滤。新版这两列不存在（分析文档 §8.6-(b) 拍板不加列）
 * ⇒ 这里**拉全量、前端现推着筛**，实现见 `utils/scanStats.ts` 的 `filterScanRows`。
 * 日期标签（`本周` 从**周一**算起等）也在那个文件里，逐条照旧服务端的 `resolveDateLabel`。
 */
async function queryStats(mode: RangeLabel) {
  let start: string
  let end: string
  if (mode === '更多') {
    const range = validateRange()
    if (!range) return
    ;[start, end] = range
  } else {
    ;[start, end] = resolveDateLabel(mode as ScanDateLabel)
  }

  statsLoading.value = true
  try {
    const r = await api.listProgress()
    const all = r?.progressData ?? []
    const hit = filterScanRows(all, { employee: queryEmployee.value, start, end })
    statsRows.value = hit
    // 旧版副标题里就是 `zl` 那个档位名（选「更多」时显示的就是「更多」两个字）。
    // 这里「更多」改成显示实际区间 —— 比两个字有用，且不影响任何口径（有意的小改进）。
    statsTitle.value = mode === '更多' ? `${start} 至 ${end}` : mode
    statsEmployee.value = employeeLabel.value
    statsOpen.value = true
    if (hit.length === 0) message.warning('该条件下暂无扫码数据')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '查询扫码数据失败')
  } finally {
    statsLoading.value = false
  }
}

// ===== 扫码查单 / 手动查单（旧版 `ua` / `It`）=====
/**
 * 按单号查（旧版 `getScanQRcode`，现改为**客户端过滤** `GET /v1/progress`，见文件头第 5 条）。
 *
 * ⚠️ **这是把旧版那条端点换成等价客户端过滤，不是漏做** —— 后端已把那条端点删掉，
 * 别以后有人以为是漏了、又去补一个。匹配口径（`trim` 后精确相等）与差分台见
 * `utils/scanStats.ts` 的 `matchByScanCode`。
 */
async function runScanQuery(code: string) {
  const wanted = code.trim()
  if (!wanted) {
    message.warning('请提供单号')
    return
  }
  querying.value = true
  try {
    const r = await api.listProgress()
    const hit = (r?.progressData ?? []).filter((row) => matchByScanCode(row, wanted))
    if (hit.length === 0) {
      // 旧版服务端这里是 `404 未找到相关订单`，前端走 error 分支、**不打开**面板。
      message.error('未找到相关订单')
      return
    }
    message.success(`识别到二维码: ${wanted}`)
    // 顺带把「现推」出来的扫码日期挂到行上：旧版这条路（`getScanQrCode`）服务端是带
    // `enrichDoorRow(..., {gmtDate:true})` 的，行上**有**这个键，26 列里的「扫码日期」才显示得出来。
    statsRows.value = hit.map((row) => {
      const marker = deriveScanMarker(row)
      return marker ? ({ ...row, 扫码日期: marker.date } as ProgressRowDto) : row
    })
    // 扫码查单没有日期口径，副标题给「扫码查单」；「· 员工 X」旧版这条路也不补 `查询员工`
    // （`ua` 只写 `Cl`，没有那句 `{...row, 查询员工}`）⇒ 这里同样不给员工。
    statsTitle.value = '扫码查单'
    statsEmployee.value = ''
    statsOpen.value = true
  } catch (e) {
    message.error(e instanceof Error ? e.message : '查询扫码数据失败')
  } finally {
    querying.value = false
  }
}

// ===== 手动录单 / 手动查单（旧版 `xt` / `At` → `vt` 弹窗 → `It`，§3.3-(c)）=====
const manualShow = ref(false)
/** 旧版 `Pt`：`entry` = 只本地入列；`query` = 调查单接口。 */
const manualMode = ref<'entry' | 'query'>('entry')
const manual = ref({ number: '', year: '', month: '', day: '' })
/** 旧版 `kt`：年份是不是**自动预填**的（决定要不要显示那句提示）。 */
const yearPrefilled = ref(false)

const pad2 = (n: number) => String(n).padStart(2, '0')
/** **本地**日期 `YYYY-MM-DD`（不用 `toISOString` —— 那是 UTC，见文件头偏离 2）。 */
function todayYmd(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 年下拉只有一个「当前 YY」选项，但 `filterable` + 可新建 ⇒ 用户能填任意两位（旧版同）。 */
const yearOptions = computed(() => {
  const yy = String(new Date().getFullYear()).slice(-2)
  return [{ label: yy, value: yy }]
})
/**
 * 月下拉 —— ⚠️ **有意偏离**：旧版这个 select 只有「当前 MM」**一个**选项（靠 `allow-create` 手输），
 * 等于逼着人打字。这里把 01–12 都列出来方便点选，`filterable` + 可新建照样开着，
 * 想填别的也拦不住 —— 语义不变，只是少打字。
 */
const monthOptions = Array.from({ length: 12 }, (_, i) => {
  const v = pad2(i + 1)
  return { label: v, value: v }
})

/** 只留数字（旧版 `zt` / `ht` 的 `onInput`）。 */
function digitsOnly(v: string, max: number) {
  return v.replace(/\D/g, '').slice(0, max)
}
function onNumberInput(v: string) {
  manual.value.number = digitsOnly(v, 10)
}
function onDayInput(v: string) {
  manual.value.day = digitsOnly(v, 2)
}

/** 预览（旧版 `Bt`）—— 没填的段落下划线占位。 */
const manualPreview = computed(() => {
  const m = manual.value
  return `${m.number || '___'}-${m.year || '__'}/${m.month || '__'}/${m.day || '__'}`
})

/** 某年某月有多少天（旧版 `Nt()`，2 月按闰年）。 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * 开「手动录单 / 手动查单」弹窗（旧版 `xt` / `At`）。
 * 两者是**同一个弹窗的两个模式**（`Pt = "entry" | "query"`），差别只在确认时。
 */
function openManual(mode: 'entry' | 'query') {
  // 旧版先关摄像头再开弹窗；这里也一样（手机端否则会一直占着摄像头）。
  stop()
  manualMode.value = mode

  const now = new Date()
  const month = now.getMonth() + 1
  // 旧版先「清空 `pt`」再只回填年份 ⇒ 月/日**不预填**（`It` 里除 `pt.year` 外没别的赋值）。
  const m = { number: '', year: '', month: '', day: '' }
  // ★ `l >= 2 && l <= 11` 才预填年份。1 月/12 月是跨年边界，**要手选**（旧版 `It` 原文）。
  if (month >= 2 && month <= 11) {
    m.year = String(now.getFullYear()).slice(-2)
    yearPrefilled.value = true
  } else {
    yearPrefilled.value = false
  }
  manual.value = m
  manualShow.value = true
}

/**
 * 「确认」（旧版 `It`）。
 *
 * 校验：日不能大于当月天数、月不能 > 12（旧版 `Nt()`）。
 * 拼法：`单号 + "-" + 年 + "/" + 月(补零) + "/" + 日(补零)` —— 逐字照抄（年份原样不补零）。
 *
 * ⚠️ **`entry` 模式只本地入列、不调任何接口** —— 这是旧版的既定语义（§3.3-(c) 末句）：
 * 手工把还没印二维码的门单也加进这一批，最后一起「确认」提交进度。
 * `query` 模式才调查单。
 */
function confirmManual() {
  const m = manual.value
  const number = m.number.trim()
  const year = m.year.trim()
  const month = Number(m.month)
  const day = Number(m.day)

  if (!number) return void message.warning('请输入单号')
  if (!year) return void message.warning('请选择年份')
  if (!month || month > 12) return void message.warning('月份不正确，请填写 1 到 12')
  if (!day) return void message.warning('请输入日')
  // 年份是两位，补成四位再判当月天数（闰年只跟 4 的倍数有关，两位补 2000 年后结论不变）。
  const fullYear = 2000 + Number(year)
  if (day > daysInMonth(fullYear, month)) {
    return void message.warning(`${month} 月只有 ${daysInMonth(fullYear, month)} 天，请检查`)
  }

  const code = `${number}-${year}/${pad2(month)}/${pad2(day)}`
  manualShow.value = false
  if (manualMode.value === 'query') {
    void runScanQuery(code)
    return
  }
  if (addCode(code)) message.success(`已录入单号: ${code}`)
  else message.info(`这个单号已经在列表里了: ${code}`)
}

// ===== 固定标签数（旧版 `rt` / `ut`，§2.8）=====
/**
 * 键名逐字照抄旧版（`Qrscanner @40204`）。开着时把算出来的标签张数**覆盖**掉，
 * 方便「我只想每个门打一张」这种场景。
 */
const FIXED_ENABLED_KEY = 'label_quantity_enabled'
const FIXED_VALUE_KEY = 'label_quantity_value'
const fixedCountOn = ref(localStorage.getItem(FIXED_ENABLED_KEY) === '1')
const fixedCount = ref(Number(localStorage.getItem(FIXED_VALUE_KEY)) || 1)

function saveFixedCount() {
  localStorage.setItem(FIXED_ENABLED_KEY, fixedCountOn.value ? '1' : '0')
  localStorage.setItem(FIXED_VALUE_KEY, String(fixedCount.value || 1))
}

// ===== 打印标签（旧版 `Ba` → `za`，§3.5）=====
/**
 * 打印标签。
 *
 * 数据面走 `POST /v1/scan/labels`（body = 勾选的**行级单号**数组）；
 * 张数与 11 个字段的构造在 `utils/scanLabels.ts`（照旧版 `za` 逐行抄）。
 *
 * 🔀 **打印动作**本身与旧版不同：旧版是云打印（`transitPrintSingle`，推给装了打印客户端的机器），
 * 新版走**浏览器打印对话框**（`printByMode`），与 Home / Hui 同一条路 —— 见文件头第 7 条。
 */
async function printLabels() {
  if (checked.value.length === 0) {
    message.error('没有选中的单号可打印')
    return
  }
  printing.value = true
  try {
    const { rows } = await api.scanLabels([...checked.value])
    if (!rows || rows.length === 0) {
      message.error('未找到标签数据')
      return
    }
    const labelRows = buildScanLabelRows(rows, {
      registrant: auth.tenant?.name ?? '',
      pingTabs: DEFAULT_PING_TABS,
      diaoTabs: DEFAULT_DIAO_TABS,
      // ⚠️ 见 `scanLabels.ts` 文件头：传 0 = 保持旧版那条「套线单价」死分支不生效。
      casingPrice: 0,
      fixedCount: fixedCountOn.value ? fixedCount.value : null,
    })
    await printByMode('lable', labelRows)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '标签打印处理出错')
  } finally {
    printing.value = false
  }
}

// ===== 「确认」提交进度（旧版 `oa`，§3.4）=====
/**
 * 把勾选的**单号**解析成**行 id**。
 *
 * ⚠️ 这是与旧版唯一的数据流差别：旧版 `updataProgress` 的 body 直接就是单号数组，
 * 服务端拿 `rowRefs(row)` 去比（`单号`/`回执单号`/`orderNo`/`id` 都算）；
 * 新版 `POST /v1/progress/update` 收的是**行 id 列表**（`progress/model.rs`），
 * 所以这里先用 `GET /v1/progress` 拉一次全量、建「单号 → 行 id」的表。
 * 与分析文档 §8.5 的结论一致：两条路最终落到同一个槽、共用一个接口。
 *
 * 顺带说明：同一次「确认」里**只拉一次**全量 —— 上一版是每单号一次请求，
 * 现在是 `完成` 一次（后端注释也写了「前端手里有行级单号 → 行的映射，直接拿它拼 line_ids」）。
 */
async function resolveLineIds(byNo: string[]): Promise<{ ids: number[]; missing: string[] }> {
  const r = await api.listProgress()
  const map = new Map<string, number>()
  for (const row of r?.progressData ?? []) {
    const no = String(row['单号'] ?? '').trim()
    // 同一个单号理论上只对应一行；真撞了就取第一个（与旧版 `Set.has` 的命中语义一致）。
    if (no && !map.has(no)) map.set(no, row.id)
  }
  const ids: number[] = []
  const missing: string[] = []
  for (const no of byNo) {
    const id = map.get(no)
    if (id == null) missing.push(no)
    else ids.push(id)
  }
  return { ids, missing }
}

async function submitProgress() {
  if (checked.value.length === 0) return void message.error('没有扫描结果可提交')
  if (staffName.value.trim() === '') return void message.error('请先输入员工名称')
  if (!procedureSlot.value || !selectedName.value) return void message.error('请先选择工序')

  submitting.value = true
  stop() // 旧版也是提交时先把摄像头关掉
  try {
    const wanted = [...checked.value]
    const { ids, missing } = await resolveLineIds(wanted)

    if (ids.length === 0) {
      message.error('这些单号在系统里都找不到，没法提交进度')
      return
    }
    if (missing.length > 0) {
      message.warning(`有 ${missing.length} 个单号在系统里找不到，已跳过：${missing.join('、')}`)
    }

    // 值的三段：`工序名_员工名_本地日期`（旧版是 UTC 日期，见文件头偏离 2）。
    // ⚠️ 这个「两个下划线」的形状正是统计看板认的标记 —— 见 `utils/scanStats.ts` 的 `parseScanMarker`。
    const value = `${selectedName.value}_${staffName.value.trim()}_${todayYmd()}`
    await api.updateProgress(ids, procedureSlot.value, value)

    message.success('提交成功')
    codes.value = []
    checked.value = []
  } catch (e) {
    message.error(e instanceof Error ? e.message : '提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(loadProcedures)
</script>

<style scoped>
/*
 * 根容器 —— 旧版 `div.qr-scanner` 的 CSS 逐条照抄（分析文档 §2）：
 * `padding:16px; max-width:100%; margin:65px auto 0`，≤768px 时 `margin-top:17px; padding:10px`。
 * ⚠️ 旧版那个 `margin-top:65px` 是给它自己的固定标题栏让位的；我们的标题栏是全局的
 *    （`App.vue` 的 `--app-header-h`，其它页面一律 `calc(100vh - var(--app-header-h))`）
 *    ⇒ 这里改用同一个变量，与 Progress 等页面保持一致（**有意偏离**）。
 */
.qr-scanner {
  min-height: calc(100vh - var(--app-header-h));
  max-width: 100%;
  padding: 16px;
  background: #fff;
}
/* 工具条：旧版 `display:flex; flex-wrap:wrap; gap:10px; justify-content:center`。 */
.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}
/* 旧版 `.button-group button { min-width:100px }`。 */
.button-group :deep(button) {
  min-width: 100px;
}
/*
 * 置灰按钮的可点包装（与 `PrintDrawer.vue` 的 `.doc-pending` 同一套机制）：
 * naive 的 `disabled` 按钮会吃掉点击事件，所以包一层 span 接 click，按钮本身设 `pointer-events:none`。
 * ⚠️ `Progress.vue` 里原先也有一份同名的，2026-09-19 那页的占位按钮全部接上真目标后已删 ——
 *    这里的这份是**本组件自己的**，别因为那边没了就顺手删。
 */
.pending-slot {
  display: inline-flex;
  cursor: not-allowed;
}
.pending-slot :deep(button) {
  pointer-events: none;
}
/* 日期范围：旧版 `.date-range-actions`，居中一排。 */
.date-range-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 10px;
}
/* 旧版 `.range-btn`：常态灰、选中蓝加粗。 */
.range-btn {
  font-size: 13px;
}
.range-btn.active {
  color: #409eff;
  font-weight: 700;
}
/* 「更多」展开区：PC 一个区间选择器、手机两个独立选择器（旧版 §2.2）。 */
.custom-date-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  justify-content: center;
  margin-top: 8px;
}
.range-sep {
  font-size: 13px;
  color: #909399;
}
/*
 * 员工名称输入 + 工序下拉：旧版两件都是 `width:50%`，且**没为窄屏加媒体查询**
 * （分析文档 §2.6 末句）⇒ 窄屏仍是 50%（见下面媒体查询里的**有意偏离**说明）。
 */
.staff-name-input,
.procedure-select {
  width: 50%;
  min-width: 160px;
  margin-top: 10px;
}
/* 旧版 `.scanner-container`：`width:100%; max-width:300px; height:300px; margin:1rem auto`。 */
.scanner-container {
  width: 100%;
  max-width: 300px;
  height: 300px;
  margin: 1rem auto;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  overflow: hidden;
}
/* video 的 `object-fit:cover` 等内联样式（旧版是 `createElement` 后设的）搬到这里。 */
.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* 扫码结果区。 */
.scan-results {
  margin-top: 16px;
}
.result-count {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
}
/* 打印标签 + 固定标签数那一行。 */
.result-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.fixed-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
}
.fixed-count-input {
  width: 90px;
}
/* 旧版 `.result-item`：一个单号一行。 */
.result-item {
  padding: 4px 0;
}
/* 旧版 `.button-group-bottom`：确认按钮居中。 */
.button-group-bottom {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
/* 手动录入弹窗表单。宽度走 `n-modal` 的行内 style（旧版 `vt` 宽 90%，见模板）。 */
.manual-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.manual-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.manual-label {
  flex: none;
  width: 40px;
  font-size: 13px;
  color: #606266;
}
.manual-row :deep(.n-input),
.manual-row :deep(.n-select) {
  flex: 1 1 160px;
  min-width: 0;
}
.manual-hint {
  font-size: 12px;
  color: #e6a23c;
}
.manual-preview {
  font-size: 13px;
  color: #606266;
}
.manual-preview code {
  color: #409eff;
  font-size: 14px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/*
 * 窄屏（旧版 `@media (max-width:768px)`）：根容器 padding 收紧、工具条改纵向铺满。
 * ⚠️ 员工名/工序下拉旧版窄屏**仍是 50%**；这里**有意偏离**改成 100%
 *    —— 手机上 50% 宽的输入框放不下「请输入员工名称」那行提示，
 *    与 `frontend-conventions.md` 的窄屏规范也冲突。记在这里免得被当成抄错。
 */
@media (max-width: 768px) {
  .qr-scanner {
    padding: 10px;
  }
  .button-group {
    flex-direction: column;
  }
  .button-group :deep(button) {
    width: 100%;
  }
  .staff-name-input,
  .procedure-select {
    width: 100%;
  }
}
</style>
