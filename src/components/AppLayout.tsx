import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Avatar, Button, Dropdown, Tag } from 'antd'
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

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT,
  )

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
          <nav className="desktop-nav">
            {menuOptions.map((opt) => (
              <Link
                key={opt.key}
                className={`desktop-nav-item${activeKey === opt.key ? ' active' : ''}`}
                to={`/${opt.key}`}
              >
                <AppIcon name={opt.icon} size={16} />
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
              style={{ padding: isMobile ? 8 : 6, display: 'inline-flex', alignItems: 'center' }}
            >
              <AppIcon name="palette" size={isMobile ? 18 : 16} />
            </Button>
          </Dropdown>
          <Dropdown
            placement="bottomRight"
            trigger={['click']}
            menu={{ items: userMenuItems, onClick: ({ key }) => handleUserMenu(key as string) }}
          >
            {!isMobile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}>
                <Avatar size={28} style={{ background: '#6366f1' }}>
                  {username.charAt(0).toUpperCase()}
                </Avatar>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{username}</span>
                <Tag color={roleTagColor(role)} style={{ marginLeft: 0 }}>{roleLabel(role)}</Tag>
              </div>
            ) : (
              <Avatar size={32} style={{ background: '#6366f1' }}>
                {username.charAt(0).toUpperCase()}
              </Avatar>
            )}
          </Dropdown>
        </div>
      </div>

      {/* 移动端：底部 Tab Bar */}
      {isMobile && (
        <div className="mobile-tab-bar">
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
