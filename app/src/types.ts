/** 一条动态。字段与旧版 localStorage 数据结构完全一致。 */
export interface Post {
  id: string
  text: string
  createdAt: number
}

/** 发布失败的原因，由展示层决定对应文案。 */
export type PublishError = 'EMPTY' | 'TOO_LONG' | 'SAVE_FAILED'

/** 发布结果：成功时带回新动态，失败时带回原因。 */
export type PublishResult = { ok: true; post: Post } | { ok: false; error: PublishError }

/** 删除失败的原因，由展示层决定对应文案。 */
export type DeleteError = 'NOT_FOUND' | 'SAVE_FAILED'

/** 删除结果：与发布保持一致，不直接触发 UI。 */
export type DeleteResult = { ok: true } | { ok: false; error: DeleteError }

/** 动态流的时间范围筛选。 */
export type FilterRange = 'all' | 'today' | 'week' | 'month'

/** 动态流的筛选条件。 */
export interface FeedFilter {
  keyword: string
  range: FilterRange
}

/** 导入文件解析失败的原因。 */
export type ImportError = 'INVALID_JSON' | 'INVALID_SHAPE' | 'EMPTY' | 'TOO_LARGE'

/**
 * 导入解析结果：
 * 成功时带回可用动态与丢弃的脏条目数量，失败时带回原因。
 */
export type ImportResult =
  | { ok: true; posts: Post[]; skipped: number }
  | { ok: false; error: ImportError }

/**
 * 接口层错误码。
 * 前三个由客户端判定（网络中断、超时、响应不可用），其余直接沿用后端 `error.code`。
 */
export type ApiErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER'
  | 'NOT_FOUND'
  | 'EMPTY'
  | 'TOO_LONG'
  | 'INVALID_SHAPE'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'LIMIT_REACHED'

/** 接口调用结果：失败时带回错误码与真实 HTTP 状态码（无法拿到响应时为 0）。 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorCode; status: number }

/** 导入接口的写入汇总，`total` 为导入后服务端的动态总数。 */
export interface ImportSummary {
  imported: number
  skipped: number
  total: number
}

/** 导入动作的结果：成功时带回服务端计数，失败时带回接口错误码。 */
export type ImportOutcome =
  | { ok: true; imported: number; skipped: number }
  | { ok: false; error: ApiErrorCode }
