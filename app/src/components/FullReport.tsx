import { config } from '../lib/config'
import { getOverallFeedback, getPillarFeedback } from '../lib/scoring'
import type { DiagnosticResult } from '../lib/types'
import PillarCard from './PillarCard'

export default function FullReport({ result }: { result: DiagnosticResult }) {
  return (
    <section aria-label="Your full report">
      <div className="overall-feedback">
        <p>{getOverallFeedback(result)}</p>
      </div>
      <div className="pillars-detail">
        {config.pillars.map((pillar) => (
          <PillarCard
            key={pillar}
            pillar={pillar}
            result={result.pillars[pillar]}
            feedback={getPillarFeedback(pillar, result)}
          />
        ))}
      </div>
      <footer className="signature">
        <p>{config.meta.author}</p>
        <p>{config.meta.authorTitle}</p>
        <p className="motto">{config.meta.motto}</p>
      </footer>
    </section>
  )
}
