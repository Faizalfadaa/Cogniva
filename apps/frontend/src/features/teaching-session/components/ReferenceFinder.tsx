import { useCallback, useEffect, useRef, useState } from 'react'
import { useBridge } from '../../../bridge/BridgeProvider'
import type { ReferenceOptionDTO, ReferenceSuggestionsDTO } from '../../../dto/ReferenceDTO'
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

/**
 * What the trust tier means, in the user's words.
 *
 * Two different claims sit side by side on each card and the labels have to keep
 * them apart: 'confirmed' means the link is real (a search returned it),
 * while these say who is answerable for its contents. A link can be perfectly
 * real and still be a source nobody stands behind.
 */
const TRUST_BADGE: Record<
  ReferenceOptionDTO['trust'],
  { label: string; title: string; className: keyof typeof styles }
> = {
  high: {
    label: 'institutional',
    title: 'A university, government body, journal, or open-textbook publisher',
    className: 'badgeHigh',
  },
  medium: {
    label: 'edited',
    title: 'A publisher with a named editorial process',
    className: 'badgeMid',
  },
  low: {
    label: 'unrecognised',
    title: 'Not a publisher this app recognises — open it and check before using it',
    className: 'badgeLow',
  },
}

/**
 * Finds reference material for a user who has none.
 *
 * The whole point of the dialog is that the user *chooses*: the agent searches
 * and describes, but a suggestion only becomes this session's answer key when
 * someone picks it. So every option keeps its real link, openable in a new tab
 * before deciding, and both flags on a card are shown rather than hidden: who
 * answers for the source, and whether a search actually returned the link.
 *
 * The list can therefore come back shorter than the user asked for. That is the
 * backend refusing to offer a page nobody is accountable for, and the notice
 * above the list says so — a short list here is a filtered one, not a failed
 * search.
 *
 * Adopting is the slow step — the page has to be fetched and turned into notes —
 * so it reports its own outcome instead of closing optimistically. A source that
 * cannot be read is a normal answer here, not an error: the list stays open and
 * the user picks another.
 */
export function ReferenceFinder({ workspaceId, topic, onClose, onAdopted }: ReferenceFinderProps) {
  const bridge = useBridge()
  const [hint, setHint] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<ReferenceSuggestionsDTO | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [adopting, setAdopting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

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
    try {
      const result = await bridge.suggestReferences(workspaceId, hint.trim() || undefined)
      if (!alive.current) return
      setSuggestions(result)
      setSelected(result.options[0]?.id ?? null)
    } catch (err) {
      console.error('[ReferenceFinder] suggestReferences failed', err)
      if (alive.current) setError('The search failed. Try again in a moment.')
    } finally {
      if (alive.current) setSearching(false)
    }
  }, [bridge, workspaceId, hint])

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
        setError(result.problem || 'That source cannot be used.')
        return
      }
      setDone(`Reference saved (${result.chars.toLocaleString('en-US')} characters).`)
      onAdopted()
    } catch (err) {
      console.error('[ReferenceFinder] useReference failed', err)
      if (alive.current) setError('Could not save the reference. Try again.')
    } finally {
      if (alive.current) setAdopting(false)
    }
  }, [bridge, workspaceId, suggestions, selected, onAdopted])

  const options = suggestions?.options ?? []

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Find reference material"
      onClick={(event) => {
        // Backdrop click closes, but only the backdrop — a click that started
        // inside the panel and drifted out should not throw the list away.
        if (event.target === event.currentTarget && !adopting) onClose()
      }}
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <div>
            <h2 className={styles.title}>Find reference material</h2>
            <p className={styles.subtitle}>
              No material of your own? Pick one source to grade your explanation against
              later. The learner never sees it — only the evaluator does.
            </p>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close" disabled={adopting}>
            ✕
          </button>
        </header>

        <div className={styles.searchRow}>
          <input
            className={styles.hintInput}
            value={hint}
            placeholder={`Topic: ${topic || 'untitled'} — add a steer, e.g. "high school level"`}
            onChange={(event) => setHint(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !searching) void search()
            }}
            disabled={searching || adopting}
            aria-label="Search steer"
          />
          <button
            className={styles.searchBtn}
            onClick={() => void search()}
            disabled={searching || adopting}
          >
            {searching ? 'Searching…' : 'Search again'}
          </button>
        </div>

        {suggestions?.notice && <p className={styles.notice}>{suggestions.notice}</p>}

        <div className={styles.list}>
          {searching && <p className={styles.status}>Searching for sources on “{topic}”…</p>}

          {!searching && options.length === 0 && (
            <p className={styles.status}>No sources can be offered.</p>
          )}

          {!searching &&
            options.map((option) => (
              <label
                key={option.id}
                className={option.id === selected ? styles.cardSelected : styles.card}
              >
                <input
                  type="radio"
                  name="reference-option"
                  className={styles.radio}
                  checked={option.id === selected}
                  onChange={() => setSelected(option.id)}
                  disabled={adopting}
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
                    <span
                      className={styles[TRUST_BADGE[option.trust].className]}
                      title={TRUST_BADGE[option.trust].title}
                    >
                      {TRUST_BADGE[option.trust].label}
                    </span>
                    {option.verified ? (
                      <span className={styles.badgeOk} title="Appeared in the search results">
                        confirmed
                      </span>
                    ) : (
                      <span
                        className={styles.badgeWarn}
                        title="Not confirmed in the search results"
                      >
                        unconfirmed
                      </span>
                    )}
                    <a
                      className={styles.link}
                      href={option.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      open ↗
                    </a>
                  </div>

                  {option.summary && <p className={styles.summary}>{option.summary}</p>}
                  {option.whyRelevant && <p className={styles.why}>{option.whyRelevant}</p>}
                </div>
              </label>
            ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {done && <p className={styles.done}>{done}</p>}

        <footer className={styles.foot}>
          <button className={styles.ghostBtn} onClick={onClose} disabled={adopting}>
            {done ? 'Done' : 'Cancel'}
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() => void adopt()}
            disabled={!selected || adopting || searching}
          >
            {adopting ? 'Preparing…' : 'Use this source'}
          </button>
        </footer>
      </div>
    </div>
  )
}
