import { useEffect, useRef } from 'react'
import styles from './FareResult.module.css'

const TRANSPORT_ICONS = {
  Jeepney: '🚌',
  'Beep Jeep': '🚐',
}

export default function FareResult({ result, onClose }) {
  const closeRef = useRef(null)

  // Trap focus inside modal and close on Escape
  useEffect(() => {
    closeRef.current?.focus()
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!result) return null

  const icon = TRANSPORT_ICONS[result.transport] || '🚌'
  const hasDiscount = result.discountRate > 0

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Fare result"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.card}>
        {/* Jeepney arrival animation */}
        <div className={styles.jeepneyArrival} aria-hidden="true">{icon}</div>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.transportBadge}>
            {icon} {result.transportLabel}
          </span>

          <div className={styles.fare}>
            <span className={styles.pesoSign}>₱</span>
            {result.total.toFixed(2)}
          </div>
          <p className={styles.fareLabel}>Estimated fare</p>

          {hasDiscount && (
            <span className={styles.discountTag}>
              🎟 20% {result.passengerType} discount applied
            </span>
          )}
        </div>

        {/* Route */}
        <div className={styles.route}>
          <div className={styles.routePoint}>
            <div className={`${styles.dot} ${styles.dotStart}`}>📍</div>
            <div>
              <p className={styles.routePointLabel}>From</p>
              <p className={styles.routePointName}>{result.from}</p>
            </div>
          </div>
          <div className={styles.connector} />
          <div className={styles.routePoint}>
            <div className={`${styles.dot} ${styles.dotEnd}`}>🎯</div>
            <div>
              <p className={styles.routePointLabel}>To</p>
              <p className={styles.routePointName}>{result.to}</p>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className={styles.breakdown}>
          <p className={styles.breakdownTitle}>Fare breakdown</p>

          <BreakdownRow label="Base fare (first 4 km)" value={`₱${result.baseFare.toFixed(2)}`} />

          {result.extraCharge > 0 && (
            <BreakdownRow
              label={`Extra distance (${result.distance} km − 4 km)`}
              value={`₱${result.extraCharge.toFixed(2)}`}
            />
          )}

          {hasDiscount && (
            <BreakdownRow
              label={`Discount (20% ${result.passengerType})`}
              value={`−₱${result.discountAmount.toFixed(2)}`}
              valueClass={styles.green}
            />
          )}

          <div className={`${styles.row} ${styles.total}`}>
            <span>Estimated total</span>
            <span>₱{result.total.toFixed(2)}</span>
          </div>

          <BreakdownRow label="Est. distance" value={`~${result.distance} km`} />
          <BreakdownRow label="Passenger type" value={result.passengerType} />
        </div>

        {/* Disclaimer */}
        <p className={styles.disclaimer}>
          <strong>⚠ Sample estimate only.</strong> Fares are for demonstration
          purposes. Always confirm the actual fare with your driver or operator.
          <br />
          <span className={styles.source}>
            Source: {result.source} · {result.lastUpdated}
          </span>
        </p>

        <button
          ref={closeRef}
          className={styles.closeBtn}
          onClick={onClose}
        >
          ↩ Check Another Route
        </button>
      </div>
    </div>
  )
}

function BreakdownRow({ label, value, valueClass }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={valueClass || ''}>{value}</span>
    </div>
  )
}
