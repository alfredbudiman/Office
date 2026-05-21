# Fase 4 — Absensi (Clock In/Out + Rekap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modul absensi: setiap karyawan bisa Clock In & Clock Out (sekali per hari), melihat status hari ini, dan rekap jam kerja per periode. Owner & HRD melihat absensi semua orang; karyawan melihat dirinya sendiri.

**Architecture:** Tabel `attendance` (1 baris per user per tanggal) di Supabase dengan RLS (lihat sendiri; owner/HRD lihat semua; tulis hanya milik sendiri). Logika murni (status absen hari ini, hitung durasi kerja) di `src/lib/attendance.ts` (TDD), reuse `formatDuration` dari `src/lib/rekap.ts`. Aksi clock in/out lewat Server Actions ber-RLS. Tampilan pakai design system (`PageHeader`, `StatCard`, tokens, lucide).

**Tech Stack:** Next.js 16 App Router + TS, Supabase + RLS, Tailwind v4 + shadcn + Framer Motion + lucide, Vitest. Migrasi via `npm run db:migrate` (DATABASE_URL sudah ada).

## Prasyarat
Fase 1-3 selesai. `profiles` (role owner/editor/hrd) + `is_owner()` ada. Menu `/absensi` sudah ada di sidebar semua role (Fase 1). `formatDuration(ms)` ada di `src/lib/rekap.ts`.

## File Structure (Fase 4)
| File | Tanggung jawab |
|------|----------------|
| `supabase/migrations/0003_attendance.sql` | Tabel attendance + RLS + helper viewer |
| `src/lib/attendance.ts` | Status absen + durasi kerja (murni) |
| `src/lib/attendance.test.ts` | Test |
| `src/lib/attendance-data.ts` | Query: absen hari ini + daftar periode |
| `src/app/(dashboard)/absensi/actions.ts` | Server actions clockIn/clockOut |
| `src/app/(dashboard)/absensi/clock-card.tsx` | Kartu tombol Clock In/Out (client) |
| `src/app/(dashboard)/absensi/page.tsx` | Halaman absensi (kartu + rekap) |

---

## Task 1: Skema attendance

**Files:** Create `supabase/migrations/0003_attendance.sql`

- [ ] **Step 1: Tulis migration**

Create `supabase/migrations/0003_attendance.sql`:
```sql
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tanggal date not null default current_date,
  clock_in timestamptz,
  clock_out timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, tanggal)
);

create index on public.attendance (tanggal);
create index on public.attendance (user_id, tanggal);

-- owner & hrd boleh lihat semua absensi
create or replace function public.can_view_all_attendance()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'hrd') and aktif = true
  );
$$;

alter table public.attendance enable row level security;

create policy "att_select" on public.attendance for select
  using (user_id = auth.uid() or public.can_view_all_attendance());
create policy "att_insert" on public.attendance for insert
  with check (user_id = auth.uid());
create policy "att_update" on public.attendance for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Terapkan**

Run: `npm run db:migrate -- supabase/migrations/0003_attendance.sql`
Expected: `OK: migrasi diterapkan: supabase/migrations/0003_attendance.sql`

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0003_attendance.sql
git commit -m "feat: attendance schema + RLS (self write, owner/hrd view all)"
```

---

## Task 2: Logika absensi (TDD, murni)

**Files:** Create `src/lib/attendance.ts`, Test `src/lib/attendance.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `src/lib/attendance.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { attendanceState, workedMs, sumWorkedMs, type AttendanceLite } from "@/lib/attendance";

describe("attendanceState", () => {
  it("null / tanpa clock_in -> belum masuk", () => {
    expect(attendanceState(null)).toBe("not_in");
    expect(attendanceState({ clock_in: null, clock_out: null })).toBe("not_in");
  });
  it("clock_in tanpa clock_out -> sedang bekerja", () => {
    expect(attendanceState({ clock_in: "2026-01-01T08:00:00Z", clock_out: null })).toBe("working");
  });
  it("clock_in & clock_out -> selesai", () => {
    expect(attendanceState({ clock_in: "2026-01-01T08:00:00Z", clock_out: "2026-01-01T17:00:00Z" })).toBe("done");
  });
});

describe("workedMs", () => {
  it("selisih clock_out - clock_in", () => {
    expect(workedMs("2026-01-01T08:00:00Z", "2026-01-01T17:00:00Z")).toBe(9 * 3600000);
  });
  it("null bila belum clock_out", () => {
    expect(workedMs("2026-01-01T08:00:00Z", null)).toBeNull();
  });
});

describe("sumWorkedMs", () => {
  it("jumlahkan durasi yang sudah selesai, abaikan yang belum", () => {
    const rows: AttendanceLite[] = [
      { clock_in: "2026-01-01T08:00:00Z", clock_out: "2026-01-01T12:00:00Z" }, // 4j
      { clock_in: "2026-01-02T08:00:00Z", clock_out: "2026-01-02T11:00:00Z" }, // 3j
      { clock_in: "2026-01-03T08:00:00Z", clock_out: null },                    // diabaikan
    ];
    expect(sumWorkedMs(rows)).toBe(7 * 3600000);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm test -- attendance`
Expected: FAIL — "Cannot find module '@/lib/attendance'".

- [ ] **Step 3: Implementasi**

Create `src/lib/attendance.ts`:
```ts
export type AttendanceLite = { clock_in: string | null; clock_out: string | null };
export type AttendanceState = "not_in" | "working" | "done";

export function attendanceState(row: AttendanceLite | null): AttendanceState {
  if (!row || !row.clock_in) return "not_in";
  if (!row.clock_out) return "working";
  return "done";
}

export function workedMs(clockIn: string | null, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  return new Date(clockOut).getTime() - new Date(clockIn).getTime();
}

export function sumWorkedMs(rows: AttendanceLite[]): number {
  return rows.reduce((acc, r) => acc + (workedMs(r.clock_in, r.clock_out) ?? 0), 0);
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npm test -- attendance`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/attendance.ts src/lib/attendance.test.ts
git commit -m "feat: attendance logic (state, worked duration) with tests"
```

---

## Task 3: Lapisan data absensi

**Files:** Create `src/lib/attendance-data.ts`

- [ ] **Step 1: Implementasi**

Create `src/lib/attendance-data.ts`:
```ts
import { createClient } from "@/lib/supabase/server";

export type AttendanceRow = {
  id: string; user_id: string; tanggal: string;
  clock_in: string | null; clock_out: string | null;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayAttendance(userId: string): Promise<AttendanceRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("id, user_id, tanggal, clock_in, clock_out")
    .eq("user_id", userId)
    .eq("tanggal", todayStr())
    .maybeSingle();
  return (data as AttendanceRow) ?? null;
}

// RLS otomatis: karyawan dapat barisnya sendiri; owner/HRD dapat semua.
export async function listAttendance(from: string, to: string, userId?: string): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("attendance")
    .select("id, user_id, tanggal, clock_in, clock_out")
    .gte("tanggal", from)
    .lte("tanggal", to)
    .order("tanggal", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  return (data ?? []) as AttendanceRow[];
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add src/lib/attendance-data.ts
git commit -m "feat: attendance data layer (today + period list)"
```

---

## Task 4: Server actions clock in/out

**Files:** Create `src/app/(dashboard)/absensi/actions.ts`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/absensi/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance } from "@/lib/attendance-data";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function clockIn() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const existing = await getTodayAttendance(profile.id);
  const now = new Date().toISOString();

  if (!existing) {
    const { error } = await supabase
      .from("attendance")
      .insert({ user_id: profile.id, tanggal: todayStr(), clock_in: now });
    if (error) return { ok: false, error: error.message };
  } else if (!existing.clock_in) {
    const { error } = await supabase.from("attendance").update({ clock_in: now }).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    return { ok: false, error: "Sudah clock in hari ini" };
  }
  revalidatePath("/absensi");
  return { ok: true };
}

export async function clockOut() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const existing = await getTodayAttendance(profile.id);
  if (!existing || !existing.clock_in) return { ok: false, error: "Belum clock in" };
  if (existing.clock_out) return { ok: false, error: "Sudah clock out hari ini" };

  const { error } = await supabase
    .from("attendance")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/absensi");
  return { ok: true };
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/absensi/actions.ts"
git commit -m "feat: clock in/out server actions"
```

---

## Task 5: Kartu Clock In/Out (client)

**Files:** Create `src/app/(dashboard)/absensi/clock-card.tsx`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/absensi/clock-card.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { clockIn, clockOut } from "./actions";
import { Button } from "@/components/ui/button";
import type { AttendanceState } from "@/lib/attendance";

export function ClockCard({
  state,
  clockInLabel,
  clockOutLabel,
}: {
  state: AttendanceState;
  clockInLabel: string | null;
  clockOutLabel: string | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [now] = useState(() =>
    new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-6 shadow-card"
    >
      <p className="text-sm text-muted-foreground">{now}</p>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Masuk</p>
          <p className="tnum text-2xl font-semibold tracking-tight">{clockInLabel ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pulang</p>
          <p className="tnum text-2xl font-semibold tracking-tight">{clockOutLabel ?? "—"}</p>
        </div>
        <div className="ml-auto">
          {state === "not_in" && (
            <Button size="lg" disabled={pending} onClick={() => run(clockIn, "Berhasil clock in")}>
              <LogIn className="mr-2 h-4 w-4" /> Clock In
            </Button>
          )}
          {state === "working" && (
            <Button size="lg" variant="secondary" disabled={pending} onClick={() => run(clockOut, "Berhasil clock out")}>
              <LogOut className="mr-2 h-4 w-4" /> Clock Out
            </Button>
          )}
          {state === "done" && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Absen hari ini selesai
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/absensi/clock-card.tsx"
git commit -m "feat: clock in/out card component"
```

---

## Task 6: Halaman Absensi

**Files:** Create `src/app/(dashboard)/absensi/page.tsx`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/absensi/page.tsx`:
```tsx
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance, listAttendance } from "@/lib/attendance-data";
import { attendanceState, workedMs, sumWorkedMs } from "@/lib/attendance";
import { formatDuration } from "@/lib/rekap";
import { PageHeader, StatCard, SectionTitle } from "@/components/ui-kit";
import { ClockCard } from "./clock-card";

function jam(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

export default async function AbsensiPage() {
  const profile = await requireProfile();
  const canViewAll = profile.role === "owner" || profile.role === "hrd";
  const { from, to } = monthRange();

  const today = await getTodayAttendance(profile.id);
  const rows = await listAttendance(from, to, canViewAll ? undefined : profile.id);

  // Nama untuk kolom (viewer lihat banyak orang)
  const supabase = await createClient();
  const { data: profs } = await supabase.from("profiles").select("id, nama");
  const namaById = new Map((profs ?? []).map((p: { id: string; nama: string }) => [p.id, p.nama]));

  const myRows = rows.filter((r) => r.user_id === profile.id);
  const myTotal = sumWorkedMs(myRows);

  return (
    <div className="space-y-6">
      <PageHeader title="Absensi" description="Clock in / clock out & rekap jam kerja bulan ini." />

      <ClockCard
        state={attendanceState(today)}
        clockInLabel={jam(today?.clock_in ?? null)}
        clockOutLabel={jam(today?.clock_out ?? null)}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Hari tercatat (bulan ini)" value={myRows.length} />
        <StatCard label="Total jam kerja (bulan ini)" value={formatDuration(myTotal)} emphasis />
      </div>

      <section className="space-y-3">
        <SectionTitle>{canViewAll ? "Rekap semua karyawan (bulan ini)" : "Rekap saya (bulan ini)"}</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Tanggal</th>
                {canViewAll && <th className="px-4 py-2.5">Nama</th>}
                <th className="px-4 py-2.5">Masuk</th>
                <th className="px-4 py-2.5">Pulang</th>
                <th className="px-4 py-2.5">Durasi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-accent/40">
                  <td className="tnum px-4 py-2.5">{new Date(r.tanggal).toLocaleDateString("id-ID")}</td>
                  {canViewAll && <td className="px-4 py-2.5">{namaById.get(r.user_id) ?? "—"}</td>}
                  <td className="tnum px-4 py-2.5">{jam(r.clock_in) ?? "—"}</td>
                  <td className="tnum px-4 py-2.5">{jam(r.clock_out) ?? "—"}</td>
                  <td className="tnum px-4 py-2.5">{formatDuration(workedMs(r.clock_in, r.clock_out))}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={canViewAll ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">Belum ada data absensi bulan ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi**

Run: `npm run build`
Expected: build sukses, route `/absensi` muncul.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/absensi/page.tsx"
git commit -m "feat: attendance page (clock card + monthly recap, role-aware)"
```

---

## Task 7: Verifikasi live

**Files:** Create `scripts/verify-absensi.mjs`

- [ ] **Step 1: Skrip**

Create `scripts/verify-absensi.mjs`:
```js
// Verifikasi RLS & clock in/out absensi. Jalankan:
//   node --experimental-websocket --env-file=.env.local scripts/verify-absensi.mjs
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);
let fail = 0;
const check = (n, c, d) => { console.log(`${c ? "PASS" : "FAIL"}: ${n}${d ? " — " + d : ""}`); if (!c) fail++; };

const mk = async (role) => {
  const email = `t-abs-${role}-${crypto.randomBytes(3).toString("hex")}@example.com`;
  const pw = "Pw-" + crypto.randomBytes(6).toString("base64url");
  const { data } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { nama: role, role } });
  const cli = createClient(url, anon, opts);
  await cli.auth.signInWithPassword({ email, password: pw });
  return { id: data.user.id, cli };
};
const A = await mk("editor");
const B = await mk("editor");

const today = new Date().toISOString().slice(0, 10);
// A clock in (insert own)
let r = await A.cli.from("attendance").insert({ user_id: A.id, tanggal: today, clock_in: new Date().toISOString() });
check("editor A clock in (own insert)", !r.error, r.error?.message);
// B tidak bisa lihat absensi A (RLS)
const bSees = await B.cli.from("attendance").select("id").eq("user_id", A.id);
check("editor B TIDAK lihat absensi A (RLS)", (bSees.data?.length ?? 0) === 0, "rows=" + bSees.data?.length);
// B tidak bisa insert untuk A
const bHack = await B.cli.from("attendance").insert({ user_id: A.id, tanggal: today, clock_in: new Date().toISOString() });
check("editor B TIDAK bisa absen atas nama A", !!bHack.error, "err=" + (bHack.error?.message ?? "tidak ada (BAHAYA)"));

// cleanup (admin)
await admin.from("attendance").delete().eq("user_id", A.id);
await admin.from("attendance").delete().eq("user_id", B.id);
await admin.auth.admin.deleteUser(A.id);
await admin.auth.admin.deleteUser(B.id);
console.log(`\n${fail === 0 ? "SEMUA LULUS ✅" : fail + " GAGAL ❌"}`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Jalankan**

Run: `node --experimental-websocket --env-file=.env.local scripts/verify-absensi.mjs`
Expected: SEMUA LULUS ✅.

- [ ] **Step 3: Commit**
```bash
git add scripts/verify-absensi.mjs
git commit -m "test: live verification of attendance RLS"
```

---

## Self-Review (penulis)
- Clock in/out (1×/hari) → tabel unique(user_id,tanggal) + actions (Task 1,4) + kartu (Task 5). ✅
- Rekap jam kerja per periode → listAttendance + sumWorkedMs + formatDuration + tabel (Task 2,3,6). ✅
- Karyawan lihat diri; owner/HRD lihat semua → RLS `can_view_all_attendance()` + `canViewAll` di page (Task 1,6); diuji Task 7. ✅
- Reuse `formatDuration` dari rekap.ts (DRY). ✅
- Placeholder: tidak ada. Type consistency: `AttendanceLite`/`AttendanceState`/`attendanceState`/`workedMs`/`sumWorkedMs`/`AttendanceRow`/`getTodayAttendance`/`listAttendance`/`clockIn`/`clockOut` konsisten.

## Di luar cakupan
- Lokasi/GPS, foto selfie, jam kerja shift, izin/cuti formal — tidak termasuk (sesuai "simpel").
- Filter periode kustom di UI (default: bulan berjalan). Bisa ditambah seperti pola filter rekap bila perlu.
