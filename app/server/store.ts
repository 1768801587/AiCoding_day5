import type { Post } from '../src/types'
import { createId, sortPostsDesc } from '../src/utils/post'

/** 导入统计：imported = 本次新写入条数，skipped = 因 id 已存在未写入条数，total = 导入后总数。 */
export interface ImportSummary {
  imported: number
  skipped: number
  total: number
}

/** 内存动态仓库，所有读写都在这里完成，路由层与 UI 层都不持有数据。 */
export interface PostStore {
  /** 按 createdAt 倒序返回动态副本（每次都是新数组，外部改动不影响内部）。 */
  list(): Post[]
  /** 当前总条数。 */
  count(): number
  /** 按 id 查询，未命中返回 undefined。 */
  get(id: string): Post | undefined
  /** 写入一条新动态，id 由服务端生成；createdAt 缺省用当前时间。 */
  create(text: string, createdAt?: number): Post
  /** 删除指定 id，返回是否真的删掉了。 */
  remove(id: string): boolean
  /** 设置点赞状态（幂等）：仅在状态真正变化时增减计数，未命中返回 undefined。 */
  setLiked(id: string, liked: boolean): Post | undefined
  /** 设置收藏状态（幂等）：只切换布尔值，未命中返回 undefined。 */
  setFavorited(id: string, favorited: boolean): Post | undefined
  /** 批量写入（按 id 去重，已存在的保留服务端原有数据）。 */
  importMany(posts: readonly Post[]): ImportSummary
  /** 预演导入后的总条数，用于路由层在写入前判断是否超限。 */
  projectedTotal(posts: readonly Post[]): number
}

/**
 * 创建内存存储。
 * 读多写少的场景下用「排序缓存 + 写操作失效」避免每次 list 都重新排序，
 * 缓存只保存内部副本，对外始终返回浅拷贝数组。
 */
export function createPostStore(): PostStore {
  const posts = new Map<string, Post>()

  /** 排序后的快照；写操作后置空，下次 list 时重建。 */
  let sortedCache: Post[] | null = null

  const invalidate = (): void => {
    sortedCache = null
  }

  /** 至少返回 1 条时才会进入缓存，否则每次都是空数组。 */
  const sortedSnapshot = (): Post[] => {
    if (sortedCache === null) {
      sortedCache = sortPostsDesc([...posts.values()])
    }

    return sortedCache
  }

  /**
   * 生成一个未被占用的 id：
   * `createId` 只保证随机性，同一毫秒内仍可能撞车，这里显式重试兜底。
   */
  const nextId = (createdAt: number): string => {
    let id = createId(createdAt)

    while (posts.has(id)) {
      id = createId(createdAt)
    }

    return id
  }

  return {
    list(): Post[] {
      return sortedSnapshot().map((post) => ({ ...post }))
    },

    count(): number {
      return posts.size
    },

    get(id: string): Post | undefined {
      const post = posts.get(id)

      return post ? { ...post } : undefined
    },

    create(text: string, createdAt: number = Date.now()): Post {
      // 新动态一律从「未点赞、未收藏」的干净状态开始
      const post: Post = {
        id: nextId(createdAt),
        text,
        createdAt,
        likes: 0,
        liked: false,
        favorited: false,
      }

      posts.set(post.id, post)
      invalidate()

      return { ...post }
    },

    setLiked(id: string, liked: boolean): Post | undefined {
      const post = posts.get(id)

      if (!post) {
        return undefined
      }

      const currentLikes = post.likes ?? 0
      const wasLiked = post.liked === true
      // 幂等语义：状态没变时计数不动，避免重复点击把计数越加越多
      let likes = currentLikes

      if (liked !== wasLiked) {
        likes = liked ? currentLikes + 1 : Math.max(0, currentLikes - 1)
      }

      // 整体替换而不是原地 mutate，保证外部拿到的旧快照不被偷偷改写
      const updated: Post = { ...post, likes, liked }
      posts.set(id, updated)
      invalidate()

      return { ...updated }
    },

    setFavorited(id: string, favorited: boolean): Post | undefined {
      const post = posts.get(id)

      if (!post) {
        return undefined
      }

      const updated: Post = { ...post, favorited }
      posts.set(id, updated)
      invalidate()

      return { ...updated }
    },

    remove(id: string): boolean {
      const removed = posts.delete(id)

      if (removed) {
        invalidate()
      }

      return removed
    },

    importMany(incoming: readonly Post[]): ImportSummary {
      let imported = 0
      let skipped = 0

      for (const post of incoming) {
        // 已存在的 id 保留服务端数据，批量导入天然幂等
        if (posts.has(post.id)) {
          skipped += 1
          continue
        }

        // 点赞/收藏属于服务端状态，导入时一律重置，不接受外部伪造的计数
        posts.set(post.id, {
          id: post.id,
          text: post.text,
          createdAt: post.createdAt,
          likes: 0,
          liked: false,
          favorited: false,
        })
        imported += 1
      }

      if (imported > 0) {
        invalidate()
      }

      return { imported, skipped, total: posts.size }
    },

    projectedTotal(incoming: readonly Post[]): number {
      const incomingIds = new Set<string>()

      for (const post of incoming) {
        if (!posts.has(post.id)) {
          incomingIds.add(post.id)
        }
      }

      return posts.size + incomingIds.size
    },
  }
}
