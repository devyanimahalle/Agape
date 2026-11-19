/** Read-only star display, e.g. "★ 4.6 (12)". Ink on a pale chip so it stays readable (no amber text on white). */
export default function RatingStars({ avg, count }) {
  if (avg === null || avg === undefined) return null
  return (
    <span className="ml-1 inline-block rounded-pill bg-highlight px-2 py-0.5 text-xs font-semibold text-ink" aria-label={`Provider rating ${avg.toFixed(1)} out of 5 from ${count} ratings`}>
      ★ {avg.toFixed(1)} <span className="font-normal">({count})</span>
    </span>
  )
}
