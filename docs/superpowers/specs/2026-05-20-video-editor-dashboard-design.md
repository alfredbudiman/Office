# Dashboard Tim — Modul Video Editor (Desain)

**Tanggal:** 2026-05-20
**Status:** Disetujui untuk masuk perencanaan implementasi
**Owner:** Alfred (alfred.budiman@gmail.com)

## Ringkasan

Dashboard internal sebagai media komunikasi antara owner dengan tim (video editor, HRD).
Owner punya akses penuh; tiap role punya menu berbeda. Spec ini fokus pada **fondasi
(auth + role) dan modul Video Editor**, plus menyiapkan fondasi untuk modul HRD (absensi
sederhana). Modul HRD lain dibangun di fase berikutnya.

## Keputusan Kunci (hasil brainstorming)

- **Penanganan video:** link-only. Sistem hanya menyimpan link (Google Drive/YouTube/dll),
  bukan file video. Tidak butuh storage besar.
- **Revisi:** tak terbatas. Riwayat tiap draft (Draft 1, 2, 3…) tersimpan, tidak ditimpa.
- **Tipe video:** monolog, podcast, shorts, clipping. Clipping beda alur (skip cut-to-cut)
  dan terhubung ke video induk.
- **Stok konten:** monitor stok final siap tayang **dan** sebaran isi pipeline.
- **Rekap kinerja:** fokus ke kecepatan (waktu pengerjaan & per tahap) + jumlah selesai per tipe.
- **Akun:** 1 editor untuk sekarang, akun dibuat oleh owner. Tidak ada registrasi publik.
  Arsitektur menyiapkan banyak editor.
- **Komunikasi:** komentar in-app + notifikasi in-app (Realtime). Tanpa email/WA di v1.
- **Absensi (HRD):** clock in / clock out, dengan rekap jam kerja per periode.

## Tech Stack

- **Next.js (App Router) + TypeScript** — deploy sebagai **project Vercel baru terpisah**
  (tidak menyentuh project Vercel lain milik owner).
- **Supabase** (project baru khusus app ini): Postgres (data), Auth (login),
  Row Level Security (akses per-role), Realtime (notif & komentar live).
- **Tailwind + shadcn/ui** (komponen) + **Framer Motion** (animasi/transisi).
- Repo **git baru**; env var Supabase disimpan di Vercel.
- VPS owner tidak dipakai untuk v1 (dicadangkan untuk kebutuhan lain).

## Peran & Akses

- **Owner:** akses semua. Buat entri video, approve, catatan revisi, centang final,
  lihat rekap & stok, kelola akun, akses semua modul (termasuk HRD nanti).
- **Editor:** hanya lihat video yang ditugaskan ke dirinya. Update progres, kirim link
  draft, balas komentar. Tidak lihat data editor lain atau modul HRD.
- **HRD:** disiapkan strukturnya. Untuk v1 cuma punya akses absensi; modul HRD lain menyusul.

**Struktur menu (sidebar, beda per role):**
- Owner: Dashboard · Video · Stok Konten · Rekap Kinerja · Kelola User · Absensi · *(HRD lain — nanti)*
- Editor: Dashboard · Video Saya · Absensi
- HRD: Dashboard · Absensi · *(modul HRD lain — nanti)*

Penjaga akses sebenarnya ada di level database (RLS), bukan sekadar sembunyikan menu.

## Model Data (Postgres / Supabase)

- **users** — id, nama, email, role (owner/editor/hrd), aktif (bool).
- **videos** — id, judul, tipe (monolog/podcast/shorts/clipping), status, editor_id,
  parent_video_id (terisi jika clipping), link_source, created_at, final_at,
  target_tayang (opsional), sudah_tayang (bool), published_at (opsional).
- **drafts** — id, video_id, nomor_draft, link_draft, created_by, created_at.
  (Append-only — riwayat tiap draft tersimpan.)
- **comments** — id, video_id, user_id, isi, created_at.
- **notifications** — id, user_id (penerima), pesan, link, sudah_dibaca (bool), created_at.
- **status_events** — id, video_id, status_lama, status_baru, created_at.
  (Sumber data perhitungan rekap kecepatan per tahap.)
- **attendance** — id, user_id, tanggal, clock_in, clock_out.

## Alur Status Video

**Status (monolog / podcast / shorts):**
1. `Draft Brief` — Owner buat entri + tempel link source, tugaskan ke editor.
2. `Cut-to-Cut` — Editor kerjakan potongan kasar, kirim link.
3. `Review Cut` — Owner approve → lanjut, atau catatan → balik ke editor (kembali ke Cut-to-Cut).
4. `Editing` — Editor edit penuh.
5. `Review Draft` — Editor kirim Draft N. Owner approve → Final, atau catatan revisi →
   editor kirim Draft N+1 (loop tak terbatas, kembali ke Review Draft).
6. `Final` — Owner centang. Masuk stok siap tayang.
7. `Tayang` — ditandai sudah publish (keluar dari stok).

**Alur clipping:** sama, tapi **skip `Cut-to-Cut` & `Review Cut`** (mulai dari `Editing`),
dan **wajib** pilih video induk (parent_video_id).

Tiap perpindahan status dicatat di `status_events` dan memicu notifikasi ke pihak terkait.
Tiap komentar baru juga memicu notifikasi.

## Layar Utama (UI)

- **Login** — email + password (Supabase Auth). Redirect ke Dashboard sesuai role.
- **Dashboard (Owner)** — kartu ringkasan (jumlah per status, stok siap tayang, video butuh
  aksi owner), daftar "Perlu aksi Anda" di atas.
- **Video (Owner)** — papan **kanban** per status (kolom: Draft Brief → Cut-to-Cut →
  Review Cut → Editing → Review Draft → Final → Tayang), filter per tipe & editor, toggle ke
  tabel. Tombol "+ Video baru" (form: judul, tipe, link source, editor; jika clipping →
  pilih video induk). **Detail video:** info, link source, riwayat semua draft, timeline
  status, kolom komentar; tombol approve / minta revisi / centang final.
- **Video Saya (Editor)** — daftar video yang ditugaskan; detail sama tapi tombol
  "Kirim link cut-to-cut" / "Kirim Draft" + balas komentar. Tidak lihat punya editor lain.
- **Stok Konten** — (a) stok final siap tayang per tipe + estimasi "cukup berapa hari"
  berdasarkan target posting/minggu yang di-set owner; (b) sebaran isi pipeline (jumlah per tahap).
- **Rekap Kinerja** — filter rentang tanggal + opsional editor & tipe. Tampilkan jumlah video
  final per tipe dan kecepatan (rata-rata mulai→final + lama per tahap). Export CSV.
- **Kelola User (Owner)** — daftar user, tambah/nonaktifkan, set role & password.
- **Absensi** — tombol Clock In / Clock Out, status hari ini; tabel rekap jam kerja per
  periode (Owner/HRD lihat semua; karyawan lihat dirinya).
- **Notifikasi** — ikon lonceng di header + badge, update live via Realtime.

Tampilan: bersih & modern, transisi Framer Motion (kartu kanban smooth saat pindah kolom,
panel detail slide-in). Dibangun dengan skill frontend-design.

## Keamanan & Error Handling

- Supabase Auth + **Row Level Security**: editor tidak bisa menarik data video orang lain
  walau coba akali API. Owner bypass (lihat semua).
- Validasi form: judul wajib, link harus URL valid, clipping wajib punya induk.
- Aksi gagal (mis. koneksi putus) → pesan error jelas, data tidak hilang.
- Jika Realtime gagal, data tetap muncul saat refresh (fallback ke fetch biasa).

## Testing

- Unit test logika inti: transisi status (loop revisi & aturan skip clipping),
  perhitungan rekap kecepatan, hitung stok.
- Test akses role (editor tidak bisa akses data orang lain / modul HRD).
- TDD untuk logika penting.

## Urutan Build (Fase)

1. **Fondasi** — auth, role, struktur menu, kelola user.
2. **Modul Video Editor** (inti) — kanban, detail video, draft, komentar, notifikasi.
3. **Stok Konten + Rekap Kinerja.**
4. **Absensi** — clock in/out + rekap.

## Di Luar Cakupan (v1)

- Modul HRD selain absensi (penggajian, cuti formal, dll).
- Upload/storage file video (tetap link-only).
- Notifikasi email / WhatsApp.
- Integrasi analytics platform (views, dll).
