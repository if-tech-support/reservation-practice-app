import { createFileRoute } from '@tanstack/react-router'
import { features } from '#platform'
import { isAdminUser } from '../../server/admin'
import { auth } from '../../server/auth'

// encodeURIComponent が残す ' ( ) * ! も、filename* では記号として扱われるのでエンコードする
const encodeRfc5987 = (name: string) =>
  encodeURIComponent(name).replace(
    /['()*!]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )

const notFound = () =>
  new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })

// 添付ファイルの取り出し。R2 は公開せず、必ずここを通す。
// 予約の持ち主か管理者だけに返し、それ以外は 404（存在を明かさない）
export const Route = createFileRoute('/api/attachments/$attachmentId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const store = features.attachments
        if (!store) return notFound()
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return notFound()
        const isAdmin = isAdminUser(session.user)
        const file = await store.open(params.attachmentId, { id: session.user.id, isAdmin })
        if (!file) return notFound()
        return new Response(file.body, {
          headers: {
            'Content-Type': file.contentType,
            'Content-Length': String(file.size),
            // 日本語のファイル名は filename* で渡す（filename は読めない環境向けの代わり）
            'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeRfc5987(file.filename)}`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        })
      }
    }
  }
})
