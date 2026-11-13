import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import App from './App.vue'
import { resetNow } from './composables/useNow'
import { resetToast } from './composables/useToast'
import { TOAST_MESSAGES } from './constants'
import { usePostsStore } from './stores/posts'
import type { Post } from './types'
import { createPost, deletePost, fetchPosts, importPosts, setPostFavorited, setPostLiked } from './utils/api'

// 接口层整体替换为内存假服务端，用例不触碰真实网络
vi.mock('./utils/api')

let pinia: Pinia
type AppWrapper = ReturnType<typeof mount>
const mounted: AppWrapper[] = []

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

const mountApp = (activePinia: Pinia = pinia): AppWrapper => {
  const wrapper = mount(App, { global: { plugins: [activePinia] } })
  mounted.push(wrapper)
  return wrapper
}

const statValues = (wrapper: AppWrapper): string[] =>
  wrapper.findAll('.stat__value').map((node) => node.text())

const postTexts = (wrapper: AppWrapper): string[] =>
  wrapper.findAll('.post__text').map((node) => node.text())

const publish = async (wrapper: AppWrapper, text: string): Promise<void> => {
  await wrapper.get('textarea').setValue(text)
  await wrapper.get('.composer__submit').trigger('click')
  await flushPromises()
}

describe('App', () => {
  beforeEach(async () => {
    resetToast()
    resetNow()
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    resetFakeServer()
    // 首屏数据由入口处 hydrate 拉取，这里保持与 main.ts 一致
    await usePostsStore().hydrate()
  })

  afterEach(() => {
    while (mounted.length > 0) {
      mounted.pop()?.unmount()
    }
  })

  it('首次访问展示空状态与全零统计', () => {
    const wrapper = mountApp()

    expect(fetchPosts).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.get('.feed__count').text()).toBe('0 条')
    expect(statValues(wrapper)).toEqual(['0', '0', '0'])
  })

  it('渲染顶部导航与侧栏说明文案', () => {
    const wrapper = mountApp()

    expect(wrapper.get('.brand__name').text()).toBe('Mingle')
    expect(wrapper.text()).toContain('服务端模式')
    expect(wrapper.text()).toContain('无需登录')
    expect(wrapper.text()).toContain('所有内容都保存在服务端内存中')
    expect(wrapper.get('.footer__text').text()).toBe('Mingle · 数据存于服务端内存')
  })

  it('发布后动态流、条数与三项统计联动更新', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '今天')

    expect(wrapper.findAll('.post')).toHaveLength(1)
    expect(postTexts(wrapper)).toEqual(['今天'])
    expect(wrapper.get('.feed__count').text()).toBe('1 条')
    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(statValues(wrapper)).toEqual(['1', '1', '2'])
    expect(wrapper.get('.toast').text()).toBe(TOAST_MESSAGES.success)
    expect(wrapper.get('.toast').classes()).toContain('is-visible')

    // 新动态的 id 与创建时间由服务端返回
    const [created] = usePostsStore().posts
    expect(created?.id).toBe('srv-1')
    expect(typeof created?.createdAt).toBe('number')
  })

  it('多条动态按时间倒序展示', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '第一条')
    await publish(wrapper, '第二条')

    expect(postTexts(wrapper)).toEqual(['第二条', '第一条'])
    expect(wrapper.get('.feed__count').text()).toBe('2 条')
  })

  it('重新挂载（模拟刷新）后仍能从服务端恢复数据', async () => {
    const first = mountApp()
    await publish(first, '刷新也要在')
    first.unmount()
    mounted.pop()

    const secondPinia = createPinia()
    setActivePinia(secondPinia)
    await usePostsStore().hydrate()
    const second = mountApp(secondPinia)

    expect(postTexts(second)).toEqual(['刷新也要在'])
    expect(statValues(second)).toEqual(['1', '1', '5'])
  })

  it('累计字数超过 9999 时以 k 缩写展示', async () => {
    resetFakeServer([{ id: 'long', text: 'a'.repeat(12_000), createdAt: Date.now() }])
    await usePostsStore().hydrate()

    const wrapper = mountApp()

    expect(statValues(wrapper)).toEqual(['1', '1', '12.0k'])
  })

  it('关键词搜索实时过滤列表并显示命中条数', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '今天去爬山')
    await publish(wrapper, '看完一部电影')

    await wrapper.get('.feed__search').setValue('爬山')

    expect(postTexts(wrapper)).toEqual(['今天去爬山'])
    expect(wrapper.get('.feed__count').text()).toBe('1 / 2 条')
  })

  it('搜索无结果时展示筛选空态', async () => {
    const wrapper = mountApp()
    await publish(wrapper, '今天去爬山')

    await wrapper.get('.feed__search').setValue('不存在的关键词')

    expect(wrapper.get('.empty__title').text()).toBe('没有匹配的动态')
    expect(wrapper.get('.feed__count').text()).toBe('0 / 1 条')
  })

  it('时间范围筛选只保留窗口内的动态', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 4, 1, 12, 0))
    resetFakeServer([
      { id: 'today', text: '今天的动态', createdAt: new Date(2024, 4, 1, 9, 0).getTime() },
      { id: 'old', text: '很久以前的动态', createdAt: new Date(2024, 0, 1, 9, 0).getTime() },
    ])
    await usePostsStore().hydrate()
    const wrapper = mountApp()

    await wrapper.get('.feed__select').setValue('today')

    expect(postTexts(wrapper)).toEqual(['今天的动态'])
    expect(wrapper.get('.feed__count').text()).toBe('1 / 2 条')
  })

  it('两次点击删除后列表、条数与统计同步更新', async () => {
    const wrapper = mountApp()
    await publish(wrapper, '要删掉的动态')

    const button = wrapper.get('.post__delete')
    await button.trigger('click')
    expect(button.text()).toBe('确认删除')

    await button.trigger('click')
    await flushPromises()

    expect(deletePost).toHaveBeenCalledWith('srv-1')
    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.get('.feed__count').text()).toBe('0 条')
    expect(statValues(wrapper)).toEqual(['0', '0', '0'])
    expect(wrapper.get('.toast').text()).toBe(TOAST_MESSAGES.deleteSuccess)
  })

  it('加载失败展示错误条，点击重试后恢复列表', async () => {
    vi.mocked(fetchPosts).mockResolvedValue({ ok: false, error: 'NETWORK', status: 0 })
    await usePostsStore().hydrate()

    const wrapper = mountApp()

    expect(wrapper.get('.feed__error-text').text()).toBe(TOAST_MESSAGES.loadFailed)
    expect(wrapper.find('.empty').exists()).toBe(true)

    // 服务端恢复后点「重试」应重新拉取并渲染列表
    resetFakeServer([{ id: 'srv-9', text: '重试后的动态', createdAt: Date.now() }])
    await wrapper.get('.feed__error-retry').trigger('click')
    await flushPromises()

    expect(wrapper.find('.feed__error').exists()).toBe(false)
    expect(postTexts(wrapper)).toEqual(['重试后的动态'])
    expect(wrapper.get('.feed__count').text()).toBe('1 条')
    expect(statValues(wrapper)).toEqual(['1', '1', '6'])
  })

  it('跨过零点后「今日发布」自动归零', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 4, 1, 23, 59, 50))
    resetFakeServer([
      { id: 'late', text: '深夜动态', createdAt: new Date(2024, 4, 1, 23, 50).getTime() },
    ])
    await usePostsStore().hydrate()
    const wrapper = mountApp()

    expect(statValues(wrapper)).toEqual(['1', '1', '4'])

    vi.advanceTimersByTime(11_000)
    await nextTick()

    expect(statValues(wrapper)).toEqual(['1', '0', '4'])
  })

  /* ---------------------------------------------------------
     点赞 / 收藏与「我的收藏」筛选（追加用例，上方既有断言保持不变）
     --------------------------------------------------------- */

  /** 为假服务端补上点赞 / 收藏实现，状态一律以 fakePosts 为唯一数据源。 */
  function installSocialApi(): void {
    vi.mocked(setPostLiked).mockImplementation(async (id, liked) => {
      const target = fakePosts.find((post) => post.id === id)

      if (!target) {
        return { ok: false, error: 'NOT_FOUND', status: 404 }
      }

      const updated: Post = { ...target, liked, likes: liked ? (target.likes ?? 0) + 1 : 0 }
      fakePosts = fakePosts.map((post) => (post.id === id ? updated : post))

      return { ok: true, data: updated }
    })

    vi.mocked(setPostFavorited).mockImplementation(async (id, favorited) => {
      const target = fakePosts.find((post) => post.id === id)

      if (!target) {
        return { ok: false, error: 'NOT_FOUND', status: 404 }
      }

      const updated: Post = { ...target, favorited }
      fakePosts = fakePosts.map((post) => (post.id === id ? updated : post))

      return { ok: true, data: updated }
    })
  }

  it('点赞成功后按钮进入激活态并显示最新计数', async () => {
    resetFakeServer([
      { id: 'p1', text: '一条动态', createdAt: Date.now(), likes: 0, liked: false },
    ])
    await usePostsStore().hydrate()
    installSocialApi()
    const wrapper = mountApp()

    expect(wrapper.get('.post__action--like').text()).toBe('0')

    await wrapper.get('.post__action--like').trigger('click')
    await flushPromises()

    const like = wrapper.get('.post__action--like')
    expect(setPostLiked).toHaveBeenCalledWith('p1', true)
    expect(like.text()).toBe('1')
    expect(like.attributes('aria-pressed')).toBe('true')
    expect(like.classes()).toContain('is-active')
  })

  it('点赞失败时弹出失败提示，计数不变', async () => {
    resetFakeServer([
      { id: 'p1', text: '一条动态', createdAt: Date.now(), likes: 0, liked: false },
    ])
    await usePostsStore().hydrate()
    vi.mocked(setPostLiked).mockResolvedValue({ ok: false, error: 'NETWORK', status: 0 })
    const wrapper = mountApp()

    await wrapper.get('.post__action--like').trigger('click')
    await flushPromises()

    expect(wrapper.get('.toast').text()).toBe(TOAST_MESSAGES.likeFailed)
    expect(wrapper.get('.toast').classes()).toContain('is-visible')
    expect(wrapper.get('.toast').classes()).toContain('is-error')
    expect(wrapper.get('.post__action--like').text()).toBe('0')
    expect(wrapper.get('.post__action--like').attributes('aria-pressed')).toBe('false')
  })

  it('收藏失败时弹出失败提示', async () => {
    resetFakeServer([{ id: 'p1', text: '一条动态', createdAt: Date.now() }])
    await usePostsStore().hydrate()
    vi.mocked(setPostFavorited).mockResolvedValue({ ok: false, error: 'SERVER', status: 500 })
    const wrapper = mountApp()

    await wrapper.get('.post__action--favorite').trigger('click')
    await flushPromises()

    expect(wrapper.get('.toast').text()).toBe(TOAST_MESSAGES.favoriteFailed)
    expect(wrapper.get('.toast').classes()).toContain('is-error')
    expect(wrapper.get('.post__action--favorite').text()).toBe('收藏')
  })

  it('开启「我的收藏」后只显示已收藏的动态', async () => {
    resetFakeServer([
      { id: 'fav', text: '收藏的动态', createdAt: Date.now(), favorited: true },
      { id: 'plain', text: '普通动态', createdAt: Date.now() + 10 },
    ])
    await usePostsStore().hydrate()
    const wrapper = mountApp()

    expect(postTexts(wrapper)).toEqual(['普通动态', '收藏的动态'])

    await wrapper.get('.feed__fav-toggle').trigger('click')

    expect(postTexts(wrapper)).toEqual(['收藏的动态'])
    expect(wrapper.get('.feed__count').text()).toBe('1 / 2 条')
    expect(wrapper.get('.feed__fav-toggle').attributes('aria-pressed')).toBe('true')
  })

  it('收藏成功后开启「我的收藏」能筛出这条动态', async () => {
    resetFakeServer([
      { id: 'fav', text: '收藏的动态', createdAt: Date.now() + 10 },
      { id: 'plain', text: '普通动态', createdAt: Date.now() },
    ])
    await usePostsStore().hydrate()
    installSocialApi()
    const wrapper = mountApp()

    // 列表按时间倒序，「收藏的动态」在最前
    await wrapper.get('.post__action--favorite').trigger('click')
    await flushPromises()

    expect(setPostFavorited).toHaveBeenCalledWith('fav', true)
    expect(wrapper.get('.post__action--favorite').text()).toBe('已收藏')

    await wrapper.get('.feed__fav-toggle').trigger('click')

    expect(postTexts(wrapper)).toEqual(['收藏的动态'])
  })
})
