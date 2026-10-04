# Deploy Cogniva ke Railway

Gunakan satu project dan environment Railway untuk tiga service: `Postgres`,
`backend`, dan `frontend`. Docker Compose tidak dijalankan di Railway;
masing-masing service aplikasi dibangun dari Dockerfile di foldernya.

## 1. Push proyek ke GitHub

Commit perubahan konfigurasi deploy, lalu push ke repository kamu. Jangan
commit `.env` atau API key.

## 2. Database

Di Railway, buat project baru lalu tambahkan database PostgreSQL. Panduan ini
menggunakan nama service `Postgres`; sesuaikan referensi variabel bila namanya berbeda.

## 3. Backend

Tambahkan service dari repository GitHub yang sama dan beri nama `backend`.

- Root Directory: `/apps/backend`
- Builder: Dockerfile (terdeteksi otomatis)
- Start Command: biarkan kosong, gunakan CMD dan entrypoint Dockerfile
- Healthcheck Path: `/health`

Isi Variables:

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
GEMINI_API_KEY=<API key Gemini kamu>
JWT_SECRET=<secret acak panjang>
PORT=8000
NODE_ENV=production
COGNIVA_TTS_ENABLED=false
```

Buat JWT_SECRET lokal dengan `openssl rand -hex 32`, atau jika memakai Node:
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

Deploy backend dan tunggu status sehat. Migrasi Prisma dijalankan otomatis
oleh entrypoint sebelum server dimulai. Backend tidak memerlukan public domain.

## 4. Frontend

Tambahkan service kedua dari repository yang sama dan beri nama `frontend`.

- Root Directory: `/apps/frontend`
- Builder: Dockerfile (terdeteksi otomatis)
- Start Command: biarkan kosong
- Healthcheck Path: `/health`

Isi Variables:

```dotenv
BACKEND_UPSTREAM=${{backend.RAILWAY_PRIVATE_DOMAIN}}:8000
PORT=80
```

Biarkan `VITE_API_BASE` kosong/tidak ditambahkan: Dockerfile menggunakan URL
relatif `/api`, lalu Nginx meneruskannya ke backend melalui jaringan privat.
Deploy frontend setelah backend sehat.

Di Settings > Networking > Public Networking, pilih Generate Domain dengan
target port `80`. Buka URL HTTPS yang diberikan Railway: itulah website kamu.
Railway menangani HTTPS; tidak perlu service Caddy.

## 5. Verifikasi

- Buka `https://<domain-frontend>/health`, pastikan respons `status: ok`.
- Buat workspace, kirim chat, dan coba Teach.
- Refresh URL workspace untuk memastikan routing frontend bekerja.
- Coba Record dan berikan izin mic ketika diminta.

Pada konfigurasi ini learner membalas lewat teks. Recording mic pengguna tetap
bisa dipakai. Suara learner membutuhkan service TTS terpisah; petunjuknya ada
di `services/tts/README.md`.

## Jika deploy gagal

- Build: lihat Build Logs pada service yang gagal.
- Backend: cek Deploy Logs untuk koneksi Postgres dan migrasi Prisma.
- Frontend 502 atau gagal resolve upstream: pastikan backend sudah sehat dan
  `BACKEND_UPSTREAM` merujuk nama service backend yang benar, tanpa `http://`.
- API menjadi mock: pastikan `GEMINI_API_KEY` terisi dan `USE_MOCK_AI` tidak true.

Referensi: https://docs.railway.com/guides/docker-compose,
https://docs.railway.com/deployments/monorepo,
https://docs.railway.com/networking/domains/working-with-domains.
