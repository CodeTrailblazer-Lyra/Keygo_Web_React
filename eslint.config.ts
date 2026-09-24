import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import skipFormatting from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  js.configs.recommended,
  tseslint.configs.recommended,

  reactHooks.configs.flat.recommended,

  {
    // 构建脚本运行于 Node 环境：补充 Node 全局对象声明
    name: 'app/node-scripts',
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },

  {
    rules: {
      // useLayoutEffect 中做 DOM 测量后同步 setState（导航指示器位置、字号自适应等）
      // 是避免视觉闪烁的标准模式，该规则过于严格，予以关闭
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  skipFormatting,
)
