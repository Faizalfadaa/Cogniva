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
 * Finds reference material for a user who has none.
 *
 * The whole point of the dialog is that the user *chooses*: the agent searches
 * and describes, but a suggestion only becomes this session's answer key when
 * someone picks it. So every option keeps its real link, openable in a new tab
 * before deciding, and the corroboration flag is shown rather than hidden.
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
      if (alive.current) setError('Pencarian gagal. Coba lagi sebentar.')
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
        setError(result.problem || 'Sumber itu tidak bisa dipakai.')
        return
      }
      setDone(`Referensi tersimpan (${result.chars.toLocaleString('id-ID')} karakter).`)
      onAdopted()
    } catch (err) {
      console.error('[ReferenceFinder] useReference failed', err)
      if (alive.current) setError('Gagal menyimpan referensi. Coba lagi.')
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
      aria-label="Cari referensi"
      onClick={(event) => {
        // Backdrop click closes, but only the backdrop — a click that started
        // inside the panel and drifted out should not throw the list away.
        if (event.target === event.currentTarget && !adopting) onClose()
      }}
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <div>
            <h2 className={styles.title}>Cari referensi</h2>
            <p className={styles.subtitle}>
              Belum punya bahan sendiri? Pilih satu sumber untuk dipakai menilai penjelasanmu
              nanti. Materinya tidak pernah dilihat murid — hanya penilai.
            </p>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Tutup" disabled={adopting}>
            ✕
          </button>
        </header>

        <div className={styles.searchRow}>
          <input
            className={styles.hintInput}
            value={hint}
            placeholder={`Topik: ${topic || 'belum ada judul'} — tambahkan arahan, misal "tingkat SMA"`}
            onChange={(event) => setHint(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !searching) void search()
            }}
            disabled={searching || adopting}
            aria-label="Arahan pencarian"
          />
          <button
            className={styles.searchBtn}
            onClick={() => void search()}
            disabled={searching || adopting}
          >
            {searching ? 'Mencari…' : 'Cari lagi'}
          </button>
        </div>

        {suggestions?.notice && <p className={styles.notice}>{suggestions.notice}</p>}

        <div className={styles.list}>
          {searching && <p className={styles.status}>Mencari sumber untuk “{topic}”…</p>}

          {!searching && options.length === 0 && (
            <p className={styles.status}>Tidak ada sumber yang bisa ditawarkan.</p>
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
                    {option.verified ? (
                      <span className={styles.badgeOk} title="Muncul di hasil pencarian">
                        terkonfirmasi
                      </span>
                    ) : (
                      <span
                        className={styles.badgeWarn}
                        title="Belum terkonfirmasi di hasil pencarian"
                      >
                        belum dicek
                      </span>
                    )}
                    <a
                      className={styles.link}
                      href={option.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      buka ↗
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
            {done ? 'Selesai' : 'Batal'}
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() => void adopt()}
            disabled={!selected || adopting || searching}
          >
            {adopting ? 'Menyiapkan…' : 'Pakai referensi ini'}
          </button>
        </footer>
      </div>
    </div>
  )
}
