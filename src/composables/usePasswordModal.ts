import { create } from 'zustand'
import { changePassword } from '@/api/auth'
import { getErrorMessage, isHandledError } from '@/api/request'
import { messageError, messageSuccess } from '@/utils/messageBridge'

export interface PwdTarget {
  id: number
  username: string
}

interface PasswordModalState {
  show: boolean
  target: PwdTarget | null
  oldPwd: string
  newPwd: string
  newPwd2: string
  loading: boolean
  setOldPwd: (v: string) => void
  setNewPwd: (v: string) => void
  setNewPwd2: (v: string) => void
  open: (user?: PwdTarget | null) => void
  close: () => void
  submit: () => Promise<void>
}

/** 密码修改/重置弹窗全局单例状态（等价于 Vue 版本的模块级 ref） */
export const usePasswordModal = create<PasswordModalState>()((set, get) => ({
  show: false,
  target: null,
  oldPwd: '',
  newPwd: '',
  newPwd2: '',
  loading: false,

  setOldPwd: (v) => set({ oldPwd: v }),
  setNewPwd: (v) => set({ newPwd: v }),
  setNewPwd2: (v) => set({ newPwd2: v }),

  open(user = null) {
    set({ target: user, oldPwd: '', newPwd: '', newPwd2: '', show: true })
  },

  close() {
    set({ show: false, target: null })
  },

  async submit() {
    const { target, oldPwd, newPwd, newPwd2 } = get()
    const isSelf = !target
    // 与 Vue 版 canSubmit 校验保持一致
    if (!newPwd || newPwd.length < 4) return
    if (isSelf && (!oldPwd || newPwd !== newPwd2)) return

    set({ loading: true })
    try {
      await changePassword({
        userId: isSelf ? null : target.id,
        oldPassword: isSelf ? oldPwd : null,
        newPassword: newPwd,
      })
      messageSuccess('密码修改成功')
      get().close()
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      set({ loading: false })
    }
  },
}))
