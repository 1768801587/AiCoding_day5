import { describe, expect, it } from 'vitest'
import type { Post } from '../types'
import {
  computeStats,
  createId,
  filterValidPosts,
  formatCharCount,
  formatTime,
  isSameDay,
  isValidPost,
  sortPostsDesc,
} from './post'

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'p1',
  text: 'hello',
  createdAt: 0,
  ...overrides,
})

describe('formatTime', () => {
  it('格式化为 YYYY-MM-DD HH:mm 并补零', () => {
    const timestamp = new Date(2024, 0, 5, 7, 8).getTime()
    expect(formatTime(timestamp)).toBe('2024-01-05 07:08')
  })

  it('两位数的月日时分不重复补零', () => {
    const timestamp = new Date(2024, 10, 23, 18, 45).getTime()
    expect(formatTime(timestamp)).toBe('2024-11-23 18:45')
  })
})

describe('isSameDay', () => {
  it('同一天的不同时刻判定为同一天', () => {
    expect(isSameDay(new Date(2024, 4, 1, 0, 0), new Date(2024, 4, 1, 23, 59))).toBe(true)
  })

  it('跨日、跨月、跨年均判定为不同天', () => {
    expect(isSameDay(new Date(2024, 4, 1, 23, 59), new Date(2024, 4, 2, 0, 0))).toBe(false)
    expect(isSameDay(new Date(2024, 4, 1), new Date(2024, 5, 1))).toBe(false)
    expect(isSameDay(new Date(2023, 4, 1), new Date(2024, 4, 1))).toBe(false)
  })
})

describe('isValidPost', () => {
  it('接受拥有字符串正文的对象', () => {
    expect(isValidPost(makePost())).toBe(true)
  })

  it('拒绝 null、非对象与缺少正文的条目', () => {
    expect(isValidPost(null)).toBe(false)
    expect(isValidPost('text')).toBe(false)
    expect(isValidPost({ id: 'x', createdAt: 1 })).toBe(false)
    expect(isValidPost({ text: 123 })).toBe(false)
  })
})

describe('filterValidPosts', () => {
  it('非数组输入回退为空数组', () => {
    expect(filterValidPosts(null)).toEqual([])
    expect(filterValidPosts({ text: 'a' })).toEqual([])
    expect(filterValidPosts('[]')).toEqual([])
  })

  it('过滤脏条目，只保留合法动态', () => {
    const result = filterValidPosts([
      { id: 'a', text: 'ok', createdAt: 1 },
      null,
      { id: 'b', createdAt: 2 },
      { id: 'c', text: 'still ok', createdAt: 3 },
    ])

    expect(result.map((post) => post.id)).toEqual(['a', 'c'])
  })

  it('缺失时间戳时归一化为 0，缺失 id 时补一个非空 id', () => {
    const [post] = filterValidPosts([{ text: 'only text' }])

    expect(post?.createdAt).toBe(0)
    expect(typeof post?.id).toBe('string')
    expect(post?.id).not.toBe('')
  })
})

describe('sortPostsDesc', () => {
  it('按创建时间倒序排列且不修改原数组', () => {
    const posts = [
      makePost({ id: 'old', createdAt: 1 }),
      makePost({ id: 'new', createdAt: 3 }),
      makePost({ id: 'mid', createdAt: 2 }),
    ]

    const sorted = sortPostsDesc(posts)

    expect(sorted.map((post) => post.id)).toEqual(['new', 'mid', 'old'])
    expect(posts.map((post) => post.id)).toEqual(['old', 'new', 'mid'])
  })
})

describe('computeStats', () => {
  it('统计总数、今日发布数与累计字数', () => {
    const now = new Date(2024, 4, 1, 12, 0)
    const posts = [
      makePost({ id: 'a', text: 'abcd', createdAt: new Date(2024, 4, 1, 9, 0).getTime() }),
      makePost({ id: 'b', text: 'ef', createdAt: new Date(2024, 4, 1, 10, 0).getTime() }),
      makePost({ id: 'c', text: 'ghi', createdAt: new Date(2024, 3, 30, 10, 0).getTime() }),
    ]

    expect(computeStats(posts, now)).toEqual({ total: 3, today: 2, chars: 9 })
  })

  it('空列表统计全为 0', () => {
    expect(computeStats([], new Date(2024, 4, 1))).toEqual({ total: 0, today: 0, chars: 0 })
  })
})

describe('formatCharCount', () => {
  it('一万以内原样展示', () => {
    expect(formatCharCount(0)).toBe('0')
    expect(formatCharCount(9999)).toBe('9999')
  })

  it('超过 9999 时以 k 为单位保留一位小数', () => {
    expect(formatCharCount(10000)).toBe('10.0k')
    expect(formatCharCount(12345)).toBe('12.3k')
  })
})

describe('createId', () => {
  it('同一毫秒内也能生成不同 id', () => {
    const now = 1700000000000
    const first = createId(now)
    const second = createId(now)

    expect(first).not.toBe(second)
    expect(first.startsWith(now.toString(36))).toBe(true)
  })
})
