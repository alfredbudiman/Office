-- ============================================================================
-- TEMPEL SEMUA INI ke Supabase Dashboard → SQL Editor → Run. Aman & idempoten.
-- Menerapkan: kolom milestone (0015) + tahap interview_hr2 (0016) + rekonsiliasi
-- max_reached (0017). Bisa dijalankan ulang tanpa efek samping.
-- ============================================================================

-- 0015: kolom milestone agent
alter table public.recruitment_candidates
  add column if not exists ms_first_office date,
  add column if not exists ms_aaji date,
  add column if not exists ms_first_closing date;

-- 0016: izinkan tahap interview_hr2 di CHECK constraint
alter table public.recruitment_candidates
  drop constraint if exists recruitment_candidates_stage_check;
alter table public.recruitment_candidates
  add constraint recruitment_candidates_stage_check
  check (stage in (
    'sourcing','screening','followup','interview_hr','interview_hr2',
    'interview_alfred','onboarding','agent'
  ));

-- 0017: rekonsiliasi max_reached (hanya menaikkan yang tertinggal; aman di skala apa pun)
update public.recruitment_candidates set max_reached = 5
  where stage = 'interview_alfred' and max_reached < 5;
update public.recruitment_candidates set max_reached = 6
  where stage = 'onboarding' and max_reached < 6;
update public.recruitment_candidates set max_reached = 7
  where stage = 'agent' and max_reached < 7;

-- Verifikasi cepat (opsional): jumlah agen aktif harus sesuai kenyataan
select stage, count(*) from public.recruitment_candidates
where archived = false group by stage order by stage;
