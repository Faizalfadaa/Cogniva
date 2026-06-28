import { useEffect, useState } from 'react'
import styles from '../../../styles/TeachingSession.module.css'
import type { LearnerCharacter } from '../../../lib/Learner'

interface LearnerResponseBubbleProps {
  learner: LearnerCharacter
  text?: string
  pending: boolean
  checkpointId?: string
}

const AUTO_DISMISS_MS = 5000

export function LearnerResponseBubble({ learner, text, pending, checkpointId }: LearnerResponseBubbleProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
    if (!checkpointId) return
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [checkpointId])

  if (dismissed || (!pending && !text)) return null

  return (
    <div className={styles.notifStack} style={{ pointerEvents: 'none' }}>
      <div className={styles.notifToast} style={{ pointerEvents: 'all' }}>
        <img src={learner.avatarUrl} alt={learner.name} className={styles.notifAvatar} />
        <div className={styles.notifBody}>
          <span className={styles.notifName}>{learner.name}</span>
          <p className={styles.notifText}>{pending ? '...' : text}</p>
        </div>
        <button
          className={styles.notifClose}
          onClick={() => setDismissed(true)}
          aria-label="Tutup respon learner"
        >
          ×
        </button>
      </div>
    </div>
  )
}