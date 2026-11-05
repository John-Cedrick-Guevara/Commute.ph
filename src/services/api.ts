/**
 * API client for the FastAPI backend (back-end/).
 * In development: Vite proxies /api/* → http://localhost:8000/* (see vite.config.ts)
 * In production:  set VITE_API_URL to the FastAPI origin.
 */

const BASE: string = import.meta.env.VITE_API_URL || '/api'

// ---------------------------------------------------------------- API shapes

export interface Stop {
  id: string
  name: string
  aliases: string[]
  latitude: number
  longitude: number
}

/** PUV type codes as stored in the database (puv_types.code). */
export type PuvType = 'traditional_jeepney' | 'modern_jeepney'

export interface TransportType {
  code: PuvType
  label: string
  has_fare_matrix: boolean
}

export interface FareMatrixInfo {
  id: string
  effective_from: string
  source_name: string
  source_url: string | null
  verified_at: string | null
}

export interface RouteMatch {
  route_id: string
  route_name: string
  puv_type: PuvType
  stops: { stop_id: string; name: string; latitude: number; longitude: number; stop_sequence: number }[]
  distance_km: number | null
  regular_fare: number | null
  discounted_fare: number | null
  fare_matrix_version_id: string | null
}

export interface FareEstimateResponse {
  origin_stop_id: string
  destination_stop_id: string
  puv_type: PuvType
  fare_matrix: FareMatrixInfo | null
  routes: RouteMatch[]
}

// ---------------------------------------------------------------- App shapes

export type PassengerType = 'Regular' | 'Student' | 'Senior Citizen' | 'PWD'

/** What the result card shows: the cheapest priced route for the trip. */
export interface FareResult {
  from: string
  to: string
  transport: PuvType
  passengerType: PassengerType
  routeName: string
  stops: number
  distance: number
  regularFare: number
  discountAmount: number
  total: number
  fareMatrix: FareMatrixInfo
}

// ---------------------------------------------------------------- Requests

async function request<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`)
  } catch (err) {
    // Network failure (server down, offline): the browser only says "Failed to fetch"
    console.error(`GET ${BASE}${path} failed`, err)
    throw new Error("Can't reach the fare server right now. Please try again in a moment.")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // FastAPI errors are { detail: string } or { detail: [{ msg }] } for validation errors
    const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail
    throw new Error(detail || `Request failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

/** Every known stop, sorted by name. GET /v1/stops */
export function getStops(): Promise<Stop[]> {
  return request('/v1/stops')
}

/** The PUV types and whether fares are available for each. GET /v1/transport-types */
export function getTransportTypes(): Promise<TransportType[]> {
  return request('/v1/transport-types')
}

/**
 * Find the fare between two stops. The backend returns every route of the PUV type that
 * connects both stops; the cheapest one with a known fare is shown.
 * GET /v1/fares/estimate
 */
export async function calculateFare({ from, to, transport, transportLabel, passengerType }: {
  from: Stop
  to: Stop
  transport: PuvType
  transportLabel: string
  passengerType: PassengerType
}): Promise<FareResult> {
  const params = new URLSearchParams({
    origin_stop_id: from.id,
    destination_stop_id: to.id,
    puv_type: transport,
  })
  const estimate = await request<FareEstimateResponse>(`/v1/fares/estimate?${params}`)

  if (estimate.fare_matrix === null) {
    throw new Error(`${transportLabel} fares aren't available yet. We're still waiting on an official fare source.`)
  }
  if (estimate.routes.length === 0) {
    throw new Error(`No ${transportLabel} route connects these two stops yet.`)
  }

  const priced = estimate.routes.filter(
    (r): r is RouteMatch & { regular_fare: number; discounted_fare: number; distance_km: number } =>
      r.regular_fare !== null && r.discounted_fare !== null && r.distance_km !== null,
  )
  if (priced.length === 0) {
    throw new Error('The fare for this route is not available yet. Please try again later.')
  }

  const route = priced.reduce((a, b) => (b.regular_fare < a.regular_fare ? b : a))
  const discounted = passengerType !== 'Regular'

  return {
    from: from.name,
    to: to.name,
    transport,
    passengerType,
    routeName: route.route_name,
    stops: route.stops.length,
    distance: route.distance_km,
    regularFare: route.regular_fare,
    discountAmount: discounted ? route.regular_fare - route.discounted_fare : 0,
    total: discounted ? route.discounted_fare : route.regular_fare,
    fareMatrix: estimate.fare_matrix,
  }
}
