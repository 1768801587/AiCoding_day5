import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Post } from '../types'
import PostList from './PostList.vue'

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'p1',
  text: '第一条动态',
  createdAt: new Date(2024, 4, 1, 10, 30).getTime(),
  ...overrides,
})

describe('PostList', () => {
  it('按传入顺序渲染动态，并保证每条都完整呈现', () => {
    const posts = [
      makePost({ id: 'new', text: '更新的动态', createdAt: new Date(2024, 4, 2, 8, 5).getTime() }),
      makePost({ id: 'old', text: '更早的动态', createdAt: new Date(2024, 4, 1, 20, 0).getTime() }),
    ]

    const wrapper = mount(PostList, { props: { posts } })
    const items = wrapper.findAll('.post')

    expect(items).toHaveLength(2)
    expect(items[0]?.find('.post__text').text()).toBe('更新的动态')
    expect(items[1]?.find('.post__text').text()).toBe('更早的动态')
  })

  it('每条动态包含首字母头像、作者名与格式化后的时间', () => {
    const wrapper = mount(PostList, { props: { posts: [makePost()] } })
    const time = wrapper.find('.post__time')

    expect(wrapper.find('.post__avatar').text()).toBe('M')
    expect(wrapper.find('.post__author').text()).toBe('Mingler')
    expect(time.text()).toBe('2024-05-01 10:30')
    expect(time.attributes('datetime')).toBe(new Date(new Date(2024, 4, 1, 10, 30).getTime()).toISOString())
  })

  it('显示动态条数文案', () => {
    const wrapper = mount(PostList, { props: { posts: [makePost(), makePost({ id: 'p2' })] } })

    expect(wrapper.find('.feed__count').text()).toBe('2 条')
  })

  it('无数据时展示空状态并隐藏列表', () => {
    const wrapper = mount(PostList, { props: { posts: [] } })

    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.find('.feed__list').exists()).toBe(false)
    expect(wrapper.find('.feed__count').text()).toBe('0 条')
    expect(wrapper.text()).toContain('这里还很安静')
  })

  it('有数据时不渲染空状态', () => {
    const wrapper = mount(PostList, { props: { posts: [makePost()] } })

    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  it('正文中的 HTML 不会被解析执行（防 XSS）', () => {
    const payload = '<img src=x onerror="alert(1)"><b>加粗</b>'
    const wrapper = mount(PostList, { props: { posts: [makePost({ text: payload })] } })
    const text = wrapper.find('.post__text')

    expect(text.text()).toBe(payload)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('b').exists()).toBe(false)
  })
})
