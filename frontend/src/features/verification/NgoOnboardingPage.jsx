import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, EmptyState, LoadingState } from '../../components/ui'
import { getNgoVerification, submitNgoOnboarding } from './api'
import Page from './components/Page'
import {
  FieldError, ServerAlert, RejectionBanner, STATUS_TONE, STATUS_LABEL,
  inputCls, labelCls, fileCls,
} from './components/fields'

const SUBTITLE = 'Verified NGOs can browse and reserve surplus food.'

export default function NgoOnboardingPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  const [regNumber, setRegNumber] = useState('')
  const [document, setDocument] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverMsg, setServerMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await getNgoVerification())
    } catch (err) {
      setPageError(err.detail ?? err.message ?? 'Failed to load onboarding status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!regNumber.trim()) errs.regNumber = 'Registration number is required'
    if (!document) errs.document = 'Upload your registration certificate'
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setServerMsg('')
    try {
      setData(await submitNgoOnboarding({ reg_number: regNumber.trim(), document }))
    } catch (err) {
      setServerMsg(err.detail ?? err.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Page title="NGO onboarding" subtitle={SUBTITLE} width="max-w-2xl"><LoadingState label="Loading onboarding status…" /></Page>

  const status = data?.status ?? 'not_submitted'
  const isApproved = status === 'approved'
  const isPending = status === 'pending'

  return (
    <Page title="NGO onboarding" subtitle={SUBTITLE} width="max-w-2xl">
      {pageError && <p role="alert" className="mb-6 rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">{pageError}</p>}

      {data && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[1px] text-muted">Status</span>
          <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>
        </div>
      )}

      {isApproved && (
        <EmptyState title="Onboarding complete">
          Your organisation has been verified. You can now browse and reserve food listings.
        </EmptyState>
      )}

      {isPending && (
        <Card className="p-7 md:p-9">
          <p className="text-sm text-muted">Your application is under review. We will notify you once a decision is made.</p>
          {data?.org_name && <p className="mt-3 text-sm"><strong>Organisation:</strong> {data.org_name}</p>}
          {data?.reg_number && <p className="text-sm"><strong>Registration:</strong> {data.reg_number}</p>}
        </Card>
      )}

      {!isApproved && !isPending && (
        <Card className="p-7 md:p-9">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <RejectionBanner reason={status === 'rejected' ? data?.rejection_reason : null} />
            <ServerAlert msg={serverMsg} />

            <div>
              <label className={labelCls} htmlFor="reg-number">Registration number *</label>
              <input id="reg-number" className={inputCls} value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="REG/2023/001" />
              <FieldError msg={fieldErrors.regNumber} />
            </div>

            <div>
              <label className={labelCls} htmlFor="ngo-doc">Registration certificate *</label>
              <input id="ngo-doc" type="file" accept=".pdf,.jpg,.jpeg,.png" className={fileCls} onChange={(e) => setDocument(e.target.files?.[0] ?? null)} />
              <p className="mt-1.5 text-xs text-muted">PDF, JPG or PNG. Stored privately and only visible to admins.</p>
              <FieldError msg={fieldErrors.document} />
            </div>

            <Button type="submit" variant="brand" disabled={busy}>
              {busy ? 'Submitting…' : (status === 'rejected' ? 'Resubmit application' : 'Submit application')}
            </Button>
          </form>
        </Card>
      )}
    </Page>
  )
}
