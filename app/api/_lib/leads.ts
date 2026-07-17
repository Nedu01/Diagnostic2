import type { DiagnosticResult } from '../../src/lib/types'

export interface Lead {
  email: string
  firstName?: string
  fields: Record<string, string | number>
  tags: string[]
}

export interface EmailMarketingAdapter {
  upsertLead(lead: Lead): Promise<void>
}

const kebab = (s: string) => s.toLowerCase().replace(/_/g, '-')

export function buildLead(
  email: string,
  firstName: string | undefined,
  result: DiagnosticResult,
): Lead {
  const pillarEntries = Object.entries(result.pillars)
  const fields: Record<string, string | number> = {
    score_total: result.total,
    overall_band: result.overall.key,
    source: 'diagnostic-webapp',
  }
  for (const [pillar, r] of pillarEntries) {
    fields[`${pillar.toLowerCase()}_band`] = r.band.key
  }
  const tags = [
    'diagnostic-completed',
    `band-${kebab(result.overall.key)}`,
    ...pillarEntries
      .filter(([, r]) => r.band.key === 'needs_work' || r.band.key === 'concern')
      .map(([pillar, r]) => `pillar-${pillar.toLowerCase()}-${kebab(r.band.key)}`),
  ]
  return { email, firstName, fields, tags }
}
