import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from '../../styles/LandingPage.module.css'
import { LEARNERS, learnerCopy } from '../../lib/Learner'
import { LoginScreen } from '../auth/LoginScreen'
import { useUserStore } from '../../state/UserStore'
import { TeamSlider } from './TeamSlider'
import { BackToTop } from './BackToTop'
import { useLocale, useT, type Translate } from '../../i18n/LanguageProvider'
import { LanguageToggle } from '../../i18n/LanguageToggle'
import type { MessageKey } from '../../i18n/messages'

/**
 * Fade-and-lift sections in as they scroll into view.
 *
 * Native IntersectionObserver plus a class toggle, no animation library: the
 * transition itself lives in CSS, this only decides when to add the class.
 * Reveals once and then stops observing, so scrolling back up does not replay
 * it. Anyone who asked for reduced motion gets the end state immediately (see
 * the media query in the stylesheet).
 */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  return { ref, className: shown ? `${styles.reveal} ${styles.revealIn}` : styles.reveal }
}

/** Dashboard destination for returning users. */
const APP_ENTRY = '/home'

interface Step {
  num: string
  title: MessageKey
  body: (t: Translate) => ReactNode
}

const STEPS: Step[] = [
  {
    num: '01',
    title: 'landing.step1Title',
    body: (t) => t('landing.step1Body'),
  },
  {
    num: '02',
    title: 'landing.step2Title',
    body: (t) => (
      <>
        {t('landing.step2BodyA')}
        <strong> {t('header.teach')}</strong> {t('landing.step2BodyB')}
      </>
    ),
  },
  {
    num: '03',
    title: 'landing.step3Title',
    body: (t) => t('landing.step3Body'),
  },
  {
    num: '04',
    title: 'landing.step4Title',
    body: (t) => (
      <>
        {t('landing.step4BodyA')}
        <em> {t('evaluation.learned').toLowerCase()}</em> {t('landing.step4BodyB')}{' '}
        <em>{t('evaluation.stillConfused').toLowerCase()}</em> {t('landing.step4BodyC')}
      </>
    ),
  },
]

/** The people who built it. No portraits exist, so every card keeps the
 *  hatch-pattern placeholder rather than inventing a face. */
const TEAM = [
  'Fauzan Mohamad Abdul Ghani',
  'Tengku Naufal Saqib',
  'Muhammad Ashkar',
  'Rhenaldy Cahyadi Putra',
  'Almer Zain Farisseno',
  'Fayyaz Akmal Lauda',
  'Muhammad Faiz Alfada Dharma',
  'Muh. Hartawan Haidir',
]

/**
 * Question and answer pairs for the FAQ accordion.
 *
 * The ids are anchors, not copy: the footer and the Sekolah card both link to a
 * single row by id and open it, so they stay in English however the page reads.
 */
const FAQS: Array<{ id: string; q: MessageKey; a: MessageKey }> = [
  { id: 'what-is-cogniva', q: 'landing.faqWhatQ', a: 'landing.faqWhatA' },
  { id: 'who-is-it-for', q: 'landing.faqWhoQ', a: 'landing.faqWhoA' },
  { id: 'getting-started', q: 'landing.faqStartQ', a: 'landing.faqStartA' },
  { id: 'guest-and-account', q: 'landing.faqGuestQ', a: 'landing.faqGuestA' },
  { id: 'choose-student', q: 'landing.faqStudentQ', a: 'landing.faqStudentA' },
  { id: 'reference-material', q: 'landing.faqPdfQ', a: 'landing.faqPdfA' },
  { id: 'voice-and-board', q: 'landing.faqVoiceQ', a: 'landing.faqVoiceA' },
  { id: 'teach-button', q: 'landing.faqTeachQ', a: 'landing.faqTeachA' },
  { id: 'session-report', q: 'landing.faqReportQ', a: 'landing.faqReportA' },
  { id: 'continue-learning', q: 'landing.faqAgainQ', a: 'landing.faqAgainA' },
  { id: 'ai-feedback', q: 'landing.faqGradeQ', a: 'landing.faqGradeA' },
  { id: 'plans-and-access', q: 'landing.faqPlansQ', a: 'landing.faqPlansA' },
]

/** One FAQ row takes an interpolation; the rest are plain. */
const FAQ_VALUES: Partial<Record<MessageKey, Record<string, string>>> = {
  'landing.faqStudentA': { names: LEARNERS.map((student) => student.name).join(', ') },
}

const FOOTER_GROUPS: Array<{
  title: MessageKey
  links: Array<{ label: MessageKey; target: string }>
}> = [
  {
    title: 'landing.footerExplore',
    links: [
      { label: 'landing.navHow', target: 'how' },
      { label: 'landing.footerMeetStudents', target: 'students' },
      { label: 'landing.footerFeedback', target: 'feedback' },
      { label: 'landing.footerAccess', target: 'pricing' },
      { label: 'landing.footerAllQuestions', target: 'faq' },
    ],
  },
  {
    title: 'landing.footerFirstSession',
    links: [
      { label: 'landing.footerGettingStarted', target: 'faq-getting-started' },
      { label: 'landing.footerChooseStudent', target: 'faq-choose-student' },
      { label: 'landing.footerPrepareRefs', target: 'faq-reference-material' },
      { label: 'landing.footerBoardVoice', target: 'faq-voice-and-board' },
      { label: 'landing.footerTeachButton', target: 'faq-teach-button' },
    ],
  },
  {
    title: 'landing.footerKeepLearning',
    links: [
      { label: 'landing.footerGuestOrAccount', target: 'faq-guest-and-account' },
      { label: 'landing.footerReadReport', target: 'faq-session-report' },
      { label: 'landing.footerAnotherRound', target: 'faq-continue-learning' },
      { label: 'landing.footerAiFeedback', target: 'faq-ai-feedback' },
      { label: 'landing.footerPlanAvailability', target: 'faq-plans-and-access' },
    ],
  },
  {
    title: 'landing.footerAboutCogniva',
    links: [
      { label: 'landing.footerApproach', target: 'about' },
      { label: 'landing.footerLbt', target: 'faq-what-is-cogniva' },
      { label: 'landing.footerWhoFor', target: 'faq-who-is-it-for' },
      { label: 'landing.footerTeam', target: 'team' },
      { label: 'landing.backToTop', target: 'top' },
    ],
  },
]

/** Feature bullet marker. `on={false}` renders the muted "not included" dash. */
function Tick({ on = true, dark = false }: { on?: boolean; dark?: boolean }) {
  if (dark) return <span className={styles.tickDark}>✓</span>
  return <span className={on ? styles.tick : styles.tickOff}>{on ? '✓' : '–'}</span>
}

export default function LandingPage() {
  const t = useT()
  const { locale } = useLocale()
  const [annual, setAnnual] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const navigate = useNavigate()
  const { login, register, continueAsGuest } = useUserStore()
  /** Index of the open FAQ row, or null when all are collapsed. */
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const howReveal = useReveal<HTMLDivElement>()
  const studentsReveal = useReveal<HTMLDivElement>()
  const faqReveal = useReveal<HTMLDivElement>()
  const teamReveal = useReveal<HTMLDivElement>()

  const senseiPrice = annual ? '39.000' : '49.000'
  const senseiNote = annual ? t('landing.proposedAnnual') : t('landing.proposedMonthly')
  const schoolPrice = annual ? '19.000' : '24.000'

  return (
    <div className={styles.page}>
      {/* ============ NAV ============ */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <a href="#top" className={styles.brand}>
            <img src="/cogniva_logo.png" alt="" aria-hidden="true" className={styles.brandMarkImg} />
            <span className={styles.brandName}>Cogniva</span>
          </a>
          <nav className={styles.navLinks}>
            <a href="#how">{t('landing.navHow')}</a>
            <a href="#students">{t('landing.navStudents')}</a>
            <a href="#pricing">{t('landing.navPricing')}</a>
            <a href="#faq">{t('landing.navFaq')}</a>
            <a href="#about">{t('landing.navAbout')}</a>
          </nav>
          <div className={styles.navActions}>
            {/* First thing on the page, so someone who reads Indonesian can
                switch before reading anything else. */}
            <LanguageToggle />
            <button
              type="button"
              className={styles.btnLime}
              onClick={() => setSignInOpen(true)}
            >
              {t('auth.signIn')}
            </button>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section id="top" className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              {t('landing.heroTitle1')}
              <br />
              {t('landing.heroTitle2')}
            </h1>
            <p className={styles.heroLead}>{t('landing.heroLead')}</p>
            <div className={styles.heroCtas}>
              <Link to={APP_ENTRY} className={styles.btnLimeLarge}>
                {t('landing.heroCta')} →
              </Link>
              <a href="#how" className={styles.btnGhost}>
                {t('landing.heroSecondary')}
              </a>
            </div>
            <div className={styles.heroNotes}>
              <span>{t('landing.note1')}</span>
              <span>{t('landing.note2')}</span>
              <span>{t('landing.note3')}</span>
            </div>
          </div>

          {/* App preview — CSS-only, exactly as the mockup drew it. No screenshot asset. */}
          <div className={styles.heroPreviewWrap}>
            <div className={styles.preview}>
              <div className={styles.previewTitlebar}>
                <span className={styles.previewBack}>←</span>
                <span className={styles.previewTopic}>{t('landing.previewTopic')}</span>
                <span className={styles.previewSavedDot} />
                <span className={styles.previewSaved}>{t('common.saved')}</span>
              </div>
              <div className={styles.previewToolbar}>
                <span className={styles.previewChip}>biology-ch4.pdf</span>
                <div className={styles.previewSpacer} />
                <div className={styles.thinking}>
                  <span className={styles.thinkingLabel}>{t('landing.previewThinking')}</span>
                  <span className={styles.dots}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </span>
                </div>
              </div>
              <div className={styles.previewBody}>
                <div className={styles.previewCanvas}>
                  <div className={styles.previewCanvasInner}>
                    <span>
                      {t('landing.previewCanvas')}
                      <br />
                      {t('landing.previewCanvas2')}
                    </span>
                  </div>
                </div>
                <div className={styles.previewSide}>
                  <div className={styles.avatarStage}>
                    <span className={styles.ring} />
                    <span className={`${styles.ring} ${styles.ringDelayed}`} />
                    <img
                      src="/assets/avatars/yuzuki.png"
                      alt="Yuzuki"
                      className={styles.avatarBlob}
                    />
                  </div>
                  <span className={styles.previewSideTitle}>{t('landing.previewReading')}</span>
                  <span className={styles.previewSideNote}>{t('landing.previewNote')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className={styles.how}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionHeadMain}>
              <span className={styles.eyebrow}>{t('landing.howEyebrow')}</span>
              <h2 className={styles.h2}>{t('landing.howTitle')}</h2>
            </div>
            <p className={styles.sectionHeadAside}>{t('landing.howAside')}</p>
          </div>

          <div ref={howReveal.ref} className={`${styles.stepGrid} ${howReveal.className}`}>
            {STEPS.map((step) => (
              <div
                key={step.num}
                className={styles.stepCard}
              >
                <span className={styles.stepNum}>{step.num}</span>
                <h3 className={styles.stepTitle}>{t(step.title)}</h3>
                <p className={styles.stepBody}>{step.body(t)}</p>
              </div>
            ))}
          </div>

          <div id="feedback" className={styles.letterRow}>
            <div className={styles.letterCard}>
              <span className={styles.letterKicker}>{t('landing.letterKicker')}</span>
              <p className={styles.letterQuote}>{t('landing.letterQuote')}</p>
              <span className={styles.letterBy}>{t('landing.letterBy')}</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{LEARNERS.length}</span>
                <span className={styles.statLabel}>{t('landing.stat1')}</span>
              </div>
              <div className={styles.statRule} />
              <div className={styles.stat}>
                <span className={styles.statNum}>1</span>
                <span className={styles.statLabel}>{t('landing.stat2')}</span>
              </div>
              <div className={styles.statRule} />
              <div className={styles.stat}>
                <span className={styles.statNum}>4</span>
                <span className={styles.statLabel}>{t('landing.stat3')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STUDENTS ============ */}
      <section id="students" className={styles.students}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionHeadMain}>
              <span className={styles.eyebrowOnDark}>{t('landing.studentsEyebrow')}</span>
              <h2 className={styles.h2OnDark}>{t('landing.studentsTitle')}</h2>
            </div>
            <p className={styles.sectionHeadAsideOnDark}>
              {t('landing.studentsAside', {
                names: LEARNERS.map((student) => student.name.split(' ')[0]).join(', '),
              })}
            </p>
          </div>

          <div ref={studentsReveal.ref} className={`${styles.studentGrid} ${studentsReveal.className}`}>
            {LEARNERS.map((s) => {
              const copy = learnerCopy(s, locale)
              return (
                <div key={s.id} className={styles.studentCard}>
                  <img src={s.avatarUrl} alt={s.name} className={styles.avatarBlobLarge} />
                  <div className={styles.studentHead}>
                    <h3 className={styles.studentName}>{s.name}</h3>
                    <span className={styles.studentTrait}>{copy.traits}</span>
                  </div>
                  <p className={styles.studentBody}>{copy.description}</p>
                  <span className={styles.studentQuote}>{copy.catchphrase}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className={styles.pricing}>
        <div className={styles.container}>
          <div className={styles.pricingHead}>
            <span className={styles.eyebrow}>{t('landing.pricingEyebrow')}</span>
            <h2 className={styles.h2Centered}>{t('landing.pricingTitle')}</h2>
            <p className={styles.pricingLead}>{t('landing.pricingLead')}</p>
            <div
              className={styles.billingToggle}
              role="tablist"
              aria-label={t('landing.billingPeriod')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={!annual}
                className={
                  annual ? styles.billingTab : `${styles.billingTab} ${styles.billingTabOn}`
                }
                onClick={() => setAnnual(false)}
              >
                {t('landing.monthly')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={annual}
                className={
                  annual ? `${styles.billingTab} ${styles.billingTabOn}` : styles.billingTab
                }
                onClick={() => setAnnual(true)}
              >
                {t('landing.annual')}
              </button>
            </div>
          </div>

          <div className={styles.planGrid}>
            {/* ── Belajar ── */}
            <div className={styles.plan}>
              <div className={styles.planHead}>
                <h3 className={styles.planName}>Belajar</h3>
                <p className={styles.planTag}>{t('landing.freeTag')}</p>
              </div>
              <div className={styles.priceRow}>
                <span className={styles.price}>Rp 0</span>
                <span className={styles.priceUnit}>{t('landing.toGetStarted')}</span>
              </div>
              <button
                type="button"
                className={styles.planCtaGhost}
                onClick={() => setSignInOpen(true)}
              >
                {t('landing.startNow')}
              </button>
              <div className={styles.planRule} />
              <div className={styles.featureList}>
                <div className={styles.feature}>
                  <Tick />
                  <span>{t('landing.freeFeature1')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>{t('landing.freeFeature2')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>{t('landing.freeFeature3')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>{t('landing.freeFeature4')}</span>
                </div>
              </div>
            </div>

            {/* ── Sensei ── */}
            <div className={styles.planFeatured}>
              <span className={styles.planBadge}>{t('landing.planPreview')}</span>
              <div className={styles.planHead}>
                <h3 className={styles.planNameOnDark}>Sensei</h3>
                <p className={styles.planTagOnDark}>{t('landing.senseiTag')}</p>
              </div>
              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <span className={styles.priceLime}>Rp {senseiPrice}</span>
                  <span className={styles.priceUnitOnDark}>{t('landing.perMonth')}</span>
                </div>
                <span className={styles.priceNote}>{senseiNote}</span>
              </div>
              <button
                type="button"
                className={styles.planCtaLime}
                onClick={() => setSignInOpen(true)}
              >
                {t('landing.takeSensei')}
              </button>
              <div className={styles.planRuleDark} />
              <div className={styles.featureList}>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>{t('landing.senseiFeature1')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>{t('landing.senseiFeature2')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>{t('landing.senseiFeature3')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>{t('landing.senseiFeature4')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>{t('landing.senseiFeature5')}</span>
                </div>
              </div>
            </div>

            {/* ── Sekolah ── */}
            <div className={styles.plan}>
              <div className={styles.planHead}>
                <h3 className={styles.planName}>Sekolah</h3>
                <p className={styles.planTag}>{t('landing.schoolTag')}</p>
              </div>
              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <span className={styles.price}>Rp {schoolPrice}</span>
                  <span className={styles.priceUnit}>{t('landing.perStudent')}</span>
                </div>
                <span className={styles.priceNoteLight}>{t('landing.schoolNote')}</span>
              </div>
              <a href="#faq-plans-and-access" className={styles.planCtaOutline} onClick={() => setOpenFaq(FAQS.findIndex((faq) => faq.id === 'plans-and-access'))}>
                {t('landing.aboutAvailability')}
              </a>
              <div className={styles.planRule} />
              <div className={styles.featureList}>
                <div className={styles.feature}>
                  <Tick />
                  <span>{t('landing.schoolFeature1')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>{t('landing.schoolFeature2')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>{t('landing.schoolFeature3')}</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>{t('landing.schoolFeature4')}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className={styles.faqSection}>
        <div className={styles.container}>
          <div className={styles.pricingHead}>
            <span className={styles.eyebrow}>{t('landing.navFaq')}</span>
            <h2 className={styles.h2Centered}>{t('landing.faqTitle')}</h2>
            <p className={styles.pricingLead}>{t('landing.faqLead')}</p>
          </div>

          <div ref={faqReveal.ref} className={`${styles.faqList} ${faqReveal.className}`}>
            {FAQS.map((item, i) => {
              const open = openFaq === i
              return (
                <div id={`faq-${item.id}`} key={item.id} className={open ? `${styles.faq} ${styles.faqOpen}` : styles.faq}>
                  <button
                    type="button"
                    id={`faq-q-${item.id}`}
                    className={styles.faqQ}
                    aria-expanded={open}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpenFaq(open ? null : i)}
                  >
                    <span>{t(item.q)}</span>
                    <span className={styles.faqChevron} aria-hidden="true">
                      ⌄
                    </span>
                  </button>
                  {/* Kept mounted and collapsed by max-height so the open/close
                      is animatable and the text stays findable by Ctrl+F. */}
                  <div id={`faq-a-${i}`} className={styles.faqAWrap} role="region" aria-labelledby={`faq-q-${item.id}`} aria-hidden={!open}>
                    <p className={styles.faqA}>{t(item.a, FAQ_VALUES[item.a])}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============ ABOUT ============ */}
      <section id="about" className={styles.about}>
        <div className={styles.container}>
          <div className={styles.aboutRow}>
            <div className={styles.aboutCopy}>
              <span className={styles.eyebrow}>{t('landing.navAbout')}</span>
              <h2 className={styles.h2}>{t('landing.aboutTitle')}</h2>
              <p className={styles.aboutPara}>{t('landing.aboutPara1')}</p>
              <p className={styles.aboutPara}>{t('landing.aboutPara2')}</p>
            </div>
            <div className={styles.beliefCol}>
              <div className={styles.beliefCard}>
                <span className={styles.beliefKicker}>{t('landing.believeKicker')}</span>
                <p className={styles.beliefBody}>{t('landing.believeBody')}</p>
              </div>
              <div className={styles.beliefCard}>
                <span className={styles.beliefKicker}>{t('landing.conversationKicker')}</span>
                <p className={styles.beliefBody}>{t('landing.conversationBody')}</p>
              </div>
              <div className={styles.beliefCard}>
                <span className={styles.beliefKicker}>{t('landing.reflectKicker')}</span>
                <p className={styles.beliefBody}>{t('landing.reflectBody')}</p>
              </div>
            </div>
          </div>

          <div id="team" ref={teamReveal.ref} className={teamReveal.className}>
            <TeamSlider people={TEAM} />
          </div>
        </div>
      </section>

      {/* ============ CTA + FOOTER ============ */}
      <section className={styles.closing}>
        <div className={styles.container}>
          <div className={styles.closingCta}>
            <h2 className={styles.closingTitle}>{t('landing.closingTitle')}</h2>
            <p className={styles.closingLead}>{t('landing.closingLead')}</p>
            <button
              type="button"
              className={styles.btnLimeLarge}
              onClick={() => setSignInOpen(true)}
            >
              {t('landing.startFree')}
            </button>
          </div>

          <div className={styles.footerRule} />

          <footer className={styles.footer} aria-label={t('landing.footerLabel')}>
            <div className={styles.footerBrand}>
              <a href="#top" className={styles.brand} aria-label={t('landing.footerHome')}>
                <img src="/cogniva_logo.png" alt="" aria-hidden="true" className={styles.brandMarkImg} />
                <span className={styles.brandNameOnDark}>Cogniva</span>
              </a>
              <span className={styles.footerTagline}>{t('landing.tagline')}</span>
              <button type="button" className={styles.btnLime} onClick={() => setSignInOpen(true)}>
                {t('landing.startSession')}
              </button>
              <Link to={APP_ENTRY} className={styles.footerDashboard}>
                {t('landing.goToDashboard')} →
              </Link>
            </div>
            <nav className={styles.footerCols} aria-label={t('landing.footerNavLabel')}>
              {FOOTER_GROUPS.map((group) => (
                <div key={group.title} className={styles.footerCol}>
                  <h3 className={styles.footerColTitle}>{t(group.title)}</h3>
                  {group.links.map((link) => (
                    <a
                      key={link.target}
                      href={`#${link.target}`}
                      onClick={() => {
                        const index = FAQS.findIndex((faq) => `faq-${faq.id}` === link.target)
                        if (index >= 0) setOpenFaq(index)
                      }}
                    >
                      {t(link.label)}
                    </a>
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

      {/* The same LoginScreen HomePage uses, opened here as an overlay. No
          route change: the landing page stays mounted underneath, and closing
          returns to it. Signing in lands on the dashboard. */}
      {signInOpen && (
        <LoginScreen
          onLogin={async (u, p) => {
            await login(u, p)
            navigate('/home')
          }}
          onRegister={async (u, p) => {
            await register(u, p)
            navigate('/home')
          }}
          onGuest={() => {
            continueAsGuest()
            navigate('/home')
          }}
          onClose={() => setSignInOpen(false)}
        />
      )}
    </div>
  )
}
