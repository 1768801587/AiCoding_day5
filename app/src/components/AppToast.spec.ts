import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { resetToast, useToast } from '../composables/useToast'
import AppToast from './AppToast.vue'

afterEach(() => {
  resetToast()
})

describe('AppToast', () => {
  it('初始不可见且带有读屏播报属性', () => {
    const wrapper = mount(AppToast)
    const toast = wrapper.get('.toast')

    expect(toast.attributes('role')).toBe('status')
    expect(toast.attributes('aria-live')).toBe('polite')
    expect(toast.classes()).not.toContain('is-visible')
    expect(toast.text()).toBe('')
  })

  it('展示文案后出现 is-visible 类', async () => {
    const wrapper = mount(AppToast)

    useToast().show('发布成功')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.toast').text()).toBe('发布成功')
    expect(wrapper.get('.toast').classes()).toContain('is-visible')
    expect(wrapper.get('.toast').classes()).not.toContain('is-error')
  })

  it('错误提示额外带上 is-error 类', async () => {
    const wrapper = mount(AppToast)

    useToast().show('请输入动态内容', true)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.toast').classes()).toContain('is-error')
  })
})
