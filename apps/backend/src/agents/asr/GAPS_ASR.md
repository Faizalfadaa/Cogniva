# ASR (M2) — Catatan Integrasi & Usulan Perubahan Kontrak

Penanggung jawab: Fayyaz (Peran 5, §3.5). Dokumen ini menyertai implementasi ASR
nyata di `agents/asr/`, mengikuti pola Vision (`agents/vision/`). Semua sudah
lolos `npm run typecheck` dan `npm run test` (33/33). Jalur Gemini nyata sudah
dibuktikan end-to-end (lihat bagian Bukti). Ada dua diff aditif ke file bersama
yang sudah kuterapkan, dan dua catatan kontrak yang BELUM kuterapkan karena
mengubah `contracts/` adalah wewenang tech lead (§6, §12).

## A. Perubahan yang sudah diterapkan ke file bersama (aditif, aman)

Tidak satu pun mengubah perilaku agen lain (Learner/Evaluator/Vision).

1. **`llm/providers/gemini.ts`** — `StructuredArgs` kini punya field opsional
   `audio?: { data, mimeType }`, pola identik dengan `image?` milik Vision.
   `structured()` menyusun `contents` multimodal dari gabungan image+audio yang
   ada; bila keduanya kosong, jalurnya identik dengan sebelumnya (teks polos).
   Learner/Evaluator/Vision yang memanggil tanpa `audio` tidak berubah —
   dibuktikan oleh test mereka yang tetap lolos.

2. **`config/index.ts`** — menambah `ASR_MODEL` (default `gemini-2.5-flash`,
   override `COGNIVA_ASR_MODEL`), `ASR_DEFAULT_LANGUAGE` (default `id-ID`), dan
   `ASR_CONFIDENCE_THRESHOLD` (default `0.6`). Pola sama persis dengan blok Vision.

3. **`package.json`** — skrip `demo:asr` (sejajar `demo:vision`).

## B. Catatan kontrak (BELUM diterapkan — minta keputusanmu)

### B1. `SpeechTranscript` tidak punya penanda butuh-konfirmasi

`SpeechTranscript` resmi: `{ segmentId, sessionId, turnIndex, transcript,
audioRef?, confidence, language, capturedAt }` — tidak ada `needsConfirmation`
seperti `VisionInterpretation`. §3.5/§5.3 mensyaratkan "transkrip ditampilkan
agar pengguna dapat mengoreksi" saat keyakinan rendah.

**Bagaimana ditangani sekarang (tanpa ubah kontrak):** sinyal "ada bagian tak
jelas" diturunkan ke nilai `confidence`. `toSpeechTranscript()` menurunkan
confidence ke ≤ `ASR_CONFIDENCE_THRESHOLD` bila model melaporkan `ambiguities`,
sehingga frontend bisa memutuskan menampilkan transkrip untuk dikoreksi dari
nilai confidence saja. Ini konsisten dengan §3.5 tanpa mengubah kontrak.

**Usul (opsional):** kalau frontend lebih suka flag eksplisit, tambah
`needsConfirmation: z.boolean().optional()` di `speechTranscriptSchema`. Belum
kuterapkan.

### B2. Tidak ada kontrak input "klip audio" (analog `BoardSnapshot`)

Vision punya `BoardSnapshot` resmi sebagai input; suara hanya punya `audio`
(base64) di `teachingInputSchema` (messages.ts), tanpa `segmentId/turnIndex/
capturedAt`. Aku mendefinisikan tipe lokal `AudioClip` di `asr.types.ts` untuk
itu (mirip `RunVisionOptions` yang juga lokal). Bila kamu mau simetri penuh
dengan kanal papan, pertimbangkan kontrak resmi `AudioSnapshot`. Belum kubuat.

## C. Cara kerja singkat (untuk reviewer)

- `AsrAgent.transcribe(clip, typedText, topic)`:
  - ada `typedText` → pakai langsung, confidence 1.0, tanpa model (fallback §5.3).
  - tidak ada audio & tidak ada teks → transkrip kosong, confidence 0 (kanal
    suara opsional, giliran tidak diblok).
  - ada audio → `runAsrTurn()` → `LLMClient.structured()` dengan `audio` →
    `normalizeAsrLLMOutput()` → `toSpeechTranscript()` (kontrak resmi).
- Mode mock otomatis aktif bila `USE_MOCK_AI=true` atau tidak ada `GEMINI_API_KEY`,
  jadi seluruh test jalan offline tanpa kunci — sama seperti Vision/Learner.
- Kegagalan apa pun (network, JSON invalid, safety block) →
  `createFallbackTranscript()` (transkrip kosong, confidence 0), tidak pernah
  menjatuhkan giliran.
- Aturan "jangan koreksi" identik dengan Vision: transkripsikan ucapan apa
  adanya termasuk kekeliruan, karena Learner mempelajari miskonsepsi aslinya.

## D. Wiring ke orchestrator (SUDAH diterapkan — minimal, atas izin Fayyaz)

Sebelumnya `orchestrator/index.ts` meneruskan `speech: null`. Sekarang ASR
sudah terhubung. Perubahan minimal & aditif (semua file bersama, tetap 33/33):

1. **`agents/index.ts`** — `export { AsrAgent }`.
2. **`orchestrator/index.ts`** —
   - seam baru `Asr` (mirip `Vision`); konstruktor menerima `asr?` (OPSIONAL,
     supaya test orchestrator lama yang tidak menyuntik asr tetap lolos);
   - `buildOrchestrator()` menyuntik `new AsrAgent({ confidenceThreshold:
     config.ASR_CONFIDENCE_THRESHOLD })`;
   - `TeachingInput` dapat field `audio?`; `TurnResult` dapat `speech?`;
   - bila ada `audio` (dan asr terpasang): bangun `AudioClip`,
     `asr.transcribe(clip, null, topic.title)`, persist via `saveTranscript`,
     teruskan ke `learner.respond({ ..., speech })`, dan simpan ke
     `TeachingTurn.speechTranscript`.
3. **`api/websocket/index.ts`** — `runTurn` meneruskan `payload.audio`; mengirim
   pesan `speech_result` ke frontend saat transkrip tersedia.

**Catatan desain (sengaja minimal):**
- `typedText` TIDAK diumpankan ke ASR — itu fallback kanal papan; mengumpankannya
  ke ASR juga akan menduplikasi teks yang sama ke dua kanal. ASR hanya bekerja
  saat ada klip `audio`.
- ASR dijalankan SETELAH gerbang konfirmasi Vision. Jadi bila pembacaan papan
  butuh konfirmasi, audio giliran itu belum ditranskripsi (dan `confirmation_
  response` saat ini tidak membawa audio). Ini trade-off M2; bila perlu, audio
  bisa dipindah sebelum gerbang atau dibawa ulang di confirmation_response.
- Penggabungan papan+suara jadi satu `teachingText` sudah ditangani Learner
  (`learner/index.ts`: `[interpretation.transcribedText, speech?.transcript]`),
  jadi tidak perlu perubahan di sisi Learner.

## E. Bukti (jalur Gemini nyata sudah diuji)

Klip TTS berisi kesalahan sengaja ("Water boils at fifty degrees... H three O"),
`USE_MOCK_AI=false`:

```json
{
  "transcript": "Water boils at 50 degrees Celsius. The chemical formula for water is H3O.",
  "confidence": 0.95,
  "language": "en-US"
}
```

Kesalahan (50°C, H3O) dipertahankan apa adanya → aturan "jangan koreksi" terbukti
di kanal suara, dan pemetaan ke kontrak `SpeechTranscript` valid.

## F. Coba sendiri

```bash
cd apps/backend
npm install
npm run test                 # 33/33, termasuk tests/asr.test.ts

# transkripsi sungguhan lewat Gemini (butuh GEMINI_API_KEY di .env):
#   (PowerShell) $env:USE_MOCK_AI="false"; npm run demo:asr -- ./suara-uji/suara1_fotosintesis_id.wav "Fotosintesis"
```

Klip uji ada di `apps/backend/suara-uji/` (dibuat via TTS Windows).

## G. RISIKO DIKETAHUI — aturan "jangan koreksi" bisa bocor di audio tak jelas

**Gejala (terukur).** Pada audio Indonesia yang pelafalannya buram (klip TTS
bersuara Inggris, `suara2_salah_id.wav`: "air mendidih pada lima puluh derajat...
H tiga O"), Gemini sempat **MEMBETULKAN** isinya: transkrip keluar "100 derajat"
dan kalimat "H3O" dihapus. Ini melanggar invarian inti -- Learner jadi tidak
melihat miskonsepsi asli. Pada audio yang JELAS (klip Inggris
`suara3_salah_en.wav`) kesalahan justru dipertahankan, jadi pemicunya adalah
**audio ambigu + prior pengetahuan model**, bukan murni model mengabaikan prompt.

**Mitigasi yang sudah diterapkan (area saya).** Aturan 2 & 4 di
`llm/prompts/asr.prompt.ts` diperkuat: tegaskan bahwa sumber kebenaran adalah
BUNYI (bukan pengetahuan dunia), larang mengganti angka/fakta salah dengan yang
benar, dan minta transkrip fonetik + turunkan confidence saat ragu. **Hasil uji
ulang:** `suara2` kini benar -> "Air mendidih pada suhu 50 derajat Celsius. Rumus
kimia air adalah H3O." (kedua kesalahan dipertahankan).

**Yang BELUM dipastikan (butuh #2).** Uji di atas memakai TTS Inggris yang
melafalkan Indonesia secara kasar. Perlu uji dengan **suara manusia Indonesia
asli** untuk memastikan perbaikan prompt cukup robust di kondisi nyata. Sampai
itu dilakukan, anggap ini risiko terbuka, bukan tertutup penuh.

**Opsi lanjutan bila masih bocor (belum dikerjakan).** (a) pisahkan langkah:
minta model transkrip mentah dulu tanpa konteks topik, lalu proses; (b) turunkan
suhu/sampling bila wrapper mengeksposnya; (c) pertimbangkan model STT khusus
(mis. server Whisper) seperti disinggung §3.5 -- ini menyentuh `gemini.ts`/
arsitektur LLM (file bersama), jadi perlu koordinasi tech lead.
