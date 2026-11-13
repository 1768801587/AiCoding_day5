import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  // 保证用例之间不残留真实/伪造定时器与 DOM 节点
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
