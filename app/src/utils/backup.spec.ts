import { describe, expect, it } from 'vitest'
import type { Post } from '../types'
import { parseImport, serializePosts } from './backup'

// 归一化后所有动态都带点赞/收藏字段，sample 取归一化后的形状，导出再解析应保持一致
const sample: Post[] = [
  { id: 'a', text: '第一条', createdAt: 1700000000000, likes: 0, liked: false, favorited: false },
]

describe('serializePosts', () => {
  it('输出带版本信息的导出结构', () => {
    const text = serializePosts(sample, new Date(2024, 4, 1, 12, 0).getTime())
    const parsed = JSON.parse(text)

    expect(parsed).toMatchObject({
      app: 'mingle',
      version: 1,
      exportedAt: new Date(2024, 4, 1, 12, 0).toISOString(),
    })
    expect(parsed.posts).toEqual(sample)
  })

  it('导出的内容可以原样解析回来', () => {
    const result = parseImport(serializePosts(sample))

    expect(result).toEqual({ ok: true, posts: sample, skipped: 0 })
  })

  it('导出的 JSON 保留点赞与收藏状态，便于再次导入后恢复', () => {
    const text = serializePosts([
      { id: 'a', text: '已点赞已收藏', createdAt: 1, likes: 1, liked: true, favorited: true },
    ])

    expect(JSON.parse(text).posts[0]).toMatchObject({ likes: 1, liked: true, favorited: true })
  })
})

describe('parseImport', () => {
  it('空文件返回 EMPTY', () => {
    expect(parseImport('   ')).toEqual({ ok: false, error: 'EMPTY' })
  })

  it('非法 JSON 返回 INVALID_JSON', () => {
    expect(parseImport('{ broken')).toEqual({ ok: false, error: 'INVALID_JSON' })
  })

  it('结构不对返回 INVALID_SHAPE', () => {
    expect(parseImport('null')).toEqual({ ok: false, error: 'INVALID_SHAPE' })
    expect(parseImport('42')).toEqual({ ok: false, error: 'INVALID_SHAPE' })
    expect(parseImport('{"foo":1}')).toEqual({ ok: false, error: 'INVALID_SHAPE' })
  })

  it('兼容纯数组文件，脏条目计数后丢弃', () => {
    const result = parseImport(
      JSON.stringify([...sample, null, { id: 'no-text' }, 42]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.posts).toEqual(sample)
    expect(result.skipped).toBe(3)
  })

  it('没有任何合法动态时返回 EMPTY', () => {
    expect(parseImport(JSON.stringify([null, 42]))).toEqual({ ok: false, error: 'EMPTY' })
  })
})
