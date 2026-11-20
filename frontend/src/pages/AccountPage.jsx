import { useAuth, ROLE_LABEL } from '../context/AuthContext'
import { Badge, Card, StatusPill } from '../components/ui'
import PageHeader from '../components/PageHeader'

// The backend reports "approved"; StatusPill calls that "verified".
const PILL = { approved: 'verified' }

function Row({ label, children }) {
  return (
    <div className="rounded-[6px] bg-canvas px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold">{children}</dd>
    </div>
  )
}

export default function AccountPage() {
  const { user, profile, verificationStatus, mock } = useAuth()
  if (!user) return null // ProtectedRoute handles the signed-out state

  return (
    <main>
      <PageHeader title="Account">
        {mock && <p className="inline-block rounded-[6px] bg-ink px-3 py-2 text-canvas">Demo mode: this is a sample session, not a real account.</p>}
      </PageHeader>
      <div className="mx-auto grid max-w-6xl gap-3 px-5 py-12 md:grid-cols-2 md:px-10 md:py-20">
      <Card>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl">{user.name ?? 'Unnamed account'}</h2>
          <Badge>{ROLE_LABEL[user.role] ?? user.role}</Badge>
        </div>
        <dl className="mt-5 grid gap-2">
          {user.email && <Row label="Email">{user.email}</Row>}
          {user.phone && <Row label="Phone">{user.phone}</Row>}
          <Row label="Account ID">{user.id}</Row>
        </dl>
      </Card>

      <Card aria-label="Verification">
        <h2 className="text-2xl">Verification</h2>
        {verificationStatus ? (
          <p className="mt-3">
            <StatusPill status={PILL[verificationStatus] ?? verificationStatus} />
          </p>
        ) : (
          <p className="mt-3 text-muted">
            {user.role === 'admin' ? 'Not applicable for admin accounts.' : 'No verification status is available.'}
          </p>
        )}
        <p className="mt-3 text-sm text-muted">
          NGOs are reviewed by an admin. FSSAI numbers get a format check plus admin review. Documents are stored privately.
        </p>
      </Card>

      {profile && (
        <Card aria-label="Organisation" className="md:col-span-2">
          <h2 className="text-2xl">Organisation</h2>
          <dl className="mt-5 grid gap-2 md:grid-cols-2">
            {profile.org_name && <Row label="Name">{profile.org_name}</Row>}
            {profile.category && <Row label="Category">{profile.category}</Row>}
            {profile.address && <Row label="Address">{profile.address}</Row>}
            {profile.lat != null && profile.lng != null && (
              <Row label="Saved location">
                {Number(profile.lat).toFixed(4)}, {Number(profile.lng).toFixed(4)}
              </Row>
            )}
          </dl>
        </Card>
      )}
      </div>
    </main>
  )
}
