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
  OrderDto,
  OrderInput,
  OrderSummaryDto,
  PrintTemplateDto,
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
  // 后端成功响应统一为 { data: ... }
  return (body?.data ?? body) as T
}

export const api = {
  login: (payload: { username: string; password: string }) =>
    request<AuthResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ logged_out: boolean }>('/v1/auth/logout', { method: 'POST' }),
  me: () => request<MeResponse>('/v1/auth/me'),
  changePassword: (payload: { old_password: string; new_password: string }) =>
    request<{ changed: boolean }>('/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  health: () => request<HealthResponse>('/v1/health'),
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
  getClient: (id: number) => request<ClientDto>(`/v1/clients/${id}`),
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
  deleteOrder: (id: number) =>
    request<{ deleted: boolean }>(`/v1/orders/${id}`, { method: 'DELETE' }),
  // 打印模板（汇算字典）：按 mode 或全量拉取。
  listPrintTemplates: () => request<PrintTemplateDto[]>('/v1/print-templates'),
  getPrintTemplatesByMode: (mode: string) =>
    request<PrintTemplateDto[]>(`/v1/print-templates/${encodeURIComponent(mode)}`),
}
