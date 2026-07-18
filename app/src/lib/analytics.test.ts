import { beforeEach, describe, expect, it, vi } from 'vitest'
import { track, trackVisit } from './analytics'

const sentBodies = () =>
  vi.mocked(fetch).mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}')))
})

describe('track', () => {
  it('posts the event with a stable visitor id', () => {
    track('diagnostic_started')
    track('question_answered', { question: 1 })
    const bodies = sentBodies()
    expect(bodies[0].name).toBe('diagnostic_started')
    expect(bodies[1].props).toEqual({ question: 1 })
    expect(bodies[0].visitorId).toBe(bodies[1].visitorId)
    expect(bodies[0].visitorId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('never throws even when sending fails', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(() => track('diagnostic_started')).not.toThrow()
  })
})

describe('trackVisit', () => {
  it('fires once per browser session', () => {
    trackVisit()
    trackVisit()
    expect(sentBodies().filter((b) => b.name === 'visit')).toHaveLength(1)
  })

  it('uses the utm_source when present', () => {
    window.history.replaceState(null, '', '/?utm_source=newsletter')
    trackVisit()
    expect(sentBodies()[0].props).toEqual({ source: 'newsletter' })
    window.history.replaceState(null, '', '/')
  })

  it('omits the source when there is no referrer or utm', () => {
    trackVisit()
    expect(sentBodies()[0].props).toBeUndefined()
  })
})
