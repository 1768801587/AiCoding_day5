<script setup lang="ts">
import { computed, onScopeDispose, shallowRef } from 'vue'
import { AUTHOR_NAME, DELETE_CONFIRM_MS } from '../constants'
import { useNow } from '../composables/useNow'
import type { Post } from '../types'
import { formatPostTime, isKnownTimestamp } from '../utils/post'

const props = withDefaults(
  defineProps<{
    post: Post
    /** 点赞 / 收藏请求进行中时禁用两个操作按钮 */
    isPending?: boolean
  }>(),
  { isPending: false },
)

const emit = defineEmits<{
  remove: [id: string]
  'toggle-like': [id: string]
  'toggle-favorite': [id: string]
}>()

const now = useNow()

const authorInitial = computed(() => AUTHOR_NAME.charAt(0).toUpperCase())
const hasKnownTime = computed(() => isKnownTimestamp(props.post.createdAt))
const isoTime = computed(() =>
  hasKnownTime.value ? new Date(props.post.createdAt).toISOString() : undefined,
)
const displayTime = computed(() => formatPostTime(props.post.createdAt, now.value))

/** 历史数据可能缺失社交字段，展示层一律显式兜底。 */
const isLiked = computed(() => props.post.liked === true)
const isFavorited = computed(() => props.post.favorited === true)
const likeCount = computed(() => props.post.likes ?? 0)

function onToggleLike(): void {
  emit('toggle-like', props.post.id)
}

function onToggleFavorite(): void {
  emit('toggle-favorite', props.post.id)
}

/** 两段式删除确认：首次点击进入确认态，3 秒未确认自动复原。 */
const isConfirming = shallowRef(false)
let confirmTimer: ReturnType<typeof setTimeout> | null = null

function clearConfirmTimer(): void {
  if (confirmTimer !== null) {
    clearTimeout(confirmTimer)
    confirmTimer = null
  }
}

function onDelete(): void {
  if (!isConfirming.value) {
    clearConfirmTimer()
    isConfirming.value = true
    confirmTimer = setTimeout(() => {
      isConfirming.value = false
      confirmTimer = null
    }, DELETE_CONFIRM_MS)
    return
  }

  clearConfirmTimer()
  isConfirming.value = false
  emit('remove', props.post.id)
}

onScopeDispose(clearConfirmTimer)
</script>

<template>
  <li class="post">
    <div class="post__avatar" aria-hidden="true">{{ authorInitial }}</div>
    <div class="post__body">
      <div class="post__meta">
        <span class="post__author">{{ AUTHOR_NAME }}</span>
        <time class="post__time" :datetime="isoTime">{{ displayTime }}</time>
        <button
          type="button"
          class="post__delete"
          :class="{ 'is-confirming': isConfirming }"
          :aria-label="isConfirming ? '确认删除这条动态' : '删除这条动态'"
          @click="onDelete"
        >
          {{ isConfirming ? '确认删除' : '删除' }}
        </button>
      </div>
      <p class="post__text">{{ post.text }}</p>

      <div class="post__actions">
        <button
          type="button"
          class="post__action post__action--like"
          :class="{ 'is-active': isLiked }"
          :aria-pressed="isLiked"
          :aria-label="isLiked ? '取消点赞' : '点赞这条动态'"
          :disabled="isPending"
          @click="onToggleLike"
        >
          <svg
            class="post__action-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M12 20.6l-1.42-1.29C5.36 14.72 2 11.68 2 7.96 2 4.92 4.42 2.5 7.5 2.5c1.74 0 3.41.81 4.5 2.09a6.02 6.02 0 0 1 4.5-2.09C19.58 2.5 22 4.92 22 7.96c0 3.72-3.36 6.76-8.58 11.36L12 20.6z"
            />
          </svg>
          <span class="post__action-count">{{ likeCount }}</span>
        </button>

        <button
          type="button"
          class="post__action post__action--favorite"
          :class="{ 'is-active': isFavorited }"
          :aria-pressed="isFavorited"
          :aria-label="isFavorited ? '取消收藏' : '收藏这条动态'"
          :disabled="isPending"
          @click="onToggleFavorite"
        >
          <svg
            class="post__action-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M12 3.1l2.72 5.51 6.08.89-4.4 4.29 1.04 6.06L12 16.98l-5.44 2.87 1.04-6.06-4.4-4.29 6.08-.89L12 3.1z"
            />
          </svg>
          <span class="post__action-text">{{ isFavorited ? '已收藏' : '收藏' }}</span>
        </button>
      </div>
    </div>
  </li>
</template>
