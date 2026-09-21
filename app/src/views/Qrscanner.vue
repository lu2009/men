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
    <header class="scanner-page-header">
      <div class="scanner-page-header__copy">
        <div class="scanner-page-header__eyebrow">车间作业台</div>
        <h1>扫码生产</h1>
        <p>确认操作员与工序后，连续扫描门单并批量提交生产进度。</p>
      </div>
      <div class="scanner-state" :class="{ 'scanner-state--active': scanning }" aria-live="polite">
        <span class="scanner-state__dot" aria-hidden="true"></span>
        <span>{{ scanning ? '相机扫描中' : '等待作业' }}</span>
      </div>
    </header>

    <section class="workstation-card" aria-labelledby="workstation-title">
      <div class="section-heading workstation-card__heading">
        <div>
          <span class="section-heading__kicker">生产录入</span>
          <h2 id="workstation-title">本次作业</h2>
        </div>
        <p>员工名称同时用于扫码统计筛选，工序将写入已选门单。</p>
      </div>

      <div class="workstation-layout">
        <div class="operator-fields">
          <label class="field-block">
            <span class="field-block__label"><b>1</b> 操作员</span>
            <n-input
              v-model:value="staffName"
              class="staff-name-input"
              size="large"
              placeholder="请输入员工名称"
              @blur="saveStaffName"
            />
            <span class="field-block__hint">名称会保存在本机，下一次自动带入</span>
          </label>

          <label class="field-block">
            <span class="field-block__label"><b>2</b> 当前工序</span>
            <n-select
              v-model:value="procedureSlot"
              class="procedure-select"
              size="large"
              placeholder="请选择要录入的工序"
              :options="procedureOptions"
            />
            <span class="field-block__hint">仅显示已配置名称的工序</span>
          </label>
        </div>

        <div class="action-panel">
          <div class="action-panel__label"><b>3</b> 开始录入</div>
          <div class="entry-actions">
            <n-button
              v-if="!scanning"
              type="primary"
              size="large"
              class="primary-scan-action"
              :loading="submitting"
              @click="startScanEntry"
            >
              <template #icon>
                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M7 12h10" />
                </svg>
              </template>
              扫码录单
            </n-button>
            <n-button v-else type="primary" size="large" class="primary-scan-action stop-action" @click="stopScan">
              <template #icon>
                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="7" y="7" width="10" height="10" rx="2" />
                </svg>
              </template>
              停止扫码
            </n-button>

            <n-button size="large" class="secondary-entry-action" @click="openManual('entry')">
              <template #icon>
                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7.5h16v11H4zM7 11h.01M10.5 11h.01M14 11h.01M17 11h.01M7 14.5h.01M10.5 14.5h6.5" />
                </svg>
              </template>
              手动录单
            </n-button>
          </div>

          <div class="query-actions" aria-label="查单工具">
            <n-button :loading="querying" class="query-action" @click="startScanQuery">
              <template #icon>
                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="5.5" />
                  <path d="m15 15 5 5M8 8.5h5M8 11h3" />
                </svg>
              </template>
              扫码查单
            </n-button>
            <n-button :loading="querying" class="query-action" @click="openManual('query')">
              <template #icon>
                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 16h5" />
                </svg>
              </template>
              手动查单
            </n-button>
          </div>

          <div class="utility-actions">
            <n-button v-if="canEditProcedures(auth.user?.role)" text class="utility-action" @click="settingsShow = true">
              <template #icon>
                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19 13.5v-3l-2-.7-.6-1.4.9-1.9-2.1-2.1-1.9.9-1.4-.6-.7-2h-3l-.7 2-1.4.6-1.9-.9-2.1 2.1.9 1.9-.6 1.4-2 .7v3l2 .7.6 1.4-.9 1.9 2.1 2.1 1.9-.9 1.4.6.7 2h3l.7-2 1.4-.6 1.9.9 2.1-2.1-.9-1.9.6-1.4z" />
                </svg>
              </template>
              设置工序
            </n-button>

            <span class="pending-slot" @click="notYet('扫码账号管理', '给车间同事开扫码账号、停用旧账号')">
              <n-button text disabled class="utility-action">扫码账号管理 · 尚未开放</n-button>
            </span>
          </div>
        </div>
      </div>
    </section>

    <section v-show="scanning" class="capture-card" aria-label="扫码取景器">
      <div class="capture-card__header">
        <div>
          <span class="section-heading__kicker">实时取景</span>
          <h2>将二维码放入取景框</h2>
        </div>
        <span class="capture-status"><i aria-hidden="true"></i>持续识别</span>
      </div>
      <div class="scanner-container">
        <video ref="videoRef" class="scanner-video" autoplay playsinline muted />
        <div class="scanner-frame" aria-hidden="true">
          <i class="scanner-corner scanner-corner--tl"></i>
          <i class="scanner-corner scanner-corner--tr"></i>
          <i class="scanner-corner scanner-corner--bl"></i>
          <i class="scanner-corner scanner-corner--br"></i>
          <span class="scanner-line"></span>
        </div>
      </div>
      <p class="capture-card__hint">识别成功后会自动加入下方清单，可连续扫描多个门单。</p>
    </section>

    <section v-if="codes.length > 0" class="scan-results" aria-labelledby="result-title">
      <div class="scan-results__header">
        <div>
          <span class="section-heading__kicker">待提交批次</span>
          <h2 id="result-title">已选择 {{ checked.length }} 个门单</h2>
          <p>本批共识别 {{ codes.length }} 个，请核对并勾选需要提交的门单。</p>
        </div>
        <div class="result-toolbar">
          <n-button class="print-btn" :loading="printing" @click="printLabels">
            <template #icon>
              <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z" />
              </svg>
            </template>
            打印标签
          </n-button>
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
      </div>

      <n-checkbox-group v-model:value="checked" class="result-list">
        <label v-for="code in codes" :key="code" class="result-item">
          <n-checkbox :value="code" />
          <span class="result-item__code">{{ code }}</span>
          <span class="result-item__state">{{ checked.includes(code) ? '已选' : '待选择' }}</span>
        </label>
      </n-checkbox-group>

      <div class="result-submit-bar">
        <div class="result-submit-bar__summary">
          <span>当前工序</span>
          <strong>{{ selectedName || '尚未选择' }}</strong>
        </div>
        <n-button type="primary" size="large" class="submit-progress-action" :loading="submitting" @click="submitProgress">
          确认提交 {{ checked.length ? `${checked.length} 个` : '' }}
        </n-button>
      </div>
    </section>

    <section class="stats-section" aria-labelledby="stats-title">
      <div class="stats-section__header">
        <div>
          <span class="section-heading__kicker">生产统计</span>
          <h2 id="stats-title">扫码记录</h2>
          <p>按日期范围查看当前员工或全部员工的扫码产量。</p>
        </div>
        <div class="date-range-actions" aria-label="统计日期范围">
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

      <div v-if="!statsOpen" class="stats-empty">
        <div class="stats-empty__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 19V9M12 19V5M19 19v-7M3 19h18" />
          </svg>
        </div>
        <div>
          <strong>选择时间范围查看统计</strong>
          <p>也可以通过“扫码查单”或“手动查单”查看单个门单。</p>
        </div>
      </div>

      <ScanStatsPanel
        v-if="statsOpen"
        :rows="statsRows"
        :title="statsTitle"
        :employee="statsEmployee"
        :procedures="procedures"
      />
    </section>

    <n-modal
      v-model:show="manualShow"
      preset="card"
      :title="manualMode === 'query' ? '手动查单' : '手动录入单号'"
      class="manual-modal"
      :bordered="false"
      :mask-closable="false"
    >
      <div class="manual-form">
        <label class="manual-field manual-field--wide">
          <span class="manual-label">单号</span>
          <n-input
            v-model:value="manual.number"
            placeholder="请输入单号数字"
            :maxlength="10"
            @input="onNumberInput"
          />
        </label>
        <div class="manual-date-grid">
          <label class="manual-field">
            <span class="manual-label">年</span>
            <n-select v-model:value="manual.year" :options="yearOptions" placeholder="年" filterable tag />
          </label>
          <label class="manual-field">
            <span class="manual-label">月</span>
            <n-select v-model:value="manual.month" :options="monthOptions" placeholder="月" filterable tag />
          </label>
          <label class="manual-field">
            <span class="manual-label">日</span>
            <n-input v-model:value="manual.day" placeholder="日" :maxlength="2" @input="onDayInput" />
          </label>
        </div>

        <div v-if="yearPrefilled" class="manual-hint">已预填当前年份，请按门单日期确认。</div>

        <div class="manual-preview">
          <span>将要{{ manualMode === 'query' ? '查询' : '录入' }}</span>
          <code>{{ manualPreview }}</code>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <n-button @click="manualShow = false">取消</n-button>
          <n-button type="primary" :loading="querying" @click="confirmManual">
            {{ manualMode === 'query' ? '查询门单' : '加入清单' }}
          </n-button>
        </div>
      </template>
    </n-modal>

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
.qr-scanner {
  min-height: calc(100vh - var(--app-header-h));
  padding: var(--sd-space-8) var(--sd-page-padding) var(--sd-space-12);
  background: var(--sd-color-bg-page);
  color: var(--sd-color-text);
  font-family: var(--sd-font-sans);
}

.scanner-page-header,
.workstation-card,
.capture-card,
.scan-results,
.stats-section {
  box-sizing: border-box;
  width: min(100%, 1120px);
  margin-inline: auto;
}

.scanner-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sd-space-6);
  margin-bottom: var(--sd-space-5);
}

.scanner-page-header__eyebrow,
.section-heading__kicker {
  display: block;
  margin-bottom: var(--sd-space-1);
  color: var(--sd-color-action);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: var(--sd-letter-spacing-eyebrow);
  line-height: var(--sd-line-height-tight);
  text-transform: uppercase;
}

.scanner-page-header h1,
.section-heading h2,
.capture-card__header h2,
.scan-results__header h2,
.stats-section__header h2 {
  margin: 0;
  color: var(--sd-color-text-strong);
  font-weight: var(--sd-font-weight-bold);
  line-height: var(--sd-line-height-tight);
}

.scanner-page-header h1 {
  font-size: clamp(var(--sd-font-size-2xl), 3vw, var(--sd-font-size-3xl));
  letter-spacing: -0.035em;
}

.scanner-page-header p,
.section-heading p,
.scan-results__header p,
.stats-section__header p,
.capture-card__hint,
.stats-empty p {
  margin: var(--sd-space-2) 0 0;
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-sm);
  line-height: var(--sd-line-height-base);
}

.scanner-state {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--sd-space-2);
  min-height: var(--sd-control-height-medium);
  padding: 0 var(--sd-space-3);
  border: var(--sd-border-width) solid var(--sd-color-border);
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-bg-surface);
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-medium);
  box-shadow: var(--sd-shadow-sm);
  transition:
    color var(--sd-duration-base) var(--sd-ease-standard),
    border-color var(--sd-duration-base) var(--sd-ease-standard),
    background var(--sd-duration-base) var(--sd-ease-standard);
}

.scanner-state__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-text-disabled);
}

.scanner-state--active {
  border-color: var(--sd-color-process-border);
  background: var(--sd-color-process-soft);
  color: var(--sd-color-process);
}

.scanner-state--active .scanner-state__dot {
  background: var(--sd-color-success);
  box-shadow: var(--sd-shadow-status-soft);
  animation: status-pulse var(--sd-duration-ambient) var(--sd-ease-standard) infinite;
}

.workstation-card,
.capture-card,
.scan-results {
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  border-radius: var(--sd-radius-material);
  background: var(--sd-material-surface-strong);
  box-shadow: var(--sd-shadow-material-card);
  backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
}

.workstation-card {
  padding: var(--sd-space-6);
}

.section-heading,
.scan-results__header,
.stats-section__header,
.capture-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sd-space-5);
}

.section-heading h2,
.capture-card__header h2,
.scan-results__header h2,
.stats-section__header h2 {
  font-size: var(--sd-font-size-xl);
  letter-spacing: -0.02em;
}

.workstation-card__heading {
  padding-bottom: var(--sd-space-5);
  border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
}

.workstation-card__heading p {
  max-width: 420px;
  margin-top: var(--sd-space-1);
  text-align: right;
}

.workstation-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.82fr);
  gap: var(--sd-space-6);
  padding-top: var(--sd-space-6);
}

.operator-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sd-space-4);
  align-content: start;
}

.field-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--sd-space-2);
}

.field-block__label,
.action-panel__label {
  display: flex;
  align-items: center;
  gap: var(--sd-space-2);
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
}

.field-block__label b,
.action-panel__label b {
  display: inline-grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-action-soft);
  color: var(--sd-color-action);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-bold);
}

.field-block__hint {
  min-height: 1.4em;
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  line-height: var(--sd-line-height-tight);
}

.staff-name-input,
.procedure-select {
  width: 100%;
}

.staff-name-input :deep(.n-input-wrapper),
.procedure-select :deep(.n-base-selection) {
  transition:
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard),
    transform var(--sd-duration-fast) var(--sd-ease-standard);
}

.staff-name-input:focus-within :deep(.n-input-wrapper),
.procedure-select:focus-within :deep(.n-base-selection) {
  box-shadow: var(--sd-focus-ring-soft);
}

.action-panel {
  display: flex;
  flex-direction: column;
  gap: var(--sd-space-3);
  padding-left: var(--sd-space-6);
  border-left: var(--sd-border-width) solid var(--sd-color-divider);
}

.entry-actions,
.query-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sd-space-2);
}

.entry-actions {
  margin-top: var(--sd-space-1);
}

.primary-scan-action,
.secondary-entry-action,
.query-action,
.submit-progress-action {
  min-width: 0;
  font-weight: var(--sd-font-weight-strong);
}

.primary-scan-action {
  box-shadow: var(--sd-shadow-action);
}

.primary-scan-action:hover {
  transform: translateY(var(--sd-motion-hover-y));
  box-shadow: var(--sd-shadow-action-hover);
}

.primary-scan-action:active {
  transform: scale(var(--sd-motion-press-scale));
  box-shadow: var(--sd-shadow-action-pressed);
}

.stop-action {
  --n-color: var(--sd-color-danger) !important;
  --n-color-hover: var(--sd-color-danger-hover) !important;
  --n-color-pressed: var(--sd-color-danger-pressed) !important;
  --n-border: var(--sd-border-width) solid var(--sd-color-danger) !important;
  --n-border-hover: var(--sd-border-width) solid var(--sd-color-danger-hover) !important;
  --n-border-pressed: var(--sd-border-width) solid var(--sd-color-danger-pressed) !important;
}

.query-action {
  --n-color: var(--sd-color-bg-subtle) !important;
  --n-color-hover: var(--sd-color-bg-hover) !important;
  --n-color-pressed: var(--sd-color-bg-pressed) !important;
  --n-border: var(--sd-border-width) solid var(--sd-color-divider) !important;
  --n-border-hover: var(--sd-border-width) solid var(--sd-color-action-border) !important;
  --n-text-color: var(--sd-color-text-strong) !important;
  --n-text-color-hover: var(--sd-color-action) !important;
}

.action-icon {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.utility-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sd-space-3);
  padding-top: var(--sd-space-1);
}

.utility-action {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

.pending-slot {
  display: inline-flex;
  cursor: not-allowed;
}

.pending-slot :deep(button) {
  pointer-events: none;
}

.capture-card,
.scan-results,
.stats-section {
  margin-top: var(--sd-space-5);
}

.capture-card {
  padding: var(--sd-space-5);
  animation: surface-enter var(--sd-duration-enter) var(--sd-ease-enter) both;
}

.capture-card__header {
  align-items: center;
  margin-bottom: var(--sd-space-4);
}

.capture-status {
  display: inline-flex;
  align-items: center;
  gap: var(--sd-space-2);
  color: var(--sd-color-process);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
}

.capture-status i {
  width: 8px;
  height: 8px;
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-success);
  box-shadow: var(--sd-shadow-status);
}

.scanner-container {
  position: relative;
  width: min(100%, 480px);
  aspect-ratio: 1;
  margin: 0 auto;
  overflow: hidden;
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-card);
  background: var(--sd-color-text-strong);
  box-shadow: var(--sd-shadow-material-art);
}

.scanner-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner-frame {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.scanner-frame::before {
  position: absolute;
  inset: 13%;
  border: var(--sd-border-width) solid var(--sd-material-highlight-soft);
  border-radius: var(--sd-radius-control);
  content: '';
}

.scanner-corner {
  position: absolute;
  width: 36px;
  height: 36px;
  border-color: var(--sd-color-action);
  border-style: solid;
  filter: drop-shadow(0 0 6px var(--sd-color-action));
}

.scanner-corner--tl {
  top: 13%;
  left: 13%;
  border-width: 3px 0 0 3px;
  border-radius: var(--sd-radius-sm) 0 0 0;
}

.scanner-corner--tr {
  top: 13%;
  right: 13%;
  border-width: 3px 3px 0 0;
  border-radius: 0 var(--sd-radius-sm) 0 0;
}

.scanner-corner--bl {
  bottom: 13%;
  left: 13%;
  border-width: 0 0 3px 3px;
  border-radius: 0 0 0 var(--sd-radius-sm);
}

.scanner-corner--br {
  right: 13%;
  bottom: 13%;
  border-width: 0 3px 3px 0;
  border-radius: 0 0 var(--sd-radius-sm) 0;
}

.scanner-line {
  position: absolute;
  top: 16%;
  right: 16%;
  left: 16%;
  height: 2px;
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-action);
  box-shadow: var(--sd-focus-ring);
  animation: scanner-sweep var(--sd-duration-ambient) var(--sd-ease-standard) infinite alternate;
}

.capture-card__hint {
  text-align: center;
}

.scan-results {
  padding: var(--sd-space-6);
  animation: surface-enter var(--sd-duration-enter) var(--sd-ease-enter) both;
}

.scan-results__header {
  align-items: center;
  padding-bottom: var(--sd-space-5);
  border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
}

.result-toolbar {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sd-space-3);
}

.fixed-count {
  display: inline-flex;
  min-height: var(--sd-control-height-medium);
  align-items: center;
  gap: var(--sd-space-2);
  padding: 0 var(--sd-space-3);
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-control);
  background: var(--sd-color-bg-subtle);
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-xs);
}

.fixed-count-input {
  width: 76px;
}

.result-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sd-space-2);
  max-height: 360px;
  margin-top: var(--sd-space-4);
  overflow: auto;
  overscroll-behavior: contain;
}

.result-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--sd-space-3);
  min-height: var(--sd-control-height-prominent);
  padding: var(--sd-space-2) var(--sd-space-3);
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-control);
  background: var(--sd-color-bg-surface);
  cursor: pointer;
  transition:
    border-color var(--sd-duration-fast) var(--sd-ease-standard),
    background var(--sd-duration-fast) var(--sd-ease-standard),
    transform var(--sd-duration-fast) var(--sd-ease-standard);
}

.result-item:hover {
  border-color: var(--sd-color-action-border);
  background: var(--sd-color-action-soft);
  transform: translateY(var(--sd-motion-hover-y));
}

.result-item__code {
  overflow: hidden;
  color: var(--sd-color-text-strong);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-item__state {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

.result-submit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sd-space-4);
  margin-top: var(--sd-space-5);
  padding-top: var(--sd-space-5);
  border-top: var(--sd-border-width) solid var(--sd-color-divider);
}

.result-submit-bar__summary {
  display: flex;
  flex-direction: column;
  gap: var(--sd-space-1);
  min-width: 0;
}

.result-submit-bar__summary span {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

.result-submit-bar__summary strong {
  overflow: hidden;
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submit-progress-action {
  min-width: 180px;
  box-shadow: var(--sd-shadow-action);
}

.stats-section {
  padding-top: var(--sd-space-6);
  border-top: var(--sd-border-width) solid var(--sd-color-divider);
}

.stats-section__header {
  align-items: flex-end;
}

.date-range-actions {
  display: inline-flex;
  flex: 0 0 auto;
  gap: var(--sd-space-1);
  padding: var(--sd-space-1);
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-control);
  background: var(--sd-material-control);
}

.range-btn {
  min-width: 56px;
  min-height: var(--sd-control-height-small);
  padding-inline: var(--sd-space-3);
  border-radius: var(--sd-radius-sm);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-medium);
  transition:
    color var(--sd-duration-fast) var(--sd-ease-standard),
    background var(--sd-duration-fast) var(--sd-ease-standard),
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard);
}

.range-btn.active {
  background: var(--sd-color-bg-surface);
  color: var(--sd-color-action);
  box-shadow: var(--sd-shadow-sm);
}

.custom-date-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sd-space-2);
  margin-top: var(--sd-space-3);
  padding: var(--sd-space-3);
  border: var(--sd-border-width) solid var(--sd-color-divider);
  border-radius: var(--sd-radius-control);
  background: var(--sd-color-bg-subtle);
}

.range-sep {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-sm);
}

.stats-empty {
  display: flex;
  align-items: center;
  gap: var(--sd-space-4);
  margin-top: var(--sd-space-5);
  padding: var(--sd-space-5);
  border: var(--sd-border-width) dashed var(--sd-color-border);
  border-radius: var(--sd-radius-card);
  background: var(--sd-color-bg-subtle);
}

.stats-empty__mark {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--sd-radius-control);
  background: var(--sd-color-action-soft);
  color: var(--sd-color-action);
}

.stats-empty__mark svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.stats-empty strong {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-md);
}

.manual-modal {
  width: min(92vw, 460px);
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  border-radius: var(--sd-radius-material);
  background: var(--sd-material-surface-strong);
  box-shadow: var(--sd-shadow-material-shell);
  backdrop-filter: blur(var(--sd-glass-blur-lg)) saturate(var(--sd-glass-saturation-strong));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-lg)) saturate(var(--sd-glass-saturation-strong));
}

.manual-form {
  display: flex;
  flex-direction: column;
  gap: var(--sd-space-4);
}

.manual-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--sd-space-2);
}

.manual-label {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
}

.manual-date-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: var(--sd-space-3);
}

.manual-hint {
  padding: var(--sd-space-2) var(--sd-space-3);
  border-radius: var(--sd-radius-sm);
  background: var(--sd-color-warning-soft);
  color: var(--sd-color-warning-pressed);
  font-size: var(--sd-font-size-xs);
  line-height: var(--sd-line-height-base);
}

.manual-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sd-space-4);
  padding: var(--sd-space-3) var(--sd-space-4);
  border: var(--sd-border-width) solid var(--sd-color-action-border);
  border-radius: var(--sd-radius-control);
  background: var(--sd-color-action-soft);
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-sm);
}

.manual-preview code {
  color: var(--sd-color-action-pressed);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-md);
  font-weight: var(--sd-font-weight-bold);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--sd-space-2);
}

@keyframes status-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.18);
  }
}

@keyframes scanner-sweep {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(300px);
  }
}

@keyframes surface-enter {
  from {
    opacity: 0;
    transform: translateY(var(--sd-motion-enter-y));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .workstation-layout {
    grid-template-columns: 1fr;
  }

  .action-panel {
    padding-top: var(--sd-space-5);
    padding-left: 0;
    border-top: var(--sd-border-width) solid var(--sd-color-divider);
    border-left: 0;
  }

  .stats-section__header {
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .qr-scanner {
    padding-top: var(--sd-space-5);
    padding-bottom: var(--sd-space-8);
  }

  .scanner-page-header {
    align-items: flex-start;
    margin-bottom: var(--sd-space-4);
  }

  .scanner-page-header p {
    max-width: 260px;
  }

  .scanner-state {
    min-height: var(--sd-control-height-small);
    padding-inline: var(--sd-space-2-5);
    font-size: var(--sd-font-size-xs);
  }

  .workstation-card,
  .capture-card,
  .scan-results {
    border-radius: var(--sd-radius-card);
  }

  .workstation-card,
  .scan-results {
    padding: var(--sd-space-4);
  }

  .workstation-card__heading,
  .scan-results__header,
  .stats-section__header {
    flex-direction: column;
    gap: var(--sd-space-3);
  }

  .workstation-card__heading p {
    max-width: none;
    text-align: left;
  }

  .workstation-layout {
    gap: var(--sd-space-5);
    padding-top: var(--sd-space-5);
  }

  .operator-fields {
    grid-template-columns: 1fr;
    gap: var(--sd-space-4);
  }

  .field-block__hint {
    min-height: 0;
  }

  .entry-actions,
  .query-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .entry-actions :deep(.n-button),
  .query-actions :deep(.n-button) {
    width: 100%;
  }

  .primary-scan-action {
    min-height: var(--sd-control-height-prominent);
  }

  .utility-actions {
    align-items: flex-start;
    flex-direction: column;
    justify-content: flex-start;
    gap: var(--sd-space-1);
  }

  .pending-slot {
    max-width: 100%;
  }

  .capture-card {
    padding: var(--sd-space-3);
  }

  .capture-card__header {
    padding: var(--sd-space-1);
  }

  .capture-status {
    font-size: var(--sd-font-size-xs);
  }

  .scanner-container {
    border-radius: var(--sd-radius-control);
  }

  .scanner-line {
    animation-name: scanner-sweep-mobile;
  }

  .result-toolbar {
    width: 100%;
    justify-content: flex-start;
  }

  .result-list {
    grid-template-columns: 1fr;
    max-height: 300px;
  }

  .result-submit-bar {
    position: sticky;
    bottom: calc(var(--sd-shell-mobile-dock-reserve) - var(--sd-space-2));
    z-index: 2;
    margin-inline: calc(var(--sd-space-4) * -1);
    margin-bottom: calc(var(--sd-space-4) * -1);
    padding: var(--sd-space-3) var(--sd-space-4);
    border-top-color: var(--sd-border-glass-divider);
    border-radius: 0 0 var(--sd-radius-card) var(--sd-radius-card);
    background: var(--sd-material-surface);
    box-shadow: var(--sd-shadow-md);
    backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
    -webkit-backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
  }

  .submit-progress-action {
    min-width: 154px;
  }

  .stats-section {
    padding-top: var(--sd-space-5);
  }

  .stats-section__header {
    align-items: stretch;
  }

  .date-range-actions {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .range-btn {
    min-width: 0;
    padding-inline: var(--sd-space-1);
  }

  .custom-date-picker {
    align-items: stretch;
    justify-content: stretch;
  }

  .custom-date-picker :deep(.n-date-picker) {
    width: 100%;
  }

  .range-sep {
    display: none;
  }

  .stats-empty {
    align-items: flex-start;
    padding: var(--sd-space-4);
  }

  .manual-date-grid {
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: var(--sd-space-2);
  }
}

@media (max-width: 430px) {
  .scanner-page-header {
    gap: var(--sd-space-3);
  }

  .scanner-page-header h1 {
    font-size: var(--sd-font-size-2xl);
  }

  .scanner-page-header p {
    max-width: 230px;
  }

  .scanner-state span:last-child {
    max-width: 58px;
    line-height: var(--sd-line-height-tight);
  }

  .entry-actions {
    grid-template-columns: 1fr;
  }

  .query-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .fixed-count {
    width: 100%;
    justify-content: flex-start;
  }

  .result-submit-bar__summary {
    max-width: 38%;
  }

  .submit-progress-action {
    min-width: 0;
  }

  .manual-date-grid {
    grid-template-columns: 1fr;
  }
}

@keyframes scanner-sweep-mobile {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(62vw);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scanner-state--active .scanner-state__dot,
  .scanner-line {
    animation: none;
  }
}
</style>
