# Home 订单管理页（生产订单总表）逆向分析（2026-09-17）

> 目标：用 Rust + Vue3 + Naive UI 复刻旧版 Home 页，≥95% 保真。
> 本文由 5 路并行逆向（表格+筛选 / 财务面板 / 打印回执分享 / 数据模型+API / CSS+布局+仪表盘）综合而成，
> 结论均带证据位置（`Home.formatted.js:行号` 或 `:3884@字节偏移` = 主 Home 组件那根 242KB 巨行）。
> 解码工具：`node legacy/decode-token.mjs <name> <idx>`；主表 `dr`(offset 467)。

---

## 0. 组件结构（先立骨架）

Home 页 = 1 个 chunk（`legacy/js/Home-d6b13b9a.js`）内 **3 个页面级组件** + App 壳：

| 组件 | 位置 | 作用域 scope | 职责 |
|---|---|---|---|
| `Home`（生产订单总表） | `Home.formatted.js:3884`（单行 242KB） | `data-v-7e2e1e6b` | 筛选 + 订单主表 + 全部行操作 |
| `FinanceDrawer`（财务抽屉） | `Home.formatted.js:961–2372` | `data-v-97a9ce53` | 财务三 tab 抽屉 |
| `DashboardBigScreen`（经营看板） | `Home.formatted.js:155–554` | `data-v-e9ab146d` | 深蓝 DataV 全屏大屏 |

字符串表分工：`dr`=主 Home、`To`=财务面板、`wl`=经营看板大屏。

> **重要更正**：DESIGN-DOC §9.2 的「顶部筛选：全部/今天/上月/日期范围/付款状态/业务员/客户」**与实际代码不符**。
> 旧版顶部**没有** radio-group/date-picker/select。真实筛选见 §2。

---

## 1. 页面布局 + 仪表盘

### 1.1 主 Home 根结构

```
div.home-container  (margin-top:65px 桌面 / 18px 移动端; height:calc(100vh-70px); overflow-y:hidden)
├─ div.header-container
│  ├─ div.search-section
│  │  ├─ div.table-header
│  │  │  ├─ div.search-row: el-input.search-input("搜索客户、安装地址等") + 汇总信息条
│  │  │  └─ div.buttons-row (justify-content:space-between)
│  │  │      ├─ div.left-buttons  ← 顶部按钮组
│  │  │      └─ div.right-buttons ← 「视频」按钮
│  └─ div.table-container > el-table.table (height:calc(105vh-280px), width:100%)
│     ├─ 复选(55) / 展开(55) / 操作(内联编辑) / 财务 / 单号集 / 客户 / 日期 / 安装地址 / 打单操作 /
│     │  门数 / 总价 / 已付 / 未付 / 订单备注 / 业务员 / 打单人
│     └─ 展开行内嵌 平开门/移门明细子表（= Hui 两张表，用户已确认复用，本文不重复）
└─ div.pagination-container (居中)
```

**顶部按钮组**（`left-buttons`，按出现顺序，含触发条件）：

| 按钮 | 文案(dr) | class | 触发条件 | 动作 |
|---|---|---|---|---|
| 打印选中订单 / 查看回执单 | `打印选中订单`(514) / `查看回执单`(1433) | `custom-print-btn`→有选中`danger-print-btn` | `Yt` 工厂=打印、终端=查看 | `Gi` 建 socket.io 云打印通道 → 打印选项抽屉 |
| 刷新 | `刷新`(1414) | `custom-refresh-btn` | 常显 | `window.location.reload()` |
| 经营看板 | `经营看板`(470) | `custom-search-btn` | `Jt` | 打开 DashboardBigScreen |
| 查询更多 | `查询更多`(1355) | `custom-search-btn` | 常显 | `ms` 打开「查询订单」弹窗 |
| 删除选中数据 | `删除选中数据`(1271) | `custom-delete-btn` | 常显 | `Si` 删除流程 |
| 显示全部 / 未生产 | `显示全部`(624) / `未生产` | `custom-search-btn`↔`custom-unproduced-active-btn` | 常显 | 切换 `$l` 过滤 |
| 电子回执单 | `电子回执单`(562) | `custom-delete-btn` | `bn`(选中 1 条) | `Dn` 拼分享链接复制 |
| 选中清账 | — | `custom-delete-btn` | 选中数>0 | 全单回款 |
| 合并订单 | — | `custom-combine-btn` | 选中数>1 | 合并订单 |
| 视频 | — | — | — | — |

### 1.2 经营看板 DashboardBigScreen

入口「经营看板」按钮 → 全屏 `el-dialog`（`fullscreen`、`show-close=false`、透明背景），prop `tableData`=订单列表，**数据全部来自前端 prop，无独立请求**。

```
div.big-screen-container (深蓝渐变 #0d1b2a→#1a2d42→#0d1b2a, 100vh)
├─ 顶部装饰 dv-decoration-10 ×2 + 标题「经营数据驾驶舱」(wl547) + dv-decoration-5 + ×关闭
├─ div.filter-bar: el-radio-group(全部/今天/本周/本月/上月/90天) + 筛选客户 + 筛选业务员
└─ div.main-content (grid 1fr 2fr 1fr, gap 15px)
   ├─ 左: 业务员排行 + 客户排行 (dv-scroll-ranking-board, 各 Top7)
   ├─ 中: 5 数字翻牌(dv-digital-flop) + 每日订单趋势(echarts 折线) + 客户金额占比(echarts 饼图 Top8)
   └─ 右: 流程状态(未进入/已进入) + 最新订单(dv-scroll-board, Top10, rowNum 5)
```

**5 个数字翻牌**（字段口径见 §7）：

| 卡片 | 数据 | content | fontSize | fill |
|---|---|---|---|---|
| 订单总数 | Σcount | `{nt}` | 36 | `#3de7c9` |
| 订门总数 | Σ门数 | `{nt}` | 36 | `#00d2ff` |
| 订单总金额 | Σ总价 | `¥{nt}` | 32 | `#409EFF` |
| 已付金额 | Σ定金 | `¥{nt}` | 32 | `#67C23A` |
| 未付金额 | Σ总价−Σ定金 | `¥{nt}` | 32 | `#F56C6C` |

流程状态口径：`未进入流程`=打单操作为空的数量；`已进入流程`=打单操作非空的数量。

日期筛选（dayjs）：今天=`startOf('day')`、本周=`startOf('week')`、本月=`startOf('month')`、上月=`subtract(1,'month').startOf/endOf('month')`、90天=`subtract(90,'day')`。

---

## 2. 筛选（4 套机制，非 DESIGN-DOC 描述）

### 2.1 顶部搜索框（前端模糊过滤）

- `el-input`（`modelValue:Rc`，placeholder `搜索客户、安装地址等`，clearable，放大镜前缀）。
- `watch(Rc)` 防抖 150ms 写 `Fc`。
- 过滤（computed `ps`）：`Fc` 小写后对每行 `includes` 匹配，字段 = **客户/定金/总价/安装地址/订单备注/打单操作/业务员/日期/回执单号**。
- 搜索时信息条：`当前筛选: {Rc} ({ps.length} 条结果) | 时间: {earliest} 至 {latest} | 门数: {ls} | 总价: {os} | 未付: {ns} | 未付单数: {us} | 未审核: {rs}`。

### 2.2 「未付」列头 popover —— 付款状态

参照按钮文字 `付款状态`(779) + 当前值；选项 `已付`/`未付`/`部分付`(948)/`全部显示`，选中态 `#409eff`+`fontWeight:700`。
过滤语义 `Eo(e)`：`未付≤0→已付`；`总价>0 && 未付≥总价→未付`；否则 `部分付`。**前端过滤**。

### 2.3 「打单操作」列头 popover —— 进度状态

参照按钮 `生产进度`(1216)；固定项 `已打生产单`(1187)/`未打生产单`(1309)/`已订玻璃`/`未订玻璃`(1202) + 自定义项（localStorage 自定义操作名）+ `显示全部`。
过滤 `Ao`：`已打生产单→打单操作.includes("生产单")`、`未打→!includes("生产单")`、`已订玻璃→includes("玻璃订单")`、`未订→!includes("玻璃订单")`、自定义→`includes(该值)`。

### 2.4 列头原生 filters + 「显示全部/未生产」+ 「查询更多」弹窗

- **列头 filters**（Element 原生）：客户/日期/安装地址/打单操作/门数/总价/已付/未付/订单备注/业务员/打单人 各列带 `filters: 去重值`，`打单操作` 列最前插 `{未生产, "__EMPTY__"}`。
- **「显示全部↔未生产」**：`$l` 切换，过滤 `!打单操作 || 打单操作.trim()===""`。
- **「查询更多」弹窗**（title `查询订单`(980)，500px，`label-width:100px`）：`客户`(el-autocomplete，仅工厂) / `安装地址`(仅 `rl`) / `起始日期`/`结束日期`(el-date-picker type date，快捷项 今天/昨天/`一周前`(1300)) / `只含生产单`(checkbox)。确认 → `getMoreTableDate`（`dr(848)` 明文，param3=客户/4=地址/5=开始/6=结束）拉另一批数据并入。**这是「日期范围」筛选的真实位置**。

---

## 3. 订单主表（逐列）

`el-table` 属性：`row-key:"回执单号"`、`height:"calc(105vh - 280px)"`、`highlight-current-row`、
`row-class-name:Qo`、`header-cell-style:ha`、`cell-style:dn`、`filter-method:ga`。

**表头样式**（`ha` 内联）：`backgroundColor:"#FAEBD7"`（米色）、`color:"#000"`、`fontSize:"16px"`、`fontWeight:"bold"`、`textAlign:"left"`。
**单元格**（`dn` 内联）：`fontSize:"16px"`。

列（`Yt`=工厂模式、`Ht`=新财务、`qt`=管理员 三开关动态显隐）：

| # | label | prop | 宽 | 渲染/交互 |
|---|---|---|---|---|
| 1 | — 多选 | — | 55 | `type:selection`，`reserve-selection` |
| 2 | — 展开 | — | 55 | `type:expand`，展开平开门/移门明细子表 |
| 3 | — 操作 | — | `za===row?150:1` | 内联编辑「保存/取消」 |
| 4 | 财务（仅`Yt&&Ht`） | — | 56 center | 圆形 `¥` 按钮(`type:success`,`circle`,`title:财务管理`)→ FinanceDrawer |
| 5 | 单号集（仅`Yt`） | 单号集 | min 120 | 首段 + hover popover 全单号；表头「查单号」popover |
| 6 | 客户（仅`Yt`） | 客户 | min 100 | filters；`Vo(row)` 时加 `paid-customer` 绿标；点击→改客户名 |
| 7 | 日期（始终） | 日期 | min 90 | `sortable`(desc/asc/null) + filters；`date-audit`/`date-warning`；点击→改日期；未审核加「审核确认」 |
| 8 | 安装地址（仅`!Yt`） | 安装地址 | min 220 | `el-input textarea` |
| 9 | 打单操作（仅`!Yt`） | 打单操作 | min 150 | 进度色条 + 点击→手动更新进度 |
| 10 | 门数（始终） | 门数 | min 80 | filters，纯文本 |
| 11 | 总价（始终） | 总价 | min 100 | filters，纯文本 |
| 12 | 已付（仅`Yt`） | 定金 | min 100 | 若`已分配金额!=null`显示文本，否则 `el-input` 可编辑 |
| 13 | 未付（始终） | formatter`io` | min 100 | `未收金额!=null`时彩色（≤0绿`#67c23a`/否则红`#f56c6c`）；表头付款状态 popover |
| 14 | 订单备注（仅`Yt`） | 订单备注 | min 220 | `el-input textarea` |
| 15 | 安装地址（仅`Yt`） | 安装地址 | min 220 | 同 #8（与 #8 按 `Yt` 互斥） |
| 16 | 打单操作（仅`Yt`） | 打单操作 | min 150 | 同 #9 |
| 17 | 业务员（仅`Yt`） | 业务员 | min 80 | `qt` 时 `el-input.borderless-input`，否则带底色文本 |
| 18 | 打单人（仅`Yt`） | 打单人 | min 80 | 同业务员 |
| 19–21 | （空注释占位） | — | — | 已移除列占位（待确认） |

**「打单操作」进度色条**（`ua`）：5 固定步骤 + 自定义，`done`=字段 `includes(label)`：
`确认下单 #389e0d`(flex1)、`生产单 #d48806`(flex2)、`玻璃订单 #096dd9`(flex2)、`标签 #c41d7f`(flex2)、`收据单 #237804`(flex2)；自定义 `#531dab`(flex=3/个数)。未完成底色 `#e0e0e0`。

**「打单操作」单元格底色**（`la`）：含收据单→`#90EE90`、含标签→`#FFC0CB`、含玻璃订单→`#87CEEB`、含生产单→`#FFFF99`、含自助下单→`#FFA500`。

**行状态色**（`row-class-name:Qo` + CSS）：
- `.paid-row`（`so(row)===0`，未付清）
- `.loaded-row`（已展开加载明细）`#dbdbd8` / expanded `#e2e2e0`
- `.duplicate-order-row`（重复订单）`#ffe4ec` / hover `#ffd6e4`
- `.paid-customer`（客户列已付清绿标）`#90ee90`
- `.date-audit`（未审核）`#ffb6c1` / `.date-warning`（截止 4 天内）`#fff3cd`

### 3.1 数据流 / 分页 / 排序

- 原始 `_l`：`getTableData`（`defaulted===3` 终端走 `getTableDataForTerminal`），按 `parseInt(回执单号)` 降序。
- `fs` = `qt ? _l : _l.filter(打单人===当前用户)`（非管理员只看自己的单）。
- `ps` = `gs?ws:fs` → 依次套 `$l`(未生产) → `po`(单号) → `zo`(付款状态) → `Mo`(进度) → `Fc`(搜索文本)。
- `Cs` = `ps.slice((Kl-1)*Zl, Kl*Zl)`（**客户端分页**，`getTableData` 一次拉全量无分页参数）。
- 分页：默认 50，`page-sizes [10,20,50,100,200]`，`layout:"total,sizes,prev, pager, next"`(531)。
- 排序：**仅「日期」列** `sortable`。

---

## 4. 行操作（全部）

### 4.1 详情（展开行）

展开 → `await 刷新` → `fetch detail(param2=ds, param3=回执单号)` → 把 `ping_hui`/`diao_hui` 灌进子表组件（Hui 平开/移门表），行加 `loaded-row`。
子表 props：`add-price-items`（默认 `[{name:"人工",price:100,unit:"元/套"}]`）、`showCheckbox:true`、`oderColumn`、`disable-editing`（自助下单时）、`highlight-order-query`。

### 4.2 制单 / 打印 / 分享

- **打印**：两个服务——本地 `printService`(hiprint，`It`) 与 云打印 `mutilPrintService`(socket.io，`Ut`，服务器 `v4.printjs.cn:17521`，token=`smartdoor{digit}+1088`)。打印类型选择器 `ic`(1–16)，决定操作按钮栏。约 30 个打印入口：生产单/移门生产单/平开门生产单/定制/竖版/标签/生产标签/料标签/平开标签/推拉标签/收据单/自定义收据单/自定义合格标签/平开合格标签/推拉合格标签/自定义生产单/自定义生产单2/自定义玻璃合片单/君豪汇总订单(仅君豪门窗或开门红试用号)/玻璃单…。
- **收据单2（ic=12）**：非 hiprint 模板，Home 自绘 HTML；操作 = 云打印/手动打印/直接打印/字体调节/编辑收据单（见 `docs/2026-09-16-print-font.md`，已实证不重写）。
- **电子回执单（分享）**：`Dn` 拼深链 `https://www.samrtdoor.com.cn/login?param1={客户名}&param2={token}&receiptNo={回执单号}`，`token = {i}af{c}wy{Date.now()+888}`，`i = ds==="smartdoor"?1000:Number(ds.split("smartdoor")[1])+1000`，`c = 7*客户编号+1987`；`navigator.clipboard` 复制，成功提示「电子回执单链接已复制」。
- **回执单-其它抽屉**：直接打印/手动打印/复制回执单/分享回执单(手机)/下载回执单。分享=html2canvas→`navigator.share`；下载=exportImage PNG。

### 4.3 删除（`Si`）

1. 空选 → warning「请选择要删除的数据」。
2. `y("删除")` 密码校验。
3. 首行自助下单或工厂：
   - 新财务(`Ht`)先 `finance_checkOrderPayment` 汇总各客户 `allocatedAmount`+`adjustmentAmount`；
   - `a+i>0` → 确认框「选中的订单有以下财务记录…删除订单时将自动进行红冲…」；
   - `deleteHui`(POST body=回执单号数组) → 有财务则逐客户 `finance_addPayment`(负收款)+`finance_addCustomerAdjustment`(负抹零)；
   - 成功 → 500ms 后 `location.reload()`。
4. 已确认单 → `已确认的单只能工厂删除！`。

### 4.4 改客户名（Hui 复用 composable `useOrderCustomerEdit`）

点击客户单元格 → 弹窗「修改客户名称」(460px)：原客户(disabled) + 修改为(el-autocomplete)。
提交 → `finance_updateOrderCustomer`（Hui chunk `Hui.formatted.js:156-162`）：param2=ds，POST body `{回执单号, 原客户, 原客户编号, 客户:新名, 客户编号:新编号, 编辑:当前用户名}`。

### 4.5 修改金额 / 备注 / 地址（内联编辑，无弹窗）

点击/聚焦 定金/已付/订单备注/安装地址/业务员/打单人 单元格 → `za=row`，操作列变 150px 显示「保存/取消」。
保存 = `updateCustomerInfo`(POST body=整行) → 刷新 + 子表 `markRowsPersisted` + `修改成功`(641)。
约束：`!Yt && 打单操作!=="自助下单"` 时禁止 → `已确认的单只能工厂修改！`(1327)。

### 4.6 修改下单日期

点击日期单元格 → 弹窗「修改下单日期」(400px)：原日期(disabled) + 新日期(date-picker)。确认计算新截止日期（保持原间隔）→ `updateCustomerInfo` → `日期修改成功`(703)。

### 4.7 审核确认 / 手动更新进度

- **审核确认**（日期列内，仅未生产未审核行）：`updateCustomerInfo` + `Hl("确认下单", [回执单号])`（即 `updataProgress`，`param3` = 操作名）→ `更新成功`(1279)。
  > ⚠️ **2026-09-18 更正**：此处原先写「`updataProgress`(工序10, 操作名「确认下单」)」—— **「工序10」是错的**，
  > 这条传的只有操作名。`Hl("工序10", 单号集合, 日期)` 是另一个函数 `Gl` 在调。证据见 `docs/home-audit/02-actions.md` G2。
- **手动更新进度**（打单操作单元格点击 → 弹窗 460px）：回执单号(disabled) + 操作名称(el-autocomplete) + 日期(date-picker) + `记录日期`(585, checkbox, 写 localStorage `gr`)。确认 → `updataProgress`（`param3 = 记录日期 ? 操作名+日期 : 操作名`）→ `进度更新成功`(990)；删除 → `deleteProgressForFullOrder` → `进度删除成功`(1148)。
  > **`操作名称` 的下拉是「聚焦即弹」**（2026-09-18 补记）：这一处的三个 `el-autocomplete` 里，它**没写** `trigger-on-focus`，
  > 而 Element Plus 该 prop 默认 **true**（从旧版随包发的 `legacy/vendor/js/element-plus.min.js` 里读出的
  > `triggerOnFocus:{type:Boolean,default:!0}`）；候选构造 `Sa` 在查询词为空时**回全量**，
  > 所以点进空框就看到整份候选（固定 4 项 + localStorage 自定义项），**不必先打字**。
  > 另两处（`:12058` 客户编辑弹窗、`:12141` 查询订单·客户）是逐字写了 `"trigger-on-focus":!0`，行为相同。
  > 对照见 `docs/home-audit/autocomplete-logiccheck.mjs`。
  >
  > ⚠️ **「聚焦即弹」有个陷阱**：光把焦点行为补上还不够 —— 旧版 `el-dialog` 的 focus-trap 硬编码
  > `"focus-start-el": "container"`，**开窗时只聚焦容器、不聚焦任何输入框**，所以旧版开窗不会自己弹下拉。
  > 新版若用 Naive 的默认（`n-modal` 的 focus-trap `autoFocus` 默认 `true` ⇒ 聚焦第一个可聚焦控件），
  > 开窗瞬间就会弹，而且是在入场动画途中弹的、浮层位置也算偏。
  > **结论：装了 autocomplete 的弹窗必须 `:auto-focus="false"`**（本页「手动更新进度」与「查询订单」两个）。

### 4.8 加价

主表侧仅提供默认加价项 `ro = [{name:"人工",price:100,unit:"元/套"}]`，加价逻辑在 Hui 明细表 + `useAddPriceItems` 内（不重复分析）。

---

## 5. 财务面板 FinanceDrawer（`To` 解码表）

`el-drawer` `direction:"rtl"`，尺寸 `innerWidth<=768?"100%":"520px"`，标题 `财务管理 — {客户名}`。
父级传入 `row` 仅 4 字段 `{回执单号,客户编号,客户,总价}`，其余打开后自拉。`defaultedStatus=Yt`（终端用户隐藏写操作）。

### 5.1 三 tab

1. **📄 本单财务**：横幅（回执单号/订单总价/本单未收）+ 4 summary-card（订单总价/已分配/订单调整金额/未收金额）+ 收款分配记录表 + 本单收款表单 + 订单调整记录表。
2. **💰 客户收款**：紫渐变卡（订单总额/已实收/客户余额/未分配余额）+ 录入收款 + 分配预览表 + 剩余未分配。
3. **📊 客户对账**：紫渐变卡（订单总额/实收/调整合计/客户余额）+ 收款趋势 echarts 柱状图 + 对账明细表（筛选框 + 日期/类型/单据号·地址/金额/备注）。

### 5.2 四个弹窗（el-dialog append-to-body）

| 弹窗 | 标题 | 宽 | 提交 API |
|---|---|---|---|
| 订单抹零/冲销 | `订单抹零 / 冲销` | 380px | `finance_addOrderAdjustment` |
| 客户抹零/冲销 | `客户抹零 / 冲销` | 380px | `finance_addCustomerAdjustment` |
| 录入预付款 | `录入预付款` | 400px | `finance_addPayment` |
| 预付款分配 | `预付款分配` | 560px | preview→execute |

### 5.3 收款方式

默认 5 项：**微信/支付宝/现金/转账/其他**；自定义存 `localStorage["finance_payment_methods"]`；新增截断 20 字；右键删除（选中则回退「微信」）。

### 5.4 各操作校验规则（逐条，重要）

**本单收款（finance_addOrderPayment）**，body `{ds,客户编号,回执单号,收款金额,收款日期,收款方式,备注,启用预付优惠,优惠比例}`：
1. 金额空/0 → 「收款金额不能为零」。
2. 启用预付优惠：负数红冲 → 「启用预付优惠时不支持负数红冲」；`优惠抵扣≤0` → 「当前没有可用预付款用于优惠抵扣」；`金额+优惠抵扣>未收` → 「收款金额+优惠抵扣不能超过本单未收」。
3. `金额>未收+0.005` → 「收款金额不能大于未收金额」。
4. `金额<0 && |金额|>已分配+0.005` → 「红冲金额绝对值不能超过本单已分配金额」。
5. `金额>客户余额+0.005` → 「收款金额超过客户余额」。
预付优惠抵扣 `G = min(未收×优惠比例/100, 未分配余额)`。

**客户收款（finance_previewAllocation 预览 + finance_addPayment 提交）**：金额空/0→warning；红冲超实收→error；收款超客户余额→warning（非阻断）。提交带 `分配列表`。

**录入预付款（finance_addPayment，冲销模式）**：冲销金额>未分配余额→error；金额取绝对值，冲销取负；备注自动加前缀 `预付款:`/`预付款冲销:`。

**订单抹零（finance_addOrderAdjustment）**，调整类型 `抹零/优惠/补贴/冲销/其他`：正数(减免)超未收→error；超客户余额→error；负数(冲销)超订单调整合计→error。

**客户抹零（finance_addCustomerAdjustment）**，类型 `月度抹零/优惠/冲销/其他`：正数超客户余额→error；负数超客户调整合计→error。

**预付款分配（preview→execute）**：金额≤0→warning；预览返回 `分配列表/合计分配金额/合计优惠金额/资金池剩余`；执行需先预览。

**清账（全单回款）**：选中 0→warning；按客户分组算未收；提示「客户X：N单，未收 ¥Y」；逐客户 `finance_addPayment`（`收款方式:"清账"`，`分配列表`=未收>0 的 `{回执单号,日期,总价,分配金额:未收,分配后余额:0}`）。

### 5.5 红冲展示

负数分配金额 → `text-danger`(#f56c6c)；订单调整记录减免金额恒 `text-warning`(#e6a23c) 显示 `-¥X`；对账明细负数 → `text-success`(#67c23a) 显示 `-￥|X|`；类型 tag：收款→success、订单抹零→warning、客户抹零→info、红冲单→danger。

---

## 6. 打印 / 回执 / 分享 / 通知 / 工具

### 6.1 打印类型 `ic`(1–16) 与取值/模板映射

| ic | 类型 | 取值方法 | 模板 key |
|---|---|---|---|
| 1 | 玻璃合片单 | calculateGlass | glass |
| 2 | 生产单 | calculateReceipt | receipt |
| 3 | 玻璃单 | Glasslist | glassHole |
| 4 | 标签 | lable | — |
| 5 | 收据单 | 收据单(brand 替换「回执单」) | — |
| 6 | 订货清单 | 替换「订货清单」 | — |
| 7 | 自定义收据单 | calculateReceiptForCustomed | — |
| 8/9 | 生产单旧版 | calculateReceiptOld(+两两配对) | product3 |
| 10 | 料标签 | lableForProduct | — |
| 11 | 料标签(自定义) | lableForMaterial | — |
| 12 | 收据单2 | FinalReceipt2 | — |
| 13 | 合格标签 | buildQualifiedLabelHtml | — |
| 14 | 生产单2 | buildProductionSheetHtml | — |
| 15 | 生产单2 | buildProductionSheet2Html | — |
| 16 | 玻璃合片单2 | buildGlassSheet2Html | — |

### 6.2 回执单三组件（不在 Home 内，触发链在 index 壳）

| 组件 | 路由 | requiresAuth | 触发 |
|---|---|---|---|
| ReceiptView | `/receipt-view/:receiptNo` | true | 深链自动登录后，守卫把 `sessionStorage.pending_receipt_no` 重定向到它；读 `getorders` 渲染 ReceiptMobile |
| ReceiptShare | `/receipt-share` | false | 免登录，读 `receiptNo/ds/registrant` + `getorders` 渲染 ReceiptMobile |
| ReceiptMobile | 无独立路由 | — | 被前两者作为 `_` 组件渲染 |

深链校验（index）：`token.split("wy")` → 前段 `{i}af{c}` 不含 NaN、后段 `now-(尾段-888)∈[0,604800000]`(7 天) → `login` API 自动登录。

### 6.3 工具按钮

- **刷新**：`window.location.reload()`。
- **导出 Excel**（生产单）：ExcelJS，`生产单_YYYYMMDD_HHMMSS.xlsx`；表头 `[客户/门类,门图,单号,订单信息,方向,门扇,外框,亮窗/扣板,备注]`，列宽 `[12,15,9,17,9,17,17,17,17]`；门图从 `$i(url)` 拉 base64 插入。
- **列宽设置**：仅「君豪汇总订单」Excel 设置，localStorage key `junhaoOrderSummaryExcelSettings`，默认 `{rowHeight:60, columnWidths:[96,120,120,96,80,80,80,176,100,100,160,100], bodyFontSize:12, headerFontSize:12, headerBold:true}`。**主表无列宽持久化**。
- **扫码生产**：不在 Home，是 App 壳顶部导航项 → `/Qrscanner`。

### 6.4 通知公告（syncNoticeBoard，在 index 全局路由守卫）

`GET …/1?param1=syncNoticeBoard&param2={registrant}`；`code===200 && message!=="none"` → `ElMessageBox.alert`（`dangerouslyUseHTMLString:true`，标题「通知:」，`\n`→`<br>`），正文中 `http(s)://` 链接逐个 `window.open(_blank)`；「我知道了」→ `location.reload()`。

---

## 7. 数据模型

### 7.1 订单头（中文 key）

`回执单号`(主键/排序) · `日期` · `截止日期` · `客户` · `客户编号` · `电话`/`地址` · `业务员` · `打单人` · `打单操作` · `品牌` · `门数` · `总价` · `定金` · `锁向` · `加价项目` · `安装地址` · `订单备注` · `已分配金额`/`订单调整金额`/`未收金额`(新财务) · `类型`(流水过滤)。

> ⚠️ **2026-09-18 更正**：本行原先把 `单号` 也列在**订单头**里 —— **错了**。
> 经前端 + 旧服务端双向核实（`docs/2026-09-18-order-no-semantics.md`）：
> **`单号` 是「明细行」级字段**（每一扇门一个，格式 `N-YY/MM/DD`），订单头上根本没有它；
> **`单号集` 是订单头字段**，内容 = 该单所有明细行「单号」去重后 `_` 连接。
> 前端全部头对象字面量（`:8125/:9146/:9172/:9200/:11003/:11358`）里只有 `回执单号`，一个 `单号` 都没有。

**财务口径**（`co`/`so`）：
- `已付 = 新财务(Ht) && 已分配金额!=null ? 已分配金额 : 定金`
- `未收 = 新财务 && 未收金额!=null ? 未收金额 : (总价 - 定金)`
- `Ht = localStorage.getItem("newFinanceSystem")==="1" && userinfo.name!=="开门红2"`

**主表汇总行**：`总价=Σ总价`、`已付=Σ(已分配金额??定金)`、`未付=Σ未收`、`未付单数=Σ(未收>0)`、`未审核=Σ(打单操作&&单号集都空)`。

### 7.2 订单行（中文 key + 少量英文）

数组名 `ping_hui`/`diao_hui`（英文）；每项 `id`(英文)、`imageUrl`(英文)；其余中文 key：
`单号/客户/型材/颜色/开向/扇数/五金/面玻/底玻/玻璃厚/墙厚/门洞宽/门洞高/亮窗总高/洞尺/吊脚/轨道长/轨道种类/套线种类/套线单价/边封数/亮窗数量/数量/单价/平方数/打折/金额/计价方式/备注`。

### 7.3 财务数据

- 订单财务：`{已分配金额, 订单调整金额, 未收金额}`（按回执单号 key，`finance_getOrderFinanceSummary` 下发）。
- 客户余额：`{客户编号,客户名称,订单总额,实收金额,客户余额,未分配余额,订单调整合计,客户调整合计}`。
- 流水：`{类型,单据号,日期,收款金额,安装地址,备注}`。
- 删除校验：`{回执单号:{allocatedAmount,adjustmentAmount,customerId}}`。
- 分配项：`{回执单号,日期,总价,分配金额,分配后余额}`。

---

## 8. API 端点全表

网关：`https://www.samrtdoor.com.cn/1?param1=<动作>&param2=<ds>...`；响应统一 `{code,message,data}`，成功 `code===200`。

### 8.1 订单/客户/图片（10）

| 端点 | 方法 | 参数 | 响应 |
|---|---|---|---|
| getTableData | GET | param2=ds | `data.tableData:[订单头]` |
| getTableDataForTerminal | GET | param2=`ds_终端号` | 同上 |
| detail | GET | param2=ds, param3=回执单号 | `data:{ping_hui:[],diao_hui:[]}` |
| combine | POST | param2=ds, body `{merged,record}` | code |
| deleteHui | POST | param2=ds, body=回执单号数组 | code |
| updateCustomerInfo | POST | param2=ds, body=整行/日期对象 | code |
| getClientsInfo | GET | param2=ds | `data:[{客户,电话,地址,编号}]` |
| getLatestClientsInfo | GET | param2=ds, param3=客户编号 | `data[0]` |
| getimage | GET | param2=类型(`qrcode`), param3=registrant | 二进制 blob（type 全库仅 `qrcode` 收款二维码一种；`showQrcode` 是显示开关非 type） |
| clearAccount | POST | param2=ds, body=`[{回执单号,定金:总价}]` | code（老财务清账） |

### 8.2 财务（13）

| 端点 | 方法 | 参数 | 响应 |
|---|---|---|---|
| finance_getOrderDetail | GET | param2=ds, param3=回执单号 | `{未收金额,订单调整金额,已分配金额,...}` |
| finance_getCustomerBalance | GET | param2=ds, param3=客户编号 | `{客户余额,实收金额,未分配余额,客户调整合计,...}` |
| finance_getCustomerStatement | GET | param2=ds, param3=客户编号, param4=天数(0/365) | `data:[流水]` |
| finance_getPaymentStats | GET | param2=ds, param3=客户编号 | `data:{monthly:[],yearly:[]}` |
| finance_getOrderFinanceSummary | GET | param2=ds, param3=天数(默认60), param4=start, param5=end | `data:{[回执单号]:{已分配金额,订单调整金额,未收金额}}` |
| finance_checkOrderPayment | POST | param2=ds, body=回执单号数组 | `data.orders:{[回执单号]:{allocatedAmount,adjustmentAmount,customerId}}` |
| finance_addOrderPayment | POST | body `{ds,客户编号,回执单号,收款金额,收款日期,收款方式,备注,启用预付优惠,优惠比例}` | code |
| finance_addOrderAdjustment | POST | body `{ds,回执单号,调整金额,调整类型,备注}` | code |
| finance_addPayment | POST | body `{ds,客户编号,收款金额,收款日期,收款方式,备注,分配列表}` | code |
| finance_addCustomerAdjustment | POST | body `{ds,客户编号,调整金额,调整类型,备注}` | code |
| finance_updateOrderCustomer | POST | param2=ds, body `{回执单号,原客户,原客户编号,客户,客户编号,编辑}` | code（改客户名，Hui chunk） |
| finance_previewAllocation | POST | body `{ds,客户编号,收款金额}` | `data:{分配列表,剩余未分配}` |
| finance_previewPrepaymentAllocation | POST | body `{ds,客户编号,分配金额,优惠比例}` | `data:{分配列表,合计分配金额,合计优惠金额,资金池剩余}` |
| finance_executePrepaymentAllocation | POST | body `{ds,客户编号,分配金额,优惠比例,备注}` | code |

### 8.3 跨 chunk（后端契约需知，Home 不直接发）

`getMoreTableDate`(TerminalOrders) · `updataProgress`(Progress) · `updataPaymentCollection`(Progress) · `syncNoticeBoard`(index) · `login`(深链自动登录) · `getorders`(ReceiptView/Share)。

---

## 9. 租户配置（登录响应 registrant）

Home 只读：`userinfo.ds`(所有 param2) · `userinfo.name`(门店名) · `userinfo.registrant`(品牌, getimage param3) · `userinfo.defaulted`(3=终端) · `registrant.ping_column`(平开列显隐) · `registrant.template.{product,glassHole,FinalReceipt}`(打印模板)。

排序：Home 本地 `parseInt(回执单号)` 降序（**不用** DESIGN-DOC 说的 `smartdoor_sort_method`）。

---

## 10. 与后端的差距

**订单头缺**：单号集、打单人、打单操作(状态机)、锁向、加价项目、独立「截止日期」字段。

> ⚠️ 其中 **`单号集` 已于 2026-09-18 落地**（迁移 `0020` 起改为**服务端派生**；
> 行级 `单号` 同时补上，`order_lines.line_no`）。见 `docs/2026-09-18-order-no-semantics.md` §6。

> ⚠️ **2026-09-18 更正**：本行原先把 `单号` 也列进「**订单头**缺」—— **层级弄错了**。
> `单号` 是**明细行**级字段（每樘门一个），不存在于订单头，**不该出现在这张订单头的缺口清单里**；
> 它对应的是 `order_lines` 缺一个编号列。详见 `docs/2026-09-18-order-no-semantics.md`。
> （`单号集` 仍在订单头，保留。）
**订单行**：字段基本对得上，但旧版是中文 key，我们是英文 key，需一层序列化映射；`洞尺` vs `hole_size` 语义待确认。
**财务（最大缺口）**：完全没有财务表/接口——回款、冲销、预付款分配、客户余额全部缺（对应 F1–F13）。
**客户**：`clients` 表已覆盖，基本满足。
**租户配置**：`tenants` 只有 `id/name`，缺 `ds`/`registrant` 配置对象；登录响应 `AuthResponse` 无 `userinfo`/`registrant` 结构。
**接口**：orders 模块只有 REST（list/get/create/update/delete...），缺动作式 `getTableData/detail/combine/deleteHui/updateCustomerInfo` + 全部 `finance_*` + `getimage`。

---

## 11. 完整 CSS + Naive UI 映射

### 11.1 语义色（Element 默认 → Naive token）

| 用途 | 色值 | Naive token |
|---|---|---|
| 主文字 / 常规 / 次要 | `#303133`/`#606266`/`#909399` | `textColor1/2/3` |
| 边框 / 背景 | `#ebeef5` `#dcdfe6` / `#f5f7fa` | `borderColor`/`dividerColor`/`bodyColor` |
| 主色蓝 | `#409eff` | `primaryColor` |
| 成功/警告/危险 | `#67c23a`/`#e6a23c`/`#f56c6c` | `successColor`/`warningColor`/`errorColor` |
| 按钮蓝（自定义） | `#7caaf3`→hover`#0965fa` | 自定义 type 或 override |
| 紫渐变（看板/余额卡） | `#667eea→#764ba2` | 自定义渐变 class |

### 11.2 主 Home 样式（`[data-v-7e2e1e6b]`）

- `.home-container{margin-top:65px;padding:10px;height:calc(100vh-70px);overflow-y:hidden}`（768px 下 margin-top:18px）
- 表头 `#FAEBD7` + `#000` + 16px + bold + 左对齐（内联）
- 可编辑格 `el-input__inner{border:none;padding:2px 5px;transparent;hover #f5f7fa;focus #ecf5ff+ring #409eff33}`
- 按钮色见 §1.1 按钮表；`custom-combine-btn #67c23a`、`custom-unproduced-active-btn #f56c6c`、`custom-print-btn #4a89ee`
- `.expand-column .el-table__expand-icon--expanded{transform:rotate(90deg)}`
- `.action-buttons .el-button{padding:0 5px;font-size:12px}`

### 11.3 财务面板（`[data-v-97a9ce53]`）

`.finance-banner`(flex gap20 下边框) · `.b-label`(11px #909399) · `.b-value`(17px 700 #303133) · `.summary-card`(#f5f7fa radius6) · `.sc-label`(11px)/`.sc-value`(15px 700) · `.cust-balance-card`(紫渐变 radius8 白字) · `.order-pay-form`(#f0f7ff border #b3d8ff radius6)。

### 11.4 大屏仪表盘（`[data-v-e9ab146d]`，深色 DataV 主题，需自写装饰）

`.big-screen-container`(深蓝渐变 100vh) · `.title`(28px 渐变字 + text-shadow) · `.main-content`(grid 1fr 2fr 1fr gap15) · 青 `#3de7c9` / 浅蓝字 `#7ec7ff` / 图表分隔 `#243b5a`。DataV 组件（dv-border-box-8/12/13、dv-decoration、dv-digital-flop、dv-scroll-ranking-board、dv-scroll-board）Naive 无对应，需自写 SVG/CSS + echarts（旧版就是 echarts）。

---

## 12. 待确认 / 死代码清单

1. **ic=6（订货清单）操作栏按钮文字**未逐字复核。
2. `printService.exportImage` 方法体（html2canvas→share/download）只核到调用层，未逐行读方法体。
3. `finance_getOrderFinanceSummary` 的 param3（默认 60）确切含义推测「近 N 天」，未证实。
4. `getimage` 的 type 已查：全库仅 `qrcode`（收款二维码）一种，`showQrcode` 是显示开关而非 type。
5. 死代码/死样式：`Tt`（`dr(760)="false"` 只写不读）；`.date-danger` 样式已定义但 `Ls()` 未引用；`.custom-dashboard-btn`/`.custom-sale-btn` 无引用（「经营看板」实际用 `custom-search-btn`）；`.paid-row` 无对应 CSS。
6. 主表 4 处空注释占位列（疑已移除的「品牌/开向」等列），列名无法从代码确认。

---

## 附：证据坐标速查

- Home 主组件：`Home.formatted.js:3884`（整行）；FinanceDrawer `:961–2372`；DashboardBigScreen `:155–554`。
- 主表列/筛选/数据流：`:3884`（`ps`/`fs`/`Cs` computed、`co`/`so` 口径）。
- 各 API fetch：`Home.formatted.js:1101(Q)/1114(R)/1141($)/1159(ae)/1240/1269/1298/1333/1366/1426/1449` + `:3884@389680(F5)/433560(F6)/104500(清账)`。
- CSS：`legacy/css/Home-97d96482.css`（三 scope：`7e2e1e6b`/`97a9ce53`/`e9ab146d`）。

---

## 补记 2026-09-19：A3 / F3 / F4 / F5 那条架构级偏离**已消除**

用户指出「Home 页折叠展开的明细行 和 Hui 页表格一样，原版是这样的，新版是重新画的」——
正是本文件记的这条偏离。当天做完了：

- **展开行不再自绘**：挂 `components/DetailLinesTable.vue`（与 Hui 页**同一个组件**），
  列集/单元格/行内编辑/勾选/加价/门图/算料/行级保存全都在，与 Hui 完全一致。
- **顺带补齐**（旧版有、新版原先没有的）：行级编辑态（点单元格 → 确认修改/取消、脏行标粉、
  切行「未保存提醒」）、行级保存（`PUT /orders/{id}/lines/{line_id}`，旧版 `updateRowData`）。
- **已知未接**：展开行的「算料」按钮**只算料、不自动开「生产单」预览**（旧版会顺手开，
  `Home.formatted.js:8221-8263`）。新版不内嵌 Hui 页面组件，预览要接 Home 自己的打印链路 —— 见下。

**证据与逐条对照**：`docs/2026-09-18-detail-table-extraction.md`（含终端态接口、搬迁保真检查、
CSS 差分台）；验收脚本 `docs/home-audit/hui-extract-movecheck.mjs`（引擎 47 + 组件 51 逐字一致）、
`hui-engine-logiccheck.mjs`、`hui-row-save-check.mjs`。

⚠️ **本文件的正文表格未逐条复核**，上面只覆盖这一条偏离及其直接连带项。
另有两条**本次未动**、需要单独立项的差异：① 操作列第三个按钮旧版是**查看3D**、我们是**算料**；
② 旧版另有独立「算料」入口在门花图列。**未核实**，别当成已做。

⚠️ **浏览器里的观感未验**：本项目没有浏览器驱动，5c 的验收目前是 build + `vue-tsc` + 五个
逻辑/接口脚本 + 源码复核。**展开行的实际渲染与交互仍需人工过一眼。**
