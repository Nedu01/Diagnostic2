import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { config } from '../lib/config'
import { decodeAnswers, encodeBands } from '../lib/resultCode'
import { computeResult, toBandsResult } from '../lib/scoring'
import { track } from '../lib/analytics'
import { useDiagnostic } from '../state/useDiagnostic'
import ScoreHeadline from './ScoreHeadline'
import PillarChips, { type PillarBands } from './PillarChips'
import EmailGate from './EmailGate'
import FullReport from './FullReport'
import ShareButton from './ShareButton'

export default function ResultsScreen() {
  const { code = '' } = useParams()
  const unlocked = useDiagnostic((s) => s.unlocked)
  const unlock = useDiagnostic((s) => s.unlock)
  const decoded = useMemo(() => decodeAnswers(code), [code])
  const completedTracked = useRef(false)

  const result = useMemo(() => (decoded ? computeResult(decoded.answers) : null), [decoded])

  useEffect(() => {
    if (result && !completedTracked.current) {
      completedTracked.current = true
      track('diagnostic_completed', { band: result.overall.key })
    }
  }, [result])

  if (!decoded || !result) {
    return (
      <main className="container center">
        <h1>This results link isn&rsquo;t valid</h1>
        <p>It may have been mistyped or shortened. The diagnostic itself takes about five minutes.</p>
        <Link className="btn-primary" to="/">
          Take the diagnostic
        </Link>
      </main>
    )
  }

  const shareCode = encodeBands(toBandsResult(result), config.meta.version)
  const pillarBands = Object.fromEntries(
    Object.entries(result.pillars).map(([p, r]) => [p, r.band]),
  ) as unknown as PillarBands

  return (
    <main className="container results">
      <h1>Your Marriage Readiness Report</h1>
      <p className="subtitle">A pillar-by-pillar reading of where you stand today.</p>
      <ScoreHeadline result={result} />
      <PillarChips bands={pillarBands} />

      {unlocked ? (
        <FullReport result={result} />
      ) : (
        <EmailGate
          code={code}
          onUnlocked={() => {
            unlock()
            track('report_unlocked', { band: result.overall.key })
          }}
        />
      )}

      <ShareButton shareCode={shareCode} />
      <p className="retake center">
        <Link to="/">Retake the diagnostic</Link>
      </p>
    </main>
  )
}
