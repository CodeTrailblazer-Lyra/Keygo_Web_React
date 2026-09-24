import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { easings } from '@/anim/motion'

interface AnimatedNumberProps {
  value: number
  className?: string
  /** 数字变化的补间时长（秒），默认 0.6 */
  duration?: number
  /** 是否使用千分位分隔符，默认 true */
  group?: boolean
}

/**
 * 数字补间组件：数值变化时以缓动补间「滚动」到新值，
 * 用于统计卡片等「状态变化」场景，比静态跳变更有生命感。
 * 缓动必须单调无过冲（easings.smooth）：回弹曲线会让数字先滚过目标值再回落，观感错误。
 * 自动尊重系统「减少动效」偏好（直接显示终值，不补间）。
 */
export function AnimatedNumber({ value, className, duration = 0.6, group = true }: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    if (fromRef.current === value) {
      setDisplay(value)
      return
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: easings.smooth,
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    fromRef.current = value
    return () => controls.stop()
  }, [value, duration, reduce])

  const text = group ? display.toLocaleString('en-US') : String(display)
  return <span className={className}>{text}</span>
}
