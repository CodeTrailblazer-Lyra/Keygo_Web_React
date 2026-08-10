import request from './request'
import type {
  BatchClaimResult,
  ClaimResult,
  CodeListResult,
  ActivationCode,
  Stats,
} from '@/types'

export interface MyCodesResult {
  codes: ActivationCode[]
  total: number
  page: number
  size: number
  totalPages: number
}

export interface CodeQueryOptions {
  status?: string
  keyword?: string
  page?: number
  size?: number
}

/** 公共统计（所有认证用户可用） */
export async function getStats(): Promise<Stats> {
  const res = await request.get<Stats>('/api/v1/codes/stats')
  return res.data
}

/** 激活码列表（分页 + 筛选） */
export async function listCodes(opts: CodeQueryOptions): Promise<CodeListResult> {
  const res = await request.get<CodeListResult>('/api/v1/admin/codes', {
    params: {
      status: opts.status,
      keyword: opts.keyword,
      page: opts.page ?? 1,
      size: opts.size ?? 20,
    },
  })
  return res.data
}

/** 申领单个激活码 */
export async function claimCode(): Promise<ClaimResult> {
  const res = await request.post<ClaimResult>('/api/v1/codes/claim')
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
export async function batchUse(ids: number[]): Promise<void> {
  await request.patch('/api/v1/admin/codes/batch/use', { ids })
}

/** 批量恢复未使用 */
export async function batchUnuse(ids: number[]): Promise<void> {
  await request.patch('/api/v1/admin/codes/batch/unuse', { ids })
}

/** 删除单个激活码 */
export async function deleteCode(id: number): Promise<void> {
  await request.delete(`/api/v1/admin/codes/${id}`)
}

/** 批量删除激活码 */
export async function batchDelete(ids: number[]): Promise<void> {
  await request.post('/api/v1/admin/codes/batch-delete', { ids })
}

/** Excel 批量导入激活码（第二列作为备注） */
export async function importExcel(file: File): Promise<void> {
  const formData = new FormData()
  formData.append('file', file)
  await request.post('/api/v1/admin/codes/import', formData)
}

/** 更新激活码备注 */
export async function updateRemark(id: number, remark: string): Promise<void> {
  await request.patch(`/api/v1/admin/codes/${id}/remark`, { remark })
}

/** 当前用户已获取的激活码（分页） */
export async function myCodes(page: number, size: number): Promise<MyCodesResult> {
  const res = await request.get<MyCodesResult>('/api/v1/codes/my-codes', {
    params: { page, size },
  })
  return res.data
}

/** 导出激活码 Excel（条件放 body，返回文件流） */
export async function exportCodes(opts: {
  status?: string
  keyword?: string
}): Promise<Blob> {
  const res = await request.post<Blob>('/api/v1/admin/codes/export', opts, {
    responseType: 'blob',
  })
  return res.data
}
