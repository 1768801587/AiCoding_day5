import { describe, expect, it } from 'vitest'
import type { Post } from '../types'
import {
  computeStats,
  countChars,
  createId,
  filterPosts,
  filterValidPosts,
  formatCharCount,
  formatPostTime,
  formatTime,
  isKnownTimestamp,
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

describe('countChars', () => {
  it('按 Unicode 码点计数，中英文长度不受影响', () => {
    expect(countChars('')).toBe(0)
    expect(countChars('你好')).toBe(2)
    expect(countChars('abc')).toBe(3)
  })

  it('emoji 与生僻字只算一个字', () => {
    expect('😀'.length).toBe(2)
    expect(countChars('😀')).toBe(1)
    expect(countChars('今天😀好')).toBe(4)
    expect(countChars('𠮷')).toBe(1)
  })
})

describe('isKnownTimestamp', () => {
  it('0、负数与非有限值都视为未知时间', () => {
    expect(isKnownTimestamp(0)).toBe(false)
    expect(isKnownTimestamp(-1)).toBe(false)
    expect(isKnownTimestamp(Number.NaN)).toBe(false)
    expect(isKnownTimestamp(1700000000000)).toBe(true)
  })
})

describe('formatPostTime', () => {
  const now = new Date(2024, 4, 1, 12, 0).getTime()

  it('缺失时间显示为「时间未知」而不是 1970 年', () => {
    expect(formatPostTime(0, now)).toBe('时间未知')
    expect(formatPostTime(Number.NaN, now)).toBe('时间未知')
  })

  it('一分钟内显示「刚刚」，未来时间也不会出现负数', () => {
    expect(formatPostTime(now - 30_000, now)).toBe('刚刚')
    expect(formatPostTime(now + 5_000, now)).toBe('刚刚')
  })

  it('一小时内按分钟显示', () => {
    expect(formatPostTime(now - 5 * 60_000, now)).toBe('5 分钟前')
    expect(formatPostTime(now - 59 * 60_000, now)).toBe('59 分钟前')
  })

  it('一天内按小时显示', () => {
    expect(formatPostTime(now - 3 * 3_600_000, now)).toBe('3 小时前')
    expect(formatPostTime(now - 23 * 3_600_000, now)).toBe('23 小时前')
  })

  it('昨天的动态显示「昨天 HH:mm」', () => {
    const yesterday = new Date(2024, 3, 30, 8, 5).getTime()
    expect(formatPostTime(yesterday, now)).toBe('昨天 08:05')
  })

  it('同年更早的动态显示 MM-DD HH:mm，跨年补全年份', () => {
    expect(formatPostTime(new Date(2024, 1, 3, 9, 7).getTime(), now)).toBe('02-03 09:07')
    expect(formatPostTime(new Date(2023, 11, 31, 23, 59).getTime(), now)).toBe(
      '2023-12-31 23:59',
    )
  })
})

describe('filterPosts', () => {
  const now = new Date(2024, 4, 1, 12, 0).getTime()
  const posts: Post[] = [
    makePost({ id: 'today', text: '今天去爬山', createdAt: new Date(2024, 4, 1, 9, 0).getTime() }),
    makePost({ id: 'week', text: '周末看了电影', createdAt: new Date(2024, 3, 28, 9, 0).getTime() }),
    makePost({ id: 'month', text: '月初的日记', createdAt: new Date(2024, 3, 10, 9, 0).getTime() }),
    makePost({ id: 'old', text: '更早的旧动态', createdAt: new Date(2024, 0, 10, 9, 0).getTime() }),
  ]

  it('默认条件返回原数组的浅拷贝，不修改入参', () => {
    const result = filterPosts(posts, { keyword: '  ', range: 'all' }, now)

    expect(result.map((post) => post.id)).toEqual(['today', 'week', 'month', 'old'])
    expect(result).not.toBe(posts)
  })

  it('关键词做忽略大小写的子串匹配', () => {
    expect(filterPosts(posts, { keyword: '电影', range: 'all' }, now).map((p) => p.id)).toEqual([
      'week',
    ])
    expect(filterPosts(posts, { keyword: '日记', range: 'all' }, now).map((p) => p.id)).toEqual([
      'month',
    ])
  })

  it('today 只保留当天发布的动态', () => {
    expect(filterPosts(posts, { keyword: '', range: 'today' }, now).map((p) => p.id)).toEqual([
      'today',
    ])
  })

  it('week / month 按时间窗口过滤', () => {
    expect(filterPosts(posts, { keyword: '', range: 'week' }, now).map((p) => p.id)).toEqual([
      'today',
      'week',
    ])
    expect(filterPosts(posts, { keyword: '', range: 'month' }, now).map((p) => p.id)).toEqual([
      'today',
      'week',
      'month',
    ])
  })

  it('关键词与范围同时生效', () => {
    expect(
      filterPosts(posts, { keyword: '日记', range: 'today' }, now).map((post) => post.id),
    ).toEqual([])
  })

  it('无匹配时返回空数组', () => {
    expect(filterPosts(posts, { keyword: '不存在的词', range: 'all' }, now)).toEqual([])
  })
})
