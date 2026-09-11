// ── CONFIG ─────────────────────────────────────────
const API = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : window.location.origin

// ── TOKEN HELPERS ──────────────────────────────────
const getToken  = () => localStorage.getItem('fws_token')
const setToken  = (t) => localStorage.setItem('fws_token', t)
const setUser   = (u) => localStorage.setItem('fws_user', JSON.stringify(u))
const getUser   = () => JSON.parse(localStorage.getItem('fws_user') || 'null')
const clearAuth = () => {
  localStorage.removeItem('fws_token')
  localStorage.removeItem('fws_user')
}

// ── TOAST ──────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.className = `toast ${type} show`
  setTimeout(() => t.classList.remove('show'), 3500)
}

// ── FORMAT HELPERS ─────────────────────────────────
function formatCourse(course) {
  const map = {
    tef:        'TEF Preparation',
    tcf:        'TCF Preparation',
    a1:         'A1 — Complete Beginner',
    a2:         'A2 — Elementary',
    b1:         'B1 — Intermediate',
    b2:         'B2 — Upper Intermediate',
    'clb7-6mo': 'A1-B2 — 6 months',
    'clb7-4mo': 'CLB 7 — 4 months',
    '1on1':     '1-on-1 Private',
  }
  return map[course] || course || '—'
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}