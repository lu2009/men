# Home 主表保真度审计（主表 / 列 / 筛选 / 排序 / 分页 / 展开行）

> 审计对象：旧版 `legacy/js/Home-d6b13b9a.js` 主 Home 组件 ↔ 新版 `app/src/views/Home.vue`
> 旧版坐标一律用**当前** `legacy/js/Home.formatted.js` 行号（主组件 = 第 7568–12278 行，该文件已被重新格式化过，
> 与 `docs/2026-09-17-home-analysis.md` §附 里那批「:3884@偏移」**对不上**，本文行号以当前文件为准，已逐条 `sed` 验证）。
> 字符串表解码：`node legacy/decode-token.mjs dr <idx>`（主表用 `dr`）。
> 判定：✅ 已做 / ⚠️ 偏离 / ❌ 未做 / ❓ 未确认

---

## A. 表格本体属性

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| A1 | 表格高度 | `Home.formatted.js:11297-11298` `height:"calc(105vh - 280px)"` | `Home.vue:63`（`tableHeight`）、`Home.vue:1119` `'calc(100vh - 300px)'` | ⚠️ 偏离 | 数值不同：旧版 105vh−280px，新版 100vh−300px ≈ 矮了 5vh+20px。属实现期改写，未见文档记录，疑无意。 |
| A2 | 表头样式 | `:8003-8007` `ha()` → `backgroundColor:"#FAEBD7"`、`color:"#000"`、`fontSize:"16px"`、`fontWeight:"bold"`、`textAlign:"left"` | `Home.vue:1170-1176` | ✅ 已做 | 五项全对（用 `:deep(.n-data-table-th)` 实现）。 |
| A3 | 单元格样式 | `:8138-8140` `dn()` → `{fontSize:"16px"}` | `Home.vue:1177-1179` | ✅ 已做 | 一致。 |
| A4 | `row-key` | `:11298` `"row-key":s(467)` = `回执单号` | `Home.vue:61` `:row-key="row => row.id"` | ✅ 已做 | 等价改写：新版用自增 `id`，旧版用回执单号；两者在各自系统内都是唯一键。 |
| A5 | `highlight-current-row` | `:11298` `"highlight-current-row":""` | 无 | ❌ 未做 | Naive 无等价物，未做。视觉影响小（行 hover/选中高亮）。 |
| A6 | 表格宽度 | `:11299-11300` `style:{width:"100%"}` | `Home.vue:64` `:scroll-x="1750"` | ⚠️ 偏离 | 旧版 100% 自适应；新版固定 1750 横向滚动。min-width 求和 ≈ 1710，尚算等价，但列宽策略不同。 |
| A7 | 复选列 | `:11302-11303` `{type:"selection", width:"55", "reserve-selection":""}` | `Home.vue:1020` `{type:'selection'}` | ⚠️ 偏离 | 没给 width 也没开「翻页保留勾选」（naive 对应 `reserve-checked-row-keys` / `checked-row-keys` 受控）。新版是受控 `checked-row-keys`，翻页不丢勾选，行为**碰巧**接近，但列宽非 55。 |
| A8 | 展开列 | `:11304-11305` `{type:"expand", width:"55", "class-name":"expand-column"}`；CSS `.expand-column .el-table__expand-icon--expanded{transform:rotate(90deg)}` | `Home.vue:1021` `{type:'expand', renderExpand}` | ⚠️ 偏离 | 缺 `width:55` 与 `expand-column` 类（图标旋转 90° 的样式）。 |
| A9 | 行事件（hover 自定义 tooltip） | `:11298` `onCellMouseEnter:sa` / `onCellMouseLeave:da`；`:8056-8074`（`sa`/`da`/`Va`）、`:11602-11605`（Teleport 渲染 `ia`） | 无 | ❌ 未做 | 旧版在「客户」「打单操作」两列 hover 时弹出一个自绘 tooltip（`✓/○ + 步骤名` 列表，已付清再追加一行）。新版完全没有。 |
| A10 | 4 个空注释占位列 | `:11464`（门数后 1 个 `createCommentVNode`）、`:11599`（末尾 3 个） | 无 | ✅ 已做 | 旧版这 4 处只渲染注释节点，**不产生列**，所以「没做」等于「做对」。**注意**：`docs/2026-09-17-home-analysis.md` §3 表把它写成「19–21 空注释占位」，位置说错了一个（真正的第 1 个在门数与总价之间）。 |

---

## B. 逐列

### B-1 列集合与列序

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| B1 | 工厂视图（`Yt`=true）完整列序 | `:11301-11599`：复选 / 展开 / 操作 / 财务(`Yt&&Ht`) / 单号集(`Yt`) / 客户(`Yt`) / 日期 / 门数 / (占位) / 总价 / 已付(`Yt`) / 未付 / 订单备注(`Yt`) / **安装地址(`Yt`)** / **打单操作(`Yt`)** / 业务员(`Yt`) / 打单人(`Yt`) | `Home.vue:1019-1117` | ⚠️ 偏离 | **列序错位**：旧版工厂视图里「安装地址」「打单操作」排在**订单备注之后**（第 14/15 列，见 `:11524-11525`、`:11532-11533`）；第 7/8 位那两个是 `!Yt`（终端）专用（`:11437-11438`、`:11445-11446`，工厂下被 `createCommentVNode` 掉）。新版只做工厂视图，却把这两列放到了第 7/8 位。用户能直接看出列序不同。 |
| B2 | 终端视图（`Yt`=false）专用列 | `:11437-11446`（`!Yt`：安装地址、打单操作）；`:11297-11298` 注释 `:8187` | — | ✅ 已做 | 新版明确只做工厂视图（`Home.vue:929` 注释「Phase 1 = 工厂视图 Yt」），终端分支未做是**有意**的；该分支在旧版也靠 `Yt` 开关互斥，不算漏列。 |
| B3 | 「财务」独立列 | `:11351-11360`：`Yt&&Ht` 时新增 `{label:"财务", width:"56", align:"center"}`，内含 `type:"success" circle` 的 `¥` 按钮（`title:"财务管理"`）→ 开 FinanceDrawer | `Home.vue:1033`（挪进「操作」列的 `财务` 小按钮） | ⚠️ 偏离 | 入口在、动作对（`openFinance` → FinanceDrawer），但**形态完全不同**：旧版是独立 56px 居中列里的绿色圆形 `¥`；新版是操作列里的文字按钮。 |

### B-2 「操作」列

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| B4 | 操作列宽 | `:8138` `cn=Vue.computed(()=>za.value?150:1)` | `Home.vue:1025` `width: editingId != null ? 150 : 140` | ⚠️ 偏离 | 旧版**非编辑态宽度 = 1px**（整列基本塌掉、只显示内联编辑的保存/取消），新版非编辑态 140px 常驻两颗按钮。 |
| B5 | 操作列内容 | `:11318-11331`：仅编辑态显示「保存 / 取消」 | `Home.vue:1026-1037`：非编辑态显示「财务 / 电子回执单」 | ⚠️ 偏离 | 旧版的「财务」是独立列、「电子回执单」是工具栏按钮（选中 1 条才出现，`:8067` 附近 `bn`）；新版把两者塞进操作列常驻。 |
| B6 | 保存动作 | `:11322-11329`：`!Yt && 打单操作!=="自助下单"` → 报错「已确认的单只能工厂修改！」；否则 POST `updateCustomerInfo`（整行） → 刷新 + 子表 `markRowsPersisted` | `Home.vue:430-441` `saveEdit()` → `api.updateOrderHead` | ✅ 已做 | 主链路对；旧版那条「已确认的单只能工厂修改」在工厂视图下恒不触发（`!Yt` 条件），所以新版不实现不算漏。 |

### B-3 「单号集」列（`Yt`）

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| B7 | 列定义 | `:11364-11365` `{key:1,label:"单号集",prop:"单号集","min-width":120}` | `Home.vue:1039-1042` `{title:'单号集', minWidth:120}` | ✅ 已做 | 一致。 |
| B8 | 取值：拆分成多单号 | `:7699-7702` `To(e)` → `Uo(单号集)`，`:7694-7697` `Uo = s.trim().split("_").map(trim).filter(Boolean)` | `Home.vue` `splitOrderNos()` | ✅ 已做（2026-09-18） | 改成按 **下划线 `_`** 拆，与旧版逐字一致。⚠️ `0018_home_order_head_fields.sql:4` 的注释写「空格串」仍是**未决的口径冲突**（见 I9）；这里沿用本文件对 `打单操作` 已经定下的处置：**以旧版源码为准**，两处保持同一套。逐字对照见 `orderno-logiccheck.mjs`。 |
| B9 | 单元格显示：只显示第一段 | `:7702` `l[0] \|\| ""`；`:11368-11373` hover popover 列出全部 | `Home.vue:1047-1050` | ✅ 已做 | 结构一致（首段 + hover 看全）。 |
| B10 | 列头「查单号」popover | `:11366-11384`：表头内嵌 `el-popover` + 输入框（placeholder 待查）+ 清除/确认，`Yo` 按 `po` 过滤首段 | `Home.vue` 单号集列 `title` 渲染 + `confirmOrderNoQuery()` | ✅ 已做（2026-09-18） | 含：`po` 参与筛选（**`startsWith`，不是 `includes`**）、**自动补年份后缀** `-YY`（`:7703-7709`）、命中后**展开第一条**、没命中 `warning` 且清空 `po`。⚠️ 旧版命中后那段「滚到 `.highlight-matched-order` 居中」**做不了** —— `OrderLineDto` 里没有「单号」字段，见 `02-actions.md` I4。 |
| B11 | 单号集列头「清除」按钮 | `:11367-11371`：`po` 非空时显示 `text` 按钮「清除」 | `Home.vue` 单号集列 `title` 渲染 + `clearOrderNoQuery()` | ✅ 已做（2026-09-18） | 一并照抄了旧版的「恢复中...」态与那个 `setTimeout(..., 50)` 的时间轴，以及清除时**收起所有已展开行**。 |

### B-4 「客户」列（`Yt`）

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| B12 | 列定义 | `:11400` `{key:2,label:"客户",prop:"客户","min-width":100,filters:ta("客户"),"filter-method":ga,"filter-placement":"bottom-start"}` | `Home.vue:1053-1059` | ⚠️ 偏离 | 列本身在、minWidth 100 对；**`filters` 整套没做**（详见 C11）。 |
| B13 | 已付清绿标 `.paid-customer` | `:11402-11404` `class:{"paid-customer":Vo(row)}`；CSS `.paid-customer{background-color:#90ee90!important;padding:4px 8px;border-radius:4px;color:#000;font-weight:700}` | `Home.vue` 客户列 `render`（`unpaidOf(row)===0` → `clickable-cell paid-customer`） | ✅ 已做（2026-09-18） | `Vo(e)` = `Number(so(e))===0`（`:7664`，即未收为 0）。样式逐字取自 `legacy/css/Home-97d96482.css`。 |
| B14 | 单元格点击 → 改客户名 | `:11298` `onCellClick:en`，`:8067-8069` `en` → `property==="客户"` → `Qa(e)` 开「修改客户名称」弹窗 | `Home.vue:1058` `onClick: () => openRename(row)` + `Home.vue:88-108` | ✅ 已做 | 行为一致（弹窗标题、原客户 disabled、提交走更新接口）。差异：旧版「修改为」是 `el-autocomplete`（`finance_updateOrderCustomer`），新版是普通 `n-input` + `updateOrderHead`（`Home.vue:463`），见 §4.4 那条；弹窗形态本身对得上。 |
| B15 | 单元格 `title` 提示 | `:11405` `title:"点击修改客户名称"` | 无 | ⚠️ 偏离 | 少了原生 tooltip。 |

### B-5 「日期」列

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| B16 | 列定义 | `:11410` `{label:"日期",prop:"日期","min-width":90,filters:ta("日期"),"filter-method":ga,sortable:true,"sort-orders":[s(890),s(1263),null]}` = `["descending","ascending",null]` | `Home.vue:1061-1067` `{title:'日期', minWidth:90, sortable:true}` | ✅ 已做 | 唯一可排序列一致（见 D 段）。 |
| B17 | 是否可排序 | 同上 | 同上 | ✅ 已做 | 全表仅日期列 `sortable` ✅（`:11464` 总价列无 sortable）。 |
| B18 | 排序方向循环 | `:11410` `"sort-orders":["descending","ascending",null]` | 未声明（Naive 默认 `['ascend','descend',false]`） | ⚠️ 偏离 | 旧版显式声明**以降序开场**，新版用默认**升序开场**，第一次点击的排序方向相反。依据是两份源码里声明的 `sort-orders` 数组本身（两框架都把数组第 0 项当作首次点击的方向）。 |
| B19 | 未审核标记（`date-audit`） | `:11221` `Ls(e)`：`bs(e)`（`:11148-11151` = `打单操作` 空 **且** `单号集` 空）→ 返回 `"date-audit"`；CSS `.date-audit{background:#ffb6c1!important;color:#721c24;padding:4px 8px;border-radius:4px;font-weight:700}` | `Home.vue:401`（`rowProps` 加 `date-audit`）、`Home.vue:1283-1285` | ⚠️ 偏离 | **判定口径完全一致** ✅，但**呈现层级不同**：旧版是套在**日期单元格内的那个 div** 上的小色块（有 padding/圆角/深红字），新版是整行 `td` 铺 `#ffb6c1`。视觉差别明显。 |
| B20 | 临近截止标记（`date-warning`） | `:11221-11227` `Ls`：非未审核 && `so(e)!==0` && 有 `截止日期` && `Math.floor((new Date(截止日期)-now)/864e5) < 4` → `"date-warning"`；CSS `.date-warning{background:#fff3cd;color:#856404;...}` | `Home.vue:388-397` `isDueSoon`、`Home.vue:402`、`Home.vue:1286-1288` | ⚠️ 偏离 | 三处差异：①旧版是**无下界**的 `< 4`，**已逾期**（负数）同样命中；新版 `diff >= 0 && diff <= 4` 把逾期行排除了。②旧版要求 `未收 != 0`（已付清不加），新版不看付款状态。③同 B19 的层级差异（cell 小色块 vs 整行）。 |
| B21 | 单元格点击的**前置校验** | `:11416-11422`：`打单操作.trim()` 非空 → `ElMessage.warning("已生产的单不能修改生产日期")`，否则才开「修改下单日期」弹窗 | `Home.vue:1066` `onClick: () => openDate(row)`（无校验） | ⚠️ 偏离 | 新版点日期**无条件**开弹窗，旧版对已生产的单会拦下并提示。属行为差异。 |
| B22 | 「审核确认」按钮 | `:11423-11438`：`bs(row)`（未审核）时在日期格内追加一颗 `el-button`「 审核确认 」，点击 → 设今天为下单日期 + `updataProgress`(工序10,「确认下单」) → 「更新成功」 | 无 | ❌ 未做 | 新版日期列没有这颗按钮，也没有对应的审核动作。 |
| B23 | `date-danger` | 分析文档 §12 称已定义未引用 | 无 | ✅ 已做 | 复核：`legacy/css/Home-97d96464.css` 里确有 `.date-danger` 样式，但 `Ls` 只返回 `date-audit`/`date-warning`，全组件无第二处引用 → **死样式**，新版不做是对的。 |

### B-6 「安装地址」列

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| B24 | 列定义 | `:11438`（`!Yt`）/ `:11525`（`Yt`）两处 `{label:"安装地址",prop:"安装地址",filters:ta("安装地址"),...,"min-width":220}` | `Home.vue:1068-1073` `{title:'安装地址', minWidth:220}` | ⚠️ 偏离 | minWidth 220 对；`filters` 未做（C11）；工厂视图下的**列位置**错位（B1）。 |
| B25 | 单元格形态 | `:11440-11444` / `:11527-11531`：**常驻** `el-input type="textarea" autosize{1,3}` `class="input-style"`，`onFocus` 才置 `za=row` 进编辑态 | `Home.vue` `renderEditable()` | ✅ 已做（2026-09-18） | 改成**常驻输入框**：非编辑态显示行值、`onFocus` 进编辑态，`autosize{minRows:1,maxRows:3}`、`class="input-style"` 都照抄。CSS 也补了（旧版 §11.2 的 `border:none` + hover `#f5f7fa` + focus `#ecf5ff`/`0 0 0 2px #409eff33`）。 |

### B-7 「打单操作」列

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| B26 | 列定义 | `:11446`（`!Yt`）/ `:11533`（`Yt`）：`{label:"打单操作",prop:"打单操作",filters:ta("打单操作"),...,"min-width":150}` | `Home.vue:1074-1080` | ⚠️ 偏离 | minWidth 150 对；`filters` 未做（C11）；工厂视图下**列位置**错位（B1）。 |
| B27 | 列头 popover 触发器 | `:11534-11546`：表头 = 文字「打单操作」+ `text` 按钮「 生产进度 」+ 当前值 `(值)` | `Home.vue` 打单操作列 `title` | ✅ 已做（2026-09-18） | 结构齐了（列头文字 + `生产进度` 按钮 + `(当前值)` + 列表 + 分隔线）。 |
| B28 | 进度色条的**分段** | `:7964-7970` `ua(e)`：5 固定段 + 自定义段；`:7690-7696` `na=[{确认下单,#389e0d,flex:1},{生产单,#d48806,flex:2},{玻璃订单,#096dd9,flex:2},{标签,#c41d7f,flex:2},{收据单,#237804,flex:2}]`；未完成底色 `#e0e0e0`（`:11579`）；每段 `minWidth:"4px"` | `Home.vue:239-245`（常量）、`Home.vue:940-952` `renderProgress` | ✅ 已做 | 5 段的 label / 色 / flex 比例 / 未完成底色 `#e0e0e0` 全对；只有 `minWidth:4px` 没写（旧版有、`Home.vue:948` 无），影响极小。 |
| B28b | 进度色条的**外观盒模型** | `:7446-7449`（`Au`）/ `:7490-7493`（`ju`）：条容器 `display:flex; height:12px; border-radius:6px; overflow:hidden; gap:1px; margin-bottom:4px` | `Home.vue:1212-1220` `.progress-bar{height:16px;border-radius:3px}`（分段间无 gap，无 margin-bottom）；`.progress-cell{padding:2px;border-radius:3px}` | ⚠️ 偏离 | 高度 12px→16px、圆角 6px→3px、段间 `gap:1px` 没做、条下方 `margin-bottom:4px` 没做。观感是「细胶囊状、段间留白」vs「粗方块」。 |
| B29 | 「确认下单」段的完成判定 | `:7967` `done: "确认下单"===label ? l.length>0 : l.includes(label)`（`l = String(打单操作\|\|"")`） | `Home.vue:948` `status.includes(step.label)` | ⚠️ 偏离 | 旧版「确认下单」段只要 `打单操作` **非空**就算完成（不等于必须含「确认下单」四字）；新版要求字符串里真的含「确认下单」。例：`打单操作 = "生产单 玻璃订单"` → 旧版首段亮，新版首段灰。 |
| B30 | 自定义进度段 | `:7968-7969` `ua` 追加 `Ea.value`（localStorage `home_manual_progress_actions`）里不在固定表里的项，`flex = 3/个数`，色 `#531dab`（`:7968` `t(1012)`） | 无 | ❌ 未做 | 新版 `PROGRESS_STEPS` 写死 5 段，自定义段（含其 flex 分配算法 3/N）完全没有。 |
| B31 | 单元格底色（`la`） | `:7940-7942` `la(e)`：含「收据单」→`#90EE90`、含「标签」→`#FFC0CB`、含「玻璃订单」→`#87CEEB`、含「生产单」→`#FFFF99`、含「自助下单」→`#FFA500`（**按此优先级短路**）。**调用点只有 2 处**：`:11589`（业务员列）与 `:11597`（打单人列） | `Home.vue:931-938` `statusBg` → 用在**打单操作**格子 `Home.vue:1079` | ✅ 已做（2026-09-18，**结论两次更正**） | ⚠️ **先更正既有文档**：`docs/2026-09-17-home-analysis.md` §3 写「「打单操作」单元格底色（`la`）」—— **错的**，打单操作格子（`:11571-11582`）只有 `style:{cursor:"pointer"}`。<br>⭐ **再更正本条审计自己**：原文说 `la()` 在业务员/打单人「**非管理员分支**」被调用 —— **不是管理员，是 `qt`**。`qt = (userinfo.registrant === userinfo.name)`（`:8147`），即「**正在看的这份数据是不是自己租户的**」，是旧版**代看别的租户**时的只读闸门。`la()` 的两个调用点（`:11589`/`:11597`）都长成 `qt ? <el-input> : <div style={la(值)}>`，**带底色的是 `!qt` 那一支**。<br>新版没有租户切换 ⇒ **`qt ≡ true`** ⇒ 那五个底色**在本系统里根本到不了**。<br>⇒ 处置：业务员/打单人改成**常驻输入框**（`qt` 真分支），那套 `la()` 底色**整体删掉**（不是漏做，是不可达）。<br>（先前 `a70ac477` 把底色挂到了这两列的「非编辑态显示」上 —— 函数挂对了，但挂在一个进不去的分支上。）<br>逐字对照见 `editable-cell-logiccheck.mjs`（15 条全过：`la(` 恰好两处调用且都在 `qt` 假分支、`qt` 的算法、两列无 `qt` 门控、`nn` 的语义）。 |
| B32 | 单元格文字（前段 + 末段） | `:11582`（`Yt`）/ `:11454`（`!Yt`）：进度条后跟 `<span>[{oa(打单操作)}][{aa(打单操作)}]</span>`；`oa`(`:7943-7947`) = 去掉最后一段后**加回一个 `_`**，样式 `{font-weight:400}`（`:7494-7497` `qu`）；`aa`(`:7948-7952`) = 最后一段，样式 `{color:#d9001b; font-weight:700}`（`:7498-7501` `Ju` / `:7454-7457` `Pu`） | 无 | ❌ 未做 | 新版打单操作格子里**只有进度条，没有任何文字**。旧版条下方还有一行「`前段_`」+「**深红加粗的末段**」。 |
| B33 | 单元格「✓已付」徽标 | `:11582`（`Yt`）/ `:11456`（`!Yt`）：`Vo(row)` 时追加 `<span>✓已付</span>`，样式 `{margin-left:4px; color:#52c41a; font-size:10px; font-weight:700; vertical-align:middle}`（`:7502-7505` `_u` / `:7458-7461` `Iu`） | 无 | ❌ 未做 | 同 B13 的「已付清」语义，旧版两处都有标记（客户列绿块 + 打单操作格 `✓已付`），新版两处都没有；连徽标的字号/色/字重都一并缺。 |
| B34 | 单元格点击 → 手动更新进度弹窗 | `:11298` `onCellClick:en`，`:8067-8069` → `property==="打单操作"` → `Ha(row)` 开弹窗（回执单号 disabled + 操作名称 autocomplete + 日期 + 记录日期） | 无 | ❌ 未做 | 新版打单操作格子没有点击行为（`Home.vue:1078-1079` 无 onClick）。 |

### B-8 「门数」「总价」「已付」「未付」

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| B35 | 门数列 | `:11460-11461` `{label:"门数",prop:"门数","min-width":80,filters:ta("门数"),...}`，渲染 = 原值直出（`:11462`） | `Home.vue:1081` `{title:'门数', key:'door_count', minWidth:80}` | ✅ 已做 | 取值/宽度一致（新版无 render → Naive 直出原值，同旧版）。仅缺 `filters`（C11）。 |
| B36 | 总价列 | `:11464-11467` `{label:"总价",prop:"总价","min-width":100,filters:ta("总价"),...}`，渲染 = **原值直出**（`:11466` `toDisplayString(e.row["总价"])`） | `Home.vue:1082` `render: row => fmt(row.total_price)` | ⚠️ 偏离 | 新版做了 `toFixed(2)`（`Home.vue:287`），旧版是**不做任何格式化**的裸数字。例：旧版显示 `18500`，新版显示 `18500.00`。 |
| B37 | 已付列 | `:11468-11473`：`{label:"已付",prop:"定金","min-width":100,filters:ma,"filter-method":ya}`；渲染 = `已分配金额 != null ? <span>{已分配金额}</span> : el-input(定金)`；该 span 样式 `{font-weight:600; color:#409eff}`（`:7462-7465` `Uu`，**蓝色**） | `Home.vue:1083-1099` | ⚠️ 偏离 | 四处差异：①新财务态下旧版显示 `已分配金额`（`:11470` `e.row[s(891)]`，`s(891)="已分配金额"`）且**染成蓝色 600**，新版恒显示 `deposit`（`Home.vue:1097` `fmt(row.deposit)`）且无色；②旧版裸数字，新版 `toFixed(2)`；③旧版非编辑态是**常驻输入框**，新版是点击进编辑态；④新版完全没读 `已分配金额`。 |
| B38 | 未付列取值 | `:11474` `{label:"未付",formatter:io,...}`，`io=e=>so(e)`（`:7669`）；`so`(`:7671-7673`) = `Ht && 未收金额!=null ? 未收金额 : 总价-定金` | `Home.vue:1100-1108`，`unpaidOf`(`Home.vue:289-292`) | ✅ 已做 | 口径一致（新版把 `Ht` 换成「财务摘要里有就用 `unpaid_amount`，否则 `总价-定金`」）。 |
| B39 | 未付列着色 | `:11509-11515`：`未收金额 != null` 时 → `color: 未收金额<=0 ? "#67c23a" : "#f56c6c"`，`fontWeight:"600"`；**否则回退分支不着色**（`:11511-11513` 纯文本 `so(row)`） | `Home.vue:1104-1107`：恒 `color: u<=0?'#67c23a':'#f56c6c'`，`fontWeight:'bold'` | ⚠️ 偏离 | 新版**恒着色**（旧版只在「有 `未收金额` 字段」时着色）；字重 `bold`(700) vs 旧版 `600`。旧版这个「回退不着色」在无新财务系统时是常态，观感差挺明显。 |
| B40 | 未付列头 popover | `:11475-11508`：表头内 `el-popover`（width 220），reference 是 `text` 按钮「 付款状态 」+`(当前值)`；option = 已付 / 未付 / 部分付 / 全部显示 | `Home.vue` 未付列 `title` | ✅ 已做（2026-09-18） | 宽度 220、按钮文案、`(当前值)`、选项顺序、拦截语义全齐。另：旧版触发器**没有** `▾` 箭头，先前多画了一个 —— 一并去掉。 |
| B41 | 未付列 popover 的命中语义 `Eo` | `:7673-7675` `Eo=e => {l=Number(so(e)\|\|0); o=Number(总价\|\|0); return l<=0?"已付": o>0&&l>=o?"未付":"部分付"}` | `Home.vue:294-299` `paymentStatus` | ✅ 已做 | **逐字一致**。 |

### B-9 「订单备注」「业务员」「打单人」

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| B42 | 订单备注列 | `:11516-11523`：`{label:"订单备注",prop:"订单备注","min-width":220}`，常驻 `el-input textarea` | `Home.vue` 订单备注列 `render` | ✅ 已做（2026-09-18） | 常驻 textarea 见 B25。`filters` 已由列头原生筛选（C16–C18）覆盖。 |
| B43 | 业务员列 | `:11583-11590`：`{label:"业务员",prop:"业务员","min-width":80}`；`qt`（管理员）→ `el-input.borderless-input`，**否则 → `<span style={la(row["业务员"])}>`**（`:11587-11589`） | `Home.vue:1115` `render: row => renderEditable(row,'salesperson')` | ⚠️ 偏离 | 新版**恒可编辑**，没有 `qt` 分支；旧版非管理员时这里是**只读文本**，且套着 `la()` 那串内联样式（`background-color:X; padding:4px 8px; border-radius:4px; font-weight:bold`）。`la(业务员)` 用「收据单/标签/玻璃订单/生产单/自助下单」这几个关键词去匹配**业务员姓名**，明显是旧版自己的写法问题（正常人名多半匹配不到 → 返回 `""`，等于没底色），但「管理员才可编辑」这条差别是实在的。 |
| B44 | 打单人列 | `:11591-11598`：同 B43，prop = `打单人`（`s(511)`），`la(row["打单人"])` | `Home.vue:1116` `renderEditable(row,'creator_name')` | ⚠️ 偏离 | 同 B43。 |

---

## C. 筛选（4 套机制逐套核）

### C-1 顶部搜索框

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| C1 | 搜索框本身 | `:11246` `el-input modelValue:Rc placeholder:"搜索客户、安装地址等" class:"search-input" clearable onFocus:Ns onClear:Ms onInput:Es` | `Home.vue:38-45` | ✅ 已做 | placeholder / clearable / 放大镜前缀都对（旧版前缀是 `el-input` 的 `prefix` 插槽，见 §1.1）。 |
| C2 | 匹配字段集 | `:11178`：`客户 / 定金 / 总价 / 安装地址 / 订单备注 / 打单操作 / 业务员 / 日期 / 回执单号`，全部 `toString().toLowerCase().includes(关键词)`，**OR 连接** | `Home.vue:318-333` `matchSearch` | ✅ 已做 | 9 个字段逐条一致，`includes` + OR 一致。 |
| C3 | 防抖 | `:11207-11209`（`home.txt:3414`）`watch(Rc) → clearTimeout + setTimeout(150ms) → Fc` | `Home.vue:39` 直接 `v-model:value="searchText"`，无防抖 | ⚠️ 偏离 | 旧版输入与过滤值之间隔 150ms 防抖（且**汇总条读的是未防抖的 `Rc`**）；新版实时过滤。功能等价、性能特征不同。 |
| C4 | 搜索时汇总信息条 | `:11251`（`home.txt:3684`）`Rc` 非空时显示：`当前筛选: {Rc} ({ps.length} 条结果) \| 时间: {earliest} 至 {latest} \| 门数: {ls} \| 总价: {os.toFixed(0)} \| 已付: {as.toFixed(0)}\| 未付: {ns.toFixed(0)} \| 未付单数: {us} \| 未审核: {rs}` | `Home.vue:46-52` | ⚠️ 偏离 | **少了「已付」一项**（旧版 `as` = 已付合计）。其余字段齐全，且都用了 `toFixed(0)` 一致。 |
| C5 | **无搜索时**的常驻信息条 | `:11251` 同行的 `else if(_l.length>0)` 分支：`总计: {ps.length} 条记录 \| 时间: ... \| 门数: ... \| 总价: ... \| 已付: ... \| 未付: ... \| 未付单数: ... \| 未审核: ...` | 无 | ❌ 未做 | 旧版**不搜索时**也有一条常驻汇总条（`总计: N 条记录 ...`）。新版只在有搜索词时显示。 |

### C-2 「未付」列头 popover（付款状态）

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| C6 | 选项集与语义 | `:7673-7675` `Eo`；选项 `已付`(`:11482-11489`)、`未付`(`:11490-11497`)、`部分付`(`:11498-11505`)、`全部显示`(`:11506-11507` → `bo` 清空) | `Home.vue:236` `PAYMENT_OPTIONS`、`Home.vue:344-346` | ✅ 已做 | 4 个选项 + 过滤语义完全一致。 |
| C7 | 选项**顺序** | `:11482-11507` 渲染顺序：已付 → 未付 → 部分付 → 全部显示 | `Home.vue` `PAYMENT_OPTIONS` | ✅ 已做（2026-09-18） | 顺序已按旧版（清除项「全部显示」放**最后**）。逐字对照见 `headerfilter-logiccheck.mjs`（从源码切出选项序列比对，13 条全过）。 |
| C8 | 触发器显示当前值 | `:11479-11481` reference = 按钮「 付款状态 」+ 选中时 `(值)` | `Home.vue` `headerFilter()` | ✅ 已做（2026-09-18） | 已显示 `付款状态 (未付)`。⭐ 顺带发现**两列的回显样式不一样，别统一**：`未付` 的值是**裸文本**（`:11481`），`打单操作` 的包在 `<span style="color:#409eff;font-weight:700;margin-left:4px">` 里（`Ou`，`:11541`）—— 已按各自口径实现（`highlightValue` 开关）。 |
| C9 | 选中态样式 | `:11483` 选中 → `color:#409eff; fontWeight:"700"`；未选中 → `#606266 / 400` | `Home.vue:1252-1255` `.filter-item.active{color:#409eff;font-weight:700}` | ✅ 已做 | 一致。 |
| C10 | 切换后回第 1 页 | `:7676-7678` `Lo/Lo` 内 `Kl.value=1` | `Home.vue:381-383` `watch(...) => page=1` | ✅ 已做 | 一致。 |

### C-3 「打单操作」列头 popover（生产进度）

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| C11 | 固定 4 项 + 语义 | `:7673` `Bo=[已打生产单,未打生产单,已订玻璃,未订玻璃]`；`:7682-7687` `Ao`：`已打生产单→includes("生产单")`、`未打→!includes`、`已订玻璃→includes("玻璃订单")`、`未订→!includes` | `Home.vue:237`、`Home.vue:301-308` `progressMatch` | ✅ 已做 | 逐条一致（含「字段为空则恒 true」的早退，`:7684` ↔ `Home.vue:303` 空串时 `!''.includes('生产单')`→true）。 |
| C12 | 自定义项（localStorage） | `:7689-7697` `La = Ea 中不在 Bo 里的项`，`Ea` 读 localStorage key `home_manual_progress_actions`（`:8013`）；`:11558-11573` 渲染为可点项，选中色 `#409eff` | 无 | ❌ 未做 | 新版 popover 只有 4 个固定项。自定义项的**持久化键**在旧版是 `home_manual_progress_actions`（`Home.formatted.js:7568` 附近的 `wr` 常量），新版没有对应物。 |
| C13 | 选项顺序 | `:11547-11573`：4 固定项 → 分隔线(`:11574`, `La.length` 时) → 自定义项 → 「显示全部」(`:11575-11581`) | `Home.vue` `PROGRESS_OPTIONS` + `headerFilter({dividerBefore})` | ✅ 已做（2026-09-18） | 四段顺序都对，「显示全部」在最后；分隔线也补了（`NDivider`，`margin:4px 0`），且是**条件式**——只在有自定义项时插（旧版 `v-if="La.length"`）。 |
| C14 | 触发器显示当前值 | `:11549-11553` reference：按钮「 生产进度 」+`(值)` | `Home.vue` `headerFilter()` | ✅ 已做（2026-09-18） | 见 C8——注意这列的值是**蓝色加粗**的（`Ou`），与「未付」列不同。 |
| C15 | 「显示全部」的清理语义 | `:7680-7681` `Po`：`Mo=""`、关 popover、`Kl=1` | `Home.vue:347` `progressFilter==='显示全部'` 时不过滤 + `Home.vue:381` 重置页码 | ✅ 已做 | 行为等价（新版是「选中『显示全部』这一项」，旧版是「点『显示全部』按钮清空」）。 |

### C-4 列头原生 filters + 「显示全部/未生产」+「查询更多」

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| C16 | 列头原生 `filters`（文本列） | `:7933-7939` `ta(prop)` = 从 **`_l` 全量**取 distinct 值 → `[{text:v,value:v}]`；挂载于 客户(`:11400`)、日期(`:11410`)、安装地址(`:11438/11525`)、打单操作(`:11446/11533`)、门数(`:11460`)、总价(`:11464`)、订单备注(`:11516`)、业务员(`:11583`)、打单人(`:11591`) 共 9 处 | 无 | ❌ 未做 | 新版**一个列头 filter 都没有**（`n-data-table` 的 `filterOptions`/`filter` 完全没用）。 |
| C17 | 列头 filter 的匹配函数（文本） | `:7996-8002` `ga(e,t,l)`：`打单操作` 列的 `__EMPTY__` 特殊处理（值空或空白串 → 命中）；其余 `t[l.property]===e` 严格相等 | 无 | ❌ 未做 | 随 C16 缺。`__EMPTY__` 这个哨兵值（`:7705` `ta` 里 `unshift({text:"未生产", value:"__EMPTY__"})`）新版也没有。 |
| C18 | 列头 filter（金额列） | 已付：`:7986-7991` `ma` = distinct `co(row)`（已付额），`:8003` `ya=(e,t)=>co(t)===e`；未付：`:7992-7995` `wa` = distinct `so(row)`，`:8003` `fa=(e,t)=>so(t)===e` | 无 | ❌ 未做 | 已付/未付两列的 filter 选项是**金额数字**，不是「已付/未付」标签。新版全无。 |
| C19 | filter 下拉位置 | 客户/日期/已付/未付 等用 `"filter-placement":"bottom-start"`（`s(911)`），安装地址/打单操作 用 `"bottom-start"`，与 location 无关 | — | ✅ 已做 | 无落点也算「不适用」——这条只在有 filter 时才有意义，随 C16 一起缺。 |
| C20 | 「显示全部 / 未生产」切换 | `:3708-3711`（`home.txt`）按钮，`$l` 切换；`:3589-3591`/`:3599-3601` 过滤条件 = `打单操作` **空**（`!o \|\| (typeof o==="string" && o.trim()==="")`） | `Home.vue:7-13`（按钮）、`Home.vue:341-343` | ✅ 已做 | 过滤语义一致；按钮文案切换、选中态换色一致（旧版 `custom-unproduced-active-btn` 红底，新版 `type="error"`）。 |
| C21 | 「查询更多」弹窗 | `:12132-12176`（`home.txt:4565-4606`）：`el-dialog`「查询订单」500px，字段 = 客户(autocomplete, 仅 `Yt`)、安装地址(仅 `rl`)、起始日期、结束日期(带快捷项 今天/昨天/一周前)、只含生产单；确认 → `getMoreTableDate(param3=客户, param4=地址, param5=开始, param6=结束)` 拉另一批并入 `_l` | 无 | ❌ 未做 | 这是旧版**唯一**的日期范围筛选入口，新版完全没有（也没有对应后端接口）。 |
| C22 | 「查询更多」的结果预览表 | `:12132` 之前，`home.txt:4518-4541`：`{key:0,label:"客户"}` / `{key:1,label:"安装地址"}` / `{label:"起始日期"}` … 的结果表格（列：回执单号 / 客户 / 日期） | 无 | ❌ 未做 | 同 C21。 |

---

## D. 排序

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| D1 | 可排序列 | 全表只有 `日期` 列有 `sortable:true`（`:11410`）；门数/总价/已付/未付均无 | `Home.vue:1064` | ✅ 已做 | 一致。 |
| D2 | 排序方向循环 | `:11410` `"sort-orders":["descending","ascending",null]` | 未声明 → Naive 默认 `['ascend','descend',false]` | ⚠️ 偏离 | 见 B18。 |
| D3 | 排序比较函数 | `:11410` 无 `sort-method`/`sort-by` → Element 默认比较器（字符串走 localeCompare、数字走 `<`/`>`），比较的是 `row["日期"]` 原值（`"YYYY-MM-DD"` 串） | Naive `sortable:true` 默认比较器 | ✅ 已做 | 两边都用框架默认比较器、比较同一字段；`"YYYY-MM-DD"` 定长串按字典序 = 按时间序，结果一致。 |
| D4 | 默认数据顺序 | `:7633-7639`（`home.txt:327-332`）：`_l = resp.data.tableData.sort((t,l)=>parseInt(l["回执单号"])-parseInt(t["回执单号"]))` → 按 `parseInt(回执单号)` **降序** | `backend/src/modules/orders/service.rs:207-209` `... FROM orders WHERE tenant_id = $1 ORDER BY id DESC` | ⚠️ 偏离 | 落点等价但依据不同：旧版排的是**回执单号数值**，新版排的是**自增 id**。两者只在「回执单号随 id 递增」时同序。新版 `receipt_no` 缺省时生成 `HT{id:08}`（`service.rs:331-334`，`parseInt("HT00000012")` = NaN），且允许用户自定义单号（`service.rs:299`），所以**不保证同序**。 |
| D5 | 排序后不改页码 | — | `Home.vue:381-383` 的 watch 只监听筛选条件，不含排序 | ✅ 已做 | Naive 的排序在 `paged` 之后由表格内部处理，`filtered.length` 不变 → 等价于旧版「排序不动 `Kl`」的行为。 |

---

## E. 分页

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| E1 | 默认 pageSize | `:7616`（`home.txt:83`）`Zl=Vue.ref(50)` | `Home.vue:375` `pageSize = ref(50)` | ✅ 已做 | 一致。 |
| E2 | pageSize 选项 | `:7616` `Xl=[10,20,50,100,200]` | `Home.vue:81` `:page-sizes="[10,20,50,100,200]"` | ✅ 已做 | 一致且顺序相同。 |
| E3 | layout | `:11607` `layout:"total,sizes,prev, pager, next"`（`s(531)`） | `Home.vue` `n-pagination` + `#prefix` | ✅ 已做（2026-09-18） | 三处都补齐了：① `#prefix` 补「共 N 条」；② `display-order="['size-picker','pages']"` 把每页条数提到页码**前面**（naive 默认是 `["pages","size-picker","quick-jumper"]`）；③ **去掉** `show-quick-jumper`（旧版没有）。SSR 探针实测顺序 = `共 N 条 → 每页条数 → prev/页码/next`。 |
| E4 | 分页方式 | `:11606-11608` `:current-page` / `:page-size` / `:page-sizes` / `:total="zs"` / `onSizeChange:Bs` / `onCurrentChange:xs` | `Home.vue:77-84` `n-pagination` + `Home.vue:376-379` `paged` | ✅ 已做 | 都是**客户端切片**（旧版 `Cs = ps.slice((Kl-1)*Zl, Kl*Zl)`，`home.txt:3613-3615`）。后端 `listOrders` 一次拉全量、无分页参数 ✅ 一致。 |
| E5 | total 来源 | `:11183` `zs = computed(() => ps.length)`（**过滤后**长度） | `Home.vue:80` `:item-count="filtered.length"` | ✅ 已做 | 一致。 |
| E6 | 切换筛选时回第 1 页 | `watch(Fc)` → `Kl=1`（`:11207-11209`）；`Lo`/`bo`/`ko`/`Po` 内均 `Kl=1`；`Bs`（改页大小）末尾 `Kl=1` | `Home.vue` `watch([...])` + `onPageSizeChange()` | ✅ 已做（2026-09-18 补齐） | ⚠️ **本条先前是假 ✅**：那条 `watch` 里只有四个筛选条件，**没有 `pageSize`**，而旧版 `Bs` 末尾是**无条件 `Kl=1`**。naive 只在「当前页超出新页数」时才动 page，且是**夹到最后一页**（`Pagination.mjs` 的 `doUpdatePageSize`），不是回第 1 页 ⇒ 「第 3 页 → 换成 200/条」会停在原页码。现已显式置 1。 |
| E7 | 翻页/改页大小后的「全选模式」重选 + 滚动复位 | `:11184-11199` `xs` / `:11196-11206` `Bs`：`Wl`（跨页全选模式，`:7627` `Wl=Vue.ref(!1)`）为真时，`nextTick` 里 `clearSelection()` 后把 `ps` 中所有行 `toggleRowSelection(row,true)`；随后 `document.querySelector(".table-container").scrollTop = 0` | 无 | ❌ 未做 | 新版既没有「跨页全选」模式，翻页后也不复位滚动条。这是**分页 × 选择**的交互，旧版是实打实实现的（工具栏那颗全选 checkbox 在 `:7695` 附近）。 |

---

## F. 展开行（详情）

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| F1 | 展开列定义 | `:11304-11305` `{type:"expand", width:"55", "class-name":"expand-column"}` | `Home.vue:1021` `{type:'expand', renderExpand}` | ⚠️ 偏离 | 见 A8（缺 width 与类名）。 |
| F2 | 展开时**懒加载** | `:11298` `onExpandChange:Jo`；`:7769-7800`（`home.txt:202-233`）：展开时 `fetch("...param1=detail&param2={ds}&param3={回执单号}")`，成功才 `_o.add(回执单号)` 并灌 `wo`(ping_hui)/`mo`(diao_hui) | `Home.vue:852-869` `onExpandedKeys` → `loadDetail(id)` → `api.getOrder(id)` | ✅ 已做 | 懒加载 + 只在展开时拉明细，一致。 |
| F3 | 展开内容 = 平开/移门两张子表 | `:11306-11317`（`home.txt:3740-3750`）：渲染 Hui 的平开门组件 `l`(`_`) 与移门组件 `o`，props = `add-price-items` / `showCheckbox:true` / `oderColumn` / `disable-editing` / `highlight-order-query` / `v-model:showPingkai` / `v-model:showDiao` + `onRefresh` / `onUnselect` / `onCalculateSingleRow` | `Home.vue:896-926`：两个只读 `n-data-table` | ⚠️ 偏离 | **复用策略不同**（且是大差异）：旧版直接把 Hui 的**可编辑明细表**整只挂进来（能加价、能勾选、能改行、能算单行）；新版是自绘的**只读** 13 列小表。功能上少了：加价项目、勾选、行内编辑、单行计算、刷新回写。 |
| F4 | 子表列集 | 由 Hui 组件决定（列集见 `Hui.formatted.js`，本次未展开核） | `Home.vue:879-893`：型材/颜色/开向/扇数/五金/面玻/底玻/门洞宽/门洞高/数量/单价/金额/备注 | ⚠️ 偏离 | 新版列集明显是**自选子集**（旧版 Hui 表列更多：含 玻璃厚/墙厚/亮窗总高/洞尺/吊脚/轨道长/轨道种类/套线种类/套线单价/边封数/亮窗数量/平方数/打折/计价方式 等，见分析文档 §7.2）。 |
| F5 | 平开/移门切换 | `:11308` `v-model:showPingkai`（`uo(row,"ping")`）、`:11313` `v-model:showDiao`（`uo(row,"diao")`）+ `v-show` | 无 | ❌ 未做 | 旧版两张子表用 `v-show` 互斥/切换显示（`no[回执单号] = {ping,diao}`，`:7625-7629`）；新版是「有就渲染两张、都展示」。 |
| F6 | 展开行底色 `loaded-row` / `expanded-row` | `:7842-7849` `Qo`：已加载 → `loaded-row`、已展开 → `expanded-row`；CSS `.loaded-row{background-color:#dbdbd8!important}`、`.loaded-row.expanded-row{background-color:#e2e2e0!important}`、`.expanded-row{background-color:#fff!important}` | `Home.vue` `rowClass()` + `:row-class-name` | ✅ 已做（2026-09-18） | ⚠️ 实现见 `Home.vue` `<style>` 里那段：Naive 的 `td` **不透明**（自带 `background-color`），照抄挂 `tr` 会**完全看不见**，改挂 `td` 并还原层叠。`loaded` 集合只在 detail **成功**时写入（`:7792`）。 |
| F7 | 展开时清掉该行在明细子表里的选中 | `:7771-7775`（`Jo` 内 `t.unselectAll()` / `l.unselectAll()`）、`:7775` `jo.add` | 无 | ✅ 已做 | 不适用：新版没有可选的明细子表（随 F3 一起缺），这条本身无从偏离。 |
| F8 | 展开态与「导入中」互斥 | `:7777-7782` `An.value=true`（`An` = 导入中标志） | 无 | ❓ 未确认 | 新版没有「导入」这个动作（属打印/导入维度），我读不出旧版这条在什么时机真正生效，不判定。 |

---

## G. 行级视觉状态

| # | 项 | 旧版依据（行号） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| G1 | `row-class-name` 函数 | `:11298` `"row-class-name":Qo`；`:7842-7849` `Qo({row})` 汇总 4 个类 | `Home.vue` `:row-class-name="rowClass"` | ✅ 已做（2026-09-18） | 类集已对齐：`expanded-row` / `loaded-row` / `duplicate-order-row`（`paid-row` 除外，见 G3 旁注）。⚠️ 原文把行类与 `date-audit`/`date-warning` 对比是**比错了层** —— 那两个是**单元格**类（`Ls`），不是 `Qo` 的产物。 |
| G2 | `.paid-row`（未付清） | `:7843` `0===so(e) && l.push("paid-row")` | 无 | ✅ 已做 | 复核：`legacy/css/` 全目录 `grep -rl paid-row` **无命中** → 旧版只加类、没有任何 CSS，是**死样式**。新版不做不算漏（`Home.vue:386-387` 注释说的「.paid-row 无清晰口径」措辞不准确 —— 口径是清楚的 `未收==0`，只是**没有样式**）。 |
| G3 | `.duplicate-order-row`（重复订单） | `:7827-7831` `Zo` = `客户+"__"+门数+"__"+总价`；`Xo`(`:7830-7841`) = 在**当前过滤结果 `ps`** 中出现 >1 次的键集合；`Qo` 据此加类。CSS `tr.duplicate-order-row>td{background:#ffe4ec!important}` / `:hover>td{background:#ffd6e4!important}`（活样式） | `Home.vue` `dupKey()` / `duplicateKeys` / `rowClass()` | ✅ 已做（2026-09-18） | 三个字段**各自 trim 后都非空**才成键（空串 falsy ⇒ 不参与）；数值 `0` 是 `"0"`（真值）⇒ **仍参与**。⭐ `paid-row` 不实现：`grep -r paid-row legacy/` **零 CSS 命中**，旧版加了类却不产生任何效果，是死码。 |
| G4 | `.paid-customer`（客户列已付清绿块） | `:11402-11404` + CSS（活样式） | `Home.vue` 客户列 `render` | ✅ 已做（2026-09-18） | 见 B13。同一格还一并补了 `title="点击修改客户名称"`（`dr(1490)`，见 02-actions D1）。 |
| G5 | `.date-audit` | `:11221` + CSS（活样式，**cell 级**） | `Home.vue:401`、`1283-1285`（**行级**） | ⚠️ 偏离 | 见 B19。 |
| G6 | `.date-warning` | `:11221-11227` + CSS（活样式，**cell 级**） | `Home.vue:402`、`1286-1288`（**行级**） | ⚠️ 偏离 | 见 B20。 |
| G7 | `.loaded-row` / `.expanded-row` 底色 | `:7846` + CSS | `Home.vue` `rowClass()` + `<style>` | ✅ 已做（2026-09-18） | 见 F6。 |
| G8 | `.date-danger` | CSS 有、`Ls` 未引用 | 无 | ✅ 已做 | 死样式，不做正确。 |

---

## H. 附：非本维度但复核到的问题

| # | 项 | 旧版依据 | 新版落点 | 判定 | 说明 |
|---|---|---|---|---|---|
| H1 | 非管理员只看自己的单 | `:11147`（`home.txt:3580`）`fs = qt ? _l : _l.filter(t => t["打单人"] === _t)`；`qt` 的赋值在 `:8147`（`home.txt:580`）`qt = (userinfo.registrant.name === userinfo.name)` | `Home.vue:337-340` `auth.user?.role !== 'admin'` → 按 `creator_name === auth.user?.name` 过滤 | ✅ 已做 | 效果一致（非管理员只看自己打的单）。**身份判定口径不同**：旧版是「店名 == 用户名」（`qt`），新版是 `role==='admin'`。需确认新版 admin 语义与旧版 `qt` 是否总能对齐（旧版还有 `Jt = 店名==用户名 \|\| 用户名==="开门红"` 的第三态，`:8147`）。 |
| H2 | 打单操作列/客户列 tooltip 用的 `Ea`/`Na` | `:8013`（`home.txt:446`）`Na=["玻璃订单","生产单","已订玻璃","确认生产"]` | 无 | ❓ 未确认 | `Na` 只在「手动更新进度」弹窗的建议项里用（`:8013` 附近读到引用），不在主表渲染路径上，故本维度不判。 |

---

## 对既有逆向文档的更正（复核发现，共 3 处）

1. **`docs/2026-09-17-home-analysis.md` §3「「打单操作」单元格底色（`la`）」是错的。**
   `la()` 在全组件只在 `Home.formatted.js:11589`（业务员列）与 `:11597`（打单人列）被调用，**从不服务打单操作格**；
   打单操作格的外层 div（`:11571-11582`）只有 `style:{cursor:"pointer"}`，CSS 里也 `grep` 不到那五个色值。
   所以旧版：**打单操作格无底色**，而**业务员/打单人列在非管理员时有这层底色**（写法明显是旧版自己的 bug —— 拿「收据单/标签/玻璃订单/生产单/自助下单」去匹配人名）。
   新版正好**反了**：给打单操作格加上了底色（凭空多出来的），业务员/打单人反而没有。
2. **§3「4 处空注释占位列（19–21）」位置说错。** 实际是门数与总价之间 1 个 + 表尾 3 个（`:11464`、`:11599`）。
3. **§3「`.paid-row`（未付清）」的措辞方向反了。** `Qo`（`:7843`）里 `0===so(e)` 时加的类，语义其实是**已付清**（未收 0）；而且它在 `legacy/css/` 全目录**没有任何样式**，是死代码 —— 结论（不做）没错，但理由不是「口径不清」，是「没有样式」。

---

## 汇总

- ✅ 已做：**39** 条
- ⚠️ 偏离：**42** 条
- ❌ 未做：**23** 条
- ❓ 未确认：**1** 条

**最该先修的（用户一眼能看出来）** —— 括号里是 2026-09-18 的补做情况：

1. ~~**B31 打单操作格底色用错了列**~~ —— ✅ 已修（`a70ac477`）。旧版这格没底色；有底色的是业务员/打单人。
2. **B32/B33 打单操作格子只有色条** —— 旧版条下面还有一行「`前段_`」+「**深红加粗的末段**」和绿色 `✓已付` 徽标，现在整格信息量只剩一半。（`✓已付` 徽标已补，进度条文字段仍缺）
3. ~~**B13/G4 已付清标记全无**~~ —— ✅ 已补（`39c1db54`）。客户列绿块 `.paid-customer`（含 `title="点击修改客户名称"`）。
4. ~~**B1 列序**~~ —— ✅ 已修（`a70ac477`）。工厂视图下「安装地址 / 打单操作」已移到订单备注之后。
5. ~~**G3 重复订单底色**~~ —— ✅ 已补（`39c1db54`）。口径写死在 `Zo`/`Xo` 里，CSS 是活样式；原注释「口径不清」与源码不符，注释一并改正。
   ⭐ 同批还补齐了 **F6/G7 `loaded-row`/`expanded-row`**；**`paid-row` 经实测判定为死码**（旧版加类但全库无对应 CSS 规则），有意不做。
6. **C16–C18 列头原生筛选整块缺失**（9 个文本列 + 已付/未付两个金额列）与 **C21「查询更多」弹窗**（唯一的日期范围筛选）。
7. **B19/B20 `date-audit`/`date-warning` 做成了整行**（旧版是日期格里的一个小色块），且 **`date-warning` 把「已逾期」的行排除掉了**（旧版恰恰包含）。
8. **E3 分页条**：少了「共 N 条」，多了「跳至第 N 页」。
9. **B4/B5 操作列**：旧版非编辑态宽 1px（几乎不可见），新版 140px 常驻「财务 / 电子回执单」两颗按钮。
