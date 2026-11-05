import { useEffect, useState } from 'react'
import { adminApi, formatDate, type SavedFare } from '../adminApi'
import { transportLabel } from '../../components/FareChecker/TransportSelector'
import styles from '../admin.module.css'

/** Read-only view of saved fares; soft-deleted ones are kept 15 days after a new matrix takes effect. */
export default function SavedFaresPage() {
  const [fares, setFares] = useState<SavedFare[] | null>(null)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setFares(null)
    adminApi.listSavedFares(includeDeleted).then(setFares).catch((err) => setError(err.message))
  }, [includeDeleted])

  return (
    <>
      <h1 className={styles.title}>Saved fares</h1>
      <p className={styles.subtitle}>
        Fare results reused for repeat trips (latest 200). They are cleared when routes or stops change, and retired when
        a new fare matrix takes effect.
      </p>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontWeight: 700 }}>
        <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
        Show retired (soft-deleted) fares
      </label>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.section}>
        {fares === null ? <p className={styles.empty}>Loading…</p> : fares.length === 0 ? (
          <p className={styles.empty}>No saved fares yet. They appear after commuters check fares.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>From</th><th>To</th><th>PUV type</th><th className={styles.num}>Routes</th>
                  <th className={styles.num}>Cheapest</th><th>Matrix effective</th><th>Saved</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {fares.map((f) => (
                  <tr key={f.id}>
                    <td>{f.origin}</td>
                    <td>{f.destination}</td>
                    <td>{transportLabel(f.puv_type)}</td>
                    <td className={styles.num}>{f.route_count}</td>
                    <td className={styles.num}>{f.cheapest_regular_fare !== null ? `₱${f.cheapest_regular_fare.toFixed(2)}` : '—'}</td>
                    <td>{formatDate(f.fare_matrix_effective_from)}</td>
                    <td>{formatDate(f.created_at)}</td>
                    <td>{f.deleted_at ? `Retired ${formatDate(f.deleted_at)}` : 'Live'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
