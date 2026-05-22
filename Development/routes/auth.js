import { Router } from 'express'
import { register, login, logout, getMe } from '../controllers/authController.js'
import verifyJWT from '../middleware/verifyJWT.js'
import supabase from '../lib/supabase.js'
const router = Router()

router.post('/register', register)
router.post('/login',    login)
router.post('/logout',   logout)
router.get('/me',        verifyJWT, getMe)  // protected

// GET student dashboard data
router.get('/dashboard', verifyJWT, async (req, res) => {
  const studentId = req.user.sub

  // Get student profile
  const { data: student } = await supabase
    .from('students')
    .select('full_name, email, phone, course, created_at')
    .eq('id', studentId)
    .single()

  // Get enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('course, status, enrolled_at')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .single()

  // Get payment history
  const { data: payments } = await supabase
    .from('payments')
    .select('course, amount, currency, status, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  return res.status(200).json({
    student,
    enrollment: enrollment || null,
    payments:   payments  || []
  })
})

export default router