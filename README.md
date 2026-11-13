# Mingle

一个轻量的社交动态应用：**Vue 3 + Pinia + TypeScript** 前端，**Hono + RESTful API + 内存存储** 后端，支持发布动态、搜索筛选、点赞收藏、导出导入与多标签页同步。开发过程采用 TDD（先写测试再实现）。

## 功能

- 发布动态：输入文字后发布，支持 `Ctrl / ⌘ + Enter`；空内容不可发布，最多 500 字（按 Unicode 码点计）
- 动态流：按时间倒序展示，相对时间文案每分钟自动刷新
- 搜索与筛选：关键词搜索 + 全部 / 今天 / 近 7 天 / 近 30 天，展示「命中 / 总数」
- 点赞与收藏：每条动态可点赞（显示计数）与收藏，工具栏「我的收藏」开关只看已收藏动态
- 删除动态：两段式确认（3 秒未确认自动复原）
- 草稿自动保存：输入防抖写入草稿，刷新或重开后恢复
- 数据导出 / 导入：侧栏导出 JSON 备份（含点赞/收藏状态），导入按 id 去重且幂等，旧备份同样可导入
- 多标签页同步：写操作通过 `BroadcastChannel` 广播，其它标签页自动刷新

> 后端的动态数据保存在**内存**中，服务进程重启后会清空；需要长期保存请使用侧栏的「导出 JSON」。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3.4（`<script setup>`）、TypeScript、Pinia、Vite 5 |
| 服务端 | Hono 4、`@hono/node-server`、tsx 直接运行 TypeScript |
| 测试 | Vitest 1.6、@vue/test-utils、jsdom（服务端用例跑 node 环境） |

无额外框架与依赖，前后端共用 `app/src/types.ts` 与 `app/src/utils/post.ts` 中的领域规则。

## 目录结构

```
.
├── app/                    # 全部源码（前端 + 服务端）
│   ├── src/                # Vue 前端：组件、store、composables、工具函数
│   ├── server/             # Hono 服务端：路由、内存存储、校验、错误映射
│   ├── tests/setup.ts      # Vitest 全局 setup
│   └── README.md           # 分层设计、API 契约与测试说明
├── AGENTS.md               # AI 协作约定
└── README.md
```

## 快速开始

```bash
cd app
npm install
npm run dev      # 前端 http://localhost:5173 ，API http://localhost:8787
```

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动 Vite 与 Hono（`/api` 自动代理到 8787） |
| `npm run dev:web` | 只启动前端 |
| `npm run dev:api` | 只启动后端（watch 模式） |
| `npm test` | 运行前后端全部测试 |
| `npm run typecheck` | 仅执行 `vue-tsc` 类型检查 |
| `npm run build` | 类型检查 + 生产构建（输出 `app/dist/`） |
| `npm start` | 单端口 8787 同时提供 API 与 `dist/` 产物 |

## API 一览

统一前缀 `/api`，错误体固定为 `{ error: { code, message } }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/posts` | 全量列表（倒序） |
| GET | `/api/posts/:id` | 单条详情 |
| POST | `/api/posts` | 新建动态 |
| POST | `/api/posts/import` | 批量导入（按 id 去重） |
| DELETE | `/api/posts/:id` | 删除动态 |
| PUT / DELETE | `/api/posts/:id/like` | 点赞 / 取消点赞（幂等） |
| PUT / DELETE | `/api/posts/:id/favorite` | 收藏 / 取消收藏（幂等） |

约束：单条动态最多 500 字、最多 1000 条、请求体上限 1MB。点赞与收藏是**单用户全局状态**，由服务端保存；导出文件会带上 `likes / liked / favorited`，导入时一并恢复，不含这些字段的旧备份仍可导入（导入后为默认值）。

## 备份文件（JSON）

侧栏「数据管理」可以导出 / 导入 JSON 备份，用于在内存数据被清空后恢复动态，**包含点赞与收藏状态**。导出的文件名形如 `mingle-posts-20261113-1600.json`。

### 文件结构

```json
{
  "app": "mingle",
  "version": 1,
  "exportedAt": "2026-11-13T12:00:00.000Z",
  "posts": [
    {
      "id": "seed-01",
      "text": "早上出门发现降温了，风里已经有冬天的味道。",
      "createdAt": 1794532320000,
      "likes": 1,
      "liked": true,
      "favorited": false
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `app` / `version` | string / number | 固定为 `mingle` 与 `1`，用于识别文件来源 |
| `exportedAt` | string | 导出时间（ISO 8601），仅作记录，导入时忽略 |
| `posts[].id` | string | 动态唯一标识，导入时按它去重；缺失会自动生成新 id |
| `posts[].text` | string | 正文，必填，最多 500 字（按 Unicode 码点计） |
| `posts[].createdAt` | number | 创建时间（毫秒时间戳），缺失按 0 处理（排在列表末尾并显示「时间未知」） |
| `posts[].likes` | number | 点赞数，单用户模型下只会是 0 或 1 |
| `posts[].liked` | boolean | 当前是否已点赞 |
| `posts[].favorited` | boolean | 当前是否已收藏 |

### 导入规则

- 兼容两种形状：上面带 `app / version / posts` 的导出结构，以及**纯数组** `[{ id, text, createdAt }]`。
- 按 `id` 去重：已存在的动态会被**跳过且不覆盖**（正文、时间、点赞收藏都保持服务端现值），提示里显示「跳过 N 条」。
- 点赞收藏状态随导入恢复：`likes` 以 `liked` 为准收敛（已点赞记为 1，未点赞记为 0），`favorited` 原样保留。
- **旧备份兼容**：不含 `likes / liked / favorited` 的文件仍可导入，导入后这三项分别为 `0 / false / false`。
- 校验限制：文件 ≤ 1MB；正文必填且 ≤ 500 字；导入后总条数 ≤ 1000 条；完全非法的条目（如缺少 `text`）会被丢弃并计入跳过数。
- 失败时用提示条说明原因：JSON 非法 / 结构不符 / 没有可导入的动态 / 文件过大 / 写入失败。

### 命令行导出与导入

`GET /api/posts` 返回的数组就是导出文件中的 `posts` 内容，因此可以直接用命令行备份与恢复：

```bash
# 导出（纯数组，导入接口同样接受）
curl -s http://localhost:8787/api/posts > posts.json

# 导入：既可用上面导出的纯数组，也可用页面导出的完整备份文件
curl -X POST http://localhost:8787/api/posts/import \
  -H "Content-Type: application/json" \
  --data-binary @posts.json
```

完整的分层设计、字段定义与测试说明见 [`app/README.md`](./app/README.md)。
