/** 草稿占用的独立键名，避免污染动态数据。 */
export const DRAFT_KEY = 'mingle_draft'

/** 单条动态最大字数（按 Unicode 码点计算）。 */
export const MAX_LENGTH = 500

/** 默认作者名。 */
export const AUTHOR_NAME = 'Mingler'

/** 轻提示自动隐藏时长（毫秒）。 */
export const TOAST_DURATION = 2000

/** 草稿写入防抖时长（毫秒）。 */
export const DRAFT_DEBOUNCE = 300

/** 删除按钮二次确认的保持时长（毫秒）。 */
export const DELETE_CONFIRM_MS = 3000

/** 相对时间的刷新间隔（毫秒）。 */
export const NOW_TICK_MS = 60_000

/** 导入文件体积上限（字节）。 */
export const IMPORT_MAX_BYTES = 1024 * 1024

/** 固定文案，避免展示层散落硬编码字符串。 */
export const TOAST_MESSAGES = {
  empty: '请输入动态内容',
  tooLong: `内容不能超过 ${MAX_LENGTH} 字`,
  loadFailed: '加载动态失败，请重试',
  saveFailed: '保存失败，请检查网络后重试',
  success: '发布成功',
  deleteSuccess: '已删除该动态',
  deleteNotFound: '这条动态已经不存在了',
  deleteFailed: '删除失败，请检查网络后重试',
  likeFailed: '点赞失败，请稍后重试',
  favoriteFailed: '收藏失败，请稍后重试',
  exportSuccess: '已导出 JSON 文件',
  exportFailed: '导出失败，请重试',
  importSuccess: '导入成功',
  importSaveFailed: '导入失败，请检查网络后重试',
  importReadFailed: '读取文件失败，请重试',
} as const

/** 导入失败原因对应的提示文案。 */
export const IMPORT_ERROR_MESSAGES = {
  INVALID_JSON: '文件不是有效的 JSON',
  INVALID_SHAPE: '文件内容不是有效的动态数据',
  EMPTY: '文件里没有可导入的动态',
  TOO_LARGE: '文件过大，请选择 1MB 以内的文件',
} as const
