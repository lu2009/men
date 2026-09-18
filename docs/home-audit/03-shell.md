# 03 · Home 工具条 / 弹窗 / 页面级杂项 —— 保真度审计

> 审计人：subagent（工具条 + 弹窗 + 页面级杂项维度）
> 审计日：2026-09-18

## 0. 证据坐标说明（**重要，先读**）

`docs/2026-09-17-home-analysis.md` 里的 `Home.formatted.js:行号` **全部失效** ——
该文件在 2026-09-17 12:35 被 `deobfuscate-home.mjs` 用**另一套美化器**重新生成过
（当前 12282 行，最长行 23316 字符 @ 7563；文档里说的「3884 是一根 242KB 巨行」在该版本已不成立）。

本报告的行号一律以**当前磁盘上的** `legacy/js/Home.formatted.js` 为准，并给出：
- 组件边界：`DashboardBigScreen` 156–960 · `FinanceDrawer` 961–2372 ·
  `Receipt2PrintManager` 2373–3468 · `QualifiedLabelPrintManager` 3469–4522 ·
  `ProductionSheetPrintManager` 4523–5787 · `ProductionSheet2PrintManager` 5788–6485 ·
  `GlassSheet2PrintManager` 6486–7182 · `JunhaoOrderSummaryDialog` 7183–7568 ·
  **`Home` 7569–12282**（判据：`__name:"..."` 标记行）。
- 字符串解码：当前 formatted 文件里 **Home 主组件的解码器局部名叫 `s`**，`FinanceDrawer` 里叫
  `l/d/e/t/n/o`，别名分别指向 `/tmp/home-map.json` 的 `dr` / `To` 表。
  本报告引用时写成 `s(514)`（= `dr(514)` = `" 打印选中订单"`），方便与旧文档对照。
- 壳（路由守卫）：`legacy/js/index-c3b16e3f.js`，**该文件是单行 85818 字节**，故用**字节偏移**引用。

**结论摘要**

- 派单点名的 9 条工具按钮：**3 条 ❌**（导出 Excel 生产单 / 列宽设置·君豪汇总订单 / 扫码生产）、
  **3 条 ⚠️**（未生产↔显示全部**语义反了** / 清账 / 打印选中订单）、**2 条 ✅**（刷新·行为偏离另计）。
  ⚠️ 另外两处**文档坐标也要更正**：`导出 Excel（生产单）` 与 `列宽设置` **都不是工具栏按钮**（前者在 `ic=2` 打印预览弹窗工具条，后者在君豪汇总订单弹窗内）。
- 旧版工具栏**实际有 10 颗**（左 9 + 右 1），我方点名的只覆盖 6 颗。剩下 4 颗新版情况：
  查询更多 ❌ / 电子回执单 ⚠️（挪到行操作且改成跳页）/ 合并订单 ❌ / 视频教程 ❌。
- FinanceDrawer：三 tab、四弹窗、收款方式默认项、红冲色、Tab 懒加载 —— 结构层面 ✅；
  **§5.4 的校验规则几乎全缺 ❌**（B22–B29 逐条列出，共缺 20+ 条 error/warning + 3 套表单 validate），
  收款方式的**自定义新增与右键删除 ❌ 整体未做**。
- 经营看板：11 块面板与筛选**结构齐全**，数值口径 ✅；差异集中在 DataV 组件降级、`流程状态` 左右顺序反、
  `最新订单` 列集不同、数据源被按角色过滤。
- `syncNoticeBoard` ❌ 完全未做（旧版挂在全局路由守卫，**不在 Home 内**）。
- `Yt`（工厂/终端）影响 **12 处** UI、`z`（手机端）影响 **7 处** —— 逐条列在 §E。

---

## A. §6.3 工具按钮（含旧版实际存在的全部工具栏按钮）

旧版工具栏渲染整体位于 `Home.formatted.js:11253–11298`（容器 `mu`=`.buttons-row`，左组 `wu`=`.left-buttons`，右组 `vu`=`.right-buttons`）。

| # | 项 | 旧版依据（行号 / 偏移） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| A1 | **工具栏整体构成** | `:11253–11298`（左 9 颗 + 右 1 颗）；CSS `.left-buttons/.right-buttons{display:flex;gap:10px}` @ `Home-97d96482.css` | `Home.vue:5–35` | ⚠️ 偏离 | 旧版左组顺序 = 打印/查看回执单 → 刷新 → 经营看板 → 查询更多 → 删除选中数据 → 显示全部/未生产 → 电子回执单 → 选中清账(N) → 合并订单(N)；右组 = 视频。新版左组 = 刷新 → 未生产/显示全部 → 打印选中订单 → 删除选中数据 → 清账，右组 = 经营看板+汇算下单+客户信息+公式管理+退出登录。**顺序打乱、4 颗缺、右组被塞进自家导航**。注：新版把「汇算下单/客户信息/公式管理/退出登录」放这里，是因为新版**没有 App 壳导航**（`App.vue:1–12` 只有 router-view）——旧版这些在壳的抽屉菜单里（`index-c3b16e3f.js@29400–30100`）。 |
| A2 | 刷新 | `:11262` `el-button.custom-refresh-btn` 文案 `s(1414)=" 刷新 "`；handler `pa` @ `:8008` = `async()=>{ window.location.reload() }` | `Home.vue:6` `@click="load"` | ⚠️ 偏离 | **旧版是整页 `location.reload()`（清空选项/分页/展开态），新版只重拉数据（`Home.vue:255–269`）**。组件/交互后果不同：旧版刷新后选中与展开全没。另：旧版按钮 `type:"primary"` 且背景 `#7caaf3`，新版 `size=small` 默认色。 |
| A3 | 未生产 ↔ 显示全部 | `:11278–11282`：文案 `$l.value ? "显示全部" : "未生产"`，class `$l.value ? custom-unproduced-active-btn : custom-search-btn`；handler `Ui` @ `:9220` = `$l=!$l; Kl=1; $l ? ElMessage.success(s(940)="已筛选未生产数据") : ElMessage.success("已显示全部数据")` | `Home.vue:7–13`：`{{ onlyUnproduced ? '未生产' : '显示全部' }}`，`:type="onlyUnproduced ? 'error' : 'default'"`；toggle 在 `Home.vue:341–343` | ⚠️ **语义反了** | 旧版 `$l=true`（=正在只看未生产）时按钮文案是**「显示全部」**（按钮说的是"点了会怎样"），底色红。新版 `onlyUnproduced=true` 时文案是**「未生产」**（说的是"当前状态"）。**两者恰好相反**，且新版**无任何切换提示消息**（旧版有「已筛选未生产数据」/「已显示全部数据」）。过滤口径本身一致（`!打单操作\|\|trim===""`）。 |
| A4 | 打印选中订单 / 查看回执单 | `:11253–11261`：`Yt ? 【打印选中订单 + " (N)")】: 【查看回执单 + " (N)")】`，class `Fl.length>0 ? danger-print-btn : custom-print-btn`，同一 handler `Gi` @ `:9326`；**无 `disabled`，0 选中也能点** | `Home.vue:14–20`，`openPrint` @ `Home.vue:550–564` | ⚠️ 偏离 | ① 旧版**工厂/终端文案不同**（新版无 `Yt`，只做「打印选中订单」）——终端分支见 E1。② **旧版没有「至少选一条」的前置校验**：`Gi` 只校验 `go`（=表被改过 → `ElMessage.warning("订单已修改，请重新选择！")` + 清空选中 + 关掉子表选择，`:9336–9350`），0 选中点下去就是拿到空数据继续走。新版 `openPrint` 先 `message.warning('请先勾选要打印的订单')` 拦住 —— **是有意改进，但属于行为偏离**。③ 旧版明细**不补拉**：只取已展开行（`wn`/`gn`），没展开过的订单打出来是空白；新版 `Home.vue:556–558` 对未展开的走 `api.getOrder(id)` 兜底（代码注释自认「有意的行为改进」）。 |
| A5 | 未付额配色（打印按钮的色变依据） | `:11255` 用 `Fl.value.length>0` 切 `danger-print-btn(#f56c6c)` | — | ✅ 已做（等效） | 新版用 `:type="checkedRowKeys.length ? 'warning' : 'default'"`（`Home.vue:16`）表达同一意图，颜色 token 不同（#e6a23c vs #f56c6c）。 |
| A6 | **查询更多** | `:11268–11272` `el-button.custom-search-btn` 文案 `s(1355)=" 查询更多 "`；handler `ms` @ `:11029`（开 `.查询订单` 弹窗 + 拉 `getClientsInfo`）；确认 `ys` @ `:11052`（GET `getMoreTableDate&param2=ds&param3=客户&param4=地址&param5=start&param6=end`，按 `打单人` 二次过滤，与 `_l` 去重合并，再把搜索框写成「客户 地址」，`Yt&&Ht` 时 `ea(60,{start,end})` 重拉财务摘要，并刷新看板）；「确认统计」`vs` @ `:11122` | **无** | ❌ 未做 | 旧版这颗是**日期范围筛选的唯一真实入口**（§2.4）。弹窗本体：`:12118` `el-dialog title="查询订单" width="500px" label-width:100px`，字段 `客户`(el-autocomplete，仅 `Yt`)/`安装地址`(仅 `rl`)/`起始日期`/`结束日期`(含快捷项 `今天/昨天/s(1300)`)/`只含生产单`(checkbox)。新版工具栏与页面均**无此按钮、无此弹窗**。 |
| A7 | 删除选中数据 | `:11273–11277` `el-button.custom-delete-btn` 文案 `s(1271)=" 删除选中数据 "`；handler `Si` @ `:9223` | `Home.vue:27`，`deleteSelected` @ `Home.vue:670–760` | ⚠️ 偏离 | 文案 ✅、常显 ✅、空选提示 ✅（旧版 `s(952)="请选择要删除的数据"` @ `:9228`，新版 `Home.vue:673` 同文）。**缺**：① **密码校验** —— 旧版 `:9229` `if(!(await y("删除"))) return;`，`y` = `usePasswordVerify` 的 `verifyPassword`（`Home.formatted.js:7570–7573` `const {verifyPassword:y}=St()`；该模块 `legacy/js/usePasswordVerify-b6115859.js`，内含「请输入密码」「密码不能为空」「请输入管理员密码以确认」）。② **分支** —— 旧版 `:9231` `if(打单操作==="自助下单" || Yt)` 才进删除流程，否则 `ElMessage.success(s(706)="已确认的单只能工厂删除！")`（`:9306`），新版无此分支，任何单都能删。③ 旧版是**批量** `deleteHui`（body = 回执单号数组，`:9296`），新版 `Home.vue:724` 逐条 `api.deleteOrder(id)` 循环。④ 旧版成功消息列出「删除成功，已完成：收款红冲 ¥X，抹零红冲 ¥X」（`s(853)`），新版统一 `'删除成功'`。⑤ 旧版删完 `setTimeout(()=>location.reload(),500)`（`:9302`），新版 `load()`。红冲内容（`Home.vue:726–747`）与旧版逐客户 `finance_addPayment(负收款)+finance_addCustomerAdjustment(负抹零)` 口径 ✅ 一致（备注文案也照抄）。 |
| A8 | 清账 | `:11284–11288`：**仅 `Fl.length>0` 时出现**，文案 `" 选中清账 ("+N+") "`，class `custom-delete-btn`；handler `Pi` @ `:9116` | `Home.vue:28`（**常显**），`clearAccounts` @ `Home.vue:765–843` | ⚠️ 偏离 | ① **可见性**：旧版选中数 >0 才渲染，新版**常显**。② **文案**：旧版「选中清账 (N)」→ 新版「清账」。③ **确认框标题**：旧版新财务分支 `ElMessageBox.confirm(..., "清账确认（新财务系统）")`（`:9133`），新版「清账确认」（`Home.vue:818`）。④ 空选提示文案不同：旧版「请选择要清账的数据」→ 新版同（`Home.vue:768` ✅）。⑤ 分组口径一致（按 `客户编号`，`未收金额 ?? 总价-定金` 再 `Math.max(0,…)`，`:9119–9128` vs `Home.vue:789–805`）；提交口径一致（`收款方式:"清账"`、`备注:"批量清账 "`、`分配列表`，`:9155` vs `Home.vue:825–833`）。⑥ 旧版有**老财务分支**（`clearAccount` POST body `[{回执单号,定金:总价}]`，`:9172–9188`），新版只有新财务一条路 —— 与后端自洽模型一致，算有意收敛。 |
| A9 | 经营看板（按钮） | `:11263–11267`：**仅 `Jt.value` 时渲染**，class `custom-search-btn`，文案 `s(470)=" 经营看板 "`；handler `Is` @ `:11241` = `()=>{ ks.value=!0 }`；`Jt` 定义 `:7580` `Vue.ref(!1)`，赋值 `:8147` `Jt.value = (registrant===name) \|\| (name==="开门红")` | `Home.vue:30`（**无条件渲染**） | ⚠️ 偏离 | 新版**没有开门条件**。旧版对绝大多数门店（`userinfo.registrant !== userinfo.name` 且 `name !== "开门红"`）**根本不显示这颗按钮**。注：该判断的具体业务含义（为什么 registrant==name 才算）**❓ 未确认**，此处只给字面表达式。 |
| A10 | 电子回执单 | `:11279–11283`：**仅 `bn` 时渲染**，`bn = Kt.length===1`（`:8188–8190`），class `custom-delete-btn`，文案 `" 电子回执单 "`；handler `Dn` @ `:8192` | 新版把它做成**行内操作按钮**（`Home.vue:1036`，操作列），跳 `receipt-view` 路由（`Home.vue:643–649`） | ⚠️ 偏离 | ① **位置**：旧版在**工具栏**（选中 1 条才出现），新版在**每行的操作列**（每行都有）。② **行为**：旧版是**拼深链并复制到剪贴板**（`https://www.samrtdoor.com.cn/login?param1={客户}&param2={token}&receiptNo={单号}`，`token={i}af{c}wy{now+888}`，`:8200–8214`；成功提示 `s(725)`；非安全上下文回退 `document.execCommand('copy')`）；新版是**跳预览页**（注释自认「旧版直接复制，新版多一步」）。③ 非 1 条选中时旧版提示「请只选择一条回执单」（`s(543)`，`:8217`），新版无此约束（按行进入天然单条）。 |
| A11 | 合并订单 | `:11289–11293`：**仅 `Fl.length>1` 时渲染**，class `custom-combine-btn(#67c23a)`，文案 `" 合并订单 ("+N+") "`；handler `Ii` @ `:9190` | **无** | ❌ 未做 | 旧版流程：`<2` 选中 → `ElMessage.warning("请选择至少两条数据进行合并")`（`s(639)`）；**必须同一 `客户编号`**否则 `ElMessage.error("只能合并同一客户的订单（客户编号必须相同）")`（`s(574)`，`:9213`）；确认框标题「合并订单确认」（`s(1005)`），正文「…条订单吗？合并后将以最早的回执单号为准，合并后不可恢复。」（`s(1224)`）；合并规则（`:9196–9206`）：取 `回执单号` 最大者为主，`总价/定金/门数` 累加，`日期`/`截止日期` 取最早，`安装地址`/`订单备注`/`打单人` 用 `"; "` 拼接，`打单操作` 置 `"合并单"`；POST `combine&param2=ds` body `{merged, record}`；成功「订单合并成功」（`s(1191)`）→ `Ca()` + 清空选中。新版**完全没有**。 |
| A12 | 视频（右组） | `:11294–11298` `el-button` 文案 `"视频"`；handler `Rt` @ `:7581` = `()=>{ Qt.value=!0 }`；`Qt` @ `:12172` `el-drawer title="视频教程" direction:"rtl" size:300px`，内含 3 颗：`批量打印`/`订单修改`/`订单汇总`，各调 `Ft(name)` @ `:7583` → `window.open(douyinUrl, "_blank")` + `ElMessage.success("正在打开"+name+"视频教程")` | **无** | ❌ 未做 | 三个抖音教程短链：批量打印 `https://v.douyin.com/xUPEUGEwfkI/`（`s(1210)`）、订单修改 `https://v.douyin.com/PaUmOVqJoZw/`（明文）、订单汇总 `https://v.douyin.com/7XtWK-apv0M/`（`s(537)`）、兜底 `https://v.douyin.com/jkgzDBIYLDA/`。 |
| A13 | **导出 Excel（生产单）** | `:11771–11775`：按钮 `" 导出excel "`（`type:"success"`），条件 `2==ic.value`，`onClick:tc` → **在「打印预览弹窗」的工具条里，不在工具栏、也不在「打印选项」抽屉里**；实现 `tc` @ `:9916–10047` | **无**（`app/package.json` 无 `exceljs`/`xlsx` 依赖；`PrintPreviewDialog.vue:533` 自认 `导出PDF` 都还没做） | ❌ 未做 | 旧版 §6.3 把它记成「工具栏按钮」是**文档错误**。`tc` 的完整实现（已逐行读）：① **前置校验** `if(!uc.value\|\|uc.value.length===0) return ElMessage.warning("没有可导出的生产单数据")`（`:9919`；`uc` 是「已生成生产单数据的行」列表，由行内 `In/calculateReceipt` 逐行填充）；② `ElLoading` 文案「正在生成Excel文件...」（`s(757)`）；③ `new ExcelJS.Workbook`，sheet 名 `s(1193)="生产单"`；④ 标题行合并 `A1:I1`、行高 35、`bold:18`、居中、`fill FFF0F8FF`、`下框 thick`/其余 thick；⑤ 表头 `["客户/门类","门图","单号","订单信息","方向","门扇","外框","亮窗/扣板","备注"]`（`s(1361)/"门图"/"单号"/s(731)/"方向"/"门扇"/"外框"/s(738)/"备注"`），**列宽 `[12,15,9,17,9,17,17,17,17]`** —— 与 §6.3 记录一致 ✅；⑥ 数据行行高 `max(30, 15*c+15)`、`size:14`、`wrapText`、`fill FFE6E6FA`；⑦ 门图：对每行的 `url`/`lockImg` 逐张 `await $i(url)` 取 dataURL → 去 `data:image/*;base64,` 前缀 → `workbook.addImage({base64, extension:"png"})`，door 类型放 `B{row}`，否则 `tl:{col:4,row:rowIndex-1}, ext:{width:50,height:40}`；失败该格写 `"图片加载失败"`（`s(1275)`）；⑧ 文件名 `"生产单_" + YYYYMMDD + "_" + HHMMSS + ".xlsx"`（`:10025–10028`，`s(502)=".xlsx"`）—— 与 §6.3 一致 ✅；⑨ 成功 `"Excel文件导出成功"`（`s(1155)`），失败 `"导出Excel失败，请重试"`（`s(788)`）。<br>**另一处易混**：`:9004–9087` 的 `bi` 是**另一个**导出（表头 `日期/型材/开向/颜色/玻璃/尺寸/数量/单价/金额/…/付款状态/备注`，文件名前缀 `s(1318)="订单汇总_"` + `toLocaleDateString()`），**不是** ic=2 这颗。新版**两个都没有**。 |
| A14 | **列宽设置（君豪汇总订单）** | 「君豪汇总订单」入口：`:11949–11956`，**在「打印选项」抽屉里**，条件 `Wt.value==="君豪门窗" \|\| Wt.value==="开门红试用号"`（`Wt` = `userinfo.registrant`，`:8145`）；组件 `JunhaoOrderSummaryDialog` @ `:7183–7568`；设置 key `const Cl="junhaoOrderSummaryExcelSettings"` @ `:607`；默认值 @ `:640` = `{rowHeight:60, columnWidths:[96,120,120,96,80,80,80,176,100,100,160,100], bodyFontSize:12, bodyBold:false, headerFontSize:12, headerBold:true}`；列定义 `:608–639`（序号/客户/型材/…）；导出 `Di` @ `:9085`（`kl(t,fn,$i)` → 「汇总订单导出成功」） | **无**（`app/src/components/` 无 `JunhaoOrderSummaryDialog`） | ❌ 未做 | 两点更正：① 旧版「列宽设置」有**两处**同名 UI —— `:5559` 那个属于**生产单打印设置**（class `ps-layout-fields-title`，管 `rowHeight/border/underlineBrElements/显隐列`），**不是**君豪汇总订单的；君豪那份在 `JunhaoOrderSummaryDialog` 内。② §6.3 说「主表无列宽持久化」✅ 属实。 |
| A15 | **扫码生产** | **不在 Home 内**。`index-c3b16e3f.js@29940`：壳抽屉菜单项 `📱 扫码生产`（`el-menu-item`，`onClick:O()`，受 `we && !ve` 门控，`ve`=手机端）；路由 `/Qrscanner` @ `index@73213`；且是**非终端账号登录后的默认落地页**（`index@81951` `n(1===t ? "/hui" : "/Qrscanner")`） | **无**（`app/src/router/index.ts` 只有 `/ , /login, /formulas, /clients, /hui, /receipt-view/:receiptNo, /receipt-share`；`App.vue` 无壳导航） | ❌ 未做 | 旧版把「扫码生产」当主入口之一，新版完全缺席。这条**只能算壳的缺口**，Home 页本身没错。 |

---

## B. §5 财务面板 FinanceDrawer

旧版 `Home.formatted.js:961–2372`（`__name:"FinanceDrawer"`），解码表 `To`，抽屉本身 `:1489`。

| # | 项 | 旧版依据 | 新版落点 | 判定 | 说明 |
|---|---|---|---|---|---|
| B1 | 抽屉外壳 | `:1489` `el-drawer title="财务管理 — "+客户 size=u direction:"rtl" destroy-on-close:false onOpen:ue`；`:967–970` `u = window<=768 ? "100%" : s(460)="520px"` | `FinanceDrawer.vue:2–3, 361` | ✅ 已做 | 标题、`rtl`、`520px`/`100%` 断点全对。 |
| B2 | 三 tab 名称 | `:1505–1510` `name:"order"` label `"📄 本单财务"` + `el-tag "单"`；`:1686–1691` `name:"payment"` `"💰 客户收款"`（tag）；`:1838–1843` `name:"statement"` `"📊 客户对账"`（tag） | `FinanceDrawer.vue:6, 94, 149` | ✅ 已做 | 三个 tab 名逐字一致（新版的 `el-tag "单"` 未复刻，属装饰）。 |
| B3 | Tab 切换的按需加载 | `re(paneName)` @ `:1210–1219`：`statement` → `R(客户编号)+$(客户编号)+ae(客户编号)`（余额+对账+统计）；`payment` 且无客户编号 → `R()`；打开抽屉 `ue()` @ `:1202` 只调 `Ce()+Q(回执单号)+R(客户编号)` | `FinanceDrawer.vue:412–431` 一次性 `Promise.all` 拉 4 个接口 | ⚠️ 偏离 | 旧版是**懒加载**（切到对账 tab 才拉对账与统计），新版打开即全拉。行为等价但请求时序/量不同。 |
| B4 | Tab1 横幅 | `:1493–1502`：`回执单号` / `订单总价` / `本单未收`（值色 `>0 ? text-warning : text-success`） | `FinanceDrawer.vue:8–12` | ⚠️ 偏离 | 新版「本单未收」用 `text-danger`（红），旧版是 `text-warning`（#e6a23c）与 `text-success`（#67c23a）二选一。 |
| B5 | Tab1 四张 summary-card | `:1509–1533`：`订单总价` / **`已分配`** / **`已调整`** / **`未收`** | `FinanceDrawer.vue:14–33`：`订单总价` / `已分配金额` / `订单调整金额` / `未收金额` | ⚠️ 偏离 | 四张卡口径对，**标签文案不同**。数值色：旧版「未收」按 >0 用 `text-warning`，新版用 `text-danger`。 |
| B6 | Tab1 `el-alert` 说明条 | `:1577–1582` `el-alert type:"info" show-icon title="本次收款将分配到订单【X】。可选“使用预付款抵扣优惠”；正数=收款；负数=红冲（冲销之前的错误收款）"` | **无** | ❌ 未做 | Tab2/Tab3/预付款分配也各有 alert（`:1739`「以下收款作用于客户【X】所有订单…抹零请点击右侧按钮。」、`:1897`「对账单显示近365天/全部记录 · 客户【X】」、`:2169`「当前未分配余额：¥X」），新版**四条 alert 全无**。 |
| B7 | Tab1 收款/抹零按钮的终端门控 | `:1548–1556`：`录入本单收款`（切换 `f`）与 `新增抹零` 均 **仅 `defaultedStatus`（=Home 的 `Yt`）时渲染** | `FinanceDrawer.vue:74–78` 无条件 | ⚠️ 偏离 | 新版 `FinanceDrawer` `props` 只有 `show/order`（`:345–348`），**没有 `defaultedStatus` 只读态**。终端账号在新版会看到不该有的写操作按钮。 |
| B8 | Tab1 收款分配记录表 | `:1559` `el-table class:"finance-table" empty-text:"暂无分配记录"`；列 `日期/方式/分配金额/备注`（`:1562–1572`） | `FinanceDrawer.vue:36–42, 781–792` | ⚠️ 偏离 | 列集不同：旧版「日期/方式/分配金额/备注」，新版「类型/日期/金额/备注」。空态文案：旧版 `暂无分配记录`，新版走 naive 默认「暂无数据」。 |
| B9 | Tab1 分配金额的红冲展示 | `:1566–1571`：`分配金额<0 ? text-danger : text-success`，渲染 `"¥"+值` | `FinanceDrawer.vue:784–790`：`<0 ? '#f56c6c' : '#000'` | ⚠️ 偏离 | 负数红 ✅，**非负数旧版是 `text-success`(#67c23a)，新版是黑**。 |
| B10 | Tab1 订单调整记录表 | `:1666–1682` `empty-text:"暂无调整记录"`，列 `日期/类型/减免金额/备注`；减免金额恒用 `Fl`=text-warning 且**带前导负号**显示 `"-¥"+调整金额` | `FinanceDrawer.vue:82–88, 781–792` | ⚠️ 偏离 | 新版复用同一 `recordColumns`（列为「类型/日期/金额/备注」），调整金额用 `text-warning` ✅ 但**没有前导 `-`**。 |
| B11 | Tab1 无数据态 | `:1683–1685` `el-empty description:"暂无财务数据（后端接口待接入）" image-size:80` | `FinanceDrawer.vue:90` `<n-empty description="加载中或暂无数据" />` | ⚠️ 偏离 | 文案不同（旧版那句「后端接口待接入」是旧版自身的占位话术）。 |
| B12 | Tab2 紫渐变余额卡 | `:1700–1735`：卡内 4 格（含 `未分配余额`，值色 `>0 ? #ffa500 : #90ee90`）；CSS `.cust-balance-card` 紫渐变 | `FinanceDrawer.vue:96–101` | ⚠️ 偏离 | 字段 ✅（订单总额/已实收/客户余额/未分配余额），但新版**未复刻「未分配余额 >0 橙 / ≤0 绿」的条件配色**，渐变取值也不同（`#6a11cb→#2575fc` vs 旧版 `#667eea→#764ba2`，见 `docs/...-home-analysis.md` §11.1）。 |
| B13 | Tab2「分配预付款」按钮 | `:1734–1739`：**`未分配余额>0 && defaultedStatus`** 才渲染；handler 开 `h`（预付款分配弹窗） | `FinanceDrawer.vue:143`「预付款分配」按钮**无条件** | ⚠️ 偏离 | 新版既不判余额 >0，也不判只读态。「客户抹零」(`:1748`) 与「录入预付款」(`:1752`) 同理受 `defaultedStatus` 门控，新版均无。 |
| B14 | Tab3 工具条 | `:1884–1907`：`defaultedStatus` 时的抹零按钮 + `刷新对账单` + `仅看近365天 / 查看全部历史` 切换 + `刷新图表`；`monthly/yearly` radio (`:1910–1919`) | `FinanceDrawer.vue:158–172` 只有手写 CSS 柱状图 | ⚠️ 偏离 | 新版**无「刷新对账单」「刷新图表」「365天/全部历史」切换、无「月度/年度」切换**。旧版是 echarts 双系列柱图（收款/红冲），新版是 CSS 条。 |
| B15 | Tab3 对账明细表 | `:1936–1958` 列 `日期/类型/单据号-地址/金额/备注`；类型 tag 色映射 `pe()` @ `:1470–1476` = `{订单:"", 收款:success, 订单抹零:warning, 客户抹零:info, 红冲单:danger}`；金额 `金额<0 ? text-success` 且 `<0 → "-￥"+abs`、`>=0 → "￥"+值`；单据号列**仅当 `类型==="订单"`** 才追加安装地址 | `FinanceDrawer.vue:824–852`，`KIND_TAG_TYPE` @ `:817–822` | ⚠️ 偏离 | ① tag 色映射 ✅ 一致（新版缺 `订单` 键，但新版也不显示该类型）。② 金额展示 ✅ 一致。③ **单据号/地址**：旧版有条件（仅「订单」行），新版一律 `receipt_no · install_address`。④ 空态 `暂无数据` ✅（naive 默认）。 |
| B16 | Tab3 明细筛选 | `m` computed @ `:981–984`：关键词匹配 `单据号/日期/安装地址/备注`，且**先剔除 `类型==="订单"` 的行** | `FinanceDrawer.vue:764–776` | ⚠️ 偏离 | 新版是「类型下拉 + 关键词」双控件（旧版只有关键词输入 + 类型 tag 列），且**没有「剔除订单流水」这条规则**。 |
| B17 | 四个弹窗：标题 / 宽度 / API | `:1964` `订单抹零 / 冲销` 380px `finance_addOrderAdjustment`；`:2023` `客户抹零 / 冲销` 380px `finance_addCustomerAdjustment`；`:2080` `录入预付款` 400px `finance_addPayment`；`:2156` `预付款分配` 560px `preview→execute` | `FinanceDrawer.vue:203, 224, 245, 273` | ✅ 已做 | 四个标题、四个宽度**逐字一致**。均 `append-to-body` ✅（naive n-modal 默认 teleport）。 |
| B18 | 调整类型选项 | 订单抹零 `:2003–2013` = `抹零/优惠/补贴/冲销/其他`；客户抹零 `:2062–2070` = `月度抹零/优惠/冲销/其他` | `FinanceDrawer.vue:569–570` | ✅ 已做 | 两组选项完全一致。 |
| B19 | 收款方式：默认 5 项 | `:994` `N=["微信","支付宝","现金","转账","其他"]` | `FinanceDrawer.vue:387` | ✅ 已做 | 一致。 |
| B20 | 收款方式：自定义（输入即新增 + 20 字截断） | `:1002–1015` `A(kind, value)`：`el-select allow-create` 新增，`String.trim()` 后截断到 20 并 `ElMessage.warning("收款方式最多"+20+"个字符，已自动截断")`，非默认值 push 进 `E` 并写 localStorage | **无** | ❌ 未做 | 新版 `n-select` 无 `allow-create`（`FinanceDrawer.vue:54,112,254`），`customMethods` **只读不写**（`:391–407` 只 `localStorage.getItem`，全文无 `setItem`）。 |
| B21 | 收款方式：右键删除 | `:1021–1029` `k(e)`：非默认项 → `ElMessageBox.confirm("确定删除自定义收款方式“X”？","删除确认",{confirmButtonText:"删除",type:"warning"})` → 从 `E` 剔除 + 写回 + 若当前选中值恰被删则回退 `N[0]`（"微信"）；绑定 `:1631/:1639, :1779/:1787, :2134/:2142` `@contextmenu.prevent` | **无** | ❌ 未做 | 新版无删除入口。localStorage key `finance_payment_methods` ✅ 一致（旧版 `:960` `Yo="finance_payment_methods"`）。 |
| B22 | §5.4 **本单收款**校验（`ie` @ `:1213–1260`） | ① `null/0` → warning「收款金额不能为零」`:1218`；② 启用预付优惠且 `n<0` → error「启用预付优惠时不支持负数红冲」`:1221`；③ `抵扣<=0` → error「当前没有可用预付款用于优惠抵扣」`:1223`；④ `n+抵扣>未收+0.005` → error「收款金额+优惠抵扣（X）不能超过本单未收（Y）」`:1224`；⑤ `n>0 && n>未收+0.005` → error「收款金额（X）不能大于未收金额（Y）」`:1226`；⑥ `n<0 && \|n\|>已分配+0.005` → error「红冲金额绝对值（X）不能超过本单已分配金额（Y）」`:1227`；⑦ `n>客户余额+0.005` → error「收款金额（X）超过客户余额（Y），客户余额可能已被客户级抹零覆盖」`:1229`（并 `else` 短路，即**阻断**）；⑧ 提交前 `await 表单.validate()`（规则 `O` @ `:1040–1055`：收款金额 required+「金额不能为零」、收款日期 required「请选择收款日期」、收款方式 required「请选择收款方式」） | `FinanceDrawer.vue:462–492` | ❌ 未做 | **新版只实现了第 ①、②（部分）**：只有「收款金额不能为零」（`:465–468`）。**②③④⑤⑥⑦ 六条与表单 validate 全部缺失**。②「启用预付优惠时不支持负数红冲」具体缺。新版对 `usePrepay` 只做 `prepayDiscount` 展示（`:454–460`），提交时不做任何上限校验。 |
| B23 | 预付优惠抵扣公式 | `G` computed @ `:1056–1063`：`u = Math.round(未收 × 比例/100 × 100)/100`（**先 round2**），再 `Math.round(100 × Math.min(u, 未分配余额))/100`；另有 `j()` 自动回填 `收款金额 = max(0, 未收 - G)`（`:1064–1071`），在开关/输入时触发（`:1072–1077`） | `FinanceDrawer.vue:454–460` | ⚠️ 偏离 | ① 新版公式 `Math.round(100*Math.min(unpaid*rate, pool))/100` **缺中间那次 round2**，浮点尾部可能差 0.01。② 旧版**会自动把收款金额回填成 `未收-抵扣`**，新版只是显示「预计抵扣 ¥X」，不回填。 |
| B24 | §5.4 **客户收款**校验（预览 `se` @ `:1261–1277`） | ① `null/0` → warning「收款金额不能为零」`:1262`；② `n<0 && \|n\|>实收+0.005` → error「红冲金额绝对值（X）不能超过实收金额（Y）」`:1264`（`else if`，阻断）；③ `n>0 && n>客户余额+0.005` → warning「收款金额（X）超过客户余额（Y），将产生预付款，请确认」`:1265`（**非阻断**，继续预览）；④ 预览成功写 `分配列表` + `剩余未分配` | `FinanceDrawer.vue:505–523` | ❌ 未做 | 新版只有 ①（`:508–511`）。**②③ 缺**。 |
| B25 | §5.4 **提交收款**（`de` @ `:1312–1343`） | 先 `await 表单.validate()`（规则 `_` @ `:1078–1093`，同 B22 ⑧）→ POST `finance_addPayment`（body 带 `分配列表: w.value`，**可以为空数组**） | `FinanceDrawer.vue:525–564` | ⚠️ 偏离 | 新版**加了一道旧版没有的**门槛：`if(!allocationPreview) { message.warning('请先预览分配'); return }`（`:532–535`）。旧版不要求先预览，直接提交当前 `w`（未预览就是空分配）。属于「更严格」的偏离。旧版成功提示「收款录入成功」，新版「收款成功」。 |
| B26 | §5.4 **订单抹零**（`Ve` @ `:1327–1350`） | ① `null/0` → warning「请输入调整金额（正数=减免，负数=冲销）」`:1320`；② `n>0 && n>未收+0.005` → error「抹零金额（X）不能超过订单未收金额（Y）」`:1321`；③ `n>0 && n>客户余额+0.005` → error「抹零金额（X）超过客户当前余额（Y），请检查是否已有客户级抹零」`:1323`；④ `n<0 && \|n\|>订单调整金额+0.005` → error「冲销金额绝对值（X）不能超过已有订单调整合计（Y）」`:1327` | `FinanceDrawer.vue:582–603` | ❌ 未做 | 新版 `if (amount == null) return`（`:584`）—— **空值直接静默返回，连提示都没有**；②③④ 全缺。旧版成功提示「订单抹零成功」，新版「已保存」。 |
| B27 | §5.4 **客户抹零**（`me` @ `:1349–1372`） | ① `null/0` → warning「请输入调整金额（正数=减免，负数=冲销）」；② `n>0 && n>客户余额+0.005` → error「抹零金额（X）不能超过客户余额（Y）」`:1356`；③ `n<0 && \|n\|>客户调整合计+0.005` → error「冲销金额绝对值（X）不能超过客户调整合计（Y）」`:1360` | `FinanceDrawer.vue:616–636` | ❌ 未做 | 同 B26：新版空值静默返回，②③全缺。旧版成功提示「月度抹零成功」。 |
| B28 | §5.4 **录入预付款**（`ge` @ `:1382–1406`） | ① 金额空/`<=0` → warning `冲销模式 ? "请输入冲销金额" : "请输入预付款金额"`；② 日期空 → warning「请选择收款日期」`:1389`；③ `冲销模式 && 金额 > 未分配余额+0.005` → error「冲销金额不能大于当前未分配余额（X）」`:1390`；④ 金额取 `Math.abs`，冲销取负；⑤ 备注前缀 `"预付款: "`/`"预付款冲销: "`（**冒号后带一个空格**） | `FinanceDrawer.vue:655–688` | ⚠️ 偏离 | 新版只有 ①（文案改成「收款金额需大于 0」）。②③ 缺；⑤ 新版前缀是 `预付款:`/`预付款冲销:`（**冒号后无空格**），且**只在有备注时加前缀**，旧版无备注时也写「预付款」/「预付款冲销」。 |
| B29 | §5.4 **预付款分配** | 预览 `fe` @ `:1419–1436`：金额空/`<=0` → warning「请输入分配金额」`else if(...)` 即阻断；优惠比例 = `启用优惠 ? 比例/100 : 0`；成功写 `分配列表/合计分配金额/合计优惠金额/资金池剩余`。执行 `he` @ `:1438–1455`：`if(|分配列表|!==0){...} else warning("请先预览分配方案")`；备注 = `启用优惠 ? "优惠"+比例+"%" : ""`。弹窗默认值 `ye()` @ `:1408–1417`：`分配金额=未分配余额`、`启用优惠=false`、`优惠比例=2` | `FinanceDrawer.vue:697–742` | ⚠️ 偏离 | ① 预览空值提示：旧版「请输入分配金额」→ 新版「分配金额需大于 0」。② **旧版是「启用优惠」开关 + 比例**（默认关、比例 2），新版是**常显的比例输入（默认 10）**，没有开关。③ 旧版执行按钮的守卫是「列表非空」，新版是「`prepayAllocatePreview` 非空」+ `:disabled`（`:304`）—— 等效。④ 旧版备注在未启用优惠时为空串，新版恒为 `优惠X%`（`:732`）。⑤ 旧版弹窗打开时**把分配金额预填为未分配余额**，新版是 `null`。⑥ 显示「资金池剩余」✅。 |
| B30 | §5.4 **清账**（Home 侧） | 见 A8 | `Home.vue:765–843` | ⚠️ 偏离 | 见 A8。 |
| B31 | 红冲/负数展示（Tab3 对账） | `:1950–1956`：`金额<0 → text-success(#67c23a)` 且显示 `-￥\|X\|`；`>=0` 显示 `￥X` | `FinanceDrawer.vue:841–850` | ✅ 已做 | 逐字一致。 |
| B32 | `defaultedStatus` 只读态整体 | `:965–969` props `defaultedStatus:{type:Boolean}`；Home 传 `defaultedStatus:Yt.value` @ `:12212`；6 处门控见 B7/B13/B14 | `FinanceDrawer.vue:345–348` 无此 prop | ❌ 未做 | 见 E1 的「未做范围」。 |
| B33 | `getOrderFinanceSummary` 调用时机 | Home `$o()` @ `:7878–7905`：拉 `getTableData`（或终端变体）→ 按 `parseInt(回执单号)` 降序 → **末尾 `Yt.value && Ht.value && await ea()`**；`ea(days=60, range=null)` @ `:7906–7928`：`GET finance_getOrderFinanceSummary&param2=ds&param3=60`（range 非空时追加 `&param4=start&param5=end`），把 `已分配金额/订单调整金额/未收金额` **合并进 `_l` 行**；「查询更多」确认时会以 `ea(60,{start,end})` **重拉带日期的版本**（`:11079`）；触发点还有 `Vue.onActivated(()=>$o())` @ `:7931`（keep-alive 复用） | `Home.vue:255–269`（`load()` 里 `api.getOrderFinanceSummary()`），`Home.vue:521–523`（`onFinanceSaved`→`load()`） | ⚠️ 偏离 | ① 调用时机 ✅（每次订单列表加载后一次、`days=60` 默认 ✅，见 `app/src/api/client.ts:216–217`）。② **旧版只在 `Yt && Ht`（工厂 + `localStorage.newFinanceSystem==="1"` 且门店名≠"开门红2"）时拉**，新版**无条件拉**（`Ht` 见 `Home.vue` 无对应概念；`grep newFinanceSystem app/ backend/` 无命中）。③ **旧版不带日期范围时不会重拉**，只有「查询更多」才带 `start/end`；新版没有查询更多这条路。④ 旧版 `onActivated` 复用时重拉，新版无 keep-alive（`grep keep-alive\|onActivated app/src/` 无命中）。 |

---

## C. §1.2 经营看板 DashboardBigScreen

旧版 `Home.formatted.js:156–960`（`__name:"DashboardBigScreen"`，解码表 `wl`），渲染函数 `:366–560`。

| # | 项 | 旧版依据 | 新版落点 | 判定 | 说明 |
|---|---|---|---|---|---|
| C1 | 容器 / 形态 | `:368` `el-dialog fullscreen:true show-close:false class:"big-screen-dialog"`；模板容器 `class:"big-screen-container"` @ `:72` | `DashboardBigScreen.vue:2, 349–359` | ⚠️ 偏离 | 旧版是 `el-dialog`（teleport 到 body、`z-index` 由 Element 管），新版是 `position:fixed;inset:0;z-index:3000` 的裸 div。观感等价，**关闭按钮位置**：旧版 `.close-btn` 在标题行内（`:391`），新版绝对定位右上角（`:380–392`）。 |
| C2 | 顶部装饰 | `dv-decoration-10` ×2（`:372/:380`）+ `dv-decoration-8`（`:390`，在标题左侧）+ `dv-decoration-5`（`:396`）+ 标题「经营数据驾驶舱」（`wl(547)`） | `DashboardBigScreen.vue:4–9`（两条 `linear-gradient` 线 + 26px 渐变字） | ⚠️ 偏离 | 旧版用 DataV 的 `dv-decoration-*`；§11.4 已说明「Naive 无对应，需自写 SVG/CSS」。新版**只自写了两条渐变线，`dv-decoration-8/5` 未复刻**（标题左侧还有个 `dv-decoration-8` 是另一处装饰）。 |
| C3 | 筛选：日期区间 | `:423–424` `el-radio-group` 6 项 `全部/今天/本周/本月/上月/90天`（值 `wl(610/537/566/599/508/613)`）；dayjs 计算 @ `:214–246`：今天 `startOf('day')`、本周 `startOf('week')`、本月 `startOf('month')`、上月 `subtract(1,'month').startOf/endOf('month')`、90天 `subtract(90,'day')`；过滤是**字符串比较** `t["日期"] >= d && t["日期"] <= m`（`:248–252`） | `DashboardBigScreen.vue:14–23, 179–200` | ✅ 已做 | 6 个区间 ✅，边界口径基本一致（新版「本周」手算周一，「上月」建 `Date(y,m-1,1)`，与 dayjs 等价）。 |
| C4 | 筛选：客户 / 业务员 | `:425–443` `el-select placeholder:"筛选客户"`（选项 = 去重客户）、`:444` `el-select placeholder:wl(585)="筛选业务员"`（选项 = 去重业务员）；两者 `clearable filterable` | `DashboardBigScreen.vue:24–31` | ✅ 已做 | 一致（新版用原生 `<select>`，无 `filterable`）。 |
| C5 | 数据来源 | `:12191` `<DashboardBigScreen modelValue=ks tableData=_l.value onCustomQuery=ms />` —— **`_l` 是 `getTableData` 的原样全量列表，未按角色过滤** | `Home.vue:188` `:orders="dashboardOrders"`；`dashboardOrders` @ `Home.vue:655–659` **按 `auth.user.role!=='admin'` 过滤成「只看自己打的单」** | ⚠️ 偏离 | 旧版看板看**全店**数据；新版非管理员只看自己的。 |
| C6 | 左列：业务员排行 / 客户排行 | `:434–458`：两块 `el-card` + `dv-scroll-ranking-board`（`A`），label 分别 `wl(637)="业务员排行"` / `wl(515)="客户排行"`；数据 `:262–288`：按 `总价` 求和、降序、**`slice(0,7)`**、`carousel:true`、`unit:"元"`，空业务员归入 `wl(627)` 桶 | `DashboardBigScreen.vue:37–63, 239–252` | ✅ 已做 | Top7 ✅、按总价 ✅、`未填` 兜底 ✅。观感差异：旧版是 DataV 滚动榜，新版是静态条（属 §11.4 已知的组件缺口）。 |
| C7 | 中列：5 张数字翻牌 | `:459–520` 五块 + label：`订单总数`(`wl(588)`)/`订门总数`(`wl(597)`)/`订单总金额`/`已付金额`(`wl(525)`)/`未付金额`(`wl(541)`)；config `:264–290`：`content` 前三个 `wl(568)`、后两个 `wl(522)="¥{nt}"`，`fontSize 36/36/32/32/32`，`fill #3de7c9 / #00d2ff / #409EFF(wl(514)) / #67C23A(wl(590)) / #F56C6C`；口径 `p` computed `:258–263`：`已付=Σ定金`、`未付=Σ总价-Σ定金` | `DashboardBigScreen.vue:67–88, 217–228` | ✅ 已做（数值口径）/ ⚠️（观感） | 五张卡、五个 label、五个色值、口径 **全部一致** ✅。字号旧版 36/32，新版统一 22px（`:536–540`）。旧版是 `dv-digital-flop` 翻牌动画，新版静态数字。 |
| C8 | 中列：每日订单趋势 | `:521–529` 标题 `wl(509)="每日订单趋势"` + `div.chart-container ref=trendChartRef`；echarts 折线 `:290` 起；数据 `b` computed `:305–320`：按 `日期` 聚合 **`count` 与 `amount`** 两个字段，按 date 升序 | `DashboardBigScreen.vue:90–101, 262–297` | ⚠️ 偏离 | 新版只聚合 `count`（笔数），旧版聚合 `count+amount`（双系列）；新版是手写 `<polyline>` SVG，旧版是 echarts。 |
| C9 | 中列：客户金额占比 | `:530–541` 标题 `wl(572)="客户金额占比"` + `div.chart-container ref=pieChartRef`；数据 `D` computed `:321–331`：按 `客户` 求和 → 降序 → **`slice(0,8)`** | `DashboardBigScreen.vue:103–116, 302–326` | ✅ 已做 | Top8 ✅、按总价 ✅、饼图 ✅（新版 `conic-gradient`，旧版 echarts）。 |
| C10 | 右列：流程状态 | `:542–556` 标题 `wl(505)="流程状态"`；两块数字：**先「未进入流程」**（`p.notInProcess`）**再「已进入流程」**（`p.inProcess`），均 `dv-digital-flop` 120×120 | `DashboardBigScreen.vue:121–133, 331–339` | ⚠️ 偏离 | 口径 ✅（`打单操作` 非空=已进入）。**左右顺序反了**：旧版「未进入」在左，新版「已进入」在左。 |
| C11 | 右列：最新订单 | `:557–562` 标题 `wl(626)="最新订单"` + `dv-scroll-board`（`T`）；config `L` @ `:289–297`：`header:["日期","客户","金额"]`、按 `日期` 降序、**`slice(0,10)`**、**`rowNum:5`**（可视 5 行滚动）、`headerBGC/oddRowBGC/evenRowBGC` 深蓝系 | `DashboardBigScreen.vue:135–147, 341–345` | ⚠️ 偏离 | Top10 ✅、按日期降序 ✅。**列集/顺序不同**：旧版 `日期/客户/金额`，新版 `序号/客户/日期/金额`；旧版有表头行与 `rowNum:5` 滚动视口，新版是纯 `overflow-y:auto` 列表、无表头。 |
| C12 | `customQuery` 事件 | `:161` `emits:["update:modelValue","customQuery"]`；Home `:12191` 绑 `onCustomQuery:ms` | — | ❌ 未做（**死代码**） | `grep customQuery` 在 DashboardBigScreen 全组件仅出现在 `emits` 声明里，**从未 `emit`** —— 旧版自己就是死代码。新版不复刻属**正确**，但记录在案。 |

---

## D. §6.4 通知公告 `syncNoticeBoard`

| # | 项 | 旧版依据 | 新版落点 | 判定 | 说明 |
|---|---|---|---|---|---|
| D1 | 调用位置 | **`index-c3b16e3f.js@82300–82380`**（单行文件，字节偏移），在**全局 `router.beforeEach`** 里，**不在 Home 内** | — | ❌ 未做 | 新版 `app/src/router/index.ts:29–38` 的 `beforeEach` 只做 `requiresAuth` 跳转，无通知拉取。 |
| D2 | 触发时机 | 守卫的 `else` 分支（**已登录且 `to.path !== '/login'`**）里，顺序为：`await A()` 取 userinfo → `if(await on(t,n)) return`（开门红/试用期/7天过期守卫）→ 处理回执单深链 → **然后才跑 syncNoticeBoard** → `n()` 放行。**例外**：当 `to.name==='ReceiptView'` 且 `params.receiptNo` 与 pending 相同，走 `void n()` 直接返回，**会跳过通知**（`index@82100–82105`）。登录跳转分支（`to.path==='/login'` 且已登录）里也会跑一次（`index@81970`） | — | ❌ 未做 | 即：**几乎每次已登录的路由跳转都会 GET 一次通知接口**。 |
| D3 | 请求 | `GET https://www.samrtdoor.com.cn/1?param1=syncNoticeBoard&param2={userinfo.registrant}`（`method:"get"`） | — | ❌ 未做 | `grep syncNoticeBoard app/ backend/` 无命中。 |
| D4 | 行为 | `code===200` 且 `message!=="none"` 时：`ElMessageBox.alert( message.replace(/\n/g,"<br>"), "通知:", { dangerouslyUseHTMLString:true, confirmButtonText:"我知道了", callback:()=>{ window.location.reload(); Xe() } } )`；**同一次**对正文跑 `/(https?:\/\/[^\s]+)/g`，命中的链接逐个 `window.open(e,"_blank")` | — | ❌ 未做 | 注意两点：① `dangerouslyUseHTMLString:true` —— 服务端下发的正文按 HTML 渲染（**XSS 面**，复刻时需评估）；② 链接是 `alert()` 之后立刻 `forEach` 打开的，不是点按钮才开。异常时 `ElMessage.error("更新信息获取失败")`。 |

---

## E. 两个态标志 `Yt`（工厂/终端）与 `z`（手机端）

### E1. `Yt` —— 工厂 / 终端

| 项 | 依据 | 说明 |
|---|---|---|
| 定义 | `:7580` `Yt=Vue.ref(!0)`（**默认 true = 工厂**） | 常量初值 |
| 唯一置位点 | `:8145–8147`（`onBeforeMount`）：`const o = userinfo.defaulted; ... 3==o && (Yt.value=!1, Gt.value=userinfo.name.split("-")[0], jt.value=Number(userinfo.name.split("-")[1]))` | **`userinfo.defaulted===3` ⇒ 终端用户 ⇒ `Yt=false`**；同时把门店名按 `-` 拆成「终端号前缀 + 序号」 |
| ❓ 未确认 | 新版后端 `AuthResponse` 无 `userinfo.defaulted`（见 `docs/...-home-analysis.md` §10）；新版也没有「终端账号」概念 —— 所以**新版永远处于 `Yt` 语义下**。 |

**`Yt` 影响到的 UI（这就是「未做」的准确范围）** —— 逐条列全：

| 序 | 影响点 | 旧版依据 | 新版对应 | 判定 |
|---|---|---|---|---|
| Y1 | **数据源**：终端走 `getTableDataForTerminal&param2={ds}_{终端号}`，工厂走 `getTableData` | `:7882–7893` | 新版只有 `api.listOrders()`（无终端变体） | ❌ |
| Y2 | **顶栏主按钮文案**：`Yt ? "打印选中订单" : "查看回执单"`（handler 同一个 `Gi`） | `:11253–11261` | `Home.vue:14–20` 只有「打印选中订单」 | ⚠️ |
| Y3 | **列显隐（6 组）**：`安装地址`/`打单操作` 列 **仅 `!Yt`**（`:11437/:11445`）；`单号集`/`客户`/`已付`/`订单备注`/`安装地址`/`打单操作`/`业务员`/`打单人` 列 **仅 `Yt`**（`:11364/:11399/:11468/:11516/:11524/:11532/:11583/:11591`） | 同上 | 新版只做工厂视图（`Home.vue:1019–1117`），符合 `Yt=true` 分支 | ✅（工厂分支） |
| Y4 | **财务列（`Yt && Ht`）**：56px 圆形 `¥` 按钮 | `:11351–11363` | 新版把「财务」做进操作列（`Home.vue:1033`），**且不受 `Ht` 门控** | ⚠️ |
| Y5 | **财务摘要拉取**：仅 `Yt && Ht` | `:7904` | 新版无条件（见 B33） | ⚠️ |
| Y6 | **内联编辑限制**：`!Yt && 打单操作!=="自助下单"` → `ElMessage.error("已确认的单只能工厂修改！")` | `:11325` | **无** | ❌ |
| Y7 | **删除分支**：`打单操作==="自助下单" \|\| Yt` 才删，否则 `"已确认的单只能工厂删除！"` | `:9231, :9306` | **无**（任何单都能删） | ❌ |
| Y8 | **删除后刷新**：`await Ca(); Ht && await ea()` | `:9300` | 新版统一 `load()` | ⚠️ |
| Y9 | **查询更多弹窗的「客户」字段**：仅 `Yt` 渲染（终端用手填 `id` 反查） | `:12135–12146`；`ys` 里 `!Yt` 时用 `nl.find(t=>t.id===jt.value)` 回填客户名 | 新版无此弹窗（见 A6） | ❌ |
| Y10 | **打印抽屉的两颗回执单动作**：`直接打印回执单`/`手动打印回执单` 仅 `Yt`（`:11876–11897`） | 同上 | `PrintDrawer.vue:46–59` 只有「查看回执单」「回执单-其它」 | ❌ |
| Y11 | **FinanceDrawer 只读态**：`defaultedStatus: Yt` → 6 处写操作门控（B7/B13/B14/B32） | `:12212`；`:1548/:1552/:1577/:1734/:1748/:1884` | 新版无 prop、无门控 | ❌ |
| Y12 | **抽屉尺寸以外**：`Wt=userinfo.registrant` 门控「君豪汇总订单」 | `:8145, :11949` | 无 | ❌（见 A14） |

### E2. `z` —— 手机端

| 项 | 依据 | 说明 |
|---|---|---|
| 定义 | `:7571–7577`：`onMounted(() => { const t=/iPad\|iPhone\|iPod/.test(navigator.xxx); z.value = v.isMobile() \|\| t })`（`v` 从 `vue-ade658be.js` 导入） | UA + `isMobile()` |

**`z` 影响到的 UI**：

| 序 | 影响点 | 旧版依据 | 新版对应 | 判定 |
|---|---|---|---|---|
| Z1 | 打印预览弹窗：`z.value ? 无 : 按钮`（`:11629`，一颗仅桌面可见） | `:11629` | 无对应判断 | ❌ |
| Z2 | 「复制成图片 / 微信分享(手机)」二选一（`:11783/11787`） | 同上 | 新版 `ReceiptOtherDialog` 未做此二选一 | ❓ 待 receipt 维度确认 |
| Z3 | 「复制玻璃单 / 微信分享(手机)」二选一（`:11799/11803`） | 同上 | 同上 | ❓ |
| Z4 | 「导出玻璃订单」按钮 `lo && !z`（仅桌面）（`:11811`） | 同上 | 无此按钮 | ❌ |
| Z5 | 打印抽屉：`直接打印回执单/手动打印回执单` `z.value ? 无 : 按钮`（`:11884`） | `:11884` | 无 | ❌ |
| Z6 | CSS：`.home-container{margin-top:18px}` @ 768px | `Home-97d96482.css` | 新版无 `@media` 断点（`Home.vue:1122–1289`） | ❌ |
| Z7 | FinanceDrawer 宽度 `window<=768 ? "100%" : "520px"` | `:967–970` | `FinanceDrawer.vue:361` **✅ 已做** | ✅ |

---

## F. 页面级杂项

| # | 项 | 旧版依据 | 新版落点 | 判定 | 说明 |
|---|---|---|---|---|---|
| F1 | 页面标题 / 面包屑 | 全库 `grep 订单管理` **零命中**（含 `index-c3b16e3f.js`、`Home-*.js`、`index.html`）；Home 根容器无标题节点 | `Home.vue` 无标题 | ✅ 已做（**两边都没有**） | 旧版 Home **没有**「订单管理」标题/面包屑，只有搜索框 + 汇总条。新版一致。 |
| F2 | 汇总信息条 | `:11252`（有搜索词）` 当前筛选: {Rc} (N 条结果) \| 时间: {earliest} 至 {latest} \| 门数: {ls} \| 总价: {os} \| 已付: {as} \| 未付: {ns} \| 未付单数: {us} \| 未审核: {rs}`；`:11252` 后半（**无搜索词且有数据**）` 总计: N 条记录 \| 时间: …` 同款 | `Home.vue:46–52` | ⚠️ 偏离 | ① 新版**只有「有搜索词」这一支**，**缺「无搜索词时显示总计」那一支**。② 新版**漏了「已付」字段**（旧版 `as`），且数值用 `fmt()` 保留 2 位小数，旧版用 `.toFixed(0)`（`:11252` `os.value.toFixed(0)`）。③ 旧版两处 `未付单数`/`未审核` 各带自己的颜色 span（`class ru/iu/su/du/Vu`），新版无。 |
| F3 | 空态 | 主表 `el-table` **未设 `empty-text`**（`:11300` 的 props 里没有）→ 用 Element 默认「暂无数据」；CSS 里有 `.no-data{padding:20px;margin-top:10px;text-align:left;color:#909399}` 但**渲染函数中零引用** | `n-data-table` 默认「暂无数据」 | ✅ 已做 | 两边都是组件默认空态。`.no-data` 是**死样式**（记录在案）。 |
| F4 | loading 态 | 主表 **无 `v-loading`**（`:11297–11300` 的 `el-table` props 里没有 `Vue.withDirectives(...,[[P]])`）；`Tn` flag（`:7580`–`:9358`）**只被赋值、从未在渲染中读取** → 死标志 | `Home.vue:62` `:loading="loading"` | ⚠️ 偏离 | **旧版没有任何 loading 指示**（点进去就是空白直到数据来），新版有。属改进式偏离。 |
| F5 | 错误提示 | 各处 `ElMessage.error(...)`：无用户信息 `"无法获取用户数据"`、拉表失败 `s(1214)`、查询失败 `s(722)` 等 | `Home.vue:265` / `:557` / `:758` 等 `message.error(...)` | ✅ 已做 | 机制一致（Element `ElMessage` → naive `useMessage`）。 |
| F6 | **右键菜单** | **Home 全组件无 `contextmenu`**：`grep contextmenu` 的命中全在 FinanceDrawer（`:844/:872/:922` 是 `withModifiers` 的修饰符数组常量，`:1639/:1787/:2142` 是收款方式右键删除，见 B21） | `Home.vue` 无 | ✅ 已做（**两边都没有**） | Home 主页面无右键菜单；唯一的右键交互在财务抽屉的收款方式下拉里。 |
| F7 | **悬浮跟手 tooltip**（单元格级） | `sa/da/Va` @ `:7966–7983` + 渲染 `:11601–11606`：`el-table` 的 `onCellMouseEnter/MouseLeave` + 容器 `onMousemove`，当鼠标进入 **`客户` 或 `打单操作`** 列时，`Teleport to body` 出一个 `position:fixed;left:X;top:Y;transform:translateX(12px) translateY(calc(-100% - 8px))` 的白底 div，`innerHTML` = 五行进度徽章（`<span style="color:…">✓/○</span>&nbsp;{label}`）+ 已付清时追加 `s(988)` | `Home.vue:946`（每个进度段挂原生 `title` 属性） | ❌ 未做 | 旧版是**自绘的跟手浮层**（显示完整的 5 步 + 自定义步骤的 ✓/○），新版退化成**逐段的浏览器原生 tooltip**；且**「客户」列完全没有**这个浮层。 |
| F8 | 页面容器样式 | `Home-97d96482.css`：`.home-container{margin-top:65px;padding:10px;height:calc(100vh - 70px);box-sizing:border-box;overflow-y:hidden;position:relative;width:100%}`；768px → `margin-top:18px`；`.table-container{height:calc(100vh - 10px);overflow:hidden;margin-bottom:100px}`；`body,html{overflow:hidden;margin:0;padding:0;height:100%}` | `Home.vue:1123–1167`：`padding:10px;height:100vh;display:flex;flex-direction:column;background:#f5f7fa`；`tableHeight='calc(100vh - 300px)'` @ `Home.vue:1119` | ⚠️ 偏离 | **缺 `margin-top:65px`**（旧版是用来给固定顶栏让位的；新版无顶栏故无所谓，但 `margin-top:18px` 的移动端断点也一并没有）。高度算法不同（旧版 `calc(100vh-70px)` + 表格自身 `calc(105vh-280px)`；新版 flex + `calc(100vh-300px)`）。新增了 `background:#f5f7fa`（旧版是 body 底色）。 |
| F9 | 行状态色 | `.date-audit{background:#ffb6c1;color:#721c24;padding:4px 8px;border-radius:4px;font-weight:700}`、`.date-warning{background:#fff3cd;color:#856404;…}`、`.date-danger{background:#f8d7da;…}`、`.paid-customer{background:#90ee90;…}`、`.loaded-row{#dbdbd8}`、`.duplicate-order-row{#ffe4ec/`#ffd6e4}`（CSS 文件） | `Home.vue:399–404, 1283–1288` | ⚠️ 偏离 | 新版只做了 `date-audit`/`date-warning`（用 `td` 背景覆盖，`!important`），**缺 `.paid-customer` / `.loaded-row` / `.duplicate-order-row` / `.date-danger`**（新版注释自认 `:386`）。另旧版这些类还带 `color` 与 `padding/border-radius`，新版只设了 `background`。 |
| F10 | 按钮配色 | `.custom-search-btn/.custom-delete-btn/.custom-refresh-btn{background:#7caaf3}` hover `#0965fa`；`.custom-print-btn{#4a89ee}`；`.danger-print-btn{#f56c6c}`；`.custom-combine-btn{#67c23a}`；`.custom-unproduced-active-btn{#f56c6c}`（CSS 文件） | `Home.vue:16/27/28` 用 naive 的 `warning`/`error`/`success`/`default` | ⚠️ 偏离 | 旧版是「统一 #7caaf3 蓝底」的成套自定义色，新版换成 naive 语义色。`type="error"`（红）出现在「删除选中数据」上，旧版那颗是**蓝**的 #7caaf3。 |
| F11 | 搜索框 | `:11248–11251` `el-input placeholder:"搜索客户、安装地址等" clearable` + 前缀放大镜图标；CSS `.search-input{width:220px}` @ `:11256`（`.search-section` 内还有 `gap:40px`） | `Home.vue:38–45` placeholder ✅、`clearable` ✅、`🔍` 前缀 ✅；CSS `.search-input{width:320px}` @ `Home.vue:1155` | ⚠️ 偏离 | 仅宽度不同（220 → 320）。搜索字段集一致（`Home.vue:321–331` vs `:11252` 的 computed） ✅。 |
| F12 | 分页 | `:11608–11611` `el-pagination layout:"total,sizes,prev, pager, next"`、`page-sizes Xl=[10,20,50,100,200]`（`s(531)` 处 doc 已记）；默认 `Zl=50` | `Home.vue:77–84` `:page-sizes="[10,20,50,100,200]"`、默认 `pageSize=50`（`:375`） | ⚠️ 偏离 | 页大小档位与默认值 ✅。**layout 多了 `quick-jumper`**（旧版没有）；旧版总条数是 `zs`（**另算**，`:1` `_l` 过滤后 total），新版 `:item-count="filtered.length"` ✅ 等效。 |
| F13 | 表格高度 | `:11300` `height:"calc(105vh - 280px)"`（硬编码在 el-table 上） | `Home.vue:1119` `calc(100vh - 300px)` | ⚠️ 偏离 | 数值与参照系都不同（105vh vs 100vh）。 |
| F14 | 表格 `filter-method` / 列头 `filters` | `:11300` `"filter-method":ga`；各列 `filters` @ `:11437/11445/11468/11516/11524/11532/11583/11591` | `Home.vue:1019–1117` 无 `filters`/`filter-method` | ❌ 未做 | 属表格维度（audit-table 负责），此处只做交叉记录。 |
| F15 | 隐藏容器 `div#9527` | `:11612–11614` `Vue.createElementVNode("div",{id:"9527"},null,-1)`（hiprint 打印容器） | 新版 hiprint 走 `PrintPreviewDialog`，无此容器 | ❓ 未确认 | hiprint 相关的载体，属打印维度。 |

---

## G. 与「终端只读页」`/terminal-orders` 的交叉

| # | 项 | 旧版依据 | 新版落点 | 判定 | 说明 |
|---|---|---|---|---|---|
| G1 | **Home 上有没有指向 `/terminal-orders` 的入口** | **没有**。在 `Home` 组件范围（`:7569–12282`）内 `grep -i "terminal\|qrcode\|二维码\|扫码"` 的命中只有：`:7885`（终端**数据源** `getTableDataForTerminal`）、`:9386/:9389`（打印时拉的**收款二维码**图片 `getimage&param2=qrcode`）、`:9865`（收据单2 的 qrcode 占位）、`:10747`。**无 `orderQrcode`、无任何跳 `/terminal-orders` 的链接** | 无 | ✅ 已做（**两边都没有**） | 结论明确：**Home 页不产出、也不指向终端只读页**。 |
| G2 | `/terminal-orders` 的真实入口 | ① 壳路由守卫：`userinfo.defaulted===3` 时登录后跳 `/terminal-orders`（或 receipt 深链），`index@81951`；② `ReceiptView` 的 ✕（新版注释已记，`app/src/views/ReceiptView.vue:4, 85`） | 新版无 `/terminal-orders` 路由（`app/src/router/index.ts:12–24`）；`app/src/views/Clients.vue:254–260` 有一条指向 `/terminal-orders` 的**外链**（注释自认「路由为占位，后续对接 TerminalOrders」） | ❌ 未做 | 属壳/终端页维度的缺口；**与 Home 无直接关系**。 |
| G3 | 二维码产出 | Home 打印链路里拉的 `getimage&param2=qrcode`（收款二维码，`:9383–9395`，缓存到 `M("qrcode","qrcode",blob)`）；`docs/...-home-analysis.md` §12.4 已确认「全库 type 仅 `qrcode` 一种」 | 新版未见对应实现 | ❓ 未确认 | 属打印维度（`ps-*` / `receipt-*` agent 的 lane），此处仅记录交叉点。 |

---

## H. 死代码 / 点了没反应的清单（本次审计新发现，补充 §12）

| # | 项 | 依据 | 说明 |
|---|---|---|---|
| H1 | `Tn`（打印 loading） | `:7580` 定义；`:9358` 置 true、`:9782` 置 false；**渲染中零读取** | 死标志。旧版主表因此**没有任何 loading 态**。 |
| H2 | `E`（隐藏表容器） | `:7580` `let E=Vue.ref(!1)`；只在 `:8012/:8592/:8612/:8664/:8706` 被**赋 `false`**，**从未置 true**；渲染 `:11295` `Vue.unref(E) ? 注释 : 表容器` | 死标志 ⇒ 表容器**恒显示**。 |
| H3 | `Tt` | `:7580` `Vue.ref(s(760)="false")`；`:8149` 写入；**零读取** | 与 §12.5 一致。 |
| H4 | DashboardBigScreen `customQuery` | `:161` 声明在 `emits`，**从未 emit** | 死事件。 |
| H5 | `.no-data` 样式 | `Home-97d96482.css`；渲染零引用 | 死样式。 |
| H6 | 工具栏「视频」按钮 | 见 A12 | **不是死按钮**（点了会开「视频教程」抽屉），但容易误判；新版完全没做。 |
| H7 | `Lt`/`Ls` 之类 | `Ls` @ `:11221` 返回 `""` 或 `"date-warning"`；`.date-danger` 无引用 | 与 §12.5 部分重合，`.date-danger` 确认**死样式**。 |

---

## I. 我没能确认的（明确标 ❓，不猜）

| # | 项 | 为什么没确认 |
|---|---|---|
| I1 | `Jt`（经营看板可见性）的**业务语义** | 字面条件是 `userinfo.registrant === userinfo.name \|\| userinfo.name === "开门红"`（`:8147`）。为什么「registrant 等于门店名」才算，我没有找到旁证。只给字面表达式。 |
| I2 | ~~「导出 Excel（生产单）」的实现体~~ | **已解决** —— 见 A13，`tc` @ `:9916–10047` 已逐行读完。 |
| I5 | `uc`（可导出的生产单行）是怎么被填充的完整链路 | 只确认到「由行内 `In`/`calculateReceipt` 逐行填充」（`:10051` `dc` 也读 `uc`）。跨到打印/明细计算的 lane。 |
| I3 | 旧版「生产单定制(竖版)」「料标签」「平开门生产单」「移门生产单」「订单汇总」等打印抽屉入口在新版的对应 | 属打印 agent 的 lane；本报告只记录 A13/A14 这两颗点名项缺失。 |
| I4 | 旧版 Home 是否在别处（非 Home 组件范围）渲染了指向终端的入口 | 我扫的是 Home 组件的行区间 + 壳的字节偏移；`Qrscanner-195163c4.js` / `TerminalOrders-43b60190.js` 两个 chunk 未读。 |
