import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import styles from '../Marketing.module.css'
import { PageHero, SectionHead, minCol } from '../blocks'
import { LEARNERS, learnerCopy } from '../../../lib/Learner'
import { useLocale } from '../../../i18n/LanguageProvider'
import type { Locale } from '../../../i18n/messages'

/** Portrait tint and accent ink per student, as on the sample canvases. */
const LOOK: Record<string, { tint: string; ink: string }> = {
  yuzuki: { tint: '#dfe8c0', ink: '#3a4d12' },
  reina: { tint: '#d9dbef', ink: '#3a3f6b' },
  akira: { tint: '#f0dcc4', ink: '#6b4a1f' },
}

const EN = {
  hero: {
    eyebrow: 'Product · the AI students',
    title: "Three students. You don't get to pick twice.",
    lead: 'You choose one when a workspace is first opened, and the choice is stored on the workspace, so the same face and the same voice return on every visit and on every device. They differ in temperament, which changes the kind of pressure they put on an explanation.',
    links: [
      { href: '#cast', label: 'The cast' },
      { href: '#mind', label: 'How the student thinks' },
      { href: '#voice', label: 'Her voice' },
      { href: '#honest', label: "What isn't finished" },
    ],
  },
  cast: {
    yuzuki: { body: 'She apologises before every question, and then asks the sharpest one in the session. Yuzuki is the student who will admit, in writing, that she copied your diagram without following it, which is the most useful sentence in a debrief. Teach her when you want to find out whether your explanation held up under polite, relentless attention.', pressure: 'pressure · detail' },
    reina: { body: 'Enthusiastic to the point of chaos. Reina jumps three steps ahead of where you are, which is exactly how you discover your explanation never had a step two. Teach her when you suspect your understanding is a sequence of confident conclusions with the reasoning quietly missing.', pressure: 'pressure · structure' },
    akira: { body: 'Says the quiet part out loud. If a section of your explanation was filler, his letter names it as filler. Akira is the least comfortable one to teach and usually the most productive: he will not politely fill your gaps in for you, and he does not pretend a nod was understanding.', pressure: 'pressure · substance' },
    note: 'Each character opens a new workspace with a short introduction: “Connecting you to a student…”, then a few lines in character, addressing you by name with the honorific sensei. Portraits, traits, descriptions and opening lines all follow your interface language.',
  },
  mind: {
    eyebrow: 'How the student thinks',
    title: 'A genuine agent, not a single prompt.',
    aside: 'Her goal is to understand your explanation and surface her own gaps, while always remaining a student. She can investigate before she asks, and she is bounded so a turn can never run away.',
    cards: [
      { tag: 'Mental model', title: 'What she carries between turns', body: 'Concepts she now understands, misconceptions currently active, gaps not yet filled, and questions she has already asked, so she never asks the same thing twice.', dark: false },
      { tag: 'Believably new', title: 'Seeded with real misconceptions', body: 'A new session starts with up to three plausible misconceptions drawn from the topic, so she is genuinely new to the material rather than blank.', dark: false },
      { tag: 'She remembers', title: 'Re-seeded from last round', body: 'Resume a finished workspace and her state is rebuilt from the evaluation: the concepts you missed or got wrong become exactly what she is curious about next.', dark: true },
      { tag: 'Bounded', title: 'Two tools, then she must reply', body: 'She may re-read part of the board or recall an earlier turn, at most twice per turn and never the same call twice. Then she has to say something.', dark: false },
    ],
    answerTag: 'Five ways she can answer',
    answer1: 'Every reply is typed (a question, a confusion, an acknowledgment or a paraphrase) and records what triggered it: a gap, a misconception, or new information you just gave her.',
    answer2: 'A guard flags teacher-like or overly long text as unsafe and coerces it back into a student-shaped reply, so the persona holds even when the model does not. She will not lecture you, ever.',
    moves: [
      'ask_clarification: “which box, the first or the second?”',
      'request_example: “can you show me one?”',
      'challenge_claim: “but you said the opposite earlier”',
      "paraphrase: “so it's like a spare room for CO₂?”",
      'attempt_problem: she tries it herself, and gets it wrong',
    ],
  },
  voice: {
    eyebrow: 'Her voice',
    title: 'Hearing her changes it from operating software to talking to someone.',
    aside: 'It is also the most operationally demanding part of the system, so it is built to be entirely optional. Nothing in the app breaks when the voice service is off.',
    steps: [
      { title: 'Split into sentences', body: 'The reply is cut on punctuation, closing quotes kept with their sentence, fragments under four words merged with a neighbour, and capped at four pieces without dropping a word.' },
      { title: 'Rendered in order', body: 'The first clip is ready after synthesising only the first sentence; the rest render behind it. She starts speaking while she is still being given words.' },
      { title: 'Revealed in step', body: "The client holds the words and shows each sentence as its clip starts playing. The live amplitude drives the portrait's motion, so she only moves while actually speaking." },
      { title: 'Never hidden behind audio', body: 'If a clip takes longer than eight seconds, the remaining text is shown anyway. Words must never wait behind a voice that is not coming.' },
    ],
    bugTag: 'A bug worth admitting',
    bugBody: "The voice the backend speaks in is resolved exactly the way the interface resolves the face on screen (your pick, or a stable hash of the workspace id), and a test now locks the two together. That test exists because they once disagreed: a workspace showing Yuzuki spoke in Akira's voice.",
    specs: [
      'engine · chatterbox-turbo (MIT), default',
      'service · Python + FastAPI, its own process',
      'failure · unreachable, loading, slow or broken all mean “no audio this time”',
      'settings · per-character decoding in voices.json, editable without a restart',
    ],
  },
  honest: {
    eyebrow: "What isn't finished",
    title: 'The three of them share one dialogue prompt.',
    body: 'Yuzuki, Reina and Akira differ in portrait, voice, introduction and how the debrief is framed. The prompt that generates their replies, however, is shared, so their dialogue does not yet differ by temperament. Giving each a persona prompt is next on the list, and we would rather say so than let the character cards over-promise.',
    link: 'The rest of the roadmap →',
    gaps: [
      { strong: 'No Indonesian voice.', rest: ' No cloning model supports it yet, so Indonesian sessions are silent by design.' },
      { strong: 'Replies are English-only.', rest: ' The interface is bilingual; the Learner prompt is not, yet.' },
      { strong: 'Voice wants a GPU.', rest: ' On CPU a reply takes 10 to 30 seconds, which is why it ships behind an optional profile.' },
    ],
  },
}

const ID: typeof EN = {
  hero: {
    eyebrow: 'Produk · murid-murid AI',
    title: 'Tiga murid. Kamu tidak bisa memilih dua kali.',
    lead: 'Kamu memilih salah satunya saat ruang kerja pertama kali dibuka, dan pilihan itu disimpan di ruang kerja, jadi wajah dan suara yang sama muncul lagi setiap kali kamu datang, di perangkat mana pun. Mereka berbeda watak, dan itu mengubah jenis tekanan yang mereka berikan pada sebuah penjelasan.',
    links: [
      { href: '#cast', label: 'Para pemeran' },
      { href: '#mind', label: 'Cara murid berpikir' },
      { href: '#voice', label: 'Suaranya' },
      { href: '#honest', label: 'Yang belum selesai' },
    ],
  },
  cast: {
    yuzuki: { body: 'Dia minta maaf sebelum setiap pertanyaan, lalu melontarkan pertanyaan paling tajam di sesi itu. Yuzuki adalah murid yang mau mengaku, secara tertulis, bahwa dia menyalin diagrammu tanpa benar-benar mengikutinya, dan itu kalimat paling berguna di sebuah laporan. Ajari dia kalau kamu ingin tahu apakah penjelasanmu tahan terhadap perhatian yang sopan tapi tidak kenal lelah.', pressure: 'tekanan · detail' },
    reina: { body: 'Semangatnya sampai bikin kacau. Reina melompat tiga langkah di depanmu, dan justru dari situ kamu sadar penjelasanmu tidak pernah punya langkah kedua. Ajari dia kalau kamu curiga pemahamanmu hanya deretan kesimpulan yang yakin tanpa penalaran di antaranya.', pressure: 'tekanan · struktur' },
    akira: { body: 'Mengucapkan hal yang orang lain cuma pikirkan. Kalau ada bagian penjelasanmu yang sekadar pengisi, suratnya akan menyebutnya pengisi. Akira paling tidak nyaman untuk diajari dan biasanya paling produktif: dia tidak akan menambal celahmu dengan sopan, dan tidak berpura-pura anggukan berarti paham.', pressure: 'tekanan · substansi' },
    note: 'Setiap karakter membuka ruang kerja baru dengan pengenalan singkat: “Menghubungkanmu dengan seorang murid…”, lalu beberapa kalimat sesuai wataknya, memanggilmu dengan nama dan sebutan sensei. Potret, watak, deskripsi, dan kalimat pembuka semuanya mengikuti bahasa antarmukamu.',
  },
  mind: {
    eyebrow: 'Cara murid berpikir',
    title: 'Agen sungguhan, bukan satu prompt.',
    aside: 'Tujuannya adalah memahami penjelasanmu dan memunculkan celahnya sendiri, sambil tetap menjadi murid. Dia bisa menyelidiki dulu sebelum bertanya, dan dibatasi supaya satu giliran tidak pernah lepas kendali.',
    cards: [
      { tag: 'Model mental', title: 'Yang dia bawa antar giliran', body: 'Konsep yang sekarang dia pahami, miskonsepsi yang sedang aktif, celah yang belum terisi, dan pertanyaan yang sudah dia ajukan, jadi dia tidak pernah menanyakan hal yang sama dua kali.', dark: false },
      { tag: 'Benar-benar baru', title: 'Diisi miskonsepsi nyata', body: 'Sesi baru dimulai dengan sampai tiga miskonsepsi yang masuk akal dari materinya, jadi dia benar-benar baru mengenal materi itu, bukan kosong.', dark: false },
      { tag: 'Dia ingat', title: 'Diisi ulang dari putaran lalu', body: 'Lanjutkan ruang kerja yang sudah selesai dan kondisinya dibangun ulang dari penilaian: konsep yang kamu lewatkan atau salah jelaskan menjadi hal yang paling ingin dia ketahui berikutnya.', dark: true },
      { tag: 'Dibatasi', title: 'Dua alat, lalu dia harus menjawab', body: 'Dia boleh membaca ulang sebagian papan atau mengingat giliran sebelumnya, paling banyak dua kali per giliran dan tidak pernah panggilan yang sama dua kali. Setelah itu dia harus mengatakan sesuatu.', dark: false },
    ],
    answerTag: 'Lima cara dia menjawab',
    answer1: 'Setiap balasan punya jenis (pertanyaan, kebingungan, pengakuan, atau parafrase) dan mencatat pemicunya: sebuah celah, miskonsepsi, atau informasi baru yang baru saja kamu berikan.',
    answer2: 'Sebuah guard menandai teks yang terdengar seperti guru atau terlalu panjang sebagai tidak aman lalu memaksanya kembali jadi balasan khas murid, jadi karakternya tetap terjaga walau modelnya tidak. Dia tidak akan pernah menceramahimu.',
    moves: [
      'ask_clarification: “kotak yang mana, pertama atau kedua?”',
      'request_example: “bisa kasih satu contoh?”',
      'challenge_claim: “tapi tadi sensei bilang sebaliknya”',
      'paraphrase: “jadi itu seperti kamar cadangan untuk CO₂?”',
      'attempt_problem: dia mencoba sendiri, dan salah',
    ],
  },
  voice: {
    eyebrow: 'Suaranya',
    title: 'Mendengar suaranya mengubah rasa memakai perangkat lunak jadi berbicara dengan seseorang.',
    aside: 'Bagian ini juga yang paling berat secara operasional, jadi dibangun sepenuhnya opsional. Tidak ada bagian aplikasi yang rusak saat layanan suara mati.',
    steps: [
      { title: 'Dipecah per kalimat', body: 'Balasan dipotong di tanda baca, tanda kutip penutup tetap bersama kalimatnya, potongan di bawah empat kata digabung dengan tetangganya, dan dibatasi empat bagian tanpa kehilangan satu kata pun.' },
      { title: 'Diproses berurutan', body: 'Klip pertama siap setelah hanya kalimat pertama yang disintesis; sisanya diproses di belakangnya. Dia mulai bicara saat masih diberi kata-kata.' },
      { title: 'Ditampilkan bertahap', body: 'Klien menahan teksnya dan menampilkan setiap kalimat saat klipnya mulai diputar. Amplitudo langsung menggerakkan potretnya, jadi dia hanya bergerak saat benar-benar bicara.' },
      { title: 'Tidak pernah tertahan audio', body: 'Kalau satu klip butuh lebih dari delapan detik, teks yang tersisa tetap ditampilkan. Tulisan tidak boleh menunggu suara yang tidak kunjung datang.' },
    ],
    bugTag: 'Bug yang layak diakui',
    bugBody: 'Suara yang dipakai backend ditentukan persis dengan cara antarmuka menentukan wajah di layar (pilihanmu, atau hash tetap dari id ruang kerja), dan sebuah tes sekarang mengunci keduanya. Tes itu ada karena keduanya pernah berbeda: ruang kerja yang menampilkan Yuzuki berbicara dengan suara Akira.',
    specs: [
      'mesin · chatterbox-turbo (MIT), bawaan',
      'layanan · Python + FastAPI, proses tersendiri',
      'kegagalan · tidak terjangkau, memuat, lambat, atau rusak semuanya berarti “kali ini tanpa audio”',
      'pengaturan · decoding per karakter di voices.json, bisa diubah tanpa restart',
    ],
  },
  honest: {
    eyebrow: 'Yang belum selesai',
    title: 'Ketiganya memakai satu prompt dialog yang sama.',
    body: 'Yuzuki, Reina, dan Akira berbeda dalam potret, suara, pengenalan, dan cara laporannya dibingkai. Tapi prompt yang membuat balasan mereka masih sama, jadi dialog mereka belum berbeda sesuai wataknya. Memberi masing-masing prompt karakter sendiri ada di urutan berikutnya, dan kami lebih suka mengatakannya daripada membiarkan kartu karakter menjanjikan terlalu banyak.',
    link: 'Peta jalan selengkapnya →',
    gaps: [
      { strong: 'Belum ada suara Bahasa Indonesia.', rest: ' Belum ada model kloning yang mendukungnya, jadi sesi berbahasa Indonesia memang tanpa suara.' },
      { strong: 'Balasan hanya dalam bahasa Inggris.', rest: ' Antarmukanya dua bahasa; prompt Learner belum.' },
      { strong: 'Suara butuh GPU.', rest: ' Di CPU satu balasan butuh 10 sampai 30 detik, karena itu fitur ini dikirim di balik profil opsional.' },
    ],
  },
}

const COPY: Record<Locale, typeof EN> = { en: EN, id: ID }

export default function StudentsPage() {
  const { locale } = useLocale()
  const c = COPY[locale]

  return (
    <>
      <PageHero {...c.hero} dark />

      <section id="cast" className={styles.bgPage}>
        <div className={`${styles.container} ${styles.gapMd}`}>
          {LEARNERS.map((learner) => {
            const look = LOOK[learner.id]
            const copy = learnerCopy(learner, locale)
            const extra = c.cast[learner.id as 'yuzuki' | 'reina' | 'akira']
            const vars = { '--tint': look.tint, '--ink': look.ink } as CSSProperties
            return (
              <div key={learner.id} className={`${styles.card} ${styles.cardLg} ${styles.cardRow}`} style={vars}>
                <div className={styles.castSide}>
                  <img src={learner.avatarUrl} alt={learner.name} className={styles.castPortrait} />
                  <span className={styles.castTrait}>{copy.traits}</span>
                </div>
                <div className={styles.castMain}>
                  <h2 className={styles.castName}>{learner.name}</h2>
                  <p className={styles.text} style={{ fontSize: 16, maxWidth: 640 }}>
                    {extra.body}
                  </p>
                  <div className={styles.castQuote}>
                    <p>{copy.catchphrase}</p>
                  </div>
                  <div className={styles.chips}>
                    <span className={styles.chip}>portrait · {learner.id}.png</span>
                    <span className={styles.chip}>voice · voices/{learner.id}.wav</span>
                    <span className={styles.chip}>{extra.pressure}</span>
                  </div>
                </div>
              </div>
            )
          })}
          <p className={styles.text} style={{ maxWidth: 760 }}>
            {c.cast.note}
          </p>
        </div>
      </section>

      <section id="mind" className={styles.bgCream}>
        <div className={`${styles.container} ${styles.gapLg}`}>
          <SectionHead eyebrow={c.mind.eyebrow} title={c.mind.title} aside={c.mind.aside} />
          <div className={styles.grid} style={minCol(238)}>
            {c.mind.cards.map((card) => (
              <div
                key={card.tag}
                className={
                  card.dark ? `${styles.card} ${styles.cardDark} ${styles.onDark}` : `${styles.card} ${styles.cardPaper}`
                }
              >
                <span className={styles.tag}>{card.tag}</span>
                <h3 className={`${styles.h3} ${styles.h3Sm}`}>{card.title}</h3>
                <p className={styles.small}>{card.body}</p>
              </div>
            ))}
          </div>

          <div className={`${styles.card} ${styles.cardPaper} ${styles.cardLg} ${styles.cardRow}`}>
            <div className={styles.cardCol} style={{ gap: 14 }}>
              <span className={styles.tag}>{c.mind.answerTag}</span>
              <p className={styles.text} style={{ fontSize: 15 }}>
                {c.mind.answer1}
              </p>
              <p className={styles.text} style={{ fontSize: 15 }}>
                {c.mind.answer2}
              </p>
            </div>
            <div className={styles.cardCol} style={{ gap: 9, flexBasis: 320 }}>
              {c.mind.moves.map((move, i) => (
                <div key={move} className={styles.numberedLine}>
                  <span className={styles.mono}>{String(i + 1).padStart(2, '0')}</span>
                  <span>{move}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="voice" className={styles.bgPage}>
        <div className={`${styles.container} ${styles.gapLg}`}>
          <SectionHead eyebrow={c.voice.eyebrow} title={c.voice.title} aside={c.voice.aside} />
          <div className={styles.grid} style={minCol(258)}>
            {c.voice.steps.map((step, i) => (
              <div key={step.title} className={styles.card}>
                <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className={`${styles.h3} ${styles.h3Sm}`}>{step.title}</h3>
                <p className={styles.small}>{step.body}</p>
              </div>
            ))}
          </div>
          <div className={`${styles.card} ${styles.cardDark} ${styles.cardMd} ${styles.cardRow} ${styles.onDark}`}>
            <div className={styles.cardCol} style={{ flexBasis: 380 }}>
              <span className={styles.tag}>{c.voice.bugTag}</span>
              <p className={`${styles.text} ${styles.inkText}`}>{c.voice.bugBody}</p>
            </div>
            <div className={`${styles.cardCol} ${styles.monoLines}`} style={{ flexBasis: 300 }}>
              {c.voice.specs.map((spec) => (
                <span key={spec} className={styles.monoLine} style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                  {spec}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="honest" className={styles.bgCream}>
        <div className={styles.split}>
          <div className={styles.col}>
            <span className={styles.eyebrow}>{c.honest.eyebrow}</span>
            <h2 className={styles.h2}>{c.honest.title}</h2>
            <p className={styles.text}>{c.honest.body}</p>
            <Link to="/about#roadmap" className={styles.link}>
              {c.honest.link}
            </Link>
          </div>
          <div className={styles.colSide}>
            {c.honest.gaps.map((gap) => (
              <div key={gap.strong} className={`${styles.card} ${styles.cardPaper}`} style={{ padding: '22px 24px' }}>
                <p className={`${styles.small} ${styles.inkText}`} style={{ fontSize: 14.5 }}>
                  <strong>{gap.strong}</strong>
                  {gap.rest}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
