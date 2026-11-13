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
