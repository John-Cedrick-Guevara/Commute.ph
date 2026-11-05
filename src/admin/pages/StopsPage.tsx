import { useEffect, useState, type FormEvent } from 'react'
import { getStops, type Stop } from '../../services/api'
import { adminApi, type StopInput } from '../adminApi'
import styles from '../admin.module.css'

/** Text fields for a stop; aliases are comma-separated. */
interface StopForm { name: string; latitude: string; longitude: string; aliases: string }

const EMPTY: StopForm = { name: '', latitude: '', longitude: '', aliases: '' }
const toForm = (s: Stop): StopForm => ({
  name: s.name, latitude: String(s.latitude), longitude: String(s.longitude), aliases: s.aliases.join(', '),
})

function toInput(form: StopForm): StopInput {
  const latitude = Number(form.latitude)
  const longitude = Number(form.longitude)
  if (!form.name.trim()) throw new Error('Give the stop a name.')
  if (!form.latitude.trim() || !Number.isFinite(latitude) || !form.longitude.trim() || !Number.isFinite(longitude)) {
    throw new Error('Enter the latitude and longitude as numbers, e.g. 14.6507 and 121.1029.')
  }
  return {
    name: form.name.trim(),
    latitude,
    longitude,
    aliases: form.aliases.split(',').map((a) => a.trim()).filter(Boolean),
  }
}

/** Create, edit and delete stops. Moving a stop clears the road distances around it. */
export default function StopsPage() {
  const [stops, setStops] = useState<Stop[] | null>(null)
  const [newStop, setNewStop] = useState<StopForm>(EMPTY)
  const [editing, setEditing] = useState<{ id: string; form: StopForm } | null>(null)
  const [error, setError] = useState('')

  const reload = () => getStops().then(setStops).catch((err) => setError(err.message))
  useEffect(() => { reload() }, [])

  const act = async (action: () => Promise<unknown>) => {
    setError('')
    try {
      await action()
      await reload()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    }
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (await act(() => adminApi.createStop(toInput(newStop)))) setNewStop(EMPTY)
  }

  const saveEdit = async () => {
    if (editing && await act(() => adminApi.updateStop(editing.id, toInput(editing.form)))) setEditing(null)
  }

  const remove = (stop: Stop) => {
    if (window.confirm(`Delete the stop "${stop.name}"?`)) act(() => adminApi.deleteStop(stop.id))
  }

  const fields = (form: StopForm, set: (f: StopForm) => void) => (
    <>
      <label className={styles.field}>Name<input value={form.name} onChange={(e) => set({ ...form, name: e.target.value })} /></label>
      <label className={styles.field}>Latitude<input inputMode="decimal" value={form.latitude} onChange={(e) => set({ ...form, latitude: e.target.value })} /></label>
      <label className={styles.field}>Longitude<input inputMode="decimal" value={form.longitude} onChange={(e) => set({ ...form, longitude: e.target.value })} /></label>
      <label className={styles.field}>
        Other names <span className={styles.hint}>comma-separated</span>
        <input value={form.aliases} onChange={(e) => set({ ...form, aliases: e.target.value })} />
      </label>
    </>
  )

  return (
    <>
      <h1 className={styles.title}>Stops</h1>
      <p className={styles.subtitle}>
        One entry per real-world place, shared by every route that passes it. Moving a stop clears the road distances
        of the route segments around it; run the distance script to refetch them.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Add a stop</h2>
        <form className={styles.row} onSubmit={create}>
          {fields(newStop, setNewStop)}
          <button className={`${styles.button} ${styles.primary}`}>Add stop</button>
        </form>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.section}>
        {stops === null ? <p className={styles.empty}>Loading…</p> : stops.length === 0 ? (
          <p className={styles.empty}>No stops yet. Add the first one above.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Name</th><th>Latitude</th><th>Longitude</th><th>Other names</th><th /></tr></thead>
              <tbody>
                {stops.map((stop) => editing?.id === stop.id ? (
                  <tr key={stop.id}>
                    <td colSpan={5}>
                      <div className={styles.row}>
                        {fields(editing.form, (form) => setEditing({ id: stop.id, form }))}
                        <button className={`${styles.button} ${styles.primary}`} onClick={saveEdit}>Save</button>
                        <button className={styles.button} onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={stop.id}>
                    <td>{stop.name}</td>
                    <td>{stop.latitude}</td>
                    <td>{stop.longitude}</td>
                    <td>{stop.aliases.join(', ') || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className={`${styles.button} ${styles.small}`} aria-label={`Edit ${stop.name}`}
                              onClick={() => setEditing({ id: stop.id, form: toForm(stop) })}>Edit</button>{' '}
                      <button className={`${styles.button} ${styles.small} ${styles.danger}`} aria-label={`Delete ${stop.name}`}
                              onClick={() => remove(stop)}>Delete</button>
                    </td>
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
