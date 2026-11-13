import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { FilterRange } from '../types'
import FeedFilter from './FeedFilter.vue'

const mountFilter = (keyword = '', range: FilterRange = 'all') =>
  mount(FeedFilter, { props: { keyword, range } })

describe('FeedFilter', () => {
  it('渲染关键词输入框、范围下拉与无障碍标签', () => {
    const wrapper = mountFilter()

    expect(wrapper.get('.feed__search').attributes('placeholder')).toBe('搜索动态…')
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual([
      '全部',
      '今天',
      '近 7 天',
      '近 30 天',
    ])
    expect(wrapper.find('label[for="feedSearch"]').exists()).toBe(true)
    expect(wrapper.find('label[for="feedRange"]').exists()).toBe(true)
  })

  it('输入关键词时向上同步', async () => {
    const wrapper = mountFilter()

    await wrapper.get('.feed__search').setValue('爬山')

    expect(wrapper.emitted('update:keyword')).toEqual([['爬山']])
  })

  it('切换时间范围时向上同步', async () => {
    const wrapper = mountFilter()

    await wrapper.get('.feed__select').setValue('week')

    expect(wrapper.emitted('update:range')).toEqual([['week']])
  })

  it('有关键词时展示清除按钮，点击后清空', async () => {
    const wrapper = mountFilter('爬山')

    const clear = wrapper.get('.feed__search-clear')
    await clear.trigger('click')

    expect(wrapper.emitted('update:keyword')).toEqual([['']])
  })

  it('没有关键词时不展示清除按钮', () => {
    const wrapper = mountFilter()

    expect(wrapper.find('.feed__search-clear').exists()).toBe(false)
  })
})
