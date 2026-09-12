import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/TeachingSession.module.css'

interface TeachButtonProps {
  mode: 'editing' | 'locked'
  pending: boolean
  onTeach: () => void
  onContinueEditing: () => void
}

export function TeachButton({ mode, pending, onTeach, onContinueEditing }: TeachButtonProps) {
  const t = useT()

  if (mode === 'editing') {
    return (
      <button data-tour="teach-button" className={styles.teachBtn} onClick={onTeach}>
        {t('header.teach')} ↗
      </button>
    )
  }

  if (pending) {
    return (
      <button data-tour="teach-button" className={styles.teachBtn} disabled>
        {t('header.thinking')}
      </button>
    )
  }

  return (
    <button data-tour="teach-button" className={styles.outlineBtn} onClick={onContinueEditing}>
      {t('header.continueEditing')}
    </button>
  )
}