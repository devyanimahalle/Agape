import { Link, useLocation } from 'react-router-dom'
import { useAuth, ROLE_LABEL } from '../context/AuthContext'
import { loginPath, selectRolePath } from '../lib/routes'
import Page from './Page'
import LoadingState from './ui/LoadingState'

const linkCls = 'press inline-block rounded-[6px] px-6 py-3 text-sm font-bold uppercase tracking-[1px]'

// Gate a route by session and (optionally) role. Each outcome is a normal page with the orange title band.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) {
    return <Page title="One moment" width="max-w-3xl"><LoadingState label="Checking your session…" /></Page>
  }
  if (!user) {
    return (
      <Page title="Sign in required" subtitle="You need to be signed in to view this page." width="max-w-3xl">
        <Link to={roles?.length === 1 ? loginPath(roles[0], loc.pathname + loc.search) : selectRolePath(loc.pathname + loc.search)} className={`${linkCls} bg-brand-bright text-ink hover:bg-brand`}>
          Sign in
        </Link>
      </Page>
    )
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <Page
        title="Not available for your role"
        subtitle={`This page is for ${roles.map((r) => ROLE_LABEL[r]).join(' / ')} accounts. You are signed in as ${ROLE_LABEL[user.role] ?? user.role}.`}
        width="max-w-3xl"
      >
        <Link to="/" className={`${linkCls} bg-ink text-canvas hover:bg-toast`}>Back home</Link>
      </Page>
    )
  }
  return children
}
