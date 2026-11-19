import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BowlIcon, ClipboardCheckIcon, HeartIcon, ParcelIcon, ShieldCheckIcon, StorefrontIcon } from './icons'

const ICONS = { BowlIcon, ShieldCheckIcon, ParcelIcon, HeartIcon, StorefrontIcon, ClipboardCheckIcon }
const svgOf = (Icon) => render(<Icon />).container.querySelector('svg')

describe.each(Object.entries(ICONS))('%s', (name, Icon) => {
  it('is a decorative svg on the 24px grid with one stroke construction', () => {
    const svg = svgOf(Icon)
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
    expect(svg).toHaveAttribute('fill', 'none')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('stroke-width', '2')
    expect(svg).toHaveAttribute('stroke-linecap', 'round')
    expect(svg).toHaveAttribute('stroke-linejoin', 'round')
  })

  it('is built from plain primitives only, with no per-shape stroke overrides', () => {
    const svg = svgOf(Icon)
    const shapes = [...svg.children]
    expect(shapes.length).toBeGreaterThan(0)
    for (const el of shapes) {
      expect(['path', 'rect', 'line', 'circle']).toContain(el.tagName)
      for (const attr of ['stroke', 'stroke-width', 'fill', 'style', 'opacity', 'transform', 'filter']) {
        expect(el.hasAttribute(attr), `${name} <${el.tagName}> has ${attr}`).toBe(false)
      }
    }
  })

  it('keeps every shape inside the 24px grid with whole-number or half-step coordinates', () => {
    const svg = svgOf(Icon)
    const numbers = [...svg.querySelectorAll('[d],[x],[y],[x1],[y1],[x2],[y2],[width],[height],[r],[cx],[cy]')]
      .flatMap((el) => [...el.attributes].filter((a) => /^(d|x|y|x1|y1|x2|y2|width|height|r|cx|cy)$/.test(a.name)).map((a) => a.value))
      .join(' ')
      .match(/-?\d+(\.\d+)?/g)
      .map(Number)
    expect(numbers.length).toBeGreaterThan(4)
    for (const n of numbers) expect(Number.isInteger(n * 2), `${name}: ${n}`).toBe(true)
  })

  it('takes its colour from the tile (currentColor) and has no shadow', () => {
    const html = render(<Icon />).container.innerHTML
    expect(html).not.toMatch(/#[0-9a-f]{3,6}|rgb\(|shadow|filter/i)
  })

  it('accepts a size class', () => {
    expect(render(<Icon className="h-9 w-9" />).container.querySelector('svg')).toHaveClass('h-9', 'w-9')
  })
})

describe('the icon set', () => {
  it('has six icons that are all different', () => {
    const markup = Object.values(ICONS).map((Icon) => svgOf(Icon).innerHTML)
    expect(new Set(markup).size).toBe(6)
  })
})
