// ブラウザから API を呼ぶためのクライアント
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createAuthClient } from 'better-auth/react'
import type { AppRouter } from '../server/trpc'

export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc' })]
})

export const authClient = createAuthClient()
