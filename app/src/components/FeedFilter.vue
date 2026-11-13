<script setup lang="ts">
import { computed } from 'vue'
import type { FilterRange } from '../types'

const props = defineProps<{ keyword: string; range: FilterRange }>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:range': [value: FilterRange]
}>()

const RANGE_OPTIONS: { value: FilterRange; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '近 7 天' },
  { value: 'month', label: '近 30 天' },
]

const hasKeyword = computed(() => props.keyword !== '')

function onKeywordInput(event: Event): void {
  emit('update:keyword', (event.target as HTMLInputElement).value)
}

function onRangeChange(event: Event): void {
  emit('update:range', (event.target as HTMLSelectElement).value as FilterRange)
}

function clearKeyword(): void {
  emit('update:keyword', '')
}
</script>

<template>
  <div class="feed__toolbar">
    <label class="sr-only" for="feedSearch">搜索动态</label>
    <input
      id="feedSearch"
      class="feed__search"
      type="search"
      placeholder="搜索动态…"
      :value="keyword"
      @input="onKeywordInput"
    />
    <button
      v-if="hasKeyword"
      type="button"
      class="feed__search-clear"
      aria-label="清除搜索关键词"
      @click="clearKeyword"
    >
      清除
    </button>

    <label class="sr-only" for="feedRange">时间范围</label>
    <select id="feedRange" class="feed__select" :value="range" @change="onRangeChange">
      <option v-for="option in RANGE_OPTIONS" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>
