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
