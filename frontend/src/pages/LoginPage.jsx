import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, setToken, USE_MOCKS } from '../lib/api'
import { homeForRole, safeNext } from '../lib/routes'
import { useAuth, ROLES, ROLE_LABEL } from '../context/AuthContext'
import { Badge, Button } from '../components/ui'

const inputCls = 'mt-1.5 w-full rounded-[6px] bg-canvas px-4 py-3 focus:bg-panel'

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
    <main className="grid md:min-h-[calc(100vh-3.5rem)] md:grid-cols-[1.1fr_1fr]">
      <section aria-label="About Agape" className="bg-brand-bright text-ink">
        <div className="mx-auto max-w-xl px-5 py-12 md:ml-auto md:mr-0 md:px-12 md:py-20">
          <p className="agape-rise font-display text-[clamp(4.5rem,15vw,9.5rem)] uppercase leading-[0.82]" aria-hidden="true">AGAPE</p>
          <p className="agape-rise mt-5 inline-block rounded-[6px] bg-ink px-3 py-1.5 font-bold text-canvas" style={{ '--d': '120ms' }}>
            Every MEAL Matters
          </p>
          <ul className="mt-12 space-y-8">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="agape-rise" style={{ '--d': `${240 + i * 120}ms` }}>
                <p className="text-lg font-bold">
                  {f.title} {f.soon && <Badge tone="neutral" className="ml-1 align-middle">In development</Badge>}
                </p>
                <p className="mt-1.5 leading-relaxed">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Sign in" className="px-5 py-12 md:px-12 md:py-20">
        <div className="mx-auto max-w-sm md:mx-0">
          <h1 className="agape-rise text-[clamp(3rem,6vw,4.5rem)] leading-[0.9]">Sign in</h1>
          {next && <p className="mt-3 text-muted">Sign in to continue.</p>}
          <form onSubmit={onSubmit} noValidate className="agape-rise mt-8 rounded-card bg-panel p-6" style={{ '--d': '120ms' }}>
            <label className="block font-semibold">
              Email
              <input type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} className={`${inputCls} font-normal`} />
            </label>
            <label className="mt-5 block font-semibold">
              Password
              <input type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} className={`${inputCls} font-normal`} />
            </label>
            {error && <p role="alert" className="mt-5 rounded-[6px] bg-bad-bg px-3 py-2 text-bad-ink">{error}</p>}
            <Button type="submit" variant="brand" className="mt-7 w-full" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {USE_MOCKS && (
            <section aria-label="Demo sign-in" className="mt-10">
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
