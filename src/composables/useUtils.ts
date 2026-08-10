import { useMessage } from 'naive-ui'

export function useUtils() {
  const message = useMessage()

  function formatTime(ts: string | null | undefined): string {
    if (!ts) return '—'
    const d = new Date(ts)
    if (isNaN(d.getTime())) {
      const parts = ts.slice(0, 19).split('T')
      if (parts.length === 2) return parts[0]! + ' ' + parts[1]!.slice(0, 5)
      return ts
    }
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  async function copyToClipboard(text: string, okMsg = '已复制到剪贴板') {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      message.success(okMsg)
    } catch {
      message.warning('复制失败，请手动复制')
    }
  }

  function roleLabel(r: string): string {
    switch (r) {
      case 'ROLE_SUPER_ADMIN':
        return '超级管理员'
      case 'ROLE_ADMIN':
        return '管理员'
      default:
        return '普通用户'
    }
  }

  function roleTagType(r: string): 'error' | 'warning' | 'default' {
    switch (r) {
      case 'ROLE_SUPER_ADMIN':
        return 'error'
      case 'ROLE_ADMIN':
        return 'warning'
      default:
        return 'default'
    }
  }

  function actionLabel(action: string): string {
    const m: Record<string, string> = {
      CLAIM: '申领激活码',
      BATCH_CLAIM: '批量申领',
      MARK_USED: '使用',
      MARK_UNUSED: '恢复未用',
      BATCH_MARK_USED: '批量标记',
      BATCH_MARK_UNUSED: '批量恢复',
      DELETE: '删除激活码',
      BATCH_DELETE: '批量删除',
      IMPORT: '导入激活码',
      PUBLISH_ANNOUNCEMENT: '发布公告',
      USER_APPROVE: '用户通过',
      USER_REJECT: '用户拒绝',
      USER_ROLE_CHANGE: '角色变更',
      USER_DELETE: '删除用户',
      PASSWORD_CHANGE: '修改密码',
    }
    return m[action] || action
  }

  function actionTagType(action: string): 'error' | 'success' | 'warning' | 'default' {
    if (/DELETE|REJECT/.test(action)) return 'error'
    if (/CLAIM|IMPORT|PUBLISH|APPROVE/.test(action)) return 'success'
    if (/MARK|BATCH/.test(action)) return 'warning'
    return 'default'
  }

  function debounce<T extends (...args: any[]) => void>(
    fn: T,
    delay = 400,
  ): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null
    return (...args: Parameters<T>) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => fn(...args), delay)
    }
  }

  return {
    message,
    formatTime,
    copyToClipboard,
    roleLabel,
    roleTagType,
    actionLabel,
    actionTagType,
    debounce,
  }
}
