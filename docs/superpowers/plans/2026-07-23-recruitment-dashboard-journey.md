# Recruitment Dashboard — Journey, Tren Mingguan & Milestone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gabungkan analitik Journey (funnel + konversi), Tren Mingguan 8 minggu, dan Milestone Agent editable ke dalam tab Dashboard `/recruitment`, memakai data live Supabase.

**Architecture:** Tiga helper murni baru di `lib/recruitment.ts` menghitung Journey/Weekly dari field yang sudah ada. Satu migrasi menambah 3 kolom milestone; satu server action `updateMilestone` menyimpannya. `dashboard-view.tsx` dirombak jadi satu dashboard scroll dengan 5 section (2 lama + 3 baru), Milestone-nya editable via action.

**Tech Stack:** Next.js 16.2.6 (App Router, Server Actions), React 19, Supabase (`recruitment_candidates`), Recharts, Tailwind + shadcn, sonner (toast), Vitest.

## Global Constraints

- **Next.js 16 punya breaking changes** — baca `node_modules/next/dist/docs/` yang relevan (Server Actions) sebelum menulis action. (`AGENTS.md`)
- Halaman dibatasi role `owner` + `hrd` (`page.tsx` → `requireRole`).
- `DashboardView` menerima list yang **sudah ter-filter Jalur** (`filtered`) — jangan filter jalur lagi di dalam komponen.
- Styling pakai token app: panel `rounded-2xl border border-border/70 bg-card p-5 shadow-card`, heading `font-display text-base tracking-tight`, bar `bg-brand` / `bg-brand-muted/40`.
- Warna seri konsisten: sea-green `#2e8b57`, blue `#2c6fb3`, amber `#b7791f`, purple `#8e44ad`.
- Port semantik HTML: fungsi Journey memakai `(maxReached || 1) >= idx` (bukan `?? 0`), sesuai `renderJourney` di prototipe.

---

### Task 1: Migrasi DB + perluasan tipe milestone

**Files:**
- Create: `supabase/migrations/0015_recruitment_milestones.sql`
- Modify: `src/lib/recruitment.ts` (type `Candidate` ~L56-98, `CandidateRow` ~L101-143, `rowToCandidate` ~L147-191)

**Interfaces:**
- Produces: `Candidate.msFirstOffice: string`, `Candidate.msAAJI: string`, `Candidate.msFirstClosing: string`; kolom DB `ms_first_office`, `ms_aaji`, `ms_first_closing` (date, nullable).

- [ ] **Step 1: Tulis migrasi**

Create `supabase/migrations/0015_recruitment_milestones.sql`:

```sql
-- Kolom milestone agent untuk tab Dashboard (Journey → Milestone Agent).
-- Diisi manual oleh owner/hrd lewat tabel editable. Nullable, tanpa perubahan RLS
-- (policy update recruitment_candidates yang ada sudah mencakup owner + hrd).
alter table public.recruitment_candidates
  add column if not exists ms_first_office date,
  add column if not exists ms_aaji date,
  add column if not exists ms_first_closing date;
```

- [ ] **Step 2: Jalankan migrasi**

Run: `npm run db:migrate`
Expected: migrasi `0015` teraplikasi tanpa error (kolom baru muncul di `recruitment_candidates`).

- [ ] **Step 3: Tambah field di type `Candidate`**

Di `src/lib/recruitment.ts`, di dalam `export type Candidate = { ... }`, tepat setelah `contractLink: string;`, tambahkan:

```ts
  msFirstOffice: string;
  msAAJI: string;
  msFirstClosing: string;
```

- [ ] **Step 4: Tambah field di type `CandidateRow`**

Di `export type CandidateRow = { ... }`, tepat setelah `contract_link: string | null;`, tambahkan:

```ts
  ms_first_office: string | null;
  ms_aaji: string | null;
  ms_first_closing: string | null;
```

- [ ] **Step 5: Map di `rowToCandidate`**

Di `rowToCandidate`, tepat setelah `contractLink: s(r.contract_link),`, tambahkan:

```ts
    msFirstOffice: s(r.ms_first_office),
    msAAJI: s(r.ms_aaji),
    msFirstClosing: s(r.ms_first_closing),
```

- [ ] **Step 6: Perbarui fixture test**

Di `src/lib/recruitment.test.ts`, di dalam factory `cand()` (objek default), tambahkan setelah baris yang memuat `contractLink` / field terakhir sebelum `...over`:

```ts
  msFirstOffice: "", msAAJI: "", msFirstClosing: "",
```

(Jika tidak yakin barisnya, tambahkan di mana saja dalam literal objek default `cand()` sebelum `...over`.)

- [ ] **Step 7: Typecheck & test**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (tidak ada error tipe; test lama tetap hijau).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0015_recruitment_milestones.sql src/lib/recruitment.ts src/lib/recruitment.test.ts
git commit -m "feat(recruitment): kolom milestone agent + perluasan tipe Candidate"
```

---

### Task 2: Helper murni Journey / Weekly / Milestone (TDD)

**Files:**
- Modify: `src/lib/recruitment.ts` (tambah fungsi + konstanta)
- Test: `src/lib/recruitment.test.ts`

**Interfaces:**
- Consumes: `Candidate`, `Stage`, `STAGES`, `stageIndex`, `stageLabel`, `daysBetween` (sudah ada di file).
- Produces:
  - `mondayOf(dateStr: string): string`
  - `weekLabel(mondayStr: string): string`
  - `officeDate(c: Candidate): string`
  - `journeyFunnel(cands: Candidate[]): { stage: Stage; label: string; count: number; pctTop: number; pctPrev: number; width: number }[]`
  - `journeySummary(cands: Candidate[]): { total: number; aktif: number; diundang: number; office: number; showRate: number; agent: number; convAll: number }`
  - `weeklyTrend(cands: Candidate[]): { key: string; label: string; masuk: number; interview: number; office: number }[]`

- [ ] **Step 1: Tulis test yang gagal**

Di `src/lib/recruitment.test.ts`, tambahkan import berikut ke blok `import { ... } from "@/lib/recruitment";`:

```ts
  mondayOf,
  officeDate,
  journeyFunnel,
  journeySummary,
  weeklyTrend,
```

Lalu tambahkan di akhir file:

```ts
describe("mondayOf", () => {
  it("mengembalikan Senin dari minggu tanggal (UTC-safe)", () => {
    expect(mondayOf("2026-07-23")).toBe("2026-07-20"); // Kamis → Senin 20 Jul
    expect(mondayOf("2026-07-20")).toBe("2026-07-20"); // Senin tetap
    expect(mondayOf("2026-07-19")).toBe("2026-07-13"); // Minggu → Senin sebelumnya
  });
  it("string kosong → kosong", () => {
    expect(mondayOf("")).toBe("");
  });
});

describe("officeDate", () => {
  it("prioritas msFirstOffice > joinDate > stageSince/interviewAt", () => {
    expect(officeDate(cand({ msFirstOffice: "2026-07-01", joinDate: "2026-07-05" }))).toBe("2026-07-01");
    expect(officeDate(cand({ joinDate: "2026-07-05" }))).toBe("2026-07-05");
    expect(
      officeDate(cand({ stage: "onboarding", maxReached: 6, stageSince: "2026-07-10", interviewAt: "" })),
    ).toBe("2026-07-10");
  });
  it("belum sampai onboarding & tak ada tanggal → kosong", () => {
    expect(officeDate(cand({ stage: "screening", maxReached: 1, joinDate: "" }))).toBe("");
  });
});

describe("journeyFunnel", () => {
  it("6 tahap screening→agent dengan pctTop & pctPrev", () => {
    const cs = [
      cand({ maxReached: 1 }), // screening
      cand({ maxReached: 3 }), // interview_hr2
      cand({ maxReached: 7 }), // agent
    ];
    const f = journeyFunnel(cs);
    expect(f.map((r) => r.stage)).toEqual([
      "screening", "interview_hr", "interview_hr2", "interview_alfred", "onboarding", "agent",
    ]);
    expect(f[0].count).toBe(3); // semua maxReached>=1
    expect(f[0].pctTop).toBe(100);
    expect(f[0].pctPrev).toBe(100);
    expect(f[5].count).toBe(1); // hanya yang maxReached>=7
  });
});

describe("journeySummary", () => {
  it("menghitung total/diundang/office/agent + rate", () => {
    const cs = [
      cand({ maxReached: 1, outcome: "active" }),
      cand({ maxReached: 5, outcome: "active" }), // >= interview_alfred(5) & onboarding? idx onboarding=6 → tidak
      cand({ maxReached: 7, outcome: "agent_aktif" }),
    ];
    const s = journeySummary(cs);
    expect(s.total).toBe(3);
    expect(s.aktif).toBe(2);
    expect(s.agent).toBe(1);
    expect(s.convAll).toBe(33); // round(1/3*100)
  });
});

describe("weeklyTrend", () => {
  it("mengelompokkan masuk/interview/office per minggu (maks 8)", () => {
    const t = weeklyTrend([
      cand({ dateIn: "2026-07-20", interviewAt: "2026-07-22T13:00", stage: "interview_hr", maxReached: 3 }),
      cand({ dateIn: "2026-07-21" }),
    ]);
    const wk = t.find((w) => w.key === "2026-07-20");
    expect(wk).toBeTruthy();
    expect(wk!.masuk).toBe(2);
    expect(wk!.interview).toBe(1);
    expect(t.length).toBeLessThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npm test -- recruitment`
Expected: FAIL (mis. `mondayOf is not a function` / import tidak ditemukan).

- [ ] **Step 3: Implementasi helper**

Di `src/lib/recruitment.ts`, tambahkan di akhir file (setelah `bestSource`):

```ts
// ---- Journey / Weekly / Milestone (port dari prototipe HTML) ----

// Senin dari minggu tanggal, UTC-safe (mirip addDays: pakai UTC agar tak geser TZ).
export function mondayOf(dateStr: string): string {
  const ds = (dateStr || "").slice(0, 10);
  if (!ds) return "";
  const d = new Date(ds + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  const wd = (d.getUTCDay() + 6) % 7; // 0 = Senin
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}

export function weekLabel(mondayStr: string): string {
  if (!mondayStr) return "";
  return new Date(mondayStr + "T00:00:00Z").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

// Tanggal "datang ke kantor": msFirstOffice → joinDate → (stageSince/interviewAt bila ≥ onboarding).
export function officeDate(c: Candidate): string {
  const io = stageIndex("onboarding");
  const d = (s: string) => (s || "").slice(0, 10);
  return (
    d(c.msFirstOffice) ||
    d(c.joinDate) ||
    ((c.maxReached || 1) >= io ? d(c.stageSince) || d(c.interviewAt) : "")
  );
}

const JOURNEY_STAGES: Stage[] = [
  "screening",
  "interview_hr",
  "interview_hr2",
  "interview_alfred",
  "onboarding",
  "agent",
];

export function journeyFunnel(
  cands: Candidate[],
): { stage: Stage; label: string; count: number; pctTop: number; pctPrev: number; width: number }[] {
  const idxs = JOURNEY_STAGES.map((k) => stageIndex(k));
  const counts = idxs.map((i) => cands.filter((c) => (c.maxReached || 1) >= i).length);
  const top = counts[0] || 1;
  return JOURNEY_STAGES.map((k, i) => {
    const count = counts[i];
    const pctTop = Math.round((count / top) * 100);
    const pctPrev = i === 0 ? 100 : counts[i - 1] ? Math.round((count / counts[i - 1]) * 100) : 0;
    const width = Math.max(5, Math.round((count / top) * 100));
    return { stage: k, label: stageLabel(k), count, pctTop, pctPrev, width };
  });
}

export function journeySummary(cands: Candidate[]): {
  total: number;
  aktif: number;
  diundang: number;
  office: number;
  showRate: number;
  agent: number;
  convAll: number;
} {
  const reached = (i: number) => cands.filter((c) => (c.maxReached || 1) >= i).length;
  const total = reached(stageIndex("screening"));
  const diundang = reached(stageIndex("interview_alfred"));
  const office = reached(stageIndex("onboarding"));
  const agent = reached(stageIndex("agent"));
  const aktif = cands.filter((c) => c.outcome === "active").length;
  const showRate = diundang ? Math.round((office / diundang) * 100) : 0;
  const convAll = total ? Math.round((agent / total) * 100) : 0;
  return { total, aktif, diundang, office, showRate, agent, convAll };
}

export function weeklyTrend(
  cands: Candidate[],
): { key: string; label: string; masuk: number; interview: number; office: number }[] {
  const weeks: Record<string, { masuk: number; interview: number; office: number }> = {};
  const bump = (m: string, key: "masuk" | "interview" | "office") => {
    if (!m) return;
    weeks[m] = weeks[m] || { masuk: 0, interview: 0, office: 0 };
    weeks[m][key]++;
  };
  cands.forEach((c) => bump(mondayOf(c.dateIn), "masuk"));
  cands.forEach((c) => {
    if (c.interviewAt) bump(mondayOf(c.interviewAt), "interview");
  });
  cands.forEach((c) => {
    const od = officeDate(c);
    if (od) bump(mondayOf(od), "office");
  });
  return Object.keys(weeks)
    .sort()
    .slice(-8)
    .map((key) => ({ key, label: weekLabel(key), ...weeks[key] }));
}
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npm test -- recruitment`
Expected: PASS (semua test baru + lama hijau).

- [ ] **Step 5: Commit**

```bash
git add src/lib/recruitment.ts src/lib/recruitment.test.ts
git commit -m "feat(recruitment): helper journeyFunnel/journeySummary/weeklyTrend + test"
```

---

### Task 3: Server action `updateMilestone`

**Files:**
- Modify: `src/app/(dashboard)/recruitment/actions.ts`

**Interfaces:**
- Consumes: `getRow`, `withHistory`, `jakartaToday`, `TABLE`, `Result`, `requireRole`, `createClient`, `revalidatePath` (sudah ada di file).
- Produces: `updateMilestone(id: string, field: string, value: string): Promise<Result>` (di-import Task 4).

- [ ] **Step 1: Tambah action**

Di `src/app/(dashboard)/recruitment/actions.ts`, tambahkan setelah fungsi `updateCandidate` (sekitar L199):

```ts
const MS_COLS = new Set(["ms_first_office", "ms_aaji", "ms_first_closing", "join_date"]);
const MS_LABEL: Record<string, string> = {
  ms_first_office: "Pertama ke Kantor",
  ms_aaji: "Lisensi AAJI",
  ms_first_closing: "Closing Pertama",
  join_date: "Join / Kontrak",
};

export async function updateMilestone(
  id: string,
  field: string,
  value: string,
): Promise<Result> {
  await requireRole("owner", "hrd");
  if (!MS_COLS.has(field)) return { ok: false, error: "Kolom tidak valid." };
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: "Format tanggal salah." };
  const row = await getRow(id);
  if (!row) return { ok: false, error: "Kandidat tidak ditemukan." };
  const patch: Record<string, unknown> = {
    [field]: value || null,
    last_updated: jakartaToday(),
    history: withHistory(row.history, `Milestone: ${MS_LABEL[field]} = ${value || "-"}`),
  };
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (tidak ada error; `requireRole`, `Result`, `getRow`, dll. sudah di-import di file).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/recruitment/actions.ts"
git commit -m "feat(recruitment): action updateMilestone (guard owner/hrd + whitelist kolom)"
```

---

### Task 4: Rombak `dashboard-view.tsx` (3 section baru)

**Files:**
- Modify (ganti isi): `src/app/(dashboard)/recruitment/dashboard-view.tsx`

**Interfaces:**
- Consumes: `journeyFunnel`, `journeySummary`, `weeklyTrend`, `officeDate`, `funnelData`, `sourceBreakdown`, `bestSource`, `stageIndex`, `stageLabel`, `daysBetween`, `type Candidate` (dari `@/lib/recruitment`); `StatCard` (`@/components/ui-kit`); `updateMilestone` (`./actions`).

- [ ] **Step 1: Ganti seluruh isi `dashboard-view.tsx`**

Tulis ulang `src/app/(dashboard)/recruitment/dashboard-view.tsx` menjadi:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { StatCard } from "@/components/ui-kit";
import {
  funnelData,
  sourceBreakdown,
  bestSource,
  journeyFunnel,
  journeySummary,
  weeklyTrend,
  daysBetween,
  stageIndex,
  stageLabel,
  type Candidate,
} from "@/lib/recruitment";
import { updateMilestone } from "./actions";

const PIE_COLORS = ["#2e8b57", "#2c6fb3", "#b7791f", "#8e44ad", "#16a085", "#d35400", "#7f8c8d"];
const SERIES = { masuk: "#2c6fb3", interview: "#b7791f", office: "#8e44ad" };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="mb-4 font-display text-base tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function MilestoneRow({ c }: { c: Candidate }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (field: string, value: string) => {
    start(async () => {
      const r = await updateMilestone(c.id, field, value);
      if (r.ok) {
        toast.success("Milestone tersimpan");
        router.refresh();
      } else {
        toast.error(r.error ?? "Gagal menyimpan");
      }
    });
  };
  const leadN =
    c.joinDate && c.msFirstClosing ? daysBetween(c.joinDate, c.msFirstClosing) : NaN;
  const lead = Number.isNaN(leadN) ? "–" : `${leadN} hari`;
  const dateInput = (field: string, val: string) => (
    <input
      type="date"
      defaultValue={val}
      disabled={pending}
      onChange={(e) => save(field, e.target.value)}
      className="rounded-md border border-border/70 bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
    />
  );
  return (
    <tr className="border-t border-border/60">
      <td className="py-2 pr-3">
        <div className="font-medium">{c.name}</div>
        <div className="text-[11px] text-muted-foreground">{stageLabel(c.stage)}</div>
      </td>
      <td className="px-2 py-2">{dateInput("ms_first_office", c.msFirstOffice)}</td>
      <td className="px-2 py-2">{dateInput("join_date", c.joinDate)}</td>
      <td className="px-2 py-2">{dateInput("ms_aaji", c.msAAJI)}</td>
      <td className="px-2 py-2">{dateInput("ms_first_closing", c.msFirstClosing)}</td>
      <td className="px-2 py-2 text-xs text-muted-foreground">{lead}</td>
    </tr>
  );
}

export function DashboardView({ candidates }: { candidates: Candidate[] }) {
  const visible = candidates.filter((c) => !c.archived);
  const activePipe = visible.filter((c) => c.outcome === "active").length;
  const talent = visible.filter((c) => c.outcome === "talent_pool").length;
  const fail = visible.filter((c) => c.outcome === "tidak_lolos").length;
  const agent = visible.filter((c) => c.outcome === "agent_aktif").length;

  const funnel = funnelData(visible);
  const by = sourceBreakdown(visible);
  const pieData = Object.entries(by)
    .filter(([, v]) => v.t > 0)
    .map(([name, v]) => ({ name, value: v.t }));

  const jf = journeyFunnel(visible);
  const js = journeySummary(visible);
  const trend = weeklyTrend(visible);

  const io = stageIndex("onboarding");
  const milestoneRows = visible.filter(
    (c) =>
      c.outcome !== "tidak_lolos" &&
      c.outcome !== "talent_pool" &&
      ((c.maxReached || 1) >= io || c.stage === "agent" || c.stage === "onboarding"),
  );

  return (
    <div className="space-y-5">
      {/* 1. KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Kandidat" value={visible.length} />
        <StatCard label="Aktif di Pipeline" value={activePipe} emphasis />
        <StatCard label="Talent Pool" value={talent} />
        <StatCard label="Tidak Lolos" value={fail} />
        <StatCard label="Agent Aktif" value={agent} emphasis />
        <StatCard label="Source Terbaik" value={bestSource(visible)} />
      </div>

      {/* 2. Funnel lama + Source */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Funnel & Conversion Rate per Tahap">
          <div className="space-y-2">
            {funnel.map((row, i) => (
              <div key={row.stage} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-right text-xs font-medium text-muted-foreground">
                  {row.label}
                </div>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-brand-muted/40">
                  <div
                    className="h-full rounded-md bg-brand transition-all"
                    style={{ width: `${row.width}%`, minWidth: 2 }}
                  />
                </div>
                <div className="w-24 shrink-0 text-xs text-muted-foreground">
                  {row.count} org{i > 0 ? ` · ${row.conv}%` : ""}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Kandidat per Source">
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">Belum ada data.</p>
          )}
        </Panel>
      </div>

      {/* 3. Journey — Funnel & Konversi */}
      <Panel title="Journey Kandidat — Funnel & Konversi">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total masuk pipeline" value={js.total} />
          <StatCard label="Masih aktif diproses" value={js.aktif} emphasis />
          <StatCard label="Diundang ke kantor" value={js.diundang} />
          <StatCard label="Datang ke kantor" value={js.office} hint={`${js.showRate}% dari diundang`} />
          <StatCard label="Jadi Agent" value={js.agent} emphasis />
          <StatCard label="Konversi Screening→Agent" value={`${js.convAll}%`} />
        </div>
        <div className="space-y-2">
          {jf.map((row, i) => (
            <div key={row.stage} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-right text-xs font-medium text-muted-foreground">
                {row.label}
              </div>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-brand-muted/40">
                <div
                  className="flex h-full items-center rounded-md bg-brand px-2 text-[11px] font-semibold text-white transition-all"
                  style={{ width: `${row.width}%`, minWidth: 24 }}
                >
                  {row.count}
                </div>
              </div>
              <div className="w-56 shrink-0 text-xs text-muted-foreground">
                {row.pctTop}% dari awal
                {i > 0 ? ` · ${row.pctPrev}% lanjut dari tahap sebelumnya` : ""}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* 4. Tren Mingguan */}
      <Panel title="Tren Mingguan (8 minggu terakhir)">
        {trend.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar name="Masuk (Screening)" dataKey="masuk" fill={SERIES.masuk} radius={[3, 3, 0, 0]} />
              <Bar name="Interview terjadwal" dataKey="interview" fill={SERIES.interview} radius={[3, 3, 0, 0]} />
              <Bar name="Datang ke kantor" dataKey="office" fill={SERIES.office} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">Belum ada data mingguan.</p>
        )}
      </Panel>

      {/* 5. Milestone Agent */}
      <Panel title="Milestone Agent (sudah onboarding)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Agent</th>
                <th className="px-2 pb-2 font-medium">Pertama ke Kantor</th>
                <th className="px-2 pb-2 font-medium">Join / Kontrak</th>
                <th className="px-2 pb-2 font-medium">Lisensi AAJI</th>
                <th className="px-2 pb-2 font-medium">Closing Pertama</th>
                <th className="px-2 pb-2 font-medium">Join→Closing</th>
              </tr>
            </thead>
            <tbody>
              {milestoneRows.length ? (
                milestoneRows.map((c) => <MilestoneRow key={c.id} c={c} />)
              ) : (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-muted-foreground">
                    Belum ada agent/onboarding. Baris muncul otomatis saat kandidat mencapai tahap
                    Onboarding/Agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Isi tanggal langsung di kolom — tersimpan otomatis. Kolom “Join→Closing” dihitung otomatis.
        </p>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Verifikasi manual di app**

Run: `npm run dev` lalu buka `http://localhost:3000/recruitment` → tab **Dashboard**.
Expected:
- 5 section tampil: KPI, Funnel+Source, Journey (6 kartu + funnel), Tren Mingguan (grouped bar), Milestone (tabel).
- Ganti filter Jalur di subbar → angka Journey/Weekly/Milestone ikut berubah.
- Isi salah satu input tanggal di Milestone → toast "Milestone tersimpan"; refresh halaman → nilai tetap ada.
- Kolom Join→Closing terisi "N hari" saat Join & Closing Pertama keduanya diisi.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/recruitment/dashboard-view.tsx"
git commit -m "feat(recruitment): tab Dashboard — Journey funnel, Tren Mingguan, Milestone editable"
```

---

## Self-Review

**Spec coverage:**
- Section 1-2 (KPI, Funnel, Source) dipertahankan → Task 4 Step 1. ✓
- Journey Funnel + jKPI → `journeyFunnel`/`journeySummary` (Task 2) + render (Task 4). ✓
- Tren Mingguan → `weeklyTrend` (Task 2) + BarChart (Task 4). ✓
- Milestone editable → kolom DB (Task 1) + `updateMilestone` (Task 3) + tabel (Task 4). ✓
- Migrasi + tipe + mapping → Task 1. ✓
- Helper murni + unit test → Task 2. ✓
- Hormati filter Jalur → `candidates` (=`filtered`) dipakai apa adanya, hanya buang archived. ✓
- Next.js 16 docs → Global Constraints + Task 3 catatan. ✓

**Placeholder scan:** Tidak ada TBD/TODO; semua step berisi kode/perintah lengkap. ✓

**Type consistency:** `updateMilestone(id, field, value)` konsisten Task 3 ↔ Task 4. Field DB (`ms_first_office`, `ms_aaji`, `ms_first_closing`, `join_date`) konsisten migrasi ↔ action whitelist ↔ input `save()`. Property `Candidate` (`msFirstOffice/msAAJI/msFirstClosing`) konsisten Task 1 ↔ Task 4. Return `journeySummary` (`total/aktif/diundang/office/showRate/agent/convAll`) konsisten Task 2 ↔ render. ✓
