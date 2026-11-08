export interface UserInfo {
  username: string
  role: string
  approved: boolean
}

/** 统计信息 */
export interface StatsResponse {
  total: number
  available: number
  used: number
}

/** 通用分页响应结构 */
export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  totalPages: number
  totalElements: number
}

/** 官方验证信息（管理端列表接口返回，用户侧恒为 null） */
export interface OfficialInfo {
  /** 使用状态码：0=未验证, 1=已使用, 2=未使用, 3=无效码, 4=查询异常；null=未取到有效状态 */
  useStatus: number | null
  /** 使用状态文案：`未验证` / `已使用` / `未使用` / `无效码` / `查询异常` */
  useStatusText: string
  /** 官方激活时间（ISO 8601） */
  useTime: string | null
  /** 产品名称 */
  product: string | null
  /** 设备信息 */
  device: string | null
  /** 官方接口顶层 code（0=查询成功，非0=码无效或官方侧异常）；null=未取到有效状态 */
  officialCode: number | null
  /** 最后验证时间（ISO 8601）；null=从未验证 */
  checkedAt: string | null
}

/** 激活码（列表接口返回） */
export interface ActivationCode {
  id: number
  /** 激活码明文（如 `ABCD-EFGH-IJKL`） */
  code: string
  /** 状态：`"已使用"` / `"未使用"` */
  status: string
  remark: string | null
  fetchUser: string | null
  fetchTime: string | null
  createTime: string | null
  /** 官方验证信息（仅管理端返回，用户侧恒为 null） */
  official: OfficialInfo | null
}

/** ActivationCode 便捷判断 */
export function isCodeUsed(code: ActivationCode): boolean {
  return code.status === '已使用'
}

/** 管理员激活码列表响应 */
export interface AdminCodeListResponse {
  codes: PageResponse<ActivationCode>
  stats: StatsResponse
}

/** 申领激活码响应 */
export interface ClaimResult {
  code: string
  fetchTime: string
  stats: StatsResponse
}

/** 批量申领激活码响应 */
export interface BatchClaimResult {
  count: number
  codes: string[]
  stats: StatsResponse
}

/** 操作日志 */
export interface OperationLog {
  id: number
  username: string
  action: string
  target: string | null
  detail: string | null
  createTime: string | null
}

/** 核销审计日志 */
export interface ActivationLog {
  id: number
  code: string | null
  deviceId: string | null
  ip: string | null
  result: string
  createTime: string
}

/** 公告 */
export interface Announcement {
  id: number
  content: string
  publisher: string | null
  pinned: boolean
  /** 是否在获取页展示（后端未返回该字段时视为 true，向后兼容） */
  visible?: boolean
  createTime: string | null
}

/** 系统用户 */
export interface SysUser {
  id: number
  username: string
  role: string
  approved: boolean
  enabled: boolean
  createTime: string
}

/** 使用单位（获取激活码时可选择，选中则写入激活码备注） */
export interface UsageUnit {
  id: number
  name: string
  createTime: string | null
}

/** 使用单位批量导入结果 */
export interface UnitImportResult {
  added: number
  skipped: number
  duplicates: string[]
}

/** Excel 批量导入激活码结果 */
export interface ImportResponse {
  count: number
  skipped: number
  stats: StatsResponse
}

/** 批量操作响应 */
export interface BatchOperationResponse {
  count: number
  stats: StatsResponse | null
}

/** 核销请求参数 */
export interface RedeemRequest {
  code: string
  deviceId?: string
}

/** 核销响应 */
export interface RedeemResult {
  codeId: number
}
