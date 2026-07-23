# Deploy: Recruitment Dashboard (Journey, Tren Mingguan, Milestone)

Kode sudah lolos `tsc`, 117 unit test, dan `next build`, dan sudah di-merge.
Yang tersisa hanya **satu langkah database**. `DATABASE_URL` di `.env.local` menolak auth
(`28P01 password authentication failed`), jadi migrasi tak bisa jalan dari terminal lokal.

## Cara termudah: SQL Editor (tanpa password, tanpa terminal)

1. Buka **Supabase Dashboard** → project ini → menu **SQL Editor** → **New query**.
2. Buka file `scripts/recruitment-apply-all.sql`, **salin seluruh isinya**, tempel, klik **Run**.

Itu menerapkan ketiganya sekaligus, aman & bisa diulang:
- kolom milestone (`ms_first_office`, `ms_aaji`, `ms_first_closing`),
- tahap baru `interview_hr2` di CHECK constraint,
- rekonsiliasi `max_reached` (hanya menaikkan nilai yang tertinggal — tidak mungkin merusak
  data yang sudah benar, tak perlu diagnosa skala).

## Alternatif: dari terminal (jika kredensial DB sudah benar)

Perbaiki dulu `DATABASE_URL` di `.env.local` (ambil dari Supabase → Settings → Database), lalu:

```bash
node --env-file=.env.local scripts/db-migrate.mjs supabase/migrations/0015_recruitment_milestones.sql
node --env-file=.env.local scripts/db-migrate.mjs supabase/migrations/0016_recruitment_stage_interview_hr2.sql
node --env-file=.env.local scripts/db-migrate.mjs supabase/migrations/0017_recruitment_max_reached_reconcile.sql
```

## Verifikasi runtime

`npm run dev` → `/recruitment`:
- Kanban punya kolom baru **Interview HR 2** di antara Interview HR dan Interview Pak Alfred.
- Tab **Dashboard**: KPI, Funnel+Source, **Journey** (funnel+ringkasan), **Tren Mingguan**,
  **Milestone** editable. Cek "Jadi Agent" = jumlah agen sebenarnya.
- Isi tanggal di tabel Milestone → toast tersimpan → refresh → nilai tetap ada.
