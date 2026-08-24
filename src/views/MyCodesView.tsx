import { useEffect, useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { Button, Card, Pagination, Table, Typography } from 'antd'
import { myCodes } from '@/api/codes'
import { copyText, formatTime } from '@/utils'
import { getErrorMessage, isHandledError } from '@/api/request'
import { messageError, messageSuccess, messageWarning } from '@/utils/messageBridge'
import type { ActivationCode } from '@/types'

const { Text } = Typography

export default function MyCodesView() {
  const [list, setList] = useState<ActivationCode[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  async function loadMyCodes(p: number, size: number = pageSize) {
    setLoading(true)
    try {
      const data = await myCodes(p, size)
      setList(data.codes)
      setPage(p)
      setPageSize(size)
      setTotal(data.total)
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMyCodes(1)
  }, [])

  async function copyCode(code: string) {
    const ok = await copyText(code)
    if (ok) messageSuccess('已复制到剪贴板')
    else messageWarning('复制失败，请手动复制')
  }

  const columns: ColumnsType<ActivationCode> = [
    {
      title: '#',
      width: 64,
      align: 'center',
      // 跨页连续序号：第 2 页从上一页结束编号继续（如每页 20 条，则第 2 页从 21 开始）
      render: (_: unknown, __: ActivationCode, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: '激活码',
      dataIndex: 'code',
      render: (value: string) => <span className="code-chip">{value}</span>,
    },
    {
      title: '获取时间',
      width: 180,
      render: (_: unknown, row: ActivationCode) => <Text type="secondary">{formatTime(row.fetchTime)}</Text>,
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, row: ActivationCode) => (
        <Button size="small" type="default" onClick={() => void copyCode(row.code)}>
          复制
        </Button>
      ),
    },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div className="page-header-block">
        <h2 className="page-title">我的获取记录</h2>
        <p className="page-subtitle">查看您获取过的激活码</p>
      </div>

      <Card className="table-card" styles={{ body: { padding: 24 } }} variant="outlined">
        <Table<ActivationCode>
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          bordered
          scroll={{ x: 600 }}
          pagination={false}
        />
        {totalPages > 1 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={(p) => void loadMyCodes(p)}
              size="small"
            />
          </div>
        )}
      </Card>
    </div>
  )
}
