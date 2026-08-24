import request from './request'
import type { UnitImportResult, UsageUnit } from '@/types'

/**
 * 使用单位模块（后端 API 契约）
 *
 * - GET    /api/v1/units                 所有认证用户可读（获取页下拉数据源）
 * - POST   /api/v1/admin/units           管理员手动添加            body: { name }
 * - POST   /api/v1/admin/units/import    管理员文件批量导入        multipart: file
 *                                        支持 .txt/.csv（每行一个单位）/ .xlsx（第一列）
 * - DELETE /api/v1/admin/units/{id}      管理员删除单位
 *
 * 申领联动：POST /api/v1/codes/claim 携带可选 { unit }，
 * 后端在 unit 非空时将其写入该激活码备注字段；unit 缺省时备注保持原值。
 *
 * 创建时间字段兼容说明：后端可能返回 created_at / createdAt / createTime，
 * 且值可能为字符串或秒级/毫秒级时间戳，normalizeUnit 会统一归一化为
 * 前端类型定义的 createTime（ISO 字符串），避免界面不显示创建时间。
 */

/** 后端可能返回的原始单位结构（字段命名不确定，逐字段兼容） */
interface RawUnit {
  id?: number | string
  name?: string
  created_at?: string | number
  createdAt?: string | number
  createTime?: string | number
}

/** 将任意格式的时间值归一化为 ISO 字符串；空值返回 null */
function normalizeTime(value: string | number | undefined): string | null {
  if (value === undefined || value === null || value === '') return null
  // 数字时间戳：秒级（10 位）转毫秒后再格式化
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  return value
}

/** 将后端原始单位对象归一化为前端 UsageUnit 结构 */
function normalizeUnit(raw: RawUnit): UsageUnit {
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ''),
    createTime: normalizeTime(raw.created_at ?? raw.createdAt ?? raw.createTime),
  }
}

/** 使用单位列表（所有认证用户可读） */
export async function listUnits(): Promise<UsageUnit[]> {
  const res = await request.get<RawUnit[]>('/api/v1/units')
  return (Array.isArray(res.data) ? res.data : []).map(normalizeUnit)
}

/** 手动添加使用单位（管理员） */
export async function addUnit(name: string): Promise<UsageUnit> {
  const res = await request.post<RawUnit>('/api/v1/admin/units', { name })
  return normalizeUnit(res.data)
}

/** 文件批量导入使用单位（管理员）：.txt/.csv 每行一个单位；.xlsx 取第一列 */
export async function importUnits(file: File): Promise<UnitImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await request.post<UnitImportResult>('/api/v1/admin/units/import', formData)
  return res.data
}

/** 删除使用单位（管理员） */
export async function deleteUnit(id: number): Promise<void> {
  await request.delete(`/api/v1/admin/units/${id}`)
}
