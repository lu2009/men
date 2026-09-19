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
   */
  listProgress: () => request<{ progressData: ProgressRowDto[] }>('/v1/progress'),
  /**
   * 更新若干行的某个工序槽（旧版 `param1=updataProgress`）。
   *
   * 语义是**覆盖**（旧版只有 `工序10` 走合并，那个特判新版去掉了）。
   * `value` 的格式约定是 `工序名[_操作员]_YYYY-MM-DD`，但**服务端不校验格式**。
   *
   * ⚠️ **槽名会被服务端校验**（必须 `工序1`..`工序15`），野键直接 400 —— 这是新版加的。
   */
  updateProgress: (lineIds: number[], slot: string, value: string) =>
    request<{ updated: number }>('/v1/progress/update', {
      method: 'POST',
      body: JSON.stringify({ line_ids: lineIds, slot, value }),
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
  // 打印模板（汇算字典）：按 mode 或全量拉取。
  listPrintTemplates: () => request<PrintTemplateDto[]>('/v1/print-templates'),
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
