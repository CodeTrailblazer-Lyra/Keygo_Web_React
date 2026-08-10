<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/AppLayout.vue'

const route = useRoute()
const auth = useAuthStore()

const showLayout = computed(() => route.meta.requiresAuth !== false && auth.isLoggedIn)

const themeOverrides = {
  common: {
    primaryColor: '#6366f1',
    primaryColorHover: '#818cf8',
    primaryColorPressed: '#4f46e5',
    primaryColorSuppl: '#818cf8',
    borderRadius: '10px',
  },
  Card: {
    borderRadius: '14px',
  },
  Button: {
    borderRadiusMedium: '8px',
    borderRadiusLarge: '10px',
    borderRadiusSmall: '6px',
  },
  Input: {
    borderRadius: '10px',
  },
  Tag: {
    borderRadius: '8px',
  },
  DataTable: {
    borderRadius: '14px',
  },
  Modal: {
    borderRadius: '16px',
  },
  Drawer: {
    borderRadius: '0',
  },
}

onMounted(() => {
  // 登录页不请求用户信息，避免失效会话触发 401 提示闪烁
  if (route.name !== 'login') {
    auth.fetchUser()
  }
})
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <n-message-provider>
            <AppLayout v-if="showLayout">
              <router-view v-slot="{ Component }">
                <transition name="page" mode="out-in">
                  <component :is="Component" />
                </transition>
              </router-view>
            </AppLayout>
            <router-view v-else v-slot="{ Component }">
              <transition name="page" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </n-message-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>
