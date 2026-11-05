import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getTransportTypes, type PuvType, type TransportType } from '../../services/api'
import { adminApi, type RouteListItem } from '../adminApi'
import styles from '../admin.module.css'

/** Every route, and creating a new one. */
export default function RoutesPage() {
  const navigate = useNavigate()
  const [routes, setRoutes] = useState<RouteListItem[] | null>(null)
  const [types, setTypes] = useState<TransportType[]>([])
  const [name, setName] = useState('')
  const [puvType, setPuvType] = useState<PuvType>('traditional_jeepney')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([adminApi.listRoutes(), getTransportTypes()])
      .then(([r, t]) => { setRoutes(r); setTypes(t) })
      .catch((err) => setError(err.message))
  }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Give the route a name.'); return }
    try {
      const route = await adminApi.createRoute({ route_name: name.trim(), puv_type: puvType })
      navigate(`/admin/routes/${route.id}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const label = (code: string) => types.find((t) => t.code === code)?.label ?? code

  return (
    <>
      <h1 className={styles.title}>Routes</h1>
      <p className={styles.subtitle}>A route is a PUV type and its stops in travel order.</p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>New route</h2>
        <form className={styles.row} onSubmit={create}>
          <label className={styles.field} style={{ flex: 2 }}>
            Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marikina - Parang" />
          </label>
          <label className={styles.field}>
            PUV type
            <select value={puvType} onChange={(e) => setPuvType(e.target.value as PuvType)}>
              {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </label>
          <button className={`${styles.button} ${styles.primary}`}>Create and add stops</button>
        </form>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.section}>
        {routes === null ? <p className={styles.empty}>Loading…</p> : routes.length === 0 ? (
          <p className={styles.empty}>No routes yet.</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>Route</th><th>PUV type</th><th className={styles.num}>Stops</th><th /></tr></thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id}>
                  <td>{r.route_name}</td>
                  <td>{label(r.puv_type)}</td>
                  <td className={styles.num}>{r.stop_count}</td>
                  <td><Link to={`/admin/routes/${r.id}`} aria-label={`Edit ${r.route_name}`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
