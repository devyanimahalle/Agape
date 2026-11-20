import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, ROLE_LABEL } from '../context/AuthContext'

const itemCls = 'block w-full rounded-[6px] px-3 py-2 text-left text-sm font-bold uppercase tracking-[1px] text-ink hover:bg-canvas focus-visible:bg-canvas'

function initials(user) {
  const source = (user.name ?? '').trim() || ROLE_LABEL[user.role] || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)
  return letters.toUpperCase()
}

// Signed-in profile button with a small menu: Account and Sign out. Closes on outside click, Escape or a choice.
export default function ProfileMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const button = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    root.current?.querySelector('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...root.current.querySelectorAll('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  const signOut = () => {
    setOpen(false)
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="press flex h-9 w-9 items-center justify-center rounded-pill bg-brand-bright text-xs font-bold text-ink hover:bg-brand"
      >
        <span aria-hidden="true">{initials(user)}</span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Profile"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-40 mt-2 w-56 rounded-card bg-panel p-2 text-ink"
        >
          <div className="px-3 pb-2 pt-1">
            <p className="truncate text-sm font-bold">{user.name ?? ROLE_LABEL[user.role]}</p>
            <p className="text-xs uppercase tracking-[1px] text-muted">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)} className={itemCls}>Account</Link>
          <button type="button" role="menuitem" onClick={signOut} className={itemCls}>Sign out</button>
        </div>
      )}
    </div>
  )
}
