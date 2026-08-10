import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** 需要登录 */
    requiresAuth?: boolean
    /** 需要管理员权限 */
    requiresAdmin?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/fetch',
      name: 'fetch',
      component: () => import('@/views/FetchView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/mycodes',
      name: 'mycodes',
      component: () => import('@/views/MyCodesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/list',
      name: 'list',
      component: () => import('@/views/ListView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/views/LogsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/',
      redirect: '/fetch',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // 未登录且不是去登录页时，尝试通过 session 恢复登录态
  if (!auth.isLoggedIn && to.name !== 'login') {
    await auth.fetchUser()
  }

  // 已登录访问登录页 → 跳转申领页
  if (to.name === 'login' && auth.isLoggedIn) {
    return { name: 'fetch' }
  }

  // 需要管理员权限但当前用户非管理员
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return auth.isLoggedIn ? { name: 'fetch' } : { name: 'login' }
  }

  // 需要登录但未登录
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login' }
  }

  return true
})

export default router
