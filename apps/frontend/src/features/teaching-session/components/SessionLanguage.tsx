import styles from '../../../styles/TeachingSession.module.css'
import { useT } from '../../../i18n/LanguageProvider'
import { LOCALES, LOCALE_LABELS, type Locale } from '../../../i18n/messages'

interface SessionLanguageProps {
  /** The language the workspace inherited when it was created. */
  current: Locale
  onChoose: (locale: Locale) => void
  /** True while the choice is being saved to the workspace. */
  saving?: boolean
}

/**
 * Asks which language this session runs in, once, before anything else.
 *
 * The switch in the header sets the reader's own language; this sets the
 * session's, which is a different and heavier choice: the student speaks in it,
 * the report is written in it, and it cannot be changed once teaching starts.
 * Asking it here, in a dialog with both languages written out, is the one
 * moment where that choice is actually being made.
 *
 * Built from the character picker's scrim and panel so the two dialogs read as
 * one sequence: language, then student, then the introduction.
 */
export function SessionLanguage({ current, onChoose, saving = false }: SessionLanguageProps) {
  const t = useT()

  return (
    <div
      className={styles.selectOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('sessionLang.dialog')}
    >
      <div className={styles.selectPanel}>
        <h2 className={styles.selectTitle}>{t('sessionLang.title')}</h2>
        <p className={styles.selectSubtitle}>{t('sessionLang.subtitle')}</p>

        <div className={styles.langGrid}>
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              className={code === current ? styles.langCardCurrent : styles.langCard}
              onClick={() => onChoose(code)}
              disabled={saving}
            >
              <span className={styles.langCode}>{code.toUpperCase()}</span>
              <span className={styles.langName}>{LOCALE_LABELS[code]}</span>
              {code === current && (
                <span className={styles.langCurrent}>{t('sessionLang.current')}</span>
              )}
            </button>
          ))}
        </div>

        <p className={styles.langNote}>
          {saving ? t('sessionLang.saving') : `${t('sessionLang.note')} ${t('sessionLang.voiceNote')}`}
        </p>
      </div>
    </div>
  )
}
