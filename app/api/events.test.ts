import { beforeEach, describe, expect, it, vi } from 'vitest'

const inserted: { text: string; params: unknown[] }[] = []
let allowRate = true

vi.mock('./_lib/db', () => ({
  getQuery: () => async (text: string, params: unknown[] = []) => {
    inserted.push({ text, params })
    return []
  },
}))
vi.mock('./_lib/rateLimit', () => ({
  hashIp: (ip: string) => `hashed(${ip})`,
  checkRateLimit: async () => allowRate,
}))

import handler from './events'

type Sent = { status: number; body: unknown }
const call = async (method: string, body: unknown, headers: Record<string, string> = {}) => {
  const sent: Sent = { status: 0, body: null }
  const req = { method, body, headers } as never
  const res = {
    status(code: number) {
      sent.status = code
      return { json(payload: unknown) { sent.body = payload } }
    },
  } as never
  await handler(req, res)
  return sent
}

const VISITOR = '123e4567-e89b-42d3-a456-426614174000'

beforeEach(() => {
  inserted.length = 0
  allowRate = true
})

describe('/api/events', () => {
  it('accepts a valid completed event and inserts one row', async () => {
    const sent = await call('POST', {
      name: 'diagnostic_completed',
      visitorId: VISITOR,
      props: { band: 'strong', clarity: 'strong', freedom: 'solid', capacity: 'strong', intention: 'strong', unity: 'needs_work' },
    })
    expect(sent.status).toBe(200)
    expect(inserted).toHaveLength(1)
    expect(inserted[0].params[0]).toBe(VISITOR)
    expect(inserted[0].params[1]).toBe('diagnostic_completed')
  })

  it('accepts a visit event with a source', async () => {
    const sent = await call('POST', { name: 'visit', visitorId: VISITOR, props: { source: 'catholicmarriagelife.com' } })
    expect(sent.status).toBe(200)
  })

  it('rejects unknown event names', async () => {
    const sent = await call('POST', { name: 'password_typed', visitorId: VISITOR })
    expect(sent.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })

  it('rejects prototype-colliding event names', async () => {
    for (const name of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
      const sent = await call('POST', { name, visitorId: VISITOR, props: {} })
      expect(sent.status).toBe(400)
    }
    expect(inserted).toHaveLength(0)
  })

  it('rejects unknown props on a known event', async () => {
    const sent = await call('POST', { name: 'diagnostic_started', visitorId: VISITOR, props: { email: 'a@b.com' } })
    expect(sent.status).toBe(400)
  })

  it('rejects an email-shaped visit source', async () => {
    const sent = await call('POST', { name: 'visit', visitorId: VISITOR, props: { source: 'a@b.com' } })
    expect(sent.status).toBe(400)
  })

  it('rejects a malformed visitor id', async () => {
    const sent = await call('POST', { name: 'diagnostic_started', visitorId: 'not-a-uuid' })
    expect(sent.status).toBe(400)
  })

  it('rejects an out-of-range question number', async () => {
    const sent = await call('POST', { name: 'question_answered', visitorId: VISITOR, props: { question: 21 } })
    expect(sent.status).toBe(400)
  })

  it('rejects non-POST methods', async () => {
    const sent = await call('GET', undefined)
    expect(sent.status).toBe(405)
  })

  it('returns 429 when rate limited', async () => {
    allowRate = false
    const sent = await call('POST', { name: 'diagnostic_started', visitorId: VISITOR })
    expect(sent.status).toBe(429)
    expect(inserted).toHaveLength(0)
  })
})
