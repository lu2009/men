<template>
  <div class="page">
    <!-- 命令行（仿旧版：清空 / 添加门类 / 保存回执单 / 3D画图 · 更多▾ 收高级入口） -->
    <div class="top-bar">
      <!--
        ⚠️ 本排按钮**不写 `size`** —— 这是照旧版的，不是漏写。

        旧版工具栏每一颗都是 `size:"default"`（`H:745331` / `H:745573` / `H:745986` / `H:746380` …
        全是 token `a(272)` = `"default"`）。naive-ui **没有 `"default"` 这个档**
        （只有 `tiny|small|medium|large`，默认就是 `medium`）⇒ 等价物是**不传 `size`**，
        而不是写一个 naive 不认的值。所以这里显式省略，别好心补 `size="small"`。
        （2026-09-19 之前本排写的是 `small`，比旧版小一号；见
        `docs/2026-09-19-hui-shell-audit.md` §2。）
      -->
      <div class="toolbar-row">
        <n-button @click="clearOrder">1.清空</n-button>
        <n-button type="error" @click="addTypeOpen = true">2.添加门类</n-button>
        <n-button type="warning" :loading="saving" @click="saveOrder">3.保存回执单</n-button>
        <n-tooltip>
          <template #trigger>
            <n-button disabled>3D画图</n-button>
          </template>
          3D 画图（本期后置，另行排期）
        </n-tooltip>
        <n-button @click="refreshPage">刷新</n-button>
        <!-- 旧版工具栏第二行是「刷新 · 视频」两颗（`H:12864-12870`，**都是裸字面量**）。
             我们先前把「视频」换成了自建的「更多功能 ▾」—— 那颗是偏离（见
             `docs/2026-09-19-hui-shell-audit.md` §5.1），但**「视频」本身是旧版有的，不该缺**。 -->
        <n-button @click="videoDrawer = true">视频</n-button>
        <span class="grow-spacer" />
        <!--
          ⚠️ 工具栏这一格先前放过一个「总余额显示」下拉，**2026-09-19 已挪回「添加门类」抽屉**
             （旧版 `_0x2ffe36` 全文件只在 `H:13302-13310` 出现 —— 它**只在那 200px 的抽屉里**，
             工具栏从来没有过）。控件本身一字未改，只是落点归位；顺带不再有两份入口。
             逐项说明见本文件「添加门类」抽屉那段。
        -->
        <n-dropdown
          trigger="click"
          :options="moreMenuOptions"
          @select="onMoreSelect"
        >
          <n-button>更多功能 ▾</n-button>
        </n-dropdown>
      </div>

      <!-- 客户/订单头：就地编辑表单行（仿旧版浅边框行） -->
      <div class="header-form">
        <div class="field">
          <span class="label">客户:</span>
          <n-select
            v-model:value="order.client_code"
            filterable
            clearable
            placeholder="输入客户信息"
            :options="clientOptions"
            style="width: 190px"
            @update:value="onClientChange"
          />
        </div>
        <div class="field">
          <span class="label">电话:</span>
          <n-input v-model:value="order.phone" style="width: 110px" placeholder="电话" />
        </div>
        <div class="field">
          <span class="label">安装地址:</span>
          <n-input v-model:value="order.install_address" size="small" style="width: 170px" placeholder="全局默认安装地址（行内为空时自动回填）" />
        </div>
        <!--
          备注 —— 旧版 `Hui.formatted.js:13072`（标签）/`:13073`（绑定 `_0x2f1634`，宽 150px）。
          ⚠️ 旧版这一格挂着 `_0x1b58e4.value ? … : 注释节点`。
          那个标志**只在 `defaulted === 3`（终端账号）那一支被置 `false`**（`:8218`），
          其余一律 `true`（初值 `Vue.ref(!0)`，`:7828`）。它同时门控着某个弹窗里的
          「微信分享(手机)」等按钮 —— 也就是「**非终端账号**」。
          **终端模式我们不做**（见 `docs/2026-09-19-progress-shell.md`）⇒ 对我们它恒为 true，
          所以这里**无条件显示**是对的，不是漏掉条件。

          ⚠️ 在补这一格之前，`order.remark` 是**端到端通的**（保存载荷 `:1417`、读回 `:1507`），
          只是**界面上没地方录** —— 旧版有，我们漏了。
        -->
        <div class="field">
          <span class="label">备注:</span>
          <n-input v-model:value="order.remark" size="small" style="width: 150px" placeholder="备注" />
        </div>
        <div class="field">
          <span class="label">业务员:</span>
          <n-input v-model:value="order.salesperson" style="width: 90px" placeholder="业务员" />
        </div>
        <div class="field">
          <span class="label">生产天数:</span>
          <!-- 旧版 `H:13084`：`min:1, controls:!1`（**不显示上下箭头**），宽 `a(639)="60px"` -->
          <n-input-number v-model:value="order.production_days" :min="1" :show-button="false" style="width: 60px" />
        </div>
        <div class="field">
          <span class="label">订金(元):</span>
          <!-- 旧版 `H:13090`：`min:0, controls:!1`，宽 `a(1011)="70px !important"` -->
          <n-input-number v-model:value="order.deposit" :min="0" :show-button="false" style="width: 70px" />
        </div>
        <div class="field">
          <span class="label">品牌:</span>
          <n-input v-model:value="order.brand" style="width: 90px" placeholder="品牌" />
        </div>
        <div class="field">
          <span class="label">日期:</span>
          <n-date-picker
            v-model:value="orderDateTs"
            type="date"
            size="small"
            style="width: 130px"
            @update:value="onOrderDate"
          />
        </div>
        <div class="field readonly-meta">
          <span class="label">编号:</span><b>{{ order.receipt_no || '（未生成）' }}</b>
          <span v-if="dueDate" class="due">截止 {{ dueDate }}</span>
        </div>
      </div>
    </div>

    <!-- 两表区域：平开门 / 移门左右并排网格（仿旧版） -->
    <div v-if="!showPing && !showDiao" class="empty-hint">
      点击顶部「2.添加门类」选择要录的门类（平开门 / 移门）。
    </div>

    <div class="tables-grid">
      <!-- 旧版没有表格标题栏：门型名是**操作列的表头**（`label:"平开门"/"移门"`）。
           这一条只留我们自己的「批量删除 / 隐藏」入口，不再是标题。 -->
      <!-- 明细表外壳已抽成 `components/DetailLinesTable.vue`（2026-09-19，步骤 3a）。
           搬走的是**模板 + 那 ~220 行表格 CSS**；列定义/单元格仍在下面（步骤 3b 再搬）。
           `scroll-x` 两表不同：平开 2000 / 移门 2200 —— 别统一。 -->
      <DetailLinesTable
        v-if="showPing"
        kind="ping"
        :rows="pingRows"
        :col-vis="pingColVis"
        :client="{ name: order.client_name, code: order.client_code }"
        :engine="engine"
        :saved-order-id="orderId"
        :selected-count="selectedLines.length"
        :filling="fillingLineNo"
        :hooks="detailHooks"
        @add-row="addRowOf('ping')"
        @batch-delete="batchDeleteRows"
        @toggle-show="toggleShow('ping')"
        @fill-line-numbers="fillLineNumbers"
      />

      <DetailLinesTable
        v-if="showDiao"
        kind="diao"
        :rows="diaoRows"
        :col-vis="diaoColVis"
        :client="{ name: order.client_name, code: order.client_code }"
        :engine="engine"
        :saved-order-id="orderId"
        :selected-count="selectedLines.length"
        :filling="fillingLineNo"
        :hooks="detailHooks"
        @add-row="addRowOf('diao')"
        @batch-delete="batchDeleteRows"
        @toggle-show="toggleShow('diao')"
      />
      <!-- 「 填入单号 」：旧版 Hui `:8491-8524` 那颗（文案 `_0x250a(1010)` = " 填入单号 "）。
           旧版走 `param1=getDiaoFormulas` 顺带返回 `data.orderNumbers{行id→单号}`；
           新版拆成独立端点 `POST /orders/{id}/fill-line-numbers`（有意偏离，理由见后端
           `service::fill_line_numbers`：那个老接口还兼着写副作用，混在一起既难测也危险）。
           ⚠️ **只有平开表有这颗按钮**，所以挂在 ping 那个实例上（组件内也是按 `kind` 判）。 -->
      <!-- 「 添加行 」在**表格下方**居中，蓝色实心带 + 图标（原版 :2635-2639：
           `div.table-footer > el-button.custom-button-btn(icon=plus) 文案 " 添加行 "`） -->
    </div>

    <!-- 底部合计条 -->
    <div class="totals-strip" v-if="lines.length">
      <n-tag v-if="showPing" size="small">平开门 {{ pingRows.reduce((s,l)=>s+(l.quantity||0),0) }} 樘 / ¥ {{ pingRows.reduce((s,l)=>s+(l.amount||0),0).toFixed(2) }}</n-tag>
      <n-tag v-if="showDiao" size="small">移门 {{ diaoRows.reduce((s,l)=>s+(l.quantity||0),0) }} 樘 / ¥ {{ diaoRows.reduce((s,l)=>s+(l.amount||0),0).toFixed(2) }}</n-tag>
      <span class="grand">合计 ¥ <b>{{ totalPrice.toFixed(2) }}</b> · 门数 {{ doorCount }}</span>
      <span class="bal">余款 ¥ {{ (totalPrice - (order.deposit || 0)).toFixed(2) }}</span>
    </div>

    <!--
      「视频教程」抽屉 —— 旧版 `H:13338-13376`：
        `<el-drawer title="视频教程" direction="rtl" size="300px">`（EP 的 `el-drawer` **默认带 ×**），
        里面一个 `div` 的 class 是 **`door-buttons`**（`_hoisted_38`，`H:7787`）—— 和「添加门类」
        抽屉**同一个 class**，所以同样是 `flex-column / gap:30px / padding:20px` + 按钮满宽。
        每颗按钮：`class:"custom-button-btn"`、**`round:""`（胶囊）**、`size:"default"`。
        ⚠️ 2026-09-19 更正：先前这里写着「`custom-button-btn` 的样式不在 Hui 的 scope 里 ⇒
        在本页等于没有样式」—— **是错的**。`legacy/css/Hui-39b802eb.css` 里
        `.custom-button-btn[data-v-f7f86ced]{background-color:#7caaf3;color:#fff;border-color:#7caaf3}`
        （`:hover/:focus` → `#0965fa`），而 `f7f86ced` 正是 `.door-buttons` 那个 scope id
        ⇒ **这条规则在 Hui 页是生效的**，9 颗按钮是蓝底白字。
        （真正在本页没样式的是 `connected-btn` —— 它只长在 `setting-95715826.css` 里。）
        条目取自 `_0x1ca662` 的名字→链接表（`H:12872` 起，9 条）。

      ⚠️ 2026-09-19 修：先前写的是 `<n-drawer title="视频教程">` —— **`n-drawer` 根本没有
         `title` 属性**（那是 `n-drawer-content` 的），所以这个 prop 直接漏成了根元素上的一个
         HTML 属性，**标题和 × 都没渲染出来**（`DrawerContent.mjs` 只在
         `$slots.header || title || closable` 时才画表头）。同时按钮写成了 `size="small"`、
         外层 div 用的是**没有 CSS 定义的** `.video-list`（唯一一处），所以 9 颗按钮**没有间距**。
         三处一并按旧版改：`n-drawer-content title` + `closable`（EP 默认有 ×）、
         `round` + 不写 `size`、class 换成 `.door-buttons`。
    -->
    <n-drawer v-model:show="videoDrawer" placement="right" :width="300">
      <n-drawer-content title="视频教程" closable>
        <div class="door-buttons">
          <n-button
            v-for="[label, link] in VIDEO_LINKS"
            :key="label"
            class="custom-button-btn"
            round
            block
            @click="openVideo(link)"
          >
            {{ label }}
          </n-button>
        </div>
      </n-drawer-content>
    </n-drawer>

    <!--
      「添加门类」抽屉 —— 逐项照 `H:13276-13336`，**8 项**，一件不多一件不少：

        1. 平开门            `:type="showPing ? 'danger' : 'info'"`  `@click="_0x431f92('pingkai')"`
        2. 移门              `:type="showDiao ? 'danger' : 'info'"`  `@click="_0x431f92('diao')"`
        3. 导入上次订单      `type="warning"`                        `@click="importLastOrder"`
        4. 加价项目管理      `type="info"` `class="orange-button"`   `@click="_0x5e1bf7"` → 开管理弹窗
        5. 自动加价设置      `type="primary"`                        `@click="_0x38bc9b"` → 开设置弹窗
        6. 总余额显示        下拉（见下）
        7. 排序方式          `type="success"`                        `@click="_0xff1972"`
        8. 辅助菜单设置      下拉（见下）

      外壳：`direction:"rtl"` → `placement="right"`；`size:"200px"` → `:width="200"`；
      **`"show-close":!1` ⇒ 旧版没有 ×**，也没有 `title` —— EP 的 `el-drawer` 那时只有
      `show-close` 控制那一个 ×、标题栏随 `title` 有无。所以这里用**不带 `title`/`closable`
      的 `n-drawer-content`**（naive 两样都没有时不画表头），**关抽屉只能点遮罩** —— `n-drawer`
      的 `mask-closable` 默认就是 `true`，与旧版一致。

      ⚠️ **我们 2026-09-19 之前的三处偏离（现已全部归位）**：
        · 宽度写死 240（旧版 200）；
        · 加了 `title="添加门类"` + `closable`（旧版两样都没有）；
        · 只做了 3 项，且第 4/5/7/8 项被**搬到了工具栏的「更多功能 ▾」里**（见 §5.1、§8.6）。
          搬出去这件事本身还是偏离 —— 现在已经搬回抽屉，下拉里那三项同时删掉（不重复给两个入口）。

      ⚠️ **type 的取名差异**（全仓库统一，不是这里独有的偏离）：
        EP `danger` → naive **`error`**（naive 的 `ButtonType` 没有 `danger`）；
        EP `info`（**实心灰** `#909399`）→ naive `info`（**蓝** `#2080f0`）—— naive 没有灰色档，
        `default` 是浅灰描边而不是实心灰。**颜色对不上是全局调色板的事**（`App.vue` 只把
        `primaryColor` 覆盖成了 EP 的 `#409eff`，其余四档仍是 naive 原色），不在这一处单独修。

      ⚠️ **按钮满宽不是 `block` 抄来的**：旧版靠 `.door-buttons .el-button{width:100%}`
        （`legacy/css/Hui-39b802eb.css`）—— naive 的等价物正是 `block`，所以这里写 `block` 是对的。
        真实差异只有 `gap`/`padding`，在 `.door-buttons` 那条 CSS 里照抄。
        ⚠️ 旧版**没有** `size` 之外的档位问题：8 颗都是 `size:"default"` ⇒ 照本页惯例**不写 `size`**。

      ⚠️ 开关类控件的落点：旧版这两个开关**只在这个抽屉里**（`_0x2ffe36` 全文件只在
        `:13302-13310` 出现，「辅助菜单设置」同样）。我们先前把「总余额显示」做成了工具栏上的
        独立下拉，**现在按旧版归位到抽屉**（`§9` 的偏离①②作废）。
    -->
    <n-drawer v-model:show="addTypeOpen" placement="right" :width="200">
      <n-drawer-content>
        <div class="door-buttons">
          <n-button block :type="showPing ? 'error' : 'info'" @click="toggleShow('ping')">
            平开门
          </n-button>
          <n-button block :type="showDiao ? 'error' : 'info'" @click="toggleShow('diao')">
            移门
          </n-button>
          <n-button block type="warning" @click="importLastOrder">导入上次订单</n-button>
          <n-button block type="info" class="orange-button" @click="openMarkupMgmt">
            加价项目管理
          </n-button>
          <n-button block type="primary" @click="openAutoMarkup">自动加价设置</n-button>

          <!-- 6. 总余额显示 —— 旧版 `H:13298-13312`（下拉）+ `H:400056`（初始化 / onChange）。
               触发器文案「 总余额显示 」、开着时后面跟一个 ✓（`#67c23a`、`margin-left:5px`），
               按钮 `type` 随之在 `warning`（开）/ `default`（关）之间切换；
               浮层宽 **200**、`placement:"top"`、`trigger:"click"`，内容 `<div>` 是
               `{text-align:center; padding:10px}` + 提示语「开启后将在回执单中显示客户总余额」
               （`margin-bottom:12px`）+ 一个开关（`active-text:"开"` / `inactive-text:"关"`）。

               ⚠️ 旧版是 EP 的 `el-switch`（`active-text`/`inactive-text` 落在开关**左右两侧**、
               当前那一侧高亮）；naive 的 `n-switch` 没有文字属性 ⇒ 两侧文字自己画，样式照
               `legacy/css/element-plus-6bd3a0dc.css` 的 `.el-switch__label`
               （`font-size:14px; font-weight:500`、左右各 `10px` 外边距、`.is-active` 时
               `color: var(--el-color-primary)`）。

               口径（开关怎么存、余额怎么取、**为什么电子回执/分享页不显示它**）见
               `app/src/utils/totalBalance.ts` 的文件头。 -->
          <n-popover trigger="click" placement="top" :width="200" :show-arrow="false">
            <template #trigger>
              <n-button block :type="showTotalBalance ? 'warning' : 'default'">
                总余额显示<span v-if="showTotalBalance" class="total-balance-check">✓</span>
              </n-button>
            </template>
            <div class="total-balance-panel">
              <p class="total-balance-hint">开启后将在回执单中显示客户总余额</p>
              <span class="switch-label switch-label--left" :class="{ active: showTotalBalance }">开</span>
              <n-switch :value="showTotalBalance" @update:value="onTotalBalanceChange" />
              <span class="switch-label switch-label--right" :class="{ active: !showTotalBalance }">关</span>
            </div>
          </n-popover>

          <!-- 7. 排序方式 —— `H:13312-13315`：`type:"success"`，点了开「排序方式」弹窗
               （`_0xff1972` → `_0x24527c.value = !0`）。 -->
          <n-button block type="success" @click="openSortMethod">排序方式</n-button>

          <!-- 8. 辅助菜单设置 —— `H:13316-13335`：`type:"primary"`、`size:"default"`、
               `class:normalizeClass(["custom-button-btn", 开着 ? "connected-btn" : ""])`。
               两个 class 的区别（2026-09-19 更正）：`custom-button-btn` 的规则**在 Hui 的
               scope 里**（`.door-buttons` 用的同一个 `data-v-f7f86ced`）⇒ 它是蓝底白字；
               `connected-btn` 只在 `setting-95715826.css` 里 ⇒ 在本页没有样式，开着只是多个名字。
               浮层里：提示语「开启手机辅助菜单」+ 开关；**该开关开着时**再多一块
               「全面屏（不预留底部空间）」的开关（`_hoisted_36` = `{text-align:center;padding:10px}`，
               里面的 `<p>` 是 `{margin-bottom:10px; font-size:13px; color:#666}`）。
               两个开关都往 localStorage 写值 + 派 CustomEvent 给手机端外壳 —— 见
               `app/src/utils/assistiveMenu.ts`。 -->
          <n-popover trigger="click" placement="top" :width="200" :show-arrow="false">
            <template #trigger>
              <n-button
                block
                type="primary"
                :class="['custom-button-btn', showAssistiveMenu ? 'connected-btn' : '']"
              >
                辅助菜单设置<span v-if="showAssistiveMenu" class="total-balance-check">✓</span>
              </n-button>
            </template>
            <div class="total-balance-panel">
              <p class="total-balance-hint">开启手机辅助菜单</p>
              <span class="switch-label switch-label--left" :class="{ active: showAssistiveMenu }">开</span>
              <n-switch :value="showAssistiveMenu" @update:value="onAssistiveMenuChange" />
              <span class="switch-label switch-label--right" :class="{ active: !showAssistiveMenu }">关</span>
              <div v-if="showAssistiveMenu" class="fullscreen-row">
                <p class="fullscreen-hint">全面屏（不预留底部空间）</p>
                <span class="switch-label switch-label--left" :class="{ active: assistiveFullscreen }">开</span>
                <n-switch :value="assistiveFullscreen" @update:value="onAssistiveFullscreenChange" />
                <span class="switch-label switch-label--right" :class="{ active: !assistiveFullscreen }">关</span>
              </div>
            </div>
          </n-popover>
        </div>
      </n-drawer-content>
    </n-drawer>

    <!-- 新增加价项目 / 修改平方数 / 门图预览 / 门图名字 四个弹窗已抽到
         `components/DetailLineDialogs.vue`（状态在 `composables/useDetailLineDialogs.ts`）。
         Hui 与 Home 各挂一份 —— 明细表组件的 hooks 里这几个回调两边都要有。 -->
    <DetailLineDialogs :d="dialogs" />

    <!-- 加价项目管理：一个入口 → 两个按钮（复刻旧版 Hui.formatted.js:13107-13117，width 400 居中） -->
    <n-modal v-model:show="markupMgmtOpen" preset="card" title="加价项目管理" style="width: 400px" :bordered="false">
      <div class="footer" style="justify-content: center">
        <n-button type="primary" @click="openMarkupAdd">新增加价项目</n-button>
        <n-button type="warning" @click="openMarkupEdit">修改/删除加价项目</n-button>
      </div>
    </n-modal>

    <!-- 新增加价项目（目录，写后端）：width 500（旧版 :13119） -->
    <n-modal v-model:show="markupAddOpen" preset="card" title="新增加价项目" style="width: 500px">
      <div class="vis-col">
        <div class="mgmt-row">
          <span class="mgmt-name">加价项目</span>
          <n-input v-model:value="mgmtAdd.name" placeholder="请输入加价项目名称" style="flex: 1" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">单价</span>
          <n-input-number v-model:value="mgmtAdd.price" :show-button="false" min="0" placeholder="单价" style="width: 30%" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">计价方式</span>
          <n-select v-model:value="mgmtAdd.unit" :options="markupUnitOptions" style="width: 30%" />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="markupAddOpen = false">取消</n-button>
          <n-button type="primary" @click="confirmMarkupAdd">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 修改加价项目（footer 取消 / 删除 / 确认修改，旧版 :13164-13180） -->
    <n-modal v-model:show="markupEditOpen" preset="card" title="修改加价项目" style="width: 500px">
      <div class="vis-col">
        <div class="mgmt-row">
          <span class="mgmt-name">选择项目</span>
          <n-select
            :value="mgmtEdit.index"
            :options="markupEditOptions"
            placeholder="选择修改或删除的项目"
            style="width: 100%"
            @update:value="pickMarkupEdit"
          />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">加价项目</span>
          <n-input v-model:value="mgmtEdit.name" placeholder="请输入加价项目名称" style="flex: 1" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">单价</span>
          <n-input-number v-model:value="mgmtEdit.price" :show-button="false" min="0" placeholder="单价" style="width: 30%" />
        </div>
        <div class="mgmt-row">
          <span class="mgmt-name">计价方式</span>
          <n-select v-model:value="mgmtEdit.unit" :options="markupUnitOptions" style="width: 30%" />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="markupEditOpen = false">取消</n-button>
          <n-button type="error" @click="confirmMarkupDelete">删除</n-button>
          <n-button type="primary" @click="confirmMarkupEdit">确认修改</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 自动加价设置：文案与旧版一致（:13228-13247，width 320） -->
    <n-modal v-model:show="autoMarkupOpen" preset="card" title="自动加价设置" style="width: 320px">
      <!-- 结构/内联样式照抄旧版 :13238-13246：外层 div `padding:10px 0`；
           提示行是**内联** `color:#909399; font-size:12px; margin-top:8px`（不走 .hint 类，
           以免带上它多出来的 line-height:1.6）。 -->
      <div style="padding: 10px 0">
        <n-checkbox :checked="disableAutoMarkup" @update:checked="onAutoMarkupDraft" label="去除自动加价" />
        <div style="color: #909399; font-size: 12px; margin-top: 8px">勾选后，玻璃和尺寸相关加价项目将不再自动选中</div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="autoMarkupOpen = false">取消</n-button>
          <n-button type="primary" @click="saveAutoMarkup">保存</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 排序方式（原版 @324476 打开 / @324531 保存；全 legacy 唯一写入 `smartdoor_sort_method` 的地方）-->
    <n-modal v-model:show="sortMethodOpen" preset="card" title="排序方式" style="width: 420px">
      <div class="vis-col">
        <n-radio-group v-model:value="sortMethodDraft">
          <n-radio value="profile">型材优先（默认）</n-radio>
          <n-radio value="order">序号优先</n-radio>
        </n-radio-group>
        <div style="color:#909399;font-size:12px;margin-top:8px">
          影响生产单/玻璃合片单/玻璃订单/标签等单据的行顺序；「型材优先」按型材分组顺序，「序号优先」按单号数字前缀。
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="sortMethodOpen = false">取消</n-button>
          <n-button type="primary" @click="saveSortMethod">保存</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 收款码设置（对应原版 `getImage('qrcode')`，供回执单/收据单打印） -->
    <n-modal v-model:show="payQrcodeOpen" preset="card" title="收款码设置" style="width: 420px">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="color:#909399;font-size:12px">
          回执单 / 收据单上的收款二维码。图片仅保存在本机（浏览器 IndexedDB，键 <code>qrcode</code>）。
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <img
            v-if="payQrcodeUrl"
            :src="payQrcodeUrl"
            style="width:132px;height:132px;object-fit:contain;border:1px solid #ebeef5;border-radius:4px;background:#fafafa"
          />
          <span v-else style="width:132px;height:132px;display:flex;align-items:center;justify-content:center;color:#c0c4cc;font-size:12px;border:1px dashed #dcdfe6;border-radius:4px">未上传</span>
          <n-space vertical>
            <n-button size="small" @click="pickPayQrcode">{{ payQrcodeUrl ? '重新上传' : '上传图片' }}</n-button>
            <n-button size="small" :disabled="!payQrcodeUrl" @click="removePayQrcode">删除</n-button>
          </n-space>
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button type="primary" @click="payQrcodeOpen = false">关闭</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 开向模式设置 -->
    <n-modal v-model:show="openDirSettingsOpen" preset="card" title="开向模式设置" style="width: 460px">
      <div class="vis-col">
        <n-radio-group v-model:value="modeRadio">
          <n-radio value="">全部模式</n-radio>
          <n-radio value="1">模式1（锁命名）</n-radio>
          <n-radio value="2">模式2（开命名）</n-radio>
        </n-radio-group>
        <p class="hint" style="margin-top: 10px">模式仅影响平开门开向下拉的过滤范围。</p>
      </div>
      <template #footer>
        <div class="footer">
          <n-button @click="openCustomNames">自定义开向</n-button>
          <n-button @click="onReverseOpenDirNames">反向</n-button>
          <n-button @click="openDirSettingsOpen = false">取消</n-button>
          <n-button type="primary" @click="onConfirmOpenDirMode">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 自定义开向命名 -->
    <n-modal v-model:show="customNamesOpen" preset="card" title="自定义开向命名" style="width: 560px">
      <div class="custom-name-grid">
        <div v-for="d in PING_DIRECTIONS" :key="d" class="custom-name-row">
          <span class="orig">{{ d }}</span>
          <n-input v-model:value="customNamesDraft[d]" size="small" placeholder="留空用原始名" style="width: 200px" />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button type="error" dashed @click="resetCustomNames">重置</n-button>
          <n-button @click="customNamesOpen = false">取消</n-button>
          <n-button type="primary" @click="onConfirmCustomNames">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 列显隐设置（两表共 40 多个复选框，比旧版多，**必须限高可滚** ——
         否则卡片会长到 1390px 高、在 900px 屏上把底部的取消/保存顶出视口） -->
    <n-modal v-model:show="visOpen" preset="card" title="列显隐设置" style="width: 720px">
      <div class="vis-grid">
        <div class="vis-col">
          <div class="vis-head">平开门</div>
          <n-checkbox
            v-for="c in PING_VIS_KEYS"
            :key="c.key"
            v-model:checked="visDraft.ping_columns[c.key]"
            :label="c.label"
          />
        </div>
        <div class="vis-col">
          <div class="vis-head">移门</div>
          <n-checkbox
            v-for="c in DIAO_VIS_KEYS"
            :key="c.key"
            v-model:checked="visDraft.diao_columns[c.key]"
            :label="c.label"
          />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <n-button quaternary @click="resetVisDraft">恢复默认</n-button>
          <n-button @click="visOpen = false">取消</n-button>
          <n-button type="primary" :loading="savingVis" @click="saveVisDialog">保存</n-button>
        </div>
      </template>
    </n-modal>


    <!-- 订单列表 -->
    <n-drawer v-model:show="listOpen" :width="760" placement="right">
      <n-drawer-content title="订单列表" closable>
        <n-data-table
          :columns="orderColumns"
          :data="orders"
          :loading="loadingOrders"
          :bordered="true"
          :row-key="(r: OrderSummaryDto) => r.id"
          :scroll-x="900"
        />
      </n-drawer-content>
    </n-drawer>

    <!--
      模板预览 / 算料预览 —— **与 Home 共用同一个弹窗**（2026-09-19 收敛）。

      原先这里是 Hui 自绘的一套（模板下拉 + v-html + 自己渲染），Home 那边用的是
      `PrintPreviewDialog`；两套并存是重复。按用户要求「直接用 home 那个」，
      给 `PrintPreviewDialog` 补上模板下拉（`:templates`）后把这套删了。
    -->
    <PrintPreviewDialog
      v-model:show="templatePreviewOpen"
      :orders="templatePreviewOrders"
      :mode="templatePreviewMode || ''"
      :title="templatePreviewTitle"
      :templates="templateList"
      :auto-line-numbers="false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  NButton,
  NCheckbox,
  NInput,
  NInputNumber,
  NModal,
  NPopover,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NSwitch,
  NTooltip,
  useDialog,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { api } from '../api/client'
import type {
  ClientDto,
  FormulaDto,
  FormulaImageDto,
  OrderDto,
  OrderInput,
  OrderLineInput,
  OrderSummaryDto,
} from '../api/types'
import { printByMode } from '../utils/printService'
import type { MarkupItem } from '../utils/markupLines'
import { round2, type Line, type PartPreview } from '../utils/partsEngine'
import { createPrintPayloads, TENANT_DS, type PrintContext } from '../utils/printPayloads'
import { readShowTotalBalance, writeShowTotalBalance } from '../utils/totalBalance'
import {
  readAssistiveFullscreen,
  readAssistiveMenu,
  writeAssistiveFullscreen,
  writeAssistiveMenu,
} from '../utils/assistiveMenu'
import {
  importLastOrder as importLastOrderFlow,
  writeLastOrder,
  type LastOrderIO,
  type LastOrderSnapshot,
} from '../utils/lastOrder'
import {
  fileToDataUrl,
  idbGetImage,
  idbPutImage,
  idbRemoveImage,
} from '../utils/imageStore'
import {
  loadMarkupCatalog,
  markupCatalog,
  markupUnitOptions,
  removeCatalogItem,
  syncAddCatalogItem,
  updateCatalogItem,
} from '../composables/useMarkupCatalog'
// 行编辑引擎（2026-09-19 从本文件整段搬出，函数体逐字未改）。
// 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机器核对。
// `LS` 是模块级导出（纯 localStorage 小工具，引擎与页面共用同一份，不各存一份）。
import { LS, useOrderLines } from '../composables/useOrderLines'
import DetailLinesTable from '../components/DetailLinesTable.vue'
import DetailLineDialogs from '../components/DetailLineDialogs.vue'
import PrintPreviewDialog from '../components/PrintPreviewDialog.vue'
import { useDetailLineDialogs, sanitizeCustomSquare } from '../composables/useDetailLineDialogs'
import {
  confirmCustomNames,
  confirmOpenDirMode,
  customNamesDraft,
  customNamesOpen,
  DIRECTION_STORAGE_KEYS,
  loadOpenDirectionSettings,
  modeRadio,
  openCustomNames,
  openDirSettingsOpen,
  openOpenDirSettings,
  PING_DIRECTIONS,
  resetCustomNames,
  reverseOpenDirNames,
} from '../composables/useOpenDirection'





const message = useMessage()
const dialog = useDialog()

// 静态选项枚举（FANS / DIRECTION_SUFFIXES / GLASS_OPTIONS / GLASS_THICKNESS_OPTIONS /
// CASING_OPTIONS / FOLD_DIRECTION_SUFFIXES）已搬到 `utils/detailOptions.ts` —— 明细表组件也要用。


// ===== 加价项目目录已抽到 ../composables/useMarkupCatalog（仿旧版 useAddPriceItems）=====

// 静态选项枚举（FANS / GLASS_OPTIONS / CASING_OPTIONS …）与派生数组都已搬到
// `utils/detailOptions.ts`（明细表组件也要用），这里不再保留一份。


// `LS`（localStorage 存取）与「默认值」四件套已搬到 `composables/useOrderLines.ts`。
// `LS` 从那儿的**模块级导出** import 进来；其余四个从引擎实例解构（见上面 setup 开头）。

// 「默认值」机制（`BottomGlass`/`GlassThickness`/`OpenDirection` 三键 + 四个函数）
// 与 `sanitizeNum`/`sanitizeFloat` 已搬到 `composables/useOrderLines.ts`，此处从引擎实例解构。

// `sanitizeCustomSquare` 已随弹窗逻辑搬到 `composables/useDetailLineDialogs.ts`（本页 `lineInputOf` 也用）。

// 行 → 请求体（数字清洗 + 去掉仅前端用的 id）。
/**
 * 「填入单号」（旧版 Hui `:8491-8524`）。
 *
 * 旧版**前端只做搬运**：调 `getDiaoFormulas` 拿 `data.orderNumbers{行id → 单号}`，
 * 逐行 `row.id && d[row.id] && (row["单号"] = d[row.id])` —— 序号一律服务端算。
 * 新版同口径，只是端点拆开了。
 *
 * ⚠️ 单号是**行级**的（每樘门一个，`N-YY/MM/DD`），**不是**订单的回执单号。
 * ⚠️ 必须**先保存**再填 —— 补号是服务端按库里的行做的，未保存的行它看不见。
 *    所以这里先 `saveOrder()` 拿到 id，再填，再回读。
 */
async function fillLineNumbers() {
  if (fillingLineNo.value) return
  fillingLineNo.value = true
  try {
    // 无论新建还是编辑，**先存一次** —— 补号是服务端按库里的行做的，未保存的行它看不见。
    // （旧版那颗按钮的前置条件也一样：行得先在库里。）
    const saved = await saveOrder()
    const id = saved?.id ?? orderId.value
    if (id == null) return
    const map = await api.fillLineNumbers(id)
    if (!map || Object.keys(map).length === 0) {
      message.warning('没有可填入的行')
      return
    }
    // 回读（补号结果以服务端为准，不在这里自己拼）。
    await loadOrder(id)
    message.success('单号已填入')
  } catch (e) {
    message.error((e as Error).message || '获取单号失败')
  } finally {
    fillingLineNo.value = false
  }
}

function lineInputOf(l: Line): OrderLineInput {
  const { id: _id, ...rest } = l
  return {
    ...rest,
    quantity: sanitizeNum(l.quantity, 1),
    unit_price: sanitizeFloat(l.unit_price),
    // 打折：保留可 <1；0 由后端视为不打折（与原逻辑一致）
    discount: sanitizeFloat(l.discount),
    square: sanitizeFloat(l.square),
    custom_square: sanitizeCustomSquare(l.custom_square),
    other_fee: sanitizeFloat(l.other_fee),
    casing_price: sanitizeFloat(l.casing_price),
    casing_amount: sanitizeFloat(l.casing_amount),
    amount: sanitizeFloat(l.amount),
    door_width: sanitizeNum(l.door_width),
    door_height: sanitizeNum(l.door_height),
    light_window_height: sanitizeNum(l.light_window_height),
    wall_thickness: sanitizeNum(l.wall_thickness),
    jiao: sanitizeNum(l.jiao),
    mother_door_width: sanitizeNum(l.mother_door_width),
    seal_board_height: sanitizeNum(l.seal_board_height),
    track_length: sanitizeNum(l.track_length),
    light_window_count: sanitizeNum(l.light_window_count),
    edge_seal_count:
      l.edge_seal_count == null ? null : sanitizeNum(l.edge_seal_count),
    front_casing_add: l.front_casing_add == null ? null : sanitizeNum(l.front_casing_add),
    back_casing_add: l.back_casing_add == null ? null : sanitizeNum(l.back_casing_add),
  } as unknown as OrderLineInput
}


function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function today() {
  return fmtDate(new Date())
}

// 订单头
const order = reactive({
  receipt_no: '',
  client_code: '',
  client_name: '',
  phone: '',
  brand: '',
  order_date: today(),
  production_days: 0,
  deposit: 0,
  remark: '',
  salesperson: '',
  install_address: '', // 表头全局默认安装地址（仿原版 _0x17ac36）
  // ⚠️ 下面两个 + `install_address` 是 **Home 那边在写的头字段**。
  // Hui 界面不显示、也不编辑它们，但**必须原样带回去** —— 因为
  // `PUT /orders/{id}` 是**整头覆盖**（`orders/service.rs` 里无条件
  // `SET ... install_address=$11, production_status=$12, lock_direction=$13`），
  // 而 `model.rs` 里这几个字段是 `#[serde(default)]` ⇒ 载荷里缺键 = 反序列化成 `""` = **抹空**。
  // 见 `docs/home-audit/hui-save-clobber-check.mjs`（实测：存一次全被抹掉）。
  //
  // 📌 `order_no_set` **不在**这一组里：它已改成**服务端派生值**，PUT/PATCH 的 SET 列表
  //    里都没有它，后端自己会重算 ⇒ 客户端带不带都无所谓（详见 `refresh_order_no_set`）。
  production_status: '',
  lock_direction: '',
})

// 收款码（原版 `getImage('qrcode')`）：
//   原文 @5345 从服务端拉图后 `y.images.put({ id:'qrcode', imageBlob:r })` —— **缓存到本地 images 表**；
//   读取见 `index-c3b16e3f.js` 的 `L` @3999：`if (id === 'qrcode') return { imageUrl: await I(n.imageBlob) }`
//   （token 494='qrcode'、462='imageBlob'、497='imageUrl'，均已解码确认）。
// 我们无服务端图片库，但那半边的本地缓存与我们的 `imageStore`（IndexedDB 按 id 存）完全同构，
// 故用**固定键 'qrcode'** 存/取即可。
const PAY_QRCODE_KEY = 'qrcode'
const payQrcodeUrl = ref('')
async function loadPayQrcode() {
  try {
    payQrcodeUrl.value = (await idbGetImage(PAY_QRCODE_KEY)) || ''
  } catch {
    payQrcodeUrl.value = ''
  }
}
const payQrcodeOpen = ref(false)
function pickPayQrcode() {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = 'image/*'
  inp.onchange = async () => {
    const f = inp.files?.[0]
    if (!f) return
    try {
      const url = await fileToDataUrl(f)
      await idbPutImage(PAY_QRCODE_KEY, url)
      payQrcodeUrl.value = url
      message.success('已上传收款码')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '上传收款码失败')
    }
  }
  inp.click()
}
async function removePayQrcode() {
  await idbRemoveImage(PAY_QRCODE_KEY)
  payQrcodeUrl.value = ''
  message.success('已删除收款码')
}

// 行数据
const lines = ref<Line[]>([])
const saving = ref(false)
/** 「填入单号」进行中（旧版那颗按钮没有 loading 态；新版加，因为它是网络请求）。 */
const fillingLineNo = ref(false)
// 当前已保存订单 id（null = 尚未保存的新订单）。保存时据此决定 create 还是 update。
const orderId = ref<number | null>(null)

// 公式（算料用）。
// ⚠️ 声明位置**从下面提上来了**（原在「型材候选」一节之前）—— 引擎要在 setup 早期实例化，
//    而它依赖这个 ref。移动只改声明位置，不改任何语义。
const formulas = ref<FormulaDto[]>([])
/** 页面「自动加价设置」开关（原先在加价一节里声明，理由同上：引擎依赖它）。 */
const disableAutoMarkup = ref(LS.get('smartdoor_disable_auto_markup') === 'true')

// ── 行编辑引擎实例 ──────────────────────────────────────────────────────────
// 引擎本体在 `composables/useOrderLines.ts`（2026-09-19 整段搬出）。
// 这里**解构成与原来同名的局部变量**，所以下面几百行调用点一个字都不用改。
//
// ⚠️ 实例化必须在**任何顶层语句用到这些名字之前**。放在函数体里用的不受影响
//    （`lineRefresh` 首次出现在 `submitAddMarkup` 里、`sanitizeNum` 在 `lineInputOf` 里，
//     都是调用时才求值，那时 setup 早跑完了）。
// ⚠️ 引擎**整体**留着（`engine`）—— 明细表组件要的就是这一整份（它必须与本页同一个实例，
//    否则 `partsEngine` 会有两份，`isDiamond`/候选/算料会分歧）。
const engine = useOrderLines({ lines, formulas, order, orderId, disableAutoMarkup })
// 页面自己还要用的几个，解构成同名局部（搬迁保真：调用点不用改）。
const {
  sanitizeNum,
  sanitizeFloat,
  newLine,
  lineRefresh,
  markupError,
} = engine
// 两表显隐（仿旧版：平开/移门默认都显示、上下各占整宽）
const showPing = ref(true)
const showDiao = ref(true)
const addTypeOpen = ref(false)

function toggleShow(kind: 'ping' | 'diao') {
  if (kind === 'ping') showPing.value = !showPing.value
  else showDiao.value = !showDiao.value
}

function ensureShown(kind: 'ping' | 'diao') {
  if (kind === 'ping') showPing.value = true
  else showDiao.value = true
}

// 更多功能（次级菜单）—— 高级入口收进这里，主按钮行贴近旧版
//
// ⚠️ 旧版**没有**这个下拉（见 `docs/2026-09-19-hui-shell-audit.md` §5.1）——收编本身是偏离。
// 但**加价项目管理 / 自动加价设置 / 排序方式**这三项 2026-09-19 已从本表**删掉**：
// 旧版它们就在「添加门类」抽屉里（`H:13290-13315`），我们曾挪到这儿，现在搬回抽屉了 ——
// 同一件事不给两个入口。
const moreMenuOptions = [
  { label: '订单列表', key: 'orders' },
  { label: '模板预览', key: 'templates' },
  { label: '标签打印', key: 'labels' },
  { label: '玻璃合片单', key: 'glass' },
  { label: '玻璃订单', key: 'glassHole' },
  { label: '生产单定制打印', key: 'productionCustom' },
  { label: '生产单3打印（双联）', key: 'productionCustom3' },
  { label: '终端链接', key: 'terminal' },
  { label: '收款码设置', key: 'payQrcode' },
  { label: '开向模式设置', key: 'openDir' },
  { label: '列显隐设置', key: 'columns' },
]

/**
 * 「总余额显示」开关。
 *
 * 旧版：`_0x2ffe36 = Vue.ref(!1)`（**默认关**，`H:399836`）+ `onMounted` 里 `_0x1c743a()`
 * 读一次 `localStorage['showTotalBalance']`（`H:400056`）；`onChange` `_0x14b5ca`（`H:7934`）
 * 写回 localStorage 并弹一句成功提示。
 *
 * ⚠️ **开关本身不在这里取余额、也不在打印时读这里的 ref**：真正取余额的是打印链路
 * （`useOrderPrint.loadPrintPrereqs`），它自己去读 localStorage。这样 Hui / Home / Progress
 * 三条路同源，也不会出现「改了开关但打印用的是旧值」。见 `utils/totalBalance.ts`。
 */
const showTotalBalance = ref(false)

function onTotalBalanceChange(on: boolean) {
  showTotalBalance.value = on
  writeShowTotalBalance(on)
  message.success(on ? '总余额显示已开启' : '总余额显示已关闭')
}

/**
 * 「辅助菜单设置」两个开关 —— 旧版 `_0x187cf8`（手机辅助菜单）/ `_0x21c393`（全面屏）。
 *
 * 这颗**不影响本页任何渲染**：写 `localStorage` + 往 `window` 派一个 CustomEvent，
 * 由**手机端外壳**监听后决定底部要不要预留空间。见 `utils/assistiveMenu.ts` 的文件头
 * （键名、事件名、四句提示文案都在那儿核过）。
 *
 * 旧版初值和「总余额显示」同一批在 `onMounted` 读（`H:8263` 连着调 `_0x285a13()` `_0x1c743a()`）。
 */
const showAssistiveMenu = ref(false)
const assistiveFullscreen = ref(false)

function onAssistiveMenuChange(on: boolean) {
  showAssistiveMenu.value = on
  writeAssistiveMenu(on)
  message.success(on ? '手机辅助菜单已开启' : '手机辅助菜单已关闭')
}

function onAssistiveFullscreenChange(on: boolean) {
  assistiveFullscreen.value = on
  writeAssistiveFullscreen(on)
  message.success(on ? '全面屏已开启，底部不预留空间' : '全面屏已关闭，底部预留空间')
}

/**
 * 开「自动加价设置」弹窗 —— 旧版 `_0x38bc9b`（`H:13292`）只置一个开关
 * （`_0x24527c.value = !0`），草稿同步是我们加的（见函数里的注释）。
 *
 * ⚠️ 2026-09-19：这颗的**入口从「更多功能」搬回了「添加门类」抽屉**（旧版它就在那儿）。
 * 弹窗本身没动，只是落点归位。
 */
function openAutoMarkup() {
  // 打开时把草稿同步成已存值（旧版点「保存」才落盘，取消应丢弃改动）
  autoMarkupDraft.value = disableAutoMarkup.value
  autoMarkupOpen.value = true
}

function refreshPage() {
  message.info('已刷新')
}

/**
 * 「视频教程」抽屉 —— 旧版 `_0x1ca662`（`Hui.formatted.js:12872` 起）那张名字→链接表。
 *
 * ⚠️ **顺序照的是旧版的**渲染**顺序，不是它在源码里的**表**顺序** —— 两者不同：
 * 表里 `加价项目-修改删除` 排在 `加价项目-单次添加` **前面**，
 * 而渲染（`H:13341-13375`）是 **`单次添加` 在前**。按表顺序抄会错位。
 *
 * ⚠️ 旧版点条目走 `_0x1ca662(名字)`：从表里取 URL → `window.open(url,'_blank')`
 * → 补一句 `ElMessage.info("正在打开"+名字+"视频教程")`。我们只做前两步
 * （与 Diao 页那颗「视频」的处理一致，那儿也没补 toast）。
 */
const videoDrawer = ref(false)
const VIDEO_LINKS: Array<[string, string]> = [
  ['制作回执单', 'https://v.douyin.com/CMt_OqwWAOA/'],
  ['添加门图', 'https://v.douyin.com/9joHNJzrIDY/'],
  ['加价项目-常规操作', 'https://v.douyin.com/EBMcTieRF9M/'],
  ['加价项目-单次添加', 'https://v.douyin.com/tZJqK_VZvvI/'],
  ['加价项目-修改删除', 'https://v.douyin.com/0GhT419VjUU/'],
  ['加价项目-超墙厚', 'https://v.douyin.com/b1vqAmiRvBs/'],
  ['加价项目-超高超宽', 'https://v.douyin.com/Kj6j6ZCMavI/'],
  ['加价项目-轨道超长', 'https://v.douyin.com/T2kNqd_Sjds/'],
  ['加价项目-超平米', 'https://v.douyin.com/ASY21BgXV3I/'],
]
function openVideo(link: string) {
  window.open(link, '_blank')
}

// ===== 列显隐（仿旧版 ping_column/diao_column，租户级）=====
// 可配置列：key 与列构建里一致；缺省不配置(=显示)。
const PING_VIS_KEYS = [
  { key: 'profile_color', label: '型材/颜色' },
  { key: 'unit_quantity', label: '单价/数量' },
  { key: 'glass', label: '玻璃' },
  { key: 'open_dir', label: '开向' },
  { key: 'track', label: '开向内·锁具(轨道)' },
  { key: 'casing', label: '开向内·包边(套线)' },
  { key: 'door_size', label: '门洞尺寸' },
  { key: 'hole_size', label: '洞尺（门洞尺寸格内「洞/净尺」）' },
  { key: 'jiao', label: '吊脚' },
  // 「亮窗总高」原版**无显隐闸门**，故不进本表（仍照常显示）
  { key: 'hardware', label: '五金' },
  { key: 'seal_board', label: '封板高' },
  { key: 'remark', label: '备注' },
  { key: 'money', label: '金额' },
  { key: 'markup_summary', label: '加价' },
  { key: 'price_type', label: '计价方式' },
  { key: 'discount', label: '打折' },
  { key: 'front_casing', label: '前包加长' },
  { key: 'back_casing', label: '后包加长' },
  { key: 'double_ding', label: '单/双丁' },
  { key: 'order_no', label: '单号' },
  { key: 'image_id', label: '图片ID' },
  { key: 'client', label: '客户' },
  { key: 'client_code', label: '客户编号' },
  { key: 'other_fee', label: '其它费用' },
]
// 移门表可显隐列（列序同原版，见 diaoCols 注释）

const DIAO_VIS_KEYS = [
  { key: 'profile_color', label: '型材/颜色' },
  { key: 'unit_qty', label: '单价/数量' },
  { key: 'glass', label: '玻璃' },
  { key: 'fans_dir', label: '扇数/开向' },
  { key: 'track_line', label: '下轨道/套线' },
  { key: 'door_size', label: '门洞尺寸' },
  { key: 'hole_size', label: '洞尺（门洞尺寸格内「洞/净尺」）' },
  { key: 'lightwin', label: '亮窗信息' },
  { key: 'hardware', label: '五金' },
  { key: 'remark', label: '备注' },
  { key: 'money', label: '金额' },
  { key: 'markup_summary', label: '加价' },
  { key: 'up_track_seal', label: '上轨/边封' },
  { key: 'front_casing', label: '前包加长' },
  { key: 'back_casing', label: '后包加长' },
  { key: 'double_ding', label: '单/双丁' },
  { key: 'price_type', label: '计价方式' },
  { key: 'discount', label: '打折' },
  { key: 'order_no', label: '单号' },
  { key: 'image_id', label: '图片ID' },
  { key: 'client', label: '客户' },
  { key: 'client_code', label: '客户编号' },
  { key: 'other_fee', label: '其它费用' },
]
// 是否显示某列（缺省都显示）
const pingColVis = reactive<Record<string, boolean>>({})
const diaoColVis = reactive<Record<string, boolean>>({})
function colVis(map: Record<string, boolean>, key: string): boolean {
  return map[key] !== false // 仅当显式 false 才隐藏
}
// 列显隐设置弹窗
const visOpen = ref(false)
const visDraft = reactive({ ping_columns: {} as Record<string, boolean>, diao_columns: {} as Record<string, boolean> })
const savingVis = ref(false)

function openVisDialog() {
  // 从当前生效值初始化草稿（缺省都显示）
  visDraft.ping_columns = {}
  visDraft.diao_columns = {}
  for (const c of PING_VIS_KEYS) visDraft.ping_columns[c.key] = colVis(pingColVis, c.key)
  for (const c of DIAO_VIS_KEYS) visDraft.diao_columns[c.key] = colVis(diaoColVis, c.key)
  visOpen.value = true
}

/** 「恢复默认」：把草稿勾回旧版租户配置那套（见 `PING_COL_DEFAULTS`），**要再点保存才生效**。 */
function resetVisDraft() {
  for (const c of PING_VIS_KEYS) visDraft.ping_columns[c.key] = PING_COL_DEFAULTS[c.key] !== false
  for (const c of DIAO_VIS_KEYS) visDraft.diao_columns[c.key] = DIAO_COL_DEFAULTS[c.key] !== false
}

async function saveVisDialog() {
  savingVis.value = true
  try {
    await api.updateColumnConfig({
      ping_columns: { ...visDraft.ping_columns },
      diao_columns: { ...visDraft.diao_columns },
    })
    // 回写到生效值
    Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
    Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
    for (const [k, v] of Object.entries(visDraft.ping_columns)) pingColVis[k] = v
    for (const [k, v] of Object.entries(visDraft.diao_columns)) diaoColVis[k] = v
    visOpen.value = false
    message.success('列显隐已保存')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存列配置失败')
  } finally {
    savingVis.value = false
  }
}

// ===== 加价项目管理（复刻旧版主页三弹窗：管理 → 新增 / 修改删除）=====
// 旧版：`加价项目管理`(400) → 两个按钮；`新增加价项目`(500)；`修改加价项目`(500)
//       Hui.formatted.js:13107-13226；目录增删改走 addAddPrice / editPrice / deleteAddPrice
const markupMgmtOpen = ref(false)
const markupAddOpen = ref(false)
const markupEditOpen = ref(false)

/** 新增弹窗的表单（旧版 `_0x4956b9`，打开时重置为 name:'', price:0, unit:'元/套'）。 */
const mgmtAdd = reactive({ name: '', price: 0, unit: '元/套' })
function openMarkupMgmt() {
  markupMgmtOpen.value = true
}
function openMarkupAdd() {
  mgmtAdd.name = ''
  mgmtAdd.price = 0
  mgmtAdd.unit = '元/套'
  markupMgmtOpen.value = false
  markupAddOpen.value = true
}
async function confirmMarkupAdd() {
  const name = mgmtAdd.name.trim()
  // 旧版校验：名称「请输入加价项目名称」；单价「单价必须大于0」（管理弹窗这份是 min:.01，:7986-7993）
  if (!name) {
    message.warning('请输入加价项目名称')
    return
  }
  if (!(mgmtAdd.price > 0)) {
    message.warning('单价必须大于0')
    return
  }
  const ok = await syncAddCatalogItem({ name, price: mgmtAdd.price, unit: mgmtAdd.unit || '元/套' })
  if (!ok) {
    message.warning('加价项目已存在！') // 去重失败即已存在，原版提示后**不关窗**
    return
  }
  message.success('加价项目添加成功')
  markupAddOpen.value = false
}

/** 「修改/删除加价项目」：打开前重载目录（旧版 `_0x2612ea` 先 `await _0x51e171()`）。 */
const mgmtEdit = reactive({ index: -1, name: '', price: 0, unit: '元/套' })
const markupEditOptions = computed(() =>
  markupCatalog.value.map((m, i) => ({ label: `${m.name} ${m.price}${m.unit}`, value: i })),
)
async function openMarkupEdit() {
  if (!(await loadMarkupCatalog())) message.error('初始化失败')
  mgmtEdit.index = -1
  mgmtEdit.name = ''
  mgmtEdit.price = 0
  mgmtEdit.unit = '元/套'
  markupMgmtOpen.value = false
  markupEditOpen.value = true
}
function pickMarkupEdit(i: number) {
  const a = markupCatalog.value[i]
  mgmtEdit.index = i
  if (!a) return
  mgmtEdit.name = a.name
  mgmtEdit.price = a.price
  mgmtEdit.unit = a.unit
}
async function confirmMarkupEdit() {
  if (mgmtEdit.index < 0) {
    message.warning('请先选择一个项目')
    return
  }
  if (!mgmtEdit.name.trim()) {
    message.warning('请输入加价项目名称')
    return
  }
  if (!(mgmtEdit.price > 0)) {
    message.warning('单价必须大于0')
    return
  }
  // 同名（除自己外）判重 —— 旧版 `_0x3cdb91` 的 `.some(...)`
  const dup = markupCatalog.value.some(
    (c, i) => i !== mgmtEdit.index && c.name === mgmtEdit.name.trim() && c.price === mgmtEdit.price && c.unit === mgmtEdit.unit,
  )
  if (dup) {
    message.warning('加价项目已存在！')
    return
  }
  const ok = await updateCatalogItem(mgmtEdit.index, {
    name: mgmtEdit.name.trim(),
    price: mgmtEdit.price,
    unit: mgmtEdit.unit || '元/套',
  })
  if (!ok) {
    message.error('编辑失败，请重试')
    return
  }
  message.success('加价项目修改成功')
  markupEditOpen.value = false
}
async function confirmMarkupDelete() {
  if (mgmtEdit.index < 0) {
    message.warning('请先选择一个项目')
    return
  }
  const target = markupCatalog.value[mgmtEdit.index]
  dialog.warning({
    title: '提示',
    content: '确定要删除此加价项目吗?',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      const ok = await removeCatalogItem(mgmtEdit.index)
      message[ok ? 'success' : 'error'](ok ? '加价项目删除成功' : '加价项目删除失败')
      mgmtEdit.index = -1
      mgmtEdit.name = ''
      mgmtEdit.price = 0
      mgmtEdit.unit = '元/套'
    },
    onNegativeClick: () => message.info('已取消删除'),
  })
  void target
}

// 自动加价设置（本地开关，仿旧版 smartdoor_disable_auto_markup）
// ⚠️ 存的是**布尔值的字符串**（`"true"` / `"false"`），不是 `"1"`/`"0"` ——
//   旧版读写都是 `=== "true"` / `String(v)`（`Hui.formatted.js:835` / `:8009-8014`），
//   必须一致，否则从旧版迁过来的浏览器里那份设置会被读反。
//   旧版点「保存」才落盘，故这里也用草稿态。
const autoMarkupOpen = ref(false)
// `disableAutoMarkup` 的声明已上提到 setup 开头（引擎依赖它）。
const autoMarkupDraft = ref(disableAutoMarkup.value)
function onAutoMarkupDraft(v: boolean) {
  autoMarkupDraft.value = v
}
function saveAutoMarkup() {
  disableAutoMarkup.value = autoMarkupDraft.value
  LS.set('smartdoor_disable_auto_markup', String(autoMarkupDraft.value))
  autoMarkupOpen.value = false
  message.success('设置已保存')
}

/**
 * 列显隐默认值 —— 取自**旧版租户配置**（`GET /1?param1=login` 返回的
 * `registrant.ping_column` / `registrant.diao_column`，2026-09-16 实查）：
 *
 *   ping_column = {"五金":1,"前包加长":1,"单双丁":1,"吊脚":0,"后包加长":1,"套线种类":1,
 *                  "封板高":1,"平方数":0,"开向模式":1,"打折":0,"洞尺":1,"轨道种类":0,"锁向":1}
 *   diao_column = {"五金":0,"单双丁":1,"封板高":1,"打折":1,"数量":0,"洞尺":1,"计价方式":0}
 *
 * 旧版的闸门是「真值才渲染」；另外 **日期/回执单号/图片ID/客户/客户编号/其它费用 六列
 * 在旧版里恒 false**（闸门变量 `he`/`ge` = `Vue.ref(!1)`，全组件无赋值），从来没显示过，
 * 所以这里也默认隐藏（仍可在「列显隐设置」里打开）。
 */
const PING_COL_DEFAULTS: Record<string, boolean> = {
  jiao: false, // 吊脚:0
  discount: false, // 打折:0
  track: false, // 轨道种类:0（开向格里的「锁具」那一行）
  image_id: false,
  client: false,
  client_code: false,
  other_fee: false,
}
const DIAO_COL_DEFAULTS: Record<string, boolean> = {
  hardware: false, // 五金:0
  price_type: false, // 计价方式:0
  image_id: false,
  client: false,
  client_code: false,
  other_fee: false,
}
function seedColumnDefaults() {
  Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
  Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
  Object.assign(pingColVis, PING_COL_DEFAULTS)
  Object.assign(diaoColVis, DIAO_COL_DEFAULTS)
}

async function loadColumnConfig() {
  seedColumnDefaults()
  try {
    const c = await api.getColumnConfig()
    // 后端存过就用存过的（整表覆盖；未存过保留上面的旧版默认）
    if (c.ping_columns && Object.keys(c.ping_columns).length) {
      Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
      Object.assign(pingColVis, c.ping_columns)
    }
    if (c.diao_columns && Object.keys(c.diao_columns).length) {
      Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
      Object.assign(diaoColVis, c.diao_columns)
    }
  } catch {
    // 忽略：保留旧版默认
  }
}

function onConfirmOpenDirMode() {
  message.success(confirmOpenDirMode())
}
function onConfirmCustomNames() {
  message.success(confirmCustomNames())
}
// 反向：打开自定义命名并互换左/右（原版为后端反转+重载，此处做本地等价）
function onReverseOpenDirNames() {
  openCustomNames()
  reverseOpenDirNames()
}

function onMoreSelect(key: string) {
  switch (key) {
    case 'orders': void openOrderList(); break
    case 'templates': void openTemplatePreview(); break
    case 'labels': void printLabels(); break
    case 'glass': void printGlass(); break
    case 'glassHole': void printGlassHole(); break
    case 'productionCustom': void printProductionCustom('product2'); break
    case 'productionCustom3': void printProductionCustom('product3'); break
    case 'terminal': void copyTerminalLink(); break
    case 'payQrcode': payQrcodeOpen.value = true; break
    case 'openDir': openOpenDirSettings(); break
    case 'columns': openVisDialog(); break
  }
}

const pingRows = computed(() => lines.value.filter((l) => l.line_type === 'ping'))
const diaoRows = computed(() => lines.value.filter((l) => l.line_type === 'diao'))
const totalPrice = computed(() =>
  round2(lines.value.reduce((s, l) => s + (l.amount || 0), 0)),
)
const doorCount = computed(() =>
  lines.value.reduce((s, l) => s + (l.quantity || 0), 0),
)
const dueDate = computed(() => {
  const d = new Date(`${order.order_date || today()}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + (order.production_days || 0) + 1)
  return fmtDate(d)
})

// 顶栏日期（n-date-picker 用时间戳，order.order_date 保持 'YYYY-MM-DD'）
function strToTs(s: string): number {
  const d = new Date(`${s || today()}T00:00:00`)
  return Number.isNaN(d.getTime()) ? new Date().getTime() : d.getTime()
}
const orderDateTs = ref<number>(strToTs(order.order_date))
function onOrderDate(ts: number | null) {
  if (ts == null) return
  order.order_date = fmtDate(new Date(ts))
  orderDateTs.value = ts
}

// 每表底部「添加行」→ 直接往表里插一行默认空行，就地编辑（仿旧版，不弹窗）
function addRowOf(kind: 'ping' | 'diao') {
  ensureShown(kind)
  const l = newLine(kind)
  l.price_type = kind === 'ping' ? LS.get('PriceType') || '套' : '方'
  lines.value.push(l)
  lineRefresh(l)
  message.info(`已添加一行${kind === 'ping' ? '平开门' : '移门'}，直接在表内填写`)
}

// 客户
const clients = ref<ClientDto[]>([])
const clientOptions = computed(() =>
  clients.value.map((c) => ({ label: `${c.name}（${c.code}）`, value: c.code })),
)
let lastAppliedClient = ''

function applyClient(code: string | null) {
  const c = clients.value.find((x) => x.code === code)
  order.client_name = c?.name ?? ''
  order.phone = c?.phone ?? ''
  order.brand = c?.brand ?? ''
  lastAppliedClient = c?.code ?? ''
}

function onClientChange(code: string | null) {
  // 仅当「已有归属客户（加载的订单或已选客户）」且切换到另一客户时，才二次确认是否清空订单行。
  // 新订单首次选择客户不弹窗（已有门类但无归属客户，直接套用客户资料）。
  if (
    lines.value.length > 0 &&
    code &&
    lastAppliedClient &&
    code !== lastAppliedClient
  ) {
    dialog.warning({
      title: '切换客户',
      content: '当前订单已有门类，切换客户将清空现有订单行。是否继续？',
      positiveText: '清空并切换',
      negativeText: '取消',
      onPositiveClick: () => {
        lines.value = []
        applyClient(code)
      },
      onNegativeClick: () => {
        order.client_code = lastAppliedClient || ''
      },
    })
    return
  }
  applyClient(code)
}

// `formulas` 的声明已上提到 setup 开头（引擎依赖它）。以下型材候选三件套
// （`PING_FAMILY_TYPES` / `belongsToTable` / `profileOptionsFor`）已搬到 `useOrderLines.ts`。


// —— 取价 / 公式匹配（型材失焦自动回填）已改行内 resolveRow；无弹窗抽屉 ——

// —— 离开拦截（仿旧版 onBeforeRouteLeave / beforeunload）——
function serializeOrder(): string {
  try {
    return JSON.stringify({
      h: { ...order },
      l: lines.value.map((x) => ({ ...x, markup: x.markup, parts: x.parts })),
    })
  } catch {
    return ''
  }
}
let savedSnap = serializeOrder()
function dirtyNow() {
  return serializeOrder() !== savedSnap
}
function markSaved() {
  savedSnap = serializeOrder()
}
onBeforeRouteLeave(() => {
  if (!dirtyNow()) return true
  return window.confirm('存在未保存的修改，离开后将丢失，是否继续离开？')
})
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirtyNow()) return
  e.preventDefault()
  e.returnValue = ''
}

/**
 * 「导入上次订单」—— 流程本身在 `utils/lastOrder.ts`（**逐字照旧版 `H:8899-8925`**：
 * 没存过 → `warning`「没有找到上次保存的订单数据」；有 → 弹确认框（标题「导入上次订单」、
 * 正文「将导入 {时间} 保存的订单数据，当前数据将被覆盖，是否继续？」、按钮「确认导入」/「取消」）；
 * 确认后应用 + `success`「上次订单数据已导入」；解析失败 → `error`「导入订单数据失败」）。
 *
 * 为什么拆出去：那些**文案和分支**要和旧版逐字对齐，而 SFC 里的 setup 函数差分台 import 不到。
 * 拆成「注入 IO 的纯函数」之后，`docs/home-audit/last-order-logiccheck.mjs` 能把旧版那段
 * 切片**真的跑一遍**，跟我们的调用序列逐条比。
 *
 * ⚠️ 本地这层只管「拿快照改页面状态」，这一段旧版没有对应（它的键存的是整单载荷、
 *    直接往 12 个表单 ref 上落），所以差分台只比**流程与文案**，不比这里的字段映射。
 */
function applyLastOrder(data: LastOrderSnapshot) {
  if (data.header) Object.assign(order, data.header)
  if (Array.isArray(data.lines)) lines.value = data.lines as typeof lines.value
  // 两表显隐跟着导入的数据走（旧版 `showPingkai` / `showDiao` 直接赋给那两个 ref）
  if (typeof data.showPing === 'boolean') showPing.value = data.showPing
  if (typeof data.showDiao === 'boolean') showDiao.value = data.showDiao
  // ⚠️ 导入出来的是**新的一单**：旧版不认领上一单的 id（再点保存是一次全新提交）。
  //    不清掉的话，下一次「保存」会去 PUT 覆盖上一单 —— 那不是「导入」该干的事。
  orderId.value = null
  // ⚠️ **不要**无条件 `applyClient()`：它按 code 去客户目录**重取**姓名/电话/品牌，
  //    目录里查不到这个 code 时会把刚导入的三个字段**抹成空**。
  //    旧版是把 `customerInfo` 里存的值**直接落上去**、不查目录。所以只在查得到时才套目录值。
  if (clients.value.some((c) => c.code === order.client_code)) {
    applyClient(order.client_code)
  } else {
    lastAppliedClient = order.client_code ?? ''
  }
  // 导入的行按「已保存」着色（旧版是把上次保存的整表行 splice 回来，那些行本来就带保存态）。
  markSaved()
}

/** 把 naive 的 `message` / `dialog` / `localStorage` 接到 `utils/lastOrder.ts` 的 IO 面上。 */
const lastOrderIO: LastOrderIO = {
  storage: { getItem: (k) => LS.get(k), setItem: (k, v) => LS.set(k, v) },
  warning: (m) => message.warning(m),
  success: (m) => message.success(m),
  error: (m) => message.error(m),
  confirm: (o) => dialog.warning(o),
}

function importLastOrder() {
  importLastOrderFlow(lastOrderIO, applyLastOrder)
}

function resetOrder() {
  orderId.value = null
  order.receipt_no = ''
  order.client_code = ''
  order.client_name = ''
  order.phone = ''
  order.brand = ''
  order.order_date = today()
  order.production_days = 0
  order.deposit = 0
  order.remark = ''
  order.salesperson = ''
  order.install_address = ''
  // ⚠️ 这两个同上：忘一个，保存时那一个就被抹空（见 `order` 声明处的说明）。
  order.production_status = ''
  order.lock_direction = ''
  lines.value = []
  lastAppliedClient = ''
  markSaved()
  // ⚠️ **不要**在这里写 `smartdoor_last_order`：旧版那个键全文件只有两处
  // （`H:8853` 保存成功时写、`H:8903` 导入时读），**清空订单不动它**。
  // （我们先前那套实时草稿在这里写了个空草稿 —— 等于「清空 = 把上次订单也清了」，
  //  旧版没这回事。见 `persistLastOrder` 的注释。）
}

// 「1.清空」：清空当前订单内容（不新建的口吻）
function clearOrder() {
  if (lines.value.length === 0 && orderId.value == null) {
    message.info('当前订单已为空')
    return
  }
  dialog.warning({
    title: '清空订单',
    content: '将清空当前订单的所有内容（未保存的更改会丢失）。是否继续？',
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: () => resetOrder(),
  })
}

// —— 保存整单校验（旧版 makeReceipt 语义，反混淆核对）——
// 必填只在「保存整单」拦截，允许先添加半空行；保存前自动剔除全空行。
// ping：型材/数量/颜色/底玻/面玻/玻璃厚/开向/计价方式；diao：型材/颜色/底玻/面玻/玻璃厚/开向/扇数/轨道种类。
// （旧码门洞宽/高检查是死代码、平开轨道检查是告警不拦截——本版统一补强门洞宽/高，吊趟轨道保留必填。）
function missingFieldsOf(l: Line): string[] {
  const m: string[] = []
  const add = (ok: boolean, name: string) => {
    if (!ok) m.push(name)
  }
  // 必填清单**逐字照抄旧版**（平开 @349085 / 吊趟 @353602）：
  //   平开 `["型材","数量","颜色","底玻","面玻", 玻璃厚,"开向", 计价方式]`
  //   吊趟 `["型材","颜色","底玻","面玻", 玻璃厚,"开向","扇数", 轨道种类]`
  // ⚠️ **底玻/面玻是必填**（原版两格都没有 `clearable`，配合新建行默认值 ⇒ 空串在旧版产生不出来）。
  // ⚠️ **原版清单里没有 门洞宽/门洞高**（用户确认「按照原版改」）。
  //    @349301 校验循环里那两条 `"门洞高"===e && _[e]<=0` / `"门洞宽"===e && _[e]<=0`
  //    是**死代码** —— `e` 只遍历清单 `x`，而这两项不在 `x` 中，永不命中
  //    （形态像当初漏加了清单项）。故原版**实际不校验尺寸**：`errorFields["门洞高"]` 也没有
  //    任何地方会写 `true`（单元格上挂着 `error-cell` 绑定但永远是 false）。
  //    ⇒ 我们同步去掉这两项必填（**这是一处放宽**；要恢复只需把两行 `add` 加回来）。
  add(!!l.profile.trim(), '型材')
  add(!!l.color.trim(), '颜色')
  add(!!l.bottom_glass.trim(), '底玻')
  add(!!l.face_glass.trim(), '面玻')
  add(!!l.glass_thickness.trim(), '玻璃厚')
  add(!!l.direction.trim(), '开向')
  if (l.line_type === 'ping') {
    add(l.quantity >= 1, '数量')
    add(!!l.price_type.trim(), '计价方式')
  } else {
    add(!!l.fans.trim(), '扇数')
    add(!!l.track.trim(), '轨道种类')
  }
  return m
}

// 整行无任何内容 → 保存前自动剔除（旧版 splice 语义）
function rowHasContent(l: Line): boolean {
  return !!(
    l.profile.trim() ||
    l.door_width > 0 ||
    l.door_height > 0 ||
    l.color.trim() ||
    l.bottom_glass.trim() ||
    l.face_glass.trim() ||
    l.glass_thickness.trim() ||
    l.direction.trim() ||
    l.fans.trim() ||
    l.track.trim() ||
    l.price_type.trim()
  )
}

// 墙厚单元格：输入后同步「超墙厚」加价项（旧版 blur 联动）。

const checkboxTick = ref(0)

// 选中行（跨两表）
const selectedLines = computed(() => {
  void checkboxTick.value
  return lines.value.filter((l) => l.isSelected)
})

function batchDeleteRows() {
  const sel = selectedLines.value
  if (!sel.length) {
    message.warning('请先勾选要删除的行')
    return
  }
  dialog.warning({
    title: '批量删除',
    content: `确定删除选中的 ${sel.length} 行吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      for (const l of sel) {
        if (orderId.value != null && l.id != null) {
          try {
            await api.deleteOrderLine(orderId.value, l.id)
          } catch {
            // 单行删除失败继续
          }
        }
        lines.value = lines.value.filter((x) => x !== l)
      }
      message.success('已删除选中行')
    },
  })
}

/**
 * 交给明细表组件的**页面级回调**（2026-09-19 组件化时新增）。
 *
 * 这些留在页面而不是组件里，是因为它们**跨两表**或**依赖页面能力**：
 * · `onSelectChange` —— 勾选计数是两表共用一个（旧版也是），组件只能通知页面自己 +1；
 * · `calcSingleRow` —— 要 `loadFormulaImages` + `openTemplatePreview`（页面弹窗，见方案 §3.5）；
 * · `openAddMarkup` / `openSquareDialog` / 门图三件套 / `previewImage` —— 页面持有那些弹窗；
 * · `lineInputOf` —— 行 → `OrderLineInput` 的映射，行级保存要发完整行（缺字段会被抹空）。
 */
const dialogs = useDetailLineDialogs({ lineRefresh: engine.lineRefresh })

/**
 * 交给明细表组件的**页面级回调**（2026-09-19 组件化时新增）。
 *
 * 这些留在页面而不是组件里，是因为它们**跨两表**或**依赖页面能力**：
 * · `onSelectChange` —— 勾选计数是两表共用一个（旧版也是），组件只能通知页面自己 +1；
 * · `calcSingleRow` —— 要 `loadFormulaImages` + `openTemplatePreview`（页面弹窗，见方案 §3.5）；
 * · 其余四个是**共用弹窗**（`components/DetailLineDialogs.vue`，状态在本页的 `dialogs`）；
 * · `lineInputOf` —— 行 → `OrderLineInput` 的映射，行级保存要发完整行（缺字段会被抹空）。
 */
const detailHooks = {
  openSquareDialog: (l: Line) => dialogs.openSquareDialog(l),
  openAddMarkup: (l: Line) => dialogs.openAddMarkup(l),
  pickDoorImg: (l: Line) => dialogs.pickDoorImg(l),
  removeDoorImg: (l: Line) => dialogs.removeDoorImg(l),
  openTextImg: (l: Line) => dialogs.openTextImg(l),
  previewImage: (url: string) => dialogs.previewImage(url),
  calcSingleRow: (l: Line) => void calcSingleRow(l),
  onSelectChange: () => {
    checkboxTick.value++
  },
  lineInputOf: (l: Line) => lineInputOf(l),
}


// 单行算料：有 formula_id 才计算（仿旧版门图列「算料」）
async function calcSingleRow(l: Line) {
  // 核心（公式兜底匹配 / 取公式 / 算料 / 重算行）已抽到引擎 `calcRowParts`，
  // 好让 Home 的展开行用同一份（旧版 Home 是内嵌整个 Hui 页面去调 `calculateReceipt`，
  // 见 `docs/2026-09-18-detail-table-extraction.md` §3.5）。
  // 这里只留两件**页面能力**：挖孔图缓存、模板预览弹窗。
  // `beforeCompute` 保留原顺序（原版就是先拉图再 computeParts）。
  const ok = await engine.calcRowParts(l, loadFormulaImages)
  if (!ok) return
  message.success(`算料完成：${l.parts.length} 个部件`)
  void openTemplatePreview('product')
}

/**
 * 门花图格。
 *
 * ⚠️ **两个分支的 `key` 不能省**（踩过一次）：
 * 两个分支都是同层同类型的 `div`，子节点又都是无 key 的 `NButton` 数组 —— Vue 走
 * `patchUnkeyedChildren`，第 1 个子节点「旧=「文字」按钮 / 新=「×」删除按钮」**类型相同**，
 * 于是**原地复用同一个 DOM 元素**（只是把 props 换成「删除门图」）。
 * 而 naive-ui 的 `FocusTrap` 关闭时会 `lastFocusedElement.focus()` —— 那个"上次聚焦的元素"
 * 正是「文字」按钮。结果：**文字传图按 Enter 之后，焦点悄悄落到了"删除"按钮上**，
 * 再来一次 Enter（键重复/再按一下）就弹出「删除门图」。
 * 实测复现：一次 Enter keydown 之后即出现 `["门图名字 …", "删除门图 …"]` 两个弹窗，
 * 焦点 trace 由 INPUT → BUTTON(取消) → BUTTON(×)。
 * 给两个分支不同 key，Vue 就会卸载旧的、挂新的，DOM 不再被复用。
 */
async function hydrateRowImages(rows: Line[]) {
  for (const l of rows) {
    if (l.image_id && !l.image_url) {
      const url = await idbGetImage(l.image_id)
      if (url) l.image_url = url
    }
  }
}

// —— 组合单元格工具：一格多控件、紧凑 ——
// **结构与类名逐字照抄旧版**（`legacy/css/Hui-39b802eb.css`）：
//   div.glass-inputs-container{display:flex;flex-direction:column;gap:5px;width:100%}
//     └ div.glass-input-group{display:flex;align-items:center;gap:4px}
//         ├ div.glass-input-label{font-size:11px;white-space:nowrap;color:#1302fa}   ← 蓝色小标签
//         └ div.glass-input{flex:1}  → 控件
// 旧版多数格子是「label 与控件同层、控件自己带 .glass-input」；个别格子中间还夹一层 div
// （如 `_hoisted_27$1`）。我们统一在控件外面包一层 `.glass-input`，视觉等价且不必逐格分支。
//
// ⚠️ 样式必须写成 `:deep(.glass-inputs-container)` 等（见文件末尾样式表）：
// 这些 vnode 是在 NDataTable 的 `render` 回调里创建的，`currentRenderingInstance` 是表本身，
// 拿不到本组件的 `data-v` 标记，普通 `<style scoped>` 规则一条都不会命中。


// 复制行（仿旧版：清生产进度/图片）
// 修改平方数（平方单元格右键，仿旧版）
// 保存
/** 保存订单。成功返回服务端结果（**「填入单号」要用它的 id**），被守卫拦下时返回 null。 */
async function saveOrder(): Promise<OrderDto | null> {
  if (lines.value.length === 0) {
    message.warning('请先添加门类，填写订单信息！')
    return null
  }
  if (!order.client_name) {
    message.warning('请先选择客户')
    return null
  }
  // 剔除整行空行；其余行按门型检查必填，缺失则拦保存并列出（旧版 makeReceipt 语义）
  lines.value = lines.value.filter(rowHasContent)
  if (lines.value.length === 0) {
    message.warning('请先添加门类，填写订单信息！')
    return null
  }
  const problems = lines.value
    .map((l, i) => ({ row: i + 1, missing: missingFieldsOf(l) }))
    .filter((p) => p.missing.length > 0)
  if (problems.length) {
    const detail = problems
      .map((p) => `第${p.row}行缺：${p.missing.join('、')}`)
      .join('\n')
    message.error(`请补充必填信息！\n${detail}`)
    return null
  }
  saving.value = true
  try {
    // 表头全局默认安装地址：行内地址为空的行用默认值回填（仿原版）
    if (order.install_address.trim()) {
      for (const l of lines.value) {
        if (!l.install_address.trim()) l.install_address = order.install_address.trim()
      }
    }
    const payload: OrderInput = {
      receipt_no: order.receipt_no,
      client_code: order.client_code,
      client_name: order.client_name,
      phone: order.phone,
      brand: order.brand,
      order_date: order.order_date,
      production_days: order.production_days,
      deposit: order.deposit,
      remark: order.remark,
      salesperson: order.salesperson,
      // ⚠️ 这四个 Hui 界面上没有、也编辑不了，但**必须原样回传** —— PUT 是整头覆盖，
      // 少一个就抹空一个（实测见 `docs/home-audit/hui-save-clobber-check.mjs`）。
      install_address: order.install_address,
      // ⚠️ 这里**不带** `order_no_set` —— 它已改成服务端派生值（后端 PUT/PATCH 的 SET
      //    列表里都没有它），所以既不需要、也发不进去。
      production_status: order.production_status,
      lock_direction: order.lock_direction,
      lines: lines.value.map(lineInputOf),
    }
    const saved =
      orderId.value != null
        ? await api.updateOrder(orderId.value, payload)
        : await api.createOrder(payload)
    orderId.value = saved.id
    order.receipt_no = saved.receipt_no
    // 回填/刷新服务端分配的行 id（create 与整单 update 后行顺序一致）
    saved.lines.forEach((sl, i) => {
      const local = lines.value[i]
      if (local) local.id = sl.id
    })
    persistLastOrder()
    markSaved()
    message.success(`订单已保存（${saved.receipt_no}）`)
    return saved
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
    return null
  } finally {
    saving.value = false
  }
}

// 订单列表
const listOpen = ref(false)
const orders = ref<OrderSummaryDto[]>([])
const loadingOrders = ref(false)

const orderColumns: DataTableColumns<OrderSummaryDto> = [
  { title: '回执单号', key: 'receipt_no', width: 120 },
  { title: '客户', key: 'client_name', minWidth: 120 },
  { title: '日期', key: 'order_date', width: 110 },
  { title: '截止', key: 'due_date', width: 110 },
  { title: '门数', key: 'door_count', width: 60 },
  { title: '总价', key: 'total_price', width: 100, render: (o) => o.total_price.toFixed(2) },
  { title: '定金', key: 'deposit', width: 90, render: (o) => o.deposit.toFixed(2) },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    render: (o) =>
      h(NSpace, { size: 4 }, {
        default: () => [
          h(NButton, { size: 'tiny', type: 'primary', onClick: () => loadOrder(o.id) }, { default: () => '载入' }),
          h(NButton, { size: 'tiny', type: 'error', onClick: () => removeOrder(o) }, { default: () => '删除' }),
        ],
      }),
  },
]

async function openOrderList() {
  listOpen.value = true
  await refreshOrders()
}

async function refreshOrders() {
  loadingOrders.value = true
  try {
    orders.value = await api.listOrders()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载订单失败')
  } finally {
    loadingOrders.value = false
  }
}

async function loadOrder(id: number) {
  try {
    const o = await api.getOrder(id)
    orderId.value = o.id
    order.receipt_no = o.receipt_no
    order.client_code = o.client_code
    lastAppliedClient = o.client_code
    order.client_name = o.client_name
    order.phone = o.phone
    order.brand = o.brand
    order.order_date = o.order_date
    order.production_days = o.production_days
    order.deposit = o.deposit
    order.remark = o.remark
    order.salesperson = o.salesperson
    // ⚠️ 三个「Hui 不显示但 Home 在写」的头字段必须读回来，否则保存时被整头覆盖抹空。
    // （`install_address` 原先就漏在这里 + 漏在载荷里，是同一个坑的另一半。）
    // `order_no_set` 不在此列 —— 服务端派生，见 `order` 声明处的说明。
    order.install_address = o.install_address
    order.production_status = o.production_status
    order.lock_direction = o.lock_direction
    lines.value = o.lines.map((l) => ({
      id: l.id,
      line_type: l.line_type === 'diao' ? 'diao' : 'ping',
      profile: l.profile, color: l.color, direction: l.direction, fans: l.fans,
      track: l.track, casing: l.casing, hardware: l.hardware,
      bottom_glass: l.bottom_glass, face_glass: l.face_glass, glass_thickness: l.glass_thickness,
      door_width: l.door_width, door_height: l.door_height, light_window_height: l.light_window_height,
      wall_thickness: l.wall_thickness, jiao: l.jiao, mother_door_width: l.mother_door_width,
      quantity: l.quantity, unit_price: l.unit_price, price_type: l.price_type, discount: l.discount,
      square: l.square, custom_square: l.custom_square, other_fee: l.other_fee,
      casing_price: l.casing_price, casing_amount: l.casing_amount, amount: l.amount,
      parts: (l.parts as PartPreview[]) ?? [], markup: (l.markup as MarkupItem[]) ?? [],
      formula_id: l.formula_id, remark: l.remark, install_address: l.install_address,
      open_img: l.open_img, edge_seal_count: l.edge_seal_count, seal_board_height: l.seal_board_height,
      track_length: l.track_length, front_casing_add: l.front_casing_add, back_casing_add: l.back_casing_add,
      double_ding: l.double_ding, light_window_count: l.light_window_count,
      image_id: l.image_id, image_url: l.image_url, progress: l.progress, hole_size: l.hole_size,
      // ⚠️ 行级单号也**必须读回来**，否则保存时被后端 `#[serde(default)]` 抹空
      //    （与上面那四个头字段同一个坑）。
      line_no: l.line_no,
    }))
    void hydrateRowImages(lines.value)
    listOpen.value = false
    markSaved()
    message.success('已载入订单')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '载入失败')
  }
}

function removeOrder(o: OrderSummaryDto) {
  dialog.warning({
    title: '删除订单',
    content: `确定删除订单「${o.receipt_no}」吗？删除后不可恢复！`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.deleteOrder(o.id)
        message.success('删除成功')
        await refreshOrders()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '删除失败')
      }
    },
  })
}

// 原版 `shouldUseNewSizeFormat(ds)`：ds 形如 smartdoor / smartdoor408；无数字后缀或 408 / >414 用新格式。
// 生产环境 ds = 'smartdoor' → 新格式（带 `高:`/`<br/>宽:` 标签那种）。后端 tenants 暂无 ds 列，先常量占位。










// 原版：逐个订单行取「行安装地址」，为空则回填订单级安装地址；去重后以 **`_`** 连接（不是「、」）。

// —— 生产类单据的行顺序（原版各 produces 构造器统一，见 docs/2026-09-11-row-order-exhaustive.md）——
//   ① 平开块在前、吊趟块在后（`_0x4d19f5` 里 ping<i>/diao<i> 两段）
//   ② 块内按 `formulaid → 颜色` 排序（**玻璃合片单入口不排**，故用参数区分）
//   ③ 过滤：丢弃无公式/查不到公式的行；吊趟另丢弃无扇数的行
//   ④ 收尾：`smartdoor_sort_method === 'order'` 时把 ping+diao 合起来按单号数字前缀升序，
//      否则保持 ② 的顺序（原版按 `produce.timestamp` 升序，而 timestamp 就是 ② 迭代时写入的，等价）
const sortMethod = ref(localStorage.getItem('smartdoor_sort_method') || 'profile')
// 「排序方式」对话框（原版 `_0xff1972` 打开 / `_0x2a0b61` 保存）
const sortMethodOpen = ref(false)
const sortMethodDraft = ref(sortMethod.value)
function openSortMethod() {
  sortMethodDraft.value = sortMethod.value
  sortMethodOpen.value = true
}
function saveSortMethod() {
  sortMethod.value = sortMethodDraft.value === 'order' ? 'order' : 'profile'
  localStorage.setItem('smartdoor_sort_method', sortMethod.value)
  sortMethodOpen.value = false
  message.success('排序方式已保存')
}
// 原版按**每行自己的「单号」**的数字前缀排（`parseInt(OrderID.split('-')[0]) || 0`）。







async function printLabels() {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  const rows = printApi.value.labelRows('lable')
  if (!rows.length) {
    message.warning('标签数量为 0，无需打印')
    return
  }
  try {
    await printByMode('lable', rows)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '标签打印失败')
  }
}

// 公式挖孔图缓存（原版 glassHole doorImg = 按行开向取公式图片）
const formulaImages = ref<Record<number, FormulaImageDto[]>>({})
async function loadFormulaImages(fid: number | null) {
  if (fid == null || formulaImages.value[fid]) return
  try {
    formulaImages.value[fid] = await api.listFormulaImages(fid)
  } catch {
    formulaImages.value[fid] = []
  }
}

/**
 * 打印/预览「玻璃订单」前，确保**各行公式的挖孔图都已加载**。
 *
 * ⚠️ `loadFormulaImages` 原先**只在「算料」里调用一次**（`calcSingleRow`），而 `holeImageOf` /
 * `holeImgByDir` 是同步查缓存的 ⇒ **载入一张已保存的订单后直接打印玻璃订单，挖孔图整列为空**
 * （必须先在页面上点一次「算料」才会出现）。这里在打印/预览入口补一次兜底加载
 * （`loadFormulaImages` 自带缓存，重复调用是 no-op）。
 */
async function ensureFormulaImages() {
  const ids = [...new Set(lines.value.map((l) => l.formula_id).filter((v): v is number => v != null))]
  await Promise.all(ids.map((id) => loadFormulaImages(id)))
}







// ===== 预览（模板预览 / 算料共用）=====
// 2026-09-19 收敛：原先这里是一套**自绘**的「模板预览」弹窗（模板下拉 + v-html + 自己渲染），
// 与 Home 的 `PrintPreviewDialog` 功能重复。用户拍板「直接用 home 那个」⇒ 给那个弹窗补上
// 模板下拉（`:templates`），这边整套删掉，只留打开它的入口。
const templatePreviewOpen = ref(false)
const templatePreviewLoading = ref(false)
const templateList = ref<{ mode: string; name: string }[]>([])
const templatePreviewMode = ref<string | null>(null)
const templatePreviewTitle = ref('模板预览')

/**
 * 给 `PrintPreviewDialog` 的订单 = **Hui 当前编辑中的这一单**（可能还没落库）。
 *
 * ⚠️ 显式给 `lines`：弹窗里那句 `o.lines?.length ? o : await api.getOrder(o.id)` 就是靠它
 *    免掉回拉的（未落库的单根本没有 id 可拉）。
 */
const templatePreviewOrders = computed<OrderDto[]>(() =>
  lines.value.length
    ? [{ ...(order as unknown as OrderDto), id: orderId.value ?? 0, lines: lines.value as unknown as OrderDto['lines'] }]
    : [],
)

/**
 * 打开预览（`:1004` 的「模板预览」入口，以及「算料」都走它）。
 *
 * 与旧版自绘那套的差别：预览/打印的**渲染与按钮**都交给 `PrintPreviewDialog` 了，
 * 这里只负责拉模板清单、定初始 mode、给标题。
 *
 * ⚠️ `auto-line-numbers: false`（在模板上）—— Hui 这条链路**从不补行级单号**
 *    （旧版也是；Hui 有独立的「填入单号」按钮）。
 */
async function openTemplatePreview(initialMode?: string) {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  templatePreviewOpen.value = true
  templatePreviewLoading.value = true
  try {
    const all = await api.listPrintTemplates()
    templateList.value = all.map((t) => ({ mode: t.mode, name: t.name }))
    const want = initialMode ?? templatePreviewMode.value ?? all[0]?.mode
    templatePreviewMode.value = want || all[0]?.mode || null
    templatePreviewTitle.value = templateList.value.find((t) => t.mode === templatePreviewMode.value)?.name || '模板预览'
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载模板失败')
  } finally {
    templatePreviewLoading.value = false
  }
}

async function printGlass() {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  try {
    await printByMode('glass', { produces: printApi.value.glassProduces() })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '玻璃单打印失败')
  }
}

// 玻璃订单（glassHole 模板，table.field=glassInfoList）
async function printGlassHole() {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  try {
    await ensureFormulaImages()
    await printByMode('glassHole', { glassInfoList: printApi.value.glassInfoProduces() })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '玻璃订单打印失败')
  }
}

// 生产单定制（product2，mode 8）/ 生产单3（product3，mode 9）—— 均走 `oldSheet` 载荷。
// **product3 需要配对**：`_0x1ebfe1` 把相邻两行合成一张，第二行的所有键加 `1` 后缀
// （模板里同时有 `oldSheet` 与 `oldSheet1` 两张表，正是为此）。原版 mode 9 有独立分支，
// 我们原先只有 product2 一个出口，product3 只能从「模板预览」里打。
async function printProductionCustom(mode: 'product2' | 'product3' = 'product2') {
  if (!lines.value.length) {
    message.warning('暂无订单行')
    return
  }
  try {
    await printByMode(mode, printApi.value.oldSheetProduces(mode === 'product3'))
  } catch (e) {
    message.error(e instanceof Error ? e.message : '生产单定制打印失败')
  }
}

// —— 回执单分享 / 下载（无外部依赖：下载独立 HTML、分享文本摘要） ——


// —— 终端链接 token ——
// 兼容旧版算法：a = tenant_id + 1000, x = 7 × 客户编号 + 1987, t = 时间戳 + 888。
// 终端页（只读订单视图）后续接入后消费 param2 token；当前仅生成并复制链接。
const tenantName = ref('')
// 当前登录用户（原版 maker = userinfo.name，打单人）
const currentUserName = ref('')

const currentClient = computed(() =>
  clients.value.find((c) => c.code === order.client_code),
)

// 原版（@448151 邻近）token = `{a}af{x}wy{now+888}`：
//   `ds === 'smartdoor'` → a = 1000；否则 a = Number(ds.split('smartdoor')[1]) + 1000
//   x = 7 × 客户编号 + 1987
// 注意 a **与租户 id 无关**（原版没有用 tenant.id）。
function buildTerminalToken(clientId: number): string {
  const a = TENANT_DS === 'smartdoor' ? 1000 : Number(TENANT_DS.split('smartdoor')[1]) + 1000
  const x = 7 * clientId + 1987
  const t = Date.now() + 888
  return `${a}af${x}wy${t}`
}

const terminalLink = computed(() => {
  const c = currentClient.value
  if (!c) return ''
  const token = buildTerminalToken(c.id)
  const p = new URLSearchParams({
    param1: order.client_name || c.name,
    param2: token,
    receiptNo: order.receipt_no,
  })
  return `${window.location.origin}/terminal?${p.toString()}`
})

async function copyTerminalLink() {
  if (!currentClient.value) {
    message.warning('请先选择客户')
    return
  }
  try {
    await navigator.clipboard.writeText(terminalLink.value)
    message.success('终端链接已复制')
  } catch {
    message.error('复制失败，请手动复制')
  }
}

// —— 「上次订单」的写入 ——
//
// 旧版只在**「3.保存回执单」成功那一刻**写一次（`H:8853`），页面加载时**什么都不恢复**
// （`onMounted`（`H:8261`）里没有这个键）。口径、修正经过、键名取舍全都写在
// `app/src/utils/lastOrder.ts` 的文件头里 —— 一句话：
// **我们先前那个「编辑中就落盘的实时草稿 + onMounted 无条件恢复」是自造的，已整套删掉**
// （用户 2026-09-19 报的「每次刷新页面都会自动恢复上次订单」就是它）。
function persistLastOrder() {
  writeLastOrder(lastOrderIO, {
    header: { ...order },
    lines: lines.value,
    showPing: showPing.value,
    showDiao: showDiao.value,
    savedAt: Date.now(),
  })
}

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

// ---------------------------------------------------------------------------
// 打印载荷（Hui 这一单）—— 构造层已搬到 `utils/printPayloads.ts`，与 Home 批量打印共用。
// ---------------------------------------------------------------------------
// ⚠️ 这里**故意不给 `totalBalance`**：本对象只喂 `printApi` 的非回执单据
// （玻璃单 / 玻璃订单 / 生产单 —— 见 `printGlass` / `printProduction` 那几处），
// 这几张模板里根本没有 `TotalBalance` 这一格。回执族的打印**全部**走
// `PrintPreviewDialog` → `useOrderPrint.loadPrintPrereqs`，余额在那儿取。
const printCtx = computed<PrintContext>(() => ({
  order,
  lines: lines.value,
  formulas: formulas.value,
  clients: clients.value,
  tenantName: tenantName.value,
  maker: currentUserName.value,
  payQrcode: payQrcodeUrl.value,
  terminalLink: terminalLink.value,
  showPing: showPing.value,
  showDiao: showDiao.value,
  sortMethod: sortMethod.value,
  formulaImages: formulaImages.value,
  today: today(),
  onMarkupError: markupError,
}))
const printApi = computed(() => createPrintPayloads(printCtx.value))

onMounted(async () => {
  loadOpenDirectionSettings()
  void loadPayQrcode()
  // 旧版拉目录失败会弹「初始化失败」（Hui.formatted.js:979）
  void loadMarkupCatalog().then((ok) => { if (!ok) message.error('初始化失败') })
  void loadColumnConfig()
  // 「总余额显示」开关的初值也和旧版一样在 `onMounted` 读（`H:400056` 的 `_0x1c743a`
  // 就是挂在 `Vue.onMounted` 上的）；缺记录 → 保持默认「关」。
  showTotalBalance.value = readShowTotalBalance()
  // 「辅助菜单设置」两个开关**同一批**读 —— 旧版 `H:8263` 是一行连着调
  // `_0x285a13()`（辅助菜单）和 `_0x1c743a()`（总余额）。
  showAssistiveMenu.value = readAssistiveMenu()
  assistiveFullscreen.value = readAssistiveFullscreen()
  markSaved()
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('storage', (e) => {
    if (DIRECTION_STORAGE_KEYS.includes(e.key || '')) {
      loadOpenDirectionSettings()
    }
  })
  try {
    const me = await api.me()
    currentUserName.value = (me.user as unknown as { name?: string })?.name || ''
    tenantName.value = me.tenant.name
  } catch {
    // 忽略：取不到租户信息时沿用空值（门店名回退为空）
  }
  try {
    clients.value = await api.listClients()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载客户失败')
  }
  try {
    formulas.value = await api.listFormulas()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载公式失败')
  }
})
</script>

<style scoped>
/* 减掉全局标题栏的高度（`App.vue` 的 `--app-header-h`）。 */
.page {
  min-height: calc(100vh - var(--app-header-h));
  background: #fff;
  padding: 12px 16px 24px;
}
/* ── 「总余额显示」下拉（照旧版 `_hoisted_33/34` + `element-plus-6bd3a0dc.css` 的 .el-switch__label）── */
/* 开着的 ✓：`H:7771` 的 `{margin-left:5px, color:"#67c23a"}`。 */
.total-balance-check {
  margin-left: 5px;
  color: #67c23a;
}
/* 浮层内容块：`H:7767` 的 `{text-align:center, padding:10px}`。 */
.total-balance-panel {
  text-align: center;
  padding: 10px;
}
/* 提示语：旧版是 `<p style="margin-bottom:12px">`（`H:13299` 附近）。 */
.total-balance-hint {
  margin: 0 0 12px;
}
/* `el-switch__label` 的等价样式：14px / 500 字重、左右各 10px 外边距、当前侧高亮。
   高亮色 `#409eff` = Element Plus 默认 primary，也正是本仓库 `App.vue` 给 naive 的
   `themeOverrides.common.primaryColor` —— 两边同值，所以不存在跟错主题的问题。 */
.switch-label {
  display: inline-block;
  vertical-align: middle;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  transition: color 0.2s;
  cursor: pointer;
}
.switch-label.active {
  color: #409eff;
}
.switch-label--left {
  margin-right: 10px;
}
.switch-label--right {
  margin-left: 10px;
}
.header-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
}
.field {
  display: flex;
  align-items: center;
  gap: 6px;
}
.field .label {
  white-space: nowrap;
  color: #666;
  font-size: 13px;
}
.field.grow {
  flex: 1;
  min-width: 220px;
}
.summary-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 6px;
}
.summary-bar .total {
  font-size: 15px;
  margin-left: auto;
}
.summary-bar .total b {
  color: #e8801f;
  font-size: 20px;
}
.summary-bar .balance {
  color: #18a058;
  font-size: 14px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.lines-card {
  margin-top: 16px;
}
.dims-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}
.dims-grid .n-form-item {
  width: calc(50% - 8px);
}
.dims-grid .n-form-item.grow {
  width: 100%;
}
.calc-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.parts-preview {
  margin-top: 12px;
}
/* ===== 加价项目单元格（照抄 legacy/css/Hui-39b802eb.css，与旧版逐字一致）=====
   ⚠️ 必须用 `:deep()`：这一格是在 **DataTable 的 `render` 回调**里渲染的，
   回调执行时 `currentRenderingInstance` 是 NDataTable 而非本组件，vnode 拿不到本组件的
   `data-v` 标记 ⇒ 不带 `:deep()` 的话 `<style scoped>` 的规则一条都不会命中
   （实测：display 仍是 block、字号仍是 12px、颜色不是 #1302fa）。
   `:deep(X)` 编译成 `[data-v-本组件] X`，靠祖先命中，正好绕开这一点。
   —— 旧版能用普通 scoped 是因为它走 Element Plus 的**作用域插槽**，插槽内容在父作用域渲染。 */
/* 明细表格「一格多控件」的布局类，同样照抄 legacy/css/Hui-39b802eb.css。 */
.markup-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.markup-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.markup-amount {
  min-width: 90px;
  text-align: right;
  color: #e8801f;
  font-weight: 600;
}
.markup-total {
  margin-top: 8px;
  text-align: right;
  color: #18a058;
  font-weight: 600;
}
.receipt-host {
  overflow-x: auto;
}
.production-host {
  overflow: auto;
  max-height: 70vh;
}
/*
 * ⚠️ 这里**故意不给预览内容加任何样式**。
 * 预览就是 hiprint 真渲染（与打印同一套核心），样式一律由 `print-lock.css` 决定，
 * 这样「预览」和「实打」才一致。
 *
 * 曾经加过 `:deep(td) { border/padding/vertical-align: top/white-space }` 和
 * `:deep(img) { max-width: 80px }` —— 它们的**特异性 (0,2,1) 高于** hiprint 的
 * `.hiprint-printElement-tableTarget td` (0,1,1)，会把 hiprint 的
 * `vertical-align: middle` 盖成 `top`，导致预览里所有单据的单元格**变成上对齐**（实打仍是居中，
 * 于是"预览 ≠ 实打"）。要调预览外观，请改模板 JSON 或 print-lock.css，别在这里加覆盖。
 */
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* —— 新版骨架（仿旧版命令行 + 就地表单行 + 两表并排网格）—— */
.top-bar {
  border-top: 2px solid #1a7f3c;
  border-bottom: 1px solid #ebeef5;
  background: #fafbfc;
  padding: 8px 10px 12px;
  margin-bottom: 10px;
}
.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
}
.readonly-meta {
  white-space: nowrap;
}
.readonly-meta .due {
  color: #999;
  font-size: 12px;
  margin-left: 8px;
}
.addr-readonly {
  color: #666;
  font-size: 13px;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
}
.empty-hint {
  padding: 48px 20px;
  text-align: center;
  color: #909399;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  background: #fff;
  margin-top: 12px;
}
.tbl-title {
  font-weight: 600;
  font-size: 14px;
}
/* 两表并排网格：两张表同排，各自横向滚动（仿旧版） */
.tables-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.totals-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-top: none;
  border-radius: 0 0 6px 6px;
  font-size: 13px;
  margin-bottom: 8px;
}
.totals-strip .grand b {
  color: #e8801f;
  font-size: 16px;
}
.totals-strip .bal {
  color: #18a058;
  margin-left: auto;
  font-weight: 600;
}
/* 抽屉里的按钮列 —— 「添加门类」和「视频教程」**共用**这一个 class（旧版两处的 div 都用
   `_hoisted_38 = { class:"door-buttons" }`）。逐字照 `legacy/css/Hui-39b802eb.css`：
     .door-buttons{display:flex;flex-direction:column;gap:30px;padding:20px}
     .door-buttons .el-button{width:100%;display:flex;justify-content:center;align-items:center;text-align:center;padding:0 20px}
     .door-buttons .el-button.is-active,.door-buttons .el-button:hover{width:100%;justify-content:center}
   后一条的「满宽 + 居中」在 naive 里就是 `block`（所以模板上每颗都写了 `block`）；
   naive 的按钮本来就是 `inline-flex` + `justify-content:center` + `text-align:center`
   ⇒ 只剩 `padding: 0 20px` 值得抄（见下）。第三条 `is-active` **是死规则**：
   它写的两条恰好与基础规则一字不差，而 EP 的 `el-button` 也不会自己加 `is-active`
   ⇒ 旧版自己抄重了，不复制。
   ⚠️ `gap:30px` 不是笔误，旧版就是这个数（比一般表单间距大一倍）。
   ⚠️ 旧版 `.el-button` 的高度是 EP 的 32px，naive medium 是 34px —— 那是**全局档位**的事
   （本页一度整体写成 `size="small"`，那是另一笔），不在这里单独压高度。 */
.door-buttons {
  display: flex;
  flex-direction: column;
  gap: 30px;
  padding: 20px;
}
.door-buttons :deep(.n-button) {
  padding: 0 20px;
}
/* 「加价项目管理」的橙色 —— 旧版 `Hui-39b802eb.css` 的
   `.orange-button{background-color:orange!important;border-color:#e69500!important;color:#fff!important}`。
   ⚠️ 旧版那三条 `!important` 把 EP 的 hover/active 态也一起压住了（没有单独的 hover 规则），
   所以这里**四个态同色**。naive 的按钮底色走 CSS 变量（`Button.mjs` 的 `cssVarsRef` 把它们
   以 **inline style** 写在元素上），所以我们的规则必须带 `!important` 才能压过 inline —— 这不是
   随手加的，去掉就失效。 */
.door-buttons .orange-button {
  --n-color: orange !important;
  --n-color-hover: orange !important;
  --n-color-pressed: orange !important;
  --n-color-focus: orange !important;
  --n-border: 1px solid #e69500 !important;
  --n-border-hover: 1px solid #e69500 !important;
  --n-border-pressed: 1px solid #e69500 !important;
  --n-border-focus: 1px solid #e69500 !important;
  --n-text-color: #fff !important;
  --n-text-color-hover: #fff !important;
  --n-text-color-pressed: #fff !important;
  --n-text-color-focus: #fff !important;
}
/* `custom-button-btn` —— 旧版 `Hui-39b802eb.css`（**scope id 是 Hui 自己的 `f7f86ced`，
   所以「视频教程」9 颗和「辅助菜单设置」在旧版就是蓝底白字**）：
     .custom-button-btn{background-color:#7caaf3;color:#fff;border-color:#7caaf3}
     .custom-button-btn:hover,.custom-button-btn:focus{background-color:#0965fa;color:#fff;border-color:#0965fa}
   ⚠️ 旧版**只**定义了 base 与 `:hover/:focus` 两条；`:active` 那一帧会落到 EP 的
   `.el-button:active{background-color:var(--el-button-active-bg-color)}`（0,2,0 压过本 class 的
   0,1,0）。naive 四个态都要有值才不闪，所以 `pressed` 取 hover 那一档 —— 一帧的按压态，
   不值得为此再造一个色值。
   （`connected-btn` 只在 `setting-95715826.css` 里 ⇒ 在 Hui 页真的没有样式，故意不写规则。） */
.door-buttons .custom-button-btn {
  --n-color: #7caaf3 !important;
  --n-color-hover: #0965fa !important;
  --n-color-pressed: #0965fa !important;
  --n-color-focus: #0965fa !important;
  --n-border: 1px solid #7caaf3 !important;
  --n-border-hover: 1px solid #0965fa !important;
  --n-border-pressed: 1px solid #0965fa !important;
  --n-border-focus: 1px solid #0965fa !important;
  --n-text-color: #fff !important;
  --n-text-color-hover: #fff !important;
  --n-text-color-pressed: #fff !important;
  --n-text-color-focus: #fff !important;
}
/* 「全面屏（不预留底部空间）」那一块 —— 旧版 `_hoisted_36`（`H:7775`）里
   `{text-align:center; padding:10px}`，里面的 `<p>`（`H:13330-13332`）是
   `{margin-bottom:10px; font-size:13px; color:#666}`。 */
.fullscreen-row {
  text-align: center;
  padding: 10px;
}
.fullscreen-hint {
  margin: 0 0 10px;
  font-size: 13px;
  color: #666;
}
.hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}
.square-dialog p {
  margin: 4px 0 10px;
}
.vis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
  /* 限高可滚：见模板里的说明 */
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 6px;
}
.vis-col .vis-head {
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a7f3c;
}
.vis-col .n-checkbox {
  display: block;
  margin-bottom: 6px;
}
.mgmt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.mgmt-name {
  /* 旧版三个加价项目弹窗都是 el-form `label-width: 100px`（:2655 / :13130 / :13179） */
  width: 100px;
  flex: none;
}
/* 未保存行 / 命中单号行高亮 —— 颜色照抄旧版：
   .el-table__row.unsaved-row>td.el-table__cell{background-color:#ffe6ef!important}
   hover → #ffd6e6；.highlight-matched-order → #d4edda / hover #c3e6cb */
/* 自定义开向命名 */
.custom-name-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
}
.custom-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.custom-name-row .orig {
  flex: none;
  width: 80px;
  font-size: 12px;
}
.mgmt-price {
  width: 80px;
  text-align: right;
}
.mgmt-unit {
  width: 80px;
}
</style>
