import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from '../../styles/HomePage.module.css'
import { useT } from '../../i18n/LanguageProvider'
import type { MessageKey } from '../../i18n/messages'

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
  title: MessageKey
  body: MessageKey
  cta: MessageKey
}

const STEPS: Step[] = [
  {
    icon: IconBoard,
    title: 'onb.step1Title',
    body: 'onb.step1Body',
    cta: 'onb.step1Cta',
  },
  {
    icon: IconStudent,
    title: 'onb.step2Title',
    body: 'onb.step2Body',
    cta: 'onb.step2Cta',
  },
  {
    icon: IconReport,
    title: 'onb.step3Title',
    body: 'onb.step3Body',
    cta: 'onb.step3Cta',
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
  const t = useT()
  const canGoBack = step > 0
  return (
    <div className={styles.onbNav}>
      {canGoBack && (
        <button className={styles.modalBtnGhost} onClick={onBack}>
          ← {t('onb.back')}
        </button>
      )}
      {onSkip && (
        <button className={styles.modalBtnGhost} onClick={onSkip}>
          {t('onb.skip')}
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
  const t = useT()

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
            <h2 id="onboarding-title" className={styles.modalTitle}>{t('home.askName')}</h2>
            <p className={styles.modalBody}>{t('onb.nameBody')}</p>
            <input
              ref={inputRef}
              className={styles.modalInput}
              type="text"
              placeholder={t('home.yourName')}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={40}
              aria-label={t('home.yourNameLabel')}
            />
            <button className={styles.modalBtn} onClick={handleSubmit} disabled={!name.trim()}>
              {t('onb.enter')} →
            </button>
            <BackRow step={step} onBack={() => setStep(step - 1)} />
          </>
        ) : (
          <>
            <div className={styles.onbIcon}>{STEPS[step].icon()}</div>
            <h2 id="onboarding-title" className={styles.modalTitle}>{t(STEPS[step].title)}</h2>
            <p className={styles.onbBody}>{t(STEPS[step].body)}</p>
            <button className={styles.modalBtn} onClick={() => setStep(step + 1)}>
              {t(STEPS[step].cta)} →
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
