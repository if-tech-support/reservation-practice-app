import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { config } from '#platform'
import { auth } from './auth'
import {
  cancelReservation,
  createReservation,
  listAllReservations,
  listReservationsOf,
  MAX_RESERVATIONS_PER_USER
} from './reservations'

export const createContext = async ({ req }: { req: Request }) => {
  const session = await auth.api.getSession({ headers: req.headers })
  return { user: session?.user ?? null }
}

// エラーの詳しい中身（スタックトレース）は、手元で動かすときだけ応答に含める
const t = initTRPC.context<typeof createContext>().create({ isDev: config.appEnv === 'local' })

// ログインしている人だけが呼べる
const userProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { user: ctx.user } })
})

// 管理者（ADMIN_EMAIL と同じメールアドレスの人）だけが呼べる
const adminProcedure = userProcedure.use(({ ctx, next }) => {
  if (!config.adminEmail || ctx.user.email !== config.adminEmail) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next()
})

const reservationInput = z.object({
  title: z.string().trim().min(1).max(100),
  startsAt: z.coerce.date(),
  partySize: z.number().int().min(1).max(20),
  note: z.string().trim().max(500).default('')
})

export const appRouter = t.router({
  me: t.procedure.query(({ ctx }) => ({
    user: ctx.user ? { name: ctx.user.name, email: ctx.user.email } : null,
    isAdmin: Boolean(ctx.user && config.adminEmail && ctx.user.email === config.adminEmail)
  })),
  reservation: t.router({
    list: userProcedure.query(({ ctx }) => listReservationsOf(ctx.user.id)),
    create: userProcedure.input(reservationInput).mutation(async ({ ctx, input }) => {
      const mine = await listReservationsOf(ctx.user.id)
      if (mine.length >= MAX_RESERVATIONS_PER_USER) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `予約は1人 ${MAX_RESERVATIONS_PER_USER} 件までです`
        })
      }
      return createReservation(ctx.user.id, input)
    }),
    cancel: userProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(({ ctx, input }) => cancelReservation(ctx.user.id, input.id))
  }),
  admin: t.router({
    reservations: adminProcedure.query(() => listAllReservations())
  })
})

export type AppRouter = typeof appRouter
