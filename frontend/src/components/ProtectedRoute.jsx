import { Link, useLocation } from 'react-router-dom'
import { useAuth, ROLE_LABEL } from '../context/AuthContext'

// Gate a route by session and (optionally) role. There is no login screen yet, so the signed-out state explains that.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <p className="mx-auto max-w-6xl px-5 py-16 md:px-10" role="status">Checking your session…</p>
  if (!user) {
    return (
      <section className="mx-auto max-w-6xl px-5 py-16 md:px-10 md:py-24">
        <h2 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.92]">Sign in required</h2>
        <p className="mt-4 max-w-xl text-lg text-muted">You need to be signed in to view this page.</p>
        <Link to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} className="press mt-6 inline-block rounded-[6px] bg-brand-bright px-6 py-3 text-sm font-bold uppercase tracking-[1px] text-ink hover:bg-brand">
          Sign in
        </Link>
      </section>
    )
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <section className="mx-auto max-w-6xl px-5 py-16 md:px-10 md:py-24">
        <h2 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.92]">Not available for your role</h2>
        <p className="mt-4 max-w-xl text-lg text-muted">
          This page is for {roles.map((r) => ROLE_LABEL[r]).join(' / ')} accounts. You are signed in as{' '}
          {ROLE_LABEL[user.role] ?? user.role}.
        </p>
      </section>
    )
  }
  return children
}
