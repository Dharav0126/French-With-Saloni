import supabase from './supabase.js'
import resend from './resend.js'
import twilio from './twilio.js'
import { COURSES } from './courses.js'

// ── ENROLL STUDENT ────────────────────────────────────
export const enrollStudent = async ({ studentId, course, stripeSessionId }) => {

    // 1. Fetch student details
const { data: student, error: studentError } = await supabase
  .from('students')
  .select('full_name, email, phone')  // ← just add , phone here
  .eq('id', studentId)
  .single()

  if (studentError || !student) {
    throw new Error(`Student not found: ${studentId}`)
  }

  // 2. Create enrollment record
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .insert({
      student_id:        studentId,
      course,
      status:            'active',
      stripe_session_id: stripeSessionId || null,
      enrolled_at:       new Date().toISOString()
    })
    .select()
    .single()

  if (enrollError) {
    throw new Error(`Enrollment failed: ${enrollError.message}`)
  }

  // 3. Update student's course in students table
  await supabase
    .from('students')
    .update({ course })
    .eq('id', studentId)

  // 4. Send email confirmation to student
  await sendEnrollmentEmail(student, course)

  // 5. Notify Saloni on WhatsApp
  await notifySaloni(student, course)

  return enrollment
}

// ── UNENROLL / DEACTIVATE ─────────────────────────────
export const updateEnrollmentStatus = async ({ studentId, status }) => {
  const { data, error } = await supabase
    .from('enrollments')
    .update({ status })
    .eq('student_id', studentId)
    .eq('status', status === 'active' ? 'inactive' : 'active')
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update enrollment: ${error.message}`)
  }

  return data
}

// ── SEND EMAIL ────────────────────────────────────────
const sendEnrollmentEmail = async (student, course) => {
  const courseDetails = COURSES[course]

  try {
    await resend.emails.send({
      from:    `French with Saloni <no-reply@frenchwithsaloni.com>`,
      to:      student.email,
      subject: `🎉 You're enrolled in ${courseDetails.name}!`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#1355A0;">Bonjour ${student.full_name}! 🇫🇷</h2>
          <p>You have successfully enrolled in <strong>${courseDetails.name}</strong>.</p>
          <div style="background:#EEF5FF;padding:20px;border-radius:8px;margin:20px 0;">
            <h3 style="color:#1355A0;margin:0 0 10px;">Course Details</h3>
            <p style="margin:0;">${courseDetails.description}</p>
          </div>
          <p>Saloni will reach out to you shortly with your class schedule and Zoom links.</p>
          <p>In the meantime, if you have any questions feel free to reply to this email.</p>
          <br/>
          <p>À bientôt,<br/><strong>Saloni</strong><br/>French with Saloni</p>
        </div>
      `
    })
    console.log(`✅ Enrollment email sent to ${student.email}`)
  } catch (err) {
    console.error('Email send failed:', err)
    // Don't throw — email failure shouldn't block enrollment
  }
}

// ── NOTIFY SALONI ─────────────────────────────────────
const notifySaloni = async (student, course) => {
  const courseDetails = COURSES[course]

  try {
    await twilio.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to:   process.env.SALONI_WHATSAPP,
      body: `🎉 New enrollment!\n\nStudent: ${student.full_name}\nEmail: ${student.email}\nPhone: ${student.phone || 'Not provided'}\nCourse: ${courseDetails.name}\n\nPlease reach out to set up their schedule.`
    })
    console.log(`✅ WhatsApp notification sent to Saloni`)
  } catch (err) {
    console.error('WhatsApp send failed:', err)
  }
}