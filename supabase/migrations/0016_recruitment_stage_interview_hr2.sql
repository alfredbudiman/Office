-- Tambah tahap "Interview HR 2" ke pipeline recruitment.
-- CHECK constraint lama (0008) belum mengizinkan 'interview_hr2', sehingga kandidat
-- tak bisa dipindah ke tahap ini. Drop & buat ulang constraint dengan nilai baru.
alter table public.recruitment_candidates
  drop constraint if exists recruitment_candidates_stage_check;

alter table public.recruitment_candidates
  add constraint recruitment_candidates_stage_check
  check (stage in (
    'sourcing','screening','followup','interview_hr','interview_hr2',
    'interview_alfred','onboarding','agent'
  ));
