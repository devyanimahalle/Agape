// Shared form primitives for the verification screens: filled cream fields, DM Mono labels, status-tinted messages.
export const inputCls = 'mt-1.5 w-full rounded-[6px] bg-canvas px-4 py-3 text-sm font-normal focus:bg-panel'
export const labelCls = 'block text-xs font-semibold uppercase tracking-[1px]'
export const fileCls = 'mt-1.5 block w-full rounded-[6px] bg-canvas px-4 py-3 text-sm font-normal'

export function FieldError({ msg }) {
  return msg ? <p className="mt-1.5 text-xs text-bad-ink">{msg}</p> : null
}

export function ServerAlert({ msg }) {
  return msg ? <p role="alert" className="rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">{msg}</p> : null
}

export function RejectionBanner({ reason, label = 'Rejected' }) {
  if (!reason) return null
  return (
    <div className="rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">
      <strong>{label}:</strong> {reason}
    </div>
  )
}

export const STATUS_TONE = { not_submitted: 'neutral', pending: 'warn', approved: 'ok', rejected: 'bad' }
export const STATUS_LABEL = { not_submitted: 'Not submitted', pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }
