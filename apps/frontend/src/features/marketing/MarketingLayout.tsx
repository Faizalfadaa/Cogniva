import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import styles from '../../styles/LandingPage.module.css'
import mk from './Marketing.module.css'
import { SignInContext } from './SignInContext'
import { BackToTop } from '../landing/BackToTop'
import { LoginScreen } from '../auth/LoginScreen'
import { useUserStore } from '../../state/UserStore'
import { useT } from '../../i18n/LanguageProvider'
import { LanguageToggle } from '../../i18n/LanguageToggle'
import type { MessageKey } from '../../i18n/messages'

/** Top-level pages, in reading order. */
const NAV: Array<{ to: string; label: MessageKey }> = [
  { to: '/product', label: 'landing.navHow' },
  { to: '/students', label: 'landing.navStudents' },
  { to: '/debrief', label: 'landing.navDebrief' },
  { to: '/technology', label: 'landing.navTechnology' },
  { to: '/pricing', label: 'landing.navPricing' },
  { to: '/about', label: 'landing.navAbout' },
]

/**
 * Footer site map. The first and last columns go to pages; the middle two keep
 * pointing at single questions on the front page's FAQ, which LandingPage opens
 * when it arrives with that hash.
 */
const FOOTER_GROUPS: Array<{ title: MessageKey; links: Array<{ label: MessageKey; to: string }> }> = [
  {
    title: 'landing.footerExplore',
    links: [
      { label: 'landing.navHow', to: '/product' },
      { label: 'landing.footerMeetStudents', to: '/students' },
      { label: 'landing.footerFeedback', to: '/debrief' },
      { label: 'landing.footerAccess', to: '/pricing' },
      { label: 'landing.footerAllQuestions', to: '/#faq' },
    ],
  },
  {
    title: 'landing.footerFirstSession',
    links: [
      { label: 'landing.footerGettingStarted', to: '/#faq-getting-started' },
      { label: 'landing.footerChooseStudent', to: '/#faq-choose-student' },
      { label: 'landing.footerPrepareRefs', to: '/#faq-reference-material' },
      { label: 'landing.footerBoardVoice', to: '/#faq-voice-and-board' },
      { label: 'landing.footerTeachButton', to: '/#faq-teach-button' },
    ],
  },
  {
    title: 'landing.footerKeepLearning',
    links: [
      { label: 'landing.footerGuestOrAccount', to: '/#faq-guest-and-account' },
      { label: 'landing.footerReadReport', to: '/#faq-session-report' },
      { label: 'landing.footerAnotherRound', to: '/#faq-continue-learning' },
      { label: 'landing.footerAiFeedback', to: '/#faq-ai-feedback' },
      { label: 'landing.footerPlanAvailability', to: '/#faq-plans-and-access' },
    ],
  },
  {
    title: 'landing.footerAboutCogniva',
    links: [
      { label: 'landing.footerApproach', to: '/about' },
      { label: 'landing.footerLbt', to: '/about#research' },
      { label: 'landing.footerWhoFor', to: '/#faq-who-is-it-for' },
      { label: 'landing.footerTeam', to: '/about#team' },
      { label: 'landing.navTechnology', to: '/technology' },
    ],
  },
]

/**
 * Frame for the public site: the landing page's nav, the current page, its
 * closing call to action and footer, and the one sign-in overlay every page
 * can open.
 *
 * Route changes start at the top of the new page; a link with a hash lands on
 * that section instead. The overlay is the same LoginScreen the dashboard uses,
 * and signing in from it goes straight to /home.
 */
export default function MarketingLayout() {
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const { login, register, continueAsGuest } = useUserStore()
  const [signInOpen, setSignInOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const openSignIn = useCallback(() => {
    setMenuOpen(false)
    setSignInOpen(true)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (target) {
        target.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [location.pathname, location.hash, location.key])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? styles.navLinkActive : undefined)

  return (
    <SignInContext.Provider value={openSignIn}>
      <div className={styles.page}>
        {/* ============ NAV ============ */}
        <header className={styles.nav}>
          <div className={styles.navInner}>
            <Link to="/" className={styles.brand}>
              <img src="/cogniva_logo.png" alt="" aria-hidden="true" className={styles.brandMarkImg} />
              <span className={styles.brandName}>Cogniva</span>
            </Link>
            <nav className={styles.navLinks}>
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={navClass}>
                  {t(item.label)}
                </NavLink>
              ))}
            </nav>
            <div className={styles.navActions}>
              {/* First thing on the page, so someone who reads Indonesian can
                  switch before reading anything else. */}
              <LanguageToggle />
              <button type="button" className={`${styles.btnLime} ${styles.navSignInBtn}`} onClick={openSignIn}>
                {t('auth.signIn')}
              </button>
              <button
                type="button"
                className={styles.menuToggle}
                aria-expanded={menuOpen}
                aria-controls="site-menu"
                aria-label={t(menuOpen ? 'landing.closeMenu' : 'landing.openMenu')}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav id="site-menu" className={styles.mobileMenu}>
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={navClass}>
                  {t(item.label)}
                </NavLink>
              ))}
              <button type="button" className={`${styles.btnLime} ${styles.mobileMenuCta}`} onClick={openSignIn}>
                {t('auth.signIn')}
              </button>
            </nav>
          )}
        </header>

        <main className={mk.root}>
          <Outlet />
        </main>

        {/* ============ CTA + FOOTER ============ */}
        <section className={styles.closing}>
          <div className={styles.container}>
            <div className={styles.closingCta}>
              <h2 className={styles.closingTitle}>{t('landing.closingTitle')}</h2>
              <p className={styles.closingLead}>{t('landing.closingLead')}</p>
              <button type="button" className={styles.btnLimeLarge} onClick={openSignIn}>
                {t('landing.startFree')}
              </button>
            </div>

            <div className={styles.footerRule} />

            <footer className={styles.footer} aria-label={t('landing.footerLabel')}>
              <div className={styles.footerBrand}>
                <Link to="/" className={styles.brand} aria-label={t('landing.footerHome')}>
                  <img src="/cogniva_logo.png" alt="" aria-hidden="true" className={styles.brandMarkImg} />
                  <span className={styles.brandNameOnDark}>Cogniva</span>
                </Link>
                <span className={styles.footerTagline}>{t('landing.tagline')}</span>
                <button type="button" className={styles.btnLime} onClick={openSignIn}>
                  {t('landing.startSession')}
                </button>
                <Link to="/home" className={styles.footerDashboard}>
                  {t('landing.goToDashboard')} →
                </Link>
              </div>
              <nav className={styles.footerCols} aria-label={t('landing.footerNavLabel')}>
                {FOOTER_GROUPS.map((group) => (
                  <div key={group.title} className={styles.footerCol}>
                    <h3 className={styles.footerColTitle}>{t(group.title)}</h3>
                    {group.links.map((link) => (
                      <Link key={link.to} to={link.to}>
                        {t(link.label)}
                      </Link>
                    ))}
                  </div>
                ))}
              </nav>
            </footer>

            <div className={styles.footerBottom}>
              <span className={styles.copyright}>
                {t('landing.copyright', { year: new Date().getFullYear() })}
              </span>
              <span className={styles.copyright}>{t('landing.motto')}</span>
            </div>
          </div>
        </section>

        <BackToTop />
      </div>

      {signInOpen && (
        <LoginScreen
          onLogin={async (username, password) => {
            await login(username, password)
            navigate('/home')
          }}
          onRegister={async (username, password) => {
            await register(username, password)
            navigate('/home')
          }}
          onGuest={() => {
            continueAsGuest()
            navigate('/home')
          }}
          onClose={() => setSignInOpen(false)}
        />
      )}
    </SignInContext.Provider>
  )
}
