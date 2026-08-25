import { Router } from 'express'
import supabase from '../lib/supabase.js'
import verifyJWT from '../middleware/verifyJWT.js'
import isAdmin from '../middleware/isAdmin.js'

const router = Router()

// ── ADMIN ROUTES (protected) ────────────────────────

// GET all quizzes
router.get('/admin', verifyJWT, isAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ quizzes: data })
})

// POST create quiz
router.post('/admin', verifyJWT, isAdmin, async (req, res) => {
const { title, course, level, attempts_allowed, timer_seconds } = req.body

  if (!title || !course) {
    return res.status(400).json({ error: 'Title and course are required' })
  }

  const { data, error } = await supabase
  .from('quizzes')
  .insert({
    title,
    course,
    level: level || 'General',
    attempts_allowed: parseInt(attempts_allowed) || 3,
    timer_seconds: parseInt(timer_seconds) || 20
  })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ message: 'Quiz created', quiz: data })
})

// PATCH update quiz
router.patch('/admin/:id', verifyJWT, isAdmin, async (req, res) => {
  const { id } = req.params
  const { title, course, level, attempts_allowed, is_active } = req.body

  const { data, error } = await supabase
    .from('quizzes')
    .update({ title, course, level, attempts_allowed, is_active })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Quiz updated', quiz: data })
})

// DELETE quiz
router.delete('/admin/:id', verifyJWT, isAdmin, async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('quizzes')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Quiz deleted' })
})

// GET questions for a quiz
router.get('/admin/:id/questions', verifyJWT, isAdmin, async (req, res) => {
  const { id } = req.params

  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', id)
    .order('order_num', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ questions: data })
})

// POST add question to quiz
router.post('/admin/:id/questions', verifyJWT, isAdmin, async (req, res) => {
  const { id } = req.params
  const { question_text, question_type, options, correct_answer, order_num } = req.body

  if (!question_text || !correct_answer) {
    return res.status(400).json({ error: 'Question text and correct answer are required' })
  }

  if (question_type === 'mcq' && (!options || options.length < 2)) {
    return res.status(400).json({ error: 'MCQ questions require at least 2 options' })
  }

  const { data, error } = await supabase
    .from('quiz_questions')
    .insert({
      quiz_id:       id,
      question_text,
      question_type: question_type || 'mcq',
      options:       question_type === 'mcq' ? options : null,
      correct_answer,
      order_num:     parseInt(order_num) || 1
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ message: 'Question added', question: data })
})

// DELETE question
router.delete('/admin/questions/:questionId', verifyJWT, isAdmin, async (req, res) => {
  const { questionId } = req.params

  const { error } = await supabase
    .from('quiz_questions')
    .delete()
    .eq('id', questionId)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Question deleted' })
})

// ── STUDENT ROUTES (protected) ──────────────────────

// GET quizzes for a course (student)
router.get('/course/:course', verifyJWT, async (req, res) => {
  const { course } = req.params
  const studentId = req.user.id

  // Get active quizzes for course
  const { data: quizzes, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('course', course)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  // Get attempt counts for this student
  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('quiz_id, score, total, attempted_at')
    .eq('student_id', studentId)

  // Attach attempt info to each quiz
  const quizzesWithAttempts = quizzes.map(q => {
    const myAttempts = (attempts || []).filter(a => a.quiz_id === q.id)
    const attemptsUsed = myAttempts.length
    const attemptsLeft = Math.max(0, q.attempts_allowed - attemptsUsed)
    const bestScore = myAttempts.length > 0
      ? Math.max(...myAttempts.map(a => Math.round((a.score / a.total) * 100)))
      : null

    return {
      ...q,
      attemptsUsed,
      attemptsLeft,
      bestScore,
      canAttempt: attemptsLeft > 0
    }
  })

  return res.status(200).json({ quizzes: quizzesWithAttempts })
})

// GET questions for a quiz (student — no correct answers)
router.get('/:id/questions', verifyJWT, async (req, res) => {
  const { id } = req.params
  const studentId = req.user.id

  // Check attempts remaining
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('attempts_allowed')
    .eq('id', id)
    .single()

  if (!quiz) return res.status(404).json({ error: 'Quiz not found' })

  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('id')
    .eq('quiz_id', id)
    .eq('student_id', studentId)


  // Return questions WITHOUT correct_answer
  const { data: questions, error } = await supabase
    .from('quiz_questions')
    .select('id, question_text, question_type, options, order_num')
    .eq('quiz_id', id)
    .order('order_num', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
return res.status(200).json({ questions, timer_seconds: quiz.timer_seconds || 20 })
})

// POST submit quiz attempt
router.post('/:id/submit', verifyJWT, async (req, res) => {
  const { id } = req.params
  const studentId = req.user.id
  const { answers } = req.body // { questionId: "student answer", ... }

  // Check attempts remaining
 const { data: quiz } = await supabase
  .from('quizzes')
  .select('attempts_allowed, timer_seconds')
  .eq('id', id)
  .single()

  if (!quiz) return res.status(404).json({ error: 'Quiz not found' })

  

  
  // Get correct answers
const { data: questions, error } = await supabase
  .from('quiz_questions')
  .select('id, question_text, correct_answer, question_type, options')
  .eq('quiz_id', id)

  if (error) return res.status(500).json({ error: error.message })

    // Grade the attempt and build review
  let score = 0
  const review = questions.map(q => {
    const studentAnswer = (answers[q.id] || '').toString().trim().toLowerCase()
    const correctAnswer  = q.correct_answer.toString().trim().toLowerCase()
    const isCorrect      = studentAnswer === correctAnswer
    if (isCorrect) score++

    // For MCQ — convert letter (a/b/c/d) to actual option text
    const studentAnswerDisplay = q.question_type === 'mcq'
      ? (q.options?.[answers[q.id]?.charCodeAt(0) - 97] || answers[q.id] || '(no answer)')
      : (answers[q.id] || '(no answer)')

    const correctAnswerDisplay = q.question_type === 'mcq'
      ? (q.options?.[q.correct_answer.charCodeAt(0) - 97] || q.correct_answer)
      : q.correct_answer

    return {
      question_text:  q.question_text,
      student_answer: studentAnswerDisplay,
      correct_answer: correctAnswerDisplay,
      correct:        isCorrect
    }
  })

  const total = questions.length

  // Save attempt
  const { error: saveError } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id:    id,
      student_id: studentId,
      score,
      total,
      answers
    })

  if (saveError) return res.status(500).json({ error: saveError.message })

  const attemptsLeft = '∞'

  return res.status(200).json({
    message:    'Quiz submitted!',
    score,
    total,
    percentage: Math.round((score / total) * 100),
    attemptsLeft,
    review
  })
})

export default router