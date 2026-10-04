import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from '../Marketing.module.css'
import { Faq } from '../Faq'
import { SectionHead } from '../blocks'
import { useLocale } from '../../../i18n/LanguageProvider'
import type { Locale } from '../../../i18n/messages'

const EN = {
  eyebrow: 'Pricing',
  title: 'Free to learn with. Paid when you want her to remember.',
  lead: 'Prices in rupiah. Every plan includes all three students, the whole teaching loop and the full debrief; paid tiers change how much of it you keep.',
  billingLabel: 'Billing period',
  monthly: 'Monthly',
  annual: 'Annual · 2 months free',
  belajar: {
    tag: 'For finding out whether teaching actually works on you.',
    unit: 'forever',
    cta: 'Start now',
    features: [
      'Choice of all three students',
      'Whiteboard, voice recording and chat',
      'Letter, notebook and next topics',
      'Saved workspaces once you sign in',
      'Reports kept for 7 days',
    ],
  },
  sensei: {
    badge: 'Proposed',
    tag: 'For someone with an exam, a thesis, or a habit.',
    unit: '/ month',
    noteMonthly: 'Or Rp 39.000 on annual billing',
    noteAnnual: 'Billed Rp 468.000 yearly',
    cta: 'Take Sensei',
    features: [
      'Unlimited workspaces and rounds',
      'Extended report history, round by round',
      'Reference PDFs up to 100 pages',
      'Deeper evaluation that remembers earlier rounds',
      'Export letters and notes',
    ],
  },
  sekolah: {
    tag: 'For a class, a study group, or a whole school.',
    unit: '/ student / month',
    note: 'Minimum 20 students',
    cta: 'Talk to us',
    features: [
      'Everything in Sensei',
      'Teacher view: who taught what, and how it went',
      'Assign a topic to a whole class',
      'Which concepts a class consistently misses',
      'Invoicing, onboarding session, priority support',
    ],
  },
  noticeStrong: 'Checkout is deliberately not live yet.',
  noticeRest: ' Accounts exist and usage is already metered, but there is no balance, payment integration or invoicing. These prices are proposals we want feedback on before we build any of that.',
  compare: {
    eyebrow: 'Line by line',
    title: 'What changes between plans',
    feature: 'Feature',
    rows: [
      { name: 'Active workspaces', a: '3', b: 'Unlimited', c: 'Unlimited' },
      { name: 'Rounds per topic', a: 'Unlimited', b: 'Unlimited', c: 'Unlimited' },
      { name: 'Report history', a: '7 days', b: 'Forever', c: 'Forever' },
      { name: 'Reference PDF length', a: 'Up to 20 pages', b: 'Up to 100 pages', c: 'Up to 100 pages' },
      { name: 'Evaluation memory', a: 'This round only', b: 'Remembers earlier rounds', c: 'Remembers earlier rounds' },
      { name: 'Export letters & notes', a: '–', b: 'PDF', c: 'PDF' },
      { name: 'Student voice', a: 'Where available', b: 'Where available', c: 'Where available' },
      { name: 'Indonesian & English', a: 'Both', b: 'Both', c: 'Both' },
      { name: 'Teacher view', a: '–', b: '–', c: 'Class-level findings' },
      { name: 'Support', a: 'Community', b: 'Email', c: 'Priority + onboarding' },
    ],
  },
  market: {
    eyebrow: 'About three US dollars',
    title: 'Priced where students already pay, for the opposite service.',
    aside: 'Willingness to pay is proven: Khanmigo went from roughly 68,000 users in 2023–24 to over 1.4 million by mid-2025 at about USD 4 per month. Cogniva sits in the same bracket and offers something answer services structurally cannot.',
    rows: [
      { product: 'Khanmigo (Khan Academy)', price: '≈ USD 4 / month', what: 'An AI tutor that guides you toward answers', ours: false },
      { product: 'Quizlet Plus', price: '≈ USD 3 / month, annual', what: 'AI flashcards, practice tests, study guides', ours: false },
      { product: 'Chegg Study', price: '≈ USD 15.95 / month', what: 'Step-by-step solutions and expert Q&A', ours: false },
      { product: 'Human tutoring', price: '≈ USD 15–40 / session', what: 'One-to-one help from a person', ours: false },
      { product: 'Cogniva Sensei', price: '≈ USD 3 / month', what: 'An AI student you teach: active recall, not answer delivery', ours: true },
    ],
  },
  faq: {
    eyebrow: 'Plans & billing',
    title: 'Fair questions about money',
    more: 'More questions →',
    items: [
      { q: 'Can I pay for Cogniva today?', a: "No. Accounts are in place and every session's token usage is metered, but balances, payment integration, usage history and invoices are still to be built. Sensei is where we will start." },
      { q: 'What happens to my free workspaces if I upgrade?', a: 'They stay exactly as they are. Upgrading lifts limits; nothing is deleted, migrated or reformatted.' },
      { q: 'Why is a paid tier needed at all?', a: 'A session with voice costs roughly Rp 1.420 to run: about Rp 690 of model tokens, Rp 660 of GPU time and Rp 70 of server. Voice roughly doubles the marginal cost at low volume, which is the honest argument for it being a paid feature.' },
      { q: 'Do I need an account to use the free plan?', a: 'No, guest mode works immediately. Signing in is what makes workspaces and reports survive beyond the browser you happen to be using.' },
      { q: 'Is the Sekolah minimum negotiable?', a: 'The 20-student minimum is a starting assumption, not a policy. If you run a class or a tutoring centre and the shape is wrong, tell us; we would rather adjust it than guess.' },
      { q: 'Will prices change?', a: "Probably. They are derived from an architectural cost estimate, not from production billing. The session token meter already records real usage, and it will replace the estimate before we take anyone's money." },
    ],
  },
}

const ID: typeof EN = {
  eyebrow: 'Harga',
  title: 'Gratis untuk belajar. Berbayar kalau kamu ingin dia mengingat.',
  lead: 'Harga dalam rupiah. Setiap paket sudah termasuk ketiga murid, seluruh putaran mengajar, dan laporan lengkap; paket berbayar mengubah seberapa banyak yang bisa kamu simpan.',
  billingLabel: 'Periode penagihan',
  monthly: 'Bulanan',
  annual: 'Tahunan · gratis 2 bulan',
  belajar: {
    tag: 'Untuk mencari tahu apakah belajar dengan mengajar cocok untukmu.',
    unit: 'selamanya',
    cta: 'Mulai sekarang',
    features: [
      'Bebas memilih ketiga murid',
      'Papan tulis, rekaman suara, dan obrolan',
      'Surat, buku catatan, dan materi berikutnya',
      'Ruang kerja tersimpan setelah kamu masuk',
      'Laporan disimpan selama 7 hari',
    ],
  },
  sensei: {
    badge: 'Usulan',
    tag: 'Untuk yang sedang menghadapi ujian, skripsi, atau ingin rutin.',
    unit: '/ bulan',
    noteMonthly: 'Atau Rp 39.000 dengan tagihan tahunan',
    noteAnnual: 'Ditagih Rp 468.000 per tahun',
    cta: 'Ambil Sensei',
    features: [
      'Ruang kerja dan putaran tanpa batas',
      'Riwayat laporan lebih panjang, per putaran',
      'PDF acuan sampai 100 halaman',
      'Penilaian lebih dalam yang ingat putaran sebelumnya',
      'Ekspor surat dan catatan',
    ],
  },
  sekolah: {
    tag: 'Untuk satu kelas, kelompok belajar, atau satu sekolah.',
    unit: '/ murid / bulan',
    note: 'Minimal 20 murid',
    cta: 'Hubungi kami',
    features: [
      'Semua yang ada di Sensei',
      'Tampilan guru: siapa mengajarkan apa, dan bagaimana hasilnya',
      'Tugaskan satu materi ke seluruh kelas',
      'Konsep yang sering terlewat di satu kelas',
      'Penagihan, sesi pengenalan, dukungan prioritas',
    ],
  },
  noticeStrong: 'Pembayaran memang belum dibuka.',
  noticeRest: ' Akun sudah ada dan pemakaian sudah diukur, tapi belum ada saldo, integrasi pembayaran, atau tagihan. Harga ini masih usulan yang ingin kami dengar masukannya sebelum membangun semua itu.',
  compare: {
    eyebrow: 'Baris demi baris',
    title: 'Yang berbeda di tiap paket',
    feature: 'Fitur',
    rows: [
      { name: 'Ruang kerja aktif', a: '3', b: 'Tanpa batas', c: 'Tanpa batas' },
      { name: 'Putaran per materi', a: 'Tanpa batas', b: 'Tanpa batas', c: 'Tanpa batas' },
      { name: 'Riwayat laporan', a: '7 hari', b: 'Selamanya', c: 'Selamanya' },
      { name: 'Panjang PDF acuan', a: 'Sampai 20 halaman', b: 'Sampai 100 halaman', c: 'Sampai 100 halaman' },
      { name: 'Ingatan penilaian', a: 'Hanya putaran ini', b: 'Ingat putaran sebelumnya', c: 'Ingat putaran sebelumnya' },
      { name: 'Ekspor surat & catatan', a: '–', b: 'PDF', c: 'PDF' },
      { name: 'Suara murid', a: 'Jika tersedia', b: 'Jika tersedia', c: 'Jika tersedia' },
      { name: 'Bahasa Indonesia & Inggris', a: 'Keduanya', b: 'Keduanya', c: 'Keduanya' },
      { name: 'Tampilan guru', a: '–', b: '–', c: 'Temuan tingkat kelas' },
      { name: 'Dukungan', a: 'Komunitas', b: 'Email', c: 'Prioritas + pengenalan' },
    ],
  },
  market: {
    eyebrow: 'Sekitar tiga dolar AS',
    title: 'Dihargai di kisaran yang sudah biasa dibayar pelajar, untuk layanan yang arahnya berlawanan.',
    aside: 'Kesediaan membayar sudah terbukti: pengguna Khanmigo naik dari sekitar 68.000 pada 2023–24 menjadi lebih dari 1,4 juta pada pertengahan 2025, dengan harga sekitar USD 4 per bulan. Cogniva ada di kisaran yang sama dan menawarkan sesuatu yang secara struktur tidak bisa diberikan layanan penjawab.',
    rows: [
      { product: 'Khanmigo (Khan Academy)', price: '≈ USD 4 / bulan', what: 'Tutor AI yang menuntunmu ke jawaban', ours: false },
      { product: 'Quizlet Plus', price: '≈ USD 3 / bulan, tahunan', what: 'Kartu hafalan AI, latihan soal, panduan belajar', ours: false },
      { product: 'Chegg Study', price: '≈ USD 15,95 / bulan', what: 'Solusi langkah demi langkah dan tanya jawab ahli', ours: false },
      { product: 'Les privat', price: '≈ USD 15–40 / sesi', what: 'Bantuan tatap muka dari seseorang', ours: false },
      { product: 'Cogniva Sensei', price: '≈ USD 3 / bulan', what: 'Murid AI yang kamu ajari: mengingat aktif, bukan menerima jawaban', ours: true },
    ],
  },
  faq: {
    eyebrow: 'Paket & penagihan',
    title: 'Pertanyaan wajar soal uang',
    more: 'Pertanyaan lainnya →',
    items: [
      { q: 'Bisakah aku membayar Cogniva hari ini?', a: 'Belum. Akun sudah ada dan pemakaian token setiap sesi sudah diukur, tapi saldo, integrasi pembayaran, riwayat pemakaian, dan tagihan masih perlu dibangun. Sensei akan jadi yang pertama.' },
      { q: 'Apa yang terjadi pada ruang kerja gratisku kalau aku upgrade?', a: 'Semuanya tetap seperti semula. Upgrade hanya membuka batas; tidak ada yang dihapus, dipindahkan, atau diubah formatnya.' },
      { q: 'Kenapa perlu paket berbayar?', a: 'Satu sesi dengan suara butuh biaya sekitar Rp 1.420: sekitar Rp 690 untuk token model, Rp 660 untuk waktu GPU, dan Rp 70 untuk server. Suara kira-kira menggandakan biaya marginal di volume rendah, dan itulah alasan jujur kenapa fitur ini berbayar.' },
      { q: 'Apakah perlu akun untuk memakai paket gratis?', a: 'Tidak, mode tamu langsung bisa dipakai. Masuk ke akun yang membuat ruang kerja dan laporanmu tetap ada di luar peramban yang sedang kamu pakai.' },
      { q: 'Apakah minimal murid untuk Sekolah bisa ditawar?', a: 'Minimal 20 murid adalah asumsi awal, bukan aturan. Kalau kamu mengelola kelas atau bimbel dan bentuknya tidak cocok, beri tahu kami; kami lebih suka menyesuaikannya daripada menebak.' },
      { q: 'Apakah harganya akan berubah?', a: 'Kemungkinan besar. Harga ini diturunkan dari perkiraan biaya arsitektur, bukan dari tagihan produksi. Pengukur token sesi sudah mencatat pemakaian nyata, dan angka itu akan menggantikan perkiraan sebelum kami menerima uang siapa pun.' },
    ],
  },
}

const COPY: Record<Locale, typeof EN> = { en: EN, id: ID }

function Features({ items }: { items: string[] }) {
  return (
    <ul className={styles.features} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item} className={styles.feature}>
          <span className={styles.tick} aria-hidden="true">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function PricingPage() {
  const { locale } = useLocale()
  const c = COPY[locale]
  const [annual, setAnnual] = useState(false)

  return (
    <>
      <section className={styles.bgCream} style={{ borderTop: 'none' }}>
        <div className={styles.centerHero}>
          <span className={styles.eyebrow}>{c.eyebrow}</span>
          <h1 className={styles.h1}>{c.title}</h1>
          <p className={styles.lead}>{c.lead}</p>
          <div className={styles.billing} role="group" aria-label={c.billingLabel}>
            <button
              type="button"
              className={annual ? styles.billingTab : `${styles.billingTab} ${styles.billingTabOn}`}
              aria-pressed={!annual}
              onClick={() => setAnnual(false)}
            >
              {c.monthly}
            </button>
            <button
              type="button"
              className={annual ? `${styles.billingTab} ${styles.billingTabOn}` : styles.billingTab}
              aria-pressed={annual}
              onClick={() => setAnnual(true)}
            >
              {c.annual}
            </button>
          </div>
        </div>
      </section>

      <section className={styles.bgPage}>
        <div className={styles.container} style={{ paddingTop: 56, gap: 24 }}>
          <div className={styles.plans}>
            <div className={styles.plan}>
              <div className={styles.planHead}>
                <h2 className={styles.planName}>Belajar</h2>
                <p className={styles.planTag}>{c.belajar.tag}</p>
              </div>
              <div className={styles.priceRow}>
                <span className={styles.price}>Rp 0</span>
                <span className={styles.priceUnit}>{c.belajar.unit}</span>
              </div>
              <Link to="/home" className={`${styles.btnGhost} ${styles.btnSm} ${styles.btnBlock}`}>
                {c.belajar.cta}
              </Link>
              <div className={styles.planRule} />
              <Features items={c.belajar.features} />
            </div>

            <div className={`${styles.plan} ${styles.planDark} ${styles.onDark}`}>
              <span className={styles.planBadge}>{c.sensei.badge}</span>
              <div className={styles.planHead}>
                <h2 className={styles.planName}>Sensei</h2>
                <p className={styles.planTag}>{c.sensei.tag}</p>
              </div>
              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <span className={styles.price}>Rp {annual ? '39.000' : '49.000'}</span>
                  <span className={styles.priceUnit}>{c.sensei.unit}</span>
                </div>
                <span className={styles.priceNote}>{annual ? c.sensei.noteAnnual : c.sensei.noteMonthly}</span>
              </div>
              <Link to="/home" className={`${styles.btnLime} ${styles.btnSm} ${styles.btnBlock}`}>
                {c.sensei.cta}
              </Link>
              <div className={styles.planRule} />
              <Features items={c.sensei.features} />
            </div>

            <div className={styles.plan}>
              <div className={styles.planHead}>
                <h2 className={styles.planName}>Sekolah</h2>
                <p className={styles.planTag}>{c.sekolah.tag}</p>
              </div>
              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <span className={styles.price}>Rp {annual ? '19.000' : '24.000'}</span>
                  <span className={styles.priceUnit}>{c.sekolah.unit}</span>
                </div>
                <span className={styles.priceNote}>{c.sekolah.note}</span>
              </div>
              <Link to="/about#contact" className={`${styles.btnGhost} ${styles.btnOutline} ${styles.btnSm} ${styles.btnBlock}`}>
                {c.sekolah.cta}
              </Link>
              <div className={styles.planRule} />
              <Features items={c.sekolah.features} />
            </div>
          </div>

          <div className={styles.notice}>
            <span className={styles.noticeIcon} aria-hidden="true">
              !
            </span>
            <p className={styles.small} style={{ fontSize: 14.5 }}>
              <strong>{c.noticeStrong}</strong>
              {c.noticeRest}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.bgCream}>
        <div className={styles.container}>
          <SectionHead eyebrow={c.compare.eyebrow} title={c.compare.title} />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{c.compare.feature}</th>
                  <th scope="col">Belajar</th>
                  <th scope="col" className={styles.tableHighlight}>
                    Sensei
                  </th>
                  <th scope="col">Sekolah</th>
                </tr>
              </thead>
              <tbody>
                {c.compare.rows.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.a}</td>
                    <td className={styles.tableHighlight}>{row.b}</td>
                    <td>{row.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={`${styles.bgForest} ${styles.onDark}`}>
        <div className={styles.container}>
          <SectionHead eyebrow={c.market.eyebrow} title={c.market.title} aside={c.market.aside} />
          <div className={styles.market}>
            {c.market.rows.map((row) => (
              <div key={row.product} className={row.ours ? `${styles.marketRow} ${styles.marketOurs}` : styles.marketRow}>
                <span className={styles.marketName}>{row.product}</span>
                <span className={styles.marketPrice}>{row.price}</span>
                <span className={styles.marketWhat}>{row.what}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.bgPage}>
        <div className={styles.container} style={{ gap: 32 }}>
          <SectionHead eyebrow={c.faq.eyebrow} title={c.faq.title} />
          <Faq items={c.faq.items} idPrefix="pricing-faq" />
          <Link to="/#faq" className={styles.link}>
            {c.faq.more}
          </Link>
        </div>
      </section>
    </>
  )
}
