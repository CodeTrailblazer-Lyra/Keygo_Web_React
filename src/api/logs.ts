import request from './request'
import type { Announcement, LogListResult } from '@/types'

/** 操作日志列表（分页，仅管理员） */
export async function logs(page: number, size: number): Promise<LogListResult> {
  const res = await request.get<LogListResult>('/api/v1/admin/codes/logs', {
    params: { page, size },
  })
  return res.data
}

/** 公告列表 */
export async function announcements(): Promise<Announcement[]> {
  const res = await request.get<Announcement[]>('/api/v1/announcements')
  return res.data
}

/** 发布公告（仅管理员） */
export async function publishAnnouncement(content: string, pinned: boolean): Promise<void> {
  await request.post('/api/v1/announcements', { content, pinned })
}

/** 删除公告（仅管理员） */
export async function deleteAnnouncement(id: number): Promise<void> {
  await request.delete(`/api/v1/announcements/${id}`)
}
