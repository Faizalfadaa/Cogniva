import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/TeachingSession.module.css'

interface ReferenceMenuProps {
  /** Uploaded reference file, if any. */
  pdfUrl?: string
  /** Set when the reference came from the web instead of an upload. */
  referenceSource?: { url: string; title: string; source: string }
  uploading?: boolean
  onUpload: (file: File) => void
  /** Opens the Referencer dialog, where an agent looks material up. */
  onFindWithAgent: () => void
}

/** The backend returns a relative /api path; mock/blobs are already absolute. */
function resolveFileHref(url: string): string {
  if (/^(https?:|blob:|data:)/.test(url)) return url
  const base = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
  return `${base}${url}`
}

/** The menu's choices, in order, for arrow-key movement between them. */
function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
}

function BookIcon() {
  return (
    <svg className={styles.referenceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className={styles.referenceItemIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg className={styles.referenceItemIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg className={styles.referenceItemIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  )
}

/**
 * One Reference button for both ways of getting reference material: an agent
 * that looks it up, or a file of the user's own.
 *
 * These used to be two header buttons side by side, "Reference (PDF)" and
 * "Find reference", which read as two different things when they are two routes
 * to the same one, and put a file format in front of people who had no file.
 * The format is still enforced, by the file picker, where it belongs.
 *
 * When material is already attached the button says so, and the menu leads with
 * a way to open it; the upload item becomes "Replace".
 */
export function ReferenceMenu({
  pdfUrl,
  referenceSource,
  uploading = false,
  onUpload,
  onFindWithAgent,
}: ReferenceMenuProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const attachedHref = pdfUrl ? resolveFileHref(pdfUrl) : referenceSource?.url
  const attachedName = pdfUrl
    ? t('header.referenceYourFile')
    : referenceSource?.title || referenceSource?.source

  // Close on a press anywhere else; the menu is a transient choice, not a panel.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    // Keyboard users land on the first choice instead of having to find it.
    requestAnimationFrame(() => menuItems(menuRef.current)[0]?.focus())
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = menuItems(menuRef.current)
    const at = list.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      list[(at + 1) % list.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      list[(at - 1 + list.length) % list.length]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.referenceMenu} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        data-tour="reference-button"
        className={styles.referenceBtn}
        onClick={() => setOpen((v) => !v)}
        disabled={uploading}
        aria-haspopup="menu"
        aria-expanded={open}
        title={attachedHref ? t('header.referenceAttached') : t('header.referenceTitle')}
      >
        <BookIcon />
        <span>{uploading ? t('header.uploading') : t('header.reference')}</span>
        {attachedHref && !uploading && (
          <span className={styles.referenceDot} aria-label={t('header.referenceAttached')} />
        )}
        <svg className={styles.referenceChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('header.referenceMenu')}
          className={styles.referencePopover}
          onKeyDown={onMenuKeyDown}
        >
          {attachedHref && (
            <a
              role="menuitem"
              className={styles.referenceItem}
              href={attachedHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => close(false)}
            >
              <OpenIcon />
              <span className={styles.referenceItemText}>
                <span className={styles.referenceItemTitle}>{t('header.referenceOpen')}</span>
                <span className={styles.referenceItemHint}>{attachedName}</span>
              </span>
            </a>
          )}

          <button
            type="button"
            role="menuitem"
            className={styles.referenceItem}
            onClick={() => {
              close(false)
              onFindWithAgent()
            }}
          >
            <SearchIcon />
            <span className={styles.referenceItemText}>
              <span className={styles.referenceItemTitle}>{t('header.referenceAgent')}</span>
              <span className={styles.referenceItemHint}>{t('header.referenceAgentHint')}</span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            className={styles.referenceItem}
            onClick={() => {
              close(false)
              fileRef.current?.click()
            }}
          >
            <UploadIcon />
            <span className={styles.referenceItemText}>
              <span className={styles.referenceItemTitle}>
                {pdfUrl ? t('header.referenceReplace') : t('header.referenceUpload')}
              </span>
              <span className={styles.referenceItemHint}>{t('header.referenceUploadHint')}</span>
            </span>
          </button>

          <p className={styles.referenceFootnote}>{t('header.referenceFootnote')}</p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
