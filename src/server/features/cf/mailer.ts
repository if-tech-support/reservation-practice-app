import type { Db } from './db'
import { lt } from 'drizzle-orm'
import { mailLog } from '../../db/schema.sqlite'
import {
  MAIL_MAX_PER_ADDRESS_PER_DAY,
  MAIL_MAX_PER_DAY,
  MAIL_MAX_PER_IP_PER_DAY,
  MAIL_MIN_INTERVAL_MS,
  MailLimitError,
  type Mailer
} from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

// 生の IP は保存・ログ出力しない。SHA-256 の先頭16文字（8バイト）だけ持つ
const hashIp = async (ip: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

// 確認と記録を1つの INSERT ... SELECT にまとめる（SQLite は1文を不可分に実行するので、
// 同時リクエストでも上限を超えて通らない）。入った行が0なら上限超過
const RESERVE_SQL = `
INSERT INTO mail_log (id, to_address, kind, ip_hash, created_at)
SELECT ?1, ?2, ?3, ?4, ?5
WHERE (SELECT COUNT(*) FROM mail_log WHERE to_address = ?2 AND created_at > ?6) = 0
  AND (SELECT COUNT(*) FROM mail_log WHERE to_address = ?2 AND created_at > ?7) < ?8
  AND (SELECT COUNT(*) FROM mail_log WHERE created_at > ?7) < ?9
  AND (?4 IS NULL OR (SELECT COUNT(*) FROM mail_log WHERE ip_hash = ?4 AND created_at > ?7) < ?10)`

export const createMailer = (deps: {
  email: SendEmail
  from: string
  db: Db
}): Mailer => {
  const { email, from, db } = deps

  return {
    async reserve(to, kind, clientIp) {
      const now = Date.now()
      const ipHash = clientIp ? await hashIp(clientIp) : null
      const result = await db.$client
        .prepare(RESERVE_SQL)
        .bind(
          crypto.randomUUID(),
          to.trim().toLowerCase(),
          kind,
          ipHash,
          now,
          now - MAIL_MIN_INTERVAL_MS,
          now - DAY_MS,
          MAIL_MAX_PER_ADDRESS_PER_DAY,
          MAIL_MAX_PER_DAY,
          MAIL_MAX_PER_IP_PER_DAY
        )
        .run()
      if (result.meta.changes === 0) throw new MailLimitError()
      // 2日より古い記録は不要なので消す（テーブルを育てない）
      await db.delete(mailLog).where(lt(mailLog.createdAt, new Date(now - 2 * DAY_MS)))
    },
    async send(message) {
      // 枠は reserve で取り済み（登録・再送の前の hooks.before）。
      // 送信に失敗しても記録は消さない。消すと、失敗する宛先へ繰り返し叩けて
      // 「1分に1通・1日の上限」が意味を失い、送信サービスへの無駄な呼び出しも増えるため
      try {
        const result = await email.send({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html
        })
        // 宛先のメールアドレスはログに出さない
        console.log('[mail] sent', message.kind, result.messageId)
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code
        console.error(
          '[mail] send failed',
          message.kind,
          typeof code === 'string' && code.startsWith('E_') ? code : 'unknown'
        )
        // 利用者には中身を見せず、一般的なメッセージだけ返す
        throw new Error('メールを送信できませんでした')
      }
    }
  }
}
