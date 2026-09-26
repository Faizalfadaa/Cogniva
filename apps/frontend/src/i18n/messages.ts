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
  'stage.showCharacter': { en: 'Show character', id: 'Tampilkan karakter' },
  'stage.minimizeCharacter': { en: 'Minimize character', id: 'Kecilkan karakter' },
  'stage.conversationWith': { en: 'Conversation with {name}', id: 'Percakapan dengan {name}' },
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
  'reference.noticeThin': {
    en: 'The search found only a few usable sources. If none of them fit, you can still upload a PDF of your own.',
    id: 'Pencarian hanya menemukan sedikit sumber yang bisa dipakai. Kalau tidak ada yang cocok, kamu tetap bisa mengunggah PDF sendiri.',
  },
  'reference.noticeUnverified': {
    en: 'Some of the links below were not confirmed to appear in the search results. Open them and check before using one.',
    id: 'Beberapa tautan di bawah belum terkonfirmasi muncul di hasil pencarian. Buka dan periksa dulu sebelum memakainya.',
  },
  'reference.noticeRejected': {
    en: 'Some results were skipped because nobody is answerable for what they say, such as open-edit wikis, Q&A sites and personal uploads. This material becomes the marking key for your explanation, so its source has to be accountable.',
    id: 'Beberapa hasil dilewati karena tidak ada yang bertanggung jawab atas isinya, seperti wiki yang bisa diedit siapa saja, situs tanya jawab, dan unggahan pribadi. Materi ini menjadi kunci penilaian penjelasanmu, jadi sumbernya harus bisa dipertanggungjawabkan.',
  },
  'reference.noticeOffline': {
    en: 'Online search is unavailable right now, so these are entry points into open libraries, pre-filtered for your topic, not specific document titles. Open one, then upload the PDF if you find something that fits.',
    id: 'Pencarian online sedang tidak tersedia, jadi ini pintu masuk ke perpustakaan terbuka yang sudah disaring untuk topikmu, bukan judul dokumen tertentu. Buka salah satunya, lalu unggah PDF-nya kalau kamu menemukan yang cocok.',
  },

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
  'evaluation.toTheirTeacher': { en: 'to their teacher', id: 'untuk gurunya' },
  'evaluation.notes': { en: 'My Notes', id: 'Catatanku' },
  'evaluation.learned': { en: 'Learned', id: 'Yang dipahami' },
  'evaluation.nothingNoted': { en: 'Nothing noted yet.', id: 'Belum ada catatan.' },
  'evaluation.stillConfused': { en: 'Still Confused', id: 'Masih bingung' },
  'evaluation.nothingConfusing': { en: 'Nothing confusing — amazing!', id: 'Tidak ada yang membingungkan — hebat!' },
  'evaluation.reflection': { en: 'Reflection', id: 'Refleksi' },
  'evaluation.continueLearning': { en: 'Continue Learning', id: 'Lanjut belajar' },
  'evaluation.reportView': { en: 'Report view', id: 'Tampilan laporan' },
  'evaluation.tabSummary': { en: 'Summary', id: 'Ringkasan' },
  'evaluation.tabDetail': { en: 'Detail', id: 'Detail' },
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
  'evaluation.continueSession': { en: 'Continue This Session', id: 'Lanjutkan Sesi Ini' },
  'evaluation.newSession': { en: 'Start a New Session', id: 'Mulai Sesi Baru' },
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

  // --- the debrief, rebuilt around findings ---------------------------------
  'evaluation.scoreTitle': { en: 'Session Score', id: 'Skor Sesi' },
  'evaluation.scoreCaption': {
    en: 'How accurate and complete your explanation was against the reference material.',
    id: 'Ketepatan dan kelengkapan penjelasanmu dibanding materi rujukan.',
  },
  /* Spelled out on the screen rather than buried in the code: a score nobody
     can reproduce is a score nobody can argue with, and the whole point of
     computing it from the findings was to make it checkable. */
  'evaluation.scoreFormula': {
    en: 'Counted from the findings below: 50% accuracy, 30% completeness, 20% clarity. Depth is judged separately and is not part of this number.',
    id: 'Dihitung dari temuan di bawah: 50% ketepatan, 30% kelengkapan, 20% kejelasan. Kedalaman dinilai terpisah dan tidak masuk ke angka ini.',
  },
  'evaluation.notesTitle': { en: 'How This Session Went', id: 'Penilaian Sesi Ini' },
  'evaluation.nothingToAssess': { en: 'Nothing to assess yet.', id: 'Belum ada yang bisa dinilai.' },
  'evaluation.followUpLabel': { en: 'Suggested fix', id: 'Saran perbaikan' },
  'evaluation.prevFinding': { en: 'Previous finding', id: 'Temuan sebelumnya' },
  'evaluation.nextFinding': { en: 'Next finding', id: 'Temuan berikutnya' },
  'evaluation.transcriptTitle': { en: 'What You Taught', id: 'Yang Kamu Ajarkan' },
  'evaluation.closeNote': { en: 'Close note', id: 'Tutup catatan' },
  'evaluation.close': { en: 'Close', id: 'Tutup' },
  'evaluation.findingAria': { en: 'Assessment: {concept}', id: 'Penilaian: {concept}' },
  'evaluation.notesEmptyHint': {
    en: 'Findings are made per concept from the reference material. A very short session, or a workspace with no reference, has nothing to show here yet. Continue the session and teach one more concept to fill it in.',
    id: 'Penilaian dibuat per konsep dari materi rujukan. Sesi yang sangat singkat, atau workspace tanpa materi rujukan, belum menghasilkan apa pun di sini. Lanjutkan sesi dan ajarkan satu konsep lagi untuk mengisinya.',
  },
  'evaluation.notesIntro': {
    en: 'Assessed automatically against the reference material, not your student\'s private notes. Filter by category, then open a finding to read its suggested fix.',
    id: 'Dinilai otomatis dari materi rujukan, bukan catatan pribadi muridmu. Saring per kategori, lalu buka satu temuan untuk membaca saran perbaikannya.',
  },
  'evaluation.transcriptIntro': {
    en: 'Marked passages carry an assessment note. Click one to open it in place.',
    id: 'Bagian yang ditandai punya catatan penilaian. Klik untuk membukanya di tempat.',
  },
  'evaluation.transcriptEmpty': { en: 'No transcript was saved.', id: 'Transkrip tidak tersimpan.' },
  'evaluation.transcriptEmptyHint': {
    en: 'This session ended before the transcript could be recorded, or its report was produced through the recovery path. The findings below still hold; they just cannot be shown against the original text.',
    id: 'Sesi ini selesai sebelum transkrip sempat direkam, atau laporannya dibuat lewat jalur pemulihan. Penilaian di bawah tetap berlaku, hanya tidak bisa ditunjukkan di teks aslinya.',
  },
  'evaluation.turnNoNotes': {
    en: 'No specific notes for this turn.',
    id: 'Tidak ada catatan khusus untuk giliran ini.',
  },
  'evaluation.orphanLabel': {
    en: 'Notes with no matching turn',
    id: 'Catatan tanpa giliran terkait',
  },
  'evaluation.turnWholeLabel': {
    en: 'Notes on this turn, with no exact quote',
    id: 'Catatan untuk giliran ini, tanpa kutipan presisi',
  },
  'evaluation.seeFollowUp': { en: 'See the suggested fix', id: 'Lihat saran perbaikan' },

  // --- findings board, radar, coverage --------------------------------------
  'evaluation.radarAria': { en: 'Score shape per axis', id: 'Bentuk skor per aksis' },
  'evaluation.filterAria': { en: 'Filter findings by category', id: 'Saring temuan per kategori' },
  'evaluation.filterAll': { en: 'All', id: 'Semua' },
  'evaluation.filterEmpty': {
    en: 'No findings in this category.',
    id: 'Tidak ada temuan di kategori ini.',
  },
  'evaluation.statsTitle': { en: 'Session at a Glance', id: 'Sekilas Sesi Ini' },
  'evaluation.statTurns': { en: 'teaching turns', id: 'giliran mengajar' },
  'evaluation.statAssessed': { en: 'concepts assessed', id: 'konsep dinilai' },
  'evaluation.statCovered': { en: 'of them you covered', id: 'di antaranya kamu bahas' },
  'evaluation.statWords': { en: 'words taught', id: 'kata diajarkan' },
  'evaluation.turnLabel': { en: 'Turn {index}', id: 'Giliran {index}' },
  'evaluation.spokenLabel': { en: 'Spoken', id: 'Lisan' },
  'evaluation.chatLabel': { en: 'In the chat', id: 'Di obrolan' },
  'evaluation.chatYou': { en: 'You', id: 'Kamu' },
  'evaluation.chatLearner': { en: 'Your student', id: 'Muridmu' },

  // --- trend, timing, board replay, practice --------------------------------
  'evaluation.trendTitle': {
    en: 'Across your last {count} sessions',
    id: '{count} sesi terakhirmu',
  },
  'evaluation.trendVsPrevious': { en: 'vs last session', id: 'dari sesi sebelumnya' },
  'evaluation.trendSame': { en: 'same as last session', id: 'sama seperti sesi lalu' },
  'evaluation.trendAxisY': { en: 'Score', id: 'Skor' },
  'evaluation.trendAxisX': { en: 'Session, oldest first', id: 'Sesi, dari yang terlama' },
  'evaluation.recordingLabel': { en: 'Your recording', id: 'Rekamanmu' },
  'evaluation.trendCaption': {
    en: 'Each dot is a finished session, scored the same way. Yours is the filled one.',
    id: 'Tiap titik adalah satu sesi selesai, dinilai dengan cara yang sama. Sesi ini yang terisi penuh.',
  },
  'evaluation.statSpan': { en: 'teaching span', id: 'rentang mengajar' },
  'evaluation.statLongestGap': { en: 'longest pause', id: 'jeda terlama' },
  'evaluation.timingCaveat': {
    en: 'Times are measured between one "Teach" and the next, and are shown as context only. How long someone thinks before explaining is not part of the score.',
    id: 'Waktu dihitung antara satu "Teach" dan berikutnya, dan ditampilkan sebagai konteks saja. Lama berpikir sebelum menjelaskan tidak ikut dinilai.',
  },
  'evaluation.boardAlt': {
    en: 'The whiteboard you taught turn {index} from',
    id: 'Papan tulis yang kamu pakai mengajar di giliran {index}',
  },
  'evaluation.boardCaption': {
    en: 'What you drew for this turn',
    id: 'Yang kamu tulis untuk giliran ini',
  },
  'evaluation.practiceConcept': {
    en: 'Practise this concept →',
    id: 'Latih konsep ini →',
  },
  'evaluation.roundPickerLabel': { en: 'Which round', id: 'Ronde ke berapa' },
  'evaluation.roundLabel': { en: 'Round {round}', id: 'Ronde {round}' },
  'evaluation.viewingOlderRound': {
    en: 'You are reading an earlier round. Your newest debrief is the last tab.',
    id: 'Kamu sedang membaca ronde yang lebih lama. Debrief terbarumu ada di tab paling kanan.',
  },
  'evaluation.processing2b': {
    en: 'Checking each concept against the reference...',
    id: 'Mencocokkan tiap konsep dengan materi rujukan...',
  },
  'evaluation.processing2c': {
    en: 'Marking the sentences that stood out...',
    id: 'Menandai kalimat-kalimat yang menonjol...',
  },
  'evaluation.strengthLabel': { en: 'Main strength', id: 'Kekuatan utama' },
  'evaluation.priorityLabel': { en: 'Fix this first', id: 'Prioritas perbaikan' },

  // A finding's category, used by both the notes badge and the transcript mark.
  'evaluation.catCorrect': { en: 'Right', id: 'Tepat' },
  'evaluation.catWrong': { en: 'Wrong', id: 'Keliru' },
  'evaluation.catConfusing': { en: 'Unclear', id: 'Rancu' },
  'evaluation.catMissed': { en: 'Missed', id: 'Terlewat' },

  // The four axes. `short` is for the radar tips, where a full label will not fit.
  'evaluation.axisAccuracy': { en: 'Accuracy', id: 'Ketepatan' },
  'evaluation.axisAccuracyShort': { en: 'Right', id: 'Tepat' },
  'evaluation.axisCompleteness': { en: 'Completeness', id: 'Kelengkapan' },
  'evaluation.axisCompletenessShort': { en: 'Full', id: 'Lengkap' },
  'evaluation.axisClarity': { en: 'Clarity', id: 'Kejelasan' },
  'evaluation.axisClarityShort': { en: 'Clear', id: 'Jelas' },
  'evaluation.axisDepth': { en: 'Depth of Understanding', id: 'Kedalaman Pemahaman' },
  'evaluation.axisDepthShort': { en: 'Deep', id: 'Dalam' },
  'evaluation.axisOutOf100': { en: '{label}: {value} out of 100', id: '{label}: {value} dari 100' },
  'evaluation.accuracyNone': {
    en: 'Nothing was judged right or wrong yet',
    id: 'Belum ada poin yang dinilai benar atau salah',
  },
  'evaluation.accuracyOne': {
    en: '{correct} right out of 1 point judged',
    id: '{correct} tepat dari 1 poin yang dinilai',
  },
  'evaluation.accuracyCount': {
    en: '{correct} right out of {judged} points judged',
    id: '{correct} tepat dari {judged} poin yang dinilai',
  },
  'evaluation.nothingMeasured': {
    en: 'No findings to measure yet',
    id: 'Belum ada temuan untuk diukur',
  },
  'evaluation.nothingMissed': { en: 'No concept was left out', id: 'Tidak ada konsep yang terlewat' },
  // English needs the singular; Indonesian marks no plural, so both of its
  // forms are the same sentence -- the same shape as time.dayAgo / time.daysAgo.
  'evaluation.missedOne': {
    en: '1 concept was not touched on',
    id: '1 konsep belum disinggung',
  },
  'evaluation.missedCount': {
    en: '{count} concepts were not touched on',
    id: '{count} konsep belum disinggung',
  },
  'evaluation.nothingConfusingAxis': {
    en: 'No part came across as unclear',
    id: 'Tidak ada bagian yang membingungkan',
  },
  'evaluation.confusingOne': {
    en: '1 part read as unclear',
    id: '1 bagian terbaca rancu',
  },
  'evaluation.confusingCount': {
    en: '{count} parts read as unclear',
    id: '{count} bagian terbaca rancu',
  },
  'evaluation.depthCaption': {
    en: 'How far you explained how it works, not just what it is called',
    id: 'Seberapa jauh kamu menjelaskan cara kerjanya, bukan hanya namanya',
  },
  'evaluation.notMeasured': { en: 'not measured', id: 'belum terukur' },
  'evaluation.plusOthers': {
    en: '{detail} Plus {count} other concepts that were also right.',
    id: '{detail} Ditambah {count} konsep lain yang juga tepat.',
  },
  'evaluation.highestScore': {
    en: 'Your highest score this session, {value} out of 100.',
    id: 'Nilai tertinggimu sesi ini, {value} dari 100.',
  },
  'evaluation.lowestScore': {
    en: 'Your lowest score this session, {value} out of 100.',
    id: 'Nilai terendahmu sesi ini, {value} dari 100.',
  },

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
    en: 'Turn what you are studying into an explanation. Write, draw, or record your voice, then teach an AI student who responds and asks questions. Finish with feedback on what came across clearly and what you can explain better.',
    id: 'Ubah apa yang sedang kamu pelajari jadi sebuah penjelasan. Tulis, gambar, atau rekam suaramu, lalu ajari murid AI yang menanggapi dan bertanya. Di akhir kamu dapat masukan: bagian mana yang sudah tersampaikan dan bagian mana yang bisa kamu jelaskan lebih baik.',
  },
  'landing.heroCta': { en: 'Open a workspace', id: 'Buka ruang kerja' },
  'landing.heroSecondary': { en: 'See how a session goes', id: 'Lihat jalannya satu sesi' },
  'landing.note1': { en: 'Try as a guest', id: 'Coba sebagai tamu' },
  'landing.note2': { en: 'Sign in to keep your work', id: 'Masuk untuk menyimpan pekerjaanmu' },
  'landing.note3': { en: 'Whiteboard, voice, and chat', id: 'Papan tulis, suara, dan obrolan' },
  'landing.previewTopic': {
    en: 'Photosynthesis in C4 plants',
    id: 'Fotosintesis pada tumbuhan C4',
  },
  'landing.previewCanvas': { en: 'your whiteboard', id: 'papan tulismu' },
  'landing.previewCanvas2': {
    en: 'explain one idea at a time',
    id: 'jelaskan satu gagasan dalam satu waktu',
  },
  'landing.previewReading': { en: 'Reading your board…', id: 'Membaca papanmu…' },
  'landing.previewNote': {
    en: 'Your student is working through your explanation.',
    id: 'Muridmu sedang mencerna penjelasanmu.',
  },
  'landing.previewThinking': { en: 'Thinking', id: 'Berpikir' },
  'landing.howEyebrow': { en: 'How a session goes', id: 'Jalannya satu sesi' },
  'landing.howTitle': {
    en: 'From explaining to understanding.',
    id: 'Dari menjelaskan jadi memahami.',
  },
  'landing.howAside': {
    en: "Start with one concept. Explain it at your own pace, respond to your student's questions, and use the feedback to guide your next attempt.",
    id: 'Mulai dari satu konsep. Jelaskan sesuai temponya sendiri, jawab pertanyaan muridmu, lalu pakai masukannya sebagai arah untuk percobaan berikutnya.',
  },
  'landing.step1Title': { en: 'Prepare your topic', id: 'Siapkan materimu' },
  'landing.step1Body': {
    en: 'Create a workspace and choose your AI student. Add a reference PDF, paste your notes, or find a source to give your evaluation more context.',
    id: 'Buat ruang kerja dan pilih murid AI-mu. Tambahkan PDF acuan, tempel catatanmu, atau cari sumber supaya penilaiannya punya konteks lebih.',
  },
  'landing.step2Title': { en: 'Teach in your own words', id: 'Ajarkan dengan kata-katamu sendiri' },
  'landing.step2BodyA': {
    en: 'Write or draw on the whiteboard, and record your voice if you like. Press',
    id: 'Tulis atau gambar di papan tulis, dan rekam suaramu kalau mau. Tekan',
  },
  'landing.step2BodyB': {
    en: 'to share your explanation with your AI student.',
    id: 'untuk membagikan penjelasanmu ke murid AI-mu.',
  },
  'landing.step3Title': { en: 'Work through the questions', id: 'Tanggapi pertanyaannya' },
  'landing.step3Body': {
    en: 'Your student responds to your explanation and asks about unclear parts. Answer in chat, add an example, or update the board and teach again.',
    id: 'Muridmu menanggapi penjelasanmu dan menanyakan bagian yang belum jelas. Jawab lewat obrolan, tambahkan contoh, atau perbarui papannya lalu ajarkan lagi.',
  },
  'landing.step4Title': { en: 'Reflect and try again', id: 'Renungkan lalu coba lagi' },
  'landing.step4BodyA': {
    en: 'End the session to read a letter and a notebook of what your student',
    id: 'Akhiri sesinya untuk membaca surat dan buku catatan berisi apa yang',
  },
  'landing.step4BodyB': { en: 'and is', id: 'dan apa yang masih', },
  'landing.step4BodyC': {
    en: 'about. Use the suggested next topics to decide what to explain next.',
    id: 'oleh muridmu. Pakai usulan materi berikutnya untuk menentukan apa yang kamu jelaskan selanjutnya.',
  },
  'landing.letterKicker': {
    en: 'An example of student feedback',
    id: 'Contoh masukan dari murid',
  },
  'landing.letterQuote': {
    en: '“Arif-sensei, I think I finally get why C4 plants bother with the extra step. But when you drew the two cell types I wrote them down without really following. If you asked me now which one has the rubisco, I would guess.”',
    id: '“Arif-sensei, sepertinya aku akhirnya paham kenapa tumbuhan C4 repot-repot menambah satu langkah. Tapi waktu sensei menggambar dua jenis selnya, aku cuma mencatat tanpa benar-benar mengikuti. Kalau sekarang ditanya yang mana punya rubisco, aku cuma bisa menebak.”',
  },
  'landing.letterBy': {
    en: 'Illustrative example from Yuzuki',
    id: 'Contoh ilustrasi dari Yuzuki',
  },
  'landing.stat1': {
    en: 'students, each with their own temperament',
    id: 'murid, masing-masing dengan wataknya sendiri',
  },
  'landing.stat2': {
    en: 'workspace for your board, references, and conversation',
    id: 'ruang kerja untuk papan, acuan, dan percakapanmu',
  },
  'landing.stat3': {
    en: 'steps: prepare, explain, respond, and reflect',
    id: 'langkah: siapkan, jelaskan, tanggapi, renungkan',
  },
  'landing.studentsEyebrow': { en: "Who you'll be teaching", id: 'Siapa yang akan kamu ajari' },
  'landing.studentsTitle': {
    en: 'Meet your next AI student.',
    id: 'Kenalan dengan murid AI berikutnya.',
  },
  'landing.studentsAside': {
    en: 'Choose from {names} when you set up a workspace. Each brings a different personality to the conversation. You bring the topic and the explanation.',
    id: 'Pilih {names} saat menyiapkan ruang kerja. Masing-masing membawa kepribadian yang berbeda ke percakapan. Kamu yang membawa materi dan penjelasannya.',
  },
  'landing.pricingEyebrow': { en: 'Access and plan previews', id: 'Akses dan pratinjau paket' },
  'landing.pricingTitle': {
    en: 'Start learning. See what is planned.',
    id: 'Mulai belajar. Lihat apa yang sedang direncanakan.',
  },
  'landing.pricingLead': {
    en: 'Try the current Cogniva experience for free. Sensei and Sekolah below are proposed paid plans, with indicative prices in IDR. Paid checkout is not available yet.',
    id: 'Coba Cogniva yang ada sekarang secara gratis. Sensei dan Sekolah di bawah masih paket berbayar yang diusulkan, dengan harga perkiraan dalam rupiah. Pembayaran belum tersedia.',
  },
  'landing.billingPeriod': { en: 'Billing period', id: 'Periode penagihan' },
  'landing.monthly': { en: 'Monthly', id: 'Bulanan' },
  'landing.annual': { en: 'Annual', id: 'Tahunan' },
  'landing.proposedAnnual': {
    en: 'Proposed annual total: Rp 468.000',
    id: 'Usulan total tahunan: Rp 468.000',
  },
  'landing.proposedMonthly': { en: 'Proposed monthly price', id: 'Usulan harga bulanan' },
  'landing.freeTag': {
    en: 'Explore a topic by explaining it to an AI student.',
    id: 'Dalami satu materi dengan menjelaskannya ke murid AI.',
  },
  'landing.toGetStarted': { en: 'to get started', id: 'untuk memulai' },
  'landing.startNow': { en: 'Start now', id: 'Mulai sekarang' },
  'landing.freeFeature1': {
    en: 'Choose from three AI students',
    id: 'Pilih dari tiga murid AI',
  },
  'landing.freeFeature2': {
    en: 'Whiteboard, voice recording, chat',
    id: 'Papan tulis, rekaman suara, obrolan',
  },
  'landing.freeFeature3': {
    en: 'Letter, notebook and next topics',
    id: 'Surat, buku catatan, dan materi berikutnya',
  },
  'landing.freeFeature4': {
    en: 'Save workspaces when signed in',
    id: 'Ruang kerja tersimpan saat kamu masuk',
  },
  'landing.planPreview': { en: 'Plan preview', id: 'Pratinjau paket' },
  'landing.senseiTag': {
    en: 'A proposed plan for a regular learning-by-teaching routine.',
    id: 'Usulan paket untuk kamu yang rutin belajar dengan mengajar.',
  },
  'landing.perMonth': { en: '/ month', id: '/ bulan' },
  'landing.takeSensei': { en: 'Take Sensei', id: 'Ambil Sensei' },
  'landing.senseiFeature1': {
    en: 'Unlimited workspaces and rounds',
    id: 'Ruang kerja dan putaran tanpa batas',
  },
  'landing.senseiFeature2': { en: 'Extended report history', id: 'Riwayat laporan lebih panjang' },
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
    en: 'A proposed plan for classrooms and study groups.',
    id: 'Usulan paket untuk ruang kelas dan kelompok belajar.',
  },
  'landing.perStudent': { en: '/ student / month', id: '/ murid / bulan' },
  'landing.schoolNote': {
    en: 'Plan preview · proposed minimum of 20 students',
    id: 'Pratinjau paket · usulan minimal 20 murid',
  },
  'landing.aboutAvailability': {
    en: 'About plan availability',
    id: 'Soal ketersediaan paket',
  },
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
  'landing.faqLead': {
    en: 'Getting started, choosing a student, and making the most of your teaching session.',
    id: 'Cara memulai, memilih murid, dan memanfaatkan sesi mengajarmu semaksimal mungkin.',
  },
  'landing.faqWhatQ': { en: 'What is Cogniva?', id: 'Apa itu Cogniva?' },
  'landing.faqWhatA': {
    en: 'Cogniva is a learning-by-teaching study space. You explain a topic to an AI student using a whiteboard, optional voice recordings, and chat. The student responds, asks questions, and helps you see which parts of your explanation need more work.',
    id: 'Cogniva adalah ruang belajar dengan cara mengajar. Kamu menjelaskan satu materi ke murid AI lewat papan tulis, rekaman suara kalau mau, dan obrolan. Muridnya menanggapi, bertanya, dan membantumu melihat bagian penjelasan mana yang masih perlu digarap.',
  },
  'landing.faqWhoQ': { en: 'Who is Cogniva for?', id: 'Cogniva untuk siapa?' },
  'landing.faqWhoA': {
    en: 'Anyone who wants to practise explaining what they are studying. Use it to review a lesson, prepare an explanation for class, or work through a concept in your own words. You do not need teaching experience.',
    id: 'Siapa pun yang ingin berlatih menjelaskan apa yang sedang dipelajarinya. Pakai untuk mengulang pelajaran, menyiapkan penjelasan untuk di kelas, atau menuntaskan satu konsep dengan kata-katamu sendiri. Kamu tidak perlu pengalaman mengajar.',
  },
  'landing.faqStartQ': {
    en: 'How do I start my first session?',
    id: 'Bagaimana cara memulai sesi pertamaku?',
  },
  'landing.faqStartA': {
    en: 'Open the sign-in window and sign in, create an account, or continue as a guest. From the dashboard, create a workspace, choose a student, and prepare your board. Press Teach when you are ready to share your explanation.',
    id: 'Buka jendela masuk lalu masuk, buat akun, atau lanjut sebagai tamu. Dari dasbor, buat ruang kerja, pilih murid, dan siapkan papanmu. Tekan Ajarkan begitu kamu siap membagikan penjelasanmu.',
  },
  'landing.faqGuestQ': {
    en: 'What is the difference between a guest session and an account?',
    id: 'Apa bedanya sesi tamu dan punya akun?',
  },
  'landing.faqGuestA': {
    en: 'Guest sessions let you try Cogniva without an account. Guest work is not saved to your account and ends when you reload, close the page, or sign in. With an account, your workspaces and session results are saved so you can return to them.',
    id: 'Sesi tamu membuatmu bisa mencoba Cogniva tanpa akun. Pekerjaan sebagai tamu tidak tersimpan ke akun mana pun dan berakhir saat kamu memuat ulang, menutup halaman, atau masuk. Dengan akun, ruang kerja dan hasil sesimu tersimpan supaya bisa kamu buka lagi.',
  },
  'landing.faqStudentQ': { en: 'Can I choose my AI student?', id: 'Bisakah aku memilih murid AI-ku?' },
  'landing.faqStudentA': {
    en: 'Yes. Choose from {names} when setting up your workspace. Each character has a different personality, so you can choose the student you would like to teach.',
    id: 'Bisa. Pilih {names} saat menyiapkan ruang kerjamu. Tiap karakter punya kepribadian berbeda, jadi kamu bisa memilih murid yang ingin kamu ajari.',
  },
  'landing.faqPdfQ': { en: 'Do I need to upload a PDF?', id: 'Apakah aku harus mengunggah PDF?' },
  'landing.faqPdfA': {
    en: 'No. You can begin with your own explanation. For more context in the evaluation, upload a reference PDF, paste notes, or use the reference finder to look for a source. Review any suggested source before using it.',
    id: 'Tidak. Kamu bisa mulai dengan penjelasanmu sendiri. Untuk konteks tambahan saat penilaian, unggah PDF acuan, tempel catatan, atau pakai pencari referensi untuk mencari sumber. Periksa dulu sumber yang disarankan sebelum kamu pakai.',
  },
  'landing.faqVoiceQ': {
    en: 'Do I have to use a microphone or draw?',
    id: 'Apakah aku wajib memakai mikrofon atau menggambar?',
  },
  'landing.faqVoiceA': {
    en: 'Voice recording is optional. You can type text and add shapes on the whiteboard, then use chat for follow-up explanations. If you record your voice, your browser will ask for microphone access.',
    id: 'Merekam suara sifatnya opsional. Kamu bisa mengetik teks dan menambah bentuk di papan tulis, lalu memakai obrolan untuk penjelasan lanjutan. Kalau kamu merekam suara, peramban akan meminta izin mikrofon.',
  },
  'landing.faqTeachQ': {
    en: 'When does the AI student respond?',
    id: 'Kapan murid AI-nya menanggapi?',
  },
  'landing.faqTeachA': {
    en: 'Press Teach to submit your current board and any recorded explanation. The student responds after processing that teaching step. You can also send a chat message to continue the conversation.',
    id: 'Tekan Ajarkan untuk mengirim isi papanmu saat ini beserta rekaman penjelasan kalau ada. Muridnya menanggapi setelah memproses langkah mengajar itu. Kamu juga bisa mengirim pesan obrolan untuk melanjutkan percakapan.',
  },
  'landing.faqReportQ': {
    en: 'What do I get at the end of a session?',
    id: 'Aku dapat apa di akhir sesi?',
  },
  'landing.faqReportA': {
    en: 'Your report includes a letter from your AI student, notes on what they learned and what remains unclear, a reflection, and suggested next topics. Use it to choose which part of your explanation to revisit.',
    id: 'Laporanmu berisi surat dari murid AI-mu, catatan tentang apa yang dia pahami dan apa yang masih belum jelas, sebuah refleksi, serta usulan materi berikutnya. Pakai itu untuk memilih bagian penjelasan mana yang perlu kamu tengok lagi.',
  },
  'landing.faqAgainQ': { en: 'Can I teach the same topic again?', id: 'Bisakah aku mengajarkan materi yang sama lagi?' },
  'landing.faqAgainA': {
    en: 'Yes. You can resume a completed workspace and start another teaching round. The workspace report updates after a new evaluation, so revisit the latest feedback as you refine your explanation.',
    id: 'Bisa. Kamu bisa melanjutkan ruang kerja yang sudah selesai dan memulai putaran mengajar berikutnya. Laporannya diperbarui setelah penilaian baru, jadi baca lagi masukan terbarunya sambil kamu memperhalus penjelasanmu.',
  },
  'landing.faqGradeQ': { en: 'Is the feedback a final grade?', id: 'Apakah masukannya termasuk nilai akhir?' },
  'landing.faqGradeA': {
    en: 'No. It is AI-generated feedback on your explanation, intended to help you reflect and practise. It can miss context or make mistakes. Check important points against your course material, reference sources, or a teacher.',
    id: 'Bukan. Itu masukan yang dihasilkan AI atas penjelasanmu, untuk membantumu merenung dan berlatih. Masukannya bisa kehilangan konteks atau keliru. Periksa hal-hal penting ke materi kuliahmu, sumber acuan, atau gurumu.',
  },
  'landing.faqPlansQ': {
    en: 'Can I buy a Sensei or Sekolah subscription now?',
    id: 'Bisakah aku berlangganan Sensei atau Sekolah sekarang?',
  },
  'landing.faqPlansA': {
    en: 'Paid checkout is not available in the current app. Sensei and Sekolah are plan previews, and their listed prices and features are proposals. The buttons open sign-in so you can try the current learning experience; they do not purchase a subscription.',
    id: 'Pembayaran belum tersedia di aplikasi ini. Sensei dan Sekolah masih pratinjau paket, dan harga serta fiturnya masih usulan. Tombolnya membuka halaman masuk supaya kamu bisa mencoba pengalaman belajar yang ada sekarang; tombol itu tidak membeli langganan apa pun.',
  },
  'landing.aboutTitle': {
    en: 'A place to practise what you understand.',
    id: 'Tempat melatih apa yang kamu pahami.',
  },
  'landing.aboutPara1': {
    en: 'Cogniva is built around learning by teaching. Choosing your words, connecting ideas, and answering questions gives you a way to examine your own understanding. Our workspace brings that practice together with an AI student you can teach.',
    id: 'Cogniva dibangun di sekitar gagasan belajar dengan mengajar. Memilih kata, menghubungkan gagasan, dan menjawab pertanyaan memberimu cara untuk memeriksa pemahamanmu sendiri. Ruang kerja kami menyatukan latihan itu dengan murid AI yang bisa kamu ajari.',
  },
  'landing.aboutPara2': {
    en: 'Your board holds the explanation, chat keeps the conversation going, and the report gives you something concrete to reflect on. Start with what you know, notice what needs another example, and return for another teaching round.',
    id: 'Papanmu menampung penjelasannya, obrolan menjaga percakapan tetap berjalan, dan laporannya memberimu sesuatu yang konkret untuk direnungkan. Mulai dari yang sudah kamu tahu, perhatikan bagian yang butuh contoh lain, lalu kembali untuk putaran mengajar berikutnya.',
  },
  'landing.believeKicker': {
    en: 'Explain in your own words',
    id: 'Jelaskan dengan kata-katamu sendiri',
  },
  'landing.believeBody': {
    en: 'Build an explanation with your own examples, diagrams, and reasoning.',
    id: 'Susun penjelasan dengan contoh, diagram, dan penalaranmu sendiri.',
  },
  'landing.conversationKicker': {
    en: 'Learn through conversation',
    id: 'Belajar lewat percakapan',
  },
  'landing.conversationBody': {
    en: "Use your student's questions to spot missing steps and try a clearer explanation.",
    id: 'Pakai pertanyaan muridmu untuk menemukan langkah yang hilang dan mencoba penjelasan yang lebih jernih.',
  },
  'landing.reflectKicker': { en: 'Reflect, then revisit', id: 'Renungkan, lalu tengok lagi' },
  'landing.reflectBody': {
    en: 'Turn feedback into your next study step, whether that is a better example or a new topic.',
    id: 'Ubah masukannya jadi langkah belajar berikutnya, entah itu contoh yang lebih baik atau materi baru.',
  },
  'landing.closingTitle': {
    en: 'What will you teach today?',
    id: 'Hari ini kamu mau mengajarkan apa?',
  },
  'landing.closingLead': {
    en: 'Bring one concept, choose an AI student, and explain it your way. Your next question is a chance to understand it better.',
    id: 'Bawa satu konsep, pilih murid AI, lalu jelaskan dengan caramu. Pertanyaan berikutnya adalah kesempatan untuk memahaminya lebih baik.',
  },
  'landing.tagline': {
    en: 'A study space for explaining ideas, asking better questions, and learning through the act of teaching an AI student.',
    id: 'Ruang belajar untuk menjelaskan gagasan, mengajukan pertanyaan yang lebih baik, dan belajar lewat tindakan mengajari murid AI.',
  },
  'landing.startSession': { en: 'Start a teaching session', id: 'Mulai sesi mengajar' },
  'landing.goToDashboard': { en: 'Go to your dashboard', id: 'Buka dasbormu' },
  'landing.footerLabel': { en: 'Cogniva footer', id: 'Footer Cogniva' },
  'landing.footerHome': { en: 'Cogniva home', id: 'Beranda Cogniva' },
  'landing.footerNavLabel': { en: 'Explore and get help', id: 'Jelajahi dan cari bantuan' },
  'landing.footerExplore': { en: 'Explore Cogniva', id: 'Jelajahi Cogniva' },
  'landing.footerMeetStudents': { en: 'Meet the AI students', id: 'Kenali murid-murid AI' },
  'landing.footerFeedback': { en: 'Student feedback', id: 'Masukan dari murid' },
  'landing.footerAccess': { en: 'Access and plans', id: 'Akses dan paket' },
  'landing.footerAllQuestions': { en: 'All questions', id: 'Semua pertanyaan' },
  'landing.footerFirstSession': { en: 'Your first session', id: 'Sesi pertamamu' },
  'landing.footerGettingStarted': { en: 'Getting started', id: 'Cara memulai' },
  'landing.footerChooseStudent': { en: 'Choose a student', id: 'Memilih murid' },
  'landing.footerPrepareRefs': { en: 'Prepare references', id: 'Menyiapkan acuan' },
  'landing.footerBoardVoice': { en: 'Whiteboard and voice', id: 'Papan tulis dan suara' },
  'landing.footerTeachButton': { en: 'Using the Teach button', id: 'Memakai tombol Ajarkan' },
  'landing.footerKeepLearning': { en: 'Keep learning', id: 'Lanjut belajar' },
  'landing.footerGuestOrAccount': { en: 'Guest or account?', id: 'Tamu atau akun?' },
  'landing.footerReadReport': { en: 'Read your report', id: 'Membaca laporanmu' },
  'landing.footerAnotherRound': { en: 'Teach another round', id: 'Mengajar satu putaran lagi' },
  'landing.footerAiFeedback': {
    en: 'Understanding AI feedback',
    id: 'Memahami masukan dari AI',
  },
  'landing.footerPlanAvailability': { en: 'Plan availability', id: 'Ketersediaan paket' },
  'landing.footerAboutCogniva': { en: 'About Cogniva', id: 'Tentang Cogniva' },
  'landing.footerApproach': { en: 'Our approach', id: 'Pendekatan kami' },
  'landing.footerLbt': { en: 'Learning by teaching', id: 'Belajar dengan mengajar' },
  'landing.footerWhoFor': { en: 'Who it is for', id: 'Untuk siapa' },
  'landing.footerTeam': { en: 'Meet the team', id: 'Kenali timnya' },
  'landing.backToTop': { en: 'Back to top', id: 'Kembali ke atas' },
  'landing.copyright': { en: '© {year} Cogniva.', id: '© {year} Cogniva.' },
  'landing.motto': {
    en: 'Explain. Question. Reflect. Teach again.',
    id: 'Jelaskan. Tanyakan. Renungkan. Ajarkan lagi.',
  },
  'landing.previous': { en: 'Previous', id: 'Sebelumnya' },
  'landing.next': { en: 'Next', id: 'Berikutnya' },

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
