import { useState } from 'react'
import styles from './Marketing.module.css'

export interface FaqItem {
  q: string
  a: string
}

/**
 * Accordion of questions, first one open.
 *
 * Each question is a real button with aria-expanded, and each answer a region
 * labelled by it, so the list works from the keyboard and reads correctly to a
 * screen reader. `idPrefix` keeps ids unique when two lists share a page.
 */
export function Faq({ items, idPrefix }: { items: FaqItem[]; idPrefix: string }) {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className={styles.faqList}>
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.q} className={isOpen ? `${styles.faqItem} ${styles.faqItemOpen}` : styles.faqItem}>
            <button
              type="button"
              id={`${idPrefix}-q-${i}`}
              className={styles.faqQ}
              aria-expanded={isOpen}
              aria-controls={`${idPrefix}-a-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span className={styles.faqQText}>{item.q}</span>
              <span className={styles.faqChevron} aria-hidden="true">
                ⌄
              </span>
            </button>
            <div id={`${idPrefix}-a-${i}`} role="region" aria-labelledby={`${idPrefix}-q-${i}`} hidden={!isOpen}>
              <p className={styles.faqA}>{item.a}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
