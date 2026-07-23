-- Kolom milestone agent untuk tab Dashboard (Journey → Milestone Agent).
-- Diisi manual oleh owner/hrd lewat tabel editable. Nullable, tanpa perubahan RLS
-- (policy update recruitment_candidates yang ada sudah mencakup owner + hrd).
alter table public.recruitment_candidates
  add column if not exists ms_first_office date,
  add column if not exists ms_aaji date,
  add column if not exists ms_first_closing date;
