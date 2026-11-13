import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { usePostsStore } from './stores/posts'
import './assets/style.css'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)

// 首屏等待服务端数据，失败时也挂载以便展示错误提示
usePostsStore(pinia)
  .hydrate()
  .finally(() => {
    app.mount('#app')
  })
