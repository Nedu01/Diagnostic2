import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '../lib/config'
import type { AnswerValue } from '../lib/types'

const QUESTION_COUNT = config.questions.length

interface DiagnosticState {
  answers: (AnswerValue | null)[]
  currentIndex: number
  unlocked: boolean
  answer: (index: number, value: AnswerValue) => void
  goTo: (index: number) => void
  reset: () => void
  unlock: () => void
}

const emptyAnswers = () => new Array<AnswerValue | null>(QUESTION_COUNT).fill(null)

export const useDiagnostic = create<DiagnosticState>()(
  persist(
    (set) => ({
      answers: emptyAnswers(),
      currentIndex: 0,
      unlocked: false,
      answer: (index, value) =>
        set((s) => {
          const answers = [...s.answers]
          answers[index] = value
          return { answers }
        }),
      goTo: (index) =>
        set(() => ({ currentIndex: Math.max(0, Math.min(QUESTION_COUNT - 1, index)) })),
      reset: () => set({ answers: emptyAnswers(), currentIndex: 0 }),
      unlock: () => set({ unlocked: true }),
    }),
    { name: `cml-diag:v${config.meta.version}` },
  ),
)

export const hasProgress = (answers: (AnswerValue | null)[]) =>
  answers.some((a) => a !== null) && answers.some((a) => a === null)

export const isComplete = (answers: (AnswerValue | null)[]) => answers.every((a) => a !== null)
