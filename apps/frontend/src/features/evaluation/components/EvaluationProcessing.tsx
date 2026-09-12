import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from '../../../styles/Evaluation.module.css'
import { useT } from '../../../i18n/LanguageProvider'
import type { MessageKey } from '../../../i18n/messages'

interface EvaluationProcessingProps {
  workspaceId: string
  workspaceTitle?: string
}

const MESSAGES: MessageKey[] = [
  'evaluation.processing1',
  'evaluation.processing2',
  'evaluation.processing3',
  'evaluation.processing4',
]

const MESSAGE_INTERVAL_MS = 3500

export function EvaluationProcessing({ workspaceId, workspaceTitle }: EvaluationProcessingProps) {
  const navigate = useNavigate()
  const t = useT()
  const msgIndexRef = useRef(0)
  const msgElRef = useRef<HTMLParagraphElement>(null)

  // Cycle through messages
  useEffect(() => {
    const el = msgElRef.current
    if (!el) return

    el.textContent = t(MESSAGES[msgIndexRef.current])

    const interval = setInterval(() => {
      msgIndexRef.current = (msgIndexRef.current + 1) % MESSAGES.length
      // Fade out → swap text → fade in
      el.style.opacity = '0'
      setTimeout(() => {
        el.textContent = t(MESSAGES[msgIndexRef.current])
        el.style.opacity = '1'
      }, 300)
    }, MESSAGE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [t])

  return (
    <div className={styles.processingPage}>
      {/* Back to home — user can leave and come back */}
      <button className={styles.processingBack} onClick={() => navigate('/home')}>
        ← {t('evaluation.backHome')}
      </button>

      <div className={styles.processingContent}>
        <div className={styles.processingVideoWrap}>
          <video
            className={styles.processingVideo}
            src="/cogniva_loading.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
        </div>

        <div className={styles.processingText}>
          <h1 className={styles.processingTitle}>
            {workspaceTitle
              ? t('evaluation.evaluatingNamed', { title: workspaceTitle })
              : t('evaluation.evaluating')}
          </h1>
          <p
            ref={msgElRef}
            className={styles.processingMessage}
            style={{ transition: 'opacity 300ms ease' }}
          />
        </div>

        <p className={styles.processingHint}>{t('evaluation.processingHint')}</p>
      </div>
    </div>
  )
}