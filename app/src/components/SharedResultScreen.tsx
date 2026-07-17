import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { config } from '../lib/config'
import { decodeBands } from '../lib/resultCode'
import { resolveBand } from '../lib/scoring'
import type { Pillar } from '../lib/types'
import PillarChips, { type PillarBands } from './PillarChips'

export default function SharedResultScreen() {
  const { code = '' } = useParams()
  const decoded = useMemo(() => decodeBands(code), [code])

  if (!decoded) {
    return (
      <main className="container center">
        <h1>This link isn&rsquo;t valid</h1>
        <p>It may have been mistyped or shortened.</p>
        <Link className="btn-primary" to="/">
          Take the diagnostic
        </Link>
      </main>
    )
  }

  const overall = config.scoring.overallBands.find((b) => b.key === decoded.bands.overall)
  const pillarBands = Object.fromEntries(
    config.pillars.map((p) => {
      const key = decoded.bands.pillars[p as Pillar]
      const band = config.scoring.pillarBands.find((b) => b.key === key)
      return [p, band ?? resolveBand(0, config.scoring.pillarBands)]
    }),
  ) as unknown as PillarBands

  return (
    <main className="container results shared">
      <h1>{config.meta.title}</h1>
      <p className="subtitle">Someone shared their readiness summary with you.</p>
      {overall && <div className="score-band shared-band">{overall.label}</div>}
      <PillarChips bands={pillarBands} />
      <p className="welcome-para">
        {config.meta.shareText} It asks twenty honest questions across the Five Pillars of Valid
        Consent — {config.pillars.join(', ')} — and takes about five minutes.
      </p>
      <div className="center">
        <Link className="btn-primary" to="/">
          Take the diagnostic yourself
        </Link>
      </div>
    </main>
  )
}
