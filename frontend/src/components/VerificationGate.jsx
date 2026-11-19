import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Page from './Page'
import { Badge, Card } from './ui'

const COPY = {
  ngo: {
    to: '/ngo/onboarding',
    cta: 'Go to NGO onboarding',
    title: 'Get verified to see food near you',
    body: 'NGOs are admin-verified before they can see the food board or reserve food.',
  },
  provider: {
    to: '/provider',
    cta: 'Go to verification',
    title: 'Get verified before you list food',
    body: 'Every donor, including home kitchens, is admin-verified before listing food.',
  },
}

const STATE_NOTE = {
  pending: 'Your request is with an admin, or you have not submitted it yet. This page unlocks as soon as it is approved.',
  rejected: 'Your last request was not approved. You can resubmit it.',
}

// Route guard for screens that need an approved account. Demo mode has no real verification, so it passes through.
// The session is re-read once so an approval made while you were signed in unlocks the page without signing out.
export default function VerificationGate({ role, children }) {
  const { mock, verificationStatus, refresh } = useAuth()
  const approved = mock || verificationStatus === 'approved'

  useEffect(() => {
    if (!approved) refresh?.().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (approved) return children
  const c = COPY[role]
  return (
    <Page title="Verification needed" subtitle={c.body} width="max-w-3xl">
      <Card className="p-7 md:p-9">
        <Badge tone="warn">{verificationStatus === 'rejected' ? 'Not approved' : 'Awaiting verification'}</Badge>
        <h2 className="mt-4 text-3xl md:text-4xl">{c.title}</h2>
        <p className="mt-3 leading-relaxed text-muted">{STATE_NOTE[verificationStatus] ?? STATE_NOTE.pending}</p>
        <Link to={c.to} className="press mt-6 inline-block rounded-[6px] bg-brand-bright px-6 py-3 text-sm font-bold uppercase tracking-[1px] text-ink hover:bg-brand">
          {c.cta}
        </Link>
      </Card>
    </Page>
  )
}
