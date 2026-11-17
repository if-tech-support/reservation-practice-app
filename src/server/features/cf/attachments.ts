import type { Db } from './db'
import { and, asc, count, eq } from 'drizzle-orm'
import { attachment, reservation } from '../../db/schema.sqlite'
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_RESERVATION,
  ATTACHMENT_MAX_PER_USER,
  ATTACHMENT_TYPES,
  type AttachmentInfo,
  type AttachmentStore
} from '../types'

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b)

// 申告された種類ではなく、中身の先頭バイトで確かめる
const detectType = (bytes: Uint8Array): string | null => {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  return null
}

// 元のファイル名は表示用にだけ使う。パス区切りと制御文字は除く
const cleanFilename = (name: string) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字を除くため
  name.replace(/[\\/\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) || 'file'

const RESERVE_SQL = `
INSERT INTO attachment (id, reservation_id, user_id, r2_key, filename, content_type, size, created_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
WHERE (SELECT COUNT(*) FROM attachment WHERE reservation_id = ?2) < ?9
  AND (SELECT COUNT(*) FROM attachment WHERE user_id = ?3) < ?10`

const toInfo = (row: typeof attachment.$inferSelect): AttachmentInfo => ({
  id: row.id,
  reservationId: row.reservationId,
  filename: row.filename,
  contentType: row.contentType,
  size: row.size,
  createdAt: row.createdAt
})

export const createAttachmentStore = (deps: { bucket: R2Bucket; db: Db }): AttachmentStore => {
  const { bucket, db } = deps

  const removeRows = async (rows: (typeof attachment.$inferSelect)[]) => {
    if (rows.length === 0) return
    // R2 を先に消す。失敗したら行が残るので、あとでやり直せる
    await bucket.delete(rows.map((row) => row.r2Key))
    for (const row of rows) await db.delete(attachment).where(eq(attachment.id, row.id))
  }

  return {
    async upload(userId, reservationId, file) {
      if (file.size > ATTACHMENT_MAX_BYTES) {
        return { ok: false, status: 413, message: 'ファイルは5MBまでです' }
      }
      if (file.size === 0) return { ok: false, status: 400, message: '空のファイルです' }
      if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
        return { ok: false, status: 415, message: 'PDF・PNG・JPEG だけ添付できます' }
      }
      // 予約の持ち主だけが添付できる。他人の予約は存在しないものとして扱う
      const [owned] = await db
        .select({ id: reservation.id })
        .from(reservation)
        .where(and(eq(reservation.id, reservationId), eq(reservation.userId, userId)))
      if (!owned) return { ok: false, status: 404, message: '予約が見つかりません' }

      const buffer = await file.arrayBuffer()
      if (detectType(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength))) !== file.type) {
        return { ok: false, status: 415, message: 'ファイルの中身が種類と合っていません' }
      }

      const id = crypto.randomUUID()
      // 推測できないキー。元のファイル名はキーに入れない
      const r2Key = `attachments/${reservationId}/${crypto.randomUUID()}`
      const row = {
        id,
        reservationId,
        userId,
        r2Key,
        filename: cleanFilename(file.name),
        contentType: file.type,
        size: buffer.byteLength,
        createdAt: new Date()
      }
      // R2 に書く前に、件数が上限未満のときだけ行を入れて枠を取る（1つの SQL なので同時アップロードでも超えない）
      const reserved = await db.$client
        .prepare(RESERVE_SQL)
        .bind(
          row.id,
          reservationId,
          userId,
          r2Key,
          row.filename,
          row.contentType,
          row.size,
          row.createdAt.getTime(),
          ATTACHMENT_MAX_PER_RESERVATION,
          ATTACHMENT_MAX_PER_USER
        )
        .run()
      if (reserved.meta.changes === 0) {
        const [perReservation] = await db
          .select({ n: count() })
          .from(attachment)
          .where(eq(attachment.reservationId, reservationId))
        if ((perReservation?.n ?? 0) >= ATTACHMENT_MAX_PER_RESERVATION) {
          return {
            ok: false,
            status: 409,
            message: `1つの予約に添付できるのは ${ATTACHMENT_MAX_PER_RESERVATION} 件までです`
          }
        }
        return { ok: false, status: 409, message: `添付は1人 ${ATTACHMENT_MAX_PER_USER} 件までです` }
      }
      try {
        await bucket.put(r2Key, buffer, { httpMetadata: { contentType: file.type } })
      } catch (error) {
        // 書けなかったら枠を返す
        await db.delete(attachment).where(eq(attachment.id, id))
        throw error
      }
      return { ok: true, attachment: toInfo(row) }
    },

    async open(id, viewer) {
      const [row] = await db.select().from(attachment).where(eq(attachment.id, id))
      if (!row || (row.userId !== viewer.id && !viewer.isAdmin)) return null
      const object = await bucket.get(row.r2Key)
      if (!object) return null
      return {
        body: object.body,
        contentType: row.contentType,
        filename: row.filename,
        size: row.size
      }
    },

    async listOf(userId) {
      const rows = await db
        .select()
        .from(attachment)
        .where(eq(attachment.userId, userId))
        .orderBy(asc(attachment.createdAt))
      return rows.map(toInfo)
    },

    async listAll() {
      const rows = await db.select().from(attachment).orderBy(asc(attachment.createdAt)).limit(1000)
      return rows.map(toInfo)
    },

    async remove(userId, id) {
      const rows = await db
        .select()
        .from(attachment)
        .where(and(eq(attachment.id, id), eq(attachment.userId, userId)))
      await removeRows(rows)
    },

    async removeAllOfReservation(userId, reservationId) {
      const rows = await db
        .select()
        .from(attachment)
        .where(and(eq(attachment.reservationId, reservationId), eq(attachment.userId, userId)))
      await removeRows(rows)
    }
  }
}
