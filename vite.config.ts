import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
      // CDN 外部化：antd / icons / patch / react 系列通过 index.html importmap 加载
      external: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        'antd',
        '@ant-design/icons',
        '@ant-design/v5-patch-for-react-19',
      ],
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
