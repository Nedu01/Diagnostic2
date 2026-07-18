import { afterEach, describe, expect, it } from 'vitest'
import { getQuery, resetQueryCache } from './db'

describe('getQuery', () => {
  afterEach(() => {
    resetQueryCache()
    delete process.env.DATABASE_URL
  })

  it('throws a clear error when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL
    expect(() => getQuery()).toThrow('DATABASE_URL')
  })

  it('returns a function when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db'
    expect(typeof getQuery()).toBe('function')
  })
})
