# Fase 3 — Stok Konten + Rekap Kinerja Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman Stok Konten (jumlah konten Final siap tayang per tipe + sebaran isi pipeline) dan Rekap Kinerja (jumlah selesai per tipe + kecepatan mulai→final & lama per tahap, dengan filter rentang tanggal/editor/tipe + export CSV) untuk owner.

**Architecture:** Perhitungan (hitung stok, sebaran pipeline, durasi total & per-tahap, rata-rata) adalah modul logika murni yang di-TDD penuh (`src/lib/stock.ts`, `src/lib/rekap.ts`). Halaman adalah Server Component yang membaca data via Supabase (RLS; owner-only via `requireRole`), memanggil fungsi murni untuk agregasi, lalu merender. "Selesai" = status mencapai `final` (pakai `final_at`). Stok siap tayang = `status='final' AND sudah_tayang=false`. Filter rekap lewat URL search params; export CSV via Route Handler.

**Tech Stack:** Next.js 16 App Router + TypeScript, Supabase, Tailwind v4 + shadcn/ui + Framer Motion, Vitest.

## Prasyarat
Fase 1 & 2 selesai. Tabel `videos` (punya `tipe`, `status`, `editor_id`, `final_at`, `sudah_tayang`, `created_at`) dan `status_events` (`status_baru`, `created_at`, `video_id`) ada + RLS. `listVideos()`/`listEditors()` ada di `src/lib/videos.ts`. Menu owner sudah punya `/stok` dan `/rekap` (Fase 1).

## File Structure (Fase 3)

| File | Tanggung jawab |
|------|----------------|
| `src/lib/stock.ts` | Hitung stok siap tayang per tipe + sebaran pipeline (murni) |
| `src/lib/stock.test.ts` | Test stok |
| `src/lib/rekap.ts` | Durasi total, durasi per-tahap, rata-rata, format (murni) |
| `src/lib/rekap.test.ts` | Test rekap |
| `src/lib/rekap-data.ts` | Query: video selesai dalam rentang + events |
| `src/app/(dashboard)/stok/page.tsx` | Halaman stok konten |
| `src/app/(dashboard)/rekap/page.tsx` | Halaman rekap (server, baca searchParams) |
| `src/app/(dashboard)/rekap/rekap-filter.tsx` | Form filter (client) |
| `src/app/(dashboard)/rekap/export/route.ts` | Export CSV |

---

## Task 1: Logika stok (TDD, murni)

**Files:**
- Create: `src/lib/stock.ts`
- Test: `src/lib/stock.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `src/lib/stock.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { stockReadyByType, pipelineByStatus, type StockVideo } from "@/lib/stock";

const v = (tipe: string, status: string, sudah_tayang = false): StockVideo =>
  ({ tipe: tipe as StockVideo["tipe"], status: status as StockVideo["status"], sudah_tayang });

describe("stockReadyByType", () => {
  it("hitung video final yang belum tayang per tipe", () => {
    const res = stockReadyByType([
      v("monolog", "final"), v("monolog", "final"), v("monolog", "final", true),
      v("shorts", "final"), v("shorts", "editing"),
    ]);
    expect(res.monolog).toBe(2); // 2 final belum tayang (1 sudah tayang tak dihitung)
    expect(res.shorts).toBe(1);
    expect(res.podcast).toBe(0);
    expect(res.clipping).toBe(0);
  });
});

describe("pipelineByStatus", () => {
  it("hitung jumlah video per status", () => {
    const res = pipelineByStatus([
      v("monolog", "editing"), v("shorts", "editing"), v("monolog", "review_draft"),
    ]);
    expect(res.editing).toBe(2);
    expect(res.review_draft).toBe(1);
    expect(res.draft_brief).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm test -- stock`
Expected: FAIL — "Cannot find module '@/lib/stock'".

- [ ] **Step 3: Implementasi**

Create `src/lib/stock.ts`:
```ts
import { STATUS_ORDER, type VideoStatus, type VideoType } from "@/lib/video-workflow";

export type StockVideo = { tipe: VideoType; status: VideoStatus; sudah_tayang: boolean };

const TYPES: VideoType[] = ["monolog", "podcast", "shorts", "clipping"];

export function stockReadyByType(videos: StockVideo[]): Record<VideoType, number> {
  const out = { monolog: 0, podcast: 0, shorts: 0, clipping: 0 } as Record<VideoType, number>;
  for (const v of videos) {
    if (v.status === "final" && !v.sudah_tayang) out[v.tipe]++;
  }
  return out;
}

export function pipelineByStatus(videos: StockVideo[]): Record<VideoStatus, number> {
  const out = {} as Record<VideoStatus, number>;
  for (const s of STATUS_ORDER) out[s] = 0;
  for (const v of videos) out[v.status]++;
  return out;
}

export const STOCK_TYPES = TYPES;
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npm test -- stock`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/stock.ts src/lib/stock.test.ts
git commit -m "feat: stock computation (ready-by-type, pipeline) with tests"
```

---

## Task 2: Logika rekap (TDD, murni)

**Files:**
- Create: `src/lib/rekap.ts`
- Test: `src/lib/rekap.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `src/lib/rekap.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  totalDurationMs, average, formatDuration, stageDurationsMs,
  type EventLite,
} from "@/lib/rekap";

describe("totalDurationMs", () => {
  it("selisih created -> final dalam ms", () => {
    expect(totalDurationMs("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(86400000);
  });
  it("null bila belum final", () => {
    expect(totalDurationMs("2026-01-01T00:00:00Z", null)).toBeNull();
  });
});

describe("average", () => {
  it("rata-rata abaikan null", () => {
    expect(average([100, 200, null, 300])).toBe(200);
  });
  it("null bila kosong", () => {
    expect(average([null, null])).toBeNull();
  });
});

describe("formatDuration", () => {
  it("format hari & jam", () => {
    expect(formatDuration(90000000)).toBe("1 hari 1 jam"); // 25 jam
  });
  it("format jam & menit untuk < 1 hari", () => {
    expect(formatDuration(3 * 3600000 + 30 * 60000)).toBe("3 jam 30 menit");
  });
  it("strip nol", () => {
    expect(formatDuration(2 * 86400000)).toBe("2 hari");
  });
  it("null -> tanda strip", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("stageDurationsMs", () => {
  it("hitung lama tiap status dari created + events (loop revisi dijumlahkan)", () => {
    // created di jam 0 (draft_brief), masuk editing jam 1, review_draft jam 2,
    // editing lagi jam 3 (revisi), review_draft jam 4, final jam 5.
    const base = "2026-01-01T0";
    const events: EventLite[] = [
      { status_baru: "editing", created_at: base + "1:00:00Z" },
      { status_baru: "review_draft", created_at: base + "2:00:00Z" },
      { status_baru: "editing", created_at: base + "3:00:00Z" },
      { status_baru: "review_draft", created_at: base + "4:00:00Z" },
      { status_baru: "final", created_at: base + "5:00:00Z" },
    ];
    const res = stageDurationsMs("draft_brief", base + "0:00:00Z", events);
    expect(res.draft_brief).toBe(3600000); // jam 0->1
    expect(res.editing).toBe(2 * 3600000); // (1->2) + (3->4)
    expect(res.review_draft).toBe(2 * 3600000); // (2->3) + (4->5)
    expect(res.final ?? 0).toBe(0); // status terakhir tak punya durasi
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm test -- rekap`
Expected: FAIL — "Cannot find module '@/lib/rekap'".

- [ ] **Step 3: Implementasi**

Create `src/lib/rekap.ts`:
```ts
import type { VideoStatus } from "@/lib/video-workflow";

export type EventLite = { status_baru: VideoStatus; created_at: string };

export function totalDurationMs(createdAt: string, finalAt: string | null): number | null {
  if (!finalAt) return null;
  return new Date(finalAt).getTime() - new Date(createdAt).getTime();
}

export function average(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalMin = Math.round(ms / 60000);
  const hari = Math.floor(totalMin / 1440);
  const jam = Math.floor((totalMin % 1440) / 60);
  const menit = totalMin % 60;
  const parts: string[] = [];
  if (hari) parts.push(`${hari} hari`);
  if (jam) parts.push(`${jam} jam`);
  if (!hari && menit) parts.push(`${menit} menit`);
  return parts.length ? parts.join(" ") : "0 menit";
}

// Lama (ms) yang dihabiskan di tiap status, dari createdAt + daftar event transisi.
// Status yang dikunjungi berulang (loop revisi) dijumlahkan.
export function stageDurationsMs(
  initialStatus: VideoStatus,
  createdAt: string,
  events: EventLite[]
): Partial<Record<VideoStatus, number>> {
  const timeline: { status: VideoStatus; at: number }[] = [
    { status: initialStatus, at: new Date(createdAt).getTime() },
    ...events.map((e) => ({ status: e.status_baru, at: new Date(e.created_at).getTime() })),
  ];
  const out: Partial<Record<VideoStatus, number>> = {};
  for (let i = 0; i < timeline.length - 1; i++) {
    const dur = timeline[i + 1].at - timeline[i].at;
    const s = timeline[i].status;
    out[s] = (out[s] ?? 0) + dur;
  }
  return out;
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npm test -- rekap`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/rekap.ts src/lib/rekap.test.ts
git commit -m "feat: rekap computation (durations, average, stage timing) with tests"
```

---

## Task 3: Halaman Stok Konten

**Files:**
- Create: `src/app/(dashboard)/stok/page.tsx`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/stok/page.tsx`:
```tsx
import { requireRole } from "@/lib/auth";
import { listVideos } from "@/lib/videos";
import { stockReadyByType, pipelineByStatus, STOCK_TYPES, type StockVideo } from "@/lib/stock";
import { STATUS_ORDER, STATUS_LABEL, TYPE_LABEL } from "@/lib/video-workflow";
import { Card } from "@/components/ui/card";

export default async function StokPage() {
  await requireRole("owner");
  const videos = await listVideos();
  const sv: StockVideo[] = videos.map((v) => ({ tipe: v.tipe, status: v.status, sudah_tayang: v.sudah_tayang }));
  const ready = stockReadyByType(sv);
  const pipeline = pipelineByStatus(sv);
  const totalReady = STOCK_TYPES.reduce((a, t) => a + ready[t], 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Stok Konten</h1>
        <p className="text-sm text-muted-foreground">Konten Final yang belum tayang & sebaran isi pipeline.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Siap tayang (Final, belum tayang): {totalReady}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STOCK_TYPES.map((t) => (
            <Card key={t} className="p-4">
              <p className="text-sm text-muted-foreground">{TYPE_LABEL[t]}</p>
              <p className="mt-1 text-3xl font-semibold">{ready[t]}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Isi Pipeline (per status)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {STATUS_ORDER.map((s) => (
            <Card key={s} className="p-3">
              <p className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</p>
              <p className="mt-1 text-2xl font-semibold">{pipeline[s]}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi**

Run: `npm run build`
Expected: build sukses, route `/stok` muncul.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/stok/page.tsx"
git commit -m "feat: stock page (ready-by-type + pipeline distribution)"
```

---

## Task 4: Lapisan data rekap

**Files:**
- Create: `src/lib/rekap-data.ts`

- [ ] **Step 1: Implementasi**

Create `src/lib/rekap-data.ts`:
```ts
import { createClient } from "@/lib/supabase/server";
import type { VideoStatus, VideoType } from "@/lib/video-workflow";
import type { EventLite } from "@/lib/rekap";

export type RekapFilter = { from: string; to: string; editorId?: string; tipe?: VideoType };

export type CompletedVideo = {
  id: string; judul: string; tipe: VideoType; editor_id: string | null;
  created_at: string; final_at: string;
};

// Video yang SELESAI (final_at terisi) dalam rentang [from, to] (inklusif harian).
export async function getCompletedVideos(f: RekapFilter): Promise<CompletedVideo[]> {
  const supabase = await createClient();
  let q = supabase
    .from("videos")
    .select("id, judul, tipe, editor_id, created_at, final_at")
    .not("final_at", "is", null)
    .gte("final_at", `${f.from}T00:00:00Z`)
    .lte("final_at", `${f.to}T23:59:59Z`)
    .order("final_at", { ascending: false });
  if (f.editorId) q = q.eq("editor_id", f.editorId);
  if (f.tipe) q = q.eq("tipe", f.tipe);
  const { data } = await q;
  return (data ?? []) as CompletedVideo[];
}

// Event transisi untuk sekumpulan video, dikelompokkan per video_id (urut waktu).
export async function getEventsByVideo(videoIds: string[]): Promise<Map<string, EventLite[]>> {
  const map = new Map<string, EventLite[]>();
  if (videoIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("status_events")
    .select("video_id, status_baru, created_at")
    .in("video_id", videoIds)
    .order("created_at", { ascending: true });
  for (const row of (data ?? []) as { video_id: string; status_baru: VideoStatus; created_at: string }[]) {
    const list = map.get(row.video_id) ?? [];
    list.push({ status_baru: row.status_baru, created_at: row.created_at });
    map.set(row.video_id, list);
  }
  return map;
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add src/lib/rekap-data.ts
git commit -m "feat: rekap data layer (completed videos in range + events)"
```

---

## Task 5: Form filter rekap (client)

**Files:**
- Create: `src/app/(dashboard)/rekap/rekap-filter.tsx`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/rekap/rekap-filter.tsx`:
```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditorOpt = { id: string; nama: string };

export function RekapFilter({ editors, from, to }: { editors: EditorOpt[]; from: string; to: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    sp.set("from", String(fd.get("from")));
    sp.set("to", String(fd.get("to")));
    const editor = String(fd.get("editor") ?? "");
    const tipe = String(fd.get("tipe") ?? "");
    if (editor) sp.set("editor", editor);
    if (tipe) sp.set("tipe", tipe);
    router.push(`/rekap?${sp.toString()}`);
  }

  const exportHref = `/rekap/export?${params.toString()}`;

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor="from">Dari</Label>
        <Input id="from" name="from" type="date" defaultValue={from} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to">Sampai</Label>
        <Input id="to" name="to" type="date" defaultValue={to} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="editor">Editor</Label>
        <select id="editor" name="editor" defaultValue={params.get("editor") ?? ""}
          className="h-9 rounded-md border px-2 text-sm">
          <option value="">Semua</option>
          {editors.map((e) => <option key={e.id} value={e.id}>{e.nama}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tipe">Tipe</Label>
        <select id="tipe" name="tipe" defaultValue={params.get("tipe") ?? ""}
          className="h-9 rounded-md border px-2 text-sm">
          <option value="">Semua</option>
          <option value="monolog">Monolog</option>
          <option value="podcast">Podcast</option>
          <option value="shorts">Shorts</option>
          <option value="clipping">Clipping</option>
        </select>
      </div>
      <Button type="submit">Terapkan</Button>
      <Button asChild variant="secondary" type="button">
        <a href={exportHref}>Export CSV</a>
      </Button>
    </form>
  );
}
```
Catatan: `Button asChild` membungkus `<a>` agar link export tampil sebagai tombol (shadcn mendukung `asChild`). Jika tidak tersedia, ganti dengan `<a className="...">` bergaya tombol.

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/rekap/rekap-filter.tsx"
git commit -m "feat: rekap filter form (date range, editor, type) + export link"
```

---

## Task 6: Halaman Rekap Kinerja

**Files:**
- Create: `src/app/(dashboard)/rekap/page.tsx`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/rekap/page.tsx`:
```tsx
import { requireRole } from "@/lib/auth";
import { listEditors } from "@/lib/videos";
import { createClient } from "@/lib/supabase/server";
import { getCompletedVideos, getEventsByVideo } from "@/lib/rekap-data";
import { totalDurationMs, average, formatDuration, stageDurationsMs } from "@/lib/rekap";
import { initialStatus, STATUS_ORDER, STATUS_LABEL, TYPE_LABEL, type VideoType } from "@/lib/video-workflow";
import { RekapFilter } from "./rekap-filter";
import { Card } from "@/components/ui/card";

function defaultRange() {
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

const TYPES: VideoType[] = ["monolog", "podcast", "shorts", "clipping"];

export default async function RekapPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; editor?: string; tipe?: string }> }) {
  await requireRole("owner");
  const sp = await searchParams;
  const def = defaultRange();
  const from = sp.from ?? def.from;
  const to = sp.to ?? def.to;
  const tipe = (sp.tipe as VideoType | undefined) || undefined;
  const editorId = sp.editor || undefined;

  const editors = await listEditors();
  const videos = await getCompletedVideos({ from, to, editorId, tipe });
  const eventsByVideo = await getEventsByVideo(videos.map((v) => v.id));

  // Jumlah selesai per tipe
  const countByType = { monolog: 0, podcast: 0, shorts: 0, clipping: 0 } as Record<VideoType, number>;
  for (const v of videos) countByType[v.tipe]++;

  // Kecepatan mulai->final
  const totals = videos.map((v) => totalDurationMs(v.created_at, v.final_at));
  const avgTotal = average(totals);

  // Lama per tahap (rata-rata antar video)
  const perStageSums: Partial<Record<string, number>> = {};
  const perStageCounts: Partial<Record<string, number>> = {};
  for (const v of videos) {
    const stages = stageDurationsMs(initialStatus(v.tipe), v.created_at, eventsByVideo.get(v.id) ?? []);
    for (const [s, ms] of Object.entries(stages)) {
      perStageSums[s] = (perStageSums[s] ?? 0) + (ms ?? 0);
      perStageCounts[s] = (perStageCounts[s] ?? 0) + 1;
    }
  }

  // Nama editor
  const supabase = await createClient();
  const { data: profs } = await supabase.from("profiles").select("id, nama");
  const namaById = new Map((profs ?? []).map((p: { id: string; nama: string }) => [p.id, p.nama]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rekap Kinerja</h1>
      <RekapFilter editors={editors} from={from} to={to} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 sm:col-span-2">
          <p className="text-sm text-muted-foreground">Rata-rata mulai → final</p>
          <p className="mt-1 text-2xl font-semibold">{formatDuration(avgTotal)}</p>
        </Card>
        <Card className="p-4 sm:col-span-2">
          <p className="text-sm text-muted-foreground">Total selesai (periode)</p>
          <p className="mt-1 text-2xl font-semibold">{videos.length}</p>
        </Card>
        {TYPES.map((t) => (
          <Card key={t} className="p-4">
            <p className="text-sm text-muted-foreground">Selesai · {TYPE_LABEL[t]}</p>
            <p className="mt-1 text-2xl font-semibold">{countByType[t]}</p>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Rata-rata lama per tahap</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_ORDER.filter((s) => s !== "tayang").map((s) => {
            const avg = perStageCounts[s] ? (perStageSums[s] ?? 0) / perStageCounts[s]! : null;
            return (
              <Card key={s} className="p-3">
                <p className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</p>
                <p className="mt-1 text-sm font-medium">{formatDuration(avg)}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Daftar selesai ({videos.length})</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr><th className="p-2">Judul</th><th className="p-2">Tipe</th><th className="p-2">Editor</th><th className="p-2">Final</th><th className="p-2">Durasi</th></tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2">{v.judul}</td>
                  <td className="p-2">{TYPE_LABEL[v.tipe]}</td>
                  <td className="p-2">{v.editor_id ? namaById.get(v.editor_id) ?? "—" : "—"}</td>
                  <td className="p-2">{new Date(v.final_at).toLocaleDateString("id-ID")}</td>
                  <td className="p-2">{formatDuration(totalDurationMs(v.created_at, v.final_at))}</td>
                </tr>
              ))}
              {videos.length === 0 && <tr><td colSpan={5} className="p-3 text-muted-foreground">Tidak ada data di periode ini.</td></tr>}
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
Expected: build sukses, route `/rekap` muncul.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/rekap/page.tsx"
git commit -m "feat: rekap page (jumlah selesai per type, speed total + per stage, table)"
```

---

## Task 7: Export CSV

**Files:**
- Create: `src/app/(dashboard)/rekap/export/route.ts`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/rekap/export/route.ts`:
```ts
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCompletedVideos, getEventsByVideo } from "@/lib/rekap-data";
import { totalDurationMs } from "@/lib/rekap";
import type { VideoType } from "@/lib/video-workflow";

function csvCell(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  await requireRole("owner");
  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get("from") ?? today;
  const to = url.searchParams.get("to") ?? today;
  const editorId = url.searchParams.get("editor") || undefined;
  const tipe = (url.searchParams.get("tipe") as VideoType | null) || undefined;

  const videos = await getCompletedVideos({ from, to, editorId, tipe });
  void getEventsByVideo; // (events tidak dipakai di CSV ringkas)

  const supabase = await createClient();
  const { data: profs } = await supabase.from("profiles").select("id, nama");
  const namaById = new Map((profs ?? []).map((p: { id: string; nama: string }) => [p.id, p.nama]));

  const header = ["Judul", "Tipe", "Editor", "Dibuat", "Final", "Durasi (jam)"];
  const rows = videos.map((v) => {
    const ms = totalDurationMs(v.created_at, v.final_at);
    const jam = ms === null ? "" : (ms / 3600000).toFixed(1);
    return [
      v.judul, v.tipe, v.editor_id ? namaById.get(v.editor_id) ?? "" : "",
      v.created_at.slice(0, 10), v.final_at.slice(0, 10), jam,
    ].map((c) => csvCell(String(c))).join(",");
  });
  const csv = [header.map(csvCell).join(","), ...rows].join("\r\n");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-${from}_sd_${to}.csv"`,
    },
  });
}
```

- [ ] **Step 2: Verifikasi**

Run: `npm run build`
Expected: build sukses, route `/rekap/export` muncul.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/rekap/export/route.ts"
git commit -m "feat: rekap CSV export route"
```

---

## Task 8: Verifikasi live (data uji)

**Files:**
- Create: `scripts/verify-rekap.mjs`

- [ ] **Step 1: Skrip seed + cek angka**

Create `scripts/verify-rekap.mjs`:
```js
// Verifikasi angka stok & rekap. Jalankan:
//   node --experimental-websocket --env-file=.env.local scripts/verify-rekap.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, secret, { auth: { persistSession: false } });
let fail = 0;
const check = (n, c, d) => { console.log(`${c ? "PASS" : "FAIL"}: ${n}${d ? " — " + d : ""}`); if (!c) fail++; };

const created = new Date(Date.now() - 3 * 86400000).toISOString();
const finalAt = new Date(Date.now() - 1 * 86400000).toISOString();

// 1 monolog final belum tayang (stok), 1 monolog final SUDAH tayang (bukan stok)
const mk = (judul, status, sudah_tayang, final_at) =>
  admin.from("videos").insert({ judul, tipe: "monolog", status, sudah_tayang, created_at: created, final_at }).select("id").single();
const a = await mk("REKAP-A", "final", false, finalAt);
const b = await mk("REKAP-B", "final", true, finalAt);
const ids = [a.data.id, b.data.id];
// event final utk A (untuk per-stage)
await admin.from("status_events").insert({ video_id: a.data.id, status_lama: "review_draft", status_baru: "final", created_at: finalAt });

// Stok ready monolog harus >= 1 (A); B tak dihitung
const ready = await admin.from("videos").select("id").eq("tipe", "monolog").eq("status", "final").eq("sudah_tayang", false);
check("stok monolog final-belum-tayang >= 1", (ready.data?.length ?? 0) >= 1, "count=" + ready.data?.length);

// Selesai dalam 7 hari terakhir mencakup A & B (final_at terisi)
const from = new Date(Date.now() - 7 * 86400000).toISOString();
const done = await admin.from("videos").select("id").not("final_at", "is", null).gte("final_at", from).in("id", ids);
check("2 video selesai terdeteksi di rentang", done.data?.length === 2, "count=" + done.data?.length);

// cleanup
await admin.from("videos").delete().in("id", ids);
console.log(`\n${fail === 0 ? "SEMUA LULUS ✅" : fail + " GAGAL ❌"}`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Jalankan**

Run: `node --experimental-websocket --env-file=.env.local scripts/verify-rekap.mjs`
Expected: SEMUA LULUS ✅.

- [ ] **Step 3: Commit**
```bash
git add scripts/verify-rekap.mjs
git commit -m "test: live verification of stock & rekap counts"
```

---

## Self-Review (oleh penulis)

**Spec coverage (Stok + Rekap):**
- Stok siap tayang per tipe (Final belum tayang) → `stockReadyByType` (Task 1) + page (Task 3). ✅
- Sebaran isi pipeline → `pipelineByStatus` (Task 1) + page (Task 3). ✅
- Rekap jumlah selesai per tipe → page count (Task 6). ✅
- Rekap kecepatan (mulai→final + lama per tahap) → `totalDurationMs`/`stageDurationsMs` (Task 2) + page (Task 6). ✅
- Filter rentang tanggal + editor + tipe → `RekapFilter` (Task 5) + `getCompletedVideos` (Task 4) + page (Task 6). ✅
- Export CSV → Task 7. ✅
- "Selesai" = Final (keputusan) → pakai `final_at`, stok = final & !sudah_tayang. ✅
- Owner-only → `requireRole("owner")` di tiap halaman/route. ✅
- "Cukup berapa hari" (estimasi) — SENGAJA tidak dibuat (keputusan owner). ✅

**Placeholder scan:** tidak ada placeholder; semua step berisi kode konkret.

**Type consistency:** `StockVideo`, `stockReadyByType`/`pipelineByStatus`, `EventLite`, `totalDurationMs`/`average`/`formatDuration`/`stageDurationsMs`, `RekapFilter`/`CompletedVideo`/`getCompletedVideos`/`getEventsByVideo` konsisten lintas task. `VideoType`/`VideoStatus`/`STATUS_ORDER`/`STATUS_LABEL`/`TYPE_LABEL`/`initialStatus` dari Fase 2 dipakai ulang.

## Di luar cakupan Fase 3 (fase lain)
- Estimasi "stok cukup berapa hari" + target posting per tipe — menyusul bila diperlukan.
- Realtime. Absensi (Fase 4).
- Grafik/chart visual — angka dulu; chart bisa ditambah saat poles frontend-design.
