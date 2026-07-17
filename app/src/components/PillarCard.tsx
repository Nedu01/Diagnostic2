import { config } from '../lib/config'
import type { BandKey, Pillar, PillarResult } from '../lib/types'

const BAND_CLASS: Record<BandKey, string> = {
  strong: 'strong',
  solid: 'solid',
  needs_work: 'needs-work',
  concern: 'concern',
}

interface Props {
  pillar: Pillar
  result: PillarResult
  feedback: string
}

export default function PillarCard({ pillar, result, feedback }: Props) {
  return (
    <article className={`pillar-card ${BAND_CLASS[result.band.key]}`}>
      <div className="pillar-card-header">
        <span className="pillar-name">Pillar of {pillar}</span>
        <span className="pillar-score">
          {result.score} / {config.scoring.perPillarMax}
        </span>
      </div>
      <span className="pillar-status">{result.band.label}</span>
      <p className="pillar-feedback">{feedback}</p>
    </article>
  )
}
