import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeResult } from '../../src/lib/scoring'
import { buildLead } from './leads'
import { SystemeAdapter } from './systeme'
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
