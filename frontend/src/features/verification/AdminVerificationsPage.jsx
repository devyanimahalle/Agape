import { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Card, Badge, EmptyState, LoadingState, Modal } from '../../components/ui'
import { listVerifications, decideVerification, fetchDocumentUrl } from './api'
import Page from './components/Page'
import { ServerAlert, RejectionBanner, STATUS_TONE, inputCls, labelCls } from './components/fields'

const TYPE_LABEL = { provider_step1: 'Donor: step 1', provider_step2: 'Donor: step 2', ngo: 'NGO onboarding' }
const STATUSES = ['', 'pending', 'approved', 'rejected']
const TYPES = ['', 'provider_step1', 'provider_step2', 'ngo']
const SUBTITLE = 'Review donor and NGO verification requests. Documents open privately and are never public.'

const filterCls = 'mt-1.5 rounded-[6px] bg-panel px-4 py-3 text-sm font-normal capitalize'

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
            className="h-96 w-full rounded-[6px] bg-canvas"
          />
          <div className="flex flex-wrap gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button variant="dark">Open in new tab</Button>
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
        <label className={labelCls} htmlFor="reject-reason">Rejection reason *</label>
        <textarea
          id="reject-reason"
          rows={3}
          className={inputCls}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this submission is rejected…"
        />
        {noReason && <p role="alert" className="text-xs text-bad-ink">Rejection reason is required</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="dark" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Rejecting…' : 'Confirm rejection'}
          </Button>
          <Button variant="ghost" onClick={handleClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Verification card ─────────────────────────────────────────────────────────
function Detail({ label, children }) {
  return (
    <div className="rounded-[6px] bg-canvas px-4 py-3">
      <dt className="text-xs uppercase tracking-[1px] text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{children}</dd>
    </div>
  )
}

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
  const docs = item.document_ids ?? []
  const title = item.org_name || item.entity_name || item.user_email

  return (
    <>
      <Card as="article" className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl">{title}</h2>
            <p className="mt-1 text-xs text-muted">{item.user_email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{TYPE_LABEL[item.type] ?? item.type}</Badge>
            <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{item.status}</Badge>
          </div>
        </div>

        <dl className="grid gap-2 sm:grid-cols-2">
          {item.reg_number && <Detail label="Registration">{item.reg_number}</Detail>}
          {item.entity_name && item.type !== 'ngo' && <Detail label="Business name">{item.entity_name}</Detail>}
          {item.pan_masked && <Detail label="PAN">{item.pan_masked}</Detail>}
          {item.aadhaar_masked && <Detail label="Aadhaar">{item.aadhaar_masked}</Detail>}
          {item.fssai_number && <Detail label="FSSAI">{item.fssai_number}</Detail>}
          <Detail label="Submitted">{new Date(item.submitted_at).toLocaleString()}</Detail>
        </dl>

        <RejectionBanner reason={item.rejection_reason} label="Reason" />
        <ServerAlert msg={msg} />

        <div className="flex flex-wrap gap-2">
          {docs.map((id, i) => (
            <Button key={id} variant="ghost" onClick={() => setDocId(id)}>
              {docs.length > 1 ? `View document ${i + 1}` : 'View document'}
            </Button>
          ))}
          {isPending && (
            <>
              <Button variant="brand" disabled={busy} onClick={() => decide('approve')}>Approve</Button>
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
      setItems(await listVerifications({ status: statusFilter || undefined, type: typeFilter || undefined }))
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
    <Page title="Verification queue" subtitle={SUBTITLE} width="max-w-4xl">
      <div className="mb-8 flex flex-wrap items-end gap-4">
        <label className={labelCls}>
          Status
          <select className={`${filterCls} block`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Type
          <select className={`${filterCls} block normal-case`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t ? (TYPE_LABEL[t] ?? t) : 'All'}</option>)}
          </select>
        </label>
        <Button variant="ghost" onClick={load}>Refresh</Button>
      </div>

      {pageError && <p role="alert" className="mb-6 rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">{pageError}</p>}

      {loading
        ? <LoadingState label="Loading verifications…" />
        : items.length === 0
          ? <EmptyState title="Nothing here">No verifications match the current filters.</EmptyState>
          : (
            <div className="grid gap-3">
              {items.map((item) => (
                <VerificationCard key={item.id} item={item} onDecide={handleDecide} />
              ))}
            </div>
          )}
    </Page>
  )
}
