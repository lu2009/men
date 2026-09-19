# `/Diao`（公式管理·吊）↔ `views/Formulas.vue` 保真度审计

- 日期：2026-09-19
- 起因：用户指出「`/Diao` 其实已经有了，就是现在的公式页面 —— 既然提到了，验证一遍」
- 上游文档：`docs/2026-08-21-formula-analysis.md`（**已部分过期，本文末尾列了要改哪几处**）

---

## 0. 结论

**身份成立**：旧版 `/Diao` 就是我们现在的 `/formulas`（公式管理·吊）。路由与页面标题都能对上。

**但「有」不等于「全」**。逐块比下来，**4 块功能缺失**（其中 3D 是常驻的大块）、**6 处口径偏差**、
以及若干旧版自身的死代码。**没有一处是我推断的** —— 每条都带行号。

| # | 差在哪 | 性质 | 严重度 |
|---|---|---|---|
| 1 | **3D 预览面板**整块没有 | 缺功能 | ★★★ 常驻区域，依赖 Three.js |
| 2 | **「3D创建公式」**按钮没有 | 缺功能 | ★★ 管理员按钮 |
| 3 | **「算料神器」**按钮没有 | 缺功能 | ★★ 无门控按钮 |
| 4 | 主表格操作列**「查看3D」**没有 | 缺功能 | ★ 已在我们代码注释里承认 |
| 5 | `formulaType` 子母门拼写不同 | 口径 | ★★ 见 §3.1 |
| 6 | 我们把**尺寸存进了库**，旧版不存 | 口径 | ★★ 见 §3.2 |
| 7 | 列表弹窗**结构完全不同** | 口径 | ★ 见 §3.3 |
| 8 | 删除确认用原生 `window.confirm` | 口径 | ★ 见 §3.3 |
| 9 | 编辑区旧版首次加载前隐藏 | 口径 | ☆ 见 §3.4 |
| 10 | 列表弹窗标题文案不同 | 口径 | ☆ 见 §3.3 |

---

## 1. 身份确认（证据）

```
legacy/js/index-c3b16e3f.js:
  path:"/Diao", name:"Diao", component:()=>import("./Diao-1afe5586.js")
```

旧版整张路由表里 `Diao` 是**唯一**对应公式管理的条目（同表另有 `/hui`、`/Progress`、
`/clients_Info`、`/Qrscanner`、`/setting`、`/drawDoor`、三个 3d、`/share`、`/terminal-orders`、
`/test-addprice`）。我们的 `/formulas` → `views/Formulas.vue`，页内标题「公式管理（吊）」。
⇒ **对得上**。用户的说法成立。

下面用 `D:行号` 指代 `legacy/js/Diao.deobfuscated.js`。

---

## 2. 逐块对照

### 2.1 顶部按钮区 —— 旧版 6 颗，我们 4 颗

旧版 `D:3341-3364`，顺序与门控**逐颗**如下（门控变量 `_0x1fbe4b` = 管理员标志）：

| 旧版按钮 | 行号 | 门控 | 点击 |
|---|---|---|---|
| 查询/修改/删除公式 | 3342 | `_0x1fbe4b` | `_0x2b9a27` 开列表 |
| 公式模板 | 3346 | `_0x1fbe4b` | `_0x26bf26` 开模板抽屉 |
| **3D创建公式** | 3350 | `_0x1fbe4b` | `_0x4a37ca` |
| 开孔图 | 3354 | **无** | `_0x344e30` 切 `_0x360177` |
| **算料神器** | 3358 | **无** | `_0x3cc2b6` → `_0x3c68a4=!0` |
| 视频 | 3362 | **无** | `_0x1b1af9` |

**管理员标志的出处**（`D:3313`，逐字）：

```js
_0xb648e8["value"] = a["userinfo"].name,
_0x1fbe4b["value"] = a["userinfo"].registrant === a.userinfo.name || a["userinfo"].name === "开门红",
```

⇒ `2026-08-21-formula-analysis.md` §7.1 说的「**三个**受管理员权限控制」是**对的**，
而且那三个正是 查询/修改/删除公式 · 公式模板 · 3D创建公式。我们的 `isAdminUser`
（`role === 'admin'`）盖住了前两颗 ✓，**第三颗整个没有**。

**我们缺的两颗都不是死按钮**：

- **3D创建公式**（`D:3320` 附近 `_0x4a37ca`）：清空表单 + `_0xb3040a="swing3dDouble"`
  + `_0x579c3d=!0`（**正是 3514 行那个 3D 面板的开关**）+ 各扩展设置复位。
- **算料神器**（`D:951` `_0x3cc2b6`）：置 `_0x3c68a4=!0`，渲染在 `D:4039`，
  组件是 `ref="suanliaoShenQiRef"` 的 `_0xf4057`/`_0x148cac`/`_0x306d52`/`_0x92856f`
  —— **全是从 `Hui-d088417c.js` 借来的**，即 Diao 页复用汇算页的算料组件。

### 2.2 尺寸输入区 —— **一致** ✓

逐项核对（ref 身份见 `D:1195` 那张报错映射表）：

| 输入项 | 旧版 ref | 我们的 | 显示条件 |
|---|---|---|---|
| 公式名称 | `_0x5d22ac` | `formulaName` | 恒显 |
| 单扇最小平方数 | `_0x5247bb` | `square` | 简单门型才显示 |
| 门洞高 | `_0x1208fb` | `dimH` | 恒显 |
| 门洞宽（钻石型→「左宽」） | `_0x2fe495` | `dimW` | 恒显 |
| 母门宽 | `_0x1dfd7e` | `dimS` | 子母门 |
| 亮窗总高（钻石型→「右宽」） | `_0x497099` | `dimH1` | 恒显 |
| 墙厚（钻石型→「门宽」） | `_0x55e8eb` | `dimT` | 恒显 |
| 吊脚 | `_0x30f3a7` | `dimJ` | 简单门型 **且非平开3D**（见下） |

**⚠️ 三个字段的真实条件比看上去复杂，但对我们等价 —— 因为差别全部挂在 3D 上**：

```
D:3384  亮窗总高   v-if  !_0x240250 || _0x544b53
D:3386  墙厚       v-if  !_0x240250 || _0x4d034f
D:3388  吊脚       v-show _0x1d0fcc && !_0x240250
D:3390  吊脚（平开3D 下）→ 换成 el-switch「开启/关闭」
D:3392  开关开启时，多出一个「吊脚值:」输入框（`_0x207f3d` 为开关、`_0x30f3a7` 为值）
```

`_0x240250` 就是**「平开3D」**（`D:924`：`_0xb3040a === "swing3dDouble"`）。
我们**没有 3D ⇒ `_0x240250` 恒为假** ⇒ 三个条件分别塌缩成「恒显 / 恒显 / 简单门型」，
**正好等于我们现在的实现** ✓。

⇒ 结论：**目前结果是对的**，但不是因为我们复刻对了，而是因为缺的那块恰好只影响这几条。
**将来一旦补 3D，这三个字段（和「吊脚值」「亮窗」两个开关）必须一起回来改** —— 别当成已经做完了。

**「简单门型」的口径两边相同**，且旧版自己写了**两处**、互为印证：

- `D:2213` `formulaType==="diao"||==="ling" ? 吊脚=false : 吊脚=true`
- `D:3305` `formulaType==="ping"||"parentSubsidiary"||"double"||"diamond" ? 吊脚=true : false`

⇒ 集合就是 `{ping, double, parentSubsidiary, diamond}`，**正是我们
`formulaExtra.ts:5` 的 `SIMPLE_SQUARE_TYPES`** ✓（除 §3.1 的大小写）。

钻石型标签切换 `D:2213` `formulaType==="diamond"` → 我们的 `isDiamond` ✓。

### 2.3 快捷设置 7 弹窗 —— **一致** ✓

`D:3400-3428` 七颗按钮：亮窗示意图 / 洞尺设置 / 包边洞尺 / 平开门丁墙 / 平开门合页 /
边封增量 / 固定配件。**七颗全部无 v-if**（我们也是恒显 ✓），每颗后面跟一个受 computed
控制的摘要 `<span>`（`_0x5be56e`/`_0x4990d0`/`_0x2bc848`/`_0x99c66d`/`_0x58efbd`/`_0x291c32`）
—— 对应我们的 6 个 `config-summary` ✓。

### 2.4 主表格区 —— 列**一致** ✓，操作列缺一颗

- 列：`材料名 / 数量 / 计算结果 / 操作 / 公式类别` —— `2026-08-21` 文档 §7.1 说的 5 列**核实无误**，
  我们也是这 5 列 ✓。
- **操作列**（`D:3470-3481`）旧版是**三颗**、且**列宽随 3D 开关变**：
  ```js
  label:"操作", width: _0x5679d4.value ? 120 : 80
  ```
  1. **「查看3D」**（`D:3476`），`v-if="_0xb8632f(row)"`，点击 `_0x4b6d5d(row)` ← **我们没有**
  2. 删除：`ElPopconfirm` 标题「确定删除该行吗?」，按钮 **确定/取消**（`D:3478`）
  3. 复制
- 删除确认文案我们逐字一致 ✓（`Formulas.vue:1116`），但 naive 的默认按钮文案是「确认/取消」，
  旧版是「确定/取消」。
- 行内挖孔图展示（`_0x44ca5e`）我们实现为 `glassImages` ✓。

### 2.5 3D —— **整块缺失**（最大的洞）

`D:924` 这一串 computed 是整个 3D 的总开关：

```js
_0x240250 = computed(() => _0xb3040a.value === "swing3dDouble")   // 平开类
_0x5edca7 = computed(() => "sliding3d" === _0xb3040a.value)        // 推拉
_0x1c54da = computed(() => _0xb3040a.value === "folding3d")        // 折叠
_0xe893bd = computed(() => _0xb3040a.value === "pt3d")             // PT
_0x5679d4 = computed(() => _0xb3040a.value !== "normal")           // ← 3D 区显示的判据
```

`_0xb3040a` 由 `_0x48b25f(formulaType, parts)`（定义 `D:1838`）按门型写入：

| formulaType | 3D 模式 |
|---|---|
| 子母门（`_0x187deb`） | `3track3leaf` |
| 平开类（`_0x3ccfb0`） | `swing3dDouble` |
| `diao` | `pt3d` / `folding3d` / `sliding3d`（按部件细分） |
| 其余 | `normal` |

⇒ **只要门型是真的，`_0x5679d4` 就为真，3D 面板就显示**。这不是可选的边角功能，
是**打开公式就常驻在页面上的区域**。渲染点：

```
D:3514   <div v-show="_0x579c3d">   ← 编辑区/工具栏整块
D:3516   _0x47c7c0  (= SlidingDoor3D)   平开分支
D:3518   _0x47c7c0                       推拉/折叠/PT 分支
D:3518   _0x22e6fd   (D:618 定义的本地组件，scopeId data-v-448e7717)
```

**依赖体量**（`Diao-1afe5586.js` 的 import 列表里）：

| chunk | 大小 | 是什么 |
|---|---|---|
| `SlidingDoor3D-513fae14.js` | **622 KB** | 3D 门模型渲染组件（`_0x47c7c0`） |
| `three-52679e93.js` | **660 KB** | **Three.js r162**（文件头 `@license ... Three.js Authors`，`const t="162"`） |

⇒ 我们 `package.json` 里**没有 `three` 这个依赖**，这块是从零开始。

⚠️ **这算不算「已知不做」？** 查过了：
- `docs/2026-09-19-legacy-nav.md:110-112` 只把 `/3d-view`、`/sliding-door-3d`、
  `/composite-gate-3d` 三个**独立路由**记为 ❌未做；
- `docs/2026-09-08-hui-table-gap.md:20` 记了一条**未复核**的「操作列第三颗按钮旧版是查看3D、我们是算料」；
- **Diao 页内嵌的这块 3D 面板，任何文档里都没有提过**。

⇒ 属于 `CLAUDE.md` 说的「这块本来就没文档」，本文补上。

---

## 3. 口径偏差（逐条）

### 3.1 ★ 子母门的 `formulaType` 拼写对不上

旧版把它写成**驼峰** `parentSubsidiary`，而且是**真在做比较**：

```
D:2213   l["formulaType"]==="parentSubsidiary" ? isSubsidiary=true : false
D:2236   "parentSubsidiary"===formulaType ? (门洞宽="900", 母门宽="200") : 门洞宽="800"
```

我们 `formulaTemplates.ts:10` 与 `Formulas.vue:63` 用的是**全小写** `parentsubsidiary`。

**根因推测**：旧版有两张不同的表，容易看串 ——
- `D:2589` 那张 13 键中文名表用的是**小写** `parentsubsidiary`；
- 但那张表**不是 formulaType 表**（见 §4.1），
- 真正的 formulaType 赋值（`_0xb8c576`）只有 5 个字面量，其中是 `parentSubsidiary`。

**影响**：我们内部自洽，所以现在不会报错。但**凡是要跟旧版数据/旧版代码对齐的地方都会静默不匹配**，
而且以后有人照旧版写 `parentSubsidiary` 会永远不成立。

**建议**：改成 `parentSubsidiary`（要一条数据迁移把库里已有的值改掉），或**在代码里注明这是有意偏离**。
**现状两头都不占** —— 既没对齐，也没写明。

### 3.2 ★ 尺寸：旧版**不存**，我们存了

旧版保存载荷（`D:2089-2128`）逐字只有这些键：

```js
{ [公式名]: { formulaName, formulaType, square, diao,
              ...resetSize, ...widthIncrement, ...swingWall, ...TaoDong, ...hardware, ...hinge } }
```

**没有 门洞宽/高、亮窗总高、墙厚、吊脚、母门宽。** 所以它在**加载公式时按门型重置尺寸**
（`D:2233-2236`）：

| 字段 | 加载时被设成 |
|---|---|
| 门洞高 `_0x1208fb` | 恒 `"2000"` |
| 墙厚 `_0x55e8eb` | 恒 `"300"` |
| 亮窗总高 `_0x497099` | `"2500"` / `"0"`（看 `_0x3ccfb0(type)` 与 `_0x59130c(diao)`） |
| 门洞宽 `_0x2fe495` | `diao`→2400；`ling`→1600；`diamond`→580；`parentSubsidiary`→900；其余→800 |
| （diamond 另置） | 墙厚=560、亮窗总高=580 |
| （parentSubsidiary 另置） | 母门宽=200 |

**我们反过来**：`formulas` 表有 `door_width`/`door_height`/`light_window_height`/`wall_thickness`/
`jiao`/`mother_door_width` 六列（`2026-08-21` 文档 §8.1 的设计），`loadFormula` 从库里读回
（`Formulas.vue:842-847`），加载后**不做任何按门型重置**。

**后果**：旧版随便打开哪个公式，尺寸栏一定是一组合理值；我们打开一个存的时候尺寸为空的公式，
`dimH=''` ⇒ `refreshPlaceholders()` 按 `h=0` 算 ⇒ **整表占位值全错**，而界面上没有任何提示。

**建议**：保留「存尺寸」（比旧版好），但**加载后把空值补上门型默认**，两边的好处都拿到。
这是行为改动，需产品点头。

### 3.3 列表弹窗（查询/修改/删除公式）结构不同

旧版 `D:3586-3608`：

```
标题「修改/删除公式」  width: 移动端 90% / PC 30%
内容： <label>公式名：</label>
       el-autocomplete（placeholder「请输入公式名称」，clearable）
         fetch-suggestions → 按 formulaName.toLowerCase().includes(q) 过滤（D:2178）
         候选项 = { value: formulaName, formulaId }（D:2180）
       [查询 primary] [删除 danger] [复制 primary]
```

**旧版根本没有表格** —— 是「打名字 → 三颗按钮」。
我们做成了 `n-data-table` + 每行 修改/复制/删除（`Formulas.vue:767-804`），
列 名称/类型/门洞宽×高/更新时间。

行为副作用：旧版选不中会提示「请选择一个公式」（`D:2196`）/ 我们不需要这条。
另外 `D:2070` 算了 `minSquare`（移门方数设置）字段，但**全文件只此一处、从未被读**
⇒ **旧版那个字段是死的**，别照抄。

删除确认我们用的是**原生 `window.confirm`**（`Formulas.vue:874`），旧版是
`ElMessageBox.confirm(msg, "删除确认", {确定/取消, type:"warning"})`（`D:2250`）。
原生弹窗在浏览器里样式与其它一致性和旧版差得远。

### 3.4 编辑区的 `v-show`

`D:3428` 那个 `[[Vue.vShow, _0x579c3d["value"]]]` 罩住了搜索框 + 7 颗快捷按钮那一整行。
`_0x579c3d` 声明为 `ref(!1)`，**19 处赋值全是 `!0`、从不回 false**（`D:947` 起）——
是个**单向闩**：首次加载模板/公式/点「3D创建公式」之前隐藏，之后永久显示。

我们恒显示。差别只出现在「刚进页面、还没选模板」那一瞬，影响很小，记一笔。

---

## 4. 旧版自身的毛病（别照抄）

1. **13 键中文名表不是 formulaType 表。** `D:2589` 的 `_0x55fb2e` 有 13 个键（含
   `pingwindows`/`doubleling`/`diamondling`/`parentsubsidiary`），文档 §3.1 称其为
   「formulaType → 中文」。**实际不是**：它唯一的调用点 `D:3541` 是把 **TEMPLATES 对象的键**
   喂进去（`_0x386353 = e => _0x55fb2e[e.toLowerCase()] || e`）—— 键是 `diamondLing`、
   `pingWindows` 这类**模板键**，小写后正好命中。
   **真 formulaType 只有 5 个值**，见 `Formulas.vue` 的 `FORMULA_TYPE_LABELS` 注释（我们已按 5 个做 ✓）。
2. **`minSquare` 死字段**（`D:2070`），见 §3.3。
3. **`ling` 分支**：`D:2236` 有一支 `"ling"===formulaType`，但旧版**自己从不产生 `ling`**
   （`_0xb8c576` 的 5 个字面量赋值里没有它）。只有 `D:2206` 从数据读回
   （`String(l["formulaType"]||"")`）时才可能命中 ⇒ **取决于历史数据里有没有**，不能断定是死代码。
4. **`D:2248` 起删除弹窗**用 `_0x463507`（选中的 id）判断，而删除按钮在列表弹窗里
   —— 也就是删除的目标是「当前选中的那条」。

---

## 5. 要回写的文档（`CLAUDE.md` 硬规矩）

`docs/2026-08-21-formula-analysis.md` 有**两处已经不成立**，已在同一笔改动里改掉：

| 位置 | 原文 | 实际 |
|---|---|---|
| §3.1 标题与表头 | 「用户可见类型（13 类，**formulaType** → 中文）」 | 那张表是**模板键**→中文；formulaType 只有 5 个值 |
| §8.3 前端 | 「列表 + 新建/编辑弹窗（名称/类型/尺寸/平方数/备注 + **部件 JSON 文本域占位**）」 | 早已不是占位：有 `formulaEngine` / `formulaTemplates` / `formulaMaterials` / `formulaExtra` / `GlassDraw` 与完整编辑器 |

§7.1/§7.2 的界面描述**经核对基本成立**（「三个受管理员控制」也对），保留。

---

## 6. 怎么办（建议，未动手）

按性价比排：

1. **补齐 §3.2 的加载默认尺寸** —— 改动小、收益明确（避免打开公式看到一堆 0）。
2. **定 `parentSubsidiary` 大小写**（§3.1）—— 要么改+迁移，要么写明偏离。**别维持现状**。
3. **列表弹窗对齐**（§3.3）：至少把 `window.confirm` 换成 naive 的 dialog。
4. **「查看3D」与 3D 面板**（§2.5）—— 体量最大（Three.js + 622KB 组件），
   **建议单独排期、单独评估**，不要塞进本轮。若要砍，就在文档里写成**明确的有意偏离**。
5. 「3D创建公式」「算料神器」—— 前者依附于 3D 面板，后者是借 Hui 的组件，
   可与 4 一起定。

---

## 7. 怎么复现本文的每一条

```bash
cd /Users/aaa/Desktop/door-main

# 旧版路由 → Diao 组件
grep -o 'path:"/Diao"[^}]\{0,200\}' legacy/js/index-c3b16e3f.js

# 顶部 6 颗按钮 + 门控 + 文案
sed -n '3341,3365p' legacy/js/Diao.deobfuscated.js

# 3D 总开关与模式选择
sed -n '924p;1838,1850p' legacy/js/Diao.deobfuscated.js

# 保存载荷（证明旧版不存尺寸）
sed -n '2086,2128p' legacy/js/Diao.deobfuscated.js

# 加载时按门型重置尺寸
sed -n '2233,2236p' legacy/js/Diao.deobfuscated.js

# 操作列三颗按钮 + 列宽随 3D 变
sed -n '3470,3482p' legacy/js/Diao.deobfuscated.js

# 3D 依赖体量
ls -l legacy/js/SlidingDoor3D-513fae14.js legacy/js/three-52679e93.js
```

⚠️ 本文**没有差分台** —— 它是**界面/结构审计**，不是纯函数比对。
可比的纯函数部分（公式引擎）另有 `docs/2026-09-11-engine-exhaustive.md` 那套在管，
**别把本文当成算式正确性的证据**。
