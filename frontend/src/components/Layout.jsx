import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth, ROLES, ROLE_LABEL } from '../context/AuthContext'

const navCls = ({ isActive }) =>
  `press whitespace-nowrap rounded-[6px] px-3 py-1.5 ${isActive ? 'bg-brand-bright text-ink' : 'text-canvas hover:bg-toast'}`

export default function Layout() {
  const { user, mock, mockRole, setMockRole, logout } = useAuth()
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="on-ink bg-ink text-canvas">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 md:px-10">
          <Link to="/" className="font-display text-2xl uppercase leading-none tracking-[0.02em] text-brand-bright">Agape</Link>
          <nav aria-label="Main" className="-mx-1 flex min-w-0 gap-1 overflow-x-auto">
            <NavLink to="/ngo" end className={navCls}>Food board</NavLink>
            <NavLink to="/ngo/reservations" className={navCls}>My reservations</NavLink>
            {user && <NavLink to="/account" className={navCls}>Account</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {mock ? (
              <div className="flex items-center gap-2">
                <span className="rounded-pill bg-brand-bright px-2.5 py-0.5 text-xs font-bold uppercase text-ink">Demo mode</span>
                <select
                  aria-label="Demo role"
                  value={mockRole}
                  onChange={(e) => setMockRole(e.target.value)}
                  className="rounded-[6px] bg-canvas px-2 py-1.5 text-ink"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
            ) : user ? (
              <>
                <span>{user.name ?? ROLE_LABEL[user.role]}</span>
                <button onClick={logout} className="press underline underline-offset-4">Sign out</button>
              </>
            ) : (
              <Link to="/login" className="press rounded-[6px] bg-brand-bright px-4 py-1.5 font-bold text-ink">Sign in</Link>
            )}
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="on-ink bg-ink text-on-ink">
        <div className="mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-16">
          <p aria-hidden="true" className="font-display text-[clamp(3.5rem,13vw,9rem)] uppercase leading-[0.85] text-brand-bright">Agape</p>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed">
            NGOs are admin-verified. FSSAI numbers get a format check plus admin review. Documents are stored privately.
            Meal figures are estimates.
          </p>
        </div>
      </footer>
    </div>
  )
}
