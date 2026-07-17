interface Props {
  current: number // 1-based
  total: number
  pillar: string
}

export default function ProgressBar({ current, total, pillar }: Props) {
  return (
    <div className="progress-container">
      <div className="progress-meta">
        <span>
          Question {current} of {total}
        </span>
        <span className="pillar-label">{pillar}</span>
      </div>
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={`Question ${current} of ${total}`}
      >
        <div className="progress-fill" style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  )
}
