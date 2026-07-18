import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bearerToken, verifyToken } from '../_lib/adminAuth'
import { getQuery } from '../_lib/db'
import { getStats, type Period } from '../_lib/stats'
import { fetchRecentLeads } from '../_lib/systeme'

const PERIODS: Period[] = ['7d', '30d', 'all']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }
  const secret = process.env.ADMIN_SESSION_SECRET
  const token = bearerToken(req.headers.authorization)
  if (!secret || !token || !verifyToken(secret, token)) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }

  const requested = String(req.query.period ?? '')
  const period: Period = (PERIODS as string[]).includes(requested) ? (requested as Period) : '30d'

  const apiKey = process.env.SYSTEME_API_KEY
  // Stats and leads fail independently — the dashboard shows whichever loaded.
  const [stats, leads] = await Promise.allSettled([
    Promise.resolve().then(() => getStats(getQuery(), period)),
    apiKey
      ? fetchRecentLeads(apiKey)
      : Promise.reject(new Error('SYSTEME_API_KEY is not configured')),
  ])
  if (stats.status === 'rejected') {
    console.error('stats failed:', stats.reason instanceof Error ? stats.reason.message : stats.reason)
  }
  if (leads.status === 'rejected') {
    console.error('leads failed:', leads.reason instanceof Error ? leads.reason.message : leads.reason)
  }
  res.status(200).json({
    ok: true,
    period,
    stats: stats.status === 'fulfilled' ? stats.value : { error: true },
    leads: leads.status === 'fulfilled' ? leads.value : { error: true },
  })
}
