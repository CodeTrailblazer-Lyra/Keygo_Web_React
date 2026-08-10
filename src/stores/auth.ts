import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getMe, login as loginApi, logout as logoutApi } from '@/api/auth'
import { setLoggingOut } from '@/api/request'
import type { UserInfo } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const isLoggedIn = computed(() => !!user.value)
  const username = computed(() => user.value?.username || '')
  const role = computed(() => user.value?.role || '')
  const isAdmin = computed(
    () => role.value === 'ROLE_ADMIN' || role.value === 'ROLE_SUPER_ADMIN',
  )
  const isSuperAdmin = computed(() => role.value === 'ROLE_SUPER_ADMIN')

  async function fetchUser() {
    try {
      const data = await getMe()
      user.value = data
      return data
    } catch {
      user.value = null
      return null
    }
  }

  async function login(username: string, password: string, rememberMe: boolean) {
    // 登录成功后必须成功获取用户信息，否则视为登录失败
    await loginApi(username, password, rememberMe)
    const me = await fetchUser()
    if (!me) {
      throw new Error('认证成功，但获取用户信息失败，请刷新页面重试')
    }
    return true
  }

  async function logout() {
    // 退出期间的在途请求 401 全部静默，不弹"未登录"提示
    setLoggingOut(true)
    try {
      await logoutApi()
    } catch {
      // 退出请求失败不阻塞登出流程
    } finally {
      user.value = null
      // 稍后恢复，确保在途请求都已返回
      setTimeout(() => setLoggingOut(false), 1000)
    }
  }

  function clearUser() {
    user.value = null
  }

  return {
    user,
    isLoggedIn,
    username,
    role,
    isAdmin,
    isSuperAdmin,
    fetchUser,
    login,
    logout,
    clearUser,
  }
})
