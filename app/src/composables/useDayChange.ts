import { getCurrentScope, onScopeDispose } from 'vue'

/**
 * 在本地时间跨过零点时触发一次回调（用于刷新「今日发布」统计）。
 * 除零点定时器外，页面重新可见时也补一次回调，覆盖后台标签页被节流的情况。
 */
export function useDayChange(handler: () => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedule(): void {
    clearTimer()

    const now = Date.now()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 0, 0)

    // 多加 1 秒，避免定时器在 23:59:59.999 提前触发
    const delay = Math.max(nextMidnight.getTime() - now, 0) + 1000

    timer = setTimeout(() => {
      handler()
      schedule()
    }, delay)
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      handler()
    }
  }

  schedule()
  document.addEventListener('visibilitychange', onVisibilityChange)

  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearTimer()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    })
  }
}
