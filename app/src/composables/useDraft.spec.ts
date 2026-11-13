import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { DRAFT_DEBOUNCE, DRAFT_KEY } from '../constants'
import { useDraft } from './useDraft'

describe('useDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  it('防抖写入草稿：未到时间不落盘', () => {
    const scope = effectScope()
    const draft = scope.run(() => useDraft())

    draft?.save('写到一半')
    vi.advanceTimersByTime(DRAFT_DEBOUNCE - 1)
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()

    vi.advanceTimersByTime(1)
    expect(localStorage.getItem(DRAFT_KEY)).toBe('写到一半')

    scope.stop()
  })

  it('连续输入只保存最后一次内容', () => {
    const scope = effectScope()
    const draft = scope.run(() => useDraft())

    draft?.save('a')
    vi.advanceTimersByTime(100)
    draft?.save('ab')
    vi.advanceTimersByTime(100)
    draft?.save('abc')

    vi.advanceTimersByTime(DRAFT_DEBOUNCE)

    expect(localStorage.getItem(DRAFT_KEY)).toBe('abc')
    scope.stop()
  })

  it('clear 立即移除草稿并取消待写入内容', () => {
    const scope = effectScope()
    const draft = scope.run(() => useDraft())

    draft?.save('待清空')
    draft?.clear()
    vi.advanceTimersByTime(DRAFT_DEBOUNCE * 2)

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
    scope.stop()
  })

  it('作用域销毁前 flush 未写入的草稿', () => {
    const scope = effectScope()
    const draft = scope.run(() => useDraft())

    draft?.save('还没来得及写')
    scope.stop()

    expect(localStorage.getItem(DRAFT_KEY)).toBe('还没来得及写')
  })

  it('load 读取已存在的草稿', () => {
    localStorage.setItem(DRAFT_KEY, '上次的内容')
    const scope = effectScope()
    const draft = scope.run(() => useDraft())

    expect(draft?.load()).toBe('上次的内容')
    scope.stop()
  })
})
