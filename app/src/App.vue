<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AppToast from './components/AppToast.vue'
import FeedFilter from './components/FeedFilter.vue'
import PostComposer from './components/PostComposer.vue'
import PostList from './components/PostList.vue'
import SidePanel from './components/SidePanel.vue'
import StatsPanel from './components/StatsPanel.vue'
import { TOAST_MESSAGES } from './constants'
import { useDayChange } from './composables/useDayChange'
import { useToast } from './composables/useToast'
import { usePostsStore } from './stores/posts'
import type { FilterRange } from './types'
import { postsChannel } from './utils/broadcast'
import { filterPosts } from './utils/post'

const posts = usePostsStore()
const toast = useToast()

const keyword = shallowRef('')
const range = shallowRef<FilterRange>('all')

const isFiltered = computed(() => keyword.value.trim() !== '' || range.value !== 'all')
const visiblePosts = computed(() =>
  filterPosts(
    posts.orderedPosts,
    { keyword: keyword.value, range: range.value },
    posts.now.getTime(),
  ),
)

async function onRemove(id: string): Promise<void> {
  const result = await posts.remove(id)

  if (result.ok) {
    toast.show(TOAST_MESSAGES.deleteSuccess)
    return
  }

  toast.show(
    result.error === 'NOT_FOUND' ? TOAST_MESSAGES.deleteNotFound : TOAST_MESSAGES.deleteFailed,
    true,
  )
}

// 其他标签页发布/删除后重新拉取，避免列表不一致
let unsubscribeChannel: (() => void) | null = null

/** 页面重新可见时刷新，避免长时间挂后台导致数据过期 */
function onVisible(): void {
  if (document.visibilityState === 'visible') {
    void posts.refresh()
  }
}

onMounted(() => {
  unsubscribeChannel = postsChannel.subscribe(() => {
    void posts.refresh()
  })
  document.addEventListener('visibilitychange', onVisible)
})

onUnmounted(() => {
  unsubscribeChannel?.()
  unsubscribeChannel = null
  document.removeEventListener('visibilitychange', onVisible)
})

// 跨过零点后刷新「今日发布」统计
useDayChange(() => posts.refreshNow())
</script>

<template>
  <div class="bg-orb bg-orb--one" aria-hidden="true"></div>
  <div class="bg-orb bg-orb--two" aria-hidden="true"></div>
  <div class="bg-orb bg-orb--three" aria-hidden="true"></div>
  <div class="bg-grid" aria-hidden="true"></div>

  <AppHeader />

  <main class="app">
    <section class="hero" aria-labelledby="heroTitle">
      <div class="hero__content">
        <span class="hero__eyebrow">Welcome to Mingle</span>
        <h1 id="heroTitle" class="hero__title">记录当下，<br />分享此刻</h1>
        <p class="hero__desc">
          写下此刻的心情与想法，所有内容都保存在服务端内存中，服务重启后会清空。
        </p>
      </div>

      <StatsPanel
        :total="posts.totalCount"
        :today="posts.todayCount"
        :chars-label="posts.charStatLabel"
      />
    </section>

    <div class="layout">
      <div class="layout__main">
        <PostComposer />

        <p v-if="posts.loadError" class="feed__error" role="alert">
          <span class="feed__error-text">{{ TOAST_MESSAGES.loadFailed }}</span>
          <button type="button" class="feed__error-retry" @click="void posts.refresh()">重试</button>
        </p>

        <PostList
          :posts="visiblePosts"
          :total="posts.totalCount"
          :is-filtered="isFiltered"
          @remove="onRemove"
        >
          <template #filter>
            <FeedFilter v-model:keyword="keyword" v-model:range="range" />
          </template>
        </PostList>
      </div>

      <SidePanel />
    </div>
  </main>

  <footer class="footer">
    <p class="footer__text">Mingle · 数据存于服务端内存</p>
  </footer>

  <AppToast />
</template>
