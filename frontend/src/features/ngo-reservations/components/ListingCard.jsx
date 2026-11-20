import { Badge, Button, Card } from '../../../components/ui'
import { countdownTone, formatCountdown, formatDistance, formatQuantity, formatWindow } from '../utils'
import RatingStars from './RatingStars'

const TONE = { ok: 'text-ok-ink', urgent: 'text-warn-ink', closed: 'text-bad-ink' }

function Row({ label, children }) {
  return (
    <div className="rounded-[6px] bg-canvas px-4 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  )
}

export default function ListingCard({ listing, now, onReserve }) {
  const tone = countdownTone(listing.window_end, now)
  const closed = tone === 'closed'
  return (
    <Card as="article" className="flex flex-col p-6" aria-label={listing.title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl leading-none md:text-3xl">{listing.title}</h3>
          <p className="mt-2 text-muted">
            {listing.org_name} <RatingStars avg={listing.rating_avg} count={listing.rating_count} />
          </p>
        </div>
        <Badge className="whitespace-nowrap">{formatDistance(listing.distance_km)}</Badge>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <Row label="Quantity">{formatQuantity(listing)} · {listing.food_type}</Row>
        <Row label="Estimate">≈ {listing.est_meals} meals · ≈ {listing.est_kg} kg <span className="text-xs text-muted">(estimate)</span></Row>
        <Row label="Collect between">{formatWindow(listing.window_start, listing.window_end)}</Row>
        <Row label="Address">{listing.address}</Row>
      </dl>
      {listing.notes && <p className="mt-3 italic text-muted">{listing.notes}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <span className={`font-semibold ${TONE[tone]}`} data-testid="countdown">{formatCountdown(listing.window_end, now)}</span>
        <Button variant="brand" disabled={closed} onClick={() => onReserve(listing)}>Reserve</Button>
      </div>
    </Card>
  )
}
