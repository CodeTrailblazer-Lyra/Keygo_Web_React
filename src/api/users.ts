import request from './request'
import type { SysUser } from '@/types'

export interface PendingUser {
  id: number
  username: string
  createTime: string
}

/** 待审核用户列表 */
export async function pendingUsers(): Promise<PendingUser[]> {
  const res = await request.get<PendingUser[]>('/api/v1/admin/users/pending')
  return res.data
}

/** 用户列表（管理页「用户管理」模块数据源） */
export async function allUsers(): Promise<SysUser[]> {
  const res = await request.get<SysUser[]>('/api/v1/admin/users')
  return res.data
}

/** 审核通过 */
export async function approveUser(id: number): Promise<void> {
  await request.patch(`/api/v1/admin/users/${id}/approve`)
}

/** 审核拒绝 */
export async function rejectUser(id: number): Promise<void> {
  await request.patch(`/api/v1/admin/users/${id}/reject`)
}

/** 修改用户角色（仅超级管理员） */
export async function changeRole(id: number, role: string): Promise<void> {
  await request.patch(`/api/v1/admin/users/${id}/role`, { role })
}

/** 删除用户（仅超级管理员） */
export async function deleteUser(id: number): Promise<void> {
  await request.delete(`/api/v1/admin/users/${id}`)
}
