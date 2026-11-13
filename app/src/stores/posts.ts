import { computed, readonly, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { MAX_LENGTH } from '../constants'
import type {
  ApiErrorCode,
  ApiResult,
  DeleteResult,
  ImportOutcome,
  Post,
  PublishResult,
} from '../types'
import {
  createPost,
  deletePost,
  fetchPosts,
  importPosts,
  setPostFavorited,
  setPostLiked,
} from '../utils/api'
import { postsChannel } from '../utils/broadcast'
import { computeStats, countChars, formatCharCount, sortPostsDesc } from '../utils/post'

/** 点赞 / 收藏动作的结果：失败时不触发 UI，由展示层决定文案。 */
export type ToggleResult = { ok: true; post: Post } | { ok: false; error: ApiErrorCode }

/** 可切换的社交状态字段，点赞与收藏共用一套流程。 */
type ToggleField = 'liked' | 'favorited'

/**
 * 动态数据源。所有读写、校验与统计都在这里完成，组件只负责展示。
 * 数据存于服务端：写操作失败时不改动本地列表，避免出现「假成功」。
 */
export const usePostsStore = defineStore('posts', () => {
  const posts = shallowRef<Post[]>([])
  /** 首次/重新加载是否进行中，供展示层显示骨架或禁用按钮。 */
  const isLoading = shallowRef(false)
  /** 最近一次加载失败的错误码，成功后清空。 */
  const loadError = shallowRef<ApiErrorCode | null>(null)
  /**
   * 统计使用的时间基准。
   * 单独抽成响应式状态，才能让「今日发布」在跨天后被外部刷新触发重算。
   */
  const now = shallowRef(new Date())
  /**
   * 点赞 / 收藏请求进行中的动态 id。
   * 用于按钮禁用与请求去重：同一条动态同一时刻只允许一个在途请求。
   */
  const pendingIds = shallowRef<readonly string[]>([])

  const orderedPosts = computed(() => sortPostsDesc(posts.value))
  const stats = computed(() => computeStats(posts.value, now.value))
  const totalCount = computed(() => stats.value.total)
  const todayCount = computed(() => stats.value.today)
  const charStatLabel = computed(() => formatCharCount(stats.value.chars))

  /** 刷新统计的时间基准（跨天、页面重新可见时调用）。 */
  function refreshNow(current: Date = new Date()): void {
    now.value = current
  }

  /**
   * 从服务端拉取列表。
   * 只有请求成功才替换 `posts`；失败仅记录错误码，保证已有列表引用不变。
   */
  async function load(): Promise<void> {
    isLoading.value = true

    try {
      const result = await fetchPosts()

      if (result.ok) {
        posts.value = result.data
        loadError.value = null
      } else {
        loadError.value = result.error
      }
    } finally {
      isLoading.value = false
    }
  }

  /** 首次加载：由应用入口显式调用，避免 store 顶层副作用。 */
  async function hydrate(): Promise<void> {
    await load()
    refreshNow()
  }

  /** 重新拉取：用于跨标签页变更、导入完成后的同步。 */
  async function refresh(): Promise<void> {
    await load()
    refreshNow()
  }

  /** 发布一条动态。校验与写入失败都通过返回值表达，不直接触发 UI。 */
  async function publish(text: string): Promise<PublishResult> {
    const content = text.trim()

    if (!content) {
      return { ok: false, error: 'EMPTY' }
    }

    if (countChars(content) > MAX_LENGTH) {
      return { ok: false, error: 'TOO_LONG' }
    }

    const result = await createPost(content)

    if (!result.ok) {
      // 后端也会做长度校验，需要把自身的 TOO_LONG 原样反馈给展示层
      return { ok: false, error: result.error === 'TOO_LONG' ? 'TOO_LONG' : 'SAVE_FAILED' }
    }

    const post = result.data

    posts.value = [post, ...posts.value]
    refreshNow()
    postsChannel.notify()

    return { ok: true, post }
  }

  /** 删除一条动态。服务端删除成功后才从本地列表移除。 */
  async function remove(id: string): Promise<DeleteResult> {
    const result = await deletePost(id)

    if (!result.ok) {
      return { ok: false, error: result.error === 'NOT_FOUND' ? 'NOT_FOUND' : 'SAVE_FAILED' }
    }

    posts.value = posts.value.filter((post) => post.id !== id)
    postsChannel.notify()

    return { ok: true }
  }

  /**
   * 批量导入动态：去重、写库与校验全部交给服务端，
   * 成功后重新拉取一次列表，保证计数与顺序与服务端一致。
   */
  async function importAll(incoming: readonly Post[]): Promise<ImportOutcome> {
    const result = await importPosts(incoming)

    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    await refresh()
    postsChannel.notify()

    return { ok: true, imported: result.data.imported, skipped: result.data.skipped }
  }

  /** 判断某条动态是否正在切换点赞 / 收藏状态。 */
  function isPending(id: string): boolean {
    return pendingIds.value.includes(id)
  }

  /**
   * 点赞与收藏共用的状态切换：
   * 1. 本地列表没有该动态时视为不存在，直接返回 NOT_FOUND，不发请求；
   * 2. 同 id 已有在途请求时直接返回 SERVER，避免重复点击反复翻转状态；
   * 3. 目标状态由当前值决定（已是 `true` 则取消，否则开启）；
   * 4. 只有请求成功才用服务端返回的动态替换对应项，失败保留原列表。
   */
  async function toggle(
    id: string,
    field: ToggleField,
    request: (id: string, active: boolean) => Promise<ApiResult<Post>>,
  ): Promise<ToggleResult> {
    const target = posts.value.find((post) => post.id === id)

    if (!target) {
      return { ok: false, error: 'NOT_FOUND' }
    }

    if (isPending(id)) {
      return { ok: false, error: 'SERVER' }
    }

    const active = target[field] !== true
    pendingIds.value = [...pendingIds.value, id]

    try {
      const result = await request(id, active)

      if (!result.ok) {
        return { ok: false, error: result.error }
      }

      const updated = result.data

      // 单条替换，其余动态保持原引用，避免整表重建
      posts.value = posts.value.map((post) => (post.id === id ? updated : post))
      postsChannel.notify()

      return { ok: true, post: updated }
    } finally {
      pendingIds.value = pendingIds.value.filter((pending) => pending !== id)
    }
  }

  /** 切换点赞状态；点赞数为服务端权威值，本地不做乐观更新。 */
  function toggleLike(id: string): Promise<ToggleResult> {
    return toggle(id, 'liked', setPostLiked)
  }

  /** 切换收藏状态；同样只以服务端返回结果为准。 */
  function toggleFavorite(id: string): Promise<ToggleResult> {
    return toggle(id, 'favorited', setPostFavorited)
  }

  return {
    posts,
    now,
    isLoading,
    loadError,
    orderedPosts,
    stats,
    totalCount,
    todayCount,
    charStatLabel,
    pendingIds: readonly(pendingIds),
    refreshNow,
    hydrate,
    refresh,
    publish,
    remove,
    importAll,
    isPending,
    toggleLike,
    toggleFavorite,
  }
})
