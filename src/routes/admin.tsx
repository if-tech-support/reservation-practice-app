import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { trpc } from '../lib/clients'

export const Route = createFileRoute('/admin')({ component: AdminPage })

// 管理者向けの画面。表示を隠すだけでは守れないので、最終的な確認はサーバー（adminProcedure）で行う。
// コースでは、この /admin を Cloudflare Access や ALB の認証でさらに制限する。
function AdminPage() {
  const all = useQuery({
    queryKey: ['admin', 'reservations'],
    queryFn: () => trpc.admin.reservations.query(),
    retry: false
  })
  // 添付ファイルの機能が無い構成では、空の一覧が返る
  const attachments = useQuery({
    queryKey: ['admin', 'attachments'],
    queryFn: () => trpc.admin.attachments.query(),
    retry: false
  })
  if (all.isPending) return <p className="muted">読み込み中…</p>
  if (all.error) return <p className="error">この画面を見る権限がありません。</p>
  return (
    <div className="card">
      <h2>
        すべての予約 <span className="badge">管理者</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>日時</th>
            <th>名前</th>
            <th>人数</th>
            <th>登録した人</th>
            {attachments.data && attachments.data.length > 0 && <th>添付</th>}
          </tr>
        </thead>
        <tbody>
          {all.data.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.startsAt).toLocaleString('ja-JP')}</td>
              <td>{item.title}</td>
              <td>{item.partySize}</td>
              <td>{item.userEmail}</td>
              {attachments.data && attachments.data.length > 0 && (
                <td>
                  {attachments.data
                    .filter((file) => file.reservationId === item.id)
                    .map((file) => (
                      <div key={file.id}>
                        <a href={`/api/attachments/${file.id}`}>{file.filename}</a>
                      </div>
                    ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
