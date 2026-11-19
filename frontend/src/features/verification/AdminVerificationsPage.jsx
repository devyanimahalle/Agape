import { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Card, Badge, EmptyState, LoadingState, Modal } from '../../components/ui'
import { listVerifications, decideVerification, fetchDocumentUrl } from './api'

const STATUS_TONE = { pending: 'warn', approved: 'ok', rejected: 'bad' }
const TYPE_LABEL = { provider_step1: 'Provider — Step 1', provider_step2: 'Provider — Step 2', ngo: 'NGO onboarding' }

function ServerAlert({ msg }) {
  return msg ? (
    <p role="alert" className="rounded-md bg-bad-bg px-4 py-2 text-sm text-bad-ink">
      {msg}
    </p>
  ) : null
}

// ── Document viewer modal ─────────────────────────────────────────────────────
function DocumentModal({ docId, onClose }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const urlRef = useRef(null)

  useEffect(() => {
    if (!docId) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetchDocumentUrl(docId)
      .then((objUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(objUrl)
          return
        }
        urlRef.current = objUrl
        setUrl(objUrl)
      })
      .catch((err) => {
        if (!cancelled) setError(err.detail ?? err.message ?? 'Could not load document')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [docId])

  function handleClose() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setUrl(null)
    onClose()
  }

  return (
    <Modal open={!!docId} onClose={handleClose} title="Document viewer">
      {loading && <LoadingState label="Loading document…" />}
      {error && (
        <div className="space-y-3">
          <p className="text-sm text-bad-ink">{error}</p>
          <Button variant="ghost" onClick={handleClose}>Close</Button>
        </div>
      )}
      {url && !loading && !error && (
        <div className="space-y-3">
          <iframe
            src={url}
            title="Verification document"
            className="h-96 w-full rounded border border-line bg-canvas"
          />
          <div className="flex gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button variant="primary">Open in new tab</Button>
            </a>
            <Button variant="ghost" onClick={handleClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Reject modal ──────────────────────────────────────────────────────────────
function RejectModal({ open, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const noReason = touched && !reason.trim()

  function handleConfirm() {
    setTouched(true)
    if (!reason.trim()) return
    onConfirm(reason.trim())
  }

  function handleClose() {
    setReason('')
    setTouched(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Reject verification">
      <div className="space-y-3">
        <label className="block text-sm font-semibold" htmlFor="reject-reason">Rejection reason *</label>
        <textarea
          id="reject-reason"
          rows={3}
          className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this submission is rejected…"
        />
        {noReason && <p role="alert" className="text-xs text-bad-ink">Rejection reason is required</p>}
        <div className="flex gap-2">
          <Button variant="dark" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Rejecting…' : 'Confirm rejection'}
          </Button>
          <Button variant="ghost" onClick={handleClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Verification row card ─────────────────────────────────────────────────────
function VerificationCard({ item, onDecide }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [docId, setDocId] = useState(null)

  async function decide(decision, rejection_reason) {
    setBusy(true)
    setMsg('')
    try {
      await onDecide(item.id, { decision, rejection_reason })
    } catch (err) {
      setMsg(err.detail ?? err.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
      setRejectOpen(false)
    }
  }

  const isPending = item.status === 'pending'

  return (
    <>
      <Card as="article" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{item.user_email}</p>
            <p className="text-xs text-muted">{TYPE_LABEL[item.type] ?? item.type}</p>
          </div>
          <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{item.status}</Badge>
        </div>

        {item.org_name && <p className="text-sm"><strong>Org:</strong> {item.org_name} · {item.reg_number}</p>}
        {item.pan_masked && <p className="text-sm"><strong>PAN:</strong> {item.pan_masked} · <strong>Aadhaar:</strong> {item.aadhaar_masked}</p>}
        {item.rejection_reason && (
          <p className="rounded bg-bad-bg px-3 py-1 text-xs text-bad-ink"><strong>Reason:</strong> {item.rejection_reason}</p>
        )}

        <p className="text-xs text-muted">Submitted {new Date(item.submitted_at).toLocaleString()}</p>

        <ServerAlert msg={msg} />

        <div className="flex flex-wrap gap-2">
          {item.document_id && (
            <Button variant="ghost" onClick={() => setDocId(item.document_id)}>View document</Button>
          )}
          {isPending && (
            <>
              <Button variant="primary" disabled={busy} onClick={() => decide('approve')}>Approve</Button>
              <Button variant="dark" disabled={busy} onClick={() => setRejectOpen(true)}>Reject</Button>
            </>
          )}
        </div>
      </Card>

      <RejectModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => decide('reject', reason)}
        busy={busy}
      />

      <DocumentModal docId={docId} onClose={() => setDocId(null)} />
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const STATUSES = ['', 'pending', 'approved', 'rejected']
const TYPES = ['', 'provider_step1', 'provider_step2', 'ngo']

export default function AdminVerificationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setPageError('')
    try {
      const data = await listVerifications({ status: statusFilter || undefined, type: typeFilter || undefined })
      setItems(data)
    } catch (err) {
      setPageError(err.detail ?? err.message ?? 'Failed to load verifications')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  async function handleDecide(id, decision) {
    await decideVerification(id, decision)
    await load()
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Verification queue</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted" htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            className="mt-1 rounded-md border border-line bg-canvas px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted" htmlFor="type-filter">Type</label>
          <select
            id="type-filter"
            className="mt-1 rounded-md border border-line bg-canvas px-3 py-1.5 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {TYPES.map((t) => <option key={t} value={t}>{t ? (TYPE_LABEL[t] ?? t) : 'All'}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button variant="ghost" onClick={load}>Refresh</Button>
        </div>
      </div>

      {pageError && <p role="alert" className="rounded-md bg-bad-bg px-4 py-2 text-sm text-bad-ink">{pageError}</p>}

      {loading
        ? <LoadingState label="Loading verifications…" />
        : items.length === 0
          ? <EmptyState title="Nothing here">No verifications match the current filters.</EmptyState>
          : (
            <div className="space-y-4">
              {items.map((item) => (
                <VerificationCard key={item.id} item={item} onDecide={handleDecide} />
              ))}
            </div>
          )
      }
    </main>
  )
}
