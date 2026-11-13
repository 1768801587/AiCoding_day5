<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { MAX_LENGTH, TOAST_MESSAGES } from '../constants'
import { useToast } from '../composables/useToast'
import { usePostsStore } from '../stores/posts'
import type { PublishError } from '../types'

const ERROR_MESSAGES: Record<PublishError, string> = {
  EMPTY: TOAST_MESSAGES.empty,
  TOO_LONG: TOAST_MESSAGES.tooLong,
  SAVE_FAILED: TOAST_MESSAGES.saveFailed,
}

const posts = usePostsStore()
const toast = useToast()

const draft = shallowRef('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const countLabel = computed(() => `${draft.value.length} / ${MAX_LENGTH}`)
const isAtLimit = computed(() => draft.value.length >= MAX_LENGTH)
const canSubmit = computed(() => draft.value.trim().length > 0)

function onInput(event: Event): void {
  draft.value = (event.target as HTMLTextAreaElement).value
}

function submit(): void {
  const result = posts.publish(draft.value)

  if (!result.ok) {
    toast.show(ERROR_MESSAGES[result.error], true)
    if (result.error === 'EMPTY') {
      textareaRef.value?.focus()
    }
    return
  }

  draft.value = ''
  textareaRef.value?.focus()
  toast.show(TOAST_MESSAGES.success)
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    submit()
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
      :maxlength="MAX_LENGTH"
      placeholder="写下你的动态…"
      :value="draft"
      @input="onInput"
      @keydown="onKeydown"
    ></textarea>

    <div class="composer__footer">
      <span class="composer__count" :class="{ 'is-limit': isAtLimit }">{{ countLabel }}</span>
      <div class="composer__actions">
        <span class="composer__tip">Ctrl / ⌘ + Enter 快速发布</span>
        <button type="button" class="composer__submit" :disabled="!canSubmit" @click="submit">
          <span>发布</span>
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
