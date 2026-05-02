import { Router } from 'express'
import {
  submitReview,
  getApprovedReviews,
  getAllReviews,
  updateReviewStatus
} from '../controllers/reviewController.js'
import verifyJWT from '../middleware/verifyJWT.js'
import isAdmin from '../middleware/isAdmin.js'

const router = Router()

// Public — get approved reviews for website
router.get('/', getApprovedReviews)

// Protected — student submits review
router.post('/', verifyJWT, submitReview)

// Admin — manage reviews
router.get('/admin', verifyJWT, isAdmin, getAllReviews)
router.patch('/:id/status', verifyJWT, isAdmin, updateReviewStatus)

export default router