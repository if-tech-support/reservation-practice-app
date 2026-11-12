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
          </tr>
        </thead>
        <tbody>
          {all.data.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.startsAt).toLocaleString('ja-JP')}</td>
              <td>{item.title}</td>
              <td>{item.partySize}</td>
              <td>{item.userEmail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
