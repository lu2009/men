import type {
  AuthResponse,
  ClientDto,
  ClientInput,
  FormulaDto,
  FormulaImageDto,
  FormulaImageInput,
  FormulaInput,
  HealthResponse,
  MeResponse,
  AddPriceItemDto,
  AddPriceItemInput,
  ColumnConfigInput,
  FormulaMatchResolveDto,
  OrderDto,
  OrderHeadInput,
  OrderInput,
  OrderLineInput,
  OrderSearchParams,
  OrderSummaryDto,
  PriceResolveDto,
  ProcedureSlotDto,
  ProceduresDto,
  ProgressRowDto,
  PrintTemplateDto,
  ReceiptDto,
  ReceiptShareToken,
  OrderFinance,
  OrderFinanceDetail,
  CheckOrderPaymentItem,
  AllocationReversal,
  CustomerBalance,
  StatementItem,
  AllocationPreview,
  PrepaymentAllocationPreview,
  PaymentStatsDto,
  AddOrderPaymentInput,
  AddOrderAdjustmentInput,
  AddCustomerPaymentInput,
  AddCustomerAdjustmentInput,
  AllocationPreviewInput,
  PrepaymentPreviewInput,
  PrepaymentExecuteInput,
} from './types'

// 统一 API 封装。Web 端经 Vite 代理走相对路径 /api；
// Tauri 桌面端通过 VITE_API_BASE_URL 指向后端绝对地址。
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const TOKEN_KEY = 'smartdoor_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

interface ApiError extends Error {
  status?: number
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.error?.message) message = body.error.message
    } catch {
      // 忽略非 JSON 错误体
    }
    const err = new Error(message) as ApiError
    err.status = res.status
    throw err
  }

  if (res.status === 204) return undefined as T
  const body = await res.json()
  // 后端成功响应统一为 { data: ... }；显式 data:null 也须原样返回 null（不可用 ?? 兜底成整包对象）。
  if (body && typeof body === 'object' && 'data' in body) return body.data as T
  return body as T
}

export const api = {
  login: (payload: { username: string; password: string }) =>
    request<AuthResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ logged_out: boolean }>('/v1/auth/logout', { method: 'POST' }),
  me: () => request<MeResponse>('/v1/auth/me'),
  health: () => request<HealthResponse>('/v1/health'),
  /**
   * 生产进度（旧版 `/Progress` 页）。
   *
   * ⚠️ 后端是**一次返回全量、不分页** —— 与旧版一致（旧版也拉全量、前端自己筛选/分页，
   * 它确实不重新请求）。所以这里也没有分页参数。
   *
   * ⚠️ 旧版还有个终端分支（`getProgressForTerminal`），服务端是**写死 400**，
   * 那条路本来就是坏的 ⇒ 新版不做。见 `docs/2026-09-19-progress-analysis.md` §10。
   *
   * ⚠️ **`/Qrscanner`（扫码页）不许调这一条。** 这里是**整库门行**（含客户名/金额/安装地址），
   * 而扫码页跑在**车间工人的手机**上 —— 该页一律走窄接口（`scanQrcode` / `scanStats` / `scanLabels`）。
   * 详见 `scanQrcode` 的注释：本版**栽过一次**（扫码页拉全量、前端自己筛）。
   */
  listProgress: () => request<{ progressData: ProgressRowDto[] }>('/v1/progress'),
  /**
   * 「查询更多」（旧版 `getMoreProgress`，`param3`–`param6` = 客户 / 安装地址 / 起止日期）。
   *
   * 只传非空条件 —— 与旧版「不填就不拼进 URL」等价，后端的四个参数也都能缺省（**空 = 全量**）。
   * 返回的**行结构与 `GET /v1/progress` 一模一样**（后端同一个 `build_row`）⇒ 前端一套 DTO 吃两条口。
   *
   * ⚠️ 两处**有意偏离旧版**（后端定下的口径，见分析文档 §8.3）：
   *   ① 地址筛的是**行里显示的那一格** `orders.install_address`，
   *      不是旧版那种「拿客户档案 `client.address` 筛、却显示 `customerInfo.安装地址`」的错位；
   *   ② 租户从登录态取，URL 里没有 `ds`。
   *
   * 参数结构直接复用 Home「查询更多」的 `OrderSearchParams`（同一个后端口径）。
   */
  listProgressMore: (params: OrderSearchParams) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && String(v).trim() !== '') qs.set(k, String(v).trim())
    }
    return request<{ progressData: ProgressRowDto[] }>(`/v1/progress/more?${qs.toString()}`)
  },
  /**
   * 更新若干行的某个工序槽（旧版 `param1=updataProgress`）。
   *
   * 语义是**覆盖**（旧版只有 `工序10` 走合并，那个特判新版去掉了）。
   * `value` 的格式约定是 `工序名[_操作员]_YYYY-MM-DD`，但**服务端不校验格式**。
   *
   * ## ★ 行怎么指：`lineIds` 或 `lineNos`，**二选一**（都给则取并集）
   *
   * 这是 2026-09-19 用户拍板加的 `line_nos` 那一半，**理由是对齐旧版**：
   * 旧版 `updataProgress` 的 body 本来就是**单号数组**（`progress.service.ts:598`
   * `orderIds: string[]`），服务端拿 `rowRefs(row)` 去比。新版把两条路都留着：
   * · `/Progress` 页手里只有行 id ⇒ 传 `lineIds`；
   * · `/Qrscanner` 手里只有扫到的**行级单号** ⇒ 传 `lineNos`。
   *
   * ★ 后者**省掉一次往返**：原先扫码端要先用 `GET /v1/progress` 拉全量建「单号 → 行 id」的表
   * （那条现在对扫码账号已 403，而且本来就超范围 —— 见 `scanQrcode` 的注释）。
   *
   * ⚠️ `lineNos` 是**行级单号**（`order_lines.line_no`，二维码里装的那个），
   *    **不是回执单号**。拿错了**两头都不报错**，只是改错行 —— 所以参数名在这里写全。
   *
   * ⚠️ **槽名会被服务端校验**（必须 `工序1`..`工序15`），野键直接 400 —— 这是新版加的。
   *
   * ## 返回与「没对上」的三种出口（★ 与旧版**逐条对齐**，不是我们发明的）
   *
   * | 情况 | 返回 |
   * |---|---|
   * | 全命中 | 200 `{updated:N, failed:[]}` |
   * | **部分命中** | 200 `{updated:N, failed:[没对上的单号]}` |
   * | **一个都没对上** | **400**（`没有要更新的行`） |
   * | `line_ids` / `line_nos` 都不给 | 400 |
   *
   * 依据是旧版（`progress.service.ts:654`）：
   * ```ts
   * if (failed.size > 0 && totalUpdated === 0) return { code: 400, data: { failed: [...] } };
   * return { code: 200, message: `更新成功，共更新 ${totalUpdated} 条记录…` };
   * ```
   * ⇒ 「零命中给 400、部分命中给 200」**本来就是旧版的口径**。
   * 后端那份表在 `backend/src/modules/progress/handler.rs:80`（「状态码只有两种」那张）。
   * ⚠️ 这里曾经有句「一律 200，哪怕 `updated: 0`」的注释与实现**互相打架**，
   *    2026-09-19 已按「代码为准」改掉（是本条注释写反了，不是实现错）。
   * 差分台 `docs/qrscanner-scan-logiccheck.mjs` 的 ⑤ 段是**两边各跑一次**比的这条，别再靠注释。
   *
   * @returns `updated` = 真被改到的行数；`failed` = **没找到**的那些单号
   *          （字段名照旧版 `data.failed`）。⚠️ 零命中走 400，**那条路的响应体里没有 `failed`**
   *          （旧版 400 的 body 里是带的 —— 这是新版全站错误信封带来的小差别，改由前端给通用提示）。
   */
  updateProgress: (payload: {
    slot: string
    value: string
    /** 行 id（`/Progress` 页用）。 */
    lineIds?: number[]
    /** **行级**单号（`/Qrscanner` 用）。 */
    lineNos?: string[]
  }) =>
    request<{ updated: number; failed: string[] }>('/v1/progress/update', {
      method: 'POST',
      // `undefined` 的键会被 `JSON.stringify` 直接丢掉 ⇒ 不会发出「空数组」那种歧义载荷。
      body: JSON.stringify({
        slot: payload.slot,
        value: payload.value,
        line_ids: payload.lineIds,
        line_nos: payload.lineNos,
      }),
    }),
  /**
   * 标签云打印的数据（旧版 `param1=getLabelData`，body = 单号数组）。
   *
   * 同样按**行级「单号」**取门行，返回结构与 `GET /v1/progress` 同构。
   *
   * ⚠️ 旧版的 `labelRow`（`progress.service.ts:181`）只挑 18 个中文键 ——
   * 那是「当时那个打印模板恰好用到的字段」的快照，不是业务边界；新版给整行。
   * 标签张数要按 `扇数`×`数量` / `亮窗总高` / `墙厚` 现算，只多不少。
   *
   * ⚠️ **旧版这条链路首尾不是同一个键**：二维码里装的是**行级**「单号」，
   * 服务端却按**订单号** `orderNo` 过滤（查不到、或撞上就多打整张单）。
   * 新版统一到行级 `order_lines.line_no`（分析文档 §8.6-(c)）。
   */
  scanLabels: (lineNos: string[]) =>
    request<{ rows: ProgressRowDto[] }>('/v1/scan/labels', {
      method: 'POST',
      body: JSON.stringify({ line_nos: lineNos }),
    }),
  /**
   * 扫码查单（旧版 `param1=getScanQRcode`）—— **只回命中的那几行**。
   *
   * ## ★ 为什么是端点而不是「拉全量 + 前端 filter」
   *
   * 本版**曾经**用 `GET /v1/progress` 拉全量再 `filter(单号)`，理由是「纯过滤、逐字等价」。
   * 2026-09-19 用户纠正：**不等价**。`GET /v1/progress` 是**全量门行**（含客户名/金额/安装地址），
   * 而扫码页跑在**车间工人的手机**上 —— 一次扫码就把整库订单摊到那台手机上，
   * 与旧版「每次扫码只请求命中的那几行」的数据面**根本不同**。
   * ⇒ 老服务端那条纯过滤接口**不是重复造**，是**最小暴露面**，恢复它。
   *
   * ⚠️ **找不到就是 404**（旧版就是 404，前端走 error 分支、不打开面板）——
   *    `request()` 会把它抛成 `status === 404` 的 `Error`，见 `Qrscanner.vue` 的 `runScanQuery`。
   *
   * ⚠️ 匹配口径仍在服务端：`btrim(单号)` 后**精确相等**（不是 includes、不是前缀）——
   *    与旧版 `String(row['单号']).trim()` 一致。
   *
   * ⚠️ `code` **可以是逗号分隔的多个单号**（服务端 `split(',')` 后取并集 —— 旧版 REST 路由
   *    `?orderNo=a,b` 就是这么发的）。`resolveLineIds` 的批量解析走的就是这条。
   *    空/全空白给 **200 + 空列表**（不是 404）；**有值但一个都没命中才 404**。
   */
  scanQrcode: (code: string) =>
    request<{ rows: ProgressRowDto[] }>(`/v1/scan/qrcode?code=${encodeURIComponent(code)}`),
  /**
   * 扫码统计看板的数据（旧版 `param1=getProcessCounts`）—— **只回范围内那几行**。
   *
   * 同 `scanQrcode`：不再让前端拉全量现推「扫码员工 / 扫码日期」。
   * 那条推导（旧版正则 `/_(.+)_(\d{4}-\d{2}-\d{2})$/`，**要两个下划线**）现在**只有服务端一份**，
   * 见 `utils/scanStats.ts` 里删掉的那段留下的说明。**前端不许再加回来。**
   *
   * ⚠️ **响应的键是 `progressData`，不是 `scanQrcode` 那个 `rows`** —— 服务端刻意与
   *    `GET /v1/progress` 同名同构（换接口时取数那行不用改），两条窄接口的键面**不一样**，
   *    别「顺手统一」。
   *
   * @param employee 员工名；**`"1"` 是「全部员工」的哨兵值**（旧版服务端 `getProcessCounts` 用它判）。
   *                 ⚠️ **服务端要求非空**：空串直接 400（旧版是 500 + 裸 HTML，服务端有意改成 400）。
   * @param range    `当天` / `本周` / `本月`，或 `"起,止"`（两个 `YYYY-MM-DD`）。
   *                 **标签由服务端换算**（`本周` 从**周一**算起）—— 前端不再算一份，免得两处漂。
   *                 同样**要求非空**（空串 400）。
   *
   * 回来的行**带 `扫码日期`**（服务端现推的那个日期；没标记的行根本不会回来）。
   */
  scanStats: (employee: string, range: string) => {
    const qs = new URLSearchParams({ employee, range })
    return request<{ progressData: ProgressRowDto[] }>(`/v1/scan/stats?${qs.toString()}`)
  },
  /**
   * 本租户的工序名清单（15 个扁平槽，顺序按槽号）。
   *
   * ⚠️ **颜色也在这条接口里** —— 旧版颜色根本不上服务端（只写本地 localStorage），
   * 这里是新版加的一列，见 `ProcedureSlotDto` 的注释。
   */
  listProcedures: () => request<ProceduresDto>('/v1/procedures'),
  /**
   * 保存工序配置（旧版 `param1=SetProcedures`，唯一写入点）。
   *
   * 一次事务 upsert，不是旧版那样逐槽 `findFirst` 再 update/create
   * （旧版按 `orderIndex` 找不到还会按 `name` 兜底查，同名不同槽会**误合并**）。
   *
   * ⚠️ 语义是「**只 upsert 请求里给的槽**，没提到的槽一个都不动」——
   * **不是**「整体替换、名称为空即删行」。`Qrscanner.vue` 每次都发全 15 槽，
   * 所以两种口径对它没差别；但别拿这条接口去发「只发改动槽」的差量。
   * （`name:""` 照样能把某个槽的名字清掉。）
   * 依据：`backend/src/modules/progress/service.rs` 的 `set_procedures` 文档注释。
   *
   * ⚠️ 旧版这条 POST 的 body 是 `{"工序1":"下料", …}`（槽号 → 工序名，**裸对象**），
   * **颜色一个字节都不传**、且**排掉工序10**；新版的 body 是
   * `{slots:[{slot,name,color}]}`，15 槽全发、颜色一起落库。
   */
  saveProcedures: (slots: ProcedureSlotDto[]) =>
    request<{ saved: boolean }>('/v1/procedures', {
      method: 'POST',
      body: JSON.stringify({ slots }),
    }),
  listFormulas: (search?: string) =>
    request<FormulaDto[]>(
      `/v1/formulas${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  getFormula: (id: number) => request<FormulaDto>(`/v1/formulas/${id}`),
  createFormula: (payload: FormulaInput) =>
    request<FormulaDto>('/v1/formulas', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateFormula: (id: number, payload: FormulaInput) =>
    request<FormulaDto>(`/v1/formulas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteFormula: (id: number) =>
    request<{ deleted: boolean }>(`/v1/formulas/${id}`, { method: 'DELETE' }),
  listFormulaImages: (id: number) => request<FormulaImageDto[]>(`/v1/formulas/${id}/images`),
  addFormulaImage: (id: number, payload: FormulaImageInput) =>
    request<FormulaImageDto>(`/v1/formulas/${id}/images`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteFormulaImage: (id: number, imageId: number) =>
    request<{ deleted: boolean }>(`/v1/formulas/${id}/images/${imageId}`, {
      method: 'DELETE',
    }),
  listClients: (search?: string) =>
    request<ClientDto[]>(
      `/v1/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  createClient: (payload: ClientInput) =>
    request<ClientDto>('/v1/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateClient: (id: number, payload: ClientInput) =>
    request<ClientDto>(`/v1/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteClient: (id: number) =>
    request<{ deleted: boolean }>(`/v1/clients/${id}`, { method: 'DELETE' }),
  listOrders: () => request<OrderSummaryDto[]>('/v1/orders'),
  // Home「查询更多」（旧版 `getMoreTableDate`）：按客户 / 安装地址 / 日期范围取一批订单头。
  // 只传非空条件 —— 与旧版「不填就不拼进 URL」等价（后端四个参数也都能缺省）。
  searchOrders: (params: OrderSearchParams) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && String(v).trim() !== '') qs.set(k, String(v).trim())
    }
    return request<OrderSummaryDto[]>(`/v1/orders/search?${qs.toString()}`)
  },
  getOrder: (id: number) => request<OrderDto>(`/v1/orders/${id}`),
  createOrder: (payload: OrderInput) =>
    request<OrderDto>('/v1/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateOrder: (id: number, payload: OrderInput) =>
    request<OrderDto>(`/v1/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  // 订单头就地编辑（不动行）：Home 主表内联编辑/改日期/改客户名。
  updateOrderHead: (id: number, payload: OrderHeadInput) =>
    request<OrderDto>(`/v1/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteOrder: (id: number) =>
    request<{ deleted: boolean }>(`/v1/orders/${id}`, { method: 'DELETE' }),
  /**
   * 合并订单（旧版 `param1=combine`）。
   *
   * ⚠️ 只传**订单 id 列表** —— 存活单由服务端按回执单号取最小算出来。
   * 旧版是前端算好 `{merged, record}` 交给服务端、服务端照单全收，
   * 传错就毁数据（源单物理删除、不可恢复），新版把这层堵掉了。
   */
  combineOrders: (orderIds: number[]) =>
    request<OrderDto>('/v1/orders/combine', {
      method: 'POST',
      body: JSON.stringify({ order_ids: orderIds }),
    }),
  /**
   * 「填入单号」（旧版 Hui 那颗按钮，走 `param1=getDiaoFormulas` 顺带返回 `data.orderNumbers`）。
   *
   * 给本单**还没单号**的明细行补 `N-YY/MM/DD`（序号 = 本租户该年份全局最大 +1，按年重置，
   * **永不覆盖已有值**），返回 `{行id → 单号}`。
   * ⚠️ 这是**行级**单号（每樘门一个），不是订单的回执单号。
   */
  fillLineNumbers: (orderId: number) =>
    request<Record<string, string>>(`/v1/orders/${orderId}/fill-line-numbers`, {
      method: 'POST',
    }),
  // 订单行：单行删除。
  deleteOrderLine: (orderId: number, lineId: number) =>
    request<{ deleted: boolean }>(`/v1/orders/${orderId}/lines/${lineId}`, {
      method: 'DELETE',
    }),
  /**
   * 单行保存（旧版 `param1=updateRowData`，见 `docs/2026-09-18-detail-table-extraction.md` §3.3）。
   *
   * ⚠️ **本版原先刻意没做这条**（这条注释原写「行的保存统一走 updateOrder 整单提交」）——
   * 2026-09-19 用户拍板按旧版补齐：旧版明细表有「行级编辑态」（点单元格选中该行 →
   * 操作列出「保存/取消」→ 脏行标粉 → 切行/离开时提醒并自动保存），我们一条都没有。
   *
   * ⚠️ **必须发完整行**：后端 `service::update_line` 是 45 列的 `SET` 全字段替换，
   * 少发哪个字段就把哪一列抹空。所以**不要**照抄旧版那份「剔内部键」的清单
   * （`["开向图","imageUrl","isSelected","生产进度",…]`）—— 换成我们的字段名之后，
   * 那几个恰恰都是要落库的列（`open_img` / `image_url` / `progress`）。
   */
  updateOrderLine: (orderId: number, lineId: number, line: OrderLineInput) =>
    request<{ updated: boolean }>(`/v1/orders/${orderId}/lines/${lineId}`, {
      method: 'PUT',
      body: JSON.stringify(line),
    }),
  // 取价 + 公式匹配（汇算字典 resolve）。
  resolvePrice: (lineType: string, profile: string, clientCode?: string) =>
    request<PriceResolveDto | null>(
      `/v1/prices/resolve?line_type=${encodeURIComponent(lineType)}&profile=${encodeURIComponent(profile)}${
        clientCode ? `&client_code=${encodeURIComponent(clientCode)}` : ''
      }`,
    ),
  resolveFormulaMatch: (lineType: string, profile: string, fans?: string) =>
    request<FormulaMatchResolveDto | null>(
      `/v1/formula-matches/resolve?line_type=${encodeURIComponent(lineType)}&profile=${encodeURIComponent(profile)}${
        fans ? `&fans=${encodeURIComponent(fans)}` : ''
      }`,
    ),
  // 列显隐配置（租户级）。
  getColumnConfig: () => request<ColumnConfigInput>('/v1/column-configs'),
  updateColumnConfig: (payload: ColumnConfigInput) =>
    request<{ saved: boolean }>('/v1/column-configs', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  // 加价项目（租户级，同步保存持久化）。
  listAddPriceItems: () => request<AddPriceItemDto[]>('/v1/add-price-items'),
  createAddPriceItem: (payload: AddPriceItemInput) =>
    request<AddPriceItemDto>('/v1/add-price-items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAddPriceItem: (id: number, payload: AddPriceItemInput) =>
    request<AddPriceItemDto>(`/v1/add-price-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAddPriceItem: (id: number) =>
    request<{ deleted: boolean }>(`/v1/add-price-items/${id}`, { method: 'DELETE' }),
  /**
   * 打印模板（汇算字典）：全量列表。
   *
   * ⚠️ **扫码账号（`/Qrscanner`）调不了这一条**（403）—— 白名单是**按具体路径**精确匹配的。
   * 扫码页要模板就 `getPrintTemplatesByMode('lable')`，见下面。
   */
  listPrintTemplates: () => request<PrintTemplateDto[]>('/v1/print-templates'),
  /**
   * 打印模板：按 mode 取（路由是 `/v1/print-templates/{mode}`，**路径参数**）。
   *
   * ## ⚠️ 扫码账号**只放行 `lable` 这一个 mode**（2026-09-19 加的白名单）
   *
   * 白名单（`backend/src/core/guard.rs` 的 `SCANNER_ALLOWED`）比的是**具体路径**，
   * 所以里面是写死的一条 `("GET", "/api/v1/print-templates/lable")`：
   *
   * | 路径 | 扫码账号 |
   * |---|---|
   * | `GET /v1/print-templates/lable` | ✅ 200 |
   * | `GET /v1/print-templates`（列表） | ❌ 403 |
   * | `GET /v1/print-templates/xiaopiao`（别的 mode） | ❌ 403 |
   *
   * ⇒ **`/Qrscanner` 的「打印标签」必须继续按 mode 取 `lable`**（`printByMode('lable', …)`），
   * **别**改成「先拉列表再自己挑」—— 那条是 403，而且列表也不需要。
   * 哪天真要在扫码页打别的单据，**先让后端把那个 mode 加进白名单**，别在这儿绕。
   *
   * 依据与实测：`docs/qrscanner-authz-check.mjs`（`scanner GET /v1/print-templates/lable → 200`）。
   */
  getPrintTemplatesByMode: (mode: string) =>
    request<PrintTemplateDto[]>(`/v1/print-templates/${encodeURIComponent(mode)}`),
  // 电子回执单：已登录取详情 / 签发分享链接 / 无认证凭令牌取详情。
  getReceipt: (receiptNo: string) =>
    request<ReceiptDto>(`/v1/receipts/${encodeURIComponent(receiptNo)}`),
  shareReceipt: (receiptNo: string) =>
    request<ReceiptShareToken>(`/v1/receipts/${encodeURIComponent(receiptNo)}/share`, {
      method: 'POST',
    }),
  getPublicReceipt: (receiptNo: string, token: string) =>
    request<ReceiptDto>(
      `/v1/public/receipts?no=${encodeURIComponent(receiptNo)}&t=${encodeURIComponent(token)}`,
    ),
  // 财务：订单级。
  getOrderFinance: (orderId: number) => request<OrderFinanceDetail>(`/v1/finance/orders/${orderId}`),
  getOrderFinanceSummary: (days = 60) =>
    request<Record<string, OrderFinance>>(`/v1/finance/orders/summary?days=${days}`),
  checkOrderPayment: (orderIds: number[]) =>
    request<CheckOrderPaymentItem[]>('/v1/finance/orders/check', {
      method: 'POST',
      body: JSON.stringify({ order_ids: orderIds }),
    }),
  addOrderPayment: (orderId: number, payload: AddOrderPaymentInput) =>
    request<{ saved: boolean }>(`/v1/finance/orders/${orderId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  // 删除订单红冲的一条腿：冲销该订单的「资金池分配」。
  // 无请求体 —— 金额由服务端按该订单当前的分配合计取，不接受客户端传。
  reverseOrderAllocation: (orderId: number) =>
    request<AllocationReversal>(`/v1/finance/orders/${orderId}/allocation-reversal`, {
      method: 'POST',
    }),
  addOrderAdjustment: (orderId: number, payload: AddOrderAdjustmentInput) =>
    request<{ saved: boolean }>(`/v1/finance/orders/${orderId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  // 财务：客户级。
  getCustomerBalance: (customerCode: string) =>
    request<CustomerBalance>(`/v1/finance/customers/${encodeURIComponent(customerCode)}/balance`),
  getCustomerStatement: (customerCode: string) =>
    request<StatementItem[]>(
      `/v1/finance/customers/${encodeURIComponent(customerCode)}/statement`,
    ),
  getPaymentStats: (customerCode: string) =>
    request<PaymentStatsDto>(
      `/v1/finance/customers/${encodeURIComponent(customerCode)}/stats`,
    ),
  addCustomerPayment: (customerCode: string, payload: AddCustomerPaymentInput) =>
    request<{ saved: boolean }>(`/v1/finance/customers/${encodeURIComponent(customerCode)}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  addCustomerAdjustment: (customerCode: string, payload: AddCustomerAdjustmentInput) =>
    request<{ saved: boolean }>(`/v1/finance/customers/${encodeURIComponent(customerCode)}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  previewAllocation: (customerCode: string, payload: AllocationPreviewInput) =>
    request<AllocationPreview>(
      `/v1/finance/customers/${encodeURIComponent(customerCode)}/allocation/preview`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  previewPrepaymentAllocation: (customerCode: string, payload: PrepaymentPreviewInput) =>
    request<PrepaymentAllocationPreview>(
      `/v1/finance/customers/${encodeURIComponent(customerCode)}/prepayment/preview`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  executePrepaymentAllocation: (customerCode: string, payload: PrepaymentExecuteInput) =>
    request<{ saved: boolean }>(
      `/v1/finance/customers/${encodeURIComponent(customerCode)}/prepayment/execute`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),
}
