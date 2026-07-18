import { createHmac, timingSafeEqual } from 'node:crypto'

const THIRTY_DAYS_S = 30 * 24 * 60 * 60

const hmac = (secret: string, data: string): string =>
  createHmac('sha256', secret).update(data).digest('base64url')

export function signToken(secret: string, nowMs = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(nowMs / 1000) + THIRTY_DAYS_S }),
  ).toString('base64url')
  return `${payload}.${hmac(secret, payload)}`
}

export function verifyToken(secret: string, token: string, nowMs = Date.now()): boolean {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  if (!safeEqual(sig, hmac(secret, payload))) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number }
    return typeof exp === 'number' && exp * 1000 > nowMs
  } catch {
    return false
  }
}

/** Constant-time string comparison (length leak is acceptable). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function bearerToken(header: string | undefined): string | null {
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}
