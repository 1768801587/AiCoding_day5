import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '../constants'
import type { Post } from '../types'
import { loadPosts, savePosts } from './storage'

const sample: Post[] = [{ id: 'a', text: '第一条', createdAt: 1700000000000 }]

describe('loadPosts', () => {
  it('没有数据时返回空数组', () => {
    expect(loadPosts()).toEqual([])
  })

  it('读取并返回已存储的动态', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sample))

    expect(loadPosts()).toEqual(sample)
  })

  it('JSON 损坏时告警并回退为空数组', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, '{ broken json')

    expect(loadPosts()).toEqual([])
    expect(warn).toHaveBeenCalled()
  })

  it('存储内容不是数组时回退为空数组', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: 'not an array' }))

    expect(loadPosts()).toEqual([])
  })

  it('忽略数组中的脏数据', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...sample, null, { id: 'b' }, 42]),
    )

    expect(loadPosts()).toEqual(sample)
  })
})

describe('savePosts', () => {
  it('写入成功返回 true 并持久化到 localStorage', () => {
    expect(savePosts(sample)).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(sample)
  })

  it('写入失败时告警并返回 false（不抛出异常）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => savePosts(sample)).not.toThrow()
    expect(savePosts(sample)).toBe(false)
    expect(warn).toHaveBeenCalled()
  })
})
