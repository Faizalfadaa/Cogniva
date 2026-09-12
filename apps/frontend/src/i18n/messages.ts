/**
 * Every string the interface shows, in both languages.
 *
 * One flat table rather than a translation library: the app has a few hundred
 * strings and two locales, and a library would add a dependency, a loader and a
 * plural engine for something a typed object already does. The keys are typed,
 * so a missing translation is a compile error rather than an English word
 * surfacing in an Indonesian session.
 *
 * Indonesian is written as a person would say it, not as a literal translation —
 * "Ajarkan" rather than "Mengajar", "Selesaikan sesi" rather than "Sesi akhir".
 * Product names (Cogniva) and the students' names are never translated.
 */

export const LOCALES = ['id', 'en'] as const

export type Locale = (typeof LOCALES)[number]

/** Shown in the language switcher, each in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
}

/** For Intl: thousands separators differ (1.500 vs 1,500), so numbers follow the language too. */
export const LOCALE_TAGS: Record<Locale, string> = {
  id: 'id-ID',
  en: 'en-US',
}

type Entry = Record<Locale, string>

export const messages = {
  // --- common ---------------------------------------------------------------
  'common.cancel': { en: 'Cancel', id: 'Batal' },
  'common.close': { en: 'Close', id: 'Tutup' },
  'common.delete': { en: 'Delete', id: 'Hapus' },
  'common.done': { en: 'Done', id: 'Selesai' },
  'common.send': { en: 'Send', id: 'Kirim' },
  'common.saving': { en: 'Saving...', id: 'Menyimpan...' },
  'common.saved': { en: 'Saved', id: 'Tersimpan' },
  'common.saveFailed': { en: 'Failed to save', id: 'Gagal menyimpan' },
  'common.optional': { en: 'optional', id: 'opsional' },
  'common.language': { en: 'Language', id: 'Bahasa' },
  'common.languageLocked': {
    en: 'This session is in {language}. The language is set when a workspace is created and cannot be changed afterwards.',
    id: 'Sesi ini berbahasa {language}. Bahasa ditetapkan saat ruang kerja dibuat dan tidak bisa diubah setelahnya.',
  },
  'home.workspaceLanguage': { en: 'Language: {language}', id: 'Bahasa: {language}' },

  // --- workspace header -----------------------------------------------------
  'header.backToHome': { en: 'Back to dashboard', id: 'Kembali ke dasbor' },
  'header.homeTitle': { en: 'Back to the Cogniva home page', id: 'Kembali ke halaman utama Cogniva' },
  'header.home': { en: 'Home', id: 'Beranda' },
  'header.untitled': { en: 'Untitled Document', id: 'Dokumen Tanpa Judul' },
  'header.workspaceTitle': { en: 'Workspace title', id: 'Judul ruang kerja' },
  'header.referenceAttached': { en: 'Reference attached', id: 'Acuan terpasang' },
  'header.viewReference': { en: 'View reference material', id: 'Lihat bahan acuan' },
  'header.uploadPdf': { en: 'Reference (PDF)', id: 'Acuan (PDF)' },
  'header.uploadPdfTitle': {
    en: 'Upload reference material (PDF) to ground your evaluation',
    id: 'Unggah bahan acuan (PDF) sebagai dasar penilaian',
  },
  'header.replace': { en: 'Replace', id: 'Ganti' },
  'header.uploading': { en: 'Uploading...', id: 'Mengunggah...' },
  'header.findReference': { en: 'Find reference', id: 'Cari acuan' },
  'header.findReferenceTitle': {
    en: 'Find reference material for this topic',
    id: 'Carikan bahan acuan untuk materi ini',
  },
  'header.record': { en: 'Record', id: 'Rekam' },
  'header.stop': { en: 'Stop', id: 'Berhenti' },
  'header.teach': { en: 'Teach', id: 'Ajarkan' },
  'header.thinking': { en: 'Thinking...', id: 'Sedang berpikir...' },
  'header.continueEditing': { en: 'Continue editing', id: 'Lanjut menulis' },
  'header.finishSession': { en: 'Finish Session', id: 'Selesaikan sesi' },
  'header.finishing': { en: 'Finishing...', id: 'Menyelesaikan...' },
  'header.finishTeaching': { en: 'Finish teaching', id: 'Selesai mengajar' },
  'header.mute': { en: "Mute the learner's voice", id: 'Matikan suara murid' },
  'header.unmute': { en: "Unmute the learner's voice", id: 'Nyalakan suara murid' },
  'header.voiceOn': { en: 'Voice on', id: 'Suara aktif' },
  'header.voiceOff': { en: 'Voice off', id: 'Suara mati' },
  'header.voiceUnavailable': {
    en: 'No voice for this language yet',
    id: 'Suara belum tersedia dalam Bahasa Indonesia',
  },
  'header.startRecording': { en: 'Start recording', id: 'Mulai merekam' },
  'header.stopRecording': { en: 'Stop recording', id: 'Berhenti merekam' },
  'header.recordAudio': { en: 'Start recording audio', id: 'Mulai merekam suara' },
  'header.stopRecordAudio': { en: 'Stop recording audio', id: 'Berhenti merekam suara' },

  // --- picking a student ----------------------------------------------------
  'learnerSelect.title': { en: 'Who would you like to teach?', id: 'Siapa yang mau kamu ajari?' },
  'learnerSelect.subtitle': {
    en: 'Pick a student for this workspace. They will stay with you for the whole session.',
    id: 'Pilih satu murid untuk ruang kerja ini. Dia akan menemanimu sepanjang sesi.',
  },
  'learnerSelect.dialog': { en: 'Choose your student', id: 'Pilih muridmu' },
  'learnerSelect.teach': { en: 'Teach {name}', id: 'Ajari {name}' },

  // --- the learner on stage -------------------------------------------------
  'stage.idle': {
    en: '{name} is waiting. Teach something, or say hi below.',
    id: '{name} sedang menunggu. Ajarkan sesuatu, atau sapa dia di bawah.',
  },
  'stage.nothingSaid': { en: 'Nothing said yet.', id: 'Belum ada yang diucapkan.' },
  'stage.showTranscript': { en: 'Show transcript', id: 'Tampilkan transkrip' },
  'stage.hideTranscript': { en: 'Hide transcript', id: 'Sembunyikan transkrip' },
  'stage.replay': { en: 'Replay', id: 'Putar ulang' },
  'stage.stop': { en: 'Stop', id: 'Hentikan' },
  'stage.replayVoice': { en: "Replay {name}'s voice", id: 'Putar ulang suara {name}' },
  'stage.stopPlayback': { en: 'Stop playback', id: 'Hentikan pemutaran' },
  'stage.playVoice': { en: "Play {name}'s voice", id: 'Putar suara {name}' },
  'stage.say': { en: 'Say something to {name}...', id: 'Katakan sesuatu ke {name}...' },
  'stage.writeMessage': { en: 'Write a message', id: 'Tulis pesan' },
  'stage.openChat': { en: 'Open chat with {name}', id: 'Buka obrolan dengan {name}' },
  'stage.closeChat': { en: 'Close chat', id: 'Tutup obrolan' },
  'stage.closeResponse': { en: 'Close learner response', id: 'Tutup balasan murid' },
  'stage.theLearner': { en: 'the learner', id: 'murid' },
  'dock.empty': { en: 'No messages yet. Say hi to {name}!', id: 'Belum ada pesan. Sapa {name}!' },
  'dock.message': { en: 'Message {name}...', id: 'Kirim pesan ke {name}...' },
  'intro.connecting': { en: 'Connecting you to a student...', id: 'Menghubungkan kamu dengan seorang murid...' },
  'intro.greetings': { en: 'Greetings from,', id: 'Salam dari,' },
  // Stands in for a name the user never gave: "...you-sensei?"
  'intro.you': { en: 'you', id: 'kamu' },
  'stage.messageFrom': {
    en: 'Message from {name}: {text}. Click to open chat.',
    id: 'Pesan dari {name}: {text}. Klik untuk membuka obrolan.',
  },

  // --- session setup --------------------------------------------------------
  'setup.title': { en: 'What are you teaching today?', id: 'Mau mengajarkan apa hari ini?' },
  'setup.subtitle': {
    en: '{name} will learn from your explanation. Write the topic first, so the evaluation at the end looks at what you actually meant to cover.',
    id: '{name} akan belajar dari penjelasanmu. Tulis materinya dulu, supaya penilaian di akhir sesi menyorot hal yang memang ingin kamu uji.',
  },
  'setup.dialog': { en: 'Set up the session', id: 'Siapkan sesi' },
  'setup.topicLabel': { en: 'The topic you want to be tested on', id: 'Materi yang ingin diuji' },
  'setup.topicPlaceholder': {
    en: 'For example: Photosynthesis, Newton’s Laws, the Stack data structure',
    id: 'Misalnya: Fotosintesis, Hukum Newton, Struktur Data Stack',
  },
  'setup.scopeLabel': { en: 'Anything to focus on?', id: 'Bagian mana yang mau ditekankan?' },
  'setup.scopePlaceholder': {
    en: 'For example: just the light reactions, up to the role of chlorophyll',
    id: 'Misalnya: cukup reaksi terang saja, sampai peran klorofil',
  },
  'setup.referenceLabel': { en: 'Reference material', id: 'Bahan acuan penilaian' },
  'setup.referenceHint': {
    en: 'Used by the evaluator at the end to check your explanation. {name} never sees it.',
    id: 'Dipakai penilai di akhir sesi untuk mengecek penjelasanmu. {name} tidak pernah melihatnya.',
  },
  'setup.paste': { en: 'Write or paste material', id: 'Tulis / tempel materi' },
  'setup.upload': { en: 'Upload a PDF', id: 'Unggah PDF' },
  'setup.find': { en: 'Find it for me', id: 'Carikan referensi' },
  'setup.findDisabled': {
    en: 'Write the topic first, so the search knows what to look for',
    id: 'Tulis materinya dulu supaya pencarian tahu harus mencari apa',
  },
  'setup.findEnabled': { en: 'Search for sources on this topic', id: 'Cari sumber untuk topik ini' },
  'setup.pastePlaceholder': {
    en: 'Paste notes, a chapter summary, or the points you should mention...',
    id: 'Tempel catatan, ringkasan bab, atau poin-poin yang harus kamu sebutkan...',
  },
  'setup.characters': { en: '{count} characters', id: '{count} karakter' },
  'setup.saveMaterial': { en: 'Save material', id: 'Simpan materi' },
  'setup.savedMaterial': { en: 'Material saved ({count} characters).', id: 'Materi tersimpan ({count} karakter).' },
  'setup.pdfAttached': { en: 'PDF attached: {name}', id: 'PDF terpasang: {name}' },
  'setup.pdfReady': { en: 'A reference PDF is attached.', id: 'PDF acuan sudah terpasang.' },
  'setup.sourceReady': { en: 'Reference: {title}', id: 'Acuan: {title}' },
  'setup.skip': { en: 'Skip', id: 'Lewati' },
  'setup.start': { en: 'Start teaching', id: 'Mulai mengajar' },
  'setup.starting': { en: 'Saving...', id: 'Menyimpan...' },
  'setup.titleFailed': { en: 'Could not save the topic. Try again.', id: 'Judul materi gagal disimpan. Coba lagi.' },
  'setup.uploadFailed': { en: 'The PDF could not be uploaded. Try another file.', id: 'PDF gagal diunggah. Coba berkas lain.' },
  'setup.materialFailed': { en: 'The material could not be saved. Try again.', id: 'Materi gagal disimpan. Coba lagi.' },

  // --- finding references ---------------------------------------------------
  'reference.title': { en: 'Find reference material', id: 'Cari referensi' },
  'reference.subtitle': {
    en: 'No material of your own? Pick one source to grade your explanation against. The student never sees it — only the evaluator does.',
    id: 'Belum punya bahan sendiri? Pilih satu sumber untuk dipakai menilai penjelasanmu nanti. Materinya tidak pernah dilihat murid — hanya penilai.',
  },
  'reference.hintPlaceholder': {
    en: 'Topic: {topic} — add a steer, e.g. "high school level"',
    id: 'Topik: {topic} — tambahkan arahan, misal "tingkat SMA"',
  },
  'reference.noTopic': { en: 'no title yet', id: 'belum ada judul' },
  'reference.hintLabel': { en: 'Search steer', id: 'Arahan pencarian' },
  'reference.search': { en: 'Search again', id: 'Cari lagi' },
  'reference.searching': { en: 'Searching...', id: 'Mencari...' },
  'reference.searchingFor': { en: 'Looking for sources on "{topic}"...', id: 'Mencari sumber untuk "{topic}"...' },
  'reference.empty': { en: 'No sources to offer.', id: 'Tidak ada sumber yang bisa ditawarkan.' },
  'reference.verified': { en: 'verified', id: 'terkonfirmasi' },
  'reference.verifiedTitle': { en: 'Appeared in the search results', id: 'Muncul di hasil pencarian' },
  'reference.unverified': { en: 'unchecked', id: 'belum dicek' },
  'reference.unverifiedTitle': {
    en: 'Not confirmed in the search results',
    id: 'Belum terkonfirmasi di hasil pencarian',
  },
  'reference.open': { en: 'open', id: 'buka' },
  'reference.use': { en: 'Use this reference', id: 'Pakai referensi ini' },
  'reference.preparing': { en: 'Preparing...', id: 'Menyiapkan...' },
  'reference.saved': { en: 'Reference saved ({count} characters).', id: 'Referensi tersimpan ({count} karakter).' },
  'reference.searchFailed': { en: 'The search failed. Try again in a moment.', id: 'Pencarian gagal. Coba lagi sebentar.' },
  'reference.useFailed': { en: 'Could not save the reference. Try again.', id: 'Gagal menyimpan referensi. Coba lagi.' },
  'reference.unusable': { en: 'That source cannot be used.', id: 'Sumber itu tidak bisa dipakai.' },

  // --- home -----------------------------------------------------------------
  'home.newWorkspace': { en: 'New workspace', id: 'Ruang kerja baru' },
  'home.createWorkspace': { en: 'Create a new workspace', id: 'Buat ruang kerja baru' },
  'home.createFirst': { en: 'Create your first workspace', id: 'Buat ruang kerja pertamamu' },
  'home.all': { en: 'All', id: 'Semua' },
  'home.active': { en: 'Active', id: 'Berjalan' },
  'home.completed': { en: 'Completed', id: 'Selesai' },
  'home.allWorkspaces': { en: 'All workspaces', id: 'Semua ruang kerja' },
  'home.noWorkspaces': { en: 'No workspaces yet', id: 'Belum ada ruang kerja' },
  'home.noWorkspacesHint': {
    en: 'Start your first session. Pick a topic, open the whiteboard, and teach your AI student.',
    id: 'Mulai sesi pertamamu. Pilih materi, buka papan tulis, lalu ajari murid AI-mu.',
  },
  'home.noFinished': { en: 'No finished sessions yet', id: 'Belum ada sesi yang selesai' },
  'home.noMatches': { en: 'No matching workspaces.', id: 'Tidak ada ruang kerja yang cocok.' },
  'home.search': { en: 'Search workspaces...', id: 'Cari ruang kerja...' },
  'home.searchLabel': { en: 'Search workspaces', id: 'Cari ruang kerja' },
  'home.filterLabel': { en: 'Filter workspaces', id: 'Saring ruang kerja' },
  'home.openWorkspace': { en: 'Open workspace {title}', id: 'Buka ruang kerja {title}' },
  'home.deleteWorkspace': { en: 'Delete workspace {title}', id: 'Hapus ruang kerja {title}' },
  'home.deleteConfirm': { en: 'Delete this workspace?', id: 'Hapus ruang kerja ini?' },
  'home.untitled': { en: 'untitled', id: 'tanpa judul' },
  'home.profile': { en: 'Your profile', id: 'Profilmu' },
  'home.openProfile': { en: 'Open profile settings for {name}', id: 'Buka pengaturan profil untuk {name}' },
  'home.displayName': { en: 'Display name', id: 'Nama tampilan' },
  'home.yourName': { en: 'Your name...', id: 'Namamu...' },
  'home.yourNameLabel': { en: 'Your name', id: 'Namamu' },
  'home.cantConnect': { en: "Can't connect", id: 'Tidak bisa terhubung' },
  'home.askName': { en: "Hey, what's your name?", id: 'Halo, siapa namamu?' },

  // --- sign in --------------------------------------------------------------
  'auth.closeSignIn': { en: 'Close sign in', id: 'Tutup masuk' },
  'auth.username': { en: 'Username', id: 'Nama pengguna' },
  'auth.password': { en: 'Password', id: 'Kata sandi' },

  // --- evaluation -----------------------------------------------------------
  'evaluation.complete': { en: 'Session complete', id: 'Sesi selesai' },
  'evaluation.letterTitle': { en: 'Letter from Your Learner', id: 'Surat dari Muridmu' },
  'evaluation.letterOpen': { en: 'Open the letter from your learner', id: 'Buka surat dari muridmu' },
  'evaluation.clickToOpen': { en: 'Click to open', id: 'Klik untuk membuka' },
  'evaluation.toTheirTeacher': { en: 'to their teacher', id: 'untuk gurunya' },
  'evaluation.notes': { en: 'My Notes', id: 'Catatanku' },
  'evaluation.learned': { en: 'Learned', id: 'Yang dipahami' },
  'evaluation.nothingNoted': { en: 'Nothing noted yet.', id: 'Belum ada catatan.' },
  'evaluation.stillConfused': { en: 'Still Confused', id: 'Masih bingung' },
  'evaluation.nothingConfusing': { en: 'Nothing confusing — amazing!', id: 'Tidak ada yang membingungkan — hebat!' },
  'evaluation.reflection': { en: 'Reflection', id: 'Refleksi' },
  'evaluation.continueLearning': { en: 'Continue Learning', id: 'Lanjut belajar' },
  'evaluation.noRecommendations': { en: 'No recommendations right now.', id: 'Belum ada rekomendasi.' },

  // --- workspace state, as shown on a card ---------------------------------
  'state.draft': { en: 'Draft', id: 'Draf' },
  'state.teaching': { en: 'Teaching', id: 'Mengajar' },
  'state.evaluating': { en: 'Evaluating', id: 'Menilai' },
  'state.completed': { en: 'Completed', id: 'Selesai' },

  // --- how long ago ---------------------------------------------------------
  // Indonesian marks no plural, so its two forms are the same sentence twice.
  // Keeping both keys is what lets English say "1 day" and "2 days".
  'time.justNow': { en: 'just now', id: 'baru saja' },
  'time.minsAgo': { en: '{count} min ago', id: '{count} menit lalu' },
  'time.hoursAgo': { en: '{count} hr ago', id: '{count} jam lalu' },
  'time.dayAgo': { en: '1 day ago', id: '1 hari lalu' },
  'time.daysAgo': { en: '{count} days ago', id: '{count} hari lalu' },

  // --- home, continued ------------------------------------------------------
  'home.untitledWorkspace': { en: 'Untitled workspace', id: 'Ruang kerja tanpa judul' },
  'home.deleteWorkspaceTitle': { en: 'Delete workspace', id: 'Hapus ruang kerja' },
  'home.creatingWorkspace': { en: 'Creating workspace...', id: 'Membuat ruang kerja...' },
  'home.creating': { en: 'Creating...', id: 'Membuat...' },
  'home.oneWorkspace': { en: '1 workspace', id: '1 ruang kerja' },
  'home.manyWorkspaces': { en: '{count} workspaces', id: '{count} ruang kerja' },
  'home.noFinishedHint': {
    en: 'Finish a teaching session and its evaluation will show up here.',
    id: 'Selesaikan satu sesi mengajar dan penilaiannya akan muncul di sini.',
  },
  'home.tryAgain': { en: 'Try again', id: 'Coba lagi' },
  'home.clearFilters': { en: 'Clear filters', id: 'Hapus saringan' },
  'home.connectError': {
    en: 'Could not connect to the server. Make sure the backend is running at http://localhost:8000.',
    id: 'Tidak bisa terhubung ke server. Pastikan backend berjalan di http://localhost:8000.',
  },
  'home.createError': {
    en: 'Failed to create workspace. Make sure the backend is running at http://localhost:8000.',
    id: 'Gagal membuat ruang kerja. Pastikan backend berjalan di http://localhost:8000.',
  },
  'home.deleteError': {
    en: 'Failed to delete workspace. Please try again.',
    id: 'Gagal menghapus ruang kerja. Coba lagi.',
  },
  'home.deleteBody': {
    en: '{title} will be permanently deleted, including all its teaching history and evaluation. This action cannot be undone.',
    id: '{title} akan dihapus permanen, termasuk seluruh riwayat mengajar dan penilaiannya. Tindakan ini tidak bisa dibatalkan.',
  },
  'home.deleting': { en: 'Deleting...', id: 'Menghapus...' },
  'home.confirmDelete': { en: 'Yes, delete workspace', id: 'Ya, hapus ruang kerja' },
  'home.exitGuest': { en: 'Exit guest', id: 'Keluar mode tamu' },
  'home.signOut': { en: 'Sign out', id: 'Keluar' },
  'home.exitGuestTitle': { en: 'Exit guest session?', id: 'Keluar dari sesi tamu?' },
  'home.signOutTitle': { en: 'Sign out?', id: 'Keluar dari akun?' },
  'home.exitGuestBody': {
    en: 'You will go back to the Cogniva home page. Your workspaces stay on this device, so continuing as a guest again brings them back.',
    id: 'Kamu akan kembali ke halaman utama Cogniva. Ruang kerjamu tetap tersimpan di perangkat ini, jadi masuk lagi sebagai tamu akan memunculkannya kembali.',
  },
  'home.signOutBody': {
    en: 'You will go back to the Cogniva home page. Sign in again any time to pick up where you left off.',
    id: 'Kamu akan kembali ke halaman utama Cogniva. Masuk lagi kapan saja untuk melanjutkan dari tempat terakhir.',
  },
  'home.signingOut': { en: 'Signing out...', id: 'Keluar...' },
  'home.confirmExitGuest': { en: 'Yes, exit guest', id: 'Ya, keluar mode tamu' },
  'home.confirmSignOut': { en: 'Yes, sign out', id: 'Ya, keluar' },
  'home.staySignedIn': { en: 'Stay signed in', id: 'Tetap masuk' },
  'home.guestSession': { en: 'Guest session', id: 'Sesi tamu' },
  'home.profileShort': { en: 'Profile', id: 'Profil' },
  'home.profileBody': {
    en: 'Your AI student calls you by this name during a session.',
    id: 'Murid AI-mu akan memanggilmu dengan nama ini selama sesi.',
  },
  'home.saveChanges': { en: 'Save changes', id: 'Simpan perubahan' },

  // --- first visit ----------------------------------------------------------
  'onb.step1Title': { en: 'Here, you are the teacher', id: 'Di sini, kamu yang jadi guru' },
  'onb.step1Body': {
    en: 'Cogniva flips the classroom. Instead of re-reading your notes, you explain the topic in your own words — and the parts you only half-understand show up immediately.',
    id: 'Cogniva membalik ruang kelas. Bukan membaca ulang catatan, kamu menjelaskan materinya dengan kata-katamu sendiri — dan bagian yang cuma kamu pahami separuh akan langsung kelihatan.',
  },
  'onb.step1Cta': { en: 'How does it work?', id: 'Bagaimana caranya?' },
  'onb.step2Title': { en: 'Teach an AI student', id: 'Ajari seorang murid AI' },
  'onb.step2Body': {
    en: 'Open a workspace, write or draw your material on the whiteboard, then teach. Your AI student follows along and asks questions whenever something does not click.',
    id: 'Buka ruang kerja, tulis atau gambar materimu di papan tulis, lalu ajarkan. Murid AI-mu menyimak dan bertanya setiap kali ada yang belum masuk.',
  },
  'onb.step2Cta': { en: 'And after that?', id: 'Lalu setelah itu?' },
  'onb.step3Title': { en: 'Finish with a report', id: 'Tutup dengan laporan' },
  'onb.step3Body': {
    en: 'End the session and Cogniva evaluates your explanation: what landed clearly, what stayed fuzzy, and which parts are worth reviewing again.',
    id: 'Akhiri sesinya dan Cogniva menilai penjelasanmu: bagian mana yang sudah jelas, mana yang masih kabur, dan mana yang perlu kamu ulang.',
  },
  'onb.step3Cta': { en: "Got it, let's start", id: 'Paham, ayo mulai' },
  'onb.back': { en: 'Back', id: 'Kembali' },
  'onb.skip': { en: 'Skip intro', id: 'Lewati perkenalan' },
  'onb.nameBody': {
    en: 'Your AI student will call you by this name throughout the session.',
    id: 'Murid AI-mu akan memanggilmu dengan nama ini sepanjang sesi.',
  },
  'onb.enter': { en: 'Enter Cogniva', id: 'Masuk ke Cogniva' },

  // --- sign in, continued ---------------------------------------------------
  'auth.signInTitle': { en: 'Sign in to Cogniva', id: 'Masuk ke Cogniva' },
  'auth.registerTitle': { en: 'Create your account', id: 'Buat akunmu' },
  'auth.body': {
    en: 'Keep your teaching workspaces attached to your username.',
    id: 'Ruang kerja mengajarmu tersimpan di bawah nama penggunamu.',
  },
  'auth.failed': { en: 'Authentication failed', id: 'Gagal masuk' },
  'auth.wait': { en: 'Please wait...', id: 'Mohon tunggu...' },
  'auth.signIn': { en: 'Sign in', id: 'Masuk' },
  'auth.createAccount': { en: 'Create account', id: 'Buat akun' },
  'auth.toRegister': { en: 'Create a new account', id: 'Buat akun baru' },
  'auth.toLogin': { en: 'I already have an account', id: 'Aku sudah punya akun' },
  'auth.guest': { en: 'Continue as guest', id: 'Lanjut sebagai tamu' },
  'auth.backToSite': { en: 'Back to the site', id: 'Kembali ke situs' },

  // --- evaluation, continued ------------------------------------------------
  'evaluation.letterFrom': { en: 'Letter from {name}', id: 'Surat dari {name}' },
  'evaluation.notesOwner': { en: "{name}'s notes", id: 'Catatan {name}' },
  'evaluation.continueHint': {
    en: 'Ready to teach new topics? Start a new session or continue this one.',
    id: 'Siap mengajarkan materi baru? Mulai sesi baru, atau lanjutkan yang ini.',
  },
  'evaluation.opening': { en: 'Opening...', id: 'Membuka...' },
  'evaluation.continueSession': { en: 'Continue Session', id: 'Lanjutkan sesi' },
  'evaluation.newSession': { en: 'Start a new session', id: 'Mulai sesi baru' },
  'evaluation.backHome': { en: 'Back to Home', id: 'Kembali ke Beranda' },
  'evaluation.evaluating': { en: 'Evaluating your session...', id: 'Menilai sesimu...' },
  'evaluation.evaluatingNamed': { en: 'Evaluating "{title}"', id: 'Menilai "{title}"' },
  'evaluation.processingHint': {
    en: 'You can head back to Home and return later — the evaluation keeps running in the background.',
    id: 'Kamu boleh kembali ke Beranda dan mampir lagi nanti — penilaiannya tetap berjalan di latar belakang.',
  },
  'evaluation.processing1': {
    en: 'Your student is thinking back over the session...',
    id: 'Muridmu sedang mengingat-ingat sesi tadi...',
  },
  'evaluation.processing2': { en: 'Writing up the notes...', id: 'Menulis catatannya...' },
  'evaluation.processing3': { en: 'Preparing a letter for you...', id: 'Menyiapkan surat untukmu...' },
  'evaluation.processing4': { en: 'Almost done...', id: 'Hampir selesai...' },

  // --- the guided tour ------------------------------------------------------
  'tour.gotIt': { en: 'Got it', id: 'Paham' },
  'tour.skip': { en: 'Skip tour', id: 'Lewati panduan' },
  'tour.next': { en: 'Next', id: 'Lanjut' },
  'tour.listTitle': { en: 'Your topics live here', id: 'Materimu ada di sini' },
  'tour.listBody': {
    en: 'Each thing you teach gets its own workspace, with its own board, its own student and its own report. Reopen one any time to teach it again.',
    id: 'Setiap materi yang kamu ajarkan punya ruang kerjanya sendiri, lengkap dengan papan, murid, dan laporannya sendiri. Buka lagi kapan saja untuk mengajarkannya ulang.',
  },
  'tour.filtersTitle': { en: 'Find your way around', id: 'Cara menavigasinya' },
  'tour.filtersBody': {
    en: 'Active workspaces are the ones you are still teaching. Completed ones have a finished report waiting for you.',
    id: 'Ruang kerja "Berjalan" adalah yang masih kamu ajarkan. Yang "Selesai" sudah punya laporan yang menunggu dibaca.',
  },
  'tour.profileTitle': { en: 'This is you', id: 'Ini kamu' },
  'tour.profileBody': {
    en: 'The name your student calls you by. Change it here whenever you like.',
    id: 'Nama yang dipakai muridmu untuk memanggilmu. Ubah di sini kapan pun kamu mau.',
  },
  'tour.newTitle': { en: 'Start a topic', id: 'Mulai satu materi' },
  'tour.newBody': {
    en: 'Open a new workspace to begin teaching. The tour picks up again once you are inside, right at the board.',
    id: 'Buka ruang kerja baru untuk mulai mengajar. Panduannya berlanjut begitu kamu masuk, tepat di papan tulis.',
  },
  'tour.boardTitle': { en: 'This is your board', id: 'Ini papan tulismu' },
  'tour.boardBody': {
    en: 'Write, draw, or sketch your explanation here — the same way you would on a real whiteboard. Everything you put down is saved as you go.',
    id: 'Tulis, gambar, atau sketsakan penjelasanmu di sini — sama seperti di papan tulis sungguhan. Semua yang kamu tulis tersimpan sambil jalan.',
  },
  'tour.micTitle': { en: 'Explain out loud', id: 'Jelaskan dengan suara' },
  'tour.micBody': {
    en: 'Recording is on while you teach, so you can talk through the board instead of writing every word. Tap to pause or resume it.',
    id: 'Perekaman menyala selama kamu mengajar, jadi kamu bisa menjelaskan papannya secara lisan tanpa menulis setiap kata. Tekan untuk menjeda atau melanjutkan.',
  },
  'tour.teachTitle': { en: 'Hand it to your student', id: 'Serahkan ke muridmu' },
  'tour.teachBody': {
    en: 'Press Teach when you want her to look at the board. She reads what you drew, listens to what you said, and reacts.',
    id: 'Tekan Ajarkan saat kamu ingin dia melihat papannya. Dia membaca gambarmu, menyimak ucapanmu, lalu bereaksi.',
  },
  'tour.chatTitle': { en: 'Talk it through', id: 'Bahas bersama' },
  'tour.chatBody': {
    en: 'She asks questions here, and you can answer or ask your own without pressing Teach again. Unread replies show up as a badge.',
    id: 'Dia bertanya di sini, dan kamu bisa menjawab atau balik bertanya tanpa menekan Ajarkan lagi. Balasan yang belum dibaca muncul sebagai tanda.',
  },
  'tour.pdfTitle': { en: 'Attach a reference (optional)', id: 'Lampirkan acuan (opsional)' },
  'tour.pdfBody': {
    en: 'Add a PDF of the source material to ground your evaluation. Your student never sees it — only the evaluator does.',
    id: 'Tambahkan PDF bahan aslinya sebagai dasar penilaian. Muridmu tidak pernah melihatnya — hanya penilai.',
  },
  'tour.finishTitle': { en: 'End the round', id: 'Akhiri sesinya' },
  'tour.finishBody': {
    en: 'Finish the session when you are done. She writes you a letter about what she understood, what confused her, and what to try next.',
    id: 'Selesaikan sesinya kalau kamu sudah cukup. Dia akan menulis surat tentang apa yang dia pahami, apa yang membingungkan, dan apa yang sebaiknya dicoba berikutnya.',
  },

  // --- the public landing page ----------------------------------------------
  // Prices, plan names (Belajar / Sensei / Sekolah) and the team's names are the
  // same in both languages and are not keys.
  'landing.navHow': { en: 'How it works', id: 'Cara kerjanya' },
  'landing.navStudents': { en: 'Your students', id: 'Muridmu' },
  'landing.navPricing': { en: 'Pricing', id: 'Harga' },
  'landing.navFaq': { en: 'FAQ', id: 'Tanya jawab' },
  'landing.navAbout': { en: 'About us', id: 'Tentang kami' },
  'landing.startFree': { en: 'Start teaching for free', id: 'Mulai mengajar, gratis' },
  'landing.heroTitle1': { en: "You don't know it", id: 'Kamu belum menguasainya' },
  'landing.heroTitle2': { en: 'until you can teach it.', id: 'sampai kamu bisa mengajarkannya.' },
  'landing.heroLead': {
    en: "Cogniva gives you a student instead of a quiz. Explain a topic on a whiteboard, out loud if you like, and she'll interrupt, get confused, and ask the one question you were quietly hoping she wouldn't. Afterwards she writes you a letter about what she actually understood.",
    id: 'Cogniva memberimu seorang murid, bukan kuis. Jelaskan satu materi di papan tulis, boleh sambil bersuara, dan dia akan menyela, kebingungan, lalu menanyakan satu hal yang diam-diam kamu harap tidak dia tanyakan. Setelah itu dia menulis surat tentang apa yang benar-benar dia pahami.',
  },
  'landing.heroCta': { en: 'Open a workspace', id: 'Buka ruang kerja' },
  'landing.heroSecondary': { en: 'See how a session goes', id: 'Lihat jalannya satu sesi' },
  'landing.note1': { en: 'No account needed', id: 'Tanpa perlu akun' },
  'landing.note2': { en: 'Just type your name and start', id: 'Cukup tulis namamu, lalu mulai' },
  'landing.note3': { en: 'Works in Bahasa Indonesia', id: 'Tersedia dalam Bahasa Indonesia' },
  'landing.previewTopic': {
    en: 'Photosynthesis in C4 plants',
    id: 'Fotosintesis pada tumbuhan C4',
  },
  'landing.previewCanvas': {
    en: 'your whiteboard',
    id: 'papan tulismu',
  },
  'landing.previewCanvas2': {
    en: 'read-only while she reads',
    id: 'terkunci selama dia membaca',
  },
  'landing.previewReading': { en: 'Reading your board…', id: 'Membaca papanmu…' },
  'landing.previewNote': {
    en: "She's looking at the arrows on the right side.",
    id: 'Dia sedang memperhatikan panah di sisi kanan.',
  },
  'landing.previewThinking': { en: 'Thinking', id: 'Berpikir' },
  'landing.howEyebrow': { en: 'How a session goes', id: 'Jalannya satu sesi' },
  'landing.howTitle': {
    en: 'Four steps, about twenty minutes.',
    id: 'Empat langkah, sekitar dua puluh menit.',
  },
  'landing.howAside': {
    en: 'Nothing to configure and nothing to grade. You talk, she listens badly enough to expose the gaps, and the report tells you where to look again.',
    id: 'Tidak ada yang perlu diatur, tidak ada yang perlu dinilai. Kamu menjelaskan, dia menyimak dengan cukup polos untuk memunculkan celahnya, dan laporannya memberitahu bagian mana yang perlu kamu baca ulang.',
  },
  'landing.step1Title': { en: 'Open a board', id: 'Buka satu papan' },
  'landing.step1Body': {
    en: "Name a topic, or don't. Attach a reference PDF if you have one. Your student never sees it, so she can't cheat off the answer key.",
    id: 'Beri nama materinya, atau tidak juga boleh. Lampirkan PDF acuan kalau kamu punya. Muridmu tidak pernah melihatnya, jadi dia tidak bisa menyontek kunci jawaban.',
  },
  'landing.step2Title': { en: 'Explain it', id: 'Jelaskan' },
  'landing.step2BodyA': {
    en: 'Draw, write, record your voice. Press',
    id: 'Gambar, tulis, rekam suaramu. Tekan',
  },
  'landing.step2BodyB': {
    en: "whenever you want her to look at what's on the board.",
    id: 'kapan pun kamu ingin dia melihat isi papannya.',
  },
  'landing.step3Title': { en: 'She pushes back', id: 'Dia menyanggah' },
  'landing.step3Body': {
    en: '“E-Etto… is the rubisco in the first box or the second one?” Answer in chat, or go draw it properly. Her questions stay put until you deal with them.',
    id: '“E-Etto… rubisco-nya di kotak pertama atau kedua?” Jawab di obrolan, atau gambarkan ulang dengan benar. Pertanyaannya tidak hilang sampai kamu menanganinya.',
  },
  'landing.step4Title': { en: 'Read her letter', id: 'Baca suratnya' },
  'landing.step4BodyA': { en: 'A letter, a notebook split into', id: 'Sebuah surat, buku catatan yang terbagi jadi' },
  'landing.step4BodyB': { en: 'and', id: 'dan' },
  'landing.step4BodyC': {
    en: "and three topics she'd like next. Then teach it again, better.",
    id: 'plus tiga materi yang ingin dia pelajari berikutnya. Lalu ajarkan ulang, lebih baik.',
  },
  'landing.letterKicker': { en: 'What the letter looks like', id: 'Kira-kira begini suratnya' },
  'landing.letterQuote': {
    en: '“Arif-sensei, I think I finally get why C4 plants bother with the extra step. But when you drew the two cell types I wrote them down without really following. If you asked me now which one has the rubisco, I would guess.”',
    id: '“Arif-sensei, sepertinya aku akhirnya paham kenapa tumbuhan C4 repot-repot menambah satu langkah. Tapi waktu sensei menggambar dua jenis selnya, aku cuma mencatat tanpa benar-benar mengikuti. Kalau sekarang ditanya yang mana punya rubisco, aku cuma bisa menebak.”',
  },
  'landing.letterBy': { en: '(Yuzuki, after 24 minutes)', id: '(Yuzuki, setelah 24 menit)' },
  'landing.stat1': {
    en: 'students, each with their own temperament',
    id: 'murid, masing-masing dengan wataknya sendiri',
  },
  'landing.stat2': {
    en: 'accounts, passwords or setup screens',
    id: 'akun, kata sandi, atau layar pengaturan',
  },
  'landing.stat3': {
    en: 'rounds per topic, and each one keeps its own report',
    id: 'putaran per materi, dan tiap putaran punya laporannya sendiri',
  },
  'landing.studentsEyebrow': { en: "Who you'll be teaching", id: 'Siapa yang akan kamu ajari' },
  'landing.studentsTitle': {
    en: "Three students. You don't get to pick.",
    id: 'Tiga murid. Kamu tidak yang memilih.',
  },
  'landing.studentsAside': {
    en: "Each workspace is assigned a student and keeps her for good, so a topic always has the same voice in it. Teach three topics and you'll have met all three.",
    id: 'Setiap ruang kerja mendapat satu murid dan menyimpannya selamanya, jadi satu materi selalu punya suara yang sama. Ajarkan tiga materi, dan kamu sudah bertemu ketiganya.',
  },
  'landing.pricingTitle': {
    en: 'Free to learn with. Paid when you want her to remember.',
    id: 'Gratis untuk belajar. Berbayar kalau kamu ingin dia mengingat.',
  },
  'landing.pricingLead': {
    en: 'Prices in IDR, per month, cancel any time. Every plan includes all three students and the full report.',
    id: 'Harga dalam rupiah, per bulan, bisa dibatalkan kapan saja. Semua paket memuat ketiga murid dan laporan lengkapnya.',
  },
  'landing.billingPeriod': { en: 'Billing period', id: 'Periode penagihan' },
  'landing.monthly': { en: 'Monthly', id: 'Bulanan' },
  'landing.annual': { en: 'Annual · 2 months free', id: 'Tahunan · 2 bulan gratis' },
  'landing.billedYearly': { en: 'Billed Rp 468.000 yearly', id: 'Ditagih Rp 468.000 per tahun' },
  'landing.orAnnual': {
    en: 'Or Rp 39.000 on annual billing',
    id: 'Atau Rp 39.000 dengan penagihan tahunan',
  },
  'landing.freeTag': {
    en: 'For seeing whether teaching actually works on you.',
    id: 'Untuk membuktikan apakah cara mengajar ini cocok untukmu.',
  },
  'landing.forever': { en: 'forever', id: 'selamanya' },
  'landing.startNow': { en: 'Start now', id: 'Mulai sekarang' },
  'landing.freeFeature1': { en: '3 workspaces at a time', id: '3 ruang kerja sekaligus' },
  'landing.freeFeature2': {
    en: 'Whiteboard, voice recording, chat',
    id: 'Papan tulis, rekaman suara, obrolan',
  },
  'landing.freeFeature3': {
    en: 'Letter, notebook and next topics',
    id: 'Surat, buku catatan, dan materi berikutnya',
  },
  'landing.freeFeature4': { en: 'Reports kept 7 days', id: 'Laporan disimpan 7 hari' },
  'landing.mostChosen': { en: 'Most chosen', id: 'Paling dipilih' },
  'landing.senseiTag': {
    en: 'For someone with an exam, a thesis, or a habit.',
    id: 'Untuk yang punya ujian, skripsi, atau kebiasaan belajar.',
  },
  'landing.perMonth': { en: '/ month', id: '/ bulan' },
  'landing.takeSensei': { en: 'Take Sensei', id: 'Ambil Sensei' },
  'landing.senseiFeature1': {
    en: 'Unlimited workspaces and rounds',
    id: 'Ruang kerja dan putaran tanpa batas',
  },
  'landing.senseiFeature2': {
    en: 'Reports kept forever, with round history',
    id: 'Laporan disimpan selamanya, lengkap dengan riwayat putaran',
  },
  'landing.senseiFeature3': {
    en: 'Reference PDFs up to 100 pages',
    id: 'PDF acuan sampai 100 halaman',
  },
  'landing.senseiFeature4': {
    en: 'Deeper evaluation that remembers earlier rounds',
    id: 'Penilaian lebih dalam yang mengingat putaran sebelumnya',
  },
  'landing.senseiFeature5': {
    en: 'Export letters and notes as PDF',
    id: 'Ekspor surat dan catatan sebagai PDF',
  },
  'landing.schoolTag': {
    en: 'For a class, a study group, or a whole school.',
    id: 'Untuk satu kelas, kelompok belajar, atau seluruh sekolah.',
  },
  'landing.perStudent': { en: '/ student / month', id: '/ murid / bulan' },
  'landing.minStudents': { en: 'Minimum 20 students', id: 'Minimal 20 murid' },
  'landing.talkToUs': { en: 'Talk to us', id: 'Hubungi kami' },
  'landing.schoolFeature1': { en: 'Everything in Sensei', id: 'Semua yang ada di Sensei' },
  'landing.schoolFeature2': {
    en: 'Teacher view: who taught what, and how it went',
    id: 'Tampilan guru: siapa mengajarkan apa, dan bagaimana hasilnya',
  },
  'landing.schoolFeature3': {
    en: 'Assign a topic to the whole class',
    id: 'Tugaskan satu materi ke seluruh kelas',
  },
  'landing.schoolFeature4': {
    en: 'Invoicing, onboarding session, priority support',
    id: 'Penagihan, sesi pengenalan, dukungan prioritas',
  },
  'landing.faqTitle': { en: 'Questions you might have', id: 'Pertanyaan yang mungkin muncul' },
  'landing.faq1Q': {
    en: 'What happens to my free workspaces?',
    id: 'Ruang kerja gratisku bagaimana?',
  },
  'landing.faq1A': {
    en: 'They stay. Upgrading only lifts the limits, and nothing is deleted or migrated.',
    id: 'Tetap ada. Naik paket hanya melepas batasannya; tidak ada yang dihapus atau dipindahkan.',
  },
  'landing.faq2Q': { en: 'Is my board used for training?', id: 'Apakah papanku dipakai untuk melatih AI?' },
  'landing.faq2A': {
    en: 'No. Your boards, voice and PDFs are used to run your session and nothing else.',
    id: 'Tidak. Papan, suara, dan PDF-mu dipakai untuk menjalankan sesimu saja.',
  },
  'landing.faq3Q': { en: 'Do I need an account to pay?', id: 'Perlu akun untuk berlangganan?' },
  'landing.faq3A': {
    en: 'Only from Sensei upwards. That is the point where your reports need somewhere to live.',
    id: 'Hanya dari paket Sensei ke atas. Di titik itu laporanmu butuh tempat tinggal.',
  },
  'landing.aboutTitle': {
    en: 'We built the study tool we kept failing to be disciplined enough for.',
    id: 'Kami membuat alat belajar yang dulu selalu gagal kami jalani dengan disiplin.',
  },
  'landing.aboutPara1': {
    en: "Cogniva started as a small team in Bandung re-reading the same chapter for the fourth time and still not being able to explain it to a friend. Flashcards told us we knew things we didn't. Talking out loud to nobody felt silly. So we made the nobody talk back.",
    id: 'Cogniva dimulai dari tim kecil di Bandung yang membaca bab yang sama untuk keempat kalinya dan masih tidak bisa menjelaskannya ke teman. Kartu hafalan membuat kami merasa paham padahal tidak. Bicara sendiri ke ruang kosong terasa aneh. Jadi kami membuat ruang kosong itu menjawab.',
  },
  'landing.aboutPara2': {
    en: 'The students are deliberately not experts. An expert would fill your gaps in politely. A confused beginner leaves them exactly where they are, in writing, where you have to look at them.',
    id: 'Muridnya sengaja bukan ahli. Seorang ahli akan menutupi celah penjelasanmu dengan sopan. Pemula yang kebingungan membiarkan celah itu apa adanya, tertulis, di tempat yang harus kamu lihat.',
  },
  'landing.believeKicker': { en: 'What we believe', id: 'Yang kami yakini' },
  'landing.believeBody': {
    en: "Understanding is a performance, not a feeling. If you can't perform it, you don't have it yet.",
    id: 'Pemahaman itu pertunjukan, bukan perasaan. Kalau belum bisa kamu tampilkan, berarti belum kamu miliki.',
  },
  'landing.wontKicker': { en: "What we won't do", id: 'Yang tidak kami lakukan' },
  'landing.wontBody': {
    en: 'No streaks, no leaderboards, no notifications guilting you back. One good session beats thirty nagged ones.',
    id: 'Tanpa rentetan hari, tanpa papan peringkat, tanpa notifikasi yang membuatmu merasa bersalah. Satu sesi yang bagus mengalahkan tiga puluh sesi hasil paksaan.',
  },
  'landing.whereKicker': { en: 'Where we are', id: 'Posisi kami sekarang' },
  'landing.whereBody': {
    en: 'Open beta, four people, Bandung. Bahasa Indonesia first, English second.',
    id: 'Beta terbuka, empat orang, Bandung. Bahasa Indonesia dulu, Inggris kemudian.',
  },
  'landing.closingTitle': {
    en: 'Pick a topic you think you know.',
    id: 'Pilih satu materi yang kamu rasa sudah kamu kuasai.',
  },
  'landing.closingLead': {
    en: 'Type your name, open a board, and find out in twenty minutes. No card, no account.',
    id: 'Tulis namamu, buka papan, dan buktikan dalam dua puluh menit. Tanpa kartu, tanpa akun.',
  },
  'landing.tagline': {
    en: 'Learning by teaching. Made in Bandung, Indonesia.',
    id: 'Belajar dengan mengajar. Dibuat di Bandung, Indonesia.',
  },
  'landing.footerProduct': { en: 'Product', id: 'Produk' },
  'landing.footerCompany': { en: 'Company', id: 'Perusahaan' },
  'landing.footerLegal': { en: 'Legal', id: 'Hukum' },
  'landing.footerContact': { en: 'Contact', id: 'Kontak' },
  'landing.footerCareers': { en: 'Careers', id: 'Karier' },
  'landing.footerPrivacy': { en: 'Privacy', id: 'Privasi' },
  'landing.footerTerms': { en: 'Terms', id: 'Ketentuan' },
  'landing.copyright': { en: '© 2026 Cogniva. Open beta.', id: '© 2026 Cogniva. Beta terbuka.' },
  'landing.previous': { en: 'Previous', id: 'Sebelumnya' },
  'landing.next': { en: 'Next', id: 'Berikutnya' },
  'landing.backToTop': { en: 'Back to top', id: 'Kembali ke atas' },

  // --- errors ---------------------------------------------------------------
  'error.dismiss': { en: 'Dismiss notification', id: 'Tutup pemberitahuan' },
  'error.budgetTitle': { en: 'Session token limit reached', id: 'Batas token sesi tercapai' },
  'error.budgetText': {
    en: 'This session has used its whole token budget. Finish the session to see your evaluation, or open a new workspace to keep teaching.',
    id: 'Sesi ini sudah memakai seluruh jatah tokennya. Akhiri sesi untuk melihat evaluasi, atau buka workspace baru untuk lanjut mengajar.',
  },
  'error.networkTitle': { en: 'No internet connection', id: 'Tidak terhubung ke internet' },
  'error.networkText': {
    en: 'The connection dropped. Your whiteboard is still saved on this device — the message will be sent again as soon as you are back online.',
    id: 'Koneksi terputus. Coretan di papan tetap tersimpan di perangkat ini — pesan akan terkirim lagi begitu koneksi kembali.',
  },
  'error.aiTitle': { en: 'Could not reach Cogniva', id: 'Gagal menghubungi Cogniva' },
  'error.aiText': {
    en: 'The server did not respond, so this turn was not sent. Press Teach again in a moment.',
    id: 'Server tidak merespons, jadi giliran ini belum terkirim. Coba tekan Teach sekali lagi sebentar lagi.',
  },
} satisfies Record<string, Entry>

export type MessageKey = keyof typeof messages
