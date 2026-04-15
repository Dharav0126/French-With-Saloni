import stripe from '../lib/stripe.js'
import supabase from '../lib/supabase.js'
import { enrollStudent } from '../lib/enrollment.js'
import { COURSES } from '../lib/courses.js'

// ── CREATE CHECKOUT SESSION ───────────────────────────
export const createCheckoutSession = async (req, res) => {
    console.log('Stripe key exists:', !!process.env.STRIPE_SECRET_KEY)
  console.log('Client URL:', process.env.CLIENT_URL)
  const { course } = req.body
  const userId = req.user.sub
  const userEmail = req.user.email

  if (!course || !COURSES[course]) {
    return res.status(400).json({ error: 'Invalid course selected' })
  }

  const selectedCourse = COURSES[course]

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 'payment',
      customer_email:       userEmail,
      line_items: [
        {
          price_data: {
            currency:     selectedCourse.currency,
            unit_amount:  selectedCourse.amount,
            product_data: {
              name:        selectedCourse.name,
              description: selectedCourse.description
            }
          },
          quantity: 1
        }
      ],
      metadata: { userId, course },
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.CLIENT_URL}/cancel`
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Stripe error message:', err.message)  // ← add this
    console.error('Stripe error type:', err.type)        // ← add this
    console.error('Stripe full error:', err)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}

// ── WEBHOOK ───────────────────────────────────────────
export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { userId, course } = session.metadata

    try {
      // Record payment
      await supabase.from('payments').insert({
        student_id:         userId,
        course,
        amount:             session.amount_total,
        currency:           session.currency,
        stripe_session_id:  session.id,
        stripe_customer_id: session.customer,
        status:             'paid'
      })

      // Auto-enroll student
      await enrollStudent({
        studentId:       userId,
        course,
        stripeSessionId: session.id
      })

      console.log(`✅ Student ${userId} enrolled in ${course}`)
    } catch (err) {
      console.error('Enrollment error:', err)
      return res.status(500).json({ error: 'Enrollment failed' })
    }
  }

  res.status(200).json({ received: true })
}