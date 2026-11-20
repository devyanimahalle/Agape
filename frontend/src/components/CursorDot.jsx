import { useEffect, useRef, useState } from 'react'

const FINE_POINTER = '(hover: hover) and (pointer: fine)'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const INTERACTIVE = 'a, button, [role="button"], [role="menuitem"], [role="tab"], input, select, textarea, label, summary'
const EASE = 0.2 // how much of the remaining distance the dot covers each frame: smaller is lazier

// Only a mouse-like pointer that can hover gets the dot, and never when the visitor asked for reduced motion.
function wantsDot() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(FINE_POINTER).matches && !window.matchMedia(REDUCED_MOTION).matches
}

function useWantsDot() {
  const [wanted, setWanted] = useState(wantsDot)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const lists = [window.matchMedia(FINE_POINTER), window.matchMedia(REDUCED_MOTION)]
    const update = () => setWanted(wantsDot())
    lists.forEach((m) => m.addEventListener?.('change', update))
    return () => lists.forEach((m) => m.removeEventListener?.('change', update))
  }, [])
  return wanted
}

// A small orange dot that trails the mouse with easing. It is decoration only: aria-hidden, pointer-events none
// (see .cursor-dot in styles/index.css), hidden on touch and coarse pointers, and absent under reduced motion.
export default function CursorDot() {
  const wanted = useWantsDot()
  const ref = useRef(null)

  useEffect(() => {
    if (!wanted) return undefined
    const el = ref.current
    if (!el) return undefined
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    let raf = 0
    let seen = false

    const paint = () => { el.style.transform = `translate3d(${x}px, ${y}px, 0)` }
    const tick = () => {
      x += (tx - x) * EASE
      y += (ty - y) * EASE
      paint()
      raf = Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1 ? requestAnimationFrame(tick) : 0
    }
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick) }

    const onMove = (e) => {
      tx = e.clientX
      ty = e.clientY
      if (!seen) { // first movement: appear under the pointer instead of sweeping in from the corner
        seen = true
        x = tx
        y = ty
        paint()
        el.dataset.visible = 'true'
      }
      wake()
    }
    const onOver = (e) => { el.dataset.hover = e.target instanceof Element && e.target.closest(INTERACTIVE) ? 'true' : 'false' }
    const onLeave = () => { el.dataset.visible = 'false' }
    const onEnter = () => { if (seen) el.dataset.visible = 'true' }
    const onDown = () => { el.dataset.down = 'true' }
    const onUp = () => { el.dataset.down = 'false' }

    document.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseover', onOver, { passive: true })
    document.addEventListener('mousedown', onDown, { passive: true })
    document.addEventListener('mouseup', onUp, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    document.documentElement.addEventListener('mouseenter', onEnter)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('mouseup', onUp)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      document.documentElement.removeEventListener('mouseenter', onEnter)
    }
  }, [wanted])

  if (!wanted) return null
  return (
    <div ref={ref} aria-hidden="true" data-testid="cursor-dot" data-visible="false" data-hover="false" data-down="false" className="cursor-dot">
      <span className="cursor-dot-inner" />
    </div>
  )
}
