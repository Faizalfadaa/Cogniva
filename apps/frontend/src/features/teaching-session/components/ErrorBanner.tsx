import styles from '../../../styles/TeachingSession.module.css'
import type { SessionError, SessionErrorKind } from './errorTypes'

interface ErrorBannerProps {
  error: SessionError | null
  onDismiss: () => void
}

interface Copy {
  icon: string
  title: string
  text: string
  className: string
}

/**
 * One entry per kind, so adding a kind is a data change rather than another
 * branch in the render. Wording says what happened AND what to do about it —
 * "something went wrong" tells the user nothing they can act on.
 */
const COPY: Record<SessionErrorKind, Copy> = {
  budget_exceeded: {
    icon: '🌱',
    title: 'Session token limit reached',
    text: 'This session has used its entire token allowance. End the session to see the evaluation, or open a new workspace to keep teaching.',
    className: styles.errorBannerBudget,
  },
  network: {
    icon: '📡',
    title: 'No internet connection',
    text: 'The connection dropped. Your whiteboard strokes are still saved on this device — messages will be sent again as soon as the connection is back.',
    className: styles.errorBannerNetwork,
  },
  ai_unavailable: {
    icon: '⚠️',
    title: 'Could not reach Cogniva',
    text: 'The server did not respond, so this turn was not sent. Try pressing Teach again in a moment.',
    className: styles.errorBannerAi,
  },
}

/**
 * A single banner for every session-level problem — one shape, three variants,
 * rather than a component per failure. Rendered at the top-centre of the canvas
 * (see .errorBanner in the stylesheet for why that spot).
 */
export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null

  const copy = COPY[error.kind]

  return (
    <div
      className={`${styles.errorBanner} ${copy.className}`}
      role="alert"
      aria-live="assertive"
    >
      <span className={styles.errorBannerIcon} aria-hidden="true">
        {copy.icon}
      </span>

      <div className={styles.errorBannerBody}>
        <span className={styles.errorBannerTitle}>{copy.title}</span>
        <p className={styles.errorBannerText}>{copy.text}</p>
        {error.detail && <p className={styles.errorBannerDetail}>{error.detail}</p>}
      </div>

      <button
        type="button"
        className={styles.errorBannerClose}
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  )
}
