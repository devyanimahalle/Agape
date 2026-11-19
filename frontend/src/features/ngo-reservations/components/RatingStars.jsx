/** Read-only star display, e.g. "★ 4.6 (12)". */
export default function RatingStars({ avg, count }) {
  if (avg === null || avg === undefined) return null
  return (
    <span className="text-sm text-amber-600" aria-label={`Provider rating ${avg.toFixed(1)} out of 5 from ${count} ratings`}>
      ★ {avg.toFixed(1)} <span className="text-gray-500">({count})</span>
    </span>
  )
}
