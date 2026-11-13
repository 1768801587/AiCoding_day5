import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useDayChange } from './useDayChange'

const setVisibility = (value: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true })
}

describe('useDayChange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 4, 1, 23, 59, 50))
    setVisibility('visible')
  })

  it('本地零点过后触发回调，并为次日重新排期', () => {
    const handler = vi.fn()
    const scope = effectScope()
    scope.run(() => useDayChange(handler))

    vi.advanceTimersByTime(11_000)
    expect(handler).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(86_400_000)
    expect(handler).toHaveBeenCalledTimes(2)

    scope.stop()
  })

  it('零点之前不会触发', () => {
    const handler = vi.fn()
    const scope = effectScope()
    scope.run(() => useDayChange(handler))

    vi.advanceTimersByTime(5_000)
    expect(handler).not.toHaveBeenCalled()

    scope.stop()
  })

  it('页面重新可见时补一次刷新', () => {
    const handler = vi.fn()
    const scope = effectScope()
    scope.run(() => useDayChange(handler))

    document.dispatchEvent(new Event('visibilitychange'))

    expect(handler).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('作用域销毁后既不触发回调也不残留定时器', () => {
    const handler = vi.fn()
    const scope = effectScope()
    scope.run(() => useDayChange(handler))

    scope.stop()
    vi.advanceTimersByTime(86_400_000 * 2)

    expect(handler).not.toHaveBeenCalled()
  })
})
