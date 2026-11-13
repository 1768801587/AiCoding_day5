/** localStorage 键名，与旧版静态页面保持一致，实现数据互通。 */
export const STORAGE_KEY = 'mingle_posts'

/** 单条动态最大字数。 */
export const MAX_LENGTH = 500

/** 默认作者名。 */
export const AUTHOR_NAME = 'Mingler'

/** 轻提示自动隐藏时长（毫秒）。 */
export const TOAST_DURATION = 2000

/** 固定文案，避免展示层散落硬编码字符串。 */
export const TOAST_MESSAGES = {
  empty: '请输入动态内容',
  tooLong: `内容不能超过 ${MAX_LENGTH} 字`,
  saveFailed: '保存失败，请检查浏览器存储权限',
  success: '发布成功',
} as const
