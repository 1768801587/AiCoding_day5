import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { errorResponse } from './errors'
import { createApiRoutes } from './routes'
import type { PostStore } from './store'

/** 测试环境不打印访问日志，保持用例输出干净。 */
const SHOULD_LOG = process.env.NODE_ENV !== 'test'

/** 访问日志只保留方法、路径、状态与耗时，不触碰请求体内容。 */
function printAccessLog(message: string, ...rest: string[]): void {
  console.log(message, ...rest)
}

/** 生成用于日志串联的短 id，仅用于定位异常，不返回给客户端。 */
function createTraceId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * 组装应用：路由 + 统一 404 + 统一异常处理。
 * 这里刻意不挂任何静态托管，未匹配的路径（包括 `/`）都必须返回 JSON 404，
 * 前端产物由 `index.ts` 的启动入口单独托管。
 */
export function createApp(store: PostStore): Hono {
  const app = new Hono()

  if (SHOULD_LOG) {
    app.use('*', logger(printAccessLog))
  }

  app.route('/', createApiRoutes(store))

  app.notFound((c) => errorResponse(c, 'NOT_FOUND', '请求的资源不存在'))

  app.onError((_error, c) => {
    // 只记录错误码与追踪 id：堆栈与原始 message 一律不外泄
    console.error(`[api] 未捕获异常 code=INTERNAL id=${createTraceId()}`)

    return errorResponse(c, 'INTERNAL', '服务器内部错误')
  })

  return app
}
