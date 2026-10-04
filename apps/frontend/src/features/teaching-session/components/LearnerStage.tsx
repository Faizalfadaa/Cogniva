import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
import { useT, type Translate } from '../../../i18n/LanguageProvider'
import { TypingIndicator } from './TypingIndicator'

const STAGE_MIN_PX = 300
const STAGE_MAX_RATIO = 0.5 // at most half the canvas
const STAGE_DEFAULT_PX = 360
const SCROLL_BOTTOM_THRESHOLD_PX = 48

interface LearnerStageProps {
  learner: LearnerCharacter
  messages: ChatMessageDTO[]
  isOpen: boolean
  isTyping?: boolean
  onToggle: () => void
  onSend: (content: string) => void
}

/** Whether one of this message's clips is the one playing right now. */
function isSpeaking(message: ChatMessageDTO | undefined, playingUrl: string | null): boolean {
  if (!message || !playingUrl) return false
  if (message.speech) return message.speech.segments.some((s) => s.audioUrl === playingUrl)
  return message.learnerAudioUrl === playingUrl
}

/** Availability is passed in: "this language has no voice" is not a fact about the message. */
function hasAudio(message: ChatMessageDTO, voice: LearnerVoice): boolean {
  if (!voice.available) return false
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
  t,
}: {
  message: ChatMessageDTO
  learnerName: string
  voice: LearnerVoice
  t: Translate
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
      {waiting ? <TypingIndicator name={learnerName} /> : spokenText(message.content, message.speech, progress)}
      {!waiting && hasAudio(message, voice) && (
        <button
          className={styles.chatBubbleSpeak}
          onClick={() => replayOrStop(message, speaking, voice)}
          aria-label={t('stage.playVoice', { name: learnerName })}
        >
          {speaking ? '◼' : '▶'}
        </button>
      )}
    </div>
  )
}

/**
 * Character portrait above a permanently visible conversation.
 *
 * The character stands on stage and moves with their own voice: `useVoiceLevel`
 * writes the live amplitude into `--voice-level`, and the CSS drives every
 * motion from that one number. Nothing here is a canned animation on a timer —
 * when the audio is quiet the avatar is still, and it settles the moment the
 * clip ends.
 *
 * A reply is spoken one sentence at a time, and its words appear as they are
 * said: a bubble holds a thinking mark until the first clip starts, then grows a
 * sentence per clip. With no voice for this language there is nothing to wait
 * for and every reply simply arrives whole.
 */
export function LearnerStage({
  learner,
  messages,
  isOpen,
  isTyping = false,
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
  const draftRef = useRef<HTMLTextAreaElement>(null)

  // The box grows with what is typed, up to the cap in the stylesheet, so a
  // long message wraps downward where it can be read instead of scrolling
  // sideways out of view. Re-measured when the panel opens or is dragged wider
  // or narrower, since either one rewraps the same text.
  useLayoutEffect(() => {
    const box = draftRef.current
    if (!box) return
    box.style.height = 'auto'
    const border = box.offsetHeight - box.clientHeight
    box.style.height = `${box.scrollHeight + border}px`
  }, [draft, isOpen, width])

  const voice = useLearnerVoice()
  const t = useT()
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

  // Polling creates a new array even when nothing visible has changed. Speech is
  // part of the signature because a bubble grows a sentence at a time, and the
  // transcript has to keep following it down.
  const transcriptVersion = useMemo(
    () =>
      JSON.stringify(
        messages.map(({ id, content, learnerAudioUrl, speech }) => [
          id,
          content,
          learnerAudioUrl,
          speech?.status,
          speech?.segments.length,
        ]),
      ),
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
  }, [isOpen, transcriptVersion, characterMinimized, isTyping])

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
      transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop <=
      SCROLL_BOTTOM_THRESHOLD_PX
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
        <button
          type="button"
          className={styles.stageIdentity}
          onClick={() => setCharacterMinimized((minimized) => !minimized)}
          aria-expanded={!characterMinimized}
          aria-controls={characterId}
          aria-label={
            characterMinimized ? t('stage.showCharacter') : t('stage.minimizeCharacter')
          }
          title={characterMinimized ? t('stage.showCharacter') : t('stage.minimizeCharacter')}
        >
          <img src={learner.avatarUrl} alt="" className={styles.stageHeaderAvatar} />
          <span className={styles.stageName}>{learner.name}</span>
        </button>
        <div className={styles.stageHeaderActions}>
          <button
            type="button"
            className={styles.stageIconBtn}
            onClick={onToggle}
            aria-label={t('stage.closeChat')}
            title={t('stage.closeChat')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
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

      <div
        className={styles.stageTranscript}
        ref={transcriptRef}
        onScroll={handleTranscriptScroll}
        role="log"
        aria-label={t('stage.conversationWith', { name: learner.name })}
      >
        {messages.length === 0 && !isTyping ? (
          <p className={styles.chatSidebarEmpty}>{t('stage.nothingSaid')}</p>
        ) : (
          messages.map((m) => (
            <TranscriptBubble
              key={m.id}
              message={m}
              learnerName={learner.name}
              voice={voice}
              t={t}
            />
          ))
        )}
        {isTyping && (
          <div className={`${styles.chatBubble} ${styles.chatBubbleLearner}`}>
            <TypingIndicator name={learner.name} />
          </div>
        )}
      </div>

      <div className={styles.chatSidebarInputRow}>
        <textarea
          ref={draftRef}
          className={styles.chatSidebarInput}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends and Shift+Enter breaks the line, as in any chat. Not
            // while an IME is composing: that Enter picks a candidate word.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={t('stage.say', { name: learner.name })}
          aria-label={t('stage.writeMessage')}
        />
        <button
          className={styles.chatSidebarSend}
          onClick={handleSubmit}
          disabled={!draft.trim()}
          aria-label={t('common.send')}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
