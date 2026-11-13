/**
 * 触发浏览器下载一个 JSON 文件。
 * 使用 Blob + 临时 <a download>，不依赖任何第三方库。
 * @returns 是否成功触发下载
 */
export function downloadJson(filename: string, text: string): boolean {
  let objectUrl: string | null = null

  try {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    objectUrl = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    return true
  } catch (error) {
    console.warn('[Mingle] 导出文件失败：', error)
    return false
  } finally {
    if (objectUrl !== null) {
      URL.revokeObjectURL(objectUrl)
    }
  }
}
