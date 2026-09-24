/**
 * 修复「关闭弹窗后整页无法点击（交互失效）」缺陷。
 *
 * 现象：点击「立即获取」等按钮打开 Modal，关闭后页面所有可点击元素失去响应，
 * 彷佛被一层透明遮罩覆盖。
 *
 * 根因（antd v5 + React 19）：
 *   antd 的 Modal 在关闭时依赖「离场动画结束 → 触发 afterClose → 卸载遮罩 Portal」。
 *   在 React 19 的渲染时序下，该离场动画/卸载链路偶发未正常完成，导致：
 *     1) `.ant-modal-mask` 遮罩根节点（`.ant-modal-root`）残留于 DOM——
 *        它是一块覆盖全视口、pointer-events:auto 的透明层，从而整页无法点击；
 *     2) `@rc-component/portal` 的滚动锁定（向 <head> 注入
 *        `<style id="rc-util-locker-...">html body{overflow-y:hidden}</style>`）残留，
 *        使页面滚动被锁死。
 *   此外历史版本曾用 `ant-scrolling-effect` 类（仅作用于 <body>）做滚动锁定，
 *   在本应用真实滚动容器为 <html> 时本身无效，属于失效逻辑，需一并清理。
 *
 * 方案：关闭弹窗后「主动兜底清理」——移除残留遮罩与滚动锁定，恢复页面交互与滚动。
 *   该清理幂等、可重复调用；不依赖 antd 自身的 afterClose（其仅在离场动画完成时触发，
 *   若动画未触发则不会执行），因此在 antd 卸载时序异常时仍能恢复页面可用性。
 *
 * 使用方式：
 *   - 每个 <Modal> 加 `destroyOnClose` + `afterClose={releaseModalOverlay}`；
 *   - 组件顶层调用 `useModalOverlayCleanup(open)`（open 由 true→false 后延迟兜底清理）。
 */

import { useEffect } from 'react'

let initialized = false

/**
 * 强制释放可能残留的弹窗「滚动锁定」，恢复页面滚动与交互能力。
 * 幂等、可重复调用，且**绝不移除任何 React 仍在管理的 DOM 节点**——
 * antd 的弹窗 Portal（.ant-modal-root）由 React 负责卸载，若此处主动 removeChild，
 * 会与 antd 后续卸载产生冲突（React 抛出 NotFoundError 并卸载整棵树，表现为「页面卡在加载」）。
 * 因此本函数只做安全的样式/类清理，对残留遮罩仅做「非破坏性中和」（隐藏 + 解除事件拦截），
 * 由 React 自行完成最终的 DOM 移除。
 */
export function releaseModalOverlay(): void {
  if (typeof document === 'undefined') return

  // 1) 清除 @rc-component/portal 注入的滚动锁定样式（id 形如 rc-util-locker-<ts>_<n>）
  document
    .querySelectorAll('style[id^="rc-util-locker-"]')
    .forEach((el) => el.remove())

  // 2) 清除滚动锁定类与内联样式（兼容不同 antd 版本 / 真实滚动容器为 <html> 的场景）
  document.body.classList.remove('ant-scrolling-effect')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('overflow-y')
  document.body.style.removeProperty('overflow-x')
  document.body.style.removeProperty('width')
  document.documentElement.style.removeProperty('overflow')
  document.documentElement.style.removeProperty('overflow-y')
  document.documentElement.style.removeProperty('overflow-x')

  // 3) 对「已完全关闭却残留于 DOM」的弹窗根做**非破坏性中和**：
  //    仅将其隐藏并解除 pointer-events 拦截，避免遮挡点击；
  //    不直接 removeChild（否则会与 antd/React 的 Portal 卸载冲突导致整页崩溃）。
  //    正常卸载流程下此处查询不到节点，为空操作。
  document
    .querySelectorAll('.ant-modal-root, .ant-dialog-root')
    .forEach((root) => {
      const mask = root.querySelector(
        '.ant-modal-mask, .ant-dialog-mask',
      ) as HTMLElement | null
      const dialog = root.querySelector(
        '.ant-modal, .ant-dialog',
      ) as HTMLElement | null
      const maskHidden =
        !mask || parseFloat(getComputedStyle(mask).opacity || '1') === 0
      const dialogHidden = !dialog || getComputedStyle(dialog).display === 'none'
      if (maskHidden && dialogHidden) {
        // 非破坏性：仅隐藏并解除拦截，不移除节点
        ;(root as HTMLElement).style.setProperty('display', 'none', 'important')
        ;(root as HTMLElement).style.setProperty(
          'pointer-events',
          'none',
          'important',
        )
      }
    })
}

/**
 * 监听弹窗开启状态：当 open 由 true 变为 false（关闭瞬间）后，
 * 延迟一小段时间兜底清理遮罩与滚动锁定，确保即便 antd 卸载时序异常，
 * 页面交互也能被恢复。延迟略大于 Modal 离场动画时长，避免误删仍在正常淡出的弹窗。
 * 需在组件顶层无条件调用（遵循 Hooks 规则）。
 */
export function useModalOverlayCleanup(open: boolean): void {
  useEffect(() => {
    if (open) return
    // 分两档触发：先覆盖正常淡出尾段，再覆盖异常卡顿/延迟场景
    const t1 = window.setTimeout(releaseModalOverlay, 300)
    const t2 = window.setTimeout(releaseModalOverlay, 700)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [open])
}

/**
 * 应用启动时调用一次的入口（main.tsx 已调用）。
 *
 * 作用：监听 `ant-scrolling-effect` 类（antd 滚动锁定标志，可能出现在 <html>、<body>
 * 或任意后代节点上，取决于 antd / rc-util 版本与真实滚动容器）的增删，
 * 同步将**真实滚动容器 <html>** 的 overflow 锁死 / 释放。
 *
 * 为什么需要：本应用真实可滚动容器是 <html>。仅锁 <body>（antd 默认行为）在本应用无效，
 * 导致弹窗（含「使用单位」下拉）打开时底层根页面仍可触摸滚动，下拉与底部发生同步滑动。
 * 既有 `:has()` 纯 CSS 方案覆盖不到「类直接挂在 <html> 自身」的情形，故此处用 JS 兜底，
 * 保证任何版本下弹窗打开期间根页面都无法滚动，彻底消除滚动穿透 / 同步滑动卡顿。
 */
export function initModalScrollLock(): void {
  if (initialized || typeof document === 'undefined') return
  initialized = true

  const sync = () => {
    const locked =
      document.documentElement.classList.contains('ant-scrolling-effect') ||
      document.body.classList.contains('ant-scrolling-effect')
    document.documentElement.style.overflow = locked ? 'hidden' : ''
  }

  // 监听 <html> 及其所有后代的 class 变化（attributeFilter 仅关注 class，开销可控）
  const mo = new MutationObserver(sync)
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true,
  })
  sync()
}
