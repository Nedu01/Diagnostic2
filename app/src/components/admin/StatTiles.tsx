import type { AdminStats } from '../../lib/adminApi'

const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`)

export default function StatTiles({ funnel }: { funnel: AdminStats['funnel'] }) {
  const tiles = [
    { label: 'Visitors', value: funnel.visitors, rate: null as string | null },
    { label: 'Started', value: funnel.starts, rate: pct(funnel.startRate) },
    { label: 'Completed', value: funnel.completions, rate: pct(funnel.completionRate) },
    { label: 'Opted in', value: funnel.optIns, rate: pct(funnel.optInRate) },
  ]
  return (
    <section className="admin-tiles" aria-label="Funnel">
      {tiles.map((t) => (
        <div key={t.label} className="admin-tile">
          <p className="admin-tile-value">{t.value}</p>
          <p className="admin-tile-label">
            {t.label}
            {t.rate !== null && <span className="admin-tile-rate"> · {t.rate}</span>}
          </p>
        </div>
      ))}
    </section>
  )
}
