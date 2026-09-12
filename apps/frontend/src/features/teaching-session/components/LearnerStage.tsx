import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const STAGE_MIN_PX = 300
const STAGE_MAX_RATIO = 0.5 // at most half the canvas
const STAGE_DEFAULT_PX = 360

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
      {waiting ? '…' : spokenText(message.content, message.speech, progress)}
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
 * The learner as a presence rather than a chat log.
 *
 * The character stands on stage and moves with their own voice: `useVoiceLevel`
 * writes the live amplitude into `--voice-level`, and the CSS drives every
 * motion from that one number. Nothing here is a canned animation on a timer —
 * when the audio is quiet the avatar is still, and it settles the moment the
 * clip ends.
 *
 * A reply is spoken one sentence at a time, and its words appear as they are
 * said: the line holds a thinking mark until the first clip starts, then grows a
 * sentence per clip. Only the current line is shown. The full transcript is
 * still one click away, because losing the ability to re-read what was said
 * would be a regression, not a simplification.
 */
export function LearnerStage({
  learner,
  messages,
  isOpen,
  onToggle,
  onSend,
}: LearnerStageProps) {
  const [width, setWidth] = useState(STAGE_DEFAULT_PX)
  const [draft, setDraft] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const seededRef = useRef(false)

  const voice = useLearnerVoice()
  const t = useT()
  // Amplitude lands on the stage element; every moving part reads it from there.
  useVoiceLevel(stageRef)

  const latestLearnerLine = useMemo(
    () => [...messages].reverse().find((m) => m.sender === 'learner'),
    [messages],
  )
  const latestProgress = useUtteranceProgress(latestLearnerLine?.speech)
  const speaking = isSpeaking(latestLearnerLine, voice.playingUrl)
  const waitingForVoice = latestProgress?.phase === 'waiting'

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

  useEffect(() => {
    if (!showTranscript) return
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [showTranscript, messages])

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
        <span className={styles.stageName}>{learner.name}</span>
        <div className={styles.stageHeaderActions}>
          <button
            className={showTranscript ? styles.stageIconBtnOn : styles.stageIconBtn}
            onClick={() => setShowTranscript((open) => !open)}
            aria-pressed={showTranscript}
            aria-label={showTranscript ? t('stage.hideTranscript') : t('stage.showTranscript')}
            title={showTranscript ? t('stage.hideTranscript') : t('stage.showTranscript')}
          >
            ☰
          </button>
          <button
            className={styles.stageIconBtn}
            onClick={onToggle}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            ×
          </button>
        </div>
      </div>

      {/* Everything below reads --voice-level, set on this node each frame. */}
      <div
        ref={stageRef}
        className={`${styles.stageBody} ${speaking ? styles.stageBodySpeaking : ''}`}
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

      {latestLearnerLine ? (
        <div className={styles.stageLine}>
          <p className={styles.stageLineText} aria-live="polite">
            {waitingForVoice
              ? '…'
              : spokenText(latestLearnerLine.content, latestLearnerLine.speech, latestProgress)}
          </p>
          {!waitingForVoice && hasAudio(latestLearnerLine, voice) && (
            <button
              className={styles.stageReplay}
              onClick={() => replayOrStop(latestLearnerLine, speaking, voice)}
              aria-label={
                speaking ? t('stage.stopPlayback') : t('stage.replayVoice', { name: learner.name })
              }
            >
              {speaking ? `◼ ${t('stage.stop')}` : `▶ ${t('stage.replay')}`}
            </button>
          )}
        </div>
      ) : (
        <p className={styles.stageIdle}>{t('stage.idle', { name: learner.name })}</p>
      )}

      {showTranscript && (
        <div className={styles.stageTranscript} ref={transcriptRef}>
          {messages.length === 0 ? (
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
        </div>
      )}

      <div className={styles.chatSidebarInputRow}>
        <input
          className={styles.chatSidebarInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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
