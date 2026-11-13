import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { NOW_TICK_MS } from '../constants'
import { resetNow, useNow } from './useNow'

const setVisibility = (value: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true })
}

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 4, 1, 12, 0))
    setVisibility('visible')
    resetNow(Date.now())
  })

  it('按分钟心跳自动前进', () => {
    const scope = effectScope()
    const now = scope.run(() => useNow())
    const start = Date.now()

    expect(now?.value).toBe(start)

    vi.advanceTimersByTime(NOW_TICK_MS)

    expect(now?.value).toBe(start + NOW_TICK_MS)
    scope.stop()
  })

  it('多个订阅者共享同一个定时器与同一份时间', () => {
    const scope = effectScope()
    const first = scope.run(() => useNow())
    const second = scope.run(() => useNow())
    const start = Date.now()

    vi.advanceTimersByTime(NOW_TICK_MS)

    expect(first).toBe(second)
    expect(first?.value).toBe(start + NOW_TICK_MS)
    scope.stop()
  })

  it('页面重新可见时立刻刷新，不需要等心跳', () => {
    const scope = effectScope()
    const now = scope.run(() => useNow())
    const start = Date.now()

    vi.advanceTimersByTime(20_000)
    expect(now?.value).toBe(start)

    document.dispatchEvent(new Event('visibilitychange'))

    expect(now?.value).toBe(start + 20_000)
    scope.stop()
  })

  it('作用域销毁后停止心跳', () => {
    const scope = effectScope()
    const now = scope.run(() => useNow())
    const start = Date.now()

    scope.stop()
    vi.advanceTimersByTime(NOW_TICK_MS * 3)

    expect(now?.value).toBe(start)
  })
})
