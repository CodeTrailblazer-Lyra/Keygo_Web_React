import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@ant-design/v5-patch-for-react-19'
import App from './App'
// antd 样式重置：本地依赖引入（原 CDN 引入会被浏览器跟踪防护拦截）
import 'antd/dist/reset.css'
import './styles/main.css'
// 修复移动端弹窗滚动穿透：锁定时同步锁定真实滚动容器 <html>
import { initModalScrollLock } from './utils/modalScrollLock'

initModalScrollLock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
