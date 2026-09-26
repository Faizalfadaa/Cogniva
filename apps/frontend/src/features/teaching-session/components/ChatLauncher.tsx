import { useRef, useState, type PointerEvent } from 'react'
import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/TeachingSession.module.css'
import type { LauncherOffset } from '../hooks/useLauncherPosition'

/**
 * How far the pointer has to travel before a press becomes a drag. Below this
 * it is a click with an unsteady hand, and should still open the chat.
 */
const DRAG_THRESHOLD = 5

interface ChatLauncherProps {
  chatOpen: boolean
  chatUnread: number
  onToggleChat: () => void
  /** Where the button sits over the canvas (see useLauncherPosition). */
  offset: LauncherOffset
  /** Called as the button is dragged. */
  onMove: (next: LauncherOffset) => void
  /** Secondary detail: whose chat this opens. Optional — the glyph carries the meaning. */
  learnerAvatarUrl?: string
  learnerName?: string
}

/** Speech bubble — the shape people already read as "chat" (Intercom/Crisp). */
function ChatBubbleIcon() {
  return (
    <svg
      className={styles.chatLauncherIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

/** Floating chat entry point, visible while the sidebar is closed. */
export function ChatLauncher({
  chatOpen,
  chatUnread,
  onToggleChat,
  offset,
  onMove,
  learnerAvatarUrl,
  learnerName,
}: ChatLauncherProps) {
  const t = useT()
  const dragRef = useRef<{ x: number; y: number; from: LauncherOffset; moved: boolean } | null>(null)
  // The click that follows a drag's release must not open the chat.
  const swallowClickRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  if (chatOpen) return null

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    dragRef.current = { x: e.clientX, y: e.clientY, from: offset, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      drag.moved = true
      setDragging(true)
    }
    // Measured from the bottom-right, so moving right or down shrinks it.
    onMove({ right: drag.from.right - dx, bottom: drag.from.bottom - dy })
  }

  const endDrag = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.moved) return
    swallowClickRef.current = true
    setDragging(false)
  }

  const onClick = () => {
    if (swallowClickRef.current) {
      swallowClickRef.current = false
      return
    }
    onToggleChat()
  }

  const who = learnerName ?? t('stage.theLearner')
  const label = t('stage.openChat', { name: who })

  return (
    <button
      type="button"
      data-tour="chat-launcher"
      className={`${styles.chatLauncher} ${dragging ? styles.chatLauncherDragging : ''}`}
      style={{ right: offset.right, bottom: offset.bottom }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-label={label}
      aria-expanded={chatOpen}
      title={`${label}. ${t('stage.dragHint')}`}
    >
      <ChatBubbleIcon />

      {learnerAvatarUrl && (
        <img
          src={learnerAvatarUrl}
          alt=""
          aria-hidden="true"
          className={styles.chatLauncherAvatar}
        />
      )}

      {chatUnread > 0 && (
        <span className={styles.sidebarBadge}>{chatUnread > 9 ? '9+' : chatUnread}</span>
      )}
    </button>
  )
}
