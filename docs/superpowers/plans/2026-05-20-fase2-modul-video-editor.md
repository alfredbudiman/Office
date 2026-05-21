# Fase 2 — Modul Video Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modul inti video: owner buat entri video, tugaskan editor; editor & owner menggerakkan video lewat alur status (cut-to-cut → review → editing → draft/revisi tak terbatas → final → tayang) dengan tombol aksi, riwayat draft, komentar, timeline status, dan notifikasi in-app.

**Architecture:** State machine status video adalah modul logika murni (`src/lib/video-workflow.ts`) yang di-TDD penuh — ia mengkodekan gate approval & aturan clipping (skip cut-to-cut). Semua data di Postgres/Supabase dengan RLS (owner lihat semua; editor hanya video yang ditugaskan ke dirinya). Mutasi lewat Server Actions yang memvalidasi transisi via state machine lalu menulis via klien Supabase ber-RLS. Transisi & komentar mencatat `status_events` dan membuat `notifications` (dihitung saat load; Realtime menyusul di fase lain). Transisi status memakai TOMBOL AKSI (bukan drag-drop).

**Tech Stack:** Next.js 16 App Router + TypeScript, Supabase (Postgres + Auth + RLS), Tailwind v4 + shadcn/ui + Framer Motion, Vitest, `pg` (script migrasi).

---

## Prasyarat
Fase 1 selesai: ada `profiles` (role owner/editor/hrd), auth, `requireRole`/`requireProfile`, `createClient` (server/browser), `is_owner()`, sidebar dengan menu `/video`. `.env.local` berisi kunci Supabase.

## File Structure (Fase 2)

| File | Tanggung jawab |
|------|----------------|
| `scripts/db-migrate.mjs` | Runner migrasi SQL ke DB (pakai `pg` + `DATABASE_URL`) |
| `supabase/migrations/0002_videos.sql` | Enum + tabel videos/drafts/comments/notifications/status_events + RLS |
| `src/lib/video-workflow.ts` | State machine status (logika murni) |
| `src/lib/video-workflow.test.ts` | Test state machine |
| `src/lib/videos.ts` | Tipe domain + query baca (list/detail/drafts/comments/events) |
| `src/lib/notifications.ts` | Helper buat & hitung notifikasi |
| `src/app/(dashboard)/video/page.tsx` | Papan video (owner: semua; editor: miliknya) |
| `src/app/(dashboard)/video/video-board.tsx` | Komponen papan kolom-per-status + filter |
| `src/app/(dashboard)/video/new-video-form.tsx` | Form buat video (owner) |
| `src/app/(dashboard)/video/actions.ts` | Server actions: createVideo, applyVideoAction, addComment |
| `src/app/(dashboard)/video/[id]/page.tsx` | Detail video |
| `src/app/(dashboard)/video/[id]/status-actions.tsx` | Tombol aksi transisi |
| `src/app/(dashboard)/video/[id]/comments.tsx` | Daftar + form komentar |
| `src/components/notif-bell.tsx` | Lonceng + badge (count) di header |
| `src/app/(dashboard)/notifikasi/page.tsx` | Daftar notifikasi + tandai dibaca |
| `src/app/(dashboard)/layout.tsx` | (modify) sisipkan `<NotifBell>` di header |

---

## Task 1: Runner migrasi DB + skema video

**Files:**
- Create: `scripts/db-migrate.mjs`, `supabase/migrations/0002_videos.sql`
- Modify: `.env.local.example` (tambah DATABASE_URL), `package.json` (script `db:migrate`)

- [ ] **Step 1: Owner sediakan DATABASE_URL (manual, sekali saja)**

Di Supabase → Project Settings → Database → Connection string → **URI** (mode "Session"/pooler). Salin ke `.env.local` sebagai `DATABASE_URL=postgresql://...` (ganti `[YOUR-PASSWORD]` dengan password DB yang di-set saat buat project). Tambahkan juga baris `DATABASE_URL=` ke `.env.local.example`. Minta owner konfirmasi terisi sebelum lanjut.

- [ ] **Step 2: Install `pg`**

Run: `npm install pg` (set `npm_config_cache` ke folder temp bila cache default error: `export npm_config_cache="${TEMP:-/tmp}/npm-cache-claude"`).

- [ ] **Step 3: Tulis runner migrasi**

Create `scripts/db-migrate.mjs`:
```js
// Jalankan file SQL ke DB. Pakai: node --env-file=.env.local scripts/db-migrate.mjs supabase/migrations/0002_videos.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) { console.error("Beri path file SQL."); process.exit(1); }
const conn = process.env.DATABASE_URL;
if (!conn) { console.error("DATABASE_URL kosong di .env.local"); process.exit(1); }

const sql = readFileSync(file, "utf8");
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("OK: migrasi diterapkan:", file);
} catch (e) {
  console.error("MIGRASI GAGAL:", e.message);
  process.exitCode = 2;
} finally {
  await client.end();
}
```
Tambah ke `package.json` scripts: `"db:migrate": "node --env-file=.env.local scripts/db-migrate.mjs"`.

- [ ] **Step 4: Tulis skema video**

Create `supabase/migrations/0002_videos.sql`:
```sql
create type video_type as enum ('monolog', 'podcast', 'shorts', 'clipping');
create type video_status as enum ('draft_brief', 'cut_to_cut', 'review_cut', 'editing', 'review_draft', 'final', 'tayang');

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  tipe video_type not null,
  status video_status not null,
  editor_id uuid references public.profiles(id) on delete set null,
  parent_video_id uuid references public.videos(id) on delete set null,
  link_source text,
  target_tayang date,
  sudah_tayang boolean not null default false,
  published_at timestamptz,
  final_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  nomor_draft int not null,
  link_draft text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  isi text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pesan text not null,
  link text,
  sudah_dibaca boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  status_lama video_status,
  status_baru video_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.videos (editor_id);
create index on public.videos (status);
create index on public.drafts (video_id);
create index on public.comments (video_id);
create index on public.notifications (user_id, sudah_dibaca);
create index on public.status_events (video_id);

-- Helper: apakah user peserta video ini (owner atau editor yang ditugaskan)
create or replace function public.is_video_participant(vid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from public.videos v where v.id = vid and v.editor_id = auth.uid()
  );
$$;

alter table public.videos enable row level security;
alter table public.drafts enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.status_events enable row level security;

-- videos: owner semua; editor hanya miliknya
create policy "videos_select" on public.videos for select
  using (public.is_owner() or editor_id = auth.uid());
create policy "videos_insert" on public.videos for insert
  with check (public.is_owner());
create policy "videos_update" on public.videos for update
  using (public.is_owner() or editor_id = auth.uid())
  with check (public.is_owner() or editor_id = auth.uid());

-- drafts: peserta video
create policy "drafts_select" on public.drafts for select
  using (public.is_video_participant(video_id));
create policy "drafts_insert" on public.drafts for insert
  with check (public.is_video_participant(video_id));

-- comments: peserta video
create policy "comments_select" on public.comments for select
  using (public.is_video_participant(video_id));
create policy "comments_insert" on public.comments for insert
  with check (public.is_video_participant(video_id) and user_id = auth.uid());

-- notifications: milik sendiri
create policy "notif_select" on public.notifications for select
  using (user_id = auth.uid());
create policy "notif_update" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- status_events: peserta video boleh baca; tulis lewat server action (peserta)
create policy "events_select" on public.status_events for select
  using (public.is_video_participant(video_id));
create policy "events_insert" on public.status_events for insert
  with check (public.is_video_participant(video_id));
```

- [ ] **Step 5: Terapkan migrasi**

Run: `npm run db:migrate -- supabase/migrations/0002_videos.sql`
Expected: `OK: migrasi diterapkan: supabase/migrations/0002_videos.sql`

- [ ] **Step 6: Commit**
```bash
git add scripts/db-migrate.mjs supabase/migrations/0002_videos.sql package.json package-lock.json .env.local.example
git commit -m "feat: video schema (videos/drafts/comments/notifications/status_events) + RLS + migrate runner"
```

---

## Task 2: State machine status video (TDD, logika murni)

**Files:**
- Create: `src/lib/video-workflow.ts`
- Test: `src/lib/video-workflow.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `src/lib/video-workflow.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  initialStatus, actionsFor, applyAction, ACTIONS,
  type VideoStatus, type VideoAction,
} from "@/lib/video-workflow";

describe("initialStatus", () => {
  it("clipping mulai dari editing (skip cut-to-cut)", () => {
    expect(initialStatus("clipping")).toBe("editing");
  });
  it("non-clipping mulai dari draft_brief", () => {
    expect(initialStatus("monolog")).toBe("draft_brief");
    expect(initialStatus("podcast")).toBe("draft_brief");
    expect(initialStatus("shorts")).toBe("draft_brief");
  });
});

describe("actionsFor", () => {
  it("editor di cut_to_cut bisa submit_cut", () => {
    expect(actionsFor("cut_to_cut", "editor")).toEqual(["submit_cut"]);
  });
  it("owner di review_cut bisa approve atau minta revisi cut", () => {
    expect(actionsFor("review_cut", "owner").sort()).toEqual(["approve_cut", "request_cut_revision"]);
  });
  it("owner di review_draft bisa approve_final atau request_revision", () => {
    expect(actionsFor("review_draft", "owner").sort()).toEqual(["approve_final", "request_revision"]);
  });
  it("editor di review_cut tidak punya aksi (giliran owner)", () => {
    expect(actionsFor("review_cut", "editor")).toEqual([]);
  });
  it("hrd tidak punya aksi apa pun", () => {
    expect(actionsFor("review_draft", "hrd")).toEqual([]);
  });
  it("tayang tidak punya aksi lanjutan", () => {
    expect(actionsFor("tayang", "owner")).toEqual([]);
  });
});

describe("applyAction", () => {
  it("submit_cut: cut_to_cut -> review_cut", () => {
    expect(applyAction("cut_to_cut", "submit_cut")).toEqual({ ok: true, to: "review_cut" });
  });
  it("approve_cut: review_cut -> editing", () => {
    expect(applyAction("review_cut", "approve_cut")).toEqual({ ok: true, to: "editing" });
  });
  it("loop revisi: request_revision review_draft -> editing, lalu submit_draft -> review_draft", () => {
    expect(applyAction("review_draft", "request_revision")).toEqual({ ok: true, to: "editing" });
    expect(applyAction("editing", "submit_draft")).toEqual({ ok: true, to: "review_draft" });
  });
  it("approve_final: review_draft -> final, mark_tayang: final -> tayang", () => {
    expect(applyAction("review_draft", "approve_final")).toEqual({ ok: true, to: "final" });
    expect(applyAction("final", "mark_tayang")).toEqual({ ok: true, to: "tayang" });
  });
  it("aksi dari status salah ditolak", () => {
    const r = applyAction("final", "submit_cut");
    expect(r.ok).toBe(false);
  });
});

describe("ACTIONS metadata", () => {
  it("submit_cut & submit_draft wajib link", () => {
    expect(ACTIONS.submit_cut.requiresLink).toBe(true);
    expect(ACTIONS.submit_draft.requiresLink).toBe(true);
  });
  it("submit_draft membuat draft", () => {
    expect(ACTIONS.submit_draft.createsDraft).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npm test -- video-workflow`
Expected: FAIL — "Cannot find module '@/lib/video-workflow'".

- [ ] **Step 3: Implementasi**

Create `src/lib/video-workflow.ts`:
```ts
import type { Role } from "@/lib/roles";

export type VideoType = "monolog" | "podcast" | "shorts" | "clipping";
export type VideoStatus =
  | "draft_brief" | "cut_to_cut" | "review_cut"
  | "editing" | "review_draft" | "final" | "tayang";
export type VideoAction =
  | "start_cut" | "submit_cut" | "approve_cut" | "request_cut_revision"
  | "submit_draft" | "approve_final" | "request_revision" | "mark_tayang";

export const STATUS_ORDER: VideoStatus[] = [
  "draft_brief", "cut_to_cut", "review_cut", "editing", "review_draft", "final", "tayang",
];

export const STATUS_LABEL: Record<VideoStatus, string> = {
  draft_brief: "Draft Brief",
  cut_to_cut: "Cut-to-Cut",
  review_cut: "Review Cut",
  editing: "Editing",
  review_draft: "Review Draft",
  final: "Final",
  tayang: "Tayang",
};

export const TYPE_LABEL: Record<VideoType, string> = {
  monolog: "Monolog",
  podcast: "Podcast",
  shorts: "Shorts",
  clipping: "Clipping",
};

export const ACTION_LABEL: Record<VideoAction, string> = {
  start_cut: "Mulai Cut-to-Cut",
  submit_cut: "Kirim Cut-to-Cut",
  approve_cut: "Approve Cut",
  request_cut_revision: "Minta Revisi Cut",
  submit_draft: "Kirim Draft",
  approve_final: "Centang Final",
  request_revision: "Minta Revisi",
  mark_tayang: "Tandai Tayang",
};

type ActionDef = {
  from: VideoStatus;
  to: VideoStatus;
  role: "owner" | "editor";
  requiresLink?: boolean;
  createsDraft?: boolean;
};

export const ACTIONS: Record<VideoAction, ActionDef> = {
  start_cut: { from: "draft_brief", to: "cut_to_cut", role: "editor" },
  submit_cut: { from: "cut_to_cut", to: "review_cut", role: "editor", requiresLink: true },
  approve_cut: { from: "review_cut", to: "editing", role: "owner" },
  request_cut_revision: { from: "review_cut", to: "cut_to_cut", role: "owner" },
  submit_draft: { from: "editing", to: "review_draft", role: "editor", requiresLink: true, createsDraft: true },
  approve_final: { from: "review_draft", to: "final", role: "owner" },
  request_revision: { from: "review_draft", to: "editing", role: "owner" },
  mark_tayang: { from: "final", to: "tayang", role: "owner" },
};

export function initialStatus(type: VideoType): VideoStatus {
  return type === "clipping" ? "editing" : "draft_brief";
}

export function actionsFor(status: VideoStatus, role: Role): VideoAction[] {
  if (role !== "owner" && role !== "editor") return [];
  return (Object.keys(ACTIONS) as VideoAction[]).filter(
    (a) => ACTIONS[a].from === status && ACTIONS[a].role === role
  );
}

export function applyAction(
  status: VideoStatus,
  action: VideoAction
): { ok: true; to: VideoStatus } | { ok: false; error: string } {
  const def = ACTIONS[action];
  if (!def) return { ok: false, error: "Aksi tidak dikenal" };
  if (def.from !== status) {
    return { ok: false, error: `Aksi '${action}' tidak valid dari status '${STATUS_LABEL[status]}'` };
  }
  return { ok: true, to: def.to };
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npm test -- video-workflow`
Expected: PASS (semua test).

- [ ] **Step 5: Commit**
```bash
git add src/lib/video-workflow.ts src/lib/video-workflow.test.ts
git commit -m "feat: video status state machine with tests"
```

---

## Task 3: Lapisan data video (query baca)

**Files:**
- Create: `src/lib/videos.ts`

- [ ] **Step 1: Implementasi tipe + query**

Create `src/lib/videos.ts`:
```ts
import { createClient } from "@/lib/supabase/server";
import type { VideoStatus, VideoType } from "@/lib/video-workflow";

export type VideoRow = {
  id: string;
  judul: string;
  tipe: VideoType;
  status: VideoStatus;
  editor_id: string | null;
  parent_video_id: string | null;
  link_source: string | null;
  target_tayang: string | null;
  sudah_tayang: boolean;
  created_at: string;
  final_at: string | null;
};

export type DraftRow = {
  id: string; video_id: string; nomor_draft: number;
  link_draft: string; created_at: string; created_by: string | null;
};
export type CommentRow = {
  id: string; video_id: string; user_id: string | null;
  isi: string; created_at: string;
};
export type StatusEventRow = {
  id: string; status_lama: VideoStatus | null; status_baru: VideoStatus; created_at: string;
};

// RLS otomatis membatasi: owner lihat semua, editor lihat miliknya.
export async function listVideos(): Promise<VideoRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("id, judul, tipe, status, editor_id, parent_video_id, link_source, target_tayang, sudah_tayang, created_at, final_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as VideoRow[];
}

export async function getVideo(id: string): Promise<VideoRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("id, judul, tipe, status, editor_id, parent_video_id, link_source, target_tayang, sudah_tayang, created_at, final_at")
    .eq("id", id)
    .maybeSingle();
  return (data as VideoRow) ?? null;
}

export async function getDrafts(videoId: string): Promise<DraftRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("drafts").select("id, video_id, nomor_draft, link_draft, created_at, created_by")
    .eq("video_id", videoId).order("nomor_draft", { ascending: true });
  return (data ?? []) as DraftRow[];
}

export async function getComments(videoId: string): Promise<CommentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments").select("id, video_id, user_id, isi, created_at")
    .eq("video_id", videoId).order("created_at", { ascending: true });
  return (data ?? []) as CommentRow[];
}

export async function getStatusEvents(videoId: string): Promise<StatusEventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("status_events").select("id, status_lama, status_baru, created_at")
    .eq("video_id", videoId).order("created_at", { ascending: true });
  return (data ?? []) as StatusEventRow[];
}

export async function listEditors(): Promise<{ id: string; nama: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles").select("id, nama").eq("role", "editor").eq("aktif", true).order("nama");
  return (data ?? []) as { id: string; nama: string }[];
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: tidak ada error pada `src/lib/videos.ts`.

- [ ] **Step 3: Commit**
```bash
git add src/lib/videos.ts
git commit -m "feat: video data-access layer (read queries)"
```

---

## Task 4: Helper notifikasi

**Files:**
- Create: `src/lib/notifications.ts`

- [ ] **Step 1: Implementasi**

Create `src/lib/notifications.ts`:
```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Dibuat dari server action untuk SIAPA SAJA (penerima != aktor) -> pakai admin (bypass RLS insert).
export async function notify(userId: string | null, pesan: string, link: string) {
  if (!userId) return;
  const admin = createAdminClient();
  await admin.from("notifications").insert({ user_id: userId, pesan, link });
}

export async function unreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("sudah_dibaca", false);
  return count ?? 0;
}

export async function listNotifications() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, pesan, link, sudah_dibaca, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add src/lib/notifications.ts
git commit -m "feat: notifications helpers (create, count, list)"
```

---

## Task 5: Server actions video (create, transisi, komentar)

**Files:**
- Create: `src/app/(dashboard)/video/actions.ts`

- [ ] **Step 1: Implementasi server actions**

Create `src/app/(dashboard)/video/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { getVideo } from "@/lib/videos";
import {
  initialStatus, applyAction, ACTIONS,
  type VideoType, type VideoAction,
} from "@/lib/video-workflow";

function isUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}

export async function createVideo(_prev: unknown, formData: FormData) {
  await requireRole("owner");
  const judul = String(formData.get("judul") ?? "").trim();
  const tipe = String(formData.get("tipe") ?? "") as VideoType;
  const editorId = String(formData.get("editor_id") ?? "") || null;
  const linkSource = String(formData.get("link_source") ?? "").trim();
  const parentId = String(formData.get("parent_video_id") ?? "") || null;

  const errors: Record<string, string> = {};
  if (!judul) errors.judul = "Judul wajib diisi";
  if (!["monolog", "podcast", "shorts", "clipping"].includes(tipe)) errors.tipe = "Tipe tidak valid";
  if (linkSource && !isUrl(linkSource)) errors.link_source = "Link harus URL valid";
  if (tipe === "clipping" && !parentId) errors.parent_video_id = "Clipping wajib pilih video induk";
  if (Object.keys(errors).length) return { ok: false, errors };

  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.from("videos").insert({
    judul, tipe, status: initialStatus(tipe),
    editor_id: editorId, parent_video_id: parentId,
    link_source: linkSource || null, created_by: profile.id,
  }).select("id").single();
  if (error) return { ok: false, errors: { judul: error.message } };

  if (editorId) await notify(editorId, `Video baru ditugaskan: ${judul}`, `/video/${data.id}`);
  revalidatePath("/video");
  return { ok: true, errors: {}, id: data.id };
}

export async function applyVideoAction(videoId: string, action: VideoAction, link?: string) {
  const profile = await requireProfile();
  const video = await getVideo(videoId);
  if (!video) return { ok: false, error: "Video tidak ditemukan" };

  const def = ACTIONS[action];
  if (!def) return { ok: false, error: "Aksi tidak dikenal" };
  // Otorisasi: role harus cocok; editor hanya boleh video miliknya.
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

  // Buat draft jika perlu (nomor_draft = jumlah draft + 1)
  if (def.createsDraft && link) {
    const { count } = await supabase.from("drafts")
      .select("id", { count: "exact", head: true }).eq("video_id", videoId);
    await supabase.from("drafts").insert({
      video_id: videoId, nomor_draft: (count ?? 0) + 1, link_draft: link, created_by: profile.id,
    });
  }

  // Update status (+ final_at saat final, sudah_tayang saat tayang)
  const patch: Record<string, unknown> = { status: res.to };
  if (res.to === "final") patch.final_at = new Date().toISOString();
  if (res.to === "tayang") { patch.sudah_tayang = true; patch.published_at = new Date().toISOString(); }
  const { error: upErr } = await supabase.from("videos").update(patch).eq("id", videoId);
  if (upErr) return { ok: false, error: upErr.message };

  // Catat status_event
  await supabase.from("status_events").insert({
    video_id: videoId, status_lama: video.status, status_baru: res.to, changed_by: profile.id,
  });

  // Notifikasi ke pihak lawan
  const counterpart = profile.role === "owner" ? video.editor_id : video.created_by ?? null;
  await notify(counterpart, `Status "${video.judul}" → ${res.to}`, `/video/${videoId}`);

  revalidatePath(`/video/${videoId}`);
  revalidatePath("/video");
  return { ok: true };
}

export async function addComment(videoId: string, isi: string) {
  const profile = await requireProfile();
  const text = isi.trim();
  if (!text) return { ok: false, error: "Komentar kosong" };
  const video = await getVideo(videoId);
  if (!video) return { ok: false, error: "Video tidak ditemukan" };

  const supabase = await createClient();
  const { error } = await supabase.from("comments")
    .insert({ video_id: videoId, user_id: profile.id, isi: text });
  if (error) return { ok: false, error: error.message };

  // Notifikasi ke pihak lawan
  const counterpart = profile.role === "owner" ? video.editor_id : video.created_by ?? null;
  await notify(counterpart, `Komentar baru di "${video.judul}"`, `/video/${videoId}`);

  revalidatePath(`/video/${videoId}`);
  return { ok: true };
}
```
Catatan: `getVideo` memakai klien ber-RLS, jadi editor yang bukan peserta akan dapat `null` (otorisasi berlapis). `video.created_by` dipakai sebagai penerima notifikasi sisi owner (owner pembuat video).

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/video/actions.ts"
git commit -m "feat: video server actions (create, transition, comment) with auth + notifications"
```

---

## Task 6: Form buat video (owner)

**Files:**
- Create: `src/app/(dashboard)/video/new-video-form.tsx`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/video/new-video-form.tsx`:
```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createVideo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditorOpt = { id: string; nama: string };
type VideoOpt = { id: string; judul: string };

export function NewVideoForm({ editors, parents }: { editors: EditorOpt[]; parents: VideoOpt[] }) {
  const [open, setOpen] = useState(false);
  const [tipe, setTipe] = useState("monolog");
  const [state, action, pending] = useActionState(createVideo, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) { setOpen(false); router.refresh(); }
  }, [state, router]);

  if (!open) return <Button onClick={() => setOpen(true)}>+ Video baru</Button>;

  return (
    <AnimatePresence>
      <motion.form
        action={action}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
      >
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="judul">Judul</Label>
          <Input id="judul" name="judul" />
          {state?.errors?.judul && <p className="text-xs text-red-500">{state.errors.judul}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="tipe">Tipe</Label>
          <select id="tipe" name="tipe" value={tipe} onChange={(e) => setTipe(e.target.value)}
            className="h-9 w-full rounded-md border px-2 text-sm">
            <option value="monolog">Monolog</option>
            <option value="podcast">Podcast</option>
            <option value="shorts">Shorts</option>
            <option value="clipping">Clipping</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="editor_id">Editor</Label>
          <select id="editor_id" name="editor_id" className="h-9 w-full rounded-md border px-2 text-sm">
            <option value="">— belum ditugaskan —</option>
            {editors.map((e) => <option key={e.id} value={e.id}>{e.nama}</option>)}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="link_source">Link source</Label>
          <Input id="link_source" name="link_source" placeholder="https://..." />
          {state?.errors?.link_source && <p className="text-xs text-red-500">{state.errors.link_source}</p>}
        </div>
        {tipe === "clipping" && (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="parent_video_id">Video induk (untuk clipping)</Label>
            <select id="parent_video_id" name="parent_video_id" className="h-9 w-full rounded-md border px-2 text-sm">
              <option value="">— pilih —</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.judul}</option>)}
            </select>
            {state?.errors?.parent_video_id && <p className="text-xs text-red-500">{state.errors.parent_video_id}</p>}
          </div>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
        </div>
      </motion.form>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/video/new-video-form.tsx"
git commit -m "feat: new video form (owner) with clipping parent picker"
```

---

## Task 7: Papan video + halaman /video

**Files:**
- Create: `src/app/(dashboard)/video/video-board.tsx`, `src/app/(dashboard)/video/page.tsx`

- [ ] **Step 1: Komponen papan**

Create `src/app/(dashboard)/video/video-board.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { STATUS_ORDER, STATUS_LABEL, TYPE_LABEL, type VideoStatus, type VideoType } from "@/lib/video-workflow";

type Card = { id: string; judul: string; tipe: VideoType; status: VideoStatus; editorNama: string | null };

export function VideoBoard({ cards }: { cards: Card[] }) {
  const [tipe, setTipe] = useState<VideoType | "all">("all");
  const filtered = tipe === "all" ? cards : cards.filter((c) => c.tipe === tipe);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "monolog", "podcast", "shorts", "clipping"] as const).map((t) => (
          <button key={t} onClick={() => setTipe(t)}
            className={`rounded-full border px-3 py-1 text-xs ${tipe === t ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            {t === "all" ? "Semua" : TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => {
          const items = filtered.filter((c) => c.status === status);
          return (
            <div key={status} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-medium">{STATUS_LABEL[status]}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((c) => (
                  <motion.div key={c.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <Link href={`/video/${c.id}`}
                      className="block rounded-lg border bg-card p-3 text-sm shadow-sm transition hover:shadow">
                      <p className="font-medium">{c.judul}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {TYPE_LABEL[c.tipe]}{c.editorNama ? ` · ${c.editorNama}` : ""}
                      </p>
                    </Link>
                  </motion.div>
                ))}
                {items.length === 0 && <p className="px-1 text-xs text-muted-foreground/60">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Halaman /video**

Create `src/app/(dashboard)/video/page.tsx`:
```tsx
import { requireProfile } from "@/lib/auth";
import { listVideos, listEditors } from "@/lib/videos";
import { createClient } from "@/lib/supabase/server";
import { VideoBoard } from "./video-board";
import { NewVideoForm } from "./new-video-form";
import type { VideoType, VideoStatus } from "@/lib/video-workflow";

export default async function VideoPage() {
  const profile = await requireProfile();
  const videos = await listVideos();

  // Map editor id -> nama untuk label kartu
  const supabase = await createClient();
  const { data: profs } = await supabase.from("profiles").select("id, nama");
  const namaById = new Map((profs ?? []).map((p: { id: string; nama: string }) => [p.id, p.nama]));

  const cards = videos.map((v) => ({
    id: v.id, judul: v.judul, tipe: v.tipe as VideoType, status: v.status as VideoStatus,
    editorNama: v.editor_id ? namaById.get(v.editor_id) ?? null : null,
  }));

  const editors = profile.role === "owner" ? await listEditors() : [];
  const parents = profile.role === "owner"
    ? videos.filter((v) => v.tipe !== "clipping").map((v) => ({ id: v.id, judul: v.judul }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{profile.role === "owner" ? "Video" : "Video Saya"}</h1>
        {profile.role === "owner" && <NewVideoForm editors={editors} parents={parents} />}
      </div>
      <VideoBoard cards={cards} />
    </div>
  );
}
```
Catatan: editor otomatis hanya melihat video miliknya (RLS pada `listVideos`). Menu sidebar editor sudah berlabel "Video Saya" (Fase 1).

- [ ] **Step 3: Verifikasi**

Run: `npm run build`
Expected: build sukses, route `/video` muncul.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(dashboard)/video/video-board.tsx" "src/app/(dashboard)/video/page.tsx"
git commit -m "feat: video board page (owner all, editor own) with type filter"
```

---

## Task 8: Tombol aksi transisi status

**Files:**
- Create: `src/app/(dashboard)/video/[id]/status-actions.tsx`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/video/[id]/status-actions.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyVideoAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTIONS, ACTION_LABEL, type VideoAction } from "@/lib/video-workflow";

export function StatusActions({ videoId, actions }: { videoId: string; actions: VideoAction[] }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState("");
  const router = useRouter();
  const needsLink = actions.some((a) => ACTIONS[a].requiresLink);

  if (actions.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada aksi untuk Anda di status ini.</p>;
  }

  function run(action: VideoAction) {
    start(async () => {
      const res = await applyVideoAction(videoId, action, link || undefined);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(ACTION_LABEL[action] + " berhasil");
      setLink("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {needsLink && (
        <div className="space-y-1">
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
  );
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/video/[id]/status-actions.tsx"
git commit -m "feat: video status action buttons (button-based transitions)"
```

---

## Task 9: Komentar (daftar + form)

**Files:**
- Create: `src/app/(dashboard)/video/[id]/comments.tsx`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/video/[id]/comments.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { addComment } from "../actions";
import { Button } from "@/components/ui/button";

type C = { id: string; isi: string; created_at: string; nama: string };

export function Comments({ videoId, comments }: { videoId: string; comments: C[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!text.trim()) return;
    start(async () => {
      const res = await addComment(videoId, text);
      if (!res.ok) { toast.error(res.error ?? "Gagal kirim komentar"); return; }
      setText(""); router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Komentar & Catatan</h3>
      <div className="space-y-2">
        {comments.map((c) => (
          <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-md border p-2 text-sm">
            <div className="mb-0.5 flex justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{c.nama}</span>
              <span>{new Date(c.created_at).toLocaleString("id-ID")}</span>
            </div>
            <p className="whitespace-pre-wrap">{c.isi}</p>
          </motion.div>
        ))}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">Belum ada komentar.</p>}
      </div>
      <div className="flex gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
          className="flex-1 rounded-md border p-2 text-sm" placeholder="Tulis catatan revisi / komentar..." />
        <Button disabled={pending} onClick={submit}>Kirim</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/video/[id]/comments.tsx"
git commit -m "feat: video comments list + form"
```

---

## Task 10: Halaman detail video

**Files:**
- Create: `src/app/(dashboard)/video/[id]/page.tsx`

- [ ] **Step 1: Implementasi**

Create `src/app/(dashboard)/video/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getVideo, getDrafts, getComments, getStatusEvents } from "@/lib/videos";
import { createClient } from "@/lib/supabase/server";
import { actionsFor, STATUS_LABEL, TYPE_LABEL } from "@/lib/video-workflow";
import { StatusActions } from "./status-actions";
import { Comments } from "./comments";
import { Badge } from "@/components/ui/badge";

export default async function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const video = await getVideo(id); // null jika bukan peserta (RLS) -> 404
  if (!video) notFound();

  const [drafts, comments, events] = await Promise.all([
    getDrafts(id), getComments(id), getStatusEvents(id),
  ]);

  // Nama untuk komentar & editor
  const supabase = await createClient();
  const { data: profs } = await supabase.from("profiles").select("id, nama");
  const namaById = new Map((profs ?? []).map((p: { id: string; nama: string }) => [p.id, p.nama]));

  const actions = actionsFor(video.status, profile.role);
  const commentView = comments.map((c) => ({
    id: c.id, isi: c.isi, created_at: c.created_at,
    nama: c.user_id ? namaById.get(c.user_id) ?? "—" : "—",
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <Link href="/video" className="text-sm text-muted-foreground hover:underline">← Kembali</Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{video.judul}</h1>
            <Badge>{STATUS_LABEL[video.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {TYPE_LABEL[video.tipe]}
            {video.editor_id ? ` · Editor: ${namaById.get(video.editor_id) ?? "—"}` : " · belum ditugaskan"}
          </p>
          {video.link_source && (
            <a href={video.link_source} target="_blank" rel="noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline">Link source ↗</a>
          )}
        </div>

        <StatusActions videoId={video.id} actions={actions} />

        <div className="space-y-2">
          <h3 className="font-medium">Riwayat Draft</h3>
          {drafts.length === 0 && <p className="text-sm text-muted-foreground">Belum ada draft.</p>}
          {drafts.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>Draft {d.nomor_draft}</span>
              <a href={d.link_draft} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                Buka link ↗
              </a>
            </div>
          ))}
        </div>

        <Comments videoId={video.id} comments={commentView} />
      </div>

      <aside className="space-y-2">
        <h3 className="font-medium">Timeline Status</h3>
        <ol className="space-y-2 border-l pl-4">
          {events.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="font-medium">{STATUS_LABEL[e.status_baru]}</span>
              <span className="block text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString("id-ID")}
              </span>
            </li>
          ))}
          {events.length === 0 && <li className="text-sm text-muted-foreground">Belum ada perubahan status.</li>}
        </ol>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi**

Run: `npm run build`
Expected: build sukses, route `/video/[id]` muncul.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/video/[id]/page.tsx"
git commit -m "feat: video detail page (info, drafts, timeline, actions, comments)"
```

---

## Task 11: Lonceng notifikasi + halaman notifikasi

**Files:**
- Create: `src/components/notif-bell.tsx`, `src/app/(dashboard)/notifikasi/page.tsx`, `src/app/(dashboard)/notifikasi/actions.ts`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Action tandai dibaca**

Create `src/app/(dashboard)/notifikasi/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markAllRead() {
  await requireProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ sudah_dibaca: true }).eq("sudah_dibaca", false);
  revalidatePath("/notifikasi");
  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 2: Lonceng**

Create `src/components/notif-bell.tsx`:
```tsx
import Link from "next/link";
import { unreadCount } from "@/lib/notifications";

export async function NotifBell() {
  const count = await unreadCount();
  return (
    <Link href="/notifikasi" className="relative inline-flex items-center rounded-md px-2 py-1 text-sm hover:bg-muted">
      <span aria-hidden>🔔</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 3: Halaman notifikasi**

Create `src/app/(dashboard)/notifikasi/page.tsx`:
```tsx
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import { markAllRead } from "./actions";
import { Button } from "@/components/ui/button";

export default async function NotifikasiPage() {
  await requireProfile();
  const items = await listNotifications();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifikasi</h1>
        <form action={markAllRead}><Button variant="ghost" size="sm">Tandai semua dibaca</Button></form>
      </div>
      <div className="space-y-2">
        {items.map((n: { id: string; pesan: string; link: string | null; sudah_dibaca: boolean; created_at: string }) => (
          <Link key={n.id} href={n.link ?? "#"}
            className={`block rounded-md border p-3 text-sm ${n.sudah_dibaca ? "opacity-60" : "bg-muted/40"}`}>
            <p>{n.pesan}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("id-ID")}</p>
          </Link>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Belum ada notifikasi.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Sisipkan lonceng ke header layout**

Modify `src/app/(dashboard)/layout.tsx` — tambah import dan render `<NotifBell />` di header (di kiri tombol "Keluar"). Tambahkan di bagian atas:
```tsx
import { NotifBell } from "@/components/notif-bell";
```
Ubah blok header menjadi:
```tsx
        <header className="flex items-center justify-between border-b px-6 py-3">
          <span className="text-sm capitalize text-muted-foreground">{profile.role}</span>
          <div className="flex items-center gap-2">
            <NotifBell />
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">Keluar</Button>
            </form>
          </div>
        </header>
```

- [ ] **Step 5: Verifikasi**

Run: `npm run build`
Expected: build sukses, route `/notifikasi` muncul. `<NotifBell>` adalah async server component (boleh di-render di server layout).

- [ ] **Step 6: Commit**
```bash
git add "src/app/(dashboard)/notifikasi" src/components/notif-bell.tsx "src/app/(dashboard)/layout.tsx"
git commit -m "feat: notification bell (unread count) + notifications page"
```

---

## Task 12: Verifikasi alur end-to-end (live)

**Files:**
- Create: `scripts/verify-video-flow.mjs`

- [ ] **Step 1: Skrip verifikasi alur**

Create `scripts/verify-video-flow.mjs`:
```js
// Verifikasi alur status + RLS video. Jalankan:
//   node --experimental-websocket --env-file=.env.local scripts/verify-video-flow.mjs "<owner_password>"
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerPw = process.argv[2];
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);
let fail = 0;
const check = (n, c, d) => { console.log(`${c ? "PASS" : "FAIL"}: ${n}${d ? " — " + d : ""}`); if (!c) fail++; };

// Owner login
const owner = createClient(url, anon, opts);
await owner.auth.signInWithPassword({ email: "alfred.budiman@gmail.com", password: ownerPw });

// Buat 2 editor sementara
const mk = async (role) => {
  const email = `t-${role}-${crypto.randomBytes(3).toString("hex")}@example.com`;
  const pw = "Pw-" + crypto.randomBytes(6).toString("base64url");
  const { data } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { nama: role, role } });
  return { id: data.user.id, email, pw };
};
const edA = await mk("editor");
const edB = await mk("editor");

// Owner buat video utk editor A
const ins = await owner.from("videos").insert({ judul: "Vid A", tipe: "monolog", status: "draft_brief", editor_id: edA.id }).select("id").single();
check("owner buat video", !ins.error, ins.error?.message);
const vid = ins.data?.id;

// Editor A login -> lihat video; Editor B login -> tidak lihat
const cliA = createClient(url, anon, opts); await cliA.auth.signInWithPassword({ email: edA.email, password: edA.pw });
const cliB = createClient(url, anon, opts); await cliB.auth.signInWithPassword({ email: edB.email, password: edB.pw });
const aSees = await cliA.from("videos").select("id").eq("id", vid);
const bSees = await cliB.from("videos").select("id").eq("id", vid);
check("editor A lihat video miliknya", aSees.data?.length === 1);
check("editor B TIDAK lihat video editor A (RLS)", (bSees.data?.length ?? 0) === 0);

// Editor B tidak bisa update video editor A
const bHack = await cliB.from("videos").update({ status: "review_cut" }).eq("id", vid);
const after = await admin.from("videos").select("status").eq("id", vid).single();
check("editor B TIDAK bisa ubah video editor A", after.data?.status === "draft_brief", "status=" + after.data?.status);

// Cleanup
await admin.from("videos").delete().eq("id", vid);
await admin.auth.admin.deleteUser(edA.id);
await admin.auth.admin.deleteUser(edB.id);
console.log(`\n${fail === 0 ? "SEMUA LULUS ✅" : fail + " GAGAL ❌"}`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Jalankan**

Run: `node --experimental-websocket --env-file=.env.local scripts/verify-video-flow.mjs "<owner_password>"`
Expected: SEMUA LULUS ✅ (RLS isolasi video antar editor terbukti).

- [ ] **Step 3: Smoke test UI manual (opsional, oleh owner/dev)**

Jalankan `npm run dev`, login owner: buat video monolog → tugaskan editor → login editor (browser lain) → `start_cut` → `submit_cut` (isi link) → login owner → `approve_cut` → editor `submit_draft` → owner `request_revision` → editor `submit_draft` lagi → owner `approve_final` → `mark_tayang`. Cek timeline & notifikasi terisi.

- [ ] **Step 4: Commit**
```bash
git add scripts/verify-video-flow.mjs
git commit -m "test: live verification of video RLS isolation"
```

---

## Self-Review (oleh penulis)

**Spec coverage (modul Video Editor):**
- Alur status + gate approval + loop revisi tak terbatas → Task 2 (state machine) + Task 5 (actions) + Task 8 (buttons). ✅
- Clipping skip cut-to-cut + wajib induk → `initialStatus` (Task 2) + validasi `createVideo` (Task 5) + picker (Task 6). ✅
- Tipe video (monolog/podcast/shorts/clipping) → enum (Task 1), filter papan (Task 7). ✅
- Riwayat tiap draft tersimpan (append-only) → tabel drafts + `createsDraft` (Task 1/5), tampil di detail (Task 10). ✅
- Komentar in-app → Task 9 + addComment (Task 5). ✅
- Notifikasi in-app (count saat load; Realtime menyusul) → Task 4 + bell (Task 11) + notify pada transisi/komentar (Task 5). ✅
- Owner lihat semua / editor lihat miliknya → RLS (Task 1) + listVideos (Task 3) + page (Task 7); diverifikasi Task 12. ✅
- status_events utk rekap kecepatan (dipakai Fase 3) → ditulis pada tiap transisi (Task 5). ✅
- Papan kanban dengan kolom status; transisi via tombol (keputusan) → Task 7 + Task 8. ✅

**Placeholder scan:** tidak ada TBD/placeholder; semua step berisi kode konkret.

**Type consistency:** `VideoType`, `VideoStatus`, `VideoAction`, `ACTIONS`, `actionsFor`, `applyAction`, `initialStatus`, `STATUS_ORDER/LABEL`, `TYPE_LABEL`, `ACTION_LABEL`, `VideoRow/DraftRow/CommentRow/StatusEventRow`, `notify/unreadCount/listNotifications` konsisten lintas task.

**Catatan dependensi:** Task 8/9 (komponen) di-import oleh Task 10 (detail page); build penuh hijau setelah Task 10. Task 11 menyisipkan bell ke layout Fase 1.

## Di luar cakupan Fase 2 (fase lain)
- Realtime live update (komentar/notif tanpa refresh) — polish menyusul.
- Stok Konten + Rekap Kinerja (pakai status_events & final/tayang) — Fase 3.
- Absensi — Fase 4.
- Drag-and-drop kanban — tidak dipakai (keputusan: tombol aksi).
