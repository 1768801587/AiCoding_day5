<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import AppToast from './components/AppToast.vue'
import PostComposer from './components/PostComposer.vue'
import PostList from './components/PostList.vue'
import SidePanel from './components/SidePanel.vue'
import StatsPanel from './components/StatsPanel.vue'
import { usePostsStore } from './stores/posts'

const posts = usePostsStore()
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
          一个轻量的动态记录空间。写下此刻的心情与想法，所有内容都保存在你的浏览器本地，简单、安全且私密。
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
        <PostList :posts="posts.orderedPosts" />
      </div>

      <SidePanel />
    </div>
  </main>

  <footer class="footer">
    <p class="footer__text">Mingle · 数据仅存于本地浏览器</p>
  </footer>

  <AppToast />
</template>
