import { describe, expect, it } from 'vitest'
import { config } from './config'
import { computeResult, getOverallFeedback, getPillarFeedback, resolveBand } from './scoring'
import type { Answers, AnswerValue, Pillar } from './types'

const answersWithTotal = (total: number): Answers => {
  // Distribute `total` across 20 answers using 2s then a remainder.
  const answers: AnswerValue[] = new Array(20).fill(0)
  let remaining = total
  for (let i = 0; i < 20 && remaining > 0; i++) {
    const v = Math.min(2, remaining) as AnswerValue
    answers[i] = v
    remaining -= v
  }
  return answers
}

describe('config invariants', () => {
  it('has 20 questions, 4 per pillar, ids 1..20 in order', () => {
    expect(config.questions).toHaveLength(20)
    expect(config.questions.map((q) => q.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
    for (const pillar of config.pillars) {
      expect(config.questions.filter((q) => q.pillar === pillar)).toHaveLength(4)
    }
  })

  it('bands are sorted by descending min and end at 0', () => {
    for (const bands of [config.scoring.pillarBands, config.scoring.overallBands]) {
      const mins = bands.map((b) => b.min)
      expect([...mins].sort((a, b) => b - a)).toEqual(mins)
      expect(mins[mins.length - 1]).toBe(0)
    }
  })

  it('has feedback copy for every band', () => {
    expect(Object.keys(config.overallFeedback).sort()).toEqual(
      ['concern', 'gaps', 'good', 'strong'].sort(),
    )
    for (const pillar of config.pillars) {
      expect(Object.keys(config.pillarFeedback[pillar]).sort()).toEqual(
        ['concern', 'needs_work', 'solid', 'strong'].sort(),
      )
    }
  })
})

describe('overall band parity with the live site (>=34 strong, >=26 good, >=18 gaps)', () => {
  const cases: Array<[number, string]> = [
    [40, 'strong'],
    [34, 'strong'],
    [33, 'good'],
    [26, 'good'],
    [25, 'gaps'],
    [18, 'gaps'],
    [17, 'concern'],
    [0, 'concern'],
  ]
  it.each(cases)('total %i → %s', (total, key) => {
    const result = computeResult(answersWithTotal(total))
    expect(result.total).toBe(total)
    expect(result.overall.key).toBe(key)
  })
})

describe('pillar band parity with the live site (>=7 strong, >=5 solid, >=3 needs_work)', () => {
  const cases: Array<[number, string]> = [
    [8, 'strong'],
    [7, 'strong'],
    [6, 'solid'],
    [5, 'solid'],
    [4, 'needs_work'],
    [3, 'needs_work'],
    [2, 'concern'],
    [0, 'concern'],
  ]
  it.each(cases)('pillar score %i → %s', (score, key) => {
    expect(resolveBand(score, config.scoring.pillarBands).key).toBe(key)
  })
})

describe('computeResult', () => {
  it('all 1s → total 20, overall gaps, every pillar 4/needs_work', () => {
    const result = computeResult(new Array(20).fill(1) as Answers)
    expect(result.total).toBe(20)
    expect(result.overall.key).toBe('gaps')
    for (const pillar of config.pillars) {
      expect(result.pillars[pillar].score).toBe(4)
      expect(result.pillars[pillar].band.key).toBe('needs_work')
    }
  })

  it('scores each pillar from only its own questions', () => {
    for (const pillar of config.pillars) {
      const answers = config.questions.map((q) => (q.pillar === pillar ? 2 : 0)) as Answers
      const result = computeResult(answers)
      expect(result.pillars[pillar].score).toBe(8)
      for (const other of config.pillars.filter((p) => p !== pillar)) {
        expect(result.pillars[other].score).toBe(0)
      }
    }
  })

  it('rejects wrong-length input', () => {
    expect(() => computeResult([1, 2] as Answers)).toThrow()
  })
})

describe('feedback lookups return the exact config paragraphs', () => {
  it('overall', () => {
    const result = computeResult(new Array(20).fill(2) as Answers)
    expect(getOverallFeedback(result)).toBe(config.overallFeedback.strong)
  })

  it('per pillar', () => {
    const result = computeResult(new Array(20).fill(0) as Answers)
    for (const pillar of config.pillars) {
      expect(getPillarFeedback(pillar as Pillar, result)).toBe(
        config.pillarFeedback[pillar].concern,
      )
    }
  })
})
