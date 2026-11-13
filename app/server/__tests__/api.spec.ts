// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { IMPORT_MAX_BYTES } from '../../src/constants'
import type { Post } from '../../src/types'
import { createApp } from '../app'
import { createPostStore } from '../store'

/** 服务端允许的最大动态条数，超出后发布会返回 409。 */
const MAX_POSTS = 1000

const JSON_HEADERS = { 'Content-Type': 'application/json' }

interface HealthBody {
  status: string
  posts: number
  uptime: number
}

interface ImportBody {
  imported: number
  skipped: number
  total: number
}

interface ErrorBody {
  error: { code: string; message: string }
}

/**
 * 统一断言错误体形状：`{ error: { code, message } }`，
 * 且响应里绝不能出现堆栈信息。
 */
function expectErrorBody(payload: unknown, code: string): void {
  const body = payload as ErrorBody

  expect(body.error?.code).toBe(code)
  expect(typeof body.error?.message).toBe('string')
  expect(JSON.stringify(body)).not.toContain('stack')
}

/** 构造一批用于预置数据的动态。 */
function seedPosts(count: number): Post[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `seed-${index}`,
    text: `预置-${index}`,
    createdAt: index + 1,
  }))
}

describe('GET /api/health', () => {
  it('返回 200 与状态、动态数、运行时长', async () => {
    const store = createPostStore()
    store.create('一条动态')

    const res = await createApp(store).request('/api/health')

    expect(res.status).toBe(200)
    const body = (await res.json()) as HealthBody
    expect(body.status).toBe('ok')
    expect(body.posts).toBe(1)
    expect(typeof body.uptime).toBe('number')
    expect(Number.isFinite(body.uptime)).toBe(true)
    expect(body.uptime).toBeGreaterThanOrEqual(0)
  })

  it('动态数为 0 时也正常返回', async () => {
    const res = await createApp(createPostStore()).request('/api/health')

    expect(res.status).toBe(200)
    const body = (await res.json()) as HealthBody
    expect(body.posts).toBe(0)
  })
})

describe('GET /api/posts', () => {
  it('返回 200 与按 createdAt 倒序的列表', async () => {
    const store = createPostStore()
    store.create('旧', 1_000)
    store.create('新', 3_000)
    store.create('中', 2_000)

    const res = await createApp(store).request('/api/posts')

    expect(res.status).toBe(200)
    const body = (await res.json()) as Post[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.map((post) => post.text)).toEqual(['新', '中', '旧'])
  })

  it('空数据时返回空数组', async () => {
    const res = await createApp(createPostStore()).request('/api/posts')

    expect(res.status).toBe(200)
    expect((await res.json()) as Post[]).toEqual([])
  })
})

describe('GET /api/posts/:id', () => {
  it('命中时返回 200 与对应动态', async () => {
    const store = createPostStore()
    const post = store.create('单条详情', 1_000)
    const app = createApp(store)

    const res = await app.request(`/api/posts/${post.id}`)

    expect(res.status).toBe(200)
    expect((await res.json()) as Post).toEqual(post)
  })

  it('未命中时返回 404 NOT_FOUND', async () => {
    const res = await createApp(createPostStore()).request('/api/posts/missing-id')

    expect(res.status).toBe(404)
    expectErrorBody(await res.json(), 'NOT_FOUND')
  })
})

describe('POST /api/posts', () => {
  it('成功时返回 201、新动态与 Location 头', async () => {
    const store = createPostStore()
    const app = createApp(store)

    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: '  发布内容  ' }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as Post
    expect(typeof body.id).toBe('string')
    expect(body.id.length).toBeGreaterThan(0)
    expect(body.text).toBe('发布内容')
    expect(body.createdAt).toBeGreaterThan(0)
    expect(res.headers.get('location')).toBe(`/api/posts/${body.id}`)
    expect(store.count()).toBe(1)
    expect(store.get(body.id)).toEqual(body)
  })

  it('正文为空时返回 400 EMPTY 且不写入任何数据', async () => {
    const store = createPostStore()
    const app = createApp(store)

    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: '   ' }),
    })

    expect(res.status).toBe(400)
    expectErrorBody(await res.json(), 'EMPTY')
    expect(store.count()).toBe(0)
  })

  it('超过 500 字时返回 400 TOO_LONG 且不写入任何数据', async () => {
    const store = createPostStore()
    const app = createApp(store)

    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: 'a'.repeat(501) }),
    })

    expect(res.status).toBe(400)
    expectErrorBody(await res.json(), 'TOO_LONG')
    expect(store.count()).toBe(0)
  })

  it('已有 1000 条时返回 409 LIMIT_REACHED', async () => {
    const store = createPostStore()
    expect(store.importMany(seedPosts(MAX_POSTS)).imported).toBe(MAX_POSTS)
    const app = createApp(store)

    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: '超出上限' }),
    })

    expect(res.status).toBe(409)
    expectErrorBody(await res.json(), 'LIMIT_REACHED')
    expect(store.count()).toBe(MAX_POSTS)
  })

  it('体积超过 1MB 时返回 413 TOO_LARGE（优先于超长判断）', async () => {
    const store = createPostStore()
    const app = createApp(store)
    const oversized = JSON.stringify({ text: 'a'.repeat(IMPORT_MAX_BYTES + 1) })

    expect(oversized.length).toBeGreaterThan(IMPORT_MAX_BYTES)

    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: oversized,
    })

    expect(res.status).toBe(413)
    expectErrorBody(await res.json(), 'TOO_LARGE')
    expect(store.count()).toBe(0)
  })

  it('Content-Type 不是 application/json 时返回 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const store = createPostStore()
    const app = createApp(store)

    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ text: '纯文本提交' }),
    })

    expect(res.status).toBe(415)
    expectErrorBody(await res.json(), 'UNSUPPORTED_MEDIA_TYPE')
    expect(store.count()).toBe(0)
  })
})

describe('POST /api/posts/import', () => {
  it('导入 { posts: [...] } 形状时返回 200 与统计结果', async () => {
    const store = createPostStore()
    const app = createApp(store)
    const posts = seedPosts(2)

    const res = await app.request('/api/posts/import', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ posts }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as ImportBody
    expect(body.imported).toBe(2)
    expect(body.skipped).toBe(0)
    expect(body.total).toBe(2)
    expect(store.count()).toBe(2)
  })

  it('导入纯数组形状时同样成功', async () => {
    const store = createPostStore()
    const app = createApp(store)

    const res = await app.request('/api/posts/import', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(seedPosts(1)),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as ImportBody
    expect(body.imported).toBe(1)
    expect(store.count()).toBe(1)
  })

  it('按 id 去重：重复导入同一批数据返回 imported 为 0', async () => {
    const store = createPostStore()
    const app = createApp(store)
    const payload = JSON.stringify({ posts: seedPosts(2) })

    const first = await app.request('/api/posts/import', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: payload,
    })
    expect(first.status).toBe(200)

    const second = await app.request('/api/posts/import', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: payload,
    })

    expect(second.status).toBe(200)
    const body = (await second.json()) as ImportBody
    expect(body.imported).toBe(0)
    expect(body.total).toBe(2)
    expect(store.count()).toBe(2)
  })

  it('导入列表为空时返回 400 EMPTY', async () => {
    const store = createPostStore()
    const app = createApp(store)

    const res = await app.request('/api/posts/import', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ posts: [] }),
    })

    expect(res.status).toBe(400)
    expectErrorBody(await res.json(), 'EMPTY')
    expect(store.count()).toBe(0)
  })

  it('形状非法时返回 400 INVALID_SHAPE', async () => {
    const store = createPostStore()
    const app = createApp(store)

    const res = await app.request('/api/posts/import', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ foo: 'bar' }),
    })

    expect(res.status).toBe(400)
    expectErrorBody(await res.json(), 'INVALID_SHAPE')
    expect(store.count()).toBe(0)
  })
})

describe('DELETE /api/posts/:id', () => {
  it('成功时返回 204 且没有响应体', async () => {
    const store = createPostStore()
    const post = store.create('待删除', 1_000)
    const app = createApp(store)

    const res = await app.request(`/api/posts/${post.id}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(store.get(post.id)).toBeUndefined()
    expect(store.count()).toBe(0)
  })

  it('未命中时返回 404 NOT_FOUND 且不影响已有数据', async () => {
    const store = createPostStore()
    const post = store.create('保留', 1_000)
    const app = createApp(store)

    const res = await app.request('/api/posts/missing-id', { method: 'DELETE' })

    expect(res.status).toBe(404)
    expectErrorBody(await res.json(), 'NOT_FOUND')
    expect(store.count()).toBe(1)
    expect(store.get(post.id)).toEqual(post)
  })
})

describe('未匹配路由', () => {
  it.each([
    ['/api/unknown', 'GET'],
    ['/', 'GET'],
    ['/api/posts/import', 'PUT'],
  ])('%s（%s）返回 404 NOT_FOUND', async (path, method) => {
    const res = await createApp(createPostStore()).request(path, { method })

    expect(res.status).toBe(404)
    expectErrorBody(await res.json(), 'NOT_FOUND')
  })
})
