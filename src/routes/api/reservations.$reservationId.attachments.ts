import { createFileRoute } from '@tanstack/react-router'
import { features } from '#platform'
import { auth } from '../../server/auth'
import { ATTACHMENT_MAX_BYTES } from '../../server/features/types'

// 予約に添付ファイルを1つ足す（multipart/form-data の file 欄）。持ち主だけが呼べる
const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const Route = createFileRoute('/api/reservations/$reservationId/attachments')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const store = features.attachments
        if (!store) return json({ error: 'not found' }, 404)
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return json({ error: 'unauthorized' }, 401)

        // 本文を読む前に大きさを見て、大きすぎる要求はメモリに載せずに断る（フォームの枠ぶんだけ余裕を持たせる）
        const length = Number(request.headers.get('content-length'))
        if (!Number.isFinite(length) || length <= 0) return json({ error: '大きさが分かりません' }, 411)
        if (length > ATTACHMENT_MAX_BYTES + 64 * 1024) {
          return json({ error: 'ファイルは5MBまでです' }, 413)
        }

        let file: unknown
        try {
          file = (await request.formData()).get('file')
        } catch {
          return json({ error: 'multipart/form-data で送ってください' }, 400)
        }
        if (!(file instanceof File)) return json({ error: 'file が必要です' }, 400)

        const result = await store.upload(session.user.id, params.reservationId, file)
        if (!result.ok) return json({ error: result.message }, result.status)
        return json({ attachment: result.attachment }, 201)
      }
    }
  }
})
