import { useState } from 'react'
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
    <section aria-label="Sorting location" className="rounded-lg border bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Sorting from: <strong>{location?.label ?? 'no location set'}</strong>
        </p>
        {!open && (
          <button type="button" onClick={startEditing} className="rounded border px-2 py-1">
            Change location
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <form onSubmit={search} className="flex gap-2">
            <input
              aria-label="Search address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an address or area"
              className="flex-1 rounded border px-2 py-1"
            />
            <button type="submit" disabled={searching} className="rounded bg-gray-800 px-3 py-1 text-white disabled:opacity-60">
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {results?.length > 0 && (
            <ul className="divide-y rounded border">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button type="button" className="w-full px-2 py-1 text-left hover:bg-gray-50" onClick={() => setDraft({ lat: r.lat, lng: r.lng, label: r.label })}>
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
          <p className="text-xs text-gray-500">Drag the pin or click the map to fine-tune. Search results © OpenStreetMap contributors.</p>
          <div className="flex flex-wrap justify-end gap-2">
            {saved && (
              <button type="button" className="rounded border px-3 py-1" onClick={() => { onChange(saved); setOpen(false) }}>
                Use saved location
              </button>
            )}
            <button type="button" className="rounded border px-3 py-1" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="rounded bg-green-700 px-3 py-1 text-white" disabled={!draft} onClick={apply}>
              Use this location
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
