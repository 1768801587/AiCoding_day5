# Mingle

一个纯前端、零依赖的简易社交动态页面：支持发布与查看文字动态，数据保存在浏览器 localStorage 中，无需后端。

## 功能

- 发布动态：输入文字后发布，生成带时间戳的动态
- 查看动态：页面加载时自动读取本地数据，按时间倒序展示
- 本地持久化：数据存储于 `localStorage`（key：`mingle_posts`），刷新不丢失
- 输入校验：空内容不可发布，最多 500 字

## 技术栈

纯 HTML + CSS + JavaScript，无框架、无依赖、无构建步骤。

## 目录结构

```
.
├── index.html      # 页面结构
├── css/
│   └── style.css   # 样式与设计令牌
├── js/
│   └── app.js      # 交互逻辑与本地存储
└── README.md
```

## 运行

直接用浏览器打开 `index.html` 即可；或在项目根目录启动一个静态服务器：

```bash
python -m http.server 8080
```

然后访问 http://localhost:8080/

## Vue 3 + Pinia 版（TDD 重写）

`app/` 目录是同一功能以 Node.js + Vue 3 + Pinia + TypeScript + Vite 重写的版本，采用 TDD（先写测试再实现）开发。

数据已从浏览器 `localStorage` 迁移到 **Hono + RESTful API + 内存存储** 的服务端：前端通过 `/api/posts` 读写动态，服务端生成 id 与时间戳。内存存储意味着**服务重启后数据清空**，需要长期保存时请使用侧栏的导出功能。

该版本还支持**点赞**与**收藏**：每条动态卡片底部有点赞按钮（显示计数）与收藏按钮，工具栏的「我的收藏」开关可以只看已收藏的动态，并可与关键词、时间范围筛选组合。点赞/收藏是单用户全局状态，由服务端保存。

```bash
cd app
npm install
npm run dev      # 同时启动 Vite(5173) 与 Hono API(8787)，/api 走代理
npm test         # 运行前后端全部测试
npm run build    # 类型检查 + 生产构建
npm start        # 单端口 8787 同时提供 API 与 dist 产物
```

根目录的 `index.html`、`css/`、`js/` 仍是纯前端 localStorage 版本，保持原样、互不影响。

详细的分层与测试说明见 [`app/README.md`](./app/README.md)。
