import { neon } from '@neondatabase/serverless'

export type QueryFn = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>

let cached: QueryFn | null = null

/** Lazily creates one Neon client per warm serverless instance. */
export function getQuery(): QueryFn {
  if (!cached) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not configured')
    const sql = neon(url)
    cached = async (text, params = []) =>
      (await sql.query(text, params)) as Record<string, unknown>[]
  }
  return cached
}

/** Test hook: drop the cached client so env changes take effect. */
export function resetQueryCache(): void {
  cached = null
}
