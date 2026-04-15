import supabase from '../lib/supabase.js'

const isAdmin = async (req, res, next) => {
  const { data: student } = await supabase
    .from('students')
    .select('role')
    .eq('id', req.user.sub)
    .single()

  if (!student || student.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }

  next()
}

export default isAdmin