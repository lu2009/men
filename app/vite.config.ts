import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * `app/` 里**没装 `@types/node`**（`tsconfig.json` 的 `types` 只列了 `vite/client`），
 * 直接写 `process.env` 会让 `vue-tsc` 报 **TS2591**（已实测）。所以这里就地声明一下，
 * 只为让构建闸过 —— **不为这个多装一个依赖**。
 * ⚠️ 将来谁给 `tsconfig.json` 的 `types` 加上 `'node'`，就把这一行删掉（否则会重复声明）。
 */
declare const process: { env: Record<string, string | undefined> }

// Tauri 需要固定端口；Vite 默认 5173。
//
// ⚠️ 端口与代理目标这两处**读环境变量**，只为让 `npm run e2e`（`scripts/e2e.mjs`）能在
//    **另一套端口**上起第二份 vite、并把它指到**一次性库**的后端（3101）——用户的 dev
//    后端就占着 3000、dev 库就是 `smartdoor`，E2E 绝不能打到那儿。
//    **默认值一字未改**：不设这两个环境变量时，行为与从前**逐字相同**。
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: true,
    proxy: {
      // Web 端开发时，把 /api 转发到后端 axum 服务。
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
