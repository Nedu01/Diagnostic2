import { createHash } from 'node:crypto'
import type { QueryFn } from './db'

/** Stable, non-reversible key for an IP so raw addresses are never stored. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

/**
 * Fixed-window counter in Postgres (in-memory counters reset between
 * serverless invocations). Returns true while the caller is within limit.
 */
export async function checkRateLimit(
  q: QueryFn,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const rows = await q(
    `insert into rate_limits (key, window_start, count)
     values ($1, now(), 1)
     on conflict (key) do update set
       count = case
         when rate_limits.window_start < now() - make_interval(secs => $2) then 1
         else rate_limits.count + 1
       end,
       window_start = case
         when rate_limits.window_start < now() - make_interval(secs => $2) then now()
         else rate_limits.window_start
       end
     returning count`,
    [key, windowSeconds],
  )
  return Number(rows[0].count) <= limit
}
