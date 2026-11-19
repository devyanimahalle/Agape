import { countdownTone, formatCountdown, formatDistance, formatQuantity, formatWindow } from '../utils'
import RatingStars from './RatingStars'

const TONE = { ok: 'text-green-700', urgent: 'text-amber-700', closed: 'text-red-700' }

export default function ListingCard({ listing, now, onReserve }) {
  const tone = countdownTone(listing.window_end, now)
  const closed = tone === 'closed'
  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm" aria-label={listing.title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{listing.title}</h3>
          <p className="text-sm text-gray-600">
            {listing.org_name} <RatingStars avg={listing.rating_avg} count={listing.rating_count} />
          </p>
        </div>
        <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs">{formatDistance(listing.distance_km)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Quantity</dt>
        <dd>{formatQuantity(listing)} · {listing.food_type}</dd>
        <dt className="text-gray-500">Estimate</dt>
        <dd>≈ {listing.est_meals} meals · ≈ {listing.est_kg} kg <span className="text-xs text-gray-500">(estimate)</span></dd>
        <dt className="text-gray-500">Collect between</dt>
        <dd>{formatWindow(listing.window_start, listing.window_end)}</dd>
        <dt className="text-gray-500">Address</dt>
        <dd>{listing.address}</dd>
      </dl>
      {listing.notes && <p className="mt-2 text-sm italic text-gray-600">{listing.notes}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className={`text-sm font-medium ${TONE[tone]}`} data-testid="countdown">{formatCountdown(listing.window_end, now)}</span>
        <button type="button" disabled={closed} onClick={() => onReserve(listing)} className="rounded bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">
          Reserve
        </button>
      </div>
    </article>
  )
}
