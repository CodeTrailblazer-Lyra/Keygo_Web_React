import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:18080',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // vue/vue-router/pinia 走阿里云 CDN（importmap）；naive-ui 及其依赖本地打包
      external: ['vue', 'vue-router', 'pinia'],
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            return 'naive-ui'
          }
        },
      },
    },
  },
})
