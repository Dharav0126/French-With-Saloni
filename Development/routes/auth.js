import { Router } from 'express'
import { register, login, logout, getMe } from '../controllers/authController.js'
import verifyJWT from '../middleware/verifyJWT.js'

const router = Router()

router.post('/register', register)
router.post('/login',    login)
router.post('/logout',   logout)
router.get('/me',        verifyJWT, getMe)  // protected

export default router