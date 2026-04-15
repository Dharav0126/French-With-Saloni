import { Router } from 'express'
import { createCheckoutSession, handleWebhook } from '../controllers/paymentController.js'
import verifyJWT from '../middleware/verifyJWT.js'
import express from 'express'

const router = Router()

router.post('/create-checkout-session', verifyJWT, createCheckoutSession)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook)

export default router