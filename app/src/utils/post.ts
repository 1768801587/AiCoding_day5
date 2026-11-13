import type { FeedFilter, Post } from '../types'

/** 单趟统计结果，供 store 的 getters 复用。 */
export interface PostStats {
  total: number
  today: number
  chars: number
}

/** 判断任意值是否是一条可用的动态（正文必须为字符串）。 */
export function isValidPost(value: unknown): value is Post {
  if (!value || typeof value !== 'object') {
    return false
  }
  return typeof (value as Partial<Post>).text === 'string'
}

/** 归一化点赞数：只接受有限非负数，其余（缺失、负数、NaN、字符串）一律归零。 */
function normalizeLikes(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * 过滤脏数据并把缺失字段归一化。
 * 保存时间未知的历史数据按 0 处理（排在列表末尾），缺失 id 时生成一个新 id。
 * 点赞/收藏字段缺失或类型不符时归零，避免历史数据与导入数据出现非法状态。
 */
export function filterValidPosts(value: unknown): Post[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isValidPost).map((post) => ({
    id: typeof post.id === 'string' && post.id !== '' ? post.id : createId(),
    text: post.text,
    createdAt: typeof post.createdAt === 'number' && Number.isFinite(post.createdAt)
      ? post.createdAt
      : 0,
    likes: normalizeLikes(post.likes),
    liked: post.liked === true,
    favorited: post.favorited === true,
  }))
}

/** 生成唯一 id：时间戳的 36 进制 + 随机后缀。 */
export function createId(now: number = Date.now()): string {
  return now.toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * 统计字数：按 Unicode 码点计数，emoji 等代理对算一个字。
 * 与 `String.prototype.length`（UTF-16 码元）不同，避免字数提示与实际字数不一致。
 */
export function countChars(text: string): number {
  return Array.from(text).length
}

/** 判断时间戳是否是可信的展示时间（未知时间统一为 0）。 */
export function isKnownTimestamp(timestamp: number): boolean {
  return Number.isFinite(timestamp) && timestamp > 0
}

/** 将时间戳格式化为 `YYYY-MM-DD HH:mm`（本地时区）。 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number): string => (value < 10 ? `0${value}` : String(value))

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** 只保留 `HH:mm`，供「昨天 08:30」这类短文案使用。 */
function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number): string => (value < 10 ? `0${value}` : String(value))

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 动态流使用的相对时间：
 * `刚刚` / `x 分钟前` / `x 小时前` / `昨天 HH:mm` / `MM-DD HH:mm` / `YYYY-MM-DD HH:mm`。
 * 时间缺失（`createdAt <= 0`）时返回「时间未知」，不再展示 1970 年。
 */
export function formatPostTime(timestamp: number, now: number = Date.now()): string {
  if (!isKnownTimestamp(timestamp)) {
    return '时间未知'
  }

  const diff = now - timestamp

  if (diff < 60_000) {
    return '刚刚'
  }

  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)} 分钟前`
  }

  if (diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)} 小时前`
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(new Date(timestamp), yesterday)) {
    return `昨天 ${formatClock(timestamp)}`
  }

  const date = new Date(timestamp)
  const nowDate = new Date(now)
  const pad = (value: number): string => (value < 10 ? `0${value}` : String(value))
  const monthDay = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${formatClock(timestamp)}`

  return date.getFullYear() === nowDate.getFullYear()
    ? monthDay
    : `${date.getFullYear()}-${monthDay}`
}

/** 判断两个时间是否落在同一本地日期。 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** 返回按创建时间倒序排列的新数组，不修改入参。 */
export function sortPostsDesc(posts: readonly Post[]): Post[] {
  return [...posts].sort((a, b) => b.createdAt - a.createdAt)
}

/** 各时间范围对应的起点时间戳（`all` 表示不限制）。 */
function rangeStart(range: FeedFilter['range'], now: number): number {
  switch (range) {
    case 'today': {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return start.getTime()
    }
    case 'week':
      return now - 7 * 86_400_000
    case 'month':
      return now - 30 * 86_400_000
    default:
      return Number.NEGATIVE_INFINITY
  }
}

/**
 * 按关键词、时间范围与「只看收藏」筛选动态，三者可任意组合。
 * 关键词做忽略大小写的子串匹配；无任何条件时直接返回原数组的浅拷贝。
 */
export function filterPosts(
  posts: readonly Post[],
  filter: FeedFilter,
  now: number = Date.now(),
): Post[] {
  const keyword = filter.keyword.trim().toLowerCase()
  const start = rangeStart(filter.range, now)
  const onlyFavorited = filter.onlyFavorited === true

  if (keyword === '' && start === Number.NEGATIVE_INFINITY && !onlyFavorited) {
    return [...posts]
  }

  return posts.filter((post) => {
    if (post.createdAt < start) {
      return false
    }
    if (onlyFavorited && post.favorited !== true) {
      return false
    }
    return keyword === '' || post.text.toLowerCase().includes(keyword)
  })
}

/** 统计总数、今日发布数与累计字数。 */
export function computeStats(posts: readonly Post[], now: Date = new Date()): PostStats {
  let today = 0
  let chars = 0

  for (const post of posts) {
    chars += countChars(post.text)
    if (isSameDay(new Date(post.createdAt), now)) {
      today += 1
    }
  }

  return { total: posts.length, today, chars }
}

/** 累计字数的展示文案：超过 9999 时以 k 为单位保留一位小数。 */
export function formatCharCount(chars: number): string {
  return chars > 9999 ? `${(chars / 1000).toFixed(1)}k` : String(chars)
}
