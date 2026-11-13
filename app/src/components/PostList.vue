<script setup lang="ts">
import { computed } from 'vue'
import type { Post } from '../types'
import EmptyState from './EmptyState.vue'
import PostItem from './PostItem.vue'

const props = defineProps<{ posts: readonly Post[] }>()

const countLabel = computed(() => `${props.posts.length} 条`)
</script>

<template>
  <section class="feed" aria-label="动态列表">
    <div class="feed__head">
      <h2 class="feed__title">最新动态</h2>
      <span class="feed__count">{{ countLabel }}</span>
    </div>

    <ul v-if="posts.length > 0" class="feed__list">
      <PostItem v-for="post in posts" :key="post.id" :post="post" />
    </ul>

    <EmptyState v-else />
  </section>
</template>
