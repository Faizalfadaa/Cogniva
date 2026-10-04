import { useCallback, useEffect, useRef, useState } from 'react'
import type { CognivaBridge } from '../../../bridge/CognivaBridge'
import type { ChatMessageDTO } from '../../../dto/ChatMessageDTO'
import type { LearnerSpeechDTO } from '../../../dto/LearnerSpeechDTO'
import type { SessionError } from '../components/errorTypes'
import { markHeardUrls, markSpeechHeard } from './useLearnerVoice'
import { getGuestSessionId } from '../../../state/guestSession'

const POLL_INTERVAL_MS = 2000

/**
 * While a reply is being voiced every poll can bring the next sentence's clip,
 * so polling speeds up. It also speeds up for a while after sending a message,
 * so the reply itself lands without waiting out the slow interval.
 */
const FAST_POLL_MS = 500
const FAST_AFTER_SEND_MS = 20000

export interface ChatToast {
  id: string
  content: string
  senderName: string
  avatarUrl: string
  /** Kept current on every poll, so the toast reveals the reply as it is spoken. */
  speech?: LearnerSpeechDTO
}

interface UseWorkspaceChatOptions {
  /**
   * The student's greeting, shown ahead of the real conversation.
   *
   * `undefined` means not decided yet (see useFirstSession) and shows none;
   * `[]` means no greeting, which is every session after the first. It can
   * arrive after the conversation has: it is kept out of every count, so it
   * never shows up as unread or as a toast.
   *
   * Each line carries its own time, anchored to when the workspace was made, so
   * the greeting is the same on every load and always sorts first. It used to be
   * stamped with the time the page opened, which put a greeting from the first
   * session at the bottom of the conversation on any later visit.
   */
  seedMessages?: Array<{ id: string; content: string; createdAt: string }>
}

/**
 * The greeting lives only in the browser; the server has never heard of it.
 * Recognised by id so it can be kept out of anything that counts the real
 * conversation.
 */
const SEED_PREFIX = 'seed-'

function isSeed(message: { id: string }): boolean {
  return message.id.startsWith(SEED_PREFIX)
}

// ── localStorage helpers ────────────────────────────────────────────────────

function readCountKey(workspaceId: string) {
  // v2: counts the real conversation only, without the greeting. A v1 count
  // included it, and read against the new counting it would sit three too high,
  // hiding the next three replies from the unread badge.
  return `cogniva:chat-read:v2:${workspaceId}`
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

// The four storage helpers below swallow deliberately: localStorage/
// sessionStorage throw in private mode or when the quota is full, and losing a
// read-count or a cached transcript is a cosmetic regression, not something to
// interrupt the user over. Only the network paths raise a SessionError.
function saveReadCount(workspaceId: string, count: number) {
  if (getGuestSessionId()) return
  try {
    localStorage.setItem(readCountKey(workspaceId), String(count))
  } catch {}
}

function loadSessionMsgs(workspaceId: string): ChatMessageDTO[] {
  if (getGuestSessionId()) return []
  try {
    const raw = sessionStorage.getItem(sessionMsgsKey(workspaceId))
    return raw ? (JSON.parse(raw) as ChatMessageDTO[]) : []
  } catch {
    return []
  }
}

function saveSessionMsgs(workspaceId: string, msgs: ChatMessageDTO[]) {
  if (getGuestSessionId()) return
  try {
    sessionStorage.setItem(sessionMsgsKey(workspaceId), JSON.stringify(msgs))
  } catch {}
}

// ── Hook ───────────────────────────────────────────────────────────────────

/** Whether two snapshots of a reply's speech would render the same. */
function sameSpeech(a: LearnerSpeechDTO | undefined, b: LearnerSpeechDTO | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const clips = (speech: LearnerSpeechDTO) => speech.segments.filter((s) => s.audioUrl).length
  return a.id === b.id && a.status === b.status && clips(a) === clips(b)
}

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
  // The stored greeting is dropped: whether there is one is decided again on
  // every visit, and a copy from the first session must not outlive it.
  const persistedOnMount = useRef<ChatMessageDTO[]>(
    loadSessionMsgs(workspaceId).filter((m) => !isSeed(m))
  )

  // A conversation restored from this tab's storage has already been heard.
  // Marked before the first render uses it, so none of it is spoken again.
  const restoredMarked = useRef(false)
  if (!restoredMarked.current) {
    restoredMarked.current = true
    markSpeechHeard(persistedOnMount.current.map((m) => m.speech?.id))
    markHeardUrls(persistedOnMount.current.map((m) => m.learnerAudioUrl))
  }

  const seedsReady = options.seedMessages !== undefined
  // Rebuilt every render and read through a ref by the poll loop, which would
  // otherwise keep the greeting it saw when it started.
  const seedRef = useRef<ChatMessageDTO[]>([])
  seedRef.current = (options.seedMessages ?? []).map((m) => ({
    id: m.id,
    sender: 'learner' as const,
    content: m.content,
    createdAt: m.createdAt,
  }))
  const seedKey = seedRef.current.map((m) => m.id + m.content).join('|')

  // What this tab saw last, shown at once while the first poll is in flight.
  const [messages, setMessages] = useState<ChatMessageDTO[]>(persistedOnMount.current)

  const [isOpen, setIsOpen] = useState(false)
  const [sendingCount, setSendingCount] = useState(0)
  const [toasts, setToasts] = useState<ChatToast[]>([])
  const [error, setError] = useState<SessionError | null>(null)

  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  // Persist read count across navigations
  const readLearnerCountRef = useRef<number>(loadReadCount(workspaceId))

  // -1 = first poll not yet done; used to suppress stale-message toasts on mount
  const prevLearnerCountRef = useRef<number>(-1)

  // Adaptive polling: fast while a reply is still being voiced, or just after
  // the user sent something; slow otherwise.
  const pendingSpeechRef = useRef(false)
  const fastUntilRef = useRef(0)

  function mergeMessages(seeds: ChatMessageDTO[], fetched: ChatMessageDTO[]): ChatMessageDTO[] {
    const fresh = fetched.filter((m) => !isSeed(m))
    return [...seeds, ...fresh].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }

  // The greeting decided (or changed, when the learner or language does):
  // swap it into what is on screen without waiting for the next poll.
  useEffect(() => {
    if (!seedsReady) return
    setMessages((prev) => mergeMessages(seedRef.current, prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedsReady, seedKey])

  useEffect(() => {
    if (!workspaceId) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const fetched = await bridge.getChatMessages(workspaceId)
        if (!active) return

        // First poll: every reply already on the server predates this page.
        // Marked heard before it reaches state, so no render ever treats it as
        // new and starts speaking a conversation that already happened.
        if (prevLearnerCountRef.current === -1) {
          markSpeechHeard(fetched.map((m) => m.speech?.id))
          markHeardUrls(fetched.map((m) => m.learnerAudioUrl))
        }

        const merged = mergeMessages(seedRef.current, fetched)
        setMessages(merged)
        saveSessionMsgs(workspaceId, merged)
        // A poll that lands clears whatever the previous one complained about.
        setError(null)
        pendingSpeechRef.current = merged.some((m) => m.speech?.status === 'pending')

        // Toasts are snapshots taken when a reply first arrives. Keep their
        // speech current, so they reveal the reply in step with the voice.
        setToasts((prev) => {
          let changed = false
          const next = prev.map((toast) => {
            const latest = merged.find((m) => m.id === toast.id)?.speech
            if (sameSpeech(latest, toast.speech)) return toast
            changed = true
            return { ...toast, speech: latest }
          })
          return changed ? next : prev
        })

        // The greeting is not counted: it was just played to the user in the
        // introduction, so it is neither unread nor worth a toast.
        const learnerMsgs = merged.filter((m) => m.sender === 'learner' && !isSeed(m))
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
                speech: m.speech,
              }))
            )
          }
          prevLearnerCountRef.current = learnerCount
        }
      } catch (err) {
        if (!active) return
        // Polling repeats every few seconds, so this fires repeatedly while the
        // backend is down; setting the same shape each time keeps it to one
        // banner rather than a stream. Offline is reported as such -- the poll
        // failing is the symptom, not the cause.
        console.error('[useWorkspaceChat] getChatMessages failed', err)
        setError(
          navigator.onLine
            ? { kind: 'ai_unavailable', detail: err instanceof Error ? err.message : String(err) }
            : { kind: 'network' }
        )
      }
    }

    // A timeout chain rather than an interval, so the pace can change between
    // polls and a slow request never stacks a second one behind it.
    async function loop() {
      await poll()
      if (!active) return
      const fast = pendingSpeechRef.current || Date.now() < fastUntilRef.current
      timer = setTimeout(loop, fast ? FAST_POLL_MS : POLL_INTERVAL_MS)
    }

    void loop()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [workspaceId, bridge, learnerName, learnerAvatarUrl])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      setSendingCount((count) => count + 1)
      fastUntilRef.current = Date.now() + FAST_AFTER_SEND_MS
      try {
        const sent = await bridge.sendChatMessage(workspaceId, trimmed)
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev
          const next = [...prev, sent]
          saveSessionMsgs(workspaceId, next)
          return next
        })
        setError(null)
      } catch (err) {
        // This one had no catch at all before: a failed send became an unhandled
        // rejection and the message just vanished from the UI with no
        // explanation.
        console.error('[useWorkspaceChat] sendChatMessage failed', err)
        setError(
          navigator.onLine
            ? { kind: 'ai_unavailable', detail: err instanceof Error ? err.message : String(err) }
            : { kind: 'network' }
        )
      } finally {
        setSendingCount((count) => count - 1)
      }
    },
    [bridge, workspaceId]
  )

  function markAllRead(msgs: ChatMessageDTO[]) {
    const learnerCount = msgs.filter((m) => m.sender === 'learner' && !isSeed(m)).length
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
    messages.filter((m) => m.sender === 'learner' && !isSeed(m)).length -
      readLearnerCountRef.current
  )

  const dismissError = useCallback(() => setError(null), [])

  return {
    messages,
    // Chat replies arrive asynchronously through polling after the send resolves.
    isTyping: !error && (sendingCount > 0 || messages[messages.length - 1]?.sender === 'user'),
    isOpen,
    unreadCount,
    toasts,
    dismissToast,
    sendMessage,
    open,
    close,
    toggle,
    error,
    dismissError,
  }
}
