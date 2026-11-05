import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getStops, getTransportTypes, type PuvType, type Stop, type TransportType } from '../../services/api'
import { adminApi, type RouteDetail } from '../adminApi'
import styles from '../admin.module.css'

/** Edit a route's name and PUV type, and its stops in travel order. */
export default function RouteEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [allStops, setAllStops] = useState<Stop[]>([])
  const [types, setTypes] = useState<TransportType[]>([])
  const [name, setName] = useState('')
  const [puvType, setPuvType] = useState<PuvType>('traditional_jeepney')
  const [order, setOrder] = useState<string[]>([])   // stop IDs in travel order
  const [toAdd, setToAdd] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = (r: RouteDetail) => {
    setRoute(r)
    setName(r.route_name)
    setPuvType(r.puv_type)
    setOrder(r.stops.map((s) => s.stop_id))
  }

  useEffect(() => {
    Promise.all([adminApi.getRoute(id), getStops(), getTransportTypes()])
      .then(([r, s, t]) => { load(r); setAllStops(s); setTypes(t) })
      .catch((err) => setError(err.message))
  }, [id])

  const act = async (action: () => Promise<void>, done: string) => {
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(done)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (!route) return error ? <p className={styles.error}>{error}</p> : <p className={styles.empty}>Loading…</p>

  const stopName = (stopId: string) => allStops.find((s) => s.id === stopId)?.name ?? stopId
  // The saved distance applies only while the same two stops stay next to each other
  const savedDistance = (i: number) => {
    const saved = route.stops[i]
    return saved && i > 0 && saved.stop_id === order[i] && route.stops[i - 1]?.stop_id === order[i - 1]
      ? saved.distance_from_previous_km
      : null
  }
  const move = (i: number, by: number) => {
    const next = [...order]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setOrder(next)
  }
  const stopsChanged = order.join() !== route.stops.map((s) => s.stop_id).join()

  return (
    <>
      <p><Link to="/admin/routes">← Routes</Link></p>
      <h1 className={styles.title}>{route.route_name}</h1>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.ok} role="status">{message}</p>}

      <section className={styles.section}>
        <div className={styles.row}>
          <label className={styles.field} style={{ flex: 2 }}>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className={styles.field}>
            PUV type
            <select value={puvType} onChange={(e) => setPuvType(e.target.value as PuvType)}>
              {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </label>
          <button className={`${styles.button} ${styles.primary}`}
                  onClick={() => act(async () => {
                    await adminApi.updateRoute(id, { route_name: name.trim(), puv_type: puvType })
                    load(await adminApi.getRoute(id))
                  }, 'Route saved.')}>
            Save
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Stops in travel order</h2>
        {order.length === 0 ? <p className={styles.empty}>No stops yet. A route needs at least two.</p> : (
          <table className={styles.table}>
            <thead><tr><th>#</th><th>Stop</th><th className={styles.num}>km from previous</th><th /></tr></thead>
            <tbody>
              {order.map((stopId, i) => (
                <tr key={`${stopId}-${i}`}>
                  <td>{i + 1}</td>
                  <td>{stopName(stopId)}</td>
                  <td className={styles.num}>{i === 0 ? '—' : savedDistance(i) ?? 'not fetched'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className={`${styles.button} ${styles.small}`} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${stopName(stopId)} up`}>↑</button>{' '}
                    <button className={`${styles.button} ${styles.small}`} disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${stopName(stopId)} down`}>↓</button>{' '}
                    <button className={`${styles.button} ${styles.small} ${styles.danger}`} onClick={() => setOrder(order.filter((_, j) => j !== i))} aria-label={`Remove ${stopName(stopId)}`}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={styles.row} style={{ marginTop: 12 }}>
          <label className={styles.field} style={{ flex: 1 }}>
            Add a stop at the end
            <select value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
              <option value="">Choose a stop…</option>
              {allStops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <button className={styles.button} disabled={!toAdd} onClick={() => { setOrder([...order, toAdd]); setToAdd('') }}>Add</button>
          <span className={styles.spacer} />
          <button className={`${styles.button} ${styles.primary}`} disabled={!stopsChanged || order.length < 2}
                  onClick={() => act(async () => load(await adminApi.setRouteStops(id, order)), 'Stops saved. Segments that changed need their road distance fetched.')}>
            Save stops
          </button>
        </div>
      </section>

      <button className={`${styles.button} ${styles.danger}`}
              onClick={() => {
                if (window.confirm(`Delete the route "${route.route_name}"? Its stops stay.`)) {
                  act(async () => { await adminApi.deleteRoute(id); navigate('/admin/routes') }, '')
                }
              }}>
        Delete route
      </button>
    </>
  )
}
