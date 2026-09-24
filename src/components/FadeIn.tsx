import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { contentVariants, type AnimEffect } from '@/anim/motion'

interface FadeInProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** 入场过渡形式：up 上移渐入 / fade 纯渐显 / scale 缩放 / right 左滑入 / left 右滑入 */
  effect?: AnimEffect
  /** 入场延迟（秒），用于制造层次感 */
  delay?: number
  /** 起始 Y 位移（px），仅 effect='up' 生效，默认 10；传 0 则纯渐显 */
  y?: number
  /** 起始 X 位移（px），仅 effect='right'/'left' 生效，默认 24 */
  x?: number
  /**
   * 是否在「首次挂载」时播放入场动画。
   * 页面级容器（已被整页滑动承载入场）建议设为 false，避免与页面滑动重叠造成双重动画；
   * 登录页等无整页滑动的场景保持默认 true，自身提供入场。
   */
  animateOnMount?: boolean
  /**
   * 刷新令牌：变化时重新触发一次渐入，用于「数据刷新时的状态过渡」。
   * 即便 animateOnMount=false，数据刷新仍会重播渐入（克制不扰民）。
   */
  refreshKey?: string | number
}

/**
 * 内容渐入容器：数据加载后平滑呈现、数据刷新时温和过渡。
 * 自动尊重系统「减少动效」偏好（由 App 根部的 MotionConfig reducedMotion="user" 也会接管，
 * 此处再显式降级为纯渲染，确保万无一失）。
 */
export function FadeIn({
  children,
  className,
  style,
  effect = 'up',
  delay = 0,
  y = 10,
  x = 24,
  animateOnMount = true,
  refreshKey,
}: FadeInProps) {
  const reduce = useReducedMotion()
  const controls = useAnimationControls()
  const prevKey = useRef<unknown>(refreshKey)
  const mounted = useRef(false)

  // 首帧：按 animateOnMount 决定是否播放入场
  useEffect(() => {
    if (reduce) return
    if (animateOnMount) {
      void controls.start('visible')
    } else {
      controls.set('visible')
    }
    mounted.current = true
    // 仅首帧执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 数据刷新：refreshKey 变化（非首次）时重播一次渐入
  useEffect(() => {
    if (reduce) return
    if (!mounted.current) return
    if (prevKey.current === refreshKey) return
    prevKey.current = refreshKey
    controls.set('hidden')
    void controls.start('visible')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

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
      variants={contentVariants(effect, { y, x, delay })}
      initial={animateOnMount ? 'hidden' : 'visible'}
      animate={controls}
    >
      {children}
    </motion.div>
  )
}
