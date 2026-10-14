import { useCallback, useEffect, useState } from 'react'

export interface Coords {
  lat: number
  lng: number
}

/** Great-circle distance in metres. */
export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(m: number): string {
  // US-first app: miles/feet. (Locale-aware units can come later.)
  const miles = m / 1609.344
  if (miles < 0.1) return `${Math.round(m * 3.28084)} ft`
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`
}

export function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser doesn’t support location'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? 'Location permission is off' : 'Couldn’t get your location')),
      { timeout: 10_000, maximumAge: 60_000, enableHighAccuracy: true },
    )
  })
}

type Status = 'idle' | 'locating' | 'ready' | 'denied' | 'error' | 'unsupported'

/**
 * Current position, fetched automatically only if permission was already
 * granted (so Home never pops a prompt unasked). `request()` asks explicitly.
 */
export function usePosition() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<Status>('geolocation' in navigator ? 'idle' : 'unsupported')

  const request = useCallback(() => {
    setStatus('locating')
    getPosition()
      .then((c) => {
        setCoords(c)
        setStatus('ready')
      })
      .catch((e: Error) => setStatus(/permission/i.test(e.message) ? 'denied' : 'error'))
  }, [])

  useEffect(() => {
    if (!('geolocation' in navigator) || !navigator.permissions) return
    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        if (cancelled) return
        if (p.state === 'granted') request()
        else if (p.state === 'denied') setStatus('denied')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [request])

  return { coords, status, request }
}
