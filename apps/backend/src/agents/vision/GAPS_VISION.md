# Vision (M2) — Catatan Integrasi & Usulan Perubahan Kontrak

Penanggung jawab: Fayyaz (Peran 5, §3.4). Dokumen ini menyertai implementasi
Vision nyata yang menggantikan stub M1 di `agents/vision/`. Semua sudah lolos
`npm run typecheck` dan `npm run test` (26/26). Tiga hal di bawah ini perlu
perhatianmu sebagai tech lead: dua diff aditif ke file bersama yang sudah
kuterapkan, dan dua usulan perubahan kontrak yang BELUM kuterapkan karena
mengubah `contracts/` adalah wewenangmu (§6, §12).

## A. Perubahan yang sudah diterapkan ke file bersama (aditif, aman)

Keduanya tidak mengubah perilaku agen lain (Learner/Evaluator). Kucatat di sini
supaya kamu tahu titik sentuhnya saat review.

1. **`config/index.ts`** — menambah `VISION_MODEL` (default `gemini-2.5-flash`,
   override via `COGNIVA_VISION_MODEL`). Pola sama persis dengan `LEARNER_MODEL`.

2. **`llm/providers/gemini.ts`** — `StructuredArgs` kini punya field opsional
   `image?: { data, mimeType }`. Bila ada, `structured()` menyusun `contents`
   multimodal (inlineData + text); bila tidak, jalurnya identik dengan
   sebelumnya. Learner/Evaluator yang memanggil tanpa `image` tidak berubah
   sama sekali — sudah dibuktikan oleh test mereka yang tetep lolos.

3. **`orchestrator/index.ts`** — interface `Vision.interpret` menjadi `async`
   (pembacaan papan nyata perlu panggilan LLM), satu-satunya call site di-`await`,
   dan kini meneruskan `topic.title` sebagai konteks ke Vision (sebelumnya tidak
   ada jalurnya). Satu test orchestrator lama diperbarui: dulu "image-only selalu
   minta konfirmasi" karena Vision belum bisa baca; sekarang Vision membaca, jadi
   giliran bergambar lanjut ke Learner. Skenario konfirmasi murni (tanpa gambar
   DAN tanpa teks) tetap diuji.

## B. Usulan perubahan kontrak (BELUM diterapkan — minta keputusanmu)

Dua sinyal yang sudah terbukti penting lewat uji foto papan tulis asli tapi
belum punya tempat di `contracts/board.ts` + `contracts/enums.ts`. Implementasi
sekarang tetap berfungsi benar tanpa keduanya (perilaku "jangan menebak" dijaga
di level keseluruhan), tapi dua sinyal granular ini hilang saat dipetakan.

### B1. `ElementType` tidak punya nilai `"unknown"`

Enum resmi: `text | equation | diagram | arrow | figure`.

**Bukti (papan3.jpeg, lihat riwayat chat):** ada coretan buram yang Vision benar
laporkan sebagai tidak terbaca — `kind:"unknown"`, `confidence:0.3` — alih-alih
menebak. Saat dipetakan ke kontrak, elemen ini terpaksa jadi `type:"text"`, sama
seperti elemen yang terbaca jelas. Sinyal "ini genuinely tak terbaca" hanya
bertahan di `needsConfirmation` level keseluruhan, hilang di level elemen.

**Usul:** tambah `"unknown"` ke `elementTypeSchema` di `contracts/enums.ts`.
Diff satu baris. Diuji di `tests/vision.test.ts` (kasus papan3).

### B2. `Element` tidak punya `confidence` per elemen

`Element` resmi: `{ type, content, bbox? }`.

**Bukti (papan2.jpeg):** elemen persamaan dapat `confidence:0.95` sementara
elemen lain `1.0` — variasi nyata, bukan default. Setelah pemetaan, hanya
`confidence` level VisionInterpretation yang tersisa, jadi Frontend/Evaluator
tidak bisa menyorot elemen MANA yang diragukan.

**Usul:** tambah `confidence: z.number().optional()` di `elementSchema`.

### Bukan masalah (informasi)

- **`bbox` selalu `null`.** Model vision (Gemini/Claude) tidak mengembalikan
  koordinat piksel presisi dari deskripsi posisi teks. Kalau Frontend butuh
  `bbox` untuk menyorot area di kanvas, perlu diskusi terpisah — kualitas
  koordinat dari model perlu diuji ulang dan kemungkinan kurang akurat.
- **`shape` → `figure`.** Kind internal `"shape"` (kotak/lingkaran) dipetakan ke
  `"figure"` resmi; ini padanan yang wajar, bukan kompromi.

## C. Cara kerja singkat (untuk reviewer)

- `VisionAgent.interpret(snapshot, typedText, topic)`:
  - ada `typedText` → pakai langsung, confidence 1.0, tanpa model (fallback §5.3).
  - tidak ada gambar & tidak ada teks → minta konfirmasi.
  - ada gambar → `runVisionTurn()` → `LLMClient.structured()` dengan image →
    `normalizeVisionLLMOutput()` → `toVisionInterpretation()` (kontrak resmi).
- Mode mock otomatis aktif bila `USE_MOCK_AI=true` atau tidak ada `GEMINI_API_KEY`,
  jadi seluruh test jalan offline tanpa kunci — sama seperti Learner.
- Kegagalan apa pun (network, JSON invalid, safety block) → `createFallbackInterpretation()`
  yang selalu minta konfirmasi, tidak pernah menjatuhkan giliran.

## D. Coba sendiri

```bash
cd apps/backend
npm install
npm run test                 # 26/26, termasuk tests/vision.test.ts

# uji manual dengan foto papan asli (mode mock, tanpa kunci):
npm run demo:vision -- ./papan2.jpeg "Fotosintesis"

# baca sungguhan lewat Gemini:
#   set GEMINI_API_KEY di apps/backend/.env, lalu:
USE_MOCK_AI=false npm run demo:vision -- ./papan2.jpeg "Fotosintesis"
```
