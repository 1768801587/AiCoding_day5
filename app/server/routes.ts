import { Hono } from 'hono'
import type { Context } from 'hono'
import { MAX_LENGTH } from '../src/constants'
import { API_PREFIX, MAX_BODY_BYTES, MAX_POSTS } from './constants'
import { errorResponse } from './errors'
import type { PostStore } from './store'
import { validateCreatePayload, validateImportPayload } from './validation'
import type { ValidationErrorCode } from './validation'

/** 校验失败码对应的中文说明，只用于响应体的 message 字段。 */
const VALIDATION_MESSAGES: Record<ValidationErrorCode, string> = {
  EMPTY: '内容不能为空',
  TOO_LONG: `内容不能超过 ${MAX_LENGTH} 字`,
  INVALID_SHAPE: '请求体结构不正确',
}

/** 请求体读取结果：体积超限时直接返回错误码，不进入解析。 */
type RawBody = { ok: true; text: string } | { ok: false; code: 'TOO_LARGE' }

/** JSON 解析结果，失败不抛异常。 */
type ParsedJson = { ok: true; value: unknown } | { ok: false }

const encoder = new TextEncoder()

/**
 * 判断 Content-Type 是否为 JSON。
 * 允许带参数（如 `application/json; charset=utf-8`），其余一律视为不支持的媒体类型。
 */
function isJsonRequest(c: Context): boolean {
  const contentType = c.req.header('content-type') ?? ''
  const [mediaType = ''] = contentType.split(';')

  return mediaType.trim().toLowerCase() === 'application/json'
}

/**
 * 读取并校验请求体体积。
 * 不依赖 `bodyLimit` 中间件：`app.request()` 不会自动带 Content-Length，
 * 只有按真实字节数判断才能覆盖「体积超限优先于超长」的语义。
 */
async function readBody(c: Context): Promise<RawBody> {
  const text = await c.req.text()

  if (encoder.encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, code: 'TOO_LARGE' }
  }

  return { ok: true, text }
}

/** 解析 JSON，失败用判别式结果表达。 */
function parseJson(text: string): ParsedJson {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

/** 注册 `/api` 下的全部路由；数据读写统一委托给传入的 store。 */
export function createApiRoutes(store: PostStore): Hono {
  const routes = new Hono()

  routes.get(`${API_PREFIX}/health`, (c) =>
    c.json({ status: 'ok', posts: store.count(), uptime: process.uptime() }),
  )

  routes.get(`${API_PREFIX}/posts`, (c) => c.json(store.list()))

  routes.get(`${API_PREFIX}/posts/:id`, (c) => {
    const post = store.get(c.req.param('id'))

    return post ? c.json(post) : errorResponse(c, 'NOT_FOUND', '动态不存在')
  })

  routes.delete(`${API_PREFIX}/posts/:id`, (c) =>
    store.remove(c.req.param('id'))
      ? c.body(null, 204)
      : errorResponse(c, 'NOT_FOUND', '动态不存在'),
  )

  routes.post(`${API_PREFIX}/posts`, async (c) => {
    if (!isJsonRequest(c)) {
      return errorResponse(c, 'UNSUPPORTED_MEDIA_TYPE', '请求头 Content-Type 必须是 application/json')
    }

    const body = await readBody(c)
    if (!body.ok) {
      // 体积判断先于内容校验：超限的请求体不再解析，避免浪费内存
      return errorResponse(c, 'TOO_LARGE', `请求体不能超过 ${MAX_BODY_BYTES} 字节`)
    }

    const parsed = parseJson(body.text)
    if (!parsed.ok) {
      // 发布接口拿到空/非法 JSON 时，语义上等价于「没有可发布的内容」，故用 EMPTY
      // （导入接口的形状要求更严格，解析失败归为 INVALID_SHAPE）
      return errorResponse(c, 'EMPTY', '请求体不是有效的 JSON')
    }

    const validated = validateCreatePayload(parsed.value)
    if (!validated.ok) {
      return errorResponse(c, validated.code, VALIDATION_MESSAGES[validated.code])
    }

    if (store.count() >= MAX_POSTS) {
      return errorResponse(c, 'LIMIT_REACHED', `动态数量已达上限 ${MAX_POSTS} 条`)
    }

    const post = store.create(validated.text)
    c.header('Location', `${API_PREFIX}/posts/${post.id}`)

    return c.json(post, 201)
  })

  routes.post(`${API_PREFIX}/posts/import`, async (c) => {
    if (!isJsonRequest(c)) {
      return errorResponse(c, 'UNSUPPORTED_MEDIA_TYPE', '请求头 Content-Type 必须是 application/json')
    }

    const body = await readBody(c)
    if (!body.ok) {
      return errorResponse(c, 'TOO_LARGE', `请求体不能超过 ${MAX_BODY_BYTES} 字节`)
    }

    const parsed = parseJson(body.text)
    if (!parsed.ok) {
      return errorResponse(c, 'INVALID_SHAPE', '请求体不是有效的 JSON')
    }

    const validated = validateImportPayload(parsed.value)
    if (!validated.ok) {
      return errorResponse(c, validated.code, VALIDATION_MESSAGES[validated.code])
    }

    // 整批写入前先预演总数：超限时一条都不写，避免半途导入
    if (store.projectedTotal(validated.posts) > MAX_POSTS) {
      return errorResponse(c, 'LIMIT_REACHED', `导入后动态总数将超过上限 ${MAX_POSTS} 条`)
    }

    const summary = store.importMany(validated.posts)

    return c.json({
      imported: summary.imported,
      // skipped 同时包含「脏条目」与「id 已存在」两类未写入的数据
      skipped: summary.skipped + validated.skipped,
      total: summary.total,
    })
  })

  return routes
}
