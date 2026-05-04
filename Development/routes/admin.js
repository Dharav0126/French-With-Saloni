import { Router } from 'express'
import supabase from '../lib/supabase.js'
import verifyJWT from '../middleware/verifyJWT.js'
import isAdmin from '../middleware/isAdmin.js'

const router = Router()

router.use(verifyJWT, isAdmin)

// GET all students
router.get('/students', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ students: data })
})

// GET all contacts
router.get('/contacts', async (req, res) => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ contacts: data })
})

export default router