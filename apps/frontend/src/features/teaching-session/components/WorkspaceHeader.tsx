import { type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { TeachButton } from './TeachButton'
import type { TitleSaveStatus } from '../hooks/useWorkspaceTitleAutosave'
import { useLearnerVoice } from '../hooks/useLearnerVoice'
import styles from '../../../styles/TeachingSession.module.css'

interface WorkspaceHeaderProps {
  title: string
  onTitleChange: (value: string) => void
  saveStatus: TitleSaveStatus
  isRecording: boolean
  micPermissionDenied: boolean
  onToggleRecording: () => void
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
  /** Opens the Referencer dialog, for a user with no material of their own. */
  onFindReference: () => void
  /** Set when the reference came from the web instead of an upload. */
  referenceSource?: { url: string; title: string; source: string }
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
      return 'Failed to save'
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
  onToggleRecording,
  mode,
  pending,
  onTeach,
  onContinueEditing,
  onFinishSession,
  finishingSession = false,
  onUploadPdf,
  pdfUrl,
  uploadingPdf = false,
  onFindReference,
  referenceSource,
}: WorkspaceHeaderProps) {
  const navigate = useNavigate()
  const voice = useLearnerVoice()

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <button className={styles.backBtn} onClick={() => navigate('/home')} aria-label="Back to Home">
          ←
        </button>

        {/* "Untitled Document" is only a placeholder - the value stays the real
            (possibly empty) title, not written into value, so it isn't saved as a
            literal title if the user just clicks without typing anything. */}
        <input
          className={styles.titleInput}
          value={title}
          placeholder="Untitled Document"
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Workspace title"
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
              title="View reference material"
            >
              📄 Reference attached
            </a>
          )}

          {/* A web source and an upload are mutually exclusive, so only one of
              these two chips is ever on screen. */}
          {!pdfUrl && referenceSource && (
            <a
              href={referenceSource.url}
              target="_blank"
              rel="noreferrer"
              style={{ ...pdfBtnStyle, textDecoration: 'none', maxWidth: '220px' }}
              title={`${referenceSource.title} — ${referenceSource.source}`}
            >
              <span
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                🔗 {referenceSource.title || referenceSource.source}
              </span>
            </a>
          )}
          <label
            data-tour="pdf-upload"
            style={{ ...pdfBtnStyle, opacity: uploadingPdf ? 0.6 : 1 }}
            title="Upload reference material (PDF) to ground your evaluation"
          >
            {uploadingPdf ? 'Uploading…' : pdfUrl ? 'Replace' : '📎 Reference (PDF)'}
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

          {/* The way out for a user who has nothing to upload: an agent looks
              material up and offers options to choose from. */}
          <button
            type="button"
            data-tour="reference-finder"
            onClick={onFindReference}
            style={{ ...pdfBtnStyle }}
            title="Find reference material for this topic"
          >
            🔎 Find reference
          </button>
        </div>
      </div>

      <div className={styles.headerRight}>
        {/* Mute the learner's synthesized voice. Reads its state from the shared
            player, so no prop drilling is needed. */}
        <button
          className={voice.muted ? styles.voiceBtnMuted : styles.voiceBtn}
          onClick={voice.toggleMuted}
          aria-label={voice.muted ? "Unmute learner's voice" : "Mute learner's voice"}
          aria-pressed={voice.muted}
          title={voice.muted ? 'Voice off' : 'Voice on'}
        >
          {voice.muted ? '🔇' : '🔊'}
        </button>

        {!micPermissionDenied && (
          <button
            data-tour="mic-button"
            className={isRecording ? styles.micBtnActive : styles.micBtnIdle}
            onClick={onToggleRecording}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            title={isRecording ? 'Stop recording audio' : 'Start recording audio'}
          >
            <span className={styles.micBtnIcon}>{isRecording ? '⏹' : '🎙'}</span>
            <span className={styles.micBtnLabel}>{isRecording ? 'Stop' : 'Record'}</span>
            {isRecording && <span className={styles.micDot} />}
          </button>
        )}
        <button
          data-tour="finish-button"
          className={styles.finishBtn}
          onClick={onFinishSession}
          disabled={finishingSession || pending}
          aria-label="Finish teaching"
        >
          {finishingSession ? 'Finishing...' : 'Finish Session'}
        </button>
        {/* Chat now opens from ChatLauncher, floating bottom-right of the canvas. */}
        <TeachButton mode={mode} pending={pending} onTeach={onTeach} onContinueEditing={onContinueEditing} />
      </div>
    </header>
  )
}