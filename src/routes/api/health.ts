import { createFileRoute } from '@tanstack/react-router'
import { config, features, pingDb, runtime } from '#platform'

// 動作確認と、ロードバランサーのヘルスチェックに使う。
// DB に届かないときは 503 を返す（届かないサーバーへ通信を振り分けないため）
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await pingDb()
          // メンテナンス中でも 200 のまま返し、印だけ足す（KV の読み取りは1回）
          const maintenance = features.maintenance ? await features.maintenance.isOn() : false
          return Response.json({
            status: 'ok',
            runtime,
            appEnv: config.appEnv,
            db: 'ok',
            ...(maintenance ? { maintenance: true } : {})
          })
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
