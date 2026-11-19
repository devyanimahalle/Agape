const TONE = {
  neutral: 'bg-canvas text-ink border-line',
  ok: 'bg-ok-bg text-ok-ink border-transparent',
  warn: 'bg-warn-bg text-warn-ink border-transparent',
  bad: 'bg-bad-bg text-bad-ink border-transparent',
  highlight: 'bg-highlight text-ink border-transparent',
}

export default function Badge({ tone = 'neutral', className = '', ...props }) {
  return (
    <span
      className={`inline-block rounded-pill border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone] ?? TONE.neutral} ${className}`}
      {...props}
    />
  )
}
