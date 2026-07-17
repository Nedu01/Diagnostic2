import type { ScaleOption } from '../lib/types'

interface Props {
  option: ScaleOption
  selected: boolean
  onSelect: () => void
}

export default function AnswerOption({ option, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`response-btn${selected ? ' selected' : ''}`}
      onClick={onSelect}
    >
      <span className="label">{option.label}</span>
      {option.text}
    </button>
  )
}
