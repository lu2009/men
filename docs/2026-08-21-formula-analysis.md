# 「吊」公式管理模块 —— 逆向分析与重构规格

- 日期：2026-08-21
- 阶段：公式管理（formula）模块
- 前置：`2026-08-21-auth-design.md`
- 依据：小分队对 `legacy/js/Diao.deobfuscated.js` 的分段逆向（5 段并行）

本文档沉淀旧版「吊」（公式管理）页的完整逻辑与交互，作为新系统 `formula` 模块的实现依据。旧版是单文件巨石组件 `Diao`（约 3200 行 setup + 750 行 render）+ 子组件 `Glass_draw`（挖孔图编辑器）。

---

## 1. 定位

「吊」是旧版的核心页面：用一套**迷你公式 DSL** 描述不同门型的材料下料计算（门窗宽/高/墙厚/吊脚等尺寸 → 每根材料的切割长度），并可把公式保存、查询、复制、删除。它同时是「汇算」页的算料引擎来源。

**本模块不是单一 CRUD**，而是：
1. 公式元数据（名称/类型/尺寸/最小平方数）的增删改查；
2. 门型模板库（13+ 类，每类一份预设部件清单）；
3. 一套计算公式（正向 `formula` + 逆向 `calculate`）与求值引擎；
4. 挖孔图（玻璃锁向开孔图）的生成/上传/删除子功能。

---

## 2. 数据模型

### 2.1 公式对象（持久化主体）

顶层元信息 + 部件清单：

| 字段 | 类型 | 含义 |
|---|---|---|
| `formulaName` | string | 公式名称（唯一必填） |
| `formulaType` | string | 公式类型（见 §3） |
| `square` | number \| object | 最小平方数；移门类为 `{型号:"min-max"}` 对象 |
| `diao` | object | **部件清单**：以「材料名」为键的扁平 map（见 §4.1） |
| `resetSize` | `{width,height}` | 重置尺寸（可选） |
| `widthIncrement` | `{SheetIncrement,TrackIncrement}` | 边封/轨道增量（可选） |
| `swingWall` | `{SingleWall,DoubleWall,UpWall}` | 平开门单/双/上丁墙厚（可选） |
| `TaoDong` | `{SingleDong:{宽减,高减}, DubleDong:{宽减,高减}}` | 套洞减尺（可选） |
| `hardware` | string | 配件文本（可选） |
| `hinge` | object | 合页减尺 `{名称:{"上下方减尺","光企减尺寸"}}`（可选） |

> 旧字段拼写 `DubleDong`（双包边洞）为源实现笔误，重构时规范为 `DoubleDong`，读旧数据需兼容。

### 2.2 尺寸变量（公式 DSL 的基础变量）

| 符号 | 中文 | 语义 | UI 标签 |
|---|---|---|---|
| `w` | 门洞宽 | 门洞宽 | 门洞宽 / 钻石型时「左宽」 |
| `h` | 门洞高 | 门洞高 | 门洞高 |
| `h1` | 亮窗总高 | 亮窗总高 | 亮窗总高 / 钻石型时「右宽」 |
| `t` | 墙厚 | 墙厚（多义：钻石型=斜长，luiyifour=中扇宽） | 墙厚 / 钻石型「门宽」 |
| `j` | 吊脚 | 门下留空高度 | 吊脚 |
| `s` | 母门宽 | 子母门母门宽 | 母门宽 |
| `v` | 缝隙/搭接量 | 每部件独立，由逆向公式反推 | — |
| `result` | 计算结果 | 该部件下料长度（用户确认值） | 计算结果列 |
| `X.result` | 跨部件引用 | 引用名为 X 部件的结果 | — |

---

## 3. 公式类型 / 门型

### 3.1 用户可见类型（13 类，`formulaType` → 中文）

| key | 中文名 | 3D 模式 |
|---|---|---|
| `ping` | 平开门 | swing3dDouble |
| `pingwindows` | 平开门带亮窗 | swing3dDouble |
| `double` | 双开门 | swing3dDouble |
| `lvmu` | 铝木门 | — |
| `diao` | 推拉门 | sliding3d |
| `ling` | 淋浴房一固一活 | — |
| `doubleling` | 淋浴房双活 | — |
| `dan` | 单轨门 | sliding3d |
| `pt` | PT门 | pt3d |
| `diamondling` | 钻石型淋浴房 | — |
| `zhe` | 折叠门 | folding3d |
| `parentsubsidiary` | 子母门 | — |
| `parentsubsidiarywindow` | 子母门带上亮 | — |

另有内部变体（无独立显示名，3D 创建入口使用）：`ping1/ping2/pingWindows1/pingWindows2/doubleWindow/luiyifour`。

### 3.2 平开门模板（`ping1/ping2/pingWindows1/pingWindows2`）

| templateKey | 中文 | casingMode | 需墙厚 | 带亮窗 |
|---|---|---|---|---|
| `ping1` | 平开门双包 | doubleSingleSide | true | false |
| `ping2` | 平开门单包 | single | false | false |
| `pingWindows1` | 平开门双包亮窗 | doubleSingleSide | true | true |
| `pingWindows2` | 平开门单包亮窗 | single | false | true |

---

## 4. 部件定义与计算公式 DSL

### 4.1 部件条目结构

每个「部件」（材料）一个对象：

| 字段 | 类型 | 含义 |
|---|---|---|
| `key`（=材料名） | string | 唯一标识（表格行 name） |
| `state` | bool | 是否启用/已算 |
| `quantity` | number | 数量（下料根数） |
| `materialName` | string | 材料名（可编辑，表格列） |
| `track` | string | 轨道/套线默认值（`标配`/`单包`/`双包`/空） |
| `title` | string | 非空时显示附加输入框的标签（`轨道名称:`/`套线名称:`/`下轨名称:`） |
| `formula` | string | **正向公式**：尺寸 → 下料长度 |
| `calculate` | string | **逆向公式**：下料长度 → 反推 `v` |
| `result` | number | 计算结果 |
| `v` | number | 缝隙/搭接量 |
| `color` | string | 行背景色分组 |

**颜色约定**：`lightgreen`=框料/固定件、`yellow`=扇料/活动料、`red`=需手输关键料（光企/固玻，通常 `track:"标配"`）、`pink`/`lightblue`/`lightpink`=推拉门 2轨4扇/3轨/PT 系列、`green`=附加部件库。

### 4.2 计算公式 DSL

- 表达式以 `=` 开头，支持 `+ - * /`、括号、变量（§2.2）与 `X.result` 跨部件引用。
- **正向**：`formula` 用尺寸变量 + `v` 算下料长度，如 `=w/2+v`、`=上下方.result-v`、`=h-v-j`。
- **逆向**：`calculate` 是 `formula` 把 `v` 移到另一侧的代数逆运算，用于由用户输入的「计算结果」反推 `v`：
  - `=w-v` ↔ `=w-result`
  - `=w/2+v` ↔ `=result-w/2`
  - `=h-v-j` ↔ `=h-result-j`
  - `=上下方.result-v` ↔ `=上下方.result-result`

**求值引擎**（eval 替换变量后的表达式）：
1. 正向：替换 `X.result`（按 name 找行，取最新结果，缺省补 `0`）、`w/h/h1/t/j/s`（取当前尺寸）、`v`（负数加括号）、`result`（负数加括号）→ `eval`，异常返回 0。
2. 逆向：同替换（不含 `v`），被引用行结果缺失时警告并返回哨兵 `1e5`。
3. 尺寸输入框 blur 时触发联动：遍历所有行，凡 `formula` 含该变量或含 `.result` 都重算并写入结果占位。

### 4.3 各门型典型部件（数量规律）

- **平开/双开/子母门**：门框宽/高、上下方、玻璃宽/高、光企高（`=h-v-j`）、收口、扣板宽/高/厚（扣板厚恒 `=t-v`）。双开门上下方 `=w/2-v` qty4。子母门母门 `=s-v`、子门 `=w-s-v`。
- **推拉门（diao）**：边封、上滑/下滑、N轨N扇上下方 `=w/N+v`、玻璃宽、光企高/勾企高（`=h-v`，`track:标配`）、玻璃高、收口、套线（单/双包宽/高 `=w+v`/`=h+v`）、扣板、F槽。数量：上下方/玻璃 = 2×扇数，光企 2、勾企 = 扇数。
- **淋浴房一固一活（ling）/双活**：边封、上/下轨、固玻上下方 `=w/2-v`、固玻璃、光企、门玻上下方 `=w/2+v`、亮窗玻璃/压线。
- **折叠门（zhe）**：边封、折叠上/下滑、折叠N扇上下方 `=w/N+v`、玻璃、光企、收口。
- **PT门（pt）**：边封、上/下滑、上方/下方 `=w/N+v`、固定/移动、玻璃宽/高、合页高、锁高（`=h-v`，`track:标配`）。
- **单轨门（dan）**：单轨上/下滑公式特殊 `=w*2+v`。
- **铝木门（lvmu）**：前/后框、门扇/门板、封边横/竖、龙骨横/竖、扣板。
- **钻石型（diamondling）**：左边 `=w+v`、右边 `=h1+v`、斜长 `=t+v`、竖框、左右固玻、门玻。
- **轨扇组合（luiyifour）**：外框/中柱、扇光企高/上下方、边固定扇、上亮转换。

---

## 5. 挖孔图（Glass_draw 子组件）

玻璃锁向「开孔图」编辑器：左右两张 SVG（220×400 玻璃轮廓 + 凹槽），标注孔宽/孔高/孔距，右侧为镜像（锁向左右互换）。支持三种动作：

| 动作 | 说明 |
|---|---|
| 生成挖孔图 | SVG → Canvas → JPEG，存原始 + 镜像两张，回传 `imageUpdated` |
| 上传挖孔图 | 手动上传 JPG/PNG，回传 `imageUpdated` |
| 删除挖孔图 | 服务端删除 + 本地 IndexedDB 清理，回传 `imageDeleted` |

锁向 13 项：`左锁内开/右锁内开/左锁外开/右锁外开/内左/内右/外左/外右/左固玻/右固玻/双开左/双开右`（源数据 `右固玻` 重复一次）。镜像方向 = 锁向字符串「左↔右」互换。锁向候选集由 `openDirectionMode`（`1`/`2`）切换，并支持 `openDirectionCustomNames` 自定义显示名。

**挖孔图归属**：挖孔图是**公式管理（Diao）页**的功能——给某个公式按锁向挂一张/多张玻璃开孔图，后续订单用到该公式时，算料单据会带上对应图片。旧版图片存 IndexedDB + 云端 `glassHole`；新系统改为随公式持久化。

---

## 6. API / 持久化（旧版）

旧版走一个万能网关 `https://www.samrtdoor.com.cn/1?param1=<action>&param2=<registrant>&param3=<formulaId>`，返回 `{code,data,message}`（`code===200` 成功）。动作：

| action | 方法 | 说明 |
|---|---|---|
| `getFormulaName` | GET | 拉取公式名列表 `{formulaId → {formulaName, square}}` |
| `queryFormula` | GET | 按 id 拉完整公式对象 + `images` |
| `saveFormula` | POST | 保存完整公式对象（body 为公式 JSON） |
| `deleteFormula` | GET | 删除公式 |
| `glassHole` | POST | 上传/生成挖孔图元数据 |
| `deleteGlassHole` | GET | 删除挖孔图 |

新系统改为 RESTful：`/api/v1/formulas`（见 §8）。

---

## 7. UI 结构与交互（旧版全景）

### 7.1 页面三段布局
1. **顶部按钮区**：查询/修改/删除公式、公式模板、3D创建公式（三个受管理员权限 `registrant===name || name==="开门红"` 控制）、开孔图、算料神器、视频。
2. **公式编辑区**：尺寸输入（公式名称、单扇最小平方数、门洞高、门洞宽/左宽、母门宽、亮窗总高/右宽、墙厚/门宽、吊脚）+ 搜索框 + 快捷设置按钮（洞尺/包边洞尺/丁墙/合页/边封增量/固定配件/亮窗示意图）。
3. **主表格区**：材料部件表（材料名/数量/计算结果/操作/公式类别 5 列）+ 挖孔图预览 + 新增材料/确认按钮 + 3D 预览组件。

### 7.2 关键交互
- **字段显隐**：子母门→显示母门宽；钻石型→标签切换（门洞宽→左宽、亮窗总高→右宽、墙厚→门宽）；平开门 3D→吊脚用 `el-switch`（开启/关闭）；移门方数模式→显示「移门最低方数设置」按钮（非移门→直接显示单扇最小平方数输入）。
- **表格行操作**：材料名/数量/计算结果 onBlur 触发重算与反推 `v`；删除（Popconfirm）、复制（含「大小扇上下方及玻璃」/「复制成单玻」/「同时复制勾企高」等分支）。
- **数字输入**：用 `ElInput` + onBlur `Number()` 转换 + 非法回 0（非 `ElInputNumber`）。
- **权限**：管理员/开门红可见管理按钮。

### 7.3 校验文案（抽样）
`请输入公式名称` / `请输入门洞高` / `请输入门洞宽` / `请先填写 "X" 的计算结果` / `找不到名称为 "X" 的行` / `请选择一个公式` / `确定要删除该公式吗？此操作不可恢复。`

---

## 8. 本期实现映射（元数据 CRUD + JSONB 占位）

第一轮已批准范围：**元数据 CRUD + 部件存 JSONB 占位**。后续目标：把 Diao 页还原到旧版 ~90%（公式录入逻辑 + 前端 TS 计算引擎 + 挖孔图），全部留在 Diao 页。

### 8.1 数据表 `formulas`

把元信息拆为可查询列，部件与扩展设置整体作为 JSONB 占位：

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `tenant_id` | BIGINT → tenants | 多租户 |
| `name` | TEXT | 公式名称（必填） |
| `formula_type` | TEXT | 公式类型（§3.1 key） |
| `door_width`/`door_height` | TEXT | 门洞宽 `w` / 高 `h` |
| `light_window_height` | TEXT | 亮窗总高 `h1` |
| `wall_thickness` | TEXT | 墙厚 `t` |
| `jiao` | TEXT | 吊脚 `j` |
| `mother_door_width` | TEXT | 母门宽 `s` |
| `square` | TEXT | 最小平方数 |
| `parts` | JSONB | 部件清单 + 扩展设置占位 |
| `remark` | TEXT | 备注 |
| `created_by` | BIGINT → users | 创建人 |
| `created_at`/`updated_at` | TIMESTAMPTZ | |

尺寸列用 TEXT 以对齐旧版字符串语义（""/“0” 区分「未填/已填」），避免浮点精度问题。

### 8.2 REST API（`/api/v1/formulas`，均需鉴权）

| 方法 | 端点 | 说明 |
|---|---|---|
| GET | `/formulas?search=` | 列表（按名称模糊搜索，按更新时间倒序） |
| POST | `/formulas` | 新建 |
| GET | `/formulas/{id}` | 详情 |
| PUT | `/formulas/{id}` | 更新（全量保存） |
| DELETE | `/formulas/{id}` | 删除 |

多租户隔离：所有查询/更新/删除均带 `tenant_id` 过滤；不存在返回 404 `not_found`。

### 8.3 前端

- `api/types.ts`：`FormulaDto` / `FormulaInput`。
- `api/client.ts`：`listFormulas/createFormula/getFormula/updateFormula/deleteFormula`。
- `views/Formulas.vue`：列表（搜索 + Naive UI 表格）+ 新建/编辑弹窗（名称/类型/尺寸/平方数/备注 + 部件 JSON 文本域占位）。
- 路由 `/formulas`（`meta.requiresAuth`）。

---

## 9. 已知源实现缺陷（重构时修正/核对）

1. `luiyifour` 的 `扇中方`/`扇玻璃宽/高` 引用 `上下方.result`/`光企高.result`，但实际部件 key 是 `扇上下方`/`扇光企高` → 跨部件引用落空。
2. `doubleWindow.门框高` 正向用 `h1`、逆向用 `h`，正逆不一致。
3. `pt` 的 `2轨2扇光企高`/`3轨3扇光企高`/`2轨4扇光企高` 的 materialName 误写为「勾企高」。
4. 锁向选项 `右固玻` 重复一次。
5. 字段拼写 `DubleDong`（应为 DoubleDong）。
6. 挖孔图生成 `result` 用 -100000 与上传 -180000 不一致；通用删除未清理本地 IndexedDB。
