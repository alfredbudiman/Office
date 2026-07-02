# Rekap Absensi Bulanan per Orang — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah section "Rekap per karyawan" di `/absensi` (owner & HRD) berisi tabel ringkasan kehadiran per orang untuk bulan terpilih, dengan rincian harian yang bisa di-expand.

**Architecture:** Helper agregasi murni di `src/lib/attendance.ts` (diuji unit). Halaman server `page.tsx` membaca `?bulan=YYYY-MM`, query `listAttendance` + karyawan aktif, lalu agregasi. Dua komponen client baru: `BulanPicker` (pilih bulan via URL) dan `RekapPerOrang` (tabel + expand).

**Tech Stack:** Next.js 16 (App Router, server components, async `searchParams`), React 19, Supabase, Vitest, Tailwind, lucide-react.

## Global Constraints

- AGENTS.md: ini Next.js dengan breaking changes — `searchParams` adalah `Promise`, harus di-`await` (lihat pola `src/app/(dashboard)/rekap/page.tsx:20-24`).
- Akses section ini: hanya `profile.role === "owner" || "hrd"` (variabel `canViewAll`).
- Util yang dipakai apa adanya: `sumWorkedMs`, `workedMs` (`src/lib/attendance.ts`), `formatDuration` (`src/lib/rekap.ts`), `wibToday` (`src/lib/wib.ts`).
- Test runner: `npm test` (vitest). Test hanya untuk lib murni; komponen diverifikasi `npx tsc --noEmit`.
- Bahasa UI: Indonesia, ikuti gaya teks & className yang ada.

---

### Task 1: Helper agregasi `aggregateByUser`

**Files:**
- Modify: `src/lib/attendance.ts`
- Test: `src/lib/attendance.test.ts`

**Interfaces:**
- Consumes: `sumWorkedMs` (sudah ada di file yang sama).
- Produces:
  - `type AttendanceDay = { id: string; tanggal: string; clock_in: string | null; clock_out: string | null }`
  - `type RekapOrang = { id: string; nama: string; hariHadir: number; totalMs: number; days: AttendanceDay[] }`
  - `function aggregateByUser(rows: (AttendanceDay & { user_id: string })[], people: { id: string; nama: string }[]): RekapOrang[]`

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `src/lib/attendance.test.ts`:

```typescript
import { aggregateByUser } from "@/lib/attendance";

describe("aggregateByUser", () => {
  const people = [
    { id: "a", nama: "Budi" },
    { id: "b", nama: "Ani" },
    { id: "c", nama: "Citra" },
  ];

  it("karyawan tanpa catatan -> 0 hari, 0 ms, days kosong", () => {
    const res = aggregateByUser([], people);
    expect(res).toHaveLength(3);
    for (const r of res) {
      expect(r.hariHadir).toBe(0);
      expect(r.totalMs).toBe(0);
      expect(r.days).toEqual([]);
    }
  });

  it("hari hadir hanya menghitung baris yang punya clock_in", () => {
    const rows = [
      { id: "1", user_id: "a", tanggal: "2026-06-01", clock_in: "2026-06-01T01:00:00Z", clock_out: "2026-06-01T05:00:00Z" },
      { id: "2", user_id: "a", tanggal: "2026-06-02", clock_in: null, clock_out: null },
    ];
    const res = aggregateByUser(rows, people);
    const budi = res.find((r) => r.id === "a")!;
    expect(budi.hariHadir).toBe(1);
    expect(budi.totalMs).toBe(4 * 3600000);
    expect(budi.days).toHaveLength(2);
  });

  it("baris tanpa clock_out tidak menambah total ms", () => {
    const rows = [
      { id: "1", user_id: "b", tanggal: "2026-06-01", clock_in: "2026-06-01T01:00:00Z", clock_out: null },
    ];
    const res = aggregateByUser(rows, people);
    const ani = res.find((r) => r.id === "b")!;
    expect(ani.hariHadir).toBe(1);
    expect(ani.totalMs).toBe(0);
  });

  it("urut total jam desc, lalu nama; days terurut tanggal asc", () => {
    const rows = [
      { id: "1", user_id: "a", tanggal: "2026-06-02", clock_in: "2026-06-02T01:00:00Z", clock_out: "2026-06-02T03:00:00Z" },
      { id: "2", user_id: "a", tanggal: "2026-06-01", clock_in: "2026-06-01T01:00:00Z", clock_out: "2026-06-01T02:00:00Z" },
      { id: "3", user_id: "b", tanggal: "2026-06-01", clock_in: "2026-06-01T01:00:00Z", clock_out: "2026-06-01T11:00:00Z" },
    ];
    const res = aggregateByUser(rows, people);
    // Ani (b) = 10 jam, Budi (a) = 3 jam, Citra (c) = 0 -> Citra terakhir
    expect(res.map((r) => r.id)).toEqual(["b", "a", "c"]);
    const budi = res.find((r) => r.id === "a")!;
    expect(budi.days.map((d) => d.tanggal)).toEqual(["2026-06-01", "2026-06-02"]);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- attendance`
Expected: FAIL — `aggregateByUser is not a function` / export tidak ada.

- [ ] **Step 3: Implementasi minimal**

Tambahkan di akhir `src/lib/attendance.ts`:

```typescript
export type AttendanceDay = {
  id: string;
  tanggal: string;
  clock_in: string | null;
  clock_out: string | null;
};

export type RekapOrang = {
  id: string;
  nama: string;
  hariHadir: number;
  totalMs: number;
  days: AttendanceDay[];
};

/** Agregasi baris attendance menjadi ringkasan per orang.
 *  Semua orang di `people` selalu muncul (termasuk yang 0 hari). */
export function aggregateByUser(
  rows: (AttendanceDay & { user_id: string })[],
  people: { id: string; nama: string }[],
): RekapOrang[] {
  const byUser = new Map<string, AttendanceDay[]>();
  for (const r of rows) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push({ id: r.id, tanggal: r.tanggal, clock_in: r.clock_in, clock_out: r.clock_out });
    byUser.set(r.user_id, arr);
  }
  const result = people.map((p) => {
    const days = (byUser.get(p.id) ?? [])
      .slice()
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    return {
      id: p.id,
      nama: p.nama,
      hariHadir: days.filter((d) => d.clock_in).length,
      totalMs: sumWorkedMs(days),
      days,
    };
  });
  result.sort((a, b) => b.totalMs - a.totalMs || a.nama.localeCompare(b.nama));
  return result;
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npm test -- attendance`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attendance.ts src/lib/attendance.test.ts
git commit -m "feat(absensi): helper aggregateByUser untuk rekap bulanan"
```

---

### Task 2: Komponen client `BulanPicker`

**Files:**
- Create: `src/app/(dashboard)/absensi/bulan-picker.tsx`

**Interfaces:**
- Produces: `function BulanPicker({ bulan }: { bulan: string }): JSX.Element` — input `type="month"`, saat berubah navigasi ke `/absensi?bulan=<value>`.
- Consumes: `useRouter` (next/navigation), komponen `Label`/`Input` (`@/components/ui/*`).

- [ ] **Step 1: Buat komponen**

Buat `src/app/(dashboard)/absensi/bulan-picker.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function BulanPicker({ bulan }: { bulan: string }) {
  const router = useRouter();
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="bulan">Bulan</Label>
        <Input
          id="bulan"
          type="month"
          defaultValue={bulan}
          onChange={(e) => {
            const v = e.target.value;
            if (v) router.push(`/absensi?bulan=${v}`);
          }}
          className="h-9 w-full rounded-lg sm:w-auto"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: tidak ada error baru terkait file ini.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/absensi/bulan-picker.tsx"
git commit -m "feat(absensi): komponen BulanPicker (pilih bulan via URL)"
```

---

### Task 3: Komponen client `RekapPerOrang`

**Files:**
- Create: `src/app/(dashboard)/absensi/rekap-per-orang.tsx`

**Interfaces:**
- Consumes: `RekapOrang` (`@/lib/attendance` dari Task 1), `formatDuration` (`@/lib/rekap`), `workedMs` (`@/lib/attendance`).
- Produces: `function RekapPerOrang({ data }: { data: RekapOrang[] }): JSX.Element`.

- [ ] **Step 1: Buat komponen**

Buat `src/app/(dashboard)/absensi/rekap-per-orang.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatDuration } from "@/lib/rekap";
import { workedMs, type RekapOrang, type AttendanceDay } from "@/lib/attendance";

function jam(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function tgl(d: string): string {
  return new Date(d).toLocaleDateString("id-ID");
}

function DetailHarian({ days }: { days: AttendanceDay[] }) {
  if (days.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">Tidak ada catatan bulan ini.</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="px-4 py-2 font-medium">Tanggal</th>
          <th className="px-4 py-2 font-medium">Masuk</th>
          <th className="px-4 py-2 font-medium">Pulang</th>
          <th className="px-4 py-2 font-medium">Durasi</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.id} className="border-t border-border/60">
            <td className="tnum px-4 py-2">{tgl(d.tanggal)}</td>
            <td className="tnum px-4 py-2">{jam(d.clock_in)}</td>
            <td className="tnum px-4 py-2">{jam(d.clock_out)}</td>
            <td className="tnum px-4 py-2">{formatDuration(workedMs(d.clock_in, d.clock_out))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RekapPerOrang({ data }: { data: RekapOrang[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        Belum ada karyawan aktif.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: kartu per orang */}
      <div className="space-y-2 sm:hidden">
        {data.map((o) => {
          const open = openId === o.id;
          return (
            <div key={o.id} className="rounded-xl border border-border bg-card shadow-card">
              <button
                type="button"
                onClick={() => toggle(o.id)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {o.nama}
                </span>
                <span className="tnum text-sm">{o.hariHadir} hari · {formatDuration(o.totalMs)}</span>
              </button>
              {open && <div className="border-t border-border"><DetailHarian days={o.days} /></div>}
            </div>
          );
        })}
      </div>

      {/* Desktop: tabel */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-card sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Nama</th>
              <th className="px-4 py-2.5">Hari hadir</th>
              <th className="px-4 py-2.5">Total jam</th>
            </tr>
          </thead>
          <tbody>
            {data.map((o) => {
              const open = openId === o.id;
              return (
                <FragmentRow key={o.id} o={o} open={open} onToggle={() => toggle(o.id)} />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FragmentRow({ o, open, onToggle }: { o: RekapOrang; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="cursor-pointer border-t border-border hover:bg-accent/40" onClick={onToggle}>
        <td className="px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {o.nama}
          </span>
        </td>
        <td className="tnum px-4 py-2.5">{o.hariHadir}</td>
        <td className="tnum px-4 py-2.5">{formatDuration(o.totalMs)}</td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={3} className="p-0">
            <DetailHarian days={o.days} />
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: tidak ada error baru terkait file ini.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/absensi/rekap-per-orang.tsx"
git commit -m "feat(absensi): komponen RekapPerOrang (tabel + expand rincian)"
```

---

### Task 4: Integrasi ke halaman Absensi

**Files:**
- Modify: `src/app/(dashboard)/absensi/page.tsx`

**Interfaces:**
- Consumes: `aggregateByUser` (Task 1), `BulanPicker` (Task 2), `RekapPerOrang` (Task 3), `listAttendance` (`@/lib/attendance-data`), `createClient` (`@/lib/supabase/server`), `wibToday`.

- [ ] **Step 1: Tambah import**

Di `src/app/(dashboard)/absensi/page.tsx`, perbarui baris import:

```tsx
import { getTodayAttendance, getOpenAttendance, listAttendance } from "@/lib/attendance-data";
import { attendanceState, workedMs, sumWorkedMs, aggregateByUser } from "@/lib/attendance";
import { BulanPicker } from "./bulan-picker";
import { RekapPerOrang } from "./rekap-per-orang";
```

- [ ] **Step 2: Tambah helper rentang bulan terpilih**

Tepat di bawah fungsi `monthRange()` yang ada, tambahkan:

```tsx
function isBulan(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}$/.test(s);
}
function rangeForBulan(bulan: string) {
  const from = `${bulan}-01`;
  const today = wibToday();
  if (bulan === today.slice(0, 7)) return { from, to: today };
  const [y, m] = bulan.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // m 1-based -> hari 0 bulan berikutnya = hari terakhir bulan ini
  return { from, to: `${bulan}-${String(lastDay).padStart(2, "0")}` };
}
```

- [ ] **Step 3: Terima `searchParams` & resolusi bulan terpilih**

Ubah signature & awal fungsi `AbsensiPage`:

```tsx
export default async function AbsensiPage({
  searchParams,
}: { searchParams: Promise<{ bulan?: string }> }) {
  const profile = await requireProfile();
  const canViewAll = profile.role === "owner" || profile.role === "hrd";
  const { from, to } = monthRange();

  const sp = await searchParams;
  const bulan = isBulan(sp.bulan) ? sp.bulan : wibToday().slice(0, 7);
  const rekapRange = rangeForBulan(bulan);
```

- [ ] **Step 4: Query data rekap (owner/HRD) secara paralel**

Ganti blok `Promise.all` yang ada menjadi:

```tsx
  const supabase = await createClient();
  const [open, todayRow, rows, profsRes, rekapRowsRaw, aktifRes] = await Promise.all([
    getOpenAttendance(profile.id),
    getTodayAttendance(profile.id),
    listAttendance(from, to, canViewAll ? undefined : profile.id),
    supabase.from("profiles").select("id, nama"),
    canViewAll ? listAttendance(rekapRange.from, rekapRange.to) : Promise.resolve([]),
    canViewAll
      ? supabase.from("profiles").select("id, nama").eq("aktif", true).order("nama")
      : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
  ]);
```

Lalu, setelah baris `const namaById = ...` yang ada, tambahkan agregasi:

```tsx
  const rekap = canViewAll
    ? aggregateByUser(rekapRowsRaw, (aktifRes.data ?? []) as { id: string; nama: string }[])
    : [];
```

- [ ] **Step 5: Render section baru**

Tepat sebelum penutup `</div>` terluar (setelah `</section>` daftar harian yang ada), tambahkan:

```tsx
      {canViewAll && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle>Rekap per karyawan</SectionTitle>
            <BulanPicker bulan={bulan} />
          </div>
          <RekapPerOrang data={rekap} />
        </section>
      )}
```

- [ ] **Step 6: Typecheck & test**

Run: `npx tsc --noEmit && npm test -- attendance`
Expected: tidak ada error TS; test attendance PASS.

- [ ] **Step 7: Build (verifikasi akhir)**

Run: `npm run build`
Expected: build sukses tanpa error.

- [ ] **Step 8: Verifikasi manual**

- Login sebagai owner/HRD → buka `/absensi`, scroll ke "Rekap per karyawan".
- Pastikan semua karyawan aktif muncul, terurut total jam desc, yang 0 hari di bawah.
- Klik baris → rincian harian muncul; klik lagi → tutup.
- Ganti bulan via picker → URL jadi `?bulan=YYYY-MM`, data ikut berubah; section lama tetap "bulan ini".
- Login sebagai editor → section "Rekap per karyawan" tidak muncul.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(dashboard)/absensi/page.tsx"
git commit -m "feat(absensi): section rekap per karyawan per bulan (owner/HRD)"
```

---

## Self-Review

- **Spec coverage:** bentuk tabel per orang (Task 3) ✓; penempatan section baru + pemilih bulan (Task 4 Step 5, Task 2) ✓; akses owner/HRD (Task 4 `canViewAll`) ✓; semua karyawan aktif termasuk 0 hari (Task 1 `aggregateByUser` + query `aktif`) ✓; hari hadir = clock_in not null (Task 1) ✓; total jam via sumWorkedMs (Task 1) ✓; urut total jam desc lalu nama (Task 1) ✓; drill-down rincian harian (Task 3) ✓; default bulan berjalan + validasi (Task 4 Step 2-3) ✓; section lama tetap "bulan ini" (Task 4 tak mengubah `rows`) ✓.
- **Placeholder scan:** tidak ada TBD/TODO; semua step berisi kode lengkap.
- **Type consistency:** `RekapOrang`/`AttendanceDay` didefinisikan Task 1, dipakai sama persis di Task 3 & 4; `aggregateByUser(rows, people)` argumen konsisten; `BulanPicker({ bulan })` & `RekapPerOrang({ data })` cocok dengan pemanggilan di Task 4.
