/** 通用工具函数（从 Vue 版 composables/useUtils.ts 迁移，去除 UI 库依赖） */

export function formatTime(ts: string | null | undefined): string {
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

/**
 * 复制文本到剪贴板，返回是否成功。
 * 优先使用异步 Clipboard API（需安全上下文 + 用户手势内调用）；
 * 不可用或被拒绝（如 iOS Safari 受限环境、非 HTTPS）时，
 * 降级为隐藏 textarea + execCommand('copy') 兜底方案。
 */
export async function copyText(text: string): Promise<boolean> {
  // 首选：异步 Clipboard API
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 权限被拒等情况：继续走 execCommand 降级 */
  }

  // 降级：隐藏 textarea + execCommand
  // iOS Safari 上 select() 无效，需 contentEditable + setSelectionRange 才能选中
  const ta = document.createElement('textarea')
  ta.value = text
  ta.contentEditable = 'true'
  ta.readOnly = true
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)

  // 保存用户当前选区，复制完成后还原（降级方案会临时抢占选区）
  const selection = document.getSelection()
  const prevRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  try {
    ta.focus()
    ta.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(ta)
    if (prevRange && selection) {
      selection.removeAllRanges()
      selection.addRange(prevRange)
    }
  }
}

export function roleLabel(r: string): string {
  switch (r) {
    case 'ROLE_SUPER_ADMIN':
      return '超级管理员'
    case 'ROLE_ADMIN':
      return '管理员'
    default:
      return '普通用户'
  }
}

/** 角色对应的 Tag 颜色（Ant Design 合法预设色） */
export function roleTagColor(r: string): string {
  switch (r) {
    case 'ROLE_SUPER_ADMIN':
      return 'red'
    case 'ROLE_ADMIN':
      return 'gold'
    default:
      return 'default'
  }
}

export function actionLabel(action: string): string {
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
    GENERATE: '生成激活码',
    PUBLISH_ANNOUNCEMENT: '发布公告',
    USER_APPROVE: '用户通过',
    USER_REJECT: '用户拒绝',
    USER_ROLE_CHANGE: '角色变更',
    USER_DELETE: '删除用户',
    PASSWORD_CHANGE: '修改密码',
  }
  return m[action] || action
}

/** 操作类型对应的 Tag 颜色（Ant Design 合法预设色） */
export function actionTagColor(action: string): string {
  if (/DELETE|REJECT/.test(action)) return 'red'
  if (/CLAIM|IMPORT|PUBLISH|APPROVE/.test(action)) return 'green'
  if (/MARK|BATCH/.test(action)) return 'orange'
  return 'default'
}
