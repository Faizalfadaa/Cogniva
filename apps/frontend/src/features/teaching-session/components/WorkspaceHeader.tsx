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
      </div>

      <div className={styles.headerRight}>
        {isRecording && !micPermissionDenied && (
          <span className={styles.micDot} title="Merekam audio" />
        )}
        <TeachButton mode={mode} pending={pending} onTeach={onTeach} onContinueEditing={onContinueEditing} />
      </div>
    </header>
  )
}