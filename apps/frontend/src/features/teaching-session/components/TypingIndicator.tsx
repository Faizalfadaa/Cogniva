import { useT } from '../../../i18n/LanguageProvider'
import styles from '../../../styles/TeachingSession.module.css'

export function TypingIndicator({ name }: { name: string }) {
  const t = useT()
  return (
    <span className={styles.typingIndicator} role="status" aria-label={t('stage.typing', { name })}>
      <span aria-hidden="true" className={styles.typingDots}>
        <span /><span /><span />
      </span>
    </span>
  )
}
