import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { config } from '../lib/config'
import { useDiagnostic } from '../state/useDiagnostic'
import QuizScreen from './QuizScreen'
import type { AnswerValue } from '../lib/types'

const renderQuiz = () =>
  render(
    <MemoryRouter initialEntries={['/quiz']}>
      <Routes>
        <Route path="/quiz" element={<QuizScreen />} />
        <Route path="/r/:code" element={<p>results page</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('QuizScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    useDiagnostic.setState({
      answers: new Array<AnswerValue | null>(20).fill(null),
      currentIndex: 0,
      unlocked: false,
    })
  })

  it('auto-advances after the first answer', async () => {
    const user = userEvent.setup()
    renderQuiz()
    expect(screen.getByText(config.questions[0].text)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /yes,/i }))
    await waitFor(() => expect(screen.getByText(config.questions[1].text)).toBeInTheDocument())
  })

  it('does not auto-advance when revisiting; Next appears instead', async () => {
    const user = userEvent.setup()
    renderQuiz()
    await user.click(screen.getByRole('radio', { name: /yes,/i }))
    await waitFor(() => expect(screen.getByText(config.questions[1].text)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(screen.getByText(config.questions[0].text)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /not yet,/i }))
    // Still on question 1 (no auto-advance on revisit)
    expect(screen.getByText(config.questions[0].text)).toBeInTheDocument()
    expect(useDiagnostic.getState().answers[0]).toBe(1)
    await user.click(screen.getByRole('button', { name: /next question/i }))
    expect(screen.getByText(config.questions[1].text)).toBeInTheDocument()
  })

  it('navigates to results after the final answer', async () => {
    const user = userEvent.setup()
    useDiagnostic.setState({
      answers: [...(new Array(19).fill(2) as AnswerValue[]), null],
      currentIndex: 19,
      unlocked: false,
    })
    renderQuiz()
    expect(screen.getByText(config.questions[19].text)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /yes,/i }))
    await waitFor(() => expect(screen.getByText('results page')).toBeInTheDocument())
  })
})
