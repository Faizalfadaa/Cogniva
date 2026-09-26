import { useCallback, useEffect, useRef, useState } from 'react'
import { useBridge } from '../../../bridge/BridgeProvider'
import type {
  ReferenceOptionDTO,
  ReferenceProblemCode,
  ReferenceSuggestionsDTO,
} from '../../../dto/ReferenceDTO'
import { useLocale, useT } from '../../../i18n/LanguageProvider'
import { LOCALE_TAGS, type MessageKey } from '../../../i18n/messages'
import styles from '../../../styles/ReferenceFinder.module.css'

interface ReferenceFinderProps {
  workspaceId: string
  /** Prefills the search, so the user does not retype what they already titled. */
  topic: string
  onClose: () => void
  /** Called after a source has been adopted, so the workspace can refresh. */
  onAdopted: () => void
}

const KIND_ICON: Record<ReferenceOptionDTO['kind'], string> = {
  article: '📄',
  pdf: '📕',
  course: '🎓',
  video: '🎬',
  book: '📚',
}

/** Why the server could not read a source, in the language on screen. */
const PROBLEM_KEY: Record<ReferenceProblemCode, MessageKey> = {
  'invalid-link': 'reference.problemInvalidLink',
  'not-web': 'reference.problemNotWeb',
  'blocked-host': 'reference.problemBlockedHost',
  refused: 'reference.problemRefused',
  'too-large': 'reference.problemTooLarge',
  'unsupported-type': 'reference.problemUnsupportedType',
  timeout: 'reference.problemTimeout',
  unreachable: 'reference.problemUnreachable',
  'too-little-text': 'reference.problemTooLittleText',
}

/** Notices the search returns about the list as a whole. */
const NOTICE_KEY = {
  thin: 'reference.noticeThin',
  unverified: 'reference.noticeUnverified',
  rejected: 'reference.noticeRejected',
  offline: 'reference.noticeOffline',
} as const

/**
 * Finds reference material for a user who has none.
 *
 * The whole point of the dialog is that the user *chooses*: the agent searches
 * and describes, but a suggestion only becomes this session's answer key when
 * someone picks it. So every option keeps its real link, openable in a new tab
 * before deciding, and the corroboration flag is shown rather than hidden.
 *
 * Adopting is the slow step — the page has to be fetched and turned into notes —
 * so it reports its own outcome instead of closing optimistically. A source that
 * cannot be read is a normal answer here, not an error: it is marked unusable in
 * place, with the reason, the next option is selected, and the list stays open.
 */
export function ReferenceFinder({ workspaceId, topic, onClose, onAdopted }: ReferenceFinderProps) {
  const bridge = useBridge()
  const t = useT()
  const { locale } = useLocale()
  const [hint, setHint] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<ReferenceSuggestionsDTO | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [adopting, setAdopting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  /** Options the server has already refused, by id, with the reason to show. */
  const [unusable, setUnusable] = useState<Record<string, string>>({})

  // The dialog outlives its own async work — the user can close it mid-search —
  // so nothing writes state after unmount.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const search = useCallback(async () => {
    setSearching(true)
    setError('')
    setDone('')
    setSelected(null)
    setUnusable({})
    try {
      const result = await bridge.suggestReferences(workspaceId, hint.trim() || undefined)
      if (!alive.current) return
      setSuggestions(result)
      setSelected(result.options[0]?.id ?? null)
    } catch (err) {
      console.error('[ReferenceFinder] suggestReferences failed', err)
      if (alive.current) setError(t('reference.searchFailed'))
    } finally {
      if (alive.current) setSearching(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, workspaceId, hint, t])

  // Search on open: the user already said what the topic is by naming the
  // workspace, so making them press a button first would be asking twice.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void search()
  }, [search])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const adopt = useCallback(async () => {
    const option = suggestions?.options.find((o) => o.id === selected)
    if (!option) return

    setAdopting(true)
    setError('')
    setDone('')
    try {
      const result = await bridge.useReference(workspaceId, {
        url: option.url,
        title: option.title,
        source: option.source,
      })
      if (!alive.current) return
      if (!result.ok) {
        // Say why in the reader's language, mark the option so the list shows
        // which one was tried, and move the selection to the next one left.
        const reason = result.problemCode
          ? t(PROBLEM_KEY[result.problemCode])
          : result.problem || t('reference.unusable')
        const refused = { ...unusable, [option.id]: reason }
        setUnusable(refused)
        setError(`${reason} ${t('reference.pickAnother')}`)
        const next = suggestions?.options.find((o) => !refused[o.id] && o.id !== option.id)
        setSelected(next?.id ?? null)
        return
      }
      setDone(
        t('reference.saved', { count: result.chars.toLocaleString(LOCALE_TAGS[locale]) }),
      )
      onAdopted()
    } catch (err) {
      console.error('[ReferenceFinder] useReference failed', err)
      if (alive.current) setError(t('reference.useFailed'))
    } finally {
      if (alive.current) setAdopting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, workspaceId, suggestions, selected, unusable, onAdopted, t, locale])

  const options = suggestions?.options ?? []

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('reference.title')}
      onClick={(event) => {
        // Backdrop click closes, but only the backdrop — a click that started
        // inside the panel and drifted out should not throw the list away.
        if (event.target === event.currentTarget && !adopting) onClose()
      }}
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <div>
            <h2 className={styles.title}>{t('reference.title')}</h2>
            <p className={styles.subtitle}>{t('reference.subtitle')}</p>
          </div>
          <button
            className={styles.close}
            onClick={onClose}
            aria-label={t('common.close')}
            disabled={adopting}
          >
            ✕
          </button>
        </header>

        <div className={styles.searchRow}>
          <input
            className={styles.hintInput}
            value={hint}
            placeholder={t('reference.hintPlaceholder', {
              topic: topic || t('reference.noTopic'),
            })}
            onChange={(event) => setHint(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !searching) void search()
            }}
            disabled={searching || adopting}
            aria-label={t('reference.hintLabel')}
          />
          <button
            className={styles.searchBtn}
            onClick={() => void search()}
            disabled={searching || adopting}
          >
            {searching ? t('reference.searching') : t('reference.search')}
          </button>
        </div>

        {/* Coded notices are translated; a server that only sends the English
            sentence still gets it shown rather than nothing. */}
        {suggestions?.noticeCodes?.length ? (
          <p className={styles.notice}>
            {suggestions.noticeCodes.map((code) => t(NOTICE_KEY[code])).join(' ')}
          </p>
        ) : (
          suggestions?.notice && <p className={styles.notice}>{suggestions.notice}</p>
        )}

        <div className={styles.list}>
          {/* The search takes seconds; a spinner and a full-size line say so
              rather than leaving the panel looking empty and stuck. */}
          {searching && (
            <p className={styles.status} role="status" aria-live="polite">
              <span className={styles.spinner} aria-hidden="true" />
              {t('reference.searchingFor', { topic })}
            </p>
          )}

          {!searching && options.length === 0 && (
            <p className={`${styles.status} ${styles.statusQuiet}`}>{t('reference.empty')}</p>
          )}

          {!searching &&
            options.map((option) => {
              const refused = unusable[option.id]
              const cardClass = refused
                ? `${styles.card} ${styles.cardUnusable}`
                : option.id === selected
                  ? styles.cardSelected
                  : styles.card
              return (
                <label key={option.id} className={cardClass} title={refused || undefined}>
                  <input
                    type="radio"
                    name="reference-option"
                    className={styles.radio}
                    checked={option.id === selected}
                    onChange={() => setSelected(option.id)}
                    disabled={adopting || Boolean(refused)}
                  />
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <span className={styles.kind} aria-hidden="true">
                        {KIND_ICON[option.kind] ?? '📄'}
                      </span>
                      <span className={styles.cardTitle}>{option.title}</span>
                    </div>

                    <div className={styles.meta}>
                      <span className={styles.publisher}>{option.source}</span>
                      {refused ? (
                        <span className={styles.badgeUnusable}>{t('reference.optionUnusable')}</span>
                      ) : option.verified ? (
                        <span className={styles.badgeOk} title={t('reference.verifiedTitle')}>
                          {t('reference.verified')}
                        </span>
                      ) : (
                        <span className={styles.badgeWarn} title={t('reference.unverifiedTitle')}>
                          {t('reference.unverified')}
                        </span>
                      )}
                      <a
                        className={styles.link}
                        href={option.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {t('reference.open')} ↗
                      </a>
                    </div>

                    {refused ? (
                      <p className={styles.summary}>{refused}</p>
                    ) : (
                      <>
                        {option.summary && <p className={styles.summary}>{option.summary}</p>}
                        {option.whyRelevant && <p className={styles.why}>{option.whyRelevant}</p>}
                      </>
                    )}
                  </div>
                </label>
              )
            })}

          {/* Fetching and reading a page is the slowest step in the dialog. */}
          {adopting && (
            <p className={styles.status} role="status" aria-live="polite">
              <span className={styles.spinner} aria-hidden="true" />
              {t('reference.preparing')}
            </p>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {done && <p className={styles.done}>{done}</p>}

        <footer className={styles.foot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={adopting}>
            {done ? t('common.done') : t('common.cancel')}
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() => void adopt()}
            disabled={!selected || adopting || searching}
          >
            {adopting ? t('reference.preparing') : t('reference.use')}
          </button>
        </footer>
      </div>
    </div>
  )
}
