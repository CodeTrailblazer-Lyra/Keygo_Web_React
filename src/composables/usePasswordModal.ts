import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { changePassword } from '@/api/auth'
import { getErrorMessage, isHandledError } from '@/api/request'

interface PwdTarget {
  id: number
  username: string
}

const show = ref(false)
const target = ref<PwdTarget | null>(null)
const oldPwd = ref('')
const newPwd = ref('')
const newPwd2 = ref('')
const loading = ref(false)

const isSelf = computed(() => !target.value)
const canSubmit = computed(() => {
  if (!newPwd.value || newPwd.value.length < 4) return false
  if (isSelf.value) {
    if (!oldPwd.value) return false
    if (newPwd.value !== newPwd2.value) return false
  }
  return true
})

export function usePasswordModal() {
  const message = useMessage()

  function open(user: PwdTarget | null = null) {
    target.value = user
    oldPwd.value = ''
    newPwd.value = ''
    newPwd2.value = ''
    show.value = true
  }

  function close() {
    show.value = false
    target.value = null
  }

  async function submit() {
    if (!canSubmit.value) return
    loading.value = true
    try {
      await changePassword({
        userId: isSelf.value ? null : target.value!.id,
        oldPassword: isSelf.value ? oldPwd.value : null,
        newPassword: newPwd.value,
      })
      message.success('密码修改成功')
      close()
    } catch (err) {
      if (!isHandledError(err)) message.error(getErrorMessage(err))
    } finally {
      loading.value = false
    }
  }

  return { show, target, oldPwd, newPwd, newPwd2, loading, isSelf, canSubmit, open, close, submit }
}
