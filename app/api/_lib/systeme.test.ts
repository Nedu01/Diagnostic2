import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeResult } from '../../src/lib/scoring'
import { buildLead } from './leads'
import { fetchRecentLeads, SystemeAdapter } from './systeme'
import type { Answers } from '../../src/lib/types'

const allOnes = new Array(20).fill(1) as Answers // total 20 → gaps; all pillars needs_work

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status })

describe('buildLead', () => {
  it('maps a gaps-band result to the expected fields and tags', () => {
    const lead = buildLead('a@b.com', 'Ada', computeResult(allOnes))
    expect(lead.fields).toEqual({
      score_total: 20,
      overall_band: 'gaps',
      clarity_band: 'needs_work',
      freedom_band: 'needs_work',
      capacity_band: 'needs_work',
      intention_band: 'needs_work',
      unity_band: 'needs_work',
      source: 'diagnostic-webapp',
    })
    expect(lead.tags).toEqual([
      'diagnostic-completed',
      'band-gaps',
      'pillar-clarity-needs-work',
      'pillar-freedom-needs-work',
      'pillar-capacity-needs-work',
      'pillar-intention-needs-work',
      'pillar-unity-needs-work',
    ])
  })

  it('adds no pillar tags when every pillar is strong', () => {
    const lead = buildLead('a@b.com', undefined, computeResult(new Array(20).fill(2) as Answers))
    expect(lead.tags).toEqual(['diagnostic-completed', 'band-strong'])
  })
})

describe('SystemeAdapter', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('creates a contact then resolves and assigns tags', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init })
      const u = String(url)
      if (u.endsWith('/contacts') && init?.method === 'POST') {
        return jsonResponse(200, { id: 7 })
      }
      if (u.includes('/tags?') && init?.method === 'GET') {
        return jsonResponse(200, { items: [{ id: 1, name: 'diagnostic-completed' }] })
      }
      if (u.endsWith('/tags') && init?.method === 'POST') {
        return jsonResponse(200, { id: 2, name: 'band-strong' })
      }
      if (u.includes('/contacts/7/tags')) return jsonResponse(200, {})
      throw new Error(`unexpected fetch: ${init?.method} ${u}`)
    })

    const lead = buildLead('a@b.com', 'Ada', computeResult(new Array(20).fill(2) as Answers))
    await new SystemeAdapter('key').upsertLead(lead)

    const create = calls.find((c) => c.url.endsWith('/contacts') && c.init?.method === 'POST')!
    const body = JSON.parse(String(create.init?.body))
    expect(body.email).toBe('a@b.com')
    expect(body.firstName).toBe('Ada')
    expect(body.fields).toContainEqual({ slug: 'overall_band', value: 'strong' })
    expect((create.init?.headers as Record<string, string>)['X-API-Key']).toBe('key')
    expect(calls.filter((c) => c.url.includes('/contacts/7/tags'))).toHaveLength(2)
  })

  it('falls back to lookup + merge-patch when the contact already exists (422)', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init })
      const u = String(url)
      if (u.endsWith('/contacts') && init?.method === 'POST') return jsonResponse(422, {})
      if (u.includes('/contacts?email=') && init?.method === 'GET') {
        return jsonResponse(200, { items: [{ id: 9 }] })
      }
      if (u.includes('/contacts/9') && init?.method === 'PATCH') return jsonResponse(200, {})
      if (u.includes('/tags?')) return jsonResponse(200, { items: [] })
      if (u.endsWith('/tags') && init?.method === 'POST') {
        return jsonResponse(200, { id: 5, name: 'x' })
      }
      if (u.includes('/contacts/9/tags')) return jsonResponse(200, {})
      throw new Error(`unexpected fetch: ${init?.method} ${u}`)
    })

    const lead = buildLead('a@b.com', undefined, computeResult(new Array(20).fill(2) as Answers))
    await new SystemeAdapter('key').upsertLead(lead)

    const patch = calls.find((c) => c.init?.method === 'PATCH')!
    expect(patch.url).toContain('/contacts/9')
    expect((patch.init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/merge-patch+json',
    )
  })

  it('throws when contact creation fails outright', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(401, {}))
    const lead = buildLead('a@b.com', undefined, computeResult(allOnes))
    await expect(new SystemeAdapter('bad').upsertLead(lead)).rejects.toThrow(/401/)
  })
})

describe('fetchRecentLeads', () => {
  beforeEach(() => vi.restoreAllMocks())

  const contact = (id: number, registeredAt: string) => ({
    id,
    email: `u${id}@example.com`,
    registeredAt,
    fields: [
      { slug: 'first_name', value: `Name${id}` },
      { slug: 'score_total', value: '37' },
      { slug: 'overall_band', value: 'strong' },
      { slug: 'clarity_band', value: 'strong' },
      { slug: 'freedom_band', value: 'solid' },
      { slug: 'capacity_band', value: 'strong' },
      { slug: 'intention_band', value: 'strong' },
      { slug: 'unity_band', value: 'needs_work' },
    ],
    tags: [{ id: 1, name: 'diagnostic-completed' }, { id: 2, name: 'band-strong' }],
  })

  it('maps contacts to leads, newest first', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        items: [contact(1, '2026-07-01T00:00:00+00:00'), contact(2, '2026-07-15T00:00:00+00:00')],
      }),
    )
    const leads = await fetchRecentLeads('key', 20)
    expect(leads.map((l) => l.id)).toEqual([2, 1])
    expect(leads[0]).toMatchObject({
      email: 'u2@example.com',
      firstName: 'Name2',
      scoreTotal: '37',
      overallBand: 'strong',
      pillarBands: { clarity: 'strong', freedom: 'solid', capacity: 'strong', intention: 'strong', unity: 'needs_work' },
      tags: ['diagnostic-completed', 'band-strong'],
      url: 'https://systeme.io/dashboard/contacts/2',
    })
  })

  it('tolerates contacts with no custom fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { items: [{ id: 3, email: 'u3@example.com', registeredAt: '2026-07-10T00:00:00+00:00' }] }),
    )
    const [lead] = await fetchRecentLeads('key')
    expect(lead.firstName).toBeNull()
    expect(lead.overallBand).toBeNull()
    expect(lead.tags).toEqual([])
  })

  it('throws on a non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(500, {}))
    // request() retries once on 5xx, so the mock above must resolve twice — mockResolvedValue does.
    await expect(fetchRecentLeads('key')).rejects.toThrow('contacts list failed')
  })
})
