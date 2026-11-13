// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_LENGTH } from '../../src/constants'
import { validateCreatePayload, validateImportPayload } from '../validation'

/** 生成恰好 length 个 Unicode 码点的正文。 */
const repeat = (char: string, length: number): string => char.repeat(length)

describe('validateCreatePayload - 合法输入', () => {
  it('接受普通正文并原样返回', () => {
    expect(validateCreatePayload({ text: '你好，Mingle' })).toEqual({ ok: true, text: '你好，Mingle' })
  })

  it('返回的正文已去除首尾空白', () => {
    expect(validateCreatePayload({ text: '  你好  ' })).toEqual({ ok: true, text: '你好' })
  })

  it('恰好 500 个字符通过', () => {
    const text = repeat('a', MAX_LENGTH)
    const result = validateCreatePayload({ text })

    expect(result).toEqual({ ok: true, text })
  })

  it('emoji 按 1 个码点计数：500 个 emoji 通过', () => {
    const text = repeat('😀', MAX_LENGTH)

    // 若误用 String.prototype.length（UTF-16 码元），这里会得到 1000 而被拒绝
    expect(validateCreatePayload({ text })).toEqual({ ok: true, text })
  })
})

describe('validateCreatePayload - 空内容', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['空对象', {}],
    ['text 不是字符串', { text: 123 }],
    ['空字符串', { text: '' }],
    ['纯空白', { text: '   ' }],
    ['换行与制表符', { text: '\n\t ' }],
  ])('%s 判定为 EMPTY', (_label, payload) => {
    expect(validateCreatePayload(payload)).toEqual({ ok: false, code: 'EMPTY' })
  })
})

describe('validateCreatePayload - 超长', () => {
  it('501 个字符判定为 TOO_LONG', () => {
    expect(validateCreatePayload({ text: repeat('a', MAX_LENGTH + 1) })).toEqual({
      ok: false,
      code: 'TOO_LONG',
    })
  })

  it('501 个 emoji 判定为 TOO_LONG', () => {
    expect(validateCreatePayload({ text: repeat('😀', MAX_LENGTH + 1) })).toEqual({
      ok: false,
      code: 'TOO_LONG',
    })
  })
})

describe('validateImportPayload - 合法输入', () => {
  it('接受 { posts: [...] } 形状', () => {
    const posts = [
      { id: 'i1', text: '导入一', createdAt: 1 },
      { id: 'i2', text: '导入二', createdAt: 2 },
    ]

    expect(validateImportPayload({ posts })).toEqual({ ok: true, posts, skipped: 0 })
  })

  it('接受纯数组形状', () => {
    const posts = [{ id: 'i1', text: '导入一', createdAt: 1 }]

    expect(validateImportPayload(posts)).toEqual({ ok: true, posts, skipped: 0 })
  })

  it('丢弃脏条目并计入 skipped（skipped = 原始条数 - 有效条数）', () => {
    const payload = [
      { id: 'i1', text: '有效一', createdAt: 1 },
      null,
      { id: 'i2', createdAt: 2 },
      'not-a-post',
      { id: 'i3', text: '有效二', createdAt: 3 },
    ]

    const result = validateImportPayload(payload)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.posts.map((post) => post.id)).toEqual(['i1', 'i3'])
    expect(result.skipped).toBe(3)
  })

  it('归一化缺失字段：createdAt 补 0、缺失 id 时生成新 id', () => {
    const result = validateImportPayload([{ text: '没有 id 与时间' }])

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.posts).toHaveLength(1)
    expect(typeof result.posts[0].id).toBe('string')
    expect(result.posts[0].id.length).toBeGreaterThan(0)
    expect(result.posts[0].createdAt).toBe(0)
    expect(result.skipped).toBe(0)
  })
})

describe('validateImportPayload - 失败路径', () => {
  it.each([
    ['空数组', []],
    ['posts 为空数组', { posts: [] }],
  ])('%s 判定为 EMPTY', (_label, payload) => {
    expect(validateImportPayload(payload)).toEqual({ ok: false, code: 'EMPTY' })
  })

  it('全部条目都是脏数据时判定为 EMPTY', () => {
    const result = validateImportPayload([null, { id: 'x' }, 42])

    expect(result).toEqual({ ok: false, code: 'EMPTY' })
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['字符串', 'posts'],
    ['数字', 1],
    ['缺少 posts 字段', { foo: 'bar' }],
    ['posts 不是数组', { posts: 'not-an-array' }],
    ['posts 是对象', { posts: { id: 'i1', text: 'x' } }],
  ])('%s 判定为 INVALID_SHAPE', (_label, payload) => {
    expect(validateImportPayload(payload)).toEqual({ ok: false, code: 'INVALID_SHAPE' })
  })

  it('失败结果不抛异常，只返回判别式结果', () => {
    expect(() => validateImportPayload(undefined)).not.toThrow()
    expect(() => validateCreatePayload(undefined)).not.toThrow()
  })
})
