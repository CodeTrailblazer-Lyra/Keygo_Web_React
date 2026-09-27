import { useCallback, useEffect, useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { Button, Card, Pagination, Table, Typography } from 'antd'
import { myCodes } from '@/api/codes'
import { copyText, formatTime } from '@/utils'
import { getErrorMessage, isHandledError } from '@/api/request'
import { messageError, messageSuccess, messageWarning } from '@/utils/messageBridge'
import { FadeIn } from '@/components/FadeIn'
import type { ActivationCode } from '@/types'
import './MyCodesView.css'

const { Text } = Typography

export default function MyCodesView() {
  const [list, setList] = useState<ActivationCode[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const loadMyCodes = useCallback(async (p: number, size: number) => {
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
  }, [])

  useEffect(() => {
    void loadMyCodes(1, 20)
  }, [loadMyCodes])

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
      render: (_: unknown, __: ActivationCode, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: '激活码',
      dataIndex: 'code',
      render: (value: string | null) =>
        value ? (
          <span className="code-chip">{value}</span>
        ) : (
          <span className="code-chip code-chip--placeholder">哈希码·无明文</span>
        ),
    },
    {
      title: '获取时间',
      width: 180,
      render: (_: unknown, row: ActivationCode) => (
        <Text type="secondary">{row.fetchTime ? formatTime(row.fetchTime) : '—'}</Text>
      ),
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, row: ActivationCode) => (
        <Button size="small" type="default" disabled={!row.code} onClick={() => void copyCode(row.code!)}>
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

      <FadeIn animateOnMount={false}>
        <Card className="table-card" styles={{ body: { padding: 24 } }} variant="outlined">
          <Table<ActivationCode>
            rowKey="id"
            columns={columns}
            className="my-codes-table"
            dataSource={list}
            loading={loading}
            bordered
            scroll={{ x: 600 }}
            pagination={false}
          />
          {totalPages > 1 && (
            <div className="my-codes-pagination">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(p) => void loadMyCodes(p, pageSize)}
                size="small"
              />
            </div>
          )}
        </Card>
      </FadeIn>
    </div>
  )
}
