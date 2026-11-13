<script setup lang="ts">
import { computed } from 'vue'
import type { Post } from '../types'
import EmptyState from './EmptyState.vue'
import PostItem from './PostItem.vue'

const props = withDefaults(
  defineProps<{
    posts: readonly Post[]
    /** 未筛选时的动态总数，用于展示「命中 / 总数」 */
    total?: number
    /** 当前是否处于筛选状态，决定条数文案与空态提示 */
    isFiltered?: boolean
    /** 正在切换点赞 / 收藏状态的动态 id，命中的条目禁用操作按钮 */
    pendingIds?: readonly string[]
  }>(),
  { total: 0, isFiltered: false, pendingIds: () => [] },
)

const emit = defineEmits<{
  remove: [id: string]
  'toggle-like': [id: string]
  'toggle-favorite': [id: string]
}>()

const countLabel = computed(() =>
  props.isFiltered ? `${props.posts.length} / ${props.total} 条` : `${props.posts.length} 条`,
)

const emptyTitle = computed(() => (props.isFiltered ? '没有匹配的动态' : '这里还很安静'))
const emptyText = computed(() =>
  props.isFiltered ? '试试换个关键词或时间范围' : '还没有动态，发布第一条吧～',
)

/** 列表只做状态判断，请求本身由 store 负责。 */
function isPostPending(id: string): boolean {
  return props.pendingIds.includes(id)
}

function onRemove(id: string): void {
  emit('remove', id)
}

function onToggleLike(id: string): void {
  emit('toggle-like', id)
}

function onToggleFavorite(id: string): void {
  emit('toggle-favorite', id)
}
</script>

<template>
  <section class="feed" aria-label="动态列表">
    <div class="feed__head">
      <h2 class="feed__title">最新动态</h2>
      <div class="feed__head-tools">
        <slot name="filter" />
        <span class="feed__count">{{ countLabel }}</span>
      </div>
    </div>

    <ul v-if="posts.length > 0" class="feed__list">
      <PostItem
        v-for="post in posts"
        :key="post.id"
        :post="post"
        :is-pending="isPostPending(post.id)"
        @remove="onRemove"
        @toggle-like="onToggleLike"
        @toggle-favorite="onToggleFavorite"
      />
    </ul>

    <EmptyState v-else :title="emptyTitle" :text="emptyText" />
  </section>
</template>
