import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DashboardData } from '../../lib/adminApi'
import AdminScreen from './AdminScreen'

const happyData: DashboardData = {
  period: '30d',
  stats: {
    funnel: {
      visitors: 100, starts: 80, completions: 60, optIns: 15,
      startRate: 0.8, completionRate: 0.75, optInRate: 0.25,
    },
    dropoff: [
      { question: 1, visitors: 80 },
      { question: 2, visitors: 74 },
    ],
    overallBands: { strong: 35, gaps: 25 },
    pillarBands: { clarity: { strong: 40 }, unity: { needs_work: 60 } },
    shares: 9,
    sources: [{ source: 'catholicmarriagelife.com', visitors: 70 }],
  },
  leads: [
    {
      id: 2, email: 'ada@example.com', firstName: 'Ada',
      registeredAt: '2026-07-15T00:00:00+00:00', scoreTotal: '37', overallBand: 'strong',
      pillarBands: { clarity: 'strong', freedom: 'solid', capacity: 'strong', intention: 'strong', unity: 'needs_work' },
      tags: ['diagnostic-completed'], url: 'https://systeme.io/dashboard/contacts/2',
    },
  ],
}

const { fetchDashboard } = vi.hoisted(() => ({ fetchDashboard: vi.fn() }))
vi.mock('../../lib/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/adminApi')>()),
  fetchDashboard,
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('AdminScreen', () => {
  it('shows the login form when there is no token', () => {
    render(<AdminScreen />)
    expect(screen.getByLabelText('Admin password')).toBeInTheDocument()
  })

  it('renders tiles, patterns, sources, and leads when data loads', async () => {
    localStorage.setItem('admin-token', 'tok')
    fetchDashboard.mockResolvedValue(happyData)
    render(<AdminScreen />)
    expect(await screen.findByText('100')).toBeInTheDocument() // visitors tile
    expect(screen.getByText(/80%/)).toBeInTheDocument() // start rate
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('catholicmarriagelife.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open in systeme/i })).toHaveAttribute(
      'href',
      'https://systeme.io/dashboard/contacts/2',
    )
  })

  it('shows independent error banners when a source fails', async () => {
    localStorage.setItem('admin-token', 'tok')
    fetchDashboard.mockResolvedValue({ period: '30d', stats: { error: true }, leads: { error: true } })
    render(<AdminScreen />)
    expect(await screen.findByText(/activity stats are unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/leads are unavailable/i)).toBeInTheDocument()
  })

  it('falls back to the login form when the token is rejected', async () => {
    localStorage.setItem('admin-token', 'expired')
    fetchDashboard.mockRejectedValue(new Error('unauthorized'))
    render(<AdminScreen />)
    expect(await screen.findByLabelText('Admin password')).toBeInTheDocument()
  })

  it('reloads when the period changes', async () => {
    localStorage.setItem('admin-token', 'tok')
    fetchDashboard.mockResolvedValue(happyData)
    render(<AdminScreen />)
    await screen.findByText('100')
    await userEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(fetchDashboard).toHaveBeenLastCalledWith('7d')
  })
})
