# Cogniva

Platform belajar dengan prinsip **Learning by Teaching** — pengguna mengajar AI
yang berperan sebagai murid, lalu mendapat evaluasi atas kualitas penjelasannya.

Repositori ini adalah **kerangka kerja Milestone M0 (Penyelarasan & Kontrak)**.
Acuan desain: `Cogniva_Dokumen_Arsitektur.pdf`.

## Status Milestone M0

Deliverable M0 menurut dokumen (§11): _dokumen, kontrak data, repo & kerangka,
1–2 topik demo_.

| Deliverable M0 | Status | Lokasi |
| --- | --- | --- |
| Dokumen arsitektur | ✅ | `Cogniva_Dokumen_Arsitektur.pdf` |
| Kontrak data (§6) | ✅ | `backend/app/contracts/`, `frontend/src/contracts/` |
| Mesin status sesi (§4) | ✅ | `backend/app/state_machine.py` |
| Kerangka API REST + WebSocket (§7) | ✅ | `backend/app/api/` |
| Repo & kerangka frontend (React+TS+Vite+Tailwind) | ✅ | `frontend/` |
| 1–2 topik demo (§6.1) | ✅ | `backend/app/data/topics/` |

Logika agen AI (Vision, ASR, Learner, Evaluator) **belum** diimplementasikan —
itu lingkup M1+. Titik-titik tersebut ditandai `TODO(Mx)` di kode dan, untuk M0,
mengembalikan placeholder/`error` yang dapat dipulihkan, bukan crash.

## Struktur

```
Cogniva/
├── Cogniva_Dokumen_Arsitektur.pdf   # acuan desain (output M0)
├── docs/
│   └── CONTRACTS.md                 # peta kontrak data → kode
├── backend/                         # Python + FastAPI (modular-monolith)
│   ├── app/
│   │   ├── contracts/               # model Pydantic — kontrak §6
│   │   ├── ws/messages.py           # kontrak pesan WebSocket §7.2
│   │   ├── state_machine.py         # mesin status sesi §4
│   │   ├── api/                     # REST §7.1 + WebSocket §7.2
│   │   ├── data/topics/             # topik demo terkurasi §6.1
│   │   ├── store.py                 # store in-memory (placeholder §8)
│   │   └── main.py                  # entrypoint FastAPI
│   ├── tests/                       # uji mesin status & kontrak
│   └── requirements.txt
└── frontend/                        # React + TypeScript + Vite + Tailwind
    └── src/
        ├── contracts/               # mirror TS dari kontrak §6 & pesan §7.2
        ├── api/client.ts            # klien REST tipis
        └── App.tsx                  # kerangka UI (memuat topik demo)
```

## Menjalankan

### Backend (port 8000)

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Dokumentasi OpenAPI interaktif: http://localhost:8000/docs

Uji:

```bash
cd backend
python -m pytest
```

### Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Pastikan backend berjalan agar daftar topik termuat (CORS sudah diizinkan untuk
`localhost:5173` di `app/main.py`).

## Tumpukan teknologi (§9)

Frontend: React + TypeScript + Vite + Tailwind · Backend: Python + FastAPI ·
Real-time: WebSocket · Penyimpanan (menyusul): SQLite + penyimpanan objek.

## Catatan kontrak

Kontrak data adalah sumber kebenaran tunggal lintas tim (§6, §12). Setiap
perubahan harus melalui kesepakatan tech lead dan disinkronkan di **kedua** sisi
(Pydantic backend ⇄ TypeScript frontend). Lihat `docs/CONTRACTS.md`.
