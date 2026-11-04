import { useState, useCallback } from 'react'
import LocationInput from './LocationInput'
import TransportSelector from './TransportSelector'
import PassengerSelector from './PassengerSelector'
import { calculateFare } from '../../services/api'
import styles from './FareCard.module.css'

export default function FareCard({ onResult, onTransportChange }) {
  const [from, setFrom]             = useState('')
  const [to, setTo]                 = useState('')
  const [transport, setTransport]   = useState('Jeepney')
  const [passenger, setPassenger]   = useState('Regular')
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState({})

  const handleTransport = (val) => {
    setTransport(val)
    onTransportChange?.(val)
  }

  const validate = () => {
    const e = {}
    if (!from.trim()) e.from = 'Please enter a starting point.'
    if (!to.trim())   e.to   = 'Please enter a destination.'
    if (from.trim() && to.trim() && from === to)
      e.to = 'Destination must be different from starting point.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSwap = () => {
    setFrom(to)
    setTo(from)
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
          id="from"
          label="Starting point"
          icon="📍"
          placeholder="Where are you coming from?"
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
          id="to"
          label="Destination"
          icon="🎯"
          placeholder="Where do you want to go?"
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
