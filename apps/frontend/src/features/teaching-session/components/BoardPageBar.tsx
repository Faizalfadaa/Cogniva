import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/TeachingSession.module.css'
import { pageLabel, type BoardBase } from '../board/boardPages'

interface BoardPageBarProps {
  base: BoardBase
  /** The page the middle of the screen is on — the one a checkpoint captures. */
  activePage: number
  onGoToPage: (index: number) => void
  onAddBlank: (afterIndex: number) => void
  onRemoveBlank: (index: number) => void
  /** Opens the base picker, where the PDF is chosen or set aside. */
  onOpenBase: () => void
  /** Pages are still rendering: moving about is fine, editing the stack is not. */
  busy?: boolean
}

/**
 * Where you are in the stack, and the two things you do to it.
 *
 * Bottom-centre of the canvas: Excalidraw owns the top (its toolbar), the
 * bottom-left (zoom) and the left edge (the style panel), and the bottom-right
 * is the chat launcher and the notification stack. The middle of the bottom edge
 * is the one strip nothing else claims.
 *
 * Only shown when the board stands on a PDF. A plain whiteboard has no pages, so
 * it gets no page bar — nothing about the old board changes.
 */
export function BoardPageBar({
  base,
  activePage,
  onGoToPage,
  onAddBlank,
  onRemoveBlank,
  onOpenBase,
  busy = false,
}: BoardPageBarProps) {
  const t = useT()
  const count = base.pages.length
  const index = Math.max(0, Math.min(activePage, count - 1))
  const current = base.pages[index]
  const label = pageLabel(base.pages, index)

  return (
    <div className={styles.pageBar} role="toolbar" aria-label={t('board.baseMenu')}>
      <button
        type="button"
        className={styles.pageBarBtn}
        onClick={() => onGoToPage(index - 1)}
        disabled={index <= 0}
        aria-label={t('board.prevPage')}
      >
        ‹
      </button>

      <span className={styles.pageBarLabel} aria-live="polite">
        {t('board.pageOf', { label, count })}
        {current?.kind === 'blank' && (
          <span className={styles.pageBarPaper}>{t('board.paper')}</span>
        )}
      </span>

      <button
        type="button"
        className={styles.pageBarBtn}
        onClick={() => onGoToPage(index + 1)}
        disabled={index >= count - 1}
        aria-label={t('board.nextPage')}
      >
        ›
      </button>

      <span className={styles.pageBarDivider} aria-hidden="true" />

      <button
        type="button"
        className={styles.pageBarAction}
        onClick={() => onAddBlank(index)}
        disabled={busy}
        title={t('board.addBlankHint')}
      >
        + {t('board.addBlank')}
      </button>

      {/* Only paper can be taken back out: removing a PDF page would mean
          editing the document, which is not what this board does. */}
      {current?.kind === 'blank' && (
        <button
          type="button"
          className={styles.pageBarAction}
          onClick={() => onRemoveBlank(index)}
          disabled={busy}
        >
          {t('board.removeBlank')}
        </button>
      )}

      <span className={styles.pageBarDivider} aria-hidden="true" />

      <button type="button" className={styles.pageBarAction} onClick={onOpenBase}>
        {t('board.baseMenu')}
      </button>
    </div>
  )
}
