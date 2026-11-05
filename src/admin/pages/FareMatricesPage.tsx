import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getTransportTypes, type PuvType, type TransportType } from '../../services/api'
import { adminApi, formatDate, type VersionSummary } from '../adminApi'
import { StatusBadge } from './StatusBadge'
import styles from '../admin.module.css'

/** Every fare matrix version per PUV type, and starting a new draft. */
export default function FareMatricesPage() {
  const navigate = useNavigate()
  const [versions, setVersions] = useState<VersionSummary[] | null>(null)
  const [types, setTypes] = useState<TransportType[]>([])
  const [newType, setNewType] = useState<PuvType>('traditional_jeepney')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([adminApi.listVersions(), getTransportTypes()])
      .then(([v, t]) => { setVersions(v); setTypes(t) })
      .catch((err) => setError(err.message))
  }, [])

  const createDraft = async () => {
    try {
      const draft = await adminApi.createDraft(newType)
      navigate(`/admin/fare-matrices/${draft.id}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const label = (code: string) => types.find((t) => t.code === code)?.label ?? code

  return (
    <>
      <h1 className={styles.title}>Fare matrices</h1>
      <p className={styles.subtitle}>
        A published matrix is never edited. To change fares, start a new draft, review it, and publish it with its
        effective date.
      </p>

      <section className={styles.section}>
        <div className={styles.row}>
          <label className={styles.field}>
            New draft for
            <select value={newType} onChange={(e) => setNewType(e.target.value as PuvType)}>
              {types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </label>
          <button className={`${styles.button} ${styles.primary}`} onClick={createDraft}>Start draft</button>
        </div>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.section}>
        {versions === null ? <p className={styles.empty}>Loading…</p> : versions.length === 0 ? (
          <p className={styles.empty}>No fare matrices yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>PUV type</th><th>Status</th><th>Effective</th><th>Source</th><th className={styles.num}>Rows</th>
                  <th>Verified</th><th />
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>{label(v.puv_type)}</td>
                    <td><StatusBadge version={v} /></td>
                    <td>{formatDate(v.effective_from)}</td>
                    <td>{v.source_name ?? '—'}</td>
                    <td className={styles.num}>{v.row_count}</td>
                    <td>{v.verified_by ? `${v.verified_by}, ${formatDate(v.verified_at)}` : '—'}</td>
                    <td><Link to={`/admin/fare-matrices/${v.id}`}>{v.status === 'draft' ? 'Edit' : 'View'}</Link></td>
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
