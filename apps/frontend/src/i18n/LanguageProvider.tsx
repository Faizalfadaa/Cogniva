import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LOCALES, messages, type Locale, type MessageKey } from './messages'

/**
 * The interface language, chosen by the user and remembered per browser.
 *
 * There are two languages in play.
 *
 * The *preference* is the reader's, kept per browser. The dashboard, the public
 * pages and everything outside a session are written in it.
 *
 * The *session language* belongs to a workspace and is fixed when it is
 * created. It decides what the student says, what the report is written in and
 * whether a voice exists. While a session's board or its evaluation is open,
 * the whole screen is shown in that language, interface included, so a page
 * never mixes an Indonesian conversation with English buttons or the other way
 * round. The switch turns into a label naming it, because it cannot be changed
 * there. Leaving restores the preference untouched.
 *
 * Nothing here is async and there is no loader: both dictionaries ship in the
 * bundle, because they are a few hundred short strings and a flash of the wrong
 * language costs more than the bytes save.
 */

const LOCALE_KEY = 'cogniva:locale'

/** The app is Indonesian-first, so anything but an explicitly English browser lands on Indonesian. */
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (stored && (LOCALES as readonly string[]).includes(stored)) return stored as Locale
  } catch {
    // localStorage unavailable (private mode): fall through to the browser's own setting.
  }
  const preferred = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase()
  return preferred.startsWith('en') ? 'en' : 'id'
}

/** Fill {placeholders} in a message. Values are stringified, never parsed as markup. */
function interpolate(text: string, values?: Record<string, string | number>): string {
  if (!values) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  )
}

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string

interface LanguageValue {
  /** What to render in: the session's language while one is open, else the preference. */
  locale: Locale
  setLocale: (locale: Locale) => void
  /** True while a session holds the language, i.e. it cannot be changed here. */
  pinned: boolean
  /** The open session's language, or the reader's own when no session is open. */
  sessionLocale: Locale
  pin: (locale: Locale | null) => void
  t: Translate
}

const LanguageContext = createContext<LanguageValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<Locale>(detectLocale)
  const [pinnedLocale, setPinnedLocale] = useState<Locale | null>(null)

  const locale = pinnedLocale ?? preference

  const setLocale = useCallback((next: Locale) => {
    setPreference(next)
    try {
      localStorage.setItem(LOCALE_KEY, next)
    } catch {
      // Not remembering the choice is a cosmetic loss, not worth interrupting over.
    }
  }, [])

  // Deliberately not persisted: a pin belongs to the screen that set it, and
  // must not outlive it. A reload lands on the dashboard in the preference.
  const pin = useCallback((next: Locale | null) => setPinnedLocale(next), [])

  // Screen readers, spell-checking and hyphenation all read this attribute.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<LanguageValue>(
    () => ({
      locale,
      setLocale,
      pinned: pinnedLocale !== null,
      sessionLocale: locale,
      pin,
      t: (key, values) => interpolate(messages[key][locale], values),
    }),
    [locale, setLocale, pinnedLocale, pin],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return value
}

/** The translator. `t('header.teach')`, or `t('stage.say', { name })`. */
export function useT(): Translate {
  return useLanguage().t
}

/**
 * The current language and its setter, plus the open session's language.
 *
 * Inside a session the two are the same; `sessionLocale` exists so code about
 * what the student says or whether a voice exists reads as what it means.
 */
export function useLocale(): {
  locale: Locale
  setLocale: (locale: Locale) => void
  pinned: boolean
  sessionLocale: Locale
} {
  const { locale, setLocale, pinned, sessionLocale } = useLanguage()
  return { locale, setLocale, pinned, sessionLocale }
}

/**
 * Show this screen entirely in a session's own language for as long as it is open.
 *
 * Pass the workspace's locale, or undefined while it is still loading, which
 * pins nothing and leaves the reader's preference in place for that moment.
 * Unmounting releases the pin, so navigating back to the dashboard returns to
 * their own language.
 */
export function usePinnedLocale(locale: Locale | undefined): void {
  const { pin } = useLanguage()
  useEffect(() => {
    pin(locale ?? null)
    return () => pin(null)
  }, [locale, pin])
}
