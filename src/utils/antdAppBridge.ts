import { message, Modal } from 'antd'
import type { MessageInstance } from 'antd/es/message/interface'
import type { ModalFuncProps } from 'antd/es/modal/interface'

/**
 * antd App 上下文桥接：
 * antd <App/> 组件内 useApp() 拿到的 message / modal 实例会跟随 ConfigProvider 主题（含暗色），
 * 通过本模块注册后，非组件模块（api 拦截器、各视图的确认弹窗）也能使用主题感知的实例；
 * 未注册时回退到 antd 静态方法（React 19 下由 v5-patch 补丁兜底）。
 */

interface ModalConfirmApi {
  confirm: (config: ModalFuncProps) => unknown
}

let messageApi: MessageInstance | null = null
let modalApi: ModalConfirmApi | null = null

export function registerAntdApp(msg: MessageInstance | null, modal: ModalConfirmApi | null) {
  messageApi = msg
  modalApi = modal
}

/** 获取跟随主题的 message 实例 */
export function getMessageApi(): MessageInstance {
  return messageApi ?? message
}

/** 跟随主题的 Modal.confirm */
export function appConfirm(config: ModalFuncProps) {
  if (modalApi) return modalApi.confirm(config)
  return Modal.confirm(config)
}
