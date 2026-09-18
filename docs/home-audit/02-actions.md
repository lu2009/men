# 审计 02 · Home 行操作（全部）

> **旧版证据**：`legacy/js/Home-d6b13b9a.js`（单行，字符偏移）。Home 组件 = `327885`（`yr=Vue.defineComponent({name:"Home"…`）～`519303`（文件末）。
> 表内字符串在 `dr` 表里，文中写作 `dr(1017)`；同时给出该串在**渲染处**的字符偏移，便于复核。
> **新版**：`app/src/views/Home.vue`（全文 1289 行）+ `app/src/components/*`。
>
> ⚠️ **开工先纠正一处既有文档的坑**：`docs/2026-09-17-home-analysis.md` 的**行号引用已失效** ——
> 该文写「主 Home 组件 `Home.formatted.js:3884`（整行 242KB）」，但现在仓库里的
> `legacy/js/Home.formatted.js` 是**重新排版过的**（12281 行、最长行 23316 字符），
> Home 组件实际在 `:7569`，且该文件**不解码 `dr` 表**（仍是 `o(504)` 形式）。
> ⇒ 该文的**字符串索引（`dr(N)`）全部可靠**（本次逐条复核：`dr(641)`=修改成功、`dr(703)`=日期修改成功、
> `dr(990)`=进度更新成功、`dr(1148)`=进度删除成功、`dr(1279)`=更新成功、`dr(1327)`=已确认的单只能工厂修改！
> **六个全对**），但**行号一律不可用**。本表只用字符偏移 + `dr(N)`。

---

## 结论速览（先说三件反直觉的事）

1. **旧版主表「操作」列平常是 1px 宽的空气**，里面**一颗按钮都没有**。
   `Vue.createVNode(y,{width:cn[s(755)]},…)`（`471266`），`cn = computed(() => za.value ? 150 : 1)`（`350044`）。
   只有进入内联编辑态才撑到 150px，长出「确认修改 / 取消」两颗（`471384` / `472119`）。
   ⇒ 新版那两颗常显的 `财务` / `电子回执单` **不是**旧版「操作列」的内容。
2. **旧版那套「打单操作单元格底色」（`la`）挂错了字段**：它被绑在**业务员/打单人**两列的文本上
   （`485666` / `486260`：`style:{…la(e.row["业务员"])}`），而不是挂在「打单操作」单元格上。
   那两列装的是**人名**，`la` 里 `includes("收据单"/"生产单"/…)` 永远为假 ⇒ **实际渲染出来什么都没有**。
   打单操作单元格本体（`ju`，定义在 `303132`）只有 `flex/height/border-radius/overflow/gap`，**没有 backgroundColor**。
   ⇒ 新版 `Home.vue:1079` 给打单操作格加的底色，是**照文档描述实现的、旧版并不存在的行为**。
3. **旧版删除里那句「已确认的单只能工厂删除！」是 `ElMessage.success`（绿色）弹出**的
   （`Si`，`385975` 起，末句）—— 一句禁止性提示用成功色弹。新版直接没有这条守卫。

---

## 逐条对照表

| # | 项 | 旧版依据（字符偏移 / `dr`） | 新版落点（文件:行） | 判定 | 说明 |
|---|---|---|---|---|---|
| **A. §4.1 详情（展开行）** ||||||
| A1 | 展开图标列（55px，`class-name:expand-column`） | `dr(1455)`=expand-column，列定义在 `Vue.createVNode(y,{type:"expand",width:"55","class-name":…})` | `app/src/views/Home.vue:1021` | ✅ 已做 | 都是 `type:expand`，都对。展开态把行记进 Set（旧 `jo`，新 `expandedRowKeys`）。 |
| A2 | 展开时 **拉明细**：`detail&param2=ds&param3=回执单号`，只拉一次（`jo.has` 短路） | `Jo`=`338528`；`jo.value.add(回执单号)` 后才 fetch；结果 `ping_hui/diao_hui` 各自 `sort(by id localeCompare)` | `Home.vue:852-869`（`onExpandedKeys`→`loadDetail`→`api.getOrder`） | ⚠️ 偏离 | 语义对（展开才拉、拉过不重拉），但**接口与排序不同**：旧版走动作式 `detail` 返回中文字段、并显式按 `id` 字符串 `localeCompare` 排序；新版走 REST `GET /v1/orders/{id}`，**没有排序**（依赖后端返回序）。若后端不是按 id 排，行序会与旧版不一致。 |
| A3 | 展开行内嵌 **Hui 两张汇算子表**（平开/移门） | `createVNode(l,{…"add-price-items":ro.value, showCheckbox:!0, oderColumn:…, "disable-editing":sl, "highlight-order-query":po, onRefresh:vo, onUnselect:kn, onCalculateSingleRow:In})`；移门同构（`onCalculateSingleRow:Un`）。`v-show` 由 `uo(回执单号,"ping"/"diao")` 控制 | `Home.vue:879-926`（自拼 `detailColumns` 13 列只读 `NDataTable`） | ⚠️ 偏离 | **旧版展开行 = 一整块可编辑的汇算表**；新版是一张**只读 13 列简表**。旧版随行带进子表的 prop 全部没有对应物：<br>· `showCheckbox:true` —— 子表行可勾选（勾选状态还会被主表全选/单选级联，见 J8）<br>· `add-price-items`（加价项）<br>· `oderColumn`（本单是否在「已下单集合」里）<br>· `disable-editing`（自助下单时禁用编辑）<br>· `highlight-order-query`（查单号高亮）<br>· `onCalculateSingleRow`（**单行算料并直接出生产单预览**，`In`/`Un`）<br>· `onRefresh` / `onUnselect`<br>⇒ 这条偏离比表面大：`docs/2026-09-17-home-analysis.md` §4.1 写「= Hui 两张表，**用户已确认复用**」，新版**并没有复用**（Home.vue 没有 import 任何 Hui 子表；Hui.vue 也没有把两张表拆成可复用组件、没有 `defineExpose`）。 |
| A4 | 展开行的「加载中」提示 | 无（旧版直接空白到数据回填） | `Home.vue:898-900`（`NSpin` + 「加载明细…」） | ⚠️ 偏离 | 新版多了一个 loading 态。无害改进，但与旧版不一致。 |
| A5 | 行底色 `loaded-row`（已加载明细）/`expanded-row` | `Qo`=`340759`：`jo.has→expanded-row`、`_o.has→loaded-row` | `Home.vue` `rowClass()` + `:row-class-name` | ✅ 已做（2026-09-18） | 另两条也补了：`.duplicate-order-row`（G3）、`.paid-customer`（B13）。`.paid-row` **不做** —— 旧版加了类但 `legacy/` 全库无 `.paid-row` 规则，是死码（实测：13 条夹具里旧版命中 5 条、新版 0 条）。 |
| **B. §4.2 制单 / 打印 / 分享** ||||||
| B1 | 工具栏只有一个打印入口：工厂=「打印选中订单」/终端=「查看回执单」，**onClick 是同一个** `Gi` | `dr(514)`@`467059`（按钮）/`dr(1433)`@`467510`；`Gi`=`389063` | `Home.vue:14-20`（只有「打印选中订单」一颗，无终端分支） | ⚠️ 偏离 | 新版只有工厂文案那一颗，没有 `Yt`（终端态）分支。旧版 `Yt` 由 `userinfo.defaulted===3` 置假 —— 新版无终结端账号概念（属工具栏范围，另路审计）。 |
| B2 | 打印**两层结构**：抽屉只列入口 → 点入口设 `ic` → 开预览弹窗 `C`（`dr(922)`=el-dialog，宽 `15/16==ic?"95%":"1180px"`） | 抽屉 `title:【打印选项】 size:350`（`501700`）；预览弹窗工具栏 `div.Ru` 起 `487568` | `Home.vue:141-147`（`PrintDrawer`）→ `Home.vue:585-590`（`onOpenMode`）→ `Home.vue:158-163`（`PrintPreviewDialog`） | ✅ 已做 | 结构一致。 |
| B3 | 选中的订单**必须是「已展开过」的才有明细**，未展开的打空白 | `Gi` 里读 `Ql/Rl` 两个 Map（子表实例）再取 `ping_hui` | `Home.vue:550-564`（`openPrint` 对未展开的 `api.getOrder` **兜底补拉**） | ⚠️ 偏离 | **有意改进**（`docs/2026-09-17-home-print.md` §2 已记录），但与旧版行为不同：旧版打未展开的单会打出空白明细。 |
| B4 | 电子回执单深链：`https://www.samrtdoor.com.cn/login?param1={客户名}&param2={token}&receiptNo={回执单号}`，`token={i}af{c}wy{Date.now()+888}`，`i=ds==="smartdoor"?1000:Number(ds.split("smartdoor")[1])+1000`，`c=7*客户编号+1987`，默认 7 天 | `Dn`=`351731`；`dr(1339)`? 不涉表；token 拼接在同函数内 `351900`–`352500`（`Date.now()+888`、`encodeURIComponent(客户名/回执单号)` 逐处可见）；`navigator.clipboard.writeText` 成功后提示「电子回执单链接已复制」 | `Home.vue:643-649`（`openReceipt`→`/receipt-view/:receiptNo`）→ `ReceiptView.vue:97-118`（`copyShareLink`→`api.shareReceipt`）→ `backend/src/core/receipt_token.rs`(`issue`/`verify`) | ⚠️ 偏离 | ① **位置**：旧版是**工具栏**按钮（`bn` 条件 = 选中**恰好 1 条**，`dr(562)`@`468768`），新版搬到了**每行操作列**（`Home.vue:1036`）且无选中约束。<br>② **动作**：旧版一键**直接复制链接到剪贴板**；新版是**跳转到回执预览页**再点「复制分享链接」。<br>③ **token 方案**：旧版是旧域名 token（依赖旧用户库），新版是后端自签 HMAC（`{tenant_id}.{exp}.{sig}`），TTL 同为 7 天。已在 `receipt_token.rs` 头注释里明确记为**有意替换**。 |
| B5 | 「回执单-其它」抽屉（旧版是嵌在打印抽屉里的第二层 `Mn`，`size:350`）：直接打印/手动打印/复制/分享(手机)/下载 | `Nn`=`351553`（只 `Mn.value=!0`）；工具栏 `dr(1460)`=直接打印回执单 `502440`、`dr(978)`=手动打印 `501337`、「复制回执单」/「分享回执单(手机)」（字面量，见 `ReceiptOtherDialog.vue` 头注释的偏移表）、`dr(851)`=下载回执单 `503336` | `Home.vue:155`（`ReceiptOtherDialog`）+ `Home.vue:601-605`（`onOpenReceiptOther`） | ✅ 已做（4/5） | 见 `docs/2026-09-17-home-print.md` §5 与 `ReceiptOtherDialog.vue` 头注释：少了「直接打印回执单」(`zi`@`8691`) —— 已查证它是**云中转/本机 hiprint 客户端静默打印**，新版两条载体都没有，省略合理。另外旧版抽屉是**嵌套**（外层不关），新版**先关外层再开**（两抽屉同侧会叠），已在 `Home.vue:592-600` 注明。 |
| B6 | 「查看回执单」预览弹窗（`ki`@`381580` → `Ai` 弹窗，宽 1180px；工具条 关闭/打印/手动打印/编辑回执单/复制回执单） | `ki`=`381580`，弹窗工具栏 `487700–488100` | `PrintDrawer.vue:201-207`（顶部「查看回执单」→ `openMode('receipt')`） | ⚠️ 偏离 | 入口做了，但**走的是预览弹窗那条路**，缺旧版那颗「`编辑回执单`」（`dr(597)`@`488233`，`qn.value.length>0` 才显示，开 `ReceiptEdit`）。旧版该弹窗的实质（给客户看 + 复制/分享）新版由 `ReceiptOtherDialog` 覆盖。 |
| **C. §4.3 删除（`Si`）** ||||||
| C1 | 空选 → warning「请选择要删除的数据」 | `Si`=`385975`，首段 | `Home.vue:670-675` | ✅ 已做 | 文案一致。 |
| C2 | **密码校验** `await y("删除")`，取消则 `info("已取消删除")` | `Si` 内 `await y(dr(697))` 在 `386216`（`dr(697)`=「删除」；取消走外层 catch 的 `info("已取消删除")`） | 无 | ❌ 未做 | 新版删除**没有任何二次密码校验**，直接弹确认框。`y(...)` 是什么（旧版的一个口令弹窗）另路未查，但调用点在此确凿。 |
| C3 | 守卫：**首行**若 `打单操作==="自助下单"` 或 `Yt`（工厂）才允许删；否则弹「已确认的单只能工厂删除！」 | `Si` 内 `"自助下单"==(a?a["打单操作"]:"")‖Yt.value` | 无 | ❌ 未做 | 新版无守卫。⚠️ 旧版这句用的是 `ElMessage.success`（**绿**），不是 error —— 旧版自身的瑕疵，新版若要补应先定文案色。 |
| C4 | 财务预检 `finance_checkOrderPayment`（**仅 `Ht` 新财务**），汇总 `allocatedAmount/adjustmentAmount` 只对 **>0** 的取正累加，收集 `customerId` 去重 | `386487`（`param1=finance_checkOrderPayment`）；`allocatedAmount`=`dr(889)`；`adjustmentAmount`=`dr(863)` | `Home.vue:678-706`（`api.checkOrderPayment` + 按客户分组） | ✅ 已做 | 逻辑一致（>0 才累加、按客户聚合）。 |
| C5 | 有财务记录时的确认框文案：`选中的订单有以下财务记录：\n• 已分配收款 ¥x\n• 订单抹零 ¥y\n\n删除订单时将自动进行红冲（冲销收款和抹零），确定继续？`，标题「删除订单」，按钮「确定删除并红冲」/「取消」 | `dr(689)`/`dr(1347)`/`dr(1082)`/`dr(1411)`/`dr(697)`；`确定删除并红冲` 字面量 @`387113` | `Home.vue:708-719` | ⚠️ 偏离 | 内容等价但**文案与按钮全改了**：新版标题「删除确认」、按钮「删除」/「取消」、正文末句「删除订单时将自动进行红冲。」少了「（冲销收款和抹零），确定继续？」。<br>无财务记录时旧版是「确定要删除选中的数据吗？此操作不可恢复」(`dr(1270)`)，新版是「确定删除选中的 N 条订单吗？删除后不可恢复。」—— 也是改写。 |
| C6 | 删除请求 `deleteHui`（POST，body = 回执单号数组） | `dr(1353)`=`https://…?param1=deleteHui&param2=` | `Home.vue:724`（`api.deleteOrder(id)` 逐条 REST DELETE） | ⚠️ 偏离 | 载体不同（动作式批量 vs REST 逐条）；**逐条循环没有事务**，中途失败会留下「删了一半」的状态。建议后端补批量删接口。 |
| C7 | 红冲：逐客户 `finance_addPayment`（`收款金额: -已分配`、`收款方式:"其他"`、`备注:"删除订单红冲收款 "+单号,`、`分配列表:[]`）+ `finance_addCustomerAdjustment`（`调整金额: -抹零`、`调整类型:"删除订单冲销"`、`备注:"删除订单红冲抹零 "+单号`） | `Si` 内 `387700–388400` | `Home.vue` `deleteSelected()` | ⚠️ **有意偏离（收款那条腿）**（2026-09-18） | 抹零那条腿逐字一致（含备注前缀）✅。<br>⭐ **收款那条腿必须偏离，照抄会把客户的钱算没** —— 旧版把整笔「已分配收款」（= 本单收款 + 池分配）写成**一条客户级负收款**（`order_id = NULL`），而在我们的账务模型里那样会**同一笔钱扣两次**：`实收金额` 减了，但 `已分配总额`（只认带 `order_id` 的收款 + `finance_allocations`）减不到 ⇒ 多扣 2×。**端到端实测**（`finance-reversal-e2e.mjs`，真 HTTP）：客户往池子打 300 分给 A、另给 B 直接收 200，两张单删掉后旧写法得到 **未分配 −500 / 实收 0**，新写法得到 **300 / 300**（自洽）。<br>新版按**来源**拆：本单收款 → 带 `order_id` 的负收款（`addOrderPayment` 的负数分支）；池分配 → 负的分配行（新接口 `POST /v1/finance/orders/{id}/allocation-reversal`，见 `service::reverse_order_allocation`）。<br>⚠️ 顺带把顺序改成**先红冲再删**：`addOrderPayment` 内部要 `order_finance(order_id)` 校验，订单删了就取不到。 |
| C8 | 成功后 `success("删除成功，已完成：收款红冲 ¥x，抹零红冲 ¥y")`，再 **500ms 后 `window.location.reload()`** | `dr(853)`=删除成功，已完成： @`3884xx`；`setTimeout(()=>location.reload(),500)` | `Home.vue:748-750`（`message.success('删除成功')` + `await load()`） | ⚠️ 偏离 | ① 新版不展示「已完成：收款红冲 ¥x…」这一段（丢了红冲金额反馈）；② 新版 `await load()` 就地刷新（更好），旧版是整页 reload。 |
| **D. §4.4 改客户名** ||||||
| D1 | 触发：点**客户单元格**（`onCellClick:en` 按列 `property==="客户"` 路由）；单元格有 `title="点击修改客户名称"`、`cursor:pointer` | `en`=`347602`；`dr(1490)`=`点击修改客户名称`@`475111`；`Vo(row)`→`paid-customer` 类 | `Home.vue` 客户列 `render` | ✅ 已做（2026-09-18 补齐） | 触发方式一致；原缺的 `title`（`dr(1490)`）与 `paid-customer` 绿标（`Vo(row)` = 未收为 0 → `#90ee90`）**这次一并补上**。 |
| D2 | 弹窗「修改客户名称」460px：`原客户`（disabled el-input）+ `修改为：`（el-autocomplete，`trigger-on-focus`、clearable、联想自 `getClientsInfo`） | `dr(778)`=原客户；`dr(1359)`=100px label-width；弹窗标题 @`508658` 区 | `Home.vue:88-108`（n-modal 460px，label-width 90） | ⚠️ 偏离 | ① 新版「修改为」是**普通 `n-input`，没有联想/自动补全**，也没有 `禁用` 态与「请先选择要修改为的客户」校验；② label-width 100px→90px；③ 少了 loading 指令（旧版 `v-loading`）。 |
| D3 | 提交 `finance_updateOrderCustomer`，body `{回执单号, 原客户, 原客户编号, 客户:新名, 客户编号:新编号, 编辑:当前用户名}`；**客户编号必须由联想选中**（`canConfirm = 已选中`）；id/name 都没变时提示不提交 | `Hui.formatted.js:269-270`（`updateOrderCustomer`）+ `:230-268`（composable `useOrderCustomerEdit`，`openCustomerEditDialog`/`confirmCustomerChange`） | `Home.vue:460-470`（`api.updateOrderHead(id,{client_name})`） | ⚠️ 偏离 | **这是本维度最实的一处偏离**：新版只改订单头上的 `client_name` 字符串，**不动 `client_code`、不写客户档案**。旧版是通过 `finance_updateOrderCustomer` 把订单**挂到另一条客户记录**（带 `原客户编号`→`客户编号` 的迁移语义），后端的客户余额/对账/报表跟着走。新版改完，订单的 `client_code` 仍指向旧客户，`客户列` 与 `财务抽屉`（按 `客户编号` 取数）会**互相矛盾**。 |
| **E. §4.5 修改金额 / 备注 / 地址（内联编辑）** ||||||
| E1 | **触发时机 = `onFocus`**（聚焦才进编辑态），不是点击 | `nn`=`349113`：`za!==e && (za=e, an.定金/订单备注/安装地址=e.…)` 快照；渲染里 6 处 `onFocus:nn(e.row)`（`476745`/`478839`/`481661`/`482120`/`485539`/`486127`） | `Home.vue:954-973`（`renderEditable` 用 `onClick:()=>startEdit(row)`）；已付列 `Home.vue:1097`、客户/日期列用 `clickable-cell` | ⚠️ 偏离 | 新版统一改成**点击**进编辑。交互差异：旧版在格子里点一下→光标已就位可直接打字；新版要先点一次（进编辑）再点一次（进输入框）。 |
| E2 | 「操作」列仅编辑态出现：**「确认修改」(el-button primary mini) + 「取消」(el-button danger mini)**，列宽 `za?150:1`，**列无表头** | 保存 `471384`（`type:dr(1016)`=primary，`size:dr(1445)`=mini，label `dr(547)`=**"确认修改"**）；取消 `472119`（`type:dr(1051)`=danger，size mini）；列 `471266`；`cn`=`350044` | `Home.vue:1022-1037`（`width: editingId!=null?150:140`，按钮「保存」`type:primary` /「取消」默认） | ⚠️ 偏离 | ① **文案**：旧版是「**确认修改**」，新版是「保存」（`docs/2026-09-17-home-analysis.md` §4.5 写的「保存」，需更正）。<br>② **色**：旧版「取消」是 **danger 红**，新版是默认灰。<br>③ 旧版操作列**无表头**、非编辑态宽 **1px**；新版标题「操作」、非编辑态宽 **140px 常显**。<br>④ 新版列里常显 `财务` / `电子回执单` 两颗 —— 旧版此处**没有**（财务是独立列，见 G1；电子回执单在工具栏）。 |
| E3 | 可编辑字段（主表）：**已付/定金**（仅 `Yt`）、**订单备注**（仅 `Yt`）、**安装地址**（`Yt` 与 `!Yt` 各一列）、**业务员**（仅 `Yt`，且仅 `qt` 真时是输入框）、**打单人**（仅 `Yt`，同上） | `dr(869)`@`384917`（安装地址）、`dr(944)`@`385008`（订单备注）、`dr(1119)`@`385186`（业务员）、`dr(511)`@`385099`（打单人）、`dr(891)`/`已付`@`3900xx` | `Home.vue:1068-1073 / 1083-1099 / 1109-1116` | ✅ 已做 | 字段集一致。 |
| E4 | 业务员/打单人：**非 `qt` 时是只读文本**（带 `la()` 底色，实际为空，见「速览 2」），只有 `qt`（`registrant===门店名`）才是 `el-input.borderless-input` | 渲染 `485539-485760`（业务员）、`486100-486400`（打单人）；`qt` 在 `onBeforeMount` 置位 | `Home.vue:1115-1116`（**恒为可编辑**） | ⚠️ 偏离 | 新版没有 `qt` 概念，两列**恒可编辑**。在「非本品牌门店账号」下这会多开两个本不该能改的入口。 |
| E5 | 守卫：`!Yt && 打单操作!=="自助下单"` → **禁止保存**，弹 `dr(1327)`「已确认的单只能工厂修改！」 | `471478`（保存 handler `471384` 的第一行：`if(!Yt.value&&"自助下单"!=e[dr(1488)]) return ElMessage.error(dr(1327))`） | 无 | ❌ 未做 | 新版无守卫。 |
| E6 | 提交：POST `updateCustomerInfo`，body = **整行对象**（`JSON.stringify(e)`，行上的中文键全带上）；成功后 `markRowsPersisted()`（平开+移门两个子表实例都调）+ `Ca()`（全量刷新）+ `success(dr(641)="修改成功")` | 保存 handler `471384-472100`；`dr(641)`@`471988` | `Home.vue:430-441`（`api.updateOrderHead(id,{...draft})` + 「修改成功」+ `load()`） | ⚠️ 偏离 | 语义对（整头提交 + 成功提示 + 刷新），但：① 新版是 **PATCH 头字段**，不含明细行；② 旧版会顺手 `markRowsPersisted()` 告诉子表「这些行已落库」，新版没有子表可通知（A3 偏离的连带）；③ 旧版 `Ca()` 是整表重拉（含未保存的其它改动会丢），新版 `load()` 同理。 |
| E7 | 「取消」的还原范围：**只还原 定金 / 订单备注 / 安装地址 三个**（`an` 快照），**业务员 / 打单人 不还原**（因为它们 `v-model` 直接写进了 `e.row`） | 取消 handler `472119-472200`：`e["定金"]=an["定金"], e[dr(944)]=an[…], e["安装地址"]=an[…]` | `Home.vue:443-445`（`cancelEdit` 只清 `editingId`，草稿在 `draft` 副本里） | ⚠️ 偏离（新版更正确） | 旧版这是**实打实的 bug**：改完业务员/打单人点「取消」，改动留在行里、若之后保存会被一起提交。新版用 `draft` 副本天然规避。属**改进型偏离**，记一笔以免后续「对齐」时改回旧行为。 |
| E8 | 「已付」列：`已分配金额 != null`（新财务）时显示**只读文本**，否则才是可编辑 `el-input` | 渲染 `3900xx`：`null!=e.row[dr(891)] ? <span>{{…}}</span> : <el-input …>` | `Home.vue:1083-1099`（恒显示 `fmt(row.deposit)`，编辑态才是输入框） | ⚠️ 偏离 | 新版**不认 `已分配金额`**：即使财务摘要里有 `allocated_amount`，已付列仍显示订单头上的 `deposit`。而**同一行的「未付」列**（`Home.vue:1104-1106`）走 `unpaidOf()` 优先取 `finance_summary.unpaid_amount`。⇒ 新版同一行两列口径不同源，新财务下会出现「已付 + 未付 ≠ 总价」。 |
| **F. §4.6 修改下单日期** ||||||
| F1 | 点击日期单元格 → 弹窗「修改下单日期」400px：`原日期`（disabled）+ `新日期`（el-date-picker，`format`/`value-format:YYYY-MM-DD`） | `dr(956)`@`507541`、`dr(1183)`=400px、`dr(1359)`=100px、`dr(607)`=原日期、`dr(1245)`=新日期 | `Home.vue:111-131`（n-modal 400px）+ `Home.vue:476-496` | ✅ 已做 | 弹窗与两个控件都对。 |
| F2 | **提交前重算截止日期**：`间隔 = ceil((原截止日期 - 原日期)/864e5)`，`新截止日期 = 新日期 + 24*间隔*3600*1000` 的 ISO 日期；body = `{回执单号, 日期, 截止日期}` | `rn`=`349282`，`864e5` 缩放 + `toISOString().split("T")[0]` | `Home.vue:484-496`（只提交 `{order_date: iso}`） | ❌ 未做 | 新版**完全不碰 `due_date`**。旧版改日期会保持「生产周期」不变量；新版改完日期，`截止日期` 还是旧的 ⇒ `isDueSoon()`（`Home.vue:388-397`）算出的 `.date-warning` 会失真。 |
| F3 | 守卫：**`单号集` 非空 → 不弹窗**，改弹 warning「已生产的单不能修改生产日期」；空才弹 | 日期格 onClick `475533`（判 `单号集` 是否 `""`），文案 `475649` | `Home.vue:1066`（`openDate` 无任何条件） | ❌ 未做 | 新版任何行都能点开改日期。 |
| F4 | 成功后 `success(dr(703)="日期修改成功")` | `349898` | `Home.vue:490`（「日期修改成功」） | ✅ 已做 | 文案一致。 |
| F5 | 日期列 `sortable`，排序序 `["descending","ascending",null]`（三态） | `dr(890)`/`dr(1263)`；列定义 `475231` | `Home.vue:1060-1067`（`sortable: true`，Naive 默认三态） | ✅ 已做 | 等价。 |
| F6 | 日期格 class：`未审核 → date-audit`；`未收===0 → ""`（**已付清的单一律不告警**）；无截止日期 → `""`；否则 `ceil((截止日期 - now)/864e5) < 4 → date-warning` | `Ls`=`463734`（完整可读）；`bs=e=>hs(e)`（`463933`/`461119`：`打单操作.trim()==="" && 单号集.trim()===""`） | `Home.vue:388-404`（`isDueSoon` + `rowProps`） | ⚠️ 偏离 | 三处不同：<br>① 旧版 `< 4` 且**无下界**（`ceil` 可负）⇒ **已过期**的单也吃 `date-warning`；新版是 `diff >= 0 && diff <= 4`（**过期不告警**）。<br>② 旧版先判 `未收===0 → ""`（已付清不告警），新版没这条。<br>③ 旧版没有「无截止日期」→新版也没有，一致。<br>另外旧版是 `Math.ceil`（不足一天算一天），新版是 `Math.floor`。<br>④ 旧版 `Ls` 是 `if/return` 链 ⇒ `date-audit` 与 `date-warning` **互斥**（未审核就不再看截止日期）；新版 `rowProps` 是**两个独立 if**，两个类可能同时挂上（CSS 都带 `!important`，实际由规则先后决定）。 |
| **G. §4.7 审核确认 / 手动更新进度** ||||||
| G1 | **审核确认**：日期列内、`bs(row)`（=未审核）时在日期下方追加 el-button primary small「审核确认」（`margin-top:4px`） | 按钮 `476268`；`dr(1126)`@`476267`；显示条件 `bs(e[s(1472)])`（紧跟 `476267` 之前） | `Home.vue:2854-2868`（`dateCell` 内，`isUnaudited(row)` 时 push） | ✅ 已做 | 显示条件与 `margin-top:4px` 逐字一致。⚠️ 尺寸取 `size="tiny"`（旧版 `small`）—— Naive 无 `small` 之外的更小档；**未逐像素比对过**，若看着偏小改 `small`。 |
| G2 | 审核确认动作：`Ba=row; Ma=今天; await rn()`（**先按 F1/F2 把日期改成今天并重算截止日期**）→ `await Hl("确认下单",[回执单号])`（`updataProgress`，`param3=操作名`）→ `success(dr(1279)="更新成功")` → `Ca()`；失败 → `error(dr(920)="更新失败")` | `476268-476400`；`Hl`=`333238`（定义在 setup 前段，URL 前缀 = `dr(1369)`「`https://www.samrtdoor.com.cn/1?param1=updataProgress&param2=`」，后接 `ds`，再 `&param3=encodeURIComponent(操作名)`，有日期时再 `&param4=encodeURIComponent(日期)`；**最多重试 5 次、每次隔 500ms**） | 后端无对应接口（`app/src/api/client.ts` 全文无 `progress`） | ✅ 已做（3 处偏离） | 实现 `Home.vue:1070-1100`（`confirmAudit`）。偏离：<br>① **不回算截止日期** —— 新版 `due_date` 由 SQL 推导（`orders/service.rs` 的 `HEADER_COLUMNS`：`order_date + production_days + 1`），改日期自动跟随，比旧版的手工重算更稳（顺带把 F2 那条偏离解掉一半）。<br>② 旧版对旧服务端的**重试 5 次 / 隔 500ms** 不适用：新版 `PATCH` 即持久化。<br>③ 写的是**本地**日期，不是 `legacyToday()`（那个走 `toISOString()` = UTC）—— 旧版此处用的正是本地口径，见该函数注释里的实测（UTC+8 的 00:00–08:00 会差一天）。<br>⚠️ 顺带更正文档：`docs/2026-09-17-home-analysis.md` §4.7 写「`updataProgress`(工序10, 操作名「确认下单」)」—— 实际这条调的是 `Hl("确认下单", [单号])`，**只有操作名、没有「工序10」**；「工序10」是另一个函数 `Gl`（`Hl("工序10", 单号集合, 日期)`）在用。 |
| G3 | **手动更新进度**：点打单操作单元格（`.stop`）→ 弹窗「手动更新进度」460px，label-width 110px | `Ha`=`347058`（守卫：无回执单号 → warning「当前行缺少回执单号，无法更新进度」）；弹窗 `dr(1017)`@`510090`、`dr(1294)`=460px、`dr(1335)`=110px | 弹窗 `Home.vue:208-257`；开窗 `2202-2213`；进度条格 onClick `3005-3013`（`.stop`） | ✅ 已做 | 460px / label-width 110px / 无单号时 warning 不弹，均逐条对齐。 |
| G4 | 弹窗控件①：`回执单号`（el-input **disabled**） | `511024` 区；`dr(1407)`? 不涉；label 是字面量 `回执单号` | `Home.vue:216-218` | ✅ 已做 | — |
| G5 | 弹窗控件②：`操作名称`（el-autocomplete，placeholder「选择或输入操作名」，clearable，`onSelect` 回填，`onBlur` 触发自定义项入库）；候选 = `dr(945)/"生产单"/dr(777)/"确认生产"`（=**玻璃订单 / 生产单 / 收据单 / 确认生产** 四个固定项）+ localStorage 自定义项 | `Na`=`345688`；`Sa`=`346411`（候选构造）；`Ua`=`346306`（入库）；`Ta`=`346522`；placeholder 字面量 @`511024` | `Home.vue:219-230`；候选 `2159-2164`；入库 `2166-2168`；右键删 `2171-2190` | ✅ 已做 | ⭐ 本行原表漏记一条，**下拉的弹出时机**（用户 2026-09-18 报「新版空框不弹」）：旧版这处**没写** `trigger-on-focus`，吃 Element Plus 的默认值 `true`（该默认值从旧版随包发的 `legacy/vendor/js/element-plus.min.js` 里读出来 = `triggerOnFocus:{type:Boolean,default:!0}`）；又因 `Sa` 在查询词为空时回**全量**候选，所以**聚焦空框即弹整份下拉**。Naive 的 `n-auto-complete` 默认恰好相反（`getShow` 缺省 `!!value`，`AutoComplete.mjs` 的 `mergedShowOptionsRef`）⇒ 新版必须显式 `:get-show`。**但光补这个会出新毛病**：弹窗开窗时会自动聚焦第一个可聚焦控件，一聚焦就弹 ⇒ 下拉在入场动画途中自己冒出来、位置还偏（用户 2026-09-18 报）。<br>旧版没这毛病，因为 `el-dialog` 的 focus-trap **硬编码 `"focus-start-el": "container"`，只聚焦容器**；Naive 的 `n-modal` 是 focus-trap `autoFocus` 默认 `true` 且无 `initialFocusTo` ⇒ `resetFocusTo('first')`。所以**两个装了 autocomplete 的弹窗都得 `:auto-focus="false"`**（本处 + 查询订单）。<br>对照见 `autocomplete-logiccheck.mjs`（27 条，含这两条约束，做过变异测试确认会红）。 |
| G6 | 弹窗控件③：`日期`（el-date-picker，placeholder「选择日期」，`value-format:YYYY-MM-DD`，clearable），初值 = 今天 | `ka` 初值 `new Date().toISOString().split("T")[0]`；控件 @`511327` | `Home.vue:231-239`；初值 `legacyToday()`（`2141-2149`） | ✅ 已做 | 初值照旧版走 **UTC** 串再按本地日历还原（含 UTC+8 凌晨取到"昨天"这一旧版行为，有意保真）。 |
| G7 | 弹窗控件④：**`记录日期`** checkbox（`dr(585)`@`511658`），勾选时把日期**拼到操作名后面**再提交（`param3 = 操作名 + 日期`），并**持久化到 localStorage** | `Pa=ref("1"===localStorage.getItem(gr))`、`Wa=e=>localStorage.setItem(gr, e?"1":"0")`；`gr="home_manual_progress_record_date"`（**模块级常量，定义在 `327822`**，紧邻 Home 组件） | `Home.vue:240-247`；偏好初值 `2136`；写盘 `2196-2199`；拼串 `2221-2226` | ✅ 已做 | `Pa` 初值语义照抄：从未设置过 ⇒ `false`；存过 `"1"` ⇒ 勾上。**是持久化偏好，不是每次默认勾选**。 |
| G8 | 自定义操作项 CRUD：确认/失焦时把新名字写进 localStorage；候选里**固定 4 项不允许删**（「固定项不允许删除」），删不存在的项提示「未找到该自定义操作项」，空输入提示「请先输入要删除的操作项」，删成功提示「已删除自定义操作项」 | `Ia`=`346237`（写盘）、`Ua`=`346306`、`Ya`=`346544`；key `wr="home_manual_progress_actions"`（`327788`） | `Home.vue:2111-2129`（`rememberManualAction` / `forgetManualAction`）；右键删 `2171-2190` | ✅ 已做 | 四句提示文案逐字照抄；固定 4 项不删、删掉的正是当前筛选值时清筛选，均已实现。 |
| G9 | 弹窗按钮：`取消` / **`删除`（type=danger）** / `确认`（type=primary） | 「删除」按钮 @`510325` | `Home.vue:249-256` | ⚠️ 偏离（仅取名） | 旧版 `type="danger"`，Naive 没有 `danger` ⇒ 用 `error`（同为红色档），文案与顺序不变。 |
| G10 | 「确认」提交：`updataProgress`（`param3 = 记录日期? 操作名+日期 : 操作名`），成功后**就地改行上的 `打单操作` 字段** + `success(dr(990)="进度更新成功")` | `ln`=`347785` | `Home.vue:2253-2273`（`submitManualProgress`） | ⚠️ 偏离（通路） | 旧版 `updataProgress` 是旧服务端**不透明**接口，新版后端没有该端点 ⇒ 落到订单头字段 `production_status`（`headWithStatus` + `updateOrderHead`），语义 = 旧版**前端可见**的「整串覆盖」。<br>⚠️ 未确认项：旧服务端 `updataProgress` 自身是否还会做合并/追加 —— bundle 观测不到（旧版前端不刷新，看不到服务端结果）；新版按前端可见语义实现。 |
| G11 | 「删除」提交：`deleteProgressForFullOrder`（`param1=deleteProgressForFullOrder&param2=ds&param3=操作名[+日期]`，body=单号数组，**同样重试 5 次**），成功后从 `打单操作` 串里**摘掉该段**（处理 `x`、`x_`、`_x` 三种形态）+ `success(dr(1148)="进度删除成功")` | `on`=`348122`；`删除进度失败，已重试5次`=`dr(1057)`@`348862` | `Home.vue:2278-2304`（`deleteManualProgress`） | ⚠️ 偏离（通路） | 「摘掉该段」的 `x` / `x_` / `_x` 三种形态逐条照抄。无重试（理由同 G10）。 |
| **H. §4.8 加价** ||||||
| H1 | 主表侧只有一个**默认加价项常量** `[{name:"人工",price:100,unit:"元/套"}]`，作为 prop 传给展开行里的 Hui 子表 | `ro=Vue.ref([...])`=`334578`；全文只有两处**读**（`470413` 平开子表 / `470939` 移门子表），**没有任何写入点** | 无 | ❌ 未做 | 新版 Home **没有加价入口**（因为展开行不是 Hui 子表了，A3）。加价本体在新版落在 **Hui 汇算页**：`app/src/composables/useMarkupCatalog.ts`、`app/src/utils/markupLines.ts`、`app/src/views/Hui.vue:158-170`（新增加价项目弹窗）。⇒ 从 Home 的角度是「未做」，从产品角度是「搬到了 Hui」。 |
| **I. 行操作列 / 每行到底有哪几颗按钮** ||||||
| I1 | **行内按钮只有 3 颗 + 1 个条件**：① 编辑态「确认修改」；② 编辑态「取消」；③「财务」圆钮；④ 未审核行日期列下的「审核确认」 | 见 E2 / I2 / G1 | — | — | 穷举法：对 `471300–486500`（表体渲染区）内**所有** `createVNode(elButton,…)` 与 `createBlock(elButton,…)` 逐个列出，共 15 处 —— 其中 **11 处是列头 popover 里的**（单号集表头「查单号/清除/确认」3、未付表头「付款状态/已付/未付/部分付/全部显示」5、打单操作表头「生产进度/自定义项模板/显示全部」3），**行内只有 4 处**：`471384` 确认修改、`472119` 取消、`472564` 财务¥、`476268` 审核确认。⇒ 新版操作列那两颗常显按钮（`财务`/`电子回执单`）里，只有「财务」能在旧版行内找到对应物（且位置/形态/条件都变了）。 |
| I2 | **财务**列：label `财务`，`width:"56"`，`align:center`，**仅 `Yt && Ht`**（工厂 且 新财务开关）；控件 = el-button **`type:"success"` `size:"small"` `circle` `title="财务管理"`**，内容 `¥`，点击 → `Ln={回执单号,客户编号,客户,总价}; En=true` 开 FinanceDrawer | `label:"财务"` 字面量 @`472497`、按钮 `472564`、title `dr(1184)`=财务管理 @`472622` | `Home.vue:1033`（操作列里的 `财务` n-button `quaternary type:info`） | ⚠️ 偏离 | ① **显隐条件丢了**：旧版只在 `Yt && Ht` 下才出现；新版**恒显示**。新版没有 `Ht`（新财务开关）概念，财务能力恒开。② **形态/色**：圆形 success 绿 `¥` → 方形 `info` 蓝「财务」文字。③ **位置**：独立 56px 居中列 → 挤进操作列。④ 传入数据：旧版 4 字段（无 id），新版 5 字段（多 `id`）。 |
| I3 | **审核确认**按钮（日期列内）：el-button `type:"primary"` `size:"small"`，文案 ` 审核确认 `（前后带空格），条件 `bs(row)`=未审核 | 按钮 `476268`；`dr(1126)` | 无 | ❌ 未做 | 见 G1/G2。 |
| I4 | 单号集表头「查单号」popover：el-button text small「查单号」→ popover(width 240)，内含 el-input（placeholder「可只输入单号"-"前数字即可，如199.」）+「清除」+「确认」；**Enter 直接触发查询** | 按钮 `473605`、input @`473860`±（placeholder `dr(1387)` @`473902`）、Enter `473922`（`onKeyup:withKeys(Yo,["enter"])`）、清除 `474013`、确认 `474134`；`dr(1298)`@`473702`、`dr(1387)`、`dr(1268)`=240 | `Home.vue` 单号集列 `title` 渲染 + `confirmOrderNoQuery()` | ✅ 已做（2026-09-18） | 宽度 240、placeholder、Enter、清除/确认都在；命中后**展开第一条匹配行**也做了。⛔ **只有「滚到居中 + `.highlight-matched-order` 高亮」做不了**：那个类由 **Hui 子表**按 `row.单号.startsWith(po)` 加（`Hui.formatted.js:1352-1356` / `:3788-3792`，靠 Home 传 `highlightOrderQuery`），而 `OrderLineDto`（`app/src/api/types.ts:109-159`）里**没有「单号」字段**。数据模型补回这条之前无落点（旧版找不到该元素时同样直接 return，不滚）。<br>⚠️ **2026-09-18 更正措辞**：本行原先接着写「旧版一行明细归属某个单号，**新版把单号收在回执单号上了**」—— 前半句对（行级单号确实存在），**后半句是错的模型描述**：`单号` 与 `回执单号` 是**两个层级**的东西（行级 vs 订单级），不是「收在同一个字段上」。详见 `docs/2026-09-18-order-no-semantics.md`。<br>✅ **2026-09-18 二轮：数据源已接通** —— 原先它搜的 `order_no_set` 恒空串（零写入点），组件做对了但没数据。当天补了迁移 `0020` 的行级 `order_lines.line_no` + `order_no_set` 服务端派生，功能已能生效（前提是那一单先在 Hui 点过「填入单号」）。见 `docs/2026-09-18-order-no-semantics.md` §6。 |
| I5 | 单号集**单元格**：hover popover 列出全部单号（按 `_` 分割去空），显示的是**按已输入单号前缀过滤后的第一个**（`To(row)`） | hover popover @`474366`；`To`=`335931`、`Uo`(切分)/`So` 紧邻其前 | `Home.vue` 单号集列 `render` + `orderNoCell()` | ✅ 已做（2026-09-18） | 三处都对齐了：① 按 `_` 拆；② 查单号生效时显示**以关键字开头的那一段**（`startsWith`，不是 `includes`）；③ `placement:bottom` / `width:220` / 引用 span `cursor:pointer`。**仅 `Yt`（工厂态）时该列才存在** —— 新版只做工厂视图，一致。 |
| I6 | 客户列：`paid-customer` 绿标（`未收===0`，`#90ee90`）+ `title="点击修改客户名称"` + `cursor:pointer` | `475111` 区 | `Home.vue` 客户列 `render` | ✅ 已做（2026-09-18） | 见 D1，三项齐了。 |
| I7 | 打单操作列：进度条（`ua`，5 步 + 自定义，`done` 判定：`确认下单` 用 `len>0`，其余用 `includes`；未完成底 `#e0e0e0`）+ 前缀/后缀文本 `oa`/`aa`（按 `_` 切分）+ **`未收===0` 时追加 `✓已付清`** | `ua`=`344023`、`na`(5 步色数组)=`343825`、`oa`=`343574`、`aa`=`343711`、`dr(1302)`=✓已付清 @`477820`（!Yt 列）/`485077`（Yt 列） | `Home.vue:940-952`（`renderProgress`，`PROGRESS_STEPS` 在 `Home.vue:239-245`） | ⚠️ 偏离 | ① 新版**没有 `oa`/`aa` 的前后缀拆分显示**（旧版把「标签_生产单」显示成前缀「标签_」+ 后缀「生产单」）；② 新版**没有 `✓已付清`** 追加标记；③ 旧版 `done` 对「确认下单」是 `len>0`（整串非空即算完成），新版 `Home.vue:948` 是 `status.includes('确认下单')` —— **判定口径不同**。 |
| I8 | 打单操作**单元格底色** `la()`：含收据单→`#90EE90`、标签→`#FFC0CB`、玻璃订单→`#87CEEB`、生产单→`#FFFF99`、自助下单→`#FFA500` | `la`=`343333` | `Home.vue:931-938` + `1079` | ⚠️ 偏离（旧版是 bug） | **旧版这个函数挂错字段了**（见「速览 2」）：它绑在**业务员/打单人**人名文本上（`485666`/`486260`），实际永远返回 `""`。打单操作单元格本体（`ju`，`303132`）**无背景色**。新版按文档描述把底色加在了打单操作格上 ⇒ 视觉上**比旧版多了一层颜色**。若要 1:1，应该：不加底色，或复刻「挂在人名上」这个 bug（不推荐）。**先把文档 §3 那句「打单操作单元格底色」改成「挂错在人名列、实际无效果」。** |
| I9 | 打单操作/客户单元格 **hover 浮动 tooltip**：鼠标移入时在光标处浮一个 `position:fixed` 的 HTML 面板，内容是五步 `✓/○ + 名称`（`#52c41a`/`#bbb`），`未收===0` 时追加 `<span style="color:#52c41a;font-weight:700">✓ 已付清</span>`；`mousemove` 跟随、移出隐藏 | `sa`=`344393`（构造+定位）、`da`=`344718`（隐藏）、`Va`=`344741`（mousemove 跟手）、面板本体 @`486611`（`position:"fixed", left:ca.x+"px", …` 的 Teleport 到 body 的 div）；`dr(1302)` 的 ✓已付清在 `477820`/`485077` | 无 | ❌ 未做 | 新版只有 `title` 属性级的原生提示（且只有进度条每一段有 `title`，见 `Home.vue:946`），没有整行级浮动面板。 |
| **J. 快捷键 / 右键菜单 / 批量操作** ||||||
| J1 | **键盘快捷键** | 全文件对 Home 段（`>327000`）穷举 `withKeys|onKeyup|onKeydown|addEventListener("key`：**仅 2 处** —— `473922`（单号集查单号 Enter）、`511105`（见 J2）。**没有全局快捷键** | `Home.vue` 单号集列头的 `inputProps.onKeyup` | ✅ 已做（2026-09-18） | 查单号输入框按 Enter 触发查询已实现。⚠️ naive 的 `NInput` **不接 `onKeyup` prop**，得走 `inputProps.onKeyup` 透传到原生 `input` —— 直接写 `onKeyup` 会被**静默忽略**（同 `sorter` vs `sortable` 那类坑）。 |
| J2 | **右键菜单** | 仅 1 处：`511105` = 手动更新进度弹窗里「操作名称」autocomplete 的 `onContextmenu:Ya` → **右键删除自定义操作项**。**行上没有右键菜单** | 无 | ❌ 未做 | 随 G3 一起没做。 |
| J3 | 批量：**删除选中数据**（常显） | 按钮 `468366`（`dr(1271)`）→ `Si` | `Home.vue:27` + `670-760` | ✅ 已做 | 见 C 组。 |
| J4 | 批量：**打印选中订单 / 查看回执单**（选中>0 时按钮变 `danger-print-btn` 红） | `dr(667)`=danger-print-btn / `dr(590)`=custom-print-btn；按钮 `467059` | `Home.vue:14-20`（`type: checkedRowKeys.length ? 'warning' : 'default'`） | ⚠️ 偏离 | 旧版「有选中」时是 `danger` 红（`.danger-print-btn`），新版是 `warning` 橙。 |
| J5 | 批量：**选中清账**（选中数>0 时出现，按钮文案 ` 选中清账 (N) `，`class=custom-delete-btn`） | 按钮 @`468979`（`dr(1228)` 类名 @`468887`）；`Pi`=`381906` | `Home.vue:28` + `765-843` | ⚠️ 偏离 | ① 新版「清账」**常显**且文案不带 `(N)`；② **旧版有两条路**：`Ht`（新财务）→ `finance_addPayment`（逐客户、`收款方式:"清账"`、`分配列表`=未收>0 的项、备注 `"批量清账 "`），**否则**走老财务 `clearAccount`（body=`[{回执单号,定金:总价}]`）。**新版只做了新财务那条**。③ 确认框标题：旧版「清账确认（新财务系统）」/「清账确认」，新版「清账确认」。④ 新版开头会多提示「选中的订单没有未收金额，无需清账」（旧版同名提示存在，一致）。 |
| J6 | 批量：**合并订单**（选中数>1 时出现，按钮 @`469247`，类 `custom-combine-btn` @`469146`）—— 校验同一 `客户编号`、确认框「合并后将以最早的回执单号为准…」、POST `combine`，body=`{merged, record}`；合并时逐条累加 `总价/定金/门数`，`日期/截止日期` 取更早，`安装地址/订单备注/打单人/业务员` 用 `"; "` 拼接，`打单操作` 硬写 `"合并单"` | `Ii`=`384101`；`dr(1005)`=合并订单确认 | 无 | ❌ 未做 | 新版没有合并订单入口，`app/src/api/client.ts` 也没有 `combine`。 |
| J7 | 批量：**电子回执单**（选中**恰好 1 条**才出现） | `bn=computed(()=>Kt.value?.length===1)`；按钮 `468768` | `Home.vue:1036`（每行一颗） | ⚠️ 偏离 | 见 B4。 |
| J8 | 批量：**全选/单选会级联到展开行里的子表**（`selectAll`/`unselectAll` 逐个子表实例），并且**展开行时若该行已被勾选，子表自动全选**；「取消勾选」方法 `kn`/`Pn` 反向把主表该行取消勾选 | `Oo`=`337554`（select-all）、`Ho`=`338149`（select）、`Jo` 尾部（展开时 `l && Ql.get(回执单号).selectAll()`）、`kn`/`Pn` | 无 | ❌ 未做 | 新版子表只读、无勾选（A3），级联自然不存在。 |
| J9 | 批量：表头「付款状态」popover（已付/未付/部分付/全部显示）、「生产进度」popover（4 固定项 + 自定义 + 显示全部） | `dr(779)`=付款状态 @`479345`；`dr(1216)`=生产进度 @`482765`；`Bo=dr(1187)/dr(1309)/"已订玻璃"/dr(1202)` | `Home.vue:1075` / `1101`（`popoverTitle`） | ⚠️ 偏离 | 功能对，**选项顺序不同**：旧版「生产进度」= 4 个固定项 → 分隔线 → 自定义项 → 「显示全部」**收尾**；新版 `PROGRESS_OPTIONS`（`Home.vue:237`）= **「显示全部」开头** + 4 固定项，且**没有自定义项那一组**（也没有 localStorage 自定义操作名支持，与 G8 同源）。付款状态旧版顺序 = 已付/未付/部分付/**全部显示收尾**（`Po`），新版 `PAYMENT_OPTIONS`（`Home.vue:236`）= 全部显示开头。 |
| J10 | 工具栏：查询更多 / 视频 / 刷新 / 显示全部↔未生产 / 经营看板 | 查询更多 `dr(1355)`@`468205`（`ms`=`457563`）/ 视频按钮 @`469487`（`onClick:Rt` @`469414`，`Rt`=`328940`，面板标题 `dr(749)`=视频教程）/ 刷新 `dr(1414)`@`467849` / 显示全部↔未生产 `dr(624)`@`468568`（`Ui`）/ 经营看板 `dr(470)`@`468029`（`Is`=`464203`） | `Home.vue:6-30` | ⚠️ 偏离 | 刷新/显示全部↔未生产/经营看板 **已做**；**「查询更多」(`ms`，弹窗「查询订单」500px：客户 autocomplete/安装地址/起止日期+快捷项/只含生产单) 与「视频」(`Rt`) 未做**。属工具栏维度，此处仅标注不展开。 |

---

## 计数

共 **67** 条（`I1` 是纯清单行、不判）。其中：

| 判定 | 条数 | 占比 |
|---|---|---|
| ✅ 已做 | 12 | 18% |
| ⚠️ 偏离 | 29 | 43% |
| ❌ 未做 | 25 | 38% |
| ❓ 未确认 | 0 | — |

> **没有一条 ❓ 未确认** —— 旧版 Home 段（`>327000`）的字符串全部可从 `dr` 表解出，本次引用到的每个偏移都已实际读回代码。

---

## 给下一步的三条建议（按性价比）

1. **E8 + F2 是「静默错数」**：已付列不认 `已分配金额`、改日期不重算 `截止日期` —— 这两条不会报错，只会让界面数字慢慢对不上。优先修。
2. **D3（改客户名只改字符串）是语义级偏离**：订单的 `client_code` 与 `client_name` 会脱钩，后续财务抽屉/对账按 `客户编号` 取数必然对不上。要么补 `finance_updateOrderCustomer` 语义（迁移订单归属），要么在 UI 上把「改客户名」降级成「改客户显示名」并写清楚。
3. **A3（展开行不是 Hui 子表）是架构级偏离**，它连带掉了一整片能力（I8 之外：子表勾选、加价项、单行算料出生产单、`disable-editing`、`highlight-order-query`、级联全选 J8）。若要补，得先把 `Hui.vue` 的两张表拆成可复用组件 —— 这本身就该单独立项，别塞进 Home 的补丁里。

## 复核命令（可原样跑）

```bash
# 解码 dr 表某个索引
node legacy/decode-token.mjs dr 1017        # → "手动更新进度"

# 找某个字符串在 Home 段（>327000）的渲染偏移（自动放宽到 1–3 字符的局部别名）
node -e 'const fs=require("fs"),s=fs.readFileSync("legacy/js/Home-d6b13b9a.js","utf8"),n=1017,re=new RegExp("\\b[A-Za-z_$][A-Za-z0-9_$]{0,2}\\("+n+"\\)","g");let m;while((m=re.exec(s)))if(m.index>327000)console.log(m.index,m[0])'
```

## 本次顺带产出的「旧版自身瑕疵」清单（比实现它们更值钱）

1. **`la()` 挂错字段**：打单操作底色函数绑在业务员/打单人**人名**上，恒返回 `""`（`343333` / 调用点 `485666`、`486260`）。文档 §3 那句描述是**错的**。
2. **删除被拒时弹的是绿色 success**：「已确认的单只能工厂删除！」走 `ElMessage.success`（`Si`，`385975` 起的末句）。
3. **「取消」不还原业务员/打单人**：`an` 快照只存了 定金/订单备注/安装地址 三个，另两个字段的改动留在行里（`472119`）。
4. **`bs = e => hs(e)` 是层空壳**：`hs` 与 `bs` 之间只隔 `ps`/`Ls` 两个 computed，直接写 `hs` 即可。
5. **进度对话框「操作名称」的 `onBlur` 会静默写 localStorage**（`Ua`→`Ia`）：只是失焦就会把当前输入**登记成全局自定义操作项**，用户可能只是想改个字（`346306`/`346237`）。
