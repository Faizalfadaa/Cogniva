import { useEffect, useState } from 'react'
import styles from '../../../styles/TeachingSession.module.css'
import type { LearnerCharacter } from '../../../lib/Learner'
import { useLearnerVoice } from '../hooks/useLearnerVoice'

interface LearnerResponseBubbleProps {
  learner: LearnerCharacter
  text?: string
  pending: boolean
  checkpointId?: string
  /** Spoken version of `text`, when the voice service produced one. */
  audioUrl?: string
}

const AUTO_DISMISS_MS = 5000

export function LearnerResponseBubble({
  learner,
  text,
  pending,
  checkpointId,
  audioUrl,
}: LearnerResponseBubbleProps) {
  const [dismissed, setDismissed] = useState(false)
  const voice = useLearnerVoice()

  useEffect(() => {
    setDismissed(false)
    if (!checkpointId) return
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [checkpointId])

  // Speak the reply the moment it lands. Dismissing the bubble does not stop
  // playback — the line is worth hearing out even after the card disappears.
  useEffect(() => {
    voice.autoPlay(audioUrl)
  }, [audioUrl, voice.autoPlay]) // eslint-disable-line react-hooks/exhaustive-deps

  if (dismissed || (!pending && !text)) return null

  return (
    <div className={styles.notifStack} style={{ pointerEvents: 'none' }}>
      <div className={styles.notifToast} style={{ pointerEvents: 'all' }}>
        <img src={learner.avatarUrl} alt={learner.name} className={styles.notifAvatar} />
        <div className={styles.notifBody}>
          <span className={styles.notifName}>
            {learner.name}
            {audioUrl && (
              <button
                className={styles.notifSpeak}
                onClick={() =>
                  voice.playingUrl === audioUrl ? voice.stop() : voice.play(audioUrl)
                }
                aria-label={
                  voice.playingUrl === audioUrl ? 'Stop playback' : `Replay ${learner.name}'s voice`
                }
                title={voice.playingUrl === audioUrl ? 'Stop' : 'Replay voice'}
              >
                {voice.playingUrl === audioUrl ? '◼' : '▶'}
              </button>
            )}
          </span>
          <p className={styles.notifText}>{pending ? '...' : text}</p>
        </div>
        <button
          className={styles.notifClose}
          onClick={() => setDismissed(true)}
          aria-label="Close learner response"
        >
          ×
        </button>
      </div>
    </div>
  )
}