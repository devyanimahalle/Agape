import { useState } from 'react'
import { Button } from '../../../components/ui'
import Modal from './Modal'

export default function RateDialog({ listing, onSubmit, onCancel }) {
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!stars) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ stars, comment: comment.trim() || null })
    } catch (err) {
      setError(err.detail ?? 'Could not save your rating.')
      setBusy(false)
    }
  }

  return (
    <Modal title={`Rate ${listing.org_name}`} onClose={busy ? undefined : onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onClick={() => setStars(n)}
              className={`press h-11 w-11 rounded-[6px] text-2xl leading-none ${n <= stars ? 'bg-brand-bright text-ink' : 'bg-canvas text-muted'}`}
            >
              ★
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Comment (optional)</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} className="w-full rounded-[6px] bg-canvas px-4 py-3 focus:bg-panel" />
        </label>
        {error && <p role="alert" className="rounded-[6px] bg-bad-bg px-4 py-3 text-bad-ink">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Skip</Button>
          <Button type="submit" variant="brand" disabled={busy || !stars}>
            {busy ? 'Saving…' : 'Submit rating'}
            </Button>
        </div>
      </form>
    </Modal>
  )
}
