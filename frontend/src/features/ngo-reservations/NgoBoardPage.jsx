import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
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
      <main>
        <PageHeader title="Food board">Nearby surplus food, nearest first.</PageHeader>
        <div className="mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-20">
          <p role="alert" className="max-w-3xl rounded-card bg-warn-bg p-6 text-warn-ink">
            Your NGO has not been approved yet. You can see the board once an admin approves your registration.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main>
      <PageHeader title="Food board">
        Food available near you. Nearest first · updates automatically ·{' '}
        <a className="font-bold underline underline-offset-4" href="/ngo/reservations">My reservations</a>
      </PageHeader>
      <div className="mx-auto max-w-6xl space-y-3 px-5 py-12 md:px-10 md:py-20">
      <div className="flex justify-end">
        <div role="group" aria-label="View" className="flex gap-1">
          {['list', 'map'].map((v) => (
            <Button key={v} aria-pressed={view === v} onClick={() => setView(v)} variant={view === v ? 'brand' : 'dark'} className="!px-5 !py-2 capitalize">
              {v}
            </Button>
          ))}
        </div>
      </div>

      <LocationPicker location={location} saved={saved} onChange={setLocation} />

      {notice && (
        <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`rounded-card p-5 ${notice.kind === 'error' ? 'bg-bad-bg text-bad-ink' : 'bg-ok-bg text-ok-ink'}`}>
          {notice.text}
        </p>
      )}
      {error && status !== 'error' && <p role="alert" className="rounded-card bg-bad-bg p-5 text-bad-ink">{error}</p>}

      {status === 'loading' && <p className="p-8 text-center text-muted">Loading available food…</p>}
      {status === 'error' && (
        <div role="alert" className="rounded-card bg-bad-bg p-6 text-bad-ink">
          <p>{error}</p>
          <Button variant="dark" onClick={() => { setStatus('loading'); load() }} className="mt-4 !px-4 !py-2">Try again</Button>
        </div>
      )}
      {status === 'ready' && !location && <Card><p>Set your location above to see food nearby.</p></Card>}
      {status === 'ready' && location && visible.length === 0 && <Card><p>No food is listed right now. Check back soon.</p></Card>}

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
      </div>
    </main>
  )
}
