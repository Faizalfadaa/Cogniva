import type { CSSProperties } from 'react'
import { LOCALE_LABELS, type Locale } from './messages'

/**
 * A read-only "ID" / "EN" mark.
 *
 * Two places need to state a language without offering to change it: a
 * workspace card on the dashboard, which says what language that session was
 * taught in, and the header of an open session, where the language is fixed for
 * the life of the session. Both are the same fact, so both look the same.
 *
 * Sized and coloured to match one option of LanguageToggle, so a card badge and
 * the switch beside it read as the same kind of thing.
 */

const badge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 8px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.03em',
  lineHeight: 1.4,
  color: 'var(--lime-text, #1a2200)',
  background: 'var(--lime, #d8ff29)',
  border: '1px solid var(--border, rgba(30, 25, 10, 0.1))',
  borderRadius: 'var(--radius-sm, 8px)',
  whiteSpace: 'nowrap',
}

export function LocaleBadge({
  locale,
  title,
  style,
}: {
  locale: Locale
  /** Why it cannot be changed here. Falls back to naming the language. */
  title?: string
  style?: CSSProperties
}) {
  return (
    <span style={{ ...badge, ...style }} title={title ?? LOCALE_LABELS[locale]}>
      {locale.toUpperCase()}
    </span>
  )
}
