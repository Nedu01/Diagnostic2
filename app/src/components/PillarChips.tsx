import { config } from '../lib/config'
import type { BandKey, Pillar } from '../lib/types'

const BAND_CLASS: Record<BandKey, string> = {
  strong: 'strong',
  solid: 'solid',
  needs_work: 'needs-work',
  concern: 'concern',
}

export type PillarBands = Record<Pillar, { key: BandKey; label: string }>

interface Props {
  bands: PillarBands
}

export default function PillarChips({ bands }: Props) {
  return (
    <ul className="pillar-chips" aria-label="Pillar results">
      {config.pillars.map((pillar) => {
        const band = bands[pillar]
        return (
          <li key={pillar} className={`pillar-chip ${BAND_CLASS[band.key]}`}>
            <span className="chip-pillar">{pillar}</span>
            <span className="chip-band">{band.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
