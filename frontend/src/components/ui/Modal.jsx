import { useEffect, useId, useRef } from 'react'

// Accessible dialog: Escape and backdrop click close it; focus moves into the dialog when it opens.
export default function Modal({ open, onClose, title, children }) {
  const titleId = useId()
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-toast/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-card border border-line bg-panel p-6 outline-none"
      >
        <h2 id={titleId} className="text-2xl">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
