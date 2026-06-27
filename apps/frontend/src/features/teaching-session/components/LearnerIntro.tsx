import { useEffect, useRef, useState } from 'react'
import styles from '../../../styles/TeachingSession.module.css'
import { resolveFirstMessages, type LearnerCharacter } from '../../../lib/Learner'

interface LearnerIntroProps {
  learner: LearnerCharacter
  userName: string
  /** Dipanggil sekali setelah seluruh sequence selesai (atau di-skip). */
  onDone: () => void
}

type Phase = 'video' | 'messages'

const MESSAGE_INTERVAL_MS = 1200

export function LearnerIntro({ learner, userName, onDone }: LearnerIntroProps) {
  const [phase, setPhase] = useState<Phase>('video')
  const [muted, setMuted] = useState(true)
  const [messageIndex, setMessageIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const messages = resolveFirstMessages(learner, userName || 'kamu')

  // Lanjut ke bubble berikutnya tiap MESSAGE_INTERVAL_MS, selesai setelah yang terakhir.
  useEffect(() => {
    if (phase !== 'messages') return
    if (messageIndex >= messages.length - 1) {
      const timer = setTimeout(onDone, MESSAGE_INTERVAL_MS)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setMessageIndex((i) => i + 1), MESSAGE_INTERVAL_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, messageIndex])

  function handleVideoEnded() {
     setTimeout(() => setPhase('messages'), 40000)
  }

  function handleSkip() {
    // "user tetap boleh langsung mulai mengajar tanpa harus menunggu intro selesai"
    // - skip langsung tutup seluruh sequence, gak cuma video-nya.
    videoRef.current?.pause()
    onDone()
  }

  return (
    <div className={styles.introOverlay}>
      <button className={styles.introSkip} onClick={handleSkip}>
        Skip
      </button>

      {phase === 'video' ? (
        <div className={styles.introVideoWrap}>
          <video
            ref={videoRef}
            className={styles.introVideo}
            src={learner.introVideoUrl}
            autoPlay
            muted={muted}
            playsInline
            onEnded={handleVideoEnded}
          />
          <button
            className={styles.introMuteBtn}
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      ) : (
        <div className={styles.introMessageWrap}>
          <img src={learner.avatarUrl} alt={learner.name} className={styles.introAvatar} />
          <div className={styles.introBubble}>
            <p className={styles.responseName}>{learner.name}</p>
            <p className={styles.responseText}>{messages[messageIndex]}</p>
          </div>
        </div>
      )}
    </div>
  )
}