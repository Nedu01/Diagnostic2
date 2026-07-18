import { beforeEach, describe, expect, it, vi } from 'vitest'

let allowRate = true
vi.mock('../_lib/db', () => ({ getQuery: () => async () => [] }))
vi.mock('../_lib/rateLimit', () => ({
  hashIp: (ip: string) => `hashed(${ip})`,
  checkRateLimit: async () => allowRate,
}))

import { verifyToken } from '../_lib/adminAuth'
import handler from './login'

type Sent = { status: number; body: { ok?: boolean; token?: string; error?: string } }
const call = async (method: string, body: unknown) => {
  const sent: Sent = { status: 0, body: {} }
  const req = { method, body, headers: {} } as never
  const res = {
    status(code: number) {
      sent.status = code
      return { json(payload: unknown) { sent.body = payload as Sent['body'] } }
    },
  } as never
  await handler(req, res)
  return sent
}

beforeEach(() => {
  allowRate = true
  process.env.ADMIN_PASSWORD = 'correct-horse'
  process.env.ADMIN_SESSION_SECRET = 'session-secret'
})

describe('/api/admin/login', () => {
  it('returns a verifiable token for the right password', async () => {
    const sent = await call('POST', { password: 'correct-horse' })
    expect(sent.status).toBe(200)
    expect(verifyToken('session-secret', sent.body.token!)).toBe(true)
  })

  it('rejects a wrong password with 401', async () => {
    const sent = await call('POST', { password: 'guess' })
    expect(sent.status).toBe(401)
    expect(sent.body.token).toBeUndefined()
  })

  it('rejects a missing password with 401', async () => {
    expect((await call('POST', {})).status).toBe(401)
  })

  it('returns 429 when rate limited, even with the right password', async () => {
    allowRate = false
    expect((await call('POST', { password: 'correct-horse' })).status).toBe(429)
  })

  it('returns 502 when env vars are not configured', async () => {
    delete process.env.ADMIN_PASSWORD
    expect((await call('POST', { password: 'x' })).status).toBe(502)
  })

  it('rejects non-POST methods', async () => {
    expect((await call('GET', undefined)).status).toBe(405)
  })
})
