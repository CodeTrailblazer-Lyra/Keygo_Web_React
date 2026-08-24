import { getMessageApi } from './antdAppBridge'

/**
 * 全局消息桥接：让 api/request.ts 等非组件模块也能弹出提示。
 * 优先使用 antd <App/> 上下文注册的 message 实例（跟随 ConfigProvider 主题，含暗色）；
 * 未注册时回退 antd 静态 message（经 @ant-design/v5-patch-for-react-19 兼容 React 19）。
 */

type NotifyKind = 'success' | 'error' | 'warning' | 'info'

function notify(kind: NotifyKind, content: string) {
  getMessageApi()[kind](content)
}

export function messageError(content: string) {
  notify('error', content)
}

export function messageSuccess(content: string) {
  notify('success', content)
}

export function messageWarning(content: string) {
  notify('warning', content)
}
