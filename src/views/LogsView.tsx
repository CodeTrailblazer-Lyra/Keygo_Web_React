import { useCallback, useEffect, useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { Card, Pagination, Table, Tag, Typography } from 'antd'
import { logs } from '@/api/logs'
import { actionLabel, actionTagColor, formatTime } from '@/utils'
import { getErrorMessage, isHandledError } from '@/api/request'
import { messageError } from '@/utils/messageBridge'
import { FadeIn } from '@/components/FadeIn'
import type { OperationLog } from '@/types'
import './LogsView.css'

const { Text } = Typography

export default function LogsView() {
  const [list, setList] = useState<OperationLog[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [total, setTotal] = useState(0)

  const loadLogs = useCallback(async (p: number, s: number) => {
    setLoading(true)
    try {
      const data = await logs(p, s)
      setList(data.logs)
      setPage(p)
      setSize(s)
      setTotal(data.totalElements)
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLogs(1, 20)
  }, [loadLogs])

  const totalPages = Math.max(1, Math.ceil(total / size))

  const columns: ColumnsType<OperationLog> = [
    { title: '#', width: 70, dataIndex: 'id' },
    {
      title: '操作人',
      width: 130,
      render: (_: unknown, row: OperationLog) => <Text strong>{row.username}</Text>,
    },
    {
      title: '操作',
      width: 140,
      render: (_: unknown, row: OperationLog) => (
        <Tag color={actionTagColor(row.action)}>{actionLabel(row.action)}</Tag>
      ),
    },
    {
      title: '对象',
      render: (_: unknown, row: OperationLog) =>
        row.target ? <span className="code-chip">{row.target}</span> : <Text type="secondary">—</Text>,
    },
    {
      title: '详情',
      render: (_: unknown, row: OperationLog) => <Text type="secondary">{row.detail || '—'}</Text>,
    },
    {
      title: '时间',
      width: 170,
      render: (_: unknown, row: OperationLog) => <Text type="secondary">{formatTime(row.createTime)}</Text>,
    },
  ]

  return (
    <div>
      <div className="page-header-block">
        <h2 className="page-title">操作日志</h2>
        <p className="page-subtitle">系统操作审计记录</p>
      </div>

      <FadeIn animateOnMount={false}>
        <Card className="table-card" styles={{ body: { padding: 24 } }} variant="outlined">
          <Table<OperationLog>
            rowKey="id"
            columns={columns}
            className="logs-table"
            dataSource={list}
            loading={loading}
            bordered
            scroll={{ x: 1000 }}
            pagination={false}
          />
          {totalPages > 1 && (
            <div className="logs-pagination">
              <Pagination
                current={page}
                pageSize={size}
                total={total}
                onChange={(p) => void loadLogs(p, size)}
                size="small"
              />
            </div>
          )}
        </Card>
      </FadeIn>
    </div>
  )
}
