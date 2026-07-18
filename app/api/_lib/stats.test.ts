import { describe, expect, it } from 'vitest'
import type { QueryFn } from './db'
import { getStats } from './stats'

/** Routes each query to canned rows by matching a distinctive fragment. */
const stubQ: QueryFn = async (text, params = []) => {
  if (text.includes('count(distinct visitor_id) as n from events where happened_at')) return [{ n: 100 }]
  if (params[0] === 'diagnostic_started') return [{ n: 80 }]
  if (params[0] === 'diagnostic_completed') return [{ n: 60 }]
  if (params[0] === 'report_unlocked') return [{ n: 15 }]
  if (text.includes("'question_answered'")) {
    return [
      { question: 1, visitors: 80 },
      { question: 2, visitors: 74 },
    ]
  }
  if (text.includes('unnest')) {
    return [
      { pillar: 'clarity', band: 'strong', n: 40 },
      { pillar: 'clarity', band: 'concern', n: 20 },
      { pillar: 'unity', band: 'needs_work', n: 60 },
    ]
  }
  if (text.includes("'diagnostic_completed'") && text.includes("props->>'band'")) {
    return [
      { band: 'strong', n: 35 },
      { band: 'gaps', n: 25 },
    ]
  }
  if (text.includes("'result_shared'")) return [{ n: 9 }]
  if (text.includes("'visit'") && text.includes('source')) {
    return [
      { source: 'catholicmarriagelife.com', visitors: 70 },
      { source: 'direct', visitors: 30 },
    ]
  }
  throw new Error(`unexpected query: ${text}`)
}

describe('getStats', () => {
  it('assembles the funnel with conversion rates', async () => {
    const stats = await getStats(stubQ, '30d')
    expect(stats.funnel).toEqual({
      visitors: 100,
      starts: 80,
      completions: 60,
      optIns: 15,
      startRate: 0.8,
      completionRate: 0.75,
      optInRate: 0.25,
    })
  })

  it('returns null rates when a preceding step is zero', async () => {
    const zeroQ: QueryFn = async (text, params = []) => {
      if (text.includes('count(distinct visitor_id) as n from events where happened_at')) return [{ n: 0 }]
      if (typeof params[0] === 'string') return [{ n: 0 }]
      return []
    }
    const stats = await getStats(zeroQ, 'all')
    expect(stats.funnel.startRate).toBeNull()
    expect(stats.funnel.optInRate).toBeNull()
  })

  it('shapes dropoff, bands, shares, and sources', async () => {
    const stats = await getStats(stubQ, '7d')
    expect(stats.dropoff).toEqual([
      { question: 1, visitors: 80 },
      { question: 2, visitors: 74 },
    ])
    expect(stats.overallBands).toEqual({ strong: 35, gaps: 25 })
    expect(stats.pillarBands.clarity).toEqual({ strong: 40, concern: 20 })
    expect(stats.pillarBands.unity).toEqual({ needs_work: 60 })
    expect(stats.shares).toBe(9)
    expect(stats.sources[0]).toEqual({ source: 'catholicmarriagelife.com', visitors: 70 })
  })
})
