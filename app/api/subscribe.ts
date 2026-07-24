import type { VercelRequest, VercelResponse } from '@vercel/node'
import { decodeAnswers } from './_lib/resultCode'
import { computeResult } from './_lib/scoring'
import { buildLead } from './_lib/leads'
import { SystemeAdapter } from './_lib/systeme'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function originAllowed(req: VercelRequest): boolean {
  const origin = req.headers.origin
  if (!origin) return true // same-origin fetches may omit Origin
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return true
  const allowed = process.env.ALLOWED_ORIGIN
  return !allowed || origin === allowed
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }
  if (!originAllowed(req)) {
    res.status(403).json({ ok: false, error: 'forbidden' })
    return
  }

  const { email, firstName, code } = (req.body ?? {}) as {
    email?: string
    firstName?: string
    code?: string
  }

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    res.status(400).json({ ok: false, error: 'invalid_email' })
    return
  }
  const decoded = typeof code === 'string' ? decodeAnswers(code) : null
  if (!decoded) {
    res.status(400).json({ ok: false, error: 'invalid_code' })
    return
  }

  const apiKey = process.env.SYSTEME_API_KEY
  if (!apiKey) {
    console.error('SYSTEME_API_KEY is not configured')
    res.status(502).json({ ok: false, error: 'provider_error' })
    return
  }

  // Recompute scores server-side from the raw answers — the client never
  // sends bands, so the CRM cannot be fed spoofed results.
  const result = computeResult(decoded.answers)
  const lead = buildLead(
    email,
    typeof firstName === 'string' && firstName.trim() ? firstName.trim() : undefined,
    result,
  )

  try {
    await new SystemeAdapter(apiKey).upsertLead(lead)
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('subscribe failed:', err instanceof Error ? err.message : err)
    res.status(502).json({ ok: false, error: 'provider_error' })
  }
}
