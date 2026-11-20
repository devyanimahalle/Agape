import Badge from './Badge'

// Listing / reservation / review statuses. Wording is deliberately plain and does not over-claim.
const STATUS = {
  listed: { label: 'Available', tone: 'ok' },
  reserved: { label: 'Reserved', tone: 'warn' },
  completed: { label: 'Collected', tone: 'ok' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'bad' },
  pending: { label: 'Awaiting admin review', tone: 'warn' },
  verified: { label: 'Admin-verified', tone: 'ok' },
  rejected: { label: 'Not approved', tone: 'bad' },
}

export default function StatusPill({ status }) {
  const s = STATUS[status] ?? { label: String(status), tone: 'neutral' }
  return <Badge tone={s.tone}>{s.label}</Badge>
}
