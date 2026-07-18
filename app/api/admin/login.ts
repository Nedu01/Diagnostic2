import type { VercelRequest, VercelResponse } from '@vercel/node'
import { safeEqual, signToken } from '../_lib/adminAuth'
import { getQuery } from '../_lib/db'
import { checkRateLimit, hashIp } from '../_lib/rateLimit'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }
  const expected = process.env.ADMIN_PASSWORD
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!expected || !secret) {
    console.error('ADMIN_PASSWORD / ADMIN_SESSION_SECRET is not configured')
    res.status(502).json({ ok: false, error: 'not_configured' })
    return
  }
  try {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
    // Spec: 10 attempts per 15 minutes per IP, counted in Postgres.
    if (!(await checkRateLimit(getQuery(), `login:${hashIp(ip)}`, 10, 15 * 60))) {
      res.status(429).json({ ok: false, error: 'too_many_attempts' })
      return
    }
  } catch (err) {
    console.error('login rate check failed:', err instanceof Error ? err.message : err)
    res.status(502).json({ ok: false, error: 'provider_error' })
    return
  }
  const { password } = (req.body ?? {}) as { password?: string }
  if (typeof password !== 'string' || !safeEqual(password, expected)) {
    res.status(401).json({ ok: false, error: 'wrong_password' })
    return
  }
  res.status(200).json({ ok: true, token: signToken(secret) })
}
