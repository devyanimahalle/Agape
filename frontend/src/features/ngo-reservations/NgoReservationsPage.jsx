import { useCallback, useEffect, useState } from 'react'
import * as api from './api'
import CompleteDialog from './components/CompleteDialog'
import ConfirmDialog from './components/ConfirmDialog'
import RateDialog from './components/RateDialog'
import ReservationCard from './components/ReservationCard'
import { isRateable } from './utils'

const TABS = [
  { id: '', label: 'All' },
  { id: 'reserved', label: 'To collect' },
  { id: 'completed', label: 'Completed' },
]

/** /ngo/reservations — cancel, complete pickup with proof, rate the provider. */
export default function NgoReservationsPage() {
  const [tab, setTab] = useState('')
  const [rows, setRows] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
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

  async function submitComplete(files, note) {
    const target = completeTarget
    await api.completePickup(target.id, files, note) // errors surface inside the dialog
    setCompleteTarget(null)
    setNotice({ kind: 'success', text: `Pickup of “${target.title}” recorded. Thank you!` })
    await load()
    if (isRateable(target.provider_category)) setRateTarget({ ...target, status: 'completed' })
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
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">My reservations</h1>
          <p className="text-sm text-gray-600"><a className="underline" href="/ngo">Back to the board</a></p>
        </div>
        <div role="tablist" aria-label="Filter" className="flex overflow-hidden rounded border text-sm">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 ${tab === t.id ? 'bg-gray-800 text-white' : 'bg-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {notice && (
        <p role="status" className="rounded border border-green-300 bg-green-50 p-3 text-sm">{notice.text}</p>
      )}
      {state === 'loading' && <p>Loading…</p>}
      {state === 'error' && (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3">
          <p>{error}</p>
          <button type="button" onClick={load} className="mt-2 rounded border px-2 py-1 text-sm">Try again</button>
        </div>
      )}
      {state === 'ready' && rows.length === 0 && <p>Nothing here yet. Reserve food from the board.</p>}
      {state === 'ready' && (
        <div className="grid gap-3">
          {rows.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              onCancel={(x) => { setDialogError(null); setCancelTarget(x) }}
              onComplete={setCompleteTarget}
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
        <CompleteDialog listing={completeTarget} onSubmit={submitComplete} onCancel={() => setCompleteTarget(null)} />
      )}
      {rateTarget && <RateDialog listing={rateTarget} onSubmit={submitRating} onCancel={() => setRateTarget(null)} />}
    </main>
  )
}
