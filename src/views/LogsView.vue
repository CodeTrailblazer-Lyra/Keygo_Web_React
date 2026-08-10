<script setup lang="ts">
import { h, ref, reactive, onMounted } from 'vue'
import { NTag, type DataTableColumns } from 'naive-ui'
import { logs } from '@/api/logs'
import { useUtils } from '@/composables/useUtils'
import { getErrorMessage, isHandledError } from '@/api/request'
import type { OperationLog } from '@/types'

const { message, formatTime, actionLabel, actionTagType } = useUtils()

const logList = ref<OperationLog[]>([])
const loading = ref(false)
const logPage = ref(1)
const logSize = ref(20)

const columns: DataTableColumns<OperationLog> = [
  { title: '#', key: 'id', width: 70 },
  {
    title: '操作人',
    key: 'username',
    width: 130,
    render: (row: OperationLog) => h('strong', { style: 'color:#1e293b;' }, row.username),
  },
  {
    title: '操作',
    key: 'action',
    width: 140,
    render: (row: OperationLog) =>
      h(
        NTag,
        { type: actionTagType(row.action), size: 'small', round: true },
        { default: () => actionLabel(row.action) },
      ),
  },
  {
    title: '对象',
    key: 'target',
    minWidth: 200,
    render: (row: OperationLog) =>
      row.target
        ? h('span', { class: 'code-chip' }, row.target)
        : h('span', { style: 'color:#94a3b8;' }, '—'),
  },
  {
    title: '详情',
    key: 'detail',
    minWidth: 180,
    render: (row: OperationLog) =>
      h('span', { style: 'color:#64748b; font-size:13px;' }, row.detail || '—'),
  },
  {
    title: '时间',
    key: 'createTime',
    width: 170,
    render: (row: OperationLog) =>
      h(
        'span',
        { style: 'color:#64748b; font-size:13px; white-space:nowrap;' },
        formatTime(row.createTime),
      ),
  },
]

async function loadLogs(page: number) {
  loading.value = true
  try {
    const data = await logs(page, logSize.value)
    logList.value = data.logs
    logPage.value = page
    pagination.page = page
    pagination.itemCount = data.totalElements
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    loading.value = false
  }
}

const pagination = reactive({
  page: 1,
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  itemCount: 0,
  onUpdatePage: (page: number) => loadLogs(page),
  onUpdatePageSize: (pageSize: number) => {
    logSize.value = pageSize
    loadLogs(1)
  },
})

onMounted(() => loadLogs(1))
</script>

<template>
  <div>
    <div class="page-header-block">
      <h2 class="page-title">操作日志</h2>
      <p class="page-subtitle">系统操作审计记录</p>
    </div>

    <n-card :bordered="false" class="table-card">
      <n-spin :show="loading">
        <n-data-table
          remote
          :columns="columns"
          :data="logList"
          :pagination="pagination"
          :bordered="false"
          :single-line="false"
          :scroll-x="1000"
        />
      </n-spin>
    </n-card>
  </div>
</template>

<style scoped>
.table-card {
  border-radius: 18px;
  overflow: hidden;
  background: var(--lg-bg) !important;
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: var(--lg-border);
  box-shadow: var(--lg-shadow);
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .table-card {
    border-radius: 20px;
  }
}
</style>
