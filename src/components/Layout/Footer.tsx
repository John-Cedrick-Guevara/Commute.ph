import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.note}>
        🚌 Sakay · Marikina City Routes · Fare estimates only, confirm with your driver ·
        Not affiliated with LTFRB or any government agency
      </p>
    </footer>
  )
}
