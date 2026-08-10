export interface UserInfo {
  username: string
  role: string
  approved: boolean
}

export interface ActivationCode {
  id: number
  code: string
  used: boolean
  remark: string | null
  fetchUser: string | null
  fetchTime: string | null
  createTime: string | null
}

export interface CodeListResult {
  codes: ActivationCode[]
  total: number
  available: number
  used: number
  page: number
  size: number
  totalPages: number
  totalElements: number
}

export interface ClaimResult {
  code?: string
  fetchTime?: string
  available: number
  used: number
  total: number
}

export interface BatchClaimResult {
  count: number
  codes: string[]
  total: number
  available: number
  used: number
}

export interface OperationLog {
  id: number
  username: string
  action: string
  target: string | null
  detail: string | null
  createTime: string | null
}

export interface LogListResult {
  logs: OperationLog[]
  page: number
  totalPages: number
  totalElements: number
}

export interface Announcement {
  id: number
  content: string
  publisher: string | null
  pinned: boolean
  createTime: string | null
}

export interface SysUser {
  id: number
  username: string
  role: string
  approved: boolean
  enabled: boolean
  createTime: string
}

export interface Stats {
  total: number
  available: number
  used: number
}
