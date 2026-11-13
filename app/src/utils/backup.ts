import type { ImportResult, Post } from '../types'
import { filterValidPosts } from './post'

/**
 * 导出 / 导入的纯数据处理。
 * 与存储、DOM 完全解耦：输入文本，输出判别式结果，便于单独测试。
 */

/** 导出文件的结构，`version` 便于后续兼容升级。 */
export interface ExportPayload {
  app: 'mingle'
  version: 1
  exportedAt: string
  posts: Post[]
}

/** 把动态列表序列化为导出用的 JSON 文本。 */
export function serializePosts(posts: readonly Post[], exportedAt: number = Date.now()): string {
  const payload: ExportPayload = {
    app: 'mingle',
    version: 1,
    exportedAt: new Date(exportedAt).toISOString(),
    posts: [...posts],
  }

  return JSON.stringify(payload, null, 2)
}

/**
 * 解析导入文件内容。
 * 同时兼容导出结构（`{ posts: [...] }`）与旧式的纯数组文件，非法条目计数后丢弃。
 */
export function parseImport(text: string): ImportResult {
  if (text.trim() === '') {
    return { ok: false, error: 'EMPTY' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'INVALID_JSON' }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { posts?: unknown }).posts)
      ? ((parsed as { posts: unknown[] }).posts)
      : null

  if (list === null) {
    return { ok: false, error: 'INVALID_SHAPE' }
  }

  const posts = filterValidPosts(list)

  if (posts.length === 0) {
    return { ok: false, error: 'EMPTY' }
  }

  return { ok: true, posts, skipped: list.length - posts.length }
}
