import { describe, expect, it } from 'vitest'
import { bearerToken, safeEqual, signToken, verifyToken } from './adminAuth'

const SECRET = 'test-secret'
const DAY_MS = 24 * 60 * 60 * 1000

describe('admin tokens', () => {
  it('verifies a freshly signed token', () => {
    const token = signToken(SECRET)
    expect(verifyToken(SECRET, token)).toBe(true)
  })

  it('rejects a token signed with a different secret', () => {
    expect(verifyToken('other-secret', signToken(SECRET))).toBe(false)
  })

  it('rejects a tampered payload', () => {
    const [, sig] = signToken(SECRET).split('.')
    const forged = `${Buffer.from(JSON.stringify({ exp: 9999999999 })).toString('base64url')}.${sig}`
    expect(verifyToken(SECRET, forged)).toBe(false)
  })

  it('rejects an expired token (31 days later)', () => {
    const token = signToken(SECRET, Date.now())
    expect(verifyToken(SECRET, token, Date.now() + 31 * DAY_MS)).toBe(false)
  })

  it('accepts a token 29 days later', () => {
    const token = signToken(SECRET, Date.now())
    expect(verifyToken(SECRET, token, Date.now() + 29 * DAY_MS)).toBe(true)
  })

  it('rejects malformed tokens without throwing', () => {
    expect(verifyToken(SECRET, '')).toBe(false)
    expect(verifyToken(SECRET, 'no-dot')).toBe(false)
    expect(verifyToken(SECRET, 'a.b')).toBe(false)
  })
})

describe('safeEqual', () => {
  it('matches equal strings and rejects different ones', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('bearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(bearerToken('Bearer tok.en')).toBe('tok.en')
    expect(bearerToken('Basic xyz')).toBeNull()
    expect(bearerToken(undefined)).toBeNull()
  })
})
