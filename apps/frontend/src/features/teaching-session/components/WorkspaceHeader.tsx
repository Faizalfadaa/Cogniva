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
  /** Chat toggle lives in the header so it never overlaps the whiteboard tools. */
  learnerAvatarUrl: string
  learnerName: string
  chatOpen: boolean
  chatUnread: number
  onToggleChat: () => void
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
  learnerAvatarUrl,
  learnerName,
  chatOpen,
  chatUnread,
  onToggleChat,
}: WorkspaceHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Back to Home">
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
          <label style={{ ...pdfBtnStyle, opacity: uploadingPdf ? 0.6 : 1 }} title="Upload reference material (PDF) to ground your evaluation">
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
        </div>
      </div>

      <div className={styles.headerRight}>
        {!micPermissionDenied && (
          <button
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
          className={styles.finishBtn}
          onClick={onFinishSession}
          disabled={finishingSession || pending}
          aria-label="Finish teaching"
        >
          {finishingSession ? 'Finishing...' : 'Finish Session'}
        </button>
        <TeachButton mode={mode} pending={pending} onTeach={onTeach} onContinueEditing={onContinueEditing} />

        <button
          className={styles.headerChatBtn}
          onClick={onToggleChat}
          aria-label={chatOpen ? 'Close chat' : `Open chat with ${learnerName}`}
          title={chatOpen ? 'Close chat' : `Chat with ${learnerName}`}
        >
          <img src={learnerAvatarUrl} alt={learnerName} className={styles.headerChatAvatar} />
          {!chatOpen && chatUnread > 0 && (
            <span className={styles.sidebarBadge}>{chatUnread > 9 ? '9+' : chatUnread}</span>
          )}
        </button>
      </div>
    </header>
  )
}