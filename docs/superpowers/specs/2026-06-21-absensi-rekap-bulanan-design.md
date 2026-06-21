# Rekap Absensi Bulanan per Orang — Design

**Tanggal:** 2026-06-21
**Status:** Disetujui (brainstorming)

## Tujuan

Menambah rekap absensi **per bulan, per orang** di halaman Absensi (`/absensi`) sehingga
owner & HRD bisa melihat ringkasan kehadiran tiap karyawan dalam satu bulan terpilih:
berapa hari hadir dan total jam kerja, dengan kemampuan membuka rincian harian per orang.

## Konteks saat ini

Halaman `/absensi` (`src/app/(dashboard)/absensi/page.tsx`) sekarang menampilkan:
- Clock card (clock in/out hari ini)
- Stat card pribadi ("Hari tercatat" & "Total jam" bulan ini)
- Daftar absensi **harian** bulan berjalan (tiap baris = 1 hari). Owner/HRD lihat semua;
  editor lihat miliknya sendiri.

Data: tabel `public.attendance` (`user_id`, `tanggal`, `clock_in`, `clock_out`, …).
Util tersedia di `src/lib/attendance.ts` (`workedMs`, `sumWorkedMs`) dan
`src/lib/rekap.ts` (`formatDuration`). Query via `listAttendance(from, to, userId?)` di
`src/lib/attendance-data.ts`.

## Keputusan rancangan

1. **Bentuk:** tabel ringkasan satu baris per orang (Nama · Hari hadir · Total jam), klik
   baris → expand rincian harian.
2. **Penempatan:** section baru "Rekap per karyawan" di bawah daftar harian yang sudah ada,
   pada halaman `/absensi`. Section lama tidak diubah.
3. **Akses:** hanya owner & HRD. Editor biasa tidak melihat section ini.
4. **Pemilihan bulan:** param URL `?bulan=YYYY-MM` (default = bulan berjalan). Hanya section
   baru yang bereaksi pada param ini; section lama tetap "bulan ini".
5. **Cakupan orang:** tampilkan **semua karyawan aktif** (`profiles.aktif = true`), termasuk
   yang 0 hari pada bulan itu — agar HRD bisa melihat siapa yang tidak hadir.
6. **Hari hadir:** jumlah baris attendance bulan tsb yang punya `clock_in` (tidak null).
7. **Total jam:** `sumWorkedMs(days)` lalu `formatDuration`. Shift yang masih berjalan
   (belum clock out) dihitung 0 jam (mengikuti perilaku `workedMs` yang ada).
8. **Urutan:** total jam terbanyak di atas; karyawan 0 hari berada di bawah.

## Arsitektur

### Server — `page.tsx`
- Ubah jadi menerima `searchParams: Promise<{ bulan?: string }>` (pola sama seperti
  `rekap/page.tsx`).
- Hitung rentang bulan terpilih: `from = ${bulan}-01`, `to = akhir bulan` (atau `wibToday()`
  bila bulan berjalan). Default `bulan` = `wibToday().slice(0,7)`.
- Untuk owner/HRD, tambah query paralel:
  - `listAttendance(from, to)` (tanpa filter user) untuk bulan terpilih.
  - daftar karyawan aktif: `profiles.select("id, nama").eq("aktif", true)`.
- Agregasi per `user_id` jadi `RekapOrang[]`: `{ id, nama, hariHadir, totalMs, days }`.
  Karyawan tanpa catatan tetap dimasukkan dengan `hariHadir=0`, `totalMs=0`, `days=[]`.
- Render `<BulanPicker bulan={bulan} />` dan `<RekapPerOrang data={rekap} />` di dalam blok
  `canViewAll`.

### Helper — `src/lib/attendance.ts`
- Tambah fungsi murni `aggregateByUser(rows, people)` yang mengembalikan `RekapOrang[]`
  terurut (total jam desc, lalu nama). Dibuat terpisah agar mudah diuji unit.
- Tambah tipe `RekapOrang`.

### Client — `bulan-picker.tsx` (baru)
- `<input type="month">` dengan `defaultValue={bulan}`; `onChange` →
  `router.push("/absensi?bulan=" + value)`. Pakai komponen `Input`/`Label` yang ada.

### Client — `rekap-per-orang.tsx` (baru)
- Terima `data: RekapOrang[]`.
- **Desktop:** tabel kolom Nama · Hari hadir · Total jam. State `expandedId` (string|null);
  klik baris toggle. Saat terbuka, render baris kedua `colSpan` berisi tabel kecil rincian
  harian (Tanggal, Masuk, Pulang, Durasi) dari `days`.
- **Mobile:** daftar kartu per orang; tap untuk expand rincian. Mengikuti pola
  `hidden sm:block` / `sm:hidden` yang sudah dipakai.
- Format jam/durasi/tanggal mengikuti helper yang sudah ada (`jam`, `formatDuration`,
  `toLocaleDateString("id-ID")`). Pindahkan/duplikasi helper `jam` seperlunya.

## Alur data

`searchParams.bulan` → rentang `from/to` → `listAttendance` + `profiles(aktif)` →
`aggregateByUser` → `RekapPerOrang` (tabel + expand).

## Error handling & edge case

- `bulan` tidak valid / kosong → fallback ke bulan berjalan.
- Bulan berjalan: `to = wibToday()` agar tidak menarik tanggal masa depan.
- Tidak ada karyawan aktif → tampilkan empty state ("Belum ada karyawan aktif").
- Shift lintas tengah malam / masih berjalan: `workedMs` mengembalikan null → dihitung 0,
  konsisten dengan daftar harian yang ada.

## Testing

- Unit test `aggregateByUser`:
  - karyawan tanpa catatan → 0 hari, 0 ms, days kosong.
  - hari hadir hanya menghitung baris dengan `clock_in`.
  - total ms = jumlah `workedMs`; baris tanpa clock_out tidak menambah.
  - urutan: total jam desc, lalu nama.
- Verifikasi manual: ganti bulan via picker, expand rincian, cek editor tidak melihat section.

## Di luar cakupan (YAGNI)

- Export CSV rekap (bisa menyusul).
- Matriks orang × tanggal / tampilan kalender.
- Edit/koreksi absensi dari rekap.
