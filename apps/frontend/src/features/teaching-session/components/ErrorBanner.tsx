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
    title: 'Batas token sesi tercapai',
    text: 'Sesi ini sudah memakai seluruh jatah tokennya. Akhiri sesi untuk melihat evaluasi, atau buka workspace baru untuk lanjut mengajar.',
    className: styles.errorBannerBudget,
  },
  network: {
    icon: '📡',
    title: 'Tidak terhubung ke internet',
    text: 'Koneksi terputus. Coretan di papan tetap tersimpan di perangkat ini — pesan akan terkirim lagi begitu koneksi kembali.',
    className: styles.errorBannerNetwork,
  },
  ai_unavailable: {
    icon: '⚠️',
    title: 'Gagal menghubungi Cogniva',
    text: 'Server tidak merespons, jadi giliran ini belum terkirim. Coba tekan Teach sekali lagi sebentar lagi.',
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
        aria-label="Tutup pemberitahuan"
      >
        ✕
      </button>
    </div>
  )
}
