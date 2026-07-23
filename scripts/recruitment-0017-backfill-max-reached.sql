-- BACKFILL KONDISIONAL — JANGAN jalankan sebelum menjalankan diagnostik
-- (scripts/recruitment-diagnose-max-reached.sql) dan mengonfirmasi data lama berskala-7.
--
-- Sengaja TIDAK ditaruh di supabase/migrations/ agar tidak ikut diterapkan otomatis.
-- Terapkan HANYA SEKALI, saat deploy, SEBELUM ada aktivitas pemindahan tahap baru
-- (moveStage/promoteAgent menulis ulang max_reached pada skala BARU, jadi baris baru
--  tidak boleh ikut digeser).
--
-- Efek: menggeser nilai yang menunjuk tahap di ATAU setelah titik sisip interview_hr2 (indeks 4).
--   lama interview_alfred(4) → baru 5
--   lama onboarding(5)       → baru 6
--   lama agent(6)            → baru 7
--   lama <=interview_hr(3)   → tidak berubah
--
-- Cara jalan (setelah perbaiki kredensial DB di .env.local):
--   node --env-file=.env.local scripts/db-migrate.mjs scripts/recruitment-0017-backfill-max-reached.sql

update public.recruitment_candidates
set max_reached = max_reached + 1
where max_reached >= 4;
