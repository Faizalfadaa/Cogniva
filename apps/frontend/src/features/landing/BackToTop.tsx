import { useEffect, useState } from 'react'
import styles from '../../styles/LandingPage.module.css'

/** How far down the page the button starts being useful. */
const SHOW_AFTER_PX = 400

/**
 * Floating "back to top" shortcut, bottom-right of the landing page.
 *
 * Stays mounted and fades out rather than unmounting, so appearing and
 * disappearing can both animate. The scroll listener is throttled with
 * requestAnimationFrame: scroll fires per pixel, and only one read per frame is
 * ever useful.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let frame = 0

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setVisible(window.scrollY > SHOW_AFTER_PX)
      })
    }

    // Run once on mount: the page may already be scrolled (reload, deep link).
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <button
      type="button"
      className={visible ? `${styles.backToTop} ${styles.backToTopIn}` : styles.backToTop}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      // Hidden from keyboard and screen readers while it is faded out, so it is
      // never a focus stop that does nothing visible.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <span aria-hidden="true">↑</span>
    </button>
  )
}
