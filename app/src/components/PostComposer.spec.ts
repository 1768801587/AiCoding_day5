import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { MAX_LENGTH, STORAGE_KEY, TOAST_MESSAGES } from '../constants'
import { resetToast, useToast } from '../composables/useToast'
import { usePostsStore } from '../stores/posts'
import PostComposer from './PostComposer.vue'

let pinia: Pinia

const mountComposer = () =>
  mount(PostComposer, {
    global: { plugins: [pinia] },
    attachTo: document.body,
  })

const typeInto = async (wrapper: ReturnType<typeof mountComposer>, value: string) => {
  const textarea = wrapper.get('textarea')
  await textarea.setValue(value)
  return textarea
}

describe('PostComposer', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    resetToast()
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

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0]?.text).toBe('今天心情不错')
    expect(wrapper.get('textarea').element.value).toBe('')
    expect(wrapper.get('.composer__count').text()).toBe(`0 / ${MAX_LENGTH}`)
    expect(useToast().message.value).toBe(TOAST_MESSAGES.success)
    expect(useToast().isError.value).toBe(false)
  })

  it('Ctrl + Enter 快捷发布并阻止默认换行', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    const textarea = await typeInto(wrapper, '快捷发布')
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(store.posts).toHaveLength(1)
    expect(wrapper.get('textarea').element.value).toBe('')
  })

  it('⌘ + Enter 同样可以发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    const textarea = await typeInto(wrapper, 'Mac 快捷发布')
    await textarea.trigger('keydown', { key: 'Enter', metaKey: true })

    expect(store.posts).toHaveLength(1)
  })

  it('普通 Enter 不会发布', async () => {
    const wrapper = mountComposer()
    const store = usePostsStore()

    const textarea = await typeInto(wrapper, '换行')
    await textarea.trigger('keydown', { key: 'Enter' })

    expect(store.posts).toHaveLength(0)
  })

  it('空白内容通过快捷键提交时提示错误并保持输入', async () => {
    const wrapper = mountComposer()

    const textarea = await typeInto(wrapper, '   ')
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(usePostsStore().posts).toHaveLength(0)
    expect(useToast().message.value).toBe(TOAST_MESSAGES.empty)
    expect(useToast().isError.value).toBe(true)
    expect(wrapper.get('textarea').element.value).toBe('   ')
  })

  it('超出字数上限时提示错误且不写入', async () => {
    const wrapper = mountComposer()

    const textarea = await typeInto(wrapper, 'a'.repeat(MAX_LENGTH + 1))
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(usePostsStore().posts).toHaveLength(0)
    expect(useToast().message.value).toBe(TOAST_MESSAGES.tooLong)
    expect(useToast().isError.value).toBe(true)
  })

  it('存储失败时提示错误且保留输入内容', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mountComposer()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    await typeInto(wrapper, '存不进去的内容')
    await wrapper.get('button[type="button"]').trigger('click')

    expect(usePostsStore().posts).toHaveLength(0)
    expect(useToast().message.value).toBe(TOAST_MESSAGES.saveFailed)
    expect(useToast().isError.value).toBe(true)
    expect(wrapper.get('textarea').element.value).toBe('存不进去的内容')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('发布成功后焦点回到输入框', async () => {
    const wrapper = mountComposer()

    await typeInto(wrapper, '继续记录')
    await wrapper.get('button[type="button"]').trigger('click')

    expect(document.activeElement).toBe(wrapper.get('textarea').element)
  })
})
