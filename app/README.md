# Mingle · Vue 3 + Pinia + Hono 版

Mingle 采用 **Vue 3 + Pinia + TypeScript + Vite** 作为前端，后端为 **Hono + RESTful API + 内存存储**，开发过程遵循 TDD（先写测试再实现）。动态数据由服务端统一保管（字段为 `{ id, text, createdAt, likes, liked, favorited }`，`id` 与 `createdAt` 由服务端生成，点赞/收藏状态同样由服务端维护）。

> 内存存储的限制：**服务进程重启后动态数据会清空**，需要长期保存请使用侧栏「导出 JSON」。

## 快速开始

```bash
cd app
npm install
npm run dev        # 前端 http://localhost:5173 ，API http://localhost:8787
```

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动 Vite 与 Hono（`/api` 自动代理到 8787） |
| `npm run dev:web` | 只启动前端 |
| `npm run dev:api` | 只启动后端（watch 模式） |
| `npm start` | 单端口 8787 同时提供 API 与 `dist/` 产物（需先 build） |
| `npm run build` | 类型检查 + 生产构建（输出 `dist/`） |
| `npm run preview` | 预览构建产物 |
| `npm test` | 运行前端（jsdom）与服务端（node）全部测试 |
| `npm run test:watch` | 监听模式 |
| `npm run test:coverage` | 生成覆盖率报告 |
| `npm run typecheck` | 仅执行 `vue-tsc` 类型检查（覆盖 `src/` 与 `server/`） |

> 依赖锁定在 Node 18 兼容版本（Vite 5 / Vitest 1 / Hono 4），`tsx` 直接运行服务端 TypeScript，无需额外构建步骤。

## 功能

| 能力 | 说明 |
| --- | --- |
| 多标签页同步 | 写操作成功后 `BroadcastChannel` 广播，其它标签页自动 `refresh()`；切回页面时补刷 |
| 数据导出 / 导入 | 侧栏「数据管理」可导出 JSON 备份（含点赞/收藏状态）；导入按 id 去重合并，重复导入幂等，旧备份无状态字段时按默认值导入 |
| 跨天统计刷新 | 到本地零点的定时器 + `visibilitychange` 补刷，「今日发布」自动归零 |
| 字数口径修正 | 按 Unicode 码点计数，emoji 算一个字；移除原生 `maxlength`，改为软上限提示 |
| 删除动态 | 每条动态两段式确认删除（3 秒未确认自动复原），先落盘成功后才更新列表 |
| 草稿自动保存 | 输入 300ms 防抖写入草稿，刷新/重开后恢复；发布成功或清空输入即删除草稿 |
| 相对时间 | 「刚刚 / x 分钟前 / x 小时前 / 昨天 HH:mm / MM-DD HH:mm」，每分钟自动刷新；未知时间显示「时间未知」 |
| 搜索与筛选 | 关键词搜索 + 全部/今天/近 7 天/近 30 天筛选，展示「命中 / 总数」，无结果有独立空态 |
| 点赞 | 每条动态可点赞/取消点赞，按钮显示激活态与点赞数；请求进行中禁用按钮，避免重复提交 |
| 收藏 | 每条动态可收藏/取消收藏，激活态为暖色高亮；状态持久于服务端内存 |
| 我的收藏筛选 | 工具栏「我的收藏」开关只展示已收藏动态，可与关键词、时间范围组合；无结果显示收藏专属空态 |

### RESTful API 契约

统一前缀 `/api`，错误体固定为 `{ error: { code, message } }`。

| 方法 | 路径 | 说明 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | 健康检查 | 200 `{ status, posts, uptime }` | - |
| GET | `/api/posts` | 全量列表（倒序） | 200 `Post[]` | - |
| GET | `/api/posts/:id` | 单条详情 | 200 `Post` | 404 `NOT_FOUND` |
| POST | `/api/posts` | 新建（服务端生成 id 与时间） | 201 `Post` + `Location` | 400 `EMPTY` / `TOO_LONG`、409 `LIMIT_REACHED`、413 `TOO_LARGE`、415 `UNSUPPORTED_MEDIA_TYPE` |
| POST | `/api/posts/import` | 批量导入，按 id 去重且幂等 | 200 `{ imported, skipped, total }` | 400 `EMPTY` / `INVALID_SHAPE`、409 `LIMIT_REACHED` |
| DELETE | `/api/posts/:id` | 删除 | 204 | 404 `NOT_FOUND` |
| PUT | `/api/posts/:id/like` | 幂等设为已点赞（计数 +1） | 200 `Post` | 404 `NOT_FOUND` |
| DELETE | `/api/posts/:id/like` | 幂等取消点赞（计数不低于 0） | 200 `Post` | 404 `NOT_FOUND` |
| PUT | `/api/posts/:id/favorite` | 幂等设为已收藏 | 200 `Post` | 404 `NOT_FOUND` |
| DELETE | `/api/posts/:id/favorite` | 幂等取消收藏 | 200 `Post` | 404 `NOT_FOUND` |

> 点赞 / 收藏当前没有登录体系，是**单用户全局状态**（`likes` 只会是 0 或 1）。`PUT` / `DELETE` 语义幂等，重复请求不会让计数漂移。导出 JSON 会带上 `likes / liked / favorited`，导入时一并恢复（单用户模型下按 `liked` 收敛计数）；不含这三个字段的旧备份仍可导入，导入后为默认值。备份文件的完整字段说明与导入规则见根目录 README 的《备份文件（JSON）》。

约束：单条动态最多 500 字（按 Unicode 码点计）、最多 1000 条、请求体上限 1MB。

### 浏览器本地仅保留草稿

| 键名 | 内容 |
| --- | --- |
| `mingle_draft` | 未发布的草稿文本（纯 UI 状态，刷新不丢，发布成功即清空） |

## TDD 流程

开发顺序是自底向上的「红 → 绿 → 重构」，每一层都先写失败的测试再写实现：

1. **服务端层**（`server/__tests__/`，node 环境）
   - `store.spec.ts`：增删查、倒序、返回副本、同毫秒 id 不重复、幂等导入、重复 id 不覆盖、导入保留点赞收藏状态、点赞收藏幂等与计数不为负。
   - `validation.spec.ts`：trim、`500 / 501` 码点边界、emoji 计数、导入两种形状、脏条目计数、结构不符。
   - `api.spec.ts`：`app.request()` 跑全部状态码与错误体形状（`EMPTY`/`TOO_LONG`/`LIMIT_REACHED`/`TOO_LARGE`/`UNSUPPORTED_MEDIA_TYPE`/`INVALID_SHAPE`/`NOT_FOUND`）、`Location` 头、204 无 body、响应不含堆栈；点赞/收藏 4 个端点的幂等与 404；导入保留状态与旧格式兼容。
2. **客户端接口层**（`src/utils/`）
   - `api.spec.ts`：四个方法的请求断言、500→`SERVER`、后端错误码透传、网络失败→`NETWORK`、假定时器推进 abort→`TIMEOUT`、非 JSON 响应、204 空体、基址拼接。
   - `draft.spec.ts` / `backup.spec.ts`：草稿读写降级、导出结构（含点赞收藏字段）、导入解析与脏条目计数。
   - `broadcast.spec.ts`：跨标签页通知、取消订阅、无 `BroadcastChannel` 时静默降级。
3. **状态层**（`src/stores/posts.spec.ts`，mock `utils/api`）
   - `hydrate()/refresh()` 成功与失败（失败时 `posts` 引用不变、`loadError` 有值、`isLoading` 复位）；
   - `publish()`/`remove()`/`importAll()` 的判别式结果、失败不破坏列表、成功后广播；
   - `toggleLike()`/`toggleFavorite()`：成功替换单条、失败不改本地、同 id 在途去重；
   - getters：`orderedPosts`、`totalCount`、`todayCount`、`charStatLabel`、`pendingIds`。
4. **组合式函数**（`src/composables/*.spec.ts`）
   - `useToast` 全局单例与定时器清理、`useDraft` 防抖与 flush、`useNow`/`useDayChange` 跨天刷新。
5. **组件层**（`src/components/*.spec.ts`）
   - `PostComposer`：字数与上限样式、空值禁用、提交中禁用与「发布中…」、点击与 Ctrl/⌘ + Enter 发布。
   - `PostList`：倒序渲染、条数文案、空态切换、正文 HTML 不解析（防 XSS）。
   - `DataPanel`：导出内容来自服务端数据、导入成功提示条数与跳过数、失败提示。
6. **页面集成**（`src/App.spec.ts`）
   - 首屏空态与全零统计、发布后列表/条数/统计联动、多条倒序、搜索与时间筛选、删除、加载失败后重试恢复、跨零点统计复位。

## 目录结构

```
app/
├── index.html                 # Vue 入口
├── vite.config.ts             # Vite（/api 代理 8787）+ Vitest（jsdom / server 用 node）
├── tsconfig.json              # 同时覆盖 src/ 与 server/
├── tests/setup.ts             # 每个用例前清空 localStorage（带 node 环境守卫）
├── server/                    # Hono 服务端（内存存储）
│   ├── index.ts               # 启动入口：PORT、dist 静态托管 + SPA 回退
│   ├── app.ts                 # createApp(store)：logger / notFound / onError
│   ├── routes.ts              # /api/health、/api/posts 及点赞/收藏端点
│   ├── store.ts               # Map 存储 + 排序缓存 + id 碰撞重试 + 点赞收藏状态
│   ├── validation.ts          # 创建 / 导入请求体校验（复用前端纯函数）
│   ├── errors.ts              # 错误码与 HTTP 状态映射
│   ├── constants.ts           # API_PREFIX / 端口 / 上限
│   └── __tests__/             # store / validation / api 三组用例
└── src/
    ├── main.ts                # 创建 app、注册 Pinia、拉取服务端数据后挂载
    ├── App.vue                # 页面骨架 + 加载错误条 + 广播/可见性刷新
    ├── assets/style.css       # 新增搜索/删除/数据管理/错误条/提交中样式
    ├── constants.ts           # 草稿键、字数上限、防抖与确认时长、提示文案
    ├── types.ts               # Post / PublishResult / DeleteResult / ApiResult / ImportOutcome
    ├── utils/post.ts          # 纯函数：校验、码点计数、相对时间、筛选、排序、统计
    ├── utils/api.ts           # fetch 封装：超时、状态码归类、判别式结果
    ├── utils/draft.ts         # 草稿读写（唯一保留的 localStorage 用法）
    ├── utils/backup.ts        # 导出序列化与导入解析
    ├── utils/broadcast.ts     # BroadcastChannel 跨标签页通知
    ├── utils/download.ts      # Blob + <a download> 导出文件
    ├── stores/posts.ts        # Pinia setup store（hydrate / refresh / publish / remove / importAll / toggleLike / toggleFavorite）
    ├── composables/           # useToast / useDraft / useNow / useDayChange
    └── components/            # AppHeader / StatsPanel / PostComposer / FeedFilter /
                               # PostList / PostItem / EmptyState / SidePanel /
                               # DataPanel / AppToast
```

## 实现要点

- **组件只渲染**：校验、排序、统计、请求全部集中在 `utils` 与 store，组件只做展示与事件转发。
- **领域规则只有一份**：`src/utils/post.ts`（码点计数、脏数据归一化）与 `src/types.ts` 被前后端共用，服务端不会另写一套字数规则。
- **判别式结果贯穿全链路**：接口层 `ApiResult`、store 返回 `PublishResult`/`DeleteResult`/`ImportOutcome`，异常不外抛到 UI。
- **显式 `hydrate()`**：入口在挂载前拉取数据，失败也挂载以便展示错误条与重试按钮。
- **不做自动持久化**：没有 `$subscribe`，只有服务端确认成功后才替换列表。
- **多标签页同步**：写操作成功后 `BroadcastChannel` 广播，其它标签页收到即 `refresh()`；切回页面时补刷。不支持该 API 时静默降级。
- **禁止 `v-html`**：正文以插值渲染，自动转义，保持与原版一致的防 XSS 能力。
