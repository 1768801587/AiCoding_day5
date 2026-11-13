import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { ChannelLike } from './broadcast'
import { createPostsChannel, postsChannel } from './broadcast'

/** 可注入的假频道，既能断言广播调用，也能模拟「其它标签页」发来的消息。 */
interface FakeChannel {
  channel: ChannelLike
  postMessage: Mock<[message: unknown], void>
  close: Mock<[], void>
  emitRemoteMessage: () => void
}

function createFakeChannel(): FakeChannel {
  const postMessage = vi.fn<[message: unknown], void>()
  const close = vi.fn<[], void>()
  const channel: ChannelLike = { postMessage, close, onmessage: null }

  return {
    channel,
    postMessage,
    close,
    emitRemoteMessage: () => {
      channel.onmessage?.(new MessageEvent('message', { data: { type: 'posts-changed' } }))
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createPostsChannel', () => {
  it('使用固定的频道名', () => {
    const names: string[] = []

    createPostsChannel((name) => {
      names.push(name)
      return null
    })

    expect(names).toEqual(['mingle_posts'])
  })

  it('notify 只广播，不触发本页订阅者', () => {
    const fake = createFakeChannel()
    const channel = createPostsChannel(() => fake.channel)
    const handler = vi.fn()
    channel.subscribe(handler)

    channel.notify()

    expect(fake.postMessage).toHaveBeenCalledTimes(1)
    expect(handler).not.toHaveBeenCalled()
  })

  it('收到其它标签页的消息时触发全部订阅者', () => {
    const fake = createFakeChannel()
    const channel = createPostsChannel(() => fake.channel)
    const first = vi.fn()
    const second = vi.fn()
    channel.subscribe(first)
    channel.subscribe(second)

    fake.emitRemoteMessage()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('取消订阅后不再触发', () => {
    const fake = createFakeChannel()
    const channel = createPostsChannel(() => fake.channel)
    const handler = vi.fn()
    const unsubscribe = channel.subscribe(handler)

    unsubscribe()
    fake.emitRemoteMessage()

    expect(handler).not.toHaveBeenCalled()
  })

  it('环境没有 BroadcastChannel 时降级为仅本页订阅且不抛错', () => {
    vi.stubGlobal('BroadcastChannel', undefined)

    const channel = createPostsChannel()
    const handler = vi.fn()
    channel.subscribe(handler)

    expect(() => channel.notify()).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
    expect(() => channel.dispose()).not.toThrow()
  })

  it('dispose 关闭频道并清空订阅', () => {
    const fake = createFakeChannel()
    const channel = createPostsChannel(() => fake.channel)
    const handler = vi.fn()
    channel.subscribe(handler)

    channel.dispose()

    expect(fake.close).toHaveBeenCalledTimes(1)

    fake.emitRemoteMessage()
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('postsChannel', () => {
  it('默认实例的 notify 在无频道时也是安全空操作', () => {
    expect(() => postsChannel.notify()).not.toThrow()
  })
})
