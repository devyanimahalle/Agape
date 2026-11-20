import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import * as api from './api'
import ConfirmDialog from './components/ConfirmDialog'
import RateDialog from './components/RateDialog'
import ReservationCard from './components/ReservationCard'

const TABS = [
  { id: '', label: 'All' },
  { id: 'reserved', label: 'To collect' },
  { id: 'completed', label: 'Completed' },
]

/** /ngo/reservations: cancel, confirm a pickup (one click, then proof of donation on its own page), rate the provider. */
export default function NgoReservationsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tab, setTab] = useState('')
  const [rows, setRows] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(() => (location.state?.notice ? { kind: 'success', text: location.state.notice } : null))
  const [cancelTarget, setCancelTarget] = useState(null)
  const [completeTarget, setCompleteTarget] = useState(null)
  const [rateTarget, setRateTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState(null)

  const load = useCallback(async () => {
    try {
      setRows(await api.getReservations(tab || undefined))
      setState('ready')
      setError(null)
    } catch (err) {
      setError(err.detail ?? 'Could not load your reservations.')
      setState('error')
    }
  }, [tab])

  useEffect(() => {
    setState('loading')
    load()
  }, [load])

  async function confirmCancel() {
    setBusy(true)
    setDialogError(null)
    try {
      await api.cancelReservation(cancelTarget.id)
      setNotice({ kind: 'success', text: `Cancelled “${cancelTarget.title}”. It is back on the board if its window is still open.` })
      setCancelTarget(null)
      await load()
    } catch (err) {
      setDialogError(err.detail ?? 'Could not cancel.')
    } finally {
      setBusy(false)
    }
  }

  // One click: record the pickup, then go straight to the proof of donation page.
  async function confirmPickup() {
    const target = completeTarget
    setBusy(true)
    setDialogError(null)
    try {
      await api.completePickup(target.id)
      setCompleteTarget(null)
      navigate(`/ngo/pickups/${target.id}/proof`, { state: { justConfirmed: true } })
    } catch (err) {
      setDialogError(err.detail ?? 'Could not confirm the pickup.')
    } finally {
      setBusy(false)
    }
  }

  async function submitRating(body) {
    const target = rateTarget
    try {
      await api.rateProvider(target.id, body)
    } catch (err) {
      if (err.code !== 'ALREADY_RATED') throw err
    }
    setRateTarget(null)
    setNotice({ kind: 'success', text: 'Thanks for rating the provider.' })
    await load()
  }

  return (
    <main>
      <PageHeader title="My reservations">
        <a className="font-bold underline underline-offset-4" href="/ngo">Back to the board</a>
      </PageHeader>
      <div className="mx-auto max-w-6xl space-y-3 px-5 py-12 md:px-10 md:py-20">
      <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} variant={tab === t.id ? 'brand' : 'dark'} className="!px-5 !py-2">
            {t.label}
          </Button>
        ))}
      </div>

      {notice && (
        <p role="status" className="rounded-card bg-ok-bg p-5 text-ok-ink">{notice.text}</p>
      )}
      {state === 'loading' && <p className="p-8 text-center text-muted">Loading…</p>}
      {state === 'error' && (
        <div role="alert" className="rounded-card bg-bad-bg p-6 text-bad-ink">
          <p>{error}</p>
          <Button variant="dark" onClick={load} className="mt-4 !px-4 !py-2">Try again</Button>
        </div>
      )}
      {state === 'ready' && rows.length === 0 && <Card><p>Nothing here yet. Reserve food from the board.</p></Card>}
      {state === 'ready' && (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              onCancel={(x) => { setDialogError(null); setCancelTarget(x) }}
              onComplete={(x) => { setDialogError(null); setCompleteTarget(x) }}
              onRate={setRateTarget}
            />
          ))}
        </div>
      )}

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this reservation?"
          message={`“${cancelTarget.title}” will go back on the board for other NGOs.`}
          confirmLabel="Cancel reservation"
          busy={busy}
          error={dialogError}
          onConfirm={confirmCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}
      {completeTarget && (
        <ConfirmDialog
          title="Confirm pickup?"
          message={`Confirm that you collected “${completeTarget.title}”. You will add proof of donation next.`}
          confirmLabel="Confirm pickup"
          busy={busy}
          error={dialogError}
          onConfirm={confirmPickup}
          onCancel={() => setCompleteTarget(null)}
        />
      )}
      {rateTarget && <RateDialog listing={rateTarget} onSubmit={submitRating} onCancel={() => setRateTarget(null)} />}
      </div>
    </main>
  )
}
