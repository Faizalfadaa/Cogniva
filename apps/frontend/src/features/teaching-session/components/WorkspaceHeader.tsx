import { type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { TeachButton } from './TeachButton'
import type { TitleSaveStatus } from '../hooks/useWorkspaceTitleAutosave'
import styles from '../../../styles/TeachingSession.module.css'

interface WorkspaceHeaderProps {
  title: string
  onTitleChange: (value: string) => void
  saveStatus: TitleSaveStatus
  isRecording: boolean
  micPermissionDenied: boolean
  mode: 'editing' | 'locked'
  pending: boolean
  onTeach: () => void
  onContinueEditing: () => void
  onFinishSession: () => void
  finishingSession?: boolean
  /** Reference PDF: upload handler + current attachment + in-flight flag. */
  onUploadPdf: (file: File) => void
  pdfUrl?: string
  uploadingPdf?: boolean
}

/** The backend returns a relative /api path; mock/blobs are already absolute. */
function resolvePdfHref(pdfUrl: string): string {
  if (/^(https?:|blob:|data:)/.test(pdfUrl)) return pdfUrl
  const base = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
  return `${base}${pdfUrl}`
}

const pdfBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '5px 10px',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text-secondary, #5a5545)',
  background: 'var(--card-bg, #fff)',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: '8px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function saveStatusLabel(status: TitleSaveStatus): string {
  switch (status) {
    case 'saving':
      return 'Saving...'
    case 'saved':
      return 'Saved'
    case 'error':
      return 'Gagal menyimpan'
    default:
      return ''
  }
}

export function WorkspaceHeader({
  title,
  onTitleChange,
  saveStatus,
  isRecording,
  micPermissionDenied,
  mode,
  pending,
  onTeach,
  onContinueEditing,
  onFinishSession,
  finishingSession = false,
  onUploadPdf,
  pdfUrl,
  uploadingPdf = false,
}: WorkspaceHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Kembali ke Home">
          ←
        </button>

        {/* Placeholder "Untitled Document" - value tetap title asli (bisa kosong),
            bukan ditulis ke value supaya gak ke-save sebagai judul literal kalau
            user cuma klik tanpa ngetik apa-apa. */}
        <input
          className={styles.titleInput}
          value={title}
          placeholder="Untitled Document"
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Judul workspace"
        />

        <span className={styles.saveStatus} aria-live="polite">
          {saveStatusLabel(saveStatus)}
        </span>

        {/* Reference material: upload a PDF that grounds the post-session
            evaluation. Flows only to the Evaluator, never to the Learner. */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
          {pdfUrl && (
            <a
              href={resolvePdfHref(pdfUrl)}
              target="_blank"
              rel="noreferrer"
              style={{ ...pdfBtnStyle, textDecoration: 'none' }}
              title="Lihat materi rujukan"
            >
              📄 Materi terlampir
            </a>
          )}
          <label style={{ ...pdfBtnStyle, opacity: uploadingPdf ? 0.6 : 1 }} title="Upload materi rujukan (PDF) untuk menilai penjelasanmu">
            {uploadingPdf ? 'Mengunggah…' : pdfUrl ? 'Ganti' : '📎 Materi rujukan (PDF)'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              disabled={uploadingPdf}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUploadPdf(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      <div className={styles.headerRight}>
        {isRecording && !micPermissionDenied && (
          <span className={styles.micDot} title="Merekam audio" />
        )}
        <button
          className={styles.finishBtn}
          onClick={onFinishSession}
          disabled={finishingSession || pending}
          aria-label="Selesai mengajar"
        >
          {finishingSession ? 'Menyelesaikan...' : 'Finish Session'}
        </button>
        <TeachButton mode={mode} pending={pending} onTeach={onTeach} onContinueEditing={onContinueEditing} />
      </div>
    </header>
  )
}