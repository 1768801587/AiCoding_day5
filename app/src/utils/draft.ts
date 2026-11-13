import { DRAFT_KEY } from '../constants'

/**
 * 草稿的本地持久化。
 * 与动态列表分开存放，避免草稿写入污染动态数据；
 * 所有分支都不抛异常，存储不可用时静默降级。
 */

/** 读取草稿，异常或空内容时返回空字符串。 */
export function loadDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? ''
  } catch (error) {
    console.warn('[Mingle] 读取草稿失败：', error)
    return ''
  }
}

/** 写入草稿，失败时告警并返回 false（草稿丢失不应打断输入）。 */
export function saveDraft(text: string): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, text)
    return true
  } catch (error) {
    console.warn('[Mingle] 保存草稿失败：', error)
    return false
  }
}

/** 清空草稿。 */
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch (error) {
    console.warn('[Mingle] 清空草稿失败：', error)
  }
}
