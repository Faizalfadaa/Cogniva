import type { CSSProperties } from 'react'
import { useLocale, useT } from './LanguageProvider'
import { LocaleBadge } from './LocaleBadge'
import { LOCALES, LOCALE_LABELS } from './messages'

/**
 * The language switch: two short codes rather than a dropdown.
 *
 * Both options are visible at once because there are only two, and because a
 * reader looking for their own language should see it without opening anything.
 * The codes stay untranslated — "ID" and "EN" read the same in both languages,
 * and the full name is on the tooltip for anyone unsure.
 *
 * Inside an open session it stops being a switch and becomes a label. The
 * language belongs to the workspace, not to the reader, so there is nothing here
 * to choose — and a disabled pair of buttons would invite the click anyway. The
 * tooltip says where the choice is actually made.
 */

const group: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  padding: '2px',
  borderRadius: 'var(--radius-sm, 8px)',
  border: '1px solid var(--border, rgba(30, 25, 10, 0.1))',
  background: 'var(--card-bg, #fff)',
}

const option: CSSProperties = {
  padding: '3px 8px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.03em',
  lineHeight: 1.4,
  color: 'var(--text-muted, #9a9282)',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm, 8px)',
  cursor: 'pointer',
}

const optionActive: CSSProperties = {
  ...option,
  color: 'var(--lime-text, #1a2200)',
  background: 'var(--lime, #d8ff29)',
  cursor: 'default',
}

export function LanguageToggle({ style }: { style?: CSSProperties }) {
  const { locale, setLocale, pinned } = useLocale()
  const t = useT()

  if (pinned) {
    return (
      <LocaleBadge
        locale={locale}
        title={t('common.languageLocked', { language: LOCALE_LABELS[locale] })}
        style={style}
      />
    )
  }

  return (
    <div style={{ ...group, ...style }} role="group" aria-label={t('common.language')}>
      {LOCALES.map((code) => {
        const active = code === locale
        return (
          <button
            key={code}
            type="button"
            style={active ? optionActive : option}
            onClick={() => setLocale(code)}
            aria-pressed={active}
            title={LOCALE_LABELS[code]}
          >
            {code.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
