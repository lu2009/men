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
    | 5 | 扫码查单 / 手动查单 | ✅ `GET /v1/scan/qrcode`（**窄接口，只回命中的行**，见下） |
    | 6 | 扫码统计看板（3 KPI + 按工序统计 + 26 列详情 + 导出 CSV） | ✅ `components/ScanStatsPanel.vue` + `GET /v1/scan/stats` |
    | 7 | 标签云打印（`getLabelData` + 云打印） | ✅ 数据面 `POST /v1/scan/labels`；**打印走浏览器**（见下） |
    | 8 | 扫码账号管理（`AddScanner` / `DeleteScanner`） | ⛔ **置灰** —— 后端**决定不做**，见下 |
    | 9 | 两块死代码面板（「🔧 调试信息」「⚙️ QR码识别高级设置」） | **不做**（旧版 `ref(false)` 全文零赋值，分析文档 §2.3–2.5） |
    | 10 | 「指定打印机」弹窗（仅租户名 `恒泰智门`） | **不做** —— 那是**云打印**的选打印机，本版走浏览器打印，没有「打印机名」这个概念 |

    ### ★ 第 5 / 6 条：两条窄接口（2026-09-19 用户纠正后改回）

    **旧版每次扫码只请求「命中的那几行」，本版一度改成「拉全量 + 前端筛」——错了，已改回。**

    原来那版（连同它的理由）是：`GET /v1/progress` 已经返回全量门行连 `单号` 一起，
    前端 `filter(单号)` / 前端按现推的扫码标记筛，**逐字等价**，再开一条就是重复造。

    ⚠️ **那个「等价」只在数值上成立，在数据面上不成立。** `GET /v1/progress` 是**整库门行**，
    每行带着客户名、金额、安装地址；而这一页跑在**车间工人的手机**上 ——
    等于扫一次码就把全库订单摊到那台手机上。旧版不给，我们也不该给。

    ⇒ 两条窄接口，**这页的取数面就是它们**：

    | 用途 | 端点 | 回什么 |
    |---|---|---|
    | 扫码查单 / 手动查单（第 5 条） | `GET /v1/scan/qrcode?code=<单号>` | 只回命中的行；找不到 **404** |
    | 统计看板（第 6 条） | `GET /v1/scan/stats?employee=&range=` | 只回**范围内**的行 |

    `range` 收 `当天` / `本周` / `本月` 或 `"起,止"` —— **日期标签原样传下去，前端不换算**。

    ### ★ 「扫码日期 / 扫码员工」的**现推只剩服务端一份**

    旧版 `getProcessCounts` 按行上的 `扫码日期` / `扫码员工` 筛，而新版**没有这两列**
    （分析文档 §8.6-(b)：不加列，读时从 `procedure_slots` 用 `parseScanMarker` 那个正则现推）。
    那个正则**要两个下划线**才匹配 ⇒ 只有 `/Qrscanner` 提交的 `工序名_员工名_日期` 算得进去，
    `/Progress` 页提交的 `工序名_日期` **不算**（看板统计的本来就是「扫码页干过的活」）。

    这段推导原先前端也有一份（`utils/scanStats.ts` 的 `deriveScanMarker`/`filterScanRows`），
    **已删干净**：数据不再全量给前端了，前端也就推不出来了；两处各留一份迟早会漂，
    而漂了**不报错**（只是行数不一样）。⇒ **推导归服务端，前端不许再加回来。**

    ### ★ 提交进度：把**单号**直接交给服务端（不再自己解析行 id）

    「确认」提交进度原先要的是**行 id**，而扫码端手里只有单号 ⇒ 一度也是拉全量建映射表。
    用户拍板改成 **`POST /v1/progress/update` 也收 `line_nos`**（与 `line_ids` 二选一、取并集）
    —— **因为旧版本来就是这么设计的**：旧版 `updataProgress` 的 body 就是单号数组
    （`progress.service.ts:598`），服务端拿 `rowRefs(row)` 去比。
    ⇒ 前端那个 `resolveLineIds()` **已删**，顺带省掉一次往返。**别加回来。**

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
    `login` / `logout` / `me` / `change-password` —— **没有「建号」这条产品线**。
    ★ **这里缺的是「账号语义」不是「端点」** —— 建出来的号登录后落在哪、能看到哪些菜单。

    ⚠️ **2026-09-19 更正**：这套语义**后来补上了** —— `utils/roles.ts` 把
    `role = 'scanner'` 映射成旧版 `defaulted = 2`（落地页 `/qrscanner`、路由闸门、
    「设置工序」只给 `admin` 的 `canEditProcedures`）。所以本段原先那句
    「`role` 也没有任何地方按它分支」**已经不成立**，别再引用它。
    **但结论不变**：建号端点仍然不是本版的产品线（分析文档 §8.6 的注记说，
    这块由**后端授权层**那一路接手）⇒ 这颗按钮继续**置灰**。
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
    新版把 `defaulted` 映射成 `role`（见 `utils/roles.ts`）：

    - **「设置工序」= 只有 `admin`**（`canEditProcedures`）。依据旧版 §6.3 那张表：
      那颗按钮 `yt = (defaulted === 1)` 才显示 —— **`=2` 和 `0/其它` 都看不到**，
      不是只挡扫码账号。⚠️ 真正拦得住的是后端 `guard.rs` 的 `POST /v1/procedures`
      （scanner 白名单里没有它）；这里藏按钮只是别让人白填一遍再吃 403。
    - 扫码账号进得来这里（这是他的落地页），本页其余按钮对他照常可用 —— 那是**有意**的：
      扫码录单 / 查单 / 统计本来就是给他用的。
    - 「扫码账号管理」对所有角色都置灰，理由见上面第 8 条。
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

      <!-- 旧版 `yt`：`defaulted === 1` 才显示这颗。新栈映射成 `role === 'admin'`，
           见 `utils/roles.ts` 的 `canEditProcedures`（那里有完整依据）。 -->
      <n-button v-if="canEditProcedures(auth.user?.role)" type="info" @click="settingsShow = true">
        设置工序
      </n-button>

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
import { canEditProcedures } from '../utils/roles'
import ProcedureSettingsDialog from '../components/ProcedureSettingsDialog.vue'
import ScanStatsPanel from '../components/ScanStatsPanel.vue'
import { type ScanDateLabel } from '../utils/scanStats'
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

// ===== 统计查询（旧版 `Zl` → `GET /v1/scan/stats`，服务端筛）=====
const statsOpen = ref(false)
/** 面板副标题里的日期口径（旧版 `zl`）。 */
const statsTitle = ref<string>('当天')
const statsEmployee = ref<string>('')
const statsRows = ref<ProgressRowDto[]>([])

/**
 * 查询扫码统计（旧版 `Zl`）。
 *
 * 与旧版同形：`param3 = {员工}`、`param4 = {当天|本周|本月|起,止}`，**由服务端筛**。
 * 本次（2026-09-19）改回**窄接口** `GET /v1/scan/stats`，只回范围内那几行。
 *
 * ⚠️ **日期标签原样传给服务端**（`当天`/`本周`/`本月` 三个字面量），不在前端换算成起止。
 *    换算口径（`本周` 从**周一**算起）与「扫码员工/扫码日期」的现推一样，
 *    服务端一份就够 —— 前端再写一份，两处迟早会漂，而漂了**不报错**（只是行数不一样）。
 *    只有「更多」这一支是我们自己在日期选择器里挑的**真实区间**，拼成 `"起,止"` 传下去。
 *
 * ⚠️ 员工参数仍是旧版那个哨兵：有名字就用名字，否则 `"1"`（= 全部员工，见 `queryEmployee`）。
 */
async function queryStats(mode: RangeLabel) {
  /** 传给服务端的 `range`：三个档位传字面标签，`更多` 传 `"起,止"`。 */
  let range: string
  /** 只有「更多」需要拿它拼面板副标题。 */
  let picked: [string, string] | null = null
  if (mode === '更多') {
    const r = validateRange()
    if (!r) return
    picked = r
    range = `${r[0]},${r[1]}`
  } else {
    // 显式标一次类型：`mode` 在这一支已被收窄成 `当天|本周|本月`，
    // 万一以后有人往 `RANGE_LABELS` 里加档位，这里会先报错，而不是把野值发出去。
    const label: ScanDateLabel = mode
    range = label
  }

  statsLoading.value = true
  try {
    // ⚠️ 这条的键是 `progressData`（与 `GET /v1/progress` 同名）—— **不是** `scanQrcode` 的 `rows`。
    const r = await api.scanStats(queryEmployee.value, range)
    const hit = r?.progressData ?? []
    statsRows.value = hit
    // 旧版副标题里就是 `zl` 那个档位名（选「更多」时显示的就是「更多」两个字）。
    // 这里「更多」改成显示实际区间 —— 比两个字有用，且不影响任何口径（有意的小改进）。
    statsTitle.value = picked ? `${picked[0]} 至 ${picked[1]}` : mode
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
 * 按单号查（旧版 `getScanQRcode`）—— 走 `GET /v1/scan/qrcode?code=`，**只回命中的那几行**。
 *
 * ## ★ 2026-09-19 改回来的（见文件头第 5 条）
 *
 * 本版一度改成「`GET /v1/progress` 拉全量 + 前端 `filter(单号)`」，理由是「逐字等价」。
 * 用户指出**数据面不等价**：全量门行带着客户名/金额/安装地址，而扫码页跑在**车间工人的手机**上；
 * 旧版每次扫码只请求命中的那几行。⇒ 回到旧版那条**纯过滤**接口。
 *
 * ⚠️ `404 = 没这条单号`（旧版服务端就是 404）。`request()` 把非 2xx 抛成带 `status` 的 `Error`
 *    ⇒ 404 走「未找到相关订单」这一支（旧版前端也是走 error 分支、**不打开**面板）；
 *    其它状态码（403/500…）原样显示服务端的话，别把它们也吞成「未找到」。
 */
async function runScanQuery(code: string) {
  const wanted = code.trim()
  if (!wanted) {
    message.warning('请提供单号')
    return
  }
  querying.value = true
  try {
    const r = await api.scanQrcode(wanted)
    const hit = r?.rows ?? []
    if (hit.length === 0) {
      // 服务端按契约是 404；真回了 200+空数组时给同一句提示，免得两种空结果说法不一样。
      message.error('未找到相关订单')
      return
    }
    message.success(`识别到二维码: ${wanted}`)
    // ⚠️ 「扫码日期」这一格**由服务端给**（旧版 `getScanQrCode` 走
    //    `enrichDoorRow(..., {gmtDate:true})`，行上本来就有这个键）。
    //    前端不再现推 —— 见 `utils/scanStats.ts` 里删掉 `deriveScanMarker` 的说明。
    statsRows.value = hit
    // 扫码查单没有日期口径，副标题给「扫码查单」；「· 员工 X」旧版这条路也不补 `查询员工`
    // （`ua` 只写 `Cl`，没有那句 `{...row, 查询员工}`）⇒ 这里同样不给员工。
    statsTitle.value = '扫码查单'
    statsEmployee.value = ''
    statsOpen.value = true
  } catch (e) {
    if ((e as { status?: number }).status === 404) {
      message.error('未找到相关订单')
      return
    }
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
 * 把勾选的单号 + 工序 + 值发给服务端。
 *
 * ## ★ 2026-09-19：**直接把单号交给服务端**，前端不再解析行 id
 *
 * 这里原先有个 `resolveLineIds()`：先用 `GET /v1/progress` 拉**全量**建「单号 → 行 id」的表
 * （后来改成借 `GET /v1/scan/qrcode` 批量解析），因为新版 `update` 接口只收 `line_ids`。
 * 用户拍板：**让 `update` 也收单号** —— 因为**旧版本来就是这么设计的**：
 *
 * ```ts
 * // progress.service.ts:598 —— 旧版 updataProgress 的 body 就是单号数组
 * export async function updateProgress(ds, procedureSlot, orderIds: string[], procedureValue = '')
 * ```
 * 旧服务端再拿 `rowRefs(row)` 去比（`单号`/`回执单号`/`orderNo`/`id` 都算命中）。我们对齐它：
 * `POST /v1/progress/update` 现在收 `line_ids` **或** `line_nos`（二选一、取并集）。
 *
 * ⇒ 顺带**省掉一次往返**，也就不用再建那张表了。**别把 `resolveLineIds` 加回来。**
 *
 * ⚠️ 传的是**行级单号**（二维码里装的那个），不是回执单号 —— 拿错了两头都不报错、只是改错行。
 */
async function submitProgress() {
  if (checked.value.length === 0) return void message.error('没有扫描结果可提交')
  if (staffName.value.trim() === '') return void message.error('请先输入员工名称')
  if (!procedureSlot.value || !selectedName.value) return void message.error('请先选择工序')

  submitting.value = true
  stop() // 旧版也是提交时先把摄像头关掉
  try {
    // 值的三段：`工序名_员工名_本地日期`（旧版是 UTC 日期，见文件头偏离 2）。
    // ⚠️ 这个「两个下划线」的形状正是统计看板认的标记（正则要两个下划线才匹配），
    //    **别把它改成 `工序名_日期`** —— 那样这些活就进不了扫码统计了。
    //    解析在服务端（`GET /v1/scan/stats`），前端没有副本，见 `utils/scanStats.ts` 的删除说明。
    const value = `${selectedName.value}_${staffName.value.trim()}_${todayYmd()}`
    const { updated, failed } = await api.updateProgress({
      slot: procedureSlot.value,
      value,
      lineNos: [...checked.value],
    })

    // 零命中服务端走 **400**（见下面 catch），所以正常路径上 `updated` 至少是 1。
    // 这一支兜的是**竞态**：单号在这一刻解析成了行 id，但 UPDATE 落地前那行被别人删了
    // ⇒ 200 且 `updated: 0`、`failed: []`。那时说「都找不到」比说「提交成功」正确得多。
    if (updated === 0) {
      message.error('这些单号在系统里都找不到，没法提交进度')
      return
    }
    // 「有 N 个单号找不到，已跳过」看 `failed`，**不靠异常** —— 部分命中是 200。
    if (failed.length) {
      message.warning(`有 ${failed.length} 个单号在系统里找不到，已跳过：${failed.join('、')}`)
    }

    message.success('提交成功')
    codes.value = []
    checked.value = []
  } catch (e) {
    // ★ 「一个都没对上」服务端回 **400**（`service.rs:407`）—— **这条是旧版口径**：
    //   旧版 `updateProgress` 也是 `failed.size > 0 && totalUpdated === 0` 才给 400
    //   （`progress.service.ts:654`）。差分台 ⑤ 段两边各跑一次比过，别再照注释猜。
    //
    // ⚠️ 对我们这个请求来说「400」与「零命中」是同一件事：单号一定非空（上面刚判过）、
    //    槽名一定合法（下拉来的 `工序N`）⇒ 这条 400 只可能是「一个都没对上」。
    if ((e as { status?: number }).status === 400) {
      message.error('这些单号在系统里都找不到，没法提交进度')
      return
    }
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
