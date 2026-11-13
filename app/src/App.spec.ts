import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import App from './App.vue'
import { resetToast } from './composables/useToast'
import { STORAGE_KEY } from './constants'
import { usePostsStore } from './stores/posts'

let pinia: Pinia

const mountApp = (activePinia: Pinia = pinia) =>
  mount(App, { global: { plugins: [activePinia] } })

const statValues = (wrapper: ReturnType<typeof mountApp>): string[] =>
  wrapper.findAll('.stat__value').map((node) => node.text())

const publish = async (wrapper: ReturnType<typeof mountApp>, text: string) => {
  await wrapper.get('textarea').setValue(text)
  await wrapper.get('.composer__submit').trigger('click')
}

describe('App', () => {
  beforeEach(() => {
    resetToast()
    pinia = createPinia()
    setActivePinia(pinia)
    usePostsStore().hydrate()
  })

  it('首次访问展示空状态与全零统计', () => {
    const wrapper = mountApp()

    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.get('.feed__count').text()).toBe('0 条')
    expect(statValues(wrapper)).toEqual(['0', '0', '0'])
  })

  it('渲染顶部导航与侧栏说明文案', () => {
    const wrapper = mountApp()

    expect(wrapper.get('.brand__name').text()).toBe('Mingle')
    expect(wrapper.text()).toContain('本地模式')
    expect(wrapper.text()).toContain('无需登录')
    expect(wrapper.text()).toContain('数据仅保存在本地浏览器')
    expect(wrapper.get('.footer__text').text()).toBe('Mingle · 数据仅存于本地浏览器')
  })

  it('发布后动态流、条数与三项统计联动更新', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '今天')

    expect(wrapper.findAll('.post')).toHaveLength(1)
    expect(wrapper.get('.feed__count').text()).toBe('1 条')
    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(statValues(wrapper)).toEqual(['1', '1', '2'])
    expect(wrapper.get('.toast').text()).toBe('发布成功')
    expect(wrapper.get('.toast').classes()).toContain('is-visible')
  })

  it('多条动态按时间倒序展示', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '第一条')
    await publish(wrapper, '第二条')

    const texts = wrapper.findAll('.post__text').map((node) => node.text())
    expect(texts).toEqual(['第二条', '第一条'])
    expect(wrapper.get('.feed__count').text()).toBe('2 条')
  })

  it('重新挂载（模拟刷新）后仍能从 localStorage 恢复数据', async () => {
    const first = mountApp()
    await publish(first, '刷新也要在')
    first.unmount()

    const secondPinia = createPinia()
    setActivePinia(secondPinia)
    usePostsStore().hydrate()
    const second = mountApp(secondPinia)

    expect(second.findAll('.post__text').map((node) => node.text())).toEqual(['刷新也要在'])
    expect(statValues(second)).toEqual(['1', '1', '5'])
  })

  it('累计字数超过 9999 时以 k 缩写展示', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'long', text: 'a'.repeat(12000), createdAt: Date.now() }]),
    )
    usePostsStore().hydrate()

    const wrapper = mountApp()

    expect(statValues(wrapper)).toEqual(['1', '1', '12.0k'])
  })
})
