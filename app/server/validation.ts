import { MAX_LENGTH } from '../src/constants'
import type { Post } from '../src/types'
import { countChars, filterValidPosts } from '../src/utils/post'

/** 校验失败时可能返回的错误码（均为 400 系列，交由 errors.ts 映射状态码）。 */
export type ValidationErrorCode = 'EMPTY' | 'TOO_LONG' | 'INVALID_SHAPE'

/** 发布校验结果。 */
export type CreateValidation =
  | { ok: true; text: string }
  | { ok: false; code: ValidationErrorCode }

/** 导入校验结果：skipped 为被丢弃的脏条目数量。 */
export type ImportValidation =
  | { ok: true; posts: Post[]; skipped: number }
  | { ok: false; code: ValidationErrorCode }

/** 判断是否为可解构的普通对象（排除 null 与数组）。 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 校验发布请求体。
 * 正文必须是非空字符串，字数按 Unicode 码点统计（emoji 算一个字），返回前去除首尾空白。
 * 纯函数、不抛异常，所有失败都用判别式结果表达。
 */
export function validateCreatePayload(payload: unknown): CreateValidation {
  if (!isPlainObject(payload) || typeof payload.text !== 'string') {
    return { ok: false, code: 'EMPTY' }
  }

  const text = payload.text.trim()

  if (text === '') {
    return { ok: false, code: 'EMPTY' }
  }

  if (countChars(text) > MAX_LENGTH) {
    return { ok: false, code: 'TOO_LONG' }
  }

  return { ok: true, text }
}

/**
 * 校验导入请求体。
 * 接受 `{ posts: [...] }` 与纯数组两种形状；脏条目直接丢弃并计入 skipped，
 * 缺 id 时补生成 id、缺 createdAt 时补 0（与前端导入逻辑保持一致）。
 */
export function validateImportPayload(payload: unknown): ImportValidation {
  let raw: unknown[]

  if (Array.isArray(payload)) {
    raw = payload
  } else if (isPlainObject(payload) && Array.isArray(payload.posts)) {
    raw = payload.posts
  } else {
    return { ok: false, code: 'INVALID_SHAPE' }
  }

  const posts = filterValidPosts(raw)

  if (posts.length === 0) {
    return { ok: false, code: 'EMPTY' }
  }

  return { ok: true, posts, skipped: raw.length - posts.length }
}
