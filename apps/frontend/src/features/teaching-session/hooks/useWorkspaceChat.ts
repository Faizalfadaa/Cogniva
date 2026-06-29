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
  seedMessages?: Array<{ id: string; content: string }>
}

// ── localStorage helpers ────────────────────────────────────────────────────

function readCountKey(workspaceId: string) {
  return `cogniva:chat-read:${workspaceId}`
}

function sessionMsgsKey(workspaceId: string) {
  return `cogniva:chat-msgs:${workspaceId}`
}

function loadReadCount(workspaceId: string): number {
  try {
    const v = localStorage.getItem(readCountKey(workspaceId))
    return v !== null ? parseInt(v, 10) : 0
  } catch {
    return 0
  }
}

function saveReadCount(workspaceId: string, count: number) {
  try {
    localStorage.setItem(readCountKey(workspaceId), String(count))
  } catch {}
}

function loadSessionMsgs(workspaceId: string): ChatMessageDTO[] {
  try {
    const raw = sessionStorage.getItem(sessionMsgsKey(workspaceId))
    return raw ? (JSON.parse(raw) as ChatMessageDTO[]) : []
  } catch {
    return []
  }
}

function saveSessionMsgs(workspaceId: string, msgs: ChatMessageDTO[]) {
  try {
    sessionStorage.setItem(sessionMsgsKey(workspaceId), JSON.stringify(msgs))
  } catch {}
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useWorkspaceChat(
  workspaceId: string,
  bridge: CognivaBridge,
  learnerName: string,
  learnerAvatarUrl: string,
  options: UseWorkspaceChatOptions = {}
) {
  // If we have persisted messages from a previous visit, use those as the merge
  // base instead of re-generating seeds with a fresh Date.now() — otherwise the
  // new seed timestamps would be newer than real backend messages and sort them
  // into the wrong position.
  const persistedOnMount = useRef<ChatMessageDTO[]>(loadSessionMsgs(workspaceId))

  const seedRef = useRef<ChatMessageDTO[]>(
    persistedOnMount.current.length > 0
      ? persistedOnMount.current  // use persisted as stable base; timestamps already fixed
      : (options.seedMessages ?? []).map((m, i) => ({
          id: m.id,
          sender: 'learner' as const,
          content: m.content,
          // Anchor to a fixed past time so subsequent real messages always sort after
          createdAt: new Date(Date.now() - (options.seedMessages!.length - i) * 3000).toISOString(),
        }))
  )

  const [messages, setMessages] = useState<ChatMessageDTO[]>(
    persistedOnMount.current.length > 0 ? persistedOnMount.current : seedRef.current
  )

  const [isOpen, setIsOpen] = useState(false)
  const [toasts, setToasts] = useState<ChatToast[]>([])

  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  // Persist read count across navigations
  const readLearnerCountRef = useRef<number>(loadReadCount(workspaceId))

  // -1 = first poll not yet done; used to suppress stale-message toasts on mount
  const prevLearnerCountRef = useRef<number>(-1)

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
        saveSessionMsgs(workspaceId, merged)

        const learnerMsgs = merged.filter((m) => m.sender === 'learner')
        const learnerCount = learnerMsgs.length

        if (isOpenRef.current) {
          readLearnerCountRef.current = learnerCount
          saveReadCount(workspaceId, learnerCount)
          prevLearnerCountRef.current = learnerCount
          setToasts([])
        } else if (prevLearnerCountRef.current === -1) {
          // First poll: treat everything already present as "known" — no toasts
          prevLearnerCountRef.current = learnerCount
        } else {
          const newCount = learnerCount - prevLearnerCountRef.current
          if (newCount > 0) {
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
        if (prev.some((m) => m.id === sent.id)) return prev
        const next = [...prev, sent]
        saveSessionMsgs(workspaceId, next)
        return next
      })
    },
    [bridge, workspaceId]
  )

  function markAllRead(msgs: ChatMessageDTO[]) {
    const learnerCount = msgs.filter((m) => m.sender === 'learner').length
    readLearnerCountRef.current = learnerCount
    saveReadCount(workspaceId, learnerCount)
    prevLearnerCountRef.current = learnerCount
  }

  const open = useCallback(() => {
    setIsOpen(true)
    setToasts([])
    setMessages((prev) => { markAllRead(prev); return prev })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const close = useCallback(() => setIsOpen(false), [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        setToasts([])
        setMessages((msgs) => { markAllRead(msgs); return msgs })
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const unreadCount = Math.max(
    0,
    messages.filter((m) => m.sender === 'learner').length - readLearnerCountRef.current
  )

  return { messages, isOpen, unreadCount, toasts, dismissToast, sendMessage, open, close, toggle }
}