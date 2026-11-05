import { useEffect, useState, type FormEvent } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import FareMatricesPage from './pages/FareMatricesPage'
import FareMatrixEditor from './pages/FareMatrixEditor'
import StopsPage from './pages/StopsPage'
import RoutesPage from './pages/RoutesPage'
import RouteEditor from './pages/RouteEditor'
import SavedFaresPage from './pages/SavedFaresPage'
import styles from './admin.module.css'

/** Admin panel: sign-in gate, then fare matrices, stops, routes and saved fares. */
export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  // Restore the session and follow sign-in / sign-out / token refresh
  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabase) {
    return (
      <main className={styles.login}>
        <p className={styles.error}>
          Admin sign-in isn't configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example).
        </p>
      </main>
    )
  }
  if (checking) return null
  if (!session) return <SignIn />

  // The API enforces the role; this only avoids showing pages that would all fail
  if (session.user.app_metadata?.role !== 'admin') {
    return (
      <main className={`${styles.login} ${styles.section}`}>
        <p className={styles.sectionTitle}>This account isn't an admin</p>
        <p className={styles.subtitle}>
          Signed in as {session.user.email}. Ask a project owner to give this account the admin role.
        </p>
        <button className={styles.button} onClick={() => supabase?.auth.signOut()}>Sign out</button>
      </main>
    )
  }

  const link = ({ isActive }: { isActive: boolean }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <span className={styles.brand}>Sakay admin</span>
        <nav className={styles.nav} aria-label="Admin sections">
          <NavLink to="/admin/fare-matrices" className={link}>Fare matrices</NavLink>
          <NavLink to="/admin/stops" className={link}>Stops</NavLink>
          <NavLink to="/admin/routes" className={link}>Routes</NavLink>
          <NavLink to="/admin/saved-fares" className={link}>Saved fares</NavLink>
        </nav>
        <span className={styles.who}>{session.user.email}</span>
        <button className={`${styles.button} ${styles.small}`} onClick={() => supabase?.auth.signOut()}>
          Sign out
        </button>
      </header>

      <main className={styles.main}>
        <Routes>
          <Route index element={<Navigate to="fare-matrices" replace />} />
          <Route path="fare-matrices" element={<FareMatricesPage />} />
          <Route path="fare-matrices/:id" element={<FareMatrixEditor />} />
          <Route path="stops" element={<StopsPage />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="routes/:id" element={<RouteEditor />} />
          <Route path="saved-fares" element={<SavedFaresPage />} />
        </Routes>
      </main>
    </div>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: signInError } = await supabase!.auth.signInWithPassword({ email, password })
    if (signInError) {
      console.error('Admin sign-in failed', signInError)
      setError('That email and password don\'t match an account. Check them and try again.')
    }
    setBusy(false)
  }

  return (
    <main className={`${styles.login} ${styles.section}`}>
      <h1 className={styles.title}>Admin sign-in</h1>
      <p className={styles.subtitle}>Sakay fare data management</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label className={styles.field}>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={styles.field}>
          Password
          <input type="password" autoComplete="current-password" required value={password}
                 onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={`${styles.button} ${styles.primary}`} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
