# Redesign UI SPROUT — putih, profesional, on-brand

**Tanggal:** 2026-06-18
**Status:** Disetujui (arah "Seimbang", light-only)

## Tujuan
Menyelaraskan UI dashboard internal SPROUT dengan brand guidelines Sprout
(`/Users/alfred/Documents/Claude/Projects/Sproutlab.id`): background **putih**,
lebih profesional, tetap khas Sprout. Murni visual — tidak mengubah logika/fitur/data.

## Brand tokens (sumber: context/10-brand-core.md + brand.css)
| Token | Hex | Pemakaian |
|---|---|---|
| Deep Black | `#0C0F0A` | teks/ink (body sedikit dilembutkan) |
| Sprout Green | `#2D7D3A` | primary: tombol, link, ikon aktif |
| Bright Green | `#7ED957` | aksen pop: nav aktif, highlight, angka penting |
| Cream | `#F0EDD8` | tint lembut: hover, chip, header tabel (ganti abu-abu) |
| Gold | `#F5C518` | aksen hemat: status spesial (mis. "siap tayang") |
| White | `#FFFFFF` | background halaman & kartu |

Palette Prudential (Pru Red/Teal) **tidak dipakai** — itu khusus konten IG, bukan tool internal.

## Tipografi (next/font/google)
- **Syne** (600–800) → display: judul halaman, section title, angka besar, wordmark.
- **DM Sans** → body & UI default.
- **Space Mono** → angka tabular (jam, tanggal, hitungan).
- Hapus Instrument Serif + Geist.

## Perubahan
1. **`globals.css`** — retune semua token ke palette di atas; hapus blok `.dark` &
   plumbing dark mode; background putih; border hangat tipis; shadow lembut;
   grain overlay sangat tipis (~0.02–0.03 opacity) di body.
2. **`layout.tsx`** — ganti font ke Syne + DM Sans + Space Mono; hapus tema gelap.
3. **Komponen bersama** (menyebar otomatis):
   - `components/sidebar.tsx` — pill aktif hijau, label section mono kecil.
   - `app/(dashboard)/layout.tsx` + `dashboard-shell.tsx` — header putih bersih.
   - `components/ui-kit.tsx` — PageHeader/SectionTitle judul Syne; StatCard angka Syne, emphasis hijau.
   - `components/ui/button.tsx` — primary hijau Sprout, secondary cream-tint, ghost, destructive merah.
   - `components/status-badge.tsx` — mapping warna brand (hijau/gold/netral) tetap jelas semantik.
   - Tabel (rekap/users/absensi/video) — header cream, hover hijau tipis, angka mono.
   - Form (`ui/input`, `ui/label`, select, textarea) — focus ring hijau.
   - `app/login/page.tsx` — kartu putih terpusat, wordmark Syne, tombol hijau (kesan pertama).
   - `components/ui/sonner` (toast) — selaras.

## Di luar scope (YAGNI)
Tidak ada fitur/halaman baru; tanpa palette Prudential; tanpa font Caveat; tanpa perubahan logika.

## Strategi & verifikasi
Pusatkan di token + font dulu (mayoritas berubah otomatis), lalu poles komponen bersama.
Verifikasi: `npx tsc --noEmit`, `npx vitest run`, `npx next build`, dan tinjauan visual login + dashboard.
