<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { MAX_LENGTH, TOAST_MESSAGES } from '../constants'
import { useDraft } from '../composables/useDraft'
import { useToast } from '../composables/useToast'
import { usePostsStore } from '../stores/posts'
import type { PublishError } from '../types'
import { countChars } from '../utils/post'

const ERROR_MESSAGES: Record<PublishError, string> = {
  EMPTY: TOAST_MESSAGES.empty,
  TOO_LONG: TOAST_MESSAGES.tooLong,
  SAVE_FAILED: TOAST_MESSAGES.saveFailed,
}

const posts = usePostsStore()
const toast = useToast()
const draftStore = useDraft()

const draft = shallowRef(draftStore.load())
/** 提交是否进行中，用于禁用按钮并切换文案，避免重复发布 */
const isSubmitting = shallowRef(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const charCount = computed(() => countChars(draft.value))
const countLabel = computed(() => `${charCount.value} / ${MAX_LENGTH}`)
const isAtLimit = computed(() => charCount.value >= MAX_LENGTH)
const isOverLimit = computed(() => charCount.value > MAX_LENGTH)
const canSubmit = computed(() => !isSubmitting.value && draft.value.trim().length > 0)

function onInput(event: Event): void {
  const value = (event.target as HTMLTextAreaElement).value
  draft.value = value

  // 清空输入时顺带清掉草稿，避免下次打开又冒出来
  if (value === '') {
    draftStore.clear()
    return
  }
  draftStore.save(value)
}

async function submit(): Promise<void> {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true

  try {
    const result = await posts.publish(draft.value)

    if (!result.ok) {
      toast.show(ERROR_MESSAGES[result.error], true)
      if (result.error === 'EMPTY') {
        textareaRef.value?.focus()
      }
      return
    }

    draft.value = ''
    draftStore.clear()
    textareaRef.value?.focus()
    toast.show(TOAST_MESSAGES.success)
  } finally {
    isSubmitting.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    void submit()
  }
}
</script>

<template>
  <section class="composer" aria-label="发布动态">
    <div class="composer__head">
      <div class="composer__avatar" aria-hidden="true">M</div>
      <div class="composer__intro">
        <span class="composer__name">Mingler</span>
        <span class="composer__hint">此刻在想什么？</span>
      </div>
    </div>

    <label class="sr-only" for="postText">动态内容</label>
    <textarea
      id="postText"
      ref="textareaRef"
      class="composer__input"
      rows="3"
      placeholder="写下你的动态…"
      :value="draft"
      :aria-invalid="isOverLimit"
      aria-describedby="postTextCount"
      @input="onInput"
      @keydown="onKeydown"
    ></textarea>

    <div class="composer__footer">
      <span
        id="postTextCount"
        class="composer__count"
        :class="{ 'is-limit': isAtLimit, 'is-over': isOverLimit }"
      >
        {{ countLabel }}
      </span>
      <div class="composer__actions">
        <span class="composer__tip">Ctrl / ⌘ + Enter 快速发布</span>
        <button
          type="button"
          class="composer__submit"
          :class="{ 'is-busy': isSubmitting }"
          :disabled="!canSubmit"
          :aria-busy="isSubmitting"
          @click="submit"
        >
          <span>{{ isSubmitting ? '发布中…' : '发布' }}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4Z" />
          </svg>
        </button>
      </div>
    </div>
  </section>
</template>
