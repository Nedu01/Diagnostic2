type AnalyticsEvent =
  | 'diagnostic_started'
  | 'question_answered'
  | 'diagnostic_completed'
  | 'report_unlocked'
  | 'result_shared'

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number> }) => void
  }
}

/**
 * Single seam for analytics. Swapping providers (e.g. PostHog) means
 * reimplementing only this function. Never pass emails or raw answers.
 */
export function track(event: AnalyticsEvent, props?: Record<string, string | number>): void {
  window.plausible?.(event, props ? { props } : undefined)
}
