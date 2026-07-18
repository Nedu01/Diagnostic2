import type { AdminLead } from '../../lib/adminApi'

export default function LeadsTable({ leads }: { leads: AdminLead[] }) {
  return (
    <section aria-label="Recent leads">
      <h2>Recent leads</h2>
      {leads.length === 0 ? (
        <p>No subscribers yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Date</th>
                <th>Score</th>
                <th>Band</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{l.firstName ?? '—'}</td>
                  <td>{l.email}</td>
                  <td>{new Date(l.registeredAt).toLocaleDateString()}</td>
                  <td>{l.scoreTotal ?? '—'}</td>
                  <td>{l.overallBand ?? '—'}</td>
                  <td>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      Open in Systeme
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
