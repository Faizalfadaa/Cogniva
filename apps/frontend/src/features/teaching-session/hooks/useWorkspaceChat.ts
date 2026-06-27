import { useCallback, useEffect, useRef, useState } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'
import type { ChatMessageDTO } from '../../../dto/ChatMessageDTO'

const POLL_INTERVAL_MS = 2000

export interface ChatToast {
  id: string
  content: string
  senderName: string
  avatarUrl: string
}

interface UseWorkspaceChatOptions {
  /** First messages from the learner character, already resolved with userName.
   *  These are seeded once as the initial chat history so the chat is never empty. */
  seedMessages?: Array<{ id: string; content: string }>
}

export function useWorkspaceChat(
  workspaceId: string,
  bridge: CognivaBridge,
  learnerName: string,
  learnerAvatarUrl: string,
  options: UseWorkspaceChatOptions = {}
) {
  // Seed first messages as learner messages so chat is never empty on open.
  const seedRef = useRef<ChatMessageDTO[]>(
    (options.seedMessages ?? []).map((m, i) => ({
      id: m.id,
      sender: 'learner' as const,
      content: m.content,
      // Staggered timestamps so they render in order (oldest first)
      createdAt: new Date(Date.now() - (options.seedMessages!.length - i) * 3000).toISOString(),
    }))
  )

  const [messages, setMessages] = useState<ChatMessageDTO[]>(seedRef.current)
  const [isOpen, setIsOpen] = useState(false)
  // Toasts: up to 3 most-recent unread learner messages shown as floating bubbles
  const [toasts, setToasts] = useState<ChatToast[]>([])

  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  // How many learner messages the user has "read" (panel was open at that point)
  const readLearnerCountRef = useRef(0)
  // How many learner messages were already known from last poll (to detect new ones)
  const prevLearnerCountRef = useRef(seedRef.current.length)

  // Merge backend messages on top of seeds — avoid duplicating seed ids
  function mergeMessages(seeds: ChatMessageDTO[], fetched: ChatMessageDTO[]): ChatMessageDTO[] {
    const seedIds = new Set(seeds.map((s) => s.id))
    const fresh = fetched.filter((m) => !seedIds.has(m.id))
    return [...seeds, ...fresh].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }

  useEffect(() => {
    if (!workspaceId) return
    let active = true

    async function poll() {
      try {
        const fetched = await bridge.getChatMessages(workspaceId)
        if (!active) return

        const merged = mergeMessages(seedRef.current, fetched)
        setMessages(merged)

        const learnerMsgs = merged.filter((m) => m.sender === 'learner')
        const learnerCount = learnerMsgs.length

        if (isOpenRef.current) {
          readLearnerCountRef.current = learnerCount
          prevLearnerCountRef.current = learnerCount
          setToasts([])
        } else {
          const newCount = learnerCount - prevLearnerCountRef.current
          if (newCount > 0) {
            // Show up to last 3 new learner messages as toasts
            const newMsgs = learnerMsgs.slice(-Math.min(newCount, 3))
            setToasts(
              newMsgs.map((m) => ({
                id: m.id,
                content: m.content,
                senderName: learnerName,
                avatarUrl: learnerAvatarUrl,
              }))
            )
          }
          prevLearnerCountRef.current = learnerCount
        }
      } catch {
        // Retry on next cycle
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [workspaceId, bridge, learnerName, learnerAvatarUrl])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const sent = await bridge.sendChatMessage(workspaceId, trimmed)
      setMessages((prev) => {
        // Avoid duplicate if poll already picked it up
        if (prev.some((m) => m.id === sent.id)) return prev
        return [...prev, sent]
      })
    },
    [bridge, workspaceId]
  )

  const open = useCallback(() => {
    setIsOpen(true)
    setToasts([])
    setMessages((prev) => {
      const learnerCount = prev.filter((m) => m.sender === 'learner').length
      readLearnerCountRef.current = learnerCount
      prevLearnerCountRef.current = learnerCount
      return prev
    })
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        setToasts([])
        setMessages((msgs) => {
          const learnerCount = msgs.filter((m) => m.sender === 'learner').length
          readLearnerCountRef.current = learnerCount
          prevLearnerCountRef.current = learnerCount
          return msgs
        })
      }
      return next
    })
  }, [])

  const unreadCount = Math.max(
    0,
    messages.filter((m) => m.sender === 'learner').length - readLearnerCountRef.current
  )

  return { messages, isOpen, unreadCount, toasts, dismissToast, sendMessage, open, close, toggle }
}
