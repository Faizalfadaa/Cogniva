import { useCallback, useEffect, useRef, useState } from 'react'
import styles from '../../../styles/TeachingSession.module.css'
import type { LearnerCharacter } from '../../../lib/Learner'
import type { ChatMessageDTO } from '../../../dto/ChatMessageDTO'

const SIDEBAR_MIN_PX = 280
const SIDEBAR_MAX_RATIO = 0.5   // max 50% of canvas width
const SIDEBAR_DEFAULT_PX = 320

interface ChatSidebarProps {
  learner: LearnerCharacter
  messages: ChatMessageDTO[]
  isOpen: boolean
  unreadCount: number
  onToggle: () => void
  onSend: (content: string) => void
}

export function ChatSidebar({
  learner,
  messages,
  isOpen,
  unreadCount,
  onToggle,
  onSend,
}: ChatSidebarProps) {
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_PX)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Auto-scroll to bottom on new messages or when panel opens
  useEffect(() => {
    if (!isOpen) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [isOpen, messages])

  // ── Drag-to-resize logic ──────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = width
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return
      const canvasWidth = containerRef.current.parentElement?.offsetWidth ?? window.innerWidth
      const maxPx = canvasWidth * SIDEBAR_MAX_RATIO
      const delta = dragStartX.current - e.clientX
      const next = Math.max(SIDEBAR_MIN_PX, Math.min(maxPx, dragStartWidth.current + delta))
      setWidth(next)
    }

    function onMouseUp() {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleSubmit() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onSend(trimmed)
    setDraft('')
  }

  // ── Avatar trigger (collapsed state) ─────────────────────────────────────
  if (!isOpen) {
    return (
      <div className={styles.sidebarTrigger}>
        <button
          className={styles.sidebarAvatarBtn}
          onClick={onToggle}
          aria-label={`Open chat with ${learner.name}`}
        >
          <img src={learner.avatarUrl} alt={learner.name} className={styles.sidebarAvatarImg} />
          {unreadCount > 0 && (
            <span className={styles.sidebarBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
      </div>
    )
  }

  // ── Full sidebar (open state) ─────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={styles.chatSidebar}
      style={{ width }}
    >
      {/* Drag handle — left edge */}
      <div
        className={styles.chatSidebarHandle}
        onMouseDown={onDragStart}
        aria-hidden="true"
      />

      {/* Header */}
      <div className={styles.chatSidebarHeader}>
        <img
          src={learner.avatarUrl}
          alt={learner.name}
          className={styles.chatSidebarAvatar}
        />
        <div className={styles.chatSidebarHeaderInfo}>
          <span className={styles.chatSidebarName}>{learner.name}</span>
        </div>
        <button
          className={styles.chatSidebarClose}
          onClick={onToggle}
          aria-label="Close chat"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className={styles.chatSidebarMessages} ref={listRef}>
        {messages.length === 0 ? (
          <p className={styles.chatSidebarEmpty}>
            No messages yet. Say hi to {learner.name}!
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.chatBubble} ${
                m.sender === 'user' ? styles.chatBubbleUser : styles.chatBubbleLearner
              }`}
            >
              {m.content}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className={styles.chatSidebarInputRow}>
        <input
          className={styles.chatSidebarInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={`Message ${learner.name}...`}
          aria-label="Write a message"
        />
        <button
          className={styles.chatSidebarSend}
          onClick={handleSubmit}
          disabled={!draft.trim()}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
