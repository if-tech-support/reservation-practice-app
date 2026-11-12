// インフラに依存する部分（Node.js + PostgreSQL 版）。AWS の ECS Fargate で動かす。
// 公開している名前は platform.cloudflare.ts と同じ。
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './db/schema.pg'

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`環境変数 ${name} がありません`)
  return value
}

export { schema }
export const dialect = 'pg' as const
export const runtime = 'node' as const

const sql = postgres(required('DATABASE_URL'), {
  // RDS へは TLS でつなぐ。手元の PostgreSQL は TLS なし
  ssl: process.env.DATABASE_SSL === 'require' ? 'require' : false,
  max: 5
})

export const db = drizzle({ client: sql })

export const config = {
  appEnv: process.env.APP_ENV ?? 'local',
  baseUrl: required('BETTER_AUTH_URL'),
  authSecret: required('BETTER_AUTH_SECRET'),
  adminEmail: process.env.ADMIN_EMAIL ?? ''
}

export const pingDb = async () => {
  await sql`SELECT 1`
}
