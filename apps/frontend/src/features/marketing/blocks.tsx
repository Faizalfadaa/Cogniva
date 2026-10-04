import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import styles from './Marketing.module.css'

/** Minimum column width for a `.grid`, read by its auto-fit template. */
export function minCol(px: number): CSSProperties {
  return { '--min': `${px}px` } as CSSProperties
}

interface PageHeroProps {
  eyebrow: string
  title: string
  lead: string
  links: Array<{ href: string; label: string }>
  dark?: boolean
}

/** Top of every inner page: title and lead, with jump links to its sections. */
export function PageHero({ eyebrow, title, lead, links, dark = false }: PageHeroProps) {
  return (
    <section className={dark ? `${styles.bgForest} ${styles.onDark}` : styles.bgCream}>
      <div className={styles.pageHero}>
        <div className={styles.pageHeroMain}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 className={styles.h1}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </div>
        <nav className={styles.jumpLinks} aria-label={eyebrow}>
          {links.map((link) => (
            <a key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  )
}

interface SectionHeadProps {
  eyebrow: string
  title: string
  aside?: string
  link?: { to: string; label: string }
  large?: boolean
}

/**
 * Eyebrow and heading, with either a short paragraph or a link on the right.
 * With neither, the two stack on their own.
 */
export function SectionHead({ eyebrow, title, aside, link, large = false }: SectionHeadProps) {
  const heading = large ? `${styles.h2} ${styles.h2Lg}` : styles.h2

  if (!aside && !link) {
    return (
      <div className={styles.headStack}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2 className={heading}>{title}</h2>
      </div>
    )
  }

  return (
    <div className={styles.head}>
      <div className={styles.headMain}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2 className={heading}>{title}</h2>
      </div>
      {aside && <p className={`${styles.text} ${styles.headAside}`}>{aside}</p>}
      {link && (
        <Link to={link.to} className={styles.link}>
          {link.label}
        </Link>
      )}
    </div>
  )
}
