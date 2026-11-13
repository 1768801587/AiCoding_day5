import { IMPORT_MAX_BYTES } from '../src/constants'

/** 所有接口共用的路径前缀，前后端（Vite 代理）依赖该常量保持一致。 */
export const API_PREFIX = '/api'

/** 默认监听端口，可用环境变量 PORT 覆盖。 */
export const DEFAULT_PORT = 8787

/** 服务端允许保存的最大动态条数，超出后发布会返回 409。 */
export const MAX_POSTS = 1000

/**
 * 单次请求体体积上限（字节）。
 * 与前端导入文件的体积上限共用同一个来源，避免出现两份不一致的数字。
 */
export const MAX_BODY_BYTES = IMPORT_MAX_BYTES
