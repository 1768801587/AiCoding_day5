import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { MAX_LENGTH } from '../constants'
import type { Post, PublishResult } from '../types'
import { computeStats, createId, formatCharCount, sortPostsDesc } from '../utils/post'
import { loadPosts, savePosts } from '../utils/storage'

/**
 * 动态数据源。所有读写、校验与统计都在这里完成，组件只负责展示。
 * 持久化采用显式的「先落盘、成功后再更新 state」，避免保存失败时出现假成功。
 */
export const usePostsStore = defineStore('posts', () => {
  const posts = shallowRef<Post[]>([])

  const orderedPosts = computed(() => sortPostsDesc(posts.value))
  const stats = computed(() => computeStats(posts.value))
  const totalCount = computed(() => stats.value.total)
  const todayCount = computed(() => stats.value.today)
  const charStatLabel = computed(() => formatCharCount(stats.value.chars))

  /** 从 localStorage 载入数据。由应用入口显式调用，避免 store 顶层副作用。 */
  function hydrate(): void {
    posts.value = loadPosts()
  }

  /** 发布一条动态。校验与保存失败都通过返回值表达，不直接触发 UI。 */
  function publish(text: string): PublishResult {
    const content = text.trim()

    if (!content) {
      return { ok: false, error: 'EMPTY' }
    }

    if (content.length > MAX_LENGTH) {
      return { ok: false, error: 'TOO_LONG' }
    }

    const post: Post = { id: createId(), text: content, createdAt: Date.now() }
    const nextPosts = [...posts.value, post]

    if (!savePosts(nextPosts)) {
      return { ok: false, error: 'SAVE_FAILED' }
    }

    posts.value = nextPosts
    return { ok: true, post }
  }

  return {
    posts,
    orderedPosts,
    totalCount,
    todayCount,
    charStatLabel,
    hydrate,
    publish,
  }
})
