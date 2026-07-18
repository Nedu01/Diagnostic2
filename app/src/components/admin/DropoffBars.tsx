import type { AdminStats } from '../../lib/adminApi'

export default function DropoffBars({ dropoff }: { dropoff: AdminStats['dropoff'] }) {
  if (dropoff.length === 0) return null
  const max = Math.max(...dropoff.map((d) => d.visitors))
  return (
    <section aria-label="Question drop-off">
      <h2>Where people drop off</h2>
      <ol className="admin-bars">
        {dropoff.map((d) => (
          <li key={d.question}>
            <span className="admin-bar-label">Q{d.question}</span>
            <span
              className="admin-bar"
              style={{ width: `${max > 0 ? (d.visitors / max) * 100 : 0}%` }}
            />
            <span className="admin-bar-count">{d.visitors}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
