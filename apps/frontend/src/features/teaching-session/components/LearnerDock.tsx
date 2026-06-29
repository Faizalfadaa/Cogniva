import { useEffect, useRef, useState } from 'react'
import styles from '../../../styles/TeachingSession.module.css'
import type { LearnerCharacter } from '../../../lib/Learner'
import type { ChatMessageDTO } from '../../../dto/ChatMessageDTO'

interface LearnerDockProps {
  learner: LearnerCharacter
  messages: ChatMessageDTO[]
  isOpen: boolean
  unreadCount: number
  onToggle: () => void
  onSend: (content: string) => void
}

export function LearnerDock({ learner, messages, isOpen, unreadCount, onToggle, onSend }: LearnerDockProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll ke bawah tiap ada pesan baru / panel baru dibuka.
  useEffect(() => {
    if (!isOpen) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [isOpen, messages])

  function handleSubmit() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onSend(trimmed)
    setDraft('')
  }

  if (!isOpen) {
    return (
      <button className={styles.dockCollapsed} onClick={onToggle} aria-label={`Buka chat dengan ${learner.name}`}>
        <img src={learner.avatarUrl} alt={learner.name} className={styles.dockAvatar} />
        {unreadCount > 0 && (
          <span className={styles.dockBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>
    )
  }

  return (
    <div className={styles.dockExpanded}>
      <div className={styles.dockHeader}>
        <img src={learner.avatarUrl} alt={learner.name} className={styles.dockHeaderAvatar} />
        <span className={styles.dockHeaderName}>{learner.name}</span>
        <button className={styles.dockClose} onClick={onToggle} aria-label="Tutup chat">
          ×
        </button>
      </div>

      <div className={styles.dockMessages} ref={listRef}>
        {messages.length === 0 ? (
          <p className={styles.dockEmpty}>Belum ada chat. Sapa {learner.name} dulu, yuk.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.dockBubble} ${m.sender === 'user' ? styles.dockBubbleUser : styles.dockBubbleLearner}`}
            >
              {m.content}
            </div>
          ))
        )}
      </div>

      <div className={styles.dockInputRow}>
        <input
          className={styles.dockInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={`Tulis pesan ke ${learner.name}...`}
          aria-label="Tulis pesan"
        />
        <button className={styles.dockSend} onClick={handleSubmit} disabled={!draft.trim()} aria-label="Kirim">
          ↑
        </button>
      </div>
    </div>
  )
}