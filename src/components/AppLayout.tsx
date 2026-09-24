import type { ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button, Dropdown, Tag } from 'antd'
import { selectIsAdmin, selectRole, selectUsername, useAuthStore } from '@/stores/auth'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
import { roleLabel, roleTagColor } from '@/utils'
import { usePasswordModal } from '@/composables/usePasswordModal'
import { pendingUsers as fetchPending } from '@/api/users'
import { messageSuccess } from '@/utils/messageBridge'
import { appConfirm } from '@/utils/antdAppBridge'
import PasswordModal from './PasswordModal'
import type { IconName } from './AppIcon'
import AppIcon from './AppIcon'
import './AppLayout.css'

const MOBILE_BREAKPOINT = 768

interface NavItem {
  label: string
  key: string
  icon: IconName
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()

  const username = useAuthStore(selectUsername)
  const role = useAuthStore(selectRole)
  const isAdmin = useAuthStore(selectIsAdmin)
  const logout = useAuthStore((s) => s.logout)
  const openPasswordModal = usePasswordModal((s) => s.open)
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)

  const [pendingCount, setPendingCount] = useState(0)

  /* ===== 移动端判断 ===== */
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT,
  )

  const mobileTabRef = useRef<HTMLDivElement>(null)

  const activeKey = location.pathname.replace(/^\//, '')

  const menuOptions: NavItem[] = []
  menuOptions.push({ label: '获取', key: 'fetch', icon: 'key' })
  menuOptions.push({ label: '我的', key: 'mycodes', icon: 'clipboard' })
  if (isAdmin) {
    menuOptions.push({ label: '查询', key: 'list', icon: 'search' })
    menuOptions.push({ label: '日志', key: 'logs', icon: 'scroll' })
    menuOptions.push({
      label: pendingCount > 0 ? `管理 (${pendingCount})` : '管理',
      key: 'admin',
      icon: 'settings',
    })
  }

  async function handleLogout() {
    await logout()
    messageSuccess('已退出登录')
    navigate('/login')
  }

  function confirmLogout() {
    appConfirm({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      okButtonProps: { danger: true },
      onOk: handleLogout,
    })
  }

  function handleUserMenu(key: string) {
    if (key === 'pwd') {
      openPasswordModal(null)
    } else if (key === 'logout') {
      confirmLogout()
    }
  }

  const checkPending = useCallback(async () => {
    const role = useAuthStore.getState().user?.role || ''
    if (role !== 'ROLE_ADMIN' && role !== 'ROLE_SUPER_ADMIN') return
    try {
      const list = await fetchPending()
      setPendingCount(list.length)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void checkPending()
    // 标签页隐藏时暂停轮询（避免后台空耗请求），回到前台立即刷新一次
    const pollTimer = setInterval(() => {
      if (!document.hidden) void checkPending()
    }, 30000)
    const onVisible = () => {
      if (!document.hidden) void checkPending()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(pollTimer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [checkPending])

  /* ===== 移动端 resize 监听 ===== */
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
      }, 80)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (resizeTimer) clearTimeout(resizeTimer)
    }
  }, [])

  /* ===== 滑动指示器 ===== */
  const desktopNavRef = useRef<HTMLElement>(null)
  const [desktopIndicator, setDesktopIndicator] = useState({ x: 0, w: 0, show: false })
  const [mobileIndicator, setMobileIndicator] = useState({ x: 0, w: 0, show: false })

  const updateIndicators = useCallback(() => {
    if (desktopNavRef.current && !isMobile) {
      const active = desktopNavRef.current.querySelector('.desktop-nav-item.active') as HTMLElement | null
      if (active) {
        setDesktopIndicator({ x: active.offsetLeft, w: active.offsetWidth, show: true })
      } else {
        setDesktopIndicator((p) => ({ ...p, show: false }))
      }
    } else {
      setDesktopIndicator((p) => (p.show ? { ...p, show: false } : p))
    }
    if (mobileTabRef.current && isMobile) {
      const active = mobileTabRef.current.querySelector('.mobile-tab-item.active') as HTMLElement | null
      if (active) {
        setMobileIndicator({ x: active.offsetLeft, w: active.offsetWidth, show: true })
      } else {
        setMobileIndicator((p) => ({ ...p, show: false }))
      }
    } else {
      setMobileIndicator((p) => (p.show ? { ...p, show: false } : p))
    }
  }, [isMobile])

  useLayoutEffect(() => {
    updateIndicators()
  }, [updateIndicators, activeKey, isAdmin, pendingCount])

  useEffect(() => {
    window.addEventListener('resize', updateIndicators)
    return () => window.removeEventListener('resize', updateIndicators)
  }, [updateIndicators])

  const userMenuItems = [
    { key: 'info', label: username, disabled: true },
    { key: 'pwd', label: '修改密码' },
    { key: 'logout', label: '退出登录' },
  ]

  const themeMenuItems = [
    { key: 'auto', label: '自动（跟随系统）' },
    { key: 'light', label: '浅色模式' },
    { key: 'dark', label: '暗色模式' },
  ]

  return (
    <>
      {/* 顶部导航栏 */}
      <div className={`app-navbar${isMobile ? ' app-navbar-mobile' : ''}`}>
        <div className="app-navbar-left">
          <Link className="app-brand" to="/fetch">
            <span className="app-brand-icon">
              <AppIcon name="key" size={16} />
            </span>
            {!isMobile && <span>KeyGo</span>}
          </Link>
        </div>

        {!isMobile && (
          <nav className="desktop-nav" ref={desktopNavRef}>
            <div
              className="nav-glass-indicator"
              style={{
                transform: `translateX(${desktopIndicator.x}px)`,
                width: `${desktopIndicator.w}px`,
                opacity: desktopIndicator.show ? '1' : '0',
              }}
            />
            {menuOptions.map((opt) => (
              <Link
                key={opt.key}
                className={`desktop-nav-item${activeKey === opt.key ? ' active' : ''}`}
                to={`/${opt.key}`}
              >
                <AppIcon name={opt.icon} size={18} />
                <span>{opt.label}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="app-navbar-right">
          <Dropdown
            placement="bottomRight"
            trigger={['click']}
            menu={{
              items: themeMenuItems,
              selectable: true,
              selectedKeys: [themeMode],
              onClick: ({ key }) => setThemeMode(key as ThemeMode),
            }}
          >
            <Button
              type="text"
              aria-label="切换主题"
              title="切换主题"
              style={{ padding: isMobile ? 6 : 4, display: 'inline-flex', alignItems: 'center' }}
            >
              <AppIcon name="palette" size={isMobile ? 20 : 16} />
            </Button>
          </Dropdown>
          <Dropdown
            placement="bottomRight"
            trigger={['click']}
            menu={{ items: userMenuItems, onClick: ({ key }) => handleUserMenu(key as string) }}
          >
            {!isMobile ? (
              <Button type="text" style={{ fontWeight: 500, gap: 6 }}>
                <AppIcon name="user" size={16} />
                <span>{username}</span>
                <Tag color={roleTagColor(role)}>{roleLabel(role)}</Tag>
              </Button>
            ) : (
              <Button type="text" style={{ padding: 6 }}>
                <AppIcon name="user" size={20} />
              </Button>
            )}
          </Dropdown>
        </div>
      </div>

      {/* 移动端：底部 Tab Bar */}
      {isMobile && (
        <div className="mobile-tab-bar" ref={mobileTabRef}>
          <div
            className="tab-glass-indicator"
            style={{
              transform: `translateX(${mobileIndicator.x}px)`,
              width: `${mobileIndicator.w}px`,
              opacity: mobileIndicator.show ? '1' : '0',
            }}
          />
          {menuOptions.map((opt) => (
            <Link
              key={opt.key}
              className={`mobile-tab-item${activeKey === opt.key ? ' active' : ''}`}
              to={`/${opt.key}`}
            >
              <AppIcon name={opt.icon} size={20} className="mobile-tab-icon" />
              <span className="mobile-tab-label">{opt.label}</span>
            </Link>
          ))}
        </div>
      )}

      <main className="page-container">{children}</main>

      <PasswordModal />
    </>
  )
}
