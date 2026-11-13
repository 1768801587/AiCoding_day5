import { getCurrentScope, onScopeDispose, shallowRef, type ShallowRef } from 'vue'
import { NOW_TICK_MS } from '../constants'

/**
 * 全局共享的「当前时间」。
 * 相对时间由多个动态卡片同时使用，用单例心跳避免每条动态各建一个定时器。
 */
const currentTime = shallowRef(Date.now())

let timer: ReturnType<typeof setInterval> | null = null
let subscribers = 0

function tick(): void {
  currentTime.value = Date.now()
}

function onVisibilityChange(): void {
  // 后台标签页的定时器可能被浏览器节流，回到前台时补一次
  if (document.visibilityState === 'visible') {
    tick()
  }
}

function start(): void {
  if (timer !== null) {
    return
  }
  tick()
  timer = setInterval(tick, NOW_TICK_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
}

function stop(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  document.removeEventListener('visibilitychange', onVisibilityChange)
}

/** 订阅当前时间（分钟级刷新），作用域销毁时自动释放引用。 */
export function useNow(): ShallowRef<number> {
  subscribers += 1
  start()

  if (getCurrentScope()) {
    onScopeDispose(() => {
      subscribers = Math.max(subscribers - 1, 0)
      if (subscribers === 0) {
        stop()
      }
    })
  }

  return currentTime
}

/** 重置共享状态（测试使用）。 */
export function resetNow(now: number = Date.now()): void {
  subscribers = 0
  stop()
  currentTime.value = now
}
