import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Modal, Select } from 'antd'
import { claimCode, getStats } from '@/api/codes'
import { listUnits } from '@/api/units'
import { announcements as fetchAnnouncements } from '@/api/logs'
import { copyText } from '@/utils'
import { getErrorMessage, isHandledError } from '@/api/request'
import { messageError, messageSuccess, messageWarning } from '@/utils/messageBridge'
import { releaseModalOverlay, useModalOverlayCleanup } from '@/utils/modalScrollLock'
import type { Announcement, UsageUnit } from '@/types'
import AppIcon from '@/components/AppIcon'
import { AnimatedItem, AnimatedList } from '@/components/AnimatedList'
import { FadeIn } from '@/components/FadeIn'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import './FetchView.css'

/** 上次申领所选使用单位的持久化 key（localStorage，刷新页面后仍生效） */
const LAST_UNIT_KEY = 'keygo-last-claim-unit'

/** 读取上次申领所选单位；隐私模式等异常场景返回空串 */
function readLastUnit(): string {
  try {
    return localStorage.getItem(LAST_UNIT_KEY) ?? ''
  } catch {
    return ''
  }
}

/** 记住本次申领所选单位；清空选择时清除记录（下次默认为空） */
function saveLastUnit(name: string): void {
  try {
    if (name) localStorage.setItem(LAST_UNIT_KEY, name)
    else localStorage.removeItem(LAST_UNIT_KEY)
  } catch {
    /* localStorage 不可用时静默忽略，不影响申领主流程 */
  }
}

export default function FetchView() {
  const [stats, setStats] = useState({ total: 0, available: 0, used: 0 })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  // 使用单位（可选）：默认回填上次申领所选单位（localStorage 持久化），
  // 选中后随申领提交并由后端写入激活码备注；初次使用无记录时默认为空
  const [units, setUnits] = useState<UsageUnit[]>([])
  const [unit, setUnit] = useState('')

  const [showClaimModal, setShowClaimModal] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimDone, setClaimDone] = useState(false)
  const [claimOk, setClaimOk] = useState(false)
  const [claimedCode, setClaimedCode] = useState('')
  const [claimError, setClaimError] = useState('')

  const codeDisplayRef = useRef<HTMLDivElement>(null)
  const [codeFontSize, setCodeFontSize] = useState(20)

  const fitCodeFont = useCallback(() => {
    const el = codeDisplayRef.current
    if (!el || !claimedCode) return
    const style = window.getComputedStyle(el)
    const padL = parseFloat(style.paddingLeft) || 0
    const padR = parseFloat(style.paddingRight) || 0
    const avail = el.clientWidth - padL - padR
    const len = claimedCode.length
    let size = 20
    while (size > 10 && len * size * 0.65 > avail) size -= 0.5
    setCodeFontSize(size)
  }, [claimedCode])

  async function loadAnnouncements() {
    try {
      setAnnouncements(await fetchAnnouncements())
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    }
  }

  async function loadStats() {
    try {
      const data = await getStats()
      setStats({ total: data.total, available: data.available, used: data.used })
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    }
  }

  /** 加载使用单位选项；失败时静默降级为空列表，不阻塞主流程 */
  async function loadUnits() {
    try {
      setUnits(await listUnits())
    } catch {
      /* 使用单位为可选功能，加载失败仅意味着下拉无可选项 */
    }
  }

  function openClaimModal() {
    setClaimDone(false)
    setClaimOk(false)
    setClaiming(false)
    setClaimedCode('')
    setClaimError('')
    setCodeFontSize(20)
    // 默认回填上次申领所选单位；记录的单位已不存在（被删除）时回退为空
    const last = readLastUnit()
    setUnit(units.some((u) => u.name === last) ? last : '')
    setShowClaimModal(true)
  }

  async function doClaim() {
    setClaiming(true)
    try {
      // 选中使用单位时提交该值（后端写入备注）；未选择时不传，备注保持原样
      const chosen = unit.trim()
      const result = await claimCode(chosen || undefined)
      // 申领成功后记住本次所选单位，作为下次打开弹窗的默认值
      saveLastUnit(chosen)
      setClaimDone(true)
      setClaimOk(true)
      setClaimedCode(result.code || '')
      setStats({ available: result.available, used: result.used, total: result.total })
    } catch (err) {
      setClaimDone(true)
      setClaimOk(false)
      setClaimError(getErrorMessage(err))
    } finally {
      setClaiming(false)
    }
  }

  async function copyCode() {
    const ok = await copyText(claimedCode)
    if (ok) messageSuccess('激活码已复制')
    else messageWarning('复制失败，请手动复制')
  }

  useEffect(() => {
    void loadAnnouncements()
    void loadStats()
    void loadUnits()
  }, [])

  // 弹窗关闭后兜底清理可能残留的遮罩层与滚动锁定，确保页面交互恢复正常
  useModalOverlayCleanup(showClaimModal)

  useLayoutEffect(() => {
    if (claimDone && claimOk && claimedCode) fitCodeFont()
  }, [claimDone, claimOk, claimedCode, fitCodeFont])

  useEffect(() => {
    function onWinResize() {
      if (claimDone && claimOk) fitCodeFont()
    }
    window.addEventListener('resize', onWinResize)
    return () => window.removeEventListener('resize', onWinResize)
  }, [claimDone, claimOk, fitCodeFont])

  return (
    <div>
      <div className="page-header-block">
        <h2 className="page-title">激活码获取</h2>
        <p className="page-subtitle">点击按钮获取一个可用的激活码</p>
      </div>

      {/* 公告仅展示内容；visible=false 的公告由管理页控制、此处不渲染 */}
      {announcements.filter((a) => a.visible !== false).length > 0 && (
        <AnimatedList className="announcement-list" effect="right">
          {announcements
            .filter((a) => a.visible !== false)
            .map((item) => (
              <AnimatedItem key={item.id} effect="right">
                <Alert
                  type={item.pinned ? 'warning' : 'info'}
                  showIcon={false}
                  className="announcement-item"
                  message={<span className="announcement-text">{item.content}</span>}
                />
              </AnimatedItem>
            ))}
        </AnimatedList>
      )}

      <FadeIn className="stats-grid" delay={0.04} effect="fade" animateOnMount={false}>
        <Card className="stat-card" styles={{ body: { padding: 20 } }} variant="outlined">
          <div className="stat-card-inner">
            <span className="stat-icon">
              <AppIcon name="package" size={28} />
            </span>
            <div>
              <AnimatedNumber value={stats.total} className="stat-value" />
              <div className="stat-label">总数</div>
            </div>
          </div>
        </Card>
        <Card className="stat-card" styles={{ body: { padding: 20 } }} variant="outlined">
          <div className="stat-card-inner">
            <span className="stat-icon">
              <AppIcon name="check-circle" size={28} />
            </span>
            <div>
              <AnimatedNumber value={stats.available} className="stat-value stat-value-green" />
              <div className="stat-label">可用</div>
            </div>
          </div>
        </Card>
        <Card className="stat-card" styles={{ body: { padding: 20 } }} variant="outlined">
          <div className="stat-card-inner">
            <span className="stat-icon">
              <AppIcon name="map-pin" size={28} />
            </span>
            <div>
              <AnimatedNumber value={stats.used} className="stat-value stat-value-orange" />
              <div className="stat-label">已使用</div>
            </div>
          </div>
        </Card>
      </FadeIn>

      <Card className="claim-card" styles={{ body: { padding: 20 } }} variant="outlined">
        <div className="claim-section">
          <div className="claim-icon">
            <AppIcon name="key" size={36} />
          </div>
          <h3 className="claim-title">获取激活码</h3>
          <p className="claim-desc">
            当前可用：<strong>{stats.available}</strong> 个
          </p>
          <Button type="primary" size="large" shape="round" onClick={openClaimModal}>
            立即获取
          </Button>
        </div>
      </Card>

      <Modal
        open={showClaimModal}
        onCancel={() => setShowClaimModal(false)}
        title="获取激活码"
        footer={null}
        width={420}
        closable={false}
        maskClosable={false}
        destroyOnClose
        afterClose={releaseModalOverlay}
      >
        {!claimDone ? (
          <div className="claim-modal-body">
            <div className="claim-modal-icon">
              <AppIcon name="key" size={40} />
            </div>
            <p className="claim-modal-text">您即将获取一个激活码，确认继续吗？</p>
            <p className="claim-modal-sub">
              当前可用：<strong>{stats.available}</strong> 个
            </p>
            <div className="claim-unit-field">
              <span className="claim-unit-label">使用单位（可选）</span>
              <Select
                value={unit}
                onChange={(v) => setUnit(v ?? '')}
                options={[
                  { label: '不选择（留空）', value: '' },
                  ...units.map((u) => ({ label: u.name, value: u.name })),
                ]}
                notFoundContent="暂无可选单位"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        ) : (
          <div className="claim-modal-body">
            {claimOk ? (
              <>
                <div className="claim-result-icon">
                  <AppIcon name="check-circle" size={40} />
                </div>
                <p className="claim-modal-text">恭喜，您已成功获取：</p>
                <div
                  className="claim-code-display"
                  ref={codeDisplayRef}
                  style={{ fontSize: codeFontSize + 'px' }}
                >
                  {claimedCode}
                </div>
              </>
            ) : (
              <>
                <div className="claim-result-icon">
                  <AppIcon name="alert-circle" size={40} />
                </div>
                <p className="claim-modal-text">获取失败</p>
                <p className="claim-modal-error">{claimError}</p>
              </>
            )}
          </div>
        )}

        <div className="claim-modal-footer">
          {!claimDone ? (
            <>
              <Button onClick={() => setShowClaimModal(false)}>取消</Button>
              <Button type="primary" loading={claiming} onClick={() => void doClaim()}>
                {claiming ? '获取中...' : '确认获取'}
              </Button>
            </>
          ) : claimOk ? (
            <>
              <Button onClick={() => setShowClaimModal(false)}>关闭</Button>
              <Button type="primary" onClick={() => void copyCode()}>
                复制激活码
              </Button>
            </>
          ) : (
            <Button onClick={() => setShowClaimModal(false)}>关闭</Button>
          )}
        </div>
      </Modal>
    </div>
  )
}
