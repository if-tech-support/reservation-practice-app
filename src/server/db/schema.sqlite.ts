// Cloudflare D1（SQLite）用のテーブル定義。migrations/sqlite と対応する
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const ts = (name: string) => integer(name, { mode: 'timestamp_ms' })

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull()
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: ts('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull()
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: ts('access_token_expires_at'),
  refreshTokenExpiresAt: ts('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull()
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull()
})

export const reservation = sqliteTable('reservation', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  startsAt: ts('starts_at').notNull(),
  partySize: integer('party_size').notNull(),
  note: text('note').notNull().default(''),
  createdAt: ts('created_at').notNull()
})

// 予約への添付ファイル。本体は非公開の R2 に置き、ここには持ち主と元のファイル名だけを持つ
export const attachment = sqliteTable('attachment', {
  id: text('id').primaryKey(),
  reservationId: text('reservation_id').notNull(),
  userId: text('user_id').notNull(),
  r2Key: text('r2_key').notNull().unique(),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  createdAt: ts('created_at').notNull()
})

// 確認メールの送信記録。送りすぎの上限を数えるために使う
export const mailLog = sqliteTable('mail_log', {
  id: text('id').primaryKey(),
  toAddress: text('to_address').notNull(),
  kind: text('kind').notNull(),
  // 接続元 IP の SHA-256 の先頭16文字。生の IP は保存しない
  ipHash: text('ip_hash'),
  createdAt: ts('created_at').notNull()
})
