import { Link } from 'react-router-dom'
import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        <div className={styles.logoIcon}>🚌</div>
        <span className={styles.logoText}>
          sakay<span className={styles.dot}>.</span>
        </span>
      </Link>

      <span className={styles.tagline}>Know your fare. Enjoy the ride.</span>

      <Link to="/how-it-works" className={styles.hiwBtn}>
        How it works ↗
      </Link>
    </header>
  )
}
