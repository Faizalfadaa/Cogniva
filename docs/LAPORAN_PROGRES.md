# Laporan Progres — Cogniva

Platform Belajar dengan Prinsip *Learning by Teaching*

| | |
| --- | --- |
| **Kompetisi** | HackStone — submission 1 Juli 2026 |
| **Tanggal laporan** | 22 Juni 2026 |
| **Status keseluruhan** | Milestone M0 selesai · Milestone M1 (backend) selesai |
| **Acuan desain** | `Cogniva_Dokumen_Arsitektur.pdf` (v1.1) |
| **Catatan bahasa** | Kode, komentar, dan nilai enum kontrak ditulis dalam **bahasa Inggris** (untuk juri internasional); dokumen & laporan dalam **bahasa Indonesia**. Pemetaan nilai enum ada di `docs/CONTRACTS.md`. |

---

## 1. Ringkasan Eksekutif

Cogniva adalah platform di mana pengguna **mengajar AI yang berperan sebagai murid**,
lalu menerima evaluasi atas kualitas penjelasannya. Sampai titik ini:

- **Milestone M0 (Penyelarasan & Kontrak)** sudah **tuntas**: kontrak data antar-komponen,
  mesin status sesi, kerangka API (REST + WebSocket), scaffold frontend, serta 1–2 topik demo.
- **Milestone M1 (Kerangka Ujung-ke-Ujung) bagian backend** sudah **tuntas**: satu giliran
  mengajar penuh kini berjalan ujung-ke-ujung di sisi server (**TypeScript + Fastify**) —
  orchestrator menjahit alur, **Learner agent** menjawab sebagai murid menggunakan model
  **Gemini**, dan setiap giliran tersimpan sebagai transkrip.

Seluruh jalur kritis backend yang dibutuhkan demo (backend + Learner) sudah berdiri.
Yang tersisa untuk M1 adalah sisi **kanvas frontend**; Vision/ASR dan Evaluator menyusul
di M2 dan M3 sesuai rencana milestone.

**Status pengujian:** 16/16 tes lulus. Loop mengajar terbukti berjalan ujung-ke-ujung
(termasuk tanpa kunci API, memakai fallback deterministik; dan terverifikasi memanggil
Gemini sungguhan saat kunci tersedia).

---

## 2. Status Milestone

| Milestone | Lingkup (sesuai §11) | Status |
| --- | --- | --- |
| **M0 · Penyelarasan & kontrak** | Dokumen, kontrak data, repo & kerangka, 1–2 topik demo | ✅ **Selesai** |
| **M1 · Kerangka ujung-ke-ujung** | Backend + kanvas + Learner: satu giliran mengajar penuh | 🟡 **Backend selesai**, kanvas frontend menyusul |
| **M2 · Loop mengajar inti** | Vision baca papan + ASR transkrip suara; UI dialog; fallback teks | ⬜ Belum |
| **M3 · Evaluasi & debrief** | Evaluator (skor + temuan); layar debrief; rujukan terkurasi | ⬜ Belum |
| **M4 · Freeze, integrasi & uji** | Build stabil end-to-end; laporan uji coba kecil | ⬜ Belum |
| **M5 · Poles, pitch & submit** | Paket submission, deck, skrip demo (sebelum 1 Juli) | ⬜ Belum |

---

## 3. Milestone M0 — Penyelarasan & Kontrak (Selesai)

Bagian ini adalah inti keluaran M0: mengunci bentuk data dan antarmuka agar tim dapat
bekerja paralel tanpa saling menunggu.

### 3.1 Kontrak Data Antar-Komponen (§6)

Seluruh kontrak dari §6 dimaterialisasi di **dua sisi yang harus tetap sepadan**:

- **Backend** — skema Zod + tipe TypeScript di `apps/backend/src/contracts/` (camelCase, sepadan dengan kawat).
- **Frontend** — `interface` TypeScript di `apps/frontend/src/contracts/index.ts`.

Kontrak yang tercakup: `Topic`, `Session`, `BoardSnapshot`, `VisionInterpretation` + `Element`,
`SpeechTranscript`, `TeachingTurn`, `LearnerState` + `Misc`, `LearnerResponse`,
`EvaluationResult` + `Finding`, serta kontrak pesan WebSocket (§7.2).

Konvensi yang dipatuhi: camelCase di JSON, waktu ISO-8601 (UTC), field opsional bertanda `?`.

### 3.2 Mesin Status Sesi (§4)

Implementasi di `apps/backend/src/modules/session/stateMachine.ts`, hanya maju (tidak ada jalur mundur):

```
SETUP --start--> TEACHING --end--> ENDED --evaluate--> EVALUATED (terminal)
```

Aturan ditegakkan: `teaching_input` hanya sah pada **TEACHING**; pemicuan evaluasi hanya pada
**ENDED** dan idempoten.

### 3.3 Kerangka API (§7)

- **REST** (`apps/backend/src/api/rest/index.ts`, awalan `/api`) — siklus hidup sesi & data:
  `POST /sessions`, `GET /sessions/{id}`, `POST /sessions/{id}/start|end|evaluate`,
  `GET /sessions/{id}/evaluation`, `GET /topics`, `GET /topics/{id}`.
- **WebSocket** (`apps/backend/src/api/websocket/index.ts`, `/ws/sessions/{id}`) — jalur sesi real-time.

### 3.4 Scaffold Frontend

Stack sesuai §9: **React + TypeScript + Vite + Tailwind**. Skeleton memuat daftar topik dari
backend dan menampilkannya. Lolos `tsc` (typecheck) dan `vite build`.

### 3.5 Topik Demo (§6.1)

Dua topik demo terkurasi (`apps/backend/src/data/topics/`), lengkap dengan `referenceMaterial`,
`keyConcepts`, dan `commonMisconceptions`:

| Topik | Tingkat |
| --- | --- |
| **Photosynthesis** | easy |
| **Newton's Second Law** | medium |

### 3.6 Penyelarasan Bahasa (untuk juri internasional)

Atas permintaan, seluruh kode/komentar/dokumen kode dialihbahasakan ke Inggris, termasuk
**nilai enum kontrak** dengan pemetaan tertelusur ke PDF arsitektur:

| Enum | PDF (Indonesia) | Kode (Inggris) |
| --- | --- | --- |
| `SessionStatus` | PERSIAPAN / MENGAJAR / SELESAI / EVALUASI | SETUP / TEACHING / ENDED / EVALUATED |
| `Difficulty` | dasar / menengah / lanjut | easy / medium / hard |
| `FindingCategory` | BENAR / KELIRU / TERLEWAT / MEMBINGUNGKAN | CORRECT / WRONG / MISSED / CONFUSING |

---

## 4. Milestone M1 — Kerangka Ujung-ke-Ujung, Bagian Backend (Selesai)

Sasaran M1 (§11): *satu giliran mengajar penuh berjalan*. Sesuai §12, kerangka ujung-ke-ujung
didirikan lebih dulu pada jalur kritis (backend + Learner), baru Vision dan Evaluator
ditumpuk di atasnya. Itulah yang dikerjakan.

Backend ditulis dalam **TypeScript + Fastify** agar selaras dengan frontend dan struktur
monorepo (satu bahasa lintas tim; kontrak Zod ⇄ TypeScript).

### 4.1 Komponen yang Diimplementasikan

| Komponen | Berkas | Fungsi |
| --- | --- | --- |
| **Pembungkus LLM** (§3.3, §7.3) | `src/llm/providers/gemini.ts` | Satu pintu untuk semua pemanggilan model: model id seragam, timeout, retry (oleh SDK), dan penguraian keluaran JSON terstruktur. Agen tidak pernah memanggil SDK langsung. |
| **Learner agent** (§3.6) | `src/agents/learner/index.ts` | Berperan sebagai murid pemula via Gemini; memelihara `LearnerState` lintas giliran; menghasilkan `LearnerResponse` terstruktur. |
| **Vision (stub M2)** (§3.4) | `src/agents/vision/index.ts` | Passthrough: teks ketikan → interpretasi; bila hanya gambar → minta konfirmasi (menguji jalur §5.3). |
| **Orchestrator** (§3.3, §5.1) | `src/orchestrator/index.ts` | Menjalankan satu giliran ujung-ke-ujung (snapshot → Vision → Learner), menyimpan `TeachingTurn`, menaikkan `turnCount`. |
| **Loop WebSocket** (§7.2) | `src/api/websocket/index.ts` | `teaching_input` kini menjalankan giliran nyata lalu mengirim balik `vision_result` + `learner_message`; pemanggilan LLM bersifat async sehingga event loop tetap responsif. |
| **Penyemaian state** (§3.6) | `src/api/rest/index.ts` | Saat `start`, `LearnerState` disemai dari `commonMisconceptions` topik. |
| **Penyimpanan giliran** (§8 sementara) | `src/modules/storage/sessionStore.ts` | Menyimpan snapshot, transkrip, respons, state, dan daftar `TeachingTurn` per sesi (in-memory). |

### 4.2 Alur Satu Giliran Mengajar (yang sudah berjalan)

```
teaching_input (gambar + teks)
        │
        ▼
   [Vision]  ── interpretasi papan ──┐
 (passthrough M1)                    ├──► [Learner] ──► LearnerResponse
   (M2: [ASR] ── transkrip suara) ───┘    (persona murid, Gemini)
        │
        ▼
 simpan TeachingTurn · turnCount++ · stream vision_result + learner_message
```

Bila keyakinan pembacaan papan rendah (di M1: input hanya gambar tanpa teks), giliran
**berhenti dan meminta konfirmasi** (`confirmation_request`) alih-alih menebak — sesuai §5.3.

### 4.3 Learner Agent — Detail

- Memanggil model teks Gemini melalui SDK resmi `@google/genai`, dengan **keluaran JSON terstruktur**
  (`responseMimeType: application/json` + `responseJsonSchema`) sehingga respons dapat diurai andal.
- **Menjaga invarian §1.4 secara struktural:** fungsi Learner hanya menerima judul/deskripsi topik,
  apa yang dijelaskan pengguna, dan state-nya sendiri — **tidak pernah** menerima kunci jawaban
  (`referenceMaterial` / `keyConcepts`). System prompt mengunci peran murid (tidak mengoreksi,
  tidak menggurui, tidak membocorkan jawaban benar).
- **Tetap berjalan tanpa kunci API:** bila `GEMINI_API_KEY` tidak diset, Learner memakai
  **fallback deterministik** yang tetap dalam peran murid, sehingga loop ujung-ke-ujung (dan
  seluruh tes) berjalan luring. Ini menjaga prinsip "alur tetap berjalan".

---

## 5. Arsitektur & Struktur Repositori

```
Cogniva/                             # monorepo (apps / packages / scripts)
├── Cogniva_Dokumen_Arsitektur.pdf   # acuan desain
├── docs/
│   ├── CONTRACTS.md                 # peta kontrak data → kode
│   └── LAPORAN_PROGRES.md           # dokumen ini
├── packages/                        # paket bersama (mendatang)
├── scripts/                         # skrip repo (mendatang)
└── apps/
    ├── backend/                     # TypeScript + Fastify (modular monolith)
    │   ├── src/
    │   │   ├── main.ts              # entrypoint Fastify (muat .env, listen)
    │   │   ├── app.ts               # factory app: REST + WebSocket + CORS
    │   │   ├── config/              # konfigurasi dari environment
    │   │   ├── contracts/           # skema Zod + tipe — kontrak §6 & pesan §7.2
    │   │   ├── llm/                 # pembungkus LLM (providers, prompts) §3.3, §7.3
    │   │   ├── agents/              # Learner (nyata) + Vision (stub M2)
    │   │   ├── orchestrator/        # satu giliran ujung-ke-ujung §3.3, §5.1
    │   │   ├── api/                 # rest/ §7.1 + websocket/ §7.2
    │   │   ├── modules/             # session, topic, storage (+ teaching/evaluation stub)
    │   │   └── data/topics/         # topik demo terkurasi §6.1
    │   ├── tests/                   # mesin status, learner, llm, orchestrator, ws
    │   ├── .env.example             # GEMINI_API_KEY + knob penyetelan
    │   ├── tsconfig.json
    │   └── package.json
    └── frontend/                    # React + TypeScript + Vite + Tailwind
        └── src/
            ├── contracts/           # mirror TS kontrak §6 & pesan §7.2
            ├── api/client.ts        # klien REST tipis
            └── App.tsx              # kerangka UI (memuat topik demo)
```

---

## 6. Keputusan Teknis Penting

| Keputusan | Pilihan | Alasan |
| --- | --- | --- |
| Bahasa & framework backend | **TypeScript + Fastify** | Selaras dengan frontend (TS) & struktur monorepo; satu bahasa lintas tim, kontrak Zod ⇄ TypeScript. |
| Model LLM Learner | `gemini-2.5-flash` (default), via `COGNIVA_LEARNER_MODEL` | Cepat untuk giliran real-time; dapat dinaikkan ke `gemini-2.5-pro` untuk kualitas lebih tinggi. |
| SDK | Resmi `@google/genai` (TypeScript) | Sesuai stack backend; pemanggilan model lewat satu pembungkus. |
| Keluaran terstruktur | `responseMimeType: application/json` + `responseJsonSchema` | Respons Learner dapat diurai andal menjadi `LearnerResponse` + pembaruan state. |
| Validasi kontrak | Zod (skema + tipe) | Validasi runtime + tipe statis dari satu sumber; skema yang sama memberi JSON schema ke Gemini. |
| Penyimpanan | In-memory (M1) | Cukup untuk kerangka; SQLite + penyimpanan objek menyusul (§8) tanpa mengubah kontrak. |
| Tanpa kunci API | Fallback Learner deterministik | Skeleton & CI berjalan luring; demo tetap jalan meski kunci belum diset. |
| Vision/ASR | Stub passthrough (ditandai `TODO(M2)`) | Jalur kritis berdiri dulu; multimodal ditumpuk di M2. |

---

## 7. Invarian Pedagogis yang Dijaga (§1.4)

1. **Selama sesi, AI tetap murid** — Learner hanya bertanya/ragu/memparafrase; tidak mengoreksi
   atau menggurui. (Ditegakkan lewat system prompt + struktur masukan.)
2. **Evaluasi hanya di akhir** — Evaluator dipicu pasca-sesi (status ENDED → EVALUATED), idempoten.
3. **Learner tidak memegang kunci jawaban** — hanya `commonMisconceptions` yang mengalir ke Learner;
   `referenceMaterial` penuh dicadangkan untuk Evaluator. Dijaga secara struktural: fungsi Learner
   tak pernah menerima materi rujukan.
4. **Evaluator melihat seluruh sesi** — transkrip lengkap (`TeachingTurn`) sudah disimpan tiap giliran,
   siap dibaca Evaluator di M3.

---

## 8. Pengujian & Verifikasi

**16/16 tes lulus** (`npm test`, Vitest). Rincian:

| Berkas uji | Jml | Cakupan |
| --- | --- | --- |
| `stateMachine.test.ts` | 5 | Transisi maju penuh, tanpa mundur, terminal, evaluate hanya dari ENDED, teaching_input hanya saat TEACHING. |
| `learner.test.ts` | 4 | Penyemaian state dari miskonsepsi, fallback tetap peran murid, pencatatan pertanyaan fallback, pemetaan keluaran LLM terstruktur ke kontrak. |
| `llmClient.test.ts` | 3 | Penguraian JSON terstruktur + bentuk request; blokir keamanan (safety block); JSON cacat. |
| `orchestrator.test.ts` | 2 | Satu giliran penuh tersimpan & `turnCount` naik; input gambar saja → minta konfirmasi. |
| `teachingWs.test.ts` | 2 | Alur WebSocket nyata `create → start → teach`; penolakan teaching_input sebelum start. |

Selain itu, **smoke test ujung-ke-ujung** memverifikasi urutan
`state_update → vision_result → learner_message`, kenaikan `turnCount`, dan jalur konfirmasi.
Jalur LLM nyata juga **diuji langsung ke Gemini** (memakai kunci): Learner membalas in-character
(mis. memparafrase miskonsepsi yang sengaja ditanam). Frontend lolos `typecheck` dan `build`.

---

## 9. Cara Menjalankan

### Backend (port 8000)

```bash
cd apps/backend
npm install
# Opsional: set kunci untuk Learner nyata (tanpa ini, fallback dipakai)
#   set GEMINI_API_KEY=...   (Windows)
#   export GEMINI_API_KEY=... (bash)
npm run dev
# Cek kesehatan: http://localhost:8000/health
```

Uji: `cd apps/backend && npm test`  (Vitest)

### Frontend (port 5173)

```bash
cd apps/frontend
npm install
npm run dev
```

Konfigurasi Learner ada di `apps/backend/.env.example` (model, max tokens, ambang keyakinan Vision).

---

## 10. Yang Belum Dikerjakan & Rencana Berikutnya

| Prioritas | Pekerjaan | Milestone |
| --- | --- | --- |
| 🔜 Tinggi | **Kanvas frontend** (whiteboard tldraw/Excalidraw + tangkap snapshot) dan **UI dialog Learner** — melengkapi M1 di sisi klien. | M1 (sisa) |
| Berikutnya | **Vision nyata** (model multimodal membaca papan) + **ASR** (transkrip suara) + UI dialog penuh + fallback teks. | M2 |
| Berikutnya | **Evaluator** menghasilkan skor + temuan terkategori; **layar debrief**; kurasi Reference Store. | M3 |
| Akhir | Build stabil end-to-end + laporan uji coba kecil; lalu paket submission, deck, dan skrip demo. | M4–M5 |

**Catatan integrasi:** kontrak data & protokol (§6, §7) sudah dikunci, sehingga pekerjaan
M2/M3 bisa menempel tanpa mengubah antarmuka. Titik penyambungan sudah ditandai `TODO(Mx)` di kode.

---

## 11. Risiko & Catatan

- **Pembacaan tulisan tangan (Vision)** adalah risiko teknis terbesar (§10). Mitigasi sudah
  disiapkan sejak awal lewat jalur konfirmasi + fallback teks; tinggal mengaktifkan model nyata di M2.
- **Biaya & latensi LLM** — pembungkus terpusat memudahkan penerapan timeout/retry dan
  penggantian model tanpa menyentuh agen; model Learner dapat disetel (`gemini-2.5-flash` untuk
  cepat, `gemini-2.5-pro` untuk kualitas) lewat satu variabel environment.
- **Persistensi** masih in-memory; perlu beralih ke SQLite + penyimpanan objek (§8) sebelum
  demo yang butuh ketahanan ulang-baca, tanpa mengubah kontrak.
- **Disiplin kontrak** — setiap perubahan kontrak harus disinkronkan di kedua sisi
  (Zod ⇄ TypeScript) dan melalui kesepakatan tech lead (§12). Lihat `docs/CONTRACTS.md`.
- **Jadwal** — submission 1 Juli 2026; jalur kritis (backend + Learner) sudah berdiri, menyisakan
  runway untuk kanvas, Vision, dan Evaluator.
