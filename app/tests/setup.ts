import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  // 服务端用例运行在 node 环境，没有 localStorage，做存在性守卫
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})

afterEach(() => {
  // 保证用例之间不残留真实/伪造定时器、被替换的全局对象与 DOM 节点
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
  }
})
