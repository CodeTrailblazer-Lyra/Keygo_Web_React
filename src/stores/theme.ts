import { create } from 'zustand'

export type ThemeMode = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'keygo-theme-mode'

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'auto' || v === 'light' || v === 'dark') return v
  } catch {
    /* localStorage 不可用时忽略 */
  }
  return 'auto'
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function applyToDocument(isDark: boolean) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

interface ThemeState {
  /** 用户选择的模式：自动跟随系统 / 浅色 / 暗色，默认 auto */
  mode: ThemeMode
  /** 实际生效的暗色状态（auto 模式下由系统偏好决定） */
  isDark: boolean
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readStoredMode(),
  isDark: false,
  setMode: (mode) => {
    const isDark = mode === 'dark' || (mode === 'auto' && systemPrefersDark())
    set({ mode, isDark })
    applyToDocument(isDark)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* 忽略持久化失败 */
    }
  },
}))

/** 启动时读取 localStorage 恢复偏好并应用到 DOM（index.html 内联脚本已提前设置防闪白） */
export function initTheme() {
  const mode = useThemeStore.getState().mode
  const isDark = mode === 'dark' || (mode === 'auto' && systemPrefersDark())
  useThemeStore.setState({ mode, isDark })
  applyToDocument(isDark)
}

// 启动即初始化
initTheme()

// 系统主题变化时，「自动」模式实时跟随
if (typeof window !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      const { mode, setMode } = useThemeStore.getState()
      if (mode === 'auto') setMode('auto')
    })
}
