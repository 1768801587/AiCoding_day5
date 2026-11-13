import { describe, expect, it, vi } from 'vitest'
import { DRAFT_KEY } from '../constants'
import { clearDraft, loadDraft, saveDraft } from './draft'

describe('草稿读写', () => {
  it('没有草稿时返回空字符串', () => {
    expect(loadDraft()).toBe('')
  })

  it('写入后可以读回，清空后彻底移除', () => {
    expect(saveDraft('写到一半的内容')).toBe(true)
    expect(localStorage.getItem(DRAFT_KEY)).toBe('写到一半的内容')
    expect(loadDraft()).toBe('写到一半的内容')

    clearDraft()

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
    expect(loadDraft()).toBe('')
  })

  it('存储异常时不抛出，读取回退为空字符串、写入返回 false', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(loadDraft()).toBe('')
    expect(saveDraft('x')).toBe(false)
  })

  it('清空失败时告警但不抛出', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(() => clearDraft()).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })
})
