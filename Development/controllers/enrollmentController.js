import supabase from '../lib/supabase.js'
import { enrollStudent, updateEnrollmentStatus } from '../lib/enrollment.js'

// GET all enrollments (Saloni's overview)
export const getAllEnrollments = async (req, res) => {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      students (full_name, email)
    `)
    .order('enrolled_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ enrollments: data })
}

// GET single student enrollment
export const getStudentEnrollment = async (req, res) => {
  const { studentId } = req.params

  const { data, error } = await supabase
    .from('enrollments')
    .select(`*, students (full_name, email)`)
    .eq('student_id', studentId)
    .single()

  if (error) return res.status(404).json({ error: 'Enrollment not found' })
  return res.status(200).json({ enrollment: data })
}

// POST manually enroll a student (Saloni adds someone without payment)
export const manualEnroll = async (req, res) => {
  const { studentId, course } = req.body

  if (!studentId || !course) {
    return res.status(400).json({ error: 'studentId and course are required' })
  }

  try {
    const enrollment = await enrollStudent({ studentId, course })
    return res.status(201).json({ message: 'Student enrolled', enrollment })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

// PATCH activate or deactivate a student
export const changeEnrollmentStatus = async (req, res) => {
  const { studentId } = req.params
  const { status } = req.body

  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active or inactive' })
  }

  try {
    const data = await updateEnrollmentStatus({ studentId, status })
    return res.status(200).json({ message: `Enrollment ${status}`, data })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}