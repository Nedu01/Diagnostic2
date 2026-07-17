import { describe, expect, it } from 'vitest'
import { computeResult, toBandsResult } from './scoring'
import { decodeAnswers, decodeBands, encodeAnswers, encodeBands } from './resultCode'
import type { Answers, AnswerValue } from './types'

const randomAnswers = (seed: number): Answers => {
  // Deterministic LCG so failures are reproducible.
  let s = seed
  return Array.from({ length: 20 }, () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return (s % 3) as AnswerValue
  })
}

describe('full result code', () => {
  it('round-trips 1000 answer sets', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const answers = randomAnswers(seed)
      const code = encodeAnswers(answers, 1)
      expect(code).toHaveLength(8)
      expect(decodeAnswers(code)).toEqual({ version: 1, answers })
    }
  })

  it.each([
    [new Array(20).fill(0) as Answers],
    [new Array(20).fill(1) as Answers],
    [new Array(20).fill(2) as Answers],
  ])('round-trips uniform answers %#', (answers) => {
    expect(decodeAnswers(encodeAnswers(answers, 1))?.answers).toEqual(answers)
  })

  it('rejects wrong length, bad charset, corruption, and unknown version', () => {
    const code = encodeAnswers(randomAnswers(42), 1)
    expect(decodeAnswers('')).toBeNull()
    expect(decodeAnswers(code.slice(0, 7))).toBeNull()
    expect(decodeAnswers(code + 'A')).toBeNull()
    expect(decodeAnswers('!' + code.slice(1))).toBeNull()
    const flipped = (code[7] === 'A' ? 'B' : 'A') + '' // corrupt checksum char
    expect(decodeAnswers(code.slice(0, 7) + flipped)).toBeNull()
    expect(decodeAnswers(encodeAnswers(randomAnswers(7), 99))).toBeNull()
  })

  it('rejects invalid input to encode', () => {
    expect(() => encodeAnswers([1, 2] as Answers, 1)).toThrow()
    expect(() => encodeAnswers(new Array(20).fill(5) as Answers, 1)).toThrow()
  })
})

describe('share (bands-only) code', () => {
  it('round-trips bands derived from results', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const bands = toBandsResult(computeResult(randomAnswers(seed)))
      const code = encodeBands(bands, 1)
      expect(code).toHaveLength(6)
      expect(decodeBands(code)).toEqual({ version: 1, bands })
    }
  })

  it('never contains recoverable answers (distinct answer sets, same bands, same code)', () => {
    const a: Answers = [2, 2, 2, 1, ...new Array(16).fill(1)] as Answers
    const b: Answers = [1, 2, 2, 2, ...new Array(16).fill(1)] as Answers
    const bandsA = toBandsResult(computeResult(a))
    const bandsB = toBandsResult(computeResult(b))
    expect(bandsA).toEqual(bandsB)
    expect(encodeBands(bandsA, 1)).toBe(encodeBands(bandsB, 1))
  })

  it('rejects corruption and unknown versions', () => {
    const bands = toBandsResult(computeResult(randomAnswers(3)))
    const code = encodeBands(bands, 1)
    expect(decodeBands(code.slice(0, 5))).toBeNull()
    expect(decodeBands('!' + code.slice(1))).toBeNull()
    expect(decodeBands(encodeBands(bands, 42))).toBeNull()
  })
})
