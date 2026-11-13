import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { TOAST_DURATION } from '../constants'
import { resetToast, useToast } from './useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetToast()
  })

  afterEach(() => {
    resetToast()
  })

  it('初始状态为隐藏且无文案', () => {
    const toast = useToast()

    expect(toast.message.value).toBe('')
    expect(toast.isError.value).toBe(false)
    expect(toast.isVisible.value).toBe(false)
  })

  it('show 后立即可见并携带文案与默认非错误样式', () => {
    const toast = useToast()

    toast.show('发布成功')

    expect(toast.message.value).toBe('发布成功')
    expect(toast.isVisible.value).toBe(true)
    expect(toast.isError.value).toBe(false)
  })

  it('传入 error 时切换为错误样式', () => {
    const toast = useToast()

    toast.show('请输入动态内容', true)

    expect(toast.isError.value).toBe(true)
  })

  it(`${TOAST_DURATION}ms 后自动隐藏`, () => {
    const toast = useToast()

    toast.show('发布成功')
    vi.advanceTimersByTime(TOAST_DURATION - 1)
    expect(toast.isVisible.value).toBe(true)

    vi.advanceTimersByTime(1)
    expect(toast.isVisible.value).toBe(false)
  })

  it('连续调用会重置计时器，而不是叠加多个隐藏任务', () => {
    const toast = useToast()

    toast.show('第一次')
    vi.advanceTimersByTime(1500)
    toast.show('第二次')
    vi.advanceTimersByTime(1500)

    expect(toast.message.value).toBe('第二次')
    expect(toast.isVisible.value).toBe(true)

    vi.advanceTimersByTime(TOAST_DURATION - 1500)
    expect(toast.isVisible.value).toBe(false)
  })

  it('hide 可立即隐藏', () => {
    const toast = useToast()

    toast.show('发布成功')
    toast.hide()

    expect(toast.isVisible.value).toBe(false)
  })

  it('多个调用方共享同一个全局提示状态', () => {
    const first = useToast()
    const second = useToast()

    first.show('共享')

    expect(second.message.value).toBe('共享')
    expect(second.isVisible.value).toBe(true)
  })

  it('所在作用域销毁后不残留定时器', () => {
    const scope = effectScope()
    scope.run(() => {
      const toast = useToast()
      toast.show('作用域内提示')
    })

    scope.stop()

    expect(() => vi.advanceTimersByTime(TOAST_DURATION)).not.toThrow()
    expect(useToast().isVisible.value).toBe(false)
  })
})
