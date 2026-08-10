import request from './request'
import type { UserInfo } from '@/types'

/** 登录（Spring Security 表单登录，返回 JSON） */
export async function login(
  username: string,
  password: string,
  rememberMe: boolean,
): Promise<{ username?: string; role?: string } | null> {
  const params = new URLSearchParams()
  params.set('username', username)
  params.set('password', password)
  if (rememberMe) params.set('remember-me', 'on')
  const res = await request.post('/api/v1/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}

/** 注销 */
export async function logout(): Promise<void> {
  await request.post('/api/v1/auth/logout')
}

/** 注册（需管理员审核） */
export async function register(
  username: string,
  password: string,
): Promise<void> {
  await request.post('/api/v1/auth/register', { username, password })
}

/** 获取当前登录用户信息 */
export async function getMe(): Promise<UserInfo> {
  const res = await request.get<UserInfo>('/api/v1/admin/users/me')
  return res.data
}

/** 修改密码（管理员可指定 userId 改他人密码） */
export async function changePassword(data: {
  userId?: number | null
  oldPassword?: string | null
  newPassword: string
}): Promise<void> {
  await request.patch('/api/v1/admin/users/password', data)
}
