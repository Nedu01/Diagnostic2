import type { Answers, AnswerValue } from '../../src/lib/types'

/**
 * Self-contained copy of decodeAnswers from src/lib/resultCode.ts for the
 * CommonJS api/ scope — importing the ESM-compiled src module from these
 * functions crashes on Vercel (ERR_REQUIRE_ESM). Keep in sync with src.
 *
 * Full code (private, /r/:code) — 6 bytes → 8 base64url chars:
 *   [version][N as big-endian uint32][checksum]
 *   where N = Σ answers[i] * 3^i (20 answers in {0,1,2}; 3^20 < 2^32).
 */

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const SUPPORTED_VERSIONS = new Set([1])
const QUESTION_COUNT = 20
const MAX_N = 3 ** QUESTION_COUNT

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
