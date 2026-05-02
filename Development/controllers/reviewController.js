import supabase from '../lib/supabase.js'

// GET approved reviews — public
export const getApprovedReviews = async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('full_name, course, rating, review_text, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ reviews: data })
}

// POST submit review — enrolled students only
export const submitReview = async (req, res) => {
  const { rating, review_text } = req.body
  const studentId = req.user.sub

  if (!rating || !review_text) {
    return res.status(400).json({ error: 'Rating and review text are required' })
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' })
  }

  // Check if student is enrolled
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('course')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .single()

  if (!enrollment) {
    return res.status(403).json({ error: 'Only enrolled students can leave a review' })
  }

  // Check if student already reviewed
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('student_id', studentId)
    .single()

  if (existing) {
    return res.status(400).json({ error: 'You have already submitted a review' })
  }

  // Get student details
  const { data: student } = await supabase
    .from('students')
    .select('full_name')
    .eq('id', studentId)
    .single()

  // Insert review
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      student_id:  studentId,
      full_name:   student.full_name,
      course:      enrollment.course,
      rating:      parseInt(rating),
      review_text,
      status:      'pending'
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({
    message: 'Review submitted! It will appear after approval.',
    review: data
  })
}

// GET all reviews — admin only
export const getAllReviews = async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ reviews: data })
}

// PATCH approve or reject — admin only
export const updateReviewStatus = async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' })
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: `Review ${status}`, review: data })
}