import { useEffect, useRef } from 'react'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/ReferenceFinder.module.css'

interface FinishWithoutReferenceDialogProps {
  /** Close this and open the reference finder instead. */
  onFindReference: () => void
  /** Finish the session as it is. */
  onFinishAnyway: () => void
  /** Back to teaching, nothing changed. */
  onCancel: () => void
}

/**
 * Asked once, when the user finishes a session that has no reference material.
 *
 * The Evaluator grades the teaching against the reference. With none, it still
 * returns a score, but the score rests on the model's general knowledge and no
 * concept can be found missing, and nothing on the way to the debrief said so.
 * This is the one moment the user can still fix that, so it asks here rather
 * than explaining afterwards. Adding a reference is the first choice; finishing
 * anyway stays one click away, because a session about something no source
 * covers is a legitimate session.
 */
export function FinishWithoutReferenceDialog({
  onFindReference,
  onFinishAnyway,
  onCancel,
}: FinishWithoutReferenceDialogProps) {
  const t = useT()
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primaryRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className={styles.overlay}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="finish-no-reference-title"
      aria-describedby="finish-no-reference-body"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className={`${styles.panel} ${styles.panelNarrow}`}>
        <header className={styles.head}>
          <div>
            <h2 id="finish-no-reference-title" className={styles.title}>
              {t('finish.noReferenceTitle')}
            </h2>
            <p id="finish-no-reference-body" className={styles.subtitle}>
              {t('finish.noReferenceBody')}
            </p>
          </div>
          <button className={styles.close} onClick={onCancel} aria-label={t('common.close')}>
            ✕
          </button>
        </header>

        <div className={styles.foot}>
          <button type="button" className={styles.ghostBtn} onClick={onFinishAnyway}>
            {t('finish.finishAnyway')}
          </button>
          <button
            ref={primaryRef}
            type="button"
            className={styles.primaryBtn}
            onClick={onFindReference}
          >
            {t('finish.addReference')}
          </button>
        </div>
      </div>
    </div>
  )
}
