import { useState } from 'react'
import type { FormEvent } from 'react'

interface Props {
  code: string
  onUnlocked: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function EmailGate({ code, onUnlocked }: Props) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName: firstName || undefined, code }),
      })
      if (!res.ok) throw new Error(`subscribe failed: ${res.status}`)
      onUnlocked()
    } catch {
      setError('Something went wrong sending your report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (dismissed) {
    return (
      <div className="gate-collapsed">
        <button type="button" className="btn-link" onClick={() => setDismissed(false)}>
          Unlock your full pillar-by-pillar report
        </button>
      </div>
    )
  }

  return (
    <section className="email-gate" aria-label="Unlock your full report">
      <h2>Read your full report</h2>
      <p>
        Your pillar-by-pillar reading — Fr. Chime&rsquo;s guidance on each of your five results —
        is ready. Enter your email to unlock it here and receive your personalised{' '}
        <em>Reading Your Results</em> guide in your inbox. It is free.
      </p>
      <form onSubmit={submit} noValidate>
        <div className="gate-fields">
          <label>
            First name <span className="optional">(optional)</span>
            <input
              type="text"
              name="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              aria-describedby={error ? 'gate-error' : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p id="gate-error" role="alert" className="gate-error">
            {error}
          </p>
        )}
        <div className="center">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Unlocking…' : 'Unlock my full report'}
          </button>
        </div>
      </form>
      <div className="center">
        <button type="button" className="btn-link" onClick={() => setDismissed(true)}>
          No thanks — just show me the summary
        </button>
      </div>
    </section>
  )
}
