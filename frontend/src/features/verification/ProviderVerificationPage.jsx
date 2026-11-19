import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button, Badge, Card, LoadingState } from '../../components/ui'
import { getProviderVerification, submitProviderVerification } from './api'
import Page from './components/Page'
import {
  FieldError, ServerAlert, RejectionBanner, STATUS_TONE, STATUS_LABEL,
  inputCls, labelCls, fileCls,
} from './components/fields'

// ── Validators (mirror the backend's checks) ──────────────────────────────────
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const AADHAAR_RE = /^\d{12}$/
const FSSAI_RE = /^\d{14}$/

function validate1({ entity, pan, aadhaar, file }) {
  const errs = {}
  if (!entity) errs.entity = 'Business name is required'
  if (!file) errs.file = 'Upload your business registration document'
  if (!PAN_RE.test(pan)) errs.pan = 'PAN must be 10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)'
  if (!AADHAAR_RE.test(aadhaar)) errs.aadhaar = 'Aadhaar must be exactly 12 digits'
  return errs
}

function validate2({ fssai, file }) {
  const errs = {}
  if (!FSSAI_RE.test(fssai)) errs.fssai = 'FSSAI licence must be exactly 14 digits'
  if (!file) errs.file = 'Upload your FSSAI certificate'
  return errs
}

const FILE_HINT = 'PDF, JPG or PNG. Stored privately and only visible to admins.'

// ── Step tabs ─────────────────────────────────────────────────────────────────
function StepTab({ label, step, active, disabled, onClick }) {
  return (
    <Button
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      variant={active ? 'brand' : 'dark'}
      className="!px-5 !py-2"
    >
      {step}. {label}
    </Button>
  )
}

// ── Step 1: identity and business. Nothing is sent yet; it is held until step 2 is submitted. ──
function Step1Form({ draft, onContinue }) {
  const [entity, setEntity] = useState(draft?.entity ?? '')
  const [pan, setPan] = useState(draft?.pan ?? '')
  const [aadhaar, setAadhaar] = useState(draft?.aadhaar ?? '')
  const [file, setFile] = useState(draft?.file ?? null)
  const [fieldErrors, setFieldErrors] = useState({})

  function handleSubmit(e) {
    e.preventDefault()
    const values = { entity: entity.trim(), pan: pan.trim(), aadhaar: aadhaar.trim(), file }
    const errs = validate1(values)
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    onContinue(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label className={labelCls} htmlFor="entity">Business name *</label>
        <input id="entity" className={inputCls} value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="Ravi's Kitchen" autoComplete="organization" />
        <FieldError msg={fieldErrors.entity} />
      </div>

      <div>
        <label className={labelCls} htmlFor="biz-proof">Business registration document *</label>
        <input id="biz-proof" type="file" accept=".pdf,.jpg,.jpeg,.png" className={fileCls} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="mt-1.5 text-xs text-muted">{file ? `Selected: ${file.name}. ` : ''}{FILE_HINT}</p>
        <FieldError msg={fieldErrors.file} />
      </div>

      <div>
        <label className={labelCls} htmlFor="pan">PAN *</label>
        <input
          id="pan"
          className={`${inputCls} uppercase tracking-widest`}
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="ABCDE1234F"
          maxLength={10}
          autoComplete="off"
        />
        <FieldError msg={fieldErrors.pan} />
      </div>

      <div>
        <label className={labelCls} htmlFor="aadhaar">Aadhaar number *</label>
        <input
          id="aadhaar"
          className={`${inputCls} tracking-widest`}
          value={aadhaar}
          onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
          placeholder="123456789012"
          maxLength={12}
          autoComplete="off"
          inputMode="numeric"
        />
        <p className="mt-1.5 text-xs text-muted">Only the last four digits are kept. The full number is never stored or shown.</p>
        <FieldError msg={fieldErrors.aadhaar} />
      </div>

      <Button type="submit" variant="brand">Continue to step 2</Button>
    </form>
  )
}

// ── Step 2: FSSAI. Submitting sends BOTH steps together as one request. ──
function Step2Form({ draft, onBack, onSubmitted }) {
  const [fssai, setFssai] = useState('')
  const [file, setFile] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverMsg, setServerMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const values = { fssai: fssai.trim(), file }
    const errs = validate2(values)
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setServerMsg('')
    try {
      const result = await submitProviderVerification({
        entity_name: draft.entity,
        business_proof: draft.file,
        pan: draft.pan,
        aadhaar: draft.aadhaar,
        fssai_number: values.fssai,
        fssai_cert: file,
      })
      onSubmitted(result)
    } catch (err) {
      setServerMsg(err.detail ?? err.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <p className="rounded-[6px] bg-canvas px-4 py-3 text-sm">
        Step 1 is ready for <strong>{draft.entity}</strong>. Add the FSSAI details and submit once: an admin reviews
        both steps together.
      </p>
      <ServerAlert msg={serverMsg} />

      <div>
        <label className={labelCls} htmlFor="fssai">FSSAI licence number *</label>
        <input
          id="fssai"
          className={`${inputCls} tracking-widest`}
          value={fssai}
          onChange={(e) => setFssai(e.target.value.replace(/\D/g, ''))}
          placeholder="12345678901234"
          maxLength={14}
          autoComplete="off"
          inputMode="numeric"
        />
        <p className="mt-1.5 text-xs text-muted">The number gets a format check, then an admin reviews it. This is not an official FSSAI verification.</p>
        <FieldError msg={fieldErrors.fssai} />
      </div>

      <div>
        <label className={labelCls} htmlFor="fssai-cert">FSSAI certificate *</label>
        <input id="fssai-cert" type="file" accept=".pdf,.jpg,.jpeg,.png" className={fileCls} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="mt-1.5 text-xs text-muted">{FILE_HINT}</p>
        <FieldError msg={fieldErrors.file} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="brand" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</Button>
        <Button variant="ghost" onClick={onBack} disabled={busy}>Back to step 1</Button>
      </div>
    </form>
  )
}

function Detail({ label, children }) {
  return (
    <div className="rounded-[6px] bg-canvas px-4 py-3">
      <dt className="text-xs uppercase tracking-[1px] text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{children}</dd>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const SUBTITLE = 'Every donor is verified by an admin before listing food. One request covers your identity, business and FSSAI details.'

export default function ProviderVerificationPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState(1)
  const [draft, setDraft] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await getProviderVerification())
    } catch (err) {
      setError(err.detail ?? err.message ?? 'Failed to load verification status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Page title="Verification" subtitle={SUBTITLE} width="max-w-3xl"><LoadingState label="Loading verification status…" /></Page>

  const status = data?.status ?? 'not_submitted'
  const submitted = status === 'pending' || status === 'approved'

  return (
    <Page title="Verification" subtitle={SUBTITLE} width="max-w-3xl">
      {error && <p role="alert" className="mb-6 rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">{error}</p>}

      {data && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[1px] text-muted">Status</span>
          <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>
        </div>
      )}

      {submitted ? (
        <Card className="p-7 md:p-9">
          <h2 className="text-3xl md:text-4xl">{status === 'approved' ? 'You are verified' : 'Under review'}</h2>
          <p className="mt-3 text-sm text-muted">
            {status === 'approved'
              ? 'An admin approved your request. You can now list surplus food.'
              : 'Your identity, business and FSSAI details were sent as one request. Listings unlock once an admin approves it.'}
          </p>
          <dl className="mt-5 grid gap-2 sm:grid-cols-2">
            {data.entity_name && <Detail label="Business name">{data.entity_name}</Detail>}
            {data.masked_pan && <Detail label="PAN">{data.masked_pan}</Detail>}
            {data.masked_aadhaar && <Detail label="Aadhaar">{data.masked_aadhaar}</Detail>}
            {data.fssai_number && <Detail label="FSSAI number">{data.fssai_number}</Detail>}
          </dl>
        </Card>
      ) : (
        <>
          <div role="tablist" aria-label="Verification steps" className="mb-3 flex flex-wrap gap-2">
            <StepTab label="Identity and business" step={1} active={activeStep === 1} onClick={() => setActiveStep(1)} />
            <StepTab label="FSSAI licence" step={2} active={activeStep === 2} disabled={!draft} onClick={() => draft && setActiveStep(2)} />
          </div>

          <Card className="p-7 md:p-9">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-3xl md:text-4xl">
                {activeStep === 1 ? 'Step 1: Identity and business' : 'Step 2: FSSAI licence'}
              </h2>
              <Badge tone={draft && activeStep === 1 ? 'ok' : 'neutral'}>
                {activeStep === 1 ? (draft ? 'Ready' : 'To do') : 'Last step'}
              </Badge>
            </div>

            <div className="space-y-5">
              {status === 'rejected' && <RejectionBanner reason={data?.rejection_reason || 'Your last request was not approved. Please resubmit.'} />}
              {activeStep === 1 ? (
                <Step1Form draft={draft} onContinue={(values) => { setDraft(values); setActiveStep(2) }} />
              ) : (
                <Step2Form draft={draft} onBack={() => setActiveStep(1)} onSubmitted={setData} />
              )}
            </div>
          </Card>

          {!draft && <p className="mt-4 text-sm text-muted">Step 2 unlocks once step 1 is complete.</p>}
        </>
      )}

      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-2xl md:text-3xl">Surplus listings</h2>
          <p className="mt-1 text-sm text-muted">
            {status === 'approved' ? 'Post the food you have to give and see what you have listed.' : 'Listings unlock after an admin approves your request.'}
          </p>
        </div>
        <Link to="/provider/listings" className="press rounded-[6px] bg-ink px-6 py-3 text-sm font-bold uppercase tracking-[1px] text-canvas hover:bg-toast">
          Open listings
        </Link>
      </Card>
    </Page>
  )
}
