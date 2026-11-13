<script setup lang="ts">
defineProps<{
  total: number
  today: number
  charsLabel: string
}>()
</script>

<template>
  <div class="hero__stats" aria-label="数据统计">
    <div class="stat">
      <span class="stat__value">{{ total }}</span>
      <span class="stat__label">动态总数</span>
    </div>
    <div class="stat">
      <span class="stat__value">{{ today }}</span>
      <span class="stat__label">今日发布</span>
    </div>
    <div class="stat">
      <span class="stat__value">{{ charsLabel }}</span>
      <span class="stat__label">累计字数</span>
    </div>
  </div>
</template>
