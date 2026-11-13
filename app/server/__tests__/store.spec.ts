// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Post } from '../../src/types'
import { createPostStore } from '../store'

/** 构造一条测试用动态，未指定的字段用固定默认值补齐。 */
const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'seed-1',
  text: '现有动态',
  createdAt: 1,
  ...overrides,
})

describe('createPostStore - list', () => {
  it('初始为空列表且数量为 0', () => {
    const store = createPostStore()

    expect(store.list()).toEqual([])
    expect(store.count()).toBe(0)
  })

  it('按 createdAt 倒序返回，与写入顺序无关', () => {
    const store = createPostStore()

    store.create('最早', 1_000)
    store.create('最新', 3_000)
    store.create('中间', 2_000)

    expect(store.list().map((post) => post.text)).toEqual(['最新', '中间', '最早'])
  })

  it('返回副本：外部增删返回的数组不会改动内部数据', () => {
    const store = createPostStore()
    store.create('a', 1)

    const snapshot = store.list()
    snapshot.push(makePost({ id: 'injected', text: '外部塞入' }))
    snapshot.length = 0

    expect(store.count()).toBe(1)
    expect(store.list().map((post) => post.id)).toHaveLength(1)
  })

  it('每次调用返回新的数组实例', () => {
    const store = createPostStore()
    store.create('a', 1)

    expect(store.list()).not.toBe(store.list())
  })
})

describe('createPostStore - create', () => {
  it('由服务端生成唯一 id 并返回写入的动态', () => {
    const store = createPostStore()

    const first = store.create('第一条')
    const second = store.create('第二条')

    expect(typeof first.id).toBe('string')
    expect(first.id.length).toBeGreaterThan(0)
    expect(first.id).not.toBe(second.id)
    expect(first.text).toBe('第一条')
    expect(typeof first.createdAt).toBe('number')
    expect(first.createdAt).toBeGreaterThan(0)
    expect(store.get(first.id)).toEqual(first)
    expect(store.count()).toBe(2)
  })

  it('使用传入的 createdAt 而不是当前时间', () => {
    const store = createPostStore()

    const post = store.create('带时间', 1_234)

    expect(post.createdAt).toBe(1_234)
    expect(store.get(post.id)?.createdAt).toBe(1_234)
  })

  it('同一毫秒内连续创建也不会产生重复 id', () => {
    const store = createPostStore()

    const ids = new Set(Array.from({ length: 50 }, (_, index) => store.create(`同刻-${index}`, 5_000).id))

    expect(ids.size).toBe(50)
    expect(store.count()).toBe(50)
  })

  it('新动态的点赞/收藏字段默认为 0、false、false', () => {
    const store = createPostStore()

    const post = store.create('默认状态', 1)

    expect(post.likes).toBe(0)
    expect(post.liked).toBe(false)
    expect(post.favorited).toBe(false)
    // 读回的数据与返回值保持一致，不能只改返回值不改内部
    expect(store.get(post.id)).toEqual(post)
  })
})

describe('createPostStore - get', () => {
  it('命中时返回对应动态', () => {
    const store = createPostStore()
    const post = store.create('可查询', 10)

    expect(store.get(post.id)).toEqual(post)
  })

  it('未命中时返回 undefined', () => {
    const store = createPostStore()
    store.create('可查询', 10)

    expect(store.get('missing-id')).toBeUndefined()
  })
})

describe('createPostStore - remove', () => {
  it('删除已存在的动态返回 true 并减少数量', () => {
    const store = createPostStore()
    const kept = store.create('保留', 1)
    const removed = store.create('删除', 2)

    expect(store.remove(removed.id)).toBe(true)
    expect(store.get(removed.id)).toBeUndefined()
    expect(store.count()).toBe(1)
    expect(store.list().map((post) => post.id)).toEqual([kept.id])
  })

  it('删除不存在的 id 返回 false 且不影响已有数据', () => {
    const store = createPostStore()
    const post = store.create('保留', 1)

    expect(store.remove('missing-id')).toBe(false)
    expect(store.count()).toBe(1)
    expect(store.get(post.id)).toEqual(post)
  })

  it('重复删除同一条动态时第二次返回 false', () => {
    const store = createPostStore()
    const post = store.create('删两次', 1)

    expect(store.remove(post.id)).toBe(true)
    expect(store.remove(post.id)).toBe(false)
    expect(store.count()).toBe(0)
  })
})

/**
 * 关于返回值的语义约定：
 * - imported：本次新写入的条数
 * - skipped：因 id 重复而未写入的条数（store 层不做内容校验，脏条目已在 validation 层丢弃）
 * - total：导入后 store 内的总条数
 */
describe('createPostStore - importMany', () => {
  it('空数组时三个计数都为 0', () => {
    const store = createPostStore()

    expect(store.importMany([])).toEqual({ imported: 0, skipped: 0, total: 0 })
  })

  it('首次导入时全部写入', () => {
    const store = createPostStore()

    const result = store.importMany([
      makePost({ id: 'i1', createdAt: 1 }),
      makePost({ id: 'i2', createdAt: 2 }),
    ])

    expect(result).toEqual({ imported: 2, skipped: 0, total: 2 })
    expect(store.count()).toBe(2)
  })

  it('按 id 去重：重复导入同一批数据幂等', () => {
    const store = createPostStore()
    const incoming = [makePost({ id: 'i1', createdAt: 1 }), makePost({ id: 'i2', createdAt: 2 })]

    store.importMany(incoming)
    const again = store.importMany(incoming)

    expect(again.imported).toBe(0)
    expect(again.skipped).toBe(2)
    expect(again.total).toBe(2)
    expect(store.count()).toBe(2)
  })

  it('部分重复时只写入新条目', () => {
    const store = createPostStore()
    store.importMany([makePost({ id: 'i1', createdAt: 1 })])

    const result = store.importMany([
      makePost({ id: 'i1', createdAt: 1 }),
      makePost({ id: 'i2', createdAt: 2 }),
      makePost({ id: 'i3', createdAt: 3 }),
    ])

    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(1)
    expect(store.count()).toBe(3)
  })

  it('同 id 已存在时保留服务端原有数据', () => {
    const store = createPostStore()
    store.importMany([makePost({ id: 'i1', text: '服务端原文', createdAt: 10 })])

    store.importMany([makePost({ id: 'i1', text: '试图覆盖', createdAt: 20 })])

    expect(store.get('i1')?.text).toBe('服务端原文')
    expect(store.get('i1')?.createdAt).toBe(10)
  })

  it('导入后的列表仍按 createdAt 倒序', () => {
    const store = createPostStore()

    store.importMany([
      makePost({ id: 'i1', text: '旧', createdAt: 100 }),
      makePost({ id: 'i2', text: '新', createdAt: 900 }),
      makePost({ id: 'i3', text: '中', createdAt: 500 }),
    ])

    expect(store.list().map((post) => post.text)).toEqual(['新', '中', '旧'])
  })

  it('丢弃入参里的点赞/收藏字段，统一写入默认状态', () => {
    const store = createPostStore()

    store.importMany([
      makePost({ id: 'f1', createdAt: 1, likes: 99, liked: true, favorited: true }),
      makePost({ id: 'f2', createdAt: 2, likes: -5, liked: false, favorited: false }),
    ])

    const imported = store.get('f1')
    expect(imported?.likes).toBe(0)
    expect(imported?.liked).toBe(false)
    expect(imported?.favorited).toBe(false)

    expect(store.get('f2')?.likes).toBe(0)
    expect(store.get('f2')?.liked).toBe(false)
    expect(store.get('f2')?.favorited).toBe(false)
  })
})

describe('createPostStore - setLiked', () => {
  it('首次点赞后 likes 为 1、liked 为 true', () => {
    const store = createPostStore()
    const post = store.create('待点赞', 1)

    const updated = store.setLiked(post.id, true)

    expect(updated?.likes).toBe(1)
    expect(updated?.liked).toBe(true)
    expect(updated?.favorited).toBe(false)
    expect(store.get(post.id)).toEqual(updated)
  })

  it('重复点赞幂等：不会重复累加计数', () => {
    const store = createPostStore()
    const post = store.create('重复点赞', 1)

    store.setLiked(post.id, true)
    const second = store.setLiked(post.id, true)
    const third = store.setLiked(post.id, true)

    expect(second?.likes).toBe(1)
    expect(third?.likes).toBe(1)
    expect(third?.liked).toBe(true)
  })

  it('取消点赞后计数减 1 且 liked 回到 false', () => {
    const store = createPostStore()
    const post = store.create('取消点赞', 1)

    store.setLiked(post.id, true)
    const updated = store.setLiked(post.id, false)

    expect(updated?.likes).toBe(0)
    expect(updated?.liked).toBe(false)
  })

  it('计数已为 0 时重复取消不会变成负数', () => {
    const store = createPostStore()
    const post = store.create('未点赞', 1)

    const first = store.setLiked(post.id, false)
    const second = store.setLiked(post.id, false)

    expect(first?.likes).toBe(0)
    expect(first?.liked).toBe(false)
    expect(second?.likes).toBe(0)
    expect(second?.liked).toBe(false)
  })

  it('不存在的 id 返回 undefined 且不影响其它数据', () => {
    const store = createPostStore()
    const post = store.create('保留', 1)

    expect(store.setLiked('missing-id', true)).toBeUndefined()
    expect(store.get(post.id)).toEqual(post)
    expect(store.count()).toBe(1)
  })

  it('返回的是副本：改动返回值不会污染内部数据', () => {
    const store = createPostStore()
    const post = store.create('副本', 1)

    const updated = store.setLiked(post.id, true)
    expect(updated).toBeDefined()

    if (updated) {
      updated.likes = 999
      updated.text = '被外部篡改'
    }

    expect(store.get(post.id)?.likes).toBe(1)
    expect(store.get(post.id)?.text).toBe('副本')
  })

  it('点赞后 list 立即反映新状态（排序缓存已失效）', () => {
    const store = createPostStore()
    const post = store.create('进列表', 1)

    // 先读一次，把排序缓存填充起来
    expect(store.list()[0].likes).toBe(0)

    store.setLiked(post.id, true)

    expect(store.list()[0].likes).toBe(1)
    expect(store.list()[0].liked).toBe(true)
  })
})

describe('createPostStore - setFavorited', () => {
  it('收藏与取消收藏只切换布尔值', () => {
    const store = createPostStore()
    const post = store.create('待收藏', 1)

    const favorited = store.setFavorited(post.id, true)
    expect(favorited?.favorited).toBe(true)
    expect(favorited?.likes).toBe(0)
    expect(favorited?.liked).toBe(false)

    const unfavorited = store.setFavorited(post.id, false)
    expect(unfavorited?.favorited).toBe(false)
  })

  it('重复设置同一收藏状态幂等', () => {
    const store = createPostStore()
    const post = store.create('重复收藏', 1)

    store.setFavorited(post.id, true)
    const again = store.setFavorited(post.id, true)

    expect(again?.favorited).toBe(true)
    expect(store.list()[0].favorited).toBe(true)
  })

  it('不存在的 id 返回 undefined', () => {
    const store = createPostStore()

    expect(store.setFavorited('missing-id', true)).toBeUndefined()
  })

  it('收藏不影响已有点赞状态', () => {
    const store = createPostStore()
    const post = store.create('点赞后收藏', 1)

    store.setLiked(post.id, true)
    const favorited = store.setFavorited(post.id, true)

    expect(favorited?.liked).toBe(true)
    expect(favorited?.likes).toBe(1)
    expect(favorited?.favorited).toBe(true)
  })
})
