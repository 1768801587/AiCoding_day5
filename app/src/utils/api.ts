import type { ApiErrorCode, ApiResult, ImportSummary, Post } from '../types'
import { filterValidPosts, isValidPost } from './post'

export interface ApiClientOptions {
  /** 接口基址，默认取 `VITE_API_BASE_URL`，未配置时为 `/api` */
  baseUrl?: string
  /** 单次请求超时（毫秒），默认 8000 */
  timeoutMs?: number
}

export interface PostsApi {
  fetchPosts(): Promise<ApiResult<Post[]>>
  createPost(text: string): Promise<ApiResult<Post>>
  deletePost(id: string): Promise<ApiResult<null>>
  importPosts(posts: readonly Post[]): Promise<ApiResult<ImportSummary>>
  /** 设置点赞状态：`liked` 为 true 用 PUT，false 用 DELETE，成功返回最新动态。 */
  setPostLiked(id: string, liked: boolean): Promise<ApiResult<Post>>
  /** 设置收藏状态：`favorited` 为 true 用 PUT，false 用 DELETE，成功返回最新动态。 */
  setPostFavorited(id: string, favorited: boolean): Promise<ApiResult<Post>>
}

/** 与 Vite 开发代理、服务端路由保持一致的前缀。 */
const DEFAULT_BASE_URL = '/api'

/** 默认超时：超过 8 秒视为网络不可用，避免按钮长期无响应。 */
const DEFAULT_TIMEOUT_MS = 8000

/** 写操作的固定请求头，服务端会校验 Content-Type。 */
const JSON_HEADERS: Record<string, string> = { 'Content-Type': 'application/json' }

/** 前端认识的错误码集合，用于过滤后端返回的未知 code。 */
const API_ERROR_CODES: readonly ApiErrorCode[] = [
  'NETWORK',
  'TIMEOUT',
  'SERVER',
  'NOT_FOUND',
  'EMPTY',
  'TOO_LONG',
  'INVALID_SHAPE',
  'TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'LIMIT_REACHED',
]

/** 判断后端返回的 code 是否属于已知错误码。 */
function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value)
}

/**
 * 读取基址。
 * `import.meta.env` 只在浏览器构建期存在，因此集中在 api 层读取，
 * 不能放进 constants.ts（那个文件会被 Node 端的 tsx 直接引入）。
 */
function resolveBaseUrl(): string {
  const configured: unknown = import.meta.env.VITE_API_BASE_URL

  return typeof configured === 'string' && configured.trim() !== ''
    ? configured.trim()
    : DEFAULT_BASE_URL
}

/** 去掉基址末尾的斜杠，避免拼出 `//posts`；同时不破坏 `http://` 里的双斜杠。 */
function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

/** 请求发送结果：成功时带回 Response，失败时只带回客户端错误码。 */
type SendResult =
  | { ok: true; response: Response }
  | { ok: false; error: Extract<ApiErrorCode, 'NETWORK' | 'TIMEOUT'> }

/**
 * 发送请求：用 AbortController + setTimeout 实现超时。
 * 不抛异常，一律返回判别式结果；网络中断与超时靠 signal 状态区分。
 */
async function send(url: string, init: RequestInit, timeoutMs: number): Promise<SendResult> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null

  const timeout = new Promise<SendResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve({ ok: false, error: 'TIMEOUT' })
    }, timeoutMs)
  })

  const request = (async (): Promise<SendResult> => {
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      return { ok: true, response }
    } catch {
      // abort 之后 fetch 也会 reject，此时应归因为超时而不是网络错误
      return { ok: false, error: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK' }
    }
  })()

  try {
    // 与超时赛跑：即使底层 fetch 在 abort 后仍挂起，也能按时返回 TIMEOUT
    return await Promise.race([request, timeout])
  } finally {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
}

/** JSON 解析结果，失败不抛异常。 */
type ParsedJson = { ok: true; value: unknown } | { ok: false }

/** 读取响应体 JSON，非法内容用判别式结果表达。 */
async function readJson(response: Response): Promise<ParsedJson> {
  try {
    return { ok: true, value: (await response.json()) as unknown }
  } catch {
    return { ok: false }
  }
}

/** 从错误体中提取后端错误码，取不到或不认识时回退为 SERVER。 */
async function readErrorCode(response: Response): Promise<ApiErrorCode> {
  const parsed = await readJson(response)
  if (!parsed.ok || parsed.value === null || typeof parsed.value !== 'object') {
    return 'SERVER'
  }

  const body = parsed.value as { error?: { code?: unknown } }
  const code = body.error?.code

  return isApiErrorCode(code) ? code : 'SERVER'
}

/** 把任意 JSON 值解析为动态列表，不是数组时判定为结构不符。 */
function parsePostList(value: unknown): Post[] | null {
  return Array.isArray(value) ? filterValidPosts(value) : null
}

/** 把任意 JSON 值解析为单条动态。 */
function parsePost(value: unknown): Post | null {
  if (!isValidPost(value)) {
    return null
  }

  // 复用列表归一化逻辑，保证缺失的时间戳等字段与本地数据同规则
  const [post] = filterValidPosts([value])

  return post ?? null
}

/** 把任意 JSON 值解析为导入汇总，字段类型不符时判定为结构不符。 */
function parseImportSummary(value: unknown): ImportSummary | null {
  if (value === null || typeof value !== 'object') {
    return null
  }

  const { imported, skipped, total } = value as Partial<ImportSummary>

  return typeof imported === 'number' && typeof skipped === 'number' && typeof total === 'number'
    ? { imported, skipped, total }
    : null
}

/** 统一处理"发送 + 状态码 + 解析"，任何分支都返回 ApiResult。 */
async function request<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  parse: (value: unknown) => T | null,
): Promise<ApiResult<T>> {
  const sent = await send(url, init, timeoutMs)
  if (!sent.ok) {
    // 没有拿到响应，状态码用 0 表示
    return { ok: false, error: sent.error, status: 0 }
  }

  const { response } = sent

  if (!response.ok) {
    return { ok: false, error: await readErrorCode(response), status: response.status }
  }

  const parsed = await readJson(response)
  if (!parsed.ok) {
    return { ok: false, error: 'SERVER', status: response.status }
  }

  const data = parse(parsed.value)

  return data === null
    ? { ok: false, error: 'SERVER', status: response.status }
    : { ok: true, data }
}

/** 创建接口客户端；返回的函数都是纯函数引用，可以安全解构使用。 */
export function createPostsApi(options: ApiClientOptions = {}): PostsApi {
  const baseUrl = options.baseUrl ?? resolveBaseUrl()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  /**
   * 点赞与收藏共用同一套请求逻辑：目标状态为 true 时用 PUT，false 时用 DELETE。
   * 两者都是幂等的状态设置接口，成功后返回服务端最新的完整动态。
   */
  const setPostState = (
    id: string,
    path: '/like' | '/favorite',
    active: boolean,
  ): Promise<ApiResult<Post>> =>
    request(
      joinUrl(baseUrl, `/posts/${encodeURIComponent(id)}${path}`),
      { method: active ? 'PUT' : 'DELETE' },
      timeoutMs,
      parsePost,
    )

  return {
    fetchPosts: () =>
      request(joinUrl(baseUrl, '/posts'), { method: 'GET' }, timeoutMs, parsePostList),

    createPost: (text) =>
      request(
        joinUrl(baseUrl, '/posts'),
        { method: 'POST', headers: { ...JSON_HEADERS }, body: JSON.stringify({ text }) },
        timeoutMs,
        parsePost,
      ),

    deletePost: async (id) => {
      const sent = await send(
        joinUrl(baseUrl, `/posts/${encodeURIComponent(id)}`),
        { method: 'DELETE' },
        timeoutMs,
      )

      if (!sent.ok) {
        return { ok: false, error: sent.error, status: 0 }
      }

      // 契约是 204 无响应体，成功时不再读 body
      return sent.response.ok
        ? { ok: true, data: null }
        : { ok: false, error: await readErrorCode(sent.response), status: sent.response.status }
    },

    importPosts: (posts) =>
      request(
        joinUrl(baseUrl, '/posts/import'),
        { method: 'POST', headers: { ...JSON_HEADERS }, body: JSON.stringify({ posts }) },
        timeoutMs,
        parseImportSummary,
      ),

    setPostLiked: (id, liked) => setPostState(id, '/like', liked),

    setPostFavorited: (id, favorited) => setPostState(id, '/favorite', favorited),
  }
}

/** 应用默认使用的客户端实例。 */
const defaultApi = createPostsApi()

export const fetchPosts: PostsApi['fetchPosts'] = defaultApi.fetchPosts
export const createPost: PostsApi['createPost'] = defaultApi.createPost
export const deletePost: PostsApi['deletePost'] = defaultApi.deletePost
export const importPosts: PostsApi['importPosts'] = defaultApi.importPosts
export const setPostLiked: PostsApi['setPostLiked'] = defaultApi.setPostLiked
export const setPostFavorited: PostsApi['setPostFavorited'] = defaultApi.setPostFavorited
