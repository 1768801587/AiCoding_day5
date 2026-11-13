import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Post } from '../types'
import { createPost, createPostsApi, deletePost, fetchPosts, importPosts } from './api'

const post: Post = { id: 'a1', text: '第一条', createdAt: 1_700_000_000_000 }
const other: Post = { id: 'b2', text: '第二条', createdAt: 1_700_000_100_000 }

type FetchMock = Mock<[url: string, init?: RequestInit], Promise<Response>>

/** 替换全局 fetch，返回可断言的 mock。 */
function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): FetchMock {
  const mock = vi.fn(handler)
  vi.stubGlobal('fetch', mock)
  return mock
}

/** 构造带 JSON 响应体的 Response。 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 构造后端固定错误体 `{ error: { code, message } }`。 */
function apiErrorResponse(code: string, status: number): Response {
  return jsonResponse({ error: { code, message: '服务端说明' } }, status)
}

/** 取出第一次请求的 URL 与 init，避免断言里到处写可选链。 */
function firstCall(mock: FetchMock): { url: string | undefined; init: RequestInit | undefined } {
  const [url, init] = mock.mock.calls[0] ?? []
  return { url, init }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPosts', () => {
  it('成功时返回动态列表，并发出 GET /api/posts', async () => {
    const mock = stubFetch(async () => jsonResponse([post, other]))

    await expect(fetchPosts()).resolves.toEqual({ ok: true, data: [post, other] })

    const { url, init } = firstCall(mock)
    expect(url).toBe('/api/posts')
    expect(init?.method).toBe('GET')
  })

  it('500 时返回 SERVER 并带回真实状态码', async () => {
    stubFetch(async () => apiErrorResponse('INTERNAL', 500))

    await expect(fetchPosts()).resolves.toEqual({ ok: false, error: 'SERVER', status: 500 })
  })

  it('错误体里的未知 code 回退为 SERVER', async () => {
    stubFetch(async () => apiErrorResponse('SOMETHING_NEW', 503))

    await expect(fetchPosts()).resolves.toEqual({ ok: false, error: 'SERVER', status: 503 })
  })

  it('响应不是合法 JSON 时返回 SERVER', async () => {
    stubFetch(async () => new Response('not json', { status: 200 }))

    await expect(fetchPosts()).resolves.toEqual({ ok: false, error: 'SERVER', status: 200 })
  })

  it('响应是对象而非数组时返回 SERVER', async () => {
    stubFetch(async () => jsonResponse({ posts: [post] }))

    await expect(fetchPosts()).resolves.toEqual({ ok: false, error: 'SERVER', status: 200 })
  })

  it('fetch 本身失败时返回 NETWORK，status 为 0', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(fetchPosts()).resolves.toEqual({ ok: false, error: 'NETWORK', status: 0 })
  })

  it('超时返回 TIMEOUT，status 为 0', async () => {
    vi.useFakeTimers()
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const api = createPostsApi({ timeoutMs: 50 })
    const pending = api.fetchPosts()
    await vi.advanceTimersByTimeAsync(50)

    await expect(pending).resolves.toEqual({ ok: false, error: 'TIMEOUT', status: 0 })
  })
})

describe('createPost', () => {
  it('成功时返回新动态，并发出带 JSON 请求体的 POST /api/posts', async () => {
    const mock = stubFetch(async () => jsonResponse(post, 201))

    await expect(createPost('第一条')).resolves.toEqual({ ok: true, data: post })

    const { url, init } = firstCall(mock)
    expect(url).toBe('/api/posts')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init?.body).toBe(JSON.stringify({ text: '第一条' }))
  })

  it('TOO_LONG 错误码映射为 TOO_LONG', async () => {
    stubFetch(async () => apiErrorResponse('TOO_LONG', 400))

    await expect(createPost('太长了')).resolves.toEqual({
      ok: false,
      error: 'TOO_LONG',
      status: 400,
    })
  })

  it('错误体不是 JSON 时回退为 SERVER', async () => {
    stubFetch(async () => new Response('boom', { status: 400 }))

    await expect(createPost('x')).resolves.toEqual({ ok: false, error: 'SERVER', status: 400 })
  })

  it('2xx 但返回体不是合法动态时返回 SERVER', async () => {
    stubFetch(async () => jsonResponse({ detail: 'no post' }, 201))

    await expect(createPost('x')).resolves.toEqual({ ok: false, error: 'SERVER', status: 201 })
  })
})

describe('deletePost', () => {
  it('204 无响应体时返回 ok 与 null', async () => {
    const mock = stubFetch(async () => new Response(null, { status: 204 }))

    await expect(deletePost('a1')).resolves.toEqual({ ok: true, data: null })

    const { url, init } = firstCall(mock)
    expect(url).toBe('/api/posts/a1')
    expect(init?.method).toBe('DELETE')
  })

  it('对 id 做 encodeURIComponent', async () => {
    const mock = stubFetch(async () => new Response(null, { status: 204 }))

    await deletePost('a/b c')

    expect(firstCall(mock).url).toBe('/api/posts/a%2Fb%20c')
  })

  it('404 映射为 NOT_FOUND', async () => {
    stubFetch(async () => apiErrorResponse('NOT_FOUND', 404))

    await expect(deletePost('gone')).resolves.toEqual({
      ok: false,
      error: 'NOT_FOUND',
      status: 404,
    })
  })
})

describe('importPosts', () => {
  it('成功时返回导入汇总，并发出带 posts 的 POST /api/posts/import', async () => {
    const mock = stubFetch(async () => jsonResponse({ imported: 2, skipped: 1, total: 5 }))

    await expect(importPosts([post, other])).resolves.toEqual({
      ok: true,
      data: { imported: 2, skipped: 1, total: 5 },
    })

    const { url, init } = firstCall(mock)
    expect(url).toBe('/api/posts/import')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init?.body).toBe(JSON.stringify({ posts: [post, other] }))
  })

  it('409 LIMIT_REACHED 原样映射', async () => {
    stubFetch(async () => apiErrorResponse('LIMIT_REACHED', 409))

    await expect(importPosts([post])).resolves.toEqual({
      ok: false,
      error: 'LIMIT_REACHED',
      status: 409,
    })
  })

  it('2xx 但汇总字段缺失时返回 SERVER', async () => {
    stubFetch(async () => jsonResponse({ imported: 2 }))

    await expect(importPosts([post])).resolves.toEqual({
      ok: false,
      error: 'SERVER',
      status: 200,
    })
  })
})

describe('createPostsApi', () => {
  it('自定义 baseUrl 生效且拼接不产生双斜杠', async () => {
    const mock = stubFetch(async () => jsonResponse([]))

    const api = createPostsApi({ baseUrl: 'https://example.com/api/' })
    await api.fetchPosts()

    expect(firstCall(mock).url).toBe('https://example.com/api/posts')
  })

  it('默认导出实例使用 /api 作为基址', async () => {
    const mock = stubFetch(async () => jsonResponse([]))

    await fetchPosts()

    expect(firstCall(mock).url).toBe('/api/posts')
  })
})
