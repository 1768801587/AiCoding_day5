<script setup lang="ts">
import { computed, onScopeDispose, shallowRef } from 'vue'
import { AUTHOR_NAME, DELETE_CONFIRM_MS } from '../constants'
import { useNow } from '../composables/useNow'
import type { Post } from '../types'
import { formatPostTime, isKnownTimestamp } from '../utils/post'

const props = defineProps<{ post: Post }>()
const emit = defineEmits<{ remove: [id: string] }>()

const now = useNow()

const authorInitial = computed(() => AUTHOR_NAME.charAt(0).toUpperCase())
const hasKnownTime = computed(() => isKnownTimestamp(props.post.createdAt))
const isoTime = computed(() =>
  hasKnownTime.value ? new Date(props.post.createdAt).toISOString() : undefined,
)
const displayTime = computed(() => formatPostTime(props.post.createdAt, now.value))

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
    </div>
  </li>
</template>
