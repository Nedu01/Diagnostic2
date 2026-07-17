import { config } from '../lib/config'
import type { DiagnosticResult } from '../lib/types'

export default function ScoreHeadline({ result }: { result: DiagnosticResult }) {
  return (
    <div className="score-preview">
      <div className="score-total">
        {result.total}
        <span className="of-total"> / {config.scoring.totalMax}</span>
      </div>
      <div className="score-band">{result.overall.label}</div>
    </div>
  )
}
