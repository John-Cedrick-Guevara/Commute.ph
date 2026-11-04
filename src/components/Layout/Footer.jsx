import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.note}>
        🚌 Sakay · Marikina City Routes · Sample fare estimates only ·
        Not affiliated with LTFRB or any government agency
      </p>
    </footer>
  )
}
