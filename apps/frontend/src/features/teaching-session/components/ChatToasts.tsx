import { useEffect, useRef, useState } from 'react'
import type { ChatToast } from '../hooks/useWorkspaceChat'
import { spokenText, useUtteranceProgress } from '../hooks/useLearnerVoice'
import styles from '../../../styles/TeachingSession.module.css'

/** How long a toast stays once its line has been fully said. */
const TOAST_DURATION_MS = 5000

interface ChatToastsProps {
  toasts: ChatToast[]
  onDismiss: (id: string) => void
  onOpenChat: () => void
}

interface ToastItemProps {
  toast: ChatToast
  onDismiss: (id: string) => void
  onOpenChat: () => void
}

function ToastItem({ toast, onDismiss, onOpenChat }: ToastItemProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progress = useUtteranceProgress(toast.speech)
  const waiting = progress?.phase === 'waiting'
  const shown = waiting ? '...' : spokenText(toast.content, toast.speech, progress)
  const lineDone = !toast.speech || progress?.phase === 'done'

  useEffect(() => {
    // Fade in
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Auto dismiss, counted from when the line has been fully said rather than
  // from when the toast appeared — otherwise it could leave mid-sentence.
  useEffect(() => {
    if (!lineDone) return
    timerRef.current = setTimeout(() => {
      setVisible(false)
      // Wait for fade-out transition before removing
      setTimeout(() => onDismiss(toast.id), 250)
    }, TOAST_DURATION_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, onDismiss, lineDone])

  return (
    <div
      className={`${styles.chatToast} ${visible ? styles.chatToastVisible : ''}`}
      onClick={() => {
        onDismiss(toast.id)
        onOpenChat()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpenChat()}
      aria-label={`Message from ${toast.senderName}: ${shown}. Click to open chat.`}
    >
      <img src={toast.avatarUrl} alt={toast.senderName} className={styles.chatToastAvatar} />
      <div className={styles.chatToastBody}>
        <span className={styles.chatToastName}>{toast.senderName}</span>
        <p className={styles.chatToastText}>{shown}</p>
      </div>
    </div>
  )
}

export function ChatToasts({ toasts, onDismiss, onOpenChat }: ChatToastsProps) {
  if (toasts.length === 0) return null

  return (
    <div className={styles.chatToastsContainer}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} onOpenChat={onOpenChat} />
      ))}
    </div>
  )
}
