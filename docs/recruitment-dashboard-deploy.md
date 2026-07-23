# Deploy: Recruitment Dashboard (Journey, Tren Mingguan, Milestone)

Branch: `feat-recruitment-dashboard-journey`. Kode sudah lolos `tsc`, 117 unit test, dan `next build`.
Bagian berikut adalah langkah **operasional DB** yang belum bisa dijalankan otomatis karena
`DATABASE_URL` di `.env.local` menolak auth (`28P01 password authentication failed`).

## 1. Perbaiki kredensial DB (WAJIB dulu)

`DATABASE_URL` menunjuk Supabase pooler (`...pooler.supabase.com`). Password-nya tidak valid.
Ambil connection string yang benar dari Supabase → Project → Settings → Database, perbarui
`DATABASE_URL` di `.env.local`. Uji:

```bash
node --env-file=.env.local scripts/db-migrate.mjs supabase/migrations/0015_recruitment_milestones.sql
```

## 2. Terapkan migrasi (berurutan)

```bash
node --env-file=.env.local scripts/db-migrate.mjs supabase/migrations/0015_recruitment_milestones.sql
node --env-file=.env.local scripts/db-migrate.mjs supabase/migrations/0016_recruitment_stage_interview_hr2.sql
```

- `0015` — kolom `ms_first_office`, `ms_aaji`, `ms_first_closing` (untuk tabel Milestone editable).
- `0016` — memperluas CHECK constraint `stage` agar menerima `interview_hr2` (tahap ke-8 baru).

## 3. Rekonsiliasi `max_reached` (satu kali, sebelum aktivitas baru)

Menyisipkan `interview_hr2` di indeks 4 menggeser indeks tahap sesudahnya. `max_reached` adalah
angka indeks yang tersimpan, jadi baris lama berskala-7 akan off-by-one. **Diagnosa dulu — jangan
asal backfill** (data hasil sync HTML kemungkinan sudah skala-8 dan bisa rusak jika digeser lagi).

```bash
# Jalankan query diagnostik, baca kolom "indikasi_skala":
node --env-file=.env.local scripts/db-migrate.mjs scripts/recruitment-diagnose-max-reached.sql
```

- Mayoritas **"LAMA (perlu +1)"** → jalankan backfill:
  ```bash
  node --env-file=.env.local scripts/db-migrate.mjs scripts/recruitment-0017-backfill-max-reached.sql
  ```
- Mayoritas **"BARU (ok)"** → lewati backfill.
- Campur → periksa per-baris dulu; lihat catatan di `scripts/recruitment-0017-backfill-max-reached.sql`.

> Catatan: `importMergeCore` (Drive sync) menyalin `maxReached` apa adanya dari JSON HTML dan **tidak**
> menimpa `max_reached` baris lama. Karena app kini juga 8-tahap, sync ke depan sudah selaras.

## 4. Verifikasi runtime

`npm run dev` → `/recruitment`:
- Kanban punya kolom baru **Interview HR 2** di antara Interview HR dan Interview Pak Alfred.
- Tab **Dashboard** menampilkan 5 section: KPI, Funnel+Source, Journey (funnel+ringkasan),
  Tren Mingguan, Milestone. Cek angka "Jadi Agent" = jumlah agen sebenarnya (validasi rekonsiliasi #3).
- Isi tanggal di tabel Milestone → toast tersimpan → refresh → nilai tetap ada.
