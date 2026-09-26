import { Link } from 'react-router-dom'
import styles from '../Marketing.module.css'
import { PageHero, SectionHead, minCol } from '../blocks'
import { TeamSlider } from '../../landing/TeamSlider'
import { useLocale } from '../../../i18n/LanguageProvider'
import type { Locale } from '../../../i18n/messages'

/** The developers and advisor, as listed in the project report. Names are not translated. */
const PEOPLE = [
  'Fauzan Mohamad Abdul Ghani',
  'Tengku Naufal Saqib',
  'Muhammad Ashkar',
  'Rhenaldy Cahyadi Putra',
  'Almer Zain Farisseno',
  'Fayyaz Akmal Lauda',
  'Muhammad Faiz Alfada Dharma',
  'Muh. Hartawan Haidir',
  'Dr. Eng. Ayu Purwarianti, S.T., M.T.',
]

const EN = {
  hero: {
    eyebrow: 'Company · about us',
    title: 'We inverted the loop, because answers were never the hard part.',
    lead: 'Cogniva is a student project from Institut Teknologi Bandung that grew from a hackathon loop into a system built to be relied on. It exists because instant answers are now effortless, and understanding did not get any easier at all.',
    links: [
      { href: '#story', label: 'Why we built it' },
      { href: '#research', label: 'Learning science' },
      { href: '#market', label: 'Where it fits' },
      { href: '#team', label: 'The team' },
      { href: '#roadmap', label: 'Roadmap & known gaps' },
      { href: '#contact', label: 'Contact' },
    ],
  },
  story: {
    eyebrow: 'Why we built it',
    title: 'You can read a chapter four times and still not be able to say it out loud.',
    p1: "That was the starting observation, and it is not unusual. Around 84% of high-school students already use generative AI for schoolwork, and the OECD's 2026 outlook found the pattern that worried us: task performance improves while learning gains do not follow. Flashcards told us we knew things we did not. Explaining out loud to nobody felt silly. So we made the nobody talk back.",
    p2: 'Inverting the relationship changes what a study session is. Instead of consuming an explanation, you produce one: recalling, organising, explaining and then reflecting on where it broke. Those are the behaviours that produce deep, self-regulated learning, and they are exactly the ones an answer engine removes.',
    p3: 'One idea holds from the first screen to the last: you only truly know something when you can teach it.',
    beliefs: [
      { tag: 'What we believe', body: 'Understanding is a performance, not a feeling. If you cannot perform it, you do not have it yet.' },
      { tag: "What we won't do", body: 'No streaks, no leaderboards, no notifications guilting you back. One good session beats thirty nagged ones.' },
      { tag: 'What we say out loud', body: 'A report that only lists strengths is no use to anyone building on it. Our known gaps are published on this page, not buried.' },
    ],
  },
  timeline: {
    eyebrow: 'Four months',
    title: 'From a hackathon loop to a deployed system',
    note: '113 commits, merge commits excluded',
    items: [
      { month: 'June 2026', commits: '47 commits', what: 'Monorepo, shared contracts, Vision, ASR, Learner and Evaluator, the orchestrator, the WebSocket protocol and the first debrief.' },
      { month: 'July 2026', commits: '16 commits', what: 'Excalidraw adopted for production, HTTPS, Docker Compose, local workspaces with autosave, responsive layout.' },
      { month: 'August 2026', commits: '1 commit', what: 'Evaluator retrieval: the change that replaced context stuffing with real search over reference material.' },
      { month: 'September 2026', commits: '49 commits', what: 'Planner-driven orchestration, PostgreSQL persistence, authentication and guest mode, the learner voice, character selection, the reference agent, landing page and tour, a rebuilt debrief, and the bilingual interface.' },
    ],
  },
  research: {
    eyebrow: 'Learning science',
    title: 'Every design rule traces to a finding.',
    aside: "The product is a multimodal descendant of the teachable-agent lineage that began with Betty's Brain: instead of a concept map, you teach a curious AI by writing on a board and explaining aloud.",
    cards: [
      { tag: 'The protégé effect', body: 'Students expend more effort on behalf of a teachable agent than for themselves, and learn more as a result, with the largest gains among lower-achieving learners. Crucially the benefit comes from actually teaching, not from merely expecting to.', source: 'Chase, Chin, Oppezzo & Schwartz · Biswas et al. · Fiorella & Mayer · Duran' },
      { tag: 'Why the AI never lectures', body: "ICAP ranks learning activities from passive through active and constructive to interactive, with the higher tiers producing deeper learning. Answer delivery keeps students in the lower tiers; generating explanations and answering a protégé's questions moves the activity up two.", source: 'Chi & Wylie · Roscoe & Chi' },
      { tag: 'Self-regulated learning', body: "A session maps onto Zimmerman's three phases: forethought in choosing a topic and reference, performance under continuous monitoring while a student probes you, and self-reflection in the categorised debrief. Resuming a workspace carries the last round's gaps into the next round's goals.", source: 'Zimmerman' },
    ],
    mappingTag: 'From research to product',
    mappingHead: { feature: 'Cogniva feature', mechanism: 'Mechanism it exercises', source: 'Grounding' },
    mapping: [
      { feature: 'Teaching a confused AI student', mechanism: 'Protégé effect: more effort for a protégé than for oneself', source: 'Chase et al.; Biswas et al.' },
      { feature: 'Explaining aloud and on the board', mechanism: 'Generative learning through the act of teaching', source: 'Fiorella & Mayer; Duran' },
      { feature: 'The AI asks and wonders, never lectures', mechanism: 'Constructive and interactive engagement', source: 'Chi & Wylie; Roscoe & Chi' },
      { feature: 'Faithful perception preserves mistakes', mechanism: 'Surfacing misconceptions so they can be repaired', source: 'Roscoe & Chi' },
      { feature: 'Depth score separate from correctness', mechanism: 'Knowledge-building versus knowledge-telling', source: 'Roscoe & Chi' },
      { feature: 'Findings with quoted evidence and follow-ups', mechanism: 'Specific, actionable self-reflection', source: 'Zimmerman' },
      { feature: 'Adaptive re-seeding on resume', mechanism: 'Monitoring and iterative goal-setting across cycles', source: 'Zimmerman' },
      { feature: 'Accountable reference sources', mechanism: 'Feedback calibrated against reliable knowledge', source: '–' },
      { feature: 'Native-language interface', mechanism: 'Lower cognitive load for the primary audience', source: '–' },
    ],
    gapTag: "The gap we won't paper over",
    gapTitle: 'There is no Cogniva-specific study yet.',
    gapBody: 'The premise rests on established research, not on our own evidence. The natural study is a pre-test and post-test design comparing students who teach Cogniva against students who review the same material with a conventional AI assistant, measuring conceptual understanding, transfer to new problems, and change in the depth score across rounds. Every bit of session data that study needs is already stored.',
  },
  market: {
    eyebrow: 'Where it fits',
    title: 'The market is full of answer engines. This is the other direction.',
    p1: 'Education is one of the largest sectors in the world, and digital tools still account for a small share of its spending. Willingness to pay for an AI study companion is already demonstrated: Khanmigo went from roughly 68,000 users in 2023–24 to over 1.4 million by mid-2025 at about USD 4 a month.',
    p2: 'What almost nothing in that market does is refuse to answer. An accountable-source policy and evidence-anchored feedback give Cogniva credibility a general chat tool cannot easily claim, and Indonesia-first design gives it a primary audience that most tools reach only in translation.',
    link: "See how it's priced against them →",
    stats: [
      { value: '≈ 84%', body: 'of high-school students already use generative AI for schoolwork', source: 'College Board, 2025', dark: false },
      { value: '1.4M+', body: 'Khanmigo users by mid-2025, up from ≈68,000 two years earlier', source: 'Khan Academy', dark: false },
      { value: 'Rp 1.420', body: 'marginal cost of one full session with voice, the honest basis for any price we set', source: '', dark: true },
    ],
  },
  team: {
    eyebrow: 'The team',
    title: 'Eight students and an advisor, at ITB.',
    aside: 'The developers and advisor named in the project report.',
    developer: 'Developer',
    advisor: 'Advisor',
    institutionLabel: 'Institution',
    institution: 'Institut Teknologi Bandung, Indonesia',
    reportLabel: 'Report',
    report: 'Project Report, Second Edition · September 2026',
    sourceLabel: 'Source',
  },
  roadmap: {
    eyebrow: 'Roadmap & known gaps',
    title: 'The gaps that exist in the code today.',
    aside: 'Published rather than buried, because a list of strengths is no use to anyone building on the system, or deciding whether to trust it.',
    gaps: [
      { gap: 'Learner replies in English only', detail: 'The interface is bilingual, but the Learner prompt pins replies to English. Workspaces already store their language, so the prompt and the speech plan can branch on it.' },
      { gap: 'No Indonesian voice', detail: 'No cloning model supports Indonesian, so Indonesian sessions are silent by design, and the backend still renders English audio for them, which wastes GPU time.' },
      { gap: 'Shared student dialogue', detail: 'The three characters differ in portrait, voice, introduction and framing, but share one reply-generating prompt.' },
      { gap: 'Timeline unused', detail: 'Board changes are timestamped against the audio and stored, but not yet used to align what was drawn with what was said.' },
      { gap: 'Token budget unmeasured', detail: 'The default 50,000-token ceiling sits below the architectural estimate for a four-turn session with evaluation. It should be set from real usage before anything is priced.' },
      { gap: 'No payments', detail: 'Plans are previews: there is no checkout, balance or invoicing.' },
      { gap: 'Voice needs a GPU', detail: 'The Compose profile runs on CPU at 10 to 30 seconds per reply, which is why voice ships as optional.' },
      { gap: 'Migration checksum drift', detail: 'One early migration file was edited after being applied. prisma migrate deploy works, but migrate dev proposes a reset on affected databases.' },
      { gap: 'No learning study yet', detail: 'The educational premise rests on established research, not yet on a Cogniva-specific study.' },
    ],
    nextLabel: 'Next, in order',
    future: [
      { title: 'Learner in the session language', body: 'Pass the workspace language to the Learner prompt and skip synthesis where no voice exists.' },
      { title: 'Character-specific dialogue', body: 'Give each student a persona prompt so temperament shows in what they say, not only how they look.' },
      { title: 'Timeline alignment', body: 'Attach each spoken sentence to the drawing it describes, sharpening both her questions and the evidence.' },
      { title: 'Validation study', body: 'Run the pre-test and post-test design with real students.' },
      { title: 'Monetisation', body: 'Balances, payment integration, usage history and invoices, starting with Sensei.' },
      { title: 'Teacher view', body: 'Class-level aggregation of findings and depth scores for the Sekolah plan.' },
      { title: 'Richer perception', body: 'Region-targeted re-reading of dense boards, and cross-checking spoken terms against written ones.' },
      { title: 'Production voice', body: 'GPU-backed deployment, and an Indonesian voice as soon as a suitable model exists.' },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Three reasons to write to us.',
    body: 'We are a student team, so a reply may take a few days, but the questions below are the ones that genuinely change what gets built next.',
    reasons: [
      { title: 'You teach a class', body: 'The Sekolah plan and its teacher view are unbuilt. Tell us what a class-level report would need to show to be worth opening.' },
      { title: "You'd run the study", body: 'The pre-test and post-test design is specified and the session data is stored. What is missing is students and a researcher.' },
      { title: 'You taught a session', body: 'Tell us which question your student asked that you could not answer. That is the most useful bug report we can get.' },
    ],
    primary: 'Try it first →',
    secondary: 'Read the architecture',
  },
}

const ID: typeof EN = {
  hero: {
    eyebrow: 'Tentang · tentang kami',
    title: 'Kami membalik alurnya, karena jawaban tidak pernah jadi bagian yang sulit.',
    lead: 'Cogniva adalah proyek mahasiswa Institut Teknologi Bandung yang tumbuh dari putaran hackathon menjadi sistem yang dibangun untuk diandalkan. Cogniva ada karena jawaban instan sekarang begitu mudah didapat, sementara memahami tidak jadi lebih mudah sedikit pun.',
    links: [
      { href: '#story', label: 'Kenapa kami membangunnya' },
      { href: '#research', label: 'Ilmu belajar' },
      { href: '#market', label: 'Posisinya di pasar' },
      { href: '#team', label: 'Tim' },
      { href: '#roadmap', label: 'Peta jalan & kekurangan' },
      { href: '#contact', label: 'Kontak' },
    ],
  },
  story: {
    eyebrow: 'Kenapa kami membangunnya',
    title: 'Kamu bisa membaca satu bab empat kali dan tetap tidak bisa menjelaskannya dengan lisan.',
    p1: 'Itulah pengamatan awalnya, dan itu hal yang umum. Sekitar 84% siswa SMA sudah memakai AI generatif untuk tugas sekolah, dan laporan OECD 2026 menemukan pola yang membuat kami khawatir: kinerja tugas naik sementara hasil belajar tidak ikut naik. Kartu hafalan membuat kami merasa tahu hal yang sebenarnya belum kami pahami. Menjelaskan sendirian ke udara terasa konyol. Jadi kami membuat udara itu bisa menjawab.',
    p2: 'Membalik hubungannya mengubah arti sebuah sesi belajar. Alih-alih mengonsumsi penjelasan, kamu membuatnya: mengingat, menyusun, menjelaskan, lalu merenungkan di mana penjelasan itu patah. Itulah perilaku yang menghasilkan belajar yang dalam dan teratur, dan justru itu yang dihilangkan mesin penjawab.',
    p3: 'Satu gagasan berlaku dari layar pertama sampai terakhir: kamu baru benar-benar menguasai sesuatu saat bisa mengajarkannya.',
    beliefs: [
      { tag: 'Yang kami yakini', body: 'Pemahaman adalah sesuatu yang dipraktikkan, bukan dirasakan. Kalau belum bisa mempraktikkannya, kamu belum memilikinya.' },
      { tag: 'Yang tidak akan kami lakukan', body: 'Tidak ada streak, papan peringkat, atau notifikasi yang membuatmu merasa bersalah. Satu sesi yang bagus lebih berharga daripada tiga puluh sesi karena dipaksa.' },
      { tag: 'Yang kami katakan terus terang', body: 'Laporan yang hanya berisi kekuatan tidak berguna bagi siapa pun yang ingin membangun di atasnya. Kekurangan yang kami ketahui dipublikasikan di halaman ini, tidak disembunyikan.' },
    ],
  },
  timeline: {
    eyebrow: 'Empat bulan',
    title: 'Dari putaran hackathon menjadi sistem yang sudah di-deploy',
    note: '113 commit, tanpa commit merge',
    items: [
      { month: 'Juni 2026', commits: '47 commit', what: 'Monorepo, kontrak bersama, Vision, ASR, Learner dan Evaluator, orkestrator, protokol WebSocket, dan laporan pertama.' },
      { month: 'Juli 2026', commits: '16 commit', what: 'Excalidraw dipakai untuk produksi, HTTPS, Docker Compose, ruang kerja lokal dengan simpan otomatis, tata letak responsif.' },
      { month: 'Agustus 2026', commits: '1 commit', what: 'Pencarian acuan untuk Evaluator: perubahan yang mengganti penjejalan konteks dengan pencarian sungguhan atas materi acuan.' },
      { month: 'September 2026', commits: '49 commit', what: 'Orkestrasi berbasis Planner, penyimpanan PostgreSQL, autentikasi dan mode tamu, suara murid, pemilihan karakter, agen referensi, landing page dan tur, laporan yang dibangun ulang, dan antarmuka dua bahasa.' },
    ],
  },
  research: {
    eyebrow: 'Ilmu belajar',
    title: 'Setiap aturan desain berakar pada sebuah temuan.',
    aside: 'Produk ini adalah turunan multimodal dari garis teachable agent yang dimulai oleh Betty\'s Brain: alih-alih peta konsep, kamu mengajari AI yang penasaran dengan menulis di papan dan menjelaskan secara lisan.',
    cards: [
      { tag: 'Efek protégé', body: 'Siswa berusaha lebih keras demi teachable agent daripada demi dirinya sendiri, dan belajar lebih banyak karenanya, dengan kenaikan terbesar pada siswa yang nilainya lebih rendah. Yang penting, manfaatnya datang dari benar-benar mengajar, bukan sekadar berharap akan mengajar.', source: 'Chase, Chin, Oppezzo & Schwartz · Biswas dkk. · Fiorella & Mayer · Duran' },
      { tag: 'Kenapa AI tidak pernah menceramahi', body: 'ICAP mengurutkan kegiatan belajar dari pasif, aktif, konstruktif, sampai interaktif, dengan tingkat lebih tinggi menghasilkan belajar yang lebih dalam. Menerima jawaban menahan siswa di tingkat bawah; membuat penjelasan dan menjawab pertanyaan protégé menaikkan kegiatannya dua tingkat.', source: 'Chi & Wylie · Roscoe & Chi' },
      { tag: 'Belajar yang teratur sendiri', body: 'Satu sesi mengikuti tiga fase Zimmerman: perencanaan saat memilih materi dan acuan, pelaksanaan dengan pemantauan terus-menerus saat murid mengujimu, dan refleksi diri lewat laporan berkategori. Melanjutkan ruang kerja membawa celah putaran lalu ke tujuan putaran berikutnya.', source: 'Zimmerman' },
    ],
    mappingTag: 'Dari riset ke produk',
    mappingHead: { feature: 'Fitur Cogniva', mechanism: 'Mekanisme yang dilatih', source: 'Dasar' },
    mapping: [
      { feature: 'Mengajari murid AI yang bingung', mechanism: 'Efek protégé: usaha lebih demi protégé daripada demi diri sendiri', source: 'Chase dkk.; Biswas dkk.' },
      { feature: 'Menjelaskan secara lisan dan di papan', mechanism: 'Belajar generatif lewat tindakan mengajar', source: 'Fiorella & Mayer; Duran' },
      { feature: 'AI bertanya dan penasaran, tidak menceramahi', mechanism: 'Keterlibatan konstruktif dan interaktif', source: 'Chi & Wylie; Roscoe & Chi' },
      { feature: 'Persepsi yang setia menyimpan kesalahan', mechanism: 'Memunculkan miskonsepsi supaya bisa diperbaiki', source: 'Roscoe & Chi' },
      { feature: 'Skor kedalaman terpisah dari ketepatan', mechanism: 'Membangun pengetahuan versus sekadar menyampaikan', source: 'Roscoe & Chi' },
      { feature: 'Temuan dengan kutipan bukti dan saran lanjutan', mechanism: 'Refleksi diri yang spesifik dan bisa ditindaklanjuti', source: 'Zimmerman' },
      { feature: 'Pengisian ulang adaptif saat dilanjutkan', mechanism: 'Pemantauan dan penetapan tujuan berulang antar siklus', source: 'Zimmerman' },
      { feature: 'Sumber acuan yang bisa dipertanggungjawabkan', mechanism: 'Masukan yang dikalibrasi terhadap pengetahuan yang andal', source: '–' },
      { feature: 'Antarmuka dalam bahasa ibu', mechanism: 'Beban kognitif lebih ringan bagi pengguna utama', source: '–' },
    ],
    gapTag: 'Kekurangan yang tidak akan kami tutupi',
    gapTitle: 'Belum ada studi khusus tentang Cogniva.',
    gapBody: 'Premisnya bersandar pada riset yang sudah mapan, bukan pada bukti kami sendiri. Studi yang wajar adalah desain pre-test dan post-test yang membandingkan siswa yang mengajari Cogniva dengan siswa yang mengulang materi yang sama memakai asisten AI biasa, mengukur pemahaman konsep, penerapan ke soal baru, dan perubahan skor kedalaman antar putaran. Semua data sesi yang dibutuhkan studi itu sudah tersimpan.',
  },
  market: {
    eyebrow: 'Posisinya di pasar',
    title: 'Pasar penuh dengan mesin penjawab. Ini arah sebaliknya.',
    p1: 'Pendidikan adalah salah satu sektor terbesar di dunia, dan alat digital masih mengambil porsi kecil dari pengeluarannya. Kesediaan membayar untuk teman belajar AI sudah terbukti: pengguna Khanmigo naik dari sekitar 68.000 pada 2023–24 menjadi lebih dari 1,4 juta pada pertengahan 2025, dengan harga sekitar USD 4 per bulan.',
    p2: 'Hampir tidak ada di pasar itu yang menolak memberi jawaban. Kebijakan sumber yang bisa dipertanggungjawabkan dan masukan yang berbasis bukti memberi Cogniva kredibilitas yang sulit diklaim alat obrolan umum, dan desain yang mengutamakan Indonesia memberinya pengguna utama yang oleh kebanyakan alat hanya dijangkau lewat terjemahan.',
    link: 'Lihat perbandingan harganya →',
    stats: [
      { value: '≈ 84%', body: 'siswa SMA sudah memakai AI generatif untuk tugas sekolah', source: 'College Board, 2025', dark: false },
      { value: '1,4 jt+', body: 'pengguna Khanmigo pada pertengahan 2025, naik dari ≈68.000 dua tahun sebelumnya', source: 'Khan Academy', dark: false },
      { value: 'Rp 1.420', body: 'biaya marginal satu sesi lengkap dengan suara, dasar jujur untuk harga apa pun yang kami tetapkan', source: '', dark: true },
    ],
  },
  team: {
    eyebrow: 'Tim',
    title: 'Delapan mahasiswa dan satu pembimbing, di ITB.',
    aside: 'Para pengembang dan pembimbing yang tercantum di laporan proyek.',
    developer: 'Pengembang',
    advisor: 'Pembimbing',
    institutionLabel: 'Institusi',
    institution: 'Institut Teknologi Bandung, Indonesia',
    reportLabel: 'Laporan',
    report: 'Laporan Proyek, Edisi Kedua · September 2026',
    sourceLabel: 'Sumber',
  },
  roadmap: {
    eyebrow: 'Peta jalan & kekurangan',
    title: 'Kekurangan yang ada di kode saat ini.',
    aside: 'Dipublikasikan, bukan disembunyikan, karena daftar kekuatan tidak berguna bagi siapa pun yang membangun di atas sistem ini, atau yang sedang memutuskan apakah bisa memercayainya.',
    gaps: [
      { gap: 'Balasan Learner hanya bahasa Inggris', detail: 'Antarmukanya dua bahasa, tapi prompt Learner mengunci balasan ke bahasa Inggris. Ruang kerja sudah menyimpan bahasanya, jadi prompt dan rencana suaranya bisa bercabang berdasarkan itu.' },
      { gap: 'Belum ada suara Bahasa Indonesia', detail: 'Belum ada model kloning yang mendukung Bahasa Indonesia, jadi sesi berbahasa Indonesia memang tanpa suara, dan backend masih membuat audio bahasa Inggris untuknya, yang membuang waktu GPU.' },
      { gap: 'Dialog murid masih sama', detail: 'Ketiga karakter berbeda dalam potret, suara, pengenalan, dan pembingkaian, tapi memakai satu prompt pembuat balasan yang sama.' },
      { gap: 'Urutan waktu belum dipakai', detail: 'Perubahan papan diberi cap waktu terhadap audio dan disimpan, tapi belum dipakai untuk menyelaraskan apa yang digambar dengan apa yang diucapkan.' },
      { gap: 'Batas token belum diukur', detail: 'Batas bawaan 50.000 token masih di bawah perkiraan arsitektur untuk sesi empat giliran dengan penilaian. Angkanya perlu ditetapkan dari pemakaian nyata sebelum ada yang diberi harga.' },
      { gap: 'Belum ada pembayaran', detail: 'Paket masih pratinjau: belum ada pembayaran, saldo, atau tagihan.' },
      { gap: 'Suara butuh GPU', detail: 'Profil Compose berjalan di CPU dengan 10 sampai 30 detik per balasan, karena itu suara dikirim sebagai fitur opsional.' },
      { gap: 'Checksum migrasi bergeser', detail: 'Satu file migrasi awal diubah setelah diterapkan. prisma migrate deploy tetap jalan, tapi migrate dev menyarankan reset di basis data yang terdampak.' },
      { gap: 'Belum ada studi belajar', detail: 'Premis pendidikannya bersandar pada riset yang sudah mapan, belum pada studi khusus tentang Cogniva.' },
    ],
    nextLabel: 'Berikutnya, berurutan',
    future: [
      { title: 'Learner dalam bahasa sesi', body: 'Kirim bahasa ruang kerja ke prompt Learner dan lewati sintesis kalau suaranya tidak ada.' },
      { title: 'Dialog sesuai karakter', body: 'Beri setiap murid prompt karakter sendiri supaya wataknya terlihat dari ucapannya, bukan hanya penampilannya.' },
      { title: 'Penyelarasan urutan waktu', body: 'Kaitkan setiap kalimat lisan dengan gambar yang dijelaskannya, supaya pertanyaan murid dan buktinya sama-sama lebih tajam.' },
      { title: 'Studi validasi', body: 'Jalankan desain pre-test dan post-test dengan siswa sungguhan.' },
      { title: 'Monetisasi', body: 'Saldo, integrasi pembayaran, riwayat pemakaian, dan tagihan, dimulai dari Sensei.' },
      { title: 'Tampilan guru', body: 'Rangkuman temuan dan skor kedalaman per kelas untuk paket Sekolah.' },
      { title: 'Persepsi yang lebih kaya', body: 'Pembacaan ulang yang menyasar area tertentu di papan yang padat, dan pencocokan istilah lisan dengan istilah tertulis.' },
      { title: 'Suara untuk produksi', body: 'Deployment dengan GPU, dan suara Bahasa Indonesia begitu ada model yang cocok.' },
    ],
  },
  contact: {
    eyebrow: 'Kontak',
    title: 'Tiga alasan untuk menghubungi kami.',
    body: 'Kami tim mahasiswa, jadi balasan mungkin butuh beberapa hari, tapi pertanyaan di bawah ini yang benar-benar mengubah apa yang kami bangun berikutnya.',
    reasons: [
      { title: 'Kamu mengajar di kelas', body: 'Paket Sekolah dan tampilan gurunya belum dibangun. Beri tahu kami apa yang perlu ditampilkan laporan tingkat kelas supaya layak dibuka.' },
      { title: 'Kamu mau menjalankan studinya', body: 'Desain pre-test dan post-test sudah dirinci dan data sesinya sudah tersimpan. Yang belum ada adalah siswa dan peneliti.' },
      { title: 'Kamu sudah mengajar satu sesi', body: 'Ceritakan pertanyaan muridmu yang tidak bisa kamu jawab. Itu laporan bug paling berguna yang bisa kami dapat.' },
    ],
    primary: 'Coba dulu →',
    secondary: 'Baca arsitekturnya',
  },
}

const COPY: Record<Locale, typeof EN> = { en: EN, id: ID }

export default function AboutPage() {
  const { locale } = useLocale()
  const c = COPY[locale]
  const people = PEOPLE

  return (
    <>
      <PageHero {...c.hero} />

      <section id="story" className={styles.bgPage}>
        <div className={styles.split}>
          <div className={styles.col} style={{ flexBasis: 460 }}>
            <span className={styles.eyebrow}>{c.story.eyebrow}</span>
            <h2 className={styles.h2}>{c.story.title}</h2>
            <p className={styles.text}>{c.story.p1}</p>
            <p className={styles.text}>{c.story.p2}</p>
            <p className={styles.text}>{c.story.p3}</p>
          </div>
          <div className={styles.colSide}>
            {c.story.beliefs.map((belief) => (
              <div key={belief.tag} className={styles.card} style={{ padding: '24px 26px', gap: 9 }}>
                <span className={styles.tag}>{belief.tag}</span>
                <p className={`${styles.text} ${styles.inkText}`} style={{ fontSize: 15, lineHeight: 1.7 }}>
                  {belief.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.bgForest} ${styles.onDark}`}>
        <div className={styles.container} style={{ paddingTop: 72, paddingBottom: 72, gap: 32 }}>
          <div className={styles.head}>
            <div className={styles.headMain} style={{ gap: 12 }}>
              <span className={styles.eyebrow}>{c.timeline.eyebrow}</span>
              <h2 className={styles.h2} style={{ fontSize: 'clamp(26px, 3vw, 34px)' }}>
                {c.timeline.title}
              </h2>
            </div>
            <span className={styles.note} style={{ fontSize: 12 }}>
              {c.timeline.note}
            </span>
          </div>
          <div className={styles.grid} style={minCol(240)}>
            {c.timeline.items.map((item) => (
              <div key={item.month} className={`${styles.card} ${styles.cardForest}`} style={{ gap: 11 }}>
                <div className={styles.timelineHead}>
                  <span className={styles.cardTitle}>{item.month}</span>
                  <span className={styles.mono} style={{ fontSize: 11.5, color: 'var(--mk-lime)' }}>
                    {item.commits}
                  </span>
                </div>
                <p className={styles.small} style={{ fontSize: 13.5 }}>
                  {item.what}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="research" className={styles.bgPage}>
        <div className={`${styles.container} ${styles.gapLg}`}>
          <SectionHead eyebrow={c.research.eyebrow} title={c.research.title} aside={c.research.aside} />
          <div className={styles.grid} style={minCol(268)}>
            {c.research.cards.map((card) => (
              <div key={card.tag} className={styles.card} style={{ gap: 11 }}>
                <span className={styles.tag}>{card.tag}</span>
                <p className={styles.small} style={{ fontSize: 14.5 }}>
                  {card.body}
                </p>
                <span className={styles.note} style={{ fontSize: 11.5 }}>
                  {card.source}
                </span>
              </div>
            ))}
          </div>

          <div className={`${styles.card} ${styles.cardLg}`} style={{ gap: 22 }}>
            <span className={styles.tag}>{c.research.mappingTag}</span>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{c.research.mappingHead.feature}</th>
                    <th scope="col">{c.research.mappingHead.mechanism}</th>
                    <th scope="col">{c.research.mappingHead.source}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.research.mapping.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <td>{row.mechanism}</td>
                      <td className={styles.mono} style={{ fontSize: 12, color: 'var(--mk-muted)' }}>
                        {row.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${styles.card} ${styles.cardCream} ${styles.cardMd} ${styles.cardRowTight} ${styles.alignCenter}`}>
            <div className={styles.cardCol} style={{ flexBasis: 400, gap: 11 }}>
              <span className={styles.tag} style={{ color: '#6b4e00' }}>
                {c.research.gapTag}
              </span>
              <h3 className={styles.h3Lg} style={{ fontSize: 23 }}>
                {c.research.gapTitle}
              </h3>
            </div>
            <p className={`${styles.text} ${styles.cardCol}`} style={{ fontSize: 15, maxWidth: 460 }}>
              {c.research.gapBody}
            </p>
          </div>
        </div>
      </section>

      <section id="market" className={styles.bgCream}>
        <div className={styles.split}>
          <div className={styles.col}>
            <span className={styles.eyebrow}>{c.market.eyebrow}</span>
            <h2 className={styles.h2}>{c.market.title}</h2>
            <p className={styles.text}>{c.market.p1}</p>
            <p className={styles.text}>{c.market.p2}</p>
            <Link to="/pricing" className={styles.link}>
              {c.market.link}
            </Link>
          </div>
          <div className={styles.colSide}>
            {c.market.stats.map((stat) => (
              <div
                key={stat.value}
                className={
                  stat.dark
                    ? `${styles.card} ${styles.cardDark} ${styles.statCard} ${styles.onDark}`
                    : `${styles.card} ${styles.cardPaper} ${styles.statCard}`
                }
                style={{ padding: '24px 26px' }}
              >
                <span className={styles.statCardValue}>{stat.value}</span>
                <span className={styles.small}>
                  {stat.body}
                  {stat.source && (
                    <span className={styles.mono} style={{ fontSize: 11.5, color: 'var(--mk-muted)' }}>
                      {' '}
                      {stat.source}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="team" className={styles.bgPage}>
        <div className={styles.container}>
          <SectionHead eyebrow={c.team.eyebrow} title={c.team.title} aside={c.team.aside} />
          <TeamSlider people={people} />
          <div className={`${styles.card} ${styles.cardRowTight}`} style={{ padding: '26px 28px' }}>
            <div className={styles.infoCol}>
              <span className={styles.tag}>{c.team.institutionLabel}</span>
              <span className={`${styles.small} ${styles.inkText}`} style={{ fontSize: 14.5 }}>
                {c.team.institution}
              </span>
            </div>
            <div className={styles.infoCol}>
              <span className={styles.tag}>{c.team.reportLabel}</span>
              <span className={`${styles.small} ${styles.inkText}`} style={{ fontSize: 14.5 }}>
                {c.team.report}
              </span>
            </div>
            <div className={styles.infoCol}>
              <span className={styles.tag}>{c.team.sourceLabel}</span>
              <a
                href="https://github.com/Faizalfadaa/Cogniva"
                target="_blank"
                rel="noreferrer"
                className={`${styles.link} ${styles.mono}`}
                style={{ fontSize: 13, fontWeight: 500 }}
              >
                github.com/Faizalfadaa/Cogniva
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="roadmap" className={`${styles.bgForest} ${styles.onDark}`}>
        <div className={`${styles.container} ${styles.gapLg}`}>
          <SectionHead eyebrow={c.roadmap.eyebrow} title={c.roadmap.title} aside={c.roadmap.aside} />
          <div className={styles.stack}>
            {c.roadmap.gaps.map((gap) => (
              <div key={gap.gap} className={`${styles.card} ${styles.cardForest} ${styles.cardRowTight}`} style={{ padding: '22px 26px', borderRadius: 18, gap: 20 }}>
                <span className={styles.gapTitle}>{gap.gap}</span>
                <span className={`${styles.small} ${styles.inkText}`} style={{ flex: '1 1 380px', maxWidth: 660, fontSize: 14.5 }}>
                  {gap.detail}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.stack} style={{ gap: 20 }}>
            <span className={styles.tag} style={{ color: 'var(--mk-on-forest-muted)' }}>
              {c.roadmap.nextLabel}
            </span>
            <div className={`${styles.grid} ${styles.gridTight}`} style={minCol(268)}>
              {c.roadmap.future.map((item, i) => (
                <div key={item.title} className={styles.futureItem}>
                  <span className={styles.futureNo}>{String(i + 1).padStart(2, '0')}</span>
                  <div className={styles.futureText}>
                    <span className={styles.futureTitle}>{item.title}</span>
                    <span className={styles.small} style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                      {item.body}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className={styles.bgPage}>
        <div className={styles.split}>
          <div className={styles.col} style={{ flexBasis: 420 }}>
            <span className={styles.eyebrow}>{c.contact.eyebrow}</span>
            <h2 className={styles.h2}>{c.contact.title}</h2>
            <p className={styles.text}>{c.contact.body}</p>
          </div>
          <div className={styles.colSide} style={{ flexBasis: 360 }}>
            {c.contact.reasons.map((reason) => (
              <div key={reason.title} className={styles.card} style={{ padding: '24px 26px', gap: 8 }}>
                <span className={styles.cardTitle}>{reason.title}</span>
                <p className={styles.small}>{reason.body}</p>
              </div>
            ))}
            <div className={styles.buttons} style={{ paddingTop: 4 }}>
              <Link to="/home" className={`${styles.btnLime} ${styles.btnSm}`}>
                {c.contact.primary}
              </Link>
              <Link to="/technology" className={`${styles.btnGhost} ${styles.btnSm}`}>
                {c.contact.secondary}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
