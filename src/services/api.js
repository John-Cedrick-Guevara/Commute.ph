/**
 * API service — all calls go through Vite's proxy to the Express backend.
 * In development: Vite proxies /api → http://localhost:3001
 * In production:  deploy Express and set VITE_API_URL accordingly.
 */

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }

  return res.json()
}

/**
 * Search Marikina locations by query string.
 * GET /api/locations?q=<query>
 */
export async function searchLocations(query) {
  return request(`/locations?q=${encodeURIComponent(query)}`)
}

/**
 * Calculate fare estimate.
 * POST /api/fares/calculate
 */
export async function calculateFare({ from, to, transport, passengerType }) {
  return request('/fares/calculate', {
    method: 'POST',
    body: JSON.stringify({ from, to, transport, passengerType }),
  })
}

/**
 * Fetch the full fare matrix (for reference / display).
 * GET /api/fares/matrix
 */
export async function getFareMatrix() {
  return request('/fares/matrix')
}
