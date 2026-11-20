import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { OSM_ATTRIBUTION, OSM_TILES } from './leafletSetup'

function Recenter({ position }) {
  const map = useMap()
  const [lat, lng] = position
  useEffect(() => {
    map.setView([lat, lng], map.getZoom())
  }, [map, lat, lng])
  return null
}

function ClickToMove({ onMove }) {
  useMapEvents({ click: (e) => onMove(e.latlng.lat, e.latlng.lng) })
  return null
}

/** Map with a draggable pin; calls onMove(lat, lng) when the pin is dragged or the map is clicked. */
export default function PinMap({ lat, lng, onMove }) {
  const markerRef = useRef(null)
  const handlers = useMemo(
    () => ({
      dragend() {
        const p = markerRef.current?.getLatLng()
        if (p) onMove(p.lat, p.lng)
      },
    }),
    [onMove],
  )
  return (
    <div className="h-64 overflow-hidden rounded-card" data-testid="pin-map">
      <MapContainer center={[lat, lng]} zoom={14} className="h-full w-full">
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} />
        <Recenter position={[lat, lng]} />
        <ClickToMove onMove={onMove} />
        <Marker draggable position={[lat, lng]} ref={markerRef} eventHandlers={handlers} />
      </MapContainer>
    </div>
  )
}
