import type { Transition, Variants } from 'motion/react'
import { type AnimEffect, easings } from '@/anim/motion'

/**
 * 列表动画可配置项 —— 集中管理，便于全局统一调整动效风格。
 * 修改此对象即可同步影响所有接入 AnimatedList 的列表。
 * 新增 effect：列表项入场形式（up 上移 / right 左滑入 / left 右滑入 / scale 缩放 / fade 纯渐显），
 * 让不同列表在「错峰入场」这一统一语言下各自呈现差异化的视觉层次。
 */
export interface ListAnimConfig {
  /** 单项动画时长（秒） */
  duration: number
  /** 相邻项之间的错峰延迟（秒），营造层次感 */
  stagger: number
  /** 列表整体入场前的初始延迟（秒） */
  delayChildren: number
  /** 缓动曲线（cubic-bezier 四元组），对齐 Ant Design easeOut 令牌 */
  ease: [number, number, number, number]
  /** 入场起始 Y 偏移（px），仅 up 生效 */
  yOffset: number
  /** 入场起始 X 偏移（px），仅 right / left 生效 */
  xOffset: number
  /** 入场过渡形式 */
  effect: AnimEffect
}

/** 默认配置：放慢时长 + 弹性 easeOut（easeOutBack）+ 上移入场，节奏舒缓且带 Q 弹回弹 */
export const listAnimConfig: ListAnimConfig = {
  duration: 0.5,
  stagger: 0.07,
  delayChildren: 0.06,
  ease: [0.34, 1.56, 0.64, 1],
  yOffset: 16,
  xOffset: 28,
  effect: 'up',
}

/** 列表容器 variants：通过 staggerChildren 让子项依次出现 */
export function makeListVariants(cfg: ListAnimConfig = listAnimConfig): Variants {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: cfg.stagger,
        delayChildren: cfg.delayChildren,
      },
    },
  }
}

type ItemTarget = {
  opacity: number
  y?: number
  x?: number
  scale?: number
  transition?: Transition
}

/** 列表项 variants：渐显 + 位移入场，并支持删除时的退出动画 */
export function makeItemVariants(cfg: ListAnimConfig = listAnimConfig): Variants {
  const hidden: ItemTarget = { opacity: 0 }
  const visible: ItemTarget = { opacity: 1 }
  const exit: ItemTarget = { opacity: 0 }

  switch (cfg.effect) {
    case 'up':
      hidden.y = cfg.yOffset
      visible.y = 0
      exit.y = -cfg.yOffset
      break
    case 'right': // 自左侧滑入
      hidden.x = -cfg.xOffset
      visible.x = 0
      exit.x = cfg.xOffset
      break
    case 'left': // 自右侧滑入
      hidden.x = cfg.xOffset
      visible.x = 0
      exit.x = -cfg.xOffset
      break
    case 'scale':
      hidden.scale = 0.96
      visible.scale = 1
      exit.scale = 0.96
      break
    case 'fade':
    default:
      break
  }

  visible.transition = { duration: cfg.duration, ease: cfg.ease }
  exit.transition = { duration: cfg.duration * 0.5, ease: easings.inOut }
  return { hidden, visible, exit } as Variants
}
