import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, EmptyState, LoadingState, Modal } from '../../components/ui'
import {
  getProviderVerification,
  submitProviderStep1,
  submitProviderStep2,
} from './api'

// ── Validators ────────────────────────────────────────────────────────────────
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const AADHAAR_RE = /^\d{12}$/
const FSSAI_RE = /^\d{14}$/

function validate1({ pan, aadhaar, fssai, category }) {
  const errs = {}
  if (!PAN_RE.test(pan)) errs.pan = 'PAN must be 10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)'
  if (!AADHAAR_RE.test(aadhaar)) errs.aadhaar = 'Aadhaar must be exactly 12 digits'
  if (fssai && !FSSAI_RE.test(fssai)) errs.fssai = 'FSSAI licence must be exactly 14 digits'
  return errs
}

// ── Step indicator ────────────────────────────────────────────────────────────
const STATUS_TONE = { not_submitted: 'neutral', pending: 'warn', approved: 'ok', rejected: 'bad' }
const STATUS_LABEL = { not_submitted: 'Not submitted', pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }

function StepTab({ label, step, active, disabled, onClick }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-t-md border-b-2 px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink'}`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-canvas text-xs font-bold">{step}</span>
      {label}
    </button>
  )
}

function FieldError({ msg }) {
  return msg ? <p className="mt-1 text-xs text-bad-ink">{msg}</p> : null
}

function ServerAlert({ msg }) {
  return msg ? (
    <p role="alert" className="rounded-md bg-bad-bg px-4 py-2 text-sm text-bad-ink">
      {msg}
    </p>
  ) : null
}

function RejectionBanner({ reason }) {
  if (!reason) return null
  return (
    <div className="rounded-md border border-bad-ink/20 bg-bad-bg px-4 py-3 text-sm text-bad-ink">
      <strong>Rejected:</strong> {reason}
    </div>
  )
}

// ── Step 1 form ───────────────────────────────────────────────────────────────
function Step1Form({ data, onSuccess }) {
  const [pan, setPan] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [fssai, setFssai] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverMsg, setServerMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const isApproved = data?.step1?.status === 'approved'
  const isPending = data?.step1?.status === 'pending'

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate1({ pan: pan.trim(), aadhaar: aadhaar.trim(), fssai: fssai.trim() })
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setServerMsg('')
    try {
      const result = await submitProviderStep1({ pan: pan.trim(), aadhaar: aadhaar.trim(), fssai: fssai.trim() || undefined })
      onSuccess(result)
    } catch (err) {
      setServerMsg(err.detail ?? err.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (isApproved) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Your identity documents have been verified.</p>
        {data.step1.pan_masked && <p className="text-sm"><strong>PAN:</strong> {data.step1.pan_masked}</p>}
        {data.step1.aadhaar_masked && <p className="text-sm"><strong>Aadhaar:</strong> {data.step1.aadhaar_masked}</p>}
      </div>
    )
  }

  if (isPending) {
    return <p className="text-sm text-muted">Your submission is under review. We'll notify you once a decision is made.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <RejectionBanner reason={data?.step1?.rejection_reason} />
      <ServerAlert msg={serverMsg} />

      <div>
        <label className="block text-sm font-semibold" htmlFor="pan">PAN *</label>
        <input
          id="pan"
          className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="ABCDE1234F"
          maxLength={10}
          autoComplete="off"
        />
        <FieldError msg={fieldErrors.pan} />
      </div>

      <div>
        <label className="block text-sm font-semibold" htmlFor="aadhaar">Aadhaar number *</label>
        <input
          id="aadhaar"
          className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
          value={aadhaar}
          onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
          placeholder="123456789012"
          maxLength={12}
          autoComplete="off"
          inputMode="numeric"
        />
        <FieldError msg={fieldErrors.aadhaar} />
      </div>

      <div>
        <label className="block text-sm font-semibold" htmlFor="fssai">FSSAI licence <span className="font-normal text-muted">(optional — restaurants &amp; caterers)</span></label>
        <input
          id="fssai"
          className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
          value={fssai}
          onChange={(e) => setFssai(e.target.value.replace(/\D/g, ''))}
          placeholder="12345678901234"
          maxLength={14}
          autoComplete="off"
          inputMode="numeric"
        />
        <FieldError msg={fieldErrors.fssai} />
      </div>

      <Button type="submit" variant="dark" disabled={busy}>
        {busy ? 'Submitting…' : (data?.step1?.status === 'rejected' ? 'Resubmit' : 'Submit')}
      </Button>
    </form>
  )
}

// ── Step 2 form ───────────────────────────────────────────────────────────────
function Step2Form({ data, onSuccess }) {
  const [file, setFile] = useState(null)
  const [serverMsg, setServerMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const isPending = data?.step2?.status === 'pending'
  const isApproved = data?.step2?.status === 'approved'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setServerMsg('')
    try {
      const result = await submitProviderStep2({ document: file })
      onSuccess(result)
    } catch (err) {
      setServerMsg(err.detail ?? err.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (isApproved) return <p className="text-sm text-muted">Your business document has been verified. You're all set!</p>
  if (isPending) return <p className="text-sm text-muted">Your document is under review.</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <RejectionBanner reason={data?.step2?.rejection_reason} />
      <ServerAlert msg={serverMsg} />
      <div>
        <label className="block text-sm font-semibold" htmlFor="biz-doc">Business registration document *</label>
        <input
          id="biz-doc"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="mt-1 block text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-muted">PDF, JPG, or PNG · max 5 MB</p>
      </div>
      <Button type="submit" variant="dark" disabled={busy || !file}>
        {busy ? 'Uploading…' : (data?.step2?.status === 'rejected' ? 'Resubmit document' : 'Upload document')}
      </Button>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProviderVerificationPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState(1)

  const load = useCallback(async () => {
    try {
      const d = await getProviderVerification()
      setData(d)
    } catch (err) {
      setError(err.detail ?? err.message ?? 'Failed to load verification status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const step1Status = data?.step1?.status ?? 'not_submitted'
  const step2Status = data?.step2?.status ?? 'not_submitted'
  const step2Disabled = step1Status !== 'approved'

  function handleSuccess(updated) {
    setData(updated)
  }

  if (loading) return <LoadingState label="Loading verification status…" />

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Provider Verification</h1>

      <p className="text-sm text-muted">
        <strong>Note:</strong> General (home kitchen) providers do not need verification.
        Restaurant and caterer accounts complete two steps before listing food.
      </p>

      {error && <p role="alert" className="rounded-md bg-bad-bg px-4 py-2 text-sm text-bad-ink">{error}</p>}

      {/* Overall status */}
      {data && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-muted">Overall status:</span>
          <Badge tone={STATUS_TONE[data.overall] ?? 'neutral'}>{STATUS_LABEL[data.overall] ?? data.overall}</Badge>
        </div>
      )}

      {/* Step tabs */}
      <div role="tablist" className="flex border-b border-line">
        <StepTab label="Identity documents" step={1} active={activeStep === 1} disabled={false} onClick={() => setActiveStep(1)} />
        <StepTab
          label="Business document"
          step={2}
          active={activeStep === 2}
          disabled={step2Disabled}
          onClick={() => !step2Disabled && setActiveStep(2)}
        />
      </div>

      {/* Step content */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {activeStep === 1 ? 'Step 1 — Identity documents' : 'Step 2 — Business document'}
          </h2>
          <Badge tone={STATUS_TONE[activeStep === 1 ? step1Status : step2Status]}>
            {STATUS_LABEL[activeStep === 1 ? step1Status : step2Status]}
          </Badge>
        </div>

        {activeStep === 1
          ? <Step1Form data={data} onSuccess={handleSuccess} />
          : <Step2Form data={data} onSuccess={handleSuccess} />}
      </Card>

      {step2Disabled && activeStep === 2 && (
        <p role="alert" className="text-sm text-muted">Step 2 is available only after Step 1 is approved.</p>
      )}
    </main>
  )
}
