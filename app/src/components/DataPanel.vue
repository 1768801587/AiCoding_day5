<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { IMPORT_ERROR_MESSAGES, IMPORT_MAX_BYTES, TOAST_MESSAGES } from '../constants'
import { useToast } from '../composables/useToast'
import { usePostsStore } from '../stores/posts'
import type { ApiErrorCode } from '../types'
import { parseImport, serializePosts } from '../utils/backup'
import { downloadJson } from '../utils/download'

const posts = usePostsStore()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const isImporting = shallowRef(false)

/** 导出文件名里的时间戳：YYYYMMDD-HHmm */
function timestampLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number): string => String(value).padStart(2, '0')

  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  )
}

function onExport(): void {
  const filename = `mingle-posts-${timestampLabel(Date.now())}.json`
  const ok = downloadJson(filename, serializePosts(posts.posts))

  toast.show(ok ? TOAST_MESSAGES.exportSuccess : TOAST_MESSAGES.exportFailed, !ok)
}

function triggerImport(): void {
  fileInput.value?.click()
}

/** 服务端返回的错误码优先复用导入文案，其余统一按「写入失败」提示 */
function importErrorMessage(error: ApiErrorCode): string {
  const messages: Partial<Record<ApiErrorCode, string>> = IMPORT_ERROR_MESSAGES

  return messages[error] ?? TOAST_MESSAGES.importSaveFailed
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  // 清空 value，保证连续选择同一个文件也能触发 change
  input.value = ''

  if (!file) {
    return
  }

  if (file.size > IMPORT_MAX_BYTES) {
    toast.show(IMPORT_ERROR_MESSAGES.TOO_LARGE, true)
    return
  }

  isImporting.value = true

  try {
    const result = parseImport(await file.text())

    if (!result.ok) {
      toast.show(IMPORT_ERROR_MESSAGES[result.error], true)
      return
    }

    const outcome = await posts.importAll(result.posts)

    if (!outcome.ok) {
      toast.show(importErrorMessage(outcome.error), true)
      return
    }

    // 跳过条数 = 客户端解析时丢弃的脏数据 + 服务端去重忽略的重复数据
    const skippedCount = outcome.skipped + result.skipped
    const skippedNote = skippedCount > 0 ? `，跳过 ${skippedCount} 条` : ''
    toast.show(`${TOAST_MESSAGES.importSuccess}，导入 ${outcome.imported} 条${skippedNote}`)
  } catch (error) {
    console.warn('[Mingle] 读取导入文件失败：', error)
    toast.show(TOAST_MESSAGES.importReadFailed, true)
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <section class="side-card">
    <h3 class="side-card__title">数据管理</h3>
    <p class="side-card__text">
      导出 JSON 备份，或从备份文件恢复。导入会按 id 去重合并，不覆盖已有动态。
    </p>

    <div class="data-panel__actions">
      <button type="button" class="data-panel__button" @click="onExport">导出 JSON</button>
      <button
        type="button"
        class="data-panel__button data-panel__button--ghost"
        :disabled="isImporting"
        @click="triggerImport"
      >
        {{ isImporting ? '导入中…' : '导入 JSON' }}
      </button>
    </div>

    <input
      ref="fileInput"
      class="sr-only"
      type="file"
      accept="application/json,.json"
      aria-label="选择要导入的 JSON 文件"
      @change="onFileChange"
    />
  </section>
</template>
