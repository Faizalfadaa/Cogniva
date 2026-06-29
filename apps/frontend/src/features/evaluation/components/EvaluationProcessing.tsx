import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from '../../../styles/Evaluation.module.css'

interface EvaluationProcessingProps {
  workspaceId: string
  workspaceTitle?: string
}

const MESSAGES = [
  'Muridmu sedang mengingat-ingat sesinya...',
  'Catatan sedang ditulis...',
  'Surat untukmu sedang disiapkan...',
  'Hampir selesai...',
]

const MESSAGE_INTERVAL_MS = 3500

export function EvaluationProcessing({ workspaceId, workspaceTitle }: EvaluationProcessingProps) {
  const navigate = useNavigate()
  const msgIndexRef = useRef(0)
  const msgElRef = useRef<HTMLParagraphElement>(null)

  // Cycle through messages
  useEffect(() => {
    const el = msgElRef.current
    if (!el) return

    el.textContent = MESSAGES[0]

    const interval = setInterval(() => {
      msgIndexRef.current = (msgIndexRef.current + 1) % MESSAGES.length
      // Fade out → swap text → fade in
      el.style.opacity = '0'
      setTimeout(() => {
        el.textContent = MESSAGES[msgIndexRef.current]
        el.style.opacity = '1'
      }, 300)
    }, MESSAGE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.processingPage}>
      {/* Back to home — user can leave and come back */}
      <button className={styles.processingBack} onClick={() => navigate('/')}>
        ← Kembali ke Home
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
            {workspaceTitle ? `Mengevaluasi "${workspaceTitle}"` : 'Mengevaluasi sesimu...'}
          </h1>
          <p
            ref={msgElRef}
            className={styles.processingMessage}
            style={{ transition: 'opacity 300ms ease' }}
          />
        </div>

        <p className={styles.processingHint}>
          Kamu bisa kembali ke Home dan balik lagi nanti — evaluasi tetap berjalan di background.
        </p>
      </div>
    </div>
  )
}