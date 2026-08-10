<script setup lang="ts">
import { h, ref, reactive, onMounted } from 'vue'
import { NButton, type DataTableColumns } from 'naive-ui'
import { myCodes } from '@/api/codes'
import { useUtils } from '@/composables/useUtils'
import { getErrorMessage, isHandledError } from '@/api/request'
import type { ActivationCode } from '@/types'

const { message, formatTime, copyToClipboard } = useUtils()

const myCodesList = ref<ActivationCode[]>([])
const loading = ref(false)

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onUpdatePage: (page: number) => loadMyCodes(page),
  onUpdatePageSize: (size: number) => {
    pagination.pageSize = size
    loadMyCodes(1)
  },
})

async function loadMyCodes(page: number) {
  loading.value = true
  try {
    const data = await myCodes(page, pagination.pageSize)
    myCodesList.value = data.codes
    pagination.page = page
    pagination.itemCount = data.total
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    loading.value = false
  }
}

onMounted(() => loadMyCodes(1))

const columns: DataTableColumns<ActivationCode> = [
  {
    title: '激活码',
    key: 'code',
    width: 260,
    render: (row: ActivationCode) => h('span', { class: 'code-chip' }, row.code),
  },
  {
    title: '获取时间',
    key: 'fetchTime',
    width: 180,
    render: (row: ActivationCode) =>
      h('span', { style: 'color:#64748b; font-size:13px; white-space:nowrap;' }, formatTime(row.fetchTime)),
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    align: 'center' as const,
    render: (row: ActivationCode) =>
      h(
        NButton,
        { size: 'small', style: 'min-width:56px;', onClick: () => copyToClipboard(row.code) },
        { default: () => '复制' },
      ),
  },
]
</script>

<template>
  <div>
    <div class="page-header-block">
      <h2 class="page-title">我的获取记录</h2>
      <p class="page-subtitle">查看您获取过的激活码</p>
    </div>

    <n-card :bordered="false" class="table-card">
      <n-spin :show="loading">
        <n-data-table
          remote
          :columns="columns"
          :data="myCodesList"
          :pagination="pagination"
          :bordered="false"
          :single-line="false"
          :scroll-x="540"
        >
          <template #empty>
            <n-empty description="暂无获取记录" />
          </template>
        </n-data-table>
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
