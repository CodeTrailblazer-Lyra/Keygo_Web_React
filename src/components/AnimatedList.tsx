import type { CSSProperties, ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  listAnimConfig,
  makeItemVariants,
  makeListVariants,
  type ListAnimConfig,
} from '@/anim/listAnim'
import type { AnimEffect } from '@/anim/motion'

interface AnimatedListProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** 覆盖默认动画配置（时长 / 延迟 / 缓动 / 位移） */
  config?: ListAnimConfig
  /** 入场过渡形式（up / right / left / scale / fade），默认沿用 config.effect */
  effect?: AnimEffect
}

/**
 * 列表容器：负责错峰入场编排（staggerChildren）。
 * - 子项须使用 <AnimatedItem> 承载各自的入场 / 退场动画
 * - 自动尊重 prefers-reduced-motion：降级为无动画的纯渲染
 */
export function AnimatedList({ children, className, style, config, effect }: AnimatedListProps) {
  const reduce = useReducedMotion()
  const cfg: ListAnimConfig = effect ? { ...(config ?? listAnimConfig), effect } : config ?? listAnimConfig
  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      className={className}
      style={style}
      variants={makeListVariants(cfg)}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </motion.div>
  )
}

interface AnimatedItemProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  config?: ListAnimConfig
  effect?: AnimEffect
  /** 是否对位置变化（增删 / 重排）启用 FLIP 过渡，默认开启 */
  layout?: boolean
}

/**
 * 列表项：承载渐显 / 位移入场与退出动画；
 * layout 开启时，增删或顺序变化会平滑过渡（FLIP），操作过程更直观。
 */
export function AnimatedItem({
  children,
  className,
  style,
  config,
  effect,
  layout = true,
}: AnimatedItemProps) {
  const reduce = useReducedMotion()
  const cfg: ListAnimConfig = effect ? { ...(config ?? listAnimConfig), effect } : config ?? listAnimConfig
  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      className={className}
      style={style}
      variants={makeItemVariants(cfg)}
      layout={layout}
      exit="exit"
    >
      {children}
    </motion.div>
  )
}
