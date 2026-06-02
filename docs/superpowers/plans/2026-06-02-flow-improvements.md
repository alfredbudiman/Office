# Flow Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah 6 perbaikan flow harian — clickable URL di komentar, lompat status (owner), tipe video "Lainnya" + teks custom, default editor (Agus), pengaturan link Drive folder global, dan ringkasan kerja otomatis saat clock out dengan tombol kirim ke WhatsApp Alfred.

**Architecture:** Tetap server-actions (Next.js App Router) + Supabase (RLS). Helper murni di `src/lib/*` (test pakai vitest, env node). Migrasi schema dipecah 2 file karena Postgres `ALTER TYPE ADD VALUE` tidak boleh satu transaksi dengan statement yang memakainya. Pengiriman WA pakai `wa.me/<nomor>?text=<encoded>` di tab baru — zero biaya, zero credential.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (auth + Postgres + RLS), Tailwind v4, Framer Motion, lucide-react, vitest. Migrasi diapply via `npm run db:migrate -- <file>`.

**Spec referensi:** `docs/superpowers/specs/2026-06-02-flow-improvements-design.md`.

---

## File Structure

**Baru:**
- `supabase/migrations/0005_add_lainnya_enum.sql` — 1 statement: `ALTER TYPE`
- `supabase/migrations/0006_flow_improvements.sql` — kolom `videos.tipe_custom` + check constraint, tabel `settings`, kolom `attendance.progress_summary`, kolom `status_events.note`, seed `drive_folder_url`
- `src/lib/linkify.ts` (+ `linkify.test.ts`) — pure function deteksi URL → array of parts
- `src/lib/progress-summary.ts` (+ `progress-summary.test.ts`) — pure formatter pesan WA
- `src/lib/wa.ts` — konstan nomor + helper `waLink`
- `src/lib/settings.ts` — `getSetting()`, `setSetting()`
- `src/app/(dashboard)/pengaturan/page.tsx` + `actions.ts` — halaman owner, simpan `drive_folder_url`
- `src/app/(dashboard)/absensi/clockout-modal.tsx` — preview pesan + tombol WA

**Diubah:**
- `src/lib/roles.ts` — tambah menu "Pengaturan" untuk owner
- `src/lib/video-workflow.ts` — `VideoType` tambah `'lainnya'`, `VideoAction` tambah `'force_set_status'`, helper `typeLabel`
- `src/lib/videos.ts` — `VideoRow.tipe_custom`, semua select include
- `src/lib/stock.ts` — `STOCK_TYPES` include `'lainnya'`
- `src/lib/attendance-data.ts` — `AttendanceRow.progress_summary`, select include
- `src/app/(dashboard)/video/actions.ts` — handle `tipe='lainnya'`, branch `force_set_status` di `applyVideoAction`
- `src/app/(dashboard)/video/new-video-form.tsx` — opsi "Lainnya" + field `tipe_custom`, default editor
- `src/app/(dashboard)/video/[id]/page.tsx` — `typeLabel(video)`, render `event.note` di timeline, oper `isOwner` ke `StatusActions`
- `src/app/(dashboard)/video/[id]/comments.tsx` — pakai `linkify`
- `src/app/(dashboard)/video/[id]/status-actions.tsx` — panel "Ubah status manual" untuk owner
- `src/app/(dashboard)/video/video-board.tsx` — pakai `typeLabel`, chips tambah "Lainnya"
- `src/app/(dashboard)/stok/page.tsx` — baris "Lainnya" di grid
- `src/app/(dashboard)/dashboard/page.tsx` — card "Folder Hasil"
- `src/app/(dashboard)/absensi/actions.ts` — `clockOut(extraNote)`, bangun summary, simpan, return `{ok, summary, role, nama}`
- `src/app/(dashboard)/absensi/clock-card.tsx` — textarea "Catatan tambahan" + trigger modal kalau editor
- `src/components/sidebar.tsx` — terima prop `driveFolderUrl?`, render section bawah
- `src/app/(dashboard)/layout.tsx` — fetch `drive_folder_url`, oper ke `Sidebar`
- `src/lib/video-workflow.test.ts` — extend (force_set_status di-cover di actions.ts test, atau di sini dengan helper kalau ada)

---

## Task 1: Migrasi schema (2 file)

**Files:**
- Create: `supabase/migrations/0005_add_lainnya_enum.sql`
- Create: `supabase/migrations/0006_flow_improvements.sql`

- [ ] **Step 1: Tulis migrasi enum**

`supabase/migrations/0005_add_lainnya_enum.sql`:

```sql
alter type video_type add value if not exists 'lainnya';
```

- [ ] **Step 2: Tulis migrasi schema utama**

`supabase/migrations/0006_flow_improvements.sql`:

```sql
-- videos: kolom tipe_custom + constraint wajib kalau tipe='lainnya'
alter table public.videos add column if not exists tipe_custom text;
alter table public.videos drop constraint if exists videos_tipe_custom_required;
alter table public.videos add constraint videos_tipe_custom_required
  check (tipe <> 'lainnya' or (tipe_custom is not null and char_length(tipe_custom) between 1 and 50));

-- status_events: kolom note (catatan owner saat lompat status)
alter table public.status_events add column if not exists note text;

-- attendance: kolom ringkasan kerja saat clock out
alter table public.attendance add column if not exists progress_summary text;

-- tabel settings (KV global, owner-only write)
create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.settings enable row level security;

drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings for select using (true);

drop policy if exists "settings_write" on public.settings;
create policy "settings_write" on public.settings for all
  using (public.is_owner()) with check (public.is_owner());

-- seed key (value kosong dulu, owner isi via UI)
insert into public.settings (key, value)
  values ('drive_folder_url', '')
  on conflict (key) do nothing;
```

- [ ] **Step 3: Apply migrasi**

```
npm run db:migrate -- supabase/migrations/0005_add_lainnya_enum.sql
npm run db:migrate -- supabase/migrations/0006_flow_improvements.sql
```

Expected: "OK: migrasi diterapkan: ..." dua kali.

- [ ] **Step 4: Verifikasi schema**

Connect ke DB (psql/Supabase SQL editor) atau bikin throwaway script. Cek:
- `select unnest(enum_range(null::video_type));` harus include `lainnya`.
- `\d videos` harus nampilin kolom `tipe_custom` + constraint.
- `\d settings` ada + 1 row `drive_folder_url`.
- `\d attendance` ada kolom `progress_summary`.
- `\d status_events` ada kolom `note`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_add_lainnya_enum.sql supabase/migrations/0006_flow_improvements.sql
git commit -m "feat(db): migrasi enum lainnya, settings, progress_summary, status note"
```

---

## Task 2: `linkify` lib + test

**Files:**
- Create: `src/lib/linkify.ts`
- Create: `src/lib/linkify.test.ts`

- [ ] **Step 1: Tulis failing test**

`src/lib/linkify.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { linkify } from "@/lib/linkify";

describe("linkify", () => {
  it("plain text tanpa URL", () => {
    expect(linkify("halo dunia")).toEqual([{ type: "text", value: "halo dunia" }]);
  });

  it("URL tunggal di tengah", () => {
    expect(linkify("cek https://example.com ya")).toEqual([
      { type: "text", value: "cek " },
      { type: "link", value: "https://example.com" },
      { type: "text", value: " ya" },
    ]);
  });

  it("multiple URLs", () => {
    expect(linkify("a https://x.com b https://y.com c")).toEqual([
      { type: "text", value: "a " },
      { type: "link", value: "https://x.com" },
      { type: "text", value: " b " },
      { type: "link", value: "https://y.com" },
      { type: "text", value: " c" },
    ]);
  });

  it("URL di akhir kalimat dengan titik tidak masuk URL", () => {
    expect(linkify("buka https://example.com.")).toEqual([
      { type: "text", value: "buka " },
      { type: "link", value: "https://example.com" },
      { type: "text", value: "." },
    ]);
  });

  it("www. tanpa scheme", () => {
    expect(linkify("lihat www.google.com")).toEqual([
      { type: "text", value: "lihat " },
      { type: "link", value: "www.google.com" },
    ]);
  });

  it("wa.me link", () => {
    expect(linkify("ping wa.me/628112634321 sekarang")).toEqual([
      { type: "text", value: "ping " },
      { type: "link", value: "wa.me/628112634321" },
      { type: "text", value: " sekarang" },
    ]);
  });

  it("string kosong", () => {
    expect(linkify("")).toEqual([]);
  });

  it("URL invalid tidak jadi link", () => {
    expect(linkify("https://")).toEqual([{ type: "text", value: "https://" }]);
  });

  it("preserve newline", () => {
    expect(linkify("line1\nhttps://x.com\nline3")).toEqual([
      { type: "text", value: "line1\n" },
      { type: "link", value: "https://x.com" },
      { type: "text", value: "\nline3" },
    ]);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- src/lib/linkify.test.ts`
Expected: FAIL (module belum ada).

- [ ] **Step 3: Implement `linkify.ts`**

`src/lib/linkify.ts`:

```ts
export type Part = { type: "text"; value: string } | { type: "link"; value: string };

const URL_RE = /(https?:\/\/[^\s]+|wa\.me\/[^\s]+|www\.[^\s]+)/gi;
const TRAIL_PUNCT = /[.,!?)\]>;:]+$/;

function isValidUrl(raw: string): boolean {
  const candidate = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    const u = new URL(candidate);
    return u.hostname.length > 0 && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function linkify(text: string): Part[] {
  if (!text) return [];
  const parts: Part[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0];
    const start = m.index ?? 0;
    // trim trailing punctuation, kembalikan ke text
    const trailMatch = raw.match(TRAIL_PUNCT);
    const trail = trailMatch ? trailMatch[0] : "";
    const url = trail ? raw.slice(0, raw.length - trail.length) : raw;

    if (!isValidUrl(url)) continue; // biarin URL_RE re-iterate, tapi push raw as text di akhir

    if (start > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, start) });
    }
    parts.push({ type: "link", value: url });
    lastIndex = start + url.length;
    if (trail) {
      parts.push({ type: "text", value: trail });
      lastIndex += trail.length;
    }
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  // gabung text consecutive (jaga-jaga)
  const merged: Part[] = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (last && last.type === "text" && p.type === "text") {
      last.value += p.value;
    } else {
      merged.push(p);
    }
  }
  return merged;
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- src/lib/linkify.test.ts`
Expected: PASS 9/9.

- [ ] **Step 5: Commit**

```bash
git add src/lib/linkify.ts src/lib/linkify.test.ts
git commit -m "feat(lib): linkify helper untuk deteksi URL di teks bebas"
```

---

## Task 3: Render link clickable di komentar

**Files:**
- Modify: `src/app/(dashboard)/video/[id]/comments.tsx`

- [ ] **Step 1: Edit `comments.tsx` — ganti `<p>{c.isi}</p>`**

Ganti import block (tambah `linkify`):

```tsx
import { addComment } from "../actions";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui-kit";
import { linkify } from "@/lib/linkify";
```

Ganti baris 45 (`<p className="text-sm whitespace-pre-wrap text-foreground/80">{c.isi}</p>`) jadi:

```tsx
<p className="text-sm whitespace-pre-wrap text-foreground/80">
  {linkify(c.isi).map((part, i) =>
    part.type === "link" ? (
      <a
        key={i}
        href={part.value.startsWith("http") ? part.value : `https://${part.value}`}
        target="_blank"
        rel="noreferrer"
        className="text-brand underline-offset-2 hover:underline break-all"
      >
        {part.value}
      </a>
    ) : (
      <span key={i}>{part.value}</span>
    ),
  )}
</p>
```

- [ ] **Step 2: Smoke build**

Run: `npm run build`
Expected: build sukses, tidak ada TS error.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/video/[id]/comments.tsx
git commit -m "feat(video): URL di komentar bisa di-klik (auto linkify)"
```

---

## Task 4: `progress-summary` lib + test

**Files:**
- Create: `src/lib/progress-summary.ts`
- Create: `src/lib/progress-summary.test.ts`

- [ ] **Step 1: Tulis failing test**

`src/lib/progress-summary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildProgressSummary } from "@/lib/progress-summary";

const baseTime = new Date("2026-06-02T17:30:00+07:00");

describe("buildProgressSummary", () => {
  it("tanpa aktivitas & tanpa note", () => {
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: baseTime,
      statusMoves: [],
      comments: [],
    });
    expect(s).toContain("Halo, saya Agus");
    expect(s).not.toContain("Yang dikerjakan");
    expect(s).not.toContain("Komentar");
    expect(s).not.toContain("Catatan");
  });

  it("hanya status moves", () => {
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: baseTime,
      statusMoves: [
        { judul: "Ep 1", statusBaru: "review_draft" },
        { judul: "Ep 2", statusBaru: "editing" },
      ],
      comments: [],
    });
    expect(s).toContain("Yang dikerjakan");
    expect(s).toContain("Ep 1 → Review Draft");
    expect(s).toContain("Ep 2 → Editing");
    expect(s).not.toContain("Komentar");
  });

  it("hanya komentar, truncate ke 80 char", () => {
    const long = "x".repeat(120);
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: baseTime,
      statusMoves: [],
      comments: [{ judul: "Ep 1", isi: long }],
    });
    expect(s).toContain("Komentar");
    expect(s).toMatch(/Ep 1:.*x{80}\.\.\./);
    expect(s).not.toContain("x".repeat(81));
  });

  it("status + komentar + extraNote", () => {
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: baseTime,
      statusMoves: [{ judul: "Ep 1", statusBaru: "final" }],
      comments: [{ judul: "Ep 1", isi: "revisi BGM" }],
      extraNote: "lanjut besok",
    });
    expect(s).toContain("Yang dikerjakan");
    expect(s).toContain("Ep 1 → Final");
    expect(s).toContain("Komentar");
    expect(s).toContain("Ep 1: revisi BGM");
    expect(s).toContain("Catatan: lanjut besok");
  });

  it("format jam HH:mm WIB (sesuai clockOutTime)", () => {
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: new Date("2026-06-02T09:05:00+07:00"),
      statusMoves: [], comments: [],
    });
    expect(s).toMatch(/jam 09:05/);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- src/lib/progress-summary.test.ts`
Expected: FAIL (modul belum ada).

- [ ] **Step 3: Implement**

`src/lib/progress-summary.ts`:

```ts
import { STATUS_LABEL, type VideoStatus } from "@/lib/video-workflow";

export type SummaryInput = {
  nama: string;
  clockOutTime: Date;
  statusMoves: { judul: string; statusBaru: VideoStatus }[];
  comments: { judul: string; isi: string }[];
  extraNote?: string;
};

function fmtTime(d: Date): string {
  // Hard-code WIB (UTC+7) supaya konsisten di server tanpa peduli TZ runtime.
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const mm = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

export function buildProgressSummary(i: SummaryInput): string {
  const lines: string[] = [];
  lines.push(`Halo, saya ${i.nama} selesai jam ${fmtTime(i.clockOutTime)}.`);

  if (i.statusMoves.length > 0) {
    lines.push("");
    lines.push("Yang dikerjakan:");
    for (const m of i.statusMoves) {
      lines.push(`• ${m.judul} → ${STATUS_LABEL[m.statusBaru]}`);
    }
  }

  if (i.comments.length > 0) {
    lines.push("");
    lines.push("Komentar:");
    for (const c of i.comments) {
      lines.push(`• ${c.judul}: ${truncate(c.isi)}`);
    }
  }

  if (i.extraNote && i.extraNote.trim()) {
    lines.push("");
    lines.push(`Catatan: ${i.extraNote.trim()}`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- src/lib/progress-summary.test.ts`
Expected: PASS 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress-summary.ts src/lib/progress-summary.test.ts
git commit -m "feat(lib): progress-summary formatter untuk pesan clock out"
```

---

## Task 5: `wa.ts` helper

**Files:**
- Create: `src/lib/wa.ts`

- [ ] **Step 1: Implement helper (tidak perlu test — trivial wrapper)**

`src/lib/wa.ts`:

```ts
export const ALFRED_WA = "628112634321";

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/wa.ts
git commit -m "feat(lib): wa.ts helper (nomor Alfred + waLink)"
```

---

## Task 6: `video-workflow.ts` — type `'lainnya'`, `force_set_status`, `typeLabel` helper

**Files:**
- Modify: `src/lib/video-workflow.ts`
- Modify: `src/lib/video-workflow.test.ts`

- [ ] **Step 1: Tambah test untuk `typeLabel`**

Tambah di akhir `src/lib/video-workflow.test.ts`:

```ts
import { typeLabel } from "@/lib/video-workflow";

describe("typeLabel", () => {
  it("non-lainnya pakai TYPE_LABEL", () => {
    expect(typeLabel({ tipe: "monolog", tipe_custom: null })).toBe("Monolog");
    expect(typeLabel({ tipe: "shorts", tipe_custom: null })).toBe("Shorts");
  });
  it("lainnya pakai tipe_custom", () => {
    expect(typeLabel({ tipe: "lainnya", tipe_custom: "Tutorial" })).toBe("Tutorial");
  });
  it("lainnya tanpa tipe_custom fallback 'Lainnya'", () => {
    expect(typeLabel({ tipe: "lainnya", tipe_custom: null })).toBe("Lainnya");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- src/lib/video-workflow.test.ts`
Expected: FAIL (`typeLabel` belum ada + `'lainnya'` belum di VideoType).

- [ ] **Step 3: Edit `video-workflow.ts`**

Ganti baris 3:

```ts
export type VideoType = "monolog" | "podcast" | "shorts" | "clipping" | "lainnya";
```

Ganti baris 7-9 (VideoAction tambah `force_set_status`):

```ts
export type VideoAction =
  | "start_cut" | "submit_cut" | "approve_cut" | "request_cut_revision"
  | "submit_draft" | "approve_final" | "request_revision" | "mark_tayang"
  | "force_set_status";
```

Tambah `lainnya` ke `TYPE_LABEL`:

```ts
export const TYPE_LABEL: Record<VideoType, string> = {
  monolog: "Monolog",
  podcast: "Podcast",
  shorts: "Shorts",
  clipping: "Clipping",
  lainnya: "Lainnya",
};
```

Tambah `force_set_status` ke `ACTION_LABEL`:

```ts
export const ACTION_LABEL: Record<VideoAction, string> = {
  start_cut: "Mulai Cut-to-Cut",
  submit_cut: "Kirim Cut-to-Cut",
  approve_cut: "Approve Cut",
  request_cut_revision: "Minta Revisi Cut",
  submit_draft: "Kirim Draft",
  approve_final: "Centang Final",
  request_revision: "Minta Revisi",
  mark_tayang: "Tandai Tayang",
  force_set_status: "Ubah status manual",
};
```

`force_set_status` **TIDAK** dimasukkan ke dict `ACTIONS` (typed dengan `from`/`to` konstan). `actionsFor()` tidak perlu diubah — otomatis skip karena loop `Object.keys(ACTIONS)`.

Tambah helper di akhir file:

```ts
export function typeLabel(row: { tipe: VideoType; tipe_custom: string | null }): string {
  if (row.tipe === "lainnya") return row.tipe_custom?.trim() || "Lainnya";
  return TYPE_LABEL[row.tipe];
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- src/lib/video-workflow.test.ts`
Expected: PASS semua (existing + 3 baru untuk `typeLabel`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/video-workflow.ts src/lib/video-workflow.test.ts
git commit -m "feat(workflow): tipe 'lainnya', force_set_status action, typeLabel helper"
```

---

## Task 7: `videos.ts` — `tipe_custom` di tipe & query

**Files:**
- Modify: `src/lib/videos.ts`

- [ ] **Step 1: Edit `VideoRow` type**

Tambah `tipe_custom: string | null` ke `VideoRow` (sebelum `status`):

```ts
export type VideoRow = {
  id: string;
  judul: string;
  tipe: VideoType;
  tipe_custom: string | null;
  status: VideoStatus;
  editor_id: string | null;
  parent_video_id: string | null;
  link_source: string | null;
  target_tayang: string | null;
  sudah_tayang: boolean;
  created_at: string;
  final_at: string | null;
  created_by: string | null;
};
```

- [ ] **Step 2: Tambah `tipe_custom` ke semua `.select(...)`**

`listVideos()` baris 36 — ganti ke:

```ts
.select("id, judul, tipe, tipe_custom, status, editor_id, parent_video_id, link_source, target_tayang, sudah_tayang, created_at, final_at, created_by")
```

`getVideo()` baris 45 — sama persis: tambahkan `tipe_custom` setelah `tipe`.

- [ ] **Step 3: Smoke build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 4: Commit**

```bash
git add src/lib/videos.ts
git commit -m "feat(lib): VideoRow.tipe_custom + include di query"
```

---

## Task 8: `stock.ts` — bucket `'lainnya'`

**Files:**
- Modify: `src/lib/stock.ts`
- Modify: `src/lib/stock.test.ts` (kalau ada test existing, extend; kalau tidak, skip test step)

- [ ] **Step 1: Lihat test existing**

Run: `cat src/lib/stock.test.ts` (kalau ada). Tambah case kalau ada coverage. Kalau tidak ada, lewati ke Step 2.

- [ ] **Step 2: Edit `stock.ts`**

Ganti baris 5:

```ts
const TYPES: VideoType[] = ["monolog", "podcast", "shorts", "clipping", "lainnya"];
```

Ganti baris 8 (init):

```ts
const out = { monolog: 0, podcast: 0, shorts: 0, clipping: 0, lainnya: 0 } as Record<VideoType, number>;
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: semua pass (kalau ada test stok pastikan tetap hijau).

- [ ] **Step 4: Commit**

```bash
git add src/lib/stock.ts src/lib/stock.test.ts
git commit -m "feat(stock): bucket 'lainnya' di stockReadyByType"
```

---

## Task 9: `new-video-form.tsx` — opsi "Lainnya" + default editor

**Files:**
- Modify: `src/app/(dashboard)/video/new-video-form.tsx`

- [ ] **Step 1: State + import**

Tambah state `tipeCustom`:

```tsx
const [tipe, setTipe] = useState("monolog");
const [tipeCustom, setTipeCustom] = useState("");
```

Default editor: ubah baris 18 `useState("monolog")` tetap, lalu pre-select via `defaultValue` di `<select editor_id>` (lihat step 3).

- [ ] **Step 2: Tambah opsi "Lainnya" + field tipe_custom**

Ganti `<select id="tipe" ...>` (baris 44-50) jadi:

```tsx
<select id="tipe" name="tipe" value={tipe} onChange={(e) => setTipe(e.target.value)}
  className="h-9 w-full rounded-md border px-2 text-sm">
  <option value="monolog">Monolog</option>
  <option value="podcast">Podcast</option>
  <option value="shorts">Shorts</option>
  <option value="clipping">Clipping</option>
  <option value="lainnya">Lainnya</option>
</select>
```

Tambah block di bawah block tipe (sebelum block editor), di dalam `<form>`:

```tsx
{tipe === "lainnya" && (
  <div className="space-y-1 sm:col-span-2">
    <Label htmlFor="tipe_custom">Nama tipe</Label>
    <Input
      id="tipe_custom"
      name="tipe_custom"
      value={tipeCustom}
      onChange={(e) => setTipeCustom(e.target.value)}
      placeholder="mis. Behind the scenes, Tutorial, dll"
      maxLength={50}
    />
    {errors.tipe_custom && <p className="text-xs text-red-500">{errors.tipe_custom}</p>}
  </div>
)}
```

- [ ] **Step 3: Default editor (pre-select editor pertama)**

Ganti `<select id="editor_id" ...>` block (baris 53-57) jadi:

```tsx
<div className="space-y-1">
  <Label htmlFor="editor_id">Editor</Label>
  <select
    id="editor_id"
    name="editor_id"
    defaultValue={editors[0]?.id ?? ""}
    className="h-9 w-full rounded-md border px-2 text-sm"
  >
    {editors.map((e) => <option key={e.id} value={e.id}>{e.nama}</option>)}
    <option value="">— belum ditugaskan —</option>
  </select>
</div>
```

(Opsi "belum ditugaskan" dipindah ke bawah supaya editor pertama yang default.)

- [ ] **Step 4: Smoke build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/video/new-video-form.tsx
git commit -m "feat(video-form): opsi 'Lainnya' dengan teks bebas + default editor pertama"
```

---

## Task 10: `video/actions.ts` — `createVideo` validasi `tipe_custom` + `applyVideoAction` branch `force_set_status`

**Files:**
- Modify: `src/app/(dashboard)/video/actions.ts`

- [ ] **Step 1: `createVideo` — validasi & insert `tipe_custom`**

Edit fungsi `createVideo` (baris 17-44):

```ts
export async function createVideo(_prev: unknown, formData: FormData) {
  await requireRole("owner");
  const judul = String(formData.get("judul") ?? "").trim();
  const tipe = String(formData.get("tipe") ?? "") as VideoType;
  const tipeCustomRaw = String(formData.get("tipe_custom") ?? "").trim();
  const editorId = String(formData.get("editor_id") ?? "") || null;
  const linkSource = String(formData.get("link_source") ?? "").trim();
  const parentId = String(formData.get("parent_video_id") ?? "") || null;

  const errors: Record<string, string> = {};
  if (!judul) errors.judul = "Judul wajib diisi";
  if (!["monolog", "podcast", "shorts", "clipping", "lainnya"].includes(tipe)) errors.tipe = "Tipe tidak valid";
  if (tipe === "lainnya" && (!tipeCustomRaw || tipeCustomRaw.length > 50)) {
    errors.tipe_custom = "Nama tipe wajib 1–50 karakter";
  }
  if (linkSource && !isUrl(linkSource)) errors.link_source = "Link harus URL valid";
  if (tipe === "clipping" && !parentId) errors.parent_video_id = "Clipping wajib pilih video induk";
  if (Object.keys(errors).length) return { ok: false, errors };

  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.from("videos").insert({
    judul, tipe,
    tipe_custom: tipe === "lainnya" ? tipeCustomRaw : null,
    status: initialStatus(tipe),
    editor_id: editorId, parent_video_id: parentId,
    link_source: linkSource || null, created_by: profile.id,
  }).select("id").single();
  if (error) return { ok: false, errors: { judul: error.message } };

  if (editorId) await notify(editorId, `Video baru ditugaskan: ${judul}`, `/video/${data.id}`);
  revalidatePath("/video");
  return { ok: true, errors: {}, id: data.id };
}
```

`initialStatus("lainnya")` — perlu cek di workflow: untuk tipe "lainnya", default `draft_brief` (sama seperti non-clipping). Cek `initialStatus` di `video-workflow.ts:62`: `type === "clipping" ? "editing" : "draft_brief"` — sudah benar (lainnya → draft_brief).

- [ ] **Step 2: `applyVideoAction` — branch `force_set_status`**

Tambah import:

```ts
import { STATUS_ORDER, ... } from "@/lib/video-workflow";
```

(`STATUS_ORDER` mungkin sudah implisit via `applyAction` — pastikan import.)

Ganti `applyVideoAction` lengkap (signature tambah `targetStatus?` dan `note?`):

```ts
export async function applyVideoAction(
  videoId: string,
  action: VideoAction,
  link?: string,
  targetStatus?: import("@/lib/video-workflow").VideoStatus,
  note?: string,
) {
  const profile = await requireProfile();
  const video = await getVideo(videoId);
  if (!video) return { ok: false, error: "Video tidak ditemukan" };

  // Branch: force_set_status (owner only)
  if (action === "force_set_status") {
    if (profile.role !== "owner") return { ok: false, error: "Hanya owner yang bisa lompat status" };
    if (!targetStatus || !STATUS_ORDER.includes(targetStatus)) {
      return { ok: false, error: "Status tujuan tidak valid" };
    }
    if (targetStatus === video.status) return { ok: false, error: `Status sudah ${targetStatus}` };
    const trimmedNote = (note ?? "").trim();
    if (trimmedNote.length < 3 || trimmedNote.length > 200) {
      return { ok: false, error: "Catatan wajib 3–200 karakter" };
    }

    const supabase = await createClient();
    const patch: Record<string, unknown> = { status: targetStatus };
    // Side-effects ke/dari final & tayang
    if (targetStatus === "final" && video.status !== "final") {
      patch.final_at = new Date().toISOString();
    }
    if (video.status === "final" && targetStatus !== "final") {
      patch.final_at = null;
    }
    if (targetStatus === "tayang" && video.status !== "tayang") {
      patch.sudah_tayang = true;
      patch.published_at = new Date().toISOString();
    }
    if (video.status === "tayang" && targetStatus !== "tayang") {
      patch.sudah_tayang = false;
      patch.published_at = null;
    }
    const { error: upErr } = await supabase.from("videos").update(patch).eq("id", videoId);
    if (upErr) return { ok: false, error: upErr.message };

    await supabase.from("status_events").insert({
      video_id: videoId,
      status_lama: video.status,
      status_baru: targetStatus,
      changed_by: profile.id,
      note: trimmedNote,
    });

    const counterpart = video.editor_id;
    await notify(counterpart, `Status "${video.judul}" diubah → ${targetStatus} (manual)`, `/video/${videoId}`);

    revalidatePath(`/video/${videoId}`);
    revalidatePath("/video");
    return { ok: true };
  }

  // Jalur normal (existing)
  const def = ACTIONS[action];
  if (!def) return { ok: false, error: "Aksi tidak dikenal" };
  if (def.role !== profile.role) return { ok: false, error: "Anda tidak berhak melakukan aksi ini" };
  if (profile.role === "editor" && video.editor_id !== profile.id) {
    return { ok: false, error: "Bukan video Anda" };
  }
  if (def.requiresLink && (!link || !isUrl(link))) {
    return { ok: false, error: "Link draft harus URL valid" };
  }

  const res = applyAction(video.status, action);
  if (!res.ok) return { ok: false, error: res.error };

  const supabase = await createClient();

  if (def.createsDraft && link) {
    const { count } = await supabase.from("drafts")
      .select("id", { count: "exact", head: true }).eq("video_id", videoId);
    await supabase.from("drafts").insert({
      video_id: videoId, nomor_draft: (count ?? 0) + 1, link_draft: link, created_by: profile.id,
    });
  }

  const patch: Record<string, unknown> = { status: res.to };
  if (res.to === "final") patch.final_at = new Date().toISOString();
  if (res.to === "tayang") { patch.sudah_tayang = true; patch.published_at = new Date().toISOString(); }
  const { error: upErr } = await supabase.from("videos").update(patch).eq("id", videoId);
  if (upErr) return { ok: false, error: upErr.message };

  await supabase.from("status_events").insert({
    video_id: videoId, status_lama: video.status, status_baru: res.to, changed_by: profile.id,
  });

  const counterpart = profile.role === "owner" ? video.editor_id : video.created_by ?? null;
  await notify(counterpart, `Status "${video.judul}" → ${res.to}`, `/video/${videoId}`);

  revalidatePath(`/video/${videoId}`);
  revalidatePath("/video");
  return { ok: true };
}
```

- [ ] **Step 3: Smoke build**

Run: `npm run build`
Expected: sukses (TypeScript happy).

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/video/actions.ts
git commit -m "feat(video): handle tipe lainnya + branch force_set_status (owner)"
```

---

## Task 11: `status-actions.tsx` — panel force_set untuk owner

**Files:**
- Modify: `src/app/(dashboard)/video/[id]/status-actions.tsx`

- [ ] **Step 1: Edit komponen — tambah panel owner**

Ganti seluruh isi `status-actions.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyVideoAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTIONS, ACTION_LABEL, STATUS_ORDER, STATUS_LABEL,
  type VideoAction, type VideoStatus,
} from "@/lib/video-workflow";

export function StatusActions({
  videoId,
  actions,
  isOwner,
  currentStatus,
}: {
  videoId: string;
  actions: VideoAction[];
  isOwner: boolean;
  currentStatus: VideoStatus;
}) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState("");
  const [target, setTarget] = useState<VideoStatus>(currentStatus);
  const [note, setNote] = useState("");
  const router = useRouter();
  const needsLink = actions.some((a) => ACTIONS[a].requiresLink);
  const otherStatuses = STATUS_ORDER.filter((s) => s !== currentStatus);

  function run(action: VideoAction) {
    start(async () => {
      const res = await applyVideoAction(videoId, action, link || undefined);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(ACTION_LABEL[action] + " berhasil");
      setLink("");
      router.refresh();
    });
  }

  function runForce() {
    if (target === currentStatus) {
      toast.error("Pilih status berbeda dulu");
      return;
    }
    start(async () => {
      const res = await applyVideoAction(videoId, "force_set_status", undefined, target, note);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(`Status diubah → ${STATUS_LABEL[target]}`);
      setNote("");
      router.refresh();
    });
  }

  const showNormalCard = actions.length > 0;
  const showForcePanel = isOwner;

  if (!showNormalCard && !showForcePanel) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
        Tidak ada aksi untuk Anda di status ini.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {showNormalCard && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          {needsLink && (
            <div className="mb-3 space-y-1">
              <label className="text-sm font-medium">Link draft / hasil</label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => {
              const danger = a === "request_revision" || a === "request_cut_revision";
              return (
                <Button key={a} disabled={pending} variant={danger ? "secondary" : "default"} onClick={() => run(a)}>
                  {ACTION_LABEL[a]}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {showForcePanel && (
        <details className="rounded-xl border border-dashed border-amber-400/60 bg-amber-50/40 p-4 dark:bg-amber-400/5">
          <summary className="cursor-pointer text-sm font-medium text-amber-700 dark:text-amber-300">
            Ubah status manual (lompat)
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Lompat status — pastikan sengaja. Side-effect untuk Final/Tayang ikut diatur otomatis.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as VideoStatus)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {otherStatuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Alasan singkat (3–200 char)"
              maxLength={200}
            />
            <Button disabled={pending} variant="secondary" onClick={runForce}>
              Ubah status
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update caller di `page.tsx`**

Edit `src/app/(dashboard)/video/[id]/page.tsx` baris 67 — oper props baru:

```tsx
<StatusActions
  videoId={video.id}
  actions={actions}
  isOwner={profile.role === "owner"}
  currentStatus={video.status}
/>
```

- [ ] **Step 3: Smoke build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/video/[id]/status-actions.tsx src/app/(dashboard)/video/[id]/page.tsx
git commit -m "feat(video): panel 'Ubah status manual' untuk owner (force_set_status)"
```

---

## Task 12: Tampilan `typeLabel` di detail/board/stok + timeline note

**Files:**
- Modify: `src/app/(dashboard)/video/[id]/page.tsx`
- Modify: `src/app/(dashboard)/video/video-board.tsx`
- Modify: `src/app/(dashboard)/stok/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Detail page — `typeLabel` + render `event.note` di timeline**

Edit `src/app/(dashboard)/video/[id]/page.tsx`:

Ganti import baris 7:

```ts
import { actionsFor, STATUS_LABEL, typeLabel } from "@/lib/video-workflow";
```

Ganti baris 50 (`{TYPE_LABEL[video.tipe]}`) jadi `{typeLabel(video)}`.

Update query untuk include `note` di `getStatusEvents` — perlu juga edit `videos.ts`:

(Note: `getStatusEvents` di `videos.ts` baris 67-72 select-nya hardcode. Tambah `note` ke select:)

Edit `src/lib/videos.ts` baris 28-29:

```ts
export type StatusEventRow = {
  id: string; status_lama: VideoStatus | null; status_baru: VideoStatus;
  created_at: string; note: string | null;
};
```

Edit `getStatusEvents` select:

```ts
.select("id, status_lama, status_baru, created_at, note")
```

Lalu di `page.tsx` baris 114-119 ganti `<li>` jadi:

```tsx
<li key={e.id} className="relative">
  <span
    className={`absolute -left-[1.3125rem] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
      i === 0 ? "bg-brand" : "bg-muted-foreground/40"
    }`}
  />
  <span className="text-sm font-medium text-foreground">
    {STATUS_LABEL[e.status_baru]}
  </span>
  <span className="block text-xs text-muted-foreground">
    {new Date(e.created_at).toLocaleString("id-ID")}
  </span>
  {e.note && (
    <span className="mt-1 block text-xs italic text-muted-foreground/80">
      "{e.note}"
    </span>
  )}
</li>
```

- [ ] **Step 2: Board — `typeLabel` + chip "Lainnya"**

Edit `src/app/(dashboard)/video/video-board.tsx`:

Ganti import baris 6:

```ts
import { STATUS_ORDER, STATUS_LABEL, TYPE_LABEL, typeLabel, type VideoStatus, type VideoType } from "@/lib/video-workflow";
```

Ganti tipe `Card`:

```ts
type Card = {
  id: string; judul: string; tipe: VideoType; tipe_custom: string | null;
  status: VideoStatus; editorNama: string | null;
};
```

Ganti chip array baris 18:

```tsx
{(["all", "monolog", "podcast", "shorts", "clipping", "lainnya"] as const).map((t) => (
```

Ganti baris 62 `{TYPE_LABEL[c.tipe]}` jadi `{typeLabel(c)}`.

- [ ] **Step 3: Update `video/page.tsx` (board parent) untuk mengirim `tipe_custom`**

Cek file `src/app/(dashboard)/video/page.tsx`. Map ke `cards` perlu include `tipe_custom`. Buka file dulu, lalu tambahkan field di mapping.

Run untuk cek:

```
cat src/app/(dashboard)/video/page.tsx
```

Tambahkan `tipe_custom: v.tipe_custom` di object yang di-map menjadi `Card`.

- [ ] **Step 4: Stok — baris "Lainnya"**

Tidak perlu ubah `src/app/(dashboard)/stok/page.tsx` — kode pakai loop `STOCK_TYPES` yang sudah di-update di Task 8 dan `TYPE_LABEL[t]` yang sudah include `"lainnya": "Lainnya"`. Verifikasi visual saat smoke test.

- [ ] **Step 5: Dashboard — `typeLabel`**

Edit `src/app/(dashboard)/dashboard/page.tsx` baris 4:

```ts
import { actionsFor, typeLabel } from "@/lib/video-workflow";
```

Ganti baris 52 `{TYPE_LABEL[v.tipe]}` jadi `{typeLabel(v)}`.

- [ ] **Step 6: Smoke build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 7: Commit**

```bash
git add src/lib/videos.ts src/app/(dashboard)/video/[id]/page.tsx src/app/(dashboard)/video/video-board.tsx src/app/(dashboard)/video/page.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(ui): pakai typeLabel di mana-mana + render note di timeline"
```

---

## Task 13: `settings.ts` lib + halaman Pengaturan

**Files:**
- Create: `src/lib/settings.ts`
- Create: `src/app/(dashboard)/pengaturan/page.tsx`
- Create: `src/app/(dashboard)/pengaturan/actions.ts`
- Modify: `src/lib/roles.ts`

- [ ] **Step 1: `settings.ts` lib**

`src/lib/settings.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export async function getSetting(key: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const v = (data as { value: string } | null)?.value ?? null;
  return v && v.length > 0 ? v : null;
}

export async function setSetting(
  key: string,
  value: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: "key" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

(RLS sudah membatasi write ke owner via policy, jadi server client cukup.)

- [ ] **Step 2: Server action**

`src/app/(dashboard)/pengaturan/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { setSetting } from "@/lib/settings";

function isUrl(s: string) { try { new URL(s); return true; } catch { return false; } }

export async function saveDriveFolderUrl(_prev: unknown, formData: FormData) {
  const profile = await requireRole("owner");
  const value = String(formData.get("drive_folder_url") ?? "").trim();
  if (!value) return { ok: false, error: "URL kosong" };
  if (!isUrl(value)) return { ok: false, error: "URL tidak valid" };

  const res = await setSetting("drive_folder_url", value, profile.id);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 3: Halaman Pengaturan**

`src/app/(dashboard)/pengaturan/page.tsx`:

```tsx
import { requireRole } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { PageHeader, SectionTitle } from "@/components/ui-kit";
import { SettingsForm } from "./settings-form";

export default async function PengaturanPage() {
  await requireRole("owner");
  const driveUrl = (await getSetting("drive_folder_url")) ?? "";

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan" description="Konfigurasi global aplikasi." />

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <SectionTitle>Folder Drive Final</SectionTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          URL folder Google Drive berisi hasil semua video. Akan tampil sebagai shortcut di sidebar & dashboard.
        </p>
        <div className="mt-4">
          <SettingsForm initialUrl={driveUrl} />
        </div>
      </div>
    </div>
  );
}
```

`src/app/(dashboard)/pengaturan/settings-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveDriveFolderUrl } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { ok: boolean; error?: string } | null;

export function SettingsForm({ initialUrl }: { initialUrl: string }) {
  const [state, action, pending] = useActionState(saveDriveFolderUrl, null as State);

  useEffect(() => {
    if (state?.ok) toast.success("Disimpan");
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="drive_folder_url">URL Folder Drive</Label>
        <Input
          id="drive_folder_url"
          name="drive_folder_url"
          defaultValue={initialUrl}
          placeholder="https://drive.google.com/drive/folders/..."
        />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
    </form>
  );
}
```

(Form-nya komponen client terpisah supaya page bisa server component.)

- [ ] **Step 4: Tambah menu Pengaturan ke `roles.ts`**

Edit `src/lib/roles.ts`:

```ts
const MENUS: Record<Role, MenuItem[]> = {
  owner: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Video", href: "/video" },
    { label: "Stok Konten", href: "/stok" },
    { label: "Rekap Kinerja", href: "/rekap" },
    { label: "Kelola User", href: "/users" },
    { label: "Absensi", href: "/absensi" },
    { label: "Pengaturan", href: "/pengaturan" },
  ],
  editor: [...same...],
  hrd: [...same...],
};
```

- [ ] **Step 5: Tambah ikon Settings ke sidebar**

Edit `src/components/sidebar.tsx`:

Tambah import:

```ts
import {
  LayoutDashboard, Clapperboard, Boxes, BarChart3, Users, Clock, Settings,
  type LucideIcon,
} from "lucide-react";
```

Tambah ke `ICONS`:

```ts
const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/video": Clapperboard,
  "/stok": Boxes,
  "/rekap": BarChart3,
  "/users": Users,
  "/absensi": Clock,
  "/pengaturan": Settings,
};
```

- [ ] **Step 6: Smoke build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 7: Commit**

```bash
git add src/lib/settings.ts src/lib/roles.ts src/components/sidebar.tsx src/app/(dashboard)/pengaturan/
git commit -m "feat(settings): halaman Pengaturan + simpan drive_folder_url"
```

---

## Task 14: Tampilkan Drive folder link di sidebar + dashboard

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Sidebar terima prop `driveFolderUrl`**

Edit `src/components/sidebar.tsx`:

Ubah signature:

```tsx
export function Sidebar({
  items, nama, role, driveFolderUrl,
}: {
  items: MenuItem[];
  nama: string;
  role: string;
  driveFolderUrl: string | null;
}) {
```

Tambah import `Folder`:

```ts
import {
  LayoutDashboard, Clapperboard, Boxes, BarChart3, Users, Clock, Settings, Folder,
  type LucideIcon,
} from "lucide-react";
```

Sebelum block "User chip" (baris 80), tambah:

```tsx
{driveFolderUrl && (
  <a
    href={driveFolderUrl}
    target="_blank"
    rel="noreferrer"
    className="mx-3 mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-accent"
  >
    <Folder className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={2} />
    <span>Folder Drive Final</span>
  </a>
)}
```

- [ ] **Step 2: Layout dashboard — fetch & oper**

Buka `src/app/(dashboard)/layout.tsx`. Cari pemanggilan `<Sidebar ... />`. Tambah:

```ts
import { getSetting } from "@/lib/settings";
```

Sebelum return, tambah:

```ts
const driveFolderUrl = await getSetting("drive_folder_url");
```

Oper ke `Sidebar`:

```tsx
<Sidebar items={...} nama={...} role={...} driveFolderUrl={driveFolderUrl} />
```

- [ ] **Step 3: Dashboard — card "Folder Hasil"**

Edit `src/app/(dashboard)/dashboard/page.tsx`:

Tambah import:

```ts
import { getSetting } from "@/lib/settings";
import { FolderOpen } from "lucide-react";
```

Sebelum `const greeting`, tambah:

```ts
const driveFolderUrl = await getSetting("drive_folder_url");
```

Setelah block `<section className="mt-8 ...">Perlu aksi kamu</section>` (atau di posisi yang relevan, mis. di bawah `PageHeader`), tambahkan card:

```tsx
{driveFolderUrl && (
  <section className="mt-6">
    <a
      href={driveFolderUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card transition hover:shadow-soft"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <FolderOpen className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-medium">Folder Hasil</p>
          <p className="text-xs text-muted-foreground">Buka folder Google Drive berisi semua video</p>
        </div>
      </div>
      <span className="text-xs text-brand">Buka →</span>
    </a>
  </section>
)}
```

- [ ] **Step 4: Smoke build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar.tsx src/app/(dashboard)/layout.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(ui): tampilkan drive_folder_url di sidebar + card dashboard"
```

---

## Task 15: `attendance-data.ts` — include `progress_summary` di select

**Files:**
- Modify: `src/lib/attendance-data.ts`

- [ ] **Step 1: Tambah field & include di select**

Edit `src/lib/attendance-data.ts`:

```ts
export type AttendanceRow = {
  id: string; user_id: string; tanggal: string;
  clock_in: string | null; clock_out: string | null;
  progress_summary: string | null;
};
```

`getTodayAttendance` select baris 16 jadi:

```ts
.select("id, user_id, tanggal, clock_in, clock_out, progress_summary")
```

`listAttendance` select baris 27 sama:

```ts
.select("id, user_id, tanggal, clock_in, clock_out, progress_summary")
```

- [ ] **Step 2: Smoke build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 3: Commit**

```bash
git add src/lib/attendance-data.ts
git commit -m "feat(attendance): tambah progress_summary di tipe & select"
```

---

## Task 16: `absensi/actions.ts` — `clockOut(extraNote)` bangun summary

**Files:**
- Modify: `src/app/(dashboard)/absensi/actions.ts`

- [ ] **Step 1: Ganti fungsi `clockOut`**

Edit `src/app/(dashboard)/absensi/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance } from "@/lib/attendance-data";
import { buildProgressSummary } from "@/lib/progress-summary";
import type { VideoStatus } from "@/lib/video-workflow";

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

export type ClockOutResult =
  | { ok: true; summary: string; role: string; nama: string }
  | { ok: false; error: string };

export async function clockOut(extraNote?: string): Promise<ClockOutResult> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const existing = await getTodayAttendance(profile.id);
  if (!existing || !existing.clock_in) return { ok: false, error: "Belum clock in" };
  if (existing.clock_out) return { ok: false, error: "Sudah clock out hari ini" };

  const since = existing.clock_in;
  const clockOutTime = new Date();

  // Status moves user hari ini sejak clock_in (join ke videos untuk judul)
  const { data: eventsData } = await supabase
    .from("status_events")
    .select("status_baru, created_at, videos!inner(judul)")
    .eq("changed_by", profile.id)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const statusMoves = ((eventsData ?? []) as Array<{
    status_baru: VideoStatus; videos: { judul: string } | { judul: string }[];
  }>).map((r) => ({
    judul: Array.isArray(r.videos) ? r.videos[0]?.judul ?? "—" : r.videos.judul,
    statusBaru: r.status_baru,
  }));

  // Komentar user hari ini sejak clock_in
  const { data: commentsData } = await supabase
    .from("comments")
    .select("isi, created_at, videos!inner(judul)")
    .eq("user_id", profile.id)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const comments = ((commentsData ?? []) as Array<{
    isi: string; videos: { judul: string } | { judul: string }[];
  }>).map((r) => ({
    judul: Array.isArray(r.videos) ? r.videos[0]?.judul ?? "—" : r.videos.judul,
    isi: r.isi,
  }));

  const summary = buildProgressSummary({
    nama: profile.nama,
    clockOutTime,
    statusMoves,
    comments,
    extraNote,
  });

  const { error } = await supabase
    .from("attendance")
    .update({ clock_out: clockOutTime.toISOString(), progress_summary: summary })
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/absensi");
  return { ok: true, summary, role: profile.role, nama: profile.nama };
}
```

- [ ] **Step 2: Smoke build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/absensi/actions.ts
git commit -m "feat(absensi): clockOut bangun progress summary + return ke client"
```

---

## Task 17: `clockout-modal.tsx` + integrasi `clock-card.tsx`

**Files:**
- Create: `src/app/(dashboard)/absensi/clockout-modal.tsx`
- Modify: `src/app/(dashboard)/absensi/clock-card.tsx`

- [ ] **Step 1: Buat modal component**

`src/app/(dashboard)/absensi/clockout-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALFRED_WA, waLink } from "@/lib/wa";

export function ClockoutModal({
  initialSummary,
  onClose,
}: {
  initialSummary: string;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialSummary);

  function sendWA() {
    const url = waLink(ALFRED_WA, text);
    const win = window.open(url, "_blank", "noreferrer");
    if (!win) toast.error("Popup diblokir. Pakai 'Salin pesan' lalu paste manual.");
    else onClose();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Disalin");
    } catch {
      toast.error("Gagal menyalin");
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-soft"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">Lapor selesai kerja</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Edit pesan kalau perlu, lalu kirim ke Alfred via WhatsApp.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={sendWA}>
              <MessageCircle className="mr-2 h-4 w-4" /> Kirim via WhatsApp
            </Button>
            <Button variant="secondary" onClick={copy}>
              <Copy className="mr-2 h-4 w-4" /> Salin pesan
            </Button>
            <Button variant="ghost" onClick={onClose}>Tutup</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Update `clock-card.tsx` — textarea catatan + trigger modal**

Edit `src/app/(dashboard)/absensi/clock-card.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { clockIn, clockOut } from "./actions";
import { Button } from "@/components/ui/button";
import { ClockoutModal } from "./clockout-modal";
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
  const [extraNote, setExtraNote] = useState("");
  const [modalSummary, setModalSummary] = useState<string | null>(null);

  function doClockIn() {
    start(async () => {
      const res = await clockIn();
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success("Berhasil clock in");
      router.refresh();
    });
  }

  function doClockOut() {
    start(async () => {
      const res = await clockOut(extraNote || undefined);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success("Berhasil clock out");
      setExtraNote("");
      router.refresh();
      if (res.role === "editor") {
        setModalSummary(res.summary);
      }
    });
  }

  return (
    <>
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
              <Button size="lg" disabled={pending} onClick={doClockIn}>
                <LogIn className="mr-2 h-4 w-4" /> Clock In
              </Button>
            )}
            {state === "working" && (
              <Button size="lg" variant="secondary" disabled={pending} onClick={doClockOut}>
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

        {state === "working" && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground">Catatan tambahan untuk laporan (opsional)</summary>
            <textarea
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="mis. lanjut episode 6 besok, file source di server X..."
              className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </details>
        )}
      </motion.div>

      {modalSummary && (
        <ClockoutModal
          initialSummary={modalSummary}
          onClose={() => setModalSummary(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Smoke build**

Run: `npm run build`
Expected: sukses.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: semua hijau.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/absensi/clockout-modal.tsx src/app/(dashboard)/absensi/clock-card.tsx
git commit -m "feat(absensi): modal preview pesan + tombol kirim WhatsApp untuk editor"
```

---

## Task 18: Manual smoke test end-to-end + deploy

**Files:** —

- [ ] **Step 1: Jalankan dev server**

Run: `npm run dev`
Expected: jalan di `localhost:3000`.

- [ ] **Step 2: Smoke checklist**

Login & test berurutan:

1. **Owner Alfred:** Tambah video tipe "Lainnya" → input `tipe_custom="Tutorial"` → simpan → cek board: label "Tutorial" muncul.
2. **Detail video apa saja:** Tulis komentar `cek https://docs.google.com/x` → reload → URL clickable, buka tab baru OK.
3. **Owner di detail video:** Buka `<details>` "Ubah status manual" → pilih `final` → tulis note "Test lompat" → submit → cek timeline aside ada baris "Final" dengan note italic.
4. **`/pengaturan`:** Paste `https://drive.google.com/drive/folders/0xABC` → simpan → toast "Disimpan" → sidebar nampilin link "Folder Drive Final" → dashboard nampilin card "Folder Hasil".
5. **Logout, login sebagai Agus (editor):**
   - Clock in.
   - Buka video assigned → tulis 1 komentar → submit_draft (atau aksi apapun yang bikin status_event).
   - Balik ke `/absensi` → expand "Catatan tambahan" → tulis "Selesai cut episode 5" → Clock Out.
   - Modal muncul dengan preview pesan (nama, jam, status moves, komentar, catatan).
   - Klik "Kirim via WhatsApp" → tab baru `https://wa.me/628112634321?text=...` terbuka dengan pesan ter-prefilled.
   - Tutup modal. Tombol Clock Out hilang, status `done`.
6. **Login Alfred lagi:** `/absensi` → tabel hari ini menampilkan baris Agus dengan jam clock_in & clock_out. Detail (kalau ada view detail) menampilkan `progress_summary`. (Atau verifikasi via Supabase: `select progress_summary from attendance where tanggal = current_date;`)
7. **Stok:** Buka `/stok` → grid "Siap tayang" nampilin baris "Lainnya" (0 atau N).

- [ ] **Step 3: Kalau semua hijau, push & deploy**

```bash
git push origin main
```

Vercel auto-deploy. Tunggu sampai live di sproutkitchen.vercel.app, lalu ulang smoke #1–#5 di production.

- [ ] **Step 4: Update memory `fase` kalau perlu**

Tambah entry baru di `MEMORY.md` (kalau ini dianggap fitur fase 5 atau iterasi UX):

```
- [Flow Improvements 2026-06-02](flow-improvements-202606.md) — linkify komentar, force status (owner), tipe "Lainnya", settings drive folder, clock-out WA summary
```

Bikin file pendek `flow-improvements-202606.md` summarizing yang diimplementasi.

---

## Self-Review Checklist Hasil

**Spec coverage:**
- ✅ Clickable links: Task 2, 3
- ✅ Force set status (owner): Task 6 (type), 10 (server), 11 (UI), 12 (timeline note)
- ✅ Tipe "Lainnya" + teks custom: Task 1 (DB), 6 (type), 7 (lib), 8 (stok), 9 (form), 10 (validation), 12 (UI labels)
- ✅ Default editor: Task 9
- ✅ Drive folder link: Task 1 (seed), 13 (lib+page), 14 (sidebar+dashboard)
- ✅ Clock-out WA: Task 1 (kolom), 4 (formatter), 5 (wa helper), 15 (lib), 16 (action), 17 (modal+integrate)

**Placeholder scan:** Tidak ada TBD/TODO. Semua code block lengkap.

**Type consistency:** `VideoStatus`, `VideoType`, `typeLabel`, `force_set_status`, `ClockOutResult`, `Part` — semua disebut dengan nama sama di seluruh tasks. `setSetting(key, value, userId)` signature dipakai konsisten di Task 13.

**Catatan untuk implementer:**
- `initialStatus("lainnya")` mengembalikan `"draft_brief"` karena `tipe !== "clipping"`. Tidak perlu ubah `video-workflow.ts` `initialStatus`.
- Task 12 step 3 perlu baca `src/app/(dashboard)/video/page.tsx` dulu — file ini me-map `VideoRow` ke `Card` board, dan harus include `tipe_custom`. Path file sudah eksis (lihat Glob).
- Saat smoke test, kalau tipe `'lainnya'` belum bisa diapply karena migrasi enum gagal: cek apakah `0005` benar-benar ter-commit. `ALTER TYPE ADD VALUE` membutuhkan koneksi terpisah dari statement yang me-reference value — itulah alasan dipecah 2 file dan diapply via 2 invocation `npm run db:migrate`.
