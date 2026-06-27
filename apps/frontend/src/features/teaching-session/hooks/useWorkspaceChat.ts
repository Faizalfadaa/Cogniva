import { useCallback, useEffect, useRef, useState } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'
import type { ChatMessageDTO } from '../../../dto/ChatMessageDTO'

const POLL_INTERVAL_MS = 2000

export function useWorkspaceChat(workspaceId: string, bridge: CognivaBridge) {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  // Berapa pesan learner yang udah "dibaca" (panel pernah kebuka sampai sejauh ini).
  const readLearnerCountRef = useRef(0)

  // Bridge cuma expose polling (lihat komentar di CognivaBridge.ts), jadi caller
  // yang tanggung jawab nge-poll berkala - di sini, selama halaman workspace mount,
  // gak peduli panel-nya kebuka atau ketutup (biar badge tetep ke-update saat ketutup).
  useEffect(() => {
    if (!workspaceId) return
    let active = true

    async function poll() {
      try {
        const list = await bridge.getChatMessages(workspaceId)
        if (!active) return
        setMessages(list)

        const learnerCount = list.filter((m) => m.sender === 'learner').length
        if (isOpenRef.current) {
          readLearnerCountRef.current = learnerCount
          setUnreadCount(0)
        } else {
          setUnreadCount(Math.max(0, learnerCount - readLearnerCountRef.current))
        }
      } catch {
        // diem aja - retry otomatis di siklus poll berikutnya
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [workspaceId, bridge])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const sent = await bridge.sendChatMessage(workspaceId, trimmed)
      // Optimistic append - poll berikutnya akan full-replace dengan list yang
      // sama (sent udah ke-persist di store sebelum promise ini resolve),
      // jadi gak ada duplikat.
      setMessages((prev) => [...prev, sent])
    },
    [bridge, workspaceId]
  )

  const open = useCallback(() => {
    setIsOpen(true)
    setUnreadCount(0)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) setUnreadCount(0)
      return next
    })
  }, [])

  return { messages, isOpen, unreadCount, sendMessage, open, close, toggle }
}