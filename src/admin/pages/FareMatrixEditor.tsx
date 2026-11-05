import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminApi, formatDate, type FareRow, type PublishPreview, type VersionDetail } from '../adminApi'
import { StatusBadge } from './StatusBadge'
import { transportLabel } from '../../components/FareChecker/TransportSelector'
import styles from '../admin.module.css'

/** Editable copy of a draft's fields; numbers stay strings while typing. */
interface Form {
  effective_from: string
  source_name: string
  source_url: string
  rows: { distance_km: string; regular_fare: string; discounted_fare: string }[]
}

const toForm = (v: VersionDetail): Form => ({
  effective_from: v.effective_from ?? '',
  source_name: v.source_name ?? '',
  source_url: v.source_url ?? '',
  rows: v.rows.map((r) => ({
    distance_km: String(r.distance_km),
    regular_fare: String(r.regular_fare),
    discounted_fare: String(r.discounted_fare),
  })),
})

/**
 * Parse pasted CSV / spreadsheet rows: "km, regular, discounted" per line (commas, tabs or spaces).
 * Lines that don't start with three numbers (like a header) are skipped.
 */
export function parsePastedRows(text: string): Form['rows'] {
  return text.split(/\r?\n/).flatMap((line) => {
    const cells = line.replace(/[₱P]/gi, '').split(/[,\t;|]|\s+/).map((c) => c.trim()).filter(Boolean)
    const [km, regular, discounted] = cells
    const isNumber = (c?: string) => c !== undefined && /^\d+(\.\d+)?$/.test(c)
    return isNumber(km) && isNumber(regular) && isNumber(discounted)
      ? [{ distance_km: km, regular_fare: regular, discounted_fare: discounted }]
      : []
  })
}

export default function FareMatrixEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [version, setVersion] = useState<VersionDetail | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [dirty, setDirty] = useState(false)
  const [paste, setPaste] = useState('')
  const [preview, setPreview] = useState<PublishPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = (v: VersionDetail) => {
    setVersion(v)
    setForm(toForm(v))
    setDirty(false)
  }

  useEffect(() => {
    adminApi.getVersion(id).then(load).catch((err) => setError(err.message))
  }, [id])

  /** Run an API call with busy / error handling; returns its result or null on failure. */
  const run = async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      return await action()
    } catch (err) {
      setError((err as Error).message)
      return null
    } finally {
      setBusy(false)
    }
  }

  if (!version || !form) return error ? <p className={styles.error}>{error}</p> : <p className={styles.empty}>Loading…</p>

  const isDraft = version.status === 'draft'
  const edit = (patch: Partial<Form>) => { setForm({ ...form, ...patch }); setDirty(true); setPreview(null) }
  const editRow = (i: number, key: keyof Form['rows'][number], value: string) =>
    edit({ rows: form.rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)) })

  const addRow = () => {
    const last = form.rows[form.rows.length - 1]
    edit({
      rows: [...form.rows, {
        distance_km: String(last ? Number(last.distance_km) + 1 : 1),
        regular_fare: last?.regular_fare ?? '',
        discounted_fare: last?.discounted_fare ?? '',
      }],
    })
  }

  const save = () => run(async () => {
    const rows: FareRow[] = form.rows.map((r) => ({
      distance_km: Number(r.distance_km),
      regular_fare: Number(r.regular_fare),
      discounted_fare: Number(r.discounted_fare),
    }))
    if (rows.some((r) => [r.distance_km, r.regular_fare, r.discounted_fare].some((n) => !Number.isFinite(n) || n <= 0))) {
      throw new Error('Every row needs a distance and both fares as positive numbers.')
    }
    const saved = await adminApi.saveDraft(id, {
      effective_from: form.effective_from || null,
      source_name: form.source_name.trim() || null,
      source_url: form.source_url.trim() || null,
      rows,
    })
    load(saved)
    setMessage('Draft saved.')
    return saved
  })

  const uploadPdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (dirty && !window.confirm('Uploading replaces the rows with the ones read from the PDF. Discard your unsaved changes?')) return
    const updated = await run(() => adminApi.uploadPdf(id, file))
    if (updated) {
      load(updated)
      setMessage(`Read ${updated.rows.length} rows from ${file.name}. Check every row against the PDF before publishing.`)
    }
  }

  const applyPaste = () => {
    const rows = parsePastedRows(paste)
    if (rows.length === 0) { setError('No rows found. Use one row per line: km, regular fare, discounted fare.'); return }
    edit({ rows })
    setPaste('')
    setMessage(`Replaced the rows with ${rows.length} pasted rows. Save the draft to check them.`)
  }

  const reviewPublish = async () => {
    if (dirty && !(await save())) return
    const result = await run(() => adminApi.publishPreview(id))
    if (result) setPreview(result)
  }

  const publish = async () => {
    const published = await run(() => adminApi.publish(id))
    if (published) { load(published); setPreview(null); setMessage('Published.') }
  }

  const retract = async () => {
    if (!window.confirm('Retract this fare matrix? The previous matrix will apply again.')) return
    const result = await run(async () => {
      const counts = await adminApi.retract(id)
      load(await adminApi.getVersion(id))
      return counts
    })
    if (result) {
      setMessage(`Retracted. ${result.retired_saved_fares} saved fares retired, ${result.restored_saved_fares} restored from the previous matrix.`)
    }
  }

  const deleteDraft = async () => {
    if (!window.confirm('Delete this draft? This can\'t be undone.')) return
    if ((await run(() => adminApi.deleteDraft(id))) !== null) navigate('/admin/fare-matrices')
  }

  return (
    <>
      <p><Link to="/admin/fare-matrices">← Fare matrices</Link></p>
      <h1 className={styles.title}>
        {transportLabel(version.puv_type)} fare matrix <StatusBadge version={version} />
      </h1>
      <p className={styles.subtitle}>
        {isDraft
          ? 'Drafts are never used for fares. Review every row, then publish.'
          : `Published ${formatDate(version.published_at)} by ${version.verified_by ?? 'unknown'}. Published matrices can't be edited.`}
      </p>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.ok} role="status">{message}</p>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Source</h2>
        <div className={styles.row}>
          <label className={styles.field}>
            Effective date
            <input type="date" value={form.effective_from} disabled={!isDraft}
                   onChange={(e) => edit({ effective_from: e.target.value })} />
          </label>
          <label className={styles.field} style={{ flex: 2 }}>
            Source name
            <input value={form.source_name} disabled={!isDraft} placeholder="e.g. LTFRB MC 2023-012"
                   onChange={(e) => edit({ source_name: e.target.value })} />
          </label>
          <label className={styles.field} style={{ flex: 2 }}>
            Source link <span className={styles.hint}>optional</span>
            <input type="url" value={form.source_url} disabled={!isDraft} placeholder="https://…"
                   onChange={(e) => edit({ source_url: e.target.value })} />
          </label>
        </div>
        <div className={styles.row} style={{ marginTop: 12 }}>
          {isDraft && (
            <label className={styles.field}>
              Fill rows from a PDF
              <input type="file" accept="application/pdf" onChange={uploadPdf} disabled={busy} />
              <span className={styles.hint}>The rows read from the PDF replace the table below for your review.</span>
            </label>
          )}
          {version.source_file_name && (
            <button className={styles.button} onClick={() => run(() => adminApi.openPdf(id))}>
              Open {version.source_file_name}
            </button>
          )}
        </div>
        {version.parse_warnings.length > 0 && (
          <ul className={styles.warningList} style={{ marginTop: 12 }}>
            {version.parse_warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.row}>
          <h2 className={styles.sectionTitle}>Fares ({form.rows.length} rows)</h2>
          <span className={styles.spacer} />
          {isDraft && <button className={`${styles.button} ${styles.small}`} onClick={addRow}>Add row</button>}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Distance (km)</th><th>Regular fare (₱)</th><th>Discounted fare (₱)</th>{isDraft && <th />}</tr>
            </thead>
            <tbody>
              {form.rows.map((r, i) => (
                <tr key={i}>
                  {(['distance_km', 'regular_fare', 'discounted_fare'] as const).map((key) => (
                    <td key={key}>
                      {isDraft ? (
                        <input inputMode="decimal" value={r[key]} aria-label={`${key.replace('_', ' ')} row ${i + 1}`}
                               onChange={(e) => editRow(i, key, e.target.value)} />
                      ) : r[key]}
                    </td>
                  ))}
                  {isDraft && (
                    <td>
                      <button className={`${styles.button} ${styles.small} ${styles.danger}`}
                              onClick={() => edit({ rows: form.rows.filter((_, j) => j !== i) })}
                              aria-label={`Remove row ${i + 1}`}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {form.rows.length === 0 && <p className={styles.empty}>No rows yet. Upload the PDF, paste rows, or add them.</p>}
        </div>

        {isDraft && (
          <div className={styles.row} style={{ marginTop: 16 }}>
            <label className={styles.field} style={{ flex: 1 }}>
              Paste rows <span className={styles.hint}>one per line: km, regular, discounted (from a spreadsheet or CSV)</span>
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'1, 14.00, 11.25\n2, 14.00, 11.25'} />
            </label>
            <button className={styles.button} onClick={applyPaste} disabled={!paste.trim()}>Replace rows</button>
          </div>
        )}
      </section>

      {(version.issues.errors.length > 0 || version.issues.warnings.length > 0) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Checks {dirty && <span className={styles.hint}>(save to re-check)</span>}</h2>
          {version.issues.errors.length > 0 && (
            <>
              <p className={styles.error}>Fix before publishing:</p>
              <ul className={styles.errorList}>{version.issues.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          )}
          {version.issues.warnings.length > 0 && (
            <>
              <p style={{ fontWeight: 700, marginTop: 8 }}>Double-check:</p>
              <ul className={styles.warningList}>{version.issues.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </>
          )}
        </section>
      )}

      {preview && (
        <section className={`${styles.section} ${styles.notice}`} aria-live="polite">
          <h2 className={styles.sectionTitle}>Before you publish</h2>
          {preview.issues.errors.length > 0 ? (
            <p className={styles.error}>Fix the checks above first.</p>
          ) : (
            <>
              <p>
                This matrix takes effect {preview.takes_effect_now ? 'immediately' : `on ${formatDate(preview.retire_on)}`}.{' '}
                {preview.retiring_saved_fares > 0
                  ? `${preview.retiring_saved_fares} saved ${transportLabel(version.puv_type)} fares will be retired ${preview.takes_effect_now ? 'now' : 'then'}. They are soft-deleted and kept for 15 days in case this matrix is retracted.`
                  : 'No saved fares will be retired.'}
              </p>
              <p style={{ marginTop: 8 }}>Published matrices can't be edited. You'll be recorded as the verifier.</p>
              <div className={styles.row} style={{ marginTop: 12 }}>
                <button className={`${styles.button} ${styles.primary}`} onClick={publish} disabled={busy}>Publish</button>
                <button className={styles.button} onClick={() => setPreview(null)}>Cancel</button>
              </div>
            </>
          )}
        </section>
      )}

      <div className={styles.row}>
        {isDraft && (
          <>
            <button className={`${styles.button} ${styles.primary}`} onClick={save} disabled={busy || !dirty}>Save draft</button>
            <button className={styles.button} onClick={reviewPublish} disabled={busy}>Review and publish</button>
            <span className={styles.spacer} />
            <button className={`${styles.button} ${styles.danger}`} onClick={deleteDraft} disabled={busy}>Delete draft</button>
          </>
        )}
        {version.status === 'published' && (
          <button className={`${styles.button} ${styles.danger}`} onClick={retract} disabled={busy}>Retract</button>
        )}
      </div>
    </>
  )
}
