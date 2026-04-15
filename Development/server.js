import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import 'dotenv/config'

import authRoutes from './routes/auth.js'
import paymentRoutes from './routes/payment.js'
// import enrollmentRoutes from './routes/enrollment.js'
import contactRoutes from './routes/contact.js'

const app = express()

// ── Webhook must use raw body — register BEFORE express.json()
app.use('/payment/webhook', express.raw({ type: 'application/json' }))

// ── Middleware
app.use(helmet())
app.use(cors({ origin: 'http://127.0.0.1:5500', credentials: true }))
app.use(express.json())

// ── Routes
app.use('/auth',        authRoutes)
app.use('/payment',     paymentRoutes)
// app.use('/enrollments', enrollmentRoutes)
app.use('/contact',     contactRoutes)

// ── Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }))

// ── Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))