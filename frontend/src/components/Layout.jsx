import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth, ROLES, ROLE_LABEL } from '../context/AuthContext'

const navCls = ({ isActive }) => `rounded-pill px-3 py-1 ${isActive ? 'bg-primary text-ink' : 'hover:underline'}`

export default function Layout() {
  const { user, mock, mockRole, setMockRole, logout } = useAuth()
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-8 py-4">
          <Link to="/" className="font-display text-2xl uppercase">Agape</Link>
          <nav aria-label="Main" className="flex gap-1">
            <NavLink to="/ngo" end className={navCls}>Food board</NavLink>
            <NavLink to="/ngo/reservations" className={navCls}>My reservations</NavLink>
            {user && <NavLink to="/account" className={navCls}>Account</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {mock ? (
              <div className="flex items-center gap-2">
                <span className="rounded-pill bg-highlight px-2 py-0.5 text-xs uppercase">Demo mode</span>
                <select
                  aria-label="Demo role"
                  value={mockRole}
                  onChange={(e) => setMockRole(e.target.value)}
                  className="rounded-card border border-line bg-panel px-2 py-1"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
            ) : user ? (
              <>
                <span>{user.name ?? ROLE_LABEL[user.role]}</span>
                <button onClick={logout} className="underline">Sign out</button>
              </>
            ) : (
              <Link to="/login" className="underline">Sign in</Link>
            )}
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="mx-auto max-w-5xl px-8 py-8 text-xs text-muted">
        NGOs are admin-verified. FSSAI numbers get a format check plus admin review. Documents are stored privately.
        Meal figures are estimates.
      </footer>
    </div>
  )
}
