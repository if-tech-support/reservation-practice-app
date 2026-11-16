import type { Features } from '../types'
import { createAttachmentStore } from './attachments'
import { createMailer } from './mailer'
import { createMaintenanceFlag } from './maintenance'
import type { Db } from './db'

// wrangler types はトップレベルの設定しか読まないので、環境ごとに足すバインディングは省略可能として扱う。
// 無いとき（手元・設定前の検証環境）は、その機能だけ無効になる
type OptionalBindings = {
  FILES?: R2Bucket
  CONFIG?: KVNamespace
  EMAIL?: SendEmail
  MAIL_FROM?: string
}

export const createFeatures = (
  rawEnv: object,
  db: Db
): Features => {
  const env = rawEnv as OptionalBindings
  return {
    attachments: env.FILES ? createAttachmentStore({ bucket: env.FILES, db }) : null,
    // メールは send_email と MAIL_FROM の両方があるときだけ有効（MAIL_FROM が空なら無効）
    mailer:
      env.EMAIL && env.MAIL_FROM ? createMailer({ email: env.EMAIL, from: env.MAIL_FROM, db }) : null,
    maintenance: env.CONFIG ? createMaintenanceFlag(env.CONFIG) : null
  }
}
