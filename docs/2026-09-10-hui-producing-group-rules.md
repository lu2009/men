# 生产类模板「部件过滤/分组规则」逆向分析

> ## ⚠️ 文档状态（2026-09-10 更新）
> 本文档的 **§2 / §3 是早期基于 `Hui.formatted.js` 的近似结论，部分已被证伪，且实现方式已改变**：
> - **§2 的「正则分组」不是原版做法**。原版是**显式关键词数组 + 排除词**，且**四条列（doorsheet / doorframe / windows）
>   在四个引擎（引擎A 玻璃合片单 / 引擎B 生产单 / oldSheet D、E2 定制单）里规则各不相同**。
>   权威规格见 **`docs/2026-09-10-template-field-audit.md` §15（doorsheet）与 §16（doorframe/windows）**。
> - **§3「扣板厚拼进扣板宽/高」的说法只对部分引擎成立**：引擎B平开、引擎B吊趟、oldSheet平开 的 windows 都**没有**扣板厚拼接；
>   只有 **oldSheet吊趟**（普通 `*`）与 **引擎B吊趟**（`*<br>`）有。
> - 代码里原有的 `PING_RULES` / `DIAO_RULES` / `groupPart` / `partOrder` / `frameText` / `windowsPartText` / `partText`
>   **已全部删除**，四列现在完全由显式关键词驱动。
> - 本文档 §0/§1/§2.5（部件激活）/§8 仍然有效；**§2/§3 只作为历史记录保留**。
>
> 另外：`Hui.formatted.js` 会把 `.join`/`.push` 等方法名替换成随机字典字符串，**取真值必须用原始 chunk
> `legacy/js/Hui-d088417c.js`**（工具 `/tmp/huidrive/orig.py`）。

> 数据来源：`legacy/js/Hui-d088417c.js`（权威 minified；`Hui.formatted.js` 是可读参考但方法名/键名被污染，勿直接采信）、`legacy/hui-stringmaps.json`（静态串表，运行时偏移 +497）。
> 目的：供 Rust + Vue3 重构版按原版语义实现「生产单/生产单定制/玻璃合片」各列的部件归属。

---

## 0. 核心结论（先读这条）

**分组不是按「模板名」选，而是按「行型（平开 ping / 移门 diao）」选。**

旧版一张订单可同时含平开门行（`ping_hui`）与吊趟/移门行（`diao_hui`）。每个「生成函数」对两类行各套一套引擎：

```
生成函数 → { 平开引擎, 移门引擎 }
```

模板（mode）只决定**输出记录结构**（扁平 / oldSheet 嵌套 / 尺寸列 / 标签），**不决定**分组规则。

**钻石型不是独立引擎**，而是平开引擎内部的一个子分支（引擎 B / D 都有）。

---

## 1. 模板 → 引擎映射表

| 模板 (mode) | 生成函数 | 平开行引擎 | 移门行引擎 | 输出结构 | **模板实际字段族** |
|---|---|---|---|---|---|
| **product**（生产单） | `calculateReceipt` | **B** | **C** | 扁平 | `produces` |
| **product1**（生产单1/定制） | `calculateReceiptForCustomed` | **平板尺寸引擎** | **E** | 尺寸列 | `produces` |
| **product2 / product3**（生产单定制） | `calculateReceiptOld` | **D** | **E2** | 旧 `oldSheet` 嵌套 | `oldSheet` |
| **glass**（玻璃合片单） | `calculateGlass` | **A** | **A2** | 扁平 + 玻璃片 | `produces` |
| **glassHole**（玻璃订单） | `Glasslist` | —（独立玻璃列表） | — | 玻璃片列表 | `glassInfoList` |
| **product4** | `lableForMaterial` | —（标签引擎） | — | 标签字段 | **`produces`**（实测模板是生产单表，非标签版式） |
| **product10**（生产标签） | `lableForProduct` | —（标签引擎） | — | 标签字段 | 标签版式（无 table 族） |
| receipt / FinalReceipt / ReceiptList | （回执组装） | —（逐行回执字段） | — | 回执 | `receipt` |
| lable（标签） | （标签组装） | — | — | 标签字段 | 标签版式（无 table 族） |

> **product5–9**：`getTemplates` 返回 17 张模板（含 product5–9），但**代码里没有 product5–9 的独立生成逻辑**（grep 为 0）——它们共用 `product` 的引擎/生成分支。重构版中 product / product4–9 可共用同一套数据源。
>
> ⚠️ **数据源分发必须按「模板实际字段族」而非 mode 名**（`extractTableColumns` 探测 `produces`/`glassInfoList`/`oldSheet`/`receipt`，全无则按标签版式）。
> 按 mode 名分发会踩两个坑：① `mode.startsWith('product')` 会把 **product2/3**（oldSheet）和 **product10**（标签）提前吞掉，令 oldSheet / 标签分支成为死代码；② **glass 与 product 同属 `produces` 族**，只能靠 mode 名区分引擎（glass → `glassProduces`，其余 → `productionProduces`，product1 → `product1Produces`）。
> 实现：`templatePayload(tpl, mode)`，`printCurrentTemplate` 与 `renderTemplatePreview` 共用。

---

## 2. 各引擎过滤规则（列关键词 + 排除）

> ⚠️ **本节为早期近似结论，实现方式已废弃**——见文首「文档状态」。权威规格：审计文档 §15/§16。保留仅供追溯。

### 2.1 平开族

**引擎 B**（product 平开）
| 列 | 关键词（含则归） | 排除 |
|---|---|---|
| 门扇 doorsheet | 光企 / 方 / 封板高 / 封板宽 / 龙骨横 / 龙骨竖 / 门扇高 / 门扇宽 / 收口 / 封边横 / 封边竖 / 玻璃高 / 玻璃宽 | 含「亮窗玻璃」 |
| 外框 doorframe | 门框高 / 门框宽 ＋ 追加 前框 / 后框 / 门板 | — |
| 亮窗 windows | 扣板 / 上亮横 / 上亮窗玻璃 / 压线 | — |
| 钻石变体 | 门扇 → 左固玻璃 / 右固玻璃 / 门玻璃；外框 → 左边 / 右边 / 斜长 / 竖框 | — |

- 特殊：前框高/后框高 ＋ 前包加长/后包加长；玻璃「单玻/无玻」数量减半；套线名由 `套线种类`。

**引擎 D**（product2/3 平开，旧 schema）
| 列 | 关键词 | 排除 |
|---|---|---|
| 门扇 | 光企 / 方 / 龙骨横 / 龙骨竖 / 门扇高 / 门扇宽 / 收口 / 封边横 / 封边竖 / 玻璃高 / 玻璃宽 | 含「**上亮玻璃**」 |
| 外框 | 门框高 / 门框宽 ＋ 门板 / 前框 / 后框 | — |
| 亮窗 | 扣板 / 上亮横 / 压线 / **封板** / 上亮窗玻璃 | — |
| 钻石变体 | 同 B | — |

> ⚠️ B 与 D 的唯一语义差异之一：**排除词不同**（B 用「亮窗玻璃」，D 用「上亮玻璃」）；D 不带封板、亮窗多「封板」。

### 2.2 推拉族

**引擎 C**（product 移门，带封板）
| 列 | 关键词 | 排除 |
|---|---|---|
| 门扇 | 光企 / 勾企 / 合页 / 锁 / 收口 / 方 / 封板高 / 封板宽 / 纱网 / 玻璃高 / 玻璃宽 | 含「亮窗」 |
| 外框 | 边封 / 下轨 / 上轨 / 滑 / 固定 / 移动 / 上横 / 盖板 | 含「企」 |
| 亮窗 | 中柱 / 亮窗玻璃 / 槽 / 压线 ＋ 扣板（非扣板厚） | — |

- 外框特殊：`边封数` → quantity；`轨道长` → result（滑/左右盖板/轨道盖板）；`下滑/下轨` 前置 `轨道种类`；吊轨时 `上滑/上轨` 替换为 `轨道种类`。
- 套线：`包宽 / 包高` → **追加到外框**，前缀 `套线名：{套线种类}`。
- 扇数：`一固一活` → 玻璃数量 1；`双活` → 2。

**引擎 E**（product1 移门）
| 列 | 关键词 | 排除 |
|---|---|---|
| 门扇 | 光企 / 勾企 / 合页 / 锁 / 收口 / 方 / 纱网 / 玻璃高 / 玻璃宽 | 含「亮窗」 |
| 外框 | 同 C（边封…盖板） | 含「企」 |
| 亮窗 | 中柱 / 亮窗玻璃 / 槽 / 压线 ＋ 扣板（非扣板厚） | — |

**引擎 E2**（product2/3 移门，oldSheet）
| 列 | 关键词 | 排除 |
|---|---|---|
| 门扇 | 同 E | 含「亮窗」 |
| 外框 | 同 C/E | 含「企」 |
| 亮窗 | 中柱 / 亮窗玻璃 / 压线（**需 `亮窗总高 > 门洞高`** gate）＋ 槽 / 封板高 / 封板宽 ＋ 扣板（非厚） | — |

> C 带封板，E/E2 不带；E2 亮窗需「亮窗总高 > 门洞高」且不含「槽」（与 E 有差异）。

### 2.3 玻璃族

**引擎 A**（glass 平玻）：门扇 = 玻璃 / 门扇（**无排除**）；只写 doorsheet，无外框/亮窗拆分。
数量：面/底玻 无玻或单玻 → 整量，否则 `/2`；`parentSubsidiary` → 4×/2×；`diamond` → 3×。

**引擎 A2**（glass 吊玻，单列）：门扇 = 玻璃（排「亮窗」）；亮窗 = 亮窗玻璃（排「压线」），并入 doorsheet 单列。

### 2.4 平板尺寸引擎（product1 平开）

**不是关键词分组**，而是「部件名 → 尺寸列」映射：

```
门框高→frameHeigth  门框宽→frameWidth   玻璃→glassSize
光企高→sheetHeigth  上下方→sheetWidth
扣板宽→kouWidth     扣板高→kouHeigth     扣板厚→kouThickness
```

product1 的 `kouWidth / kouHeigth / kouThickness` 列即由此而来（其他生产模板无此列）。

---

## 2.5 部件激活规则（state）—— 决定部件算不算 / 显不显示

分组（第 2 节）决定「部件归哪一列」；**激活**决定「部件是否进入算料结果」。原版共 **12 个算料引擎**（6 个 ping 平开 / 6 个 diao 移门，规则高度重复），对每个部件按行字段判定 `state`（`state=true` 激活 / `false` 禁用）。全量判定点约 291 处。

### 控制 state 的字段全集（11 个）

| 字段 | 条件 | 受影响部件 | 效果 |
|---|---|---|---|
| **底玻 / 面玻** | 单玻（底玻或面玻 = "无"） | 含「玻璃宽 / 玻璃高」且不含「单玻」 | 存「X单玻」件 → 本体禁 + 单玻件启；否则本体启 |
| | 双玻（都有值） | 含「单玻」 | 禁（启普通玻璃件） |
| **扇数** | 为空 | 全部 diao 部件 | 整轮 diao 过滤跳过 |
| | 含「活」（活扇） | 含「活」不含「玻璃高」/ 玻璃高 且 track=轨道种类 且名含扇数 | 启 |
| | 名含扇数 + 方 / 上下方 / 固定 / 移动 / 封板(封板高>0) / 玻璃 / 盖板 | 对应件 | 启 |
| | 扇数前 2 字 = r；名含 r 且不含「扇」「扣板」 | 轨/扇前缀件（如 `2轨`、`单轨`） | 启 |
| **轨道种类** | `part.track === 行.轨道种类` 且名含扇数 | 光企 / 勾企 / 合页 / 锁 | 启 |
| **套线种类** | `part.track === 行.套线种类` | 包宽 | 启 |
| | track=套线种类 且（公式含 `h1+` ↔ 亮窗总高>门洞高 / 不含 ↔ 小于） | 包高 | 启 |
| **门洞高 vs 亮窗总高** | 门洞高 > 亮窗总高 | 含「边封」且含「无」 | 启 |
| | 门洞高 < 亮窗总高 | 含「上横」／ 含「边封」不含「无」 | 启 |
| **亮窗总高** | > 0 | 含「玻璃」或「亮窗」 | 启 |
| **亮窗数量** | N > 0 | 名含 `{N}格亮窗` | 启 |
| **墙厚** | > 0 | 其余所有件 | 启 |
| | **≤ 0（不填）且含「扣板」或「压线」** | 扣板 / 压线件 | **禁（不显示）** |
| | ≤ 0 | F槽 / 亮窗F槽高 / 扣板高 / 扣板厚 | 不激活（无显式 false，靠模板默认） |
| **封板高** | = 0 且含「封板」 | 封板件 | 禁 |
| | > 0 | 封板高件 | 启（+ v 调整） |
| **开向** | 含「收口」且 扇数(3/4/5/6扇+折叠 或 2轨3扇/单轨2扇) 且 开向不含「0」 | 收口 | 启 |
| **formula 结果** | 算得 < 0（部分引擎 < 1） | 该件 | 禁（result=0, quantity=0） |

> **注意**：原版 `state` **默认值为 false**（模板数据给定），规则只做「置 true / 置 false」。重构版是「默认保留 + 排除」模式，需把「原版置 true 才激活」的规则**转成「不满足则排除」**——风险点，逐条验证。
>
> **实证（2026-09-10）**：`isPartTrackActive`（部件 track 必须等于行「轨道种类/套线种类」）按此转换后，**光企/套线件在填与不填轨道种类时都不显示**——因为原版 track 门控是「已被其它途径激活后的附加校验」，不是唯一激活途径；直接当必要条件会误排除。该规则**已回退**。结论：**凡是"某字段必须等于某值才激活"的规则，都要确认它是不是唯一途径**，否则不可直接当排除条件。

### 确认**不**控制 state 的字段（8 个）

| 字段 | 实际用途 |
|---|---|
| 边封数 | 只参与 `widthIncrement*(2-边封数)` 增量、数量循环 |
| 轨道长 | 只覆盖 `result`（滑/盖板长度），非 state |
| 单双丁 | 不参与部件过滤 |
| 吊脚 | 公式变量 `j`、门尺寸串 |
| 洞尺 | 改 h/w/h1 初值（间接触发「结果<0」禁用） |
| 门洞宽 | 公式变量 |
| 五金 | 取「合页」项的减尺改 v |
| 加价项目 | 仅价格 |

### 数值型禁用（所有引擎都有，必须实现）
部件算出 `formula` 后：
- **ping**：结果 **< 0** → `state=false, result=0, quantity=0`
- **diao**：结果 **< 1 且名不含「滑/单轨」** → 禁用（滑/单轨件豁免）
- **扣板厚联动**：若「扣板厚」算出负值 → **「扣板高 / 扣板宽 / 压条」一并禁用**（ping 族为「扣板/压条」，diao 族为「扣板高/扣板宽」）

### 洞尺/净尺 对部件激活的**间接影响**
洞尺不直接控制 state，而是：**改小尺寸（`w`/`h`，有亮窗改 `h1`）→ 部件按公式算出更小/负的 `result` → 触发上面的负值禁用**。
例：部件 `=w-100`，门洞宽 80 + 洞尺(-6) → w=74 → result=-26 → 该部件从生产单消失。

---

## 3. 特殊规则（跨引擎）

> ⚠️ 本节表中的「扣板厚」一行**只对 oldSheet吊趟 / 引擎B吊趟 成立**，其余引擎无拼接。见文首「文档状态」。

| 规则 | 说明 |
|---|---|
| **套线归属** | 推拉 → 外框（`套线名：{种类}` + 包宽/包高）；平开 → 进 `basicInfo`（不进外框） |
| **扣板厚** | 不独立成行。生产单无「扣板厚」列，但以 `材料:result*扣板厚*数量` 格式拼进「扣板宽/高」文本（亮窗/扣板列） |
| **墙厚控制** | **墙厚 ≤ 0（不填）→ 含「扣板」或「压线」的部件不激活（不显示）**；「F槽 / 亮窗F槽高 / 扣板高 / 扣板厚」需 墙厚>0。详见 §2.5 |
| **边封/上滑/下滑/轨道** | → 外框（排除含「企」的部件） |
| **亮窗总高** | 参与平方（`宽×max(门洞高,亮窗总高)`）、套线长度、部件 `h1` 变量；E2 亮窗收集需 `亮窗总高 > 门洞高` |
| **未命中件** | 五金 / 挖孔图 / 拉手等不含任何列关键词的部件 → **不显示**（不落入任何列） |
| **钻石型** | 平开子分支：门扇 左固/右固玻璃/门玻璃；外框 左边/右边/斜长/竖框 |

---

## 4. 可合并 / 必须区分

**可合并**（统一引擎 + 变体 flag）：
1. 平开 B+D → 一个「平开引擎」，flag：`hasSealBoard`（封板高/宽）、`excludeWord`（亮窗玻璃 vs 上亮玻璃）、`windowSet`、`oldRecord`。钻石分支共享。
2. 推拉 C+E+E2 → 一个「推拉引擎」，flag：`hasSealBoard`、`upperWindowSet`（是否含「槽」）、`upperWindowGatedByHeight`（是否需 亮窗总高>门洞高）。
3. 玻璃 A+A2 → 一个「玻璃引擎」，按行型切门扇/亮窗集。

**必须区分**：
- 平开 vs 推拉：外框/门扇关键词完全不同，不可合并。
- 玻璃 vs 门：玻璃无部件分组。
- product1 平开「平板尺寸引擎」：尺寸字段映射，独立。
- 三种输出 schema：新扁平（product / product1-diao / glass）、旧 oldSheet（product2/3）、尺寸列（product1-ping）——数据结构不同，需分别保留。

---

## 5. 重构版实现对照（`app/src/views/Hui.vue`）

当前实现（2026-09-10）：

| 函数 | 作用 |
|---|---|
| `groupPart(p, lineType, diamond)` | 按行型选规则表（`PING_RULES` / `DIAO_RULES` / `DIAMOND_RULES`）→ 返回 `'doorframe' \| 'windows' \| 'doorsheet' \| null` |
| `isWallThicknessActive(key, l)` | 墙厚≤0 时含「扣板 / 压线 / F槽」的部件不激活（原版 380921/414977/392965） |
| `isLightWindowActive(key, l)` | 亮窗件按 亮窗总高/门洞高/亮窗数量 激活；边封(无/非无)、上亮/上横 按 门洞高 vs 亮窗总高 |
| `isGlassActive(key, l, parts)` | 单/双玻切换：单玻用「X单玻」件替代本体；双玻禁用含「单玻」件 |
| `isShouKouActive(key, l)` | 收口按 扇数/折叠/开向 激活 |
| ~~`isPartTrackActive(track, l)`~~ | ⚠️ **已回退**：原版 track 门控是"激活后的附加校验"，直接当必要条件会误排除光企/套线件（详见下方注意） |
| 负值禁用 | `isResultActive(key, result, lineType, kbThickNeg)`：ping `<0`、diao `<1`（滑/单轨豁免）；扣板厚负 → 扣板高/宽/压条 联动禁用 |
| `applyWidthIncrement(parts, l, f)` | 边封数≠2：玻璃宽增量/扇数 → 加「上下方」v；轨道增量 → 减 轨道件(上滑/上轨/下滑/盖板)v（原版 widthIncrement） |
| `swingWallDeduction(l, extra)` | 按「单双丁」(单丁/双丁/上丁/上丁加单丁/上丁加双丁)减 w/h（原版 swingWall） |
| `applyHinge(parts, l, f)` | 行五金含「合页」→ hinge[项].{上下方减尺,光企减尺寸} 取负加到部件 v（原版 hinge） |
| `holeDeduction(l)` | 洞尺/单包/双包洞尺 按公式 resetSize/TaoDong 减 w/h（原版） |
| `partOrder(name)` | 扣板宽 < 扣板高（扣板厚不参与排序） |
| `partText(list, lineQty)` | `材料:result*(quantity×行数量)`，`<br>` 连接 |
| `windowsPartText(win, lineQty, allParts)` | 扣板厚以 `*扣板厚值*` 拼进扣板宽/高；扣板厚件本身不独占行 |
| `productionProduces()` | product / product4-9：三列 + door/basicInfo/OrderID/lockImg/remark |
| `oldSheetProduces()` | product2/3：三列 + client/material/size/color/lockway/orderID/address |
| `product1Produces()` | product1：尺寸列（goods/doorSize/sheet*/frame*/kou*/glassSize） |
| `glassProduces()` / `glassInfoProduces()` | glass / glassHole |
| `labelRows()` | lable / product10 |

**已对齐**：按行型分流（平开/移门/钻石）、扣板厚 `*扣板厚*数量`、未命中件不显示、边封/滑/轨入外框。

**待核对**：平开与推拉的「套线归属差异」（推拉→外框，平开→basicInfo）、钻石型实测验证、E2 的「亮窗总高>门洞高」gate。

---

## 6. 证据行号（`Hui-d088417c.js`，deobfuscated 参考）

| 项 | 位置 |
|---|---|
| 生成函数 | `calculateGlass`=10213、`calculateReceipt`=10595、`calculateReceiptOld`=11153、`calculateReceiptForCustomed`=11674 |
| 门扇数组 | A=10346、B=10761、C=11001、D=11310、E2=11525、E=11970 |
| 外框 | 边封群 11013/11536/11979；diamond 左边群 10776/11324 |
| 亮窗 | B=10806、C=11041、D=11349、E2=11563（带 亮窗总高>门洞高 gate）、E=11998 |
| 扣板厚拼接 | 12512–12515 |
| `Hui.formatted.js`（污染参考） | 引擎 C@11431、E2@11998、E=12475 |

---

## 7. 未确认项

- 各引擎对应的**确切产品名/型材名**未逐个回溯（引擎由运行时 `diamond`、品牌表、推拉 `轨道种类/扇数/边封数` 判别）。
- product5-9 的具体差异（无独立逻辑，但模板版式可能不同）未逐一对照。
- 玻璃族 A/A2 的完整数量修正规则（单玻/双玻/钻石/子母）需以 `glassPiecesOf` 实际行为复核。

---

## 8. 各模板「列内容」精确拼接规则（运行时解码提取，2026-09-10）

> 本节规则全部由**运行时解码器**求得真值（静态 `hui-stringmaps.json` 是未旋转错版，`Bao`/`双开内右` 等污染值不可信）。
> 解码器链：`_0x11f592`/`_0x59f9e4`/`_0x43b0d8`/`_0x3a973c` → `_0x250a`；base64 表 `_0x1ee4`（1010 项，offset 292692）；旋转 IIFE offset 290755 **转 497 次**。
> 校验位：`_0x250a(711)`='Hui'、`(329)`='开门红试用号'、`(1022)`='directionImageMap'、`(374)`='lockImg'、`(691)`='value'、`(423)`='join'、`(447)`='push'、`(990)`='filter'、`(566)`='includes'、`(1144)`='<br>'。
>
> ⚠️ **重要更正（2026-09-10 实测）：并非所有 accessor 共用同一张串表。**
> 打印/回执主逻辑区（accessor `l`/`x`/`r`，offset 430000–680000）与 tokens.json **一致**，已多处交叉验证
> （`l(958)`→赋给 size、`l(602)`→glass、`l(1064)`→边封数与 0/1/3/4/5→双丁墙/单丁墙/上丁墙/上丁加单丁/上丁加双丁 吻合）。
> 但另一批组件用 accessor `e` 时 `e(443)` 明显是 **ds/租户标识**（拼进 fetch 的 param2、`t[e(443)].ping_column`），
> 与 tokens.json 的 `443='家家发门业'` **冲突**。=> 取真值时**必须用上下文自证**，不能只靠索引查表。

### 8.1 produces（生产单）：订单信息 basicInfo
```
items = []
[门洞高, 门洞宽, 墙厚].filter(v=>v && v!==0) 非空 → push(join("*"))   // → 2000*800*100（墙厚直接拼入，无「墙厚」二字）
亮窗总高 !==0 → push( diamond ? "*"+亮窗总高 : "亮窗高："+亮窗总高 )
吊脚   !==0 → push("吊脚："+吊脚)
洞尺 非空 → items.unshift(洞尺)                                        // 前置
[面玻,底玻,玻璃厚].filter(Boolean) 非空 →
   无底玻 && 有面玻 → push(面玻 + "*单玻")
   无底玻 && 无面玻 → push("无玻璃")
   否则             → push(面玻 + "+" + 底玻 + "*" + 玻璃厚)
basicInfo = items.join("<br>") + "<br>" + 开向   （套线种类存在时：+ "<br>" + 套线种类 + 开向）
```
> 另：`door`(客户/门类) = `[客户, 型材, 颜色].filter(Boolean).join("<br>")`；`lockImg`/`openImg` = `directionImageMap[getOriginalOpenDirection(开向)]`(平开) / `[扇数+开向]`(移门)。

### 8.2 receipt（客户回执单）逐列
| 列 | 规则 |
|---|---|
| `profile` | 型材（**纯型材**） |
| `profile2` | 型材 + `<br>` + 颜色 |
| `direction` | 平开 = `套线种类+开向`；移门 = `开向`（均无分隔符） |
| `openImg` | `directionImageMap[ getOriginalOpenDirection(开向) ]`(平开) / `[扇数+开向]`(移门) |
| `glass` | 无底玻+有面玻 → `单玻:{面玻}*{厚}mm`；都无 → `无`；钻石 → `固玻:{底玻}<br>门玻:{面玻}*{厚}mm`；厚=0 → `背板:{底玻}<br>面板:{面玻}`；否则 → `底玻:{底玻}<br>面玻:{面玻}*{厚}mm` |
| `size` | `高{高}宽{宽}` + `*亮高{亮窗总高}` + `*{墙厚}` + `吊脚{吊脚}`（墙厚直接值、无「墙厚」二字） |
| `quantity` | 数量 |
| `price` | 单价>0 ? 单价 : `"/"` |
| `amount` | `Math.round(100×金额)/100` |
| `pricing` | 套：`•单价元/套*数量=金额元`；方：`•单价元/方*平方(3位)=金额元`；再加价项目 |
| `remark` | 平开：`[打折, 轨道种类, 五金, 墙型, 安装地址, 前后包, 备注]`；移门：`[打折, 扇数:, 轨道种类:, 五金, 单双丁, 安装地址, 备注]` |
| `maker` | `userinfo.name`（当前登录用户） |

### 8.3 FinalReceipt / ReceiptList
- **FinalReceipt（收据单）**：与 `receipt` **同源行对象**，仅模板列选 `profile`（而非 profile2）、无 doorImg。
- **ReceiptList（出货清单）**：receipt 基础上 + 两列特有位——
  - `date` = 行日期 ?? 订单回执日期
  - `payment` = `未收 = 总价-定金`；`<=0 → 已付清`；`>=总价 && 总价>0 → 全部未付`；否则 `部分付`

### 8.3b hiprint 载荷形状（决定模板能不能印出内容，极易踩坑）

原版调用 `hiprint.preview(模板名, 载荷)`，载荷形状按模板分三类：

| 模板 | 载荷 | 说明 |
|---|---|---|
| product / product1 / glass | `{ produces: [行…] }` | **对象**，表 `field=produces` 绑整个数组；表外无文本元素 |
| receipt / FinalReceipt / ReceiptList | `[{ …表头字段, receipt: [行…] }]` | **数组**（1 个元素=1 页），表头字段在最外层，表绑 `receipt` |
| glassHole | `[{ date, glassInfoList: [行…] }]` | 同上；`date` 在表格外，绑顶层 |
| **product2** | `[行对象…]` | **数组本身**（每行一页），行 = `{client,material,qrcode,orderID,maker,lockImg,lockway,color,glass,size,address,remark,quantity,doorImg,`**`oldSheet:[{doorsheet,doorframe,windows,doorImg}]`**`}` |
| **product3** | `[配对行对象…]` | product2 基础上**两行合一**（见下） |
| lable / product10 | `[标签行…]` | 数组本身，每元素一张标签 |

> 关键：**文本元素绑当前数据上下文，表格元素绑 `field` 指定的数组**。
> 所以 product2/3 的 `material`/`size`/`color` 等平铺字段必须和 `oldSheet` 嵌在**同一个对象**里，
> 不能写成 `{oldSheet: rows}`（那样表能出、表头字段全空）。

**product3 双联（`_0x1ebfe1`）**：`for (i=0;i<n;i+=2)` 取 `a=rows[i]`、`b=rows[i+1]`；
`b` 存在则 `a` 的每个键各复制一份到 `a[键+"1"]`（**含 `oldSheet` → `oldSheet1`**），奇数尾行原样。
模板里 `client1/material1/size1/…/remark1` 与第二张表 `oldSheet1` 正对应这套后缀。

### 8.3c product2/3 的 `size` 列
```
items = []
[门洞高, 门洞宽, 墙厚].filter(v => v && v !== 0) 非空 → push(join("*"))
亮窗总高 > 0 → push("总高" + 亮窗总高 + (亮窗数量 > 0 ? "*" + 亮窗数量 + "格" : ""))
洞尺 非空   → items.unshift(洞尺)
size = items.join("<br>")
```
> 与回执 `size`（8.2）**不同**：这里用「总高{亮窗总高}」且带「{亮窗数量}格」后缀，回执不带。

### 8.3d 打印引擎必须用 vue-plugin-hiprint 0.0.60

**结论（2026-09-10 实测）**：打印引擎依赖 = `vue-plugin-hiprint@0.0.60`
（旧版 bundle `legacy/js/vue-ade658be.js` 内嵌的版本号正是 `{"a":"0.0.60"}`）。

> ⚠️ **不要用 `@sv-print/hiprint`**（已卸载）。它是后来的 fork，内置元素类型只有
> text / image / longText / table / html / customText / pageBreak / hline / vline / rect / oval
> ——**没有 barcode / qrcode**。而 17 张模板全含 `printElementType.type === "qrcode"` 的元素，
> 于是 `update()` 抛 `Error: 类型元素无法创建，请检查是否先注册了插件？`，
> `printPanels` 保持为空数组，随后 `getHtml/print` 再抛
> `TypeError: Cannot read properties of undefined (reading 'getLayoutStyle')` → **整张单据打印空白**。

用法（`app/src/utils/printService.ts`）：
```ts
const mod = await import('vue-plugin-hiprint')
const { hiprint, defaultElementTypeProvider } = mod.default ?? mod // UMD/CJS，dev 预打包只有 default
await import('vue-plugin-hiprint/dist/print-lock.css')
hiprint.init({ providers: [new defaultElementTypeProvider()] })   // 必须 new，providers 会被 .addElementTypes(...) 直接调用
```
> - `print-lock.css` = 旧版打印样式资源（锁定打印版式的 CSS），包内自带，需显式 import。
> - 该包无 `.d.ts`，类型声明见 `app/src/types/vue-plugin-hiprint.d.ts`。
> - 引擎走 `import()` 分包（约 3.1MB），只在打印时加载，不影响首屏。

**验证方法**（真实引擎，非本地复刻）：在浏览器里
`new hiprint.PrintTemplate({template})` → `await tpl.update(tpl.config)` → `await tpl.getHtml(payload)`，
再对返回的 DOM 做关键字断言。注意 `getHtml()` 返回的是 **jQuery 对象**（`h[0]` 才是 DOM）。

### 8.4 glass（玻璃生产单，produces 的同族）
> 注意：`glass` 与 `produces` 是**同一数据源的两个模板**，列不同源值也不同。

| 列 | 规则 |
|---|---|
| `client` | 订单客户名（**在表格内**，非表头） |
| `door` | `[型材, 颜色].filter(Boolean).join("<br>")` —— **不是门类名**（早期实现误用门类，已修） |
| `OrderID` | 回执单号 |
| `basicInfo` | 同 8.1 `basicInfoText(l)` |
| `lockImg` | `directionImageMap` 按开向（同 8.1） |
| `doorImg` | 行图片 `image_url` |
| `remark` | `produceRemark(l)` |
| `doorsheet` | **按组拼 `部件名:result`**，`<br>` 连接，组末补 `数量:N`（N = 组内部件 quantity 之和 × 行数量 × 单双玻系数）。<br>分组：平开 = `玻璃`\|`门扇` 一组；移门 = 组1 `玻璃`（排除含「亮窗」）、组2 `亮窗玻璃`（排除含「压线」）。<br>**单双玻系数**：底玻、面玻均非「无」→ `0.5`，否则 `1`。 |

### 8.4b glassHole（玻璃订单，glassInfoList）
> 与 8.4 的 `glass` 不同：此表**一行玻璃一条**，按部件名精确命中拆分。

| 列 | 规则 |
|---|---|
| `OrderID` | 回执单号 |
| `client` | 订单客户名 |
| `date` | 当天日期 |
| `thickness` | `行["玻璃厚"]`（**纯数值，无 mm**） |
| `doorImg` | 公式**挖孔图**：`formula_images` 按行开向取（见 8.6） |
| `remark` | `[备注, 安装地址].filter(Boolean).join("<br>")` |

行的产生与取值（**按部件名匹配 `materialName`**）：

| 分支 | glassName | width / height 来源 | quantity |
|---|---|---|---|
| 有亮窗（`亮窗总高>0`）且命中 `亮窗玻璃宽`/`亮窗玻璃高` | 底玻非无 → `亮窗玻璃-{底玻}`，否则 `亮窗玻璃-{面玻}` | 两部件 `result` | `部件quantity × 行数量`（**不折半**） |
| 钻石（`isDiamond`）：`左固玻璃宽/高` | `左固玻璃-{底玻}` | 同上 | 行数量 |
| 钻石：`右固玻璃宽/高` | `右固玻璃-{底玻}` | 同上 | 行数量 |
| 钻石：`门玻璃宽/高` | `门玻璃-{面玻}` | 同上 | 行数量 |
| 其余：`玻璃宽`/`玻璃高` | 底玻非无 → `底玻-{底玻}`，否则 `面玻-{面玻}` | 同上 | `部件quantity × 行数量`，**双玻时 quantity÷2** |

- 亮窗行与主玻璃行**可同时产生**（亮窗行判定只看 `亮窗总高>0`，不排斥主玻璃）。
- 末尾统一 `filter(r => Number(r.thickness) !== 0)` —— 玻璃厚为 0 的行整体剔除。

### 8.5 lable（标签）/ product10（生产标签）
| 字段 | lable | product10 |
|---|---|---|
| `door` | `型材:{型材}` | `型材+颜色`（无前缀） |
| `size` | `尺寸:高*宽` + `*吊脚/*墙厚/*亮窗` | `高*宽` + `*吊脚/*墙厚/*亮窗` |
| `lockway` | `开向:`+（套线种类）+开向 / `开向:`+扇数+开向 | （套线种类）+开向 |
| `color` | `颜色:{颜色}` | 颜色 |
| `glass` | `玻璃:{底玻}-{面玻}` | `单玻:{面玻}` / `底:{底玻}-面:{面玻}` |
| `address` | `地址:{安装地址}` | 安装地址 |
| `remark` | `[五金, "备注:"+备注]` | 备注（+加配） |
| `qrcode` | `String(单号)` | — |
| `package` | 份号 `t-i`（t=总份数） | — |
| `GlassSize` | — | 由 `BoLiGao`/`BoLiKuan` 部件配对 |

### 8.6 重构版实现对照（`app/src/views/Hui.vue`）
> 打印引擎见 8.3d；载荷形状见 8.3b。

| 原版规则 | 实现函数 |
|---|---|
| **doorsheet 列（四引擎）** | `doorsheetText(l, oldSheetEngine)` + `DS_KW` |
| **doorframe 列（四引擎）** | `doorframeText(l, oldSheetEngine)` |
| **windows 列（四引擎）** | `windowsText(l, oldSheetEngine)` |
| 门店变体（杉杉 `:<br>` / 白名单 `door` 不含客户名） | `partLine()` / `STORE_DOOR_NO_CLIENT` |
| basicInfo | `basicInfoText(l, glassEngine?)` |
| produces remark / 玻璃 remark / oldSheet remark | `produceRemark(l)` / `glassRemark(l)` / `oldSheetRemark(l)` |
| `配件:{公式.hardware}` 追加 | `appendAccessory(remark, l)`（8 个 produce 构造器都有） |
| `加配：{加价项目}` | `markupNames(l)` |
| receipt remark | `receiptRemark(l)` |
| 回执 glass | `glassSpecPrintable(l)` |
| 回执 size | `dimSizeLabel(l)` |
| 回执 pricing | `pricingDetail(l)` |
| 方向图(lockImg/openImg) | `lineLockImage(l)` |
| 墙型文本 | `wallTypeLabel(l)` |
| maker | `currentUserName`（onMounted `api.me().user.name`） |
| lable / product10 行 | `lableRow(l)` / `product10Row(l)` + `labelRows(kind)` |
| glass 生产单行 | `glassProduces()` |
| glassHole 行 | `glassInfoProduces()`（`holeImageOf(l)` 取挖孔图） |
| product2/3 行 + 双联 | `oldSheetProduce(l)` / `oldSheetProduces(paired)` / `pairRows(rows)` |
| product2/3 `size`/`glass`/`lockway` | `oldSheetSize(l)` / `oldSheetGlass(l)` / `oldSheetProduce` 内联 |
| product1 行 | `product1Produces()` |
| 载荷形状分发 | `templatePayload(tpl, mode)`（预览与打印共用） |

> 已删除的旧实现：`groupPart` / `partOrder` / `PING_RULES` / `DIAO_RULES` / `DIAMOND_RULES` /
> `frameText` / `windowsPartText` / `partText`（正则近似分组，已被关键词驱动取代）。

### 8.7 本节未实现/受限
- **`kou` 列**（引擎B平开/吊趟有该字段）：17 张模板均无此列，未实现。规格见审计文档 §16.1/§16.2。
- **名单二 `_0x2fca47`（艺佳家居门业/索力纳门窗）**：命中时 glassHole `doorImg` 用 `_0x5c8c94` 现场生成 SVG 门洞图，未移植。
- **glassHole doorImg 挖孔图**：逻辑已接（`formula_images` 按开向），但依赖公式有挖孔图数据；**亮窗行恒空**已实现。
- **product10 部件级复制张数**（`GlassSize_*` 分支 + `BoLiKuan.quantity`）、**product4（料标签 mode 11）**、**行排序**：未实现。
- **lable/product10 份数 t 的租户特例**：`labelQuantity` 已含旧版各租户 ±1 分支（旺达名门/临泉县品匠移门/美居门业有限公司/鑫隆迪门厂）。
