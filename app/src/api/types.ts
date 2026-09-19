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
  /**
   * 行级「单号」（`N-YY/MM/DD`，如 `85-26/09/14`），**每一樘门一个**。
   * 旧版由服务端 `ensureLineNumbers()` 生成／「填入单号」按钮拉取；印在玻璃单/生产单上，
   * 也是打印二维码的内容。⚠️ 与订单头的 `receipt_no`（回执单号）**不是一个层级**。
   * ⚠️ 编辑行时**必须原样回传** —— 后端是 `#[serde(default)]`，漏传 = 抹空。
   */
  line_no: string
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
  // ⚠️ **没有** `order_no_set` —— 它是**服务端派生值**（= 各行 `line_no` 去重后 `_` 连接），
  //    发过来也不会被采纳。响应里仍然有（`OrderSummaryDto.order_no_set`），别搞混。
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
  // ⚠️ 同 `OrderInput`：`order_no_set` 是服务端派生值，不接受客户端写入。
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
  /** 本单收款 + 池分配。删除确认框里「已分配收款 ¥x」显示的就是它。 */
  allocated_amount: number
  /** 本单直接收款。删除时红冲要写成**带 `order_id` 的负收款**。 */
  order_paid_amount: number
  /** 来自资金池的分配。删除时红冲要写成**负的分配行**（`reverseOrderAllocation`）。 */
  allocation_amount: number
  adjustment_amount: number
  customer_code: string
  customer_name: string
}

/** 「删除订单红冲」里冲销分配那一步的返回。 */
export interface AllocationReversal {
  /** 冲销掉的分配金额（正数）。该订单没有分配时为 0。 */
  reversed: number
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
  /** 该单**分配前**的未收（旧版列「订单未收」，只有「预付款分配」弹窗那张表用）。 */
  unpaid_amount: number
  allocated_amount: number
  /** 该单本次拿到的优惠（旧版列「优惠」）。「客户收款」tab 的预览恒为 0。 */
  discount: number
  /** `max(0, 未收 − 分配 − 优惠)` —— 旧版「分配后余额 / 分配后剩余」。 */
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
  /**
   * **本次拟分配里没分掉的**（`amount − Σ分配`）。
   * ⚠️ **不是**「客户池子还剩多少」—— 名字容易误会，那是下面的 `available_balance`。
   * 口径对齐旧版 `buildAllocationPreview` 返回的 `资金池剩余`（`svc:227`）。
   */
  pool_remaining: number
  /** 客户资金池**可用额**（= `max(0, 未分配余额)`），即这次最多能分出多少。 */
  available_balance: number
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

// ---------------------------------------------------------------------------
// 工序配置（procedures）
// ---------------------------------------------------------------------------

/**
 * 一个**工序槽**。槽号固定 `'工序1'`..`'工序15'`，**15 个槽一视同仁**。
 *
 * ⚠️ 旧版的「设置工序」弹窗**硬排掉 `工序10`**（`El` 的
 * `filter(k => k !== "工序10")`，所以只渲染 14 行）—— 那是对 Progress 侧
 * 「`回款` → `工序10`」硬编码的补偿。新版两处特判一起去掉
 * （见 `backend/migrations/0021_progress.sql` 头注）⇒ 这里**不做任何排除**。
 *
 * ⚠️ 旧版颜色**不上服务端**，写在全局 localStorage 键 `procedure_name_color_map` 里，
 * 而且**键是工序名** —— 改个名字颜色就丢，换账号登录还会读到上一个租户的色。
 * 新版把颜色落到 `procedures` 表上，键是 **slot**：改名不丢色、天然按租户隔离。
 * 见 `docs/2026-09-19-qrscanner-analysis.md` §8.3-2。
 */
export interface ProcedureSlotDto {
  /** `'工序1'` .. `'工序15'`。 */
  slot: string
  /** 工序名。**空串 = 该槽没配**（`GET` 恒返回 15 项，没配的槽给空名）。 */
  name: string
  /**
   * 该槽的颜色。旧版取色器是**自由取色 + `show-alpha`**（`predefine` 只是 8 个快捷色块），
   * 所以值不限于预置色，也可能是带透明度的 `rgba(...)`。
   *
   * ⚠️ **空串 = 没配过**，不是「白色」—— 见迁移 `0022_procedure_color.sql` 头注
   * （「没配」与「显式配成白色」是两回事，兜底色由前端自己定）。
   * ⇒ 前端**不要**在保存时把空串统一写成 `#FFFFFF`，那会把「没配」悄悄变成「配成白」。
   */
  color: string
}

/** `GET /v1/procedures` 的返回：恒 15 项，按槽号升序。 */
export interface ProceduresDto {
  slots: ProcedureSlotDto[]
}

// ---------------------------------------------------------------------------
// 生产进度（Progress）
// ---------------------------------------------------------------------------

/**
 * 生产进度页（旧版 `/Progress`）的一行。
 *
 * 形状 = **行自身的全部字段**（`OrderLineDto` 摊平）+ 一批中文键的展示字段。
 * 逐字段来源见 `docs/2026-09-19-progress-analysis.md` §11。
 *
 * ⚠️ 三处**不是空串**的兜底（照抄旧版，别"统一"）：
 * `客户编号`（旧版数字 0）、`封板高`（数字 0）、`加价项目原始数据`（**四字母字符串 'null'**）。
 */
export type ProgressRowDto = OrderLineDto & {
  /** `'工序1'` .. `'工序15'` —— **15 个键一定都在**（没配的补 `null`），前端读不会 undefined。 */
  [k: `工序${number}`]: string | null
  /** 15 槽里非空的按槽号用 `➞` 连接（旧版 `buildProgressText`）。 */
  生产进度: string
  procedureName: string
  procedureStatus: string | null
  打单人: string | null
  打单操作: string
  加价项目原始数据: string
  封板高: number
  洞尺: string
  扫码日期: string | null
  /** **行级**单号（每樘门一个），不是回执单号。 */
  单号: string
  /** 订单级回执单号。 */
  回执单号: string
  客户: string
  客户编号: string
  日期: string
  业务员: string
  备注: string
  安装地址: string
  orderNo: string
  /** 旧版挂的是整个订单对象；新版只给前端真正会用到的这几个键。 */
  order: { id: number; receipt_no: string; client_name: string; client_code: string }
}
