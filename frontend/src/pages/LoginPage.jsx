import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, setToken, USE_MOCKS } from '../lib/api'
import { homeForRole, safeNext } from '../lib/routes'
import { useAuth, ROLES, ROLE_LABEL } from '../context/AuthContext'
import { Badge, Button } from '../components/ui'

const inputCls = 'mt-1 w-full rounded-card border border-line bg-panel px-3 py-2'

const FEATURES = [
  { title: 'NGO food board & reservations', text: 'Verified NGOs see nearby surplus food on a list or map, reserve it, then confirm pickup with proof.' },
  { title: 'Donor surplus listings', text: 'Donors list surplus food with a collection window and see when it is reserved.', soon: true },
  { title: 'Admin verification, honest claims', text: 'Admins review every NGO. FSSAI numbers get a format check plus admin review. Documents are stored privately. Meal figures are estimates.', soon: true },
]

export default function LoginPage() {
  const { refresh, setMockRole } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const go = (role) => navigate(next ?? homeForRole(role), { replace: true })

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      // Assumed contract: POST /auth/login -> { access_token }. Role B owns the endpoint.
      const data = await api('/auth/login', { method: 'POST', json: { email, password } })
      setToken(data.access_token)
      const user = await refresh()
      go(user.role)
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
    go(role)
  }

  return (
    <main className="grid min-h-[calc(100vh-5rem)] md:grid-cols-2">
      <section aria-label="About Agape" className="bg-brand-bright text-ink">
        <div className="mx-auto max-w-md px-8 py-12">
          <p className="agape-rise font-display text-7xl uppercase leading-none" aria-hidden="true">AGAPE</p>
          <p className="agape-rise mt-3 inline-block rounded-card bg-ink px-3 py-1 font-bold text-canvas" style={{ '--d': '120ms' }}>
            Agape : Every Meal Matters
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="agape-rise" style={{ '--d': `${240 + i * 120}ms` }}>
                <p className="font-bold">
                  {f.title} {f.soon && <Badge tone="neutral" className="ml-1 align-middle">In development</Badge>}
                </p>
                <p className="mt-1">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Sign in" className="px-8 py-12">
        <div className="mx-auto max-w-sm">
          <h1 className="text-4xl">Sign in</h1>
          {next && <p className="mt-2 text-muted">Sign in to continue.</p>}
          <form onSubmit={onSubmit} noValidate className="mt-6 rounded-card border border-line bg-panel p-5">
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
            <Button type="submit" variant="brand" className="mt-6 w-full" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

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
        </div>
      </section>
    </main>
  )
}
