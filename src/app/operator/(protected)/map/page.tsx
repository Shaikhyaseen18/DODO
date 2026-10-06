'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import PageHeader from '@/components/operator/layout/PageHeader'

type Coordinates = { lat: number; lng: number }
type Place = Coordinates & { displayName: string }

const defaultCenter: Coordinates = { lat: 20.5937, lng: 78.9629 }
const buttonBase =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50'

async function geocodeAddress(address: string): Promise<Place> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: address.trim(),
    limit: '1',
  })
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!response.ok) {
    throw new Error('Address search is temporarily unavailable. Please try again.')
  }

  const results = await response.json()
  const place = Array.isArray(results) ? results[0] : undefined
  if (!place) {
    throw new Error(`No matching place found for “${address}”.`)
  }

  return {
    lat: Number(place.lat),
    lng: Number(place.lon),
    displayName: place.display_name,
  }
}

async function getDrivingRoute(from: Coordinates, to: Coordinates): Promise<Coordinates[]> {
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
  )
  if (!response.ok) {
    throw new Error('The route service is unavailable right now. Please try again.')
  }

  const data = await response.json()
  const coordinates = data.routes?.[0]?.geometry?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error('No driving route was found between those places.')
  }
  return coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }))
}

function MapCanvas({
  center,
  sourceCoords,
  destinationCoords,
  liveCoords,
  routePath,
  onMapReady,
}: {
  center: Coordinates
  sourceCoords: Coordinates | null
  destinationCoords: Coordinates | null
  liveCoords: Coordinates | null
  routePath: Coordinates[]
  onMapReady: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const routeRef = useRef<Polyline | null>(null)

  useEffect(() => {
    let disposed = false
    let map: LeafletMap | null = null

    import('leaflet').then((L) => {
      if (disposed || !containerRef.current) return

      map = L.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: true,
      }).setView([defaultCenter.lat, defaultCenter.lng], 5)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      mapRef.current = map
      onMapReady()
    })

    return () => {
      disposed = true
      markersRef.current.forEach((marker) => marker.remove())
      routeRef.current?.remove()
      map?.remove()
      mapRef.current = null
    }
  }, [onMapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    import('leaflet').then((L) => {
      if (mapRef.current !== map) return

      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      routeRef.current?.remove()
      routeRef.current = null

      const addMarker = (coords: Coordinates, label: 'A' | 'B' | '•', color: string) => {
        const marker = L.marker([coords.lat, coords.lng], {
          icon: L.divIcon({
            className: 'tourflow-map-marker',
            html: `<span style="background:${color}"><b>${label}</b></span>`,
            iconSize: [34, 42],
            iconAnchor: [17, 42],
          }),
        }).addTo(map)
        marker.bindTooltip(
          `${label === 'A' ? 'Start' : label === 'B' ? 'Destination' : 'Live location'} · ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
          { direction: 'top', offset: [0, -34] }
        )
        markersRef.current.push(marker)
      }

      if (sourceCoords) addMarker(sourceCoords, 'A', '#1a73e8')
      if (destinationCoords) addMarker(destinationCoords, 'B', '#e94235')
      if (liveCoords) addMarker(liveCoords, '•', '#0b57d0')

      if (routePath.length > 1) {
        routeRef.current = L.polyline(
          routePath.map(({ lat, lng }) => [lat, lng]),
          { color: '#1a73e8', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }
        ).addTo(map)
      }

      if (liveCoords) {
        map.setView([liveCoords.lat, liveCoords.lng], Math.max(map.getZoom(), 15))
      } else if (routeRef.current) {
        map.fitBounds(routeRef.current.getBounds(), { padding: [56, 56] })
      } else if (sourceCoords && destinationCoords) {
        map.fitBounds(
          [
            [sourceCoords.lat, sourceCoords.lng],
            [destinationCoords.lat, destinationCoords.lng],
          ],
          { padding: [56, 56] }
        )
      } else if (sourceCoords) {
        map.setView([sourceCoords.lat, sourceCoords.lng], 14)
      } else if (destinationCoords) {
        map.setView([destinationCoords.lat, destinationCoords.lng], 14)
      } else {
        map.setView([center.lat, center.lng], 5)
      }
    })
  }, [center, sourceCoords, destinationCoords, liveCoords, routePath])

  return (
    <div className="relative h-[min(72vh,720px)] min-h-[460px] w-full bg-slate-100">
      <div ref={containerRef} className="absolute inset-0 z-0" aria-label="Interactive OpenStreetMap" />
    </div>
  )
}

export default function MapPage() {
  const [center, setCenter] = useState(defaultCenter)
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [sourceCoords, setSourceCoords] = useState<Coordinates | null>(null)
  const [destinationCoords, setDestinationCoords] = useState<Coordinates | null>(null)
  const [liveCoords, setLiveCoords] = useState<Coordinates | null>(null)
  const [routePath, setRoutePath] = useState<Coordinates[]>([])
  const [status, setStatus] = useState('Search for a place or plan a driving route.')
  const [isLocating, setIsLocating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [journeyActive, setJourneyActive] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  const markMapReady = useCallback(() => setMapReady(true), [])

  useEffect(
    () => () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    },
    []
  )

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Location is not supported by this browser.')
      return
    }

    setIsLocating(true)
    setStatus('Finding your current location...')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude }
        setCenter(position)
        setSource(`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`)
        setSourceCoords(position)
        setDestinationCoords(null)
        setLiveCoords(null)
        setRoutePath([])
        setStatus(`Your location: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`)
        setIsLocating(false)
      },
      (error) => {
        setStatus(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location access or enter an address.'
            : 'Could not determine your location. Try again or enter an address.'
        )
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleFindCoordinates = async () => {
    if (!source.trim()) {
      setStatus('Enter a starting address to find its coordinates.')
      return
    }

    setIsSearching(true)
    setStatus('Searching for the starting address...')
    try {
      const place = await geocodeAddress(source)
      const coords = { lat: place.lat, lng: place.lng }
      setSourceCoords(coords)
      setDestinationCoords(null)
      setLiveCoords(null)
      setRoutePath([])
      setCenter(coords)
      setStatus(`${place.displayName} · ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not find that address.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleFindRoute = async () => {
    if (!source.trim() || !destination.trim()) {
      setStatus('Enter both a starting point and destination.')
      return
    }

    setIsSearching(true)
    setStatus('Finding both places and calculating a driving route...')
    try {
      const start = sourceCoords
        ? { ...sourceCoords, displayName: source }
        : await geocodeAddress(source)
      const end = await geocodeAddress(destination)
      const startCoords = { lat: start.lat, lng: start.lng }
      const endCoords = { lat: end.lat, lng: end.lng }
      const route = await getDrivingRoute(startCoords, endCoords)

      setSourceCoords(startCoords)
      setDestinationCoords(endCoords)
      setRoutePath(route)
      setCenter(startCoords)
      setStatus(`Route found: ${start.displayName} to ${end.displayName}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not find a route.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleStartJourney = () => {
    if (!routePath.length) {
      setStatus('Get directions first, then start your journey.')
      return
    }
    if (!navigator.geolocation) {
      setStatus('Live location is not supported by this browser.')
      return
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    setJourneyActive(true)
    setStatus('Starting live location tracking. Allow location access if prompted...')
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude }
        setLiveCoords(position)
        setCenter(position)
        setStatus(`Journey in progress · Live location ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`)
      },
      (error) => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
        }
        setJourneyActive(false)
        setStatus(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location access to start live tracking.'
            : 'Could not get live location. Check location services and try again.'
        )
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    )
  }

  const handleStopJourney = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setJourneyActive(false)
    setStatus(
      liveCoords
        ? `Journey tracking stopped · Last location ${liveCoords.lat.toFixed(5)}, ${liveCoords.lng.toFixed(5)}`
        : 'Journey tracking stopped.'
    )
  }

  const handleOpenDirections = async () => {
    if (!source.trim() || !destination.trim()) {
      setStatus('Enter both a starting point and destination first.')
      return
    }
    const directionsWindow = window.open('about:blank', '_blank')
    if (!directionsWindow) {
      setStatus('Allow pop-ups to open OpenStreetMap directions in a new tab.')
      return
    }

    setIsSearching(true)
    setStatus('Preparing OpenStreetMap directions...')
    try {
      const start = sourceCoords ?? (await geocodeAddress(source))
      const end = destinationCoords ?? (await geocodeAddress(destination))
      const params = new URLSearchParams({
        engine: 'fossgis_osrm_car',
        route: `${start.lat},${start.lng};${end.lat},${end.lng}`,
      })
      directionsWindow.location.href = `https://www.openstreetmap.org/directions?${params.toString()}`
    } catch (error) {
      directionsWindow.close()
      setStatus(error instanceof Error ? error.message : 'Could not open directions.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="text-slate-900">
      <PageHeader
        title="Map"
        description="Explore the map, find your location, and plan a route."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Explore map</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">OpenStreetMap</p>
            </div>
            <button
              type="button"
              onClick={handleCurrentLocation}
              disabled={isLocating}
              className={`${buttonBase} border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50`}
            >
              {isLocating ? 'Locating…' : '◎  Current location'}
            </button>
          </div>
          <div className="relative">
            <MapCanvas
              center={center}
              sourceCoords={sourceCoords}
              destinationCoords={destinationCoords}
              liveCoords={liveCoords}
              routePath={routePath}
              onMapReady={markMapReady}
            />
            {!mapReady && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 text-sm font-medium text-slate-600">
                Loading interactive map…
              </div>
            )}
            <div className="pointer-events-none absolute left-4 top-4 z-[400] rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-md">
              <span className="mr-1 text-blue-600">●</span> OpenStreetMap
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Plan your trip</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="source-address" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Starting point
                </label>
                <input
                  id="source-address"
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value)
                    setSourceCoords(null)
                    setDestinationCoords(null)
                    setLiveCoords(null)
                    setRoutePath([])
                  }}
                  placeholder="Enter an address or place"
                  autoComplete="street-address"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label htmlFor="destination-address" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Destination
                </label>
                <input
                  id="destination-address"
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value)
                    setDestinationCoords(null)
                    setLiveCoords(null)
                    setRoutePath([])
                  }}
                  placeholder="Where do you want to go?"
                  autoComplete="street-address"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <button
                type="button"
                onClick={handleFindRoute}
                disabled={isSearching || !source.trim() || !destination.trim()}
                className={`${buttonBase} w-full bg-blue-600 text-white shadow-sm hover:bg-blue-700`}
              >
                {isSearching ? 'Finding route…' : 'Get directions'}
              </button>
              <button
                type="button"
                onClick={journeyActive ? handleStopJourney : handleStartJourney}
                disabled={isSearching || (!journeyActive && routePath.length === 0)}
                className={`${buttonBase} w-full ${
                  journeyActive
                    ? 'bg-red-600 text-white shadow-sm hover:bg-red-700'
                    : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                }`}
              >
                {journeyActive ? 'Stop journey' : 'Start journey'}
              </button>
              <button
                type="button"
                onClick={handleFindCoordinates}
                disabled={isSearching || !source.trim()}
                className={`${buttonBase} w-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
              >
                {isSearching ? 'Searching…' : 'Find start coordinates'}
              </button>
              <button
                type="button"
                onClick={handleOpenDirections}
                disabled={!source.trim() || !destination.trim()}
                className={`${buttonBase} w-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
              >
                Open directions in OpenStreetMap
              </button>
            </div>

            {(sourceCoords || destinationCoords) && (
              <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-800">
                {sourceCoords && (
                  <p>
                    <span className="font-semibold text-slate-950">Start:</span>{' '}
                    {sourceCoords.lat.toFixed(6)}, {sourceCoords.lng.toFixed(6)}
                  </p>
                )}
                {destinationCoords && (
                  <p>
                    <span className="font-semibold text-slate-950">Destination:</span>{' '}
                    {destinationCoords.lat.toFixed(6)}, {destinationCoords.lng.toFixed(6)}
                  </p>
                )}
              </div>
            )}
          </section>

          <p
            role="status"
            aria-live="polite"
            className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium leading-6 text-slate-800 shadow-sm"
          >
            {status}
          </p>
          <p className="px-1 text-sm leading-6 text-slate-600">
            Map tiles © OpenStreetMap contributors. Live location is shown only while this page is open and is not saved.
          </p>
        </aside>
      </div>
    </div>
  )
}
