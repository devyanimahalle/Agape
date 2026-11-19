import { useEffect, useRef, useState } from 'react'
import { Button, LoadingState, Modal } from './ui'

// Opens a private document in a dialog with Open-in-new-tab and Download. `fetchUrl(id)` returns a blob URL; it is
// revoked when the dialog closes. Used by the admin verification queue and the admin proof review.
export default function DocumentModal({ docId, fetchUrl, title = 'Document viewer', frameTitle = 'Verification document', filename = 'document', onClose }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const urlRef = useRef(null)

  useEffect(() => {
    if (!docId) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    fetchUrl(docId)
      .then((objUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(objUrl)
          return
        }
        urlRef.current = objUrl
        setUrl(objUrl)
      })
      .catch((err) => {
        if (!cancelled) setError(err.detail ?? err.message ?? 'Could not load document')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [docId, fetchUrl])

  function handleClose() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setUrl(null)
    onClose()
  }

  return (
    <Modal open={!!docId} onClose={handleClose} title={title}>
      {loading && <LoadingState label="Loading document…" />}
      {error && (
        <div className="space-y-3">
          <p className="text-sm text-bad-ink">{error}</p>
          <Button variant="ghost" onClick={handleClose}>Close</Button>
        </div>
      )}
      {url && !loading && !error && (
        <div className="space-y-3">
          <iframe src={url} title={frameTitle} className="h-96 w-full rounded-[6px] bg-canvas" />
          <div className="flex flex-wrap gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button variant="dark">Open in new tab</Button>
            </a>
            <a href={url} download={filename}>
              <Button variant="dark">Download</Button>
            </a>
            <Button variant="ghost" onClick={handleClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
