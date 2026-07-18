import type { AdminStats } from '../../lib/adminApi'

export default function SourcesShares({
  sources,
  shares,
}: {
  sources: AdminStats['sources']
  shares: number
}) {
  return (
    <section aria-label="Traffic sources">
      <h2>Where visitors come from</h2>
      {sources.length === 0 ? (
        <p>No visits recorded yet.</p>
      ) : (
        <ul className="admin-inline-list">
          {sources.map((s) => (
            <li key={s.source}>
              <span>{s.source}</span>: <strong>{s.visitors}</strong>
            </li>
          ))}
        </ul>
      )}
      <p>
        Results shared: <strong>{shares}</strong>
      </p>
    </section>
  )
}
