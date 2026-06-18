# Scheduler v2 — multi-platform, prep materi, logo, dashboard

**Tanggal:** 2026-06-18 · **Status:** Disetujui

Penyempurnaan halaman Jadwal Posting (`/jadwal`).

## 1. Buat jadwal multi-platform sekali klik
Form + Jadwalkan: pilih konten (dropdown) → centang platform (YouTube/Shorts/TikTok/IG) →
default tanggal+jam (bisa override per platform) → submit = insert banyak baris `post_schedule` sekaligus.

## 2. Dropdown bersih
Sumber (Video Final / Bank Konten) menyembunyikan konten yang **sudah punya ≥1 jadwal** ATAU **ditandai "sudah diposting"**.

## 3. Penanda "sudah diposting (tanpa jadwal)"
Checkbox di **halaman Bank Konten** & **detail Video** (status Final/Tayang) — hanya owner + social_media.
Tabel baru `posted_content` (content_key PK, source_type, title, video_id, marked_by, marked_at).

## 4. Edit/tambah lewat kalender
Klik item kalender (atau baris checklist) → panel **"Kelola konten"**: daftar platform terjadwal
(edit jam · ✓ diposting · hapus) + **+ Tambah platform**.

## 5. Persiapan materi per konten
Tabel baru `content_prep` (content_key PK, thumbnail_url, description, tags, updated_by, updated_at).
Di panel Kelola: upload **thumbnail** (Supabase Storage bucket publik `thumbnails`, upload via service role),
**description** & **tags** (textarea + tombol Copy). Disiapkan sebelum tayang.

## 6. Logo platform
Komponen `platform-icon.tsx` (SVG inline brand: YouTube, Shorts, TikTok, Instagram) dipakai di kalender,
checklist, panel, dashboard.

## 7. Widget Dashboard
Untuk owner + social_media: kartu "Jadwal posting" — Hari ini / Besok / 2 hari lagi (logo + judul + jam + Download).

## 8. Mobile-friendly
Panel kelola, form multi-platform, upload, tombol Copy — responsif (full-width di HP).

## Data & file
- Migrasi `0011_scheduler_v2.sql`: `posted_content`, `content_prep` (+RLS can_manage_schedule), bucket `thumbnails` publik.
- Pure: `post-schedule.ts` (+ `contentKey`, `scheduledContentKeys`, grouping). Data: `post-schedule-data.ts` (+ posted/prep queries).
- Actions: createSchedule (multi), addPlatform, updateSchedule, togglePosted, deleteSchedule, markPostedContent, saveContentPrep, uploadThumbnail.
- UI: `jadwal/scheduler-view.tsx` + `schedule-form.tsx` + `content-editor.tsx`; `components/platform-icon.tsx`; `components/posted-toggle.tsx` (Bank Konten + Video detail); dashboard widget.

## Di luar scope
Tanpa auto-publish API; prep satu set per konten (belum per platform); tanpa tulis balik ke Google Sheet.

## Eksekusi
Migrasi dijalankan langsung via `npm run db:migrate` (DATABASE_URL di .env.local → Supabase Singapura).
Verifikasi: tsc, vitest, next build, preview.
