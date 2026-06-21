-- HRD (selain owner) perlu lihat profil semua karyawan untuk rekap absensi.
-- Perluas policy SELECT profiles agar mencakup can_view_all_attendance() (owner + hrd).
drop policy if exists "profiles_select_self" on public.profiles;

create policy "profiles_select_self" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_owner()
    or public.can_view_all_attendance()
  );
