import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { config, db, dialect, features, schema } from '#platform'
import { MailLimitError } from './features/types'
import { verificationMail } from './mail-templates'

const mailer = features.mailer
const VERIFICATION_EXPIRES_IN_SECONDS = 60 * 60

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
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // 確認メールを送れる構成のときだけ、確認が済むまでログインさせない
    requireEmailVerification: Boolean(mailer)
  },
  // メール機能が無効の構成（AWS・手元）では、今までどおり何も足さない
  ...(mailer
    ? {
        emailVerification: {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          expiresIn: VERIFICATION_EXPIRES_IN_SECONDS,
          sendVerificationEmail: async ({
            user,
            url
          }: {
            user: { email: string; name: string }
            url: string
          }) => {
            const mail = verificationMail({
              name: user.name,
              url,
              expiresInMinutes: VERIFICATION_EXPIRES_IN_SECONDS / 60
            })
            await mailer.send({ to: user.email, kind: 'verification', ...mail })
          }
        },
        // 登録・再送の前に上限を確かめる。メール送信は裏で動き失敗がAPIに返らないため、ここで先に断る
        hooks: {
          before: createAuthMiddleware(async (ctx) => {
            if (ctx.path !== '/sign-up/email' && ctx.path !== '/send-verification-email') return
            const email = (ctx.body as { email?: unknown } | undefined)?.email
            if (typeof email !== 'string' || !email) return
            try {
              await mailer.assertCanSend(email)
            } catch (error) {
              if (error instanceof MailLimitError) {
                throw new APIError('TOO_MANY_REQUESTS', { message: error.message })
              }
              throw error
            }
          })
        }
      }
    : {}),
  // 必ず最後に置く（Cookie の書き込みを TanStack Start に渡すため）
  plugins: [tanstackStartCookies()]
})
