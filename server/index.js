import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fareRoutes from './routes/fares.js'
import locationsRoutes from './routes/locations.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Routes
app.use('/api/fares', fareRoutes)
app.use('/api/locations', locationsRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Sakay API is running 🚌' })
})

app.listen(PORT, () => {
  console.log(`🚌 Sakay API running at http://localhost:${PORT}`)
})
