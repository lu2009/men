import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Tauri 需要固定端口；Vite 默认 5173。
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Web 端开发时，把 /api 转发到后端 axum 服务。
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
