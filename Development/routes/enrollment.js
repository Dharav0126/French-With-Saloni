import { Router } from 'express'
import {
  getAllEnrollments,
  getStudentEnrollment,
  manualEnroll,
  changeEnrollmentStatus
} from '../controllers/enrollmentController.js'
import verifyJWT from '../middleware/verifyJWT.js'
import isAdmin from '../middleware/isAdmin.js'

const router = Router()

// All enrollment routes require login + admin role
router.use(verifyJWT, isAdmin)

router.get('/',                     getAllEnrollments)
router.get('/:studentId',           getStudentEnrollment)
router.post('/manual',              manualEnroll)
router.patch('/:studentId/status',  changeEnrollmentStatus)

export default router