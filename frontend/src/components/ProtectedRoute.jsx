import { Link, useLocation } from 'react-router-dom'
import { useAuth, ROLE_LABEL } from '../context/AuthContext'

// Gate a route by session and (optionally) role. There is no login screen yet, so the signed-out state explains that.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <p className="p-8" role="status">Checking your session…</p>
  if (!user) {
    return (
      <section className="mx-auto max-w-xl p-8">
        <h2 className="text-3xl">Sign in required</h2>
        <p className="mt-2 text-muted">You need to be signed in to view this page.</p>
        <Link to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} className="mt-4 inline-block rounded-card border border-line bg-primary px-5 py-2 text-sm font-bold uppercase tracking-[1px] text-ink">
          Sign in
        </Link>
      </section>
    )
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <section className="mx-auto max-w-xl p-8">
        <h2 className="text-3xl">Not available for your role</h2>
        <p className="mt-2 text-muted">
          This page is for {roles.map((r) => ROLE_LABEL[r]).join(' / ')} accounts. You are signed in as{' '}
          {ROLE_LABEL[user.role] ?? user.role}.
        </p>
      </section>
    )
  }
  return children
}
