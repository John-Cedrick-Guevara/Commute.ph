import styles from './TransportSelector.module.css'

const TRANSPORT_OPTIONS = [
  {
    id: 'Jeepney',
    label: 'Jeepney',
    sub: 'Traditional',
    icon: '🚌',
  },
  {
    id: 'Beep Jeep',
    label: 'Beep Jeep',
    sub: 'Modern / E-Jeep',
    icon: '🚐',
  },
]

export default function TransportSelector({ value, onChange }) {
  return (
    <div
      className={styles.group}
      role="group"
      aria-label="Choose transport type"
    >
      {TRANSPORT_OPTIONS.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            className={`${styles.btn} ${active ? styles.active : ''}`}
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
          >
            <span className={styles.icon}>{opt.icon}</span>
            <span className={styles.labelWrap}>
              <span className={styles.label}>{opt.label}</span>
              <span className={styles.sub}>{opt.sub}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
