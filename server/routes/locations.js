import { Router } from 'express'
import { LOCATIONS } from '../data/locations.js'

const router = Router()

// GET /api/locations?q=marikina
router.get('/', (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim()

  if (!query) {
    return res.json(LOCATIONS)
  }

  const results = LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(query) ||
      loc.area.toLowerCase().includes(query)
  ).slice(0, 8)

  res.json(results)
})

export default router
