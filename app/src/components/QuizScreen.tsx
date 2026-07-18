import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { config } from '../lib/config'
import { encodeAnswers } from '../lib/resultCode'
import { track } from '../lib/analytics'
import type { Answers, AnswerValue } from '../lib/types'
import { useDiagnostic, isComplete } from '../state/useDiagnostic'
import ProgressBar from './ProgressBar'
import QuestionCard from './QuestionCard'

const ADVANCE_DELAY_MS = 350

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function QuizScreen() {
  const navigate = useNavigate()
  const { answers, currentIndex, answer, goTo } = useDiagnostic()
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const question = config.questions[currentIndex]
  const total = config.questions.length
  const isLast = currentIndex === total - 1
  const wasAnswered = answers[currentIndex] !== null
  const startedTracked = useRef(false)

  useEffect(() => () => clearTimeout(advanceTimer.current ?? undefined), [])

  // Production traffic often lands directly on /quiz (WordPress button links
  // here), bypassing WelcomeScreen's track('diagnostic_started'). Fire it
  // here too so direct entries are counted; double-firing for welcome-path
  // visitors is fine since the funnel counts distinct visitors.
  useEffect(() => {
    if (!startedTracked.current) {
      startedTracked.current = true
      track('diagnostic_started')
    }
  }, [])

  const finishOrAdvance = () => {
    const state = useDiagnostic.getState()
    if (isLast && isComplete(state.answers)) {
      const complete = state.answers as Answers
      const code = encodeAnswers(complete, config.meta.version)
      navigate(`/r/${code}`)
    } else {
      goTo(currentIndex + 1)
      window.scrollTo({ top: 0 })
    }
  }

  const handleSelect = (value: AnswerValue) => {
    const revisit = wasAnswered
    answer(currentIndex, value)
    track('question_answered', { question: currentIndex + 1 })
    if (!revisit) {
      // First answer auto-advances, like the original site.
      const delay = prefersReducedMotion() ? 0 : ADVANCE_DELAY_MS
      advanceTimer.current = setTimeout(finishOrAdvance, delay)
    }
  }

  return (
    <main className="container quiz">
      <ProgressBar current={currentIndex + 1} total={total} pillar={question.pillar} />
      <QuestionCard question={question} value={answers[currentIndex]} onSelect={handleSelect} />
      <div className="question-nav">
        <button
          type="button"
          className="btn-prev"
          onClick={() => goTo(currentIndex - 1)}
          style={{ visibility: currentIndex > 0 ? 'visible' : 'hidden' }}
        >
          Previous
        </button>
        {wasAnswered && (
          <button type="button" className="btn-primary btn-next" onClick={finishOrAdvance}>
            {isLast ? 'See my results' : 'Next question'}
          </button>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        Question {currentIndex + 1} of {total}
      </p>
    </main>
  )
}
