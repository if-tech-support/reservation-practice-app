// PostgreSQL へ migrations/pg/*.sql を番号順に適用する。
// 適用済みのファイル名を app_migrations テーブルに記録し、2回目以降は未適用のものだけを流す。
// 使い方: DATABASE_URL=postgres://... node scripts/migrate-pg.mjs
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL がありません')
  process.exit(1)
}
const dir = fileURLToPath(new URL('../migrations/pg/', import.meta.url))
const sql = postgres(url, {
  ssl: process.env.DATABASE_SSL === 'require' ? 'require' : false,
  max: 1,
  onnotice: () => {}
})

try {
  await sql`CREATE TABLE IF NOT EXISTS app_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`
  const applied = new Set(
    (await sql`SELECT name FROM app_migrations`).map((row) => row.name)
  )
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  let count = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const body = await readFile(dir + file, 'utf8')
    // 1ファイルを1つのトランザクションで流す。途中で失敗したら、そのファイルは丸ごと無かったことになる
    await sql.begin(async (tx) => {
      await tx.unsafe(body)
      await tx`INSERT INTO app_migrations (name) VALUES (${file})`
    })
    console.log(`applied: ${file}`)
    count += 1
  }
  console.log(count === 0 ? '適用するマイグレーションはありません' : `${count} 件を適用しました`)
} finally {
  await sql.end()
}
