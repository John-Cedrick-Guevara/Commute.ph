/**
 * API service for the FastAPI backend (back-end/).
 * In development: Vite proxies /api/* → http://localhost:8000/* (see vite.config.js)
 * In production:  set VITE_API_URL to the FastAPI origin.
 */

const BASE = import.meta.env.VITE_API_URL || '/api'

async function request(path) {
  let res
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

  return res.json()
}

/**
 * List every known stop, sorted by name. Returns [{ id, name, aliases, latitude, longitude }].
 * GET /stops/
 */
export async function getStops() {
  return request('/stops/')
}

// Transport choices in the form -> PUV type codes in the API
const PUV_TYPES = {
  Jeepney: 'traditional_jeepney',
  'Beep Jeep': 'modern_jeepney',
}

/**
 * Find the fare between two stops. `from` and `to` are stops from getStops.
 * GET /fair/routes?start_point_id=&end_point_id=
 *
 * The backend returns every route that connects both stops; the cheapest one with a
 * known fare is shown.
 */
export async function calculateFare({ from, to, transport, passengerType }) {
  const params = new URLSearchParams({
    origin_stop_id: from.id,
    destination_stop_id: to.id,
    puv_type: PUV_TYPES[transport],
  })
  const routes = await request(`/fair/routes?${params}`)

  if (routes.length === 0) {
    throw new Error(`No ${transport} route connects these two stops yet.`)
  }

  const priced = routes.filter((r) => r.regular_fare !== null)
  if (priced.length === 0) {
    throw new Error('The fare for this route is not available yet. Please try again later.')
  }

  const route = priced.reduce((a, b) => (b.regular_fare < a.regular_fare ? b : a))
  const discounted = passengerType !== 'Regular'
  const total = discounted ? route.discounted_fare : route.regular_fare

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
    total,
  }
}
