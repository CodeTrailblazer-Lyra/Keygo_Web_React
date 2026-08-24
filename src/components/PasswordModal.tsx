import type { CSSProperties } from 'react'
import { Button, Input, Modal } from 'antd'
import { usePasswordModal } from '@/composables/usePasswordModal'

/** 密码修改/重置弹窗（全局单例状态，由 usePasswordModal 控制） */
export default function PasswordModal() {
  const show = usePasswordModal((s) => s.show)
  const target = usePasswordModal((s) => s.target)
  const oldPwd = usePasswordModal((s) => s.oldPwd)
  const newPwd = usePasswordModal((s) => s.newPwd)
  const newPwd2 = usePasswordModal((s) => s.newPwd2)
  const loading = usePasswordModal((s) => s.loading)
  const setOldPwd = usePasswordModal((s) => s.setOldPwd)
  const setNewPwd = usePasswordModal((s) => s.setNewPwd)
  const setNewPwd2 = usePasswordModal((s) => s.setNewPwd2)
  const close = usePasswordModal((s) => s.close)
  const submit = usePasswordModal((s) => s.submit)

  const isSelf = !target
  const canSubmit = (() => {
    if (!newPwd || newPwd.length < 4) return false
    if (isSelf) {
      if (!oldPwd) return false
      if (newPwd !== newPwd2) return false
    }
    return true
  })()

  const labelStyle: CSSProperties = { fontSize: 14, fontWeight: 500, marginBottom: 4 }

  return (
    <Modal
      open={show}
      onCancel={close}
      title={isSelf ? '修改密码' : `重置密码 - ${target?.username || ''}`}
      footer={null}
      width={420}
      closable
      maskClosable={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isSelf && (
          <div>
            <div style={labelStyle}>当前密码</div>
            <Input.Password
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="请输入当前密码"
              autoComplete="current-password"
            />
          </div>
        )}
        <div>
          <div style={labelStyle}>新密码</div>
          <Input.Password
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="请输入新密码（至少4位）"
            autoComplete="new-password"
          />
        </div>
        {isSelf && (
          <div>
            <div style={labelStyle}>确认新密码</div>
            <Input.Password
              value={newPwd2}
              onChange={(e) => setNewPwd2(e.target.value)}
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <Button onClick={close}>取消</Button>
        <Button type="primary" disabled={!canSubmit} loading={loading} onClick={() => void submit()}>
          {loading ? '修改中...' : '确认修改'}
        </Button>
      </div>
    </Modal>
  )
}
