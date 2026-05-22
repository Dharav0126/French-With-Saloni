import { Router } from 'express'
import supabase from '../lib/supabase.js'
import verifyJWT from '../middleware/verifyJWT.js'

const router = Router()

// GET student dashboard — course, lectures, meet link
router.get('/dashboard', verifyJWT, async (req, res) => {
  const studentId = req.user.sub

  // Get enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('course, status, enrolled_at')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .single()

  if (!enrollment) {
    return res.status(200).json({
      enrolled: false,
      course:   null,
      lectures: [],
      meetLink: null,
      schedule: null
    })
  }

  // Get lectures for this course
  const { data: lectures } = await supabase
    .from('lectures')
    .select('id, title, description, video_path, order_num')
    .eq('course', enrollment.course)
    .order('order_num', { ascending: true })

  // Generate signed URLs for each lecture (2 hour expiry)
  const lecturesWithUrls = await Promise.all(
    (lectures || []).map(async (lecture) => {
      const { data: signedUrl } = await supabase
        .storage
        .from('Lectures')
        .createSignedUrl(lecture.video_path, 7200) // 2 hours

      return {
        ...lecture,
        url: signedUrl?.signedUrl || null
      }
    })
  )

  // Get Meet link and schedule for this course
  const { data: settings } = await supabase
    .from('course_settings')
    .select('meet_link, meet_schedule')
    .eq('course', enrollment.course)
    .single()

  return res.status(200).json({
    enrolled:    true,
    course:      enrollment.course,
    enrolledAt:  enrollment.enrolled_at,
    lectures:    lecturesWithUrls,
    meetLink:    settings?.meet_link || null,
    schedule:    settings?.meet_schedule || null
  })
})

export default router