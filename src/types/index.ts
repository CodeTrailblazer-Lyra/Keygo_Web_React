export interface UserInfo {
  username: string
  role: string
  approved: boolean
}

export interface ActivationCode {
  id: number
  /** 后端哈希化改造后新生成的码不落明文，列表类接口返回 null（明文仅在生成/申领响应中出现一次） */
  code: string | null
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
  /** 是否在获取页展示（后端未返回该字段时视为 true，向后兼容） */
  visible?: boolean
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

/** 使用单位（获取激活码时可选择，选中则写入激活码备注） */
export interface UsageUnit {
  id: number
  name: string
  createTime: string | null
}

/** 使用单位批量导入结果 */
export interface UnitImportResult {
  imported: number
}
