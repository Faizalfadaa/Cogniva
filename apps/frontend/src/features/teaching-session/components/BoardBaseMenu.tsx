import { useRef } from 'react'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/TeachingSession.module.css'
import type { BoardBaseSource } from '../board/boardPages'

interface BoardBaseMenuProps {
  /** What the board stands on now, if anything. */
  current?: BoardBaseSource
  /** True when the session already has a reference PDF that could be used. */
  hasReferencePdf: boolean
  /** True when a PDF has already been uploaded for the board. */
  hasBoardPdf: boolean
  onChoose: (source: BoardBaseSource) => void
  onUpload: (file: File) => void
  /** Back to the endless whiteboard. The marks stay; the pages are set aside. */
  onClearBase: () => void
  onClose: () => void
  /** Uploading or rendering — the choices wait rather than queue up. */
  busy?: boolean
  /** Set when the last attempt could not be opened. */
  problem?: string
}

/**
 * Choosing what the board stands on.
 *
 * The reference PDF is offered here on purpose, and the note under it says what
 * it means: the page being explained is captured into the checkpoint and the
 * student sees it. That is the point of teaching out of a book — the student is
 * still being taught, not handed the answers — but it is the user's choice to
 * make knowingly, so it is written down rather than implied.
 */
export function BoardBaseMenu({
  current,
  hasReferencePdf,
  hasBoardPdf,
  onChoose,
  onUpload,
  onClearBase,
  onClose,
  busy = false,
  problem,
}: BoardBaseMenuProps) {
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={styles.selectOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('board.baseTitle')}
    >
      <div className={styles.selectPanel}>
        <h2 className={styles.selectTitle}>{t('board.baseTitle')}</h2>
        <p className={styles.selectSubtitle}>{t('board.baseSubtitle')}</p>

        <div className={styles.baseGrid}>
          {hasReferencePdf && (
            <button
              type="button"
              className={current === 'reference' ? styles.baseCardCurrent : styles.baseCard}
              onClick={() => onChoose('reference')}
              disabled={busy}
            >
              <span className={styles.baseCardTitle}>{t('board.baseReference')}</span>
              <span className={styles.baseCardNote}>{t('board.baseReferenceNote')}</span>
            </button>
          )}

          {hasBoardPdf && (
            <button
              type="button"
              className={current === 'board' ? styles.baseCardCurrent : styles.baseCard}
              onClick={() => onChoose('board')}
              disabled={busy}
            >
              <span className={styles.baseCardTitle}>{t('board.baseBoardPdf')}</span>
              <span className={styles.baseCardNote}>{t('board.baseUploadNote')}</span>
            </button>
          )}

          <button
            type="button"
            className={styles.baseCard}
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <span className={styles.baseCardTitle}>{t('board.baseUpload')}</span>
            <span className={styles.baseCardNote}>{t('board.baseUploadNote')}</span>
          </button>

          <button
            type="button"
            className={current ? styles.baseCard : styles.baseCardCurrent}
            onClick={onClearBase}
            disabled={busy}
          >
            <span className={styles.baseCardTitle}>{t('board.basePlain')}</span>
            <span className={styles.baseCardNote}>{t('board.basePlainNote')}</span>
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Cleared so picking the same file twice still fires a change.
            event.target.value = ''
            if (file) onUpload(file)
          }}
        />

        <p className={styles.langNote} role={problem ? 'alert' : 'status'}>
          {problem ?? (busy ? t('board.baseUploading') : '')}
        </p>

        <button type="button" className={styles.selectCancel} onClick={onClose} disabled={busy}>
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}
