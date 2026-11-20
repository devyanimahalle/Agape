import { Button } from '../../../components/ui'
import Modal from './Modal'

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', busy = false, error, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={busy ? undefined : onCancel}>
      <p className="mb-4 text-muted">{message}</p>
      {error && <p role="alert" className="mb-3 rounded-[6px] bg-bad-bg px-4 py-3 text-bad-ink">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Not now</Button>
        <Button variant="brand" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
