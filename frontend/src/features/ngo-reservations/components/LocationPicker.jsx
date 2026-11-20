import { useState } from 'react'
import { Button, Card } from '../../../components/ui'
import * as api from '../api'
import PinMap from './PinMap'

/**
 * Lets the NGO change the point the board is sorted from: search an address (only when the
 * Search button is pressed, per Nominatim's policy) or drag the pin.
 */
export default function LocationPicker({ location, saved, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState(location)

  const startEditing = () => {
    setDraft(location)
    setOpen(true)
  }

  async function search(e) {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 3) {
      setError('Type at least 3 characters.')
      return
    }
    setSearching(true)
    setError(null)
    try {
      const found = await api.geocode(q)
      setResults(found)
      if (found.length === 0) setError('No places found. Try a more specific address.')
    } catch (err) {
      setError(err.detail ?? 'Address search failed.')
    } finally {
      setSearching(false)
    }
  }

  const apply = () => {
    onChange(draft)
    setOpen(false)
  }

  return (
    <Card as="section" aria-label="Sorting location" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Sorting from: <strong>{location?.label ?? 'no location set'}</strong>
        </p>
        {!open && (
          <Button variant="dark" onClick={startEditing} className="!px-4 !py-2">
            Change location
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <form onSubmit={search} className="flex gap-2">
            <input
              aria-label="Search address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an address or area"
              className="min-w-0 flex-1 rounded-[6px] bg-canvas px-4 py-3 focus:bg-panel"
            />
            <Button type="submit" variant="dark" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
              </Button>
          </form>
          {error && <p role="alert" className="rounded-[6px] bg-bad-bg px-4 py-3 text-bad-ink">{error}</p>}
          {results?.length > 0 && (
            <ul className="overflow-hidden rounded-[6px] bg-canvas">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button type="button" className="w-full px-4 py-2.5 text-left hover:bg-canvas-dim" onClick={() => setDraft({ lat: r.lat, lng: r.lng, label: r.label })}>
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {draft && (
            <PinMap
              lat={draft.lat}
              lng={draft.lng}
              onMove={(lat, lng) => setDraft({ lat, lng, label: 'Pinned location' })}
            />
          )}
          <p className="text-xs text-muted">Drag the pin or click the map to fine-tune. Search results © OpenStreetMap contributors.</p>
          <div className="flex flex-wrap justify-end gap-2">
            {saved && (
              <Button variant="dark" onClick={() => { onChange(saved); setOpen(false) }}>
                Use saved location
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="brand" disabled={!draft} onClick={apply}>
              Use this location
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
