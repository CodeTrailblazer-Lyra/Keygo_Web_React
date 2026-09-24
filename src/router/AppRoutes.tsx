import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { selectIsAdmin, useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/AppLayout'
import { pageSlideTransition, slideVariants } from '@/anim/motion'

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

/**
 * 新页面挂载时把滚动位置归零，避免返回旧页面时残留滚动造成「错位 / 残留状态」。
 * 放在 AnimatePresence 内部、随新页面 key 一起挂载 —— 旧页面退场期间它尚未存在，
 * 因此不会干扰正在退出的页面，只在「新页面真正出现」那一刻复位滚动。
 */
function ScrollResetOnMount() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])
  return null
}

/**
 * 路由顺序：用于推断页面切换的「方向」。导航到更靠后的页 → 视为前进（向左滑）；
 * 导航到更靠前的页 → 视为后退（向右滑）。顺序与 AppLayout 顶部导航保持一致。
 */
const ROUTE_ORDER = ['/fetch', '/mycodes', '/list', '/logs', '/admin']

/**
 * 计算本次切换方向：1 = 前进（向左滑），-1 = 后退（向右滑）。
 * 用模块级变量记录上一路由（本应用同一时刻仅一个路由树），
 * 渲染期比对即可，幂等、不受严格模式双调用影响。
 */
let lastPathname = ''
let lastDirection = 1

function useNavDirection(pathname: string): number {
  if (pathname !== lastPathname) {
    const cur = ROUTE_ORDER.indexOf(pathname)
    const prev = ROUTE_ORDER.indexOf(lastPathname)
    lastDirection = cur === -1 || prev === -1 ? 1 : cur >= prev ? 1 : -1
    lastPathname = pathname
  }
  return lastDirection
}

/**
 * 页面切换过渡：整页「左右滑动」，方向由导航层级（路由顺序）决定。
 * - mode="wait"：旧页面完整退场后，新页面再入场。同一时刻仅一个页面在 DOM ——
 *   避免 antd Table 等重型内容被同时挂载两份导致的掉帧 / 卡顿，渲染性能显著提升；
 * - 无重叠 → 无闪烁 / 错位 / 残留状态；过渡形式仍为整页左右滑动，观感连贯；
 * - 位移仅 transform + opacity（GPU 合成），不触发重排；退场略快于入场，切换更利落；
 * - custom 把方向下发到 variants 的 enter/exit 函数，决定滑动方向；
 * - initial={false}：首屏不播放滑动，避免「凭空滑入」的突兀感；
 * - 新页面入场时由 ScrollResetOnMount 复位滚动，状态自然衔接。
 */
function AnimatedOutlet() {
  const location = useLocation()
  const direction = useNavDirection(location.pathname)
  return (
    <div className="page-transition">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={location.pathname}
          className="page-view"
          variants={slideVariants}
          custom={direction}
          initial="enter"
          animate="center"
          exit="exit"
          transition={pageSlideTransition}
        >
          <ScrollResetOnMount />
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default function AppRoutes() {
  // 预加载各路由分包：进入页面前先把视图 chunk 拉入缓存，
  // 消除「页面滑入空白 → 等待 lazy chunk → 内容突现」的卡顿感。
  // 用 requestIdleCallback 在空闲时执行，不阻塞首屏与交互。
  useEffect(() => {
    const preload = () => {
      void import('@/views/LoginView')
      void import('@/views/FetchView')
      void import('@/views/MyCodesView')
      void import('@/views/ListView')
      void import('@/views/LogsView')
      void import('@/views/AdminView')
    }
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(preload)
    else window.setTimeout(preload, 1200)
  }, [])
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
