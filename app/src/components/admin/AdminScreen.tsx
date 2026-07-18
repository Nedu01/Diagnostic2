import { useCallback, useEffect, useState } from 'react'
import {
  fetchDashboard,
  getToken,
  type DashboardData,
  type Period,
} from '../../lib/adminApi'
import AdminLogin from './AdminLogin'
import StatTiles from './StatTiles'
import DropoffBars from './DropoffBars'
import ResultPatterns from './ResultPatterns'
import SourcesShares from './SourcesShares'
import LeadsTable from './LeadsTable'
import '../../styles/admin.css'

const PERIOD_LABEL: Record<Period, string> = { '7d': '7 days', '30d': '30 days', all: 'All time' }

export default function AdminScreen() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))
  const [period, setPeriod] = useState<Period>('30d')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: Period) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchDashboard(p))
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized') setAuthed(false)
      else setError('Could not load the dashboard. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) void load(period)
  }, [authed, period, load])

  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />

  return (
    <main className="admin">
      <header className="admin-header">
        <h1>Diagnostic dashboard</h1>
        <div role="group" aria-label="Period">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              className={p === period ? 'admin-period active' : 'admin-period'}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </header>
      {loading && <p>Loading…</p>}
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {data && (
        <>
          {'error' in data.stats ? (
            <p role="alert" className="admin-error">
              Activity stats are unavailable right now.
            </p>
          ) : (
            <>
              <StatTiles funnel={data.stats.funnel} />
              <DropoffBars dropoff={data.stats.dropoff} />
              <ResultPatterns overall={data.stats.overallBands} pillars={data.stats.pillarBands} />
              <SourcesShares sources={data.stats.sources} shares={data.stats.shares} />
            </>
          )}
          {Array.isArray(data.leads) ? (
            <LeadsTable leads={data.leads} />
          ) : (
            <p role="alert" className="admin-error">
              Leads are unavailable right now.
            </p>
          )}
        </>
      )}
    </main>
  )
}
