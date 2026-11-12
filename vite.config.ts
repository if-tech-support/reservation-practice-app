import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

// 同じアプリを2つの構成に載せる。
//   DEPLOY_TARGET 未指定 … Cloudflare Workers（D1）
//   DEPLOY_TARGET=node  … Node.js のサーバー（PostgreSQL）。AWS の ECS Fargate で動かす
// インフラに依存する部分は src/server/platform.*.ts にまとめ、ここで差し替える。
const target = process.env.DEPLOY_TARGET === 'node' ? 'node' : 'cloudflare'
const platform = fileURLToPath(
  new URL(`./src/server/platform.${target}.ts`, import.meta.url)
)

export default defineConfig({
  resolve: { alias: { '#platform': platform } },
  server: { port: 5173, strictPort: true },
  plugins:
    target === 'node'
      ? [tanstackStart(), nitro({ preset: 'node-server' }), react()]
      : [cloudflare({ viteEnvironment: { name: 'ssr' } }), tanstackStart(), react()]
})
