# 写死在模板/脚本里的样式：51 处逐条清单

> 目的：`ui-upgrade` 要改 UI，先得知道**哪些样式是保真度资产、哪些才是真的能动的装饰**。
> 本文只做分类，**不含任何改动**。

## 这份清单怎么数出来的

扫描 `app/src/**/*.{vue,ts}`，取**不在 `<style>` 块里**、且含装饰性属性
（`color` / `font-*` / `border*` / `background*` / `box-shadow` / `text-shadow` / `border-radius`）
的样板，共 **330 处**。其中：

| 性质 | 数量 | 是否本文范围 |
|---|---|---|
| 纯几何（宽高 / flex / 定位 / overflow） | 272 | ✗ 属布局，不是样式债 |
| 纯间距（margin / padding / gap） | 7 | ✗ |
| **含装饰属性** | **51** | ✓ 本文 |

⚠️ 计数只认**剥掉注释之后**仍然活着的引用。本仓库注释里成段逐字抄着旧版源码，
grep 命中默认是注释不是活代码（已栽过一次：把 `Hui.vue` 注释里 5 处 `var(--el-*)`
当成「空的 CSS 变量 bug」报了出去，实际那 5 处全在 `/* */` 与 `<!-- -->` 里）。

## 判定含义

| 判定 | 含义 | 能不能改 |
|---|---|---|
| **甲** | **旧版口径**：值逐字照抄旧版（注释里写着旧版行号） | ✗ 改 = 产生新的保真度偏离，要走差分台 + 记文档 |
| **乙** | **语义色**：值是硬编码的，但表达业务状态（红=欠 / 绿=清…） | ✗ 值不能改；可以**抽成语义 token**，前提是取值一一对应不变 |
| **丙** | **数据驱动**：值来自后端字段或配置表 | ✗ 完全不能碰，token 也管不到 |
| **丁** | **新版自加**：旧版没有对应实现 | ✓ 唯一能自由设计的一类 |

## 逐条清单

| # | 位置 | 判定 | 写死的值 | 依据 / 语义 | 处置 |
|---|---|---|---|---|---|
| 1 | `components/DashboardBigScreen.vue:68` | 乙 | `color: #3de7c9` | 大屏「订单总数」指标色 | 抽语义 token |
| 2 | `components/DashboardBigScreen.vue:72` | 乙 | `color: #00d2ff` | 大屏「订门总数」指标色 | 抽语义 token |
| 3 | `components/DashboardBigScreen.vue:76` | 乙 | `color: #409eff` | 大屏「订单总金额」；= EP primary | 抽语义 token |
| 4 | `components/DashboardBigScreen.vue:80` | 乙 | `color: #67c23a` | 大屏「已付金额」= 成功色 | 抽语义 token |
| 5 | `components/DashboardBigScreen.vue:84` | 乙 | `color: #f56c6c` | 大屏「未付金额」= 危险色 | 抽语义 token |
| 6 | `components/DashboardBigScreen.vue:106` | 乙 | `{ background: pieStyle }` | 客户金额占比饼图（`conic-gradient` 拼的） | 抽语义 token |
| 7 | `components/DashboardBigScreen.vue:109` | 乙 | `{ background: PIE_COLORS[i % …] }` | 饼图图例色，与 #6 同一组 | 抽语义 token |
| 8 | `components/DetailLinesTable.vue:417` | 甲 | `margin-top:4px;font-size:12px;color:#606266;line-height:1.4` | 旧版 `:2434-2435`（已选项 `join("、")` 那行） | 不动 |
| 9 | `components/DetailLinesTable.vue:780` | 甲 | `display:block;width:76px;height:52px;object-fit:contain;border:1px solid #dcdfe6;border-radius:3px;cursor:zoom-in;background:#fff` | 搬迁自 `Hui.vue` 的 `G doorImgCell` | 不动 |
| 10 | `components/DetailLinesTable.vue:815` | **丁** | `margin:0;font-size:12px;white-space:pre-wrap;max-width:340px` | **已查：旧版无依据**。`Hui.formatted.js` 里 `Tooltip` 出现 **0 次**、无 `<pre>`；`×N → 长度` 那套格式在旧版只出现在合格标签的无关文案（`QualifiedLabel.deobfuscated.js:2235`）。旧版算料按钮点下去走 `Lt` / `ht`（弹消息或面板），**不是 tooltip**。另：`partsTooltip` 全仓只在本文件，注释引的 `Hui.vue 1756-1781` 是**迁移前的自家位置**（那里现在是保存订单的代码），不是旧版依据 | 可收 token |
| 11 | `components/DetailLinesTable.vue:849` | 甲 | `font-size:11px;color:#606266` | 旧版 `:8491` 单号列 | 不动 |
| 12 | `components/DetailLinesTable.vue:909` | 甲 | `font-size:11px` | 原版 `span.clickable-header` 的设置齿轮 | 不动 |
| 13 | `components/DetailLinesTable.vue:990` | 甲 | `font-size:11px;color:#606266` | 原版「图片ID」列（只读） | 不动 |
| 14 | `components/DetailLinesTable.vue:992` | 甲 | `font-size:11px;color:#606266` | 原版「客户」列 | 不动 |
| 15 | `components/DetailLinesTable.vue:993` | 甲 | `font-size:11px;color:#606266` | 原版「客户编号」列 | 不动 |
| 16 | `components/DetailLinesTable.vue:1136` | 甲 | `font-size:11px;color:#606266` | 原版「图片ID」列（第二套列定义） | 不动 |
| 17 | `components/DetailLinesTable.vue:1138` | 甲 | `font-size:11px;color:#606266` | 原版「客户」列（第二套） | 不动 |
| 18 | `components/DetailLinesTable.vue:1139` | 甲 | `font-size:11px;color:#606266` | 原版「客户编号」列（第二套） | 不动 |
| 19 | `components/FinanceDrawer.vue:1093` | 乙 | `color: '#e6a23c'` | 「本次分配」= warning 橙 | 抽语义 token |
| 20 | `components/FinanceDrawer.vue:1102` | 乙 | `remaining_after > 0 ? '#f56c6c' : '#67c23a'` | 分配后**仍欠**红 / **已清**绿 | 抽语义 token |
| 21 | `components/FinanceDrawer.vue:1142` | 乙 | `remaining_after > 0 ? '#e6a23c' : '#67c23a'` | 分配后仍有剩 橙 / 已清 绿 | 抽语义 token |
| 22 | `components/FinanceDrawer.vue:1171` | 乙 | `amount < 0 ? '#67c23a' : '#000'` | **红冲**（负额）绿 / 正常黑 | 抽语义 token |
| 23 | `components/GlassEditDialog.vue:242` | 甲 | `font-size:${fontSize};line-height:1.6` | 旧版逐格写的 `input-style` 字号 / 行高 | 不动 |
| 24 | `components/GlassEditDialog.vue:259` | 甲 | 同上 | 同上 | 不动 |
| 25 | `components/GlassEditDialog.vue:284` | 甲 | 同上 | 同上 | 不动 |
| 26 | `components/ProductionSheetEditDialog.vue:357` | 甲 | `font-size:18px;line-height:1.6` | 旧版 `el-input` 的 `:input-style` | 不动 |
| 27 | `components/ProductionSheetEditDialog.vue:371` | 甲 | 同上 | 同上 | 不动 |
| 28 | `components/ProductionSheetSettingsDialog.vue:108` | **甲** | `margin-bottom:12px;border-bottom:1px dashed #ddd;padding-bottom:10px` | **已核**：`legacy/js/ProductionSheet.deobfuscated.js:1913-1917` 逐字相同 —— 连 `"label-width": "90px"`、`size: "small"` 都对得上 | 不动 |
| 29 | `components/ProductionSheetSettingsDialog.vue:179` | 甲 | `margin-left:6px;font-size:11px;color:#999` | 旧版残留旁注（「默认22」与真实默认 37 矛盾，照抄） | 不动 |
| 30 | `components/ProductionSheetSettingsDialog.vue:192` | 甲 | 同上 | 同上 | 不动 |
| 31 | `components/ProductionSheetSettingsDialog.vue:198` | 甲 | `margin-top:12px;font-size:13px;color:#666` | 旧版残留文案（承诺拖拽、实现只有 ↑↓，照抄） | 不动 |
| 32 | `components/ProductionSheetSettingsDialog.vue:237` | **甲** | `margin-left:8px;color:#999;font-size:12px` | **已核**：`legacy/js/Home.formatted.js:4493-4497` 的 `Ja` 常量就是这条三元组；`:5395` 与 `legacy/js/ProductionSheet.deobfuscated.js:2837` 的「已选：」span 都用它（打印管理器是同一个组件，被编进多个 bundle ⇒ 常量名各文件不同、取值相同） | 不动 |
| 33 | `components/Receipt2ElementEditor.vue:41` | 甲 | `color:#999;font-size:11px;margin-left:4px` | 旧版 `:2512-2524` / `:2552-2564` 逐字照抄 | 不动 |
| 34 | `components/ReceiptEditDialog.vue:431` | 甲 | `font-size:18px;line-height:1.6` | 旧版 `el-input` 的 `input-style` | 不动 |
| 35 | `components/ReceiptEditDialog.vue:445` | 甲 | 同上 | 同上 | 不动 |
| 36 | `components/ReceiptEditDialog.vue:467` | 甲 | 同上 | 同上 | 不动 |
| 37 | `views/Formulas.vue:1190` | **丙** | `{ background: rowBg(row.def.color) }` | 底色 = **后端字段** `def.color`，经 `rowBg()` 映射 | **不碰** |
| 38 | `views/Home.vue:155` | 乙 | `l.done ? '#52c41a' : '#bbb'` | 旧版 `:11600-11605` 行 hover tooltip；完成绿 / 未完成灰 | 抽语义 token |
| 39 | `views/Home.vue:160` | 乙 | `color:#52c41a;font-weight:700` | 同上 tooltip 的「✓ 已付清」 | 抽语义 token |
| 40 | `views/Home.vue:2656` | 乙 | `{ color:'#d9001b', fontWeight:'700' }` | 旧版 `Ju` 样式（进度后缀） | 抽语义 token |
| 41 | `views/Home.vue:2914` | 乙 | `{ color:'#409eff', fontWeight:'700', marginLeft:'4px' }` | 旧版 `Ou` `:11541`（筛选当前值） | 抽语义 token |
| 42 | `views/Home.vue:3188` | 乙 | `{ fontWeight:600, color:'#409eff' }` | 已付列只读态（`allocated_amount > 0`） | 抽语义 token |
| 43 | `views/Home.vue:3221` | 乙 | `u <= 0 ? '#67c23a' : '#f56c6c'` | 未收：**≤0 绿 / >0 红** | 抽语义 token |
| 44 | `views/Hui.vue:424` | 甲 | `color:#909399;font-size:12px;margin-top:8px` | 照抄旧版 `:13238-13246`（自动加价设置提示行） | 不动 |
| 45 | `views/Hui.vue:442` | 甲 | `color:#909399;font-size:12px;margin-top:8px` | 逐字照 `H:13248-13275`（排序方式提示行） | 不动 |
| 46 | `views/Hui.vue:459` | 甲 | `color:#909399;font-size:12px;margin-top:8px` | 同上 | 不动 |
| 47 | `views/Hui.vue:472` | **丁** | `color:#909399;font-size:12px` | 收款码弹窗说明文字，**旧版无此弹窗** | 可收 token |
| 48 | `views/Hui.vue:479` | **丁** | `width:132px;height:132px;object-fit:contain;border:1px solid #ebeef5;border-radius:4px;background:#fafafa` | 同上，二维码预览框 | 可收 token |
| 49 | `views/Hui.vue:481` | **丁** | `width:132px;height:132px;display:flex;align-items:center;justify-content:center;color:#c0c4cc;font-size:12px;border:1px dashed #dcdfe6;border-radius:4px` | 同上，「未上传」占位 | 可收 token |
| 50 | `views/Progress.vue:1104` | 甲 | `{ color: 'red' }` | 旧版 `<span style="color:red">恢复中...</span>`（`Me`），**连 `red` 关键字都照抄** | 不动 |
| 51 | `views/Progress.vue:1196` | **丙** | `{ backgroundColor: o.color }` | 色块颜色来自 `BUILTIN_COLORS` + 后端 `procedures[].color` | **不碰** |

## 汇总结论

| 判定 | 数量 | 占 51 处 |
|---|---|---|
| 甲 · 旧版口径 | **28** | 54.9% |
| 乙 · 语义色 | **17** | 33.3% |
| 丙 · 数据驱动 | **2** | 3.9% |
| 丁 · 新版自加（可自由设计） | **4** | 7.8% |
| ❓ · 未确认 | **0** | — |

**能自由改的只有 4 处。**

这推翻了「第二层是一堆可以顺手换掉的样式债」的假设 —— 第二层（写在模板/脚本里的样式）
**92% 是保真度资产或业务语义**，不是债。它对 `ui-upgrade` 的含义：

1. **甲 28 处**：改一个字就是一条新的保真度偏离，要走差分台 + 记文档。**建议整体不动。**
2. **乙 17 处**：值不能改，但可以**换一种写法**——把 `'#67c23a'` 换成 `var(--c-success)`，
   只要 token 取值与旧版色值一一相等，渲染结果逐像素不变，而语义变清楚了。
   这是唯一「既动又不动」的区域，**收益是后面换主题时这 17 处会跟着走**。
   前提：必须先建 token 表并证明取值相等（差分台可验：渲染结果不变）。
3. **丙 2 处**：物理上碰不了。
4. **丁 4 处**：唯一的设计自由区，但只有 4 处，不值得当靶子。

⇒ **「先修不够」的答案**：第二层不是靠「修」解决的，它的上限就是这 51 处里能抽 token 的 17 处。
真正的大头在**第一层**：4302 行 `<style scoped>` 装饰性 CSS，那才是能整块换的地方。

## 更正记录

### 第一轮：把「旁边有注释」当成「这条有注释」

初稿把 #10 / #28 / #32 判成「甲 · 旧版口径」，依据是「它们所在的代码块有旧版注释」。
**那是推断不是证据** —— 三处注释引的都是**邻近元素**（按钮、tab 面板）的依据，样式本身无明文引用。
已降级为 ❓。教训与 `Hui.vue` 那次 `var(--el-*)` 同款：grep 命中 ≠ 那一条有依据。

### 第二轮：把 ❓ 逐条切源码查清（结论如上表）

| # | 查法 | 结果 |
|---|---|---|
| 28 | 在 `*.deobfuscated.js` / `*.formatted.js` 里搜 `1px dashed` | ✅ **甲** — `ProductionSheet.deobfuscated.js:1913-1917` 逐字相同 |
| 32 | 搜 `已选` 找到 span，再找它的样式常量 `Ja` | ✅ **甲** — `Home.formatted.js:4493-4497` 定义、`:5395` 使用 |
| 10 | 搜 `pre-wrap` / `<pre>` / `Tooltip` / `→` / 占位文案 | ❌ **丁** — 旧版全无；`Hui.formatted.js` 里 `Tooltip` 出现 **0 次** |

⚠️ 中途一次**认错**：`Diao.deobfuscated.js:712` 有个 `{"white-space":"pre-wrap"}`，一度以为就是 #10。
读上下文才发现它挂在「包边洞尺 / 平开门丁墙」那排**公式参数按钮旁边的值**上（`<span>`，不是 `<pre>`），
与算料 tooltip 无关。**又一次「grep 命中 ≠ 同一条」。**

⚠️ 附带查明的一件事（不在本次范围，但撞见了，**结论与初判相反，记在这里以免后人重复误判**）：

`DetailLinesTable.vue` 里有 **18 处** `搬迁自 Hui.vue A-B：…` 的行号引用。逐个核过：

| 检查 | 结果 |
|---|---|
| 引用的标识符出现在 `Hui.vue` 该行区间 | **0 / 18** |
| 引用的标识符已从 `Hui.vue` 整体搬走 | 10 / 18（其余 8 处查的是 CSS 类名，仍在别处） |
| 行号是否单调、区间是否相接 | 是：`1442-1701 → 1703-1718 → … → 3567-3608` |

⇒ 这 18 处是**搬运前 `Hui.vue` 的一张完整历史地图**，**不是错误引用**。
注释写的是「搬迁自」（搬走**前**的位置），代码抽走之后行号必然对不上当前文件 ——
**它没写错，只是无法再复核。**

（初判时我把它当成「失效引用」报了出去，属**说过头**。真正准确的描述是「不可复核」，
不是「错」。判别方法记在上面那张表里，下次别再误判。）

