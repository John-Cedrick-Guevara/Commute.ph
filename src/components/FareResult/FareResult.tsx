import { useEffect, useRef } from 'react'
import type { FareResult as FareResultData, PuvType } from '../../services/api'
import { transportLabel } from '../FareChecker/TransportSelector'
import styles from './FareResult.module.css'

const TRANSPORT_ICONS: Record<PuvType, string> = {
  traditional_jeepney: '🚌',
  modern_jeepney: '🚐',
}

export default function FareResult({ result, onClose }: {
  result: FareResultData
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Trap focus inside modal and close on Escape
  useEffect(() => {
    closeRef.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const icon = TRANSPORT_ICONS[result.transport]
  const hasDiscount = result.discountAmount > 0

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
            {icon} {result.routeName}
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

          <BreakdownRow label="Regular fare" value={`₱${result.regularFare.toFixed(2)}`} />

          {hasDiscount && (
            <BreakdownRow
              label={`Discount (${result.passengerType})`}
              value={`−₱${result.discountAmount.toFixed(2)}`}
              valueClass={styles.green}
            />
          )}

          <div className={`${styles.row} ${styles.total}`}>
            <span>Estimated total</span>
            <span>₱{result.total.toFixed(2)}</span>
          </div>

          <BreakdownRow label="Est. distance" value={`~${result.distance.toFixed(1)} km`} />
          <BreakdownRow label="Stops" value={result.stops} />
          <BreakdownRow label="Passenger type" value={result.passengerType} />
        </div>

        {/* Disclaimer */}
        <p className={styles.disclaimer}>
          <strong>⚠ Estimate only.</strong> Always confirm the actual fare with
          your driver or operator.
          <br />
          <span className={styles.source}>
            {transportLabel(result.transport)} fare matrix: {result.fareMatrix.source_name}
            {' · '}effective {formatDate(result.fareMatrix.effective_from)}
            {' · '}
            {result.fareMatrix.verified_at
              ? `verified ${formatDate(result.fareMatrix.verified_at)}`
              : 'not yet verified'}
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

/** "2026-11-04" or an ISO timestamp -> "Nov 4, 2026" */
function formatDate(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value)
    .toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function BreakdownRow({ label, value, valueClass }: {
  label: string
  value: string | number
  valueClass?: string
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={valueClass || ''}>{value}</span>
    </div>
  )
}
