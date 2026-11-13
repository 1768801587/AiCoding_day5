# AGENTS.md

本文件面向 AI 编码助手，说明本仓库的双版本结构、可用命令、TDD 工作流与不可违反的约束。动手前请先读完。

## 项目概览

Mingle 是一个纯前端的轻社交动态页面：发布文字动态、按时间倒序展示、数据仅存于浏览器 `localStorage`，无后端、无登录。

仓库内**并存两套实现**，职责严格区分：

| 位置 | 实现 | 状态 |
| --- | --- | --- |
| 根目录 `index.html` + `css/` + `js/` | 纯 HTML/CSS/原生 JS（IIFE），无构建 | **只读参照，禁止修改** |
| `app/` | Vue 3 + Pinia + TypeScript + Vite（TDD 重写版） | **主力开发位置** |

两套实现共用同一份 localStorage 数据结构，数据互通。新增功能只改 `app/`。

## 技术栈与环境

- Vue `^3.4.38`（全部 `<script setup lang="ts">`）、Pinia `^2.2.2`（setup store）
- TypeScript `~5.4.5`、Vite `^5.4.3`、`vue-tsc ^2.0.29`
- 测试：Vitest `^1.6.0` + `@vue/test-utils ^2.4.6` + `jsdom ^24.1.1`
- 当前环境 Node v18.16.1 / npm 9.5.1：**依赖必须保持 Node 18 兼容，禁止升级到 Vite 7 / Vitest 3（需 Node 20+）**

## 目录职责（`app/`）

| 路径 | 职责 |
| --- | --- |
| `src/main.ts` | 创建 app、注册 Pinia、`hydrate()` 回填数据后挂载 |
| `src/App.vue` | 页面骨架：背景装饰 / Hero / 双栏 / footer / toast |
| `src/assets/style.css` | 与根目录 `css/style.css` 完全一致的副本，勿改选择器 |
| `src/constants.ts` | 存储键、字数上限、作者名、提示文案 |
| `src/types.ts` | `Post`、`PublishError`、`PublishResult` |
| `src/utils/post.ts` | 纯函数：校验、id 生成、时间格式化、排序、统计 |
| `src/utils/storage.ts` | localStorage 读写与异常降级（失败只 warn 不抛） |
| `src/stores/posts.ts` | Pinia store：state、getters、`hydrate()`、`publish()` |
| `src/composables/useToast.ts` | 全局单例提示：2 秒自动隐藏、连续调用重置计时器 |
| `src/components/*.vue` | 8 个展示组件：AppHeader / StatsPanel / PostComposer / PostList / PostItem / EmptyState / SidePanel / AppToast |
| `tests/setup.ts` | 每个用例前清空 localStorage，结束后恢复定时器与 mock |

## 命令（在 `app/` 目录执行）

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器（默认 http://localhost:5173） |
| `npm run build` | `vue-tsc --noEmit` + `vite build`，产物 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm test` | 运行全部测试（当前 9 个 spec、69 项用例） |
| `npm run test:watch` | 监听模式 |
| `npm run test:coverage` | 覆盖率报告 |
| `npm run typecheck` | 仅类型检查 |

## TDD 工作流（强制）

1. 先写测试描述期望行为，运行确认**红灯**（失败原因应是功能缺失，而非语法错误）。
2. 写最小实现让测试变绿。
3. 在测试保护下重构，再跑一次确认仍绿。
4. 分层顺序：`utils` 纯函数 → `store` → `composable` → 组件 → `App` 集成。

约定：

- 任何新增/修改的行为都必须先有失败的测试，禁止「先写实现、后补测试」。
- 每个用例前 `setActivePinia(createPinia())` 隔离 store；时间用 `vi.useFakeTimers()` + `vi.setSystemTime()` 固定。
- 存储异常用 `vi.spyOn(Storage.prototype, 'setItem')` 抛错；`console.warn` 需 `mockImplementation` 静音。
- `wrapper.unmount()` 后清理，避免定时器与 DOM 泄漏。

## 编码约定

- 单文件组件固定 `<script setup lang="ts">` → `<template>`，需要时再加 `<style>`。
- 数据向下（props）、事件向上（emit）；只有真正双向绑定的场景才用 `v-model`。
- 业务逻辑写在 `utils` 与 store，组件只做展示与事件转发；不在模板里做排序/统计等派生计算，用 `computed`。
- 沿用既有 BEM 类名与 `aria-*` 属性，视觉样式来自 `assets/style.css`，不要内联样式或新增框架。
- **禁止 `v-html`**：用户正文一律插值渲染，保持防 XSS 能力。
- 不引入 UI 组件库、CSS 预处理器或新的运行时依赖；确需新增依赖时须保持 Node 18 兼容。

## 数据契约与不可变行为

存储：`localStorage` 键 `mingle_posts`，元素 `{ id: string, text: string, createdAt: number }`（结构改变会破坏与旧版的数据互通）。

以下行为已被测试锁定，不得改变：

- 正文 `trim()` 后为空不可发布；最多 500 字，超出提示错误。
- 发布成功后清空输入并聚焦输入框；保存失败时提示且**不破坏已有列表**、保留输入。
- 列表按 `createdAt` 倒序；无数据时显示空状态；条数文案 `N 条`。
- 字数提示 `N / 500`，达到 500 加 `is-limit` 类。
- `Ctrl` / `⌘` + `Enter` 发布并 `preventDefault()`；普通 Enter 只换行。
- 提示 2 秒后自动隐藏；连续调用重置计时器而非叠加。
- 统计：总数、今日（按本地年月日比较）、累计字数（> 9999 显示 `(n/1000).toFixed(1)+'k'`）。
- 持久化顺序为「先落盘、成功后再更新 state」，不使用 `$subscribe` 自动写入。

## 禁止事项

- 不修改根目录 `index.html`、`css/style.css`、`js/app.js`。
- 不修改 Git 配置（`user.name` / `user.email` 等），不使用 `git push --force`。
- 不提交 `node_modules/`、`dist/`、`.env*`、`.DS_Store`；`.gitignore` 已覆盖，勿绕过。
- 不删除 `.codebuddy/`（计划与工具数据）与 `.agents/`（技能文档，与 `skills-lock.json` 配套）。
- 不为了「让测试通过」而修改断言；应先确认需求是否真的变化。

## 提交与自查

- 提交信息用 Conventional Commits 英文风格，如 `feat: rewrite Mingle with Vue 3 + Pinia following TDD`、`fix: keep draft after save failure`。
- 推送前必须 `npm test` 与 `npm run typecheck` 双双通过。
- 若行为清单发生变化，在同一次提交内同步更新本文件与 `app/README.md`，避免文档漂移。
