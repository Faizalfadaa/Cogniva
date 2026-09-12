import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import styles from '../../../styles/TeachingSession.module.css'
import type { LearnerCharacter } from '../../../lib/Learner'
import type { ChatMessageDTO } from '../../../dto/ChatMessageDTO'
import {
  spokenText,
  useLearnerVoice,
  useUtteranceProgress,
  useVoiceLevel,
  type LearnerVoice,
} from '../hooks/useLearnerVoice'

const STAGE_MIN_PX = 300
const STAGE_MAX_RATIO = 0.5 // at most half the canvas
const STAGE_DEFAULT_PX = 360
const SCROLL_BOTTOM_THRESHOLD_PX = 48

interface LearnerStageProps {
  learner: LearnerCharacter
  messages: ChatMessageDTO[]
  isOpen: boolean
  onToggle: () => void
  onSend: (content: string) => void
}

/** Whether one of this message's clips is the one playing right now. */
function isSpeaking(message: ChatMessageDTO | undefined, playingUrl: string | null): boolean {
  if (!message || !playingUrl) return false
  if (message.speech) return message.speech.segments.some((s) => s.audioUrl === playingUrl)
  return message.learnerAudioUrl === playingUrl
}

function hasAudio(message: ChatMessageDTO): boolean {
  return message.speech
    ? message.speech.segments.some((s) => Boolean(s.audioUrl))
    : Boolean(message.learnerAudioUrl)
}

function replayOrStop(message: ChatMessageDTO, speaking: boolean, voice: LearnerVoice): void {
  if (speaking) voice.stop()
  else if (message.speech) voice.replay(message.speech)
  else if (message.learnerAudioUrl) voice.play(message.learnerAudioUrl)
}

/** One transcript bubble, revealing a reply only as far as it has been spoken. */
function TranscriptBubble({
  message,
  learnerName,
  voice,
}: {
  message: ChatMessageDTO
  learnerName: string
  voice: LearnerVoice
}) {
  const progress = useUtteranceProgress(message.speech)
  const waiting = progress?.phase === 'waiting'
  const speaking = isSpeaking(message, voice.playingUrl)

  return (
    <div
      className={`${styles.chatBubble} ${
        message.sender === 'user' ? styles.chatBubbleUser : styles.chatBubbleLearner
      }`}
    >
      {waiting ? '…' : spokenText(message.content, message.speech, progress)}
      {!waiting && hasAudio(message) && (
        <button
          className={styles.chatBubbleSpeak}
          onClick={() => replayOrStop(message, speaking, voice)}
          aria-label={`Play ${learnerName}'s voice`}
        >
          {speaking ? '◼' : '▶'}
        </button>
      )}
    </div>
  )
}

/** Character portrait above a permanently visible conversation. */
export function LearnerStage({
  learner,
  messages,
  isOpen,
  onToggle,
  onSend,
}: LearnerStageProps) {
  const [width, setWidth] = useState(STAGE_DEFAULT_PX)
  const [draft, setDraft] = useState('')
  const [characterMinimized, setCharacterMinimized] = useState(false)
  const characterId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const followMessagesRef = useRef(true)
  const seededRef = useRef(false)

  const voice = useLearnerVoice()
  // Amplitude lands on the stage element; every moving part reads it from there.
  useVoiceLevel(stageRef)

  const latestLearnerLine = useMemo(
    () => [...messages].reverse().find((m) => m.sender === 'learner'),
    [messages],
  )
  const speaking = isSpeaking(latestLearnerLine, voice.playingUrl)

  // Legacy single-clip messages: whatever is already on screen when this opens
  // counts as heard, so reopening a conversation does not replay it.
  //
  // This deliberately seeds on the first non-empty message list, NOT on the
  // first message that happens to carry audio. Speech lands after the text it
  // belongs to, so keying on "has audio" meant the very first clip to arrive
  // was mistaken for backlog and silently skipped.
  useEffect(() => {
    if (seededRef.current || messages.length === 0) return
    seededRef.current = true
    voice.markHeard(messages.map((m) => m.learnerAudioUrl))
  }, [messages, voice.markHeard]) // eslint-disable-line react-hooks/exhaustive-deps

  // Legacy single clip: speak the newest one the moment it is attached.
  useEffect(() => {
    const url = latestLearnerLine?.speech ? undefined : latestLearnerLine?.learnerAudioUrl
    if (!url || !seededRef.current) return
    // Fetch first so playback starts instantly and the clip is same-origin by
    // the time the analyser reads it.
    voice.prefetch(url)
    voice.autoPlay(url)
    // The callbacks are useCallback-stable; depending on `voice` itself would
    // re-run this on every render.
  }, [latestLearnerLine, voice.autoPlay, voice.prefetch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Per-sentence replies: hand every one to the player on each poll. It speaks
  // each reply once, in order, and ignores the ones already heard — the chat
  // hook marks the backlog heard before any of it reaches this component.
  useEffect(() => {
    for (const message of messages) {
      if (message.sender === 'learner' && message.speech) voice.speak(message.speech)
    }
  }, [messages, voice.speak]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling creates a new array even when nothing visible has changed.
  const transcriptVersion = useMemo(
    () => JSON.stringify(messages.map(({ id, content, learnerAudioUrl }) => [id, content, learnerAudioUrl])),
    [messages],
  )

  useLayoutEffect(() => {
    if (!isOpen) {
      followMessagesRef.current = true
      return
    }
    const transcript = transcriptRef.current
    if (transcript && followMessagesRef.current) {
      // Apply before paint, without a smooth animation that can fight manual scrolling.
      transcript.scrollTop = transcript.scrollHeight
    }
  }, [isOpen, transcriptVersion, characterMinimized])

  // Follow both layout transitions and text revealed by per-sentence playback.
  useLayoutEffect(() => {
    const transcript = transcriptRef.current
    if (!isOpen || !transcript) return
    const followLatest = () => {
      if (followMessagesRef.current) transcript.scrollTop = transcript.scrollHeight
    }
    const observer = new ResizeObserver(followLatest)
    const contentObserver = new MutationObserver(followLatest)
    observer.observe(transcript)
    contentObserver.observe(transcript, { childList: true, characterData: true, subtree: true })
    return () => {
      observer.disconnect()
      contentObserver.disconnect()
    }
  }, [isOpen])

  function handleTranscriptScroll() {
    const transcript = transcriptRef.current
    if (!transcript) return
    followMessagesRef.current =
      transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop <= SCROLL_BOTTOM_THRESHOLD_PX
  }

  // --- drag to resize -------------------------------------------------------
  const dragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true
      dragStartX.current = e.clientX
      dragStartWidth.current = width
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    },
    [width],
  )

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return
      const canvasWidth = containerRef.current.parentElement?.offsetWidth ?? window.innerWidth
      const delta = dragStartX.current - e.clientX
      setWidth(
        Math.max(
          STAGE_MIN_PX,
          Math.min(canvasWidth * STAGE_MAX_RATIO, dragStartWidth.current + delta),
        ),
      )
    }
    function onUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  function handleSubmit() {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  if (!isOpen) return null

  return (
    <div ref={containerRef} className={styles.stage} style={{ width }}>
      <div className={styles.stageHandle} onMouseDown={onDragStart} aria-hidden="true" />

      <div className={styles.stageHeader}>
        <div className={styles.stageIdentity}>
          <img src={learner.avatarUrl} alt="" className={styles.stageHeaderAvatar} />
          <span className={styles.stageName}>{learner.name}</span>
        </div>
        <div className={styles.stageHeaderActions}>

          <button
            type="button"
            className={styles.stageIconBtn}
            onClick={onToggle}
            aria-label="Close chat"
            title="Close chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Everything below reads --voice-level, set on this node each frame. */}
      <div
        ref={stageRef}
        id={characterId}
        aria-hidden={characterMinimized}
        className={`${styles.stageBody} ${speaking ? styles.stageBodySpeaking : ''} ${characterMinimized ? styles.stageBodyMinimized : ''}`}
      >
        <div className={styles.stageGlow} aria-hidden="true" />
        <img
          src={learner.introImageUrl}
          alt={learner.name}
          className={styles.stageAvatar}
          draggable={false}
        />

        <div className={styles.stageMeter} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={styles.stageMeterBar} data-bar={i} />
          ))}
        </div>
      </div>

      <div className={styles.stageChatToolbar}>
          <button
            type="button"
            className={styles.stageIconBtn}
            onClick={() => setCharacterMinimized((minimized) => !minimized)}
            aria-expanded={!characterMinimized}
            aria-controls={characterId}
            aria-label={characterMinimized ? 'Show character' : 'Minimize character'}
            title={characterMinimized ? 'Show character' : 'Minimize character'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={characterMinimized ? 'M12 5v14m-6-6 6 6 6-6' : 'M12 19V5m-6 6 6-6 6 6'} />
            </svg>
          </button>
      </div>

        <div className={styles.stageTranscript} ref={transcriptRef} onScroll={handleTranscriptScroll} role="log" aria-label={`Conversation with ${learner.name}`}>
          {messages.length === 0 ? (
            <p className={styles.chatSidebarEmpty}>Nothing said yet.</p>
          ) : (
            messages.map((m) => (
              <TranscriptBubble key={m.id} message={m} learnerName={learner.name} voice={voice} />
            ))
          )}
        </div>

      <div className={styles.chatSidebarInputRow}>
        <input
          className={styles.chatSidebarInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={`Say something to ${learner.name}...`}
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
