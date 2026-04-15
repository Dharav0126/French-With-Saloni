import supabase from "../lib/supabase.js";

// ── REGISTER ──────────────────────────────────────────
export const register = async (req, res) => {
  const { full_name, email, password, course, phone } = req.body  // ← add phone

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })

  if (authError) {
    return res.status(400).json({ error: authError.message })
  }

  const { error: dbError } = await supabase
    .from('students')
    .insert({
      id:        authData.user.id,
      full_name,
      email,
      phone:     phone || null,   // ← add phone
      course:    course || null,
      role:      'student'
    })

  if (dbError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return res.status(500).json({ error: 'Failed to create student profile' })
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (sessionError) {
    return res.status(500).json({ error: 'Registered but could not create session' })
  }

  return res.status(201).json({
    message:      'Registration successful',
    accessToken:  sessionData.session.access_token,
    refreshToken: sessionData.session.refresh_token,
    user: {
      id: authData.user.id,
      email,
      full_name,
      phone,     // ← add phone
      course,
      role: 'student'
    }
  })
}

// ── LOGIN ─────────────────────────────────────────────
export const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  // Fetch student profile
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('full_name, course, role')
    .eq('id', data.user.id)
    .single()

  return res.status(200).json({
    message:      'Login successful',
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: {
      id:        data.user.id,
      email:     data.user.email,
      full_name: student?.full_name,
      course:    student?.course,
      role:      student?.role
    }
  })
}

// ── LOGOUT ────────────────────────────────────────────
export const logout = async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (token) {
    // Invalidate the session on Supabase side
    await supabase.auth.admin.signOut(token);
  }

  return res.status(200).json({ message: "Logged out successfully" });
};

// ── GET ME (protected) ────────────────────────────────
export const getMe = async (req, res) => {
  // req.user is set by verifyJWT middleware
  const { data: student, error } = await supabase
    .from("students")
    .select("full_name, email, course, role, created_at")
    .eq("id", req.user.sub)
    .single();

  if (error) {
    return res.status(404).json({ error: "Student not found" });
  }

  return res.status(200).json({ user: student });
};
