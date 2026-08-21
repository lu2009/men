# 「开门红」前端复刻设计文档

> 目标：基于现有生产构建产物，逆向分析并输出一份可用于**从零复刻**该前端的完整设计文档。
> 适用对象：前端工程师 / 架构师。本文档描述的是业务、架构、页面、数据与设计规范，不包含可复用的源码。

---

## 1. 项目概述

「开门红」是一个面向**铝合金门窗加工厂**的 SaaS 化 **ERP + MES** 前端，覆盖从接单、算料计价、生产进度、财务回款到打印交付的全流程。

| 维度 | 说明 |
|---|---|
| 产品名 | 开门红（开红） |
| 域名 | `www.samrtdoor.com.cn`（注意域名拼写为 "samrt"） |
| 业务领域 | 铝合金门窗 / 移门 / 平开门 / 吊趟门的算料、计价、生产、财务 |
| 部署形态 | 纯静态 SPA（Vite 构建产物），多租户（租户标识 `ds`） |
| 主要用户 | 门窗厂员工、业务员、老板、终端客户（移动端扫码/看单） |

---

## 2. 技术栈与依赖

### 2.1 核心框架

| 技术 | 用途 | 证据 / 说明 |
|---|---|---|
| **Vue 3**（Composition API） | 前端框架 | `vue.min.js` + 主运行时 `vue-ade658be.js`（4.8MB） |
| **Vue Router** | 路由 | `vue-router.min.js`，路由懒加载 |
| **Vite** | 构建工具 | 产物带 hash、`modulepreload`、`type="module"` 入口 |
| **Element Plus** | UI 组件库 | `element-plus.min.js` + `element-plus.css`，全局主题色 `#409eff` |
| **jQuery** | 辅助 / 打印模板兼容 | `jquery.min.js` |
| **ECharts** | 图表（Dashboard 等） | `echarts.min.js` |
| **Konva.js** | 2D Canvas 画图（画门窗） | `konva.min.js` |
| **Three.js** | 3D 可视化 | `three-52679e93.js`（676KB chunk） |
| **ExcelJS** | Excel 导出 | `exceljs.min.js` |
| **hiprint** | 打印模板 / 打印服务 | 运行时动态加载，WebSocket 打印 |
| **socket.io** | 打印服务连接 | 打印连接器使用 `io()` |
| **Coze WebChat SDK** | AI 智能客服 | `vendor/coze/chat-app-sdk.js` |
| **jsPDF / html2canvas** | PDF 生成 / 图片导出 | `vue-ade658be.js` 内含 jsPDF |
| **Web Share / File System API** | 移动端分享 / 文件保存 | 打印导出逻辑使用 |

> 关键结论：**UI 层统一使用 Element Plus**，**画图/3D/打印为独立能力模块**，通过路由懒加载隔离。

### 2.2 第三方服务

- **AI 客服**：Coze（扣子）智能体 `bot_id: 7598032591115681838`，Token 鉴权，昵称「小红智能客服」。
- **打印服务**：自建本地/云打印服务，默认端口 `17521`，通过 socket.io + WebSocket 通信（详见 §10.4）。
- **云打印**：`https://v4.printjs.cn:17521`（hiprint 云服务）。

---

## 3. 构建与部署架构

### 3.1 入口 `index.html`

```
<head>
  <!-- ① vendor 全局库（非 module，直接挂 window） -->
  vue.min.js, vue-router.min.js, jquery.min.js, element-plus.min.js
  element-plus.css, echarts.min.js, konva.min.js, exceljs.min.js

  <!-- ② 打印锁定样式（print media） -->
  <link media="print" href="/print-lock.css">

  <!-- ③ 请求拦截器（本地开发环境适配，见 §8.5） -->
  <script src="/js/local-request-interceptor.js">

  <!-- ④ 主入口 bundle + 代码分割 chunk -->
  <script type="module" src="/js/index-c3b16e3f.js">
  <link rel="modulepreload" href="/js/vue-ade658be.js">
  <link rel="stylesheet" href="/css/index-8cdd67d2.css">
</head>
<body>
  <div id="app"></div>
  <!-- ⑤ Coze 智能客服 SDK + 位置自适应脚本 -->
</body>
```

### 3.2 构建产物特征

- 产物为**已压缩 + 字符串混淆**（标识符经 base64 类编码混淆，中文字符串保留）。
- 按路由**代码分割**：每个页面一个 `*.js` chunk（如 `Home-d6b13b9a.js`、`Hui-d088417c.js`），部分大页面带 `.gz` 预压缩。
- 入口 bundle `index-c3b16e3f.js` 承载：路由表、全局 API 封装、公共工具、应用外壳。

### 3.3 部署

- 纯静态资源（html + js + css + png），可部署到任意静态服务器 / CDN。
- 与后端同域 `samrtdoor.com.cn`，打印服务走独立端口 `17521`。

---

## 4. 目录结构

```
frontend/
├── index.html                    # 入口 HTML
├── favicon.ico
├── print-lock.css                # 打印时锁定页面（防止打印多余内容）
├── download-cdn.sh               # 下载 CDN 资源的脚本
├── smartAI.png                   # AI 客服头像
├── GIFEncoder.js / LZWEncoder.js / TypedNeuQuant.js  # GIF 动图生成
├── gif.worker.js                 # GIF 编码 Worker
├── vendor/                       # 第三方库（本地化）
│   ├── js/  vue.min.js, vue-router.min.js, jquery.min.js,
│   │        element-plus.min.js, echarts.min.js, konva.min.js, exceljs.min.js
│   ├── css/ element-plus.css
│   └── coze/ chat-app-sdk.js     # Coze 客服 SDK
├── css/                          # 按路由分割的样式 chunk
│   ├── index-*.css               # 全局样式
│   ├── vue-*.css / element-plus-*.css
│   └── <PageName>-*.css          # Home/Diao/Hui/drawDoor/... 各页样式
├── js/                           # 代码分割 JS chunk
│   ├── index-c3b16e3f.js         # 入口（路由 + 全局封装）
│   ├── index-7ca9e657.js         # 打印模板配置（hiprint 模板 JSON）
│   ├── local-request-interceptor.js  # 本地开发请求拦截/图片缓存
│   ├── <PageName>-*.js           # 各页面 chunk
│   ├── printService/printConnector/receiptBuilder/mutilPrintService  # 打印服务封装
│   ├── useParametricPattern/usePasswordVerify/useAddPriceItems       # 组合式函数
│   ├── openDirectionNaming/passwordStrength                          # 工具函数
│   └── three-*.js                # Three.js 运行时
└── png/                          # 门窗示意图资源
    ├── 2/3/4_*.png               # 开向/门型示意小图
    ├── windowsDoor-*.png         # 窗示意
    └── 开门红-*.png              # Logo
```

---

## 5. 应用外壳（布局与导航）

### 5.1 响应式布局

| 断点 | 布局 | 导航 |
|---|---|---|
| `≥ 768px`（桌面） | 顶部导航栏（高约 60px） | 顶部横向菜单 |
| `< 768px`（移动） | 底部导航栏（高约 65px） | 底部 Tab Bar |

### 5.2 导航菜单项（App Shell）

从入口 bundle 提取的主导航文案：

| 菜单 | 对应路由/功能 |
|---|---|
| 生产 | `/home`（订单生产总表） |
| 生产进度 | `/Progress` |
| 画门窗 | `/drawDoor`（2D 画图） |
| 菜单 | 更多功能入口（3D、扫码、终端、设置等） |
| 通知 | 通知/公告（`syncNoticeBoard` 同步） |

### 5.3 全局能力

- **安全锁定**：触发安全保护时记录取证并退出登录。
- **试用/版本控制**：免费用户画门窗功能限时；试用号提示。
- **版本更新**：PWA 式更新提示（「更新包已下载完成」）。
- **登录态过期**：超过 7 天强制重新登录。
- **AI 客服悬浮**：右下角悬浮，桌面避开顶部导航，移动端避开底部导航（zIndex 1001）。

---

## 6. 路由与页面地图

共 **19 条路由**，均通过 `() => import('./<Page>-*.js')` 懒加载。

| # | 路径 | 路由名 | 页面 chunk | 说明 |
|---|---|---|---|---|
| 1 | `/` | — | Home | 根路由（默认进入生产总表） |
| 2 | `/login` | Login | Login | 登录 / 修改密码 |
| 3 | `/home` | Home | Home | **生产订单总表**（核心） |
| 4 | `/hui` | Hui | Hui | **汇算 / 计价**（算料） |
| 5 | `/Diao` | Diao | Diao | **吊 / 公式编辑器**（门型公式） |
| 6 | `/Progress` | Progress | Progress | **生产进度**（工序、回款） |
| 7 | `/drawDoor` | drawDoor | drawDoor | **画门窗**（2D 画图设计） |
| 8 | `/sliding-door-3d` | SlidingDoor3D | SlidingDoor3D | 移门 3D 展示 |
| 9 | `/composite-gate-3d` | CompositeGate3D | CompositeGate3DDemo | 复合门 3D 展示 |
| 10 | `/3d-view` | 3DView | — | 3D 视图入口 |
| 11 | `/clients_Info` | ClientsInfo | clients_Info | 客户信息管理 |
| 12 | `/terminal-orders` | TerminalOrders | TerminalOrders | 终端订单查询 |
| 13 | `/setting` | Setting | setting | 设置（打印服务、品牌等） |
| 14 | `/Qrscanner` | Qrscanner | Qrscanner | 扫码生产 |
| 15 | `/receipt-view/:receiptNo` | ReceiptView | ReceiptView | 回执单详情 |
| 16 | `/receipt-share` | ReceiptShare | ReceiptShare | 回执单分享页 |
| 17 | `/share` | ShareView | — | 分享入口 |
| 18 | `/share/:id` | ShareViewById | — | 分享详情 |
| 19 | `/test-addprice` | TestAddPrice | AddPriceItemsTest | 加价项目测试页 |

> 另有独立组件 `ReceiptMobile`（移动端回执单）、`roundKnobLock`（圆把手锁编辑器）、`SlidingDoor3DDemo`（移门 3D Demo）、`draw`（SVG 绘制库）、`1_right` / `10-5_5-front`（3D 辅助模块）等，被主页面按需引用。

---

## 7. 设计系统

### 7.1 颜色

**基础为 Element Plus 默认主题，叠加品牌蓝色与一处蓝紫渐变。**

| 角色 | 色值 | 用途 |
|---|---|---|
| 主色 Primary | `#409eff` | 按钮、链接、选中态（Element Plus 默认） |
| 品牌深蓝 | `#0965fa` / `#4785e6` | 强调色、Logo、关键操作 |
| 品牌浅蓝 | `#7caaf3` / `#bbd0fa` / `#ecf5ff` | 浅色强调、选中背景 |
| 蓝紫渐变 | `#667eea → #764ba2` | 登录页/品牌氛围渐变 |
| 青色点缀 | `#3de7c9` | 高亮点缀 |
| 主文本 | `#303133` | 标题、正文强调 |
| 常规文本 | `#606266` | 正文 |
| 次要文本 | `#909399` | 说明、辅助 |
| 占位文本 | `#c0c4cc` | placeholder |
| 边框 | `#dcdfe6` / `#e4e7ed` / `#ebeef5` | 分隔线、边框 |
| 背景 | `#f5f7fa` / `#fafafa` / `#f0f1f4` / `#f0f0f3` | 页面/卡片背景 |
| 成功 | `#67c23a`（浅 `#f0f9eb`） | 成功状态 |
| 警告 | `#e6a23c` | 警告 |
| 危险 | `#f56c6c`（浅 `#fef0f0`） | 错误、删除 |
| 信息 | `#909399` | 提示 |

### 7.2 组件规范

- **按钮**：Element Plus `el-button`，主操作用 `type="primary"`，删除/危险用 `type="danger"`。
- **表格**：`el-table` + `el-pagination`，支持列宽设置、排序（`smartdoor_sort_method` 本地记忆）、批量选择、导出。
- **表单**：`el-form` / `el-input` / `el-select` / `el-date-picker`，数字输入带单位下拉（元/套、元/方、元/米）。
- **弹窗**：`el-dialog` / `el-message-box`（含 `inputType: password` 的密码验证弹窗）。
- **消息**：`ElMessage` / `ElNotification`（通知）。
- **标签**：`el-tag`（付款状态、工序状态等）。
- **图标**：内联 SVG 为主。

### 7.3 打印锁定

`print-lock.css` 用于 `@media print`：打印回执/标签时锁定页面布局，避免多余内容被打印。

---

## 8. 数据层

### 8.1 后端 API 网关（统一入口）

所有业务请求走**单一网关**，采用 `param1` 作为「动作名」：

```
GET/POST  https://www.samrtdoor.com.cn/1?param1=<action>&param2=<payload>&param3=<extra>...
```

- `param1` = 业务动作（见 §8.3）
- `param2` = 主参数（JSON / 字符串）
- `param3 ~ param6` = 附加参数
- 文件/图片服务独立：`/api/v1/files/<id>`（可带 `?width=800`）、`/api/v1/files/batch`（POST 批量取图）
- 登录返回 `userinfo.ds` 作为**租户标识**，多租户隔离。

### 8.2 认证与会话

| 项 | 说明 |
|---|---|
| 登录动作 | `param1=login` |
| 登录响应 | `[ { statu, userinfo: { name, ds, registrant } } ]` |
| 本地存储 | `token`、`token_expires_at`、`remember_password`、`loginDate`、`staffName` |
| 租户隔离 | `smartdoor_active_identity = name|ds|registrant`，切换租户时清理缓存 |
| 密码规则 | 长度 8–20，含大小写字母、数字、特殊字符 |
| 二次验证 | 敏感操作（冲销、改价等）需输入密码（`param2=registrant, param3=password` 校验） |

### 8.3 API 动作清单（param1）

| 分类 | 动作名 | 用途 | 主要使用页 |
|---|---|---|---|
| 认证 | `login` | 登录 | Login |
| 订单/总表 | `getTableData` | 生产总表数据 | Home |
| | `getMoreTableDate` | 加载更多订单 | TerminalOrders |
| | `getTableDataForTerminal` | 终端订单表 | Home |
| | `getorders` | 获取订单 | ReceiptShare |
| | `detail` | 订单详情 | Home |
| | `updateRowData` | 更新行数据 | Hui |
| 客户 | `getClientsInfo` | 客户列表 | Home/clients_Info |
| | `getLatestClientsInfo` | 最新客户信息 | Home/Progress/Hui |
| 画图 | `DrawingBehaviors` | 画图行为配置 | drawDoor |
| | `parametric` | 参数化门花 | drawDoor |
| | `getimage` | 获取图片 | Home/Progress |
| 吊/公式 | `getDiaoFormulas` | 吊公式列表 | Hui |
| | `getDiaoPrice` | 吊计价 | Hui |
| | `getFormulaName` | 公式名称 | Diao |
| | `saveFormula` | 保存公式 | Diao |
| | `changeSquare` | 修改平方数 | Hui |
| | `deleteGlassHole` | 删除玻璃挖孔 | Diao |
| | `glassHole` | 玻璃挖孔 | Diao |
| 生产进度 | `updataProgress` | 更新工序进度 | Progress |
| | `updataPaymentCollection` | 更新回款 | Progress |
| 财务 | `finance_getOrderFinanceSummary` | 订单财务汇总 | ReceiptShare |
| | `finance_getCustomerBalance` | 客户余额 | Home |
| | `finance_addOrderPayment` | 添加回款 | Home/Progress |
| | `finance_addOrderAdjustment` | 订单调整（红冲） | Home |
| | `finance_checkOrderPayment` | 校验回款 | Home |
| | `finance_updateOrderCustomer` | 更新订单客户 | Home |
| 其他 | `syncNoticeBoard` | 同步公告板 | 全局 |

### 8.4 本地存储（localStorage）

| Key | 用途 |
|---|---|
| `token` / `token_expires_at` | 登录凭证 |
| `remember_password` / `loginDate` / `staffName` | 登录记忆 |
| `smartdoor_active_identity` | 当前租户身份 |
| `smartdoor_last_order` | 最近订单 |
| `smartdoor_sort_method` | 表格排序偏好 |
| `smartdoor_swingLockType` | 平开门锁型偏好 |
| `openDirectionCustomNames` | 自定义开向命名 |
| `newFinanceSystem` | 是否启用新财务系统 |
| `showTotalBalance` | 显示总余额 |
| `GlassThickness` | 玻璃厚度记忆 |
| `try_time` | 试用次数 |
| `_capuid` | 设备标识 |

### 8.5 IndexedDB 缓存

| 数据库 | 表 | 用途 |
|---|---|---|
| `ImageDatabase` | `images`, `options` | 图片/选项缓存 |
| `ImageCache` | `blobs` | 图片 base64 缓存（打印用） |

> `local-request-interceptor.js` 负责：①本地开发时把生产域名/打印端口重写到本地；②图片预加载 `__smartdoor_preloadImages`；③打印模板图片替换为缓存；④登录租户切换时清理缓存。

### 8.6 核心数据模型

**订单（Order）**：
```
单号(单号集) · 客户(编号/名称/电话/地址) · 业务员 · 品牌
开向(内左/内右/外左/外右/对开/子母) · 轨道(单轨1-2扇/2轨2-4扇/3轨/4-8轨)
门数 · 宽 · 高 · 墙厚 · 平方数 · 单价 · 计价方式(元/套|元/方|元/米|元/公分|元/支)
型材 · 五金 · 玻璃(单玻/双玻/玻璃厚/白玻/磨砂) · 颜色 · 备注
定金 · 已付 · 未付/未收 · 总价 · 优惠 · 加价项目
```

**客户（Client）**：编号、名称、联系人、电话、送货电话、地址、户籍、物流商、物流电话、品牌。

**财务（Finance）**：回款记录、冲销、预付款分配、客户余额、订单财务汇总。

---

## 9. 页面详细设计

### 9.1 Login（登录）

- 品牌渐变背景（蓝紫渐变），Logo「开门红」。
- 用户名 / 密码 / 记住密码。
- 登录后写 `token` 与租户信息；首次加载提示「首次加载中，请耐心等待」。
- 支持修改密码（原密码 + 新密码 + 确认，密码强度校验）。
- 备案信息链接（工信部 + 公安备案）。
- 设备授权限制、安全保护提示。

### 9.2 Home（生产订单总表）——核心页

- **顶部筛选**：全部 / 今天 / 上月 / 日期范围 / 付款状态（全部、全部未付）/ 业务员 / 客户。
- **订单表格**：多列（单号、客户、开向、门型、尺寸、平方、单价、金额、定金、已付、未付、业务员、品牌、进度、加价项目等）。
- **行操作**：详情、制单、打印、分享、删除、改客户名、修改金额、冲销、分配、加价。
- **财务面板**：客户余额、预付款抵扣、回款、冲销（红冲抹零/红冲收款）、分配列表。
- **工具**：列宽设置、刷新、导出 Excel、扫码生产入口。
- **通知**：公告板（`syncNoticeBoard`）。

### 9.3 Hui（汇算 / 计价）

系统最复杂页面（chunk 651KB），是**门窗算料计价引擎**的前端：

- **门型/开向选择**：支持大量开向（轨 1–8 扇、内开/外开、对开、子母、一固一活等）与轨道种类。
- **尺寸输入**：门洞宽/高、墙厚、门框宽/高、玻璃宽/高、轨道超长等，支持「一宽/一高/两高两宽」多模式。
- **计价**：单价 × 平方数/套数/米，支持修改平方数、优惠比例、加价项目、其它费用。
- **公式匹配**：调用 `getDiaoFormulas` / `getDiaoPrice` 匹配吊公式自动算料，输出各部件（上下方、光企、勾企、边封、中柱、扣板、玻璃、五金等）的尺寸与用量。
- **客户信息**：输入/选择客户，同步客户余额。
- **打印**：出货清单、切料标签、收据单、生产单定制、复制玻璃单。
- **分享/保存**：分享订单、保存布局。

### 9.4 Diao（吊 / 公式编辑器）

门窗行业「吊」即**按门型公式自动拆分算料**的配置页：

- **公式管理**：公式名称、公式类别、公式类型（`getFormulaName` / `saveFormula`）。
- **部件参数**：上下方、光企、勾企、边封、中柱、盖板、上横/下横、上滑/下滑、上轨/下轨、亮窗（上亮/中上亮/分体亮窗）、一固一活、中开门复古门等大量参数。
- **玻璃挖孔**：上传/删除挖孔图（`glassHole` / `deleteGlassHole`）、亮窗示意图。
- **教学视频**：抖音视频链接引导。

### 9.5 Progress（生产进度）

- **生产工序**：按订单显示工序状态，`updataProgress` 更新进度（工序用「工序N」标识）。
- **回款管理**：`updataPaymentCollection` 全单回款，显示回执单号、定金、已回款。
- **订单信息**：单号、客户、开向、门型、玻璃、五金、套线、型材、墙厚、安装地址、备注。
- **操作**：发货、收据单、回款、复制玻璃单、导出表格、全选/取消全选。

### 9.6 drawDoor（画门窗，2D 画图）

基于 **Konva.js** 的 2D 门窗设计画布：

- **画布工具**：画门扇/门框/窗框、竖线、横线、分段横线、竖梃、中横、圆弧/拱形（单拱/双拱/圆拱/半圆）、圆角、两点画线、等分格。
- **门花（门花）**：参数化门花（后端 `parametric` 拉取 / 本地导入方案），画门花、复制/镜像门花、清空。
- **锁具/把手**：一字锁、左锁/右锁、内左锁、把手、圆把手锁编辑器（`roundKnobLock`）。
- **对象操作**：选中、删除（Delete 键）、修剪、镜像、偏移、对象捕捉、颜色、间距。
- **动画/GIF**：生成门扇动画视频、GIF 动图。
- **导出**：保存方案、另存为、分享、下载图片、复制到剪贴板、一键 3D（跳转 3D 视图）。

### 9.7 SlidingDoor3D / CompositeGate3D（3D 展示）

基于 **Three.js**：

- **移门 3D（SlidingDoor3D）**：门框/窗框/边框/边封、玻璃（白玻/磨砂/纯色/透明）、纱网位置、竖扣板、拉手、连接件、轨扇类型（1–8 扇）、灯光、渲染尺寸、箱体颜色、门店名称。
- **复合门 3D（CompositeGate3D）**：平开门/推拉门，门洞宽/高、开门角度、锁扇、把手位置、木纹/橡木材质、墙体（砖墙）、相机距离/录制距离倍率、正面/侧面视角、标注、备注。
- **视频导出**：录制动画视频，支持 WebM→MP4 转换、下载/分享。
- 两页均支持「预览」「清空」「恢复默认视角」。

### 9.8 clients_Info（客户信息）

- 客户列表：编号、客户、品牌、联系人、电话、送货电话、地址、户籍、物流商、物流电话。
- 操作：新增、删除、刷新、复制「终端链接」到剪贴板（供终端扫码下单）。

### 9.9 TerminalOrders（终端订单）

- 终端自主下单的订单查询：按日期范围、客户、安装地址搜索。
- 订单字段：单号、客户、电话、门数、锁向、总价、总金额、定金、已付、已分配、未收、回执单号、打单人、备注。
- 操作：查询更多、获取回执单、退出系统、自主下单入口。

### 9.10 Qrscanner（扫码生产）

- 摄像头扫码（前置/后置切换），解析订单二维码进入生产。
- 扫码账号管理：创建/删除扫码账号（员工名+密码），复制账号密码到微信。
- 颜色设置：一键重置颜色。
- 云打印、打印相关操作。

### 9.11 Receipt 系列（回执单）

| 页面 | 说明 |
|---|---|
| `ReceiptView` (`/receipt-view/:receiptNo`) | 回执单详情展示（客户、订单、金额、门数、锁向、打单、备注） |
| `ReceiptShare` (`/receipt-share`) | 回执单分享页，含完整计价明细（开向、轨道、玻璃、尺寸、金额） |
| `ReceiptMobile` | 移动端回执单：效果预览、尺寸、玻璃、数量、金额合计、微信/支付宝扫码支付 |

### 9.12 Setting（设置）

- **云打印服务**：服务状态（在线/离线）、连接 ID、启动/连接、Token 复制、打印机列表。
- **打印服务地址**：默认 `:17521`，支持本地打印服务联动。
- **品牌/门店名**：内置多家门厂名称（宏辉门窗、帝奥名门、德清顾家、恒超名门、美固建材、铂卫邦铝门、鑫源移门加工厂等）。
- **打印模板类型**：出货清单、切料标签、收据单、生产单定制、标签。

---

## 10. 核心功能模块

### 10.1 画图（2D / Konva）

- 画布分层：门框层 / 门扇层 / 门花层 / 锁具把手层 / 标注层。
- 图元类型：直线、竖线、横线、分段线、圆弧、圆、圆角矩形、文字标注。
- 操作栈：选中、删除、修剪、镜像、偏移、对象捕捉、等分。
- 数据流：画布状态 ↔ 本地方案（导入/导出）↔ 后端参数化门花。

### 10.2 3D（Three.js）

- 场景组装：门框/门扇/玻璃/纱网/拉手/锁/连接件/墙体，材质支持颜色/贴图（木纹、橡木）。
- 相机：正/侧视角、距离缩放、默认视角恢复。
- 动画：门开合动画、推拉动画。
- 导出：视频（WebM/MP4）、预览图。

### 10.3 财务

- **回款（Payment）**：`finance_addOrderPayment` 添加回款、`updataPaymentCollection` 批量回款。
- **冲销（Reversal）**：红冲抹零 / 红冲收款，`finance_addOrderAdjustment`。
- **分配（Allocation）**：预付款分配到订单，不能超过余额/本单未收。
- **余额**：`finance_getCustomerBalance` 客户未分配余额。
- **校验**：`finance_checkOrderPayment` 回款前校验。
- 支持「新财务系统」开关（`newFinanceSystem`）。

### 10.4 打印（hiprint）

- **模板**：receipt（收据）、product / product1–10（产品/标签）、glass（玻璃单）、glassHole（玻璃挖孔）、lable（标签）、FinalReceipt（最终回执）、ReceiptList（回执列表）、sale（销售单）。
- **服务连接**：socket.io → `hiprint-smartdoor-<ds>` 命名空间，WebSocket 端口 `17521`，支持本地/云打印。
- **能力**：打印、批量打印、导出 PDF/图片、标签导出、分享（移动端 Web Share / File System API）。
- **打印方向**：标签 70×90mm 纵向；单据 297×210mm 横向。

### 10.5 扫码（QR）

- 摄像头扫码解析订单，扫码账号体系（员工名+密码）用于终端授权。

### 10.6 AI 客服（Coze）

- 右下角悬浮窗，`bot_id` 固定，Token 鉴权，标题「小红智能客服」，禁用上传/语音/新建会话，隐藏 footer。

---

## 11. 复刻实施指南

建议按以下阶段复刻：

### 阶段 0：脚手架
1. `Vite + Vue 3 + vue-router` 初始化。
2. 引入 `element-plus`（按需/全量），配置主色 `#409eff`。
3. 本地化 vendor 依赖（vue、element-plus、echarts、konva、three、exceljs）。

### 阶段 1：应用外壳
1. 实现响应式布局（顶部/底部导航）。
2. 实现登录页 + token 会话 + 路由守卫（未登录跳 `/login`）。
3. 封装统一 API 网关 `request(param1, payload)` → `/1?param1=...`。

### 阶段 2：核心业务页（MVP）
1. **Home 生产总表**：筛选 + 表格 + 分页 + 行操作（详情/删除/改价）。
2. **clients_Info 客户管理**。
3. **Progress 生产进度** + 工序更新。

### 阶段 3：计价与公式
1. **Hui 汇算**：门型/开向选择、尺寸输入、计价。
2. **Diao 公式编辑器**：公式 CRUD、部件参数。

### 阶段 4：可视化
1. **drawDoor**：Konva 画布 + 基础图元工具。
2. **SlidingDoor3D / CompositeGate3D**：Three.js 场景 + 材质 + 视频导出。

### 阶段 5：打印与终端
1. hiprint 模板 + 打印服务连接（socket.io）。
2. **ReceiptView / ReceiptShare / ReceiptMobile** 回执单。
3. **Qrscanner** 扫码 + 扫码账号。

### 阶段 6：增强
1. 财务模块（回款/冲销/分配）。
2. ExcelJS 导出、ECharts Dashboard。
3. Coze AI 客服集成、PWA 更新、安全锁定。

---

## 12. 附录

### 12.1 行业术语表

| 术语 | 含义 |
|---|---|
| 吊（Diao） | 按门型公式自动拆分算料的规则 |
| 汇算（Hui） | 门窗计价/算料 |
| 光企 / 勾企 | 移门扇的两侧竖型材 |
| 上下方 / 上横 / 下横 | 门扇/门框的横向型材 |
| 边封 | 门框左右封边型材 |
| 中柱 / 中横 / 竖梃 | 分隔框的竖/横型材 |
| 上轨 / 下轨 | 移门上下轨道 |
| 亮窗 | 门上方透光小窗（上亮/中上亮/分体亮窗） |
| 套线 / 扣板 | 门套装饰线条/盖板 |
| 一固一活 | 一扇固定 + 一扇活动 |
| 子母门 | 大小双开门 |
| 哑口 | 门洞套（无门扇） |
| 开向 | 门的开启方向（内左/内右/外左/外右/对开） |
| 轨扇 | 轨道数与门扇数（如「3轨2扇1纱」） |
| 门花 | 门扇上的装饰花格 |
| 挖孔 | 玻璃上开孔 |

### 12.2 关键常量

| 项 | 值 |
|---|---|
| 生产域名 | `https://www.samrtdoor.com.cn` |
| 打印服务端口 | `17521` |
| 打印命名空间 | `hiprint-smartdoor-<租户序号+1088>` |
| 图片 API | `/api/v1/files/<id>` / `/api/v1/files/batch` |
| 桌面导航高度 | 60px |
| 移动导航高度 | 65px |
| 密码规则 | 8–20 位，大小写 + 数字 + 特殊字符 |
| 登录有效期 | 7 天 |

---

*本文档基于生产构建产物的静态分析生成，涵盖了架构、路由、页面、设计系统、数据层与核心模块。复刻时可结合真实后端接口文档进一步对齐字段与响应结构。*
