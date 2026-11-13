import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { API_PREFIX, DEFAULT_PORT } from './constants'
import { errorResponse } from './errors'
import { createPostStore } from './store'

/** 前端构建产物目录：基于当前文件位置解析，不依赖启动时的工作目录。 */
const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))

/** SPA 回退入口。 */
const INDEX_HTML_PATH = join(DIST_DIR, 'index.html')

/** 静态资源用到的 MIME 类型，未覆盖的按二进制流返回。 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

/** 环境变量 PORT 优先，非法值回落到默认端口。 */
function resolvePort(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10)

  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : DEFAULT_PORT
}

/** 阻止 `../` 越权读取 dist 之外的任意文件。 */
function isInsideDist(target: string): boolean {
  return target === DIST_DIR || target.startsWith(DIST_DIR + sep)
}

/** 把请求路径映射为 dist 内的绝对路径，非法路径返回 null。 */
function resolveAssetPath(pathname: string): string | null {
  let decoded: string

  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // 非法的百分号编码（如 %zz）直接视为无对应资源
    return null
  }

  const target = normalize(join(DIST_DIR, decoded))

  return isInsideDist(target) ? target : null
}

/** 读取文件，不存在或无权限时返回 null（不抛异常到上层）。 */
async function readFileOrNull(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path)
  } catch {
    return null
  }
}

const app = createApp(createPostStore())

/**
 * 生产形态下的静态托管：先找 dist 内的真实文件，未命中的前端路由回退到 index.html。
 * `/api` 前缀的未知路径仍返回 JSON 404，避免前端拿到 HTML 去解析。
 */
app.get('*', async (c) => {
  const { pathname } = new URL(c.req.url)

  if (pathname.startsWith(API_PREFIX)) {
    return errorResponse(c, 'NOT_FOUND', '请求的资源不存在')
  }

  const assetPath = resolveAssetPath(pathname)

  if (assetPath !== null) {
    const asset = await readFileOrNull(assetPath)

    if (asset) {
      return new Response(asset, {
        headers: { 'Content-Type': MIME_TYPES[extname(assetPath).toLowerCase()] ?? 'application/octet-stream' },
      })
    }

    // 带扩展名却找不到文件，说明构建产物缺失或被删除，不必再走 SPA 回退
    if (extname(assetPath) !== '') {
      return errorResponse(c, 'NOT_FOUND', '请求的资源不存在')
    }
  }

  const html = await readFileOrNull(INDEX_HTML_PATH)

  if (html === null) {
    return c.text(
      '未找到前端构建产物（dist/index.html）：请先在 app 目录执行 npm run build，再重新访问本页面。',
      200,
    )
  }

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
})

const port = resolvePort(process.env.PORT)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[mingle] 服务已启动：http://localhost:${info.port}`)
  console.log(`[mingle] 前端静态目录：${DIST_DIR}`)
  console.log('[mingle] 数据存储在内存中，服务重启后清空')
})
