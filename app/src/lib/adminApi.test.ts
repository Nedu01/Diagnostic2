import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearToken, fetchDashboard, getToken, login } from './adminApi'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status })

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('login', () => {
  it('stores the token on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { ok: true, token: 'a.b' })))
    expect(await login('pw')).toBe('ok')
    expect(getToken()).toBe('a.b')
  })

  it('returns wrong_password and stores nothing on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { ok: false })))
    expect(await login('bad')).toBe('wrong_password')
    expect(getToken()).toBeNull()
  })

  it('returns rate_limited on 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, { ok: false })))
    expect(await login('pw')).toBe('rate_limited')
    expect(getToken()).toBeNull()
  })

  it('returns error on 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(502, {})))
    expect(await login('pw')).toBe('error')
    expect(getToken()).toBeNull()
  })
})

describe('fetchDashboard', () => {
  it('sends the bearer token and returns the payload', async () => {
    localStorage.setItem('admin-token', 'tok')
    const payload = { ok: true, period: '30d', stats: { error: true }, leads: [] }
    const mock = vi.fn().mockResolvedValue(jsonResponse(200, payload))
    vi.stubGlobal('fetch', mock)
    const data = await fetchDashboard('30d')
    expect(data.period).toBe('30d')
    const [url, init] = mock.mock.calls[0]
    expect(String(url)).toBe('/api/admin/stats?period=30d')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  it('clears the token and throws "unauthorized" on 401', async () => {
    localStorage.setItem('admin-token', 'expired')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { ok: false })))
    await expect(fetchDashboard('7d')).rejects.toThrow('unauthorized')
    expect(getToken()).toBeNull()
  })

  it('throws on other failures without clearing the token', async () => {
    localStorage.setItem('admin-token', 'tok')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(502, {})))
    await expect(fetchDashboard('7d')).rejects.toThrow()
    expect(getToken()).toBe('tok')
  })
})

describe('clearToken', () => {
  it('removes the stored token', () => {
    localStorage.setItem('admin-token', 'tok')
    clearToken()
    expect(getToken()).toBeNull()
  })
})
