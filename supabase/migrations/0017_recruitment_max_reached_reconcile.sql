-- Rekonsiliasi max_reached setelah penambahan tahap interview_hr2 (indeks 4).
-- max_reached adalah indeks tahap terjauh yang tersimpan sebagai angka. Menyisipkan
-- interview_hr2 menggeser indeks interview_alfred(→5), onboarding(→6), agent(→7).
--
-- Pendekatan AMAN & universal (tanpa perlu tahu skala data lama): pastikan max_reached
-- minimal = indeks tahap kandidat saat ini. Ini hanya MENAIKKAN nilai yang tertinggal
-- (baris skala-lama), TIDAK pernah menyentuh baris yang sudah benar (max_reached >= indeks).
-- Aman dijalankan berkali-kali (idempoten).
update public.recruitment_candidates set max_reached = 5
  where stage = 'interview_alfred' and max_reached < 5;
update public.recruitment_candidates set max_reached = 6
  where stage = 'onboarding' and max_reached < 6;
update public.recruitment_candidates set max_reached = 7
  where stage = 'agent' and max_reached < 7;
