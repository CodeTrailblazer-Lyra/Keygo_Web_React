import type { NavigateFunction } from 'react-router'

/**
 * 导航桥接：让 api/request.ts 等非组件模块也能触发路由跳转
 * （等价于 Vue 版本中直接导入 router 实例）
 */
let navigateFn: NavigateFunction | null = null

export function registerNavigate(fn: NavigateFunction | null) {
  navigateFn = fn
}

export function navigateTo(path: string) {
  navigateFn?.(path)
}

/** 当前是否已在登录页（基于浏览器地址栏判断） */
export function isOnLoginPath(): boolean {
  return window.location.pathname === '/login'
}

/**
 * 401 未授权回调：由 auth store 注册，用于清理本地登录态
 * （避免会话失效后仍停留在受保护页面）
 */
type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

export function registerUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  unauthorizedHandler = fn
}

export function notifyUnauthorized() {
  unauthorizedHandler?.()
}
