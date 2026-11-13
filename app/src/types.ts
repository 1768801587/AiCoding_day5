/** 一条动态。字段与旧版 localStorage 数据结构完全一致。 */
export interface Post {
  id: string
  text: string
  createdAt: number
}

/** 发布失败的原因，由展示层决定对应文案。 */
export type PublishError = 'EMPTY' | 'TOO_LONG' | 'SAVE_FAILED'

/** 发布结果：成功时带回新动态，失败时带回原因。 */
export type PublishResult = { ok: true; post: Post } | { ok: false; error: PublishError }
