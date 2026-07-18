import { beforeEach, describe, expect, it, vi } from 'vitest'

let statsImpl: () => Promise<unknown> = async () => ({ fake: 'stats' })
let leadsImpl: () => Promise<unknown> = async () => [{ id: 1 }]

vi.mock('../_lib/db', () => ({ getQuery: () => async () => [] }))
vi.mock('../_lib/stats', () => ({ getStats: () => statsImpl() }))
vi.mock('../_lib/systeme', () => ({ fetchRecentLeads: () => leadsImpl() }))

import { signToken } from '../_lib/adminAuth'
import handler from './stats'

type Sent = { status: number; body: { ok?: boolean; period?: string; stats?: unknown; leads?: unknown } }
const call = async (headers: Record<string, string>, query: Record<string, string> = {}) => {
  const sent: Sent = { status: 0, body: {} }
  const req = { method: 'GET', headers, query } as never
  const res = {
    status(code: number) {
      sent.status = code
      return { json(payload: unknown) { sent.body = payload as Sent['body'] } }
    },
  } as never
  await handler(req, res)
  return sent
}

const SECRET = 'session-secret'

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET
  process.env.SYSTEME_API_KEY = 'sk'
  statsImpl = async () => ({ fake: 'stats' })
  leadsImpl = async () => [{ id: 1 }]
})

describe('/api/admin/stats', () => {
  const auth = () => ({ authorization: `Bearer ${signToken(SECRET)}` })

  it('returns stats and leads with a valid token', async () => {
    const sent = await call(auth(), { period: '7d' })
    expect(sent.status).toBe(200)
    expect(sent.body.period).toBe('7d')
    expect(sent.body.stats).toEqual({ fake: 'stats' })
    expect(sent.body.leads).toEqual([{ id: 1 }])
  })

  it('defaults an invalid period to 30d', async () => {
    const sent = await call(auth(), { period: 'nonsense' })
    expect(sent.body.period).toBe('30d')
  })

  it('rejects a missing or bad token with 401', async () => {
    expect((await call({})).status).toBe(401)
    expect((await call({ authorization: 'Bearer forged.token' })).status).toBe(401)
  })

  it('still returns leads when stats fail (and marks stats as errored)', async () => {
    statsImpl = async () => { throw new Error('db down') }
    const sent = await call(auth())
    expect(sent.status).toBe(200)
    expect(sent.body.stats).toEqual({ error: true })
    expect(sent.body.leads).toEqual([{ id: 1 }])
  })

  it('still returns stats when leads fail (and marks leads as errored)', async () => {
    leadsImpl = async () => { throw new Error('systeme down') }
    const sent = await call(auth())
    expect(sent.status).toBe(200)
    expect(sent.body.stats).toEqual({ fake: 'stats' })
    expect(sent.body.leads).toEqual({ error: true })
  })

  it('marks leads as errored when SYSTEME_API_KEY is missing', async () => {
    delete process.env.SYSTEME_API_KEY
    const sent = await call(auth())
    expect(sent.body.leads).toEqual({ error: true })
  })
})
