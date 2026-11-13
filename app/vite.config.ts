import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // 开发阶段把 /api 交给 Hono 服务端，前端无需感知端口
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.spec.ts', 'server/**/*.spec.ts'],
    // 服务端用例不需要 DOM，跑在 node 环境更快也更贴近运行时
    environmentMatchGlobs: [['server/**', 'node']],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.spec.ts', 'src/types.ts'],
    },
  },
})
