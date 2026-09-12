# GAPS_EVALUATOR.md

Catatan celah kontrak + bukti uji untuk Evaluator, mengikuti pola
`GAPS_VISION.md` yang disebut `CLAUDE.md`.

Dokumen ini dibuat **setelah** perubahan dikerjakan, bukan sebagai proposal.
Isinya adalah catatan apa yang berubah dan apa yang masih terbuka.

---

## 1. Breakdown Evaluator tidak pernah sampai ke frontend — SELESAI

**Masalah.** `buildEvaluationReport()` meratakan `EvaluationResult` menjadi
surat naratif + 4 bullet `learned` + 4 bullet `stillConfused`. `score` hanya
dipakai memilih nada surat lalu dibuang; `category` per finding cuma dipakai
memisah CORRECT dari sisanya; `evidenceTurnIndex` tidak pernah disentuh sama
sekali. Semua data itu sudah dihitung Evaluator dengan benar, lalu hilang
sebelum mencapai `EvaluationReportDTO`.

**Perubahan.** `EvaluationReport` (contracts/workspace.ts) kini membawa
`score`, `depthScore`, `findings`, dan `transcript` di samping bagian
naratifnya. Bagian naratif tidak dihapus: surat dan notebook tetap dihasilkan
seperti sebelumnya.

---

## 2. `sourceQuote` pada Finding — SELESAI

**Tujuan.** Menyorot satu kalimat, bukan satu turn utuh.

**Kontrak.** `sourceQuote?: string` di `findingSchema`
(contracts/evaluation.ts). Opsional di dua arah: konsep MISSED tidak punya turn
untuk dikutip, dan guard membuang kutipan yang tidak bisa ditemukan.

**Yang tidak jelas di rencana awal.** Prompt bisa meminta substring verbatim,
tapi tidak ada yang memverifikasinya. Model memparafrase, frontend mencari
string yang tidak ada, dan highlight gagal tanpa error apa pun.

**Penyelesaian.** `normalizeEvaluation()` menerima parameter keempat
`turns: TranscriptTurn[]`. Untuk tiap finding bersourceQuote, guard mencari
turn yang `turnIndex`-nya cocok dengan `evidenceTurnIndex`, lalu memastikan
kutipan itu benar-benar ada di `boardText` atau `speech` turn tersebut.

Toleransi yang diberikan: beda runs whitespace (papan tulis punya newline yang
diratakan model) dan beda kapitalisasi di batas kalimat. Selain itu dianggap
parafrase.

**Keputusan yang perlu diketahui reviewer.** Untuk kutipan yang cocok, guard
mengembalikan potongan dari teks sumber, bukan string yang dikirim model.
Karena pencocokannya toleran, mengembalikan versi model akan membuat
`indexOf` di frontend tetap gagal untuk kasus beda whitespace/kapitalisasi.

Kutipan yang ditolak **tidak** membuang findingnya. Penilaiannya tetap sah
tanpa anchor presisi; UI jatuh ke menyorot seluruh turn.

---

## 3. `depthScore` sebagai aksis terpisah — SELESAI

`depthScore: z.number().int().min(0).max(100)` di level `EvaluationResult`,
bukan per finding. Mengukur seberapa dalam mekanisme dijelaskan, terpisah dari
`score` yang mengukur benar/lengkap.

Mock offline (`evaluator.mock.ts`) memakai proxy panjang teks dibagi 20,
dibatasi maksimum 50. Coverage kata kunci tidak bisa mengukur kedalaman, jadi
angka itu sengaja tidak pernah tinggi — supaya debrief offline tidak mengklaim
penilaian yang tidak pernah dibuatnya.

---

## 4. Migrasi kolom breakdown pada tabel `report` — SUDAH DIEKSEKUSI

**Status: selesai, bukan lagi proposal.**

Nama migrasi: `20260912093000_report_evaluation_breakdown`

**Kenapa perlu.** `EvaluationResult` memang disimpan sebagai `payload Json` di
tabel `evaluation`, jadi sempat dikira tidak butuh migrasi. Tapi
`EvaluationReport` — yang benar-benar diambil frontend lewat
`GET /workspaces/:id/report` — punya tabel relasionalnya sendiri yang hanya
menyimpan `letter`, `reflection`, `continue_learning`, plus tabel anak
`learned` dan `confused`. Tidak ada tempat untuk breakdown, sehingga keempat
field baru akan ditulis lalu hilang saat dibaca kembali.

**SQL yang dijalankan.**

```sql
ALTER TABLE "report" ADD COLUMN     "score" INTEGER,
ADD COLUMN     "depth_score" INTEGER,
ADD COLUMN     "findings" JSONB,
ADD COLUMN     "transcript" JSONB;
```

Keempatnya **nullable**. Saat migrasi dijalankan ada 5 report lama di database;
semuanya selamat dengan kolom baru bernilai NULL. `getReport()` membaca NULL
sebagai `0` / `[]`, sehingga debrief lama tetap render (§10).

`findings` dan `transcript` disimpan sebagai JSON, bukan tabel anak seperti
`learned`/`confused`: tidak ada query yang masuk ke dalam satu finding, dan
bentuknya milik kontrak untuk diubah (§6.9).

**Bukti persist.** Suite `tests/db/persistence.test.ts` punya dua test baru:
`round-trips the Evaluator breakdown through Postgres` (menulis lewat store,
membaca balik lewat store, lalu memeriksa kolomnya langsung) dan
`reads a pre-migration report, whose breakdown columns are null`.

Catatan: kolom `jsonb` menormalkan urutan key, jadi perbandingan harus
key-order-insensitive (`toEqual`, bukan `JSON.stringify`).

---

## Yang masih terbuka

**Drift checksum migrasi `20260905120000_persist_all_stores`.** File migrasi itu
diedit di commit `dc4eae3` **setelah** sudah diterapkan ke database. Perubahannya
tidak berbahaya (`ADD COLUMN` menjadi `ADD COLUMN IF NOT EXISTS`, skema hasilnya
identik), tapi checksumnya jadi tidak cocok dengan yang tercatat di
`_prisma_migrations`.

Akibatnya `prisma migrate dev` menolak jalan dan menawarkan **reset database**.
Migrasi di dokumen ini diterapkan dengan `prisma migrate deploy`, yang tidak
melakukan pemeriksaan drift itu, sehingga data tidak hilang.

Siapa pun yang sudah menerapkan migrasi tersebut sebelum `dc4eae3` akan
menemui dinding yang sama. Perbaikan permanennya adalah menyamakan checksum
tersimpan dengan isi file, dan itu keputusan pemilik database.

**Frontend belum memakai field barunya.** `EvaluationReportDTO` sudah sinkron
dan `MockCognivaBridge` sudah mengisi contoh yang konsisten, tapi layar
Evaluation belum merender breakdown per-aksis maupun highlight kalimat.
