import { createFileRoute } from '@tanstack/react-router'
import { config, pingDb, runtime } from '#platform'

// 動作確認と、ロードバランサーのヘルスチェックに使う。
// DB に届かないときは 503 を返す（届かないサーバーへ通信を振り分けないため）
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await pingDb()
          return Response.json({ status: 'ok', runtime, appEnv: config.appEnv, db: 'ok' })
        } catch (error) {
          console.error('[health] db check failed', error)
          return Response.json(
            { status: 'error', runtime, appEnv: config.appEnv, db: 'unreachable' },
            { status: 503 }
          )
        }
      }
    }
  }
})
