import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from '../../styles/HomePage.module.css'

// ─── Step illustrations ──────────────────────────────────────────────────────

function IconBoard() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="22" height="15" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 9.5h9M8 13.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 19v5M10.5 24h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconStudent() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 24c0-4.4 3.8-7 8.5-7s8.5 2.6 8.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20.5 5.5v3M19 7h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconReport() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M6 4.5h11l5 5V23a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 5 23V6a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16.5 4.5v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 14.5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Steps ───────────────────────────────────────────────────────────────────

interface Step {
  icon: () => ReactNode
  title: string
  body: string
  cta: string
}

const STEPS: Step[] = [
  {
    icon: IconBoard,
    title: 'Here, you are the teacher',
    body:
      'Cogniva flips the classroom. Instead of re-reading your notes, you explain the topic in your own words — and the parts you only half-understand show up immediately.',
    cta: 'How does it work?',
  },
  {
    icon: IconStudent,
    title: 'Teach an AI student',
    body:
      'Open a workspace, write or draw your material on the whiteboard, then teach. Your AI student follows along and asks questions whenever something does not click.',
    cta: 'And after that?',
  },
  {
    icon: IconReport,
    title: 'Finish with a report',
    body:
      'End the session and Cogniva evaluates your explanation: what landed clearly, what stayed fuzzy, and which parts are worth reviewing again.',
    cta: "Got it, let's start",
  },
]

// ─── Footer nav ──────────────────────────────────────────────────────────────
// Back is available on every step except the first, where there is nothing to
// go back to — the row then holds Skip alone so the layout height stays stable.

function BackRow({
  step,
  onBack,
  onSkip,
}: {
  step: number
  onBack: () => void
  onSkip?: () => void
}) {
  const canGoBack = step > 0
  return (
    <div className={styles.onbNav}>
      {canGoBack && (
        <button className={styles.modalBtnGhost} onClick={onBack}>
          ← Back
        </button>
      )}
      {onSkip && (
        <button className={styles.modalBtnGhost} onClick={onSkip}>
          Skip intro
        </button>
      )}
    </div>
  )
}

// ─── Onboarding flow ─────────────────────────────────────────────────────────
// Steps 0..n-1 explain the product; the final step asks for the name.
// Shown only while no name is stored, so it never repeats for returning users.

export default function Onboarding({ onDone }: { onDone: (name: string) => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isNameStep = step === STEPS.length
  const totalSteps = STEPS.length + 1

  useEffect(() => {
    if (isNameStep) inputRef.current?.focus()
  }, [isNameStep])

  function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onDone(trimmed)
  }

  return (
    <div className={styles.modalOverlay}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className={styles.onbDots} aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={`${styles.onbDot} ${i === step ? styles.onbDotActive : ''}`}
            />
          ))}
        </div>

        {isNameStep ? (
          <>
            <div className={styles.modalMark}>✦</div>
            <h2 id="onboarding-title" className={styles.modalTitle}>Hey, what's your name?</h2>
            <p className={styles.modalBody}>
              Your AI student will call you by this name throughout the session.
            </p>
            <input
              ref={inputRef}
              className={styles.modalInput}
              type="text"
              placeholder="Your name..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={40}
              aria-label="Your name"
            />
            <button className={styles.modalBtn} onClick={handleSubmit} disabled={!name.trim()}>
              Enter Cogniva →
            </button>
            <BackRow step={step} onBack={() => setStep(step - 1)} />
          </>
        ) : (
          <>
            <div className={styles.onbIcon}>{STEPS[step].icon()}</div>
            <h2 id="onboarding-title" className={styles.modalTitle}>{STEPS[step].title}</h2>
            <p className={styles.onbBody}>{STEPS[step].body}</p>
            <button className={styles.modalBtn} onClick={() => setStep(step + 1)}>
              {STEPS[step].cta} →
            </button>
            <BackRow
              step={step}
              onBack={() => setStep(step - 1)}
              onSkip={() => setStep(STEPS.length)}
            />
          </>
        )}
      </div>
    </div>
  )
}
