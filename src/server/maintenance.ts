import { config, features } from '#platform'
import { auth } from './auth'

// メンテナンス中でも通すパス。管理者がログインして解除できるようにするため
const ALLOWED_PATHS = new Set([
  '/login',
  '/api/auth/sign-in/email',
  '/api/auth/get-session',
  '/api/auth/sign-out'
])

const page = `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>メンテナンス中</title></head>
<body style="font-family: sans-serif; text-align: center; margin-top: 20vh">
<h1>ただいまメンテナンス中です</h1>
<p>しばらくしてからもう一度お試しください。</p>
</body>
</html>`

// メンテナンス中で、通してよくない要求のときだけ応答を返す。通すときは null。
// KV は1リクエストにつき1回だけ読む（/api/health は health.ts 側で読むので、ここでは読まない）
export const maintenanceResponse = async (request: Request): Promise<Response | null> => {
  const flag = features.maintenance
  if (!flag) return null
  const { pathname } = new URL(request.url)
  if (pathname === '/api/health' || ALLOWED_PATHS.has(pathname)) return null
  if (!(await flag.isOn())) return null

  // 管理者としてログイン済みの人は通す
  if (request.headers.get('cookie') && config.adminEmail) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (session?.user.email === config.adminEmail) return null
  }

  const headers = { 'Retry-After': '300', 'Cache-Control': 'no-store' }
  if (pathname.startsWith('/api/')) {
    return Response.json({ error: 'maintenance' }, { status: 503, headers })
  }
  return new Response(page, {
    status: 503,
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' }
  })
}
