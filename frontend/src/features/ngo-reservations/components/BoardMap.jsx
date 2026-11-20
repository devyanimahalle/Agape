import { useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L, { OSM_ATTRIBUTION, OSM_TILES } from './leafletSetup'
import { formatDistance } from '../utils'

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
    else if (points.length === 1) map.setView(points[0], 14)
  }, [map, points])
  return null
}

/** Listings as Leaflet markers around the NGO's sorting location. */
export default function BoardMap({ listings, origin, onReserve }) {
  const withCoords = listings.filter((l) => l.lat != null && l.lng != null)
  const points = [[origin.lat, origin.lng], ...withCoords.map((l) => [l.lat, l.lng])]
  return (
    <div className="h-[480px] overflow-hidden rounded-card" data-testid="board-map">
      <MapContainer center={[origin.lat, origin.lng]} zoom={12} className="h-full w-full">
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} />
        <FitBounds points={points} />
        <CircleMarker center={[origin.lat, origin.lng]} radius={8} pathOptions={{ color: '#111111' }}>
          <Popup>Your sorting location</Popup>
        </CircleMarker>
        {withCoords.map((l) => (
          <Marker key={l.id} position={[l.lat, l.lng]}>
            <Popup>
              <strong>{l.title}</strong>
              <br />
              {l.org_name} · {formatDistance(l.distance_km)}
              <br />
              {l.quantity} {l.unit} (≈ {l.est_meals} meals)
              <br />
              <button type="button" onClick={() => onReserve(l)} className="mt-1 rounded-[6px] bg-brand-bright px-3 py-1.5 text-xs font-bold uppercase tracking-[1px] text-ink">
                Reserve
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
