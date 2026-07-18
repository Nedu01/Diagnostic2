import type { AdminStats } from '../../lib/adminApi'

const BAND_LABEL: Record<string, string> = {
  strong: 'Strong', good: 'Good', solid: 'Solid',
  gaps: 'Gaps', needs_work: 'Needs work', concern: 'Concern',
}
const label = (k: string) => BAND_LABEL[k] ?? k

export default function ResultPatterns({
  overall,
  pillars,
}: {
  overall: AdminStats['overallBands']
  pillars: AdminStats['pillarBands']
}) {
  const weakest = Object.entries(pillars)
    .map(([pillar, bands]) => ({
      pillar,
      weak: (bands.needs_work ?? 0) + (bands.concern ?? 0),
    }))
    .sort((a, b) => b.weak - a.weak)
  return (
    <section aria-label="Result patterns">
      <h2>Result patterns</h2>
      <ul className="admin-inline-list">
        {Object.entries(overall).map(([band, n]) => (
          <li key={band}>
            <strong>{n}</strong> {label(band)}
          </li>
        ))}
      </ul>
      {weakest.length > 0 && (
        <>
          <h3>Weakest pillars</h3>
          <ol className="admin-inline-list">
            {weakest.map((w) => (
              <li key={w.pillar}>
                {w.pillar.charAt(0).toUpperCase() + w.pillar.slice(1)}: {w.weak} in need of work
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
