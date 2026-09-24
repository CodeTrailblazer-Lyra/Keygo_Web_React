import type { Transition, Variants } from 'motion/react'

/**
 * 全局动效令牌 —— 集中定义时长与缓动，全应用统一节奏（对齐 Ant Design 设计语言）。
 * 修改此文件即可同步影响所有接入的动画，避免各处硬编码导致风格分裂。
 *
 * 设计原则：
 * - 时长分层（instant → slow）让「反馈 / 入场 / 强调」各有轻重；
 * - 缓动按用途区分（out 入场、inOut 持续、emphasis 回弹、gentle 次级）；
 * - 过渡形式由 AnimEffect 决定（上移 / 纯渐显 / 缩放 / 左右滑入），
 *   不同场景用不同形式，但共享同一套时长与缓动，观感协调而不单调。
 */
export const durations = {
  /** 即时反馈（按压 / 开关）：极短，不让人等待（配合整体舒缓节奏略放缓） */
  instant: 0.18,
  /** 轻量反馈（图标 / 小元素入场）：舒展从容 */
  fast: 0.28,
  /** 次级过渡（刷新淡入、列表项） */
  micro: 0.3,
  /** 常规过渡（内容渐入 / 展开收起）：放慢以营造舒缓自然的节奏 */
  base: 0.42,
  /** 页面切换（入 / 出两端各约此值，mode=wait 下总耗时翻倍仍克制） */
  page: 0.34,
  /** 强调过程（配合强回弹缓动，Q 弹弹出） */
  slow: 0.6,
} as const

/** 统一缓动曲线（cubic-bezier 四元组，均带过冲回弹以体现「Q 弹」质感） */
export const easings = {
  /** 弹性 easeOut（easeOutBack）：起步快、收尾带回弹过冲，自然 Q 弹，用于绝大多数入场 / 反馈 */
  out: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  /** 标准 easeInOut：对称，适合持续 / 退出过程，干净收尾不回弹，避免退场时晃动 */
  inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
  /** 强回弹缓动（easeOutBack 强化）：过冲更明显，仅用于关键弹出 / 强调，强化「Q 弹」反馈 */
  emphasis: [0.34, 1.8, 0.5, 1] as [number, number, number, number],
  /** 柔和回弹 easeOut（easeOutBack 轻量版）：比 out 更克制，用于次级元素，避免与主体抢戏 */
  gentle: [0.34, 1.34, 0.64, 1] as [number, number, number, number],
  /** 单调 easeOut（easeOutExpo 形态，无过冲）：用于数值补间等「不可越过目标值」的场景，与 CSS --ease-out 一致 */
  smooth: [0.16, 1, 0.3, 1] as [number, number, number, number],
}

/** 可用的过渡形式（入场 / 状态变化的视觉语言） */
export type AnimEffect = 'up' | 'fade' | 'scale' | 'right' | 'left'

type EffectTarget = {
  opacity: number
  y?: number
  x?: number
  scale?: number
  transition?: Transition
}

/**
 * 生成一个内容块的「隐藏 → 显示」variants。
 * 通过 effect 选择不同的过渡形式，配合统一的时长与缓动，
 * 让不同区块（卡片、列表、统计）各有其动效语言，又不失整体协调。
 */
export function contentVariants(
  effect: AnimEffect = 'up',
  opts: { y?: number; x?: number; duration?: number; delay?: number; ease?: [number, number, number, number] } = {},
): Variants {
  const { y = 10, x = 24, duration = durations.base, delay = 0, ease = easings.out } = opts
  const hidden: EffectTarget = { opacity: 0 }
  const visible: EffectTarget = { opacity: 1 }

  switch (effect) {
    case 'up':
      hidden.y = y
      visible.y = 0
      break
    case 'right': // 自左侧滑入（起始偏左，向右归位）
      hidden.x = -x
      visible.x = 0
      break
    case 'left': // 自右侧滑入（起始偏右，向左归位）
      hidden.x = x
      visible.x = 0
      break
    case 'scale': // 轻微放大归位（用于强调元素 / 弹出内容）
      hidden.scale = 0.96
      visible.scale = 1
      break
    case 'fade': // 纯渐显，无任何位移（用于数据刷新等需克制处）
    default:
      break
  }

  visible.transition = { duration, ease, delay }
  return { hidden, visible } as Variants
}

/**
 * 页面切换：整页「左右滑动」，方向由导航层级（路由顺序）决定。
 * - 配合 mode="wait"：旧页面完整退场后新页面再入场，同一时刻仅一个页面在 DOM，
 *   彻底避免 antd Table 等重型内容被同时挂载两份导致的掉帧 / 卡顿，渲染性能显著更优；
 * - 无重叠 → 无闪烁 / 错位 / 残留状态，过渡仍为整页左右滑动，观感连贯；
 * - 位移幅度克制（≤16%），仅 transform + opacity 合成（GPU 友好，不触发重排）；
 * - 缓动用平滑 easeInOut（页面级滑动不回弹，避免晃动），退场略快于入场让切换更利落。
 * - dir > 0（前进 / 导航到更靠后的页）：新页自右侧入场、旧页向左侧退场 → 整体向左滑。
 * - dir < 0（后退 / 导航到更靠前的页）：新页自左侧入场、旧页向右侧退场 → 整体向右滑。
 */
export const slideVariants: Variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '16%' : '-16%',
    opacity: 0,
    transition: { duration: durations.page, ease: easings.inOut },
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: durations.page, ease: easings.inOut },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? '-16%' : '16%',
    opacity: 0,
    transition: { duration: durations.page * 0.7, ease: easings.inOut },
  }),
}

/** 页面滑动过渡（兜底默认值；具体时长 / 缓动以 slideVariants 内嵌为准） */
export const pageSlideTransition: Transition = {
  duration: durations.page,
  ease: easings.inOut,
}
