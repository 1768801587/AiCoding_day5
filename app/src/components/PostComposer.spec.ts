import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { DRAFT_DEBOUNCE, DRAFT_KEY, MAX_LENGTH, TOAST_MESSAGES } from '../constants'
import { resetToast, useToast } from '../composables/useToast'
import { usePostsStore } from '../stores/posts'
import type { ApiResult, Post } from '../types'
import { createPost, deletePost, fetchPosts, importPosts } from '../utils/api'
import PostComposer from './PostComposer.vue'

// 接口层整体替换为内存假服务端，用例不触碰真实网络
vi.mock('../utils/api')

let pinia: Pinia
type ComposerWrapper = ReturnType<typeof mount>
const mounted: ComposerWrapper[] = []

/** 假服务端里的动态列表，四个接口都以它为唯一数据源。 */
let fakePosts: Post[] = []
/** 单调递增的假时钟，保证新建动态的 createdAt 严格递增。 */
let fakeClock = 0
let fakeSeq = 0

function resetFakeServer(initial: Post[] = []): void {
  fakePosts = [...initial]
  fakeClock = Date.now()
  fakeSeq = 0

  vi.mocked(fetchPosts).mockImplementation(async () => ({ ok: true, data: [...fakePosts] }))

  vi.mocked(createPost).mockImplementation(async (text) => {
    fakeSeq += 1
    const post: Post = { id: `srv-${fakeSeq}`, text, createdAt: fakeClock++ }
    fakePosts = [post, ...fakePosts]
    return { ok: true, data: post }
  })

  vi.mocked(deletePost).mockImplementation(async (id) => {
    fakePosts = fakePosts.filter((post) => post.id !== id)
    return { ok: true, data: null }
  })

  vi.mocked(importPosts).mockImplementation(async (incoming) => {
    const existing = new Set(fakePosts.map((post) => post.id))
    const added = incoming.filter((post) => !existing.has(post.id))
    fakePosts = [...fakePosts, ...added]

    return {
      ok: true,
      data: {
        imported: added.length,
        skipped: incoming.length - added.length,
        total: fakePosts.length,
      },
    }
  })
}

/** 手动控制 Promise 何时结算，用于观察请求进行中的界面状态。 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

const mountComposer = (): ComposerWrapper => {
  const wrapper = mount(PostComposer, {
    global: { plugins: [pinia] },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

const typeInto = async (wrapper: ComposerWrapper, value: string) => {
  const textarea = wrapper.get('textarea')
  await textarea.setValue(value)
  return textarea
}

describe('PostComposer', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    resetToast()
    vi.clearAllMocks()
    resetFakeServer()
  })

  afterEach(() => {
    // 卸载会触发草稿 flush，避免跨用例残留定时器与草稿
    while (mounted.length > 0) {
      mounted.pop()?.unmount()
    }
  })

  it('空内容时发布按钮禁用', () => {
    const wrapper = mountComposer()

    expect(wrapper.get('button[type="button"]').attributes('disabled')).toBeDefined()
  })

  it('仅输入空格时仍保持禁用', async () => {
    const wrapper = mountComposer()

    await typeInto(wrapper, '    ')

    expect(wrapper.get('button[type="button"]').attributes('disabled')).toBeDefined()
  })

  it('输入内容后按钮可用，并实时显示字数', async () => {
    const wrapper = mountComposer()

    await typeInto(wrapper, '你好')

    expect(wrapper.get('button[type="button"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('.composer__count').text()).toBe(`2 / ${MAX_LENGTH}`)
    expect(wrapper.get('.composer__count').classes()).not.toContain('is-limit')
  })

  it(`达到 ${MAX_LENGTH} 字时字数提示进入上限状态`, async () => {
    const wrapper = mountComposer()

    await typeInto(wrapper, 'a'.repeat(MAX_LENGTH))

    expect(wrapper.get('.composer__count').classes()).toContain('is-limit')
  })

  it('点击发布后写入 store、清空输入并提示成功', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    await typeInto(wrapper, '  今天心情不错  ')
    await wrapper.get('button[type="button"]').trigger('click')
    await flushPromises()

    expect(createPost).toHaveBeenCalledWith('今天心情不错')
    expect(store.posts).toHaveLength(1)
    expect(store.posts[0]?.text).toBe('今天心情不错')
    // 新动态的时间与 id 都由服务端给出，前端不再自行生成
    expect(store.posts[0]?.id).toBe('srv-1')
    expect(store.posts[0]?.createdAt).toBeGreaterThan(0)
    expect(wrapper.get('textarea').element.value).toBe('')
    expect(wrapper.get('.composer__count').text()).toBe(`0 / ${MAX_LENGTH}`)
    expect(useToast().message.value).toBe(TOAST_MESSAGES.success)
    expect(useToast().isError.value).toBe(false)
  })

  it('提交进行中按钮禁用并显示「发布中…」，完成后恢复', async () => {
    const pending = deferred<ApiResult<Post>>()
    vi.mocked(createPost).mockReturnValue(pending.promise)

    const wrapper = mountComposer()
    await typeInto(wrapper, '提交中的内容')
    const button = wrapper.get('button[type="button"]')

    await button.trigger('click')

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toBe('发布中…')
    expect(usePostsStore().posts).toHaveLength(0)

    // 用失败结果验证「恢复」：成功时输入框会被清空，按钮本就该回到禁用态
    pending.resolve({ ok: false, error: 'NETWORK', status: 0 })
    await flushPromises()

    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('aria-busy')).toBe('false')
    expect(button.text()).toBe('发布')
    // 失败时内容仍在，用户可以重试
    expect(wrapper.get('textarea').element.value).toBe('提交中的内容')
  })

  it('Ctrl + Enter 快捷发布并阻止默认换行', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    const textarea = await typeInto(wrapper, '快捷发布')
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()

    expect(store.posts).toHaveLength(1)
    expect(wrapper.get('textarea').element.value).toBe('')
  })

  it('⌘ + Enter 同样可以发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    const textarea = await typeInto(wrapper, 'Mac 快捷发布')
    await textarea.trigger('keydown', { key: 'Enter', metaKey: true })
    await flushPromises()

    expect(store.posts).toHaveLength(1)
  })

  it('普通 Enter 不会发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    const textarea = await typeInto(wrapper, '换行')
    await textarea.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(store.posts).toHaveLength(0)
    expect(createPost).not.toHaveBeenCalled()
  })

  it('空白内容通过快捷键提交时提示错误并保持输入', async () => {
    const wrapper = mountComposer()

    const textarea = await typeInto(wrapper, '   ')
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()

    expect(usePostsStore().posts).toHaveLength(0)
    expect(createPost).not.toHaveBeenCalled()
    expect(useToast().message.value).toBe(TOAST_MESSAGES.empty)
    expect(useToast().isError.value).toBe(true)
    expect(wrapper.get('textarea').element.value).toBe('   ')
  })

  it('超出字数上限时提示错误且不写入', async () => {
    const wrapper = mountComposer()

    const textarea = await typeInto(wrapper, 'a'.repeat(MAX_LENGTH + 1))
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()

    expect(usePostsStore().posts).toHaveLength(0)
    expect(createPost).not.toHaveBeenCalled()
    expect(useToast().message.value).toBe(TOAST_MESSAGES.tooLong)
    expect(useToast().isError.value).toBe(true)
  })

  it('服务端保存失败时提示错误且保留输入内容', async () => {
    vi.mocked(createPost).mockResolvedValue({ ok: false, error: 'NETWORK', status: 0 })
    const wrapper = mountComposer()

    await typeInto(wrapper, '存不进去的内容')
    await wrapper.get('button[type="button"]').trigger('click')
    await flushPromises()

    expect(usePostsStore().posts).toHaveLength(0)
    expect(useToast().message.value).toBe(TOAST_MESSAGES.saveFailed)
    expect(useToast().isError.value).toBe(true)
    expect(wrapper.get('textarea').element.value).toBe('存不进去的内容')
    expect(createPost).toHaveBeenCalledWith('存不进去的内容')
  })

  it('发布成功后焦点回到输入框', async () => {
    const wrapper = mountComposer()

    await typeInto(wrapper, '继续记录')
    await wrapper.get('button[type="button"]').trigger('click')
    await flushPromises()

    expect(document.activeElement).toBe(wrapper.get('textarea').element)
  })

  it('emoji 按一个字计数，不会因为代理对被算成两个字', async () => {
    const wrapper = mountComposer()

    await typeInto(wrapper, '😀😀')

    expect(wrapper.get('.composer__count').text()).toBe(`2 / ${MAX_LENGTH}`)
    expect(wrapper.get('.composer__count').classes()).not.toContain('is-limit')
  })

  it('超出上限时字数提示进入 is-over 状态', async () => {
    const wrapper = mountComposer()
    const textarea = wrapper.get('textarea')

    // 移除原生 maxlength 后，超长内容可以输入，由 store 与提示兜底
    textarea.element.value = '😀'.repeat(MAX_LENGTH + 1)
    await textarea.trigger('input')

    const count = wrapper.get('.composer__count')
    expect(count.text()).toBe(`${MAX_LENGTH + 1} / ${MAX_LENGTH}`)
    expect(count.classes()).toContain('is-limit')
    expect(count.classes()).toContain('is-over')
  })

  it('打开页面时回填未发布的草稿', () => {
    localStorage.setItem(DRAFT_KEY, '上次没写完的内容')

    const wrapper = mountComposer()

    expect(wrapper.get('textarea').element.value).toBe('上次没写完的内容')
    expect(wrapper.get('.composer__count').text()).toBe(`8 / ${MAX_LENGTH}`)
  })

  it('输入过程中自动保存草稿（防抖）', async () => {
    vi.useFakeTimers()
    const wrapper = mountComposer()
    const textarea = wrapper.get('textarea')

    textarea.element.value = '正在写的内容'
    await textarea.trigger('input')

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()

    vi.advanceTimersByTime(DRAFT_DEBOUNCE)

    expect(localStorage.getItem(DRAFT_KEY)).toBe('正在写的内容')
  })

  it('清空输入会同步清掉草稿', async () => {
    vi.useFakeTimers()
    const wrapper = mountComposer()
    const textarea = wrapper.get('textarea')

    textarea.element.value = '临时内容'
    await textarea.trigger('input')
    vi.advanceTimersByTime(DRAFT_DEBOUNCE)
    expect(localStorage.getItem(DRAFT_KEY)).toBe('临时内容')

    textarea.element.value = ''
    await textarea.trigger('input')

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('发布成功后清空草稿', async () => {
    localStorage.setItem(DRAFT_KEY, '已发布的内容')
    const wrapper = mountComposer()

    await wrapper.get('button[type="button"]').trigger('click')
    await flushPromises()

    expect(usePostsStore().posts).toHaveLength(1)
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })
})
