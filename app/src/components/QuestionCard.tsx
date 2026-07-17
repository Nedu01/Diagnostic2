import { config } from '../lib/config'
import type { AnswerValue, Question } from '../lib/types'
import AnswerOption from './AnswerOption'

interface Props {
  question: Question
  value: AnswerValue | null
  onSelect: (value: AnswerValue) => void
}

export default function QuestionCard({ question, value, onSelect }: Props) {
  return (
    <div>
      <p className="question-text">{question.text}</p>
      <div className="response-options" role="radiogroup" aria-label="Your answer">
        {config.scale.options.map((option) => (
          <AnswerOption
            key={option.value}
            option={option}
            selected={value === option.value}
            onSelect={() => onSelect(option.value)}
          />
        ))}
      </div>
    </div>
  )
}
