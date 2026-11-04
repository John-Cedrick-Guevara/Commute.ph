import { Link } from 'react-router-dom'
import styles from './HowItWorksPage.module.css'

const STEPS = [
  {
    num: '1',
    title: 'Enter your route',
    body: 'Type your starting point and destination anywhere in Marikina City. The app will suggest known stops and landmarks as you type.',
  },
  {
    num: '2',
    title: 'Choose your ride',
    body: 'Pick between a traditional Jeepney or a modern Beep Jeep (e-jeep). Both operate on Marikina routes.',
  },
  {
    num: '3',
    title: 'Select your passenger type',
    body: 'Students, senior citizens, and PWDs are eligible for a 20% discount under LTFRB and RA 9994 / RA 10754. Always bring a valid ID.',
  },
  {
    num: '4',
    title: 'Check your fare',
    body: 'Get an instant estimate based on sample LTFRB fare matrices. No sign-up, no payment, no account required.',
  },
  {
    num: '5',
    title: 'Confirm with your driver',
    body: 'Sakay shows sample estimates only. Always verify the actual fare with your driver or operator before riding.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Simple as taking a jeep</span>
        <h1 className={styles.heading}>How it works</h1>
        <p className={styles.sub}>
          Five steps from no idea to knowing your fare.
        </p>

        <div className={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.num} className={styles.step}>
              <div className={styles.num}>{s.num}</div>
              <div className={styles.content}>
                <h2 className={styles.stepTitle}>{s.title}</h2>
                <p className={styles.stepBody}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.disclaimer}>
          <p>
            <strong>⚠ Important:</strong> Sakay is a prototype for demonstration
            purposes. Fares shown are sample estimates only and are not verified
            real-world prices. Sakay is not affiliated with LTFRB or any
            government agency.
          </p>
        </div>

        <Link to="/" className={styles.backBtn}>
          ← Back to fare checker
        </Link>
      </div>
    </div>
  )
}
