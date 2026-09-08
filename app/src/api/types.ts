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
  edge_binding: string
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
  link_no: string | null
  double_ding: string | null
  light_window_count: number
  image_id: string | null
  image_url: string | null
  progress: string
  hole_size: string
  markup_raw: string
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
  lines: OrderLineInput[]
}

// 打印模板：hiprint 模板 JSON 存于 template 字段。
export interface PrintTemplateDto {
  id: number
  mode: string
  name: string
  paper: string
  template: unknown
  remark: string
  created_at: string
  updated_at: string
}
