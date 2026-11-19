import { useState } from 'react'
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
      <form onSubmit={submit} className="space-y-3 text-sm">
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onClick={() => setStars(n)}
              className={`text-2xl ${n <= stars ? 'text-amber-500' : 'text-gray-300'}`}
            >
              ★
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block font-medium">Comment (optional)</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} className="w-full rounded border px-2 py-1" />
        </label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded border px-3 py-1.5">Skip</button>
          <button type="submit" disabled={busy || !stars} className="rounded bg-green-700 px-3 py-1.5 text-white disabled:opacity-60">
            {busy ? 'Saving…' : 'Submit rating'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
