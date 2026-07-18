import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getQuery } from './_lib/db'
import { checkRateLimit, hashIp } from './_lib/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PILLAR_BAND = new Set(['strong', 'solid', 'needs_work', 'concern'])
const OVERALL_BAND = new Set(['strong', 'good', 'gaps', 'concern'])
const PILLARS = ['clarity', 'freedom', 'capacity', 'intention', 'unity'] as const

type Props = Record<string, unknown>
const onlyKeys = (p: Props, allowed: string[]) => Object.keys(p).every((k) => allowed.includes(k))

/** Allowlist: event name → validator for its props. Anything else is rejected. */
const EVENTS: Record<string, (p: Props) => boolean> = {
  visit: (p) =>
    onlyKeys(p, ['source']) &&
    (p.source === undefined ||
      (typeof p.source === 'string' && p.source.length <= 100 && !p.source.includes('@'))),
  diagnostic_started: (p) => onlyKeys(p, []),
  question_answered: (p) =>
    onlyKeys(p, ['question']) &&
    typeof p.question === 'number' && Number.isInteger(p.question) &&
    p.question >= 1 && p.question <= 20,
  diagnostic_completed: (p) =>
    onlyKeys(p, ['band', ...PILLARS]) &&
    OVERALL_BAND.has(String(p.band)) &&
    PILLARS.every((k) => PILLAR_BAND.has(String(p[k]))),
  report_unlocked: (p) => onlyKeys(p, ['band']) && OVERALL_BAND.has(String(p.band)),
  result_shared: (p) => onlyKeys(p, ['method']) && ['native', 'clipboard'].includes(String(p.method)),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false })
    return
  }
  const { name, visitorId, props = {} } = (req.body ?? {}) as {
    name?: string
    visitorId?: string
    props?: Props
  }
  const validate = name ? EVENTS[name] : undefined
  if (
    !validate ||
    typeof visitorId !== 'string' || !UUID_RE.test(visitorId) ||
    typeof props !== 'object' || props === null || Array.isArray(props) ||
    !validate(props)
  ) {
    res.status(400).json({ ok: false })
    return
  }
  try {
    const q = getQuery()
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
    if (!(await checkRateLimit(q, `events:${hashIp(ip)}`, 120, 60))) {
      res.status(429).json({ ok: false })
      return
    }
    await q('insert into events (visitor_id, name, props) values ($1, $2, $3)', [
      visitorId,
      name,
      JSON.stringify(props),
    ])
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('event insert failed:', err instanceof Error ? err.message : err)
    res.status(502).json({ ok: false })
  }
}
