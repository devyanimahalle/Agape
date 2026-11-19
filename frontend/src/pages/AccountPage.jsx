import { useAuth, ROLE_LABEL } from '../context/AuthContext'
import { Badge, Card, StatusPill } from '../components/ui'

// The backend reports "approved"; StatusPill calls that "verified".
const PILL = { approved: 'verified' }

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  )
}

export default function AccountPage() {
  const { user, profile, verificationStatus, mock } = useAuth()
  if (!user) return null // ProtectedRoute handles the signed-out state

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-4xl">Account</h1>

      {mock && (
        <p className="mt-4 rounded-card bg-highlight px-3 py-2 text-ink">
          Demo mode: this is a sample session, not a real account.
        </p>
      )}

      <Card className="mt-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl">{user.name ?? 'Unnamed account'}</h2>
          <Badge>{ROLE_LABEL[user.role] ?? user.role}</Badge>
        </div>
        <dl className="mt-4">
          {user.email && <Row label="Email">{user.email}</Row>}
          {user.phone && <Row label="Phone">{user.phone}</Row>}
          <Row label="Account ID">{user.id}</Row>
        </dl>
      </Card>

      <Card className="mt-4" aria-label="Verification">
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
        <Card className="mt-4" aria-label="Organisation">
          <h2 className="text-2xl">Organisation</h2>
          <dl className="mt-4">
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
    </main>
  )
}
