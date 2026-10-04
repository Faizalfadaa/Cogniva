import { Link } from 'react-router-dom'
import styles from '../Marketing.module.css'
import { PageHero, SectionHead, minCol } from '../blocks'
import { useLocale } from '../../../i18n/LanguageProvider'
import type { Locale } from '../../../i18n/messages'

const EN = {
  hero: {
    eyebrow: 'Technology · architecture',
    title: 'Six agents, one orchestrator, no agent calling another.',
    lead: "A single-page app served by a modular monolith, with a separate Python service for the student's voice. The web stack is TypeScript end to end, so the data contracts, validated at runtime with Zod, have one definition and cannot drift between client and server.",
    links: [
      { href: '#layers', label: 'Four layers' },
      { href: '#agents', label: 'The six agents' },
      { href: '#retrieval', label: 'Retrieval' },
      { href: '#voice', label: 'The voice service' },
      { href: '#reliability', label: 'Reliability & cost' },
      { href: '#stack', label: 'Stack & deployment' },
    ],
  },
  invariants: [
    { tag: 'Invariant 1', body: 'The student never holds the answer key. Retrieval is exported to the Evaluator path only.' },
    { tag: 'Invariant 2', body: "Agents never call each other. Even the Learner's tools are closures the orchestrator injects and executes." },
    { tag: 'Invariant 3', body: 'The app runs with no AI dependency at all. Every model call has a deterministic fallback.' },
  ],
  layers: {
    eyebrow: 'Four layers',
    title: 'Each layer has one responsibility',
    items: [
      { name: 'Frontend', tech: 'React 18 SPA', body: 'Captures input (board snapshots, audio clips, the change timeline, chat) and renders whatever the backend returns. It holds no pedagogical logic whatsoever.', parts: ['Whiteboard', 'Learner stage & chat', 'Session setup & Referencer UI', 'Debrief & i18n'], dark: false },
      { name: 'Backend', tech: 'Fastify 5 · modular monolith', body: 'Owns sessions, workspaces and their state machine, runs teaching turns, persists everything, meters token usage and serves the API.', parts: ['Orchestrator', 'Workspace service', 'Session state machine', 'Auth & storage context'], dark: true },
      { name: 'AI agents', tech: 'stateless, each with a guard and a mock', body: 'Six modules, each split into a type contract, the model call, a guard that normalises the output, and a deterministic mock for offline use.', parts: ['Planner', 'Vision', 'ASR', 'Learner', 'Evaluator', 'Referencer'], dark: false },
      { name: 'Data & external', tech: 'PostgreSQL 16 · Gemini · voice', body: 'All durable state in Postgres; Gemini for language, vision, audio and embeddings behind a single wrapper; Google Search grounding; the optional voice service.', parts: ['Prisma 7 · 15 tables', 'Gemini 2.5 Flash', 'embedding-001', 'Chatterbox Turbo'], dark: false },
    ],
    note: 'Heavy work (a teaching turn, a chat reply, an evaluation, voice synthesis) runs in the background: the request that starts it returns at once and the client polls for the result. A bridge interface separates the UI from transport, with a real implementation over HTTP and an in-memory mock, so the entire interface can run with no backend at all.',
  },
  agents: {
    eyebrow: 'The six agents',
    title: 'Types, agent, guard, mock: four parts each.',
    aside: 'That pattern is what keeps six model integrations maintainable. The guard normalises whatever comes back (unknown values dropped, numbers clamped, missing fields defaulted), so nothing downstream ever sees raw model output.',
    agenticLabel: 'Agentic behaviour',
    items: [
      { name: 'Planner', when: 'before and during every turn', makes: 'The next steps for the turn, each with a reason.', agentic: 'Re-plans when a step surprises it, at most once. A rule engine sits behind the model, so it always has an answer.' },
      { name: 'Vision', when: 'when the board changed', makes: 'Transcribed text, typed elements with per-element confidence, and a confirmation flag.', agentic: 'Earns a directed second reading on low confidence instead of guessing or interrupting you.' },
      { name: 'ASR', when: 'when an audio clip arrived', makes: 'Transcript, confidence, language code, confirmation flag.', agentic: 'Flags ambiguity rather than guessing; a missing language code defaults to Indonesian.' },
      { name: 'Learner', when: 'every turn and every chat message', makes: 'A student reply and an updated mental model.', agentic: 'A bounded tool-use loop: re-read the board, recall earlier turns, twice at most, then it must reply.' },
      { name: 'Evaluator', when: 'once, when a round is finished', makes: 'Score, depth score, categorised findings with quotes and follow-ups.', agentic: 'Works from retrieved evidence plus a one-line outline, not the whole document.' },
      { name: 'Referencer', when: 'when you ask for sources', makes: 'Four ranked, labelled source options; notes from the one you choose.', agentic: 'Grounded search, a trust policy, one retry naming the hosts it lost, and a direct-fetch fallback.' },
    ],
    vocabTag: "The planner's step vocabulary",
    vocabBody: 'At most five steps and one re-plan per turn. Behind the model sits a rule engine whose decision procedure is total and always terminates, so a turn can never stall, and every executed step is recorded with its source: llm, rules or fallback.',
    vocab: [
      { step: 'read_board', means: "Run Vision over this turn's snapshot" },
      { step: 'reuse_board', means: 'Board is byte-identical by hash: carry the reading over, skip Vision' },
      { step: 'verify_board', means: 'A second, directed pass at the part that came back unsure' },
      { step: 'transcribe_audio', means: "Run ASR over this turn's audio clip" },
      { step: 'ask_learner', means: 'Terminal: hand everything to the student' },
      { step: 'ask_confirmation', means: 'Terminal: pause and ask you to confirm a reading' },
    ],
  },
  retrieval: {
    eyebrow: 'Retrieval',
    title: 'Retrieval, not context stuffing.',
    p1: 'The first edition truncated a PDF at 20,000 characters and pasted it into the prompt, a silent loss of everything past the cut. Reference material is now chunked and indexed once, when it is added, and each evaluation retrieves only what is relevant to what was actually taught.',
    p2: 'The keyword half is not a stub. Embeddings paraphrase well but blur exact tokens, so formulas and names like ATP, NADPH or C₆H₁₂O₆ are matched by keyword score. With no credential, the index runs on TF-IDF alone and the debrief still renders. The stopword list covers English and Indonesian, because the documents students upload are in both.',
    pipeline: [
      { stage: 'Chunker', spec: '900 chars · 150 overlap · heading-aware' },
      { stage: 'Embed', spec: 'gemini-embedding-001 · 768 dimensions' },
      { stage: 'Index', spec: 'stored on the workspace, built once' },
      { stage: 'Queries', spec: 'max 12, derived per turn from the transcript' },
      { stage: 'Hybrid search', spec: '0.7 vector + 0.3 keyword · top 3 each' },
      { stage: 'To the Evaluator', spec: '≤ 8 excerpts + a one-line outline' },
    ],
  },
  voice: {
    eyebrow: 'The voice service',
    title: 'Its own process, and entirely optional.',
    p1: 'Voice cloning models are PyTorch models with no usable Node binding, so the voice runs as a FastAPI process of its own. The backend calls it over HTTP and treats every failure (unreachable, still loading, slow, broken) as “no audio this time”. It sits behind a Compose profile because it adds a model download of roughly three gigabytes.',
    p2: 'Each clip is stored and the UI is handed a URL, so polled payloads never carry audio. A single shared audio element guarantees one clip at a time, and each reply is spoken exactly once even though it appears both on the stage and in the transcript.',
    link: 'How it feels in the session →',
    engines: [
      { name: 'chatterbox-turbo · MIT · default', body: 'The same cloning at roughly twice the speed; ignores the per-voice delivery knobs.', warn: false },
      { name: 'chatterbox · MIT', body: 'Slower, but honours per-voice exaggeration and guidance settings.', warn: false },
      { name: 'xtts · CPML, non-commercial', body: 'Kept as a switch-back option only; must not be used in a paid deployment.', warn: true },
    ],
  },
  reliability: {
    eyebrow: 'Reliability, cost and privacy',
    title: 'How it fails, and what it costs to run',
    cards: [
      { tag: 'Graceful degradation', title: 'No key, still a product', body: 'Every agent has an offline mock, used when there is no API key, when USE_MOCK_AI is set, or when a model call fails. Embeddings, web search and voice each fall back to a smaller working experience.' },
      { tag: 'Cost control', title: 'A session budget that stops kindly', body: 'Per-call usage is metered and a session token budget stops gracefully rather than erroring: finish to see the evaluation, or open a new workspace. A change in model prices can be absorbed by adjusting the cap.' },
      { tag: 'Marginal cost', title: '≈ Rp 1.420 per session with voice', body: 'Four Teach turns and one evaluation is roughly 52,000 input and 10,200 output tokens: about Rp 690 of model time, plus Rp 660 of GPU and Rp 70 of server. Voice roughly doubles it at low volume and falls sharply with scale.' },
      { tag: 'Security & privacy', title: 'Hashed, signed, isolated', body: 'Accounts use hashed passwords and signed session cookies; guest storage is isolated. The database is never exposed outside the Compose network.' },
    ],
    testedTag: 'Tested',
    testedTitle: '216 automated tests across 21 files.',
    testedBody: 'Backend, database and frontend suites on one runner, up from 46 in the first edition. Including the test that locks the on-screen face to the speaking voice, written the day they disagreed.',
    facts: [
      '15 PostgreSQL tables · Prisma 7',
      '10 versioned migrations, applied on boot',
      '463 i18n message keys · 2 languages',
      '4 session states · SETUP → EVALUATED',
    ],
  },
  stack: {
    eyebrow: 'Stack & deployment',
    title: 'Every choice, and why',
    rows: [
      { layer: 'Frontend', tech: 'React 18, Router 6, Zustand, Vite 5', why: 'A lightweight SPA foundation; Zustand keeps user state simple without boilerplate.' },
      { layer: 'Whiteboard', tech: 'Excalidraw 0.18', why: 'A production-grade canvas with export, so no drawing primitives had to be built, and one component in development and production alike.' },
      { layer: 'Backend', tech: 'Node.js 20, Fastify 5, TypeScript', why: 'Fast, with first-class WebSocket support, and it shares contracts with the frontend.' },
      { layer: 'API', tech: 'REST + @fastify/websocket', why: 'REST with polling drives the product; a typed WebSocket protocol drives the live session endpoint.' },
      { layer: 'Validation', tech: 'Zod 3', why: 'Runtime schemas that double as the cross-module data contracts.' },
      { layer: 'Database', tech: 'PostgreSQL 16, Prisma 7', why: 'Relational where the UI queries, JSON where agents store whole payloads.' },
      { layer: 'AI models', tech: 'Gemini 2.5 Flash via @google/genai', why: 'One multimodal family covers text, images, audio, grounding and embeddings behind one wrapper.' },
      { layer: 'Retrieval', tech: 'gemini-embedding-001, TF-IDF', why: 'Hybrid vector and keyword search, with a keyword-only fallback when there is no credential.' },
      { layer: 'Documents', tech: 'unpdf', why: 'Extracts text from uploaded PDFs for the reference index.' },
      { layer: 'Voice', tech: 'Python, FastAPI, Chatterbox Turbo', why: 'Voice cloning with no usable Node binding, isolated in its own process.' },
      { layer: 'Testing', tech: 'Vitest 2', why: 'One runner for backend, database and frontend suites.' },
      { layer: 'Delivery', tech: 'Docker Compose, nginx, Caddy 2', why: 'One command brings up the stack; Caddy provisions HTTPS automatically.' },
    ],
    deployTag: 'Deployment',
    deployBody: 'One Docker Compose command brings up PostgreSQL, the Fastify backend, the nginx-served SPA and Caddy, which provisions HTTPS automatically. Only Caddy publishes host ports. The backend applies pending migrations before starting, so a fresh volume becomes a fully migrated database on first boot.',
    pollTag: 'Why polling, not streaming',
    pollBody: 'Holding a connection open across several model calls and seconds of synthesis adds failure modes without improving what you see. Polling is adaptive: every half second while speech is still rendering, slower otherwise. The typed WebSocket protocol remains available on /ws with its own end-to-end test.',
  },
}

const ID: typeof EN = {
  hero: {
    eyebrow: 'Teknologi · arsitektur',
    title: 'Enam agen, satu orkestrator, tidak ada agen yang memanggil agen lain.',
    lead: 'Aplikasi satu halaman yang dilayani monolit modular, dengan layanan Python terpisah untuk suara murid. Stack web-nya TypeScript dari ujung ke ujung, jadi kontrak datanya, yang divalidasi saat runtime dengan Zod, punya satu definisi dan tidak bisa berbeda antara klien dan server.',
    links: [
      { href: '#layers', label: 'Empat lapisan' },
      { href: '#agents', label: 'Enam agen' },
      { href: '#retrieval', label: 'Pencarian acuan' },
      { href: '#voice', label: 'Layanan suara' },
      { href: '#reliability', label: 'Keandalan & biaya' },
      { href: '#stack', label: 'Stack & deployment' },
    ],
  },
  invariants: [
    { tag: 'Invarian 1', body: 'Murid tidak pernah memegang kunci jawaban. Pencarian acuan hanya diekspor ke jalur Evaluator.' },
    { tag: 'Invarian 2', body: 'Agen tidak pernah saling memanggil. Bahkan alat milik Learner adalah closure yang disuntikkan dan dijalankan orkestrator.' },
    { tag: 'Invarian 3', body: 'Aplikasi berjalan tanpa ketergantungan AI sama sekali. Setiap panggilan model punya cadangan yang deterministik.' },
  ],
  layers: {
    eyebrow: 'Empat lapisan',
    title: 'Setiap lapisan punya satu tanggung jawab',
    items: [
      { name: 'Frontend', tech: 'SPA React 18', body: 'Menangkap masukan (cuplikan papan, klip audio, urutan perubahan, obrolan) dan menampilkan apa pun yang dikembalikan backend. Lapisan ini sama sekali tidak menyimpan logika pedagogis.', parts: ['Papan tulis', 'Panggung murid & obrolan', 'Persiapan sesi & UI Referencer', 'Laporan & i18n'], dark: false },
      { name: 'Backend', tech: 'Fastify 5 · monolit modular', body: 'Mengelola sesi, ruang kerja, dan mesin statusnya, menjalankan giliran mengajar, menyimpan semuanya, mengukur pemakaian token, dan melayani API.', parts: ['Orkestrator', 'Layanan ruang kerja', 'Mesin status sesi', 'Konteks auth & penyimpanan'], dark: true },
      { name: 'Agen AI', tech: 'tanpa state, masing-masing dengan guard dan mock', body: 'Enam modul, masing-masing terbagi jadi kontrak tipe, panggilan model, guard yang menormalkan keluaran, dan mock deterministik untuk dipakai offline.', parts: ['Planner', 'Vision', 'ASR', 'Learner', 'Evaluator', 'Referencer'], dark: false },
      { name: 'Data & eksternal', tech: 'PostgreSQL 16 · Gemini · suara', body: 'Semua data permanen di Postgres; Gemini untuk bahasa, visi, audio, dan embedding di balik satu wrapper; grounding Google Search; layanan suara opsional.', parts: ['Prisma 7 · 15 tabel', 'Gemini 2.5 Flash', 'embedding-001', 'Chatterbox Turbo'], dark: false },
    ],
    note: 'Pekerjaan berat (giliran mengajar, balasan obrolan, penilaian, sintesis suara) berjalan di latar belakang: permintaan yang memulainya langsung kembali dan klien memeriksa hasilnya secara berkala. Antarmuka bridge memisahkan UI dari transport, dengan implementasi nyata lewat HTTP dan mock di memori, jadi seluruh antarmuka bisa berjalan tanpa backend sama sekali.',
  },
  agents: {
    eyebrow: 'Enam agen',
    title: 'Tipe, agen, guard, mock: empat bagian di tiap agen.',
    aside: 'Pola itulah yang membuat enam integrasi model tetap terawat. Guard menormalkan apa pun yang kembali (nilai asing dibuang, angka dibatasi, isian kosong diberi bawaan), jadi tidak ada bagian di hilir yang pernah melihat keluaran model mentah.',
    agenticLabel: 'Perilaku agentik',
    items: [
      { name: 'Planner', when: 'sebelum dan selama setiap giliran', makes: 'Langkah berikutnya untuk giliran itu, masing-masing dengan alasan.', agentic: 'Membuat rencana ulang saat satu langkah memberi hasil tak terduga, paling banyak sekali. Ada mesin aturan di belakang model, jadi selalu ada jawaban.' },
      { name: 'Vision', when: 'saat papan berubah', makes: 'Teks yang ditranskripsikan, elemen bertipe dengan keyakinan per elemen, dan penanda konfirmasi.', agentic: 'Mendapat pembacaan kedua yang terarah saat keyakinannya rendah, alih-alih menebak atau menyelamu.' },
      { name: 'ASR', when: 'saat klip audio masuk', makes: 'Transkrip, keyakinan, kode bahasa, penanda konfirmasi.', agentic: 'Menandai ambiguitas alih-alih menebak; kode bahasa yang kosong otomatis jadi Bahasa Indonesia.' },
      { name: 'Learner', when: 'setiap giliran dan setiap pesan obrolan', makes: 'Balasan murid dan model mental yang diperbarui.', agentic: 'Putaran pemakaian alat yang dibatasi: membaca ulang papan, mengingat giliran sebelumnya, paling banyak dua kali, lalu harus menjawab.' },
      { name: 'Evaluator', when: 'sekali, saat satu putaran selesai', makes: 'Skor, skor kedalaman, temuan berkategori dengan kutipan dan saran lanjutan.', agentic: 'Bekerja dari bukti yang diambil ditambah garis besar satu baris, bukan seluruh dokumen.' },
      { name: 'Referencer', when: 'saat kamu meminta sumber', makes: 'Empat opsi sumber berperingkat dan berlabel; catatan dari sumber yang kamu pilih.', agentic: 'Pencarian berbasis sumber, kebijakan kepercayaan, satu kali coba ulang dengan menyebut host yang hilang, dan cadangan pengambilan langsung.' },
    ],
    vocabTag: 'Kosakata langkah milik planner',
    vocabBody: 'Paling banyak lima langkah dan satu rencana ulang per giliran. Di belakang model ada mesin aturan yang prosedur keputusannya selalu lengkap dan selalu berhenti, jadi satu giliran tidak pernah macet, dan setiap langkah yang dijalankan dicatat bersama sumbernya: llm, rules, atau fallback.',
    vocab: [
      { step: 'read_board', means: 'Jalankan Vision atas cuplikan giliran ini' },
      { step: 'reuse_board', means: 'Papan identik per byte menurut hash: pakai pembacaan sebelumnya, lewati Vision' },
      { step: 'verify_board', means: 'Pembacaan kedua yang terarah pada bagian yang meragukan' },
      { step: 'transcribe_audio', means: 'Jalankan ASR atas klip audio giliran ini' },
      { step: 'ask_learner', means: 'Terminal: serahkan semuanya ke murid' },
      { step: 'ask_confirmation', means: 'Terminal: jeda dan minta kamu mengonfirmasi pembacaan' },
    ],
  },
  retrieval: {
    eyebrow: 'Pencarian acuan',
    title: 'Mencari isi, bukan menjejalkan konteks.',
    p1: 'Edisi pertama memotong PDF di 20.000 karakter lalu menempelkannya ke prompt, sehingga semua yang lewat dari potongan itu hilang diam-diam. Sekarang materi acuan dipotong dan diindeks sekali saat ditambahkan, dan setiap penilaian hanya mengambil bagian yang relevan dengan apa yang benar-benar diajarkan.',
    p2: 'Separuh kata kuncinya bukan tempelan. Embedding pandai menangkap parafrase tapi mengaburkan token persis, jadi rumus dan nama seperti ATP, NADPH, atau C₆H₁₂O₆ dicocokkan lewat skor kata kunci. Tanpa kredensial, indeks berjalan dengan TF-IDF saja dan laporannya tetap tampil. Daftar stopword mencakup bahasa Inggris dan Indonesia, karena dokumen yang diunggah pelajar ada dalam keduanya.',
    pipeline: [
      { stage: 'Pemotong', spec: '900 karakter · tumpang tindih 150 · sadar judul' },
      { stage: 'Embed', spec: 'gemini-embedding-001 · 768 dimensi' },
      { stage: 'Indeks', spec: 'disimpan di ruang kerja, dibangun sekali' },
      { stage: 'Kueri', spec: 'maks 12, diturunkan per giliran dari transkrip' },
      { stage: 'Pencarian hibrida', spec: '0,7 vektor + 0,3 kata kunci · 3 teratas masing-masing' },
      { stage: 'Ke Evaluator', spec: '≤ 8 kutipan + garis besar satu baris' },
    ],
  },
  voice: {
    eyebrow: 'Layanan suara',
    title: 'Proses tersendiri, dan sepenuhnya opsional.',
    p1: 'Model kloning suara adalah model PyTorch tanpa binding Node yang bisa dipakai, jadi suaranya berjalan sebagai proses FastAPI tersendiri. Backend memanggilnya lewat HTTP dan menganggap setiap kegagalan (tidak terjangkau, masih memuat, lambat, rusak) sebagai “kali ini tanpa audio”. Layanan ini ada di balik profil Compose karena menambah unduhan model sekitar tiga gigabyte.',
    p2: 'Setiap klip disimpan dan UI diberi URL-nya, jadi data yang diperiksa berkala tidak pernah membawa audio. Satu elemen audio bersama menjamin hanya satu klip yang diputar, dan setiap balasan diucapkan tepat sekali walaupun muncul di panggung dan di transkrip.',
    link: 'Seperti apa rasanya di sesi →',
    engines: [
      { name: 'chatterbox-turbo · MIT · bawaan', body: 'Kloning yang sama dengan kecepatan sekitar dua kali lipat; mengabaikan pengaturan penyampaian per suara.', warn: false },
      { name: 'chatterbox · MIT', body: 'Lebih lambat, tapi mengikuti pengaturan exaggeration dan guidance per suara.', warn: false },
      { name: 'xtts · CPML, non-komersial', body: 'Hanya disimpan sebagai opsi cadangan; tidak boleh dipakai di deployment berbayar.', warn: true },
    ],
  },
  reliability: {
    eyebrow: 'Keandalan, biaya, dan privasi',
    title: 'Bagaimana ia gagal, dan berapa biaya menjalankannya',
    cards: [
      { tag: 'Turun dengan anggun', title: 'Tanpa key, tetap sebuah produk', body: 'Setiap agen punya mock offline, dipakai saat tidak ada API key, saat USE_MOCK_AI diaktifkan, atau saat panggilan model gagal. Embedding, pencarian web, dan suara masing-masing turun ke pengalaman yang lebih kecil tapi tetap berfungsi.' },
      { tag: 'Kendali biaya', title: 'Batas sesi yang berhenti dengan sopan', body: 'Pemakaian per panggilan diukur, dan batas token sesi berhenti dengan rapi alih-alih error: selesaikan untuk melihat penilaian, atau buka ruang kerja baru. Perubahan harga model bisa diserap dengan menyesuaikan batasnya.' },
      { tag: 'Biaya marginal', title: '≈ Rp 1.420 per sesi dengan suara', body: 'Empat giliran Ajarkan dan satu penilaian kira-kira 52.000 token masukan dan 10.200 token keluaran: sekitar Rp 690 untuk waktu model, ditambah Rp 660 GPU dan Rp 70 server. Suara kira-kira menggandakannya di volume rendah dan turun tajam seiring skala.' },
      { tag: 'Keamanan & privasi', title: 'Di-hash, ditandatangani, terisolasi', body: 'Akun memakai kata sandi ter-hash dan cookie sesi bertanda tangan; penyimpanan tamu terisolasi. Basis data tidak pernah terbuka di luar jaringan Compose.' },
    ],
    testedTag: 'Teruji',
    testedTitle: '216 tes otomatis di 21 file.',
    testedBody: 'Rangkaian tes backend, basis data, dan frontend dalam satu runner, naik dari 46 di edisi pertama. Termasuk tes yang mengunci wajah di layar dengan suara yang berbicara, ditulis di hari keduanya tidak cocok.',
    facts: [
      '15 tabel PostgreSQL · Prisma 7',
      '10 migrasi berversi, diterapkan saat boot',
      '463 kunci pesan i18n · 2 bahasa',
      '4 status sesi · SETUP → EVALUATED',
    ],
  },
  stack: {
    eyebrow: 'Stack & deployment',
    title: 'Setiap pilihan, dan alasannya',
    rows: [
      { layer: 'Frontend', tech: 'React 18, Router 6, Zustand, Vite 5', why: 'Fondasi SPA yang ringan; Zustand menjaga state pengguna tetap sederhana tanpa boilerplate.' },
      { layer: 'Papan tulis', tech: 'Excalidraw 0.18', why: 'Kanvas kelas produksi dengan ekspor, jadi tidak perlu membangun primitif gambar, dan satu komponen untuk pengembangan maupun produksi.' },
      { layer: 'Backend', tech: 'Node.js 20, Fastify 5, TypeScript', why: 'Cepat, mendukung WebSocket dengan baik, dan berbagi kontrak dengan frontend.' },
      { layer: 'API', tech: 'REST + @fastify/websocket', why: 'REST dengan pemeriksaan berkala menjalankan produk; protokol WebSocket bertipe menjalankan endpoint sesi langsung.' },
      { layer: 'Validasi', tech: 'Zod 3', why: 'Skema runtime yang sekaligus jadi kontrak data antar modul.' },
      { layer: 'Basis data', tech: 'PostgreSQL 16, Prisma 7', why: 'Relasional untuk yang di-query UI, JSON untuk agen yang menyimpan payload utuh.' },
      { layer: 'Model AI', tech: 'Gemini 2.5 Flash lewat @google/genai', why: 'Satu keluarga multimodal mencakup teks, gambar, audio, grounding, dan embedding di balik satu wrapper.' },
      { layer: 'Pencarian acuan', tech: 'gemini-embedding-001, TF-IDF', why: 'Pencarian hibrida vektor dan kata kunci, dengan cadangan kata kunci saja saat tidak ada kredensial.' },
      { layer: 'Dokumen', tech: 'unpdf', why: 'Mengekstrak teks dari PDF yang diunggah untuk indeks acuan.' },
      { layer: 'Suara', tech: 'Python, FastAPI, Chatterbox Turbo', why: 'Kloning suara tanpa binding Node yang bisa dipakai, diisolasi di prosesnya sendiri.' },
      { layer: 'Pengujian', tech: 'Vitest 2', why: 'Satu runner untuk tes backend, basis data, dan frontend.' },
      { layer: 'Pengiriman', tech: 'Docker Compose, nginx, Caddy 2', why: 'Satu perintah menyalakan seluruh stack; Caddy menyiapkan HTTPS otomatis.' },
    ],
    deployTag: 'Deployment',
    deployBody: 'Satu perintah Docker Compose menyalakan PostgreSQL, backend Fastify, SPA yang dilayani nginx, dan Caddy yang menyiapkan HTTPS otomatis. Hanya Caddy yang membuka port host. Backend menerapkan migrasi yang tertunda sebelum mulai, jadi volume baru langsung jadi basis data yang termigrasi penuh di boot pertama.',
    pollTag: 'Kenapa pemeriksaan berkala, bukan streaming',
    pollBody: 'Menahan koneksi terbuka selama beberapa panggilan model dan beberapa detik sintesis menambah titik gagal tanpa memperbaiki apa yang kamu lihat. Pemeriksaannya adaptif: setiap setengah detik selama suara masih diproses, lebih jarang di luar itu. Protokol WebSocket bertipe tetap tersedia di /ws dengan tes end-to-end sendiri.',
  },
}

const COPY: Record<Locale, typeof EN> = { en: EN, id: ID }

export default function TechnologyPage() {
  const { locale } = useLocale()
  const c = COPY[locale]

  return (
    <>
      <PageHero {...c.hero} dark />

      <section className={`${styles.bgLime} ${styles.onLime}`}>
        <div className={styles.grid} style={{ ...minCol(280), maxWidth: 1180, margin: '0 auto', padding: '44px var(--mk-gutter)', gap: 28 }}>
          {c.invariants.map((item) => (
            <div key={item.tag} className={styles.stack} style={{ gap: 8 }}>
              <span className={styles.tag}>{item.tag}</span>
              <p className={`${styles.text} ${styles.inkText}`} style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.65 }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="layers" className={styles.bgPage}>
        <div className={styles.container} style={{ gap: 32 }}>
          <SectionHead eyebrow={c.layers.eyebrow} title={c.layers.title} />
          <div className={styles.stack}>
            {c.layers.items.map((layer) => (
              <div
                key={layer.name}
                className={
                  layer.dark
                    ? `${styles.card} ${styles.cardDark} ${styles.cardRowTight} ${styles.onDark}`
                    : `${styles.card} ${styles.cardRowTight}`
                }
                style={{ padding: '26px 28px' }}
              >
                <div className={styles.layerHead}>
                  <span className={styles.layerName}>{layer.name}</span>
                  <span className={styles.layerTech}>{layer.tech}</span>
                </div>
                <div className={styles.cardCol} style={{ flexBasis: 380 }}>
                  <p className={`${styles.small} ${layer.dark ? styles.inkText : ''}`} style={{ fontSize: 14.5, maxWidth: 620 }}>
                    {layer.body}
                  </p>
                  <div className={styles.chips}>
                    {layer.parts.map((part) => (
                      <span key={part} className={styles.chip} style={layer.dark ? undefined : { color: 'var(--mk-body)' }}>
                        {part}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className={styles.text} style={{ fontSize: 15, maxWidth: 760 }}>
            {c.layers.note}
          </p>
        </div>
      </section>

      <section id="agents" className={`${styles.bgForest} ${styles.onDark}`}>
        <div className={`${styles.container} ${styles.gapLg}`}>
          <SectionHead eyebrow={c.agents.eyebrow} title={c.agents.title} aside={c.agents.aside} />
          <div className={styles.stack}>
            {c.agents.items.map((agent) => (
              <div key={agent.name} className={`${styles.card} ${styles.cardForest} ${styles.cardRowTight}`} style={{ padding: '26px 28px' }}>
                <div className={styles.layerHead} style={{ flexBasis: 160 }}>
                  <span className={styles.layerName}>{agent.name}</span>
                  <span className={styles.layerTech}>{agent.when}</span>
                </div>
                <p className={`${styles.small} ${styles.inkText} ${styles.agentMakes}`} style={{ fontSize: 14.5 }}>
                  {agent.makes}
                </p>
                <div className={styles.agentMeta}>
                  <span className={styles.dimTag}>{c.agents.agenticLabel}</span>
                  <span className={styles.small} style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                    {agent.agentic}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className={`${styles.card} ${styles.cardForest} ${styles.cardMd} ${styles.cardRow}`}>
            <div className={styles.cardCol} style={{ gap: 14 }}>
              <span className={styles.tag}>{c.agents.vocabTag}</span>
              <p className={styles.text} style={{ fontSize: 15 }}>
                {c.agents.vocabBody}
              </p>
            </div>
            <div className={styles.cardCol} style={{ gap: 9 }}>
              {c.agents.vocab.map((item) => (
                <div key={item.step} className={styles.vocabRow}>
                  <span className={styles.vocabStep}>{item.step}</span>
                  <span className={styles.small} style={{ flex: '1 1 180px', fontSize: 13, lineHeight: 1.6 }}>
                    {item.means}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="retrieval" className={styles.bgPage}>
        <div className={styles.split}>
          <div className={styles.col}>
            <span className={styles.eyebrow}>{c.retrieval.eyebrow}</span>
            <h2 className={styles.h2}>{c.retrieval.title}</h2>
            <p className={styles.text}>{c.retrieval.p1}</p>
            <p className={styles.text}>{c.retrieval.p2}</p>
          </div>
          <div className={styles.colSide} style={{ gap: 12 }}>
            {c.retrieval.pipeline.map((stage) => (
              <div key={stage.stage} className={`${styles.card} ${styles.pipe}`}>
                <span className={styles.pipeStage}>{stage.stage}</span>
                <span className={styles.pipeSpec}>{stage.spec}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="voice" className={styles.bgCream}>
        <div className={styles.split}>
          <div className={styles.col}>
            <span className={styles.eyebrow}>{c.voice.eyebrow}</span>
            <h2 className={styles.h2}>{c.voice.title}</h2>
            <p className={styles.text}>{c.voice.p1}</p>
            <p className={styles.text}>{c.voice.p2}</p>
            <Link to="/students#voice" className={styles.link}>
              {c.voice.link}
            </Link>
          </div>
          <div className={styles.colSide} style={{ gap: 12 }}>
            {c.voice.engines.map((engine) => (
              <div
                key={engine.name}
                className={engine.warn ? `${styles.card} ${styles.warnCard}` : `${styles.card} ${styles.cardPaper}`}
                style={{ padding: '22px 24px', gap: 8 }}
              >
                <span className={styles.cardTitle} style={{ fontSize: 13.5 }}>
                  {engine.name}
                </span>
                <span className={styles.small} style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                  {engine.body}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="reliability" className={styles.bgPage}>
        <div className={styles.container}>
          <SectionHead eyebrow={c.reliability.eyebrow} title={c.reliability.title} />
          <div className={styles.grid} style={minCol(268)}>
            {c.reliability.cards.map((card) => (
              <div key={card.tag} className={styles.card} style={{ gap: 11 }}>
                <span className={styles.tag}>{card.tag}</span>
                <h3 className={`${styles.h3} ${styles.h3Sm}`}>{card.title}</h3>
                <p className={styles.small}>{card.body}</p>
              </div>
            ))}
          </div>
          <div className={`${styles.card} ${styles.cardDark} ${styles.cardMd} ${styles.cardRow} ${styles.alignCenter} ${styles.onDark}`}>
            <div className={styles.cardCol} style={{ flexBasis: 380 }}>
              <span className={styles.tag}>{c.reliability.testedTag}</span>
              <h3 className={styles.h3Lg}>{c.reliability.testedTitle}</h3>
              <p className={styles.text} style={{ fontSize: 15 }}>
                {c.reliability.testedBody}
              </p>
            </div>
            <div className={`${styles.cardCol} ${styles.monoLines}`} style={{ flexBasis: 260 }}>
              {c.reliability.facts.map((fact) => (
                <span key={fact} className={styles.monoLine}>
                  {fact}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="stack" className={styles.bgCream} style={{ borderBottom: 'none' }}>
        <div className={styles.container}>
          <SectionHead eyebrow={c.stack.eyebrow} title={c.stack.title} />
          <div className={styles.rows}>
            {c.stack.rows.map((row) => (
              <div key={row.layer} className={`${styles.row} ${styles.rowCream}`} style={{ padding: '20px 0' }}>
                <span className={styles.rowKey} style={{ flexBasis: 150, fontSize: 14 }}>
                  {row.layer}
                </span>
                <span className={styles.rowMono} style={{ flexBasis: 260 }}>
                  {row.tech}
                </span>
                <span className={styles.rowVal} style={{ flexBasis: 320, maxWidth: 520, fontSize: 14.5 }}>
                  {row.why}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.grid} style={minCol(300)}>
            <div className={`${styles.card} ${styles.cardPaper}`} style={{ padding: '26px 28px', gap: 11 }}>
              <span className={styles.tag}>{c.stack.deployTag}</span>
              <p className={styles.text} style={{ fontSize: 15 }}>
                {c.stack.deployBody}
              </p>
            </div>
            <div className={`${styles.card} ${styles.cardPaper}`} style={{ padding: '26px 28px', gap: 11 }}>
              <span className={styles.tag}>{c.stack.pollTag}</span>
              <p className={styles.text} style={{ fontSize: 15 }}>
                {c.stack.pollBody}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
