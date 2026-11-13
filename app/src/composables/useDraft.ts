import { getCurrentScope, onScopeDispose } from 'vue'
import { DRAFT_DEBOUNCE } from '../constants'
import { clearDraft, loadDraft, saveDraft } from '../utils/draft'

export interface DraftApi {
  /** 读取已保存的草稿 */
  load: () => string
  /** 防抖保存草稿 */
  save: (text: string) => void
  /** 立即清空草稿（发布成功后调用） */
  clear: () => void
  /** 立即写入待保存的草稿 */
  flush: () => void
}

/**
 * 草稿自动保存。
 * 输入过程中防抖写入，组件卸载前 flush 一次，避免长文丢失。
 */
export function useDraft(delay: number = DRAFT_DEBOUNCE): DraftApi {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: string | null = null

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function flush(): void {
    clearTimer()
    if (pending === null) {
      return
    }
    saveDraft(pending)
    pending = null
  }

  function save(text: string): void {
    pending = text
    clearTimer()
    timer = setTimeout(flush, delay)
  }

  function clear(): void {
    clearTimer()
    pending = null
    clearDraft()
  }

  if (getCurrentScope()) {
    onScopeDispose(flush)
  }

  return { load: loadDraft, save, clear, flush }
}
