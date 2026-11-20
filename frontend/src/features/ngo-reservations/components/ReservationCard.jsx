import { formatQuantity, formatWindow, isRateable, osmLink } from '../utils'

const BADGE = { reserved: 'bg-amber-100 text-amber-800', completed: 'bg-green-100 text-green-800' }

export default function ReservationCard({ reservation: r, onCancel, onComplete, onRate }) {
  const canRate = r.status === 'completed' && isRateable(r.provider_category) && !r.has_rated
  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm" aria-label={r.title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{r.title}</h3>
          <p className="text-sm text-gray-600">{r.org_name}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${BADGE[r.status] ?? 'bg-gray-100'}`}>{r.status}</span>
      </div>
      <p className="mt-2 text-sm">{formatQuantity(r)} · ≈ {r.est_meals} meals <span className="text-xs text-gray-500">(estimate)</span></p>
      <p className="text-sm text-gray-600">Collect between {formatWindow(r.window_start, r.window_end)}</p>
      <p className="text-sm text-gray-600">
        {r.address}
        {r.lat != null && r.lng != null && (
          <> · <a className="underline" href={osmLink(r.lat, r.lng)} target="_blank" rel="noreferrer">Open map</a></>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {r.status === 'reserved' && (
          <>
            <button type="button" onClick={() => onComplete(r)} className="rounded bg-green-700 px-3 py-1.5 text-sm text-white">Complete pickup</button>
            <button type="button" onClick={() => onCancel(r)} className="rounded border px-3 py-1.5 text-sm">Cancel reservation</button>
          </>
        )}
        {canRate && (
          <button type="button" onClick={() => onRate(r)} className="rounded border px-3 py-1.5 text-sm">Rate provider</button>
        )}
        {r.status === 'completed' && r.has_rated && <span className="text-sm text-gray-500">Rated ✓</span>}
      </div>
    </article>
  )
}
