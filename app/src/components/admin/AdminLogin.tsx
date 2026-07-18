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
      if (await login(password)) onSuccess()
      else setError('That password is not right. Try again.')
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
