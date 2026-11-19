import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { api, setToken, USE_MOCKS } from '../lib/api'
import { PORTALS } from '../lib/portals'
import { homeForRole, isPortalRole, registerPath, safeNext, selectRolePath } from '../lib/routes'
import { useAuth, ROLE_LABEL } from '../context/AuthContext'
import { Button, LoadingState } from '../components/ui'

const inputCls = 'mt-1.5 w-full rounded-[6px] bg-canvas px-4 py-3 focus:bg-panel'

// Where a signed-in account goes. A ?next= is honoured only when the account really is the role whose portal it
// signed in through; otherwise it lands on the home of the role it actually has, with a short notice.
export function destinationFor(user, portalRole, next) {
  const home = homeForRole(user.role)
  if (user.role === portalRole) return { to: next ?? home, state: null }
  const actual = ROLE_LABEL[user.role] ?? user.role
  const chosen = PORTALS[portalRole]?.label ?? portalRole
  return { to: home, state: { roleNotice: `You chose ${chosen}, but this account is a ${actual} account, so we opened your ${actual} area.` } }
}

export default function LoginPage() {
  const { user, loading, refresh, mockSignIn } = useAuth()
  const [params] = useSearchParams()
  const role = params.get('role')
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isPortalRole(role)) return <Navigate to={selectRolePath(next)} replace />
  if (loading) return <main><LoadingState label="Checking your session…" /></main>
  if (user) {
    const d = destinationFor(user, role, next)
    return <Navigate to={d.to} state={d.state} replace />
  }

  const portal = PORTALS[role]

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      // POST /auth/login -> { access_token }, then /auth/me. The effect above redirects once the session is set.
      const data = await api('/auth/login', { method: 'POST', json: { email, password } })
      setToken(data.access_token)
      await refresh()
    } catch (err) {
      setToken(null)
      setError(err?.status === 401 || err?.status === 400 || err?.status === 422
        ? 'Email or password is incorrect.'
        : err?.detail || 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid md:min-h-[calc(100vh-3.5rem)] md:grid-cols-[1.1fr_1fr]">
      <section aria-label="About Agape" className="bg-brand-bright text-ink">
        <div className="mx-auto max-w-xl px-5 py-12 md:ml-auto md:mr-0 md:px-12 md:py-20">
          <p className="agape-rise font-display text-[clamp(4.5rem,15vw,9.5rem)] uppercase leading-[0.82]" aria-hidden="true">AGAPE</p>
          <p className="agape-rise mt-5 inline-block rounded-[6px] bg-ink px-3 py-1.5 font-bold text-canvas" style={{ '--d': '120ms' }}>
            Every MEAL Matters
          </p>
          <div className="agape-rise mt-12" style={{ '--d': '240ms' }}>
            <p className="text-lg font-bold">{portal.feature.title}</p>
            <p className="mt-1.5 leading-relaxed">{portal.feature.text}</p>
          </div>
          <p className="agape-rise mt-8 leading-relaxed" style={{ '--d': '360ms' }}>{portal.context}</p>
        </div>
      </section>

      <section aria-label="Sign in" className="px-5 py-12 md:px-12 md:py-20">
        <div className="mx-auto max-w-md md:mx-0">
          <h1 className="agape-rise text-[clamp(2.75rem,5vw,4rem)] leading-[0.9]">{portal.heading}</h1>
          <p className="mt-3 text-muted">{next ? 'Sign in to continue.' : portal.subtitle}</p>
          <p className="mt-2 text-sm">
            <Link to={selectRolePath(next)} className="font-bold underline underline-offset-4">Switch role</Link>
          </p>

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

          <aside aria-label="Demo account" className="mt-6 rounded-[6px] bg-panel px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-[1px] text-muted">Demo account</p>
            <p className="mt-1 break-all">{portal.demo.email}</p>
            <p>{portal.demo.password}</p>
          </aside>

          {portal.register ? (
            <p className="mt-6 text-sm text-muted">
              {portal.register.text}{' '}
              <Link to={registerPath(role)} className="font-bold text-ink underline underline-offset-4">{portal.register.label}</Link>
            </p>
          ) : (
            <p className="mt-6 text-sm text-muted">There is no public sign-up for admin accounts.</p>
          )}

          {USE_MOCKS && (
            <section aria-label="Demo sign-in" className="mt-10">
              <p className="text-muted">Demo mode: no backend needed.</p>
              <div className="mt-3">
                <Button variant="dark" onClick={() => mockSignIn(role)}>Continue as {portal.label}</Button>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}
