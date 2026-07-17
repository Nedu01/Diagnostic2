import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { config } from '../lib/config'
import { encodeAnswers } from '../lib/resultCode'
import { useDiagnostic } from '../state/useDiagnostic'
import ResultsScreen from './ResultsScreen'
import type { Answers } from '../lib/types'

const renderWithCode = (code: string) =>
  render(
    <MemoryRouter initialEntries={[`/r/${code}`]}>
      <Routes>
        <Route path="/r/:code" element={<ResultsScreen />} />
        <Route path="/" element={<p>welcome</p>} />
      </Routes>
    </MemoryRouter>,
  )

const allOnes = new Array(20).fill(1) as Answers // total 20 → gaps, all pillars needs_work

describe('ResultsScreen gating', () => {
  beforeEach(() => {
    localStorage.clear()
    useDiagnostic.setState({ unlocked: false })
    vi.restoreAllMocks()
  })

  it('shows free summary but no feedback paragraphs while locked', () => {
    renderWithCode(encodeAnswers(allOnes, config.meta.version))
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText(config.scoring.overallBands.find((b) => b.key === 'gaps')!.label)).toBeInTheDocument()
    expect(screen.getAllByText('Needs Work')).toHaveLength(5)
    // No gated copy visible
    expect(screen.queryByText(config.overallFeedback.gaps)).not.toBeInTheDocument()
    expect(screen.queryByText(config.pillarFeedback.Clarity.needs_work)).not.toBeInTheDocument()
    // Share is available while locked
    expect(screen.getByText(/share this diagnostic/i)).toBeInTheDocument()
  })

  it('unlocks the full report after successful email submit', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    renderWithCode(encodeAnswers(allOnes, config.meta.version))
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /unlock my full report/i }))
    expect(await screen.findByText(config.overallFeedback.gaps)).toBeInTheDocument()
    expect(screen.getByText(config.pillarFeedback.Unity.needs_work)).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/subscribe',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('keeps summary and share after "no thanks", with gate re-openable', async () => {
    const user = userEvent.setup()
    renderWithCode(encodeAnswers(allOnes, config.meta.version))
    await user.click(screen.getByRole('button', { name: /no thanks/i }))
    expect(screen.queryByText(config.overallFeedback.gaps)).not.toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText(/share this diagnostic/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unlock your full pillar-by-pillar report/i })).toBeInTheDocument()
  })

  it('shows inline error and stays locked when subscribe fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 502 }))
    renderWithCode(encodeAnswers(allOnes, config.meta.version))
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /unlock my full report/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i)
    expect(screen.queryByText(config.overallFeedback.gaps)).not.toBeInTheDocument()
  })

  it('renders a friendly fallback for invalid codes', () => {
    renderWithCode('AAAAAAAA')
    expect(screen.getByText(/isn.t valid/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /take the diagnostic/i })).toBeInTheDocument()
  })
})
