import { useEffect, useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { AnimatePresence, motion } from 'motion/react'
import {
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { selectIsAdmin, selectIsSuperAdmin, selectUsername, useAuthStore } from '@/stores/auth'
import {
  allUsers as allUsersApi,
  approveUser as approveUserApi,
  changeRole as changeRoleApi,
  deleteUser as deleteUserApi,
  type PendingUser,
  pendingUsers as pendingUsersApi,
  rejectUser as rejectUserApi,
} from '@/api/users'
import {
  addUnit as addUnitApi,
  deleteUnit as deleteUnitApi,
  importUnits as importUnitsApi,
  listUnits as listUnitsApi,
} from '@/api/units'
import {
  deleteAnnouncement as deleteAnnouncementApi,
  publishAnnouncement as publishAnnouncementApi,
  updateAnnouncementVisible,
  announcements as listAnnouncementsApi,
} from '@/api/logs'
import { formatTime, roleLabel, roleTagColor } from '@/utils'
import { usePasswordModal } from '@/composables/usePasswordModal'
import type { Announcement, SysUser, UsageUnit } from '@/types'
import { getErrorMessage, isHandledError } from '@/api/request'
import { messageError, messageSuccess } from '@/utils/messageBridge'
import { appConfirm } from '@/utils/antdAppBridge'
import AppIcon from '@/components/AppIcon'
import { FadeIn } from '@/components/FadeIn'
import { durations, easings } from '@/anim/motion'
import './AdminView.css'

const { Text } = Typography

const roleOptions = [
  { label: '普通用户', value: 'ROLE_USER' },
  { label: '管理员', value: 'ROLE_ADMIN' },
  { label: '超级管理员', value: 'ROLE_SUPER_ADMIN' },
]

export default function AdminView() {
  const isAdmin = useAuthStore(selectIsAdmin)
  const isSuperAdmin = useAuthStore(selectIsSuperAdmin)
  const currentUsername = useAuthStore(selectUsername)
  const openPasswordModal = usePasswordModal((s) => s.open)

  const [pendingList, setPendingList] = useState<PendingUser[]>([])
  const [allUsersList, setAllUsersList] = useState<SysUser[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)

  const [roleTarget, setRoleTarget] = useState<SysUser | null>(null)
  const [roleValue, setRoleValue] = useState('')
  const [roleSubmitting, setRoleSubmitting] = useState(false)

  const [showAnnounceModal, setShowAnnounceModal] = useState(false)
  const [announceContent, setAnnounceContent] = useState('')
  const [announcePinned, setAnnouncePinned] = useState(false)
  const [announceVisible, setAnnounceVisible] = useState(true)
  const [announcePublishing, setAnnouncePublishing] = useState(false)

  // 公告管理列表（含删除 / 是否显示开关）
  const [announceList, setAnnounceList] = useState<Announcement[]>([])
  const [announceLoading, setAnnounceLoading] = useState(false)
  /** 当前展开的公告 id（列表项展开/收起动画用） */
  const [expandedAnnounceId, setExpandedAnnounceId] = useState<number | null>(null)

  // 使用单位（获取页下拉数据源）
  const [unitsList, setUnitsList] = useState<UsageUnit[]>([])
  const [unitsLoading, setUnitsLoading] = useState(false)
  const [newUnitName, setNewUnitName] = useState('')
  const [addingUnit, setAddingUnit] = useState(false)
  const [importingUnits, setImportingUnits] = useState(false)
  // 使用单位表格分页（受控：每页条数可切换 10/20/50/100 并正确生效）
  const [unitPage, setUnitPage] = useState(1)
  const [unitPageSize, setUnitPageSize] = useState(10)

  async function loadPending() {
    setPendingLoading(true)
    try {
      setPendingList(await pendingUsersApi())
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setPendingLoading(false)
    }
  }

  async function loadAllUsers() {
    setUsersLoading(true)
    try {
      setAllUsersList(await allUsersApi())
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setUsersLoading(false)
    }
  }

  async function loadUnits() {
    setUnitsLoading(true)
    try {
      setUnitsList(await listUnitsApi())
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setUnitsLoading(false)
    }
  }

  /** 公告管理列表 */
  async function loadAnnouncements() {
    setAnnounceLoading(true)
    try {
      setAnnounceList(await listAnnouncementsApi())
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setAnnounceLoading(false)
    }
  }

  useEffect(() => {
    void loadPending()
    void loadAllUsers()
    void loadUnits()
    void loadAnnouncements()
  }, [])

  function doApprove(id: number) {
    appConfirm({
      title: '审核通过',
      content: '确定要通过该用户的注册申请吗？',
      onOk: async () => {
        try {
          await approveUserApi(id)
          messageSuccess('已通过审核')
          await Promise.all([loadPending(), loadAllUsers()])
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  function doReject(id: number) {
    appConfirm({
      title: '拒绝注册',
      content: '确定要拒绝该用户的注册申请吗？',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await rejectUserApi(id)
          messageSuccess('已拒绝')
          await loadPending()
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  function openRoleModal(u: SysUser) {
    setRoleTarget(u)
    setRoleValue(u.role)
  }

  async function submitRoleChange() {
    if (!roleTarget) return
    if (roleValue === roleTarget.role) {
      setRoleTarget(null)
      return
    }
    setRoleSubmitting(true)
    try {
      await changeRoleApi(roleTarget.id, roleValue)
      messageSuccess(`角色已更新为「${roleLabel(roleValue)}」`)
      setRoleTarget(null)
      await loadAllUsers()
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setRoleSubmitting(false)
    }
  }

  function confirmDeleteUser(u: SysUser) {
    appConfirm({
      title: '删除用户确认',
      content: (
        <div>
          确定要删除用户 <strong>{u.username}</strong> 吗？此操作不可恢复。
        </div>
      ),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteUserApi(u.id)
          messageSuccess('用户已删除')
          await Promise.all([loadPending(), loadAllUsers()])
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  function openAnnounceModal() {
    setAnnounceContent('')
    setAnnouncePinned(false)
    setAnnounceVisible(true)
    setShowAnnounceModal(true)
  }

  async function publishAnnouncement() {
    if (!announceContent.trim()) {
      messageError('请输入公告内容')
      return
    }
    setAnnouncePublishing(true)
    try {
      await publishAnnouncementApi(announceContent, announcePinned, announceVisible)
      messageSuccess('公告已发布')
      setShowAnnounceModal(false)
      setAnnounceContent('')
      setAnnouncePinned(false)
      setAnnounceVisible(true)
      await loadAnnouncements()
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setAnnouncePublishing(false)
    }
  }

  /* ===== 系统公告管理 ===== */

  /** 切换公告展示状态（乐观更新，失败回滚） */
  async function toggleAnnouncementVisible(item: Announcement, visible: boolean) {
    const prev = announceList
    setAnnounceList((list) => list.map((a) => (a.id === item.id ? { ...a, visible } : a)))
    try {
      await updateAnnouncementVisible(item.id, visible)
      messageSuccess(visible ? '公告已设为展示' : '公告已隐藏')
    } catch (err) {
      setAnnounceList(prev)
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    }
  }

  function confirmDeleteAnnouncement(item: Announcement) {
    appConfirm({
      title: '删除公告',
      content: '确定要删除这条公告吗？删除后获取页将不再显示。',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteAnnouncementApi(item.id)
          messageSuccess('公告已删除')
          await loadAnnouncements()
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  /* ===== 使用单位 ===== */

  /** 手动添加使用单位 */
  async function doAddUnit() {
    const name = newUnitName.trim()
    if (!name) {
      messageError('请输入单位名称')
      return
    }
    setAddingUnit(true)
    try {
      await addUnitApi(name)
      messageSuccess(`已添加单位「${name}」`)
      setNewUnitName('')
      await loadUnits()
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setAddingUnit(false)
    }
  }

  /** 文件批量导入使用单位（.txt/.csv 每行一个；.xlsx 取第一列） */
  async function doImportUnits(file: File) {
    setImportingUnits(true)
    try {
      const result = await importUnitsApi(file)
      messageSuccess(`导入完成，共导入 ${result.imported} 个使用单位`)
      await loadUnits()
    } catch (err) {
      if (!isHandledError(err)) messageError(getErrorMessage(err))
    } finally {
      setImportingUnits(false)
    }
  }

  function confirmDeleteUnit(u: UsageUnit) {
    appConfirm({
      title: '删除使用单位',
      content: `确定要删除单位「${u.name}」吗？删除后获取页下拉将不再显示该单位，已写入激活码备注的历史记录不受影响。`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteUnitApi(u.id)
          messageSuccess('单位已删除')
          await loadUnits()
        } catch (err) {
          if (!isHandledError(err)) messageError(getErrorMessage(err))
        }
      },
    })
  }

  const pendingColumns: ColumnsType<PendingUser> = [
    {
      title: '用户名',
      render: (_: unknown, row: PendingUser) => <Text strong>{row.username}</Text>,
    },
    {
      title: '注册时间',
      width: 180,
      render: (_: unknown, row: PendingUser) => <Text type="secondary">{formatTime(row.createTime)}</Text>,
    },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, row: PendingUser) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={() => doApprove(row.id)}>
            通过
          </Button>
          <Button size="small" type="default" danger onClick={() => doReject(row.id)}>
            拒绝
          </Button>
        </div>
      ),
    },
  ]

  const userColumns: ColumnsType<SysUser> = [
    { title: '#', width: 60, dataIndex: 'id' },
    {
      title: '用户名',
      render: (_: unknown, row: SysUser) => <Text strong>{row.username}</Text>,
    },
    {
      title: '角色',
      width: 160,
      render: (_: unknown, row: SysUser) => <Tag color={roleTagColor(row.role)}>{roleLabel(row.role)}</Tag>,
    },
    {
      title: '状态',
      width: 110,
      render: (_: unknown, row: SysUser) =>
        row.approved ? <Tag color="green">已审核</Tag> : <Tag color="gold">待审</Tag>,
    },
    {
      title: '注册时间',
      width: 180,
      render: (_: unknown, row: SysUser) => <Text type="secondary">{formatTime(row.createTime)}</Text>,
    },
    {
      title: '操作',
      width: 300,
      render: (_: unknown, row: SysUser) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && (
            <Button size="small" type="default" onClick={() => openPasswordModal(row)}>
              改密
            </Button>
          )}
          {isSuperAdmin && (
            <Button
              size="small"
              type="default"
              disabled={row.username === currentUsername || row.role === 'ROLE_SUPER_ADMIN'}
              onClick={() => openRoleModal(row)}
            >
              改角色
            </Button>
          )}
          {isSuperAdmin && row.username !== currentUsername ? (
            <Button
              size="small"
              type="default"
              danger
              onClick={() => confirmDeleteUser(row)}
            >
              删除
            </Button>
          ) : isSuperAdmin ? (
            <span style={{ display: 'inline-block', width: 56 }} />
          ) : null}
        </div>
      ),
    },
  ]

  const unitColumns: ColumnsType<UsageUnit> = [
    { title: '#', width: 60, dataIndex: 'id' },
    {
      title: '单位名称',
      render: (_: unknown, row: UsageUnit) => <Text strong>{row.name}</Text>,
    },
    {
      title: '创建时间',
      width: 180,
      render: (_: unknown, row: UsageUnit) => <Text type="secondary">{formatTime(row.createTime)}</Text>,
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, row: UsageUnit) => (
        <Button size="small" type="default" danger onClick={() => confirmDeleteUnit(row)}>
          删除
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header-block">
        <h2 className="page-title">系统管理</h2>
        <p className="page-subtitle">用户审核、角色管理、使用单位与系统公告</p>
      </div>

      {pendingList.length > 0 && (
        <FadeIn delay={0.02} animateOnMount={false}>
        <Card
          className="table-card"
          styles={{ body: { padding: 24 } }}
          variant="outlined"
          style={{ marginBottom: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Tag color="red">{pendingList.length}</Tag>
            <Text strong className="card-title">
              待审核用户
            </Text>
          </div>
          <Table<PendingUser>
            rowKey="id"
            columns={pendingColumns}
            dataSource={pendingList}
            loading={pendingLoading}
            bordered
            scroll={{ x: 560 }}
            pagination={false}
          />
        </Card>
        </FadeIn>
      )}

      <FadeIn delay={0.04} animateOnMount={false}>
      <Card className="table-card" styles={{ body: { padding: 24 } }} variant="outlined">
        <div style={{ marginBottom: 12 }}>
          <Text strong className="card-title">
            用户管理
          </Text>
        </div>
        <Table<SysUser>
          rowKey="id"
          columns={userColumns}
          dataSource={allUsersList}
          loading={usersLoading}
          bordered
          scroll={{ x: 1000 }}
          pagination={false}
        />
        </Card>
      </FadeIn>

      {/* 瀑布流区：使用单位 + 系统公告（宽屏两列按内容高度排布，窄屏单列堆叠） */}
      {/* 每张卡片各自作为整体渐入（错峰延迟），而非内部列表逐项触发动画 */}
      <div className="admin-masonry">
        <FadeIn delay={0.06} animateOnMount={false}>
        {/* 使用单位：手动添加 + 文件批量导入，供获取页下拉读取 */}
        <Card className="table-card" styles={{ body: { padding: 24 } }} variant="outlined">
          <div className="units-header">
            <Text strong className="card-title">
              使用单位
            </Text>
            <div className="units-actions">
              <Input
                className="units-add-input"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                onPressEnter={() => void doAddUnit()}
                placeholder="输入单位名称，回车或点击添加"
                maxLength={100}
                disabled={addingUnit}
              />
              <Button
                type="primary"
                loading={addingUnit}
                disabled={!newUnitName.trim()}
                onClick={() => void doAddUnit()}
              >
                添加
              </Button>
              <Upload
                accept=".txt,.csv,.xlsx"
                showUploadList={false}
                disabled={importingUnits}
                beforeUpload={(file) => {
                  void doImportUnits(file)
                  return false
                }}
              >
                <Button icon={<AppIcon name="upload" size={14} />} loading={importingUnits}>
                  批量导入
                </Button>
              </Upload>
            </div>
          </div>
          <Text type="secondary" className="units-hint">
            维护「获取激活码」页面可选的使用单位；申领时选中单位将写入该激活码的备注字段。
            批量导入支持 .txt / .csv（每行一个单位）/ .xlsx（第一列）。
          </Text>
          <Table<UsageUnit>
            rowKey="id"
            columns={unitColumns}
            dataSource={unitsList}
            loading={unitsLoading}
            bordered
            scroll={{ x: 560 }}
            pagination={
              unitsList.length > unitPageSize
                ? {
                    current: Math.min(unitPage, Math.max(1, Math.ceil(unitsList.length / unitPageSize))),
                    pageSize: unitPageSize,
                    size: 'small',
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: (p, s) => {
                      // 切换每页条数时回到第一页，避免停留在超出范围的原页码
                      setUnitPageSize(s)
                      setUnitPage(s !== unitPageSize ? 1 : p)
                    },
                  }
                : false
            }
            style={{ marginTop: 16 }}
          />
        </Card>

        </FadeIn>
        <FadeIn delay={0.1} animateOnMount={false}>
        {/* 系统公告：发布 + 管理列表（是否显示 / 删除） */}
        <Card className="table-card" styles={{ body: { padding: 24 } }} variant="outlined">
          <div className="announce-header">
            <Text strong className="card-title">
              系统公告
            </Text>
            <Button type="primary" icon={<AppIcon name="notification" size={14} />} onClick={openAnnounceModal}>
              发布公告
            </Button>
          </div>
          <Text type="secondary" className="announce-hint">
            公告发布后展示在用户的「获取」页面顶部；关闭「显示」可临时下线公告，无需删除。
          </Text>

          {/* 列表项不再逐项入场（卡片整体已渐入）；删除时以 AnimatePresence 平滑收起，
              其余项借 layout 自然回流，属于「状态变化」而非「入场逐项触发」 */}
          <div className="announce-list" style={{ marginTop: 16 }}>
            {announceLoading ? (
              <Text type="secondary">加载中...</Text>
            ) : announceList.length === 0 ? (
              <Text type="secondary">暂无公告</Text>
            ) : (
              <AnimatePresence initial={false}>
                {announceList.map((item) => {
                  const expanded = expandedAnnounceId === item.id
                  const collapsible = item.content.length > 40
                  return (
                  <motion.div
                    key={item.id}
                    layout
                    className="announce-row"
                    style={{ overflow: 'hidden' }}
                    exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: durations.micro, ease: easings.inOut } }}
                  >
                    <div className="announce-row-main">
                      {item.pinned && <Tag color="orange" className="announce-pin-tag">置顶</Tag>}
                      <div className="announce-content-col">
                        <motion.div
                          className="announce-row-content"
                          initial={false}
                          animate={{ height: expanded ? 'auto' : 44 }}
                          transition={{ duration: durations.base, ease: easings.out }}
                          style={{ overflow: 'hidden' }}
                        >
                          <span>{item.content}</span>
                        </motion.div>
                        {collapsible && (
                          <Button
                            type="link"
                            size="small"
                            className="announce-expand-btn"
                            onClick={() =>
                              setExpandedAnnounceId(expanded ? null : item.id)
                            }
                          >
                            {expanded ? '收起' : '展开'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="announce-row-actions">
                      <span className="announce-visible-toggle">
                        <Switch
                          size="small"
                          checked={item.visible !== false}
                          onChange={(checked) => void toggleAnnouncementVisible(item, checked)}
                        />
                        <Text type="secondary" className="announce-visible-label">显示</Text>
                      </span>
                      <Button
                        size="small"
                        type="text"
                        danger
                        onClick={() => confirmDeleteAnnouncement(item)}
                      >
                        删除
                      </Button>
                    </div>
                  </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        </Card>
        </FadeIn>
      </div>

      {/* 修改角色 */}
      <Modal
        open={!!roleTarget}
        onCancel={() => setRoleTarget(null)}
        title="修改角色"
        footer={null}
        width={420}
        closable
        maskClosable={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Text type="secondary">
            为用户 <Text strong style={{ color: '#1e293b' }}>{roleTarget?.username}</Text> 选择新角色：
          </Text>
          <Select
            value={roleValue || undefined}
            onChange={(v) => setRoleValue(v as string)}
            options={roleOptions}
            placeholder="请选择角色"
            size="large"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Button onClick={() => setRoleTarget(null)}>取消</Button>
          <Button
            type="primary"
            loading={roleSubmitting}
            disabled={!roleValue}
            onClick={() => void submitRoleChange()}
          >
            {roleSubmitting ? '提交中...' : '确认修改'}
          </Button>
        </div>
      </Modal>

      {/* 发布公告 */}
      <Modal
        open={showAnnounceModal}
        onCancel={() => setShowAnnounceModal(false)}
        title="发布公告"
        footer={null}
        width={520}
        closable
        maskClosable={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input.TextArea
            value={announceContent}
            onChange={(e) => setAnnounceContent(e.target.value)}
            maxLength={500}
            autoSize={{ minRows: 4, maxRows: 8 }}
            placeholder="请输入公告内容..."
          />
          <Checkbox checked={announcePinned} onChange={(e) => setAnnouncePinned(e.target.checked)}>
            置顶此公告
          </Checkbox>
          <Checkbox checked={announceVisible} onChange={(e) => setAnnounceVisible(e.target.checked)}>
            在获取页显示（取消勾选则仅保存、不展示）
          </Checkbox>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Button onClick={() => setShowAnnounceModal(false)}>取消</Button>
          <Button
            type="primary"
            loading={announcePublishing}
            disabled={!announceContent.trim()}
            onClick={() => void publishAnnouncement()}
          >
            {announcePublishing ? '发布中...' : '发布'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
