/**
 * 跨标签页同步。
 * 数据改存服务端后，`storage` 事件不再随动态数据变化而触发，
 * 因此改用 BroadcastChannel 显式广播「数据已变更」。
 */

/** 频道的最小接口，便于测试注入假实现。 */
export interface ChannelLike {
  postMessage(message: unknown): void
  close(): void
  onmessage: ((event: MessageEvent) => void) | null
}

export interface PostsChannel {
  /** 通知「其它标签页」数据已变更，不触发本页回调 */
  notify(): void
  /** 订阅外部变更，返回取消函数 */
  subscribe(handler: () => void): () => void
  /** 关闭频道并清空订阅 */
  dispose(): void
}

/** 频道名固定为字面量，避免与已废弃的本地存储键产生耦合。 */
const CHANNEL_NAME = 'mingle_posts'

/**
 * 默认工厂：探测运行环境的 BroadcastChannel。
 * 旧浏览器或非浏览器环境下返回 null，功能降级为「仅本页订阅」。
 */
function browserChannelFactory(name: string): ChannelLike | null {
  const ctor = globalThis.BroadcastChannel

  if (typeof ctor !== 'function') {
    return null
  }

  try {
    // 直接返回原生实例，保证 onmessage 的赋值真正生效
    return new ctor(name) as ChannelLike
  } catch {
    // 某些环境（如隐私模式）构造会抛错，同样降级
    return null
  }
}

/** 创建跨标签页频道；`factory` 仅供测试替换底层实现。 */
export function createPostsChannel(
  factory: (name: string) => ChannelLike | null = browserChannelFactory,
): PostsChannel {
  const channel = factory(CHANNEL_NAME)
  const handlers = new Set<() => void>()

  if (channel !== null) {
    // 只有其它标签页发来的消息会进入这里，本页 notify 不会回环
    channel.onmessage = () => {
      for (const handler of [...handlers]) {
        handler()
      }
    }
  }

  return {
    notify(): void {
      channel?.postMessage({ type: 'posts-changed' })
    },

    subscribe(handler: () => void): () => void {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },

    dispose(): void {
      handlers.clear()
      if (channel !== null) {
        channel.onmessage = null
        channel.close()
      }
    },
  }
}

/** 应用默认使用的频道实例。 */
export const postsChannel: PostsChannel = createPostsChannel()
