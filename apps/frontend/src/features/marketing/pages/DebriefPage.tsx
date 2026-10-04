import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import styles from '../Marketing.module.css'
import { PageHero, SectionHead, minCol } from '../blocks'
import { useLocale } from '../../../i18n/LanguageProvider'
import type { Locale } from '../../../i18n/messages'

/** Axis values and bar colours for the worked example. */
const AXIS_VALUES = [
  { value: 82, colour: '#7fa03a' },
  { value: 71, colour: '#7fa03a' },
  { value: 68, colour: '#e0a800' },
  { value: 52, colour: '#e0a800' },
]

/** Background and ink for the four finding categories. */
const CATEGORY_COLOURS = [
  { bg: '#cfe8c4', fg: '#2c4a1f' },
  { bg: '#fbe3dd', fg: '#a4321c' },
  { bg: '#ffe8a8', fg: '#6b4e00' },
  { bg: '#e6e6f2', fg: '#3a3f6b' },
]

const EN = {
  hero: {
    eyebrow: 'Product · the debrief',
    title: 'Not a grade. Evidence you can argue with.',
    lead: "The Evaluator runs once per round, after the session ends, and judges the quality of your explanation, never the student's replies. It is a separate agent the student has no access to, working from accountable reference material it retrieved rather than a document it skimmed.",
    links: [
      { href: '#zoom', label: 'Organised by zoom level' },
      { href: '#scores', label: 'Two numbers, not one' },
      { href: '#axes', label: 'Four measured axes' },
      { href: '#findings', label: 'Findings and evidence' },
      { href: '#letter', label: 'The letter' },
    ],
  },
  zoom: {
    eyebrow: 'Structure',
    title: 'It widens as you scroll.',
    body: 'One number, then two sentences, then four measurements, then the evidence. You can stop at any depth and still have learned something true.',
    levels: [
      { label: 'zoom 1', title: 'One number', body: 'A session score out of 100, with a plain line saying what it measures.' },
      { label: 'zoom 2', title: 'Two sentences', body: "Your main strength, and the first thing to fix, the latter delivered by your student, because she's the one asking for it." },
      { label: 'zoom 3', title: 'Four measurements', body: 'Accuracy, completeness, clarity and depth, on a radar and as cards you can read individually.' },
      { label: 'zoom 4', title: 'The evidence', body: 'Every finding with the sentence it rests on, a follow-up for next time, and the annotated transcript underneath it all.' },
    ],
  },
  scores: {
    eyebrow: 'Two numbers, not one',
    title: 'Being right and going deep are different questions.',
    body: 'The score asks whether your explanation was correct. The depth score, judged once across the whole session and deliberately separate, asks whether it went past naming things. Keeping them apart is what stops a tidy, shallow session from looking like mastery.',
    example: '“Photosynthesis turns light into energy.”',
    correct: 'Correct',
    correctNote: 'scores well',
    shallow: 'Shallow',
    shallowNote: 'scores badly on depth',
    scoreLabel: 'session score',
    scoreNote: 'how accurate and complete your explanation was against the reference',
    depthLabel: 'depth of understanding',
    depthNote: 'whether you explained mechanisms or mostly named them',
    offline: 'offline, depth is capped at a deliberately modest value: a debrief never claims a judgement it did not make',
  },
  axes: {
    eyebrow: 'Four axes',
    title: 'Each one traceable to the findings that produced it',
    items: [
      { name: 'Accuracy', measure: 'right out of points judged', note: 'Nine of eleven claims checked out against the reference. Two were wrong.' },
      { name: 'Completeness', measure: 'concepts not left out', note: 'Three key concepts from the reference never came up at all.' },
      { name: 'Clarity', measure: 'parts that did not read as confusing', note: 'Two passages were ambiguous enough that your student had to ask which was which.' },
      { name: 'Depth', measure: 'from the Evaluator, judged once', note: 'Mostly naming and sequencing. The mechanism behind the sequence was not explained.' },
    ],
    note: 'an axis with nothing to measure is shown as unmeasured rather than as a zero',
  },
  findings: {
    eyebrow: 'Findings and evidence',
    title: 'Four categories, and a quote that has to check out.',
    aside: "Models paraphrase even when asked not to, so every quote is verified against the cited turn's board text and speech, tolerating only whitespace and capitalisation drift. A quote that cannot be found is dropped; the finding it belongs to is kept.",
    categories: [
      { tag: 'Correct', title: 'You explained it accurately', body: 'Kept without a follow-up, so the good parts are visible but never padded with advice.' },
      { tag: 'Wrong', title: 'You stated something incorrect', body: 'A factual error or a misconception of your own, quoted so you can see exactly where it entered.' },
      { tag: 'Missed', title: 'A key concept was never covered', body: 'Found by comparing what you said against what the reference says matters, not against what the student happened to ask.' },
      { tag: 'Confusing', title: 'It was ambiguous or hard to follow', body: 'Usually the most actionable category: the content was there, the ordering was not.' },
    ],
    exampleLabel: 'a finding, as it appears',
    exampleTag: 'Confusing',
    exampleWhere: 'turn 3 · board + speech',
    exampleBody: 'The two cell types were introduced in sequence without saying which one does which job, so the diagram could be copied but not read.',
    exampleQuote: "“mesophyll first, then bundle sheath, and that's where the cycle finishes”",
    nextLabel: 'Next time:',
    nextBody: ' name the job before the name (“the cell that concentrates CO₂”, then “mesophyll”) and label the boxes on the board as you say it.',
    exampleNote: 'CORRECT findings deliberately carry no follow-up, so advice is never diluted by invented advice',
  },
  letter: {
    eyebrow: "The letter, the notebook, what's next",
    title: 'The measurements convince you. The letter makes you go again.',
    p1: "Under the evidence, the same session comes back in your student's own words: what stuck, what went too fast, and what she still wants to know. Then a notebook split into learned, still confused and a reflection, and three topics she'd like next.",
    p2: 'Any of those lists can come back empty, and the empty state is written rather than left blank: “Nothing noted yet.” sits in the same ruled rhythm as a filled one, so a thin debrief reads as deliberate instead of broken.',
    primary: 'Teach a session →',
    secondary: 'Meet the students',
    wrote: 'wrote this right after your session',
    letter1: "Arif-sensei, thank you for today! I think I finally get why C4 plants bother with the extra step. You said it's like keeping a spare room for CO₂. That picture stuck.",
    letter2: 'But, e-etto… when you drew the two cell types I wrote them down without really following. If you asked me now which one has the rubisco, I would guess. Maybe that part went a bit fast?',
    sign: 'Yuzuki',
  },
}

const ID: typeof EN = {
  hero: {
    eyebrow: 'Produk · laporan sesi',
    title: 'Bukan nilai. Bukti yang bisa kamu perdebatkan.',
    lead: 'Evaluator berjalan sekali per putaran, setelah sesi berakhir, dan menilai kualitas penjelasanmu, bukan balasan murid. Ia agen terpisah yang tidak bisa diakses murid, bekerja dari materi acuan yang bisa dipertanggungjawabkan dan diambilnya sendiri, bukan dokumen yang sekadar dibaca sekilas.',
    links: [
      { href: '#zoom', label: 'Disusun per tingkat kedalaman' },
      { href: '#scores', label: 'Dua angka, bukan satu' },
      { href: '#axes', label: 'Empat sumbu terukur' },
      { href: '#findings', label: 'Temuan dan bukti' },
      { href: '#letter', label: 'Suratnya' },
    ],
  },
  zoom: {
    eyebrow: 'Struktur',
    title: 'Makin lebar saat kamu menggulir.',
    body: 'Satu angka, lalu dua kalimat, lalu empat ukuran, lalu buktinya. Kamu bisa berhenti di kedalaman mana pun dan tetap mendapat sesuatu yang benar.',
    levels: [
      { label: 'tingkat 1', title: 'Satu angka', body: 'Skor sesi dari 100, dengan satu kalimat sederhana tentang apa yang diukurnya.' },
      { label: 'tingkat 2', title: 'Dua kalimat', body: 'Kekuatan utamamu, dan hal pertama yang perlu diperbaiki, yang kedua disampaikan oleh muridmu, karena dialah yang memintanya.' },
      { label: 'tingkat 3', title: 'Empat ukuran', body: 'Ketepatan, kelengkapan, kejelasan, dan kedalaman, dalam radar dan kartu yang bisa dibaca satu per satu.' },
      { label: 'tingkat 4', title: 'Buktinya', body: 'Setiap temuan dengan kalimat yang mendasarinya, saran untuk lain kali, dan transkrip beranotasi di bawah semuanya.' },
    ],
  },
  scores: {
    eyebrow: 'Dua angka, bukan satu',
    title: 'Benar dan mendalam adalah dua pertanyaan berbeda.',
    body: 'Skor menanyakan apakah penjelasanmu benar. Skor kedalaman, dinilai sekali atas seluruh sesi dan sengaja dipisah, menanyakan apakah penjelasanmu melampaui sekadar menyebut istilah. Memisahkan keduanya yang mencegah sesi rapi tapi dangkal terlihat seperti penguasaan.',
    example: '“Fotosintesis mengubah cahaya jadi energi.”',
    correct: 'Benar',
    correctNote: 'skornya bagus',
    shallow: 'Dangkal',
    shallowNote: 'skor kedalamannya buruk',
    scoreLabel: 'skor sesi',
    scoreNote: 'seberapa tepat dan lengkap penjelasanmu dibanding acuan',
    depthLabel: 'kedalaman pemahaman',
    depthNote: 'apakah kamu menjelaskan mekanismenya atau kebanyakan hanya menyebut namanya',
    offline: 'saat offline, kedalaman dibatasi di nilai yang sengaja rendah: laporan tidak pernah mengklaim penilaian yang tidak dilakukannya',
  },
  axes: {
    eyebrow: 'Empat sumbu',
    title: 'Masing-masing bisa ditelusuri ke temuan yang menghasilkannya',
    items: [
      { name: 'Ketepatan', measure: 'benar dari poin yang dinilai', note: 'Sembilan dari sebelas klaim cocok dengan acuan. Dua salah.' },
      { name: 'Kelengkapan', measure: 'konsep yang tidak terlewat', note: 'Tiga konsep kunci dari acuan tidak pernah dibahas sama sekali.' },
      { name: 'Kejelasan', measure: 'bagian yang tidak membingungkan', note: 'Dua bagian cukup ambigu sampai muridmu harus bertanya yang mana yang mana.' },
      { name: 'Kedalaman', measure: 'dari Evaluator, dinilai sekali', note: 'Kebanyakan menyebut nama dan urutan. Mekanisme di balik urutan itu tidak dijelaskan.' },
    ],
    note: 'sumbu yang tidak punya bahan untuk diukur ditampilkan sebagai belum terukur, bukan nol',
  },
  findings: {
    eyebrow: 'Temuan dan bukti',
    title: 'Empat kategori, dan kutipan yang harus terbukti.',
    aside: 'Model tetap memparafrasekan walau diminta tidak, jadi setiap kutipan dicocokkan dengan teks papan dan ucapan di giliran yang dirujuk, hanya menoleransi perbedaan spasi dan huruf besar. Kutipan yang tidak ditemukan dibuang; temuannya tetap disimpan.',
    categories: [
      { tag: 'Tepat', title: 'Kamu menjelaskannya dengan benar', body: 'Disimpan tanpa saran lanjutan, jadi bagian yang bagus terlihat tapi tidak dijejali nasihat.' },
      { tag: 'Keliru', title: 'Kamu menyatakan sesuatu yang salah', body: 'Kesalahan fakta atau miskonsepsimu sendiri, dikutip supaya kamu bisa melihat persis di mana ia masuk.' },
      { tag: 'Terlewat', title: 'Konsep kunci tidak pernah dibahas', body: 'Ditemukan dengan membandingkan ucapanmu dengan apa yang menurut acuan penting, bukan dengan apa yang kebetulan ditanyakan murid.' },
      { tag: 'Rancu', title: 'Ambigu atau sulit diikuti', body: 'Biasanya kategori yang paling bisa langsung ditindaklanjuti: isinya ada, urutannya tidak.' },
    ],
    exampleLabel: 'sebuah temuan, seperti yang tampil',
    exampleTag: 'Rancu',
    exampleWhere: 'giliran 3 · papan + ucapan',
    exampleBody: 'Dua jenis sel diperkenalkan berurutan tanpa menyebut sel mana mengerjakan tugas apa, jadi diagramnya bisa disalin tapi tidak bisa dibaca.',
    exampleQuote: '“mesofil dulu, lalu seludang berkas, dan di situlah siklusnya selesai”',
    nextLabel: 'Lain kali:',
    nextBody: ' sebut tugasnya sebelum namanya (“sel yang memekatkan CO₂”, baru “mesofil”) dan beri label kotak di papan sambil kamu mengucapkannya.',
    exampleNote: 'temuan TEPAT sengaja tidak diberi saran lanjutan, supaya nasihat tidak diencerkan oleh nasihat karangan',
  },
  letter: {
    eyebrow: 'Surat, buku catatan, dan langkah berikutnya',
    title: 'Ukurannya meyakinkanmu. Suratnya membuatmu mencoba lagi.',
    p1: 'Di bawah bukti, sesi yang sama kembali dalam kata-kata muridmu sendiri: apa yang nyangkut, apa yang terlalu cepat, dan apa yang masih ingin dia tahu. Lalu buku catatan yang terbagi jadi sudah dipahami, masih bingung, dan refleksi, serta tiga materi yang ingin dia pelajari berikutnya.',
    p2: 'Daftar mana pun bisa kembali kosong, dan keadaan kosong itu ditulis, bukan dibiarkan kosong: “Belum ada catatan.” muncul dengan ritme bergaris yang sama seperti yang terisi, jadi laporan yang tipis terbaca disengaja, bukan rusak.',
    primary: 'Coba satu sesi →',
    secondary: 'Kenali muridnya',
    wrote: 'menulis ini tepat setelah sesimu',
    letter1: 'Arif-sensei, terima kasih untuk hari ini! Sepertinya aku akhirnya paham kenapa tumbuhan C4 repot menambah satu langkah. Sensei bilang itu seperti menyimpan kamar cadangan untuk CO₂. Gambaran itu nyangkut.',
    letter2: 'Tapi, e-etto… waktu sensei menggambar dua jenis selnya, aku cuma mencatat tanpa benar-benar mengikuti. Kalau sekarang ditanya yang mana punya rubisco, aku cuma bisa menebak. Mungkin bagian itu agak terlalu cepat?',
    sign: 'Yuzuki',
  },
}

const COPY: Record<Locale, typeof EN> = { en: EN, id: ID }

export default function DebriefPage() {
  const { locale } = useLocale()
  const c = COPY[locale]

  return (
    <>
      <PageHero {...c.hero} />

      <section id="zoom" className={styles.bgPage}>
        <div className={styles.container}>
          <div className={styles.headStack}>
            <span className={styles.eyebrow}>{c.zoom.eyebrow}</span>
            <h2 className={styles.h2}>{c.zoom.title}</h2>
            <p className={styles.text}>{c.zoom.body}</p>
          </div>
          <div className={styles.grid} style={minCol(228)}>
            {c.zoom.levels.map((level, i) => (
              <div key={level.label} className={i === 3 ? `${styles.card} ${styles.cardDark} ${styles.onDark}` : styles.card}>
                <span className={styles.eyebrow} style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>
                  {level.label}
                </span>
                <h3 className={`${styles.h3} ${styles.h3Sm}`}>{level.title}</h3>
                <p className={styles.small}>{level.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="scores" className={`${styles.bgForest} ${styles.onDark}`}>
        <div className={`${styles.split} ${styles.alignCenter}`}>
          <div className={styles.col}>
            <span className={styles.eyebrow}>{c.scores.eyebrow}</span>
            <h2 className={styles.h2}>{c.scores.title}</h2>
            <p className={styles.text}>{c.scores.body}</p>
            <div className={`${styles.card} ${styles.cardForest}`} style={{ gap: 12 }}>
              <p className={`${styles.text} ${styles.inkText} ${styles.italic}`} style={{ fontSize: 17 }}>
                {c.scores.example}
              </p>
              <div className={styles.verdicts}>
                <div className={styles.verdict}>
                  <strong>{c.scores.correct}</strong>
                  <span>{c.scores.correctNote}</span>
                </div>
                <div className={styles.verdict} style={{ '--verdict': '#e8c04a' } as CSSProperties}>
                  <strong>{c.scores.shallow}</strong>
                  <span>{c.scores.shallowNote}</span>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.colSide} style={{ gap: 16 }}>
            <div className={styles.scoreCard}>
              <span className={styles.eyebrow} style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>
                {c.scores.scoreLabel}
              </span>
              <div className={styles.scoreRow}>
                <span className={styles.bigScore}>74</span>
                <span className={styles.scoreOf}>/ 100</span>
              </div>
              <span className={styles.small} style={{ fontSize: 13.5 }}>
                {c.scores.scoreNote}
              </span>
            </div>
            <div className={styles.scoreCard}>
              <span className={styles.eyebrow} style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>
                {c.scores.depthLabel}
              </span>
              <div className={styles.scoreRow}>
                <span className={styles.bigScore} style={{ '--score': '#e8c04a' } as CSSProperties}>
                  52
                </span>
                <span className={styles.scoreOf}>/ 100</span>
              </div>
              <span className={styles.small} style={{ fontSize: 13.5 }}>
                {c.scores.depthNote}
              </span>
            </div>
            <p className={styles.note} style={{ fontSize: 11.5 }}>
              {c.scores.offline}
            </p>
          </div>
        </div>
      </section>

      <section id="axes" className={styles.bgPage}>
        <div className={styles.container}>
          <SectionHead eyebrow={c.axes.eyebrow} title={c.axes.title} />
          <div className={styles.stack} style={{ gap: 14 }}>
            {c.axes.items.map((axis, i) => {
              const { value, colour } = AXIS_VALUES[i]
              return (
                <div key={axis.name} className={`${styles.card} ${styles.cardRowTight} ${styles.axis}`} style={{ padding: '26px 28px' }}>
                  <div className={styles.axisHead}>
                    <span className={styles.axisName}>{axis.name}</span>
                    <span className={styles.axisMeasure}>{axis.measure}</span>
                  </div>
                  <div className={styles.axisBarCol}>
                    <div
                      className={styles.bar}
                      role="img"
                      aria-label={`${axis.name}: ${value} / 100`}
                    >
                      <div className={styles.barFill} style={{ '--w': `${value}%`, '--c': colour } as CSSProperties} />
                    </div>
                    <span className={styles.small} style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                      {axis.note}
                    </span>
                  </div>
                  <span className={styles.axisValue}>{value}</span>
                </div>
              )
            })}
          </div>
          <p className={styles.note} style={{ fontSize: 12 }}>
            {c.axes.note}
          </p>
        </div>
      </section>

      <section id="findings" className={styles.bgCream}>
        <div className={`${styles.container} ${styles.gapLg}`}>
          <SectionHead eyebrow={c.findings.eyebrow} title={c.findings.title} aside={c.findings.aside} />
          <div className={`${styles.grid} ${styles.gridTight}`} style={minCol(248)}>
            {c.findings.categories.map((category, i) => (
              <div key={category.tag} className={`${styles.card} ${styles.cardPaper}`} style={{ padding: '24px 22px' }}>
                <span
                  className={styles.pill}
                  style={{ '--pill-bg': CATEGORY_COLOURS[i].bg, '--pill-fg': CATEGORY_COLOURS[i].fg } as CSSProperties}
                >
                  {category.tag}
                </span>
                <span className={styles.cardTitle}>{category.title}</span>
                <p className={styles.small} style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                  {category.body}
                </p>
              </div>
            ))}
          </div>

          <div className={`${styles.card} ${styles.cardPaper} ${styles.cardMd}`} style={{ gap: 22, maxWidth: 820 }}>
            <span className={styles.eyebrow} style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--mk-faint)' }}>
              {c.findings.exampleLabel}
            </span>
            <div className={styles.buttons}>
              <span
                className={styles.pill}
                style={{ '--pill-bg': CATEGORY_COLOURS[2].bg, '--pill-fg': CATEGORY_COLOURS[2].fg } as CSSProperties}
              >
                {c.findings.exampleTag}
              </span>
              <span className={styles.small} style={{ fontSize: 12, color: 'var(--mk-muted)' }}>
                {c.findings.exampleWhere}
              </span>
            </div>
            <p className={`${styles.text} ${styles.inkText}`} style={{ fontSize: 17, lineHeight: 1.7 }}>
              {c.findings.exampleBody}
            </p>
            <div className={styles.quoteBar}>
              <p className={`${styles.text} ${styles.italic}`} style={{ lineHeight: 1.7 }}>
                {c.findings.exampleQuote}
              </p>
            </div>
            <div className={styles.nextTip}>
              <span className={styles.nextIcon} aria-hidden="true">
                →
              </span>
              <p className={`${styles.small} ${styles.inkText}`} style={{ fontSize: 14.5 }}>
                <strong>{c.findings.nextLabel}</strong>
                {c.findings.nextBody}
              </p>
            </div>
            <p className={styles.note} style={{ fontSize: 11.5 }}>
              {c.findings.exampleNote}
            </p>
          </div>
        </div>
      </section>

      <section id="letter" className={styles.bgPage}>
        <div className={styles.split}>
          <div className={styles.col}>
            <span className={styles.eyebrow}>{c.letter.eyebrow}</span>
            <h2 className={styles.h2}>{c.letter.title}</h2>
            <p className={styles.text}>{c.letter.p1}</p>
            <p className={styles.text}>{c.letter.p2}</p>
            <div className={styles.buttons} style={{ paddingTop: 4 }}>
              <Link to="/home" className={`${styles.btnLime} ${styles.btnSm}`}>
                {c.letter.primary}
              </Link>
              <Link to="/students" className={`${styles.btnGhost} ${styles.btnSm}`}>
                {c.letter.secondary}
              </Link>
            </div>
          </div>
          <div className={styles.letterCard}>
            <div className={styles.letterHead}>
              <img src="/assets/avatars/yuzuki.png" alt="" className={styles.letterAvatar} />
              <div className={styles.stack} style={{ gap: 2 }}>
                <span className={styles.cardTitle} style={{ fontSize: 14 }}>
                  Yuzuki Akatsuki
                </span>
                <span className={styles.small} style={{ fontSize: 11.5, color: 'var(--mk-muted)' }}>
                  {c.letter.wrote}
                </span>
              </div>
            </div>
            <div className={styles.letterBody}>
              <p>{c.letter.letter1}</p>
              <p>{c.letter.letter2}</p>
              <p className={styles.letterSign}>{c.letter.sign}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
