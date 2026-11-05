import { useState, useEffect, type ChangeEvent, type KeyboardEvent } from 'react'
import type { Stop } from '../../services/api'
import styles from './LocationInput.module.css'

/**
 * Rank stops for the typed text: names or aliases starting with it first, then ones containing
 * it (case-insensitive, like SQL ILIKE '%text%'). `excludeName` drops the stop chosen in the
 * other field.
 */
export function matchStops(stops: Stop[], text: string, excludeName?: string): Stop[] {
  const q = text.trim().toLowerCase()
  const candidates = stops.filter((s) => s.name !== excludeName)
  if (!q) return candidates

  const starts: Stop[] = []
  const contains: Stop[] = []
  for (const stop of candidates) {
    const names = [stop.name, ...(stop.aliases ?? [])].map((n) => n.toLowerCase())
    if (names.some((n) => n.startsWith(q))) starts.push(stop)
    else if (names.some((n) => n.includes(q))) contains.push(stop)
  }
  return [...starts, ...contains]
}

/**
 * Type-to-search stop picker. Only known stops can be chosen, since fares exist only for
 * stored routes: typing clears the selection until a suggestion is picked.
 * `value` and `onChange` use a stop object ({ id, name }) or null.
 */
interface Props {
  id: string
  label: string
  icon: string
  stops: Stop[]
  value: Stop | null
  onChange: (stop: Stop | null) => void
  placeholder: string
  excludeName?: string
  disabled?: boolean
  error?: string
}

export default function LocationInput({
  id,
  label,
  icon,
  stops,
  value,
  onChange,
  placeholder,
  excludeName,
  disabled,
  error,
}: Props) {
  const [query, setQuery]           = useState(value?.name ?? '')
  const [open, setOpen]             = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)

  const suggestions = matchStops(stops, query, excludeName)

  // Show the stop name when the parent sets the stop (e.g. swap)
  useEffect(() => {
    if (value) setQuery(value.name)
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    onChange(null)        // not a known stop until one is picked
    setFocusedIdx(0)
    setOpen(true)
  }

  const handleSelect = (stop: Stop) => {
    setQuery(stop.name)
    onChange(stop)
    setOpen(false)
    setFocusedIdx(-1)
  }

  // Leaving the field: accept an exact name typed in full, otherwise keep it unselected
  const handleBlur = () => {
    setOpen(false)
    if (value) return
    const exact = suggestions.find(
      (s) => s.name.toLowerCase() === query.trim().toLowerCase()
    )
    if (exact) handleSelect(exact)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setFocusedIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && suggestions[focusedIdx]) {
      e.preventDefault()  // pick the stop instead of submitting the form
      handleSelect(suggestions[focusedIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const listId = `${id}-listbox`

  return (
    <div className={`${styles.wrapper} ${error ? styles.hasError : ''}`}>
      <div className={`${styles.field} ${open ? styles.active : ''}`}>
        <span className={styles.icon} aria-hidden="true">{icon}</span>
        <div className={styles.inputWrap}>
          <label htmlFor={id} className={styles.label}>{label}</label>
          <input
            id={id}
            type="text"
            role="combobox"
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            disabled={disabled}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={handleBlur}
            className={styles.input}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open && focusedIdx >= 0 ? `${id}-opt-${focusedIdx}` : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
      </div>

      {open && (
        <ul id={listId} className={styles.dropdown} role="listbox" aria-label={label}>
          {suggestions.length === 0 ? (
            <li className={styles.empty}>No stop matches “{query.trim()}”. Try another name.</li>
          ) : suggestions.map((stop, i) => (
            <li
              key={stop.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === focusedIdx}
              className={`${styles.item} ${i === focusedIdx ? styles.itemFocused : ''}`}
              // mousedown fires before the input's blur, so the pick isn't lost
              onMouseDown={(e) => { e.preventDefault(); handleSelect(stop) }}
            >
              <span className={styles.itemIcon} aria-hidden="true">📍</span>
              <span className={styles.itemName}>{stop.name}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p id={`${id}-error`} className={styles.errorMsg} role="alert">⚠ {error}</p>
      )}
    </div>
  )
}
