import type { Answers, AnswerValue, BandKey, BandsResult, OverallKey, Pillar } from './types'

/**
 * Two URL-safe result codes, no dependencies:
 *
 * Full code (private, /r/:code) — 6 bytes → 8 base64url chars:
 *   [version][N as big-endian uint32][checksum]
 *   where N = Σ answers[i] * 3^i (20 answers in {0,1,2}; 3^20 < 2^32).
 *
 * Share code (public, /s/:code) — 4 bytes → 6 base64url chars:
 *   [version][b0][b1][checksum]
 *   where b0/b1 pack six 2-bit band indices (overall + five pillars in
 *   config pillar order). Carries no per-question answers by construction.
 */

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const SUPPORTED_VERSIONS = new Set([1])
const QUESTION_COUNT = 20
const MAX_N = 3 ** QUESTION_COUNT

const OVERALL_KEYS: OverallKey[] = ['strong', 'good', 'gaps', 'concern']
const BAND_KEYS: BandKey[] = ['strong', 'solid', 'needs_work', 'concern']
const PILLARS: Pillar[] = ['Clarity', 'Freedom', 'Capacity', 'Intention', 'Unity']

function toBase64url(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += B64URL[b0 >> 2]
    out += B64URL[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)]
    if (b1 !== undefined) out += B64URL[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)]
    if (b2 !== undefined) out += B64URL[b2 & 63]
  }
  return out
}

function fromBase64url(code: string, byteLength: number): number[] | null {
  const sextets: number[] = []
  for (const ch of code) {
    const v = B64URL.indexOf(ch)
    if (v === -1) return null
    sextets.push(v)
  }
  const bytes: number[] = []
  for (let i = 0; i < sextets.length; i += 4) {
    const s = sextets.slice(i, i + 4)
    if (s.length >= 2) bytes.push((s[0] << 2) | (s[1] >> 4))
    if (s.length >= 3) bytes.push(((s[1] & 15) << 4) | (s[2] >> 2))
    if (s.length === 4) bytes.push(((s[2] & 3) << 6) | s[3])
  }
  return bytes.length === byteLength ? bytes : null
}

function checksum(bytes: number[]): number {
  return bytes.reduce((a, b) => a + b, 0) % 256
}

export function encodeAnswers(answers: Answers, version: number): string {
  if (answers.length !== QUESTION_COUNT || answers.some((a) => a < 0 || a > 2)) {
    throw new Error('encodeAnswers: expected 20 answers in {0,1,2}')
  }
  let n = 0
  for (let i = QUESTION_COUNT - 1; i >= 0; i--) n = n * 3 + answers[i]
  const view = new DataView(new ArrayBuffer(4))
  view.setUint32(0, n)
  const body = [version, view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)]
  return toBase64url([...body, checksum(body)])
}

export function decodeAnswers(code: string): { version: number; answers: Answers } | null {
  if (code.length !== 8) return null
  const bytes = fromBase64url(code, 6)
  if (!bytes) return null
  const body = bytes.slice(0, 5)
  if (checksum(body) !== bytes[5]) return null
  const [version, ...nBytes] = body
  if (!SUPPORTED_VERSIONS.has(version)) return null
  const view = new DataView(new ArrayBuffer(4))
  nBytes.forEach((b, i) => view.setUint8(i, b))
  let n = view.getUint32(0)
  if (n >= MAX_N) return null
  const answers: AnswerValue[] = []
  for (let i = 0; i < QUESTION_COUNT; i++) {
    answers.push((n % 3) as AnswerValue)
    n = Math.floor(n / 3)
  }
  return { version, answers }
}

export function encodeBands(bands: BandsResult, version: number): string {
  const indices = [
    OVERALL_KEYS.indexOf(bands.overall),
    ...PILLARS.map((p) => BAND_KEYS.indexOf(bands.pillars[p])),
  ]
  if (indices.some((i) => i === -1)) throw new Error('encodeBands: unknown band key')
  const b0 = (indices[0] << 6) | (indices[1] << 4) | (indices[2] << 2) | indices[3]
  const b1 = (indices[4] << 6) | (indices[5] << 4)
  const body = [version, b0, b1]
  return toBase64url([...body, checksum(body)])
}

export function decodeBands(code: string): { version: number; bands: BandsResult } | null {
  if (code.length !== 6) return null
  const bytes = fromBase64url(code, 4)
  if (!bytes) return null
  const body = bytes.slice(0, 3)
  if (checksum(body) !== bytes[3]) return null
  const [version, b0, b1] = body
  if (!SUPPORTED_VERSIONS.has(version)) return null
  if ((b1 & 15) !== 0) return null
  const indices = [b0 >> 6, (b0 >> 4) & 3, (b0 >> 2) & 3, b0 & 3, b1 >> 6, (b1 >> 4) & 3]
  return {
    version,
    bands: {
      overall: OVERALL_KEYS[indices[0]],
      pillars: Object.fromEntries(
        PILLARS.map((p, i) => [p, BAND_KEYS[indices[i + 1]]]),
      ) as BandsResult['pillars'],
    },
  }
}
