import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { usePostsStore } from './stores/posts'
import './assets/style.css'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)

// 挂载前先回填 localStorage 数据，避免首屏出现空态闪烁
usePostsStore(pinia).hydrate()

app.mount('#app')
