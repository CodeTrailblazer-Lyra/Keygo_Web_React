import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import type { ActivationCode, BatchClaimResult } from '@/types'
import './ListView.css'

const { Text } = Typography

const filterOptions = [
  { label: '全部', value: '' },
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
]

export default function ListView() {
  const isSuperAdmin = useAuthStore(selectIsSuperAdmin)

  const [filter, setFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [codes, setCodes] = useState<ActivationCode[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [listStats, setListStats] = useState({ total: 0, available: 0, used: 0 })

  const [editingRemarkId, setEditingRemarkId] = useState<number | null>(null)
  const [editingRemarkText, setEditingRemarkText] = useState('')

  const [showImportModal, setShowImportModal] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const [importOk, setImportOk] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showBatchClaimModal, setShowBatchClaimModal] = useState(false)
  const [batchClaimCount, setBatchClaimCount] = useState<number | string>(1)
  const [batchClaiming, setBatchClaiming] = useState(false)
  const [batchClaimDone, setBatchClaimDone] = useState(false)
  const [batchClaimResult, setBatchClaimResult] = useState<BatchClaimResult | null>(null)

  async function loadCodes(
    status: string,
    p: number,
    kw: string = keyword,
    size: number = pageSize,
  ) {
    setLoading(true)
    try {
      const data = await listCodes({ status, keyword: kw, page: p, size })
      setCodes(data.codes)
      setListStats({ total: data.total, available: data.available, used: data.used })
      setPage(p)
      setPageSize(size)
      setTotal(data.totalElements)
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCodes('', 1)
  }, [])

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 卸载时清理防抖定时器，避免内存泄漏与卸载后发起多余请求
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [])

  function onKeywordChange(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setKeyword(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      void loadCodes(filter, 1, v)
    }, 400)
  }

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

  useLayoutEffect(() => {
    updateFilterIndicator()
  }, [updateFilterIndicator, filter])

  useEffect(() => {
    window.addEventListener('resize', updateFilterIndicator)
    return () => window.removeEventListener('resize', updateFilterIndicator)
  }, [updateFilterIndicator])

  function onFilterChange(value: string) {
    setFilter(value)
    setSelectedIds([])
    void loadCodes(value, 1)
  }

  function clearSelection() {
    setSelectedIds([])
  }

  function confirmMark(id: number) {
    appConfirm({
      title: '使用激活码',
      content: '确定要将此激活码标记为「已使用」吗？',
      okText: '确认使用',
      onOk: async () => {
        try {
          await markUsed(id)
          messageSuccess('已标记为使用')
          await loadCodes(filter, page)
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
          await loadCodes(filter, page)
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
          await loadCodes(filter, page)
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
      await loadCodes(filter, page)
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    }
  }

  async function batchUnuse() {
    try {
      await batchUnuseApi(selectedIds)
      messageSuccess('批量恢复成功')
      clearSelection()
      await loadCodes(filter, page)
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
          await loadCodes(filter, page)
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  function startEditRemark(row: ActivationCode) {
    setEditingRemarkId(row.id)
    setEditingRemarkText(row.remark || '')
  }

  async function saveRemark(id: number) {
    if (editingRemarkId !== id) return
    const text = editingRemarkText
    setEditingRemarkId(null)
    try {
      await updateRemark(id, text)
      messageSuccess('备注已更新')
      await loadCodes(filter, page)
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
      await loadCodes(filter, 1)
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
      const blob = await exportCodes({ status: filter, keyword })
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
      render: (value: string) => (
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
      render: (_: unknown, row: ActivationCode) =>
        editingRemarkId === row.id ? (
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
            {row.remark || '—'}
          </Text>
        ),
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
    {
      title: '操作',
      width: 132,
      align: 'center',
      fixed: 'right',
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
  ]

  return (
    <div className="list-view">
      <div className="page-header-block">
        <div>
          <h2 className="page-title">激活码查询</h2>
          <p className="page-subtitle">激活码列表与状态管理</p>
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <span className="header-stat-value">{listStats.total}</span>
            <span className="header-stat-label">总数</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-value text-success">{listStats.available}</span>
            <span className="header-stat-label">可用</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-value text-danger">{listStats.used}</span>
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
              <div className="action-desc">Excel 批量导入</div>
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
              <div className="action-desc">导出当前列表为 Excel</div>
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
              value={keyword}
              onChange={onKeywordChange}
              placeholder="搜索激活码 / 备注 / 获取人"
              allowClear
              className="toolbar-search"
              prefix={<AppIcon name="search" size={16} />}
            />
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

        <div className="table-scroll">
          <Table<ActivationCode>
            rowKey="id"
            columns={columns}
            dataSource={codes}
            loading={loading}
            bordered
            tableLayout="auto"
            scroll={{ x: 'max-content' }}
            pagination={false}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedIds,
              onChange: (keys) => setSelectedIds(keys as number[]),
            }}
          />
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
              onChange={(p, s) => void loadCodes(filter, s !== pageSize ? 1 : p, keyword, s)}
            />
          </div>
        )}
      </Card>

      {/* 导入弹窗 */}
      <Modal
        open={showImportModal}
        onCancel={() => setShowImportModal(false)}
        title="Excel 导入"
        footer={null}
        width={440}
        closable
        maskClosable={false}
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
    </div>
  )
}
