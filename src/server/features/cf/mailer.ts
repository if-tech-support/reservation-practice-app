import type { Db } from './db'
import { and, count, eq, gt, lt } from 'drizzle-orm'
import { mailLog } from '../../db/schema.sqlite'
import {
  MAIL_MAX_PER_ADDRESS_PER_DAY,
  MAIL_MAX_PER_DAY,
  MAIL_MIN_INTERVAL_MS,
  MailLimitError,
  type Mailer
} from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export const createMailer = (deps: {
  email: SendEmail
  from: string
  db: Db
}): Mailer => {
  const { email, from, db } = deps

  const assertCanSend = async (to: string) => {
    const address = to.trim().toLowerCase()
    const now = Date.now()
    const [recent] = await db
      .select({ n: count() })
      .from(mailLog)
      .where(and(eq(mailLog.toAddress, address), gt(mailLog.createdAt, new Date(now - MAIL_MIN_INTERVAL_MS))))
    if ((recent?.n ?? 0) > 0) throw new MailLimitError()
    const [perAddress] = await db
      .select({ n: count() })
      .from(mailLog)
      .where(and(eq(mailLog.toAddress, address), gt(mailLog.createdAt, new Date(now - DAY_MS))))
    if ((perAddress?.n ?? 0) >= MAIL_MAX_PER_ADDRESS_PER_DAY) throw new MailLimitError()
    const [total] = await db
      .select({ n: count() })
      .from(mailLog)
      .where(gt(mailLog.createdAt, new Date(now - DAY_MS)))
    if ((total?.n ?? 0) >= MAIL_MAX_PER_DAY) throw new MailLimitError()
  }

  return {
    assertCanSend,
    async send(message) {
      await assertCanSend(message.to)
      const now = new Date()
      // 送る前に記録する。送信に失敗しても数える（失敗を繰り返して叩き続けないため）
      await db.insert(mailLog).values({
        id: crypto.randomUUID(),
        toAddress: message.to.trim().toLowerCase(),
        kind: message.kind,
        createdAt: now
      })
      // 2日より古い記録は不要なので消す（テーブルを育てない）
      await db.delete(mailLog).where(lt(mailLog.createdAt, new Date(now.getTime() - 2 * DAY_MS)))
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
