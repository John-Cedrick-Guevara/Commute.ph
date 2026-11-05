import type { VersionSummary } from '../adminApi'
import styles from '../admin.module.css'

/** Draft / In effect / Scheduled or superseded / Retracted */
export function StatusBadge({ version }: { version: VersionSummary }) {
  if (version.status === 'draft') return <span className={`${styles.badge} ${styles.badgeDraft}`}>Draft</span>
  if (version.status === 'retracted') return <span className={`${styles.badge} ${styles.badgeRetracted}`}>Retracted</span>
  if (version.is_current) return <span className={`${styles.badge} ${styles.badgeCurrent}`}>In effect</span>
  const upcoming = version.effective_from !== null && new Date(`${version.effective_from}T00:00:00`) > new Date()
  return <span className={styles.badge}>{upcoming ? 'Scheduled' : 'Superseded'}</span>
}
