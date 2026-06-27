import styles from '../../../styles/TeachingSession.module.css'

interface TeachButtonProps {
  mode: 'editing' | 'locked'
  pending: boolean
  onTeach: () => void
  onContinueEditing: () => void
}

export function TeachButton({ mode, pending, onTeach, onContinueEditing }: TeachButtonProps) {
  if (mode === 'editing') {
    return (
      <button className={styles.teachBtn} onClick={onTeach}>
        Teach ↗
      </button>
    )
  }

  if (pending) {
    return (
      <button className={styles.teachBtn} disabled>
        Thinking...
      </button>
    )
  }

  return (
    <button className={styles.outlineBtn} onClick={onContinueEditing}>
      Continue editing
    </button>
  )
}