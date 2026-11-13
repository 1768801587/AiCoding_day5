import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** 接口错误码，前端按码决定提示文案，不解析 message。 */
export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'EMPTY'
  | 'TOO_LONG'
  | 'INVALID_SHAPE'
  | 'LIMIT_REACHED'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL'

/** 错误码到 HTTP 状态码的唯一映射，路由层不重复写魔法数字。 */
export const API_ERROR_STATUS = {
  NOT_FOUND: 404,
  EMPTY: 400,
  TOO_LONG: 400,
  INVALID_SHAPE: 400,
  LIMIT_REACHED: 409,
  TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL: 500,
} as const satisfies Record<ApiErrorCode, ContentfulStatusCode>

/** 固定错误体结构，前端只需读取 `error.code`。 */
export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string }
}

/**
 * 统一错误响应：状态码由错误码推导，响应体固定为 `{ error: { code, message } }`。
 * 只在响应里放人类可读的说明，绝不带堆栈或原始异常信息。
 */
export function errorResponse(c: Context, code: ApiErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } }

  return c.json(body, API_ERROR_STATUS[code])
}
