import { type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TeachButton } from './TeachButton'
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

        {/* Separate from the arrow above: that one goes to the dashboard, this
            one leaves the app entirely for the public site. */}
        <Link to="/" className={styles.landingLink} title={t('header.homeTitle')}>
          <img src="/cogniva_logo.png" alt="" aria-hidden="true" className={styles.landingLinkLogo} />
          <span>{t('header.home')}</span>
        </Link>

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

        {/* Reference material: upload a PDF that grounds the post-session
            evaluation. Flows only to the Evaluator, never to the Learner. */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
          {pdfUrl && (
            <a
              href={resolvePdfHref(pdfUrl)}
              target="_blank"
              rel="noreferrer"
              style={{ ...pdfBtnStyle, textDecoration: 'none' }}
              title={t('header.viewReference')}
            >
              📄 {t('header.referenceAttached')}
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
            title={t('header.uploadPdfTitle')}
          >
            {uploadingPdf
              ? t('header.uploading')
              : pdfUrl
                ? t('header.replace')
                : `📎 ${t('header.uploadPdf')}`}
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
            title={t('header.findReferenceTitle')}
          >
            🔎 {t('header.findReference')}
          </button>
        </div>
      </div>

      <div className={styles.headerRight}>
        {/* Mute the learner's synthesized voice. Reads its state from the shared
            player, so no prop drilling is needed. */}
        <LanguageToggle style={{ marginRight: '4px' }} />

        <button
          className={voice.muted || !voice.available ? styles.voiceBtnMuted : styles.voiceBtn}
          onClick={voice.toggleMuted}
          disabled={!voice.available}
          aria-label={voice.muted ? t('header.unmute') : t('header.mute')}
          aria-pressed={voice.muted}
          title={
            !voice.available
              ? t('header.voiceUnavailable')
              : voice.muted
                ? t('header.voiceOff')
                : t('header.voiceOn')
          }
        >
          {voice.muted || !voice.available ? '🔇' : '🔊'}
        </button>

        {!micPermissionDenied && (
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