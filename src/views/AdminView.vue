<script setup lang="ts">
import { h, ref, onMounted, type VNode } from 'vue'
import { NButton, NTag, NSelect, useDialog, type DataTableColumns } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import {
  approveUser as approveUserApi,
  rejectUser as rejectUserApi,
  changeRole as changeRoleApi,
  deleteUser as deleteUserApi,
  allUsers as allUsersApi,
  pendingUsers as pendingUsersApi,
  type PendingUser,
} from '@/api/users'
import { publishAnnouncement as publishAnnouncementApi } from '@/api/logs'
import { useUtils } from '@/composables/useUtils'
import { usePasswordModal } from '@/composables/usePasswordModal'
import type { SysUser } from '@/types'
import { getErrorMessage, isHandledError } from '@/api/request'

const auth = useAuthStore()
const { message, formatTime, roleLabel, roleTagType } = useUtils()
const { open: openPasswordModal } = usePasswordModal()
const dialog = useDialog()

/* ===== 状态 ===== */
const pendingList = ref<PendingUser[]>([])
const allUsersList = ref<SysUser[]>([])
const pendingLoading = ref(false)
const usersLoading = ref(false)

const showDeleteModal = ref(false)
const deleteTarget = ref<SysUser | null>(null)

const showAnnounceModal = ref(false)
const announceContent = ref('')
const announcePinned = ref(false)
const announcePublishing = ref(false)

/* ===== 待审核用户列 ===== */
const pendingColumns: DataTableColumns<PendingUser> = [
  {
    title: '用户名',
    key: 'username',
    minWidth: 180,
    render: (row) => h('strong', { style: 'color:#1e293b;' }, row.username),
  },
  {
    title: '注册时间',
    key: 'createTime',
    width: 180,
    render: (row) =>
      h('span', { style: 'color:#64748b; font-size:13px;' }, formatTime(row.createTime)),
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    align: 'center' as const,
    render: (row) =>
      h('div', { style: 'display:flex; gap:8px; justify-content:center;' }, [
        h(
          NButton,
          {
            size: 'small',
            type: 'success',
            style: 'min-width:56px;',
            onClick: () => doApprove(row.id),
          },
          { default: () => '通过' },
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'error',
            style: 'min-width:56px;',
            onClick: () => doReject(row.id),
          },
          { default: () => '拒绝' },
        ),
      ]),
  },
]

/* ===== 全部用户列 ===== */
const usersColumns: DataTableColumns<SysUser> = [
  { title: '#', key: 'id', width: 60 },
  {
    title: '用户名',
    key: 'username',
    minWidth: 150,
    render: (row) => h('strong', { style: 'color:#1e293b;' }, row.username),
  },
  {
    title: '角色',
    key: 'role',
    width: 160,
    render: (row) => {
      if (canChangeRole(row)) {
        const options = [
          { label: '普通用户', value: 'ROLE_USER' },
          { label: '管理员', value: 'ROLE_ADMIN' },
        ]
        if (auth.isSuperAdmin) {
          options.push({ label: '超级管理员', value: 'ROLE_SUPER_ADMIN' })
        }
        return h(NSelect, {
          value: row.role,
          size: 'small',
          style: 'width: 140px;',
          options,
          'onUpdate:value': (v: string | number | null) => changeUserRole(row.id, v as string),
        })
      }
      return h(
        NTag,
        { type: roleTagType(row.role), size: 'small', round: true },
        { default: () => roleLabel(row.role) },
      )
    },
  },
  {
    title: '状态',
    key: 'approved',
    width: 110,
    render: (row) =>
      h(
        NTag,
        { type: row.approved ? 'success' : 'warning', size: 'small', round: true },
        { default: () => (row.approved ? '已审核' : '待审') },
      ),
  },
  {
    title: '注册时间',
    key: 'createTime',
    width: 180,
    render: (row) =>
      h(
        'span',
        { style: 'color:#64748b; font-size:13px; white-space:nowrap;' },
        formatTime(row.createTime),
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 220,
    align: 'center' as const,
    render: (row) => {
      const btns: VNode[] = []
      if (auth.isAdmin) {
        btns.push(
          h(
            NButton,
            { size: 'small', style: 'min-width:56px;', onClick: () => openPasswordModal(row) },
            { default: () => '改密' },
          ),
        )
      }
      if (auth.isSuperAdmin && row.username !== auth.username) {
        btns.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'error',
              style: 'min-width:56px;',
              onClick: () => confirmDeleteUser(row),
            },
            { default: () => '删除' },
          ),
        )
      } else if (auth.isSuperAdmin) {
        // 占位，保持按钮位置对齐
        btns.push(h('span', { style: 'display:inline-block; width:56px;' }))
      }
      return h('div', { style: 'display:flex; gap:6px; justify-content:center;' }, btns)
    },
  },
]

/* ===== 角色变更权限 ===== */
function canChangeRole(u: SysUser): boolean {
  return auth.isAdmin && (u.role !== 'ROLE_SUPER_ADMIN' || auth.isSuperAdmin)
}

/* ===== 数据加载 ===== */
async function loadPending() {
  pendingLoading.value = true
  try {
    pendingList.value = await pendingUsersApi()
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    pendingLoading.value = false
  }
}

async function loadAllUsers() {
  usersLoading.value = true
  try {
    allUsersList.value = await allUsersApi()
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    usersLoading.value = false
  }
}

/* ===== 审核操作 ===== */
function doApprove(id: number) {
  dialog.success({
    title: '审核通过',
    content: '确定要通过该用户的注册申请吗？',
    positiveText: '通过',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await approveUserApi(id)
        message.success('已通过审核')
        await Promise.all([loadPending(), loadAllUsers()])
      } catch (err) {
        if (!isHandledError(err)) message.error(getErrorMessage(err))
      }
    },
  })
}

function doReject(id: number) {
  dialog.warning({
    title: '拒绝注册',
    content: '确定要拒绝该用户的注册申请吗？',
    positiveText: '拒绝',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await rejectUserApi(id)
        message.success('已拒绝')
        await loadPending()
      } catch (err) {
        if (!isHandledError(err)) message.error(getErrorMessage(err))
      }
    },
  })
}

/* ===== 角色变更 ===== */
async function changeUserRole(id: number, role: string) {
  try {
    await changeRoleApi(id, role)
    message.success('角色已更新')
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    await loadAllUsers()
  }
}

/* ===== 删除用户 ===== */
function confirmDeleteUser(u: SysUser) {
  deleteTarget.value = u
  showDeleteModal.value = true
}

async function doDeleteUser() {
  const target = deleteTarget.value
  if (!target) return
  try {
    await deleteUserApi(target.id)
    message.success('用户已删除')
    showDeleteModal.value = false
    deleteTarget.value = null
    await Promise.all([loadPending(), loadAllUsers()])
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  }
}

/* ===== 发布公告 ===== */
function openAnnounceModal() {
  announceContent.value = ''
  announcePinned.value = false
  showAnnounceModal.value = true
}

async function publishAnnouncement() {
  if (!announceContent.value.trim()) {
    message.warning('请输入公告内容')
    return
  }
  announcePublishing.value = true
  try {
    await publishAnnouncementApi(announceContent.value, announcePinned.value)
    message.success('公告已发布')
    showAnnounceModal.value = false
    announceContent.value = ''
    announcePinned.value = false
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    announcePublishing.value = false
  }
}

onMounted(() => {
  loadPending()
  loadAllUsers()
})
</script>

<template>
  <div>
    <!-- 页头 -->
    <div class="page-header-block">
      <n-space align="center" justify="space-between" wrap>
        <div>
          <h2 class="page-title">用户管理</h2>
          <p class="page-subtitle">审核注册、角色管理、系统公告</p>
        </div>
        <n-button type="primary" @click="openAnnounceModal">发布公告</n-button>
      </n-space>
    </div>

    <!-- 待审核用户 -->
    <n-card
      v-if="pendingList.length"
      :bordered="false"
      class="table-card"
      style="margin-bottom: 24px"
    >
      <template #header>
        <n-badge :value="pendingList.length" :max="99" type="error">
          <span class="card-title">待审核用户</span>
        </n-badge>
      </template>
      <n-data-table
        :columns="pendingColumns"
        :data="pendingList"
        :loading="pendingLoading"
        :bordered="false"
        :single-line="false"
        :scroll-x="560"
      />
    </n-card>

    <!-- 全部用户 -->
    <n-card :bordered="false" class="table-card">
      <template #header>
        <span class="card-title">全部用户</span>
      </template>
      <n-data-table
        :columns="usersColumns"
        :data="allUsersList"
        :loading="usersLoading"
        :bordered="false"
        :single-line="false"
        :scroll-x="900"
      />
    </n-card>

    <!-- 删除用户确认 -->
    <n-modal v-model:show="showDeleteModal" preset="dialog" type="error" :show-icon="true">
      <template #header>删除用户确认</template>
      <div>
        确定要删除用户 <strong>{{ deleteTarget?.username }}</strong> 吗？此操作不可恢复。
      </div>
      <template #action>
        <n-button size="medium" @click="showDeleteModal = false">取消</n-button>
        <n-button size="medium" type="error" @click="doDeleteUser">确认删除</n-button>
      </template>
    </n-modal>

    <!-- 发布公告 -->
    <n-modal
      v-model:show="showAnnounceModal"
      preset="card"
      style="max-width: min(520px, 92vw)"
      :mask-closable="false"
    >
      <template #header>发布公告</template>
      <n-space vertical :size="16">
        <n-input
          v-model:value="announceContent"
          type="textarea"
          :maxlength="500"
          show-count
          :autosize="{ minRows: 4, maxRows: 8 }"
          placeholder="请输入公告内容..."
        />
        <n-checkbox v-model:checked="announcePinned">置顶此公告</n-checkbox>
      </n-space>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAnnounceModal = false">取消</n-button>
          <n-button
            type="primary"
            :loading="announcePublishing"
            :disabled="!announceContent.trim()"
            @click="publishAnnouncement"
          >
            {{ announcePublishing ? '发布中...' : '发布' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.table-card {
  border-radius: 14px;
}
.card-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .table-card {
    border-radius: 16px;
  }
  .card-title {
    font-size: 15px;
  }
}
</style>
