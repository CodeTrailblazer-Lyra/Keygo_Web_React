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
      // 全量本地打包：React / antd / icons / patch 不再走 CDN importmap，
      // 避免生产环境无法访问外部 CDN 导致页面一直卡在加载动画
      output: {
        // strictExecutionOrder：强制跨 chunk 按依赖顺序执行。
        // 若省略，react（CJS 包）的互操作辅助函数会与业务共享模块（如 src/api/request.ts）
        // 合入同一 chunk，形成 vendor ↔ request 跨 chunk 循环依赖，
        // 运行时报 "e is not a function"，页面卡在加载动画（已踩坑回退过一次）。
        // 开启后 rolldown 会把运行时辅助函数抽到独立的 rolldown-runtime-*.js 叶子 chunk，环自然消失。
        strictExecutionOrder: true,
        // 依赖分层拆包（按变更频率分桶，最大化浏览器长效缓存命中）：
        // - react-core: react / react-dom / scheduler —— 框架层，仅升级 React 时变（189KB / gz 60KB）
        // - antd:       antd / @ant-design(含 icons) / rc-* / dayjs —— UI 库层，仅升级依赖时变（932KB / gz 295KB）
        // - vendor:     其余三方（axios / zustand / react-router 等）—— 88KB / gz 32KB
        // 首访总字节与单 vendor 相同（均 ~1210KB raw），但三层并行加载、且业务迭代/小依赖升级
        // 不再让用户重新下载 1.2MB 的整包。已用 check-chunk-cycles.mjs + 无头 Chrome 实测验证。
        // 注：Vite 8 基于 rolldown，函数式 manualChunks 分组不生效，须使用原生 advancedChunks。
        advancedChunks: {
          groups: [
            {
              name: 'react-core',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'antd',
              test: /[\\/]node_modules[\\/](antd|@ant-design|@rc-component|rc-[^\\/]*|dayjs)[\\/]/,
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
            },
          ],
        },
      },
    },
  },
})
