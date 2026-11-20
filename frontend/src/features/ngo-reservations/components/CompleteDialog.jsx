import { useState } from 'react'
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
      <form onSubmit={submit} className="space-y-3 text-sm">
        <p className="text-gray-700">Upload at least one proof of collection: a geotagged photo or a signed letter (PDF, JPG or PNG, up to 10 MB each).</p>
        <label className="block">
          <span className="mb-1 block font-medium">Proof of pickup</span>
          <input type="file" multiple accept="image/jpeg,image/png,application/pdf" onChange={add} aria-label="Proof files" />
        </label>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1">
                <span className="truncate">{f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <label className="block">
          <span className="mb-1 block font-medium">Note (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} className="w-full rounded border px-2 py-1" />
        </label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded border px-3 py-1.5">Cancel</button>
          <button type="submit" disabled={busy || files.length === 0} className="rounded bg-green-700 px-3 py-1.5 text-white disabled:opacity-60">
            {busy ? 'Uploading…' : 'Confirm pickup'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
