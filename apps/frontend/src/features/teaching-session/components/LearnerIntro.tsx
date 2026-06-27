import { useEffect, useState } from 'react'
import styles from '../../../styles/TeachingSession.module.css'
import { resolveFirstMessages, type LearnerCharacter } from '../../../lib/Learner'

interface LearnerIntroProps {
  learner: LearnerCharacter
  userName: string
  onDone: () => void
}

type Phase = 'connecting' | 'messages'

const CONNECTING_DURATION_MS = 3000
const MESSAGE_DURATION_MS = 1200
// Each message auto-dismisses after this long
const MESSAGE_VISIBLE_MS = 5000

export function LearnerIntro({ learner, userName, onDone }: LearnerIntroProps) {
  const [phase, setPhase] = useState<Phase>('connecting')
  // connectStep: 0 = nothing, 1 = line1 visible, 2 = both visible + image unblurred
  const [connectStep, setConnectStep] = useState(0)
  // Which messages are currently visible (by index)
  const [visibleMessages, setVisibleMessages] = useState<number[]>([])
  // Current message being shown (drives the queue)
  const [messageIndex, setMessageIndex] = useState(0)

  const messages = resolveFirstMessages(learner, userName || 'kamu')

  // Connecting phase: stagger text lines, then switch to messages
  useEffect(() => {
    if (phase !== 'connecting') return
    const t1 = setTimeout(() => setConnectStep(1), 300)
    const t2 = setTimeout(() => setConnectStep(2), 1400)
    const t3 = setTimeout(() => setPhase('messages'), CONNECTING_DURATION_MS)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [phase])

  // Messages phase: show each message one at a time, dismiss after MESSAGE_VISIBLE_MS
  useEffect(() => {
    if (phase !== 'messages') return
    if (messageIndex >= messages.length) return

    // Show this message
    setVisibleMessages((prev) => [...prev.slice(-2), messageIndex]) // keep last 3

    // Schedule dismiss of this message
    const dismissTimer = setTimeout(() => {
      setVisibleMessages((prev) => prev.filter((i) => i !== messageIndex))
    }, MESSAGE_VISIBLE_MS)

    // Schedule next message (or done)
    const nextTimer = setTimeout(() => {
      if (messageIndex >= messages.length - 1) {
        // Last message — call onDone after it dismisses
        setTimeout(onDone, MESSAGE_VISIBLE_MS)
      } else {
        setMessageIndex((i) => i + 1)
      }
    }, MESSAGE_DURATION_MS)

    return () => { clearTimeout(dismissTimer); clearTimeout(nextTimer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, messageIndex])

  return (
    <>
      {/* Full-canvas overlay — only during connecting phase */}
      {phase === 'connecting' && (
        <div className={styles.introOverlay}>
          <button className={styles.introSkip} onClick={onDone}>
            Skip
          </button>
          <div className={styles.introCard}>
            <img
              src={learner.introImageUrl}
              alt={learner.name}
              className={`${styles.introCardImage} ${connectStep >= 2 ? styles.introCardImageClear : styles.introCardImageBlurred}`}
            />
            <div className={styles.introCardText}>
              <span className={connectStep >= 1 ? styles.introLine1Visible : styles.introLine1Hidden}>
                Connecting you to a student...
              </span>
              <span className={connectStep >= 2 ? styles.introLine2Visible : styles.introLine2Hidden}>
                Greetings from,<br />{learner.name}!
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Side toasts — only during messages phase, no overlay */}
      {phase === 'messages' && visibleMessages.length > 0 && (
        <div className={styles.introToastsContainer}>
          <button className={styles.introSkip} onClick={onDone} style={{ position: 'static', marginBottom: 8, alignSelf: 'flex-end' }}>
            Skip
          </button>
          {visibleMessages.map((idx) => (
            <div key={idx} className={styles.introToast}>
              <img src={learner.avatarUrl} alt={learner.name} className={styles.chatToastAvatar} />
              <div className={styles.chatToastBody}>
                <span className={styles.chatToastName}>{learner.name}</span>
                <p className={styles.chatToastText}>{messages[idx]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}