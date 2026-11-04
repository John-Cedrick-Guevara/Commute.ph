import styles from './JeepneySVG.module.css'

/**
 * Animated SVG jeepney illustration.
 * Props:
 *  - variant: 'jeepney' | 'beepjeep'  (colour scheme)
 *  - state:   'idle' | 'driving' | 'arrived'
 */
export default function JeepneySVG({ variant = 'jeepney', state = 'idle' }) {
  const isBeep = variant === 'beepjeep'
  const bodyColor   = isBeep ? '#3B82F6' : '#F5C400'
  const roofColor   = isBeep ? '#2563EB' : '#D4A800'
  const accentColor = isBeep ? '#93C5FD' : '#F07B30'
  const label       = isBeep ? 'BEEP JEEP' : 'SAKAY TAYO!'

  const wrapperClass = [
    styles.wrapper,
    state === 'driving' ? styles.driving : '',
    state === 'arrived' ? styles.arrived : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperClass}>
      <svg
        viewBox="0 0 520 240"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={isBeep ? 'Beep Jeep illustration' : 'Jeepney illustration'}
        role="img"
        className={styles.svg}
      >
        {/* Body */}
        <rect x="30" y="70" width="400" height="130" rx="18" fill={bodyColor} />

        {/* Roof */}
        <rect x="10" y="50" width="440" height="40" rx="12" fill={roofColor} />
        <line x1="60"  y1="50" x2="60"  y2="90" stroke={roofColor === '#D4A800' ? '#C49800' : '#1D4ED8'} strokeWidth="3" />
        <line x1="160" y1="50" x2="160" y2="90" stroke={roofColor === '#D4A800' ? '#C49800' : '#1D4ED8'} strokeWidth="3" />
        <line x1="260" y1="50" x2="260" y2="90" stroke={roofColor === '#D4A800' ? '#C49800' : '#1D4ED8'} strokeWidth="3" />
        <line x1="360" y1="50" x2="360" y2="90" stroke={roofColor === '#D4A800' ? '#C49800' : '#1D4ED8'} strokeWidth="3" />

        {/* Front cab */}
        <rect x="360" y="72" width="70" height="110" rx="10" fill={isBeep ? '#1E40AF' : '#E0B000'} />

        {/* Windshield */}
        <rect x="368" y="80" width="54" height="60" rx="6" fill="#AEE0F0" opacity="0.9" />

        {/* Driver silhouette */}
        <circle cx="395" cy="105" r="10" fill="#2A3558" opacity="0.5" />
        <rect x="385" y="114" width="20" height="16" rx="4" fill="#2A3558" opacity="0.4" />

        {/* Side windows */}
        <rect x="60"  y="86" width="65" height="50" rx="6" fill="#AEE0F0" opacity="0.85" />
        <rect x="145" y="86" width="65" height="50" rx="6" fill="#AEE0F0" opacity="0.85" />
        <rect x="230" y="86" width="65" height="50" rx="6" fill="#AEE0F0" opacity="0.85" />

        {/* Stripe */}
        <rect x="30" y="145" width="330" height="16" fill="#1A2340" opacity="0.12" />

        {/* Decorative art */}
        <path
          d={isBeep
            ? 'M60 152 L340 152'
            : 'M60 148 Q80 130 100 148 Q120 130 140 148 M160 148 Q180 130 200 148 Q220 130 240 148'}
          stroke={accentColor}
          strokeWidth={isBeep ? '2' : '3'}
          fill="none"
          strokeLinecap="round"
        />

        {/* Label */}
        <rect x="90" y="155" width="200" height="26" rx="6" fill="#1A2340" opacity="0.1" />
        <text
          x="190" y="172"
          textAnchor="middle"
          fontFamily="Nunito, sans-serif"
          fontSize="13"
          fontWeight="900"
          fill="#1A2340"
          opacity="0.7"
        >
          {label}
        </text>

        {/* Dots */}
        <circle cx="50" cy="110" r="3" fill={accentColor} />
        <circle cx="50" cy="125" r="3" fill={accentColor} />
        <circle cx="50" cy="140" r="3" fill={accentColor} />

        {/* Bumpers */}
        <rect x="26"  y="155" width="12" height="40" rx="6" fill={isBeep ? '#1D4ED8' : '#C49800'} />
        <rect x="422" y="155" width="20" height="30" rx="6" fill={isBeep ? '#1D4ED8' : '#C49800'} />

        {/* Headlights */}
        <circle cx="432" cy="145" r="8" fill="#FFF9C4" opacity="0.9" />
        <circle cx="432" cy="145" r="5" fill="#FFEE55" />

        {/* Tail lights */}
        <circle cx="35" cy="135" r="6" fill="#F07B30" opacity="0.8" />

        {/* Undercarriage */}
        <rect x="40" y="190" width="360" height="12" rx="4" fill={isBeep ? '#1D4ED8' : '#C49800'} opacity="0.4" />

        {/* FRONT WHEEL — positioned at cx/cy, rotated with SVG animateTransform */}
        <g>
          <circle cx="390" cy="205" r="28" fill="#1A2340" />
          <circle cx="390" cy="205" r="20" fill="#2A3558" />
          <circle cx="390" cy="205" r="12" fill={bodyColor} />
          <circle cx="390" cy="205" r="5"  fill="#1A2340" />
          {/* Spokes — drawn in a group that spins around the wheel centre */}
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 390 205"
              to="360 390 205"
              dur="1.2s"
              repeatCount="indefinite"
            />
            <line x1="372" y1="205" x2="408" y2="205" stroke={bodyColor} strokeWidth="2.5" opacity="0.6" />
            <line x1="390" y1="187" x2="390" y2="223" stroke={bodyColor} strokeWidth="2.5" opacity="0.6" />
            <line x1="377" y1="192" x2="403" y2="218" stroke={bodyColor} strokeWidth="2" opacity="0.4" />
            <line x1="403" y1="192" x2="377" y2="218" stroke={bodyColor} strokeWidth="2" opacity="0.4" />
          </g>
        </g>

        {/* BACK WHEEL — same approach */}
        <g>
          <circle cx="95" cy="205" r="28" fill="#1A2340" />
          <circle cx="95" cy="205" r="20" fill="#2A3558" />
          <circle cx="95" cy="205" r="12" fill={bodyColor} />
          <circle cx="95" cy="205" r="5"  fill="#1A2340" />
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 95 205"
              to="360 95 205"
              dur="1.2s"
              repeatCount="indefinite"
            />
            <line x1="77" y1="205" x2="113" y2="205" stroke={bodyColor} strokeWidth="2.5" opacity="0.6" />
            <line x1="95" y1="187" x2="95"  y2="223" stroke={bodyColor} strokeWidth="2.5" opacity="0.6" />
            <line x1="82" y1="192" x2="108" y2="218" stroke={bodyColor} strokeWidth="2" opacity="0.4" />
            <line x1="108" y1="192" x2="82" y2="218" stroke={bodyColor} strokeWidth="2" opacity="0.4" />
          </g>
        </g>
      </svg>
    </div>
  )
}
