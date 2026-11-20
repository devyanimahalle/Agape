import Modal from './Modal'

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', busy = false, error, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={busy ? undefined : onCancel}>
      <p className="mb-4 text-sm text-gray-700">{message}</p>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded border px-3 py-1.5 text-sm">Not now</button>
        <button type="button" onClick={onConfirm} disabled={busy} className="rounded bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-60">
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
