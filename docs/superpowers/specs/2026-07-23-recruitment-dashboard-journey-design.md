# Rombak Tab Dashboard `/recruitment` — Journey, Tren Mingguan & Milestone

**Tanggal:** 2026-07-23
**Status:** Disetujui (menunggu review spec)

## Tujuan

Menggabungkan analitik dari prototipe HTML `Agent-Recruitment-Dashboard-2026-07-21.html`
(tab Dashboard + tab Journey) ke dalam **satu tab Dashboard** di `/recruitment`, memakai
**data live Supabase** dan **styling app** (Tailwind + shadcn, brand sea-green,
`rounded-2xl`, `font-display`, Recharts). Chart baru pakai Recharts — bukan Chart.js.

Halaman tetap dibatasi role `owner` + `hrd` (lihat `page.tsx`). Semua view menerima
list yang **sudah ter-filter Jalur** (`filtered`), jadi analitik baru otomatis ikut filter.

## Susunan Tab Dashboard (atas → bawah)

Komponen: `src/app/(dashboard)/recruitment/dashboard-view.tsx` (dirombak, tetap `"use client"`).

1. **KPI row** — 6 `StatCard` (Total Kandidat, Aktif di Pipeline, Talent Pool, Tidak Lolos,
   Agent Aktif, Source Terbaik). **Tetap seperti sekarang.**
2. **Funnel & Conversion Rate per Tahap** + **Kandidat per Source** (pie Recharts).
   **Tetap seperti sekarang** (grid `lg:grid-cols-[1.3fr_1fr]`).
3. 🆕 **Journey — Funnel & Konversi**
   - Ringkasan 6 angka (`journeySummary`): Total masuk pipeline · Masih aktif diproses ·
     Diundang ke kantor · Datang ke kantor (+`% dari diundang`) · Jadi Agent ·
     Konversi Screening→Agent (%).
   - Funnel 6 tahap (`journeyFunnel`, dari `screening` s/d `agent`): tiap baris label +
     bar lebar proporsional + teks `{n} · {pctTop}% dari awal · {pctPrev}% lanjut dari tahap sebelumnya`.
4. 🆕 **Tren Mingguan (8 minggu terakhir)** — grouped bar chart (Recharts `BarChart`),
   3 seri per minggu: **Masuk** (dari `dateIn`), **Interview terjadwal** (`interviewAt`),
   **Datang ke kantor** (`officeDate`). Data dari `weeklyTrend`.
5. 🆕 **Milestone Agent (sudah onboarding)** — tabel editable. Baris = kandidat yang
   `maxReached >= idx(onboarding)` atau `stage ∈ {onboarding, agent}`, dan `outcome ∉
   {tidak_lolos, talent_pool}`, tidak diarsip. Kolom:
   - Agent (nama + label tahap)
   - Pertama ke Kantor — `<input type=date>` → `msFirstOffice`
   - Join / Kontrak — `<input type=date>` → `joinDate` (field lama)
   - Lisensi AAJI — `<input type=date>` → `msAAJI`
   - Closing Pertama — `<input type=date>` → `msFirstClosing`
   - Join→Closing — auto `daysBetween(joinDate, msFirstClosing)` dalam "N hari"

## Perubahan Backend

### Migrasi DB
File baru: `supabase/migrations/0015_recruitment_milestones.sql`
```sql
alter table public.recruitment_candidates
  add column if not exists ms_first_office date,
  add column if not exists ms_aaji date,
  add column if not exists ms_first_closing date;
```
Nullable, tanpa perubahan RLS (policy `recruitment_candidates` yang ada sudah mencakup
update oleh owner/hrd). Dijalankan via `npm run db:migrate`.

### Tipe & mapping — `src/lib/recruitment.ts`
- `Candidate`: tambah `msFirstOffice: string`, `msAAJI: string`, `msFirstClosing: string`.
- `CandidateRow`: tambah `ms_first_office: string | null`, `ms_aaji: string | null`,
  `ms_first_closing: string | null`.
- `rowToCandidate`: map ketiganya via helper `s()` (default `""`).

`page.tsx` pakai `.select("*")` → kolom baru otomatis ikut, tak perlu diubah.

### Server action — `src/app/(dashboard)/recruitment/actions.ts`
```
updateMilestone(id: string, field: "ms_first_office" | "ms_aaji" | "ms_first_closing" | "join_date", value: string): Promise<Result>
```
- `requireRole("owner", "hrd")`.
- Validasi `field` termasuk whitelist di atas (cegah update kolom arbitrer).
- `value` kosong → simpan `null`; jika terisi, validasi format `YYYY-MM-DD`.
- Update `last_updated` + append satu entri `history` ("Milestone: {label} = {value|-}").
- `revalidatePath("/recruitment")`.
- Catatan Next.js 16: baca `node_modules/next/dist/docs/` terkait Server Actions sebelum implementasi.

## Helper Murni Baru — `src/lib/recruitment.ts`

Semua deterministik, tanpa I/O, dites di `recruitment.test.ts`.

- `journeyFunnel(cands: Candidate[]): { stage: Stage; label: string; count: number;
  pctTop: number; pctPrev: number; width: number }[]`
  6 tahap `screening→agent`; `count = cands` dengan `maxReached >= idx`;
  `pctTop = round(count/top*100)`; `pctPrev` (baris 0 = 100) `= round(count/prevCount*100)`;
  `width = max(5, round(count/top*100))`.
- `journeySummary(cands): { total; aktif; diundang; office; showRate; agent; convAll }`
  mengikuti logika `renderJourney` HTML (`total = count(maxReached>=idx(screening))`,
  `office/diundang/agent` per tahap, `showRate = round(office/diundang*100)`,
  `convAll = round(agent/total*100)`).
- `weeklyTrend(cands): { key; label; masuk; interview; office }[]` — 8 minggu terakhir,
  minggu di-anchor ke Senin (Monday-of-week, UTC-safe). "Masuk" dari `dateIn`,
  "interview" dari `interviewAt` (jika ada), "office" dari `officeDate(c)`.
- `officeDate(c): string` — port `jOfficeDate`: `msFirstOffice || joinDate ||
  (maxReached>=idx(onboarding) ? (stageSince || interviewAt) : "")`.
- Helper minggu: `mondayOf(dateStr)` (UTC-safe, seperti `addDays`), `weekLabel(mondayStr)`
  format `id-ID` `{day:"2-digit",month:"short"}`.

Reuse yang sudah ada: `stageIndex`, `daysBetween`, `STAGES`.

## Interaksi Client (Milestone editable)

`DashboardView` (`"use client"`) meng-import `updateMilestone` dari `actions.ts`.
Tiap `onChange` input tanggal memanggil action dalam `startTransition`, lalu
`router.refresh()` (atau andalkan `revalidatePath`) + `toast` sukses/gagal (sonner sudah dipakai).
Optimistis opsional; default: refresh setelah action selesai.

## Styling

Reproduksi tata letak HTML dengan token app, **bukan** CSS mentah HTML:
panel `rounded-2xl border border-border/70 bg-card p-5 shadow-card`,
heading `font-display text-base tracking-tight`, bar funnel pakai `bg-brand` /
`bg-brand-muted/40` seperti funnel yang sudah ada. Warna seri chart konsisten dengan
`PIE_COLORS` yang ada (sea-green `#2e8b57`, blue `#2c6fb3`, amber `#b7791f`, purple `#8e44ad`).

## Testing / Verifikasi

- **Unit** (`recruitment.test.ts`): `journeyFunnel`, `journeySummary`, `weeklyTrend`,
  `officeDate`, `mondayOf` — pakai fixture `cand()` yang sudah ada. `npm test`.
- **Manual/verify**: `npm run dev` → buka `/recruitment` tab Dashboard, cek 3 section baru
  render dengan data live, ganti filter Jalur → angka ikut berubah, isi input milestone →
  tersimpan (refresh halaman tetap ada), Join→Closing terhitung.

## Di Luar Cakupan (YAGNI)

- Tidak porting tab "Tempel Kandidat (dari analisis Claude)" maupun view Journey terpisah —
  semua konten Journey masuk ke tab Dashboard.
- Tidak mengubah data seed / localStorage HTML — app pakai Supabase.
- Tidak mengubah Kanban / Database / Wawancara.
