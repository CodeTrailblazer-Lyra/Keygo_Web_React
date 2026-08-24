import axios from 'axios'
import { isOnLoginPath, navigateTo, notifyUnauthorized } from '@/router/navigation'
import { messageError } from '@/utils/messageBridge'

// 退出登录中：此期间的 401 全部静默处理，不提示不跳转
let isLoggingOut = false
export function setLoggingOut(v: boolean) {
  isLoggingOut = v
}

/** 判断错误是否已被拦截器处理过（避免调用方重复弹提示） */
export function isHandledError(err: unknown): boolean {
  return !!(err as { __handled?: boolean })?.__handled
}

// 401 全局提示/跳转防抖
let unauthToastTimer: ReturnType<typeof setTimeout> | null = null
let unauthRedirecting = false

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  withCredentials: true,
  timeout: 30000,
})

/** axios 错误对象中可能用到的字段 */
interface ErrorLike {
  response?: { status?: number; data?: Record<string, unknown> }
  code?: string
  message?: string
}

/**
 * 从 axios 错误对象中提取友好的错误提示消息
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return '未知错误'
  const e = error as ErrorLike

  // 无 HTTP 响应（网络断开、超时、请求被取消）
  if (!e.response) {
    if (e.code === 'ECONNABORTED') return '请求超时，请检查网络后重试'
    if (e.message === 'Network Error') return '网络连接失败，请检查网络连接'
    if (e.message?.includes('timeout')) return '请求超时，请稍后重试'
    return e.message || '网络错误，请稍后重试'
  }

  const { status, data } = e.response

  // 优先使用后端返回的错误消息（统一格式 { code, message } 或旧格式）
  const backendMsg = data?.message || data?.error || data?.msg
  if (backendMsg && typeof backendMsg === 'string') return backendMsg

  // 根据 HTTP 状态码给出友好提示
  switch (status) {
    case 400:
      return '请求参数有误，请检查后重试'
    case 401:
      return '登录已过期，请重新登录'
    case 403:
      return '没有权限执行此操作'
    case 404:
      return '请求的资源不存在'
    case 409:
      return '操作冲突，请刷新页面后重试'
    case 429:
      return '请求过于频繁，请稍后再试'
    case 500:
      return '服务器内部错误，请稍后重试'
    case 502:
      return '网关错误，服务可能暂时不可用'
    case 503:
      return '服务暂不可用，请稍后重试'
    case 504:
      return '网关超时，请稍后重试'
    default:
      return `请求失败（${status}）`
  }
}

request.interceptors.response.use(
  (response) => {
    const res = response.data
    // 统一响应格式：{ code, message, data }
    if (res && typeof res.code === 'number') {
      if (res.code === 0) {
        // 成功：解包 data，直接返回业务数据
        response.data = res.data ?? null
        return response
      }
      // 业务错误：reject 携带后端 message
      const err = new Error(res.message || '操作失败') as Error & {
        code?: number | string
        response?: { status: number; data: unknown }
      }
      err.code = res.code
      err.response = { status: 200, data: res }
      return Promise.reject(err)
    }
    // 非统一格式（如文件下载）：原样返回
    return response
  },
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''
    const isLoginRequest = url.includes('/api/v1/auth/login')
    if (status === 401 && !isLoginRequest) {
      // 标记为已处理，调用方 catch 不再重复弹提示
      error.__handled = true
      // 退出登录中：静默处理，不提示不跳转
      if (isLoggingOut) {
        return Promise.reject(error)
      }
      // 当前已在登录页：只需标记，不跳转不提示
      if (!isOnLoginPath()) {
        // 全局只提示一次（防抖，避免多个在途请求重复弹窗）
        if (!unauthToastTimer) {
          unauthToastTimer = setTimeout(() => {
            unauthToastTimer = null
          }, 3000)
          messageError(getErrorMessage(error))
        }
        // 清理本地登录态
        notifyUnauthorized()
        // 防抖跳转登录页
        if (!unauthRedirecting) {
          unauthRedirecting = true
          navigateTo('/login')
          setTimeout(() => {
            unauthRedirecting = false
          }, 1000)
        }
      }
    }
    return Promise.reject(error)
  },
)

export default request
