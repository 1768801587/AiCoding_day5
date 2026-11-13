import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatsPanel from './StatsPanel.vue'

describe('StatsPanel', () => {
  it('渲染三项统计的数值与标签', () => {
    const wrapper = mount(StatsPanel, {
      props: { total: 12, today: 3, charsLabel: '1.2k' },
    })
    const values = wrapper.findAll('.stat__value').map((node) => node.text())
    const labels = wrapper.findAll('.stat__label').map((node) => node.text())

    expect(wrapper.attributes('aria-label')).toBe('数据统计')
    expect(values).toEqual(['12', '3', '1.2k'])
    expect(labels).toEqual(['动态总数', '今日发布', '累计字数'])
  })
})
