import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 后端地址：优先读环境变量 VITE_API_TARGET，默认指向本机 8080（IDEA 启动的后端）
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:8080'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // 开发环境把 /api 代理到后端，避免跨域麻烦（后端其实已配置 CORS，这里只是图方便）
      '/api': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
})
