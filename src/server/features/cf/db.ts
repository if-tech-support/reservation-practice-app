import type { drizzle } from 'drizzle-orm/d1'

// platform.cloudflare.ts の db と同じ型
export type Db = ReturnType<typeof drizzle>
