import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Card, Checkbox, Input, Tabs } from 'antd'
import { useNavigate } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { register } from '@/api/auth'
import { getErrorMessage, isHandledError } from '@/api/request'
import { messageError, messageSuccess } from '@/utils/messageBridge'
import AppIcon from '@/components/AppIcon'
import { FadeIn } from '@/components/FadeIn'
import './LoginView.css'

export default function LoginView() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [loginLoading, setLoginLoading] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)

  // 登录表单
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [remember, setRemember] = useState(false)

  // 注册表单
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  async function handleLogin() {
    if (!loginUsername || !loginPassword) {
      messageError('请输入用户名和密码')
      return
    }
    setLoginLoading(true)
    try {
      await login(loginUsername, loginPassword, remember)
      messageSuccess('登录成功')
      navigate('/fetch')
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRegister() {
    if (!regUsername || regUsername.length < 2) {
      messageError('用户名至少 2 个字符')
      return
    }
    if (!regPassword || regPassword.length < 4) {
      messageError('密码至少 4 位')
      return
    }
    if (regPassword !== regConfirm) {
      messageError('两次输入的密码不一致')
      return
    }
    setRegisterLoading(true)
    try {
      await register(regUsername, regPassword)
      messageSuccess('注册成功，请等待管理员审核')
      setRegUsername('')
      setRegPassword('')
      setRegConfirm('')
      setActiveTab('login')
      setLoginUsername(regUsername)
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setRegisterLoading(false)
    }
  }

  const tabTitle = (icon: 'user', text: string): ReactNode => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <AppIcon name={icon} size={16} />
      {text}
    </span>
  )

  const tabItems = [
    {
      key: 'login',
      label: tabTitle('user', '登录'),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <Input
            placeholder="请输入用户名"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            prefix={<AppIcon name="user" size={16} />}
            size="large"
            onPressEnter={() => void handleLogin()}
          />
          <Input.Password
            placeholder="请输入密码"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            prefix={<AppIcon name="lock" size={16} />}
            size="large"
            onPressEnter={() => void handleLogin()}
          />
          <div className="login-options">
            <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
              14天免登录
            </Checkbox>
          </div>
          <Button
            type="primary"
            block
            size="large"
            loading={loginLoading}
            onClick={() => void handleLogin()}
          >
            登录
          </Button>
        </div>
      ),
    },
    {
      key: 'register',
      label: tabTitle('user', '注册'),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <Input
            placeholder="用户名（2-50字符）"
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
            prefix={<AppIcon name="user" size={16} />}
            size="large"
          />
          <Input.Password
            placeholder="密码（至少4位）"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            prefix={<AppIcon name="lock" size={16} />}
            size="large"
          />
          <Input.Password
            placeholder="再次输入密码"
            value={regConfirm}
            onChange={(e) => setRegConfirm(e.target.value)}
            prefix={<AppIcon name="lock" size={16} />}
            size="large"
            onPressEnter={() => void handleRegister()}
          />
          <p className="register-hint">注册后需管理员审核通过方可登录</p>
          <Button
            type="primary"
            block
            size="large"
            loading={registerLoading}
            onClick={() => void handleRegister()}
          >
            注册
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="login-page">
      <FadeIn className="login-wrapper">
        <div className="brand-area">
          <div className="brand-logo">
            <AppIcon name="key" size={26} />
          </div>
          <h1 className="brand-title">KeyGo</h1>
          <p className="brand-subtitle">激活码分发管理系统</p>
        </div>

        <Card className="login-card" styles={{ body: { padding: 32 } }}>
          <Tabs
            className="login-tabs"
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as 'login' | 'register')}
            items={tabItems}
          />
        </Card>
      </FadeIn>
    </div>
  )
}
