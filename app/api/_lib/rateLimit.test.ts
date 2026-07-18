import { describe, expect, it } from 'vitest'
import type { QueryFn } from './db'
import { checkRateLimit, hashIp } from './rateLimit'

const stubQ = (count: number): { q: QueryFn; calls: { text: string; params: unknown[] }[] } => {
  const calls: { text: string; params: unknown[] }[] = []
  const q: QueryFn = async (text, params = []) => {
    calls.push({ text, params })
    return [{ count }]
  }
  return { q, calls }
}

describe('hashIp', () => {
  it('is deterministic and does not contain the raw ip', () => {
    expect(hashIp('203.0.113.9')).toBe(hashIp('203.0.113.9'))
    expect(hashIp('203.0.113.9')).not.toContain('203')
    expect(hashIp('203.0.113.9')).toHaveLength(32)
  })

  it('changes when the keying secret changes', () => {
    const before = hashIp('203.0.113.9')
    const savedSecret = process.env.ADMIN_SESSION_SECRET
    process.env.ADMIN_SESSION_SECRET = 'different-secret'
    const after = hashIp('203.0.113.9')
    if (savedSecret !== undefined) {
      process.env.ADMIN_SESSION_SECRET = savedSecret
    } else {
      delete process.env.ADMIN_SESSION_SECRET
    }
    expect(after).not.toBe(before)
  })
})

describe('checkRateLimit', () => {
  it('allows when the window count is at or below the limit', async () => {
    const { q } = stubQ(10)
    expect(await checkRateLimit(q, 'login:abc', 10, 900)).toBe(true)
  })

  it('blocks when the window count exceeds the limit', async () => {
    const { q } = stubQ(11)
    expect(await checkRateLimit(q, 'login:abc', 10, 900)).toBe(false)
  })

  it('upserts against the rate_limits table with the key and window', async () => {
    const { q, calls } = stubQ(1)
    await checkRateLimit(q, 'events:xyz', 120, 60)
    expect(calls).toHaveLength(1)
    expect(calls[0].text).toContain('rate_limits')
    expect(calls[0].params).toEqual(['events:xyz', 60])
  })
})
