import styles from '../../../styles/TeachingSession.module.css'
import { useT } from '../../../i18n/LanguageProvider'
import type { MessageKey } from '../../../i18n/messages'
import type { SessionError, SessionErrorKind } from './errorTypes'

interface ErrorBannerProps {
  error: SessionError | null
  onDismiss: () => void
}

interface Copy {
  icon: string
  title: MessageKey
  text: MessageKey
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
    title: 'error.budgetTitle',
    text: 'error.budgetText',
    className: styles.errorBannerBudget,
  },
  network: {
    icon: '📡',
    title: 'error.networkTitle',
    text: 'error.networkText',
    className: styles.errorBannerNetwork,
  },
  ai_unavailable: {
    icon: '⚠️',
    title: 'error.aiTitle',
    text: 'error.aiText',
    className: styles.errorBannerAi,
  },
  empty_board: {
    icon: '✏️',
    title: 'error.emptyTitle',
    text: 'error.emptyText',
    className: styles.errorBannerEmpty,
  },
}

/**
 * A single banner for every session-level problem — one shape, three variants,
 * rather than a component per failure. Rendered at the top-centre of the canvas
 * (see .errorBanner in the stylesheet for why that spot).
 */
export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  const t = useT()
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
        <span className={styles.errorBannerTitle}>{t(copy.title)}</span>
        <p className={styles.errorBannerText}>{t(copy.text)}</p>
        {error.detail && <p className={styles.errorBannerDetail}>{error.detail}</p>}
      </div>

      <button
        type="button"
        className={styles.errorBannerClose}
        onClick={onDismiss}
        aria-label={t('error.dismiss')}
      >
        ✕
      </button>
    </div>
  )
}
