import { act, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CursorDot from './CursorDot'

const CSS = readFileSync(join(__dirname, '../styles/index.css'), 'utf8')

// matchMedia stub: which media queries currently match
function stubMedia({ fine = true, reduced = false } = {}) {
  window.matchMedia = vi.fn((q) => ({
    matches: q.includes('pointer: fine') ? fine : q.includes('prefers-reduced-motion') ? reduced : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

let frames
beforeEach(() => {
  frames = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  delete window.matchMedia
})
// run the queued animation frames (each may queue the next one)
const flush = (n = 1) => {
  for (let i = 0; i < n; i++) {
    const batch = frames.splice(0)
    act(() => batch.forEach((cb) => cb()))
  }
}
const dot = () => screen.getByTestId('cursor-dot')
const pos = () => /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(dot().style.transform).slice(1).map(Number)

describe('CursorDot', () => {
  it('renders a decorative dot for a fine, hovering pointer', () => {
    stubMedia()
    render(<CursorDot />)
    expect(dot()).toHaveAttribute('aria-hidden', 'true')
    expect(dot()).toHaveClass('cursor-dot')
    expect(dot()).toHaveAttribute('data-visible', 'false')
  })

  it('renders nothing on touch or coarse pointers', () => {
    stubMedia({ fine: false })
    render(<CursorDot />)
    expect(screen.queryByTestId('cursor-dot')).not.toBeInTheDocument()
  })

  it('renders nothing when the visitor prefers reduced motion', () => {
    stubMedia({ reduced: true })
    render(<CursorDot />)
    expect(screen.queryByTestId('cursor-dot')).not.toBeInTheDocument()
  })

  it('renders nothing where matchMedia is unavailable', () => {
    render(<CursorDot />)
    expect(screen.queryByTestId('cursor-dot')).not.toBeInTheDocument()
  })

  it('appears under the pointer on the first move, then trails it with easing (never jumping)', () => {
    stubMedia()
    render(<CursorDot />)
    fireEvent.mouseMove(document, { clientX: 100, clientY: 50 })
    expect(dot()).toHaveAttribute('data-visible', 'true')
    expect(pos()).toEqual([100, 50])

    fireEvent.mouseMove(document, { clientX: 300, clientY: 250 })
    expect(pos()).toEqual([100, 50]) // nothing is painted until a frame runs
    flush()
    const [x1, y1] = pos()
    expect(x1).toBeGreaterThan(100)
    expect(x1).toBeLessThan(300) // lags behind the pointer
    expect(y1).toBeGreaterThan(50)
    expect(y1).toBeLessThan(250)
    flush()
    const [x2] = pos()
    expect(x2).toBeGreaterThan(x1) // keeps closing in on every frame
    flush(80)
    const [xe, ye] = pos()
    expect(xe).toBeCloseTo(300, 0)
    expect(ye).toBeCloseTo(250, 0)
  })

  it('stops requesting frames once it has settled', () => {
    stubMedia()
    render(<CursorDot />)
    fireEvent.mouseMove(document, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(document, { clientX: 20, clientY: 20 })
    flush(120)
    expect(frames).toHaveLength(0)
  })

  it('grows over interactive elements and relaxes over plain ones', () => {
    stubMedia()
    render(<><CursorDot /><button>Press</button><p>Plain</p></>)
    fireEvent.mouseMove(document, { clientX: 5, clientY: 5 })
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Press' }))
    expect(dot()).toHaveAttribute('data-hover', 'true')
    fireEvent.mouseOver(screen.getByText('Plain'))
    expect(dot()).toHaveAttribute('data-hover', 'false')
  })

  it('shrinks while pressed', () => {
    stubMedia()
    render(<CursorDot />)
    fireEvent.mouseDown(document)
    expect(dot()).toHaveAttribute('data-down', 'true')
    fireEvent.mouseUp(document)
    expect(dot()).toHaveAttribute('data-down', 'false')
  })

  it('hides when the pointer leaves the window and returns on re-entry', () => {
    stubMedia()
    render(<CursorDot />)
    fireEvent.mouseMove(document, { clientX: 5, clientY: 5 })
    fireEvent.mouseLeave(document.documentElement)
    expect(dot()).toHaveAttribute('data-visible', 'false')
    fireEvent.mouseEnter(document.documentElement)
    expect(dot()).toHaveAttribute('data-visible', 'true')
  })

  it('removes its listeners on unmount', () => {
    stubMedia()
    const { unmount } = render(<CursorDot />)
    const remove = vi.spyOn(document, 'removeEventListener')
    unmount()
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['mousemove', 'mouseover', 'mousedown', 'mouseup']))
  })
})

describe('motion and cursor styles (styles/index.css)', () => {
  const block = (selector) => {
    const i = CSS.indexOf(selector)
    expect(i, selector).toBeGreaterThan(-1)
    return CSS.slice(i, CSS.indexOf('}', i))
  }

  it('the dot never takes pointer events and is orange', () => {
    expect(block('.cursor-dot {')).toMatch(/pointer-events:\s*none/)
    expect(block('.cursor-dot-inner')).toMatch(/pointer-events:\s*none/)
    expect(block('.cursor-dot-inner')).toMatch(/var\(--color-brand-bright\)/)
    expect(CSS).toMatch(/--color-brand-bright:\s*#f97316/i)
  })

  it('the dot has no drop shadow', () => {
    expect(block('.cursor-dot-inner')).toMatch(/box-shadow:\s*none/)
  })

  it('is hidden on touch and coarse pointers, and under reduced motion', () => {
    expect(CSS).toMatch(/@media \(hover: none\), \(pointer: coarse\) \{ \.cursor-dot \{ display: none; \} \}/)
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.cursor-dot \{ display: none; \}/)
  })

  it('turns off the nav underline, card lift and field transitions under reduced motion', () => {
    const reduced = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)', CSS.indexOf('.cursor-dot-inner')))
    expect(reduced).toMatch(/\.nav-link::after[^{]*\{[^}]*transition: none/)
    expect(reduced).toMatch(/\.card-lift:hover \{ translate: none; \}/)
  })

  it('draws the active route as an underline and previews it on hover', () => {
    expect(block(".nav-link[aria-current='page']::after")).toMatch(/scaleX\(1\)/)
    expect(block('.nav-link:hover::after')).toMatch(/scaleX\(0\.45\)/)
    expect(block('.nav-link::after')).toMatch(/var\(--color-brand-bright\)/)
  })

  it('cards lift with the translate property, not a shadow', () => {
    expect(block('.card-lift:hover')).toMatch(/translate:\s*0 -3px/)
    expect(CSS).not.toMatch(/box-shadow:(?!\s*none)/)
  })
})

describe('hero pickup visual styles', () => {
  it('animates the stages and the window bar, with a static fallback under reduced motion', () => {
    expect(CSS).toMatch(/\.pickup-stage \{[^}]*animation: agape-stage 9s linear infinite/)
    expect(CSS).toMatch(/\.pickup-fill \{[^}]*animation: agape-window 9s linear infinite/)
    const reduced = CSS.slice(CSS.indexOf('@keyframes agape-stage'))
    expect(reduced).toMatch(/\.pickup-stage, \.pickup-fill \{ animation: none; \}/)
    expect(reduced).toMatch(/\.pickup-stage:first-child \{ background: var\(--color-brand-bright\)/)
  })

  it('uses only theme tokens (orange, toast, ink, canvas) for the stage colours', () => {
    const i = CSS.indexOf('@keyframes agape-stage')
    const frames = CSS.slice(i, CSS.indexOf('@keyframes agape-window'))
    expect(frames).toMatch(/var\(--color-brand-bright\)/)
    expect(frames).toMatch(/var\(--color-toast\)/)
    expect(frames).not.toMatch(/#[0-9a-f]{3,6}/i)
  })
})

describe('landing icon tiles styles', () => {
  it('swap colour and pop on card hover, and stay still under reduced motion', () => {
    expect(CSS).toMatch(/\.icon-tile \{ transition: background-color 0\.2s, color 0\.2s, scale 0\.2s/)
    expect(CSS).toMatch(/\.group:hover \.icon-tile \{ scale: 1\.06; \}/)
    const reduced = CSS.slice(CSS.indexOf('.icon-tile {'))
    expect(reduced).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.icon-tile \{ transition: none; \}/)
    expect(reduced).toMatch(/\.group:hover \.icon-tile \{ scale: none; \}/)
  })
})
