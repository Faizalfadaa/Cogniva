import { useCallback, useEffect, useRef, useState } from 'react'
import { useBridge } from '../../../bridge/BridgeProvider'
import type { WorkspaceDTO } from '../../../dto/WorkspaceDTO'
import type { LearnerCharacter } from '../../../lib/Learner'
import { ReferenceFinder } from './ReferenceFinder'
import styles from '../../../styles/SessionSetup.module.css'

interface SessionSetupProps {
  workspaceId: string
  learner: LearnerCharacter
  workspace: WorkspaceDTO | null
  /** Called with the updated workspace whenever this panel changes it. */
  onWorkspaceChange: (workspace: WorkspaceDTO) => void
  /** The panel is finished with — start teaching. */
  onDone: () => void
}

/** Which way the user is supplying the material. Nothing is chosen by default. */
type ReferenceMode = 'none' | 'paste' | 'upload' | 'find'

/**
 * Session setup — what am I teaching, and what should I be judged against.
 *
 * It sits between meeting the student and the whiteboard, because both of the
 * things it collects are worth having *before* the first explanation rather than
 * after it: the topic is what the Learner reacts to, and the reference material
 * is the answer key the Evaluator grades with (§1.4 — the Learner never sees it).
 *
 * The topic is the only required field. Everything below it is optional on
 * purpose: a user who just wants to start talking should not be blocked at a
 * form, and a session with no reference still works — the Evaluator falls back to
 * judging the explanation on its own terms. Reference material is offered three
 * ways because users arrive with different things in hand: their own notes, a
 * PDF, or nothing at all.
 */
export function SessionSetup({
  workspaceId,
  learner,
  workspace,
  onWorkspaceChange,
  onDone,
}: SessionSetupProps) {
  const bridge = useBridge()
  const [topic, setTopic] = useState(workspace?.title ?? '')
  const [scope, setScope] = useState(workspace?.description ?? '')
  const [mode, setMode] = useState<ReferenceMode>('none')
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attached, setAttached] = useState('')
  const [findingReference, setFindingReference] = useState(false)

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // A workspace opened again after a reload already has these; showing them
  // empty would invite the user to retype what they already wrote.
  useEffect(() => {
    if (workspace?.title && !topic) setTopic(workspace.title)
    if (workspace?.description && !scope) setScope(workspace.description)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.title, workspace?.description])

  const trimmedTopic = topic.trim()

  /** Persist topic and scope. Returns false when the write failed. */
  const saveMeta = useCallback(async (): Promise<boolean> => {
    try {
      const ws = await bridge.updateWorkspaceMeta(workspaceId, {
        title: trimmedTopic,
        description: scope.trim(),
      })
      if (alive.current) onWorkspaceChange(ws)
      return true
    } catch (err) {
      console.error('[SessionSetup] updateWorkspaceMeta failed', err)
      if (alive.current) setError('Judul materi gagal disimpan. Coba lagi.')
      return false
    }
  }, [bridge, workspaceId, trimmedTopic, scope, onWorkspaceChange])

  const handleUpload = useCallback(
    async (file: File) => {
      setBusy(true)
      setError('')
      try {
        const ws = await bridge.uploadWorkspacePdf(workspaceId, file)
        if (!alive.current) return
        onWorkspaceChange(ws)
        setAttached(`PDF terpasang: ${file.name}`)
      } catch (err) {
        console.error('[SessionSetup] uploadWorkspacePdf failed', err)
        if (alive.current) setError('PDF gagal diunggah. Coba berkas lain.')
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [bridge, workspaceId, onWorkspaceChange],
  )

  const handleSavePaste = useCallback(async () => {
    if (!pasted.trim()) return
    setBusy(true)
    setError('')
    try {
      const result = await bridge.saveReferenceText(workspaceId, pasted)
      if (!alive.current) return
      onWorkspaceChange(result.workspace)
      setAttached(`Materi tersimpan (${result.chars.toLocaleString('id-ID')} karakter).`)
    } catch (err) {
      console.error('[SessionSetup] saveReferenceText failed', err)
      if (alive.current) setError('Materi gagal disimpan. Coba lagi.')
    } finally {
      if (alive.current) setBusy(false)
    }
  }, [bridge, workspaceId, pasted, onWorkspaceChange])

  // The finder searches on the topic the backend has stored, so the title has to
  // be written before it opens — otherwise it would search for the old one, or
  // for nothing at all on a workspace the user just named here.
  const handleOpenFinder = useCallback(async () => {
    setBusy(true)
    setError('')
    const saved = await saveMeta()
    if (!alive.current) return
    setBusy(false)
    if (saved) setFindingReference(true)
  }, [saveMeta])

  const handleStart = useCallback(async () => {
    if (!trimmedTopic) return
    setBusy(true)
    setError('')
    const saved = await saveMeta()
    if (!alive.current) return
    setBusy(false)
    if (saved) onDone()
  }, [trimmedTopic, saveMeta, onDone])

  const hasReference = Boolean(workspace?.pdfUrl || workspace?.referenceSource) || attached !== ''

  return (
    <>
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Siapkan sesi">
        <div className={styles.panel}>
          <div className={styles.intro}>
            <img src={learner.avatarUrl} alt="" aria-hidden="true" className={styles.avatar} />
            <div>
              <h2 className={styles.title}>Mau mengajarkan apa hari ini?</h2>
              <p className={styles.subtitle}>
                {learner.name} akan belajar dari penjelasanmu. Tulis materinya dulu, supaya
                penilaian di akhir sesi menyorot hal yang memang ingin kamu uji.
              </p>
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Materi yang ingin diuji</span>
            <input
              className={styles.input}
              value={topic}
              placeholder="Misalnya: Fotosintesis, Hukum Newton, Struktur Data Stack"
              onChange={(event) => setTopic(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && trimmedTopic && !busy) void handleStart()
              }}
              autoFocus
              disabled={busy}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Bagian mana yang mau ditekankan? <em className={styles.optional}>opsional</em>
            </span>
            <textarea
              className={styles.textarea}
              value={scope}
              rows={2}
              placeholder="Misalnya: cukup reaksi terang saja, sampai peran klorofil"
              onChange={(event) => setScope(event.target.value)}
              disabled={busy}
            />
          </label>

          {/* Reference material. Optional, and stated as such — a session with no
              answer key still runs, it is simply graded on the explanation alone. */}
          <div className={styles.referenceBlock}>
            <div className={styles.label}>
              Bahan acuan penilaian <em className={styles.optional}>opsional</em>
            </div>
            <p className={styles.hint}>
              Dipakai penilai di akhir sesi untuk mengecek penjelasanmu. {learner.name} tidak
              pernah melihatnya.
            </p>

            <div className={styles.modes}>
              <button
                type="button"
                className={mode === 'paste' ? styles.modeActive : styles.mode}
                onClick={() => setMode(mode === 'paste' ? 'none' : 'paste')}
                disabled={busy}
              >
                ✍️ Tulis / tempel materi
              </button>

              <label className={styles.mode} aria-disabled={busy}>
                📎 Unggah PDF
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  style={{ display: 'none' }}
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleUpload(file)
                    event.target.value = ''
                  }}
                />
              </label>

              <button
                type="button"
                className={styles.mode}
                onClick={() => void handleOpenFinder()}
                disabled={busy || !trimmedTopic}
                title={
                  trimmedTopic
                    ? 'Cari sumber untuk topik ini'
                    : 'Tulis materinya dulu supaya pencarian tahu harus mencari apa'
                }
              >
                🔎 Carikan referensi
              </button>
            </div>

            {mode === 'paste' && (
              <div className={styles.pasteBlock}>
                <textarea
                  className={styles.pasteArea}
                  value={pasted}
                  rows={7}
                  placeholder="Tempel catatan, ringkasan bab, atau poin-poin yang harus kamu sebutkan…"
                  onChange={(event) => setPasted(event.target.value)}
                  disabled={busy}
                />
                <div className={styles.pasteFoot}>
                  <span className={styles.counter}>
                    {pasted.trim().length.toLocaleString('id-ID')} karakter
                  </span>
                  <button
                    type="button"
                    className={styles.saveBtn}
                    onClick={() => void handleSavePaste()}
                    disabled={busy || !pasted.trim()}
                  >
                    Simpan materi
                  </button>
                </div>
              </div>
            )}

            {hasReference && (
              <p className={styles.attached}>
                ✓{' '}
                {attached ||
                  (workspace?.pdfUrl
                    ? 'PDF acuan sudah terpasang.'
                    : `Acuan: ${workspace?.referenceSource?.title}`)}
              </p>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <footer className={styles.foot}>
            {/* Skipping is a real answer: someone who wants to start explaining
                immediately can, and the header keeps every one of these controls. */}
            <button type="button" className={styles.ghostBtn} onClick={onDone} disabled={busy}>
              Lewati
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void handleStart()}
              disabled={busy || !trimmedTopic}
            >
              {busy ? 'Menyimpan…' : 'Mulai mengajar'}
            </button>
          </footer>
        </div>
      </div>

      {findingReference && (
        <ReferenceFinder
          workspaceId={workspaceId}
          topic={trimmedTopic}
          onClose={() => setFindingReference(false)}
          onAdopted={async () => {
            try {
              const ws = await bridge.getWorkspace(workspaceId)
              if (alive.current) onWorkspaceChange(ws)
            } catch (err) {
              console.error('[SessionSetup] getWorkspace after reference failed', err)
            }
          }}
        />
      )}
    </>
  )
}
