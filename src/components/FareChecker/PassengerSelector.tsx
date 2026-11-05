import type { PassengerType } from '../../services/api'
import styles from './PassengerSelector.module.css'

const PASSENGER_TYPES: { id: PassengerType; label: string; discount: string | null }[] = [
  { id: 'Regular',        label: 'Regular',        discount: null },
  { id: 'Student',        label: 'Student',        discount: '−20%' },
  { id: 'Senior Citizen', label: 'Senior Citizen', discount: '−20%' },
  { id: 'PWD',            label: 'PWD',            discount: '−20%' },
]

export default function PassengerSelector({ value, onChange }: {
  value: PassengerType
  onChange: (value: PassengerType) => void
}) {
  return (
    <div
      className={styles.grid}
      role="radiogroup"
      aria-label="Passenger type"
    >
      {PASSENGER_TYPES.map((type) => {
        const selected = value === type.id
        return (
          <label
            key={type.id}
            className={`${styles.option} ${selected ? styles.selected : ''}`}
          >
            <input
              type="radio"
              name="passenger"
              value={type.id}
              checked={selected}
              onChange={() => onChange(type.id)}
              className={styles.radio}
            />
            <span className={`${styles.dot} ${selected ? styles.dotSelected : ''}`} aria-hidden="true" />
            <span className={styles.label}>{type.label}</span>
            {type.discount && (
              <span className={styles.tag}>{type.discount}</span>
            )}
          </label>
        )
      })}
    </div>
  )
}
