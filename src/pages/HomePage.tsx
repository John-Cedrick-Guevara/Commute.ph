import { useState } from 'react'
import type { FareResult as FareResultData, PuvType } from '../services/api'
import { transportLabel } from '../components/FareChecker/TransportSelector'
import FareCard from '../components/FareChecker/FareCard'
import FareResult from '../components/FareResult/FareResult'
import JeepneySVG from '../components/Jeepney/JeepneySVG'
import styles from './HomePage.module.css'

export default function HomePage() {
  const [result, setResult]         = useState<FareResultData | null>(null)
  const [transport, setTransport]   = useState<PuvType>('traditional_jeepney')

  const handleResult = (data: FareResultData) => setResult(data)
  const handleClose  = () => setResult(null)

  const jeepVariant = transport === 'modern_jeepney' ? 'beepjeep' : 'jeepney'

  return (
    <div className={styles.page}>
      {/* ---- HERO ---- */}
      <section className={styles.hero}>

        {/* Left: heading + fare form */}
        <div className={styles.left}>
          <span className={styles.eyebrow}>Your everyday commute, made simple</span>

          <h1 className={styles.heading}>
            Where are you<br />
            <span className={styles.highlight}>headed?</span>
          </h1>

          <p className={styles.subtext}>
            Find out how much your next ride around Marikina should cost.
            Less guessing. More going.
          </p>

          <FareCard
            onResult={handleResult}
            onTransportChange={setTransport}
          />

          <p className={styles.footnote}>
            ⊙ Marikina City routes only. Fares are estimates from the fare matrix
            in effect; the result shows its source and date.
          </p>
        </div>

        {/* Right: animated jeepney */}
        <div className={styles.right} aria-hidden="true">
          <div className={styles.scene}>
            {/* Clouds */}
            <div className={styles.cloud1} />
            <div className={styles.cloud2} />

            {/* Speech bubble */}
            <div className={styles.bubble}>
              {transport === 'modern_jeepney' ? '🚐' : '🚌'}&nbsp;
              {transportLabel(transport)} mode · Ready when you are
            </div>

            <JeepneySVG variant={jeepVariant} state="idle" />

            {/* Road */}
            <div className={styles.road}>
              <div className={styles.roadMarkings}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={styles.dash} />
                ))}
              </div>
            </div>

            {/* Taglines */}
            <div className={styles.taglines}>
              <p className={styles.tagline}>A little less "magkano po?"</p>
              <p className={`${styles.tagline} ${styles.taglineAccent}`}>
                A lot more peace of mind.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- FEATURES STRIP ---- */}
      <section className={styles.strip}>
        <div className={styles.stripInner}>
          <div className={styles.headline}>
            Small fares.<br /><span>Big peace of mind.</span>
          </div>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.feature}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <div>
                <p className={styles.featureTitle}>{f.title}</p>
                <p className={styles.featureSub}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- FARE RESULT MODAL ---- */}
      {result && <FareResult result={result} onClose={handleClose} />}
    </div>
  )
}

const FEATURES = [
  { icon: '📍', title: 'Know before you go',   sub: 'A quick estimate, before your ride.' },
  { icon: '🚐', title: 'Your ride, your choice', sub: 'Traditional or Beep Jeep. Your choice.' },
  { icon: '✓',  title: 'Built for every Juan',  sub: 'Simple, free, and always welcoming.' },
]
