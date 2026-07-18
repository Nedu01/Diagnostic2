type AnalyticsEvent =
  | 'diagnostic_started'
  | 'question_answered'
  | 'diagnostic_completed'
  | 'report_unlocked'
  | 'result_shared'

const VISITOR_KEY = 'diagnostic-visitor-id'
const VISIT_FLAG = 'diagnostic-visit-tracked'

function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

function send(name: string, props?: Record<string, string | number>): void {
  try {
    const body = JSON.stringify({ name, visitorId: visitorId(), props })
    // sendBeacon survives page navigation; fall back to keepalive fetch.
    const beaconed = navigator.sendBeacon?.(
      '/api/events',
      new Blob([body], { type: 'application/json' }),
    )
    if (!beaconed) {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // Analytics must never break the visitor's flow.
  }
}

/**
 * Single seam for analytics. Events land in our own Postgres via
 * /api/events. Never pass emails or raw answers — bands only.
 */
export function track(event: AnalyticsEvent, props?: Record<string, string | number>): void {
  send(event, props)
}

/** Fires once per browser session, carrying the traffic source if known. */
export function trackVisit(): void {
  try {
    if (sessionStorage.getItem(VISIT_FLAG)) return
    sessionStorage.setItem(VISIT_FLAG, '1')
  } catch {
    return
  }
  const utm = new URLSearchParams(window.location.search).get('utm_source')
  let source = utm ?? ''
  if (!source && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname
      if (host && host !== window.location.hostname) source = host
    } catch {
      // Malformed referrer — treat as direct.
    }
  }
  send('visit', source ? { source: source.slice(0, 100) } : undefined)
}
