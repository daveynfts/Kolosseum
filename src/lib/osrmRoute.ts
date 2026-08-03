/**
 * Walking/driving routes via public OSRM (Google-Maps-like polylines).
 * Free demo server — cache aggressively, limit concurrent requests.
 */

export type LatLng = { lat: number; lng: number }

export type RoadRouteResult = {
  /** destination id */
  id: string
  coordinates: [number, number][] // [lng, lat]
  distanceM: number
  durationS: number
  shortLabel: string
  fullLabel: string
  mid: [number, number]
}

const cache = new Map<string, RoadRouteResult>()

function cacheKey(
  profile: string,
  from: LatLng,
  to: LatLng,
  id: string,
): string {
  return `${profile}|${from.lng.toFixed(5)},${from.lat.toFixed(5)}|${to.lng.toFixed(5)},${to.lat.toFixed(5)}|${id}`
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `~${m} phút`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `~${h}h${rm}m` : `~${h}h`
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m / 1000)} km`
}

function midOfCoords(coords: [number, number][]): [number, number] {
  if (!coords.length) return [0, 0]
  const i = Math.floor(coords.length / 2)
  return coords[i]
}

/**
 * Fetch one route. profile: foot | driving | bike
 */
export async function fetchOsrmRoute(
  from: LatLng,
  to: LatLng,
  id: string,
  profile: 'foot' | 'driving' | 'bike' = 'foot',
): Promise<RoadRouteResult | null> {
  const key = cacheKey(profile, from, to, id)
  const hit = cache.get(key)
  if (hit) return hit

  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson`

  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return null
    const j = (await r.json()) as {
      code?: string
      routes?: Array<{
        distance: number
        duration: number
        geometry?: { coordinates?: [number, number][] }
      }>
    }
    if (j.code !== 'Ok' || !j.routes?.[0]?.geometry?.coordinates?.length) {
      return null
    }
    const route = j.routes[0]
    const coordinates = route.geometry!.coordinates as [number, number][]
    const distanceM = Number(route.distance) || 0
    const durationS = Number(route.duration) || 0
    const result: RoadRouteResult = {
      id,
      coordinates,
      distanceM,
      durationS,
      shortLabel: `${formatDistance(distanceM)} · ${formatDuration(durationS)}`,
      fullLabel: `Đường đi: ${formatDistance(distanceM)} · ${formatDuration(durationS)} (đi bộ)`,
      mid: midOfCoords(coordinates),
    }
    cache.set(key, result)
    return result
  } catch {
    return null
  }
}

/**
 * Batch routes with small delay between requests (public OSRM rate limits).
 */
export async function fetchOsrmRoutesBatch(
  from: LatLng,
  destinations: Array<{ id: string; lat: number; lng: number }>,
  profile: 'foot' | 'driving' | 'bike' = 'foot',
  onOne?: (route: RoadRouteResult) => void,
): Promise<RoadRouteResult[]> {
  const out: RoadRouteResult[] = []
  for (let i = 0; i < destinations.length; i++) {
    const d = destinations[i]
    const route = await fetchOsrmRoute(
      from,
      { lat: d.lat, lng: d.lng },
      d.id,
      profile,
    )
    if (route) {
      out.push(route)
      onOne?.(route)
    }
    // gentle throttle
    if (i < destinations.length - 1) {
      await new Promise((r) => setTimeout(r, 120))
    }
  }
  return out
}
