import type { QueryFn } from './db'

export type Period = '7d' | '30d' | 'all'

export interface Stats {
  funnel: {
    visitors: number
    starts: number
    completions: number
    optIns: number
    startRate: number | null
    completionRate: number | null
    optInRate: number | null
  }
  dropoff: { question: number; visitors: number }[]
  overallBands: Record<string, number>
  pillarBands: Record<string, Record<string, number>>
  shares: number
  sources: { source: string; visitors: number }[]
}

/** Safe to interpolate: values are fixed per enum key, never user input. */
const SINCE: Record<Period, string> = {
  '7d': "now() - interval '7 days'",
  '30d': "now() - interval '30 days'",
  all: "'epoch'::timestamptz",
}

const rate = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null)

export async function getStats(q: QueryFn, period: Period): Promise<Stats> {
  const since = SINCE[period]
  const uniqByName = async (name: string) =>
    Number(
      (
        await q(
          `select count(distinct visitor_id) as n from events where name = $1 and happened_at >= ${since}`,
          [name],
        )
      )[0]?.n ?? 0,
    )

  const [visitorRows, starts, completions, optIns, dropoffRows, overallRows, pillarRows, shareRows, sourceRows] =
    await Promise.all([
      q(`select count(distinct visitor_id) as n from events where happened_at >= ${since}`),
      uniqByName('diagnostic_started'),
      uniqByName('diagnostic_completed'),
      uniqByName('report_unlocked'),
      q(
        `select (props->>'question')::int as question, count(distinct visitor_id) as visitors
         from events where name = 'question_answered' and happened_at >= ${since}
         group by 1 order by 1`,
      ),
      q(
        `select props->>'band' as band, count(distinct visitor_id) as n
         from events where name = 'diagnostic_completed' and happened_at >= ${since}
         group by 1`,
      ),
      q(
        `select k.pillar as pillar, e.props->>k.pillar as band, count(distinct e.visitor_id) as n
         from events e,
              unnest(array['clarity','freedom','capacity','intention','unity']) as k(pillar)
         where e.name = 'diagnostic_completed' and e.happened_at >= ${since}
         group by 1, 2`,
      ),
      q(`select count(*) as n from events where name = 'result_shared' and happened_at >= ${since}`),
      q(
        `select coalesce(nullif(props->>'source', ''), 'direct') as source,
                count(distinct visitor_id) as visitors
         from events where name = 'visit' and happened_at >= ${since}
         group by 1 order by 2 desc limit 10`,
      ),
    ])

  const visitors = Number(visitorRows[0]?.n ?? 0)

  const overallBands: Record<string, number> = {}
  for (const r of overallRows) overallBands[String(r.band)] = Number(r.n)

  const pillarBands: Record<string, Record<string, number>> = {}
  for (const r of pillarRows) {
    const pillar = String(r.pillar)
    pillarBands[pillar] = pillarBands[pillar] ?? {}
    pillarBands[pillar][String(r.band)] = Number(r.n)
  }

  return {
    funnel: {
      visitors,
      starts,
      completions,
      optIns,
      startRate: rate(starts, visitors),
      completionRate: rate(completions, starts),
      optInRate: rate(optIns, completions),
    },
    dropoff: dropoffRows.map((r) => ({ question: Number(r.question), visitors: Number(r.visitors) })),
    overallBands,
    pillarBands,
    shares: Number(shareRows[0]?.n ?? 0),
    sources: sourceRows.map((r) => ({ source: String(r.source), visitors: Number(r.visitors) })),
  }
}
