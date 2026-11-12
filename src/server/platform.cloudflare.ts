// インフラに依存する部分（Cloudflare 版）。
// アプリの他のコードは '#platform' から読み込み、ここを直接は知らない。
// 同じ名前のものを platform.node.ts も公開していて、ビルド時にどちらかへ差し替わる。
import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './db/schema.sqlite'

export { schema }
export const dialect = 'sqlite' as const
export const runtime = 'cloudflare-workers' as const

export const db = drizzle(env.DB)

export const config = {
  appEnv: env.APP_ENV,
  baseUrl: env.BETTER_AUTH_URL,
  authSecret: env.BETTER_AUTH_SECRET,
  adminEmail: env.ADMIN_EMAIL ?? ''
}

// ヘルスチェック用。DB に届くかだけを確かめる
export const pingDb = async () => {
  await env.DB.prepare('SELECT 1').first()
}
