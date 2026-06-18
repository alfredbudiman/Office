# Scheduler Posting Konten + Role Social Media & Ads Manager

**Tanggal:** 2026-06-18 · **Status:** Disetujui

## Tujuan
Halaman penjadwalan posting konten ke YouTube, YouTube Shorts, TikTok, Instagram.
Tim social media menjadwalkan video yang sudah jadi ke tanggal/jam tertentu per platform,
klik tanggal → lihat item + link Drive untuk download, dan ada checklist progres
(mana yang sudah/belum diposting). Pencatatan jadwal saja — **tidak** auto-publish via API.

## Role baru: `social_media` ("Social Media & Ads Manager")
- Menu: Dashboard, **Jadwal Posting**, Bank Konten, Absensi.
- **Tidak** bisa: Recruitment, Kelola User, Pengaturan, alur Video penuh.
- Diberi akses **baca** tabel `videos` (read-only) untuk memilih video Final di picker.
- Owner juga bisa akses Jadwal Posting.

## Data
Migrasi `0009_role_social_media.sql`: `alter type user_role add value 'social_media'` (file terpisah agar tak satu transaksi dengan pemakaiannya).

Migrasi `0010_post_schedule.sql`:
- enum `post_platform` = youtube | youtube_shorts | tiktok | instagram
- enum `post_status` = scheduled | posted
- tabel `post_schedule`:
  `id · title · source_type (video|bank_konten|manual) · video_id (fk videos, nullable) ·
   drive_url · platform · scheduled_at (timestamptz) · status · posted_at · note · created_by · created_at`
- helper `can_manage_schedule()` = role in ('owner','social_media') & aktif
- RLS: select/insert/update/delete hanya `can_manage_schedule()`
- update `videos_select` agar `can_manage_schedule()` boleh baca videos (read-only picker)

## UI — halaman `/jadwal` ("Jadwal Posting"), `requireRole("owner","social_media")`
- Tombol **+ Jadwalkan** → form: pilih sumber (Video Final / Bank Konten / Manual) →
  judul & link Drive auto-terisi (editable) → platform → tanggal & jam. 1 baris = 1 post; 1 konten boleh banyak.
- **Tampilan Kalender** (default): grid bulan, tiap tanggal tampil ringkas; klik tanggal → panel berisi
  post hari itu (judul · platform · jam · tombol Download Drive · tombol ✓ Tandai diposting).
- **Tampilan Checklist** (matriks): baris = konten, kolom = 4 platform, sel = ✓tanggal (posted) / ○tanggal (terjadwal) / — (belum). Ringkasan progres "X/Y diposting".
- Aksi server: `createSchedule`, `markPosted` (toggle scheduled↔posted + posted_at), `deleteSchedule`.

## Perubahan kode
- `src/lib/roles.ts`: tambah role + menu; `src/lib/roles.test.ts`: update owner (tambah /jadwal) + test social_media.
- `src/lib/validation.ts`: ROLES + label.
- `src/app/(dashboard)/users/new-user-form.tsx`: opsi role baru.
- `src/components/sidebar.tsx`: ikon untuk `/jadwal`.
- Baru: `src/lib/post-schedule.ts` (tipe, konstanta platform, query, helper murni `buildChecklist`),
  `src/app/(dashboard)/jadwal/` (page + actions + komponen client calendar/checklist/form).

## Sumber konten di form
- Video Final: query `videos` status final/tayang → prefill judul (link Drive diisi/edit manual).
- Bank Konten: item dari sheet (judul + link) → prefill judul + drive_url.
- Manual: kosong.

## Di luar scope (YAGNI)
Tanpa auto-publish/API platform; tanpa reminder otomatis; tanpa edit-inline (cukup hapus+buat ulang di v1);
tidak mengubah struktur Bank Konten sheet; status cukup scheduled/posted (belum ada "batal").

## Catatan deploy
Migrasi `0009` & `0010` harus diterapkan ke DB (`npm run db:migrate <file>` atau via Supabase) sebelum fitur jalan.
Verifikasi: `tsc`, `vitest`, `next build`, tinjauan preview.
