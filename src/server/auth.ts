import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { config, db, dialect, schema } from '#platform'

export const auth = betterAuth({
  baseURL: config.baseUrl,
  secret: config.authSecret,
  database: drizzleAdapter(db, {
    provider: dialect,
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification
    }
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  // 必ず最後に置く（Cookie の書き込みを TanStack Start に渡すため）
  plugins: [tanstackStartCookies()]
})
