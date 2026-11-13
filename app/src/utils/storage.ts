import { STORAGE_KEY } from '../constants'
import type { Post } from '../types'
import { filterValidPosts } from './post'

/**
 * 从 localStorage 读取动态列表。
 * 存储不可用或内容损坏时告警并回退为空数组，保证页面不会白屏。
 */
export function loadPosts(): Post[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    return filterValidPosts(JSON.parse(raw))
  } catch (error) {
    console.warn('[Mingle] 读取本地数据失败：', error)
    return []
  }
}

/** 将动态列表写回 localStorage，失败时告警并返回 false。 */
export function savePosts(posts: readonly Post[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
    return true
  } catch (error) {
    console.warn('[Mingle] 保存本地数据失败：', error)
    return false
  }
}
