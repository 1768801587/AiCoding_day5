# Mingle · Vue 3 + Pinia 版

这是根目录纯静态版 Mingle 的 **TDD 重写版**：技术栈为 Node.js + Vue 3 + Pinia + TypeScript + Vite，数据仍然只保存在浏览器 `localStorage`（键名 `mingle_posts`，字段 `{ id, text, createdAt }`）。

两版共用同一份数据结构，因此：

- 旧版页面写下的动态，在新版打开后可以直接看到；
- 新版发布的动态，旧版页面同样能读取。

根目录的 `index.html`、`css/`、`js/` 保持原样，仍可独立访问。

## 快速开始

```bash
cd app
npm install
npm run dev        # http://localhost:5173
```

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 生产构建（输出 `dist/`） |
| `npm run preview` | 预览构建产物 |
| `npm test` | 运行全部单元/集成测试 |
| `npm run test:watch` | 监听模式 |
| `npm run test:coverage` | 生成覆盖率报告 |
| `npm run typecheck` | 仅执行 `vue-tsc` 类型检查 |

> 依赖锁定在 Node 18 兼容版本（Vite 5 / Vitest 1），升级 Node 20+ 后可再考虑升级构建链。

## TDD 流程

开发顺序是自底向上的「红 → 绿 → 重构」，每一层都先写失败的测试再写实现：

1. **纯函数层**（`src/utils/`）
   - `post.spec.ts`：时间格式化补零、同日判断、脏数据过滤与归一化、倒序排序不改原数组、统计口径、`9999 / 10000` 字数缩写边界、id 唯一性。
   - `storage.spec.ts`：空存储、正常读取、JSON 损坏、非数组、脏条目、`setItem` 抛错（配额超限）时不抛出且返回 `false`。
2. **状态层**（`src/stores/posts.spec.ts`）
   - `hydrate()` 读取数据、不回写存储；`publish()` 四种结果（空内容 / 超长 / 保存失败 / 成功）；
   - 「先落盘、成功后再更新 state」的语义，保存失败不破坏已有列表；
   - getters：`orderedPosts`、`totalCount`、`todayCount`、`charStatLabel`。
3. **组合式函数**（`src/composables/useToast.spec.ts`）
   - 全局单例、错误样式切换、2 秒自动隐藏、连续调用重置计时器、作用域销毁不残留定时器。
4. **组件层**（`src/components/*.spec.ts`）
   - `PostComposer`：字数与上限样式、空值禁用、点击与 Ctrl/⌘ + Enter 发布、成功后清空并聚焦、四种提示文案。
   - `PostList`：倒序渲染、条数文案、空态切换、正文 HTML 不解析（防 XSS）。
   - `StatsPanel`、`AppToast`：展示与无障碍属性。
5. **页面集成**（`src/App.spec.ts`）
   - 首屏空态与全零统计、发布后列表/条数/统计联动、多条倒序、模拟刷新后数据恢复、累计字数 k 缩写。

## 目录结构

```
app/
├── index.html                 # Vue 入口
├── vite.config.ts             # Vite + Vitest（jsdom）配置
├── tsconfig.json
├── tests/setup.ts             # 每个用例前清空 localStorage、结束后恢复定时器/mock
└── src/
    ├── main.ts                # 创建 app、注册 Pinia、回填数据后挂载
    ├── App.vue                # 页面骨架：背景装饰 / Hero / 双栏 / footer / toast
    ├── assets/style.css       # 与根目录 css/style.css 完全一致，保证视觉 1:1
    ├── constants.ts           # 存储键、字数上限、作者名、提示文案
    ├── types.ts               # Post / PublishResult
    ├── utils/post.ts          # 纯函数：校验、格式化、排序、统计
    ├── utils/storage.ts       # localStorage 读写与异常降级
    ├── stores/posts.ts        # Pinia setup store
    ├── composables/useToast.ts
    └── components/            # AppHeader / StatsPanel / PostComposer /
                               # PostList / PostItem / EmptyState / SidePanel / AppToast
```

## 实现要点

- **组件只渲染**：校验、排序、统计、持久化全部集中在 `utils` 与 store，组件只做展示与事件转发，测试不依赖 DOM 细节。
- **`publish()` 返回判别式结果**而非直接弹提示，store 不依赖 UI，提示文案由组件层映射。
- **显式 `hydrate()`**：入口挂载前回填数据，store 顶层无副作用，测试可完全控制初始状态。
- **不自动持久化**（未使用 `$subscribe`）：避免初始化回填时误写存储，保持「只有发布成功才落盘」的语义。
- **禁止 `v-html`**：正文以插值渲染，自动转义，保持与原版一致的防 XSS 能力。
