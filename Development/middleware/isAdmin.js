import supabase from '../lib/supabase.js'

const isAdmin = async (req, res, next) => {
  console.log('isAdmin check - user:', req.user)
  
  const { data: student, error } = await supabase
    .from('students')
    .select('role, assigned_courses')
    .eq('id', req.user.sub)
    .single()

  console.log('isAdmin check - student:', student, 'error:', error)
  console.log('role check:', student?.role, ['admin', 'super_admin', 'administration'].includes(student?.role))

  if (!student || !['admin', 'super_admin', 'administration'].includes(student.role)) {
    console.log('isAdmin DENIED - role:', student?.role)
    return res.status(403).json({ error: 'Admin access required' })
  }

  req.adminRole = student.role
  next()
}

export default isAdmin