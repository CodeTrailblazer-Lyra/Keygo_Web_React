<script setup lang="ts">
import { h, ref, reactive, onMounted, nextTick, watch, type VNode } from 'vue'
import { NButton, NTag, NInput, useDialog, type DataTableColumns } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import AppIcon from '@/components/AppIcon.vue'
import {
  listCodes,
  markUsed,
  markUnused,
  deleteCode,
  batchUse as batchUseApi,
  batchUnuse as batchUnuseApi,
  batchDelete as batchDeleteApi,
  importExcel,
  updateRemark,
  batchClaim,
  exportCodes,
} from '@/api/codes'
import { useUtils } from '@/composables/useUtils'
import { getErrorMessage, isHandledError } from '@/api/request'
import type { ActivationCode, BatchClaimResult, Stats } from '@/types'

const auth = useAuthStore()
const { message, formatTime, copyToClipboard, debounce } = useUtils()
const dialog = useDialog()

/* ===== 列表状态 ===== */
const listFilter = ref('')
const listKeyword = ref('')
const listPage = ref(1)
const listSize = ref(20)
const listLoading = ref(false)
const codes = ref<ActivationCode[]>([])
const checkedKeys = ref<number[]>([])
const selectedIds = ref<number[]>([])
const listStats = reactive<Stats>({ total: 0, available: 0, used: 0 })

/* ===== 备注行内编辑 ===== */
const editingRemarkId = ref<number | null>(null)
const editingRemarkText = ref('')

/* ===== 导入弹窗 ===== */
const showImportModal = ref(false)
const dragOver = ref(false)
const importFile = ref<File | null>(null)
const importing = ref(false)
const importResult = ref('')
const importOk = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

/* ===== 批量获取弹窗 ===== */
const showBatchClaimModal = ref(false)
const batchClaimCount = ref<number | null>(1)
const batchClaiming = ref(false)
const batchClaimDone = ref(false)
const batchClaimResult = ref<BatchClaimResult | null>(null)

/* ===== 批量删除弹窗 ===== */
const showBatchDeleteModal = ref(false)

/* ===== 表格列定义 ===== */
const columns: DataTableColumns<ActivationCode> = [
  { type: 'selection', width: 40 },
  { title: '#', key: 'id', width: 60 },
  {
    title: '激活码',
    key: 'code',
    minWidth: 200,
    render: (row) => h('span', { class: 'code-chip' }, row.code),
  },
  {
    title: '状态',
    key: 'used',
    width: 90,
    render: (row) =>
      h(
        NTag,
        { type: row.used ? 'error' : 'success', size: 'small', round: true },
        { default: () => (row.used ? '已使用' : '未使用') },
      ),
  },
  {
    title: '获取人',
    key: 'fetchUser',
    width: 100,
    render: (row) => h('span', { style: 'color:#64748b; font-size:13px;' }, row.fetchUser || '—'),
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 140,
    render: (row) => {
      if (editingRemarkId.value === row.id) {
        return h(NInput, {
          value: editingRemarkText.value,
          'onUpdate:value': (v: string) => (editingRemarkText.value = v),
          size: 'small',
          onKeyup: (e: KeyboardEvent) => {
            if (e.key === 'Enter') saveRemark(row.id)
            if (e.key === 'Escape') cancelEditRemark()
          },
          onBlur: () => saveRemark(row.id),
          autofocus: true,
        })
      }
      return h(
        'span',
        {
          style:
            'color:#64748b; font-size:13px; cursor:pointer; padding: 4px 6px; border-radius:6px;',
          onClick: () => startEditRemark(row),
        },
        row.remark || '—',
      )
    },
  },
  {
    title: '创建时间',
    key: 'createTime',
    width: 150,
    render: (row) =>
      h(
        'span',
        { style: 'color:#64748b; font-size:13px; white-space:nowrap;' },
        formatTime(row.createTime),
      ),
  },
  {
    title: '获取时间',
    key: 'fetchTime',
    width: 150,
    render: (row) =>
      h(
        'span',
        { style: 'color:#64748b; font-size:13px; white-space:nowrap;' },
        row.fetchTime ? formatTime(row.fetchTime) : '—',
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    align: 'center' as const,
    fixed: 'right' as const,
    render: (row) => {
      const btns: VNode[] = []
      if (!row.used) {
        btns.push(
          h(
            NButton,
            { size: 'small', type: 'warning', onClick: () => confirmMark(row.id) },
            { default: () => '使用' },
          ),
        )
      } else if (auth.isSuperAdmin) {
        btns.push(
          h(
            NButton,
            { size: 'small', onClick: () => confirmUnmark(row.id) },
            { default: () => '恢复' },
          ),
        )
      }
      if (auth.isSuperAdmin) {
        btns.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'error',
              onClick: () => confirmDelete(row.id),
            },
            { default: () => '删除' },
          ),
        )
      }
      return h(
        'div',
        { style: 'display:flex; gap:4px; justify-content:center; white-space:nowrap;' },
        btns,
      )
    },
  },
]

/* ===== 分页 ===== */
const pagination = reactive({
  page: 1,
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  itemCount: 0,
  onUpdatePage: (page: number) => loadCodes(listFilter.value, page),
  onUpdatePageSize: (pageSize: number) => {
    listSize.value = pageSize
    pagination.pageSize = pageSize
    loadCodes(listFilter.value, 1)
  },
})

/* ===== 数据加载 ===== */
async function loadCodes(status: string, page: number) {
  listLoading.value = true
  try {
    const data = await listCodes({
      status,
      keyword: listKeyword.value,
      page,
      size: listSize.value,
    })
    codes.value = data.codes
    listStats.total = data.total
    listStats.available = data.available
    listStats.used = data.used
    listPage.value = page
    pagination.page = page
    pagination.itemCount = data.totalElements
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    listLoading.value = false
  }
}

const debouncedSearch = debounce(() => {
  loadCodes(listFilter.value, 1)
}, 400)

function onFilterChange(value: string) {
  listFilter.value = value
  checkedKeys.value = []
  selectedIds.value = []
  loadCodes(listFilter.value, 1)
}

/* ===== 液态玻璃筛选器 ===== */
const filterOptions = [
  { label: '全部', value: '' },
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
]
const filterBarRef = ref<HTMLElement>()
const filterIndicator = ref({ x: 0, w: 0, show: false })

function updateFilterIndicator() {
  if (!filterBarRef.value) return
  const active = filterBarRef.value.querySelector('.filter-chip.active') as HTMLElement | null
  if (active) {
    filterIndicator.value = { x: active.offsetLeft, w: active.offsetWidth, show: true }
  } else {
    filterIndicator.value.show = false
  }
}

watch(listFilter, () => {
  nextTick(updateFilterIndicator)
})

onMounted(() => {
  loadCodes('', 1)
  nextTick(updateFilterIndicator)
  window.addEventListener('resize', updateFilterIndicator)
})

function onCheckedRowKeysChange(keys: Array<string | number>) {
  const ids = keys.map((k) => Number(k))
  checkedKeys.value = ids
  selectedIds.value = ids
}

function rowKey(row: ActivationCode): number {
  return row.id
}

function clearSelection() {
  checkedKeys.value = []
  selectedIds.value = []
}

/* ===== 单行操作 ===== */
function confirmMark(id: number) {
  dialog.warning({
    title: '使用',
    content: '确定要使用此激活码吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await markUsed(id)
        message.success('已标记为使用')
        await loadCodes(listFilter.value, listPage.value)
      } catch (err) {
        if (!isHandledError(err)) message.error(getErrorMessage(err))
      }
    },
  })
}

function confirmUnmark(id: number) {
  dialog.warning({
    title: '恢复未使用',
    content: '确定要将此激活码恢复为未使用吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await markUnused(id)
        message.success('已恢复为未使用')
        await loadCodes(listFilter.value, listPage.value)
      } catch (err) {
        if (!isHandledError(err)) message.error(getErrorMessage(err))
      }
    },
  })
}

function confirmDelete(id: number) {
  dialog.warning({
    title: '删除激活码',
    content: '确定要删除此激活码吗？此操作不可恢复。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteCode(id)
        message.success('删除成功')
        await loadCodes(listFilter.value, listPage.value)
      } catch (err) {
        if (!isHandledError(err)) message.error(getErrorMessage(err))
      }
    },
  })
}

/* ===== 批量操作 ===== */
async function batchUse() {
  try {
    await batchUseApi(selectedIds.value)
    message.success('批量标记成功')
    clearSelection()
    await loadCodes(listFilter.value, listPage.value)
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  }
}

async function batchUnuse() {
  try {
    await batchUnuseApi(selectedIds.value)
    message.success('批量恢复成功')
    clearSelection()
    await loadCodes(listFilter.value, listPage.value)
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  }
}

async function doBatchDelete() {
  try {
    await batchDeleteApi(selectedIds.value)
    message.success('批量删除成功')
    showBatchDeleteModal.value = false
    clearSelection()
    await loadCodes(listFilter.value, listPage.value)
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  }
}

/* ===== 备注编辑 ===== */
function startEditRemark(row: ActivationCode) {
  editingRemarkId.value = row.id
  editingRemarkText.value = row.remark || ''
}

function cancelEditRemark() {
  editingRemarkId.value = null
}

async function saveRemark(id: number) {
  if (editingRemarkId.value !== id) return
  const text = editingRemarkText.value
  editingRemarkId.value = null
  try {
    await updateRemark(id, text)
    message.success('备注已更新')
    await loadCodes(listFilter.value, listPage.value)
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  }
}

/* ===== 导入 ===== */
function openImportModal() {
  showImportModal.value = true
  importFile.value = null
  importResult.value = ''
  importOk.value = false
  dragOver.value = false
}

function triggerFileInput() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  importFile.value = file
  importResult.value = ''
  importOk.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (/\.xlsx?$/i.test(file.name)) {
    importFile.value = file
    importResult.value = ''
    importOk.value = false
  } else {
    message.warning('请上传 .xlsx 或 .xls 文件')
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

async function doImport() {
  const file = importFile.value
  if (!file) {
    message.warning('请先选择文件')
    return
  }
  importing.value = true
  try {
    await importExcel(file)
    importResult.value = '导入完成'
    importOk.value = true
    message.success('导入成功')
    await loadCodes(listFilter.value, 1)
  } catch (err: unknown) {
    importResult.value = getErrorMessage(err)
    importOk.value = false
    if (!isHandledError(err)) message.error(importResult.value)
  } finally {
    importing.value = false
  }
}

/* ===== 导出 ===== */
async function exportExcel() {
  try {
    const blob = await exportCodes({
      status: listFilter.value,
      keyword: listKeyword.value,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `激活码_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  }
}

/* ===== 批量获取 ===== */
function openBatchClaimModal() {
  showBatchClaimModal.value = true
  batchClaimCount.value = 1
  batchClaimDone.value = false
  batchClaimResult.value = null
  batchClaiming.value = false
}

async function doBatchClaim() {
  const count = batchClaimCount.value
  if (count === null || count < 1 || count > 100) {
    message.warning('数量需在 1-100 之间')
    return
  }
  batchClaiming.value = true
  try {
    const res = await batchClaim(count)
    batchClaimDone.value = true
    batchClaimResult.value = res
    message.success(`成功获取 ${res.count} 个激活码`)
    listStats.available = res.available
    listStats.used = res.used
    listStats.total = res.total
  } catch (err: unknown) {
    batchClaimDone.value = true
    batchClaimResult.value = null
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    batchClaiming.value = false
  }
}

async function copyAllCodes() {
  if (batchClaimResult.value && batchClaimResult.value.codes.length) {
    await copyToClipboard(batchClaimResult.value.codes.join('\n'), '全部激活码已复制')
  }
}
</script>

<template>
  <div>
    <!-- 页头 -->
    <div class="page-header-block">
      <h2 class="page-title">激活码查询</h2>
      <p class="page-subtitle">激活码列表与状态管理</p>
    </div>

    <!-- 快捷操作 -->
    <n-grid cols="2 600:4" :x-gap="16" :y-gap="16" style="margin-bottom: 24px">
      <n-gi>
        <n-card :bordered="false" class="action-card" hoverable @click="openImportModal">
          <div class="action-card-inner">
            <span class="action-icon"><AppIcon name="download" :size="24" /></span>
            <div class="action-text">
              <div class="action-title">Excel导入</div>
              <div class="action-desc">批量导入激活码</div>
            </div>
          </div>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card :bordered="false" class="action-card" hoverable @click="openBatchClaimModal">
          <div class="action-card-inner">
            <span class="action-icon"><AppIcon name="gift" :size="24" /></span>
            <div class="action-text">
              <div class="action-title">批量获取</div>
              <div class="action-desc">一次获取多个激活码</div>
            </div>
          </div>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card :bordered="false" class="action-card" hoverable @click="exportExcel">
          <div class="action-card-inner">
            <span class="action-icon"><AppIcon name="upload" :size="24" /></span>
            <div class="action-text">
              <div class="action-title">Excel导出</div>
              <div class="action-desc">导出当前列表</div>
            </div>
          </div>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card :bordered="false" class="action-card action-card-stat">
          <div class="action-card-inner">
            <span class="action-icon"><AppIcon name="check-circle" :size="24" /></span>
            <div class="action-text">
              <div class="action-title">可用统计</div>
              <div class="action-desc">
                当前可用 <strong>{{ listStats.available }}</strong> 个
              </div>
            </div>
          </div>
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 主列表 -->
    <n-card :bordered="false" class="table-card">
      <template #header>
        <n-space align="center" justify="space-between" wrap :size="12">
          <n-space align="center" :size="8">
            <div class="filter-glass-bar" ref="filterBarRef">
              <div
                class="filter-glass-indicator"
                :style="{
                  transform: `translateX(${filterIndicator.x}px)`,
                  width: `${filterIndicator.w}px`,
                  opacity: filterIndicator.show ? '1' : '0',
                }"
              ></div>
              <button
                v-for="opt in filterOptions"
                :key="opt.value"
                class="filter-chip"
                :class="{ active: listFilter === opt.value }"
                @click="onFilterChange(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
            <n-input
              v-model:value="listKeyword"
              placeholder="搜索激活码/备注/获取人"
              clearable
              size="small"
              style="width: 240px"
              @update:value="() => debouncedSearch()"
            />
          </n-space>
          <n-space align="center" :size="8">
            <template v-if="selectedIds.length >= 2">
              <n-tag type="info" size="small">已选 {{ selectedIds.length }} 项</n-tag>
              <n-button size="small" type="warning" @click="batchUse">批量使用</n-button>
              <n-button size="small" @click="batchUnuse">批量恢复</n-button>
              <n-button size="small" type="error" @click="showBatchDeleteModal = true">
                批量删除
              </n-button>
            </template>
          </n-space>
        </n-space>
      </template>

      <n-data-table
        remote
        :columns="columns"
        :data="codes"
        :loading="listLoading"
        :pagination="pagination"
        :checked-row-keys="checkedKeys"
        :row-key="rowKey"
        :bordered="false"
        :single-line="false"
        :scroll-x="1150"
        @update:checked-row-keys="onCheckedRowKeysChange"
      />
    </n-card>

    <!-- 导入弹窗 -->
    <n-modal
      v-model:show="showImportModal"
      preset="card"
      style="max-width: min(520px, 92vw)"
      :mask-closable="false"
    >
      <template #header>Excel 导入</template>
      <div
        class="drop-zone"
        :class="{ 'drag-over': dragOver }"
        @click="triggerFileInput"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <div class="drop-zone-icon"><AppIcon name="file" :size="40" /></div>
        <div class="drop-zone-text"><span>点击选择</span> 或拖拽文件到此处</div>
        <div class="drop-zone-hint">支持 .xlsx 格式，第二列作为备注</div>
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls"
          style="display: none"
          @change="onFileChange"
        />
      </div>
      <div v-if="importFile" style="margin-top: 12px">
        <n-tag type="info" size="small">{{ importFile.name }}</n-tag>
      </div>
      <n-alert
        v-if="importResult"
        :type="importOk ? 'success' : 'error'"
        style="margin-top: 12px"
        :show-icon="true"
      >
        {{ importResult }}
      </n-alert>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showImportModal = false">关闭</n-button>
          <n-button type="primary" :loading="importing" :disabled="!importFile" @click="doImport">
            {{ importing ? '导入中...' : '开始导入' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 批量获取弹窗 -->
    <n-modal
      v-model:show="showBatchClaimModal"
      preset="card"
      style="max-width: min(520px, 92vw)"
      :mask-closable="false"
    >
      <template #header>批量获取激活码</template>
      <div v-if="!batchClaimDone">
        <p style="color: #64748b; margin: 0 0 12px">输入要获取的数量（1-100）：</p>
        <n-input-number v-model:value="batchClaimCount" :min="1" :max="100" style="width: 100%" />
      </div>
      <div v-else>
        <template v-if="batchClaimResult">
          <n-alert type="success" style="margin-bottom: 12px">
            成功获取 {{ batchClaimResult.count }} 个激活码
          </n-alert>
          <div class="batch-result-box">
            <div v-for="(c, i) in batchClaimResult.codes" :key="i" class="batch-result-item">
              {{ c }}
            </div>
          </div>
          <n-button type="primary" block style="margin-top: 12px" @click="copyAllCodes">
            复制全部
          </n-button>
        </template>
        <n-alert v-else type="error"> 获取失败，请稍后重试 </n-alert>
      </div>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showBatchClaimModal = false">关闭</n-button>
          <n-button
            v-if="!batchClaimDone"
            type="primary"
            :loading="batchClaiming"
            @click="doBatchClaim"
          >
            {{ batchClaiming ? '获取中...' : '确认获取' }}
          </n-button>
          <n-button v-else type="primary" @click="openBatchClaimModal">再次获取</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 批量删除确认 -->
    <n-modal v-model:show="showBatchDeleteModal" preset="dialog" type="error" :show-icon="true">
      <template #header>批量删除确认</template>
      <div>
        确定要删除选中的 <strong>{{ selectedIds.length }}</strong> 个激活码吗？此操作不可恢复。
      </div>
      <template #action>
        <n-button size="medium" @click="showBatchDeleteModal = false">取消</n-button>
        <n-button size="medium" type="error" @click="doBatchDelete">确认删除</n-button>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.action-card {
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.action-card:hover {
  background: #f8fafc;
}
.action-card-stat {
  cursor: default;
}
.action-card-stat:hover {
  background: none;
}
.action-card-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.action-icon {
  font-size: 28px;
}
.action-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}
.action-desc {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}
.table-card {
  border-radius: 18px;
  overflow: hidden;
  background: var(--lg-bg) !important;
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: var(--lg-border);
  box-shadow: var(--lg-shadow);
}

/* ===== 液态玻璃筛选器 ===== */
.filter-glass-bar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.32));
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.6),
    0 4px 16px rgba(0, 0, 0, 0.04);
  position: relative;
}
.filter-glass-indicator {
  position: absolute;
  top: 4px;
  left: 0;
  height: calc(100% - 8px);
  border-radius: 8px;
  background: var(--lg-indicator-bg);
  backdrop-filter: blur(20px) saturate(200%);
  -webkit-backdrop-filter: blur(20px) saturate(200%);
  border: var(--lg-indicator-border);
  box-shadow: var(--lg-indicator-shadow);
  transition:
    transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
    width 0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.25s ease;
  pointer-events: none;
  z-index: 0;
}
.filter-chip {
  position: relative;
  z-index: 1;
  border: none;
  background: transparent;
  padding: 4px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border-radius: 8px;
  transition:
    color 0.25s ease,
    transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}
.filter-chip:hover {
  color: #0f172a;
}
.filter-chip:active {
  transform: scale(0.94);
}
.filter-chip.active {
  color: #6366f1;
  font-weight: 600;
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .action-card-inner {
    gap: 10px;
  }
  .action-icon {
    font-size: 24px;
  }
  .action-title {
    font-size: 14px;
  }
  .action-desc {
    font-size: 11px;
  }
  .table-card {
    border-radius: 20px;
  }
}
</style>
