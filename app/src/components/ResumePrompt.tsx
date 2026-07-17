interface Props {
  onResume: () => void
  onRestart: () => void
}

export default function ResumePrompt({ onResume, onRestart }: Props) {
  return (
    <div className="resume-prompt" role="region" aria-label="Resume your diagnostic">
      <p>You have a diagnostic in progress.</p>
      <div className="center">
        <button className="btn-primary" onClick={onResume}>
          Continue where I left off
        </button>
      </div>
      <div className="center">
        <button className="btn-link" onClick={onRestart}>
          Start over instead
        </button>
      </div>
    </div>
  )
}
