-- DIAGNOSTIK: menentukan skala `max_reached` data lama setelah penambahan tahap interview_hr2.
-- Jalankan SETELAH migrasi 0015 & 0016 diterapkan, SEBELUM memutuskan backfill 0017.
--
-- Konteks indeks tahap:
--   Lama (7 tahap): sourcing0 screening1 followup2 interview_hr3 interview_alfred4 onboarding5 agent6
--   Baru (8 tahap): sourcing0 screening1 followup2 interview_hr3 interview_hr2(4) interview_alfred5 onboarding6 agent7
--
-- Kandidat SELALU punya max_reached >= indeks tahap saat ini. Jadi baris pada tahap yang
-- indeksnya bergeser (interview_alfred/onboarding/agent) langsung menunjukkan skalanya:
--   agent            → max_reached 6 = skala-LAMA (perlu +1) | 7 = sudah skala-BARU
--   onboarding       → max_reached 5 = skala-LAMA (perlu +1) | 6 = sudah skala-BARU
--   interview_alfred → max_reached 4 = skala-LAMA (perlu +1) | 5 = sudah skala-BARU

select
  stage,
  max_reached,
  count(*) as jumlah,
  case
    when stage = 'agent'            and max_reached = 6 then 'LAMA (perlu +1)'
    when stage = 'agent'            and max_reached >= 7 then 'BARU (ok)'
    when stage = 'onboarding'       and max_reached = 5 then 'LAMA (perlu +1)'
    when stage = 'onboarding'       and max_reached >= 6 then 'BARU (ok)'
    when stage = 'interview_alfred' and max_reached = 4 then 'LAMA (perlu +1)'
    when stage = 'interview_alfred' and max_reached >= 5 then 'BARU (ok)'
    else 'cek manual'
  end as indikasi_skala
from public.recruitment_candidates
where archived = false
  and stage in ('interview_alfred', 'onboarding', 'agent')
group by stage, max_reached
order by stage, max_reached;

-- Interpretasi:
--   • Mayoritas baris "LAMA (perlu +1)"  → terapkan backfill 0017 (skrip di samping).
--   • Mayoritas baris "BARU (ok)"         → JANGAN backfill; data sudah benar.
--   • Campur                              → periksa per-baris; backfill 0017 aman untuk baris LAMA
--                                            karena menggeser BERDASARKAN NILAI (>=4), bukan tahap,
--                                            tetapi konfirmasi dulu tidak ada baris skala-BARU sebelum jalan.
