import supabase from '../lib/supabase.js'

const isAdmin = async (req, res, next) => {
  const { data: student } = await supabase
    .from('students')
    .select('role, assigned_courses')
    .eq('id', req.user.sub)
    .single()

  // Accept both old 'admin' and new 'super_admin' and 'administration' roles
  if (!student || !['admin', 'super_admin', 'administration'].includes(student.role)) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  req.adminRole       = student.role
  req.assignedCourses = student.assigned_courses || []
  next()
}

export default isAdmin