import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LOCALES, messages, type Locale, type MessageKey } from './messages'

/**
 * The interface language, chosen by the user and remembered per browser.
 *
 * Two things use it, and they are deliberately the same setting: the words on
 * screen, and the language the AI student answers in (which the backend reads
 * from the workspace). A session where the interface is Indonesian but the
 * student replies in English would be the worst of both.
 *
 * Nothing here is async and there is no loader: both dictionaries ship in the
 * bundle, because they are a few hundred short strings and a flash of the wrong
 * language costs more than the bytes save.
 *
 * There are two languages in play, not one. The *preference* is the user's, kept
 * per browser. The *pin* is a workspace's, set while a session is open: a
 * session is written, spoken and reported in one language, so it is shown in
 * that language whatever the reader normally prefers, and the switch goes away
 * until they leave. Leaving restores the preference untouched — opening someone
 * else's Indonesian session should not change what language your dashboard is
 * in.
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
  /** What to render in: the pinned language when a session is open, else the preference. */
  locale: Locale
  setLocale: (locale: Locale) => void
  /** True while a session holds the language, i.e. it cannot be changed here. */
  pinned: boolean
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

/** The current language and a setter, for the switcher. */
export function useLocale(): {
  locale: Locale
  setLocale: (locale: Locale) => void
  pinned: boolean
} {
  const { locale, setLocale, pinned } = useLanguage()
  return { locale, setLocale, pinned }
}

/**
 * Show this screen in a session's own language for as long as it is open.
 *
 * Pass the workspace's locale — or undefined while it is still loading, which
 * pins nothing and leaves the reader's preference in place. Unmounting releases
 * the pin, so navigating back to the dashboard returns to their own language.
 */
export function usePinnedLocale(locale: Locale | undefined): void {
  const { pin } = useLanguage()
  useEffect(() => {
    pin(locale ?? null)
    return () => pin(null)
  }, [locale, pin])
}
