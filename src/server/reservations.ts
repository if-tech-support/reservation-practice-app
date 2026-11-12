// 予約の読み書き。D1 でも PostgreSQL でも同じコードで動く
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '#platform'

const { reservation, user } = schema

export const MAX_RESERVATIONS_PER_USER = 50

export type NewReservation = {
  title: string
  startsAt: Date
  partySize: number
  note: string
}

export const listReservationsOf = (userId: string) =>
  db
    .select()
    .from(reservation)
    .where(eq(reservation.userId, userId))
    .orderBy(asc(reservation.startsAt))

export const listAllReservations = () =>
  db
    .select({
      id: reservation.id,
      title: reservation.title,
      startsAt: reservation.startsAt,
      partySize: reservation.partySize,
      note: reservation.note,
      userEmail: user.email
    })
    .from(reservation)
    .innerJoin(user, eq(user.id, reservation.userId))
    .orderBy(asc(reservation.startsAt))
    .limit(200)

export const createReservation = async (userId: string, input: NewReservation) => {
  const row = {
    id: crypto.randomUUID(),
    userId,
    title: input.title,
    startsAt: input.startsAt,
    partySize: input.partySize,
    note: input.note,
    createdAt: new Date()
  }
  await db.insert(reservation).values(row)
  return row
}

// 自分の予約だけを消せるよう、userId も条件に入れる
export const cancelReservation = async (userId: string, id: string) => {
  await db
    .delete(reservation)
    .where(and(eq(reservation.id, id), eq(reservation.userId, userId)))
}
