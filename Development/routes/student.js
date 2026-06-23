import { Router } from 'express'
import supabase from '../lib/supabase.js'
import verifyJWT from '../middleware/verifyJWT.js'

const router = Router()

// GET student dashboard
router.get('/dashboard', verifyJWT, async (req, res) => {
  const studentId = req.user.sub

  // Get enrollment with batch info
  const { data: enrollment } = await supabase
  .from('enrollments')
  .select(`
    course,
    status,
    enrolled_at,
    batch_id,
    exam_type,
    batches (
      batch_name,
      days,
      timing,
      meet_link
    )
  `)
  .eq('student_id', studentId)
  .eq('status', 'active')
  .order('enrolled_at', { ascending: false })
  .limit(1)
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

  // Get lectures — by batch if assigned, otherwise by course
  let lectureQuery = supabase
    .from('lectures')
    .select('id, title, description, video_path, order_num, level, course, batch_id')
    .order('order_num', { ascending: true })

  if (enrollment.batch_id) {
    lectureQuery = lectureQuery.eq('batch_id', enrollment.batch_id)
  } else {
    lectureQuery = lectureQuery.eq('course', enrollment.course).is('batch_id', null)
  }

  const { data: lectures } = await lectureQuery

  // Generate signed URLs for each lecture
  const lecturesWithUrls = await Promise.all(
    (lectures || []).map(async (lecture) => {
      const { data: signedUrl } = await supabase
        .storage
        .from('Lectures')
        .createSignedUrl(lecture.video_path, 7200)

      return {
        ...lecture,
        url: signedUrl?.signedUrl || null
      }
    })
  )

  // Group lectures by level
  const groupedLectures = {}
  lecturesWithUrls.forEach(lecture => {
    const level = lecture.level || 'General'
    if (!groupedLectures[level]) groupedLectures[level] = []
    groupedLectures[level].push(lecture)
  })

  // Get study materials for this course
  const { data: materials } = await supabase
    .from('study_materials')
    .select('id, title, description, type, file_path, url, level, order_num')
    .eq('course', enrollment.course)
    .order('order_num', { ascending: true })

  // Generate signed URLs for uploaded materials
  const materialsWithUrls = await Promise.all(
    (materials || []).map(async (material) => {
      if (material.file_path) {
        const { data: signedUrl } = await supabase
          .storage
          .from('Material')
          .createSignedUrl(material.file_path, 7200)
        return { ...material, downloadUrl: signedUrl?.signedUrl || null }
      }
      return { ...material, downloadUrl: material.url || null }
    })
  )

  // Get Meet link and schedule for this course
  const { data: settings } = await supabase
    .from('course_settings')
    .select('meet_link, meet_schedule')
    .eq('course', enrollment.course)
    .single()

  return res.status(200).json({
  enrolled:        true,
  course:          enrollment.course,
  examType:        enrollment.exam_type || 'TEF',
  enrolledAt:      enrollment.enrolled_at,
  batch:           enrollment.batches || null,
  lectures:        lecturesWithUrls,
  groupedLectures: groupedLectures,
  materials:       materialsWithUrls,
  meetLink:        enrollment.batches?.meet_link || settings?.meet_link || null,
  schedule:        enrollment.batches
    ? `${enrollment.batches.days} · ${enrollment.batches.timing}`
    : settings?.meet_schedule || null
})
})

// GET single lecture with signed URL
router.get('/lecture/:id', verifyJWT, async (req, res) => {
  const { id } = req.params
  const studentId = req.user.sub

  console.log('Lecture request:', { id, studentId })

  // Verify student is enrolled — get latest active enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('course, batch_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .single()

  console.log('Enrollment found:', enrollment)

  if (!enrollment) {
    return res.status(403).json({ error: 'Not enrolled' })
  }

  // Get lecture
  const { data: lecture, error } = await supabase
    .from('lectures')
    .select('id, title, description, video_path, order_num, level, course, batch_id')
    .eq('id', id)
    .single()

  if (error || !lecture) {
    return res.status(404).json({ error: 'Lecture not found' })
  }

  console.log('Lecture found:', lecture)

  // Verify lecture belongs to student's batch or course
  const hasAccess =
    (lecture.batch_id && lecture.batch_id === enrollment.batch_id) ||
    (!lecture.batch_id && lecture.course === enrollment.course)

  console.log('Access check:', {
    lectureBatch:    lecture.batch_id,
    enrollmentBatch: enrollment.batch_id,
    match: hasAccess
  })

  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' })
  }

  // Generate signed URL
  const { data: signedUrl } = await supabase
    .storage
    .from('Lectures')
    .createSignedUrl(lecture.video_path, 7200)

  return res.status(200).json({
    lecture: {
      ...lecture,
      url: signedUrl?.signedUrl || null
    }
  })
})

export default router