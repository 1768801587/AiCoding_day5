<script setup lang="ts">
import { computed } from 'vue'
import { AUTHOR_NAME } from '../constants'
import type { Post } from '../types'
import { formatTime } from '../utils/post'

const props = defineProps<{ post: Post }>()

const authorInitial = computed(() => AUTHOR_NAME.charAt(0).toUpperCase())
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())
const displayTime = computed(() => formatTime(props.post.createdAt))
</script>

<template>
  <li class="post">
    <div class="post__avatar" aria-hidden="true">{{ authorInitial }}</div>
    <div class="post__body">
      <div class="post__meta">
        <span class="post__author">{{ AUTHOR_NAME }}</span>
        <time class="post__time" :datetime="isoTime">{{ displayTime }}</time>
      </div>
      <p class="post__text">{{ post.text }}</p>
    </div>
  </li>
</template>
