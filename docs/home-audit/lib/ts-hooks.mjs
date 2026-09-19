/*
 * 让 `node` 直接跑本仓库的 `app/src/**` —— 差分台用，浏览器那套解析规则补上。
 *
 * 补两件 node 默认不做、但 Vite 会做的事：
 *   1. **无扩展名的相对导入**（`import { api } from '../api/client'`）按 `.ts` → `.tsx` → `/index.ts` 试；
 *   2. `import.meta.env.VITE_API_BASE_URL` 顶成 `globalThis.__VITE_ENV`（node 里 `import.meta.env` 是
 *      `undefined`，直接读会 TypeError，整个模块加载不进来）。
 *
 * 由差分台自己 `register()`，不依赖命令行参数 —— 这样脚本单独 `node` 跑也能起。
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
    const base = new URL(specifier, context.parentURL)
    for (const cand of ['.ts', '.tsx', '/index.ts']) {
      if (existsSync(fileURLToPath(new URL(base.href + cand)))) return next(base.href + cand, context)
    }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  const r = await next(url, context)
  if (url.endsWith('.ts') && r.source) {
    let s = r.source.toString()
    if (s.includes('import.meta.env')) s = s.replace(/import\.meta\.env/g, '(globalThis.__VITE_ENV ||= {})')
    return { ...r, source: s }
  }
  return r
}
