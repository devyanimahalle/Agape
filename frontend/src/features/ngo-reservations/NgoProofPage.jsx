import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, LoadingState } from '../../components/ui'
import Page from '../../components/Page'
import * as api from './api'
import { validateProofFiles } from './utils'

const inputCls = 'mt-1.5 w-full rounded-[6px] bg-canvas px-4 py-3 text-sm font-normal focus:bg-panel'
const labelCls = 'block text-xs font-semibold uppercase tracking-[1px]'
const SUBTITLE = 'Show that the food you collected was really donated.'
const backCls = 'press inline-block rounded-[6px] bg-ink px-6 py-3 text-sm font-bold uppercase tracking-[1px] text-canvas hover:bg-toast'

/** /ngo/pickups/:id/proof: proof of donation for a collected pickup (evidence the food was donated or distributed). */
export default function NgoProofPage() {
  const { id } = useParams()
  const listingId = Number(id)
  const navigate = useNavigate()
  const justConfirmed = useLocation().state?.justConfirmed === true

  const [row, setRow] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | missing | error
  const [files, setFiles] = useState([])
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const rows = await api.getReservations()
      const found = rows.find((r) => r.id === listingId) ?? null
      setRow(found)
      setState(found ? 'ready' : 'missing')
    } catch (err) {
      setError(err.detail ?? 'Could not load this pickup.')
      setState('error')
    }
  }, [listingId])

  useEffect(() => { load() }, [load])

  const add = (e) => {
    const picked = Array.from(e.target.files ?? []) // read before the input is cleared below
    setFiles((prev) => [...prev, ...picked])
    setError(null)
    e.target.value = ''
  }

  async function submit(e) {
    e.preventDefault()
    const problem = validateProofFiles(files)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.submitProof(listingId, files, note.trim())
      navigate('/ngo/reservations', { state: { notice: `Proof of donation submitted for “${row.title}”. An admin will review it.` } })
    } catch (err) {
      setError(err.detail ?? 'Could not upload the proof of donation.')
      setBusy(false)
    }
  }

  const back = <Link to="/ngo/reservations" className={backCls}>Back to my reservations</Link>

  let body
  if (state === 'loading') {
    body = <LoadingState label="Loading…" />
  } else if (state === 'error') {
    body = (
      <div role="alert" className="rounded-card bg-bad-bg p-6 text-bad-ink">
        <p>{error}</p>
        <Button variant="dark" onClick={load} className="mt-4 !px-4 !py-2">Try again</Button>
      </div>
    )
  } else if (state === 'missing') {
    body = <EmptyState title="We could not find that pickup" action={back}>It may belong to another account.</EmptyState>
  } else if (row.status !== 'completed') {
    body = (
      <EmptyState title="Confirm the pickup first" action={back}>
        Proof of donation can be added once you have confirmed that you collected the food.
      </EmptyState>
    )
  } else if (row.proof_status === 'approved') {
    body = (
      <EmptyState title="Proof of donation approved" action={back}>
        An admin approved the proof of donation for “{row.title}”. Nothing more to upload.
      </EmptyState>
    )
  } else {
    body = (
      <Card className="p-7 md:p-9">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl md:text-4xl">{row.title}</h2>
            <p className="mt-2 text-sm text-muted">{row.org_name} · {row.address}</p>
          </div>
          <Badge tone="ok">Pickup confirmed</Badge>
        </div>

        {justConfirmed && (
          <p role="status" className="mt-5 rounded-[6px] bg-ok-bg px-4 py-3 text-sm text-ok-ink">
            Pickup confirmed. Now add proof that the food was donated.
          </p>
        )}
        {row.proof_status === 'pending' && (
          <p className="mt-5 rounded-[6px] bg-warn-bg px-4 py-3 text-sm text-warn-ink">
            You have already uploaded {row.proof_count} {row.proof_count === 1 ? 'file' : 'files'}. They are awaiting admin review; you can add more.
          </p>
        )}
        {row.proof_status === 'rejected' && (
          <p className="mt-5 rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">
            An admin did not approve the earlier proof of donation. Please upload it again.
          </p>
        )}

        <form onSubmit={submit} noValidate className="mt-6 space-y-5">
          <p className="leading-relaxed text-muted">
            Upload evidence that the collected food was actually donated or distributed: a geotagged distribution photo,
            a signed distribution or beneficiary sheet, or a receipt. PDF, JPG or PNG, up to 10 MB each.
          </p>

          <div>
            <label htmlFor="proof-files" className={labelCls}>Proof of donation files *</label>
            <input
              id="proof-files"
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              onChange={add}
              className="mt-1.5 w-full rounded-[6px] bg-canvas px-4 py-3 text-sm file:mr-3 file:rounded-[6px] file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:text-canvas"
            />
          </div>
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-[6px] bg-canvas px-4 py-2">
                  <span className="truncate">{f.name}</span>
                  <button type="button" className="text-sm font-bold underline underline-offset-4" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label htmlFor="proof-note" className={labelCls}>Distribution note <span className="font-normal normal-case tracking-normal text-muted">(optional)</span></label>
            <textarea
              id="proof-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Who received the food, roughly how many people, and where"
              className={inputCls}
            />
          </div>

          {error && <p role="alert" className="rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">{error}</p>}

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="brand" disabled={busy || files.length === 0}>
              {busy ? 'Uploading…' : 'Submit proof of donation'}
            </Button>
            <Link to="/ngo/reservations" className="text-sm font-bold underline underline-offset-4">Do this later</Link>
          </div>
        </form>
      </Card>
    )
  }

  return (
    <Page title="Proof of donation" subtitle={SUBTITLE} width="max-w-3xl">
      {body}
    </Page>
  )
}
