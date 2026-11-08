import request from './request'
import type {
  ActivationCode,
  AdminCodeListResponse,
  BatchClaimResult,
  BatchOperationResponse,
  ClaimResult,
  ImportResponse,
  PageResponse,
  RedeemResult,
  StatsResponse,
} from '@/types'

/** 公共统计（所有认证用户可用） */
export async function getStats(): Promise<StatsResponse> {
  const res = await request.get<StatsResponse>('/api/v1/codes/stats')
  return res.data
}

/** 激活码管理列表（分页 + 筛选） */
export async function listCodes(opts: {
  status?: string
  keyword?: string
  page?: number
  size?: number
}): Promise<AdminCodeListResponse> {
  const res = await request.get<AdminCodeListResponse>('/api/v1/admin/codes', {
    params: {
      status: opts.status,
      keyword: opts.keyword,
      page: opts.page ?? 1,
      size: opts.size ?? 20,
    },
  })
  return res.data
}

/**
 * 申领单个激活码
 * @param unit 使用单位名称（可选）。非空时由后端写入该激活码的备注字段。
 */
export async function claimCode(unit?: string): Promise<ClaimResult> {
  const res = await request.post<ClaimResult>('/api/v1/codes/claim', unit ? { unit } : undefined)
  return res.data
}

/** 批量申领激活码（1-100） */
export async function batchClaim(count: number): Promise<BatchClaimResult> {
  const res = await request.post<BatchClaimResult>('/api/v1/codes/batch-claim', { count })
  return res.data
}

/** 标记激活码为已使用 */
export async function markUsed(id: number): Promise<void> {
  await request.patch(`/api/v1/admin/codes/${id}/use`)
}

/** 标记激活码为未使用 */
export async function markUnused(id: number): Promise<void> {
  await request.patch(`/api/v1/admin/codes/${id}/unuse`)
}

/** 批量标记已使用 */
export async function batchUse(ids: number[]): Promise<BatchOperationResponse> {
  const res = await request.patch<BatchOperationResponse>('/api/v1/admin/codes/batch/use', { ids })
  return res.data
}

/** 批量恢复未使用 */
export async function batchUnuse(ids: number[]): Promise<BatchOperationResponse> {
  const res = await request.patch<BatchOperationResponse>('/api/v1/admin/codes/batch/unuse', { ids })
  return res.data
}

/** 删除单个激活码 */
export async function deleteCode(id: number): Promise<void> {
  await request.delete(`/api/v1/admin/codes/${id}`)
}

/** 批量删除激活码 */
export async function batchDelete(ids: number[]): Promise<BatchOperationResponse> {
  const res = await request.post<BatchOperationResponse>('/api/v1/admin/codes/batch-delete', { ids })
  return res.data
}

/** Excel 批量导入激活码（第一列激活码明文，第二列可选备注） */
export async function importExcel(file: File): Promise<ImportResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await request.post<ImportResponse>('/api/v1/admin/codes/import', formData)
  return res.data
}

/** 更新激活码备注 */
export async function updateRemark(id: number, remark: string): Promise<void> {
  await request.patch(`/api/v1/admin/codes/${id}/remark`, { remark })
}

/** 当前用户已获取的激活码（分页） */
export async function myCodes(page: number, size: number): Promise<PageResponse<ActivationCode>> {
  const res = await request.get<PageResponse<ActivationCode>>('/api/v1/codes/my-codes', {
    params: { page, size },
  })
  return res.data
}

/** 导出激活码 Excel（POST，筛选条件放 body，返回文件流） */
export async function exportCodes(opts: { status?: string; keyword?: string }): Promise<Blob> {
  const res = await request.post<Blob>('/api/v1/admin/codes/export', opts, {
    responseType: 'blob',
  })
  return res.data
}

/** 设备核销激活码（无需认证，供外部软件调用） */
export async function redeemCode(code: string, deviceId?: string): Promise<RedeemResult> {
  const res = await request.post<RedeemResult>('/api/v1/codes/redeem', { code, deviceId })
  return res.data
}

/* ===== 官方验证 ===== */

/** 全量异步验证（异步任务，立即返回是否接受） */
export async function officialCheckAll(): Promise<{ accepted: boolean; total: number }> {
  const res = await request.post<{ accepted: boolean; total: number }>(
    '/api/v1/admin/codes/official-check',
  )
  return res.data
}

/** 单码同步验证，返回最新 CodeResponse */
export async function officialCheckOne(id: number): Promise<ActivationCode> {
  const res = await request.post<ActivationCode>(`/api/v1/admin/codes/${id}/official-check`)
  return res.data
}

/** 查询是否有验证任务进行中 */
export async function officialCheckRunning(): Promise<boolean> {
  const res = await request.get<boolean>('/api/v1/admin/codes/official-check/running')
  return res.data
}
