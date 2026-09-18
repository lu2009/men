export interface UserDto {
  id: number
  tenant_id: number
  username: string
  name: string
  role: string
}

export interface TenantDto {
  id: number
  name: string
}

export interface AuthResponse {
  token: string
  user: UserDto
  tenant: TenantDto
}

export interface MeResponse {
  user: UserDto
  tenant: TenantDto
}

export interface HealthResponse {
  status: string
  service: string
  db: string
}

export interface FormulaDto {
  id: number
  tenant_id: number
  name: string
  formula_type: string
  template_key: string
  door_width: string
  door_height: string
  light_window_height: string
  wall_thickness: string
  jiao: string
  mother_door_width: string
  square: string
  parts: unknown
  extra: unknown
  remark: string
  created_at: string
  updated_at: string
}

export interface FormulaInput {
  name: string
  formula_type?: string
  template_key?: string
  door_width?: string
  door_height?: string
  light_window_height?: string
  wall_thickness?: string
  jiao?: string
  mother_door_width?: string
  square?: string
  parts?: unknown
  extra?: unknown
  remark?: string
}

export interface FormulaImageDto {
  id: number
  formula_id: number
  direction: string
  mirrored: boolean
  data_url: string
}

export interface FormulaImageInput {
  direction?: string
  mirrored?: boolean
  data_url: string
}

export interface ClientDto {
  id: number
  tenant_id: number
  code: string
  name: string
  brand: string
  contact: string
  phone: string
  delivery_phone: string
  address: string
  logistics: string
  logistics_phone: string
  created_at: string
  updated_at: string
}

export interface ClientInput {
  name: string
  brand?: string
  contact?: string
  phone?: string
  delivery_phone?: string
  address?: string
  logistics?: string
  logistics_phone?: string
}

// 汇算订单行：平开门(ping)/吊趟门(diao) 共用结构，差异字段用默认值承载。
export interface OrderLineDto {
  id: number
  line_type: string
  row_index: number
  profile: string
  color: string
  direction: string
  fans: string
  track: string
  casing: string
  hardware: string
  bottom_glass: string
  face_glass: string
  glass_thickness: string
  door_width: number
  door_height: number
  light_window_height: number
  wall_thickness: number
  jiao: number
  mother_door_width: number
  quantity: number
  unit_price: number
  price_type: string
  discount: number
  square: number
  custom_square: number
  other_fee: number
  casing_price: number
  casing_amount: number
  amount: number
  parts: unknown
  markup: unknown
  formula_id: number | null
  remark: string
  install_address: string
  open_img: string
  edge_seal_count: number | null
  seal_board_height: number
  track_length: number
  front_casing_add: number | null
  back_casing_add: number | null
  double_ding: string | null
  light_window_count: number
  image_id: string | null
  image_url: string | null
  progress: string
  hole_size: string
}

export type OrderLineInput = Omit<OrderLineDto, 'id' | 'row_index'>

export interface OrderSummaryDto {
  id: number
  receipt_no: string
  client_code: string
  client_name: string
  phone: string
  brand: string
  order_date: string
  production_days: number
  due_date: string
  total_price: number
  deposit: number
  remark: string
  salesperson: string
  order_no_set: string
  install_address: string
  production_status: string
  creator_name: string
  lock_direction: string
  door_count: number
  created_at: string
  updated_at: string
}

export interface OrderDto extends OrderSummaryDto {
  lines: OrderLineDto[]
}

export interface OrderInput {
  receipt_no: string
  client_code: string
  client_name: string
  phone: string
  brand: string
  order_date: string
  production_days: number
  deposit: number
  remark: string
  salesperson: string
  order_no_set?: string
  install_address?: string
  production_status?: string
  lock_direction?: string
  lines: OrderLineInput[]
}

// 订单头就地编辑（PATCH /orders/{id}）：只动头字段，不动行。
export interface OrderHeadInput {
  client_code?: string
  client_name?: string
  phone?: string
  brand?: string
  order_date?: string
  production_days?: number
  deposit?: number
  remark?: string
  salesperson?: string
  order_no_set?: string
  install_address?: string
  production_status?: string
  creator_name?: string
  lock_direction?: string
}

// Home「查询更多」的过滤条件（GET /orders/search）—— 旧版 `getMoreTableDate` 的 param3–param6。
// 四项皆可缺省，缺省/空串 = 该条件不过滤。旧版坐标：`legacy/js/Home.formatted.js:11074`。
export interface OrderSearchParams {
  /** 旧版 param3：客户名（弹窗 autocomplete 选中的值）。 */
  client_name?: string
  /** 旧版 param4：安装地址。 */
  install_address?: string
  /** 旧版 param5：起始日期 `YYYY-MM-DD`（含当日）。 */
  start_date?: string
  /** 旧版 param6：结束日期 `YYYY-MM-DD`（含当日）。 */
  end_date?: string
}

// 取价结果：型材 → 单价/计价方式/套线单价/锁定条件。
export interface PriceResolveDto {
  unit_price: number
  price_type: string
  casing_price: number | null
  lock_rules: unknown
  matched_profile: string
}

// 公式匹配结果：型材 + 扇数 → formula_id。
export interface FormulaMatchResolveDto {
  formula_id: number
  matched_profile: string
  matched_fans: string
}

// 打印模板：hiprint 模板 JSON 存于 template 字段。
export interface PrintTemplateDto {
  id: number
  mode: string
  name: string
  paper: string
  template: unknown
  created_at: string
  updated_at: string
}

// 列显隐配置：平开/移门各自「字段名 → 是否显示」。缺省空对象 = 全部显示。
export interface ColumnConfigInput {
  ping_columns: Record<string, boolean>
  diao_columns: Record<string, boolean>
}

// 加价项目（同步保存 → 后端持久化）。
export interface AddPriceItemDto {
  id: number
  name: string
  price: number
  unit: string
}
export interface AddPriceItemInput {
  name: string
  price: number
  unit: string
}

// ---------------------------------------------------------------------------
// 电子回执单（receipts 模块）
// ---------------------------------------------------------------------------

/**
 * 回执单载荷。渲染所需的一切都在这里，**不含**渲染后的回执行 ——
 * 回实行由前端 `utils/receiptBuilder.ts` 现算（旧版 `receiptBuilder` 的 `ps`/`gs`）。
 */
export interface ReceiptDto {
  receipt_no: string
  client_name: string
  phone: string
  brand: string
  order_date: string
  due_date: string
  production_days: number
  install_address: string
  remark: string
  salesperson: string
  creator_name: string
  total_price: number
  deposit: number
  door_count: number
  /** 财务口径「已分配金额」—— 回执「已付款」用它覆盖定金。 */
  allocated_amount: number
  /** 财务口径「未收金额」—— 回执「待付款」用它覆盖 `总价 - 定金`。 */
  unpaid_amount: number
  tenant_name: string
  declaration: string
  lines: OrderLineDto[]
}

/** 分享令牌签发结果（`POST /receipts/{no}/share`）。 */
export interface ReceiptShareToken {
  receipt_no: string
  token: string
  /** Unix 秒。 */
  expires_at: number
}

// ---------------------------------------------------------------------------
// 财务子系统（finance 模块）
// ---------------------------------------------------------------------------

// 订单财务摘要（finance_getOrderFinanceSummary 项）。
export interface OrderFinance {
  total_price: number
  allocated_amount: number
  adjustment_amount: number
  unpaid_amount: number
}

// 订单财务单条记录（收款/分配/抹零）。
export interface FinanceRecord {
  kind: string
  date: string
  amount: number
  remark: string
}

// 删除校验结果项（finance_checkOrderPayment）。
export interface CheckOrderPaymentItem {
  order_id: number
  allocated_amount: number
  adjustment_amount: number
  customer_code: string
  customer_name: string
}

// 订单财务明细（finance_getOrderDetail）：totals + 分配明细 + 调整记录。
export interface OrderFinanceDetail extends OrderFinance {
  payment_records: FinanceRecord[]
  adjustment_records: FinanceRecord[]
}

// 客户余额（finance_getCustomerBalance）。
export interface CustomerBalance {
  customer_code: string
  customer_name: string
  order_total: number
  paid_amount: number
  customer_balance: number
  unallocated_balance: number
  order_adjust_total: number
  customer_adjust_total: number
}

// 对账流水项（finance_getCustomerStatement）。
export interface StatementItem {
  kind: string
  receipt_no: string
  date: string
  amount: number
  install_address: string
  remark: string
}

// 收款趋势（finance_getPaymentStats）：每月/年 拆分 收款 与 红冲。
export interface PaymentStatsDto {
  monthly: Array<{ month: string; receipt: number; refund: number }>
  yearly: Array<{ year: string; receipt: number; refund: number }>
}

// 分配项（客户收款 / 预付款分配）。
export interface AllocationInput {
  order_id: number
  receipt_no?: string
  order_date?: string
  total_price?: number
  amount: number
  remaining_after?: number
}

// 分配预览结果。
export interface AllocationItem {
  order_id: number
  receipt_no: string
  order_date: string
  total_price: number
  allocated_amount: number
  remaining_after: number
}
export interface AllocationPreview {
  allocations: AllocationItem[]
  remaining_unallocated: number
}

export interface PrepaymentAllocationPreview {
  allocations: AllocationItem[]
  total_allocated: number
  total_discount: number
  pool_remaining: number
}

// 本单收款（finance_addOrderPayment）。
export interface AddOrderPaymentInput {
  customer_code: string
  customer_name: string
  receipt_no?: string
  amount: number
  pay_date?: string
  method?: string
  remark?: string
  use_prepay_discount?: boolean
  discount_rate?: number
}

// 订单抹零（finance_addOrderAdjustment）。
export interface AddOrderAdjustmentInput {
  receipt_no?: string
  customer_code: string
  customer_name: string
  amount: number
  type?: string
  remark?: string
}

// 客户收款（finance_addPayment）。
export interface AddCustomerPaymentInput {
  customer_code: string
  customer_name: string
  amount: number
  pay_date?: string
  method?: string
  remark?: string
  allocations: AllocationInput[]
}

// 客户抹零（finance_addCustomerAdjustment）。
export interface AddCustomerAdjustmentInput {
  customer_code: string
  customer_name: string
  amount: number
  type?: string
  remark?: string
}

export interface AllocationPreviewInput {
  customer_code: string
  amount: number
}

export interface PrepaymentPreviewInput {
  customer_code: string
  allocate_amount: number
  discount_rate: number
}

export interface PrepaymentExecuteInput {
  customer_code: string
  allocate_amount: number
  discount_rate: number
  remark?: string
}
