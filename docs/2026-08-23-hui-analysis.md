# 「开门红」汇算 / 计价页（Hui）逆向分析文档

> 数据来源：`legacy/js/Hui-d088417c.js`（反混淆为 `legacy/js/Hui.formatted.js`）、`legacy/DESIGN-DOC.md`、`docs/2026-08-21-formula-analysis.md`、若干明文 helper 文件。
> 本文是 6 个并行分析分队的结果整合，供 Rust（axum + sqlx）+ Vue3/TS/Naive UI 重构使用。

---

## 1. 概述

Hui 是系统**最复杂页面**（旧 chunk 651KB），承担：选客户 → 选门型/开向/轨道 → 输尺寸 → 公式自动算料 → 计价 → 生成订单（回执单）→ 打印/分享/3D/终端链接。

### 1.1 两套并存的计价组件

旧版存在**两套完整计价组件**，由租户标识 `userinfo.ds` 决定用哪套：

| 组件 | 旧代码位置 | 角色 | 区别 |
|---|---|---|---|
| 组件 A（旧格式） | `_0x5a7707`（Hui.formatted.js 571 行） | 平开门订单行表 | 含 `吊脚`/`封板高`，无 `扇数`/`套线单价` |
| 组件 C（新格式） | `_0x4d18bf`（3566 行） | 移门/吊趟门订单行表 | 含 `扇数`/`套线单价`/`套线金额`/`亮窗数量` |

切换开关 `shouldUseNewSizeFormat`（Hui.formatted.js 89–94 行）：

```js
const shouldUseNewSizeFormat = e => {
  const t = e.match(/^smartdoor(\d+)?$/);
  if (!t) return false;
  if (!t[1]) return true;               // ds === "smartdoor"
  const a = Number(t[1]);
  return a === 408 || a > 414;          // smartdoor408 或 smartdoor415+
};
```

即 `smartdoor`、`smartdoor408`、`smartdoor>414` 用**新尺寸格式**，其余用旧格式。

### 1.2 后端网关约定

旧版所有请求走统一网关：`https://www.samrtdoor.com.cn/1?param1=<动作>&param2=<ds>`（域名拼写确为 `samrt`）。响应统一 `{ code: 200, data, message }`，`parseJsonResponse` 校验 `response.ok && json.code === 200`。`ds` 为租户标识（`userinfo.ds`，多租户隔离）。

新系统应改为 RESTful（`/api/v1/...`）。

---

## 2. 数据模型

订单在运行期是**三层结构**：订单头 `customerInfo` + 平开门行表 `ping_hui` + 吊趟/移门行表 `diao_hui`，外加画图快照 `hui_picture`（不入订单，单独走 IndexedDB）。

整单对象：
```
{ customerInfo: {...}, ping_hui: [...], diao_hui: [...], hui_picture: <画图快照> }
```

### 2.1 订单头 `customerInfo`

| 中文名 | 键名 | 类型 | 来源/默认 | 含义 |
|---|---|---|---|---|
| 客户 | `客户` | string | 顶部客户选择 | 客户名 |
| 客户编号 | `客户编号` | number | 顶部选择 | 客户编号 |
| 电话 | `电话` | string | 顶部输入 | 客户电话 |
| 品牌 | `品牌` | string | 顶部选择 | 品牌 |
| 日期 | `日期` | Date | 日期选择器 | 下单日期 |
| 生产天数 | `生产天数` | number | 输入 | 生产周期（天） |
| 回执单号 | `回执单号` | string | 输入/自动 | 订单唯一单号 |
| 截止日期 | `截止日期` | Date | = 日期 + 生产天数 + 1 | 交付截止 |
| 总价 | `总价` | number | = round(各行金额合计) | 订单总金额 |
| 定金 | `定金` | number | 输入 | 已收定金 |
| 订单备注 | `订单备注` | string | 输入 | 订单级备注 |
| 业务员 | `业务员` | string | 输入 | 业务员 |
| 打单人 | `打单人` | string | `userinfo.name` | 制单操作员 |
| 地址 | `地址` | string | 门店/仓库 | 发货地址 |
| 门数 | `门数` | number | 由行统计 | 门/樘总数 |
| 安装地址 | `安装地址` | string | 各行去重 join("_") | 安装地址集 |

### 2.2 平开门行项目 `ping_hui`（45 键）

核心字段（`se()`，Hui.formatted.js 901 行）：

| 中文名 | 键名 | 类型 | 默认 | 备注 |
|---|---|---|---|---|
| 行ID | `id` | string | 生成 | 行唯一标识 |
| 客户/客户编号/日期/回执单号 | 同订单头 | | | 继承 |
| 自定义方数 | `自定义方数` | number | `-1` | `-1`=按公式自动 |
| 型材 | `型材` | string | `""` | 型材型号 |
| 数量 | `数量` | number | `1` | 樘数 |
| 单价 | `单价` | number | `0` | 单价 |
| 颜色 | `颜色` | string | `""` | 颜色 |
| 五金 | `五金` | string | `""` | 五金配件 |
| 底玻/面玻 | `底玻`/`面玻` | string | 记忆默认/`"白玻"` | 玻璃类型 |
| 玻璃厚 | `玻璃厚` | string | 记忆默认 | 玻璃厚度 |
| 开向 | `开向` | string | `""` | 见 §3.1 |
| 套线种类 | `套线种类` | string | `""` | 见 §4.3 |
| 轨道种类 | `轨道种类` | string | `""` | 轨道类型 |
| 开向图 | `开向图` | string | `""` | 开向示意图 |
| 门洞高/门洞宽 | number | `0` | 门洞尺寸 mm |
| 墙厚 | `墙厚` | number | `0` | 墙厚 mm |
| 吊脚 | `吊脚` | number | 记忆默认 | 门下沿离地间隙 mm |
| 亮窗总高 | `亮窗总高` | number | `0` | 上亮窗总高 mm |
| 边封数 | `边封数` | number/null | `2` 或 `null` | 边封条数 |
| 封板高 | `封板高` | number | `0` | 封板高 mm |
| 轨道长 | `轨道长` | number | `0` | 轨道长度 mm |
| 备注/安装地址 | string | `""` | | |
| 平方数 | `平方数` | number | `0` | 见 §4.1 |
| 金额 | `金额` | number | `0` | 见 §4.2 |
| 计价方式 | `计价方式` | string | 记忆默认 | 元/套·元/方（见 §4.2） |
| 加价项目 | `加价项目` | string | `""` | 加价文本 |
| 加价项目原始数据 | `加价项目原始数据` | string | `""` | 原始 JSON |
| 打折 | `打折` | number | `1` | 折扣倍率（1=原价） |
| 前包/后包加长 | number/null | `null` | 套线加长量 |
| 单号 | `单号` | string/null | `null` | 关联订单单号 |
| 图片ID/图片URL | `图片ID`/`imageUrl` | string/null | `null` | IndexedDB 图片 |
| 其它费用 | `其它费用` | number | `0` | 加价金额累加容器 |
| 生产进度 | `生产进度` | string | `""` | 生产进度标识 |
| 洞尺 | `洞尺` | string | `""` | 洞尺/净尺口径 |
| isSelected | boolean | `false` | 批量选择 |

### 2.3 吊趟门/移门行项目 `diao_hui`（50 键）

在平开字段基础上**差异/新增**：

| 中文名 | 键名 | 默认 | 备注 |
|---|---|---|---|
| 套线单价 | `套线单价` | `0` | 元/米 |
| 套线金额 | `套线金额` | `0` | = 套线长度 × 数量 × 套线单价 |
| 扇数 | `扇数` | 默认扇数 | 见 §3.2（24 项枚举） |
| 亮窗数量 | `亮窗数量` | `0` | 亮窗格数 |
| 计价方式 | `计价方式` | `"方"` | 吊趟门默认按方 |
| 边封数 | `边封数` | `2` | |
| 公式ID | `formulaid` | `""` | 匹配的吊公式 ID |
| 单双丁 | `单双丁` | `null` | 影响边封数 |

> 移门/吊趟门的 `型材、颜色、底玻、面玻、玻璃厚、开向、扇数、门洞宽、门洞高` 在保存校验中是必填项。

---

## 3. 枚举数据

### 3.1 开向：两套并行体系

**平开门开向**——固定枚举 14 项（`B`，Hui.formatted.js 708 行）：
```
["左锁内开","右锁内开","左锁外开","右锁外开",   // 锁开类
 "内左","内右","外左","外右",                    // 平开内/外类
 "双开内开","双开外开","双开内左","双开内右","双开外左","双开外右"]  // 双开类
```
按 `localStorage["openDirectionMode"]` 过滤：
- `"1"`：剔除 `内左/内右/外左/外右`（只留锁开 + 双开）
- `"2"`：剔除 `左锁内开/右锁内开/左锁外开/右锁外开`（只留平开 + 双开）

**移门/折叠门开向** = 「扇数」×「方向后缀」，如 `"2轨3扇" + "左前" = "2轨3扇左前"`。

方向后缀（`h`，3615 行）：
```
左前, 右前, 左外, 右外, 左外开, 右外开, 左右外开,
左内开, 右内开, 左右内开, 中内开, 中外开, 中开,
左前内纱, 右前内纱, 无方向,
// 折叠方向 M+P 内折/外折（M+P=扇数 N）
2+0/0+2/3+0/0+3/1+2/2+1/4+0/0+4/3+1/2+2/3+3/5+0/0+5/4+1/1+4/2+3/3+2/6+0/0+6/5+1/1+5/4+2/2+4/7+0/0+7/8+0/0+8/4+4/9+0/0+9/10+0/0+10/5+5 内折/外折
```

完整开向键 → 3D 图码存于 `directionImageMap`（`v` map，3619 行起，`_0x…` 为从 `10-5_5-front`/`1_right` 导入的 3D 方向常量），重构时需把「开向键 → 渲染码」映射单独抽出为数据资源。

### 3.2 扇数枚举（24 项，`I`，3624 行）

```
["2轨2扇","2轨3扇","2轨4扇","3轨3扇",
 "单轨单扇","单轨2扇",
 "3轨4扇2纱","3轨2扇1纱","3轨6扇",
 "4轨4扇","5轨5扇","6轨6扇","7轨7扇",
 "一固一活","双活",
 "折叠2扇","折叠3扇","折叠4扇","折叠5扇","折叠6扇",
 "折叠7扇","折叠8扇","折叠9扇","折叠10扇"]
```

轨道 → 扇数对照：

| 轨道 | 支持扇数 |
|---|---|
| 单轨 | 1 扇、2 扇 |
| 2 轨 | 2、3、4 扇 |
| 3 轨 | 3、6 扇、2扇+1纱、4扇+2纱 |
| 4–7 轨 | 对应 4–7 扇 |
| 无轨 | 一固一活（2）、双活（2） |
| 折叠 | 2–10 扇 |

扇数可由**型材关键字自动推导**（`Ct`，4365 行）：型材含 `2+0`→3轨3扇、`3+0`→4轨4扇、`4+0`→5轨5扇、`5+0`→6轨6扇、`6+0`→7轨7扇。

### 3.3 计价方式枚举

- **订单级**（`W`，769 行）：仅 `["套","方"]`。`套`=单价×数量；`方`=单价×平方数。
- **加价项目级**（六项）：`元/套`、`元/支`、`元/方`、`元/米`、`元/公分`、`无`。

### 3.4 玻璃枚举

- 面玻：`["白玻","无","磨砂"]`（`无` = 单玻，否则双玻）
- 玻璃厚：`[4,8,5,6,10,12,0]`（mm）
- 包边：`["双包","外包","内包","平框"]`

### 3.5 双层命名机制（必须保留）

`openDirectionNaming-92dbc91d.js` 提供「原名 ↔ 显示名」映射（`localStorage["openDirectionCustomNames"]` + 服务端同步）：

- `getOriginalOpenDirection(name)`：还原显示名为规范原名（反向查 map）。
- 所有 `directionImageMap` 查表前**先还原原名**，避免用户改显示名后查不到图。

---

## 4. 核心计算

### 4.1 平方数

```
普通：平方数 = max( 门洞宽 × max(门洞高, 亮窗总高) / 1e6, 最小平方数 )
钻石型(diamond)：平方数 = max( (门洞宽 + 墙厚 + 亮窗总高) × 门洞高 / 1e6, 最小平方数 )
```

- 优先级：**自定义方数（>-1）> 后端 square 表（按 formulaid）> 纯面积**。
- 组件 C 的 square 配置支持按「扇数」索引（含 `a-b` 按有无亮窗取值的字符串形态）。
- 落地：`平方数 = 单樘面积 × 数量`。
- 平方始终是「门洞宽 × 高」，**不是按门扇展开面积**；单轨/多轨/折叠不直接改面积公式。

### 4.2 总价

```
套 → 单价 × 数量 + 其它费用
方 → 单价 × 平方数 + 套线金额(仅吊趟门) + 其它费用
金额 = Math.round( 总价基数 × 打折 )     // 打折是优惠倍率（0~1），不是优惠额
```

完整合并链：
```
单价(来自 getDiaoPrice/getPingPrice) × 计价量(套数 或 平方数)
  + Σ加价项目金额(累加写入「其它费用」)
  × 打折比例
  → Math.round → 订单.金额
```

### 4.3 套线长度（多尺寸模式内嵌在「套线种类」字符串里）

| 套线种类子串 | 含义 | 套线长度公式 |
|---|---|---|
| （默认） | 单樘标准 1 宽 2 高 | `(门洞宽 + 2×高 + 2×增量) / 1000` |
| `一高一宽` | 1 高 1 宽 | `(门洞宽 + 1×高 + 1×增量) / 1000` |
| `两高两宽` | 两樘并排 | `(2×门洞宽 + 2×高 + 2×增量) / 1000` |
| `一高` | 仅 1 高 | `(1×高 + 1×增量) / 1000` |
| `一宽` | 仅 1 宽 | `(1×门洞宽 + 1×增量) / 1000` |

- `高 = max(门洞高, 亮窗总高)`，`宽 = 门洞宽`，`增量 = 套线种类中 "-N" 后缀数字`。
- 套线金额 = `套线长度 × 数量 × 套线单价`。
- 多模式**只改变套线用量与金额**，不改平方公式。

### 4.4 加价项目（`useAddPriceItems`）

默认一条 `{name:"人工", price:100, unit:"元/套"}`；按 `name+price+unit` 去重。

金额计算（`wt()`，1270–1313 行）：

| 单位 | 金额公式 |
|---|---|
| 元/套、元/支、无 | `price × 数量` |
| 元/方 | `price × 平方数` |
| 元/方（超平米N） | `(平方数 - N) × price × 数量` |
| 元/米 | `(2×max(门洞高,亮窗总高) + 门洞宽) / 1000 × price × 数量` |
| 元/公分 | `(实际尺寸 - 标准尺寸) / 10 × price × 数量` |

超宽/超高/超墙厚/轨道超长/超平米**自动加价**：
- 前缀 `超宽`/`超高`/`超墙厚`/`轨道超长`/`超平米`，加价项名 = `前缀 + 阈值数字`，单位 `元/公分`（超平米为 `元/方`）。
- 触发：`墙厚` 恒触发；`门洞宽/高` 仅当 `计价方式==="套"` 时触发。
- 匹配规则：取**阈值 ≤ 实际尺寸且差值最小**的一项；已加入项不再匹配则移除。
- 计费量：`超宽N`=(门洞宽−N)/10；`超高N`=(max(门洞高,亮窗总高)−N)/10；`超墙厚N`=(墙厚−N)/10；`轨道超长N`=N/10（直接用名称数字，非「实际−N」）。
- 可关闭自动加价：`localStorage["smartdoor_disable_auto_markup"]`。

### 4.5 公式算料引擎（详见 formula-analysis.md §4.2）

- 公式 DSL：表达式以 `=` 开头，支持 `+ - * /`、括号、尺寸变量、`X.result` 跨部件引用。
- **正向** `formula`：尺寸 → 下料长度（如 `=w/2+v`、`=上下方.result-v`、`=h-v-j`）。
- **逆向** `calculate`：下料长度 → 反推缝隙 `v`（如 `=w-v ↔ =w-result`）。
- 尺寸变量：`w`=门洞宽、`h`=门洞高、`h1`=亮窗总高、`t`=墙厚、`j`=吊脚、`s`=母门宽、`v`=缝隙、`result`=本行结果、`X.result`=引用部件。
- 替换顺序：先 `X.result`（缺省补 0）→ 再 `w/h/h1/t/j/s` → 再 `v/result`（负数加括号）→ eval，异常返回 0；逆向缺失引用返回哨兵 `1e5`。
- **Rust 侧必须实现安全公式求值器，禁止裸 eval**（旧版 JS 直接 eval）。

典型部件输出：上下方、光企、勾企、边封、中柱、扣板、玻璃、五金、收口、套线、F槽 等。

### 4.6 玻璃计算（`calculateGlass`）

- 单玻 = 面玻选「无」，数量按双玻减半（钻石型例外——固玻/门玻独立倍率不减半）。
- 玻璃宽/高沿用公式行 `result`。
- 子母门、钻石型有独立数量倍率。

---

## 5. 客户与财务

> **边界**：Hui 只承载「客户选择 + 改客户名 + 回执单定金/余款 + 客户总余额显示」。完整回款、冲销（红冲）、预付款分配在 Home/Progress 页，**不在 Hui**。

### 5.1 客户选择

- 顶部 `el-autocomplete`：本地过滤已加载客户列表（`name.includes(query)`）。
- 选中回填：客户名/电话/地址/编号/品牌，并重置日期为今天。
- **切换客户会清空当前已算的门类数据**（失焦客户名变化触发）。
- 数据源两个动作：
  - `getLatestClientsInfo`（全量，param2=ds，返回含品牌）→ 主页面下拉。
  - `getClientsInfo`（按关键词搜索，返回不含品牌）→ 改客户名弹窗。
- 特殊：终端自助下单模式（登录名 = 客户名，隐藏客户输入框）。

### 5.2 财务等式

- Hui 回执单内部唯一明确等式：**本单余款 = 总价 − 定金**。
- 客户总余额 `TotalBalance`：`finance_getCustomerBalance`（param2=ds&param3=客户编号），仅当 `showTotalBalance` 开启且客户编号非 0 才拉取，显示在回执单上。
- 全系统财务关系（落在 Home/Progress）：`未付 = 总价 − 已付`（已付含定金），另有「已分配」= 客户预付款分摊到本单的金额。

### 5.3 改客户名（`useOrderCustomerEdit`）

- 前置校验：行缺 `回执单号` → 拦截；订单已有收款分配（`finance_checkOrderPayment` 或行 `已分配金额>0`）→ 拦截。
- 提交：`finance_updateOrderCustomer`，body `{回执单号, 原客户, 原客户编号, 客户, 客户编号, 编辑}`。

### 5.4 回款/冲销/分配（非 Hui，记录动作名）

`finance_addOrderPayment`（添加回款）、`finance_addOrderAdjustment`（红冲抹零/红冲收款，需二次密码验证）、`updataPaymentCollection`（全单回款，Progress 页）、预付款分配（Home 财务面板，校验「不超余额/本单未收」）。

---

## 6. 打印 / 分享 / 3D / 终端

### 6.1 打印引擎：hiprint

- 本地 WebSocket `17521`（namespace `hiprint-smartdoor-<ds+1088>`），云打印 `https://v4.printjs.cn:17521`（socket.io）。
- 模板存 `userinfo.template` 对象，按名取：`product/product2/product3/product4/product10/glass/glassHole/lable/receipt/FinalReceipt/ReceiptList/sale`。
- 标签尺寸：模板名含 `lable` → 70×90mm 竖版；其余 → A4（297×210）横版。

单据模式（mode → 模板 → 生成函数）：

| mode | 单据 | 模板 | 生成函数 |
|---|---|---|---|
| 1 | 玻璃合片单 | glass | calculateGlass |
| 2 | 生产单/回执单 | product | calculateReceipt / calculateReceiptForCustomed |
| 3 | 玻璃订单 | glassHole | Glasslist |
| 4 | 标签（出货/切料） | lable | lable |
| 8/9 | 生产单 | product2/product3 | calculateReceiptOld |
| 10 | 生产标签 | product10 | lableForProduct |
| 11 | 料标签 | product4 | lableForMaterial |

回执单（receipt）独立于 mode 体系，由保存/算料后实时生成预览。

### 6.2 标签数量计算

标签字段：`qrcode/client/door/size/color/lockway/remark/orderID/address/glass/package/storeAddress`。

**平开门 `ping_hui`**：
```
t = 数量 × ping_tabs.sheets(玻璃类别)
if 亮窗总高>0  t += ping_tabs.add
if 墙厚>0      t += ping_tabs.add_2
if 型材含"钻石" t = 4 × 数量
```

**吊趟/移门 `diao_hui`**：
```
t = 数量 × (扇数N × diao_tabs.sheets + 1)     // N = 扇数，见下表
if 亮窗总高>0  t += diao_tabs.add
if 套线单价>0  t += diao_tabs.add_2
// 工厂特判：
名甸门业/旺达名门/名扬门业/临泉县品匠移门 → t -= 1
宏叶芯诚 → t += 3
美居门业有限公司 → t = 1
折叠N扇 且 鑫隆迪门厂 → t = 1
// 型材特判：
型材含"哑口套"/"门套" → t = 数量
型材含"+0" → t -= 1
```

扇数 N 提取：单轨单扇=1、单轨2扇/2轨2扇/一固一活/双活=2、2轨3扇/3轨3扇/3轨2扇1纱=3、2轨4扇/4轨4扇=4、5轨5扇=5、6轨6扇/3轨6扇/3轨4扇2纱=6、7轨7扇=7、折叠2–9扇=2–9。

> `ping_tabs`/`diao_tabs`（每玻璃张数/亮窗加成/套线加成）是配置表，重构时需一并迁移。

### 6.3 分享流程

`html2canvas(scale:2)` 截屏 → blob → 按环境分流：
- Capacitor 原生：写 `Filesystem.Cache` → `Share.share`。
- Web 支持分享：`navigator.share({files})`。
- 不支持：下载回退，提示手动分享。

复制玻璃单到剪贴板：`preview("glassHole")` → html2canvas → `ClipboardItem` → `navigator.clipboard.write`。

### 6.4 3D 展示

- 入口：跳转 `/sliding-door-3d` 路由（`SlidingDoor3D` 组件 + `useDoor3DView` + `useDoorDesignerStore`）。
- 免费用户黑名单限制（提示「画门窗功能限时免费」）。

### 6.5 终端链接 token（与客户模块已实现一致）

```
a = (ds === "smartdoor") ? 1000 : Number(ds.split("smartdoor")[1]) + 1000
x = 7 × Number(客户编号) + 1987
token = `${a}af${x}wy${Date.now() + 888}`
链接 = https://www.samrtdoor.com.cn/login?param1=<客户名>&param2=<token>&receiptNo=<回执单号>
```

---

## 7. 订单生命周期与状态

### 7.1 生命周期动作

| 动作 | 后端 param1 | 说明 |
|---|---|---|
| 新增行 | — | 本地 push 一行（复制上一行回执单号/客户） |
| 保存单行 | `updateRowData` | 去除内部键后 POST 单行 |
| 保存整单 | `makeReceipt` | POST `{customerInfo, ping_hui, diao_hui}` |
| 删除行 | `deleteRow` | 已录入行需二次确认，POST `{id,数量,金额,安装地址}` |
| 导入上次订单 | — | 读 `localStorage["smartdoor_last_order"]` |

### 7.2 校验

- 平开门保存：轨道种类为空 → 拦；自动回填回执单号/业务员/安装地址/formulaid。
- 吊趟门保存：型材/颜色/底玻/面玻/玻璃厚/开向/扇数/门洞宽/门洞高 必填。
- 数字输入：正则清洗，失焦空→0（边封数空→2）。

### 7.3 状态

| 状态 | 载体 | 说明 |
|---|---|---|
| 已录入（持久行） | Set<id> + markRowsPersisted | 删除需二次确认 |
| 未保存修改 | Set<id>（行快照深比较） | 触发路由离开拦截 |
| 字段校验错误 | errorFields[字段] | 数字非法 |

### 7.4 本地存储

- `localStorage`：`token`、`smartdoor_active_identity`、`smartdoor_last_order`、`PriceType`（默认计价方式）、`GlassThickness`、`BottomGlass`、`openDirectionMode`、`openDirectionCustomNames`、`showTotalBalance`、`smartdoor_disable_auto_markup`、`smartdoor:boardHeightHistory`。
- `IndexedDB`：`ImageDatabase.images`（图片/收款码/画图快照）、`ImageDatabase.options`（颜色/玻璃选项缓存）。

---

## 8. 后端 API 动作清单（旧版 param1 汇总）

| param1 | 方法 | 用途 |
|---|---|---|
| getLatestClientsInfo | GET | 全量客户（含品牌） |
| getClientsInfo | GET | 客户关键词搜索 |
| getDiaoFormulas / getDiaoFormulasSingle | POST | 匹配吊公式（body `{formula:[...], id:[...]}`） |
| getDiaoPrice | GET | 取吊门单价（param2=ds&param3=型材&param4=客户） |
| getPingPrice | POST | 取平开单价 |
| initializPing | POST | 初始化平开 |
| changeSquare | POST | 修改平方数 |
| updateRowData | POST | 保存单行 |
| makeReceipt | POST | 保存整单 |
| deleteRow | POST | 删除已录入行 |
| finance_getCustomerBalance | GET | 客户余额 |
| finance_checkOrderPayment | POST | 回款/分配校验（body `[回执单号,...]`） |
| finance_updateOrderCustomer | POST | 改客户名 |
| finance_addOrderPayment | POST | 添加回款（Home） |
| finance_addOrderAdjustment | POST | 红冲抹零/收款（Home，需密码） |
| finance_getOrderFinanceSummary | GET | 订单财务汇总（ReceiptShare） |
| updataProgress | POST | 更新生产进度 |
| updataPaymentCollection | POST | 全单回款（Progress） |
| DrawingBehaviors | GET | 行为埋点 |

---

## 9. 已知源缺陷（重构时直接修正）

1. `luiyifour` 的 `扇中方`/`扇玻璃宽/高` 引用 `上下方.result`/`光企高.result`，实际 key 是 `扇上下方`/`扇光企高` → 跨引用落空。
2. `doubleWindow.门框高` 正向用 `h1`、逆向用 `h`，正逆不一致。
3. `pt` 的 `2轨2扇/3轨3扇/2轨4扇光企高` materialName 误写为「勾企高」。
4. 锁向选项 `右固玻` 重复一次。
5. `DubleDong` 应为 `DoubleDong`（旧数据兼容读）。

---

## 10. 重构映射建议

1. **数据模型**：`Order`（订单头）+ `OrderLine`（行，含平开/吊趟差异字段用可空列）两张表，`tenant_id` 多租户。行表字段见 §2.2/§2.3。
2. **枚举数据外置**：扇数 24 项、方向后缀（含折叠 M+P）、开向键→3D 码映射，作为纯数据 JSON 资源（前端可复用，后端校验可引用）。
3. **公式引擎**：实现安全公式求值器（Rust），复刻正向/逆向 DSL，修正 §9 缺陷。
4. **计价**：订单级 `套/方` + 加价项目级六单位，总价 = `round((单价×量 + Σ加价) × 打折)`。
5. **双层命名**：保留 `openDirectionCustomNames` 原名↔显示名机制。
6. **标签数量**：`数量 × (扇数 × sheets + 1)` + 加项/工厂特判，收敛为「扇数→N」查找表 + 配置表。
7. **终端 token**：`{ds+1000}af{7×编号+1987}wy{时间戳+888}`，与客户模块 `copyTerminalLink` 一致。
8. **打印/3D/分享**：hiprint 模板与 html2canvas 分享属前端能力，重构可先以「回执单预览 + 打印数据 JSON」为 MVP，再逐步接 hiprint/云打印。
