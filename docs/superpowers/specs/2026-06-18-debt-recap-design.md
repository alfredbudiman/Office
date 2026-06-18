# Rekapitulasi Hutang (modul khusus Irene)

**Tanggal:** 2026-06-18 · **Status:** Disetujui

Modul pencatatan iuran/hutang untuk Irene. Halaman `/hutang`.

## Akses
- Role baru **`finance`** (Irene). Login Irene HANYA melihat menu "Rekapitulasi Hutang".
- **Owner** juga bisa membuka (pantau). Role lain tidak melihat menu.
- `/hutang` → `requireRole("owner", "finance")`.

## Data
- `debt_people`: id, name, monthly_pa (numeric, di-assign saat tambah), active, created_by, created_at.
- `debt_charges`: id, person_id (fk), category ('monday_lab'|'pa'|'lainnya'), occurred_on (date),
  qty (default 1), unit_price, amount (qty×unit_price), description, paid (bool), paid_at, created_by, created_at.
- Helper `can_manage_debt()` = role in ('owner','finance') & aktif. RLS semua operasi.
- Harga box Monday Lab default 25.000 (konstanta di kode), bisa diubah per acara (disimpan di unit_price).

## Tiga bagian
1. **Monday Lab** — tambah acara: tanggal + harga box (default 25rb, editable) + pax per orang → charges (qty=pax, unit_price=harga, amount). occurred_on = tanggal acara.
2. **PA** — pilih bulan; otomatis muncul semua orang aktif dgn biaya PA bulanannya (auto-generate saat bulan dibuka bila belum ada; dari monthly_pa, editable per bulan). occurred_on = tgl 1 bulan itu.
3. **Lainnya** — manual: orang, qty (default 1), harga, keterangan → amount.

## Tandai lunas
Per item (`paid`). Lunas → tidak dihitung di total/output.

## Output (4 tombol generate text, murni + diuji)
1. Ringkasan Monday Lab · 2. Ringkasan PA · 3. Ringkasan Lainnya · 4. Rekap seluruhnya (per orang: total + rincian). Hanya yang belum lunas. Muncul di textarea + tombol Copy.

## File
- Migrasi `0012_role_finance.sql` (enum) + `0013_debt.sql` (tabel + RLS + can_manage_debt).
- `roles.ts` (+role+menu owner&finance) + test; `validation.ts`; `users/new-user-form.tsx`; `sidebar.tsx` ikon /hutang.
- `lib/debt.ts` (pure: tipe, formatRupiah, generator teks, total per orang) + test. `lib/debt-data.ts` (query).
- `hutang/page.tsx` + `actions.ts` + komponen client (people, monday lab, PA, lainnya, output). Mobile-friendly.

## Akun Irene
Dibuat setelah role live: butuh email + password dari user. Dibuat via SQL (DB access ada) atau lewat Kelola User (role finance).

## Di luar scope
Tanpa export PDF/Excel; Rupiah saja; PA auto saat bulan dibuka (bukan cron).

## Eksekusi
Migrasi via `npm run db:migrate` (DATABASE_URL di .env.local). Verifikasi: tsc, vitest, next build.
