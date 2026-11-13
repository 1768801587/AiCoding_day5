import { getCurrentScope, onScopeDispose, readonly, shallowRef } from 'vue'
import { TOAST_DURATION } from '../constants'

/**
 * 全局唯一的轻提示（与旧版页面只有一个 #toast 节点一致）。
 * 状态放在模块作用域，任何组件调用 useToast() 都拿到同一份。
 */
const message = shallowRef('')
const isError = shallowRef(false)
const isVisible = shallowRef(false)

let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearHideTimer(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

export interface ToastApi {
  message: Readonly<typeof message>
  isError: Readonly<typeof isError>
  isVisible: Readonly<typeof isVisible>
  show: (text: string, error?: boolean) => void
  hide: () => void
}

export function useToast(): ToastApi {
  /** 展示提示；重复调用会重置倒计时，而不是叠加多个隐藏任务。 */
  function show(text: string, error = false): void {
    message.value = text
    isError.value = error
    isVisible.value = true

    clearHideTimer()
    hideTimer = setTimeout(() => {
      isVisible.value = false
      hideTimer = null
    }, TOAST_DURATION)
  }

  function hide(): void {
    clearHideTimer()
    isVisible.value = false
  }

  // 只在组件/作用域内注册清理，保证宿主销毁后不残留定时器
  if (getCurrentScope()) {
    onScopeDispose(hide)
  }

  return {
    message: readonly(message),
    isError: readonly(isError),
    isVisible: readonly(isVisible),
    show,
    hide,
  }
}

/** 重置全局提示状态（测试与极端场景使用）。 */
export function resetToast(): void {
  clearHideTimer()
  message.value = ''
  isError.value = false
  isVisible.value = false
}
