import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@ant-design/v5-patch-for-react-19'
import App from './App'
// antd 样式重置：本地依赖引入（原 CDN 引入会被浏览器跟踪防护拦截）
import 'antd/dist/reset.css'
import './styles/main.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
