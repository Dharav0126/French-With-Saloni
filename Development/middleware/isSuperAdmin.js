import supabase from '../lib/supabase.js'

const isSuperAdmin = async (req, res, next) => {
  const { data: student } = await supabase
    .from('students')
    .select('role')
    .eq('id', req.user.sub)
    .single()

  if (!student || student.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' })
  }

  req.adminRole = student.role
  next()
}

export default isSuperAdmin