<script setup lang="ts">
import DataPanel from './DataPanel.vue'
</script>

<template>
  <aside class="layout__side" aria-label="侧边信息">
    <section class="side-card profile">
      <div class="profile__cover" aria-hidden="true"></div>
      <div class="profile__avatar" aria-hidden="true">M</div>
      <div class="profile__body">
        <h3 class="profile__name">Mingler</h3>
        <p class="profile__bio">在 Mingle 记录日常的普通人。</p>
        <div class="profile__tags">
          <span class="chip chip--soft">服务端内存</span>
          <span class="chip chip--soft">轻社交</span>
        </div>
      </div>
    </section>

    <section class="side-card">
      <h3 class="side-card__title">小提示</h3>
      <ul class="tips">
        <li class="tips__item">
          <span class="tips__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
          在发布框写下此刻的想法
        </li>
        <li class="tips__item">
          <span class="tips__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
            </svg>
          </span>
          按 Ctrl / ⌘ + Enter 快速发布
        </li>
        <li class="tips__item">
          <span class="tips__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          数据存于服务端内存，重启后清空
        </li>
      </ul>
    </section>

    <DataPanel />

    <section class="side-card side-card--gradient">
      <h3 class="side-card__title">关于 Mingle</h3>
      <p class="side-card__text">
        前后端同仓的轻量动态应用：Vue 3 + Pinia 前端，Hono 提供 RESTful API。
      </p>
    </section>
  </aside>
</template>
