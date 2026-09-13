import { useEffect, useState } from 'react'
import styles from '../../../styles/TeachingSession.module.css'
import type { LearnerCharacter } from '../../../lib/Learner'
import type { LearnerSpeechDTO } from '../../../dto/LearnerSpeechDTO'
import { spokenText, useLearnerVoice, useUtteranceProgress } from '../hooks/useLearnerVoice'
import { useT } from '../../../i18n/LanguageProvider'

interface LearnerResponseBubbleProps {
  learner: LearnerCharacter
  text?: string
  pending: boolean
  checkpointId?: string
  /** Legacy single clip, for checkpoints recorded before per-sentence speech. */
  audioUrl?: string
  /** The reply as per-sentence speech; its text is revealed as each sentence plays. */
  speech?: LearnerSpeechDTO
}

/** How long the card stays once the whole line has been said. */
const AUTO_DISMISS_MS = 5000

export function LearnerResponseBubble({
  learner,
  text,
  pending,
  checkpointId,
  audioUrl,
  speech,
}: LearnerResponseBubbleProps) {
  const [dismissed, setDismissed] = useState(false)
  const voice = useLearnerVoice()
  const progress = useUtteranceProgress(speech)
  const t = useT()

  // Hand the reply to the player on every poll. It speaks each reply once, and
  // the chat stage shares the same speech id, so the line is never heard twice.
  useEffect(() => {
    if (speech) voice.speak(speech)
  }, [speech, voice.speak]) // eslint-disable-line react-hooks/exhaustive-deps

  // Legacy single clip. Dismissing the bubble does not stop playback — the line
  // is worth hearing out even after the card disappears.
  useEffect(() => {
    if (!speech) voice.autoPlay(audioUrl)
  }, [audioUrl, speech, voice.autoPlay]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDismissed(false)
  }, [checkpointId])

  // Count down only after the whole line has been said: a card that vanished
  // mid-sentence would take the rest of the words with it.
  const lineDone = !pending && Boolean(text) && (!speech || progress?.phase === 'done')
  useEffect(() => {
    if (!checkpointId || !lineDone) return
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [checkpointId, lineDone])

  if (dismissed || (!pending && !text)) return null

  const waiting = pending || progress?.phase === 'waiting'
  const clips = !voice.available
    ? []
    : speech
      ? speech.segments.flatMap((segment) => (segment.audioUrl ? [segment.audioUrl] : []))
      : audioUrl
        ? [audioUrl]
        : []
  const speaking = voice.playingUrl !== null && clips.includes(voice.playingUrl)

  function replayOrStop() {
    if (speaking) voice.stop()
    else if (speech) voice.replay(speech)
    else if (clips[0]) voice.play(clips[0])
  }

  return (
    <div className={styles.notifStack} style={{ pointerEvents: 'none' }}>
      <div className={styles.notifToast} style={{ pointerEvents: 'all' }}>
        <img src={learner.avatarUrl} alt={learner.name} className={styles.notifAvatar} />
        <div className={styles.notifBody}>
          <span className={styles.notifName}>
            {learner.name}
            {!waiting && clips.length > 0 && (
              <button
                className={styles.notifSpeak}
                onClick={replayOrStop}
                aria-label={
                  speaking
                    ? t('stage.stopPlayback')
                    : t('stage.replayVoice', { name: learner.name })
                }
                title={speaking ? t('stage.stop') : t('stage.replay')}
              >
                {speaking ? '◼' : '▶'}
              </button>
            )}
          </span>
          <p className={styles.notifText} aria-live="polite">
            {waiting ? '...' : spokenText(text ?? '', speech, progress)}
          </p>
        </div>
        <button
          className={styles.notifClose}
          onClick={() => setDismissed(true)}
          aria-label={t('stage.closeResponse')}
        >
          ×
        </button>
      </div>
    </div>
  )
}
