import { useEffect, useId } from 'react'

/** Accessible dialog on the Agape surface: white card, toast-tinted backdrop. z-index sits above Leaflet panes. */
export default function Modal({ title, onClose, children }) {
  const titleId = useId()
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-toast/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-card bg-panel p-6">
        <h2 id={titleId} className="text-3xl leading-none">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
