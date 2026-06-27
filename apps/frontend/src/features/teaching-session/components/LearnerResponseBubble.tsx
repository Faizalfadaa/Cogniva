import { useEffect, useState } from 'react'
import styles from '../../../styles/TeachingSession.module.css'
import type { LearnerCharacter } from '../../../lib/Learner'

interface LearnerResponseBubbleProps {
  learner: LearnerCharacter
  text?: string
  pending: boolean
  /** Id checkpoint terkait - dipakai buat reset dismiss state & timer tiap ada respon baru. */
  checkpointId?: string
}

const AUTO_DISMISS_MS = 5000

export function LearnerResponseBubble({ learner, text, pending, checkpointId }: LearnerResponseBubbleProps) {
  const [dismissed, setDismissed] = useState(false)

  // Tiap checkpoint baru (id berubah) - tampil lagi dari awal dengan timer fresh.
  useEffect(() => {
    setDismissed(false)
    if (!checkpointId) return
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [checkpointId])

  if (dismissed || (!pending && !text)) return null

  return (
    <div className={styles.responseBubble}>
      <img src={learner.avatarUrl} alt={learner.name} className={styles.responseAvatar} />
      <div className={styles.responseContent}>
        <p className={styles.responseName}>{learner.name}</p>
        <p className={styles.responseText}>{pending ? '...' : text}</p>
      </div>
      <button
        className={styles.responseClose}
        onClick={() => setDismissed(true)}
        aria-label="Tutup respon learner"
      >
        ×
      </button>
    </div>
  )
}