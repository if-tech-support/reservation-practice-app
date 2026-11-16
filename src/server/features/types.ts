// Cloudflare 構成だけの機能の入り口。AWS（Node.js）構成ではすべて null（無効）になる。
// 共有コードはこの型だけを見て、R2・KV・send_email を直接は知らない。

// 添付ファイルの上限（費用と悪用を抑えるため）
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const ATTACHMENT_MAX_PER_RESERVATION = 3
export const ATTACHMENT_MAX_PER_USER = 30
export const ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const

// メール送信の上限
export const MAIL_MIN_INTERVAL_MS = 60 * 1000
export const MAIL_MAX_PER_ADDRESS_PER_DAY = 5
export const MAIL_MAX_PER_DAY = 200
export const MAIL_LIMIT_MESSAGE = 'しばらくしてからもう一度お試しください'

export class MailLimitError extends Error {
  constructor() {
    super(MAIL_LIMIT_MESSAGE)
    this.name = 'MailLimitError'
  }
}

export type AttachmentInfo = {
  id: string
  reservationId: string
  filename: string
  contentType: string
  size: number
  createdAt: Date
}

export type UploadResult =
  | { ok: true; attachment: AttachmentInfo }
  | { ok: false; status: 400 | 404 | 409 | 413 | 415; message: string }

export type OpenedAttachment = {
  body: ReadableStream
  contentType: string
  filename: string
  size: number
}

export interface AttachmentStore {
  upload(userId: string, reservationId: string, file: File): Promise<UploadResult>
  // 持ち主か管理者のときだけ中身を返す。それ以外・存在しないときは null（存在を明かさない）
  open(id: string, viewer: { id: string; isAdmin: boolean }): Promise<OpenedAttachment | null>
  listOf(userId: string): Promise<AttachmentInfo[]>
  listAll(): Promise<AttachmentInfo[]>
  remove(userId: string, id: string): Promise<void>
  removeAllOfReservation(userId: string, reservationId: string): Promise<void>
}

export type MailMessage = { to: string; subject: string; text: string; html: string; kind: string }

export interface Mailer {
  // 上限を超えるときは MailLimitError を投げる
  assertCanSend(to: string): Promise<void>
  send(message: MailMessage): Promise<void>
}

export interface MaintenanceFlag {
  // KV の値が on のとき true。呼び出し1回につき KV を1回読む
  isOn(): Promise<boolean>
}

export type Features = {
  attachments: AttachmentStore | null
  mailer: Mailer | null
  maintenance: MaintenanceFlag | null
}

export const noFeatures: Features = { attachments: null, mailer: null, maintenance: null }
