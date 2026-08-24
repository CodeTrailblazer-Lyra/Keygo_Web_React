import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { selectIsAdmin, useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/AppLayout'

const LoginView = lazy(() => import('@/views/LoginView'))
const FetchView = lazy(() => import('@/views/FetchView'))
const MyCodesView = lazy(() => import('@/views/MyCodesView'))
const ListView = lazy(() => import('@/views/ListView'))
const LogsView = lazy(() => import('@/views/LogsView'))
const AdminView = lazy(() => import('@/views/AdminView'))

/**
 * 路由守卫（等价于 Vue 版 router.beforeEach）：
 * 1. 未登录访问受保护页面时，先尝试通过 session 恢复登录态（只查一次）
 * 2. 需要登录但未登录 → 跳 /login
 * 3. 需要管理员但非管理员 → 已登录跳 /fetch，未登录跳 /login
 */
function RequireAuth({ admin = false }: { admin?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const sessionChecked = useAuthStore((s) => s.sessionChecked)
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const isAdmin = useAuthStore(selectIsAdmin)

  useEffect(() => {
    if (!sessionChecked) {
      void fetchUser()
    }
  }, [sessionChecked, fetchUser])

  if (!sessionChecked) {
    // 等待会话恢复结果，期间不渲染（与 Vue 守卫 await 行为一致）
    return null
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (admin && !isAdmin) {
    return <Navigate to="/fetch" replace />
  }
  return (
    <AppLayout>
      <AnimatedOutlet />
    </AppLayout>
  )
}

/** 已登录访问登录页 → 跳转申领页 */
function LoginGate() {
  const user = useAuthStore((s) => s.user)
  if (user) {
    return <Navigate to="/fetch" replace />
  }
  return <LoginView />
}

/** 页面切换动画：按路径作为 key 触发入场动画（等价于 Vue transition name="page"） */
function AnimatedOutlet() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-view">
      <Outlet />
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Navigate to="/fetch" replace />} />
        <Route path="/login" element={<LoginGate />} />
        <Route element={<RequireAuth />}>
          <Route path="/fetch" element={<FetchView />} />
          <Route path="/mycodes" element={<MyCodesView />} />
        </Route>
        <Route element={<RequireAuth admin />}>
          <Route path="/list" element={<ListView />} />
          <Route path="/logs" element={<LogsView />} />
          <Route path="/admin" element={<AdminView />} />
        </Route>
        <Route path="*" element={<Navigate to="/fetch" replace />} />
      </Routes>
    </Suspense>
  )
}
