import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { IMPORT_ERROR_MESSAGES, IMPORT_MAX_BYTES, TOAST_MESSAGES } from '../constants'
import { resetToast, useToast } from '../composables/useToast'
import { usePostsStore } from '../stores/posts'
import type { Post } from '../types'
import { createPost, deletePost, fetchPosts, importPosts } from '../utils/api'
import { downloadJson } from '../utils/download'
import DataPanel from './DataPanel.vue'

vi.mock('../utils/download', () => ({ downloadJson: vi.fn(() => true) }))
// 接口层整体替换为内存假服务端，用例不触碰真实网络
vi.mock('../utils/api')

const existing: Post[] = [{ id: 'old', text: '已有动态', createdAt: 1700000000000 }]

/** 假服务端里的动态列表，四个接口都以它为唯一数据源。 */
let fakePosts: Post[] = []
let fakeSeq = 0

function resetFakeServer(initial: Post[] = []): void {
  fakePosts = [...initial]
  fakeSeq = 0

  vi.mocked(fetchPosts).mockImplementation(async () => ({ ok: true, data: [...fakePosts] }))

  vi.mocked(createPost).mockImplementation(async (text) => {
    fakeSeq += 1
    const post: Post = { id: `srv-${fakeSeq}`, text, createdAt: Date.now() }
    fakePosts = [post, ...fakePosts]
    return { ok: true, data: post }
  })

  vi.mocked(deletePost).mockImplementation(async (id) => {
    fakePosts = fakePosts.filter((post) => post.id !== id)
    return { ok: true, data: null }
  })

  // 与服务端一致：按 id 去重，已存在的动态不覆盖
  vi.mocked(importPosts).mockImplementation(async (incoming) => {
    const known = new Set(fakePosts.map((post) => post.id))
    const added = incoming.filter((post) => !known.has(post.id))
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

interface FakeFile {
  size: number
  text: () => Promise<string>
}

const mountPanel = () => mount(DataPanel)

const selectFile = async (
  wrapper: ReturnType<typeof mountPanel>,
  file: FakeFile,
): Promise<void> => {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    value: [file],
    configurable: true,
  })
  await input.trigger('change')
  await flushPromises()
}

const jsonFile = (content: unknown, size?: number): FakeFile => ({
  size: size ?? JSON.stringify(content).length,
  text: () => Promise.resolve(JSON.stringify(content)),
})

describe('DataPanel', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    resetToast()
    vi.clearAllMocks()
    vi.mocked(downloadJson).mockReturnValue(true)
    resetFakeServer(existing)
    await usePostsStore().hydrate()
  })

  it('导出时把 store 里的当前动态写成 JSON 文件', async () => {
    const wrapper = mountPanel()

    await wrapper.get('.data-panel__button').trigger('click')
    await flushPromises()

    const [filename, content] = vi.mocked(downloadJson).mock.calls[0] ?? []
    expect(filename).toMatch(/^mingle-posts-\d{8}-\d{4}\.json$/)
    expect(JSON.parse(String(content)).posts).toEqual(usePostsStore().posts)
    expect(JSON.parse(String(content)).posts).toEqual(existing)
    expect(useToast().message.value).toBe(TOAST_MESSAGES.exportSuccess)
    expect(useToast().isError.value).toBe(false)
  })

  it('导出的 JSON 包含点赞与收藏状态', async () => {
    resetFakeServer([
      { id: 'liked', text: '已点赞已收藏', createdAt: 1, likes: 1, liked: true, favorited: true },
    ])
    const store = usePostsStore()
    await store.hydrate()

    const wrapper = mountPanel()
    await wrapper.get('.data-panel__button').trigger('click')
    await flushPromises()

    const [, content] = vi.mocked(downloadJson).mock.calls[0] ?? []
    expect(JSON.parse(String(content)).posts[0]).toMatchObject({
      likes: 1,
      liked: true,
      favorited: true,
    })
  })

  it('导出失败时给出错误提示', async () => {
    vi.mocked(downloadJson).mockReturnValueOnce(false)
    const wrapper = mountPanel()

    await wrapper.get('.data-panel__button').trigger('click')
    await flushPromises()

    expect(useToast().message.value).toBe(TOAST_MESSAGES.exportFailed)
    expect(useToast().isError.value).toBe(true)
  })

  it('导入时按 id 去重合并，不覆盖已有动态', async () => {
    const wrapper = mountPanel()

    await selectFile(
      wrapper,
      jsonFile([
        { id: 'old', text: '被改过的旧动态', createdAt: 1 },
        { id: 'new', text: '导入的动态', createdAt: 1730000000000 },
      ]),
    )

    const store = usePostsStore()
    expect(importPosts).toHaveBeenCalledTimes(1)
    // 导入成功后重新从服务端拉取，列表顺序与计数都以服务端为准
    expect(store.posts.map((post) => post.id)).toEqual(['old', 'new'])
    expect(store.posts[0]?.text).toBe('已有动态')
    expect(useToast().message.value).toBe(`${TOAST_MESSAGES.importSuccess}，导入 1 条，跳过 1 条`)
    expect(useToast().isError.value).toBe(false)
  })

  it('跳过条数为「解析丢弃 + 服务端去重」之和，并在提示里说明', async () => {
    const wrapper = mountPanel()

    await selectFile(
      wrapper,
      jsonFile([
        { id: 'ok', text: '正常动态', createdAt: 1730000000000 },
        { id: 'old', text: '重复的旧动态', createdAt: 1700000000000 },
        null,
      ]),
    )

    // 文件里 1 条脏数据 + 服务端忽略 1 条重复数据
    expect(useToast().message.value).toBe(`${TOAST_MESSAGES.importSuccess}，导入 1 条，跳过 2 条`)
    expect(usePostsStore().posts).toHaveLength(2)
  })

  it('文件不是合法 JSON 时提示错误且不改动数据', async () => {
    const wrapper = mountPanel()

    await selectFile(wrapper, { size: 10, text: () => Promise.resolve('{ broken') })

    expect(usePostsStore().posts).toHaveLength(1)
    expect(importPosts).not.toHaveBeenCalled()
    expect(useToast().message.value).toBe(IMPORT_ERROR_MESSAGES.INVALID_JSON)
    expect(useToast().isError.value).toBe(true)
  })

  it('文件过大时直接拦截，不读取内容', async () => {
    const wrapper = mountPanel()
    const text = vi.fn(() => Promise.resolve('[]'))

    await selectFile(wrapper, { size: IMPORT_MAX_BYTES + 1, text })

    expect(text).not.toHaveBeenCalled()
    expect(useToast().message.value).toBe(IMPORT_ERROR_MESSAGES.TOO_LARGE)
    expect(useToast().isError.value).toBe(true)
  })

  it('导入接口失败时提示错误且不改动内存数据', async () => {
    vi.mocked(importPosts).mockResolvedValue({ ok: false, error: 'SERVER', status: 500 })
    const wrapper = mountPanel()

    await selectFile(
      wrapper,
      jsonFile([{ id: 'new', text: '导入的动态', createdAt: 1730000000000 }]),
    )

    expect(usePostsStore().posts).toHaveLength(1)
    expect(useToast().message.value).toBe(TOAST_MESSAGES.importSaveFailed)
    expect(useToast().isError.value).toBe(true)
  })

  it('导入备份后恢复点赞与收藏状态', async () => {
    const wrapper = mountPanel()

    await selectFile(
      wrapper,
      jsonFile([
        {
          id: 'restored',
          text: '带状态的动态',
          createdAt: 1730000000000,
          likes: 1,
          liked: true,
          favorited: true,
        },
      ]),
    )

    const restored = usePostsStore().posts.find((post) => post.id === 'restored')
    expect(restored).toMatchObject({ likes: 1, liked: true, favorited: true })
  })
})
