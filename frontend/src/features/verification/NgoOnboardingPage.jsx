import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, EmptyState, LoadingState } from '../../components/ui'
import { getNgoVerification, submitNgoOnboarding } from './api'

const STATUS_TONE = { not_submitted: 'neutral', pending: 'warn', approved: 'ok', rejected: 'bad' }
const STATUS_LABEL = { not_submitted: 'Not submitted', pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }

function FieldError({ msg }) {
  return msg ? <p className="mt-1 text-xs text-bad-ink">{msg}</p> : null
}

export default function NgoOnboardingPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Form state
  const [orgName, setOrgName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [document, setDocument] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverMsg, setServerMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await getNgoVerification()
      setData(d)
    } catch (err) {
      setPageError(err.detail ?? err.message ?? 'Failed to load onboarding status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function validate() {
    const errs = {}
    if (!orgName.trim()) errs.orgName = 'Organisation name is required'
    if (!regNumber.trim()) errs.regNumber = 'Registration number is required'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setServerMsg('')
    try {
      const result = await submitNgoOnboarding({
        org_name: orgName.trim(),
        reg_number: regNumber.trim(),
        document: document ?? undefined,
      })
      setData(result)
    } catch (err) {
      setServerMsg(err.detail ?? err.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading onboarding status…" />

  const status = data?.status ?? 'not_submitted'
  const isApproved = status === 'approved'
  const isPending = status === 'pending'

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">NGO Onboarding</h1>

      {pageError && <p role="alert" className="rounded-md bg-bad-bg px-4 py-2 text-sm text-bad-ink">{pageError}</p>}

      {data && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-muted">Status:</span>
          <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>
        </div>
      )}

      {isApproved && (
        <EmptyState title="Onboarding complete 🎉">
          Your organisation has been verified. You can now browse and reserve food listings.
        </EmptyState>
      )}

      {isPending && (
        <Card>
          <p className="text-sm text-muted">
            Your application is under review. We'll notify you once a decision is made.
          </p>
          {data?.org_name && <p className="mt-2 text-sm"><strong>Organisation:</strong> {data.org_name}</p>}
          {data?.reg_number && <p className="text-sm"><strong>Registration:</strong> {data.reg_number}</p>}
          {data?.rejection_reason && (
            <div className="mt-3 rounded-md bg-bad-bg px-4 py-2 text-sm text-bad-ink">
              <strong>Last rejection reason:</strong> {data.rejection_reason}
            </div>
          )}
        </Card>
      )}

      {!isApproved && !isPending && (
        <Card>
          {status === 'rejected' && data?.rejection_reason && (
            <div className="mb-4 rounded-md bg-bad-bg px-4 py-2 text-sm text-bad-ink">
              <strong>Rejected:</strong> {data.rejection_reason}
            </div>
          )}

          {serverMsg && (
            <p role="alert" className="mb-4 rounded-md bg-bad-bg px-4 py-2 text-sm text-bad-ink">
              {serverMsg}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-semibold" htmlFor="org-name">Organisation name *</label>
              <input
                id="org-name"
                className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Asha Foundation"
              />
              <FieldError msg={fieldErrors.orgName} />
            </div>

            <div>
              <label className="block text-sm font-semibold" htmlFor="reg-number">Registration number *</label>
              <input
                id="reg-number"
                className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="REG/2023/001"
              />
              <FieldError msg={fieldErrors.regNumber} />
            </div>

            <div>
              <label className="block text-sm font-semibold" htmlFor="ngo-doc">
                Supporting document <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="ngo-doc"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="mt-1 block text-sm"
                onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-muted">Registration certificate, trust deed, etc. · PDF, JPG, or PNG</p>
            </div>

            <Button type="submit" variant="dark" disabled={busy}>
              {busy ? 'Submitting…' : (status === 'rejected' ? 'Resubmit application' : 'Submit application')}
            </Button>
          </form>
        </Card>
      )}
    </main>
  )
}
