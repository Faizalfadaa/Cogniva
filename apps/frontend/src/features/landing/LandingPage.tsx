import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from '../../styles/LandingPage.module.css'
import { LEARNERS } from '../../lib/Learner'
import { LoginScreen } from '../auth/LoginScreen'
import { useUserStore } from '../../state/UserStore'
import { TeamSlider } from './TeamSlider'
import { BackToTop } from './BackToTop'

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
  title: string
  body: ReactNode
}

const STEPS: Step[] = [
  {
    num: '01',
    title: 'Prepare your topic',
    body: 'Create a workspace and choose your AI student. Add a reference PDF, paste your notes, or find a source to give your evaluation more context.',
  },
  {
    num: '02',
    title: 'Teach in your own words',
    body: (
      <>
        Write or draw on the whiteboard, and record your voice if you like. Press
        <strong> Teach</strong> to share your explanation with your AI student.
      </>
    ),
  },
  {
    num: '03',
    title: 'Work through the questions',
    body: 'Your student responds to your explanation and asks about unclear parts. Answer in chat, add an example, or update the board and teach again.',
  },
  {
    num: '04',
    title: 'Reflect and try again',
    body: (
      <>
        End the session to read a letter and a notebook of what your student
        <em> learned</em> and is <em>still confused</em> about. Use the suggested next topics
        to decide what to explain next.
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

/** Question and answer pairs for the FAQ accordion. */
const FAQS = [
  {
    id: 'what-is-cogniva',
    q: 'What is Cogniva?',
    a: 'Cogniva is a learning-by-teaching study space. You explain a topic to an AI student using a whiteboard, optional voice recordings, and chat. The student responds, asks questions, and helps you see which parts of your explanation need more work.',
  },
  {
    id: 'who-is-it-for',
    q: 'Who is Cogniva for?',
    a: 'Anyone who wants to practise explaining what they are studying. Use it to review a lesson, prepare an explanation for class, or work through a concept in your own words. You do not need teaching experience.',
  },
  {
    id: 'getting-started',
    q: 'How do I start my first session?',
    a: 'Open the sign-in window and sign in, create an account, or continue as a guest. From the dashboard, create a workspace, choose a student, and prepare your board. Press Teach when you are ready to share your explanation.',
  },
  {
    id: 'guest-and-account',
    q: 'What is the difference between a guest session and an account?',
    a: 'Guest sessions let you try Cogniva without an account. Guest work is not saved to your account and ends when you reload, close the page, or sign in. With an account, your workspaces and session results are saved so you can return to them.',
  },
  {
    id: 'choose-student',
    q: 'Can I choose my AI student?',
    a: `Yes. Choose from ${LEARNERS.map((student) => student.name).join(', ')} when setting up your workspace. Each character has a different personality, so you can choose the student you would like to teach.`,
  },
  {
    id: 'reference-material',
    q: 'Do I need to upload a PDF?',
    a: 'No. You can begin with your own explanation. For more context in the evaluation, upload a reference PDF, paste notes, or use the reference finder to look for a source. Review any suggested source before using it.',
  },
  {
    id: 'voice-and-board',
    q: 'Do I have to use a microphone or draw?',
    a: 'Voice recording is optional. You can type text and add shapes on the whiteboard, then use chat for follow-up explanations. If you record your voice, your browser will ask for microphone access.',
  },
  {
    id: 'teach-button',
    q: 'When does the AI student respond?',
    a: 'Press Teach to submit your current board and any recorded explanation. The student responds after processing that teaching step. You can also send a chat message to continue the conversation.',
  },
  {
    id: 'session-report',
    q: 'What do I get at the end of a session?',
    a: 'Your report includes a letter from your AI student, notes on what they learned and what remains unclear, a reflection, and suggested next topics. Use it to choose which part of your explanation to revisit.',
  },
  {
    id: 'continue-learning',
    q: 'Can I teach the same topic again?',
    a: 'Yes. You can resume a completed workspace and start another teaching round. The workspace report updates after a new evaluation, so revisit the latest feedback as you refine your explanation.',
  },
  {
    id: 'ai-feedback',
    q: 'Is the feedback a final grade?',
    a: 'No. It is AI-generated feedback on your explanation, intended to help you reflect and practise. It can miss context or make mistakes. Check important points against your course material, reference sources, or a teacher.',
  },
  {
    id: 'plans-and-access',
    q: 'Can I buy a Sensei or Sekolah subscription now?',
    a: 'Paid checkout is not available in the current app. Sensei and Sekolah are plan previews, and their listed prices and features are proposals. The buttons open sign-in so you can try the current learning experience; they do not purchase a subscription.',
  },
]

const FOOTER_GROUPS = [
  {
    title: 'Explore Cogniva',
    links: [
      { label: 'How it works', target: 'how' },
      { label: 'Meet the AI students', target: 'students' },
      { label: 'Student feedback', target: 'feedback' },
      { label: 'Access and plans', target: 'pricing' },
      { label: 'All questions', target: 'faq' },
    ],
  },
  {
    title: 'Your first session',
    links: [
      { label: 'Getting started', target: 'faq-getting-started' },
      { label: 'Choose a student', target: 'faq-choose-student' },
      { label: 'Prepare references', target: 'faq-reference-material' },
      { label: 'Whiteboard and voice', target: 'faq-voice-and-board' },
      { label: 'Using the Teach button', target: 'faq-teach-button' },
    ],
  },
  {
    title: 'Keep learning',
    links: [
      { label: 'Guest or account?', target: 'faq-guest-and-account' },
      { label: 'Read your report', target: 'faq-session-report' },
      { label: 'Teach another round', target: 'faq-continue-learning' },
      { label: 'Understanding AI feedback', target: 'faq-ai-feedback' },
      { label: 'Plan availability', target: 'faq-plans-and-access' },
    ],
  },
  {
    title: 'About Cogniva',
    links: [
      { label: 'Our approach', target: 'about' },
      { label: 'Learning by teaching', target: 'faq-what-is-cogniva' },
      { label: 'Who it is for', target: 'faq-who-is-it-for' },
      { label: 'Meet the team', target: 'team' },
      { label: 'Back to top', target: 'top' },
    ],
  },
]

/** Feature bullet marker. `on={false}` renders the muted "not included" dash. */
function Tick({ on = true, dark = false }: { on?: boolean; dark?: boolean }) {
  if (dark) return <span className={styles.tickDark}>✓</span>
  return <span className={on ? styles.tick : styles.tickOff}>{on ? '✓' : '–'}</span>
}

export default function LandingPage() {
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
  const senseiNote = annual ? 'Proposed annual total: Rp 468.000' : 'Proposed monthly price'
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
            <a href="#how">How it works</a>
            <a href="#students">Your students</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="#about">About us</a>
          </nav>
          <div className={styles.navActions}>
            <button
              type="button"
              className={styles.btnLime}
              onClick={() => setSignInOpen(true)}
            >
              Sign in
            </button>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section id="top" className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              You don't know it
              <br />
              until you can teach it.
            </h1>
            <p className={styles.heroLead}>
              Turn what you are studying into an explanation. Write, draw, or record your voice,
              then teach an AI student who responds and asks questions. Finish with feedback
              on what came across clearly and what you can explain better.
            </p>
            <div className={styles.heroCtas}>
              <Link to={APP_ENTRY} className={styles.btnLimeLarge}>
                Open a workspace →
              </Link>
              <a href="#how" className={styles.btnGhost}>
                See how a session goes
              </a>
            </div>
            <div className={styles.heroNotes}>
              <span>Try as a guest</span>
              <span>Sign in to keep your work</span>
              <span>Whiteboard, voice, and chat</span>
            </div>
          </div>

          {/* App preview — CSS-only, exactly as the mockup drew it. No screenshot asset. */}
          <div className={styles.heroPreviewWrap}>
            <div className={styles.preview}>
              <div className={styles.previewTitlebar}>
                <span className={styles.previewBack}>←</span>
                <span className={styles.previewTopic}>Photosynthesis in C4 plants</span>
                <span className={styles.previewSavedDot} />
                <span className={styles.previewSaved}>Saved</span>
              </div>
              <div className={styles.previewToolbar}>
                <span className={styles.previewChip}>biology-ch4.pdf</span>
                <div className={styles.previewSpacer} />
                <div className={styles.thinking}>
                  <span className={styles.thinkingLabel}>Thinking</span>
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
                      your whiteboard
                      <br />
                      explain one idea at a time
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
                  <span className={styles.previewSideTitle}>Reading your board…</span>
                  <span className={styles.previewSideNote}>
                    Your student is working through your explanation.
                  </span>
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
              <span className={styles.eyebrow}>How a session goes</span>
              <h2 className={styles.h2}>From explaining to understanding.</h2>
            </div>
            <p className={styles.sectionHeadAside}>
              Start with one concept. Explain it at your own pace, respond to your student's
              questions, and use the feedback to guide your next attempt.
            </p>
          </div>

          <div ref={howReveal.ref} className={`${styles.stepGrid} ${howReveal.className}`}>
            {STEPS.map((step) => (
              <div
                key={step.num}
                className={styles.stepCard}
              >
                <span className={styles.stepNum}>{step.num}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
            ))}
          </div>

          <div id="feedback" className={styles.letterRow}>
            <div className={styles.letterCard}>
              <span className={styles.letterKicker}>An example of student feedback</span>
              <p className={styles.letterQuote}>
                “Arif-sensei, I think I finally get why C4 plants bother with the extra step. But
                when you drew the two cell types I wrote them down without really following. If
                you asked me now which one has the rubisco, I would guess.”
              </p>
              <span className={styles.letterBy}>Illustrative example from Yuzuki</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{LEARNERS.length}</span>
                <span className={styles.statLabel}>students, each with their own temperament</span>
              </div>
              <div className={styles.statRule} />
              <div className={styles.stat}>
                <span className={styles.statNum}>1</span>
                <span className={styles.statLabel}>workspace for your board, references, and conversation</span>
              </div>
              <div className={styles.statRule} />
              <div className={styles.stat}>
                <span className={styles.statNum}>4</span>
                <span className={styles.statLabel}>
                  steps: prepare, explain, respond, and reflect
                </span>
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
              <span className={styles.eyebrowOnDark}>Who you'll be teaching</span>
              <h2 className={styles.h2OnDark}>Meet your next AI student.</h2>
            </div>
            <p className={styles.sectionHeadAsideOnDark}>
              Choose from {LEARNERS.map((student) => student.name.split(' ')[0]).join(', ')} when you set up a workspace. Each brings a different
              personality to the conversation. You bring the topic and the explanation.
            </p>
          </div>

          <div ref={studentsReveal.ref} className={`${styles.studentGrid} ${studentsReveal.className}`}>
            {LEARNERS.map((s) => (
              <div key={s.id} className={styles.studentCard}>
                <img src={s.avatarUrl} alt={s.name} className={styles.avatarBlobLarge} />
                <div className={styles.studentHead}>
                  <h3 className={styles.studentName}>{s.name}</h3>
                  <span className={styles.studentTrait}>{s.traits}</span>
                </div>
                <p className={styles.studentBody}>{s.description}</p>
                <span className={styles.studentQuote}>{s.catchphrase}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className={styles.pricing}>
        <div className={styles.container}>
          <div className={styles.pricingHead}>
            <span className={styles.eyebrow}>Access and plan previews</span>
            <h2 className={styles.h2Centered}>
              Start learning. See what is planned.
            </h2>
            <p className={styles.pricingLead}>
              Try the current Cogniva experience for free. Sensei and Sekolah below are proposed
              paid plans, with indicative prices in IDR. Paid checkout is not available yet.
            </p>
            <div className={styles.billingToggle} role="tablist" aria-label="Billing period">
              <button
                type="button"
                role="tab"
                aria-selected={!annual}
                className={
                  annual ? styles.billingTab : `${styles.billingTab} ${styles.billingTabOn}`
                }
                onClick={() => setAnnual(false)}
              >
                Monthly
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
                Annual
              </button>
            </div>
          </div>

          <div className={styles.planGrid}>
            {/* ── Belajar ── */}
            <div className={styles.plan}>
              <div className={styles.planHead}>
                <h3 className={styles.planName}>Belajar</h3>
                <p className={styles.planTag}>Explore a topic by explaining it to an AI student.</p>
              </div>
              <div className={styles.priceRow}>
                <span className={styles.price}>Rp 0</span>
                <span className={styles.priceUnit}>to get started</span>
              </div>
              <button
                type="button"
                className={styles.planCtaGhost}
                onClick={() => setSignInOpen(true)}
              >
                Start now
              </button>
              <div className={styles.planRule} />
              <div className={styles.featureList}>
                <div className={styles.feature}>
                  <Tick />
                  <span>Choose from three AI students</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>Whiteboard, voice recording, chat</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>Letter, notebook and next topics</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>Save workspaces when signed in</span>
                </div>
              </div>
            </div>

            {/* ── Sensei ── */}
            <div className={styles.planFeatured}>
              <span className={styles.planBadge}>Plan preview</span>
              <div className={styles.planHead}>
                <h3 className={styles.planNameOnDark}>Sensei</h3>
                <p className={styles.planTagOnDark}>
                  A proposed plan for a regular learning-by-teaching routine.
                </p>
              </div>
              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <span className={styles.priceLime}>Rp {senseiPrice}</span>
                  <span className={styles.priceUnitOnDark}>/ month</span>
                </div>
                <span className={styles.priceNote}>{senseiNote}</span>
              </div>
              <button
                type="button"
                className={styles.planCtaLime}
                onClick={() => setSignInOpen(true)}
              >
                Take Sensei
              </button>
              <div className={styles.planRuleDark} />
              <div className={styles.featureList}>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>Unlimited workspaces and rounds</span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>
                    Extended report history
                  </span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>Reference PDFs up to 100 pages</span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>
                    Deeper evaluation that remembers earlier rounds
                  </span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>Export letters and notes as PDF</span>
                </div>
              </div>
            </div>

            {/* ── Sekolah ── */}
            <div className={styles.plan}>
              <div className={styles.planHead}>
                <h3 className={styles.planName}>Sekolah</h3>
                <p className={styles.planTag}>A proposed plan for classrooms and study groups.</p>
              </div>
              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <span className={styles.price}>Rp {schoolPrice}</span>
                  <span className={styles.priceUnit}>/ student / month</span>
                </div>
                <span className={styles.priceNoteLight}>Plan preview · proposed minimum of 20 students</span>
              </div>
              <a href="#faq-plans-and-access" className={styles.planCtaOutline} onClick={() => setOpenFaq(FAQS.findIndex((faq) => faq.id === 'plans-and-access'))}>
                About plan availability
              </a>
              <div className={styles.planRule} />
              <div className={styles.featureList}>
                <div className={styles.feature}>
                  <Tick />
                  <span>Everything in Sensei</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>Teacher view: who taught what, and how it went</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>Assign a topic to the whole class</span>
                </div>
                <div className={styles.feature}>
                  <Tick />
                  <span>Invoicing, onboarding session, priority support</span>
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
            <span className={styles.eyebrow}>FAQ</span>
            <h2 className={styles.h2Centered}>Questions you might have</h2>
            <p className={styles.pricingLead}>
              Getting started, choosing a student, and making the most of your teaching session.
            </p>
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
                    <span>{item.q}</span>
                    <span className={styles.faqChevron} aria-hidden="true">
                      ⌄
                    </span>
                  </button>
                  {/* Kept mounted and collapsed by max-height so the open/close
                      is animatable and the text stays findable by Ctrl+F. */}
                  <div id={`faq-a-${i}`} className={styles.faqAWrap} role="region" aria-labelledby={`faq-q-${item.id}`} aria-hidden={!open}>
                    <p className={styles.faqA}>{item.a}</p>
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
              <span className={styles.eyebrow}>About us</span>
              <h2 className={styles.h2}>
                A place to practise what you understand.
              </h2>
              <p className={styles.aboutPara}>
                Cogniva is built around learning by teaching. Choosing your words, connecting
                ideas, and answering questions gives you a way to examine your own understanding.
                Our workspace brings that practice together with an AI student you can teach.
              </p>
              <p className={styles.aboutPara}>
                Your board holds the explanation, chat keeps the conversation going, and the
                report gives you something concrete to reflect on. Start with what you know,
                notice what needs another example, and return for another teaching round.
              </p>
            </div>
            <div className={styles.beliefCol}>
              <div className={styles.beliefCard}>
                <span className={styles.beliefKicker}>Explain in your own words</span>
                <p className={styles.beliefBody}>
                  Build an explanation with your own examples, diagrams, and reasoning.
                </p>
              </div>
              <div className={styles.beliefCard}>
                <span className={styles.beliefKicker}>Learn through conversation</span>
                <p className={styles.beliefBody}>
                  Use your student's questions to spot missing steps and try a clearer explanation.
                </p>
              </div>
              <div className={styles.beliefCard}>
                <span className={styles.beliefKicker}>Reflect, then revisit</span>
                <p className={styles.beliefBody}>
                  Turn feedback into your next study step, whether that is a better example or a new topic.
                </p>
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
            <h2 className={styles.closingTitle}>What will you teach today?</h2>
            <p className={styles.closingLead}>
              Bring one concept, choose an AI student, and explain it your way.
              Your next question is a chance to understand it better.
            </p>
            <button
              type="button"
              className={styles.btnLimeLarge}
              onClick={() => setSignInOpen(true)}
            >
              Start teaching for free
            </button>
          </div>

          <div className={styles.footerRule} />

          <footer className={styles.footer} aria-label="Cogniva footer">
            <div className={styles.footerBrand}>
              <a href="#top" className={styles.brand} aria-label="Cogniva home">
                <img src="/cogniva_logo.png" alt="" aria-hidden="true" className={styles.brandMarkImg} />
                <span className={styles.brandNameOnDark}>Cogniva</span>
              </a>
              <span className={styles.footerTagline}>
                A study space for explaining ideas, asking better questions, and learning
                through the act of teaching an AI student.
              </span>
              <button type="button" className={styles.btnLime} onClick={() => setSignInOpen(true)}>
                Start a teaching session
              </button>
              <Link to={APP_ENTRY} className={styles.footerDashboard}>Go to your dashboard →</Link>
            </div>
            <nav className={styles.footerCols} aria-label="Explore and get help">
              {FOOTER_GROUPS.map((group) => (
                <div key={group.title} className={styles.footerCol}>
                  <h3 className={styles.footerColTitle}>{group.title}</h3>
                  {group.links.map((link) => (
                    <a
                      key={link.target}
                      href={`#${link.target}`}
                      onClick={() => {
                        const index = FAQS.findIndex((faq) => `faq-${faq.id}` === link.target)
                        if (index >= 0) setOpenFaq(index)
                      }}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              ))}
            </nav>
          </footer>

          <div className={styles.footerBottom}>
            <span className={styles.copyright}>© {new Date().getFullYear()} Cogniva.</span>
            <span className={styles.copyright}>Explain. Question. Reflect. Teach again.</span>
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
