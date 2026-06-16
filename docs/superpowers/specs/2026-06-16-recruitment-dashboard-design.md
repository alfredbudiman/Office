# Recruitment Dashboard — Design Spec

**Date:** 2026-06-16
**Status:** Approved (design), pending implementation
**Author:** Alfred + Claude

## Tujuan

Menambahkan satu menu **Recruitment** ke aplikasi Office (Next.js 16 + Supabase),
hasil port dari dashboard recruitment standalone (`Dashboard Recruitment Sproutlab.html`).
Menu dikunci password sederhana agar tim editor & tim recruiter terpisah aksesnya.

## Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Integrasi | Port penuh ke komponen React/Next (bukan iframe) |
| Data seed | Data asli Sproutlab (~25 kandidat dari Glints) |
| Visibilitas menu | Muncul untuk semua role (owner/editor/hrd), dikunci password |
| Password gate | Client-side, `Sabina26` dicek di browser, disimpan di `sessionStorage` (ingat 1 sesi browser) |
| Penyimpanan data | Supabase (shared antar perangkat & user) |
| Chart | Tambah library `recharts` untuk doughnut "Kandidat per Source" |
| Tema | Ikut tema app (Tailwind + dark mode), nuansa Sprout |

> Catatan keamanan (disepakati): password ada di bundle JS. Ini pemisah praktis
> editor vs recruiter, bukan keamanan kriptografis. Sesuai keinginan: yang tahu
> password bisa masuk, yang tidak tahu tidak bisa.

## Data model

### Tahap pipeline (7)
`sourcing` → `screening` → `followup` → `interview_hr` → `interview_alfred` → `onboarding` → `agent`

### Outcome (4)
`active`, `talent_pool`, `tidak_lolos`, `agent_aktif`

### Konstanta
- **Sources:** WhatsApp, Instagram, LinkedIn, Referral, Glints, Event, Walk-in (text bebas, default list)
- **Jalur:** Freelance, Prohire Sprout, Prohire Prudential (text bebas; boleh kosong)
- **Docs onboarding:** selfie, ktp, ktp_pasangan (opsional), ijazah_kk, tabungan, npwp (opsional)

### Field kandidat (port dari HTML)
identitas: name, whatsapp, email, domisili, birth, marital, education, jurusan, universitas,
sales_exp, experience, cv_note;
pipeline: source, jalur, stage, outcome, max_reached, stage_since, date_in, last_updated, archived;
follow up: interest, follow_note, last_contact, next_follow_up;
interview: interview_at (text datetime-local lokal), interview_done, score_hr, note_hr, rec_hr, note_alfred;
onboarding/kontrak: docs (jsonb), doc_link, join_date, contract_status, contract_link;
agent: agent_code, agent_status;
lain: code (CND-####), history (jsonb array `{d,t}`).

## Database — migrasi `supabase/migrations/0008_recruitment.sql`

- Tabel `public.recruitment_candidates`:
  - `id uuid primary key default gen_random_uuid()`
  - `code text unique` (CND-####)
  - kolom snake_case untuk semua field di atas
  - `stage text not null check (stage in (...))`, `outcome text not null check (outcome in (...))`
  - tanggal (`date_in`, `stage_since`, `last_updated`, `next_follow_up`, `last_contact`, `join_date`, `birth`) → tipe `date` (nullable kecuali `date_in`)
  - `interview_at text` (simpan string datetime-local lokal apa adanya — hindari pergeseran timezone)
  - `history jsonb not null default '[]'`, `docs jsonb not null default '{}'`
  - `max_reached int not null default 0`, `score_hr int`
  - `archived boolean not null default false`, `interview_done boolean not null default false`
  - `created_at timestamptz not null default now()`
- Dua sequence: `recruitment_cand_seq`, `recruitment_agent_seq` untuk nomor CND-#### & AGT-####.
- Index: `(stage)`, `(outcome)`, `(whatsapp)`, unique `(whatsapp)` untuk seed idempoten.
- **RLS:** semua user terautentikasi boleh select/insert/update/delete
  (pemisah nyata = password di UI). Policy mengikuti pola repo (`auth.uid() is not null`).
- **Seed:** ~25 kandidat asli Glints sebagai INSERT idempoten (`on conflict (whatsapp) do nothing`),
  dengan `stage`/`outcome`/histori sesuai data asli.
- **Settings:** `follow_up_days` & `stale_days` pakai tabel `settings` yang sudah ada
  (key `recruitment_follow_up_days` default 3, `recruitment_stale_days` default 7) via `getSetting`/`setSetting`.

## Struktur kode

### `src/lib/recruitment.ts` (+ `recruitment.test.ts`)
- Tipe `Candidate` (camelCase) + `CandidateRow` (snake_case dari DB) + mapper dua arah.
- Konstanta: `STAGES`, `SOURCES`, `JALUR`, `DOCS`, `OUTCOME_TAG`.
- Helper murni (unit-tested via vitest, sesuai pola repo):
  `stageIndex`, `stageLabel`, `isOverdue`, `isStale`, `daysInStage`, `daysBetween`, `addDays`,
  `normWa`, `funnelData`, `sourceBreakdown`.

### `src/app/(dashboard)/recruitment/`
- `page.tsx` (server): `requireProfile()` → fetch kandidat + settings → render `<RecruitmentApp/>`.
- `gate.tsx` (client): form password `Sabina26`, simpan `sessionStorage`, lalu tampilkan app.
- `recruitment-app.tsx` (client): state tab aktif + filter jalur + render 4 view + modal.
- `kanban-board.tsx`: drag-drop native HTML5 (tanpa dependency).
- `candidate-table.tsx`: tabel + filter (outcome/stage/source/overdue/arsip) + sort + search.
- `dashboard-view.tsx`: KPI + funnel (bar CSS) + doughnut per-source (`recharts`).
- `interview-view.tsx`: jadwal wawancara (belum/sudah, KPI, salin jadwal).
- `candidate-modal.tsx`: detail bertahap (section muncul sesuai tahap), tombol keputusan,
  follow-up, onboarding docs, kontrak, histori, arsip/hapus.
- `actions.ts` (server actions, `"use server"`): `createCandidate`, `updateCandidate`,
  `moveStage`, `setOutcome`, `reactivate`, `promoteAgent`, `archive`/`unarchive`, `deleteCandidate`,
  `contactedToday`, `updateSettings`, `importMerge`. Tiap mutasi `revalidatePath("/recruitment")`.

### Navigasi
- `src/lib/roles.ts`: tambah `{ label: "Recruitment", href: "/recruitment" }` ke owner, editor, hrd.
- `src/components/sidebar.tsx`: tambah ikon `/recruitment` (lucide `UserSearch`).

### Dependency
- Tambah `recharts` ke `package.json`.

## Fitur: diport vs disesuaikan

**Diport penuh:** 4 tab; modal detail bertahap; keputusan tahap (Lanjut/Talent Pool/Tidak Lolos);
promote agent + cek dokumen/kontrak; follow-up bar & interview-today bar; filter/sort/search tabel;
KPI; funnel + conversion rate; export JSON/CSV/Agen (download client-side); import-merge dari file.

**Disesuaikan / dihapus:** data dari Supabase (bukan localStorage); tombol "Ganti (import/replace semua)"
dan "backup reminder bar" **dihapus** (berbahaya/irelevan di DB bersama). Import-merge tetap ada
(berguna memindahkan data localStorage lama ke DB). Tema ikut app (dark mode), bukan hijau hardcoded.

## Yang dijalankan user setelah implementasi
1. `npm install` (menarik `recharts`).
2. Pastikan env Supabase terisi (`.env.local`).
3. `npm run db:migrate supabase/migrations/0008_recruitment.sql`.
4. `npm run dev` → buka `/recruitment` → isi password `Sabina26`.

## Risiko & catatan
- Drag-drop native HTML5 perlu uji di browser target (Chrome/Safari).
- `interview_at` disimpan sebagai text lokal supaya tidak bergeser timezone (konsisten dgn HTML asli).
- Password di client bundle (diterima sebagai trade-off).
- Generasi `code` (CND-####) via sequence Postgres agar aman dari race condition.
