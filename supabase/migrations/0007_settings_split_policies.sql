drop policy if exists "settings_write" on public.settings;

create policy "settings_insert" on public.settings for insert
  with check (public.is_owner());

create policy "settings_update" on public.settings for update
  using (public.is_owner()) with check (public.is_owner());
