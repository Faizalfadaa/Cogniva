import { useState } from 'react'
import styles from '../../styles/HomePage.module.css'

/**
 * The real sign-in form: login/register toggle, credentials, guest escape.
 *
 * Extracted from HomePage so the landing page can open the same component as a
 * modal instead of maintaining a second, fake one. The logic below is
 * unchanged from where it used to live.
 *
 * `onClose` is the only addition. HomePage renders this as the whole screen
 * with nowhere to go back to, so it omits the prop and neither dismiss control
 * appears. The landing page passes it and gets an X plus a "Back to the site"
 * link, both of which just close the overlay.
 */
export function LoginScreen({
  onLogin,
  onRegister,
  onGuest,
  onClose,
}: {
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (username: string, password: string) => Promise<void>
  onGuest: () => void
  onClose?: () => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'login') {
        await onLogin(username, password)
      } else {
        await onRegister(username, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = username.trim().length > 0 && password.length > 0

  return (
    <div className={styles.modalOverlay}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
      >
        {onClose && (
          <button
            type="button"
            className={styles.loginClose}
            onClick={onClose}
            aria-label="Close sign in"
            disabled={submitting}
          >
            ✕
          </button>
        )}

        <div className={styles.loginLogo}>
          <img src="/cogniva_logo.png" alt="" />
        </div>
        <h2 id="login-title" className={styles.modalTitle}>
          {mode === 'login' ? 'Sign in to Cogniva' : 'Create your account'}
        </h2>
        <p className={styles.modalBody}>
          Keep your teaching workspaces attached to your username.
        </p>

        <input
          className={styles.modalInput}
          type="text"
          value={username}
          placeholder="Username"
          autoComplete="username"
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          maxLength={24}
          aria-label="Username"
        />
        <input
          className={styles.modalInput}
          type="password"
          value={password}
          placeholder="Password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          aria-label="Password"
        />
        {error && <p className={styles.authError}>{error}</p>}

        <button className={styles.modalBtn} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting
            ? 'Please wait...'
            : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
        </button>
        <button
          className={styles.modalBtnGhost}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
          disabled={submitting}
        >
          {mode === 'login' ? 'Create a new account' : 'I already have an account'}
        </button>
        <button className={styles.guestBtn} onClick={onGuest} disabled={submitting}>
          Continue as guest
        </button>

        {onClose && (
          <button
            type="button"
            className={styles.loginBackLink}
            onClick={onClose}
            disabled={submitting}
          >
            ← Back to the site
          </button>
        )}
      </div>
    </div>
  )
}
