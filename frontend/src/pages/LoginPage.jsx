import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken, USE_MOCKS } from '../lib/api'
import { useAuth, ROLES, ROLE_LABEL } from '../context/AuthContext'
import { Button, Card } from '../components/ui'

const homeFor = (role) => (role === 'ngo' ? '/ngo' : '/')
const inputCls = 'mt-1 w-full rounded-card border border-line bg-panel px-3 py-2'

export default function LoginPage() {
  const { refresh, setMockRole } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      // Assumed contract: POST /auth/login -> { access_token }. Role B owns the endpoint.
      const data = await api('/auth/login', { method: 'POST', json: { email, password } })
      setToken(data.access_token)
      const user = await refresh()
      navigate(homeFor(user.role), { replace: true })
    } catch (err) {
      setToken(null)
      setError(err?.status === 401 || err?.status === 400 || err?.status === 422
        ? 'Email or password is incorrect.'
        : err?.detail || 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function demo(role) {
    setMockRole(role)
    navigate(homeFor(role), { replace: true })
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-4xl">Sign in</h1>
      <Card className="mt-6">
        <form onSubmit={onSubmit} noValidate>
          <label className="block">
            Email
            <input type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="mt-4 block">
            Password
            <input type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </label>
          {error && <p role="alert" className="mt-4 rounded-card bg-bad-bg px-3 py-2 text-bad-ink">{error}</p>}
          <Button type="submit" variant="primary" className="mt-6 w-full" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>

      {USE_MOCKS && (
        <section aria-label="Demo sign-in" className="mt-6">
          <p className="text-muted">Demo mode: no backend needed.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <Button key={r} variant="dark" onClick={() => demo(r)}>Continue as {ROLE_LABEL[r]}</Button>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
