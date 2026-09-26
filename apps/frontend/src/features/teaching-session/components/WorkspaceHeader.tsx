import { useNavigate } from 'react-router-dom'
import { TeachButton } from './TeachButton'
import { ReferenceMenu } from './ReferenceMenu'
import type { TitleSaveStatus } from '../hooks/useWorkspaceTitleAutosave'
import { useLearnerVoice } from '../hooks/useLearnerVoice'
import { useT, type Translate } from '../../../i18n/LanguageProvider'
import { LanguageToggle } from '../../../i18n/LanguageToggle'
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

/** Headphones, struck through while deafened. */
function HeadphonesIcon({ deafened }: { deafened: boolean }) {
  return (
    <svg className={styles.deafenIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      {deafened && <path className={styles.deafenSlash} d="M2 2l20 20" />}
    </svg>
  )
}

function saveStatusLabel(status: TitleSaveStatus, t: Translate): string {
  switch (status) {
    case 'saving':
      return t('common.saving')
    case 'saved':
      return t('common.saved')
    case 'error':
      return t('common.saveFailed')
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
  const t = useT()

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <button
          className={styles.backBtn}
          onClick={() => navigate('/home')}
          aria-label={t('header.backToHome')}
        >
          ←
        </button>

        {/* Brand only, not a way out. There used to be a Home link here beside
            the arrow, and two exits next to each other in a teaching screen
            made it easy to leave mid-lesson by the wrong one. The arrow is the
            one way back. */}
        <img src="/cogniva_logo.png" alt="" aria-hidden="true" className={styles.brandMark} />

        {/* "Untitled Document" is only a placeholder - the value stays the real
            (possibly empty) title, not written into value, so it isn't saved as a
            literal title if the user just clicks without typing anything. */}
        <input
          className={styles.titleInput}
          value={title}
          placeholder={t('header.untitled')}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label={t('header.workspaceTitle')}
        />

        <span className={styles.saveStatus} aria-live="polite">
          {saveStatusLabel(saveStatus, t)}
        </span>

        {/* Reference material grounds the post-session evaluation. It flows
            only to the Evaluator, never to the Learner. */}
        <ReferenceMenu
          pdfUrl={pdfUrl}
          referenceSource={referenceSource}
          uploading={uploadingPdf}
          onUpload={onUploadPdf}
          onFindWithAgent={onFindReference}
        />
      </div>

      <div className={styles.headerRight}>
        <LanguageToggle style={{ marginRight: '4px' }} />

        {/* Deafen: stop hearing the learner's synthesized voice, the way a call
            app's headphones button works. A speaker icon read as "the volume of
            this page", which it is not. Reads its state from the shared player,
            so no prop drilling is needed. */}
        <button
          className={voice.muted ? styles.deafenBtnOn : styles.deafenBtn}
          onClick={voice.toggleMuted}
          disabled={!voice.available}
          aria-label={voice.muted ? t('header.undeafen') : t('header.deafen')}
          aria-pressed={voice.muted}
          title={
            !voice.available
              ? t('header.voiceUnavailable')
              : voice.muted
                ? t('header.undeafen')
                : t('header.deafen')
          }
        >
          <HeadphonesIcon deafened={voice.muted || !voice.available} />
        </button>

        {mode === 'editing' && !pending && !micPermissionDenied && (
          <button
            data-tour="mic-button"
            className={isRecording ? styles.micBtnActive : styles.micBtnIdle}
            onClick={onToggleRecording}
            aria-label={isRecording ? t('header.stopRecording') : t('header.startRecording')}
            title={isRecording ? t('header.stopRecordAudio') : t('header.recordAudio')}
          >
            <span className={styles.micBtnIcon}>{isRecording ? '⏹' : '🎙'}</span>
            <span className={styles.micBtnLabel}>
              {isRecording ? t('header.stop') : t('header.record')}
            </span>
            {isRecording && <span className={styles.micDot} />}
          </button>
        )}
        <button
          data-tour="finish-button"
          className={styles.finishBtn}
          onClick={onFinishSession}
          disabled={finishingSession || pending}
          aria-label={t('header.finishTeaching')}
        >
          {finishingSession ? t('header.finishing') : t('header.finishSession')}
        </button>
        {/* Chat now opens from ChatLauncher, floating bottom-right of the canvas. */}
        <TeachButton mode={mode} pending={pending} onTeach={onTeach} onContinueEditing={onContinueEditing} />
      </div>
    </header>
  )
}
