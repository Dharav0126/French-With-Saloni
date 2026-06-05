import { Router } from 'express'
import supabase from '../lib/supabase.js'
import verifyJWT from '../middleware/verifyJWT.js'
import isAdmin from '../middleware/isAdmin.js'
import multer from 'multer'

const router = Router()

router.use(verifyJWT, isAdmin)
const upload = multer({ storage: multer.memoryStorage() })

// GET all students
router.get('/students', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ students: data })
})

// GET all contacts
router.get('/contacts', async (req, res) => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ contacts: data })
})

// GET course settings
router.get('/course-settings', async (req, res) => {
  const { data, error } = await supabase
    .from('course_settings')
    .select('*')

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ settings: data })
})

// PATCH update Meet link for a course
router.patch('/course-settings/:course', async (req, res) => {
  const { course } = req.params
  const { meet_link } = req.body

  const { data, error } = await supabase
    .from('course_settings')
    .update({ meet_link, updated_at: new Date().toISOString() })
    .eq('course', course)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Meet link updated', data })
})

// POST upload lecture with video file
router.post('/lectures/upload', upload.single('video'), async (req, res) => {
  try {
    let { course, title, description, level, order_num, batch_id } = req.body

    // If batch is selected, get course from batch
    if (batch_id) {
      const { data: batch } = await supabase
        .from('batches')
        .select('course')
        .eq('id', batch_id)
        .single()

      if (batch) course = batch.course  // ← override course with batch's course
    }
    if (!course || !title || !req.file) {
      return res.status(400).json({ error: 'Course, title and video file are required' })
    }

    // Upload video to Supabase Storage
    const fileName  = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`
    const videoPath = `${course.toUpperCase()}/${fileName}`

    const { error: uploadError } = await supabase
      .storage
      .from('Lectures')
      .upload(videoPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      })

    if (uploadError) {
      return res.status(500).json({ error: `Upload failed: ${uploadError.message}` })
    }

    // Save lecture metadata to database
    const { data, error: dbError } = await supabase
      .from('lectures')
      .insert({
        course,
        title,
        description: description || null,
        video_path:  videoPath,
        level:       level || 'A1',
        order_num:   parseInt(order_num) || 1,
        batch_id:    batch_id || null
      })
      .select()
      .single()

    if (dbError) {
      return res.status(500).json({ error: dbError.message })
    }

    return res.status(201).json({ message: 'Lecture uploaded successfully!', lecture: data })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// POST upload lecture (metadata only — video uploaded directly to Supabase Storage)
router.post('/lectures', async (req, res) => {
  const { course, title, description, video_path, order_num } = req.body

  if (!course || !title || !video_path) {
    return res.status(400).json({ error: 'Course, title and video_path are required' })
  }

  const { data, error } = await supabase
    .from('lectures')
    .insert({ course, title, description, video_path, order_num: order_num || 1 })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ message: 'Lecture added', lecture: data })
})

// GET all lectures
router.get('/lectures', async (req, res) => {
  const { data, error } = await supabase
    .from('lectures')
    .select('*')
    .order('course', { ascending: true })
    .order('order_num', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ lectures: data })
})

// DELETE lecture
router.delete('/lectures/:id', async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('lectures')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Lecture deleted' })
})

// GET all batches
router.get('/batches', async (req, res) => {
  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .order('course', { ascending: true })
    .order('batch_name', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ batches: data })
})

// POST create batch
router.post('/batches', async (req, res) => {
  const { course, batch_name, days, timing, meet_link } = req.body

  if (!course || !batch_name || !days || !timing) {
    return res.status(400).json({ error: 'Course, batch name, days and timing are required' })
  }

  const { data, error } = await supabase
    .from('batches')
    .insert({ course, batch_name, days, timing, meet_link: meet_link || null })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ message: 'Batch created', batch: data })
})

// PATCH update batch
router.patch('/batches/:id', async (req, res) => {
  const { id } = req.params
  const { batch_name, days, timing, meet_link, is_active } = req.body

  const { data, error } = await supabase
    .from('batches')
    .update({ batch_name, days, timing, meet_link, is_active })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Batch updated', batch: data })
})

// DELETE batch
router.delete('/batches/:id', async (req, res) => {
  const { id } = req.params  // ← add this line

  const { error } = await supabase
    .from('batches')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Batch deleted' })
})

// PATCH assign student to batch
router.patch('/enrollments/:studentId/batch', async (req, res) => {
  const { studentId } = req.params
  const { batch_id } = req.body

  if (!batch_id) {
    return res.status(400).json({ error: 'batch_id is required' })
  }

  // Get batch info to find the course
  const { data: batch } = await supabase
    .from('batches')
    .select('course')
    .eq('id', batch_id)
    .single()

  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' })
  }

  // Check if student already has an enrollment
  const { data: existing } = await supabase
    .from('enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('status', 'active')

  if (existing && existing.length > 0) {
    // Update existing enrollment with batch_id
    const { error } = await supabase
      .from('enrollments')
      .update({ batch_id, course: batch.course })
      .eq('student_id', studentId)
      .eq('status', 'active')

    if (error) return res.status(500).json({ error: error.message })
  } else {
    // No enrollment exists — create one automatically
    const { error } = await supabase
      .from('enrollments')
      .insert({
        student_id: studentId,
        course:     batch.course,
        status:     'active',
        batch_id:   batch_id
      })

    if (error) return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ message: 'Student enrolled and assigned to batch!' })
})
export default router