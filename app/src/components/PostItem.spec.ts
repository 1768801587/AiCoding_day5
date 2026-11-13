import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { DELETE_CONFIRM_MS } from '../constants'
import { resetNow } from '../composables/useNow'
import type { Post } from '../types'
import PostItem from './PostItem.vue'

type ItemWrapper = ReturnType<typeof mount>
const mounted: ItemWrapper[] = []

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'p1',
  text: '第一条动态',
  createdAt: new Date(2024, 4, 1, 11, 55).getTime(),
  ...overrides,
})

function mountItem(post: Post = makePost()): ItemWrapper {
  const wrapper = mount(PostItem, { props: { post } })
  mounted.push(wrapper)
  return wrapper
}

describe('PostItem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 4, 1, 12, 0))
    resetNow(Date.now())
  })

  afterEach(() => {
    while (mounted.length > 0) {
      mounted.pop()?.unmount()
    }
  })

  it('按相对时间展示发布时间', () => {
    const wrapper = mountItem()

    const time = wrapper.get('.post__time')
    expect(time.text()).toBe('5 分钟前')
    expect(time.attributes('datetime')).toBe(
      new Date(new Date(2024, 4, 1, 11, 55).getTime()).toISOString(),
    )
  })

  it('时间缺失的历史数据显示「时间未知」且不输出 datetime', () => {
    const wrapper = mountItem(makePost({ createdAt: 0 }))

    const time = wrapper.get('.post__time')
    expect(time.text()).toBe('时间未知')
    expect(time.attributes('datetime')).toBeUndefined()
  })

  it('首次点击只进入确认态，不触发删除', async () => {
    const wrapper = mountItem()
    const button = wrapper.get('.post__delete')

    await button.trigger('click')

    expect(button.text()).toBe('确认删除')
    expect(button.classes()).toContain('is-confirming')
    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  it('再次点击才真正删除并带出 id', async () => {
    const wrapper = mountItem()
    const button = wrapper.get('.post__delete')

    await button.trigger('click')
    await button.trigger('click')

    expect(wrapper.emitted('remove')).toEqual([['p1']])
    expect(wrapper.get('.post__delete').text()).toBe('删除')
  })

  it(`确认态在 ${DELETE_CONFIRM_MS} 毫秒后自动复原`, async () => {
    const wrapper = mountItem()
    const button = wrapper.get('.post__delete')

    await button.trigger('click')
    vi.advanceTimersByTime(DELETE_CONFIRM_MS)
    await nextTick()

    expect(wrapper.get('.post__delete').text()).toBe('删除')
    expect(wrapper.get('.post__delete').classes()).not.toContain('is-confirming')
    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  /* ---------------------------------------------------------
     点赞 / 收藏操作区（追加用例，上方既有断言保持不变）
     --------------------------------------------------------- */

  /** 点赞 / 收藏用例需要额外控制 isPending，这里单独封装挂载。 */
  function mountWithPending(post: Post = makePost(), isPending = false): ItemWrapper {
    const wrapper = mount(PostItem, { props: { post, isPending } })
    mounted.push(wrapper)
    return wrapper
  }

  it('点赞数缺失时显示 0，有值时显示服务端计数', () => {
    expect(mountWithPending(makePost()).get('.post__action--like').text()).toBe('0')
    expect(mountWithPending(makePost({ likes: 12 })).get('.post__action--like').text()).toBe('12')
  })

  it('点赞按钮的 aria-pressed 与 is-active 反映点赞状态', () => {
    const idle = mountWithPending(makePost())
    const idleLike = idle.get('.post__action--like')
    expect(idleLike.attributes('aria-pressed')).toBe('false')
    expect(idleLike.classes()).not.toContain('is-active')
    expect(idleLike.attributes('aria-label')).toBe('点赞这条动态')

    const liked = mountWithPending(makePost({ liked: true, likes: 1 }))
    const likedLike = liked.get('.post__action--like')
    expect(likedLike.attributes('aria-pressed')).toBe('true')
    expect(likedLike.classes()).toContain('is-active')
    expect(likedLike.attributes('aria-label')).toBe('取消点赞')
  })

  it('收藏按钮的文案、aria-pressed 与 is-active 反映收藏状态', () => {
    const idle = mountWithPending(makePost())
    const idleFav = idle.get('.post__action--favorite')
    expect(idleFav.text()).toBe('收藏')
    expect(idleFav.attributes('aria-pressed')).toBe('false')
    expect(idleFav.classes()).not.toContain('is-active')
    expect(idleFav.attributes('aria-label')).toBe('收藏这条动态')

    const favorited = mountWithPending(makePost({ favorited: true }))
    const faved = favorited.get('.post__action--favorite')
    expect(faved.text()).toBe('已收藏')
    expect(faved.attributes('aria-pressed')).toBe('true')
    expect(faved.classes()).toContain('is-active')
    expect(faved.attributes('aria-label')).toBe('取消收藏')
  })

  it('点击点赞与收藏按钮分别带出动态 id', async () => {
    const wrapper = mountWithPending(makePost({ id: 'target' }))

    await wrapper.get('.post__action--like').trigger('click')
    await wrapper.get('.post__action--favorite').trigger('click')

    expect(wrapper.emitted('toggle-like')).toEqual([['target']])
    expect(wrapper.emitted('toggle-favorite')).toEqual([['target']])
  })

  it('isPending 时两个按钮都禁用且点击不再派发事件', async () => {
    const wrapper = mountWithPending(makePost(), true)

    const like = wrapper.get('.post__action--like')
    const favorite = wrapper.get('.post__action--favorite')

    expect(like.attributes('disabled')).toBeDefined()
    expect(favorite.attributes('disabled')).toBeDefined()

    await like.trigger('click')
    await favorite.trigger('click')

    expect(wrapper.emitted('toggle-like')).toBeUndefined()
    expect(wrapper.emitted('toggle-favorite')).toBeUndefined()
  })
})
