import { Router } from 'express'
import supabase from '../lib/supabase.js'
import verifyJWT from '../middleware/verifyJWT.js'
import isAdmin from '../middleware/isAdmin.js'

const router = Router()

router.use(verifyJWT, isAdmin)

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
export default router