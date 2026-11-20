import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { boardItem } from './fixtures'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: ({ attribution }) => <div data-testid="tiles" data-attribution={attribution} />,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  CircleMarker: ({ children }) => <div data-testid="origin">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}))
vi.mock('../components/leafletSetup', () => ({
  default: { latLngBounds: (p) => p },
  OSM_TILES: 'tiles',
  OSM_ATTRIBUTION: '© OpenStreetMap contributors',
}))

import BoardMap from '../components/BoardMap'

describe('BoardMap', () => {
  it('renders one marker per listing with coordinates, OSM attribution and an origin marker', () => {
    const listings = [boardItem({ id: 1 }), boardItem({ id: 2, title: 'Two' }), boardItem({ id: 3, lat: null, lng: null })]
    render(<BoardMap listings={listings} origin={{ lat: 28.6, lng: 77.2 }} onReserve={() => {}} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(2)
    expect(screen.getByTestId('origin')).toBeInTheDocument()
    expect(screen.getByTestId('tiles').dataset.attribution).toMatch(/OpenStreetMap/)
  })

  it('reserves from a marker popup', async () => {
    const onReserve = vi.fn()
    render(<BoardMap listings={[boardItem({ id: 7 })]} origin={{ lat: 28.6, lng: 77.2 }} onReserve={onReserve} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reserve' }))
    expect(onReserve).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }))
  })
})
