import type { Post } from '../types'

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

/**
 * 过滤脏数据并把缺失字段归一化。
 * 保存时间未知的历史数据按 0 处理（排在列表末尾），缺失 id 时生成一个新 id。
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
  }))
}

/** 生成唯一 id：时间戳的 36 进制 + 随机后缀。 */
export function createId(now: number = Date.now()): string {
  return now.toString(36) + Math.random().toString(36).slice(2, 8)
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

/** 统计总数、今日发布数与累计字数。 */
export function computeStats(posts: readonly Post[], now: Date = new Date()): PostStats {
  let today = 0
  let chars = 0

  for (const post of posts) {
    chars += post.text.length
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
