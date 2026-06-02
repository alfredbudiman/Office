# Flow Improvements — Design Spec

**Tanggal:** 2026-06-02
**Status:** Draft, menunggu review
**Konteks:** Iterasi UX setelah Fase 1–4 selesai. Alfred mengidentifikasi friksi di flow harian: link komentar tidak bisa di-klik, state machine terlalu kaku, kebutuhan tipe video bebas, default editor, akses cepat folder Drive, dan ringkasan kerja saat clock out.

## Tujuan

Menambahkan 6 perbaikan flow ke aplikasi SPROUT:

1. URL di komentar bisa di-klik
2. Owner bisa lompat status video bebas (force set status)
3. Tipe video bisa diisi bebas (opsi "Lainnya" + teks custom)
4. Form video baru pre-select editor (Agus, satu-satunya editor saat ini)
5. Halaman Pengaturan menyimpan 1 link folder Drive (hasil semua video), tampil di sidebar + dashboard
6. Clock out menghasilkan ringkasan kerja harian otomatis + tombol kirim ke WA Alfred (`08112634321` → `wa.me/62...`)

## Non-tujuan

- Rich text editor di komentar (auto-link cukup)
- Per-user nomor WA settings (Alfred-only sekarang, 1 nomor hardcode)
- Detail stok breakdown by `tipe_custom` (bucket "Lainnya" tunggal dulu)
- Otomatis kirim WA tanpa interaksi user (bahaya kalau error tidak ke-detect)
- Provider WA berbayar (Fonnte/Twilio) — `wa.me` link cukup untuk kebutuhan internal

## Data Model

### Migrasi baru — **2 file** (Postgres gotcha)

`ALTER TYPE ... ADD VALUE` tidak boleh dipakai di transaksi yang sama dengan statement yang me-reference value baru itu. Jadi dipecah:

**`supabase/migrations/0005_add_lainnya_enum.sql`** — cuma 1 statement:

```sql
alter type video_type add value if not exists 'lainnya';
```

**`supabase/migrations/0006_flow_improvements.sql`** — sisa schema changes (boleh pakai `'lainnya'`):

```sql
alter table public.videos add column tipe_custom text;
alter table public.videos add constraint videos_tipe_custom_required
  check (tipe <> 'lainnya' or (tipe_custom is not null and char_length(tipe_custom) between 1 and 50));
```

(Lanjut di `0006_flow_improvements.sql`:)

**Tambah tabel `settings`:**

```sql
create table public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.settings enable row level security;
create policy "settings_select" on public.settings for select using (true);
create policy "settings_write" on public.settings for all
  using (public.is_owner()) with check (public.is_owner());
```

Seed key: `drive_folder_url` (kosong dulu).

**Tambah kolom `attendance.progress_summary`:**

```sql
alter table public.attendance add column progress_summary text;
```

**Tambah kolom `status_events.note`:**

```sql
alter table public.status_events add column note text;
```

## State Machine — Force Set Status (Owner)

### `src/lib/video-workflow.ts`

- **JANGAN** masukin `force_set_status` ke dict `ACTIONS` (yang typed dengan `from`/`to` konstan) — biar invariant action normal tetap clean.
- Tambah type `VideoAction` jadi: `existing actions | "force_set_status"`.
- Tambah `ACTION_LABEL.force_set_status = "Ubah status manual"`.
- `actionsFor()` tidak return `force_set_status` (panel khusus di UI yang nampilin).
- Validasi rule untuk force_set di-handle di server action, bukan via `applyAction()` helper.

### `src/app/(dashboard)/video/actions.ts` — `applyVideoAction`

Branch baru:
- Jika `action === 'force_set_status'`:
  - Validasi role owner.
  - Validasi target status valid (∈ `STATUS_ORDER`).
  - Validasi `note` (3–200 char).
  - Tolak kalau `targetStatus === video.status`.
  - Update `videos.status = targetStatus` + side-effects:
    - Pindah **ke** `'final'` → set `final_at = now()` (kalau belum ada).
    - Pindah **dari** `'final'` ke status lain → clear `final_at = null`.
    - Pindah **ke** `'tayang'` → set `sudah_tayang=true`, `published_at=now()`.
    - Pindah **dari** `'tayang'` ke status lain → set `sudah_tayang=false`, `published_at=null`.
    - Tidak ada side-effect `link_draft` (owner aware).
  - Insert `status_events { status_lama, status_baru: targetStatus, note, changed_by }`.
  - Notifikasi editor seperti aksi normal.

### Frontend — `src/app/(dashboard)/video/[id]/status-actions.tsx`

- Di bawah tombol-tombol normal, tambah panel kecil (hanya untuk owner):
  - Dropdown `STATUS_LABEL` (exclude status saat ini).
  - Textarea `note` (placeholder "Alasan singkat lompat status...").
  - Tombol kuning "Ubah status manual".
  - Warning kecil: "Lompat status — pastikan sengaja."
- Panel cuma render kalau `profile.role === 'owner'` (props baru `isOwner: boolean`).

### Timeline — `src/app/(dashboard)/video/[id]/page.tsx`

- Render `event.note` di bawah label status kalau ada, italic, muted-foreground.

## Comments Clickable

### `src/lib/linkify.ts` + `linkify.test.ts`

Pure function:

```ts
export type Part = { type: 'text'; value: string } | { type: 'link'; value: string };
export function linkify(text: string): Part[];
```

- Regex: `/(https?:\/\/[^\s]+|wa\.me\/[^\s]+|www\.[^\s]+)/gi`.
- Tiap match dicek: kalau valid URL (gunakan `new URL()` dengan prefix `http://` untuk `www.`), masuk part `link`. Kalau tidak, masuk part `text`.
- Trim trailing punctuation `.,!?)]>` dari URL (push ke text berikutnya).
- Test cases: plain text, single URL, multiple URLs, URL di akhir kalimat dengan titik, `www.x.com`, `wa.me/628...`, URL yang invalid (cuma "https://" tanpa host), text dengan newline.

### `src/app/(dashboard)/video/[id]/comments.tsx`

- Ganti `<p>{c.isi}</p>` jadi:

```tsx
<p className="text-sm whitespace-pre-wrap text-foreground/80">
  {linkify(c.isi).map((p, i) =>
    p.type === 'link' ? (
      <a key={i} href={p.value.startsWith('http') ? p.value : `https://${p.value}`}
         target="_blank" rel="noreferrer"
         className="text-brand underline-offset-2 hover:underline break-all">
        {p.value}
      </a>
    ) : (
      <span key={i}>{p.value}</span>
    )
  )}
</p>
```

## Free-format Type "Lainnya"

### `src/lib/video-workflow.ts`

- `VideoType` tambah `'lainnya'`.
- `TYPE_LABEL` tambah `lainnya: "Lainnya"`.
- Tambah helper `typeLabel(row: { tipe: VideoType; tipe_custom: string | null }): string`:
  - Return `row.tipe_custom ?? "Lainnya"` kalau `tipe === 'lainnya'`, else `TYPE_LABEL[row.tipe]`.

### `src/lib/videos.ts`

- `VideoRow` tambah `tipe_custom: string | null`.
- Semua `select(...)` include `tipe_custom`.

### `src/app/(dashboard)/video/new-video-form.tsx`

- Tambah `<option value="lainnya">Lainnya</option>`.
- Kalau `tipe === 'lainnya'`, tampilkan field text `tipe_custom` (placeholder "mis. Behind the scenes, Tutorial, dll", max 50 char).
- Default editor: kalau `editors.length > 0`, pre-select `editors[0].id`. Opsi "— belum ditugaskan —" dipindah ke bawah dropdown (atau tetap di atas dengan default = editors[0]).

### `src/app/(dashboard)/video/actions.ts` — `createVideo`

- Validasi tambahan: kalau `tipe === 'lainnya'` → `tipe_custom` wajib (1–50 char setelah trim). Errors: `tipe_custom`.
- Insert `tipe_custom` ke DB (null kalau tipe ≠ 'lainnya').

### Stok & Rekap

- `src/lib/stock.ts` — `STOCK_TYPES` tambah `'lainnya'`. `stockReadyByType` init `lainnya: 0`. Bucket tunggal.
- `src/app/(dashboard)/stok/page.tsx` — render baris "Lainnya" di tabel.
- Rekap kecepatan tidak terpengaruh (tidak per-tipe).

### Detail page + board

- `video-board.tsx` dan `video/[id]/page.tsx` — tampilkan `typeLabel(video)` di tempat `TYPE_LABEL[video.tipe]` saat ini.

## Settings — Drive Folder URL

### `src/lib/settings.ts`

```ts
export async function getSetting(key: string): Promise<string | null>;
export async function setSetting(key: string, value: string): Promise<{ ok: boolean; error?: string }>;
```

- `getSetting` pakai server client, read-only (RLS allow-all).
- `setSetting` pakai admin client (atau server client karena RLS sudah membatasi ke owner via policy). Pakai upsert.

### `src/app/(dashboard)/pengaturan/page.tsx` + `actions.ts`

- Halaman baru, owner-only. Redirect kalau bukan owner.
- Form 1 field: `drive_folder_url` (label "URL Folder Drive (hasil semua video)").
- Server action `saveDriveFolderUrl(formData)`:
  - Validasi URL (`new URL()`).
  - Panggil `setSetting('drive_folder_url', value)`.
  - `revalidatePath('/', 'layout')` agar sidebar refresh.

### Sidebar — `src/components/sidebar.tsx`

- Fetch `getSetting('drive_folder_url')` di server component sekali.
- Kalau ada, render link di section bawah sidebar:
  - Icon `Folder` dari `lucide-react`.
  - Label "Folder Drive Final".
  - `target="_blank"`, `rel="noreferrer"`.

### Dashboard — `src/app/(dashboard)/dashboard/page.tsx`

- Kalau `drive_folder_url` ada, render card kecil "Folder Hasil" dengan tombol "Buka di Drive" (external link).

### Sidebar menu

- Tambah item "Pengaturan" → `/pengaturan`, owner-only.

## Clock Out — Progress Summary + WA Link

### `src/lib/progress-summary.ts` + test

Pure helper:

```ts
export type SummaryInput = {
  nama: string;
  clockOutTime: Date;
  statusMoves: { judul: string; statusBaru: VideoStatus }[];
  comments: { judul: string; isi: string }[];
  extraNote?: string;
};

export function buildProgressSummary(input: SummaryInput): string;
```

Output format:

```
Halo, saya {nama} selesai jam {HH:mm}.

Yang dikerjakan:
• {judul A} → Editing
• {judul B} → Review Draft

Komentar:
• {judul A}: revisi BGM bagian intro...

Catatan: {extraNote}
```

- Section dihilangkan kalau kosong (mis. tidak ada komentar hari ini → skip "Komentar:").
- Comment preview di-truncate ke 80 char + "...".
- Kalau tidak ada aktivitas sama sekali, output minimal "Halo, saya {nama} selesai jam {HH:mm}." + catatan.

### `src/app/(dashboard)/absensi/actions.ts`

- `clockOut(extraNote?: string)`:
  - Cek `existing.clock_in` dan belum `clock_out` (sudah ada).
  - Query `status_events` user hari ini sejak `existing.clock_in`:
    - Join `videos` untuk dapat `judul`.
    - Filter `changed_by = profile.id`.
  - Query `comments` user hari ini sejak `existing.clock_in`:
    - Join `videos` untuk dapat `judul`.
    - Filter `user_id = profile.id`.
  - Bangun `summary = buildProgressSummary({...})`.
  - Update `attendance` set `clock_out = now()`, `progress_summary = summary`.
  - Return `{ ok: true, summary, role: profile.role, nama: profile.nama }`.

### `src/app/(dashboard)/absensi/clock-card.tsx`

- Tambah state `extraNote: string` + textarea kecil yang muncul saat mau Clock Out (collapsible "Catatan tambahan").
- Setelah `clockOut(extraNote)` sukses:
  - Kalau `role === 'editor'`:
    - Render `<ClockoutModal summary={summary} />`.
    - Modal: textarea editable (preview pesan), tombol "Kirim via WhatsApp", tombol "Salin pesan", tombol "Tutup".
    - WA button: `window.open(\`https://wa.me/628112634321?text=${encodeURIComponent(text)}\`, '_blank')`.
    - Salin pesan: `navigator.clipboard.writeText(text)` + toast.
  - Kalau `role !== 'editor'`: toast "Berhasil clock out" (summary tetap tersimpan, no modal).

### `src/app/(dashboard)/absensi/clockout-modal.tsx`

- Component baru. Props: `summary: string`, `onClose: () => void`.
- Sederhana: backdrop + card + textarea + 3 tombol.

### `src/lib/wa.ts`

```ts
export const ALFRED_WA = "628112634321";
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
```

## Error Handling

- WA link gagal buka (popup blocker): tetap sediakan tombol "Salin pesan" sebagai fallback.
- Force set ke status yang sama: tolak dengan pesan "Status sudah X".
- Force set tanpa note atau note < 3 char: tolak dengan pesan.
- Linkify input mengandung URL invalid: fallback ke text (URL constructor check, tidak emit `<a>`).
- `tipe='lainnya'` tanpa `tipe_custom`: server reject + UI nampilin error inline.
- Drive folder URL invalid: server reject + UI nampilin error inline. Sidebar fallback ke tidak render link.
- Clock out tanpa `clock_in` atau sudah clock_out: error message existing tetap.

## Testing

### Unit tests (vitest, env=node)

- `linkify.test.ts`: 8+ cases (plain, single URL, multi URL, URL di akhir kalimat, `www.`, `wa.me`, invalid URL, text dengan newline)
- `progress-summary.test.ts`: empty, only statusMoves, only comments, both, with extraNote, comment truncation
- `video-workflow.test.ts`: existing tests tetap pass. Tambah test untuk `force_set_status` (validasi role, note required, side-effects `final`/`tayang`).

### Manual smoke (post-deploy)

1. Login Alfred → tambah video tipe "Lainnya" → input `tipe_custom="Tutorial"` → sukses, label muncul "Tutorial" di board.
2. Detail video → tulis komentar berisi `https://docs.google.com/x` → reload → URL clickable, buka tab baru.
3. Owner di detail video status `editing` → panel "Ubah status manual" → pilih `final` → note "Test lompat" → submit. Timeline aside nampilin "Final" + italic note.
4. Settings → paste URL Drive `https://drive.google.com/drive/folders/xxx` → simpan. Sidebar nampilin link "Folder Drive Final".
5. Login Agus (editor) → clock in → tulis 1 komentar di video → ubah status video (mis. submit_draft) → clock out (tulis extraNote "Selesai cut episode 5") → modal muncul dengan preview pesan → klik "Kirim via WhatsApp" → tab baru `wa.me/628112634321?text=...` terbuka dengan pesan ter-prefilled berisi nama, jam, status moves, komentar, catatan.
6. Login Alfred → cek `/absensi` → riwayat hari Agus muncul + `progress_summary` (untuk rekap HRD nanti).

## File Layout

**File baru:**
- `supabase/migrations/0005_add_lainnya_enum.sql`
- `supabase/migrations/0006_flow_improvements.sql`
- `src/lib/linkify.ts` + `src/lib/linkify.test.ts`
- `src/lib/settings.ts`
- `src/lib/progress-summary.ts` + `src/lib/progress-summary.test.ts`
- `src/lib/wa.ts`
- `src/app/(dashboard)/pengaturan/page.tsx`
- `src/app/(dashboard)/pengaturan/actions.ts`
- `src/app/(dashboard)/absensi/clockout-modal.tsx`

**File yang berubah:**
- `src/lib/video-workflow.ts` — tambah `'lainnya'`, `force_set_status`, helper `typeLabel`
- `src/lib/videos.ts` — tambah `tipe_custom` di types & select
- `src/lib/stock.ts` — bucket `'lainnya'`
- `src/lib/attendance-data.ts` — include `progress_summary` di select
- `src/app/(dashboard)/video/actions.ts` — handle `tipe='lainnya'`, branch `force_set_status`
- `src/app/(dashboard)/video/new-video-form.tsx` — opsi "Lainnya", default editor
- `src/app/(dashboard)/video/[id]/page.tsx` — tampilan `typeLabel`, timeline `note`
- `src/app/(dashboard)/video/[id]/comments.tsx` — linkify
- `src/app/(dashboard)/video/[id]/status-actions.tsx` — panel force_set untuk owner
- `src/app/(dashboard)/video/video-board.tsx` — `typeLabel`
- `src/app/(dashboard)/stok/page.tsx` — baris "Lainnya"
- `src/app/(dashboard)/absensi/actions.ts` — `extraNote`, summary, return shape
- `src/app/(dashboard)/absensi/clock-card.tsx` — textarea + modal trigger
- `src/components/sidebar.tsx` — link Drive Folder + menu Pengaturan (owner-only)
- `src/app/(dashboard)/dashboard/page.tsx` — card "Folder Hasil"
