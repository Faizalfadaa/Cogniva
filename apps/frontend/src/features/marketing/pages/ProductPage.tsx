import { Link } from 'react-router-dom'
import styles from '../Marketing.module.css'
import { PageHero, SectionHead, minCol } from '../blocks'
import { useLocale } from '../../../i18n/LanguageProvider'
import type { Locale } from '../../../i18n/messages'

/** Label colours for the three trust tiers, high to blocked. */
const TRUST_INK = ['#2c4a1f', '#6b4e00', '#a4321c']

const EN = {
  hero: {
    eyebrow: 'Product · how it works',
    title: 'A session follows the rhythm of a real tutoring hour.',
    lead: 'You prepare a topic, explain it, answer what your student did not follow, and then read structured feedback on the explanation itself. The same workspace can be resumed for another round, so the loop closes on itself.',
    links: [
      { href: '#session', label: 'A session, end to end' },
      { href: '#teaching', label: 'Board, voice & chat' },
      { href: '#reference', label: 'Reference material' },
      { href: '#features', label: 'Everything in the product' },
      { href: '#languages', label: 'Two languages' },
    ],
  },
  session: {
    eyebrow: 'Nine steps',
    title: 'A session, end to end',
    steps: [
      { title: 'Arrive', body: 'The public landing page explains the idea and offers sign-in, account creation, or a guest session. The language switch sits in the navigation bar, before anything else.' },
      { title: 'Onboard', body: 'First-time users see a three-step introduction and give the name their student will use. A spotlight tour then walks through the dashboard, and resumes later at the board.' },
      { title: 'Create a workspace', body: 'The workspace inherits the language the dashboard is being read in, and keeps it for life. Every card on the dashboard carries an ID or EN badge next to its state.' },
      { title: 'Pick a student', body: 'Choose who you would like to teach, then set up the session: the topic to be tested, an optional focus, and optional reference material. The panel states plainly that the student never sees it.' },
      { title: 'Teach', body: 'Write and draw on the board, record an explanation, and press Teach. The board snapshot, the audio clip and a timeline of board changes are submitted together as one checkpoint.' },
      { title: 'Listen and respond', body: 'The reply appears on stage and, with the voice service running, is spoken sentence by sentence. The conversation then continues in chat without pressing Teach again.' },
      { title: 'Finish', body: 'The Evaluator runs once over the whole transcript and the reference material. You can leave the page and come back while it works; it keeps running in the background.' },
      { title: 'Reflect', body: 'The debrief shows the score, depth of understanding, four axes, the strongest point and the first thing to fix, every finding with its evidence and follow-up, the annotated transcript, a letter and suggested next topics.' },
      { title: 'Go again', body: 'Resume the same workspace for another round, or start a new one. Each ended round keeps its own evaluation as history rather than overwriting the last.' },
    ],
  },
  teaching: {
    eyebrow: 'Board, voice & chat',
    title: 'The workspace is a split classroom.',
    aside: 'An Excalidraw board fills the canvas and autosaves as a draft. The student appears on stage with a portrait that moves with her own voice, and the full conversation stays visible below it.',
    cards: [
      { tag: 'The board', title: 'Excalidraw, autosaved', body: 'One production-grade canvas in development and production alike, with export, thumbnails for the dashboard, and an audio-visual timeline of what changed when.' },
      { tag: 'Your voice', title: 'Teachers say more than they write', body: 'Record while you draw. The spoken channel is often the richer one, and it is transcribed with its own confidence score: ambiguity is flagged rather than guessed at.' },
      { tag: 'The checkpoint', title: 'One press of Teach', body: 'The snapshot, the audio clip and the change timeline go up together. The request returns at once and the turn runs in the background, so nothing on screen blocks on a model.' },
      { tag: 'Then just talk', title: 'Chat without pressing Teach', body: 'Her question stays in front of you until you deal with it. Answer in chat, or go back and draw it properly. Both count as teaching.' },
    ],
    ruleTag: 'The rule that makes it work',
    ruleTitle: 'Perception keeps your mistakes.',
    ruleBody: 'If you write a wrong equation, Vision reports it exactly as written. If you say the wrong thing aloud, ASR transcribes the error intact. A misconception has to survive perception for the student to be confused by it, and a test locks that in with a deliberately incorrect equation.',
    unsureTag: 'When it is unsure',
    unsureBody: 'Below a confidence of 0.6 the reading asks rather than guesses. The Planner earns one directed second look at the part that came back unsure before you are interrupted at all.',
    breaksTag: 'When something breaks',
    breaksBody: 'One banner, three plain sentences: the session hit its token budget, the connection dropped and your board is still saved on the device, or the AI did not respond and you can press Teach again in a moment.',
  },
  reference: {
    eyebrow: 'Reference material',
    title: 'An answer key the student never sees.',
    aside: 'Students arrive with different things in hand, so there are three ways in. Whatever you supply is chunked, indexed, and routed to the Evaluator only.',
    ways: [
      { no: '01', title: 'Paste your notes', body: 'The fastest path. Anything you already typed up counts as the marking key.' },
      { no: '02', title: 'Upload a PDF', body: 'Text is extracted, split into overlapping chunks and embedded once, so a hundred-page chapter is retrieved from, not truncated.' },
      { no: '03', title: 'Let the Referencer find one', body: 'A grounded search returns four real, checkable sources. You open them, then pick.' },
      { no: 'or', title: 'Bring nothing at all', body: 'Skip it. The evaluation then judges the quality of the explanation alone, which is a legitimate, if thinner, answer.' },
    ],
    policyTag: 'The source policy',
    policyTitle: '“Is someone answerable for this being right?”',
    policy1: 'What the Referencer finds becomes the marking key. A wrong sentence on an unaccountable page would not merely mislead you; it would mark a correct explanation wrong. So accountability is ranked before relevance.',
    policy2: "A model asked for sources from memory invents plausible URLs that lead nowhere. An option is marked verified only when its host also appears in the search's own grounding metadata. Unverified options are still shown, labelled, and ranked below.",
    trust: [
      { label: 'Trust: high', body: 'Universities, government and intergovernmental bodies, peer-reviewed journals, preprint servers, open-textbook publishers.' },
      { label: 'Trust: medium / low', body: "Publishers with a real editorial process, then hosts we don't recognise, ranked last and labelled rather than hidden." },
      { label: 'Blocked outright', body: 'Open-edit wikis, Q&A and homework sites, note dumps, essay mills, blogging and social platforms. The search is told to follow their references instead, because that is where the accountable source was.' },
    ],
  },
  features: {
    eyebrow: 'Feature inventory',
    title: 'Everything that exists in the product today',
    rows: [
      { area: 'Access', text: 'Landing page with FAQ and plan previews; accounts with hashed passwords and signed session cookies; guest mode; sign-out confirmation; onboarding; spotlight product tour.' },
      { area: 'Dashboard', text: 'Workspace grid with board thumbnails, state and language badges; filters for All, Active and Completed; search across titles and descriptions; rename via the title; delete with confirmation; profile name.' },
      { area: 'Session setup', text: 'Student picker; topic and optional focus; reference material by paste, PDF upload or agent search; skip option for teaching with nothing in hand.' },
      { area: 'Teaching', text: 'Excalidraw board with autosave; audio recording; Teach checkpoints; learner stage with an animated portrait; always-visible transcript; chat; toasts; replay and mute; error banners for budget, network and AI failures.' },
      { area: 'Reference finder', text: 'Four options with publisher, summary, relevance, verified and trust labels; open the source in a new tab before choosing; adopt it into the evaluation.' },
      { area: 'Debrief', text: 'Score, depth score, four-axis radar, highlights, findings slider with source quotes and follow-ups, annotated transcript, letter, notebook data, next topics, resume or start new.' },
      { area: 'Language', text: 'Indonesian and English for every screen; per-workspace fixed language; ID/EN badges; audio only where a voice exists.' },
    ],
  },
  languages: {
    eyebrow: 'Two languages',
    title: 'Indonesian first, English second.',
    p1: 'Every screen exists in both languages across 463 message keys, and the switch is the first control in the navigation bar, so a reader who prefers Indonesian can switch before reading anything else. The sign-in overlay carries its own switch, because someone who cannot read the form cannot sign in.',
    p2: 'A workspace is created in the language its dashboard was read in, and that language is fixed for its lifetime. Every card carries an ID or EN badge next to its state, so a bilingual desk never gets confusing.',
    plainTag: 'Stated plainly',
    plainBody: "The student's replies are still generated in English, even in an Indonesian workspace. The workspace already stores its language; the prompt and speech plan need to branch on it.",
    voiceTag: 'And the voice',
    voiceBody: 'No cloning model supports Indonesian yet, so Indonesian sessions are silent by design. Audio appears only where a voice genuinely exists.',
    link: 'See the full list of known gaps →',
  },
}

const ID: typeof EN = {
  hero: {
    eyebrow: 'Produk · cara kerjanya',
    title: 'Satu sesi mengikuti ritme satu jam les privat sungguhan.',
    lead: 'Kamu menyiapkan materi, menjelaskannya, menjawab bagian yang tidak diikuti muridmu, lalu membaca masukan terstruktur tentang penjelasanmu sendiri. Ruang kerja yang sama bisa dilanjutkan untuk putaran berikutnya, jadi putarannya menyambung.',
    links: [
      { href: '#session', label: 'Satu sesi, dari awal sampai akhir' },
      { href: '#teaching', label: 'Papan, suara & obrolan' },
      { href: '#reference', label: 'Materi acuan' },
      { href: '#features', label: 'Semua yang ada di produk' },
      { href: '#languages', label: 'Dua bahasa' },
    ],
  },
  session: {
    eyebrow: 'Sembilan langkah',
    title: 'Satu sesi, dari awal sampai akhir',
    steps: [
      { title: 'Datang', body: 'Landing page menjelaskan idenya dan menawarkan masuk, membuat akun, atau sesi tamu. Tombol bahasa ada di bilah navigasi, sebelum apa pun.' },
      { title: 'Pengenalan', body: 'Pengguna baru melihat pengenalan tiga langkah dan mengisi nama yang akan dipakai muridnya. Tur sorotan lalu memandu keliling dasbor, dan dilanjutkan nanti di papan.' },
      { title: 'Buat ruang kerja', body: 'Ruang kerja mewarisi bahasa yang sedang dipakai di dasbor, dan memakainya selamanya. Setiap kartu di dasbor punya penanda ID atau EN di samping statusnya.' },
      { title: 'Pilih murid', body: 'Pilih siapa yang ingin kamu ajari, lalu siapkan sesinya: materi yang diuji, fokus opsional, dan materi acuan opsional. Panelnya menyebut dengan jelas bahwa murid tidak pernah melihatnya.' },
      { title: 'Ajarkan', body: 'Tulis dan gambar di papan, rekam penjelasan, lalu tekan Ajarkan. Cuplikan papan, klip audio, dan urutan perubahan papan dikirim bersama sebagai satu checkpoint.' },
      { title: 'Dengarkan dan tanggapi', body: 'Balasan muncul di panggung dan, kalau layanan suara berjalan, diucapkan kalimat demi kalimat. Percakapan lalu berlanjut lewat obrolan tanpa perlu menekan Ajarkan lagi.' },
      { title: 'Selesai', body: 'Evaluator berjalan sekali atas seluruh transkrip dan materi acuan. Kamu boleh meninggalkan halaman dan kembali selama prosesnya berjalan; ia tetap bekerja di latar belakang.' },
      { title: 'Renungkan', body: 'Laporan menampilkan skor, kedalaman pemahaman, empat sumbu, kekuatan utama dan hal pertama yang perlu diperbaiki, setiap temuan beserta bukti dan saran lanjutannya, transkrip beranotasi, surat, dan usulan materi berikutnya.' },
      { title: 'Ulangi', body: 'Lanjutkan ruang kerja yang sama untuk putaran berikutnya, atau mulai yang baru. Setiap putaran yang selesai menyimpan penilaiannya sendiri sebagai riwayat, tidak menimpa yang sebelumnya.' },
    ],
  },
  teaching: {
    eyebrow: 'Papan, suara & obrolan',
    title: 'Ruang kerjanya adalah kelas yang terbagi dua.',
    aside: 'Papan Excalidraw mengisi kanvas dan tersimpan otomatis sebagai draf. Murid tampil di panggung dengan potret yang bergerak mengikuti suaranya, dan seluruh percakapan tetap terlihat di bawahnya.',
    cards: [
      { tag: 'Papan', title: 'Excalidraw, tersimpan otomatis', body: 'Satu kanvas kelas produksi untuk pengembangan dan produksi, lengkap dengan ekspor, thumbnail untuk dasbor, dan urutan audio-visual tentang apa yang berubah kapan.' },
      { tag: 'Suaramu', title: 'Guru mengucapkan lebih banyak daripada yang ditulis', body: 'Rekam sambil menggambar. Jalur lisan sering lebih kaya, dan ditranskripsikan dengan skor keyakinannya sendiri: bagian yang ambigu ditandai, bukan ditebak.' },
      { tag: 'Checkpoint', title: 'Sekali tekan Ajarkan', body: 'Cuplikan, klip audio, dan urutan perubahan dikirim bersama. Permintaannya langsung kembali dan gilirannya berjalan di latar belakang, jadi tidak ada layar yang menunggu model.' },
      { tag: 'Lalu cukup mengobrol', title: 'Obrolan tanpa menekan Ajarkan', body: 'Pertanyaannya tetap ada di depanmu sampai kamu menanggapinya. Jawab lewat obrolan, atau kembali dan gambar dengan benar. Keduanya dihitung sebagai mengajar.' },
    ],
    ruleTag: 'Aturan yang membuatnya berhasil',
    ruleTitle: 'Persepsi menyimpan kesalahanmu.',
    ruleBody: 'Kalau kamu menulis persamaan yang salah, Vision melaporkannya persis seperti yang tertulis. Kalau kamu mengucapkan hal yang salah, ASR mentranskripsikan kesalahan itu apa adanya. Miskonsepsi harus lolos dari persepsi supaya murid bisa bingung karenanya, dan sebuah tes mengunci hal itu dengan persamaan yang sengaja dibuat keliru.',
    unsureTag: 'Saat tidak yakin',
    unsureBody: 'Di bawah keyakinan 0,6, pembacaan akan bertanya, bukan menebak. Planner mendapat satu kali pembacaan ulang yang terarah pada bagian yang meragukan sebelum kamu disela sama sekali.',
    breaksTag: 'Saat ada yang rusak',
    breaksBody: 'Satu banner, tiga kalimat sederhana: sesi mencapai batas token, koneksi terputus dan papanmu masih tersimpan di perangkat, atau AI tidak merespons dan kamu bisa menekan Ajarkan lagi sebentar lagi.',
  },
  reference: {
    eyebrow: 'Materi acuan',
    title: 'Kunci jawaban yang tidak pernah dilihat murid.',
    aside: 'Setiap orang datang dengan bekal yang berbeda, jadi ada tiga jalan masuk. Apa pun yang kamu berikan dipotong, diindeks, dan hanya dikirim ke Evaluator.',
    ways: [
      { no: '01', title: 'Tempel catatanmu', body: 'Jalan tercepat. Apa pun yang sudah kamu ketik dihitung sebagai kunci penilaian.' },
      { no: '02', title: 'Unggah PDF', body: 'Teksnya diekstrak, dipecah jadi potongan yang saling tumpang tindih, lalu di-embed sekali, jadi bab seratus halaman bisa dicari isinya, bukan dipotong.' },
      { no: '03', title: 'Biarkan Referencer mencarikan', body: 'Pencarian berbasis sumber mengembalikan empat sumber nyata yang bisa dicek. Kamu membukanya dulu, lalu memilih.' },
      { no: 'atau', title: 'Tidak membawa apa-apa', body: 'Lewati saja. Penilaian lalu menilai kualitas penjelasannya saja, yang tetap sah walau lebih tipis.' },
    ],
    policyTag: 'Kebijakan sumber',
    policyTitle: '“Adakah yang bertanggung jawab atas kebenarannya?”',
    policy1: 'Apa yang ditemukan Referencer menjadi kunci penilaian. Kalimat salah di halaman yang tidak bisa dipertanggungjawabkan tidak hanya menyesatkanmu; kalimat itu akan menilai penjelasan yang benar sebagai salah. Jadi akuntabilitas diurutkan sebelum relevansi.',
    policy2: 'Model yang diminta sumber dari ingatan akan mengarang URL yang terdengar masuk akal tapi tidak mengarah ke mana pun. Sebuah opsi ditandai terverifikasi hanya kalau host-nya juga muncul di metadata grounding milik pencarian itu. Opsi yang belum terverifikasi tetap ditampilkan, diberi label, dan diletakkan di bawah.',
    trust: [
      { label: 'Kepercayaan: tinggi', body: 'Universitas, lembaga pemerintah dan antarpemerintah, jurnal bertelaah sejawat, server pracetak, penerbit buku teks terbuka.' },
      { label: 'Kepercayaan: sedang / rendah', body: 'Penerbit dengan proses editorial yang nyata, lalu host yang tidak kami kenali, diletakkan paling bawah dan diberi label, bukan disembunyikan.' },
      { label: 'Diblokir langsung', body: 'Wiki yang bisa diedit siapa saja, situs tanya jawab dan PR, kumpulan catatan, jasa pembuatan esai, blog, dan media sosial. Pencarian diminta mengikuti referensi mereka, karena di situlah sumber yang bisa dipertanggungjawabkan berada.' },
    ],
  },
  features: {
    eyebrow: 'Daftar fitur',
    title: 'Semua yang ada di produk saat ini',
    rows: [
      { area: 'Akses', text: 'Landing page dengan tanya jawab dan pratinjau paket; akun dengan kata sandi ter-hash dan cookie sesi bertanda tangan; mode tamu; konfirmasi keluar; pengenalan; tur sorotan produk.' },
      { area: 'Dasbor', text: 'Grid ruang kerja dengan thumbnail papan, penanda status dan bahasa; filter Semua, Aktif, dan Selesai; pencarian judul dan deskripsi; ganti nama lewat judul; hapus dengan konfirmasi; nama profil.' },
      { area: 'Persiapan sesi', text: 'Pemilih murid; materi dan fokus opsional; materi acuan lewat tempel, unggah PDF, atau pencarian agen; opsi lewati untuk mengajar tanpa bekal.' },
      { area: 'Mengajar', text: 'Papan Excalidraw dengan simpan otomatis; rekaman audio; checkpoint Ajarkan; panggung murid dengan potret bergerak; transkrip yang selalu terlihat; obrolan; notifikasi; putar ulang dan bisukan; banner error untuk batas token, jaringan, dan kegagalan AI.' },
      { area: 'Pencari referensi', text: 'Empat opsi dengan label penerbit, ringkasan, relevansi, verifikasi, dan kepercayaan; buka sumber di tab baru sebelum memilih; pakai untuk penilaian.' },
      { area: 'Laporan sesi', text: 'Skor, skor kedalaman, radar empat sumbu, sorotan, slider temuan dengan kutipan sumber dan saran lanjutan, transkrip beranotasi, surat, data buku catatan, materi berikutnya, lanjutkan atau mulai baru.' },
      { area: 'Bahasa', text: 'Bahasa Indonesia dan Inggris untuk setiap layar; bahasa tetap per ruang kerja; penanda ID/EN; audio hanya ada di tempat suaranya tersedia.' },
    ],
  },
  languages: {
    eyebrow: 'Dua bahasa',
    title: 'Bahasa Indonesia dulu, Inggris kemudian.',
    p1: 'Setiap layar tersedia dalam dua bahasa lewat 463 kunci pesan, dan tombol bahasanya adalah kontrol pertama di bilah navigasi, jadi pembaca yang lebih suka Bahasa Indonesia bisa beralih sebelum membaca apa pun. Jendela masuk punya tombol bahasanya sendiri, karena orang yang tidak bisa membaca formulirnya tidak bisa masuk.',
    p2: 'Ruang kerja dibuat dalam bahasa yang sedang dipakai di dasbornya, dan bahasa itu tetap selama ruang kerja itu ada. Setiap kartu punya penanda ID atau EN di samping statusnya, jadi meja dua bahasa tidak pernah membingungkan.',
    plainTag: 'Terus terang',
    plainBody: 'Balasan murid masih dibuat dalam bahasa Inggris, bahkan di ruang kerja berbahasa Indonesia. Ruang kerjanya sudah menyimpan bahasanya; prompt dan rencana suaranya perlu bercabang berdasarkan itu.',
    voiceTag: 'Soal suaranya',
    voiceBody: 'Belum ada model kloning yang mendukung Bahasa Indonesia, jadi sesi berbahasa Indonesia memang dibuat tanpa suara. Audio hanya muncul di tempat suaranya benar-benar ada.',
    link: 'Lihat daftar lengkap kekurangan yang diketahui →',
  },
}

const COPY: Record<Locale, typeof EN> = { en: EN, id: ID }

export default function ProductPage() {
  const { locale } = useLocale()
  const c = COPY[locale]

  return (
    <>
      <PageHero {...c.hero} />

      <section id="session" className={styles.bgPage}>
        <div className={styles.container}>
          <SectionHead eyebrow={c.session.eyebrow} title={c.session.title} />
          <div className={styles.rows}>
            {c.session.steps.map((step, i) => (
              <div key={step.title} className={styles.row}>
                <span className={`${styles.rowKey} ${styles.rowKeyNumbered}`}>
                  <span className={styles.rowNo}>{String(i + 1).padStart(2, '0')}</span>
                  {step.title}
                </span>
                <p className={styles.rowVal} style={{ fontSize: 15.5 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="teaching" className={`${styles.bgForest} ${styles.onDark}`}>
        <div className={`${styles.container} ${styles.gapLg}`}>
          <SectionHead eyebrow={c.teaching.eyebrow} title={c.teaching.title} aside={c.teaching.aside} />
          <div className={styles.grid} style={minCol(268)}>
            {c.teaching.cards.map((card) => (
              <div key={card.tag} className={`${styles.card} ${styles.cardForest}`}>
                <span className={styles.tag}>{card.tag}</span>
                <h3 className={styles.h3}>{card.title}</h3>
                <p className={styles.small}>{card.body}</p>
              </div>
            ))}
          </div>

          <div className={`${styles.card} ${styles.cardLime} ${styles.cardMd} ${styles.cardRowTight} ${styles.alignCenter} ${styles.onLime}`}>
            <div className={styles.cardCol}>
              <span className={styles.tag}>{c.teaching.ruleTag}</span>
              <h3 className={styles.h3Lg}>{c.teaching.ruleTitle}</h3>
            </div>
            <p className={`${styles.text} ${styles.cardCol}`} style={{ maxWidth: 480 }}>
              {c.teaching.ruleBody}
            </p>
          </div>

          <div className={styles.grid} style={minCol(300)}>
            <div className={`${styles.card} ${styles.cardForest}`}>
              <span className={styles.tag} style={{ color: 'var(--mk-on-forest-muted)' }}>
                {c.teaching.unsureTag}
              </span>
              <p className={`${styles.small} ${styles.inkText}`}>{c.teaching.unsureBody}</p>
            </div>
            <div className={`${styles.card} ${styles.cardForest}`}>
              <span className={styles.tag} style={{ color: 'var(--mk-on-forest-muted)' }}>
                {c.teaching.breaksTag}
              </span>
              <p className={`${styles.small} ${styles.inkText}`}>{c.teaching.breaksBody}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="reference" className={styles.bgPage}>
        <div className={`${styles.container} ${styles.gapLg}`}>
          <SectionHead eyebrow={c.reference.eyebrow} title={c.reference.title} aside={c.reference.aside} />
          <div className={styles.grid} style={minCol(258)}>
            {c.reference.ways.map((way, i) => (
              <div key={way.no} className={i === 3 ? `${styles.card} ${styles.cardCream}` : styles.card}>
                <span className={styles.num}>{way.no}</span>
                <h3 className={styles.h3}>{way.title}</h3>
                <p className={styles.small}>{way.body}</p>
              </div>
            ))}
          </div>

          <div className={`${styles.card} ${styles.cardLg} ${styles.cardRowTight}`}>
            <div className={styles.cardCol} style={{ gap: 14, flexBasis: 380 }}>
              <span className={styles.tag}>{c.reference.policyTag}</span>
              <h3 className={styles.h3Lg} style={{ fontSize: 25 }}>
                {c.reference.policyTitle}
              </h3>
              <p className={styles.text} style={{ fontSize: 15 }}>
                {c.reference.policy1}
              </p>
              <p className={styles.text} style={{ fontSize: 15 }}>
                {c.reference.policy2}
              </p>
            </div>
            <div className={styles.cardCol} style={{ flexBasis: 300 }}>
              {c.reference.trust.map((tier, i) => (
                <div
                  key={tier.label}
                  className={`${styles.card} ${styles.cardParchment}`}
                  style={i === 2 ? { background: '#fbe3dd' } : undefined}
                >
                  <span className={styles.tag} style={{ color: TRUST_INK[i], letterSpacing: '0.1em', fontSize: 11 }}>
                    {tier.label}
                  </span>
                  <span className={styles.small} style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                    {tier.body}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.bgCream}>
        <div className={styles.container}>
          <SectionHead eyebrow={c.features.eyebrow} title={c.features.title} />
          <div className={styles.rows}>
            {c.features.rows.map((row) => (
              <div key={row.area} className={`${styles.row} ${styles.rowCream}`}>
                <span className={styles.rowKey} style={{ flexBasis: 190 }}>
                  {row.area}
                </span>
                <p className={styles.rowVal}>{row.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="languages" className={styles.bgPage}>
        <div className={styles.split}>
          <div className={styles.col}>
            <span className={styles.eyebrow}>{c.languages.eyebrow}</span>
            <h2 className={styles.h2}>{c.languages.title}</h2>
            <p className={styles.text}>{c.languages.p1}</p>
            <p className={styles.text}>{c.languages.p2}</p>
          </div>
          <div className={styles.colSide}>
            <div className={styles.card}>
              <span className={styles.tag}>{c.languages.plainTag}</span>
              <p className={`${styles.small} ${styles.inkText}`}>{c.languages.plainBody}</p>
            </div>
            <div className={styles.card}>
              <span className={styles.tag}>{c.languages.voiceTag}</span>
              <p className={`${styles.small} ${styles.inkText}`}>{c.languages.voiceBody}</p>
            </div>
            <Link to="/about#roadmap" className={styles.link}>
              {c.languages.link}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
