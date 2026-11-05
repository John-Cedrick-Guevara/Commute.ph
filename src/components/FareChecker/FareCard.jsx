import { useState, useCallback, useEffect } from 'react'
import LocationInput from './LocationInput'
import TransportSelector from './TransportSelector'
import PassengerSelector from './PassengerSelector'
import { calculateFare, getStops } from '../../services/api'
import styles from './FareCard.module.css'

export default function FareCard({ onResult, onTransportChange }) {
  // Selected stops ({ id, name }); null while the user is still typing
  const [from, setFrom]             = useState(null)
  const [to, setTo]                 = useState(null)
  const [transport, setTransport]   = useState('Jeepney')
  const [passenger, setPassenger]   = useState('Regular')
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState({})
  const [stops, setStops]           = useState([])
  const [stopsLoading, setStopsLoading] = useState(true)

  // Load the known stops once for both pickers
  useEffect(() => {
    getStops()
      .then(setStops)
      .catch((err) => {
        console.error('Failed to load stops', err)
        setErrors({ api: 'Could not load the stop list. Please refresh the page.' })
      })
      .finally(() => setStopsLoading(false))
  }, [])

  const handleTransport = (val) => {
    setTransport(val)
    onTransportChange?.(val)
  }

  const validate = () => {
    const e = {}
    if (!from) e.from = 'Please pick a starting point from the suggestions.'
    if (!to)   e.to   = 'Please pick a destination from the suggestions.'
    if (from && to && from.name === to.name)
      e.to = 'Destination must be different from starting point.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Remount both pickers on swap so their text follows the swapped stops,
  // including a side that was half-typed (no stop picked yet)
  const [swapCount, setSwapCount] = useState(0)

  const handleSwap = () => {
    setFrom(to)
    setTo(from)
    setSwapCount((n) => n + 1)
    setErrors({})
  }

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const result = await calculateFare({ from, to, transport, passengerType: passenger })
      onResult(result)
    } catch (err) {
      setErrors({ api: err.message || 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, transport, passenger])

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      {/* Card header */}
      <div className={styles.header}>
        <span className={styles.title}>Let's find your fare</span>
        <span className={styles.badge}>TARA, SAKAY!</span>
      </div>

      {/* Location inputs */}
      <div className={styles.locationGroup}>
        <LocationInput
          key={`from-${swapCount}`}
          id="from"
          label="Starting point"
          icon="📍"
          placeholder={stopsLoading ? 'Loading stops…' : 'Type a stop, e.g. Riverbanks'}
          stops={stops}
          disabled={stopsLoading}
          excludeName={to?.name}
          value={from}
          onChange={(v) => { setFrom(v); setErrors((p) => ({ ...p, from: '' })) }}
          error={errors.from}
        />

        <button
          type="button"
          className={styles.swapBtn}
          onClick={handleSwap}
          aria-label="Swap starting and destination"
          title="Swap locations"
        >
          ⇅
        </button>

        <LocationInput
          key={`to-${swapCount}`}
          id="to"
          label="Destination"
          icon="🎯"
          placeholder={stopsLoading ? 'Loading stops…' : 'Type a stop, e.g. OLOPSC'}
          stops={stops}
          disabled={stopsLoading}
          excludeName={from?.name}
          value={to}
          onChange={(v) => { setTo(v); setErrors((p) => ({ ...p, to: '' })) }}
          error={errors.to}
        />
      </div>

      {/* Transport */}
      <p className={styles.sectionLabel}>Choose your Marikina ride</p>
      <TransportSelector value={transport} onChange={handleTransport} />

      {/* Passenger */}
      <div className={styles.passengerHeader}>
        <p className={styles.sectionLabel} style={{ margin: 0 }}>Passenger type</p>
        <span className={styles.demoBadge}>DEMO DISCOUNT</span>
      </div>
      <PassengerSelector value={passenger} onChange={setPassenger} />

      <p className={styles.discountNote}>
        Sample 20% discount for students, senior citizens, and PWDs. Bring a
        valid eligibility ID and confirm the actual fare with your operator.
        Discounts do not stack.
      </p>

      {/* API error */}
      {errors.api && (
        <p className={styles.apiError} role="alert">⚠ {errors.api}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <span className={styles.loader} aria-hidden="true" />
            Checking...
          </>
        ) : (
          <>
            Check Fare
            <span className={styles.arrow} aria-hidden="true">→</span>
          </>
        )}
      </button>

      <p className={styles.noSignup}>✓ No sign-ups. No hassle. Just your fare.</p>
    </form>
  )
}
