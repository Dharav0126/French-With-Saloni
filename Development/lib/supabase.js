import { createClient } from '@supabase/supabase-js'

// Service-role client — has full DB access, never expose to frontend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default supabase