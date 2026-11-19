import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Card, LoadingState } from '../../components/ui'
import { getProviderVerification, submitProviderStep1, submitProviderStep2 } from './api'
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

function validate2({ entity, fssai, file }) {
  const errs = {}
  if (!entity) errs.entity = 'Business name is required'
  if (!FSSAI_RE.test(fssai)) errs.fssai = 'FSSAI licence must be exactly 14 digits'
  if (!file) errs.file = 'Upload your FSSAI certificate'
  return errs
}

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

const FILE_HINT = 'PDF, JPG or PNG. Stored privately and only visible to admins.'

// ── Step 1 form ───────────────────────────────────────────────────────────────
function Step1Form({ data, onSuccess }) {
  const [entity, setEntity] = useState('')
  const [pan, setPan] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [file, setFile] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverMsg, setServerMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const isApproved = data?.step1?.status === 'approved'
  const isPending = data?.step1?.status === 'pending'

  async function handleSubmit(e) {
    e.preventDefault()
    const values = { entity: entity.trim(), pan: pan.trim(), aadhaar: aadhaar.trim(), file }
    const errs = validate1(values)
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setServerMsg('')
    try {
      const result = await submitProviderStep1({
        entity_name: values.entity,
        business_proof: file,
        pan: values.pan,
        aadhaar: values.aadhaar,
      })
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
    return <p className="text-sm text-muted">Your submission is under review. We will notify you once a decision is made.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <RejectionBanner reason={data?.step1?.rejection_reason} />
      <ServerAlert msg={serverMsg} />

      <div>
        <label className={labelCls} htmlFor="entity">Business name *</label>
        <input id="entity" className={inputCls} value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="Ravi's Kitchen" autoComplete="organization" />
        <FieldError msg={fieldErrors.entity} />
      </div>

      <div>
        <label className={labelCls} htmlFor="biz-proof">Business registration document *</label>
        <input id="biz-proof" type="file" accept=".pdf,.jpg,.jpeg,.png" className={fileCls} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="mt-1.5 text-xs text-muted">{FILE_HINT}</p>
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
        <p className="mt-1.5 text-xs text-muted">Only a masked version is kept. The full number is never stored.</p>
        <FieldError msg={fieldErrors.aadhaar} />
      </div>

      <Button type="submit" variant="brand" disabled={busy}>
        {busy ? 'Submitting…' : (data?.step1?.status === 'rejected' ? 'Resubmit' : 'Submit')}
      </Button>
    </form>
  )
}

// ── Step 2 form ───────────────────────────────────────────────────────────────
function Step2Form({ data, onSuccess }) {
  const [entity, setEntity] = useState('')
  const [fssai, setFssai] = useState('')
  const [file, setFile] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverMsg, setServerMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const isPending = data?.step2?.status === 'pending'
  const isApproved = data?.step2?.status === 'approved'

  async function handleSubmit(e) {
    e.preventDefault()
    const values = { entity: entity.trim(), fssai: fssai.trim(), file }
    const errs = validate2(values)
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setServerMsg('')
    try {
      const result = await submitProviderStep2({ entity_name: values.entity, fssai_number: values.fssai, fssai_cert: file })
      onSuccess(result)
    } catch (err) {
      setServerMsg(err.detail ?? err.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (isApproved) return <p className="text-sm text-muted">Your FSSAI licence has been verified. You are all set.</p>
  if (isPending) return <p className="text-sm text-muted">Your FSSAI certificate is under review.</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <RejectionBanner reason={data?.step2?.rejection_reason} />
      <ServerAlert msg={serverMsg} />

      <div>
        <label className={labelCls} htmlFor="entity2">Business name *</label>
        <input id="entity2" className={inputCls} value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="As printed on the licence" autoComplete="organization" />
        <FieldError msg={fieldErrors.entity} />
      </div>

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
        <p className="mt-1.5 text-xs text-muted">The number is checked for format and then reviewed by an admin.</p>
        <FieldError msg={fieldErrors.fssai} />
      </div>

      <div>
        <label className={labelCls} htmlFor="fssai-cert">FSSAI certificate *</label>
        <input id="fssai-cert" type="file" accept=".pdf,.jpg,.jpeg,.png" className={fileCls} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="mt-1.5 text-xs text-muted">{FILE_HINT}</p>
        <FieldError msg={fieldErrors.file} />
      </div>

      <Button type="submit" variant="brand" disabled={busy}>
        {busy ? 'Uploading…' : (data?.step2?.status === 'rejected' ? 'Resubmit certificate' : 'Upload certificate')}
      </Button>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const SUBTITLE = 'Restaurants and caterers complete two steps before listing food. Home kitchens do not need to.'

export default function ProviderVerificationPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState(1)

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

  const step1Status = data?.step1?.status ?? 'not_submitted'
  const step2Status = data?.step2?.status ?? 'not_submitted'
  const step2Disabled = step1Status !== 'approved'
  const activeStatus = activeStep === 1 ? step1Status : step2Status

  if (loading) return <Page title="Verification" subtitle={SUBTITLE}><LoadingState label="Loading verification status…" /></Page>

  return (
    <Page title="Verification" subtitle={SUBTITLE}>
      {error && <p role="alert" className="mb-6 rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">{error}</p>}

      {data && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[1px] text-muted">Overall status</span>
          <Badge tone={STATUS_TONE[data.overall] ?? 'neutral'}>{STATUS_LABEL[data.overall] ?? data.overall}</Badge>
        </div>
      )}

      <div role="tablist" aria-label="Verification steps" className="mb-3 flex flex-wrap gap-2">
        <StepTab label="Identity and business" step={1} active={activeStep === 1} onClick={() => setActiveStep(1)} />
        <StepTab
          label="FSSAI licence"
          step={2}
          active={activeStep === 2}
          disabled={step2Disabled}
          onClick={() => !step2Disabled && setActiveStep(2)}
        />
      </div>

      <Card className="p-7 md:p-9">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-3xl md:text-4xl">
            {activeStep === 1 ? 'Step 1: Identity and business' : 'Step 2: FSSAI licence'}
          </h2>
          <Badge tone={STATUS_TONE[activeStatus]}>{STATUS_LABEL[activeStatus]}</Badge>
        </div>

        {activeStep === 1
          ? <Step1Form data={data} onSuccess={setData} />
          : <Step2Form data={data} onSuccess={setData} />}
      </Card>

      {step2Disabled && (
        <p className="mt-4 text-sm text-muted">Step 2 unlocks once Step 1 is approved.</p>
      )}
    </Page>
  )
}
