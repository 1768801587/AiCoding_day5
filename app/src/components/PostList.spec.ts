import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { resetNow } from '../composables/useNow'
import type { Post } from '../types'
import PostList from './PostList.vue'

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'p1',
  text: '第一条动态',
  createdAt: new Date(2024, 4, 1, 10, 30).getTime(),
  ...overrides,
})

type ListWrapper = ReturnType<typeof mount>
const mounted: ListWrapper[] = []

interface ListProps {
  posts: readonly Post[]
  total?: number
  isFiltered?: boolean
}

function mountList(props: ListProps, slots?: Record<string, string>): ListWrapper {
  const wrapper = mount(PostList, { props, slots })
  mounted.push(wrapper)
  return wrapper
}

describe('PostList', () => {
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

  it('按传入顺序渲染动态，并保证每条都完整呈现', () => {
    const posts = [
      makePost({ id: 'new', text: '更新的动态', createdAt: new Date(2024, 4, 2, 8, 5).getTime() }),
      makePost({ id: 'old', text: '更早的动态', createdAt: new Date(2024, 4, 1, 20, 0).getTime() }),
    ]

    const wrapper = mountList({ posts })
    const items = wrapper.findAll('.post')

    expect(items).toHaveLength(2)
    expect(items[0]?.find('.post__text').text()).toBe('更新的动态')
    expect(items[1]?.find('.post__text').text()).toBe('更早的动态')
  })

  it('每条动态包含首字母头像、作者名与相对时间', () => {
    const wrapper = mountList({ posts: [makePost()] })
    const time = wrapper.find('.post__time')

    expect(wrapper.find('.post__avatar').text()).toBe('M')
    expect(wrapper.find('.post__author').text()).toBe('Mingler')
    expect(time.text()).toBe('1 小时前')
    expect(time.attributes('datetime')).toBe(
      new Date(new Date(2024, 4, 1, 10, 30).getTime()).toISOString(),
    )
  })

  it('显示动态条数文案', () => {
    const wrapper = mountList({ posts: [makePost(), makePost({ id: 'p2' })] })

    expect(wrapper.find('.feed__count').text()).toBe('2 条')
  })

  it('筛选状态下展示「命中 / 总数」并透出筛选插槽', () => {
    const wrapper = mountList({ posts: [makePost()], total: 3, isFiltered: true }, {
      filter: '<span class="stub-filter">筛选</span>',
    })

    expect(wrapper.find('.feed__count').text()).toBe('1 / 3 条')
    expect(wrapper.find('.stub-filter').exists()).toBe(true)
  })

  it('无数据时展示空状态并隐藏列表', () => {
    const wrapper = mountList({ posts: [] })

    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.find('.feed__list').exists()).toBe(false)
    expect(wrapper.find('.feed__count').text()).toBe('0 条')
    expect(wrapper.text()).toContain('这里还很安静')
  })

  it('筛选无结果时展示区别于空数据的提示', () => {
    const wrapper = mountList({ posts: [], total: 2, isFiltered: true })

    expect(wrapper.get('.empty__title').text()).toBe('没有匹配的动态')
    expect(wrapper.get('.empty__text').text()).toContain('换个关键词')
    expect(wrapper.get('.feed__count').text()).toBe('0 / 2 条')
  })

  it('有数据时不渲染空状态', () => {
    const wrapper = mountList({ posts: [makePost()] })

    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  it('删除子项的 remove 事件会向父级转发 id', async () => {
    const wrapper = mountList({ posts: [makePost({ id: 'target' })] })

    await wrapper.get('.post__delete').trigger('click')
    await wrapper.get('.post__delete').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([['target']])
  })

  it('正文中的 HTML 不会被解析执行（防 XSS）', () => {
    const payload = '<img src=x onerror="alert(1)"><b>加粗</b>'
    const wrapper = mountList({ posts: [makePost({ text: payload })] })
    const text = wrapper.find('.post__text')

    expect(text.text()).toBe(payload)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('b').exists()).toBe(false)
  })
})
