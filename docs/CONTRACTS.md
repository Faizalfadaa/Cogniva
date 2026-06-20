# Kontrak Data Cogniva (Inti Keluaran M0)

Dokumen ringkas yang menautkan **kontrak data antar-komponen** (Dokumen
Arsitektur §6) ke implementasinya di kode. Kontrak ini adalah sumber kebenaran
tunggal; perubahan apa pun harus melalui kesepakatan tech lead (§6, §12).

## Konvensi

- Nama field memakai **camelCase** saat pertukaran JSON.
- Pertukaran data memakai **JSON**.
- Waktu memakai **ISO-8601 (UTC)**.
- Field bertanda `?` di dokumen bersifat **opsional**.

## Dua representasi yang harus tetap sepadan

| Sisi | Lokasi | Bentuk |
| --- | --- | --- |
| Backend | `backend/app/contracts/` | Model Pydantic v2 (snake_case + alias camelCase) |
| Frontend | `frontend/src/contracts/index.ts` | `interface` TypeScript (camelCase) |

## Peta kontrak → berkas

| Kontrak (§) | Backend | Frontend |
| --- | --- | --- |
| Topic (§6.1) | `contracts/topic.py` | `Topic` |
| Session (§6.2) | `contracts/session.py` | `Session` |
| BoardSnapshot (§6.3) | `contracts/board.py` | `BoardSnapshot` |
| VisionInterpretation + Element (§6.4) | `contracts/board.py` | `VisionInterpretation`, `Element` |
| SpeechTranscript (§6.5) | `contracts/speech.py` | `SpeechTranscript` |
| TeachingTurn (§6.6) | `contracts/teaching.py` | `TeachingTurn` |
| LearnerState + Misc (§6.7) | `contracts/learner.py` | `LearnerState`, `Misc` |
| LearnerResponse (§6.8) | `contracts/learner.py` | `LearnerResponse` |
| EvaluationResult + Finding (§6.9) | `contracts/evaluation.py` | `EvaluationResult`, `Finding` |
| Pesan WebSocket (§7.2) | `ws/messages.py` | `contracts/messages.ts` |

## Mesin status sesi (§4)

```
PERSIAPAN --start--> MENGAJAR --end--> SELESAI --evaluate--> EVALUASI (terminal)
```

- Hanya maju, tidak ada jalur mundur (§4.2).
- `teaching_input` hanya sah pada **MENGAJAR**.
- Pemicuan evaluasi hanya pada **SELESAI** dan **idempoten**.

Implementasi: `backend/app/state_machine.py` (diuji di
`backend/tests/test_state_machine.py`).

## API (§7)

- REST (siklus hidup sesi & data): `backend/app/api/rest.py`, awalan `/api`.
- WebSocket (jalur real-time): `backend/app/api/websocket.py`, `/ws/sessions/{id}`.

## Invarian pedagogis yang dijaga kontrak (§1.4)

1. Selama sesi, AI tetap berperan **murid** (Learner tidak mengoreksi/menggurui).
2. Evaluasi hanya terjadi **di akhir**, sebagai fase refleksi terpisah.
3. Learner **tidak memegang kunci jawaban** — hanya `commonMisconceptions` yang
   mengalir ke Learner, sementara `referenceMaterial` penuh mengalir ke Evaluator.
4. Evaluator melihat **seluruh sesi** (transkrip lengkap), bukan ujian terisolasi.
