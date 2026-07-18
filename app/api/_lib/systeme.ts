import type { EmailMarketingAdapter, Lead } from './leads'

const BASE = 'https://api.systeme.io/api'
const TIMEOUT_MS = 10_000

interface SystemeContact {
  id: number
}

interface SystemeTag {
  id: number
  name: string
}

/** name → id cache; survives warm serverless invocations. */
const tagIdCache = new Map<string, number>()

async function request(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
  contentType = 'application/json',
): Promise<Response> {
  const attempt = () =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        'X-API-Key': apiKey,
        ...(body !== undefined ? { 'Content-Type': contentType } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  let res = await attempt()
  if (res.status >= 500) res = await attempt() // one retry on 5xx
  return res
}

export class SystemeAdapter implements EmailMarketingAdapter {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async upsertLead(lead: Lead): Promise<void> {
    const contactId = await this.upsertContact(lead)
    for (const tag of lead.tags) {
      const tagId = await this.getOrCreateTagId(tag)
      await this.assignTag(contactId, tagId)
    }
  }

  private contactPayload(lead: Lead) {
    return {
      email: lead.email,
      ...(lead.firstName ? { firstName: lead.firstName } : {}),
      fields: Object.entries(lead.fields).map(([slug, value]) => ({
        slug,
        value: String(value),
      })),
    }
  }

  private async upsertContact(lead: Lead): Promise<number> {
    const res = await request(this.apiKey, 'POST', '/contacts', this.contactPayload(lead))
    if (res.ok) {
      const contact = (await res.json()) as SystemeContact
      return contact.id
    }
    if (res.status === 422) {
      // Contact likely exists — find and patch it.
      const existing = await this.findContactByEmail(lead.email)
      if (existing) {
        const patch = await request(
          this.apiKey,
          'PATCH',
          `/contacts/${existing.id}`,
          this.contactPayload(lead),
          'application/merge-patch+json',
        )
        if (!patch.ok) throw new Error(`Systeme patch failed: ${patch.status}`)
        return existing.id
      }
    }
    throw new Error(`Systeme contact create failed: ${res.status}`)
  }

  private async findContactByEmail(email: string): Promise<SystemeContact | null> {
    const res = await request(
      this.apiKey,
      'GET',
      `/contacts?email=${encodeURIComponent(email)}`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { items?: SystemeContact[] }
    return data.items?.[0] ?? null
  }

  private async getOrCreateTagId(name: string): Promise<number> {
    const cached = tagIdCache.get(name)
    if (cached !== undefined) return cached
    const list = await request(this.apiKey, 'GET', '/tags?limit=100')
    if (list.ok) {
      const data = (await list.json()) as { items?: SystemeTag[] }
      for (const tag of data.items ?? []) tagIdCache.set(tag.name, tag.id)
      const found = tagIdCache.get(name)
      if (found !== undefined) return found
    }
    const created = await request(this.apiKey, 'POST', '/tags', { name })
    if (!created.ok) throw new Error(`Systeme tag create failed: ${created.status}`)
    const tag = (await created.json()) as SystemeTag
    tagIdCache.set(tag.name, tag.id)
    return tag.id
  }

  private async assignTag(contactId: number, tagId: number): Promise<void> {
    const res = await request(this.apiKey, 'POST', `/contacts/${contactId}/tags`, { tagId })
    // 422 here usually means the tag is already assigned — not an error for an upsert.
    if (!res.ok && res.status !== 422) {
      throw new Error(`Systeme tag assign failed: ${res.status}`)
    }
  }
}

export interface RecentLead {
  id: number
  email: string
  firstName: string | null
  registeredAt: string
  scoreTotal: string | null
  overallBand: string | null
  pillarBands: Record<'clarity' | 'freedom' | 'capacity' | 'intention' | 'unity', string | null>
  tags: string[]
  url: string
}

interface SystemeContactDetail {
  id: number
  email: string
  registeredAt: string
  fields?: { slug: string; value: string | null }[]
  tags?: { name: string }[]
}

/**
 * Newest contacts for the admin dashboard. Fetches one page and sorts by
 * registeredAt in case the API returns oldest-first.
 */
export async function fetchRecentLeads(apiKey: string, limit = 20): Promise<RecentLead[]> {
  const res = await request(apiKey, 'GET', `/contacts?limit=${Math.max(limit, 50)}`)
  if (!res.ok) throw new Error(`Systeme contacts list failed: ${res.status}`)
  const data = (await res.json()) as { items?: SystemeContactDetail[] }
  return (data.items ?? [])
    .map((c) => {
      const field = (slug: string) => c.fields?.find((f) => f.slug === slug)?.value ?? null
      return {
        id: c.id,
        email: c.email,
        firstName: field('first_name'),
        registeredAt: c.registeredAt,
        scoreTotal: field('score_total'),
        overallBand: field('overall_band'),
        pillarBands: {
          clarity: field('clarity_band'),
          freedom: field('freedom_band'),
          capacity: field('capacity_band'),
          intention: field('intention_band'),
          unity: field('unity_band'),
        },
        tags: (c.tags ?? []).map((t) => t.name),
        url: `https://systeme.io/dashboard/contacts/${c.id}`,
      }
    })
    .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
    .slice(0, limit)
}
