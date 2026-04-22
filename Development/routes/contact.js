import { Router } from 'express'
import supabase from '../lib/supabase.js'

const router = Router()

router.post('/', async (req, res) => {  // ← must be POST
  const { full_name, email, course, message } = req.body

  if (!full_name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required' })
  }

  const { error } = await supabase
    .from('contacts')
    .insert({ full_name, email, course: course || null, message })

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ message: 'Message received!' })
})

export default router