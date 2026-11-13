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
})
