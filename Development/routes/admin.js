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
  .from('Material')
  .upload(filePath, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false,
    contentDisposition: 'inline'
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

// GET all materials
router.get('/materials', async (req, res) => {
  const { data, error } = await supabase
    .from('study_materials')
    .select('*')
    .order('course', { ascending: true })
    .order('order_num', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ materials: data })
})



// POST create material
router.post('/materials', async (req, res) => {
  const { material_category, course, title, description, type, url, level, order_num, exam_type } = req.body

  if (!title || !url) {
    return res.status(400).json({ error: 'Title and URL are required' })
  }

  if (material_category === 'class_notes' && !course) {
    return res.status(400).json({ error: 'Course is required for class notes' })
  }

  if (material_category === 'exam_prep' && !exam_type) {
    return res.status(400).json({ error: 'Exam type is required for exam materials' })
  }

  const { data, error } = await supabase
    .from('study_materials')
    .insert({
      material_category: material_category || 'class_notes',
      course:    material_category === 'class_notes' ? course : null,
      exam_type: material_category === 'exam_prep'    ? exam_type : null,
      title,
      description: description || null,
      type: type || 'link',
      url,
      level: level || 'A1',
      order_num: parseInt(order_num) || 1
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ message: 'Material added', material: data })
})

// POST upload material as a file (PDF/Doc) to Supabase Storage
router.post('/materials/upload', upload.single('file'), async (req, res) => {
  try {
    const { material_category, course, title, description, level, order_num, exam_type } = req.body

    if (!title || !req.file) {
      return res.status(400).json({ error: 'Title and file are required' })
    }

    if (material_category === 'class_notes' && !course) {
      return res.status(400).json({ error: 'Course is required for class notes' })
    }

    if (material_category === 'exam_prep' && !exam_type) {
      return res.status(400).json({ error: 'Exam type is required for exam materials' })
    }

    // Upload file to Supabase Storage
    const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`
    const folder    = course || exam_type || 'general'
    const filePath  = `${folder.toUpperCase()}/${fileName}`

    const { error: uploadError } = await supabase
      .storage
      .from('Material')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      })

    if (uploadError) {
      return res.status(500).json({ error: `Upload failed: ${uploadError.message}` })
    }

    // Determine file type from mimetype
    const type = req.file.mimetype.includes('pdf') ? 'pdf' : 'doc'

    // Save metadata to database
    const { data, error: dbError } = await supabase
      .from('study_materials')
      .insert({
        material_category: material_category || 'class_notes',
        course:    material_category === 'class_notes' ? course : null,
        exam_type: material_category === 'exam_prep'    ? exam_type : null,
        title,
        description: description || null,
        type,
        file_path: filePath,
        url: null,
        level: level || 'A1',
        order_num: parseInt(order_num) || 1
      })
      .select()
      .single()

    if (dbError) {
      return res.status(500).json({ error: dbError.message })
    }

    return res.status(201).json({ message: 'Material uploaded successfully!', material: data })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// DELETE material
router.delete('/materials/:id', async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('study_materials')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Material deleted' })
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
  const { id } = req.params

  const { error } = await supabase
    .from('batches')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Batch deleted' })
})

// PATCH update exam type for a student's active enrollment
router.patch('/enrollments/:studentId/exam-type', async (req, res) => {
  const { studentId } = req.params
  const { exam_type } = req.body

  if (!exam_type) {
    return res.status(400).json({ error: 'exam_type is required' })
  }

  const { data, error } = await supabase
    .from('enrollments')
    .update({ exam_type })
    .eq('student_id', studentId)
    .eq('status', 'active')
    .select()

  if (error) return res.status(500).json({ error: error.message })
  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'No active enrollment found for this student' })
  }

  return res.status(200).json({ message: 'Exam type updated', data })
})

// PATCH assign student to batch (creates a NEW enrollment, supports multiple batches per student)
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

  // Check if student is ALREADY enrolled in this exact batch (avoid true duplicates)
  const { data: existingSameBatch } = await supabase
    .from('enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('batch_id', batch_id)
    .eq('status', 'active')

  if (existingSameBatch && existingSameBatch.length > 0) {
    return res.status(400).json({ error: 'Student is already enrolled in this batch' })
  }

  // Create a brand new enrollment for this batch
  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      student_id: studentId,
      course:     batch.course,
      status:     'active',
      batch_id:   batch_id
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ message: 'Student enrolled and assigned to batch!', enrollment: data })
})

export default router