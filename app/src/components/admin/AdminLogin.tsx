import { useState, type FormEvent } from 'react'
import { login } from '../../lib/adminApi'

export default function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await login(password)
      if (result === 'ok') onSuccess()
      else if (result === 'wrong_password') setError('That password is not right. Try again.')
      else if (result === 'rate_limited') setError('Too many attempts. Wait 15 minutes and try again.')
      else setError('Could not reach the server. Try again in a moment.')
    } catch {
      setError('Could not reach the server. Try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin admin-login">
      <h1>Dashboard</h1>
      <form onSubmit={submit}>
        <label htmlFor="admin-password">Admin password</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting || !password}>
          Sign in
        </button>
      </form>
    </main>
  )
}
