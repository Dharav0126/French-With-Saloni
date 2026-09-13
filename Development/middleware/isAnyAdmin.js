import supabase from '../lib/supabase.js'

const isAnyAdmin = async (req, res, next) => {
  const { data: student } = await supabase
    .from('students')
    .select('role, assigned_courses')
    .eq('id', req.user.sub)
    .single()

  if (!student || !['super_admin', 'tutor', 'administration'].includes(student.role)) {
    return res.status(403).json({ error: 'Access required' })
  }

  // Attach role info to request for downstream use
  req.adminRole       = student.role
  req.assignedCourses = student.assigned_courses || []
  next()
}

export default isAnyAdmin