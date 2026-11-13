import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MAX_LENGTH, STORAGE_KEY } from '../constants'
import type { Post } from '../types'
import { usePostsStore } from './posts'

const storedPosts: Post[] = [
  { id: 'old', text: '旧动态', createdAt: new Date(2024, 3, 1, 9, 0).getTime() },
  { id: 'new', text: '新动态', createdAt: new Date(2024, 4, 1, 10, 0).getTime() },
]

const readStorage = (): unknown => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')

describe('usePostsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('hydrate', () => {
    it('没有本地数据时保持空列表', () => {
      const store = usePostsStore()

      store.hydrate()

      expect(store.posts).toEqual([])
      expect(store.totalCount).toBe(0)
    })

    it('读取本地数据并按时间倒序暴露 orderedPosts', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPosts))
      const store = usePostsStore()

      store.hydrate()

      expect(store.totalCount).toBe(2)
      expect(store.orderedPosts.map((post) => post.id)).toEqual(['new', 'old'])
    })

    it('读取过程中不会反向写入存储', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPosts))
      const setItem = vi.spyOn(Storage.prototype, 'setItem')

      usePostsStore().hydrate()

      expect(setItem).not.toHaveBeenCalled()
    })
  })

  describe('统计 getters', () => {
    it('暴露总数、今日发布数与累计字数文案', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 4, 1, 12, 0))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPosts))
      const store = usePostsStore()

      store.hydrate()

      expect(store.totalCount).toBe(2)
      expect(store.todayCount).toBe(1)
      expect(store.charStatLabel).toBe(String('旧动态'.length + '新动态'.length))
    })
  })

  describe('publish', () => {
    it('空内容返回 EMPTY 且不写入存储', () => {
      const store = usePostsStore()
      store.hydrate()

      expect(store.publish('   ')).toEqual({ ok: false, error: 'EMPTY' })
      expect(store.posts).toEqual([])
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it(`超过 ${MAX_LENGTH} 字返回 TOO_LONG 且不写入存储`, () => {
      const store = usePostsStore()
      store.hydrate()

      expect(store.publish('a'.repeat(MAX_LENGTH + 1))).toEqual({
        ok: false,
        error: 'TOO_LONG',
      })
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it(`${MAX_LENGTH} 字是允许的边界`, () => {
      const store = usePostsStore()
      store.hydrate()

      const result = store.publish('a'.repeat(MAX_LENGTH))

      expect(result.ok).toBe(true)
      expect(store.posts).toHaveLength(1)
    })

    it('保存去除首尾空白的正文并带上当前时间戳', () => {
      vi.useFakeTimers()
      const now = new Date(2024, 4, 1, 12, 30).getTime()
      vi.setSystemTime(now)
      const store = usePostsStore()
      store.hydrate()

      const result = store.publish('  今天天气不错  ')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.post.text).toBe('今天天气不错')
      expect(result.post.createdAt).toBe(now)
      expect(store.posts[0]).toMatchObject({ text: '今天天气不错', createdAt: now })
    })

    it('先落盘再更新 state，保证刷新后数据仍在', () => {
      const store = usePostsStore()
      store.hydrate()

      store.publish('第一条')

      expect(store.posts).toHaveLength(1)
      expect(readStorage()).toEqual(store.posts)
    })

    it('存储失败时返回 SAVE_FAILED 且不破坏已有列表', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPosts.slice(0, 1)))
      const store = usePostsStore()
      store.hydrate()
      const before = store.posts

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      expect(store.publish('写不进去')).toEqual({ ok: false, error: 'SAVE_FAILED' })
      expect(store.posts).toBe(before)
      expect(store.posts).toHaveLength(1)
    })

    it('连续发布后列表按时间倒序且 key 唯一', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 4, 1, 8, 0))
      const store = usePostsStore()
      store.hydrate()

      store.publish('早')
      vi.setSystemTime(new Date(2024, 4, 1, 9, 0))
      store.publish('晚')

      expect(store.orderedPosts.map((post) => post.text)).toEqual(['晚', '早'])
      const ids = store.posts.map((post) => post.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})
