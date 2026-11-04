import { useState, useRef, useEffect, useCallback } from 'react'
import { searchLocations } from '../../services/api'
import styles from './LocationInput.module.css'

export default function LocationInput({
  id,
  label,
  icon,
  value,
  onChange,
  placeholder,
  error,
}) {
  const [query, setQuery]           = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen]             = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  // Keep local query in sync when parent clears the value
  useEffect(() => {
    if (value === '') setQuery('')
  }, [value])

  const fetchSuggestions = useCallback(async (q) => {
    if (!q.trim()) { setSuggestions([]); setOpen(false); return }
    try {
      const results = await searchLocations(q)
      setSuggestions(results)
      setOpen(results.length > 0)
    } catch {
      setSuggestions([])
    }
  }, [])

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    onChange('')          // clear confirmed selection while typing
    setFocusedIdx(-1)

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 200)
  }

  const handleSelect = (loc) => {
    setQuery(loc.name)
    onChange(loc.name)
    setSuggestions([])
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault()
      handleSelect(suggestions[focusedIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={`${styles.wrapper} ${error ? styles.hasError : ''}`}>
      <div className={`${styles.field} ${open ? styles.active : ''}`}>
        <span className={styles.icon} aria-hidden="true">{icon}</span>
        <div className={styles.inputWrap}>
          <label htmlFor={id} className={styles.label}>{label}</label>
          <input
            ref={inputRef}
            id={id}
            type="text"
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query && fetchSuggestions(query)}
            className={styles.input}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-dropdown`}
            aria-activedescendant={focusedIdx >= 0 ? `${id}-opt-${focusedIdx}` : undefined}
          />
        </div>
      </div>

      {open && (
        <ul
          ref={dropdownRef}
          id={`${id}-dropdown`}
          className={styles.dropdown}
          role="listbox"
        >
          {suggestions.map((loc, i) => (
            <li
              key={loc.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === focusedIdx}
              className={`${styles.item} ${i === focusedIdx ? styles.itemFocused : ''}`}
              onMouseDown={() => handleSelect(loc)}
            >
              <span className={styles.itemIcon}>📍</span>
              <div>
                <span className={styles.itemName}>{loc.name}</span>
                <span className={styles.itemArea}>{loc.area}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className={styles.errorMsg} role="alert">⚠ {error}</p>
      )}
    </div>
  )
}
