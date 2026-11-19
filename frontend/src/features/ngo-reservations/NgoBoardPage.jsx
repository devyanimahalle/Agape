import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api'
import BoardMap from './components/BoardMap'
import ConfirmDialog from './components/ConfirmDialog'
import ListingCard from './components/ListingCard'
import LocationPicker from './components/LocationPicker'
import useNow from './useNow'

const REFRESH_MS = 30000

/** /ngo — live availability board, nearest first. */
export default function NgoBoardPage() {
  const now = useNow()
  const [saved, setSaved] = useState(null)
  const [location, setLocation] = useState(null)
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error | not_verified
  const [error, setError] = useState(null)
  const [view, setView] = useState('list')
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState(null)
  const [notice, setNotice] = useState(null)
  const requestId = useRef(0)

  // Start from the NGO's saved location.
  useEffect(() => {
    let alive = true
    api
      .getMe()
      .then((me) => {
        if (!alive) return
        const p = me.profile
        if (p?.lat != null && p?.lng != null) {
          const loc = { lat: p.lat, lng: p.lng, label: p.address || 'Saved location' }
          setSaved(loc)
          setLocation(loc)
        } else {
          setStatus('ready')
        }
      })
      .catch((err) => {
        if (!alive) return
        setError(err.detail ?? 'Could not load your profile.')
        setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!location) return
    const id = ++requestId.current
    try {
      const rows = await api.getBoard(location.lat, location.lng)
      if (id !== requestId.current) return // a newer request superseded this one
      setItems(rows)
      setStatus('ready')
      setError(null)
    } catch (err) {
      if (id !== requestId.current) return
      if (err.code === 'NOT_VERIFIED') setStatus('not_verified')
      else {
        setError(err.detail ?? 'Could not load the board.')
        setStatus((s) => (s === 'ready' ? 'ready' : 'error'))
      }
    }
  }, [location])

  useEffect(() => {
    load()
    if (!location) return undefined
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load, location])

  const visible = items.filter((i) => new Date(i.window_end).getTime() > now)

  async function confirmReserve() {
    setBusy(true)
    setDialogError(null)
    try {
      await api.reserve(target.id)
      setItems((prev) => prev.filter((i) => i.id !== target.id))
      setNotice({ kind: 'success', text: `Reserved “${target.title}”. Find it under My reservations.` })
      setTarget(null)
    } catch (err) {
      if (err.status === 409) {
        setNotice({ kind: 'error', text: 'Sorry, that listing was just taken by another NGO or has expired.' })
        setTarget(null)
        load()
      } else {
        setDialogError(err.detail ?? 'Could not reserve this listing.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (status === 'not_verified') {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <h1 className="text-2xl font-bold">Food available near you</h1>
        <p role="alert" className="mt-4 rounded border border-amber-300 bg-amber-50 p-3">
          Your NGO has not been approved yet. You can see the board once an admin approves your registration.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Food available near you</h1>
          <p className="text-sm text-gray-600">Nearest first · updates automatically · <a className="underline" href="/ngo/reservations">My reservations</a></p>
        </div>
        <div role="group" aria-label="View" className="flex overflow-hidden rounded border text-sm">
          {['list', 'map'].map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`px-3 py-1.5 capitalize ${view === v ? 'bg-gray-800 text-white' : 'bg-white'}`}>
              {v}
            </button>
          ))}
        </div>
      </header>

      <LocationPicker location={location} saved={saved} onChange={setLocation} />

      {notice && (
        <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`rounded border p-3 text-sm ${notice.kind === 'error' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
          {notice.text}
        </p>
      )}
      {error && status !== 'error' && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {status === 'loading' && <p>Loading available food…</p>}
      {status === 'error' && (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3">
          <p>{error}</p>
          <button type="button" onClick={() => { setStatus('loading'); load() }} className="mt-2 rounded border px-2 py-1 text-sm">Try again</button>
        </div>
      )}
      {status === 'ready' && !location && <p>Set your location above to see food nearby.</p>}
      {status === 'ready' && location && visible.length === 0 && <p>No food is listed right now. Check back soon.</p>}

      {status === 'ready' && location && visible.length > 0 && view === 'list' && (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((l) => (
            <ListingCard key={l.id} listing={l} now={now} onReserve={(x) => { setDialogError(null); setTarget(x) }} />
          ))}
        </div>
      )}
      {status === 'ready' && location && visible.length > 0 && view === 'map' && (
        <BoardMap listings={visible} origin={location} onReserve={(x) => { setDialogError(null); setTarget(x) }} />
      )}

      {target && (
        <ConfirmDialog
          title="Reserve this food?"
          message={`You will reserve the whole listing “${target.title}” (${target.quantity} ${target.unit}). Your NGO is responsible for collecting it within the window.`}
          confirmLabel="Reserve"
          busy={busy}
          error={dialogError}
          onConfirm={confirmReserve}
          onCancel={() => setTarget(null)}
        />
      )}
    </main>
  )
}
