<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUtils } from '@/composables/useUtils'
import { usePasswordModal } from '@/composables/usePasswordModal'
import { pendingUsers as fetchPending } from '@/api/users'
import PasswordModal from './PasswordModal.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { roleLabel, roleTagType, message } = useUtils()
const { open: openPasswordModal } = usePasswordModal()

const pendingCount = ref(0)
let pollTimer: ReturnType<typeof setInterval> | null = null

/* ===== 移动端判断 ===== */
const MOBILE_BREAKPOINT = 768
const isMobile = ref(false)
function updateIsMobile() {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
}
let resizeTimer: ReturnType<typeof setTimeout> | null = null
function onResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(updateIsMobile, 80)
}

/* ===== 底栏实时反射（Apple Liquid Glass：滚动时反射光实时流动）===== */
let scrollRaf = 0
function onScrollReflect() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    if (!mobileTabRef.value) return
    // 让斜向反射光的横向位置随滚动进度循环流动（0%-100% 往返）
    const progress = (window.scrollY * 0.02) % 200
    const x = progress <= 100 ? progress : 200 - progress
    mobileTabRef.value.style.setProperty('--lg-reflect-x', `${x}%`)
  })
}

const activeKey = computed(() => route.name as string)

interface NavItem {
  label: string | (() => string)
  key: string
  icon: string
}

const menuOptions = computed<NavItem[]>(() => {
  const base: NavItem[] = [
    { label: '获取', key: 'fetch', icon: 'key' },
    { label: '我的', key: 'mycodes', icon: 'clipboard' },
  ]
  if (auth.isAdmin) {
    base.push({ label: '查询', key: 'list', icon: 'search' })
    base.push({ label: '日志', key: 'logs', icon: 'scroll' })
    base.push({
      label: () => (pendingCount.value > 0 ? `管理 (${pendingCount.value})` : '管理'),
      key: 'admin',
      icon: 'settings',
    })
  }
  return base
})

const userMenuOptions = computed(() => [
  { label: auth.username, key: 'info', disabled: true },
  { type: 'divider' as const, key: 'd1' },
  { label: '修改密码', key: 'pwd' },
  { label: '退出登录', key: 'logout' },
])

async function onUserMenuSelect(key: string) {
  if (key === 'pwd') {
    openPasswordModal(null)
  } else if (key === 'logout') {
    await auth.logout()
    message.success('已退出登录')
    router.push('/login')
  }
}

async function checkPending() {
  if (!auth.isAdmin) return
  try {
    const list = await fetchPending()
    pendingCount.value = list.length
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', onScrollReflect, { passive: true })
  checkPending()
  pollTimer = setInterval(checkPending, 30000)
  nextTick(updateIndicators)
  window.addEventListener('resize', updateIndicators)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('resize', updateIndicators)
  window.removeEventListener('scroll', onScrollReflect)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  if (resizeTimer) clearTimeout(resizeTimer)
  if (pollTimer) clearInterval(pollTimer)
})

/* ===== 液态玻璃滑动指示器 ===== */
const desktopNavRef = ref<HTMLElement>()
const mobileTabRef = ref<HTMLElement>()
const desktopIndicator = ref({ x: 0, w: 0, show: false })
const mobileIndicator = ref({ x: 0, w: 0, show: false })

function updateIndicators() {
  // 桌面端
  if (desktopNavRef.value && !isMobile.value) {
    const active = desktopNavRef.value.querySelector(
      '.desktop-nav-item.active',
    ) as HTMLElement | null
    if (active) {
      desktopIndicator.value = { x: active.offsetLeft, w: active.offsetWidth, show: true }
    } else {
      desktopIndicator.value.show = false
    }
  } else {
    desktopIndicator.value.show = false
  }
  // 移动端
  if (mobileTabRef.value && isMobile.value) {
    const active = mobileTabRef.value.querySelector('.mobile-tab-item.active') as HTMLElement | null
    if (active) {
      mobileIndicator.value = { x: active.offsetLeft, w: active.offsetWidth, show: true }
    } else {
      mobileIndicator.value.show = false
    }
  } else {
    mobileIndicator.value.show = false
  }
}

watch([activeKey, menuOptions, isMobile], () => {
  nextTick(updateIndicators)
})
</script>

<template>
  <!-- 顶部导航栏（桌面端横排 / 移动端顶栏 + 汉堡按钮） -->
  <div class="app-navbar" :class="{ 'app-navbar-mobile': isMobile }">
    <div class="app-navbar-left">
      <router-link class="app-brand" to="/fetch">
        <span class="app-brand-icon"><AppIcon name="key" :size="16" /></span>
        <span v-if="!isMobile">KeyGo</span>
      </router-link>
    </div>

    <nav v-if="!isMobile" class="desktop-nav" ref="desktopNavRef">
      <div
        class="nav-glass-indicator"
        :style="{
          transform: `translateX(${desktopIndicator.x}px)`,
          width: `${desktopIndicator.w}px`,
          opacity: desktopIndicator.show ? '1' : '0',
        }"
      ></div>
      <router-link
        v-for="opt in menuOptions"
        :key="opt.key"
        class="desktop-nav-item"
        :class="{ active: activeKey === opt.key }"
        :to="{ name: opt.key }"
      >
        <AppIcon :name="opt.icon" :size="18" />
        <span>{{ typeof opt.label === 'function' ? opt.label() : opt.label }}</span>
      </router-link>
    </nav>

    <div class="app-navbar-right">
      <n-dropdown :options="userMenuOptions" @select="onUserMenuSelect" trigger="click">
        <n-button v-if="!isMobile" quaternary size="large" style="font-weight: 500">
          <template #icon><AppIcon name="user" :size="16" /></template>
          {{ auth.username }}
          <n-tag :type="roleTagType(auth.role)" size="small" style="margin-left: 6px">
            {{ roleLabel(auth.role) }}
          </n-tag>
        </n-button>
        <n-button v-else quaternary size="large" circle>
          <AppIcon name="user" :size="20" />
        </n-button>
      </n-dropdown>
    </div>
  </div>

  <!-- 移动端：底部 Tab Bar -->
  <div v-if="isMobile" class="mobile-tab-bar" ref="mobileTabRef">
    <div
      class="tab-glass-indicator"
      :style="{
        transform: `translateX(${mobileIndicator.x}px)`,
        width: `${mobileIndicator.w}px`,
        opacity: mobileIndicator.show ? '1' : '0',
      }"
    ></div>
    <router-link
      v-for="opt in menuOptions"
      :key="opt.key as string"
      class="mobile-tab-item"
      :class="{ active: activeKey === opt.key }"
      :to="{ name: opt.key as string }"
    >
      <AppIcon :name="opt.icon" :size="20" class="mobile-tab-icon" />
      <span class="mobile-tab-label">{{
        typeof opt.label === 'function' ? opt.label() : opt.label
      }}</span>
    </router-link>
  </div>

  <main class="page-container">
    <slot />
  </main>

  <PasswordModal />
</template>

<style scoped>
.app-navbar {
  background: var(--lg-bg);
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);
  border: var(--lg-border);
  border-radius: 18px;
  box-shadow: var(--lg-shadow);
  margin: 12px 24px 16px;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 12px;
  z-index: 1000;
}

.app-navbar-mobile {
  margin: 8px 12px 12px;
  padding: 0 14px;
  height: 56px;
  border-radius: 16px;
  top: 8px;
}

.app-navbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
  letter-spacing: -0.3px;
  cursor: pointer;
}

/* ===== 桌面端导航 ===== */
.desktop-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}
.nav-glass-indicator {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 16px;
  background: var(--lg-indicator-bg);
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: var(--lg-indicator-border);
  box-shadow: var(--lg-indicator-shadow);
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
  pointer-events: none;
  z-index: 0;
}
.desktop-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 16px;
  text-decoration: none;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  position: relative;
  z-index: 1;
  transition:
    color 0.25s ease,
    transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.desktop-nav-item:hover {
  color: #0f172a;
}
.desktop-nav-item.active {
  color: #6366f1;
  font-weight: 600;
}

.app-brand-icon {
  width: 32px;
  height: 32px;
  background: #6366f1;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
}

.app-navbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* ===== 移动端底部 Tab Bar（悬浮胶囊，与导航栏同款四角圆角）===== */
.mobile-tab-bar {
  /* 反射光带起始位置（滚动驱动实时更新，默认 0%） */
  --lg-reflect-x: 0%;
  position: fixed;
  bottom: calc(10px + env(safe-area-inset-bottom));
  left: 12px;
  right: 12px;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  /* 更通透：降低白色层不透明度，突出背后的实时模糊内容 */
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.12));
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);
  border: var(--lg-border);
  border-radius: 22px;
  box-shadow: var(--lg-shadow);
  padding: 6px 4px;
  z-index: 999;
}

/* ===== Apple Liquid Glass 实时反射层 ===== */
/* 顶部边缘高光 + 斜向镜面反射光；--lg-reflect-x 由滚动驱动实时流动 */
.mobile-tab-bar::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 2;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.38),
      rgba(255, 255, 255, 0.06) 42%,
      transparent 62%
    ),
    linear-gradient(
      115deg,
      transparent 22%,
      rgba(255, 255, 255, 0.5) 40%,
      rgba(255, 255, 255, 0.12) 47%,
      transparent 62%
    );
  background-size:
    100% 100%,
    220% 100%;
  background-position:
    0 0,
    var(--lg-reflect-x, 0%) 0;
  will-change: background-position;
}
.tab-glass-indicator {
  position: absolute;
  top: 6px;
  left: 0;
  height: calc(100% - 12px);
  border-radius: 16px;
  background: var(--lg-indicator-bg);
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: var(--lg-indicator-border);
  box-shadow: var(--lg-indicator-shadow);
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
  pointer-events: none;
  z-index: 0;
}

.mobile-tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 2px;
  text-decoration: none;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 500;
  border-radius: 14px;
  position: relative;
  z-index: 1;
  min-width: 0;
  transition:
    color 0.25s ease,
    transform 0.15s ease;
}

.mobile-tab-item.active {
  color: #6366f1;
}

.mobile-tab-item.active .mobile-tab-icon {
  transform: scale(1.1);
}

.mobile-tab-icon {
  font-size: 20px;
  line-height: 1;
  transition: transform 0.2s ease;
}

.mobile-tab-label {
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
