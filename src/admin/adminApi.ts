/**
 * Admin API client: every request carries the signed-in admin's Supabase access token.
 */
import type { PuvType, Stop } from '../services/api'
import { supabase } from './supabase'

const BASE: string = import.meta.env.VITE_API_URL || '/api'

export interface FareRow {
  distance_km: number
  regular_fare: number
  discounted_fare: number
}

export interface Issues {
  errors: string[]
  warnings: string[]
}

export type VersionStatus = 'draft' | 'published' | 'retracted'

export interface VersionSummary {
  id: string
  puv_type: PuvType
  status: VersionStatus
  effective_from: string | null
  source_name: string | null
  source_url: string | null
  source_file_name: string | null
  verified_by: string | null
  verified_at: string | null
  published_at: string | null
  created_at: string
  is_current: boolean
  row_count: number
}

export interface VersionDetail extends VersionSummary {
  rows: FareRow[]
  issues: Issues
  parse_warnings: string[]
}

export interface PublishPreview {
  issues: Issues
  retiring_saved_fares: number
  retire_on: string | null
  takes_effect_now: boolean
}

export interface RouteListItem {
  id: string
  route_name: string
  puv_type: PuvType
  stop_count: number
}

export interface RouteDetail {
  id: string
  route_name: string
  puv_type: PuvType
  stops: { stop_id: string; name: string; stop_sequence: number; distance_from_previous_km: number | null }[]
}

export interface SavedFare {
  id: string
  origin: string
  destination: string
  puv_type: PuvType
  fare_matrix_version_id: string
  fare_matrix_effective_from: string | null
  route_count: number
  cheapest_regular_fare: number | null
  created_at: string
  deleted_at: string | null
}

export type StopInput = Omit<Stop, 'id'>

async function authHeader(): Promise<Record<string, string>> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = await authHeader()
  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  } catch (err) {
    console.error(`${method} ${path} failed`, err)
    throw new Error("Can't reach the server right now. Please try again in a moment.")
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const detail = Array.isArray(data.detail)
      ? data.detail.map((d: { loc?: string[]; msg: string }) => `${d.loc?.slice(1).join('.')}: ${d.msg}`).join('; ')
      : data.detail
    console.error(`${method} ${path} -> ${res.status}`, data)
    throw new Error(detail || `Request failed: ${res.status}`)
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>
}

export const adminApi = {
  // Fare matrices
  listVersions: () => request<VersionSummary[]>('GET', '/v1/admin/fare-matrices'),
  getVersion: (id: string) => request<VersionDetail>('GET', `/v1/admin/fare-matrices/${id}`),
  createDraft: (puv_type: PuvType) => request<VersionDetail>('POST', '/v1/admin/fare-matrices', { puv_type }),
  saveDraft: (id: string, draft: { effective_from: string | null; source_name: string | null; source_url: string | null; rows: FareRow[] }) =>
    request<VersionDetail>('PUT', `/v1/admin/fare-matrices/${id}`, draft),
  deleteDraft: (id: string) => request<void>('DELETE', `/v1/admin/fare-matrices/${id}`),
  uploadPdf: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<VersionDetail>('POST', `/v1/admin/fare-matrices/${id}/source`, form)
  },
  /** Opens the uploaded PDF in a new tab (fetched with the admin token). */
  openPdf: async (id: string) => {
    const res = await fetch(`${BASE}/v1/admin/fare-matrices/${id}/source`, { headers: await authHeader() })
    if (!res.ok) throw new Error('Could not open the PDF.')
    window.open(URL.createObjectURL(await res.blob()), '_blank', 'noopener')
  },
  publishPreview: (id: string) => request<PublishPreview>('GET', `/v1/admin/fare-matrices/${id}/publish-preview`),
  publish: (id: string) => request<VersionDetail>('POST', `/v1/admin/fare-matrices/${id}/publish`),
  retract: (id: string) =>
    request<{ retired_saved_fares: number; restored_saved_fares: number }>('POST', `/v1/admin/fare-matrices/${id}/retract`),

  // Stops
  createStop: (stop: StopInput) => request<Stop>('POST', '/v1/admin/stops', stop),
  updateStop: (id: string, stop: StopInput) => request<Stop>('PUT', `/v1/admin/stops/${id}`, stop),
  deleteStop: (id: string) => request<void>('DELETE', `/v1/admin/stops/${id}`),

  // Routes
  listRoutes: () => request<RouteListItem[]>('GET', '/v1/admin/routes'),
  getRoute: (id: string) => request<RouteDetail>('GET', `/v1/admin/routes/${id}`),
  createRoute: (route: { route_name: string; puv_type: PuvType }) => request<RouteListItem>('POST', '/v1/admin/routes', route),
  updateRoute: (id: string, route: { route_name: string; puv_type: PuvType }) =>
    request<RouteListItem>('PUT', `/v1/admin/routes/${id}`, route),
  deleteRoute: (id: string) => request<void>('DELETE', `/v1/admin/routes/${id}`),
  setRouteStops: (id: string, stop_ids: string[]) => request<RouteDetail>('PUT', `/v1/admin/routes/${id}/stops`, { stop_ids }),

  // Saved fares
  listSavedFares: (includeDeleted: boolean) =>
    request<SavedFare[]>('GET', `/v1/admin/saved-fares?include_deleted=${includeDeleted}`),
}

/** "2026-11-04" or an ISO timestamp -> "Nov 4, 2026" */
export function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value.length === 10 ? `${value}T00:00:00` : value)
    .toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
