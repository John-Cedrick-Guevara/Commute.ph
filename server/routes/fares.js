import { Router } from 'express'
import { LOCATIONS } from '../data/locations.js'
import { FARE_MATRIX, DISCOUNT_RATES } from '../data/fareMatrix.js'

const router = Router()

/**
 * POST /api/fares/calculate
 * Body: { from, to, transport, passengerType }
 */
router.post('/calculate', (req, res) => {
  const { from, to, transport, passengerType } = req.body

  // Validate required fields
  if (!from || !to || !transport || !passengerType) {
    return res.status(400).json({
      error: 'Missing required fields: from, to, transport, passengerType',
    })
  }

  // Validate transport type
  if (!FARE_MATRIX[transport]) {
    return res.status(400).json({
      error: `Invalid transport type. Must be one of: ${Object.keys(FARE_MATRIX).join(', ')}`,
    })
  }

  // Validate passenger type
  if (!(passengerType in DISCOUNT_RATES)) {
    return res.status(400).json({
      error: `Invalid passenger type. Must be one of: ${Object.keys(DISCOUNT_RATES).join(', ')}`,
    })
  }

  // Look up known locations for distance estimate
  const fromLoc = LOCATIONS.find((l) => l.name.toLowerCase() === from.toLowerCase())
  const toLoc   = LOCATIONS.find((l) => l.name.toLowerCase() === to.toLowerCase())

  let distance
  if (fromLoc && toLoc) {
    // Real distance delta between known stops
    distance = Math.abs(fromLoc.km - toLoc.km) + 0.5
  } else {
    // Fallback: approximate for unknown inputs
    distance = 4.0
  }
  distance = Math.max(1, parseFloat(distance.toFixed(1)))

  const matrix       = FARE_MATRIX[transport]
  const baseFare     = matrix.baseFare
  const extraCharge  = distance > matrix.baseKm
    ? parseFloat(((distance - matrix.baseKm) * matrix.extraPerKm).toFixed(2))
    : 0
  const subtotal     = parseFloat((baseFare + extraCharge).toFixed(2))
  const discountRate = DISCOUNT_RATES[passengerType]
  const discountAmt  = parseFloat((subtotal * discountRate).toFixed(2))
  const total        = parseFloat((subtotal - discountAmt).toFixed(2))

  res.json({
    from,
    to,
    transport,
    transportLabel: matrix.label,
    passengerType,
    distance,
    baseFare,
    extraCharge,
    subtotal,
    discountRate,
    discountAmount: discountAmt,
    total,
    currency: 'PHP',
    disclaimer:
      'This is a sample estimate only. Always confirm the actual fare with your driver or operator.',
    source: 'LTFRB fare matrix reference (demo data)',
    lastUpdated: 'November 2026',
  })
})

/**
 * GET /api/fares/matrix
 * Returns the full fare matrix for reference
 */
router.get('/matrix', (_req, res) => {
  res.json({ fareMatrix: FARE_MATRIX, discountRates: DISCOUNT_RATES })
})

export default router
