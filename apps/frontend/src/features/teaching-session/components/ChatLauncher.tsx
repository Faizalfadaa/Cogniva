import styles from '../../../styles/TeachingSession.module.css'

interface ChatLauncherProps {
  chatOpen: boolean
  chatUnread: number
  onToggleChat: () => void
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
  learnerAvatarUrl,
  learnerName,
}: ChatLauncherProps) {
  if (chatOpen) return null

  const who = learnerName ?? 'the learner'
  const label = `Open chat with ${who}`

  return (
    <button
      type="button"
      data-tour="chat-launcher"
      className={styles.chatLauncher}
      onClick={onToggleChat}
      aria-label={label}
      aria-expanded={chatOpen}
      title={label}
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
