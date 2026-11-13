import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadJson } from './download'

const createObjectURL = vi.fn<[Blob], string>(() => 'blob:mock-url')
const revokeObjectURL = vi.fn<[string], void>()

describe('downloadJson', () => {
  beforeEach(() => {
    // jsdom 未实现 Blob URL API，按需补齐
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      writable: true,
      configurable: true,
    })
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
  })

  it('创建 Blob 链接、触发下载并释放资源', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = downloadJson('mingle-posts.json', '{"posts":[]}')

    expect(result).toBe(true)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    expect(document.body.querySelector('a')).toBeNull()
  })

  it('下载失败时告警并返回 false，不抛出异常', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    createObjectURL.mockImplementationOnce(() => {
      throw new Error('BlobError')
    })

    expect(downloadJson('x.json', '{}')).toBe(false)
  })
})
