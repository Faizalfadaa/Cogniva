import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from '../../styles/LandingPage.module.css'

/** Where every call-to-action lands. Authentication is a separate workstream,
 *  so "Sign in" points at the same place as "Start teaching" for now. */
const APP_ENTRY = '/home'

interface Step {
  num: string
  title: string
  body: ReactNode
  dark?: boolean
}

const STEPS: Step[] = [
  {
    num: '01',
    title: 'Open a board',
    body: "Name a topic, or don't. Attach a reference PDF if you have one — your student never sees it, so she can't cheat off the answer key.",
  },
  {
    num: '02',
    title: 'Explain it',
    body: (
      <>
        Draw, write, record your voice. Press <strong>Teach</strong> whenever you want her to look
        at what's on the board.
      </>
    ),
  },
  {
    num: '03',
    title: 'She pushes back',
    body: '“E-Etto… is the rubisco in the first box or the second one?” Answer in chat, or go draw it properly. Her questions stay put until you deal with them.',
    dark: true,
  },
  {
    num: '04',
    title: 'Read her letter',
    body: (
      <>
        A letter, a notebook split into <em>learned</em> and <em>still confused</em>, and three
        topics she'd like next. Then teach it again, better.
      </>
    ),
  },
]

interface Student {
  name: string
  trait: string
  body: string
  quote: string
  avatarClass: string
  avatarFile: string
}

const STUDENTS: Student[] = [
  {
    name: 'Yuzuki Akatsuki',
    trait: 'Anxious, thorough',
    body: "Apologises before every question, then asks the sharpest one in the session. She'll admit when she only copied your diagram.",
    quote: '“E-Etto… sensei, sorry, one more thing?”',
    avatarClass: 'avatarYuzuki',
    avatarFile: 'yuzuki.png',
  },
  {
    name: 'Reina Kisaragi',
    trait: 'Loud, delighted',
    body: 'Enthusiastic to the point of chaos. Jumps three steps ahead, which is exactly how you find out your explanation had no step two.',
    quote: '“KYAA—! Wait, so does that mean—”',
    avatarClass: 'avatarReina',
    avatarFile: 'reina.png',
  },
  {
    name: 'Akira Kagetsu',
    trait: 'Blunt, unimpressed',
    body: 'Says the quiet part out loud. If a section of your explanation was filler, his letter will name it. The most useful one to draw.',
    quote: '“…You’re late. And that part made no sense.”',
    avatarClass: 'avatarAkira',
    avatarFile: 'akira.png',
  },
]

const TEAM = ['Design', 'Engineering', 'Learning research', 'Product']

/** Feature bullet marker. `on={false}` renders the muted "not included" dash. */
function Tick({ on = true, dark = false }: { on?: boolean; dark?: boolean }) {
  if (dark) return <span className={styles.tickDark}>✓</span>
  return <span className={on ? styles.tick : styles.tickOff}>{on ? '✓' : '–'}</span>
}

export default function LandingPage() {
  const [annual, setAnnual] = useState(false)

  const senseiPrice = annual ? '39.000' : '49.000'
  const senseiNote = annual ? 'Billed Rp 468.000 yearly' : 'Or Rp 39.000 on annual billing'
  const schoolPrice = annual ? '19.000' : '24.000'

  return (
    <div className={styles.page}>
      {/* ============ NAV ============ */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <a href="#top" className={styles.brand}>
            <span className={styles.brandMark}>C</span>
            <span className={styles.brandName}>Cogniva</span>
          </a>
          <nav className={styles.navLinks}>
            <a href="#how">How it works</a>
            <a href="#students">Your students</a>
            <a href="#pricing">Pricing</a>
            <a href="#about">About us</a>
          </nav>
          <div className={styles.navActions}>
            <Link to={APP_ENTRY} className={styles.navSignIn}>
              Sign in
            </Link>
            <Link to={APP_ENTRY} className={styles.btnLime}>
              Start teaching — free
            </Link>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section id="top" className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.betaPill}>
              <span className={styles.betaDot} /> Free while we're in open beta
            </span>
            <h1 className={styles.heroTitle}>
              You don't know it
              <br />
              until you can teach it.
            </h1>
            <p className={styles.heroLead}>
              Cogniva gives you a student instead of a quiz. Explain a topic on a whiteboard — out
              loud if you like — and she'll interrupt, get confused, and ask the one question you
              were quietly hoping she wouldn't. Afterwards she writes you a letter about what she
              actually understood.
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
              <span>No account needed</span>
              <span>Just type your name and start</span>
              <span>Works in Bahasa Indonesia</span>
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
                      read-only while she reads
                    </span>
                  </div>
                </div>
                <div className={styles.previewSide}>
                  <div className={styles.avatarStage}>
                    <span className={styles.ring} />
                    <span className={`${styles.ring} ${styles.ringDelayed}`} />
                    <div className={`${styles.avatarBlob} ${styles.avatarYuzuki}`}>
                      <span>
                        avatar
                        <br />
                        yuzuki
                      </span>
                    </div>
                  </div>
                  <span className={styles.previewSideTitle}>Reading your board…</span>
                  <span className={styles.previewSideNote}>
                    She's looking at the arrows on the right side.
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
              <h2 className={styles.h2}>Four steps, about twenty minutes.</h2>
            </div>
            <p className={styles.sectionHeadAside}>
              Nothing to configure and nothing to grade. You talk, she listens badly enough to
              expose the gaps, and the report tells you where to look again.
            </p>
          </div>

          <div className={styles.stepGrid}>
            {STEPS.map((step) => (
              <div
                key={step.num}
                className={
                  step.dark ? `${styles.stepCard} ${styles.stepCardDark}` : styles.stepCard
                }
              >
                <span className={styles.stepNum}>{step.num}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
            ))}
          </div>

          <div className={styles.letterRow}>
            <div className={styles.letterCard}>
              <span className={styles.letterKicker}>What the letter looks like</span>
              <p className={styles.letterQuote}>
                “Arif-sensei, I think I finally get why C4 plants bother with the extra step. But
                when you drew the two cell types I wrote them down without really following — if
                you asked me now which one has the rubisco, I would guess.”
              </p>
              <span className={styles.letterBy}>— Yuzuki, after 24 minutes</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.stat}>
                <span className={styles.statNum}>3</span>
                <span className={styles.statLabel}>students, each with their own temperament</span>
              </div>
              <div className={styles.statRule} />
              <div className={styles.stat}>
                <span className={styles.statNum}>0</span>
                <span className={styles.statLabel}>accounts, passwords or setup screens</span>
              </div>
              <div className={styles.statRule} />
              <div className={styles.stat}>
                <span className={styles.statNum}>∞</span>
                <span className={styles.statLabel}>
                  rounds per topic — each one keeps its own report
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
              <h2 className={styles.h2OnDark}>Three students. You don't get to pick.</h2>
            </div>
            <p className={styles.sectionHeadAsideOnDark}>
              Each workspace is assigned a student and keeps her for good, so a topic always has
              the same voice in it. Teach three topics and you'll have met all three.
            </p>
          </div>

          <div className={styles.studentGrid}>
            {STUDENTS.map((s) => (
              <div key={s.name} className={styles.studentCard}>
                <div className={`${styles.avatarBlobLarge} ${styles[s.avatarClass]}`}>
                  <span>
                    avatar
                    <br />
                    {s.avatarFile}
                  </span>
                </div>
                <div className={styles.studentHead}>
                  <h3 className={styles.studentName}>{s.name}</h3>
                  <span className={styles.studentTrait}>{s.trait}</span>
                </div>
                <p className={styles.studentBody}>{s.body}</p>
                <span className={styles.studentQuote}>{s.quote}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className={styles.pricing}>
        <div className={styles.container}>
          <div className={styles.pricingHead}>
            <span className={styles.eyebrow}>Pricing</span>
            <h2 className={styles.h2Centered}>
              Free to learn with. Paid when you want her to remember.
            </h2>
            <p className={styles.pricingLead}>
              Prices in IDR, per month, cancel any time. Every plan includes all three students and
              the full report.
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
                Annual · 2 months free
              </button>
            </div>
          </div>

          <div className={styles.planGrid}>
            {/* ── Belajar ── */}
            <div className={styles.plan}>
              <div className={styles.planHead}>
                <h3 className={styles.planName}>Belajar</h3>
                <p className={styles.planTag}>For seeing whether teaching actually works on you.</p>
              </div>
              <div className={styles.priceRow}>
                <span className={styles.price}>Rp 0</span>
                <span className={styles.priceUnit}>forever</span>
              </div>
              <Link to={APP_ENTRY} className={styles.planCtaGhost}>
                Start now
              </Link>
              <div className={styles.planRule} />
              <div className={styles.featureList}>
                <div className={styles.feature}>
                  <Tick />
                  <span>3 workspaces at a time</span>
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
                  <Tick on={false} />
                  <span className={styles.featureOff}>Reports kept 7 days</span>
                </div>
              </div>
            </div>

            {/* ── Sensei ── */}
            <div className={styles.planFeatured}>
              <span className={styles.planBadge}>Most chosen</span>
              <div className={styles.planHead}>
                <h3 className={styles.planNameOnDark}>Sensei</h3>
                <p className={styles.planTagOnDark}>
                  For someone with an exam, a thesis, or a habit.
                </p>
              </div>
              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <span className={styles.priceLime}>Rp {senseiPrice}</span>
                  <span className={styles.priceUnitOnDark}>/ month</span>
                </div>
                <span className={styles.priceNote}>{senseiNote}</span>
              </div>
              <Link to={APP_ENTRY} className={styles.planCtaLime}>
                Take Sensei
              </Link>
              <div className={styles.planRuleDark} />
              <div className={styles.featureList}>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>Unlimited workspaces and rounds</span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>
                    Reports kept forever, with round history
                  </span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>Reference PDFs up to 100 pages</span>
                </div>
                <div className={styles.feature}>
                  <Tick dark />
                  <span className={styles.featureOnDark}>
                    Deeper evaluation — she remembers earlier rounds
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
                <p className={styles.planTag}>For a class, a study group, or a whole school.</p>
              </div>
              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <span className={styles.price}>Rp {schoolPrice}</span>
                  <span className={styles.priceUnit}>/ student / month</span>
                </div>
                <span className={styles.priceNoteLight}>Minimum 20 students</span>
              </div>
              <a href="#about" className={styles.planCtaOutline}>
                Talk to us
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

          <div className={styles.faqRow}>
            <div className={styles.faq}>
              <span className={styles.faqQ}>What happens to my free workspaces?</span>
              <p className={styles.faqA}>
                They stay. Upgrading only lifts the limits — nothing is deleted or migrated.
              </p>
            </div>
            <div className={styles.faq}>
              <span className={styles.faqQ}>Is my board used for training?</span>
              <p className={styles.faqA}>
                No. Your boards, voice and PDFs are used to run your session and nothing else.
              </p>
            </div>
            <div className={styles.faq}>
              <span className={styles.faqQ}>Do I need an account to pay?</span>
              <p className={styles.faqA}>
                Only from Sensei upwards — that's the point where your reports need somewhere to
                live.
              </p>
            </div>
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
                We built the study tool we kept failing to be disciplined enough for.
              </h2>
              <p className={styles.aboutPara}>
                Cogniva started as a small team in Bandung re-reading the same chapter for the
                fourth time and still not being able to explain it to a friend. Flashcards told us
                we knew things we didn't. Talking out loud to nobody felt silly. So we made the
                nobody talk back.
              </p>
              <p className={styles.aboutPara}>
                The students are deliberately not experts. An expert would fill your gaps in
                politely. A confused beginner leaves them exactly where they are, in writing, where
                you have to look at them.
              </p>
            </div>
            <div className={styles.beliefCol}>
              <div className={styles.beliefCard}>
                <span className={styles.beliefKicker}>What we believe</span>
                <p className={styles.beliefBody}>
                  Understanding is a performance, not a feeling. If you can't perform it, you don't
                  have it yet.
                </p>
              </div>
              <div className={styles.beliefCard}>
                <span className={styles.beliefKicker}>What we won't do</span>
                <p className={styles.beliefBody}>
                  No streaks, no leaderboards, no notifications guilting you back. One good session
                  beats thirty nagged ones.
                </p>
              </div>
              <div className={styles.beliefCard}>
                <span className={styles.beliefKicker}>Where we are</span>
                <p className={styles.beliefBody}>
                  Open beta, four people, Bandung. Bahasa Indonesia first, English second.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.teamRow}>
            {TEAM.map((role) => (
              <div key={role} className={styles.teamMember}>
                <div className={styles.teamPhoto}>
                  <span>
                    team photo
                    <br />
                    square
                  </span>
                </div>
                <div className={styles.teamMeta}>
                  <span className={styles.teamName}>Name</span>
                  <span className={styles.teamRole}>{role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA + FOOTER ============ */}
      <section className={styles.closing}>
        <div className={styles.container}>
          <div className={styles.closingCta}>
            <h2 className={styles.closingTitle}>Pick a topic you think you know.</h2>
            <p className={styles.closingLead}>
              Type your name, open a board, and find out in twenty minutes. No card, no account.
            </p>
            <Link to={APP_ENTRY} className={styles.btnLimeLarge}>
              Start teaching — free
            </Link>
          </div>

          <div className={styles.footerRule} />

          <footer className={styles.footer}>
            <div className={styles.footerBrand}>
              <div className={styles.brand}>
                <span className={styles.brandMarkLime}>C</span>
                <span className={styles.brandNameOnDark}>Cogniva</span>
              </div>
              <span className={styles.footerTagline}>
                Learning by teaching. Made in Bandung, Indonesia.
              </span>
            </div>
            <div className={styles.footerCols}>
              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>Product</span>
                <a href="#how">How it works</a>
                <a href="#students">Your students</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>Company</span>
                <a href="#about">About us</a>
                <a href="#about">Contact</a>
                <a href="#about">Careers</a>
              </div>
              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>Legal</span>
                <a href="#about">Privacy</a>
                <a href="#about">Terms</a>
              </div>
            </div>
          </footer>

          <span className={styles.copyright}>© 2026 Cogniva. Open beta.</span>
        </div>
      </section>
    </div>
  )
}
