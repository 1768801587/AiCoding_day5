import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MAX_LENGTH } from '../constants'
import type { ApiResult, Post } from '../types'
import { createPost, deletePost, fetchPosts, importPosts, setPostFavorited, setPostLiked } from '../utils/api'
import { postsChannel } from '../utils/broadcast'
import { usePostsStore } from './posts'

// 服务端接口与跨标签页广播都在模块边界上，替换掉即可完全隔离网络与浏览器能力
vi.mock('../utils/api')
vi.mock('../utils/broadcast')

const storedPosts: Post[] = [
  { id: 'old', text: '旧动态', createdAt: new Date(2024, 3, 1, 9, 0).getTime() },
  { id: 'new', text: '新动态', createdAt: new Date(2024, 4, 1, 10, 0).getTime() },
]

/** 手动控制 Promise 何时结算，用于观察请求进行中的状态。 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchPosts).mockReset()
  vi.mocked(createPost).mockReset()
  vi.mocked(deletePost).mockReset()
  vi.mocked(importPosts).mockReset()
  vi.mocked(postsChannel.notify).mockReset()
  // 默认：服务端已有一条「新」一条「旧」
  vi.mocked(fetchPosts).mockResolvedValue({ ok: true, data: [...storedPosts] })
})

describe('usePostsStore', () => {
  describe('hydrate', () => {
    it('成功时用服务端数据替换列表并清空 loadError', async () => {
      const store = usePostsStore()

      await store.hydrate()

      expect(fetchPosts).toHaveBeenCalledTimes(1)
      expect(store.totalCount).toBe(2)
      expect(store.orderedPosts.map((post) => post.id)).toEqual(['new', 'old'])
      expect(store.loadError).toBeNull()
    })

    it('请求进行中 isLoading 为 true，结束后复位', async () => {
      const pending = deferred<ApiResult<Post[]>>()
      vi.mocked(fetchPosts).mockReturnValue(pending.promise)
      const store = usePostsStore()

      const loading = store.hydrate()
      expect(store.isLoading).toBe(true)

      pending.resolve({ ok: true, data: [...storedPosts] })
      await loading

      expect(store.isLoading).toBe(false)
      expect(store.totalCount).toBe(2)
    })

    it('失败时保留已有列表，只记录 loadError 并复位 isLoading', async () => {
      const store = usePostsStore()
      await store.hydrate()
      const before = store.posts

      vi.mocked(fetchPosts).mockResolvedValue({ ok: false, error: 'NETWORK', status: 0 })
      await store.hydrate()

      expect(store.posts).toBe(before)
      expect(store.totalCount).toBe(2)
      expect(store.loadError).toBe('NETWORK')
      expect(store.isLoading).toBe(false)
    })

    it('首次加载失败时列表为空且暴露 loadError', async () => {
      vi.mocked(fetchPosts).mockResolvedValue({ ok: false, error: 'TIMEOUT', status: 0 })
      const store = usePostsStore()

      await store.hydrate()

      expect(store.posts).toEqual([])
      expect(store.loadError).toBe('TIMEOUT')
    })

    it('加载成功后再次失败会留下 loadError，成功后重新清空', async () => {
      const store = usePostsStore()
      await store.hydrate()

      vi.mocked(fetchPosts).mockResolvedValue({ ok: false, error: 'SERVER', status: 500 })
      await store.hydrate()
      expect(store.loadError).toBe('SERVER')

      vi.mocked(fetchPosts).mockResolvedValue({ ok: true, data: [] })
      await store.hydrate()
      expect(store.loadError).toBeNull()
      expect(store.posts).toEqual([])
    })
  })

  describe('refresh', () => {
    it('重新拉取并用最新数据替换列表', async () => {
      const store = usePostsStore()
      await store.hydrate()
      expect(store.totalCount).toBe(2)

      vi.mocked(fetchPosts).mockResolvedValue({ ok: true, data: [storedPosts[1]!] })
      await store.refresh()

      expect(fetchPosts).toHaveBeenCalledTimes(2)
      expect(store.totalCount).toBe(1)
      expect(store.orderedPosts.map((post) => post.id)).toEqual(['new'])
    })

    it('刷新不触发跨标签页广播', async () => {
      const store = usePostsStore()

      await store.refresh()

      expect(postsChannel.notify).not.toHaveBeenCalled()
    })
  })

  describe('统计 getters', () => {
    it('暴露总数、今日发布数与累计字数文案', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 4, 1, 12, 0))
      const store = usePostsStore()

      await store.hydrate()

      expect(store.totalCount).toBe(2)
      expect(store.todayCount).toBe(1)
      expect(store.charStatLabel).toBe(String('旧动态'.length + '新动态'.length))
    })

    it('累计字数超过 9999 时以 k 缩写', async () => {
      vi.mocked(fetchPosts).mockResolvedValue({
        ok: true,
        data: [{ id: 'long', text: 'a'.repeat(12_000), createdAt: Date.now() }],
      })
      const store = usePostsStore()

      await store.hydrate()

      expect(store.charStatLabel).toBe('12.0k')
    })
  })

  describe('publish', () => {
    it('空内容返回 EMPTY 且不发请求、不改动列表', async () => {
      const store = usePostsStore()
      await store.hydrate()
      const before = store.posts

      expect(await store.publish('   ')).toEqual({ ok: false, error: 'EMPTY' })
      expect(createPost).not.toHaveBeenCalled()
      expect(store.posts).toBe(before)
    })

    it(`超过 ${MAX_LENGTH} 字返回 TOO_LONG 且不发请求`, async () => {
      const store = usePostsStore()
      await store.hydrate()
      const before = store.posts

      expect(await store.publish('a'.repeat(MAX_LENGTH + 1))).toEqual({
        ok: false,
        error: 'TOO_LONG',
      })
      expect(createPost).not.toHaveBeenCalled()
      expect(store.posts).toBe(before)
    })

    it('字数上限按码点判断，emoji 不会提前触发 TOO_LONG', async () => {
      vi.mocked(createPost).mockResolvedValue({
        ok: true,
        data: { id: 'emoji', text: '😀'.repeat(MAX_LENGTH), createdAt: 1 },
      })
      const store = usePostsStore()
      await store.hydrate()

      const allowed = await store.publish('😀'.repeat(MAX_LENGTH))
      expect(allowed.ok).toBe(true)

      expect(await store.publish('😀'.repeat(MAX_LENGTH + 1))).toEqual({
        ok: false,
        error: 'TOO_LONG',
      })
    })

    it('成功时发送去除首尾空白的正文，并把新动态插到列表最前', async () => {
      const created: Post = { id: 'created', text: '今天天气不错', createdAt: 1730000000000 }
      vi.mocked(createPost).mockResolvedValue({ ok: true, data: created })
      const store = usePostsStore()
      await store.hydrate()

      const result = await store.publish('  今天天气不错  ')

      expect(createPost).toHaveBeenCalledWith('今天天气不错')
      expect(result).toEqual({ ok: true, post: created })
      expect(store.posts.map((post) => post.id)).toEqual(['created', 'old', 'new'])
      expect(store.totalCount).toBe(3)
    })

    it('成功后广播给其它标签页', async () => {
      vi.mocked(createPost).mockResolvedValue({
        ok: true,
        data: { id: 'created', text: '新动态', createdAt: 1 },
      })
      const store = usePostsStore()
      await store.hydrate()

      await store.publish('新动态')

      expect(postsChannel.notify).toHaveBeenCalledTimes(1)
    })

    it('网络失败返回 SAVE_FAILED，列表引用不变且不广播', async () => {
      vi.mocked(createPost).mockResolvedValue({ ok: false, error: 'NETWORK', status: 0 })
      const store = usePostsStore()
      await store.hydrate()
      const before = store.posts

      expect(await store.publish('写不进去')).toEqual({ ok: false, error: 'SAVE_FAILED' })
      expect(store.posts).toBe(before)
      expect(postsChannel.notify).not.toHaveBeenCalled()
    })

    it('后端返回 TOO_LONG 时映射为 TOO_LONG', async () => {
      vi.mocked(createPost).mockResolvedValue({ ok: false, error: 'TOO_LONG', status: 400 })
      const store = usePostsStore()
      await store.hydrate()

      expect(await store.publish('正常内容')).toEqual({ ok: false, error: 'TOO_LONG' })
    })

    it('其余后端错误统一映射为 SAVE_FAILED', async () => {
      vi.mocked(createPost).mockResolvedValue({ ok: false, error: 'LIMIT_REACHED', status: 409 })
      const store = usePostsStore()
      await store.hydrate()
      const before = store.posts

      expect(await store.publish('再多一条')).toEqual({ ok: false, error: 'SAVE_FAILED' })
      expect(store.posts).toBe(before)
    })
  })

  describe('remove', () => {
    it('成功时从列表移除并广播', async () => {
      vi.mocked(deletePost).mockResolvedValue({ ok: true, data: null })
      const store = usePostsStore()
      await store.hydrate()

      expect(await store.remove('old')).toEqual({ ok: true })
      expect(deletePost).toHaveBeenCalledWith('old')
      expect(store.posts.map((post) => post.id)).toEqual(['new'])
      expect(postsChannel.notify).toHaveBeenCalledTimes(1)
    })

    it('服务端返回 NOT_FOUND 时原样传递，列表引用不变', async () => {
      vi.mocked(deletePost).mockResolvedValue({ ok: false, error: 'NOT_FOUND', status: 404 })
      const store = usePostsStore()
      await store.hydrate()
      const before = store.posts

      expect(await store.remove('missing')).toEqual({ ok: false, error: 'NOT_FOUND' })
      expect(store.posts).toBe(before)
      expect(postsChannel.notify).not.toHaveBeenCalled()
    })

    it('其他失败返回 SAVE_FAILED 且保留原列表引用', async () => {
      vi.mocked(deletePost).mockResolvedValue({ ok: false, error: 'SERVER', status: 500 })
      const store = usePostsStore()
      await store.hydrate()
      const before = store.posts

      expect(await store.remove('old')).toEqual({ ok: false, error: 'SAVE_FAILED' })
      expect(store.posts).toBe(before)
      expect(store.posts).toHaveLength(2)
    })
  })

  describe('importAll', () => {
    it('成功时回传服务端计数并重新拉取列表', async () => {
      vi.mocked(importPosts).mockResolvedValue({
        ok: true,
        data: { imported: 2, skipped: 1, total: 4 },
      })
      const store = usePostsStore()
      await store.hydrate()
      expect(fetchPosts).toHaveBeenCalledTimes(1)

      const incoming: Post[] = [
        { id: 'old', text: '被改过的旧动态', createdAt: 1 },
        { id: 'imported', text: '导入的动态', createdAt: 1730000000000 },
      ]
      vi.mocked(fetchPosts).mockResolvedValue({
        ok: true,
        data: [
          ...storedPosts,
          { id: 'imported', text: '导入的动态', createdAt: 1730000000000 },
          { id: 'extra', text: '另一条', createdAt: 1730000000001 },
        ],
      })

      const result = await store.importAll(incoming)

      expect(importPosts).toHaveBeenCalledWith(incoming)
      expect(result).toEqual({ ok: true, imported: 2, skipped: 1 })
      expect(fetchPosts).toHaveBeenCalledTimes(2)
      expect(store.totalCount).toBe(4)
    })

    it('成功后广播给其它标签页', async () => {
      vi.mocked(importPosts).mockResolvedValue({
        ok: true,
        data: { imported: 2, skipped: 0, total: 2 },
      })
      const store = usePostsStore()
      await store.hydrate()

      await store.importAll(storedPosts)

      expect(postsChannel.notify).toHaveBeenCalledTimes(1)
    })

    it('失败时透传错误码，不改动列表也不重新拉取', async () => {
      vi.mocked(importPosts).mockResolvedValue({ ok: false, error: 'TOO_LARGE', status: 413 })
      const store = usePostsStore()
      await store.hydrate()
      const before = store.posts

      expect(await store.importAll(storedPosts)).toEqual({ ok: false, error: 'TOO_LARGE' })
      expect(fetchPosts).toHaveBeenCalledTimes(1)
      expect(store.posts).toBe(before)
      expect(postsChannel.notify).not.toHaveBeenCalled()
    })
  })

  describe('跨天刷新', () => {
    it('refreshNow 后今日发布数按新的时间基准重算', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 4, 1, 12, 0))
      const store = usePostsStore()
      await store.hydrate()

      expect(store.todayCount).toBe(1)

      vi.setSystemTime(new Date(2024, 4, 2, 0, 30))
      expect(store.todayCount).toBe(1)

      store.refreshNow()

      expect(store.todayCount).toBe(0)
      expect(store.totalCount).toBe(2)
    })
  })
})

/* =========================================================
   点赞 / 收藏（追加用例，上方既有断言保持不变）
   ========================================================= */

/** 已点赞的「旧动态」，用于验证取消点赞的目标状态。 */
const likedOld: Post = { ...storedPosts[0]!, likes: 1, liked: true, favorited: false }
/** 已收藏的「旧动态」，用于验证取消收藏的目标状态。 */
const favoritedOld: Post = { ...storedPosts[0]!, likes: 0, liked: false, favorited: true }

describe('toggleLike', () => {
  beforeEach(() => {
    vi.mocked(setPostLiked).mockReset()
  })

  it('点赞成功后用服务端返回的动态替换对应项，并广播变更', async () => {
    const updated: Post = { ...storedPosts[0]!, likes: 1, liked: true, favorited: false }
    vi.mocked(setPostLiked).mockResolvedValue({ ok: true, data: updated })
    const store = usePostsStore()
    await store.hydrate()
    const untouched = store.posts.find((post) => post.id === 'new')

    const result = await store.toggleLike('old')

    expect(setPostLiked).toHaveBeenCalledWith('old', true)
    expect(result).toEqual({ ok: true, post: updated })
    expect(store.posts.find((post) => post.id === 'old')).toEqual(updated)
    // 其它动态保持原引用，避免整表重建引发无谓重渲染
    expect(store.posts.find((post) => post.id === 'new')).toBe(untouched)
    expect(store.totalCount).toBe(2)
    expect(postsChannel.notify).toHaveBeenCalledTimes(1)
  })

  it('已点赞时再次点击发送取消点赞请求', async () => {
    vi.mocked(fetchPosts).mockResolvedValue({ ok: true, data: [{ ...likedOld }] })
    vi.mocked(setPostLiked).mockResolvedValue({
      ok: true,
      data: { ...likedOld, likes: 0, liked: false },
    })
    const store = usePostsStore()
    await store.hydrate()

    const result = await store.toggleLike('old')

    expect(setPostLiked).toHaveBeenCalledWith('old', false)
    expect(result).toEqual({ ok: true, post: { ...likedOld, likes: 0, liked: false } })
    expect(store.posts[0]?.liked).toBe(false)
    expect(store.posts[0]?.likes).toBe(0)
  })

  it('失败时不改动列表、不广播，并透传错误码', async () => {
    vi.mocked(setPostLiked).mockResolvedValue({ ok: false, error: 'NETWORK', status: 0 })
    const store = usePostsStore()
    await store.hydrate()
    const before = store.posts

    expect(await store.toggleLike('old')).toEqual({ ok: false, error: 'NETWORK' })
    expect(store.posts).toBe(before)
    expect(store.posts.find((post) => post.id === 'old')?.liked).toBeUndefined()
    expect(postsChannel.notify).not.toHaveBeenCalled()
  })

  it('服务端 NOT_FOUND 原样透传', async () => {
    vi.mocked(setPostLiked).mockResolvedValue({ ok: false, error: 'NOT_FOUND', status: 404 })
    const store = usePostsStore()
    await store.hydrate()
    const before = store.posts

    expect(await store.toggleLike('old')).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect(store.posts).toBe(before)
  })

  it('未知 id 不发请求，直接返回 NOT_FOUND', async () => {
    const store = usePostsStore()
    await store.hydrate()

    expect(await store.toggleLike('missing')).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect(setPostLiked).not.toHaveBeenCalled()
  })

  it('同一 id 请求进行中时重复点击只发一次请求，并暴露 pending 状态', async () => {
    const request = deferred<ApiResult<Post>>()
    vi.mocked(setPostLiked).mockReturnValue(request.promise)
    const store = usePostsStore()
    await store.hydrate()
    const updated: Post = { ...storedPosts[0]!, likes: 1, liked: true, favorited: false }

    const first = store.toggleLike('old')
    expect(store.isPending('old')).toBe(true)
    expect(store.pendingIds).toEqual(['old'])

    // 请求未结算时的第二次点击直接失败，且不再发起请求
    expect(await store.toggleLike('old')).toEqual({ ok: false, error: 'SERVER' })
    expect(setPostLiked).toHaveBeenCalledTimes(1)

    request.resolve({ ok: true, data: updated })
    await expect(first).resolves.toEqual({ ok: true, post: updated })

    expect(store.isPending('old')).toBe(false)
    expect(store.pendingIds).toEqual([])
  })
})

describe('toggleFavorite', () => {
  beforeEach(() => {
    vi.mocked(setPostFavorited).mockReset()
  })

  it('收藏成功后用服务端返回的动态替换对应项，并广播变更', async () => {
    const updated: Post = { ...storedPosts[0]!, likes: 0, liked: false, favorited: true }
    vi.mocked(setPostFavorited).mockResolvedValue({ ok: true, data: updated })
    const store = usePostsStore()
    await store.hydrate()

    const result = await store.toggleFavorite('old')

    expect(setPostFavorited).toHaveBeenCalledWith('old', true)
    expect(result).toEqual({ ok: true, post: updated })
    expect(store.posts.find((post) => post.id === 'old')?.favorited).toBe(true)
    expect(postsChannel.notify).toHaveBeenCalledTimes(1)
  })

  it('已收藏时再次点击发送取消收藏请求', async () => {
    vi.mocked(fetchPosts).mockResolvedValue({ ok: true, data: [{ ...favoritedOld }] })
    vi.mocked(setPostFavorited).mockResolvedValue({
      ok: true,
      data: { ...favoritedOld, favorited: false },
    })
    const store = usePostsStore()
    await store.hydrate()

    await store.toggleFavorite('old')

    expect(setPostFavorited).toHaveBeenCalledWith('old', false)
    expect(store.posts[0]?.favorited).toBe(false)
  })

  it('失败时不改动列表、不广播，并透传错误码', async () => {
    vi.mocked(setPostFavorited).mockResolvedValue({ ok: false, error: 'NOT_FOUND', status: 404 })
    const store = usePostsStore()
    await store.hydrate()
    const before = store.posts

    expect(await store.toggleFavorite('old')).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect(store.posts).toBe(before)
    expect(postsChannel.notify).not.toHaveBeenCalled()
  })

  it('未知 id 不发请求，直接返回 NOT_FOUND', async () => {
    const store = usePostsStore()
    await store.hydrate()

    expect(await store.toggleFavorite('missing')).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect(setPostFavorited).not.toHaveBeenCalled()
  })
})
