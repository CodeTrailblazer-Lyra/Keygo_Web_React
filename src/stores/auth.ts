import { create } from 'zustand'
import { getMe, login as loginApi, logout as logoutApi } from '@/api/auth'
import { setLoggingOut } from '@/api/request'
import { registerUnauthorizedHandler } from '@/router/navigation'
import type { UserInfo } from '@/types'

interface AuthState {
  user: UserInfo | null
  /** 是否已尝试过会话恢复（无论成功失败，只查一次） */
  sessionChecked: boolean
  fetchUser: () => Promise<UserInfo | null>
  login: (username: string, password: string, rememberMe: boolean) => Promise<boolean>
  logout: () => Promise<void>
}

// 在途的会话恢复请求（防止多个守卫/组件同时触发）
let fetchingPromise: Promise<UserInfo | null> | null = null

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  sessionChecked: false,

  async fetchUser() {
    if (fetchingPromise) return fetchingPromise
    fetchingPromise = (async () => {
      try {
        const data = await getMe()
        set({ user: data, sessionChecked: true })
        return data
      } catch {
        set({ user: null, sessionChecked: true })
        return null
      } finally {
        fetchingPromise = null
      }
    })()
    return fetchingPromise
  },

  async login(username, password, rememberMe) {
    // 登录成功后必须成功获取用户信息，否则视为登录失败
    await loginApi(username, password, rememberMe)
    const me = await getMe()
    if (!me) {
      throw new Error('认证成功，但获取用户信息失败，请刷新页面重试')
    }
    set({ user: me })
    return true
  },

  async logout() {
    // 退出期间的在途请求 401 全部静默，不弹"未登录"提示
    setLoggingOut(true)
    try {
      await logoutApi()
    } catch {
      // 退出请求失败不阻塞登出流程
    } finally {
      set({ user: null })
      // 稍后恢复，确保在途请求都已返回
      setTimeout(() => setLoggingOut(false), 1000)
    }
  },

}))

/* ===== 派生状态选择器（等价于 Pinia computed） ===== */
export const selectUsername = (s: AuthState) => s.user?.username || ''
export const selectRole = (s: AuthState) => s.user?.role || ''
export const selectIsAdmin = (s: AuthState) =>
  s.user?.role === 'ROLE_ADMIN' || s.user?.role === 'ROLE_SUPER_ADMIN'
export const selectIsSuperAdmin = (s: AuthState) => s.user?.role === 'ROLE_SUPER_ADMIN'

// 服务端会话失效（401）时清理本地登录态，避免守卫误判已登录
registerUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null })
})
