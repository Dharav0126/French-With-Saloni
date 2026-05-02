import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'

import authRoutes from './routes/auth.js'
import paymentRoutes from './routes/payment.js'
import enrollmentRoutes from './routes/enrollment.js'
import contactRoutes from './routes/contact.js'
import reviewRoutes from './routes/reviews.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app = express()

// ── Webhook must use raw body — register BEFORE express.json()
app.use('/payment/webhook', express.raw({ type: 'application/json' }))

// ── Middleware
// ── Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr:  ["'unsafe-inline'"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com"],
      imgSrc:         ["'self'", "data:", "https:"],
      connectSrc:     ["'self'", "https://*.supabase.co", "https://api.stripe.com"],
      frameSrc:       ["'self'", "https://js.stripe.com", "https://checkout.stripe.com"],
    }
  }
}))
app.use(cors())
app.use(express.json())

// ── Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')))

// ── Routes
app.use('/auth',        authRoutes)
app.use('/payment',     paymentRoutes)
app.use('/enrollments', enrollmentRoutes)
app.use('/contact',     contactRoutes)
app.use('/reviews', reviewRoutes)

// ── Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }))

// ── Catch-all — serve index.html
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// ── Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))