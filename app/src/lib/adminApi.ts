export type Period = '7d' | '30d' | 'all'

export interface AdminStats {
  funnel: {
    visitors: number
    starts: number
    completions: number
    optIns: number
    startRate: number | null
    completionRate: number | null
    optInRate: number | null
  }
  dropoff: { question: number; visitors: number }[]
  overallBands: Record<string, number>
  pillarBands: Record<string, Record<string, number>>
  shares: number
  sources: { source: string; visitors: number }[]
}

export interface AdminLead {
  id: number
  email: string
  firstName: string | null
  registeredAt: string
  scoreTotal: string | null
  overallBand: string | null
  pillarBands: Record<string, string | null>
  tags: string[]
  url: string
}

export interface DashboardData {
  period: Period
  stats: AdminStats | { error: true }
  leads: AdminLead[] | { error: true }
}

const TOKEN_KEY = 'admin-token'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY)

export type LoginResult = 'ok' | 'wrong_password' | 'rate_limited' | 'error'

export async function login(password: string): Promise<LoginResult> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (res.status === 401) return 'wrong_password'
  if (res.status === 429) return 'rate_limited'
  if (!res.ok) return 'error'
  const data = (await res.json()) as { token?: string }
  if (!data.token) return 'error'
  localStorage.setItem(TOKEN_KEY, data.token)
  return 'ok'
}

export async function fetchDashboard(period: Period): Promise<DashboardData> {
  const res = await fetch(`/api/admin/stats?period=${period}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(`dashboard request failed: ${res.status}`)
  return (await res.json()) as DashboardData
}
