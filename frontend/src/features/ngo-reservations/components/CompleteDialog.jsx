import { useState } from 'react'
import { Button } from '../../../components/ui'
import { validateProofFiles } from '../utils'
import Modal from './Modal'

/** Complete pickup: at least one proof (geotagged photo or letter) is required, in the same request. */
export default function CompleteDialog({ listing, onSubmit, onCancel }) {
  const [files, setFiles] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const add = (e) => {
    setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
    setError(null)
    e.target.value = ''
  }

  async function submit(e) {
    e.preventDefault()
    const problem = validateProofFiles(files)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(files, note.trim())
    } catch (err) {
      setError(err.detail ?? 'Could not complete the pickup.')
      setBusy(false)
    }
  }

  return (
    <Modal title={`Complete pickup: ${listing.title}`} onClose={busy ? undefined : onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-muted">Upload at least one proof of collection: a geotagged photo or a signed letter (PDF, JPG or PNG, up to 10 MB each).</p>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Proof of pickup</span>
          <input type="file" multiple accept="image/jpeg,image/png,application/pdf" onChange={add} aria-label="Proof files" className="w-full rounded-[6px] bg-canvas px-4 py-3 text-sm file:mr-3 file:rounded-[6px] file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:text-canvas" />
        </label>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-[6px] bg-canvas px-4 py-2">
                <span className="truncate">{f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <label className="block">
          <span className="mb-1.5 block font-semibold">Note (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} className="w-full rounded-[6px] bg-canvas px-4 py-3 focus:bg-panel" />
        </label>
        {error && <p role="alert" className="rounded-[6px] bg-bad-bg px-4 py-3 text-bad-ink">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="brand" disabled={busy || files.length === 0}>
            {busy ? 'Uploading…' : 'Confirm pickup'}
            </Button>
        </div>
      </form>
    </Modal>
  )
}
