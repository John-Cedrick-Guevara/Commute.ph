import { useState, useCallback, useEffect, type FormEvent } from 'react'
import LocationInput from './LocationInput'
import TransportSelector, { transportLabel } from './TransportSelector'
import PassengerSelector from './PassengerSelector'
import {
  calculateFare, getStops, getTransportTypes,
  type FareResult, type PassengerType, type PuvType, type Stop,
} from '../../services/api'
import styles from './FareCard.module.css'

type Errors = { from?: string; to?: string; api?: string }

export default function FareCard({ onResult, onTransportChange }: {
  onResult: (result: FareResult) => void
  onTransportChange?: (transport: PuvType) => void
}) {
  // Selected stops ({ id, name }); null while the user is still typing
  const [from, setFrom]             = useState<Stop | null>(null)
  const [to, setTo]                 = useState<Stop | null>(null)
  const [transport, setTransport]   = useState<PuvType>('traditional_jeepney')
  const [passenger, setPassenger]   = useState<PassengerType>('Regular')
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState<Errors>({})
  const [stops, setStops]           = useState<Stop[]>([])
  const [stopsLoading, setStopsLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<PuvType[]>([])

  // Load the known stops and which PUV types have fares, once
  useEffect(() => {
    getStops()
      .then(setStops)
      .catch((err) => {
        console.error('Failed to load stops', err)
        setErrors({ api: 'Could not load the stop list. Please refresh the page.' })
      })
      .finally(() => setStopsLoading(false))
    getTransportTypes()
      .then((types) => setUnavailable(types.filter((t) => !t.has_fare_matrix).map((t) => t.code)))
      .catch((err) => console.error('Failed to load transport types', err))  // the estimate still says so
  }, [])

  const handleTransport = (val: PuvType) => {
    setTransport(val)
    onTransportChange?.(val)
  }

  const validate = () => {
    const e: Errors = {}
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

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!validate() || !from || !to) return
    setLoading(true)
    try {
      const result = await calculateFare({
        from, to, transport, transportLabel: transportLabel(transport), passengerType: passenger,
      })
      onResult(result)
    } catch (err) {
      setErrors({ api: err instanceof Error ? err.message : 'Something went wrong. Please try again.' })
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
      <TransportSelector value={transport} onChange={handleTransport} unavailable={unavailable} />

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
