import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import type { ColumnsType } from 'antd/es/table'
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { selectIsSuperAdmin, useAuthStore } from '@/stores/auth'
import AppIcon from '@/components/AppIcon'
import {
  batchClaim,
  batchDelete as batchDeleteApi,
  batchUnuse as batchUnuseApi,
  batchUse as batchUseApi,
  deleteCode,
  exportCodes,
  importExcel,
  listCodes,
  markUnused,
  markUsed,
  updateRemark,
} from '@/api/codes'
import { copyText, formatTime } from '@/utils'
import { getErrorMessage, isHandledError } from '@/api/request'
import { messageError, messageSuccess, messageWarning } from '@/utils/messageBridge'
import { appConfirm } from '@/utils/antdAppBridge'
import { releaseModalOverlay } from '@/utils/modalScrollLock'
import type { ActivationCode, BatchClaimResult, CodeListResult } from '@/types'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import './ListView.css'

const { Text } = Typography

const filterOptions = [
  { label: '全部', value: '' },
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
]

/** 是否移动端（≤768px）：用于切换查询页操作的展示与交互形态（内联按钮 ↔ 长按菜单） */
function useIsMobile(): boolean {
  const get = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 768px)').matches
  const [mobile, setMobile] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = () => setMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return mobile
}

/** 单次拉取每页条数：用于一次性拉取全量数据，转为纯前端筛选/分页，保证多字段统一搜索的一致性 */
const FETCH_PAGE_SIZE = 100
/** 安全上限：最多翻 50 页（5000 条），避免异常响应导致死循环 */
const MAX_FETCH_PAGES = 50
/** 拉取后续页时的并发批次大小：并行提速，同时避免瞬时压垮后端 */
const FETCH_CONCURRENCY = 4

export default function ListView() {
  const isSuperAdmin = useAuthStore(selectIsSuperAdmin)
  /** 移动端判定：操作列与行交互在移动端切换为「长按弹出操作菜单」形态 */
  const isMobile = useIsMobile()

  const [filter, setFilter] = useState('')
  /** 统一搜索关键词：同时模糊匹配 激活码 / 备注 / 获取人 */
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  /** 全量数据集（拉取所有页后缓存于前端），筛选与分页均在本地完成 */
  const [allCodes, setAllCodes] = useState<ActivationCode[]>([])
  const [listStats, setListStats] = useState({ total: 0, available: 0, used: 0 })
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  /** 移动端长按行弹出的操作选择菜单：当前选中行（null 表示关闭） */
  const [actionMenuRow, setActionMenuRow] = useState<ActivationCode | null>(null)
  const longPressTimer = useRef<number | null>(null)
  /** 数据刷新令牌：每次成功拉取全量列表自增，驱动表格区「数据刷新过渡」渐入 */
  const [refreshToken, setRefreshToken] = useState(0)

  const [editingRemarkId, setEditingRemarkId] = useState<number | null>(null)
  const [editingRemarkText, setEditingRemarkText] = useState('')

  const [showImportModal, setShowImportModal] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const [importOk, setImportOk] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** 表格容器 ref：数据刷新时通过切换 CSS 类实现「轻量淡入」，避免整体重挂载造成的卡顿 */
  const tableRef = useRef<HTMLDivElement>(null)

  const [showBatchClaimModal, setShowBatchClaimModal] = useState(false)
  const [batchClaimCount, setBatchClaimCount] = useState<number | string>(1)
  const [batchClaiming, setBatchClaiming] = useState(false)
  const [batchClaimDone, setBatchClaimDone] = useState(false)
  const [batchClaimResult, setBatchClaimResult] = useState<BatchClaimResult | null>(null)

  /** 延迟挂载重型表格：等待页面过渡动画完成后再渲染 antd Table，避免与入场动画争抢主线程导致卡顿 */
  const [tableReady, setTableReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      startTransition(() => setTableReady(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  /** 拉取全量激活码（穿透分页），转为本地筛选，确保 激活码/备注/获取人 三字段统一搜索覆盖全部数据 */
  async function loadAllCodes() {
    setLoading(true)
    try {
      const first = await listCodes({ status: '', page: 1, size: FETCH_PAGE_SIZE })
      const pages = Math.min(Math.max(1, first.totalPages || 1), MAX_FETCH_PAGES)
      const collected: ActivationCode[] = [...first.codes]
      // 其余页按批次并行拉取（保持页序），此前逐页串行 await，页数多时加载耗时成倍增加
      for (let start = 2; start <= pages; start += FETCH_CONCURRENCY) {
        const batch: Promise<CodeListResult>[] = []
        for (let p = start; p <= Math.min(pages, start + FETCH_CONCURRENCY - 1); p++) {
          batch.push(listCodes({ status: '', page: p, size: FETCH_PAGE_SIZE }))
        }
        for (const r of await Promise.all(batch)) collected.push(...r.codes)
      }
      startTransition(() => {
        setAllCodes(collected)
        const available = collected.filter((c) => !c.used).length
        setListStats({ total: collected.length, available, used: collected.length - available })
        setRefreshToken((t) => t + 1)
      })
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAllCodes()
  }, [])

  /**
   * 列表加载「丝滑淡入」：不重挂载整张表格（避免 antd Table 列宽重算 / 固定列回流导致的卡顿），
   * 而是在数据刷新时，用 Web Animations API 对常驻的表格容器做轻量 opacity 淡入。
   * 相比此前「移除 class → 强制回流(reflow) → 重加 class」的方案，WAAPI 不再触发同步 reflow，
   * 可避免重型 Table 在页面切换动画期间被强制重排而掉帧。
   * 首次挂载（loading 态、尚无真实数据）跳过，避免与页面入场动画争抢主线程造成卡顿。
   */
  const fadeMountedRef = useRef(false)
  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    // 首帧挂载时表格处于 loading 骨架，尚无真实数据，无需淡入；跳过既可避免冗余动画，
    // 也避免与页面滑动入场争抢主线程。后续真实数据到达 / 筛选 / 翻页时再淡入。
    if (!fadeMountedRef.current) {
      fadeMountedRef.current = true
      return
    }
    // 尊重「减少动效」系统偏好：直接呈现，不做动画
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const anim = el.animate(
      [{ opacity: 0.35 }, { opacity: 1 }],
      { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
    )
    return () => anim.cancel()
  }, [refreshToken])

  /* ===== 筛选器滑动指示器 ===== */
  const filterBarRef = useRef<HTMLDivElement>(null)
  const [filterIndicator, setFilterIndicator] = useState({ x: 0, w: 0, show: false })

  const updateFilterIndicator = useCallback(() => {
    const bar = filterBarRef.current
    if (!bar) return
    const active = bar.querySelector('.filter-chip.active') as HTMLElement | null
    if (active) {
      setFilterIndicator({ x: active.offsetLeft, w: active.offsetWidth, show: true })
    } else {
      setFilterIndicator((p) => (p.show ? { ...p, show: false } : p))
    }
  }, [])

  useEffect(() => {
    updateFilterIndicator()
  }, [updateFilterIndicator, filter])

  useEffect(() => {
    window.addEventListener('resize', updateFilterIndicator)
    return () => window.removeEventListener('resize', updateFilterIndicator)
  }, [updateFilterIndicator])

  /** 统一搜索（实时）：匹配 激活码 / 备注 / 获取人 任一字段即可 */
  function onSearchChange(e: ChangeEvent<HTMLInputElement>) {
    setSearchText(e.target.value)
    setPage(1)
  }

  function onFilterChange(value: string) {
    setFilter(value)
    setSelectedIds([])
    setPage(1)
  }

  /** 是否存在生效中的筛选条件（用于展示「清除筛选」） */
  const hasActiveFilter = filter !== '' || searchText.trim() !== ''

  function clearFilters() {
    setFilter('')
    setSearchText('')
    setPage(1)
  }

  // 多条件组合筛选：状态（全部/未使用/已使用）+ 统一关键词（激活码/备注/获取人），纯前端、实时更新
  const filtered = useMemo(() => {
    const kw = searchText.trim().toLowerCase()
    return allCodes.filter((c) => {
      if (filter === 'used' && !c.used) return false
      if (filter === 'unused' && c.used) return false
      if (kw) {
        const haystack = `${c.code ?? ''} ${c.remark ?? ''} ${c.fetchUser ?? ''}`.toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      return true
    })
  }, [allCodes, filter, searchText])

  // 当前页切片（前端分页）
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const total = filtered.length

  // 筛选结果变少后，若当前页超出范围则自动回落，避免空白页
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [filtered, pageSize, page])

  function confirmMark(id: number) {
    appConfirm({
      title: '使用激活码',
      content: '确定要将此激活码标记为「已使用」吗？',
      okText: '确认使用',
      onOk: async () => {
        try {
          await markUsed(id)
          messageSuccess('已标记为使用')
          await loadAllCodes()
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  function confirmUnmark(id: number) {
    appConfirm({
      title: '恢复为未使用',
      content: '确定要将此激活码恢复为「未使用」吗？',
      okText: '确认恢复',
      onOk: async () => {
        try {
          await markUnused(id)
          messageSuccess('已恢复为未使用')
          await loadAllCodes()
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  function confirmDelete(id: number) {
    appConfirm({
      title: '删除激活码',
      content: '确定要删除此激活码吗？此操作不可恢复。',
      okButtonProps: { danger: true },
      okText: '删除',
      onOk: async () => {
        try {
          await deleteCode(id)
          messageSuccess('删除成功')
          await loadAllCodes()
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  async function batchUse() {
    try {
      await batchUseApi(selectedIds)
      messageSuccess('批量标记成功')
      clearSelection()
      await loadAllCodes()
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    }
  }

  async function batchUnuse() {
    try {
      await batchUnuseApi(selectedIds)
      messageSuccess('批量恢复成功')
      clearSelection()
      await loadAllCodes()
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    }
  }

  function confirmBatchDelete() {
    appConfirm({
      title: '批量删除确认',
      content: (
        <div>
          确定要删除选中的 <strong>{selectedIds.length}</strong> 个激活码吗？此操作不可恢复。
        </div>
      ),
      okButtonProps: { danger: true },
      okText: '删除',
      onOk: async () => {
        try {
          await batchDeleteApi(selectedIds)
          messageSuccess('批量删除成功')
          clearSelection()
          await loadAllCodes()
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  function clearSelection() {
    setSelectedIds([])
  }

  function startEditRemark(row: ActivationCode) {
    setEditingRemarkId(row.id)
    const remark = row.remark
    setEditingRemarkText(remark && remark.toUpperCase() !== 'FALSE' ? remark : '')
  }

  async function saveRemark(id: number) {
    if (editingRemarkId !== id) return
    const text = editingRemarkText
    setEditingRemarkId(null)
    try {
      await updateRemark(id, text)
      messageSuccess('备注已更新')
      await loadAllCodes()
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    }
  }

  function openImportModal() {
    setShowImportModal(true)
    setImportFile(null)
    setImportResult('')
    setImportOk(false)
    setDragOver(false)
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportResult('')
    setImportOk(false)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    if (/\.xlsx?$/i.test(file.name)) {
      setImportFile(file)
      setImportResult('')
      setImportOk(false)
    } else {
      messageWarning('请上传 .xlsx 或 .xls 文件')
    }
  }

  async function doImport() {
    if (!importFile) {
      messageWarning('请先选择文件')
      return
    }
    setImporting(true)
    try {
      await importExcel(importFile)
      setImportResult('导入完成')
      setImportOk(true)
      messageSuccess('导入成功')
      await loadAllCodes()
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      setImportResult(msg)
      setImportOk(false)
      if (!isHandledError(err)) messageError(msg)
    } finally {
      setImporting(false)
    }
  }

  async function exportExcel() {
    try {
      const blob = await exportCodes({ status: filter, keyword: searchText })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `激活码_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      messageSuccess('导出已开始')
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    }
  }

  function openBatchClaimModal() {
    setShowBatchClaimModal(true)
    setBatchClaimCount(1)
    setBatchClaimDone(false)
    setBatchClaimResult(null)
    setBatchClaiming(false)
  }

  async function doBatchClaim() {
    const count = Number(batchClaimCount)
    if (!count || count < 1 || count > 100) {
      messageWarning('数量需在 1-100 之间')
      return
    }
    setBatchClaiming(true)
    try {
      const res = await batchClaim(count)
      setBatchClaimDone(true)
      setBatchClaimResult(res)
      messageSuccess(`成功获取 ${res.count} 个激活码`)
      setListStats({ available: res.available, used: res.used, total: res.total })
    } catch (err: unknown) {
      setBatchClaimDone(true)
      setBatchClaimResult(null)
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setBatchClaiming(false)
    }
  }

  async function copyAllCodes() {
    if (batchClaimResult && batchClaimResult.codes.length) {
      const ok = await copyText(batchClaimResult.codes.join('\n'))
      if (ok) messageSuccess('全部激活码已复制')
      else messageWarning('复制失败，请手动复制')
    }
  }

  /** 点击复制单个激活码，成功/失败均给出轻量提示 */
  async function copyCode(code: string) {
    const ok = await copyText(code)
    if (ok) messageSuccess('激活码已复制')
    else messageWarning('复制失败，请手动复制')
  }

  const columns: ColumnsType<ActivationCode> = [
    {
      title: '#',
      dataIndex: 'id',
      align: 'center',
    },
    {
      title: '激活码',
      dataIndex: 'code',
      // code 为 null：哈希码不落明文，展示中性占位且不带任何复制交互
      render: (value: string | null) =>
        value ? (
          <span
            className="code-chip"
            role="button"
            tabIndex={0}
            title="点击复制"
            onClick={() => void copyCode(value)}
            onMouseDown={(e) => e.preventDefault()}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                void copyCode(value)
              }
            }}
          >
            {value}
          </span>
        ) : (
          <span className="code-chip code-chip--placeholder" title="哈希码不存明文，无法查看或复制">
            哈希码·无明文
          </span>
        ),
    },
    {
      title: '状态',
      align: 'center',
      render: (_: unknown, row: ActivationCode) =>
        row.used ? (
          <Tag color="red" className="status-tag">
            已使用
          </Tag>
        ) : (
          <Tag color="green" className="status-tag">
            未使用
          </Tag>
        ),
    },
    {
      title: '获取人',
      dataIndex: 'fetchUser',
      render: (value: string) => <Text type="secondary">{value || '—'}</Text>,
    },
    {
      title: '备注',
      render: (_: unknown, row: ActivationCode) => {
        const remark = row.remark
        const isEmpty = !remark || remark.toUpperCase() === 'FALSE'
        return editingRemarkId === row.id ? (
          <Input
            size="small"
            value={editingRemarkText}
            onChange={(e) => setEditingRemarkText(e.target.value)}
            onPressEnter={() => void saveRemark(row.id)}
            onBlur={() => void saveRemark(row.id)}
            autoFocus
          />
        ) : (
          <Text
            type="secondary"
            className="remark-text"
            onClick={() => startEditRemark(row)}
            title="点击编辑备注"
          >
            {isEmpty ? '—' : remark}
          </Text>
        )
      },
    },
    {
      title: '创建时间',
      render: (_: unknown, row: ActivationCode) => (
        <Text type="secondary">{formatTime(row.createTime)}</Text>
      ),
    },
    {
      title: '获取时间',
      render: (_: unknown, row: ActivationCode) => (
        <Text type="secondary">{row.fetchTime ? formatTime(row.fetchTime) : '—'}</Text>
      ),
    },
    ...(isMobile
      ? []
      : [
          {
            title: '操作',
            width: 140,
            align: 'center' as const,
            fixed: 'right' as const,
            render: (_: unknown, row: ActivationCode) => {
              const actions = []
              if (!row.used) {
                actions.push(
                  <Button
                    key="use"
                    size="small"
                    type="primary"
                    icon={<AppIcon name="check-circle" size={14} />}
                    onClick={() => confirmMark(row.id)}
                  >
                    使用
                  </Button>,
                )
              } else if (isSuperAdmin) {
                actions.push(
                  <Button
                    key="unmark"
                    size="small"
                    type="default"
                    icon={<AppIcon name="lock" size={14} />}
                    onClick={() => confirmUnmark(row.id)}
                  >
                    恢复
                  </Button>,
                )
              }
              if (isSuperAdmin) {
                actions.push(
                  <Button
                    key="del"
                    size="small"
                    type="text"
                    danger
                    icon={<AppIcon name="x-circle" size={14} />}
                    onClick={() => confirmDelete(row.id)}
                  >
                    删除
                  </Button>,
                )
              }
              if (actions.length === 0) {
                return <Text type="secondary">—</Text>
              }
              return <div className="row-actions">{actions}</div>
            },
          },
        ]),
  ]

  /** 空状态 / 无结果提示 */
  const emptyNode = useMemo(() => {
    if (allCodes.length === 0) {
      return (
        <div className="list-empty">
          <AppIcon name="package" size={48} />
          <p className="list-empty-title">暂无激活码数据</p>
          <p className="list-empty-desc">点击上方「导入激活码」开始添加</p>
        </div>
      )
    }
    if (filtered.length === 0) {
      return (
        <div className="list-empty">
          <AppIcon name="search" size={48} />
          <p className="list-empty-title">未找到匹配的结果</p>
          <p className="list-empty-desc">
            没有符合当前筛选条件的激活码，可调整关键词或
            <Button type="link" size="small" className="list-empty-clear" onClick={clearFilters}>
              清除筛选
            </Button>
          </p>
        </div>
      )
    }
    return undefined
  }, [allCodes.length, filtered.length])

  /* ===== 移动端：长按行弹出操作选择菜单（操作列在移动端不渲染，长按作为唯一触发入口） ===== */
  function startLongPress(row: ActivationCode) {
    cancelLongPress()
    longPressTimer.current = window.setTimeout(() => {
      navigator.vibrate?.(15)
      setActionMenuRow(row)
    }, 500)
  }

  function cancelLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function runRowAction(kind: 'use' | 'unmark' | 'delete', row: ActivationCode) {
    // 先关闭操作菜单，待其离场清理（afterClose 释放滚动锁定）后再唤起确认弹窗，
    // 避免两个弹窗的滚动锁定相互覆盖导致背景仍可滚动
    setActionMenuRow(null)
    window.setTimeout(() => {
      if (kind === 'use') confirmMark(row.id)
      else if (kind === 'unmark') confirmUnmark(row.id)
      else confirmDelete(row.id)
    }, 320)
  }

  return (
    <div className="list-view">
      <div className="page-header-block">
        <div>
          <h2 className="page-title">激活码查询</h2>
          <p className="page-subtitle">激活码列表与状态管理</p>
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <AnimatedNumber value={listStats.total} className="header-stat-value" />
            <span className="header-stat-label">总数</span>
          </div>
          <div className="header-stat">
            <AnimatedNumber value={listStats.available} className="header-stat-value text-success" />
            <span className="header-stat-label">可用</span>
          </div>
          <div className="header-stat">
            <AnimatedNumber value={listStats.used} className="header-stat-value text-danger" />
            <span className="header-stat-label">已用</span>
          </div>
        </div>
      </div>

      <div className="action-cards-grid">
        <Card
          className="action-card action-card-import"
          styles={{ body: { padding: 18 } }}
          variant="outlined"
          role="button"
          tabIndex={0}
          aria-label="导入激活码"
          onClick={openImportModal}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openImportModal()
            }
          }}
        >
          <div className="action-card-inner">
            <span className="action-icon action-icon--brand">
              <AppIcon name="import" size={24} />
            </span>
            <div className="action-text">
              <div className="action-title">导入激活码</div>
              <div className="action-desc">文件批量导入</div>
            </div>
            <span className="action-arrow">
              <AppIcon name="arrow-right" size={18} />
            </span>
          </div>
        </Card>
        <Card
          className="action-card"
          styles={{ body: { padding: 18 } }}
          variant="outlined"
          role="button"
          tabIndex={0}
          aria-label="导出列表"
          onClick={() => void exportExcel()}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              void exportExcel()
            }
          }}
        >
          <div className="action-card-inner">
            <span className="action-icon action-icon--brand">
              <AppIcon name="export" size={24} />
            </span>
            <div className="action-text">
              <div className="action-title">导出列表</div>
              <div className="action-desc">导出当前列表为表格</div>
            </div>
            <span className="action-arrow">
              <AppIcon name="arrow-right" size={18} />
            </span>
          </div>
        </Card>
        <Card
          className="action-card"
          styles={{ body: { padding: 18 } }}
          variant="outlined"
          role="button"
          tabIndex={0}
          aria-label="批量使用"
          onClick={openBatchClaimModal}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openBatchClaimModal()
            }
          }}
        >
          <div className="action-card-inner">
            <span className="action-icon action-icon--brand">
              <AppIcon name="gift" size={24} />
            </span>
            <div className="action-text">
              <div className="action-title">批量使用</div>
              <div className="action-desc">一次获取多个激活码</div>
            </div>
            <span className="action-arrow">
              <AppIcon name="arrow-right" size={18} />
            </span>
          </div>
        </Card>
      </div>

      <Card className="table-card" styles={{ body: { padding: 20 } }} variant="outlined">
        <div className="list-toolbar">
          <div className="toolbar-left">
            <div className="filter-glass-bar" ref={filterBarRef}>
              <div
                className="filter-glass-indicator"
                style={{
                  transform: `translateX(${filterIndicator.x}px)`,
                  width: `${filterIndicator.w}px`,
                  opacity: filterIndicator.show ? '1' : '0',
                }}
              />
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`filter-chip${filter === opt.value ? ' active' : ''}`}
                  onClick={() => onFilterChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Input
              value={searchText}
              onChange={onSearchChange}
              placeholder="搜索激活码 / 备注 / 获取人"
              allowClear
              className="toolbar-search"
              prefix={<AppIcon name="search" size={16} />}
            />
            {hasActiveFilter && (
              <Button
                size="middle"
                type="text"
                className="toolbar-clear"
                icon={<AppIcon name="x-circle" size={16} />}
                onClick={clearFilters}
              >
                清除筛选
              </Button>
            )}
          </div>
          <div className="toolbar-right">
            {selectedIds.length >= 2 && (
              <Space size={8} wrap>
                <Tag color="blue" className="selected-tag">
                  已选 {selectedIds.length} 项
                </Tag>
                <Button
                  size="small"
                  type="primary"
                  icon={<AppIcon name="check-circle" size={14} />}
                  onClick={() => void batchUse()}
                >
                  批量使用
                </Button>
                <Button
                  size="small"
                  type="default"
                  icon={<AppIcon name="lock" size={14} />}
                  onClick={() => void batchUnuse()}
                >
                  批量恢复
                </Button>
                <Button
                  size="small"
                  type="default"
                  danger
                  icon={<AppIcon name="x-circle" size={14} />}
                  onClick={confirmBatchDelete}
                >
                  批量删除
                </Button>
              </Space>
            )}
          </div>
        </div>

        <div className="table-scroll" ref={tableRef}>
          {tableReady ? (
            <Table<ActivationCode>
              rowKey="id"
              columns={columns}
              dataSource={paged}
              loading={loading}
              bordered
              tableLayout="auto"
              scroll={{ x: 'max-content' }}
              pagination={false}
              locale={{ emptyText: emptyNode }}
              onRow={(record) => ({
                onTouchStart: () => {
                  if (isMobile) startLongPress(record)
                },
                onTouchMove: () => cancelLongPress(),
                onTouchEnd: () => cancelLongPress(),
                onContextMenu: (e) => {
                  if (isMobile) e.preventDefault()
                },
              })}
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys as number[]),
              }}
            />
          ) : (
            <div className="table-placeholder-loading">
              <div className="ant-table-placeholder">
                <span className="ant-empty-text">加载中...</span>
              </div>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="table-pagination">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              size="small"
              showSizeChanger
              showQuickJumper
              pageSizeOptions={[10, 20, 50, 100]}
              showTotal={(t) => `共 ${t} 条`}
              onChange={(p, s) => {
                setPageSize(s)
                setPage(s !== pageSize ? 1 : p)
              }}
            />
          </div>
        )}
      </Card>

      {/* 导入弹窗 */}
      <Modal
        open={showImportModal}
        onCancel={() => setShowImportModal(false)}
        title="文件导入"
        footer={null}
        width={440}
        closable
        maskClosable={false}
        destroyOnClose
        afterClose={releaseModalOverlay}
      >
        <div
          className={`drop-zone${dragOver ? ' drag-over' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="drop-zone-icon">
            <AppIcon name="file" size={40} />
          </div>
          <div className="drop-zone-text">
            <span>点击选择</span> 或拖拽文件到此处
          </div>
          <div className="drop-zone-hint">支持 .xlsx 格式，第二列作为备注</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>
        {importFile && (
          <div className="import-file-tag">
            <Tag color="blue">{importFile.name}</Tag>
          </div>
        )}
        {importResult && (
          <Alert
            type={importOk ? 'success' : 'error'}
            showIcon
            className="import-result"
            message={importResult}
          />
        )}
        <div className="modal-footer">
          <Button onClick={() => setShowImportModal(false)}>关闭</Button>
          <Button
            type="primary"
            loading={importing}
            disabled={!importFile}
            onClick={() => void doImport()}
          >
            {importing ? '导入中...' : '开始导入'}
          </Button>
        </div>
      </Modal>

      {/* 批量获取弹窗 */}
      <Modal
        open={showBatchClaimModal}
        onCancel={() => setShowBatchClaimModal(false)}
        title="批量获取激活码"
        footer={null}
        width={440}
        closable
        maskClosable={false}
        destroyOnClose
        afterClose={releaseModalOverlay}
      >
        {!batchClaimDone ? (
          <div>
            <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
              输入要获取的数量（1-100）：
            </Text>
            <InputNumber
              value={batchClaimCount}
              onChange={(v) => setBatchClaimCount(v ?? 1)}
              min={1}
              max={100}
              size="large"
              style={{ width: '100%' }}
            />
          </div>
        ) : batchClaimResult ? (
          <div>
            <Alert
              type="success"
              showIcon
              className="batch-alert"
              message={`成功获取 ${batchClaimResult.count} 个激活码`}
            />
            <div className="batch-result-box">
              {batchClaimResult.codes.map((c, i) => (
                <div
                  key={i}
                  className="batch-result-item"
                  role="button"
                  tabIndex={0}
                  title="点击复制"
                  onClick={() => void copyCode(c)}
                  onMouseDown={(e) => e.preventDefault()}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void copyCode(c)
                    }
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
            <Button block className="batch-copy" onClick={() => void copyAllCodes()}>
              复制全部
            </Button>
          </div>
        ) : (
          <Alert type="error" showIcon message="获取失败，请稍后重试" />
        )}
        <div className="modal-footer">
          <Button onClick={() => setShowBatchClaimModal(false)}>关闭</Button>
          {!batchClaimDone ? (
            <Button type="primary" loading={batchClaiming} onClick={() => void doBatchClaim()}>
              确认获取
            </Button>
          ) : (
            <Button type="primary" onClick={openBatchClaimModal}>
              再次获取
            </Button>
          )}
        </div>
      </Modal>

      {/* 移动端：长按行弹出的操作选择菜单（操作列在移动端不渲染，长按作为唯一触发入口） */}
      <Modal
        open={!!actionMenuRow}
        onCancel={() => setActionMenuRow(null)}
        title="选择操作"
        footer={null}
        width={360}
        className="row-action-sheet"
        transitionName=""
        destroyOnClose
        afterClose={releaseModalOverlay}
        maskClosable
        closable
      >
        {actionMenuRow && (
          <div className="action-sheet-list">
            {!actionMenuRow.used && (
              <button
                type="button"
                className="action-sheet-item"
                onClick={() => runRowAction('use', actionMenuRow)}
              >
                <AppIcon name="check-circle" size={18} />
                <span>使用</span>
              </button>
            )}
            {actionMenuRow.used && isSuperAdmin && (
              <button
                type="button"
                className="action-sheet-item"
                onClick={() => runRowAction('unmark', actionMenuRow)}
              >
                <AppIcon name="lock" size={18} />
                <span>恢复</span>
              </button>
            )}
            {isSuperAdmin && (
              <button
                type="button"
                className="action-sheet-item danger"
                onClick={() => runRowAction('delete', actionMenuRow)}
              >
                <AppIcon name="x-circle" size={18} />
                <span>删除</span>
              </button>
            )}
            <button
              type="button"
              className="action-sheet-item cancel"
              onClick={() => setActionMenuRow(null)}
            >
              <span>取消</span>
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
