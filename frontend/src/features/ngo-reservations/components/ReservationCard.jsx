import { Link } from 'react-router-dom'
import { Badge, Button, Card } from '../../../components/ui'
import { formatQuantity, formatWindow, isRateable, osmLink } from '../utils'

const TONE = { reserved: 'warn', completed: 'ok' }
const proofCls = 'press rounded-[6px] px-6 py-3 text-sm font-bold uppercase tracking-[1px] bg-brand-bright text-ink hover:bg-brand'

export default function ReservationCard({ reservation: r, onCancel, onComplete, onRate }) {
  const canRate = r.status === 'completed' && isRateable(r.provider_category) && !r.has_rated
  const proof = r.proof_status ?? 'none'
  const proofUrl = `/ngo/pickups/${r.id}/proof`
  return (
    <Card as="article" className="p-6" aria-label={r.title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl leading-none md:text-3xl">{r.title}</h3>
          <p className="mt-2 text-muted">{r.org_name}</p>
        </div>
        <Badge tone={TONE[r.status] ?? 'neutral'} className="capitalize">{r.status}</Badge>
      </div>
      <p className="mt-4">{formatQuantity(r)} · ≈ {r.est_meals} meals <span className="text-xs text-muted">(estimate)</span></p>
      <p className="mt-1 text-muted">Collect between {formatWindow(r.window_start, r.window_end)}</p>
      <p className="mt-1 text-muted">
        {r.address}
        {r.lat != null && r.lng != null && (
          <> · <a className="font-semibold text-ink underline underline-offset-4" href={osmLink(r.lat, r.lng)} target="_blank" rel="noreferrer">Open map</a></>
        )}
      </p>
      {r.status === 'completed' && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-[1px] text-muted">Proof of donation</span>
          {proof === 'none' && <Badge tone="warn">Needed</Badge>}
          {proof === 'rejected' && <Badge tone="bad">Not approved, upload again</Badge>}
          {proof === 'pending' && <Badge tone="warn">Awaiting admin review</Badge>}
          {proof === 'approved' && <Badge tone="ok">Approved</Badge>}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {r.status === 'reserved' && (
          <>
            <Button variant="brand" onClick={() => onComplete(r)}>Confirm pickup</Button>
            <Button variant="dark" onClick={() => onCancel(r)}>Cancel reservation</Button>
          </>
        )}
        {r.status === 'completed' && (proof === 'none' || proof === 'rejected') && (
          <Link to={proofUrl} className={proofCls}>Upload proof of donation</Link>
        )}
        {r.status === 'completed' && proof === 'pending' && (
          <Link to={proofUrl} className="press px-3 py-3 text-sm font-bold uppercase tracking-[1px] underline underline-offset-4">Add more files</Link>
        )}
        {canRate && <Button variant="dark" onClick={() => onRate(r)}>Rate provider</Button>}
        {r.status === 'completed' && r.has_rated && <span className="text-muted">Rated</span>}
      </div>
    </Card>
  )
}
