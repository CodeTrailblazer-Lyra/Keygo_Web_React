import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd'
import { BrowserRouter, useNavigate } from 'react-router'
import { registerNavigate } from '@/router/navigation'
import { useEffect } from 'react'
import AppRoutes from '@/router/AppRoutes'
import { useThemeStore } from '@/stores/theme'
import { registerAntdApp } from '@/utils/antdAppBridge'

/** 在 Router 上下文内注册编程式导航（供 api 层 401 跳转使用） */
function NavigateRegister() {
  const navigate = useNavigate()
  useEffect(() => {
    registerNavigate(navigate)
    return () => registerNavigate(null)
  }, [navigate])
  return null
}

/** 把跟随主题的 message / modal 实例注册到桥接模块（供非组件代码使用） */
function AntdAppRegistrar() {
  const { message, modal } = AntdApp.useApp()
  useEffect(() => {
    registerAntdApp(message, modal)
    return () => registerAntdApp(null, null)
  }, [message, modal])
  return null
}

export default function App() {
  const isDark = useThemeStore((s) => s.isDark)
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: '#6366f1', borderRadius: 6 },
      }}
    >
      <AntdApp>
        <AntdAppRegistrar />
        <BrowserRouter>
          <NavigateRegister />
          <AppRoutes />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  )
}
