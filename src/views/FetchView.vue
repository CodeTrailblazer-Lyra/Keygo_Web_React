<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useDialog } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { claimCode, getStats } from '@/api/codes'
import { announcements as fetchAnnouncements, deleteAnnouncement } from '@/api/logs'
import { useUtils } from '@/composables/useUtils'
import { getErrorMessage, isHandledError } from '@/api/request'
import type { Announcement } from '@/types'
import AppIcon from '@/components/AppIcon.vue'

const auth = useAuthStore()
const { message, formatTime, copyToClipboard } = useUtils()
const dialog = useDialog()

const stats = reactive({ total: 0, available: 0, used: 0 })
const announcements = ref<Announcement[]>([])

/* ===== 申领相关 ===== */
const showClaimModal = ref(false)
const claiming = ref(false)
const claimDone = ref(false)
const claimOk = ref(false)
const claimedCode = ref('')
const claimError = ref('')

async function loadAnnouncements() {
  try {
    announcements.value = await fetchAnnouncements()
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  }
}

async function loadStats() {
  try {
    const data = await getStats()
    stats.total = data.total
    stats.available = data.available
    stats.used = data.used
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  }
}

/* ===== 激活码自适应字号（一行完整显示，不滚动、不截断）===== */
const codeDisplayRef = ref<HTMLElement>()
const codeFontSize = ref(20)

function fitCodeFont() {
  const el = codeDisplayRef.value
  if (!el || !claimedCode.value) return
  const style = window.getComputedStyle(el)
  const padL = parseFloat(style.paddingLeft) || 0
  const padR = parseFloat(style.paddingRight) || 0
  const avail = el.clientWidth - padL - padR
  const len = claimedCode.value.length
  let size = 20
  // 等宽字体估算：每字符约 0.65em（含字距），不够就缩小
  while (size > 10 && len * size * 0.65 > avail) size -= 0.5
  codeFontSize.value = size
}

function onWinResize() {
  if (claimDone.value && claimOk.value) fitCodeFont()
}

function openClaimModal() {
  claimDone.value = false
  claimOk.value = false
  claiming.value = false
  claimedCode.value = ''
  claimError.value = ''
  codeFontSize.value = 20
  showClaimModal.value = true
}

async function doClaim() {
  claiming.value = true
  try {
    const result = await claimCode()
    claimDone.value = true
    claimOk.value = true
    claimedCode.value = result.code || ''
    nextTick(fitCodeFont)
    stats.available = result.available
    stats.used = result.used
    stats.total = result.total
  } catch (err) {
    claimDone.value = true
    claimOk.value = false
    claimError.value = getErrorMessage(err)
  } finally {
    claiming.value = false
  }
}

async function copyCode() {
  await copyToClipboard(claimedCode.value, '激活码已复制')
}

function closeClaimModal() {
  showClaimModal.value = false
}

function confirmDeleteAnnouncement(id: number) {
  dialog.warning({
    title: '删除公告',
    content: '确定要删除这条公告吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteAnnouncement(id)
        message.success('公告已删除')
        await loadAnnouncements()
      } catch (err) {
        if (!isHandledError(err)) message.error(getErrorMessage(err))
      }
    },
  })
}

onMounted(() => {
  loadAnnouncements()
  loadStats()
  window.addEventListener('resize', onWinResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWinResize)
})
</script>

<template>
  <div>
    <!-- 页头 -->
    <div class="page-header-block">
      <h2 class="page-title">激活码获取</h2>
      <p class="page-subtitle">点击按钮获取一个可用的激活码</p>
    </div>

    <!-- 公告 -->
    <div v-if="announcements.length" class="announcement-list">
      <n-alert
        v-for="item in announcements"
        :key="item.id"
        :type="item.pinned ? 'warning' : 'info'"
        class="announcement-item"
      >
        <div class="announcement-content">
          <span class="announcement-text">{{ item.content }}</span>
          <span class="announcement-meta">
            {{ item.publisher ? item.publisher + ' · ' : '' }}{{ formatTime(item.createTime) }}
          </span>
          <n-button
            v-if="auth.isAdmin"
            size="tiny"
            type="error"
            quaternary
            @click="confirmDeleteAnnouncement(item.id)"
          >
            删除
          </n-button>
        </div>
      </n-alert>
    </div>

    <!-- 统计 -->
    <n-grid cols="3" :x-gap="12" :y-gap="12" style="margin-bottom: 24px">
      <n-gi>
        <n-card :bordered="false" class="stat-card">
          <div class="stat-card-inner">
            <span class="stat-icon"><AppIcon name="package" :size="28" /></span>
            <div>
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">总数</div>
            </div>
          </div>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card :bordered="false" class="stat-card">
          <div class="stat-card-inner">
            <span class="stat-icon"><AppIcon name="check-circle" :size="28" /></span>
            <div>
              <div class="stat-value stat-value-green">{{ stats.available }}</div>
              <div class="stat-label">可用</div>
            </div>
          </div>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card :bordered="false" class="stat-card">
          <div class="stat-card-inner">
            <span class="stat-icon"><AppIcon name="map-pin" :size="28" /></span>
            <div>
              <div class="stat-value stat-value-orange">{{ stats.used }}</div>
              <div class="stat-label">已使用</div>
            </div>
          </div>
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 申领区 -->
    <n-card :bordered="false" class="claim-card">
      <div class="claim-section">
        <div class="claim-icon"><AppIcon name="key" :size="36" /></div>
        <h3 class="claim-title">获取激活码</h3>
        <p class="claim-desc">
          当前可用：<strong>{{ stats.available }}</strong> 个
        </p>
        <n-button type="primary" size="large" round @click="openClaimModal"> 立即获取 </n-button>
      </div>
    </n-card>

    <!-- 申领模态框 -->
    <n-modal
      v-model:show="showClaimModal"
      preset="card"
      style="max-width: min(460px, 92vw)"
      :mask-closable="false"
    >
      <template #header>获取激活码</template>

      <!-- 确认阶段 -->
      <div v-if="!claimDone" class="claim-modal-body">
        <div class="claim-modal-icon"><AppIcon name="key" :size="40" /></div>
        <p class="claim-modal-text">您即将获取一个激活码，确认继续吗？</p>
        <p class="claim-modal-sub">
          当前可用：<strong>{{ stats.available }}</strong> 个
        </p>
      </div>

      <!-- 结果阶段 -->
      <div v-else class="claim-modal-body">
        <template v-if="claimOk">
          <div class="claim-result-icon"><AppIcon name="check-circle" :size="40" /></div>
          <p class="claim-modal-text">恭喜，您已成功获取：</p>
          <div
            class="claim-code-display"
            ref="codeDisplayRef"
            :style="{ fontSize: codeFontSize + 'px' }"
          >
            {{ claimedCode }}
          </div>
        </template>
        <template v-else>
          <div class="claim-result-icon"><AppIcon name="alert-circle" :size="40" /></div>
          <p class="claim-modal-text">获取失败</p>
          <p class="claim-modal-error">{{ claimError }}</p>
        </template>
      </div>

      <template #footer>
        <div class="claim-modal-footer">
          <template v-if="!claimDone">
            <n-button @click="closeClaimModal">取消</n-button>
            <n-button type="primary" :loading="claiming" @click="doClaim">
              {{ claiming ? '获取中...' : '确认获取' }}
            </n-button>
          </template>
          <template v-else-if="claimOk">
            <n-button @click="closeClaimModal">关闭</n-button>
            <n-button type="primary" @click="copyCode">复制激活码</n-button>
          </template>
          <template v-else>
            <n-button @click="closeClaimModal">关闭</n-button>
          </template>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.stat-card {
  border-radius: 14px;
}
.stat-card-inner {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat-icon {
  font-size: 32px;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.1;
}
.stat-value-green {
  color: #16a34a;
}
.stat-value-orange {
  color: #ea580c;
}
.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-top: 2px;
}
.claim-card {
  border-radius: 14px;
}
.announcement-item {
  border-radius: 14px;
}
.announcement-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}
.announcement-text {
  flex: 1;
  min-width: 0;
}
.announcement-meta {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
}
.claim-modal-body {
  text-align: center;
  padding: 12px 0;
}
.claim-modal-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.claim-modal-text {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 8px;
}
.claim-modal-sub {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}
.claim-modal-error {
  color: #ef4444;
  font-size: 14px;
  margin: 0;
}
.claim-result-icon {
  font-size: 56px;
  margin-bottom: 12px;
}
.claim-modal-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .stat-card-inner {
    flex-direction: column;
    gap: 6px;
    align-items: center;
    text-align: center;
  }
  .stat-icon {
    font-size: 22px;
  }
  .stat-value {
    font-size: 20px;
  }
  .stat-label {
    font-size: 11px;
  }

  .announcement-content {
    gap: 6px;
  }
  .announcement-meta {
    font-size: 11px;
  }

  .claim-modal-body {
    padding: 8px 0;
  }
  .claim-modal-icon {
    font-size: 40px;
    margin-bottom: 10px;
  }
  .claim-result-icon {
    font-size: 48px;
  }
  .claim-modal-text {
    font-size: 15px;
  }
  .claim-modal-sub,
  .claim-modal-error {
    font-size: 13px;
  }
}
</style>
